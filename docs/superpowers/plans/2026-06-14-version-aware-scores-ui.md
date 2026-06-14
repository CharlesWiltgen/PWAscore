# Version-Aware Scores — UI Layer Implementation Plan (Phases 4–6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-column browser version selector (default = current; beta/preview versions badged) and a score-over-time sparkline (expandable to a full chart) to the PWA feature browser, on top of the already-merged data foundation.

**Architecture:** A new composable `useVersionedBrowsers` owns per-column version state, the release list, async loading on version change, and version-aware support/scores/series — composing the foundation APIs (`getBrowserReleases`, `loadSupportAtVersion`/`getSupportAt`, `calculateScoreSeries`). `PWAFeatureBrowser.vue` consumes it for thin UI wiring (a `USelect` in each header card, a small prop-driven `VersionScoreSparkline.vue`, and a `UModal` for the expanded chart). The default-version path delegates to the existing synchronous `getSupport`, so an untouched column behaves exactly as today.

**Tech Stack:** Nuxt 4 / Vue 3 Composition API, Nuxt UI v4 (`USelect`/`UModal`/`UBadge`), TypeScript, Vitest (`vitest run`, nuxt env), `@vue/test-utils` for component mount tests.

**Spec:** `docs/superpowers/specs/2026-06-14-version-aware-scores-design.md` · **Foundation plan (done):** `docs/superpowers/plans/2026-06-14-version-aware-scores-foundation.md` · **Tracking:** `PWAscore-2b1`

> **Test command convention:** run one file with `pnpm run test <path>` (e.g. `pnpm run test app/composables/useVersionedBrowsers.test.ts`). Do NOT use `pnpm run test -- <pattern>` (the `--` is swallowed → whole suite). A husky pre-commit hook runs `eslint --fix` + `prettier` on staged files automatically.

> **Foundation APIs this plan builds on (already on `main`, verified):**
>
> - `getBrowserReleases(browserId, currentVersion, recentMajors?) => Promise<BrowserRelease[]>` where `BrowserRelease = { version: string; releaseDate: string | null; channel: 'released'|'current'|'beta' }`
> - `useBrowserSupport()` → `{ getSupport, getSupportAt, loadSupport, loadSupportAtVersion, loadMultipleSupport, loadBrowserVersions, browserVersions, isLoading }`. `getSupportAt(browserId, featureId, canIUseId?, mdnBcdPath?, version?)` reads the version-keyed cache; with no `version` it delegates to the current-version `getSupport`. `loadSupportAtVersion(features, browserId, version)` fills that cache.
> - `useBrowserScore()` → `{ calculateBrowserScore, calculateScoreSeries }`. `calculateScoreSeries(browserId, groups, releases, getSupportAt)` returns `ScorePoint[] = { version, releaseDate, weighted }[]`.
> - `BrowserVersions = { chrome: string; firefox: string; safari: string }` (one field per _brand_; `chrome_android`+`chrome` share `chrome`, etc.). `getBrowserVersions()` resolves the current per-brand versions from CIU.

---

## File Structure

| File                                           | Responsibility                                                                                                        | Task |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---- |
| `app/composables/useVersionedBrowsers.ts`      | Per-column version state, release lists, async load on change, version-aware support/scores/sparkline series          | 1–3  |
| `app/composables/useVersionedBrowsers.test.ts` | Unit tests (mocked loader)                                                                                            | 1–3  |
| `app/components/VersionScoreSparkline.vue`     | Pure prop-driven inline-SVG sparkline (`series: ScorePoint[]`)                                                        | 4    |
| `app/components/VersionScoreSparkline.test.ts` | Mount tests                                                                                                           | 4    |
| `app/components/PWAFeatureBrowser.vue`         | Wire the composable: version `USelect` in header, per-column version-aware support/scores, sparkline, expand `UModal` | 5–6  |
| `i18n/locales/en.json`, `i18n/locales/fr.json` | Strings for version selector, beta/preview badges, trend labels                                                       | 7    |

**Brand helper note:** `useVersionedBrowsers` needs to map a `BrowserId` to its `BrowserVersions` brand field. The foundation already defines `BRAND_BY_BROWSER` privately in `useBrowserSupport.ts`. Task 1 Step 0 exports it (a one-line `export` keyword change) so the new composable reuses it rather than redefining the mapping.

---

## Task 1: `useVersionedBrowsers` — version state, releases, default load

**Files:**

