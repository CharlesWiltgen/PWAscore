# Group-Level Scores Design

**Goal:** Display weighted PWA support scores on each top-level feature group accordion header, so users can quickly identify where browsers differ without expanding every section.

**Addresses:** [GitHub Issue #1](https://github.com/charleswiltgen/pwascore/issues/1)

---

## Requirements

- Show a weighted percentage score per group on each group accordion header
- Use the same weighted scoring formula as the overall score
- Exclude experimental/non-standard/deprecated features from group scores by default
- Include them when `hideExperimental` is `false` (matches overall score behavior)
- Display as a badge with transparent background (no color coding)
- Scores appear per browser, per group (3 browsers x 6 groups = 18 badges)

## Architecture

Two changes: extend the scoring composable to compute per-group scores, then render them in the accordion headers.

### Data Layer: `useBrowserScore.ts`

Extend `calculateBrowserScore` to accumulate per-group scores during its existing feature iteration loop. No new functions needed.

**Return type change:**

`calculateBrowserScore` return type changes from `BrowserScores` to a new exported `BrowserScoreResult` interface. The top-level `weighted`, `unweighted`, `weightedFull`, `unweightedFull` fields are preserved, so existing call sites (`browser.scores.weighted` etc.) require no changes.

```ts
export interface BrowserScoreResult {
  // Overall scores (unchanged — same fields as BrowserScores)
  weighted: number
  unweighted: number
  weightedFull: number
  unweightedFull: number
  // New: per-group scores keyed by group.id
  groupScores: Record<string, BrowserScores>
}
```

**Implementation:** Inside the existing `for (const group of featureGroups)` loop, maintain per-group accumulators (stableWeightedPoints, stableTotalPossibleWeight, etc.) mirroring the overall accumulators. After processing each group's features, compute the group's percentage and store it in the `groupScores` map. The overall accumulators continue to work as before.

The `BrowserScores` interface is reused for group scores — each group gets `weighted`, `unweighted`, `weightedFull`, and `unweightedFull` values using the same formula.

### UI Layer: `PWAFeatureBrowser.vue`

The group accordion is rendered at line 587. Each group's content slot is already templated (`#[group.id]`). The group header is configured via `createGroupItems()` (line 443), which builds accordion item objects.

To add scores to the header, use the UAccordion's `#trailing` slot (scoped to each item). Since the accordion is rendered inside a `v-for` loop over browsers, the outer `browser` variable is available via closure to access `browser.scores.groupScores[group.id].weighted`. Render a `UBadge` with `variant="subtle"` for a transparent background.

Since the component renders one accordion per browser column, each browser's group headers naturally show that browser's group scores.

**Note:** The existing `handleGroupMetaClick` function (line 422) identifies groups by matching `button.textContent` against `group.name`. Adding badge text inside the header will break this. Fix by adding `data-group-id` attributes to accordion trigger buttons and matching on that instead of text content.

### Testing: `useBrowserScore.test.ts`

Add a `describe('groupScores')` block covering:

- `groupScores` keys match input group IDs exactly (no more, no fewer)
- Weighted formula matches overall score formula applied to group's features only
- Group with multiple categories accumulates scores across all categories
- Experimental features excluded from stable group scores
- Experimental features included in `weightedFull` group scores
- Groups with all-unknown features return 0
- Groups with mixed support levels compute correctly
- Empty groups (all features hidden/unknown) return 0

## Files Changed

| File                                      | Change                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| `app/composables/useBrowserScore.ts`      | Add per-group accumulators, return `groupScores` map |
| `app/composables/useBrowserScore.test.ts` | Add group score test cases                           |
| `app/components/PWAFeatureBrowser.vue`    | Render group score badge in accordion headers        |

## What This Does NOT Include

- Category-level scores (can be added later using the same pattern)
- Color-coded score badges (intentionally text-only with transparent background)
- Changes to the overall score display or tooltip
