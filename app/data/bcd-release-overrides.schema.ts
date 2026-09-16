/**
 * Valibot schemas for BCD release overrides.
 *
 * BCD ships a released OS version in its `main` branch and nightly artifact days
 * to weeks before the stable npm/CDN release that the loader pins, and the
 * nightly asset is not CORS-readable from the browser (PWAscore-4ci), so a
 * known-shipped release would otherwise render as "beta" for that gap.
 *
 * This table is TEMPORARY BY CONSTRUCTION: every entry must carry a `note` with
 * its provenance and the condition for removal, and the live guard in
 * `canIUseLoader.integration.test.ts` (RUN_INTEGRATION=1, run weekly by
 * .github/workflows/live-data.yml) fails once the pinned BCD reports an
 * overridden version as released — which forces the cleanup on the next data
 * refresh instead of letting the table silently drift from upstream.
 *
 * An override only ever marks a release as shipped (date + not-upcoming); it
 * cannot downgrade a release and does not touch feature support data.
 */

import * as v from 'valibot'

const BROWSER_IDS = [
  'chrome',
  'chrome_android',
  'firefox',
  'firefox_android',
  'safari',
  'safari_ios'
] as const

const ReleaseOverrideSchema = v.object({
  releaseDate: v.pipe(
    v.string(),
    v.regex(/^\d{4}-\d{2}-\d{2}$/, 'releaseDate must be an ISO YYYY-MM-DD date')
  ),
  note: v.pipe(
    v.string(),
    v.minLength(
      40,
      'note must state the override provenance and its removal condition'
    )
  )
})

/**
 * Browser id -> version -> override. Keys mirror `browsers[browserId].releases`
 * in MDN BCD (the same ids as the app's BrowserId).
 */
export const BcdReleaseOverridesSchema = v.record(
  v.picklist(BROWSER_IDS),
  v.record(v.pipe(v.string(), v.regex(/^\d+(\.\d+)*$/)), ReleaseOverrideSchema)
)

export type BcdReleaseOverrides = v.InferOutput<
  typeof BcdReleaseOverridesSchema
>

/**
 * Validate BCD release overrides with detailed error reporting
 * @param data - Unknown data to validate
 * @returns Validated overrides map
 * @throws Error if validation fails
 */
export function validateBcdReleaseOverrides(
  data: unknown
): BcdReleaseOverrides {
  const result = v.safeParse(BcdReleaseOverridesSchema, data)

  if (!result.success) {
    const errorMessage = v.flatten<typeof BcdReleaseOverridesSchema>(
      result.issues
    )
    console.error('BCD release overrides validation failed:', errorMessage)
    throw new Error(
      `BCD release overrides validation failed: ${JSON.stringify(errorMessage, null, 2)}`
    )
  }

  return result.output
}
