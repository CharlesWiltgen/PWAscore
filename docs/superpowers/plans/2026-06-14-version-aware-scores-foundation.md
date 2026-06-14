# Version-Aware Scores — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the storage-free data layer that lets any browser version be resolved and scored — a release-list source, version-keyed support resolution, and a score-over-time series helper — without changing any UI.

**Architecture:** Three pure/additive layers. (1) `getBrowserReleases` reads MDN BCD's `browsers[*].releases` and returns a windowed, channel-classified version list. (2) `useBrowserSupport` gains a per-browser version-keyed cache and an additive `loadSupportAtVersion` that resolves support at an explicit version, leaving the existing current-version path untouched. (3) `useBrowserScore` gains `calculateScoreSeries`, a pure helper that maps a release list to weighted scores by reusing the existing `calculateBrowserScore`. All four tasks are TDD, independently testable, and carry no visible UI change.

**Tech Stack:** Nuxt 4 / Vue 3, TypeScript, Valibot (runtime validation), Vitest (`vitest run`), MDN BCD 8.0.3.

**Spec:** `docs/superpowers/specs/2026-06-14-version-aware-scores-design.md` · **Tracking:** `PWAscore-2b1`

> **Test command convention:** run a single file with `pnpm run test <path>` (e.g. `pnpm run test app/utils/canIUseLoader.test.ts`). Do NOT use `pnpm run test -- <pattern>` — the `--` is swallowed and runs the whole suite. Filter to one test by name with `pnpm exec vitest run <path> -t "<name>"`.

---

## File Structure

| File                                        | Responsibility                                                                                               | Task |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---- |
| `app/schemas/canIUse.ts`                    | Add `BcdReleaseSchema` + `safeParseBcdRelease` for the BCD `browsers[*].releases` entry shape                | 1    |
| `app/utils/canIUseLoader.ts`                | Add `ReleaseChannel`, `BrowserRelease`, `getBrowserReleases()` (reuses `loadMdnBcdData`, `compareVersions`)  | 2    |
| `app/utils/canIUseLoader.test.ts`           | Tests for `getBrowserReleases` (mocked BCD fetch)                                                            | 2    |
| `app/composables/useBrowserSupport.ts`      | Per-browser version-keyed cache (`baseKey`/`versionedKey`), additive `loadSupportAtVersion` + `getSupportAt` | 3    |
| `app/composables/useBrowserSupport.test.ts` | Version-collision + default-path-unchanged tests                                                             | 3    |
| `app/composables/useBrowserScore.ts`        | Add `ScorePoint` + `calculateScoreSeries` (reuses `calculateBrowserScore`)                                   | 4    |
| `app/composables/useBrowserScore.test.ts`   | Score-series tests                                                                                           | 4    |

The UI layer (`PWAFeatureBrowser.vue` and i18n) is a **separate follow-on plan** — see "Phases 4–6" at the end.

---

## Task 1: BCD release-entry schema

**Files:**

- Modify: `app/schemas/canIUse.ts`

- [ ] **Step 1: Write the failing test**

Add to `app/schemas/canIUse.ts` is validated indirectly; write a focused test file `app/schemas/canIUse.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { safeParseBcdRelease } from './canIUse'

describe('safeParseBcdRelease', () => {
  test('accepts a dated released entry', () => {
    const r = safeParseBcdRelease({
      release_date: '2026-03-24',
      status: 'current'
    })
    expect(r).toEqual({
      success: true,
      data: { release_date: '2026-03-24', status: 'current' }
    })
  })

  test('accepts a null release_date (unreleased/preview)', () => {
    const r = safeParseBcdRelease({ release_date: null, status: 'beta' })
    expect(r.success).toBe(true)
  })

  test('accepts a missing status and missing release_date', () => {
    const r = safeParseBcdRelease({})
    expect(r.success).toBe(true)
  })

  test('rejects a numeric release_date (wrong type)', () => {
    const r = safeParseBcdRelease({ release_date: 20260324 })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test app/schemas/canIUse.test.ts`
Expected: FAIL — `safeParseBcdRelease` is not exported.

