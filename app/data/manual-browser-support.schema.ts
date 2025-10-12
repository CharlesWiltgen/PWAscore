/**
 * Valibot schemas for manual browser support data validation
 * Validates manual support entries for vendor-specific features without CanIUse/MDN BCD data
 */

import * as v from 'valibot'
import { BrowserSupportSchema } from '../schemas/canIUse'

/**
 * Manual Browser Support Schema
 * Maps feature IDs to their browser support data
 * Used for vendor-specific APIs not tracked by CanIUse or MDN BCD
 */
export const ManualBrowserSupportSchema = v.record(
  v.string(), // feature ID (e.g., 'apple-pay', 'google-pay')
  BrowserSupportSchema // browser support object
)

export type ManualBrowserSupport = v.InferOutput<
  typeof ManualBrowserSupportSchema
>

/**
 * Validate manual browser support data with detailed error reporting
 * @param data - Unknown data to validate
 * @returns Validated ManualBrowserSupport record
 * @throws Error if validation fails
 */
export function validateManualSupport(data: unknown): ManualBrowserSupport {
  const result = v.safeParse(ManualBrowserSupportSchema, data)

  if (!result.success) {
    const errorMessage = v.flatten<typeof ManualBrowserSupportSchema>(
      result.issues
    )
    console.error('Manual browser support validation failed:', errorMessage)
    throw new Error(
      `Manual browser support data validation failed: ${JSON.stringify(errorMessage, null, 2)}`
    )
  }

  return result.output
}
