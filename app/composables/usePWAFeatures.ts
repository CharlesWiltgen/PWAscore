import pwaFeaturesData from '~/data/pwa-features.json'
import {
  validatePWAFeatures,
  type PWAFeatureGroup,
  type PWAFeature,
  type PWAFeatureCategory
} from '~/data/pwa-features.schema'

/**
 * Cached PWA features data
 * Validated once at first access, then reused across all imports
 */
let cachedFeatures: PWAFeatureGroup[] | null = null
let validationError: Error | null = null

/**
 * Composable for accessing PWA features data
 * Provides validated PWA features with caching to avoid re-validation
 *
 * @returns Object containing features array and helper functions
 */
export function usePWAFeatures() {
  // If validation previously failed, throw the cached error
  if (validationError) {
    throw validationError
  }

  // Validate and cache on first access
  if (!cachedFeatures) {
    try {
      cachedFeatures = validatePWAFeatures(pwaFeaturesData)
    } catch (error) {
      validationError
        = error instanceof Error ? error : new Error(String(error))
      throw validationError
    }
  }

  // Helper function to get a specific feature by ID
  const getFeature = (id: string): PWAFeature | undefined => {
    if (!cachedFeatures) return undefined

    for (const group of cachedFeatures) {
      for (const category of group.categories) {
        const feature = category.features.find(f => f.id === id)
        if (feature) return feature
      }
    }
    return undefined
  }

  // Helper function to get a specific group by ID
  const getGroup = (id: string): PWAFeatureGroup | undefined => {
    return cachedFeatures?.find(g => g.id === id)
  }

  // Helper function to get a specific category by ID
  const getCategory = (id: string): PWAFeatureCategory | undefined => {
    if (!cachedFeatures) return undefined

    for (const group of cachedFeatures) {
      const category = group.categories.find(c => c.id === id)
      if (category) return category
    }
    return undefined
  }

  // Helper function to get all features by category
  const getFeaturesByCategory = (categoryId: string): PWAFeature[] => {
    const category = getCategory(categoryId)
    return category?.features ?? []
  }

  // Helper function to get all features by group
  const getFeaturesByGroup = (groupId: string): PWAFeature[] => {
    const group = getGroup(groupId)
    if (!group) return []

    return group.categories.flatMap(c => c.features)
  }

  // Helper function to get all features as a flat array
  const getAllFeatures = (): PWAFeature[] => {
    if (!cachedFeatures) return []

    return cachedFeatures.flatMap(g =>
      g.categories.flatMap(c => c.features)
    )
  }

  // Metadata about the features dataset
  const metadata = {
    groupCount: cachedFeatures.length,
    categoryCount: cachedFeatures.flatMap(g => g.categories).length,
    featureCount: getAllFeatures().length
  }

  return {
    features: cachedFeatures,
    getFeature,
    getGroup,
    getCategory,
    getFeaturesByCategory,
    getFeaturesByGroup,
    getAllFeatures,
    metadata
  }
}
