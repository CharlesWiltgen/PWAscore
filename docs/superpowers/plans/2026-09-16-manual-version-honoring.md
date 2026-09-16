# Manual `*Version` Honoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the per-browser `*Version` anchors in `manual-browser-support.json` load-bearing at a pinned browser version, so the 17 path-less features stop reporting their current state at every version.

**Architecture:** One pure helper pair (`levelAtAnchor`, `honorManualAnchors`) applied at the single manual-resolution point (`resolveSupport`), plus the three sibling reads that return the raw entry today (`loadSupport`'s path-less short-circuit — deleted, `getSupport`'s sync fast path, `getSupportAt`'s cold-cache fallback). No new data fields, no build step, no new pipeline; the anchors already exist and are already validated.

**Tech Stack:** Nuxt 4 / Vue 3 Composition API, TypeScript, Vitest (`vitest run`, nuxt env), valibot for schema validation.

**Spec:** `docs/superpowers/specs/2026-09-16-manual-version-honoring-design.md` (reviewed; revision `9a02db4`) · **Tracking:** `PWAscore-3ek` · **Predecessor:** `docs/superpowers/specs/2026-06-14-version-aware-scores-design.md:104`

> **Test command convention:** run one file with `pnpm run test <path>` (e.g. `pnpm run test app/composables/useBrowserSupport.test.ts`). Do NOT use `pnpm run test -- <pattern>` (the `--` is swallowed → whole suite). The husky pre-commit hook runs eslint + prettier on staged files automatically.

---

## Baseline (the bug this plan fixes — measured 2026-09-16, before any change)

Offline probe against the current modules (`useBrowserSupport` + `manual-browser-support.json`) — the runnable form of the evidence above, and the exact command Final Verification step 4 re-runs:

```bash
cat > /tmp/3ek-probe.ts <<'EOF'
import { useBrowserSupport } from '/Users/Charles/Projects/PWAscore/app/composables/useBrowserSupport'

const vb = useBrowserSupport()
await vb.loadBrowserVersions()

// Before the fix every line reads `supported`: manual entries ignore the version.
for (const version of ['10.0', '10.1', '15', '26']) {
  await vb.loadSupportAtVersion([{ id: 'apple-pay' }], 'safari_ios', version)
  console.log('apple-pay @ safari_ios', version, '->', vb.getSupportAt({ browserId: 'safari_ios', featureId: 'apple-pay', version }).safari_ios)
}

await vb.loadSupportAtVersion([{ id: 'declarative-web-push' }], 'safari_ios', '16.6')
console.log('declarative-web-push @ safari_ios 16.6 ->', vb.getSupportAt({ browserId: 'safari_ios', featureId: 'declarative-web-push', version: '16.6' }).safari_ios)

const current = vb.getSupport('apple-pay')
console.log('apple-pay (current, sync) ->', current.safari_ios, current.safari)
EOF
pnpm exec jiti /tmp/3ek-probe.ts
```

```
apple-pay @ safari_ios 10.0 -> supported      # anchor is 10.1 → must be not-supported
apple-pay @ safari_ios 10.1 -> supported      # at the anchor → stays supported
apple-pay @ safari_ios 15   -> supported      # fine
apple-pay @ safari_ios 26   -> supported      # fine
declarative-web-push @ safari_ios 16.6 -> supported   # anchor is 18.4 → must be not-supported
apple-pay (current, sync) -> supported supported
```

Live production DOM (badge text read per column, "Show Experimental" on):

| Column             | Version | Declarative Web Push badge today | Must become     |
| ------------------ | ------- | -------------------------------- | --------------- |
| Safari for iOS     | 17.6    | `Supported` (wrong)              | `Not Supported` |
| Safari for iOS     | 18.6    | `Supported`                      | `Supported`     |
| Chrome for Android | 153     | `Not Supported`                  | `Not Supported` |

The badge is the row's `UBadge` (`PWAFeatureBrowser.vue:959-965`); its text comes from `getSupportLabel` → i18n `support.*` (`i18n/locales/en.json:47-50`: `Supported` / `Partial` / `Not Supported` / `Unknown`) and its Nuxt UI color from `getSupportBadgeColor` (`bg-success` / `bg-warning` / `bg-error` / `bg-neutral`). Columns render in the order Chrome, Firefox, Safari in both the mobile and desktop layouts, so the third block is the Safari column.

Read it with the tool that already renders client state — no custom JS needed. This awk pass attributes each badge to its column (tested against the live page):

```bash
export AGENT_BROWSER_SESSION=pwa-3ek
agent-browser read --filter "Declarative Web Push" \
  | awk '/^## /{col=$0} /^Declarative Web Push$/{want=1; next} want && /^(Supported|Partial|Not Supported|Unknown)$/{print col" -> "$0; want=0}'
```

Measured output, Safari for iOS at 16.6 and at 27 (2026-09-16, before any change):

```
## Chrome for Android -> Not Supported
## Firefox for Android -> Not Supported
## Safari for iOS -> Supported          # 16.6: anchor is 18.4 → must become Not Supported
                                       # 27 also reads Supported today, and is correct there
```

Note the recipe's `want` flag skips the `CIU` / `MDN` link lines: path-less features (the ones this change affects) print `name → badge` directly, while BCD-backed rows print `name → CIU → MDN → badge`. Read those blocks rather than a fixed-width grep.

---

## File Structure

| File                                           | Responsibility                                                                                                                       | Task   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `app/composables/useBrowserSupport.test.ts`    | Partial mock of the loader + the honoring/caching test cases                                                                         | 1, 3–6 |
| `app/composables/useVersionedBrowsers.test.ts` | Partial mock of the loader (same reason)                                                                                             | 1      |
| `app/schemas/canIUse.ts`                       | `VersionAnchorSchema` (numeric shape) on the six `<browser>Version` fields                                                           | 2      |
| `app/schemas/canIUse.test.ts`                  | Schema rejects `≤16.4` / `x`, accepts `16.4`                                                                                         | 2      |
| `app/composables/useBrowserSupport.ts`         | `BROWSER_KEYS`, `compareVersions` import, `levelAtAnchor` + `honorManualAnchors`, four read sites, export `DEFAULT_BROWSER_VERSIONS` | 3–7    |
| `app/data/manual-browser-support.data.test.ts` | Dataset guards: anchor shape via schema, no-op at defaults, anchor-level coherence                                                   | 7      |

---

## Task 1: Test harness — partial loader mocks

The composable gains a `compareVersions` import (Task 3). Both consumer test files replace `../utils/canIUseLoader` with a **wholesale** `vi.mock` factory, so that import would be `undefined` and every manual lookup would throw `TypeError: compareVersions is not a function` — including the existing manual-data cases `should return manual support for vendor-specific features`, `should cache manual support lookups`, and `should use manual support when neither CanIUse nor MDN BCD provided`.

**Files:** Modify `app/composables/useBrowserSupport.test.ts`, `app/composables/useVersionedBrowsers.test.ts`

- [ ] **Step 1: Convert both factories to partial mocks**

Change **only the factory opening** in each file and spread the real module; leave every existing stub body and signature exactly as it is (the two files' stubs differ — `useBrowserSupport.test.ts` declares `getMdnBcdSupport(mdnBcdPath, _versions: BrowserVersions)`, `useVersionedBrowsers.test.ts` declares `getMdnBcdSupport(_path, versions: { safari: string })`):

```ts
vi.mock('../utils/canIUseLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/canIUseLoader')>()
  return {
    ...actual
    /* … each file's existing stubs, verbatim … */
  }
})
```

`useVersionedBrowsers.test.ts` additionally keeps its `getBrowserReleases` stub. Pure helpers (`compareVersions`) now resolve to the real implementation.

- [ ] **Step 2: Verify both files still pass, unchanged**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Run: `pnpm run test app/composables/useVersionedBrowsers.test.ts`
Expected: PASS with the same counts as before (12 in `useVersionedBrowsers.test.ts`; `useBrowserSupport.test.ts` unchanged).

- [ ] **Step 3: Commit**

```bash
git add app/composables/useBrowserSupport.test.ts app/composables/useVersionedBrowsers.test.ts
git commit -m "test(support): use partial loader mocks so pure helpers stay real"
```

---

## Task 2: `VersionAnchorSchema` — anchors must be numeric

`compareVersions` coerces non-numeric parts to 0 and treats `x`/`*` as wildcards, so an operator-prefixed anchor **fails open** — measured: `compareVersions('16.6','≥16.4') = 16`, `compareVersions('10.0','≤10.1') = 10`, `compareVersions('10.0','x') = 10`. A curator copying BCD's `'≤16.4'` would therefore read supported at every version with every test green. Reject the shape at data-load time instead.

**Files:** Modify `app/schemas/canIUse.ts`, `app/schemas/canIUse.test.ts`

- [ ] **Step 1: Write the failing schema test**

Add next to the existing `BrowserSupportSchema` cases (~`app/schemas/canIUse.test.ts:220`):

```ts
test('rejects operator-prefixed and wildcard version anchors', () => {
  const base = {
    chrome_android: 'supported' as const,
    firefox_android: 'supported' as const,
    safari_ios: 'supported' as const
  }
  expect(
    safeParseBrowserSupport({ ...base, safari_iosVersion: '16.4' }).success
  ).toBe(true)
  expect(
    safeParseBrowserSupport({ ...base, safari_iosVersion: '≤16.4' }).success
  ).toBe(false)
  expect(
    safeParseBrowserSupport({ ...base, safari_iosVersion: '≥16.4' }).success
  ).toBe(false)
  expect(
    safeParseBrowserSupport({ ...base, safari_iosVersion: 'x' }).success
  ).toBe(false)
})
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `pnpm run test app/schemas/canIUse.test.ts`
Expected: FAIL — `'≤16.4'`, `'≥16.4'`, and `'x'` currently pass validation.

- [ ] **Step 3: Add the schema and apply it to the six anchor fields**

In `app/schemas/canIUse.ts`, above `BrowserSupportSchema`:

```ts
/**
 * A `<browser>Version` anchor is the introduction version of a manual-data
 * feature. It must be numeric: compareVersions coerces operator-prefixed
 * ('≤16.4') and wildcard ('x') strings to 0, which would make every version
 * compare above the anchor and silently disable anchor honoring.
 */
export const VersionAnchorSchema = v.pipe(
  v.string(),
  v.regex(/^\d+(\.\d+)*$/, 'must be a numeric version such as "16.4"')
)
```

Then replace `v.optional(v.string())` with `v.optional(VersionAnchorSchema)` for exactly these six fields: `chrome_androidVersion`, `firefox_androidVersion`, `safari_iosVersion`, `chromeVersion`, `firefoxVersion`, `safariVersion`.

- [ ] **Step 4: Verify the test passes and nothing else broke**

Run: `pnpm run test app/schemas/canIUse.test.ts`
Expected: PASS.
Run: `pnpm run test app/data/manual-browser-support.data.test.ts`
Expected: PASS — the real dataset's 19 anchors are all numeric.

- [ ] **Step 5: Commit**

```bash
git add app/schemas/canIUse.ts app/schemas/canIUse.test.ts
git commit -m "fix(schema): require numeric version anchors so honoring cannot fail open"
```

---

## Task 3: `levelAtAnchor` + `honorManualAnchors`, wired into `resolveSupport`

**Files:** Modify `app/composables/useBrowserSupport.ts`, `app/composables/useBrowserSupport.test.ts`

- [ ] **Step 1: Write the failing tests**

New describe block in `app/composables/useBrowserSupport.test.ts` (uses the exported `resolveSupport` directly — no network, no browser data):

```ts
describe('resolveSupport — manual *Version anchors', () => {
  const versions = (safari: string) => ({
    chrome: '141',
    firefox: '143',
    safari
  })

  test('resolves a path-less feature against its per-browser anchor', async () => {
    expect(
      (await resolveSupport({ id: 'apple-pay' }, versions('10.0'), 't'))
        .safari_ios
    ).toBe('not-supported')
    expect(
      (await resolveSupport({ id: 'apple-pay' }, versions('10.1'), 't'))
        .safari_ios
    ).toBe('supported') // at the anchor
    expect(
      (await resolveSupport({ id: 'apple-pay' }, versions('26'), 't'))
        .safari_ios
    ).toBe('supported')
  })

  test('each key is compared against its own anchor, not the brand anchor', async () => {
    // apple-pay: safari_iosVersion 10.1, safariVersion 11.1 — 11 splits them.
    const support = await resolveSupport(
      { id: 'apple-pay' },
      versions('11'),
      't'
    )
    expect(support.safari).toBe('not-supported') // 11 < 11.1
    expect(support.safari_ios).toBe('supported') // 11 >= 10.1
  })

  test('a key without an anchor is version-invariant', async () => {
    // viewport-control: chrome_androidVersion 18, no chromeVersion.
    const support = await resolveSupport(
      { id: 'viewport-control' },
      { chrome: '10', firefox: '141', safari: '27' },
      't'
    )
    expect(support.chrome).toBe('supported') // no anchor → unchanged
    expect(support.chrome_android).toBe('not-supported') // 10 < 18
  })
})
```

Add the `resolveSupport` import to the test file's import list from `./useBrowserSupport`.

- [ ] **Step 2: Run and confirm they fail**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: FAIL — all three read `supported` (the current raw-entry behavior).

- [ ] **Step 3: Implement the helper and wire the manual branch**

In `app/composables/useBrowserSupport.ts`, add `compareVersions` to the existing `../utils/canIUseLoader` import, then add below `BRAND_BY_BROWSER`:

```ts
const BROWSER_KEYS = [
  'chrome_android',
  'firefox_android',
  'safari_ios',
  'chrome',
  'firefox',
  'safari'
] as const

/**
 * A recorded anchor is a hard floor, mirroring isVersionSupported's rule for a
 * dated BCD version_added: at or above it the recorded level stands, below it
 * the browser did not support the feature. No anchor → the level is
 * version-invariant. Only supported/partial carry meaning below an anchor;
 * an anchor on any other level is data noise (guarded by a data test).
 */
export function levelAtAnchor(
  level: SupportLevel,
  anchor: string | undefined,
  version: string
): SupportLevel {
  if (!anchor || (level !== 'supported' && level !== 'partial')) return level
  return compareVersions(version, anchor) >= 0 ? level : 'not-supported'
}

/** Resolve a manual entry at an explicit BrowserVersions set (see levelAtAnchor). */
export function honorManualAnchors(
  entry: BrowserSupport,
  versions: BrowserVersions
): BrowserSupport {
  const out = { ...entry }
  for (const key of BROWSER_KEYS) {
    out[key] = levelAtAnchor(
      entry[key],
      entry[`${key}Version`],
      versions[BRAND_BY_BROWSER[key]]
    )
  }
  return out
}
```

Then in `resolveSupport`, replace the final line:

```ts
return MANUAL_SUPPORT[feature.id] ?? UNKNOWN_SUPPORT
```

with:

```ts
const manual = MANUAL_SUPPORT[feature.id]
return manual ? honorManualAnchors(manual, versions) : UNKNOWN_SUPPORT
```

- [ ] **Step 4: Verify**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: PASS. `status` on the returned object is unchanged (the spread keeps the entry's own status block), and the BCD/CIU branches are untouched.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useBrowserSupport.ts app/composables/useBrowserSupport.test.ts
git commit -m "feat(support): honor manual *Version anchors in version-aware resolution"
```

---

## Task 4: Delete `loadSupport`'s path-less short-circuit

`loadSupport` returns `MANUAL_SUPPORT[featureId]` verbatim (and caches it) whenever a feature has neither `canIUseId` nor `mdnBcdPath` — bypassing `resolveSupport` entirely.

**Files:** Modify `app/composables/useBrowserSupport.ts`, `app/composables/useBrowserSupport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('a path-less feature resolves through the general path, not a raw manual shortcut', async () => {
  // google-pay anchor: chrome_android 61. Mock a *below-anchor* current version,
  // so a raw shortcut (which ignores versions) would read supported.
  vi.mocked(getBrowserVersions).mockResolvedValueOnce({
    chrome: '1',
    firefox: '143',
    safari: '18.4'
  })
  const { loadSupport } = useBrowserSupport()
  expect((await loadSupport('google-pay')).chrome_android).toBe('not-supported')
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: FAIL — `supported` (the shortcut returns the entry as-is without loading versions).

- [ ] **Step 3: Delete the shortcut**

Remove this block from `loadSupport` (`useBrowserSupport.ts:256-262`):

```ts
// If no data sources, check manual support first
if (!canIUseId && !mdnBcdPath) {
  const manual = MANUAL_SUPPORT[featureId]
  const result = manual || UNKNOWN_SUPPORT
  supportCache.value[cacheKey] = result
  return result
}
```

No replacement: with no paths, `resolveSupport` skips the BCD and CIU branches and lands in the manual branch. The only behavior change is the deliberate `await loadBrowserVersions()` for path-less features (the same await every other feature already pays).

- [ ] **Step 4: Verify the whole file, and that the previous behavior is preserved at current versions**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: PASS — and specifically the pre-existing manual cases (`apple-pay`, `google-pay` at current versions) still pass, proving the deleted shortcut was not load-bearing.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useBrowserSupport.ts app/composables/useBrowserSupport.test.ts
git commit -m "refactor(support): drop the path-less manual shortcut; resolve through one path"
```

---

## Task 5: `getSupport`'s sync fast path — honor, but never cache default-derived levels

`getSupport` is the synchronous render read; before the versions resolve it falls back to `DEFAULT_BROWSER_VERSIONS`. Honoring there is correct, but caching that result onto the unversioned key would pin a default-derived level for the session.

**Files:** Modify `app/composables/useBrowserSupport.ts`, `app/composables/useBrowserSupport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('does not cache default-derived levels before versions load', async () => {
  vi.mocked(getBrowserVersions).mockResolvedValueOnce({
    chrome: '1',
    firefox: '1',
    safari: '1'
  })
  const { getSupport, loadBrowserVersions } = useBrowserSupport()

  // Pre-load: defaults (chrome 141) are above google-pay's anchor 61 → supported,
  // and this read must NOT be cached.
  expect(getSupport('google-pay').chrome_android).toBe('supported')

  await loadBrowserVersions()

  // Post-load the real (mocked) version is 1 → below the anchor. If the pre-load
  // read had been cached, this would still read 'supported'.
  expect(getSupport('google-pay').chrome_android).toBe('not-supported')
})
```

- [ ] **Step 2: Run and confirm it fails**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: FAIL — second assertion reads `supported` (the pre-load read is cached).

- [ ] **Step 3: Honor in the sync branch, guarded by `versionsLoaded`**

Replace the existing manual branch in `getSupport`:

```ts
// Check manual support and cache it
const manual = MANUAL_SUPPORT[featureId]
if (manual) {
  supportCache.value[cacheKey] = manual
  return manual
}
```

with:

```ts
// Check manual support. Honor the entry's anchors with whatever versions are
// known, but only cache once real versions have loaded: a pre-load read is
// answered from DEFAULT_BROWSER_VERSIONS and must not pin that onto the key.
const manual = MANUAL_SUPPORT[featureId]
if (manual) {
  const honored = honorManualAnchors(manual, browserVersions.value)
  if (versionsLoaded.value) supportCache.value[cacheKey] = honored
  return honored
}
```

- [ ] **Step 4: Repoint the existing caching test at the cached path**

The guard changes what `should cache manual support lookups` (`useBrowserSupport.test.ts:110-121`) exercises: it reads `getSupport('google-pay')` twice with no `loadBrowserVersions()` between them, so with the guard neither read writes the cache and the `toEqual` comparison passes on two independently computed objects. That test would no longer fail if manual caching broke. Update it so the cache write is actually pinned:

```ts
test('should cache manual support lookups', async () => {
  const { getSupport, loadBrowserVersions } = useBrowserSupport()
  await loadBrowserVersions() // required: the write only happens post-load
  const first = getSupport('google-pay')
  expect(getSupport('google-pay')).toBe(first) // identity, not deep equality
})
```

- [ ] **Step 5: Verify**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: PASS — the new case above, the updated caching case, and `should return manual support for vendor-specific features`.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useBrowserSupport.ts app/composables/useBrowserSupport.test.ts
git commit -m "fix(support): honor anchors on the sync read without caching pre-load levels"
```

---

## Task 6: `getSupportAt`'s cold-cache fallback

No in-app caller reaches it today (`columnSupport` reads pinned versions only after `setVersion` awaited `loadSupportAtVersion`), but `PWAscore-vbd`'s delta resolution will read pinned versions directly — and the fallback currently returns the pre-honoring entry.

**Files:** Modify `app/composables/useBrowserSupport.ts`, `app/composables/useBrowserSupport.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test('a cold-cache pinned read honors the anchor instead of returning the raw entry', () => {
  const { getSupportAt } = useBrowserSupport()
  expect(
    getSupportAt({
      browserId: 'safari_ios',
      featureId: 'apple-pay',
      version: '10.0'
    }).safari_ios
  ).toBe('not-supported')
  expect(
    getSupportAt({
      browserId: 'safari_ios',
      featureId: 'apple-pay',
      version: '10.1'
    }).safari_ios
  ).toBe('supported')
  // The read answers from manual data only — it must not trigger a load.
  expect(vi.mocked(getMdnBcdSupport)).not.toHaveBeenCalled()
  expect(vi.mocked(getCanIUseSupport)).not.toHaveBeenCalled()
})

test('a pinned read does not disturb the current-version read for a path-less feature', async () => {
  const { loadSupport, loadSupportAtVersion, getSupportAt } =
    useBrowserSupport()
  await loadSupport('apple-pay') // current version (defaults: safari 18.4)
  await loadSupportAtVersion([{ id: 'apple-pay' }], 'safari_ios', '10.0')

  expect(
    getSupportAt({
      browserId: 'safari_ios',
      featureId: 'apple-pay',
      version: '10.0'
    }).safari_ios
  ).toBe('not-supported')
  // The unversioned key is separate and keeps the current-version answer.
  expect(
    getSupportAt({ browserId: 'safari_ios', featureId: 'apple-pay' }).safari_ios
  ).toBe('supported')
})
```

- [ ] **Step 2: Run and confirm they fail**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: FAIL — the first case reads `supported` for 10.0 (raw entry). The second case passes the versioned half (`loadSupportAtVersion` already honors via Task 3) but pins the unversioned-key separation; confirm it is green after Step 3 and report it if it fails earlier.

- [ ] **Step 3: Honor the fallback**

Replace the final line of `getSupportAt`:

```ts
return supportCache.value[key] ?? MANUAL_SUPPORT[featureId] ?? UNKNOWN_SUPPORT
```

with:

```ts
const cached = supportCache.value[key]
if (cached) return cached
const manual = MANUAL_SUPPORT[featureId]
if (!manual) return UNKNOWN_SUPPORT
// Cold cache: answer for the requested version rather than the raw entry.
const versions = {
  ...browserVersions.value,
  [brand]: version
} as BrowserVersions
return honorManualAnchors(manual, versions)
```

(`brand` is already computed in that function.)

- [ ] **Step 4: Verify**

Run: `pnpm run test app/composables/useBrowserSupport.test.ts`
Expected: PASS, including the existing `getSupportAt` cases `resolves and caches support at an explicit version, pinning the brand field` and `getSupportAt without a version delegates to the current-version getSupport`.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useBrowserSupport.ts app/composables/useBrowserSupport.test.ts
git commit -m "fix(support): honor anchors on cold-cache pinned reads"
```

---

## Task 7: Dataset guards

Three dataset guards. All are green on today's data by construction — they are tripwires, not behaviour tests (none can be red-first: two need `honorManualAnchors` from Task 3, and the no-op assertion holds because every anchor already clears the defaults). Their only prerequisite is exporting the constant in Step 1.

**Files:** Modify `app/composables/useBrowserSupport.ts` (export), `app/data/manual-browser-support.data.test.ts`

- [ ] **Step 1: Export the fallback constants**

Change `const DEFAULT_BROWSER_VERSIONS: BrowserVersions = { ... }` to `export const DEFAULT_BROWSER_VERSIONS: BrowserVersions = { ... }`.

- [ ] **Step 2: Write the guards**

Append to `app/data/manual-browser-support.data.test.ts`, adding these imports alongside the existing ones:

```ts
import {
  honorManualAnchors,
  DEFAULT_BROWSER_VERSIONS,
  type BrowserSupport
} from '../composables/useBrowserSupport'

const ANCHORS = [
  'chrome_androidVersion',
  'firefox_androidVersion',
  'safari_iosVersion',
  'chromeVersion',
  'firefoxVersion',
  'safariVersion'
] as const

describe('manual-browser-support anchors', () => {
  // Cast at the source: the JSON import's inferred shape is narrower than the
  // declared BrowserSupport fields, and this keeps the entry type usable below.
  const entries = Object.entries(
    manualSupportData as Record<string, BrowserSupport>
  )
  const withAnchors = entries.flatMap(([id, entry]) =>
    ANCHORS.flatMap((anchor) => (entry[anchor] ? [{ id, entry, anchor }] : []))
  )

  test('the guard itself is not vacuous: 19 anchors are enumerated', () => {
    // Update this number when anchors are added — an empty or partial list would
    // make the two guards below pass without checking anything.
    expect(withAnchors).toHaveLength(19)
  })

  test('every anchor accompanies a supported/partial level on the same key', () => {
    const offenders = withAnchors.filter(({ entry, anchor }) => {
      const level =
        entry[anchor.replace(/Version$/, '') as keyof BrowserSupport]
      return level !== 'supported' && level !== 'partial'
    })
    expect(offenders.map((o) => `${o.id}.${o.anchor}`)).toEqual([])
  })

  test('honoring is a no-op at DEFAULT_BROWSER_VERSIONS (so also at any shipping version)', () => {
    // Fails when an anchor is newer than the pre-load fallback — e.g. a shipped
    // safari_iosVersion "26" against the default Safari 18.4. Fix by refreshing
    // DEFAULT_BROWSER_VERSIONS in useBrowserSupport.ts, not by relaxing this.
    const offenders: string[] = []
    for (const [id, entry] of entries) {
      const honored = honorManualAnchors(entry, DEFAULT_BROWSER_VERSIONS)
      for (const anchor of ANCHORS) {
        const key = anchor.replace(/Version$/, '') as keyof BrowserSupport
        if (entry[anchor] && honored[key] !== entry[key]) {
          offenders.push(`${id}.${key} vs ${entry[anchor]}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 3: Verify**

Run: `pnpm run test app/data/manual-browser-support.data.test.ts`
Expected: PASS — 19 anchors, none above the defaults, none on a non-supported level.

- [ ] **Step 4: Commit**

```bash
git add app/composables/useBrowserSupport.ts app/data/manual-browser-support.data.test.ts
git commit -m "test(data): guard manual anchors — shape, coherence, and no-op at defaults"
```

---

## Final Verification (run before closing `PWAscore-3ek`)

- [ ] **1. Full suite**

Run: `pnpm test`
Expected: all pass — 228 baseline + the new cases, 2 skipped (pre-existing `PWAscore-3o4`).

- [ ] **2. Gates**

Run: `pnpm run lint` → exit 0
Run: `pnpm run typecheck` → exit 0

- [ ] **3. Score history is untouched**

```bash
pnpm run generate-score-history
git diff --stat app/data/score-history.json
git diff app/data/score-history.json | grep -E '^[-+] *"weighted"' || echo "no weighted changes"
```

Expected: **no `"weighted"` lines in the diff.** `generatedAt`, `domainStart`, `domainEnd` and the trailing `releaseDate` of each series derive from the run date (`scripts/generate-score-history.ts:211-215`), so they may move when run on a later day — restore the file if only those moved (`git checkout -- app/data/score-history.json`), and investigate if a `.weighted` moved.

- [ ] **4. Baseline probe flips**

Re-run the probe command from the Baseline section (`pnpm exec jiti /tmp/3ek-probe.ts`) and compare against the recorded pre-change output line by line. Expected after the fix:

```
apple-pay @ safari_ios 10.0 -> not-supported     # flipped (anchor 10.1)
apple-pay @ safari_ios 10.1 -> supported         # unchanged (at the anchor)
apple-pay @ safari_ios 15   -> supported         # unchanged
apple-pay @ safari_ios 26   -> supported         # unchanged
declarative-web-push @ safari_ios 16.6 -> not-supported   # flipped (anchor 18.4)
apple-pay (current, sync) -> supported supported          # unchanged
```

Exactly two lines flip; a third flipped line means an anchor is being applied where it should not be.

- [ ] **5. Live UI check (dev server)**

```bash
export AGENT_BROWSER_SESSION=pwa-3ek
pnpm dev        # binds [::1]:3000 — readiness is the log banner, not a port probe on 127.0.0.1
agent-browser open http://localhost:3000
```

Then, with the **Show Experimental** checkbox checked and the **Notifications & Communication** group expanded (otherwise the row is not rendered):

1. Set the Safari version selector to **17.6**, then read the badges with the Baseline recipe:

```bash
agent-browser read --filter "Declarative Web Push" \
  | awk '/^## /{col=$0} /^Declarative Web Push$/{want=1; next} want && /^(Supported|Partial|Not Supported|Unknown)$/{print col" -> "$0; want=0}'
```

Expected: Chrome `Not Supported`, Firefox `Not Supported`, Safari `Not Supported`. Before the fix the Safari line reads `Supported` — that is the live red baseline measured above.

2. Set the Safari selector to **18.6** and re-run. Expected Safari line: `Supported` (18.6 satisfies the 18.4 anchor).
3. Switch to the **Desktop** layout and repeat at Safari **15.6** (`Not Supported`) and **16.6** (`Supported`). The toggle sits under the layout container, so a bare click reports `covered by <div.lg:flex-1…>` — run `agent-browser scrollintoview @<desktop-ref>` immediately before the click (the skill's overlay guidance). Switching layouts resets each column's version to its default, so re-select the version after switching. Column headings change with the layout: `Chrome for Cross-platform` / `Firefox for Cross-platform` / `Safari for macOS` (desktop) vs `Chrome for Android` / `Firefox for Android` / `Safari for iOS` (mobile); column order is Chrome, Firefox, Safari in both.
4. Confirm the BCD-backed rows are untouched. Expectations differ per layout, measured 2026-09-16 at the same Safari version — the two layouts read different BCD keys (`safari_ios` vs `safari`):

   | Layout                       | Version          | Push API    | Notification API |
   | ---------------------------- | ---------------- | ----------- | ---------------- |
   | Mobile (`Safari for iOS`)    | 16.6             | `Supported` | **`Partial`**    |
   | Desktop (`Safari for macOS`) | 27 (its default) | `Supported` | `Supported`      |

   `Notification API` is `Partial` on iOS because BCD's `api.Notification` for `safari_ios` carries `partial_implementation`; `Push API` has none. Both are BCD answers that manual data never reaches, so **both must be identical before and after this change** — a moved value here is a regression in resolution order, not an intended flip. Chrome for Android at **153** must still read `Not Supported` for Declarative Web Push.

Screenshots are not required; the badge text is the observable. Stop the dev server when done (`hub stop dev` if it was started through hub — the repo's og-image script refuses to build while port 3000 is held).

- [ ] **6. Close out**

```bash
git status          # only intended files
git log --oneline -8
bd close PWAscore-3ek --reason="Manual *Version anchors honored at pinned versions: ..."
```

Push only on explicit user authorization (repo config `no-push`).

---

## Self-Review

**Spec coverage:**

- "at or above the anchor → recorded level, below → not-supported" → Task 3 Step 3 (`levelAtAnchor`), asserted in Task 3 Step 1. ✓
- "anchors only consulted for supported/partial; no anchor → version-invariant" → Task 3 Step 3 + the coherence guard in Task 7. ✓
- "the anchor belongs to the key being read, not the brand" → Task 3 Step 1 (the `versions('11')` case splits `safari` from `safari_ios`). ✓
- "resolution order untouched; never overrides a known BCD/CIU answer" → honored only inside `resolveSupport`'s manual branch (Task 3), with the dormant `push-api`/`notification-api` case verified in the spec — and pinned by the Final Verification step 5.4 table, which expects per-layout BCD answers (`Push API` `Supported`, `Notification API` `Partial` on iOS because `api.Notification` carries `partial_implementation`) to stay put. ✓
- "pinned reads do not collide with current reads" → Task 6 Step 1's second case (versioned read `not-supported` while the unversioned key still answers `supported`), plus the no-load assertion on the cold-cache read. ✓
- "current-version path unchanged" → Task 4 Step 4 (existing manual cases), Task 5 Step 4/5 (including the repointed caching test), and the no-op guard in Task 7. ✓
- "no primary score or score-history movement" → Final Verification step 3. ✓
- Fail-open risk → Task 2 (schema) — the finding that came out of spec review. ✓

**Placeholder scan:** none — every step has concrete code, an exact command, and an expected result. Two steps say "keep the existing body verbatim" (Task 1) because the mock bodies must not be rewritten; that is an instruction, not a placeholder.

**Type consistency:** `levelAtAnchor(level, anchor, version)` and `honorManualAnchors(entry, versions)` are used with the same signatures in the composable, both test files, and the data guard. `BROWSER_KEYS` is `as const` so `entry[`${key}Version`]` resolves to the declared optional string fields; `BrowserSupport`/`BrowserVersions`/`SupportLevel` are imported, not redefined. `DEFAULT_BROWSER_VERSIONS` stays typed `BrowserVersions`.

**Risk to watch during execution:** the Task 5 test asserts a _pre-load_ read value, which depends on `DEFAULT_BROWSER_VERSIONS` (chrome 141 > google-pay's anchor 61). If someone refreshes that constant below an anchor later, the guard in Task 7 fails first and points at the constant — the intended failure mode.

---

## What This Plan Does NOT Include (carried forward)

- **`version_removed`** stays ignored (inherited from `isVersionSupported`).
- **Data curation for anchor-less keys** (`viewport-control`/`https-requirement` desktop, `same-origin-policy`, `background-audio`, `window-controls-overlay` chrome, `jump-list`/`quick-actions` chrome, `proximity` firefox_android) — they stay version-invariant until anchors are sourced.
- **Refreshing `DEFAULT_BROWSER_VERSIONS`** (chrome 141 / firefox 143 / safari 18.4, stale against shipping 153/155/27) — harmless today because it is only a pre-load fallback and every anchor clears it; do it if a mid-range anchor is ever added.
- **The release-deltas feature itself** (`PWAscore-vbd`) — this plan only removes the limitation its spec documents.