- Modify: `app/composables/useBrowserSupport.ts` (export `BRAND_BY_BROWSER`)
- Create: `app/composables/useVersionedBrowsers.ts`
- Create: `app/composables/useVersionedBrowsers.test.ts`

- [ ] **Step 0: Export `BRAND_BY_BROWSER` from `useBrowserSupport.ts`**

Change the existing declaration (currently `const BRAND_BY_BROWSER`) to:

```ts
export const BRAND_BY_BROWSER: Record<
  BrowserId,
  'chrome' | 'firefox' | 'safari'
> = {
  chrome: 'chrome',
  chrome_android: 'chrome',
  firefox: 'firefox',
  firefox_android: 'firefox',
  safari: 'safari',
  safari_ios: 'safari'
}
```

(Only the `export` keyword is added; the `BrandKey` type alias stays internal — inline the union as above so the export is self-contained.)

- [ ] **Step 1: Write the failing test**

Create `app/composables/useVersionedBrowsers.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import {
  getBrowserVersions,
  getBrowserReleases,
  getMdnBcdSupport
} from '../utils/canIUseLoader'
import { useVersionedBrowsers } from './useVersionedBrowsers'

vi.mock('../utils/canIUseLoader', () => ({
  getBrowserVersions: vi.fn(async () => ({
    chrome: '146',
    firefox: '148',
    safari: '26.4'
  })),
  getBrowserReleases: vi.fn(async () => [
    { version: '18.5', releaseDate: '2025-05-12', channel: 'released' },
    { version: '26.4', releaseDate: '2026-03-24', channel: 'current' },
    { version: '26.5', releaseDate: null, channel: 'beta' }
  ]),
  getCanIUseSupport: vi.fn(async () => ({
    chrome_android: 'unknown',
    firefox_android: 'unknown',
    safari_ios: 'unknown',
    chrome: 'unknown',
    firefox: 'unknown',
    safari: 'unknown'
  })),
  getMdnBcdSupport: vi.fn(
    async (_path: string, versions: { safari: string }) => ({
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios: versions.safari === '18.5' ? 'not-supported' : 'supported',
      chrome: 'unknown',
      firefox: 'unknown',
      safari: 'unknown'
    })
  ),
  getMdnUrlFromBcd: vi.fn(async () => undefined)
}))

const GROUPS: PWAFeatureGroup[] = [
  {
    id: 'g',
    name: 'G',
    description: 'G',
    categories: [
      {
        id: 'c',
        name: 'C',
        description: 'C',
        features: [
          {
            id: 'badging',
            name: 'Badging',
            description: 'Badging',
            mdnBcdPath: 'api.Navigator.setAppBadge',
            status: {
              experimental: false,
              standard_track: true,
              deprecated: false
            }
          }
        ]
      }
    ]
  }
]

describe('useVersionedBrowsers', () => {
  beforeEach(() => vi.clearAllMocks())

  test('init loads current versions and per-browser releases, defaulting selection to current', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])

    expect(vb.selectedVersion.value.safari_ios).toBe('26.4')
    expect(vb.releasesByBrowser.value.safari_ios).toEqual([
      { version: '18.5', releaseDate: '2025-05-12', channel: 'released' },
      { version: '26.4', releaseDate: '2026-03-24', channel: 'current' },
      { version: '26.5', releaseDate: null, channel: 'beta' }
    ])
    expect(vi.mocked(getBrowserReleases)).toHaveBeenCalledWith(
      'safari_ios',
      '26.4'
    )
  })

  test('defaultVersionFor maps a browserId to its brand current version', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    expect(vb.defaultVersionFor('safari_ios')).toBe('26.4')
    expect(vb.defaultVersionFor('chrome_android')).toBe('146')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm run test app/composables/useVersionedBrowsers.test.ts`
Expected: FAIL — `useVersionedBrowsers` not found.

- [ ] **Step 3: Implement the composable skeleton**

Create `app/composables/useVersionedBrowsers.ts`:

```ts
import { ref } from 'vue'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import type { BrowserId, BrowserSupport } from './useBrowserSupport'
import { useBrowserSupport, BRAND_BY_BROWSER } from './useBrowserSupport'
import {
  useBrowserScore,
  type BrowserScoreResult,
  type ScorePoint
} from './useBrowserScore'
import { getBrowserReleases, type BrowserRelease } from '../utils/canIUseLoader'

type FeatureInput = {
  id: string
  canIUseId?: string
  mdnBcdPath?: string
  status?: {
    experimental: boolean
    standard_track: boolean
    deprecated: boolean
  }
}

function flattenFeatures(groups: PWAFeatureGroup[]): FeatureInput[] {
  const out: FeatureInput[] = []
  for (const group of groups) {
    for (const category of group.categories) {
      for (const feature of category.features) {
        out.push({
          id: feature.id,
          canIUseId: feature.canIUseId,
          mdnBcdPath: feature.mdnBcdPath,
          status: feature.status
        })
      }
    }
  }
  return out
}

export function useVersionedBrowsers(featureGroups: PWAFeatureGroup[]) {
  const {
    getSupportAt,
    loadSupportAtVersion,
    loadMultipleSupport,
    loadBrowserVersions,
    browserVersions
  } = useBrowserSupport()
  const { calculateBrowserScore, calculateScoreSeries } = useBrowserScore()

  const features = flattenFeatures(featureGroups)

  const selectedVersion = ref<Partial<Record<BrowserId, string>>>({})
  const releasesByBrowser = ref<Partial<Record<BrowserId, BrowserRelease[]>>>(
    {}
  )
  const isVersionLoading = ref<Partial<Record<BrowserId, boolean>>>({})

  const defaultVersionFor = (browserId: BrowserId): string =>
    browserVersions.value[BRAND_BY_BROWSER[browserId]]

  const init = async (browserIds: BrowserId[]): Promise<void> => {
    await loadBrowserVersions()
    await loadMultipleSupport(features)
    await Promise.all(
      browserIds.map(async (id) => {
        const current = defaultVersionFor(id)
        selectedVersion.value = { ...selectedVersion.value, [id]: current }
        releasesByBrowser.value = {
          ...releasesByBrowser.value,
          [id]: await getBrowserReleases(id, current)
        }
      })
    )
  }

  return {
    selectedVersion,
    releasesByBrowser,
    isVersionLoading,
    defaultVersionFor,
    init,
    // extended in Tasks 2 & 3:
    getSupportAt,
    loadSupportAtVersion,
    calculateBrowserScore,
    calculateScoreSeries,
    features
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm run test app/composables/useVersionedBrowsers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useBrowserSupport.ts app/composables/useVersionedBrowsers.ts app/composables/useVersionedBrowsers.test.ts
git commit -m "feat(ui): add useVersionedBrowsers composable — version state and release loading"
```

---

## Task 2: Version-aware support & scores + async load on version change

**Files:**

