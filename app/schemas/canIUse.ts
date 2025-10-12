/**
 * Valibot schemas for validating external API responses
 * Ensures CanIUse and MDN BCD data structures are correct at runtime
 */

import * as v from 'valibot'

/**
 * CanIUse Data Structure Schema
 * Validates data from: https://github.com/Fyrd/caniuse/blob/main/fulldata-json/data-2.0.json
 */

const AgentVersionSchema = v.object({
  version: v.string(),
  // Additional fields may exist but aren't required
  global_usage: v.optional(v.nullable(v.number())),
  release_date: v.optional(v.nullable(v.number())) // Can be null for unreleased versions
})

const AgentSchema = v.object({
  browser: v.string(),
  current_version: v.optional(v.string()),
  version_list: v.array(AgentVersionSchema)
})

const FeatureStatsSchema = v.object({
  stats: v.record(v.string(), v.record(v.string(), v.string()))
})

export const CanIUseDataSchema = v.object({
  agents: v.record(v.string(), AgentSchema),
  data: v.record(v.string(), FeatureStatsSchema)
})

export type CanIUseData = v.InferOutput<typeof CanIUseDataSchema>

/**
 * MDN Browser Compatibility Data Schema
 * Validates data from: @mdn/browser-compat-data
 */

const MdnBcdFlagSchema = v.object({
  name: v.string(),
  type: v.string(),
  value_to_set: v.optional(v.string())
})

const MdnBcdSupportSchema = v.object({
  version_added: v.union([v.string(), v.boolean(), v.null()]),
  version_removed: v.optional(v.string()),
  partial_implementation: v.optional(v.boolean()),
  flags: v.optional(v.array(MdnBcdFlagSchema))
})

const MdnBcdStatusSchema = v.object({
  experimental: v.optional(v.boolean()),
  standard_track: v.optional(v.boolean()),
  deprecated: v.optional(v.boolean())
})

const MdnBcdCompatSchema = v.object({
  mdn_url: v.optional(v.string()),
  support: v.optional(v.record(v.string(), v.union([
    MdnBcdSupportSchema,
    v.array(MdnBcdSupportSchema)
  ]))),
  status: v.optional(MdnBcdStatusSchema)
})

// MDN BCD has a recursive structure - features can contain sub-features
// Using looseObject to allow __compat plus any additional nested feature properties
export const MdnBcdFeatureSchema = v.looseObject({
  __compat: v.optional(MdnBcdCompatSchema)
})

export type MdnBcdFeature = v.InferOutput<typeof MdnBcdFeatureSchema>

/**
 * Browser Support Schema
 * Used for validating MANUAL_SUPPORT entries
 */

export const SupportLevelSchema = v.picklist([
  'supported',
  'partial',
  'not-supported',
  'unknown'
])

export const FeatureStatusSchema = v.object({
  experimental: v.boolean(),
  standard_track: v.boolean(),
  deprecated: v.boolean()
})

export const BrowserSupportSchema = v.object({
  chrome_android: SupportLevelSchema,
  firefox_android: SupportLevelSchema,
  safari_ios: SupportLevelSchema,
  status: v.optional(FeatureStatusSchema),
  chrome_androidVersion: v.optional(v.string()),
  firefox_androidVersion: v.optional(v.string()),
  safari_iosVersion: v.optional(v.string())
})

export type BrowserSupport = v.InferOutput<typeof BrowserSupportSchema>

/**
 * Validation helper functions
 */

/**
 * Safely parse and validate data, providing detailed error messages
 */
export function safeParseCanIUseData(data: unknown): {
  success: boolean
  data?: CanIUseData
  error?: string
} {
  try {
    const result = v.safeParse(CanIUseDataSchema, data)
    if (result.success) {
      return { success: true, data: result.output }
    } else {
      const errorMessage = v.flatten<typeof CanIUseDataSchema>(result.issues)
      return {
        success: false,
        error: `CanIUse data validation failed: ${JSON.stringify(errorMessage, null, 2)}`
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `CanIUse data validation error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Validate MDN BCD feature data
 */
export function safeParseMdnBcdFeature(data: unknown): {
  success: boolean
  data?: MdnBcdFeature
  error?: string
} {
  try {
    const result = v.safeParse(MdnBcdFeatureSchema, data)
    if (result.success) {
      return { success: true, data: result.output }
    } else {
      const errorMessage = v.flatten<typeof MdnBcdFeatureSchema>(result.issues)
      return {
        success: false,
        error: `MDN BCD feature validation failed: ${JSON.stringify(errorMessage, null, 2)}`
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `MDN BCD feature validation error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Validate browser support object
 */
export function safeParseBrowserSupport(data: unknown): {
  success: boolean
  data?: BrowserSupport
  error?: string
} {
  try {
    const result = v.safeParse(BrowserSupportSchema, data)
    if (result.success) {
      return { success: true, data: result.output }
    } else {
      const errorMessage = v.flatten<typeof BrowserSupportSchema>(result.issues)
      return {
        success: false,
        error: `Browser support validation failed: ${JSON.stringify(errorMessage, null, 2)}`
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Browser support validation error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
