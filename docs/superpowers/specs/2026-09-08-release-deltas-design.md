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
- Selecting a version in the modal keeps today's behavior; expanding is additive. No new storage, no build-time data pipeline, no new backend.

---

## Computation model (runtime, not precomputed)

Deltas are derived on demand from the exact machinery the feature table already uses:

- For a release pair (v1 → v2), resolve each feature's support at **both** versions through the existing `loadSupportAtVersion` (BCD-first → CIU-fallback → manual) with the foundation's per-browser version-keyed cache.
- Classify the transition with a pure helper (`classifyDelta(levelV1, levelV2)`), and compute Δscore via the existing `calculateBrowserScore` at each version (weighted, respects the experimental filter).
- No new fetch: both versions resolve from the same in-memory caniuse/BCD data the page already loaded, so an expanded row costs ≤ one extra resolution pass per version, cached for subsequent rows (typical cost: ~200 features × 2 versions on first expansion, then cache hits).

### Why this is consistent

The June foundation (PWAscore-2b1) already proved every BCD-backed feature resolves historically for every browser key, and that no feature depends on CIU alone. Therefore "level at v1 vs v2" is well-defined for the same feature set the table scores — deltas cannot contradict the table because they are the same function evaluated twice.

### Data-source nuance: 'unknown' must not be labeled 'added'

At dated historical versions, BCD `version_added` encodes the true introduction, so a transition from `unknown` (no data below the anchor) to `supported` at exactly the anchor version is genuinely "added". Where the predecessor level is `unknown` _without_ an anchor (data gap, e.g. a version older than any BCD entry for that browser), the row is labeled "added (per data start)" — a softer copy variant. In practice the series only shows recent majors, where this case is rare.

---

## Accepted limitations (v1)

- **Manual features (17 path-less, e.g. `apple-pay`, `push-api`-style overrides)** resolve to their current state at every version (per the June foundation's documented fallback). Their deltas are therefore invisible across releases — e.g. Apple Pay's true introduction in Safari 11.1 will not appear at that boundary. Honoring the `*Version` anchors in `manual-browser-support.json` is tracked separately in **`PWAscore-8ii`**; this feature is deliberately independent and documents the limitation in the UI only if a manual feature ever shows a delta (defensive copy, not expected).
- **`version_removed` is ignored** (inherited from `isVersionSupported`) — un-shipped features read as supported throughout history. Tiny set; accepted.
- Deltas are computed for the **series in the modal** (recent majors window + current + beta, per the June design); there is no full-1970s-history browser diff.

---

## UI sketch

```
┌ Safari iOS — score over time ────────────────┐
│ 27 (beta)            ▲ +0.0   ▸ expand        │
│ 26.6  Jun 2026       87 pts  ▾ 26.5 → 26.6    │
│   ┌ +1.1 pts — 3 features changed ─────────┐  │
│   │ ● Added     Badging API            w2  │  │
│   │ ● Added     File Handling API      w2  │  │
│   │ ● Improved  Notification Triggers  w1  │  │
│   └ (each row links to BCD/mdn) ───────────┘  │
│ 26.5  May 2026       86 pts  ▸ expand          │
└───────────────────────────────────────────────┘
```

Modal wiring: reuse the existing modal's browser context and version list (`getBrowserReleases` output, same channel classification); rows render lazily (expand = resolve + classify; collapse = drop refs, keep cache).

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
