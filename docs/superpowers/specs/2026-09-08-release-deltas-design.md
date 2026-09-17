# Release Deltas — "What did this browser release ship for PWA?"

**Goal:** Turn the existing per-browser release history into answerable questions: _"What did Safari 27 add?"_, _"When did Chrome ship Badging API?"_, _"Did the last Firefox release lose anything?"_ Each release in the score-over-time modal becomes an expandable row: score delta vs the previous release, plus per-feature deltas (added / improved / partial / removed) with names, descriptions, weights, and source links.

**Tracking:** `PWAscore-vbd`

---

## Requirements

- Inside the existing score-over-time modal, the per-browser release series gains one expandable row per release: version, release date, channel badge (released/current/beta — reuse existing classification), score at that version, and **Δscore vs the preceding entry in the series**.
- Expanding a row lists the feature deltas between that release and its predecessor:
  - **added** — not supported (or unknown) at the predecessor → supported at this release
  - **improved** — partial at predecessor → supported at this release
  - **partialized** — supported → partial (rare; still listed)
  - **removed** — supported/partial at predecessor → not-supported at this release
  - no row for features whose level is unchanged
- Each delta row shows: feature name, one-line description, weight chip, old→new level transition, and a source link (BCD `mdn_url` when present).
- Delta rows are grouped under the same category structure as the main table (category name as a sticky sub-header).
- The existing "hide experimental" filter applies to delta lists the same way it applies to the feature table, so an expanded release always agrees with what the table shows for those two versions.
- Beta/preview rows (no release date) get deltas computed against the last released (or preceding listed) version and stay visually marked preliminary.
  > **Measured 2026-09-16:** the modal renders the precomputed series (release _majors_: Safari iOS shows 14.5 → 27 in seven rows), not `getBrowserReleases`' list of the latest patch per major. `getBrowserReleases` feeds the version _selector_. Beta rows therefore do not appear in the modal today, so either the delta rows follow the series as-is, or this requirement pulls the selector list into the modal.
- Selecting a version in the modal keeps today's behavior; expanding is additive. No new storage, no build-time data pipeline, no new backend.

---

## Computation model (runtime, not precomputed)

Deltas are derived on demand from the exact machinery the feature table already uses:

- For a release pair (v1 → v2), resolve each feature's support at **both** versions through the existing `loadSupportAtVersion` (BCD-first → CIU-fallback → manual) with the foundation's per-browser version-keyed cache.
- Classify the transition with a pure helper (`classifyDelta(levelV1, levelV2)`), and compute Δscore via the existing `calculateBrowserScore` at each version (weighted, respects the experimental filter).
- No new fetch: both versions resolve from the same in-memory caniuse/BCD data the page already loaded, so an expanded row costs ≤ one extra resolution pass per version, cached for subsequent rows (typical cost: ~163 features × 2 versions on first expansion, then cache hits).

### Why this is consistent

The June foundation (PWAscore-2b1) already proved every BCD-backed feature resolves historically for every browser key, and that no feature depends on CIU alone. Therefore "level at v1 vs v2" is well-defined for the same feature set the table scores — deltas cannot contradict the table because they are the same function evaluated twice.

### Data-source nuance: 'unknown' must not be labeled 'added'

At dated historical versions, BCD `version_added` encodes the true introduction, so a transition from `unknown` (no data below the anchor) to `supported` at exactly the anchor version is genuinely "added". Where the predecessor level is `unknown` _without_ an anchor (data gap, e.g. a version older than any BCD entry for that browser), the row is labeled "added (per data start)" — a softer copy variant. In practice the series only shows recent majors, where this case is rare.

---

## Accepted limitations (v1)

