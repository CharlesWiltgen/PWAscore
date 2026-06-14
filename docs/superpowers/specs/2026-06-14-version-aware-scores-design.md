# Version-Aware Browsing + Scores Over Time

**Goal:** Let users view PWA support and scores for a _chosen_ version of each browser (not just the current shipping one), and see how each browser's score has evolved across its releases via a per-column sparkline. This makes upcoming versions (e.g. Safari 26.5-beta, Safari 27) inspectable as soon as the data sources list them.

**Tracking:** `PWAscore-2b1`

---

## Requirements

- Each browser column gets a version selector; default selection is the current shipping version (unchanged from today's behavior).
- Changing the selected version recomputes that column's feature-row support icons, the headline weighted score, and the per-group score badges — for that column only.
- The version list shows a recent window (last ~6-8 major versions) plus the current version plus any beta/upcoming version, with beta/preview entries clearly badged and visually distinct.
- Beta/upcoming versions (CIU/BCD entries with no release date, or BCD channel `beta`/`nightly`) are selectable and computed from whatever `version_added` data exists, marked preliminary.
- Each column shows a score-over-time sparkline beneath its score, spanning the recent window, respecting the current "hide experimental" toggle.
- Clicking a sparkline opens a larger full-history trend chart for that browser with hover-for-exact-score.
- No new storage or infrastructure: the time series is derived at runtime from the existing source data.

---

## Why MDN BCD is the backbone (data-source rationale)

The two sources differ sharply in version-history coverage. Verified against live CIU `data-2.0.json` and MDN BCD 8.0.3:

| Browser                                            | CIU `version_list`                    | MDN BCD `browsers[*].releases` |
| -------------------------------------------------- | ------------------------------------- | ------------------------------ |
| Chrome for Android (`and_chr` / `chrome_android`)  | **1 entry** (evergreen, current only) | **128** releases (127 dated)   |
| Firefox for Android (`and_ff` / `firefox_android`) | **1 entry**                           | **138** releases               |
| Safari iOS (`ios_saf` / `safari_ios`)              | 53 (30 dated)                         | 57 (56 dated)                  |
| Chrome desktop                                     | 148                                   | 151                            |
| Firefox desktop                                    | 155                                   | 157                            |
| Safari desktop                                     | 56                                    | 60                             |

CIU has **no version history for the evergreen mobile browsers**, so it cannot drive a mobile Chrome/Firefox version list or sparkline. MDN BCD has full release history (with dates and channel status) for all six browser keys, and encodes version-specific `version_added` per feature. Therefore:

- **Version list + release dates** come from BCD `browsers[browserKey].releases`.
- **Per-feature historical support** uses the existing BCD-first → CIU-fallback resolver unchanged.

This is safe because of the feature catalog's composition (verified against `app/data/pwa-features.json`):

- 163 features total
- 146 have an `mdnBcdPath` (BCD-backed)
- **0 features are CIU-only** — every feature with a `canIUseId` also has an `mdnBcdPath` (116 have both, 30 are BCD-only)
- **17 features have neither source ID** (verified: `declarative-web-push`, `proximity`, `element-capture`, `region-capture`, `background-audio`, `face-detection`, `text-detection`, `shape-detection`, `viewport-control`, `file-type-associations`, `jump-list`, `quick-actions`, `apple-pay`, `google-pay`, `https-requirement`, `same-origin-policy`, `window-controls-overlay`) — these are the features that lack real version history.

`manual-browser-support.json` has 23 keys serving two distinct roles: it is the **primary** source for those 17 path-less features, and a **status/support override** for 6 features that also have a BCD path (`tabbed-mode`, `secure-contexts`, `open-with-pwa`, `url-scheme-handling`, `push-api`, `notification-api`) — the latter still resolve historically via BCD.

Because the loader tries BCD first and no feature depends on CIU alone, BCD's version-aware resolution covers every BCD-backed feature for every browser, including mobile Chrome/Firefox. CIU remains a fallback that only decides a value when BCD returns all-unknown. Only the 17 path-less features carry no version history (handled per Unit 2).

**`current_version` reconciliation:** CIU reports Safari `current_version` = 26.4; BCD marks `safari_ios` 26.5 as `current`. We keep today's behavior — the default _selected_ version is CIU's `current_version` (via the existing `getBrowserVersions()`) — and use BCD only for the list and release dates. Any release newer than the default-selected version is badged `beta`/`preview`.

---

## Architecture

Four units, each independently testable.

### Unit 1 — Release metadata: `getBrowserReleases`

New function in `app/utils/canIUseLoader.ts` (co-located with the other data loaders, reusing `loadMdnBcdData()`).

```ts
export type ReleaseChannel = 'released' | 'current' | 'beta'

export interface BrowserRelease {
  version: string
  releaseDate: string | null // ISO date from BCD; null for unreleased/preview
  channel: ReleaseChannel
}

// browserId is the existing BrowserId union (chrome_android | ... | safari)
export async function getBrowserReleases(
  browserId: BrowserId,
  currentVersion: string
): Promise<BrowserRelease[]>
```

- Reads `bcd.browsers[browserId].releases`, maps each `{ version -> { release_date, status } }` to a `BrowserRelease`.
- `channel`: `current` when the version equals `currentVersion` (the default-selected version from `getBrowserVersions()`); `beta` when BCD `status` is `beta`/`nightly`/`planned` or `release_date` is null; otherwise `released`.
- Filters to a recent window: the last `RECENT_MAJORS` (constant, e.g. 8) major versions at or below `currentVersion`, plus the current, plus all beta/preview entries above it. Sorted ascending by version using the existing `compareVersions`.
- Returns `[]` on error (callers fall back to a single-element list containing just `currentVersion`).

`BrowserId` already maps app browsers to BCD keys 1:1 (`chrome_android`, `firefox_android`, `safari_ios`, `chrome`, `firefox`, `safari`). It currently lives in `useBrowserSupport.ts`; `canIUseLoader.ts` can `import type { BrowserId }` from there with no runtime cycle — it already does exactly this for `SupportLevel` (`canIUseLoader.ts:6`), and `import type` is erased at compile time. (Optionally relocate `BrowserId` next to `BrowserVersions` in `canIUseLoader.ts` for tidiness; not required.)

**Validation.** `loadMdnBcdData()` returns `unknown` and no schema models the `browsers` section. Add a Valibot schema for the releases shape in `app/schemas/canIUse.ts`, mirroring the existing `safeParse`-with-graceful-fallback pattern used by `navigateMdnBcdPath`:

```ts
const BcdReleaseSchema = v.object({
  release_date: v.optional(v.nullable(v.string())),
  status: v.optional(v.string())
})
```

`getBrowserReleases` reads `(bcdData as { browsers?: ... }).browsers?.[browserId]?.releases`, validates each entry, and skips/falls-back on parse failure.

### Unit 2 — Version-aware support resolution

`getCanIUseSupport(canIUseId, versions)` and `getMdnBcdSupport(path, versions)` already accept an arbitrary `BrowserVersions` object and resolve support at those versions (`findBrowserVersion`, `isVersionSupported` + `compareVersions`). No change to their logic.

The change is in `useBrowserSupport`:

- **Cache re-key, per-browser.** The support cache key today is `canIUseId|mdnBcdPath` (feature-only). Because each `calculateBrowserScore` call is scoped to one `browserId` and only that column's version varies, key by the single relevant browser+version rather than all three: `${baseKey}@${browserId}=${version}`. This keeps columns independent and avoids the cross-column cache pollution that keying on all three versions (`...@${chrome},${firefox},${safari}`) would cause.
- **New async resolver, additive.** Add `loadSupportAtVersion(features, browserId, version)` alongside the existing `loadSupport`/`loadMultipleSupport` — do NOT change the existing current-version signatures (they are called synchronously via `getSupport` on every render and must keep working unchanged). The new function resolves support by calling `getMdnBcdSupport`/`getCanIUseSupport` with `{ ...defaultVersions, [browserId]: version }` and writes into the per-browser-keyed cache.
- Manual features: of the 17 path-less features, those whose `manual-browser-support.json` entry carries a per-browser `*Version` field (e.g. `apple-pay` `safari_iosVersion: "10.1"`, `push-api` `safari_iosVersion: "16.4"`) honor it — compare against the requested version with `compareVersions`, treating it as a `version_added` anchor. Entries with no `*Version` field (e.g. `same-origin-policy`, `window-controls-overlay`) have no historical signal and resolve to their current state at all versions; this is a small, acknowledged inaccuracy on a handful of features, not score-breaking (their support is binary and mostly stable).

**Version switching: async load protocol (critical).** `getSupport` is synchronous and returns `UNKNOWN_SUPPORT` for any key not yet in the cache; the cache is populated by the async `loadSupport`. Today `loadMultipleSupport` runs once on mount. Under version switching, changing `selectedVersion[browserId]` to a not-yet-loaded version would make `getSupport` return all-unknown until an async load completes — so the UI must not render the new version's icons/score synchronously. The protocol:

1. A `watch` on `selectedVersion[browserId]` fires `loadSupportAtVersion(allFeatures, browserId, newVersion)`.
2. A per-column `isVersionLoading[browserId]` ref is set for the duration; the column shows a loading state (skeleton/overlay) rather than flashing 163 unknown rows.
3. On resolve, the per-browser-keyed cache is populated; the `browsers` computed (which must now build a per-column version-pinned `getSupportFn` closing over `selectedVersion`) recomputes that column's headline score, group badges, and row icons.

This is the most invasive part of the feature: `browsers` (`PWAFeatureBrowser.vue:327`) currently passes one shared `getSupport` to all three columns, and `getFeatureSupport`/`featureSupportMap` return support for all browsers uniformly. Both must become per-column version-aware (`getFeatureSupport(feature.id, browserId)` resolving at that column's selected version). The default-version path is unchanged, so an unmodified column behaves exactly as today.

**Experimental status is version-independent.** `shouldExcludeFromPrimaryScore` reads `support.status` (experimental / standard_track / deprecated), which comes from BCD `__compat.status` — not from per-version support. So `experimentalFeatureIds`/`experimentalGroupIds` (precomputed in `onMounted`) do NOT need recomputation on version switch; only support _levels_ change per version.

### Unit 3 — Score series

`useBrowserScore.calculateBrowserScore(browserId, groups, getSupportFn)` already takes an injectable `getSupportFn`. To build a sparkline series, call it once per windowed release with a version-pinned `getSupportFn`:

```ts
// pseudo
series = releases.map((r) => ({
  date: r.releaseDate,
  version: r.version,
  score: calculateBrowserScore(browserId, groups, getSupportAt(r.version))
    .weighted
}))
```

Cost: for the 3 columns visible in one platform view, ~163 features x ~8 windowed releases x 3 ≈ 4k support resolutions after data load. Each is a synchronous `navigateMdnBcdPath` walk over the (already-parsed, ~5 MB) BCD object plus an `isVersionSupported` comparison — bounded and main-thread-acceptable at this size, but not free, so compute **lazily on first need** and **memoize per `(browserId, version-window, hideExperimental)`**. If profiling later shows jank, deferring series computation to idle time or a worker is a fallback (out of scope for v1 — YAGNI at 4k ops).

The selected-version score (Unit 4 dropdown) reuses the same version-pinned path for a single version.

### Unit 4 — UI: `PWAFeatureBrowser.vue`

- **Version dropdown.** The static version subtitle (currently `t('browser.version', { version: browser.version })` near line 647) becomes a `USelect` bound to a per-column reactive `selectedVersion[browser.id]`, options from `getBrowserReleases`. Beta/preview options render with a badge and muted styling. Default = current.
- **Reactivity.** Feature-row icons (`getFeatureSupport(feature.id)[browser.id]`), the headline `browser.scores.weighted`, and per-group badges (`browser.scores.groupScores[...]`) recompute from the selected version. This means `browser.scores` becomes a function of `selectedVersion[browser.id]` rather than a one-time computation.
- **Sparkline.** A dependency-free inline SVG (polyline over normalized score series) beneath the score, sized small (e.g. 120x28). No charting library (keeps bundle size down; satisfies P-4).
- **Expand.** Clicking the sparkline opens a `UModal` containing a larger inline-SVG line chart of the browser's full release history with axis labels and hover-for-exact-score.
- **Existing meta-click expand-all** (`handleGroupMetaClick`) and the `data-group-id` matching from the group-scores work are unaffected.

### Data flow

```
getBrowserVersions() --default selected version--> selectedVersion[id] (ref, per column)
getBrowserReleases(id, current) --windowed list--> USelect options + sparkline x-axis
selectedVersion change --> version-pinned getSupportFn
  --> calculateBrowserScore --> headline + group badges + row icons (one column)
windowed releases --> series of weighted scores --> sparkline / expand modal
```

---

## Safari 27 handling (the originating question)

Safari 27 does not yet exist as a shipping release; today both sources top out at Safari 26.4 (current) / 26.5 (beta). The app reads `ios_saf.current_version` and already filters unreleased versions, so it shows the correct current Safari and auto-advances when a version becomes current. Under this design:

- When BCD/CIU add a `27` entry (initially with no release date / `beta` status), `getBrowserReleases` surfaces it as a selectable `27 [preview]` row, computed from whatever `version_added` data is present at that point, badged preliminary.
- The default selection remains the current shipping version until `27` actually ships and the sources mark it current.

No code change is needed when 27 arrives — it flows through the windowed-release logic automatically.

---

## Testing

- `getBrowserReleases` (`canIUseLoader.test.ts`): window size respected; `channel` classification (released/current/beta) for dated/undated/`beta`-status entries; ascending sort via `compareVersions`; empty-on-error fallback. Use a fixture BCD `browsers` slice with known release dates/statuses.
- Version-aware support cache (`useBrowserSupport.test.ts`): two different version sets for the same feature do not collide; default path still returns current-version support; manual feature with embedded `*Version` resolves by version.
- Score series (`useBrowserScore.test.ts`): a synthetic catalog where a feature lands at a known version produces a monotonic step in the series at that version; `hideExperimental` toggles which features count, matching the existing primary/full rules.
- Integration (`canIUseLoader.integration.test.ts`): every `mdnBcdPath` resolves at the current version (existing test, already passing on 8.0.3).

---

## Files Changed

| File                                        | Change                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `app/utils/canIUseLoader.ts`                | Add `getBrowserReleases`, `BrowserRelease`, `ReleaseChannel`; reuse `loadMdnBcdData`                  |
| `app/schemas/canIUse.ts`                    | Add `BcdReleaseSchema` for the BCD `browsers[*].releases` shape                                       |
| `app/utils/canIUseLoader.test.ts`           | Tests for `getBrowserReleases`                                                                        |
| `app/composables/useBrowserSupport.ts`      | Per-browser version-keyed cache; new `loadSupportAtVersion` (additive, existing signatures unchanged) |
| `app/composables/useBrowserSupport.test.ts` | Version-collision + manual-version tests                                                              |
| `app/composables/useBrowserScore.ts`        | Helper to compute a weighted-score series across releases (reuses `calculateBrowserScore`)            |
| `app/composables/useBrowserScore.test.ts`   | Score-series tests                                                                                    |
| `app/components/PWAFeatureBrowser.vue`      | Per-column version `USelect`; reactive per-column scores; inline-SVG sparkline; expand `UModal`       |
| `i18n/` locale files                        | Strings for version selector, beta/preview badges, trend labels                                       |

This exceeds the usual "< 3 files" guideline because the feature spans the data layer, scoring layer, and UI by nature; the phasing below keeps each change reviewable.

---

## Phasing (drives the implementation plan)

1. `getBrowserReleases` util + `BcdReleaseSchema` + tests (pure data, no UI). Independently shippable.
2. `loadSupportAtVersion` + per-browser version-keyed cache + tests. Additive; existing current-version path and its tests unchanged. Unit-testable with hard-coded version objects.
3. Score-series helper + tests (depends structurally on Phase 2).
   4a. Per-column `selectedVersion` state + async load protocol + per-column loading UI (the hard architectural bridge: async producer / sync consumer). Wire the per-column version-pinned `getSupportFn` and per-column `getFeatureSupport`; verify row icons + headline + group badges update on version change.
   4b. The version `USelect` UI itself (dropdown options, beta/preview badges) on top of the working 4a wiring.
4. Sparkline (inline SVG).
5. Expand-to-full-chart modal.

Phases 1-3 carry no visible UI change. Phase 4 is split because 4a (the async/reactive model) is where correctness risk lives and should be reviewed before the dropdown UI (4b) is layered on. Phases 5-6 are purely additive on a working Phase 4.

---

## What This Does NOT Include (deferred)

- Persisted snapshots / calendar-time catalog-drift tracking (would need Cloudflare KV/D1 + a scheduled job; explicitly deferred — the derived series gives full retroactive history without it).
- A combined multi-browser overlay chart (sparklines and the expand modal are per-browser in v1).
- A dedicated `/trends` route.
- A `?safari=18` shareable-version query param (optional nice-to-have; not required for v1).
- Changes to the weighting formula, the primary/full score definitions, or the platform (mobile/desktop) toggle.
- **`version_removed` handling.** BCD encodes feature removal by version, but `isVersionSupported` (`canIUseLoader.ts:659`) ignores `version_removed`. A feature that shipped then was un-shipped will read as supported throughout history, slightly inflating historical scores. The set of un-shipped web platform features is tiny, so this is an accepted v1 limitation; address only if it visibly distorts a sparkline.