- [ ] **Step 3: Implement the schema and helper**

Add to `app/schemas/canIUse.ts`, after `MdnBcdFeatureSchema` (around line 78):

```ts
/**
 * MDN BCD browser release entry: bcd.browsers[key].releases[version]
 * Only the fields we consume are modeled; extra fields are ignored.
 */
export const BcdReleaseSchema = v.looseObject({
  release_date: v.optional(v.nullable(v.string())),
  status: v.optional(v.string())
})

export type BcdRelease = v.InferOutput<typeof BcdReleaseSchema>
```

Add the helper near the other `safeParse*` functions (after `safeParseBrowserSupport`):

```ts
/**
 * Validate a single BCD browser release entry
 */
export function safeParseBcdRelease(data: unknown): {
  success: boolean
  data?: BcdRelease
  error?: string
} {
  const result = v.safeParse(BcdReleaseSchema, data)
  if (result.success) {
    return { success: true, data: result.output }
  }
  return {
    success: false,
    error: `BCD release validation failed: ${JSON.stringify(v.flatten<typeof BcdReleaseSchema>(result.issues), null, 2)}`
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test app/schemas/canIUse.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/schemas/canIUse.ts app/schemas/canIUse.test.ts
git commit -m "feat(data): add BCD release-entry schema for version lists"
```

---

## Task 2: `getBrowserReleases` — windowed, channel-classified version list

**Files:**

- Modify: `app/utils/canIUseLoader.ts`
- Modify: `app/utils/canIUseLoader.test.ts`