- **Manual features (17 path-less, e.g. `apple-pay`, `https-requirement`-style overrides)** — _updated 2026-09-16: the anchoring half of this limitation is fixed._ `PWAscore-3ek` landed version-aware resolution for manual entries (`levelAtAnchor`/`honorManualAnchors` in `useBrowserSupport.ts`, applied in `resolveSupport`, the sync `getSupport` read, and the cold-cache `getSupportAt` fallback), so a path-less feature now resolves at the pinned version: at or above its recorded `*Version` anchor it reads the recorded level, below it `not-supported`. Consequence for this feature — the first genuine manual-feature delta exists: **Declarative Web Push** (`safari_iosVersion` 18.4 / `safariVersion` 16) flips not-supported → supported across the modal's Safari iOS **18 → 26** row and its desktop Safari **15 → 16** row. Those are the _precomputed series majors_ the modal actually renders (measured live 2026-09-16: Safari iOS lists 14.5, 15, 16, 17, 18, 26, 27) — if the implementation follows the selector's patch list instead, the same delta lands at 17.6 → 18.6 / 15.6 → 16.6. Which list the delta rows follow is the plan's first decision, not an assumption to inherit. What remains invisible is every anchor that sits _below_ the deltas window — Apple Pay (10.1/11.1), Google Pay (61), viewport-control (3.1/4/18), https-requirement (44/45/11.1), jump-list and quick-actions (84), and secure-contexts (11.1/47/49) — so the Apple Pay example above still holds for a different reason, not because the data is ignored. Three entries are dormant twice over: `push-api`, `notification-api`, and `secure-contexts` carry BCD paths (`api.PushManager`, `api.Notification`, `api.isSecureContext`), so BCD answers first and their anchors are fallbacks — the first two sit inside the window but never reach the manual branch. Anchor total for auditing: 19 = 15 below the window + 4 inside it (Declarative Web Push 2, push-api 1, notification-api 1). There is no longer a case for defensive copy about manual deltas — below an anchor the helper returns `not-supported`, never `unknown`, so the softer "added (per data start)" copy cannot trigger from manual data; the row should render normally. (Anchor-less keys — `same-origin-policy`, `background-audio`, `window-controls-overlay`, the desktop halves of `viewport-control`/`https-requirement` and of `jump-list`/`quick-actions`, plus `proximity` firefox_android — stay version-invariant until anchors are sourced.)
- **`version_removed` produces no verdict of its own** — since PWAscore-5q3 array statements are selected by range (a statement covering the queried version wins over the newest entry), but a statement whose `version_removed` has passed is merely _excluded from that selection_, so a feature dropped without a successor statement still reads as supported throughout history. Tiny set; accepted.
- Deltas are computed for the **series in the modal** — the precomputed majors in `app/data/score-history.json` (measured 2026-09-16: no beta rows appear in it); there is no full-1970s-history browser diff.

---

## UI sketch

```
┌ Safari iOS — score over time ────────────────┐
│ 27  Sep 2026         87 pts  ▾ 26 → 27        │
│   ┌ +0.0 pts — 3 features changed ─────────┐  │
│   │ ● Added     Badging API            w2  │  │
│   │ ● Added     File Handling API      w2  │  │
│   │ ● Improved  Notification Triggers  w1  │  │
│   └ (each row links to BCD/mdn) ───────────┘  │
│ 26  Sep 2025         87 pts  ▸ expand        │
│ 18  Sep 2024         86 pts  ▸ expand        │
└───────────────────────────────────────────────┘
```

Modal wiring: reuse the existing modal's browser context and the list it already renders — the precomputed series (`sparklineSeries` from `app/data/score-history.json`; see the measured note under Requirements). `getBrowserReleases` feeds the version _selector_, not the modal; if the plan instead switches the modal to the selector's list, it takes that list's channel classification with it and the delta boundaries in the sibling spec change back. Rows render lazily (expand = resolve + classify; collapse = drop refs, keep cache).

---

## Files (expected shape, refine in plan)

| Area        | File                                             | Change                                                                                                                    |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Delta logic | `app/composables/useReleaseDeltas.ts` (new)      | `classifyDelta` pure helper + row assembly over `loadSupportAtVersion`/`calculateBrowserScore`, experimental-filter aware |
| Tests       | `app/composables/useReleaseDeltas.test.ts` (new) | deterministic: fixture-driven transition classification table; no network (offline suite convention)                      |
| Modal       | score-over-time modal component                  | expandable release rows + delta list, lazy resolution                                                                     |
| i18n        | `i18n/locales/{en,fr}.json`                      | row/transition strings                                                                                                    |
| Data        | none (runtime)                                   | —                                                                                                                         |

---

## Acceptance

- In the modal, every release row expands to a delta list that matches the main feature table resolved at the two adjacent versions (spot-checked in tests via the shared resolver).
- Delta classification is a pure, fully unit-tested function over the four transition kinds; unknown-handling copy per data nuance above.
- No network dependency in unit tests; suite stays deterministic (215+ baseline + new tests, offline).
- en + fr UI strings; typecheck/lint/tests green.