- Modify: `app/composables/useVersionedBrowsers.ts`
- Modify: `app/composables/useVersionedBrowsers.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `app/composables/useVersionedBrowsers.test.ts`:

```ts
describe('useVersionedBrowsers — version-aware support and scores', () => {
  beforeEach(() => vi.clearAllMocks())

  test('columnSupport at the default version uses the current path (no extra load)', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    // default 26.4 -> supported per the mock
    expect(
      vb.columnSupport(
        'safari_ios',
        'badging',
        undefined,
        'api.Navigator.setAppBadge'
      ).safari_ios
    ).toBe('supported')
  })

  test('setVersion loads support at the chosen version and toggles isVersionLoading', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])

    const promise = vb.setVersion('safari_ios', '18.5')
    expect(vb.isVersionLoading.value.safari_ios).toBe(true)
    await promise
    expect(vb.isVersionLoading.value.safari_ios).toBe(false)

    expect(vb.selectedVersion.value.safari_ios).toBe('18.5')
    // 18.5 -> not-supported per the mock
    expect(
      vb.columnSupport(
        'safari_ios',
        'badging',
        undefined,
        'api.Navigator.setAppBadge'
      ).safari_ios
    ).toBe('not-supported')
  })

  test('setVersion back to the default does not trigger another load', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    vi.clearAllMocks()
    await vb.setVersion('safari_ios', '26.4') // the default
    expect(vi.mocked(getMdnBcdSupport)).not.toHaveBeenCalled()
  })

  test('columnScores computes the weighted score for the column at its selected version', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    expect(vb.columnScores('safari_ios').weighted).toBe(100) // 26.4 -> supported
    await vb.setVersion('safari_ios', '18.5')
    expect(vb.columnScores('safari_ios').weighted).toBe(0) // 18.5 -> not-supported
  })

  test('setVersion keeps the previous score until the new version load resolves (no flash)', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    expect(vb.columnScores('safari_ios').weighted).toBe(100) // default 26.4 -> supported

    const promise = vb.setVersion('safari_ios', '18.5')
    // Before the load resolves: still the old version's score, NOT unknown/0.
    expect(vb.columnScores('safari_ios').weighted).toBe(100)
    expect(vb.selectedVersion.value.safari_ios).toBe('26.4')

    await promise
    expect(vb.selectedVersion.value.safari_ios).toBe('18.5')
    expect(vb.columnScores('safari_ios').weighted).toBe(0) // now 18.5 -> not-supported
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm run test app/composables/useVersionedBrowsers.test.ts`
Expected: FAIL — `columnSupport`/`setVersion`/`columnScores` are not returned.

- [ ] **Step 3: Implement**

In `app/composables/useVersionedBrowsers.ts`, add inside `useVersionedBrowsers` (before the `return`):

```ts
const isDefaultVersion = (
  browserId: BrowserId,
  version: string | undefined
): boolean => !version || version === defaultVersionFor(browserId)

const columnSupport = (
  browserId: BrowserId,
  featureId: string,
  canIUseId?: string,
  mdnBcdPath?: string
): BrowserSupport => {
  const version = selectedVersion.value[browserId]
  return getSupportAt(
    browserId,
    featureId,
    canIUseId,
    mdnBcdPath,
    isDefaultVersion(browserId, version) ? undefined : version
  )
}

// Load-then-swap: for a non-default version, fetch its support BEFORE
// mutating selectedVersion, so the column keeps rendering the previous
// (cached) version's data until the new one is ready — no flash of 163
// unknown rows (spec Unit 2). The default version is already warm from init,
// so it swaps synchronously.
const setVersion = async (
  browserId: BrowserId,
  version: string
): Promise<void> => {
  if (isDefaultVersion(browserId, version)) {
    selectedVersion.value = { ...selectedVersion.value, [browserId]: version }
    return
  }
  isVersionLoading.value = { ...isVersionLoading.value, [browserId]: true }
  try {
    await loadSupportAtVersion(features, browserId, version)
    selectedVersion.value = { ...selectedVersion.value, [browserId]: version }
  } finally {
    isVersionLoading.value = { ...isVersionLoading.value, [browserId]: false }
  }
}

const columnScores = (browserId: BrowserId): BrowserScoreResult =>
  calculateBrowserScore(
    browserId,
    featureGroups,
    (featureId, canIUseId, mdnBcdPath) =>
      columnSupport(browserId, featureId, canIUseId, mdnBcdPath)
  )
```

Add `columnSupport`, `setVersion`, `columnScores` to the returned object (keep the rest).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm run test app/composables/useVersionedBrowsers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useVersionedBrowsers.ts app/composables/useVersionedBrowsers.test.ts
git commit -m "feat(ui): version-aware column support and scores with async load"
```

---

## Task 3: Sparkline series (lazy, memoized)

**Files:**

- Modify: `app/composables/useVersionedBrowsers.ts`
- Modify: `app/composables/useVersionedBrowsers.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `app/composables/useVersionedBrowsers.test.ts`:

```ts
describe('useVersionedBrowsers — sparkline series', () => {
  beforeEach(() => vi.clearAllMocks())

  test('loadSparkline loads support at every release version (once), then sparklineSeries returns a point per release', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])

    await vb.loadSparkline('safari_ios')
    // releases 18.5 (non-default) and 26.5 (non-default) loaded; 26.4 is default (current path)
    expect(vi.mocked(getMdnBcdSupport)).toHaveBeenCalledTimes(2)

    const series = vb.sparklineSeries('safari_ios')
    expect(series).toEqual([
      { version: '18.5', releaseDate: '2025-05-12', weighted: 0 },
      { version: '26.4', releaseDate: '2026-03-24', weighted: 100 },
      { version: '26.5', releaseDate: null, weighted: 100 }
    ])
  })

  test('loadSparkline is memoized — a second call does not reload', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    await vb.loadSparkline('safari_ios')
    vi.clearAllMocks()
    await vb.loadSparkline('safari_ios')
    expect(vi.mocked(getMdnBcdSupport)).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm run test app/composables/useVersionedBrowsers.test.ts`
Expected: FAIL — `loadSparkline`/`sparklineSeries` not returned.

- [ ] **Step 3: Implement**

In `app/composables/useVersionedBrowsers.ts`, add a memo ref near the other refs:

```ts
const sparklineLoaded = ref<Set<BrowserId>>(new Set())
```

Add inside `useVersionedBrowsers` (before `return`):

```ts
const loadSparkline = async (browserId: BrowserId): Promise<void> => {
  if (sparklineLoaded.value.has(browserId)) return
  const releases = releasesByBrowser.value[browserId] ?? []
  await Promise.all(
    releases
      .filter((r) => !isDefaultVersion(browserId, r.version))
      .map((r) => loadSupportAtVersion(features, browserId, r.version))
  )
  sparklineLoaded.value = new Set([...sparklineLoaded.value, browserId])
}

const sparklineSeries = (browserId: BrowserId): ScorePoint[] => {
  const releases = releasesByBrowser.value[browserId] ?? []
  return calculateScoreSeries(
    browserId,
    featureGroups,
    releases.map((r) => ({ version: r.version, releaseDate: r.releaseDate })),
    (version) => (featureId, canIUseId, mdnBcdPath) =>
      getSupportAt(
        browserId,
        featureId,
        canIUseId,
        mdnBcdPath,
        isDefaultVersion(browserId, version) ? undefined : version
      )
  )
}
```

Add `loadSparkline`, `sparklineSeries` to the returned object.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm run test app/composables/useVersionedBrowsers.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run full suite + gates**

Run: `pnpm run test` → all pass (1 pre-existing skip).
Run: `pnpm run precommit` → clean.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useVersionedBrowsers.ts app/composables/useVersionedBrowsers.test.ts
git commit -m "feat(ui): lazy memoized sparkline score series per browser"
```

---

## Task 4: `VersionScoreSparkline.vue` — inline-SVG sparkline component

**Files:**

- Create: `app/components/VersionScoreSparkline.vue`
- Create: `app/components/VersionScoreSparkline.test.ts`

A pure, prop-driven component: given `series: ScorePoint[]`, render an inline SVG polyline normalized to the component box. Dependency-free (no chart lib; satisfies bundle-size P-4).

- [ ] **Step 1: Write the failing test**

Create `app/components/VersionScoreSparkline.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import VersionScoreSparkline from './VersionScoreSparkline.vue'

const series = [
  { version: '18.5', releaseDate: '2025-05-12', weighted: 0 },
  { version: '26.4', releaseDate: '2026-03-24', weighted: 50 },
  { version: '26.5', releaseDate: null, weighted: 100 }
]

describe('VersionScoreSparkline', () => {
  test('renders a polyline with one point per series entry', () => {
    const wrapper = mount(VersionScoreSparkline, {
      props: { series, width: 100, height: 20 }
    })
    const points = wrapper.get('polyline').attributes('points')
    // 3 points => 3 "x,y" pairs
    expect(points?.trim().split(/\s+/).length).toBe(3)
  })

  test('maps weighted 0 to the bottom and 100 to the top of the box (y inverted)', () => {
    const wrapper = mount(VersionScoreSparkline, {
      props: { series, width: 100, height: 20 }
    })
    const pairs = wrapper
      .get('polyline')
      .attributes('points')!
      .trim()
      .split(/\s+/)
    const yOf = (pair: string) => Number(pair.split(',')[1])
    // weighted 0 (first) is at the bottom (max y), weighted 100 (last) at the top (min y=0)
    expect(yOf(pairs[0]!)).toBe(20)
    expect(yOf(pairs[2]!)).toBe(0)
  })

  test('renders nothing drawable for an empty series', () => {
    const wrapper = mount(VersionScoreSparkline, { props: { series: [] } })
    expect(wrapper.find('polyline').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm run test app/components/VersionScoreSparkline.test.ts`
Expected: FAIL — component file does not exist.

- [ ] **Step 3: Implement**

Create `app/components/VersionScoreSparkline.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { ScorePoint } from '../composables/useBrowserScore'

const props = withDefaults(
  defineProps<{ series: ScorePoint[]; width?: number; height?: number }>(),
  { width: 120, height: 28 }
)

// Map each point to an "x,y" pair. x spreads evenly across width; y inverts
// the 0–100 weighted score so higher scores sit higher in the box.
const points = computed(() => {
  const n = props.series.length
  if (n === 0) return ''
  const stepX = n > 1 ? props.width / (n - 1) : 0
  return props.series
    .map((p, i) => {
      const x = Math.round(i * stepX)
      const y = Math.round(props.height - (p.weighted / 100) * props.height)
      return `${x},${y}`
    })
    .join(' ')
})
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    fill="none"
    aria-hidden="true"
    class="overflow-visible"
  >
    <polyline
      v-if="points"
      :points="points"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      class="opacity-70"
    />
  </svg>
</template>
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm run test app/components/VersionScoreSparkline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/VersionScoreSparkline.vue app/components/VersionScoreSparkline.test.ts
git commit -m "feat(ui): add VersionScoreSparkline inline-SVG component"
```

---

## Task 5: Wire version selector + sparkline into `PWAFeatureBrowser.vue`

**Files:**

- Modify: `app/components/PWAFeatureBrowser.vue`

This replaces the shared `getSupport`/`calculateBrowserScore` wiring with the per-column composable, turns the static "Version 26" subtitle into a `USelect`, and renders the sparkline under each score. The default-version path is unchanged behavior.

- [ ] **Step 1: Swap the composables and add per-column state**

In the `<script setup>` of `app/components/PWAFeatureBrowser.vue`:

Replace:

```ts
const { getSupport, loadMultipleSupport } = useBrowserSupport()
const { calculateBrowserScore } = useBrowserScore()
```

with:

```ts
const vb = useVersionedBrowsers(pwaFeatures)
const {
  selectedVersion,
  releasesByBrowser,
  isVersionLoading,
  columnSupport,
  columnScores,
  setVersion,
  loadSparkline,
  sparklineSeries
} = vb
```

Add the import near the other composable imports:

```ts
import { useVersionedBrowsers } from '../composables/useVersionedBrowsers'
```

- [ ] **Step 2: Replace `onMounted` data load + experimental precompute support reads**

In `onMounted`, replace the `loadMultipleSupport(allFeatures)` call (inside the `Promise.all`) with `vb.init(allBrowserIds)` where `allBrowserIds` is every browser id across both platform configs:

```ts
const allBrowserIds = [...mobileBrowserConfig, ...desktopBrowserConfig].map(
  (b) => b.id
)
await Promise.all([
  vb.init(allBrowserIds),
  ...allFeatures.map(async (feature) => {
    if (feature.mdnBcdPath) {
      const url = await getMdnUrlFromBcd(feature.mdnBcdPath)
      mdnUrls.value.set(feature.id, url)
    }
  })
])
```

In the experimental-precompute loop, replace `getSupport(feature.id, feature.canIUseId, feature.mdnBcdPath)` with a current-version read via the first browser (status is version-independent — see spec Unit 2):

```ts
const support = columnSupport(
  'chrome_android',
  feature.id,
  feature.canIUseId,
  feature.mdnBcdPath
)
```

- [ ] **Step 3: Make `browsers` and `getFeatureSupport` version-aware**

Replace the `browsers` computed:

```ts
const browsers = computed(() =>
  activeBrowserConfig.value.map((browser) => ({
    ...browser,
    version: selectedVersion.value[browser.id] ?? browser.version,
    scores: columnScores(browser.id)
  }))
)
```

Replace `featureSupportMap` + `getFeatureSupport` with a per-column getter (drop the precomputed map — `columnSupport` reads an in-memory cache, so per-call is fine). **`browserId` is OPTIONAL** so the existing one-arg call sites that only read `.status` keep compiling — status is version- and column-independent (spec Unit 2), so the default browser is fine for them:

```ts
function getFeatureSupport(
  featureId: string,
  browserId: BrowserId = 'chrome_android'
): BrowserSupport {
  const feature = featureById.get(featureId)
  return columnSupport(
    browserId,
    featureId,
    feature?.canIUseId,
    feature?.mdnBcdPath
  )
}
```

**Call-site audit (do NOT miss these — `turbo typecheck lint` gate G-2 will fail otherwise):** `getFeatureSupport(feature.id)` is called WITHOUT a browser id at three status-icon sites (`PWAFeatureBrowser.vue:811`, `:821-822`, `:832` — `.status?.experimental`, `.status?.standard_track`, `.status?.deprecated`). Those stay one-arg (they use the default and read `.status`, which is the same for every browser). Only the two support-badge sites (`:892`, `:895`) pass `browser.id`, updated in Step 4.

Add a lookup map near the top of `<script setup>`:

```ts
const featureById = new Map(
  pwaFeatures
    .flatMap((g) => g.categories.flatMap((c) => c.features))
    .map((f) => [f.id, f])
)
```

- [ ] **Step 4: Update the template — version `USelect` + sparkline in the header card**

In the header card (`PWAFeatureBrowser.vue`), replace the static version line:

```vue
<div class="text-sm text-gray-500 dark:text-gray-400">
  {{ t('browser.version', { version: browser.version }) }}
</div>
```

with a select + sparkline block:

```vue
<div class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
  <USelect
    :model-value="selectedVersion[browser.id]"
    :items="(releasesByBrowser[browser.id] ?? []).map(r => ({
      label: r.channel === 'released' || r.channel === 'current'
        ? r.version
        : `${r.version} (${t('browser.channel.' + r.channel)})`,
      value: r.version
    }))"
    size="xs"
    :aria-label="t('browser.versionSelect', { name: browser.name })"
    @update:model-value="(v) => setVersion(browser.id, v as string)"
  />
  <span v-if="isVersionLoading[browser.id]" class="animate-pulse">{{ t('browser.loading') }}</span>
</div>
<button
  type="button"
  :class="['mt-1 block', browser.color]"
  :aria-label="t('browser.trendLabel', { name: browser.name })"
  @click="openTrend(browser.id)"
  @mouseenter="loadSparkline(browser.id)"
>
  <VersionScoreSparkline :series="sparklineSeries(browser.id)" />
</button>
```

Update the feature-row support badge call site (currently `getFeatureSupport(feature.id)[browser.id]`) to pass the browser id:

```vue
:color="getSupportBadgeColor(getFeatureSupport(feature.id,
browser.id)[browser.id])"
```

and

```vue
{{ getSupportLabel(getFeatureSupport(feature.id, browser.id)[browser.id]) }}
```

- [ ] **Step 5: Trigger sparkline load for visible browsers (mount + mobile swipe)**

At the end of `onMounted` (after `vb.init`), warm the sparkline for the browsers shown by default:

```ts
visibleBrowsers.value.forEach((b) => loadSparkline(b.id))
```

The header's `@mouseenter="loadSparkline(browser.id)"` (Step 4) won't fire on touch, so on mobile (single-column, swipeable) the newly-shown browser's sparkline would stay empty until tapped. Add a watch so swiping/tab-switching warms it (place near the existing `watch(selectedBrowserIndex, ...)` announce watcher ~line 353):

```ts
watch(visibleBrowsers, (browsers) => {
  browsers.forEach((b) => loadSparkline(b.id))
})
```

- [ ] **Step 6: Verify — full suite, gates, and a headless browser check**

Run: `pnpm run test` → all pass (1 pre-existing skip). The existing composable/data suite must stay green (no regressions from the wiring).
Run: `pnpm run precommit` → clean.
Run the dev server and verify in a headless browser (agent-browser CLI, per project convention): the Safari column shows a version dropdown defaulting to the current version, listing recent versions plus `26.5 (beta)`; selecting `18.5` flips badges/score for that column only; a sparkline renders under each score. Capture a screenshot for the PR.

- [ ] **Step 7: Commit**

```bash
git add app/components/PWAFeatureBrowser.vue
git commit -m "feat(ui): per-column version selector and score sparkline in feature browser"
```

---

## Task 6: Expand-to-full-chart modal

**Files:**

- Modify: `app/components/PWAFeatureBrowser.vue`

Clicking a sparkline opens a `UModal` with a larger chart of that browser's series and hover-for-exact-score. The enlarged chart reuses `VersionScoreSparkline` at a larger size plus per-point labels.

- [ ] **Step 1: Add modal state + open handler**

In `<script setup>`:

```ts
const trendOpen = ref(false)
const trendBrowserId = ref<BrowserId | null>(null)
function openTrend(browserId: BrowserId): void {
  loadSparkline(browserId)
  trendBrowserId.value = browserId
  trendOpen.value = true
}
const trendSeries = computed(() =>
  trendBrowserId.value ? sparklineSeries(trendBrowserId.value) : []
)
```

- [ ] **Step 2: Add the modal markup**

Before the closing root tag of the template:

```vue
<UModal v-model:open="trendOpen" :title="t('browser.trendTitle')">
  <template #body>
    <div class="space-y-3">
      <VersionScoreSparkline :series="trendSeries" :width="480" :height="160" />
      <ul class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <li
          v-for="point in trendSeries"
          :key="point.version"
          class="flex justify-between"
        >
          <span class="text-gray-500 dark:text-gray-400">{{ point.version }}</span>
          <span class="font-medium tabular-nums">{{ point.weighted }}</span>
        </li>
      </ul>
    </div>
  </template>
</UModal>
```

- [ ] **Step 3: Verify**

Run: `pnpm run test` → green. `pnpm run precommit` → clean.
Headless browser: click a sparkline → modal opens showing the larger chart + a per-version score list; close works.

- [ ] **Step 4: Commit**

```bash
git add app/components/PWAFeatureBrowser.vue
git commit -m "feat(ui): expand sparkline to a full score-over-time modal"
```

---

## Task 7: i18n strings

**Files:**

- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/fr.json`

- [ ] **Step 1: Add keys to the `browser` section of `en.json`**

```json
"versionSelect": "Select {name} version",
"trendLabel": "{name} score over time. Press to expand.",
"trendTitle": "Score over time",
"loading": "Loading…",
"channel": { "beta": "beta", "released": "released", "current": "current" }
```

- [ ] **Step 2: Add the same keys to `fr.json` (translated)**

```json
"versionSelect": "Choisir la version de {name}",
"trendLabel": "Score de {name} au fil du temps. Appuyez pour agrandir.",
"trendTitle": "Score au fil du temps",
"loading": "Chargement…",
"channel": { "beta": "bêta", "released": "stable", "current": "actuelle" }
```

- [ ] **Step 3: Verify both locale files are valid JSON and typecheck passes**

Run: `node -e "JSON.parse(require('fs').readFileSync('i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('i18n/locales/fr.json','utf8')); console.log('valid')"`
Run: `pnpm run precommit` → clean (i18n schema, if enforced, accepts the new keys).

- [ ] **Step 4: Commit**

```bash
git add i18n/locales/en.json i18n/locales/fr.json
git commit -m "feat(ui): add i18n strings for version selector and trend"
```

---

## Self-Review

**Spec coverage:**

- "Per-column version selector, default = current" → Task 5 Step 4 (`USelect`), default from Task 1/2 (`selectedVersion` init). ✓
- "Changing version recomputes that column's icons + headline + group badges" → Task 2 (`columnScores`/`columnSupport`) + Task 5 Step 3 (`browsers`/`getFeatureSupport` version-aware). ✓
- "Recent window + beta/preview badged" → release list from foundation `getBrowserReleases`; badge rendering in Task 5 Step 4 (`channel` label). ✓
- "Sparkline under the score, click to expand" → Task 4 (component) + Task 5 (render) + Task 6 (modal). ✓
- "Derived, no storage" → series computed on the fly via `calculateScoreSeries`, no persistence. ✓ The sparkline tracks the same primary `.weighted` score as the headline number, which is invariant to the row-hiding "hide experimental" toggle (the toggle hides feature rows; it never switches the headline or sparkline to `weightedFull`). So the sparkline stays consistent with the headline — it does not visibly change when the toggle flips, which matches current headline behavior. ✓
- "Async load protocol + per-column loading state" → Task 2 (`setVersion` + `isVersionLoading`) + Task 5 Step 4 (loading indicator). ✓
- i18n → Task 7. ✓

**Placeholder scan:** none — every step has concrete code or an exact command. UI behavior steps (Task 5/6 verify) name the exact things to observe in the headless browser.

**Type consistency:** `columnSupport(browserId, featureId, canIUseId?, mdnBcdPath?)`, `columnScores(browserId)`, `setVersion(browserId, version)`, `loadSparkline(browserId)`, `sparklineSeries(browserId)` are used identically across composable, tests, and component. `BrowserRelease`/`ScorePoint`/`BrowserSupport`/`BrowserId` come from the foundation and are imported, not redefined. `getFeatureSupport` gains a second `browserId` param at every call site touched in Task 5 Step 4.

**Open risk to confirm during execution (not a blocker):** `@vue/test-utils` `mount` under the nuxt vitest env has no precedent in this repo (Task 4) — if `mount` needs extra setup, the sparkline can alternatively be tested by importing its `points` logic; prefer the mount test first. Flag as DONE_WITH_CONCERNS if mount needs non-trivial harness work.

---

## What This Plan Does NOT Include (carried forward)

- Persisted snapshots / calendar-time trends (deferred per spec).
- Combined multi-browser overlay chart; `/trends` page.
- `?safari=18` shareable query param.
- The `PWAscore-8ii` cleanups (DRY `resolveSupport`, hoist `FeatureInput`, `getSupportAt` options-object signature, manual `*Version` honoring) — fold in opportunistically while touching these files, but they are not required for this plan.
