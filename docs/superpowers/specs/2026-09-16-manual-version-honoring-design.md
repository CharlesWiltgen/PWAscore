# Manual `*Version` Honoring — "the version selector means what it says"

**Goal:** Make the per-browser `*Version` anchors in `manual-browser-support.json` load-bearing when a browser version is pinned, so a path-less feature resolves at the version being viewed instead of reporting its current state at every version. Declarative Web Push reads as a miss below Safari iOS 18.4 / desktop Safari 16 and then appears as a genuine delta at the release that shipped it.

**Tracking:** `PWAscore-3ek` (deferred refinement of the June foundation, `docs/superpowers/specs/2026-06-14-version-aware-scores-design.md:104`, corrected by `6256990`)

---

## Requirements

- When a browser version is pinned, a manual entry's level for each browser key is derived from that key's recorded anchor: **at or above the anchor → the recorded level; below it → `not-supported`**.
- Anchors are consulted **only** when the recorded level is `supported` or `partial`. A key with no anchor is version-invariant (unchanged from today).
- The anchor field belongs to the **key being read**, not to the brand: `safari_iosVersion` for `safari_ios`, `safariVersion` for `safari` — they differ (`apple-pay`: 10.1 vs 11.1), and each is compared against the pinned version of that key's brand (`versions[BRAND_BY_BROWSER[key]]`), the same brand-pinning convention `loadSupportAtVersion` already documents. Consumers read only the queried key.
- Resolution order is untouched: **MDN BCD → CanIUse → manual**. Honoring shapes the manual result, it never overrides a known BCD or CIU answer. (`push-api`/`notification-api` are BCD-backed, so their anchors stay dormant fallbacks.)
- `status` is untouched — anchors are version-independent metadata, and the experimental/standard-track/deprecated flags keep driving the primary-score exclusion.
- The current-version path is unchanged **by construction**, because every anchor is an introduction version and therefore at or below any shipping version. This is asserted, not assumed (see Tests).

---

## Why `not-supported` and not `unknown`

`isVersionSupported` (`app/utils/canIUseLoader.ts:733-742`) already decides dated introductions for the primary source: `compareVersions(current, version_added) >= 0 ? 'supported' : 'not-supported'`. A dated anchor is a hard floor, not a data gap — the `unknown` level exists for `version_added: null`, missing sub-features, and empty arrays. Honoring with `unknown` would additionally be wrong in scoring: `calculateBrowserScore` drops `unknown` features from **both** the denominator and the numerator (`useBrowserScore.ts:132`), so it would silently reward a browser for lacking a feature, while `not-supported` scores 0 in the denominator. The release-deltas spec's softer "added (per data start)" copy is for the anchor-less data-gap case and must not be triggered here.

---

## Computation model

One helper, one resolution path — the same DRY shape `ee189a8` established:

```ts
// useBrowserSupport.ts
// A recorded anchor is a hard floor (mirrors isVersionSupported's dated-version
// rule): at or above it the recorded level stands, below it support did not exist.
function levelAtAnchor(
  level: SupportLevel,
  anchor: string | undefined,
  version: string
): SupportLevel {
  if (!anchor || (level !== 'supported' && level !== 'partial')) return level
  return compareVersions(version, anchor) >= 0 ? level : 'not-supported'
}

function honorManualAnchors(
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

No shared key constant exists today (`useBrowserSupport.ts` has `BRAND_BY_BROWSER`; `app/data/bcd-release-overrides.schema.ts:22` keeps a private `BROWSER_IDS`), so the plan adds `BROWSER_KEYS` next to `BRAND_BY_BROWSER` rather than inlining the six keys per call site. `compareVersions` is not currently imported by `useBrowserSupport.ts`, so the import is added — safe, because `canIUseLoader` reaches back only through `import type` (`app/utils/canIUseLoader.ts:6`) and `compareVersions` is a hoisted function declaration (`:622`).

Applied in three places, all of which currently return the raw entry:

1. `resolveSupport`'s manual branch (`useBrowserSupport.ts:183`) → `honorManualAnchors(MANUAL_SUPPORT[feature.id], versions)`.
2. `loadSupport`'s path-less short-circuit (`:256-262`) is **deleted**; path-less features flow through `resolveSupport`, which skips the BCD/CIU branches on absent paths and lands in (1). This makes the feature await `loadBrowserVersions()` like every other feature instead of resolving against `DEFAULT_BROWSER_VERSIONS` — identical results today, no default-derived levels ever committed to the cache.
3. `getSupportAt`'s cold-cache fallback (`:332`) builds `{ ...browserVersions.value, [BRAND_BY_BROWSER[browserId]]: version }` and honors. No in-app caller can reach it today — `columnSupport` (`useVersionedBrowsers.ts:86`) passes a version only for a non-default selection, and `setVersion` commits the selection only after `await loadSupportAtVersion(...)` has written a versioned key for every feature (`useVersionedBrowsers.ts:119-124`, `useBrowserSupport.ts:311-320`) — so this is a guard for callers that arrive later (`PWAscore-vbd`'s delta resolution reads pinned versions directly). It is kept **with a test that pins it**, rather than deleted, because the alternative is a cold read silently returning the pre-honoring entry. The pre-existing authority caveat stays as-is: that fallback already prefers manual data when the cache is cold, and honoring only makes it version-correct.

The synchronous `getSupport` manual branch (`:226-231`) keeps its render-before-load fast path — it honors using `browserVersions.value`, but **only writes the cache once `versionsLoaded` is true**, so a pre-load read can never poison a key with default-derived levels.

Cache keys are unchanged: the version-keyed `baseKey@brand=version` entries already isolate pinned reads, and `MANUAL_SUPPORT` stays a module-scope constant.

---

## Measured impact on today's data

Of the 19 anchors in `manual-browser-support.json`, four intersect a selectable version list (live selector lists read 2026-09-16; the selector offers the latest patch of each of the last 8 majors):

| Feature                | Key          | Anchor | Selectable versions below the anchor | In primary score? | Effect                              |
| ---------------------- | ------------ | ------ | ------------------------------------ | ----------------- | ----------------------------------- |
| `declarative-web-push` | `safari_ios` | 18.4   | 13.4, 14.5, 15.6, 16.6, 17.6         | no (experimental) | row flips supported → not-supported |
| `declarative-web-push` | `safari`     | 16     | 13.1, 14.1, 15.6                     | no (experimental) | row flips supported → not-supported |
| `push-api`             | `safari_ios` | 16.4   | 13.4, 14.5, 15.6                     | yes (w2)          | none — BCD answers first            |
| `notification-api`     | `safari_ios` | 16.4   | 13.4, 14.5, 15.6                     | yes (w2)          | none — BCD answers first            |

The two BCD-backed rows are dormant by measurement, not assumption: the pinned `@mdn/browser-compat-data@8.1.2` reports `api.PushManager.__compat.support.safari_ios.version_added = "16.4"` (and `api.Notification` the same), so `resolveSupport` returns the BCD answer before the manual branch is reached. The manual anchors mirror BCD's own introduction versions — corroborating the anchor semantics above.

Every other anchor (Chrome/Firefox 4–84, Safari 3.1–11.1) sits below the last-8-majors floor (Chrome ≥ 146, Firefox ≥ 148), so it changes nothing today; anchors become load-bearing the moment a path-less feature records a recent one.

Consequences, all verifiable:

- **Row levels:** Declarative Web Push in the Safari columns at the versions above — visible only with "Show Experimental" checked.
- **"Full" scores** (`weightedFull`/`unweightedFull`, the tooltip numbers): shift for Safari at those versions by the feature's 0.5 weight, since the full accumulator includes experimental features. The **primary** `weighted`/`unweighted` scores, group badges, and headline numbers are untouched.
- **Score history:** `pnpm generate-score-history` must reproduce `app/data/score-history.json` with no value changes (only `generatedAt`) — the series uses `.weighted`, and the only in-window anchors belong to an experimental feature or are BCD-covered. If a value moves, the anchor set changed and the diff belongs in the commit.
- **Release deltas (post-`PWAscore-vbd`):** the modal's release rows are the precomputed series majors, so Safari iOS **18 → 26** and desktop Safari **15 → 16** gain an "added Declarative Web Push" row — the first genuine manual-feature delta, and exactly the case the deltas spec's accepted-limitation copy currently suppresses. (The selector's patch list would put the same flip at 17.6 → 18.6 / 15.6 → 16.6; that is the contingency if the deltas work switches the modal to the selector list — see the measured note in the deltas spec.)

---

## Out of scope

- **`version_removed`** stays ignored (inherited from `isVersionSupported`), so a feature later removed still reads supported at later versions.
- **Data curation:** several keys are `supported` with no anchor (`viewport-control`/`https-requirement` chrome+firefox+safari desktop, `same-origin-policy`, `background-audio`, `window-controls-overlay` chrome, `jump-list`/`quick-actions` chrome, `proximity` firefox_android). They stay version-invariant. Adding anchors is a data change with its own sourcing work, not part of this fix.
- **No new data fields, no build step, no new pipeline** — the anchors already exist and are already validated by `BrowserSupportSchema` (`app/schemas/canIUse.ts:117-122`).

---

## Tests

`app/composables/useBrowserSupport.test.ts` (fixtures, offline, no network — matching the existing suite):

- **`manual feature with embedded *Version resolves by version`** — the test the foundation spec promised and never got (`2026-06-14-version-aware-scores-design.md:179`). `apple-pay` at `safari_ios` 10.0 → `not-supported`; at the anchor 10.1 → `supported`; above it → `supported`.
- **Per-key anchors are distinct** — `apple-pay` with `versions.safari = '11'`: `safari` → `not-supported` (11 < 11.1) while `safari_ios` → `supported` (11 ≥ 10.1). Proves the key's own field is used, not the brand's.
- **No anchor → invariant** — `viewport-control` with `versions.chrome = '10'`: `chrome` stays `supported` (no anchor), `chrome_android` → `not-supported` (anchor 18).
- **Cold-cache pinned read (`getSupportAt`) honors the anchor** — with nothing loaded, `apple-pay` at `safari_ios` 10.0 → `not-supported`, at 10.1 → `supported`, and `loadSupportAtVersion` is never called. This is the only test covering change point 3, which no in-app caller reaches today.
- **The `versionsLoaded` guard keeps default-derived levels out of the cache** — mock `getBrowserVersions` to return versions below the anchors (e.g. `chrome: '1'`): before `loadBrowserVersions()`, `getSupport('google-pay').chrome_android` is `supported` (defaults are above the anchor) and — with the pre-load write skipped — the post-load read must be `not-supported`. Without the guard the unversioned key is poisoned and the assertion fails.
- **Pinned reads do not collide with current reads** — extends the existing version-collision test to a path-less feature.
- **Current-version path unchanged** — `loadSupport('apple-pay')` returns the entry's recorded levels, guarding the deleted short-circuit.

Both consumer test files replace `../utils/canIUseLoader` with a **wholesale factory mock** (`useBrowserSupport.test.ts:8-66`, `useVersionedBrowsers.test.ts:7-24`), so the new `compareVersions` import would be `undefined` there and every manual lookup would throw `TypeError: compareVersions is not a function` — including existing cases at `useBrowserSupport.test.ts:101`, `:114`, `:166`. Both factories become partial mocks (`await importOriginal()` spread) so pure helpers stay real while the data sources stay stubbed.

`app/data/manual-browser-support.data.test.ts` (dataset guards, alongside the existing shape checks):

- `BrowserSupportSchema` accepts only numeric anchor shapes — a shared `VersionAnchorSchema` (`v.pipe(v.string(), v.regex(/^\d+(\.\d+)*$/))`) applied to the six `<browser>Version` fields, asserted by a data test that the dataset passes and that `'≤16.4'` / `'x'` are rejected. This guard is load-bearing, not cosmetic: `compareVersions` coerces an operator-prefixed or wildcard anchor to `0` (`canIUseLoader.ts:622-664`), so a curator copying BCD's `'≤16.4'` into the table would make every version compare above the anchor and **silently disable honoring for that key** — measured: `compareVersions('16.6','≥16.4') = 16`, `compareVersions('10.0','x') = 10`. Validation at import time (via `normalizeManualSupport`) fails loudly instead.
- Honoring is a no-op at `DEFAULT_BROWSER_VERSIONS` for every entry — no anchor exceeds the pre-load fallback versions. Because those constants are a **lower bound** of the shipping versions (141/143/18.4 vs 153/155/27 today) and honoring is monotone in version, this also proves the no-op at every live version; the assertion's failure message must say so and point at `DEFAULT_BROWSER_VERSIONS` (a genuinely shipped mid-range anchor such as `safari_iosVersion: '26'` correctly fails the guard because the pre-load fast path would answer from a stale default — the fix is to refresh the constant, not relax the guard).
- Every anchor accompanies a `supported` or `partial` level on the same key — an anchor on `not-supported` is meaningless data that honoring would silently ignore.

All three pass against today's dataset (checked 2026-09-16): 19 anchors, none above `DEFAULT_BROWSER_VERSIONS` and none above the shipping versions, none on a non-supported level. The tightest case is `declarative-web-push` `safari_ios` 18.4 vs the default Safari 18.4 — comparison 0, so the guard sits exactly on its boundary and will fail the moment the default drops below an anchor, which is the point.

---

## Files (expected shape, refine in plan)

| Area         | File                                           | Change                                                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolution   | `app/composables/useBrowserSupport.ts`         | `BROWSER_KEYS` const, `compareVersions` import, `levelAtAnchor` + `honorManualAnchors`; manual branch in `resolveSupport`; drop the path-less short-circuit; honor the `getSupportAt` fallback; cache-write guard in `getSupport`; export `DEFAULT_BROWSER_VERSIONS` |
| Schema       | `app/schemas/canIUse.ts`                       | `VersionAnchorSchema` (numeric shape) on the six `<browser>Version` fields, so a malformed anchor fails at import instead of failing open                                                                                                                            |
| Tests        | `app/composables/useBrowserSupport.test.ts`    | the seven cases above                                                                                                                                                                                                                                                |
| Test harness | `app/composables/useVersionedBrowsers.test.ts` | partial mock of `../utils/canIUseLoader` (`importOriginal()` spread) so `compareVersions` stays real                                                                                                                                                                 |
| Data guard   | `app/data/manual-browser-support.data.test.ts` | anchor-shape (schema rejects `≤16.4` / `x`), no-op-at-defaults, anchor-level-coherence checks                                                                                                                                                                        |
| Data         | none expected                                  | `score-history.json` only if a `.weighted` value actually moves                                                                                                                                                                                                      |

---

## Acceptance

- The seven composable cases and three data guards pass; the suite stays offline and deterministic (228 passed / 2 skipped baseline + new tests).
- `pnpm generate-score-history` changes **no `.weighted` value** — diff `series[*][].weighted` only. `generatedAt`, `domainStart`, `domainEnd`, and the trailing `releaseDate` of each series are derived from the run date (`scripts/generate-score-history.ts:211-215`) and may move on any later day; if a `.weighted` moves, the anchor set changed the primary score and the regenerated file ships in the same commit with the movement explained.
- Live check on a preview build: with "Show Experimental" on, Declarative Web Push reads not-supported at Safari iOS **17.6** and supported at **18.6**; desktop Safari not-supported at **15.6** and supported at **16.6**; Push API/Notification API unchanged (still not-supported below 16.6 via BCD). Default (current-version) view is pixel-identical to today.
- `pnpm test`, `pnpm run lint`, `pnpm run typecheck` green.
