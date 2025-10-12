/**
 * Valibot schemas for PWA feature data validation
 * Ensures feature data integrity at runtime
 */

import * as v from 'valibot'
import { FeatureStatusSchema } from '../schemas/canIUse'

/**
 * PWA Feature Schema
 * Represents a single PWA feature with its metadata
 */
export const PWAFeatureSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  apiName: v.optional(v.string()),
  specification: v.optional(v.string()),
  canIUseId: v.optional(v.string()),
  mdnBcdPath: v.optional(v.string()),
  weight: v.optional(v.number()),
  status: v.optional(FeatureStatusSchema)
})

export type PWAFeature = v.InferOutput<typeof PWAFeatureSchema>

/**
 * PWA Feature Category Schema
 * Represents a category containing multiple features
 */
export const PWAFeatureCategorySchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  features: v.array(PWAFeatureSchema)
})

export type PWAFeatureCategory = v.InferOutput<typeof PWAFeatureCategorySchema>

/**
 * PWA Feature Group Schema
 * Represents a top-level group containing multiple categories
 */
export const PWAFeatureGroupSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  icon: v.optional(v.string()),
  categories: v.array(PWAFeatureCategorySchema)
})

export type PWAFeatureGroup = v.InferOutput<typeof PWAFeatureGroupSchema>

/**
 * PWA Features Array Schema
 * Validates the entire features dataset
 */
export const PWAFeaturesArraySchema = v.array(PWAFeatureGroupSchema)

/**
 * Validate PWA features data with detailed error reporting
 * @param data - Unknown data to validate
 * @returns Validated PWAFeatureGroup array
 * @throws Error if validation fails
 */
export function validatePWAFeatures(data: unknown): PWAFeatureGroup[] {
  const result = v.safeParse(PWAFeaturesArraySchema, data)

  if (!result.success) {
    const errorMessage = v.flatten<typeof PWAFeaturesArraySchema>(result.issues)
    console.error('PWA Features validation failed:', errorMessage)
    throw new Error(
      `PWA Features data validation failed: ${JSON.stringify(errorMessage, null, 2)}`
    )
  }

  return result.output
}