**Algorithm (handles Safari's 18→26 version jump by windowing on _distinct majors present_, not arithmetic):**

1. Validate `bcd.browsers[browserId].releases` entries with `safeParseBcdRelease`; skip entries whose version has a non-numeric major.
2. Split into `atOrBelow` (`compareVersions(version, currentVersion) <= 0`) and `above`.
3. For `atOrBelow`, keep the latest version per major number. Take the last `recentMajors` distinct majors. → one representative release per windowed major (the current version is the latest of its major, so it is included).
4. From `above`, keep only beta/upcoming entries (`status` ∈ `beta`/`nightly`/`planned`, or `release_date` null).
5. Concatenate, sort ascending via `compareVersions`, and classify `channel`: `current` if version equals `currentVersion`; else `beta` if beta/upcoming; else `released`.

- [ ] **Step 1: Write the failing test**

Add to `app/utils/canIUseLoader.test.ts`:

```ts
import { getBrowserReleases } from './canIUseLoader'

describe('getBrowserReleases', () => {
  function stubBcd(browsers: Record<string, unknown>) {
    clearCaches()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ browsers })
      })
    )
  }

  test('windows to recent majors, marks current, and surfaces beta/preview above current', async () => {
    stubBcd({
      safari_ios: {
        releases: {
          '17.0': { release_date: '2023-09-18', status: 'retired' },
          '18.5': { release_date: '2025-05-12', status: 'retired' },
          '26.3': { release_date: '2026-02-11', status: 'retired' },
          '26.4': { release_date: '2026-03-24', status: 'current' },
          '26.5': { release_date: null, status: 'beta' },
          '27': { release_date: null, status: 'planned' }
        }
      }
    })

    const releases = await getBrowserReleases('safari_ios', '26.4', 8)

    expect(releases).toEqual([
      { version: '17.0', releaseDate: '2023-09-18', channel: 'released' },
      { version: '18.5', releaseDate: '2025-05-12', channel: 'released' },
      { version: '26.4', releaseDate: '2026-03-24', channel: 'current' },
      { version: '26.5', releaseDate: null, channel: 'beta' },
      { version: '27', releaseDate: null, channel: 'beta' }
    ])

    vi.unstubAllGlobals()
    clearCaches()
  })

  test('limits to the last N distinct majors at or below current', async () => {
    const releases: Record<string, unknown> = {}
    for (let major = 1; major <= 12; major++) {
      releases[`${major}`] = {
        release_date: `20${10 + major}-01-01`,
        status: 'retired'
      }
    }
    stubBcd({ chrome: { releases } })

    const result = await getBrowserReleases('chrome', '12', 8)

    expect(result.map((r) => r.version)).toEqual([
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12'
    ])

    vi.unstubAllGlobals()
    clearCaches()
  })

  test('returns [] when the browser key is absent', async () => {
    stubBcd({})
    const result = await getBrowserReleases('safari_ios', '26.4', 8)
    expect(result).toEqual([])
    vi.unstubAllGlobals()
    clearCaches()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test app/utils/canIUseLoader.test.ts`
Expected: FAIL — `getBrowserReleases` is not exported.

- [ ] **Step 3: Implement the types and function**

In `app/utils/canIUseLoader.ts`, add the import for `safeParseBcdRelease` to the existing schema import block (top of file):

```ts
import {
  safeParseCanIUseData,
  safeParseMdnBcdFeature,
  safeParseBcdRelease,
  type CanIUseData as ValidatedCanIUseData
} from '../schemas/canIUse'
```

Merge `BrowserId` into the existing `SupportLevel` type import on line 6 — do NOT add a second `import type` statement from the same module (it would trip ESLint `no-duplicate-imports` at the precommit gate). `import type` is erased, so this adds no runtime cycle (same pattern already used for `SupportLevel`):

```ts
// line 6 — change FROM:
import type { SupportLevel } from '../composables/useBrowserSupport'
// TO:
import type { SupportLevel, BrowserId } from '../composables/useBrowserSupport'
```

Add near the bottom of the file (after `getMdnUrlFromBcd`):

```ts
export type ReleaseChannel = 'released' | 'current' | 'beta'

export interface BrowserRelease {
  version: string
  releaseDate: string | null
  channel: ReleaseChannel
}

const RECENT_MAJORS = 8
const UPCOMING_STATUSES = new Set(['beta', 'nightly', 'planned'])

function majorOf(version: string): number {
  return Number.parseInt(version.split('.')[0] ?? '', 10)
}

/**
 * Get a windowed, channel-classified release list for a browser from MDN BCD.
 * Sourced from bcd.browsers[browserId].releases (CIU lacks mobile evergreen history).
 * Returns ascending by version; [] on error or unknown browser key.
 */
export async function getBrowserReleases(
  browserId: BrowserId,
  currentVersion: string,
  recentMajors: number = RECENT_MAJORS
): Promise<BrowserRelease[]> {
  try {
    const data = (await loadMdnBcdData()) as {
      browsers?: Record<string, { releases?: Record<string, unknown> }>
    }
    const rawReleases = data.browsers?.[browserId]?.releases
    if (!rawReleases) {
      return []
    }

    type Parsed = {
      version: string
      releaseDate: string | null
      upcoming: boolean
    }
    const parsed: Parsed[] = []
    for (const [version, info] of Object.entries(rawReleases)) {
      if (Number.isNaN(majorOf(version))) continue // skip TP and non-numeric
      const result = safeParseBcdRelease(info)
      if (!result.success || !result.data) continue
      const releaseDate = result.data.release_date ?? null
      const upcoming =
        releaseDate === null ||
        (result.data.status !== undefined &&
          UPCOMING_STATUSES.has(result.data.status))
      parsed.push({ version, releaseDate, upcoming })
    }

    const atOrBelow = parsed.filter(
      (r) => compareVersions(r.version, currentVersion) <= 0
    )
    const above = parsed.filter(
      (r) => compareVersions(r.version, currentVersion) > 0 && r.upcoming
    )

    // Latest representative release per major, among atOrBelow.
    const latestPerMajor = new Map<number, Parsed>()
    for (const r of atOrBelow) {
      const major = majorOf(r.version)
      const existing = latestPerMajor.get(major)
      if (!existing || compareVersions(r.version, existing.version) > 0) {
        latestPerMajor.set(major, r)
      }
    }
    const windowedMajors = [...latestPerMajor.keys()]
      .sort((a, b) => a - b)
      .slice(-recentMajors)
    const belowReleases = windowedMajors.map((m) => latestPerMajor.get(m)!)

    const combined = [...belowReleases, ...above].sort((a, b) =>
      compareVersions(a.version, b.version)
    )

    return combined.map((r) => ({
      version: r.version,
      releaseDate: r.releaseDate,
      channel:
        r.version === currentVersion
          ? 'current'
          : r.upcoming
            ? 'beta'
            : 'released'
    }))
  } catch (error) {
    console.error(`[BCD] Error getting releases for ${browserId}:`, error)
    return []
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test app/utils/canIUseLoader.test.ts`
Expected: PASS (existing tests + 3 new `getBrowserReleases` tests).

- [ ] **Step 5: Run typecheck**

Run: `pnpm run typecheck`
Expected: no errors (confirms the `import type { BrowserId }` introduces no cycle).

- [ ] **Step 6: Commit**

```bash
git add app/utils/canIUseLoader.ts app/utils/canIUseLoader.test.ts
git commit -m "feat(data): add getBrowserReleases windowed version list from MDN BCD"
```

---

## Task 3: Version-keyed support cache + `loadSupportAtVersion`

**Files:**

- Modify: `app/composables/useBrowserSupport.ts`
- Modify: `app/composables/useBrowserSupport.test.ts`

**Design:** Extract the existing cache-key formula into a `baseKey` helper (no behavior change), add `versionedKey`, and add an additive async `loadSupportAtVersion` that resolves support at an explicit version (pinning the relevant _brand_ field of `BrowserVersions`) plus a synchronous `getSupportAt` reader. The existing `getSupport`/`loadSupport`/`loadMultipleSupport` signatures and behavior are unchanged.

A "version" pins a brand: `chrome_android` and `chrome` both map to the `chrome` field of `BrowserVersions`; `firefox_*`→`firefox`; `safari*`→`safari`. This matches how `getCanIUseSupport`/`getMdnBcdSupport` already consume `BrowserVersions`.

- [ ] **Step 1: Write the failing test**

This suite mocks the loader at module scope (`vi.mock('../utils/canIUseLoader', () => ({ getBrowserVersions, getCanIUseSupport, getMdnBcdSupport, getMdnUrlFromBcd }))`, all `vi.fn()`s) — do NOT use `vi.spyOn` on a namespace import; ESM named imports inside `useBrowserSupport.ts` won't be intercepted by it. Override behavior on the already-mocked `vi.fn` via `vi.mocked(...)`. Those named imports resolve to the SAME `vi.fn` instance the composable calls internally, so the override takes effect.

First add a value import of the two mocked functions near the top of the file (the file currently imports only `type { BrowserVersions }` from the loader):

```ts
import { getMdnBcdSupport, getBrowserVersions } from '../utils/canIUseLoader'
```

Then add this `describe` block (sibling to the existing `describe('useBrowserSupport', ...)`). Its own `beforeEach(vi.clearAllMocks)` resets call counts so `toHaveBeenCalledTimes` is accurate; `clearAllMocks` does not wipe implementations, so per-test `mockImplementation` overrides stand:

```ts
describe('loadSupportAtVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('resolves and caches support at an explicit version, pinning the brand field', async () => {
    vi.mocked(getBrowserVersions).mockResolvedValue({
      chrome: '146',
      firefox: '148',
      safari: '26.4'
    })
    vi.mocked(getMdnBcdSupport).mockImplementation(async (_path, versions) => ({
      chrome_android: 'unknown' as const,
      firefox_android: 'unknown' as const,
      safari_ios:
        versions.safari === '18'
          ? ('not-supported' as const)
          : ('supported' as const),
      chrome: 'unknown' as const,
      firefox: 'unknown' as const,
      safari: 'unknown' as const
    }))

    const { loadSupportAtVersion, getSupportAt } = useBrowserSupport()
    const feature = { id: 'badging', mdnBcdPath: 'api.Navigator.setAppBadge' }

    await loadSupportAtVersion([feature], 'safari_ios', '18')
    await loadSupportAtVersion([feature], 'safari_ios', '26.4')

    // Both versions cached independently — no collision.
    expect(
      getSupportAt(
        'safari_ios',
        'badging',
        undefined,
        'api.Navigator.setAppBadge',
        '18'
      ).safari_ios
    ).toBe('not-supported')
    expect(
      getSupportAt(
        'safari_ios',
        'badging',
        undefined,
        'api.Navigator.setAppBadge',
        '26.4'
      ).safari_ios
    ).toBe('supported')
    expect(vi.mocked(getMdnBcdSupport)).toHaveBeenCalledTimes(2)
  })

  test('getSupportAt without a version delegates to the current-version getSupport', () => {
    const { getSupportAt } = useBrowserSupport()
    // Nothing loaded → unknown, same as the default getSupport contract.
    expect(getSupportAt('safari_ios', 'unloaded').safari_ios).toBe('unknown')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: FAIL — `loadSupportAtVersion`/`getSupportAt` are not returned by `useBrowserSupport`.

- [ ] **Step 3: Implement the helpers and functions**

In `app/composables/useBrowserSupport.ts`:

Add a brand map and key helpers above `useBrowserSupport` (after `MANUAL_SUPPORT`, ~line 80):

```ts
type BrandKey = 'chrome' | 'firefox' | 'safari'

const BRAND_BY_BROWSER: Record<BrowserId, BrandKey> = {
  chrome: 'chrome',
  chrome_android: 'chrome',
  firefox: 'firefox',
  firefox_android: 'firefox',
  safari: 'safari',
  safari_ios: 'safari'
}

function baseKey(
  featureId: string,
  canIUseId?: string,
  mdnBcdPath?: string
): string {
  return mdnBcdPath && canIUseId
    ? `${canIUseId}|${mdnBcdPath}`
    : canIUseId || mdnBcdPath || featureId
}

function versionedKey(base: string, brand: BrandKey, version: string): string {
  return `${base}@${brand}=${version}`
}

function hasKnownSupport(s: {
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
}): boolean {
  return (
    s.chrome_android !== 'unknown' ||
    s.firefox_android !== 'unknown' ||
    s.safari_ios !== 'unknown' ||
    s.chrome !== 'unknown' ||
    s.firefox !== 'unknown' ||
    s.safari !== 'unknown'
  )
}
```

Refactor the two existing key computations in `getSupport` (lines ~126-129) and `loadSupport` (lines ~158-161) to call `baseKey(...)` — same value, no behavior change:

```ts
const cacheKey = baseKey(featureId, canIUseId, mdnBcdPath)
```

Add inside `useBrowserSupport`, after `loadMultipleSupport` and before the `return`:

```ts
type FeatureInput = {
  id: string
  canIUseId?: string
  mdnBcdPath?: string
  status?: FeatureStatus
}

/**
 * Load support for features resolved at an explicit version of one browser.
 * Pins that browser's brand field of BrowserVersions; other brands stay current.
 * Writes into a version-keyed cache so versions never collide. Additive — the
 * current-version path (loadSupport/getSupport) is unchanged.
 */
const loadSupportAtVersion = async (
  features: FeatureInput[],
  browserId: BrowserId,
  version: string
): Promise<void> => {
  await loadBrowserVersions()
  const brand = BRAND_BY_BROWSER[browserId]
  // Cast: spread + computed key widens away from BrowserVersions; the brand
  // key is always one of chrome|firefox|safari, so this is sound.
  const versions = {
    ...browserVersions.value,
    [brand]: version
  } as BrowserVersions

  await Promise.all(
    features.map(async (f) => {
      const key = versionedKey(
        baseKey(f.id, f.canIUseId, f.mdnBcdPath),
        brand,
        version
      )
      if (supportCache.value[key]) return

      let resolved: BrowserSupport | null = null

      if (f.mdnBcdPath) {
        try {
          const s = await getMdnBcdSupport(f.mdnBcdPath, versions)
          if (hasKnownSupport(s)) {
            resolved = f.status
              ? { ...UNKNOWN_SUPPORT, ...s, status: f.status }
              : { ...UNKNOWN_SUPPORT, ...s }
          }
        } catch (error) {
          console.error(
            `Failed to load MDN BCD support for ${f.id}@${version}:`,
            error
          )
        }
      }

      if (!resolved && f.canIUseId) {
        try {
          const s = await getCanIUseSupport(f.canIUseId, versions)
          if (hasKnownSupport(s)) {
            resolved = f.status
              ? { ...UNKNOWN_SUPPORT, ...s, status: f.status }
              : { ...UNKNOWN_SUPPORT, ...s }
          }
        } catch (error) {
          console.error(
            `Failed to load CanIUse support for ${f.id}@${version}:`,
            error
          )
        }
      }

      supportCache.value[key] =
        resolved ?? MANUAL_SUPPORT[f.id] ?? UNKNOWN_SUPPORT
    })
  )
}

/**
 * Synchronously read support at an explicit version (after loadSupportAtVersion).
 * With no version, delegates to the current-version getSupport.
 */
const getSupportAt = (
  browserId: BrowserId,
  featureId: string,
  canIUseId?: string,
  mdnBcdPath?: string,
  version?: string
): BrowserSupport => {
  if (!version) {
    return getSupport(featureId, canIUseId, mdnBcdPath)
  }
  const brand = BRAND_BY_BROWSER[browserId]
  const key = versionedKey(
    baseKey(featureId, canIUseId, mdnBcdPath),
    brand,
    version
  )
  return supportCache.value[key] ?? MANUAL_SUPPORT[featureId] ?? UNKNOWN_SUPPORT
}
```

Add both to the returned object:

```ts
return {
  getSupport,
  getSupportAt,
  loadSupport,
  loadSupportAtVersion,
  loadMultipleSupport,
  loadBrowserVersions,
  browserVersions,
  isLoading
}
```

Ensure `FeatureStatus` is imported (it already is, via the existing `import { ... type FeatureStatus } from '../utils/canIUseLoader'`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: PASS (existing tests unchanged + 2 new).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useBrowserSupport.ts app/composables/useBrowserSupport.test.ts
git commit -m "feat(data): version-keyed support cache and loadSupportAtVersion"
```

---

## Task 4: `calculateScoreSeries` — derived scores across releases

**Files:**

- Modify: `app/composables/useBrowserScore.ts`
- Modify: `app/composables/useBrowserScore.test.ts`

**Design:** A pure helper that maps a release list to weighted scores by calling the existing `calculateBrowserScore` once per release with a version-pinned `getSupportFn`. Injecting `getSupportAt` (version → getSupportFn) keeps it pure and unit-testable, mirroring how `calculateBrowserScore` already injects `getSupportFn`.

- [ ] **Step 1: Write the failing test**

Add to `app/composables/useBrowserScore.test.ts` (the file already imports `describe/expect/test`, `PWAFeatureGroup`, `BrowserSupport`, `useBrowserScore`):

```ts
import { compareVersions } from '../utils/canIUseLoader'

describe('calculateScoreSeries', () => {
  const { calculateScoreSeries } = useBrowserScore()

  test('weighted score steps up at the version a feature is added', () => {
    const groups: PWAFeatureGroup[] = [
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
                id: 'feature-0',
                name: 'F0',
                description: 'F0',
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

    const getSupportAt = (version: string) => (): BrowserSupport => ({
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios:
        compareVersions(version, '18') >= 0 ? 'supported' : 'not-supported',
      chrome: 'unknown',
      firefox: 'unknown',
      safari: 'unknown',
      status: { experimental: false, standard_track: true, deprecated: false }
    })

    const releases = [
      { version: '17', releaseDate: '2023-09-18' },
      { version: '18', releaseDate: '2024-09-16' },
      { version: '26', releaseDate: '2025-09-15' }
    ]

    const series = calculateScoreSeries(
      'safari_ios',
      groups,
      releases,
      getSupportAt
    )

    expect(series).toEqual([
      { version: '17', date: '2023-09-18', weighted: 0 },
      { version: '18', date: '2024-09-16', weighted: 100 },
      { version: '26', date: '2025-09-15', weighted: 100 }
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run test app/composables/useBrowserScore.test.ts`
Expected: FAIL — `calculateScoreSeries` is not returned by `useBrowserScore`.

- [ ] **Step 3: Implement the helper**

In `app/composables/useBrowserScore.ts`, add the type after `BrowserScoreResult` (~line 32):

```ts
export interface ScorePoint {
  version: string
  date: string | null
  weighted: number
}
```

Add inside `useBrowserScore`, after `calculateBrowserScore`:

```ts
const calculateScoreSeries = (
  browserId: BrowserId,
  featureGroups: PWAFeatureGroup[],
  releases: Array<{ version: string; releaseDate: string | null }>,
  getSupportAt: (
    version: string
  ) => (
    featureId: string,
    canIUseId?: string,
    mdnBcdPath?: string
  ) => BrowserSupport
): ScorePoint[] =>
  releases.map((r) => ({
    version: r.version,
    date: r.releaseDate,
    weighted: calculateBrowserScore(
      browserId,
      featureGroups,
      getSupportAt(r.version)
    ).weighted
  }))
```

Add to the return:

```ts
return {
  calculateBrowserScore,
  calculateScoreSeries
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm run test app/composables/useBrowserScore.test.ts`
Expected: PASS (existing tests + 1 new).

- [ ] **Step 5: Run the full suite + gates**

Run: `pnpm run test`
Expected: all pass (1 pre-existing skip).
Run: `pnpm run precommit`
Expected: lint + typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useBrowserScore.ts app/composables/useBrowserScore.test.ts
git commit -m "feat(data): add calculateScoreSeries for derived scores over releases"
```

---

## Self-Review

**Spec coverage (foundation portion):**

- "Version list + release dates from BCD `browsers[*].releases`, windowed, beta/preview marked" → Task 2 (`getBrowserReleases`). ✓
- "Per-browser version-keyed cache (`@${browserId}=${version}`)" → Task 3 (`versionedKey` keys by brand, which is the version-bearing axis). ✓
- "New async `loadSupportAtVersion`, existing signatures unchanged" → Task 3. ✓
- "Valibot schema for the releases shape" → Task 1. ✓
- "Score series reusing `calculateBrowserScore`" → Task 4 (`calculateScoreSeries`). ✓
- Safari-27 handling → falls out of Task 2 (a `27`/`beta` entry above current surfaces as `channel: 'beta'`). ✓

**Deferred to the UI plan (not this plan):** async-load-on-version-switch protocol, per-column `getSupportFn`/`getFeatureSupport` rework, the `USelect`, sparkline SVG, expand modal, i18n strings, and the `version_removed` and manual-`*Version` refinements (both flagged as accepted v1 limitations in the spec).

**Type consistency:** `BrowserRelease`/`ReleaseChannel` (Task 2) feed `getBrowserReleases`; `ScorePoint` (Task 4) is independent. `getSupportAt`'s `(browserId, featureId, canIUseId?, mdnBcdPath?, version?)` signature is used consistently in its test. `baseKey`/`versionedKey` are used identically in `loadSupportAtVersion` and `getSupportAt`.

**Placeholder scan:** none — every step has runnable code and an exact command.

---

## Phases 4–6 (follow-on UI plan — NOT in this plan)

Written as a **separate plan after this foundation lands**, because the exact Vue wiring depends on the real signatures produced here, and the spec itself isolates Phase 4a (the async/reactive bridge) as the correctness-critical part to review on its own. Scope of that plan:

| File                                   | Responsibility                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/PWAFeatureBrowser.vue` | Per-column `selectedVersion` refs (default from `getBrowserVersions`); `watch` → `loadSupportAtVersion` + per-column `isVersionLoading` state; rework `browsers`/`featureSupportMap`/`getFeatureSupport` to resolve per-column via `getSupportAt`; version `USelect` (beta/preview badged); inline-SVG sparkline; expand `UModal` |
| `i18n/*`                               | Strings: version-selector label, `beta`/`preview` badges, trend/expand labels                                                                                                                                                                                                                                                     |

Phasing for that plan: **4a** async/reactive bridge + per-column loading (no dropdown yet, version forced via a temporary control or test) → **4b** `USelect` UI → **5** sparkline → **6** expand modal. Each ends green on `pnpm run test` + `pnpm run precommit`.
