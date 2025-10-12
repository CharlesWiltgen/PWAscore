import { describe, expect, test } from 'vitest'
import pwaFeaturesData from './pwa-features.json'
import { validatePWAFeatures } from './pwa-features.schema'

describe('PWA Features Data Integrity', () => {
  test('should validate entire dataset without errors', () => {
    expect(() => validatePWAFeatures(pwaFeaturesData)).not.toThrow()
  })

  test('should have expected number of groups', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    expect(features).toHaveLength(14)
  })

  test('should have expected number of categories', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const categories = features.flatMap(g => g.categories)
    expect(categories).toHaveLength(43)
  })

  test('should have expected number of features', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allFeatures = features.flatMap(g =>
      g.categories.flatMap(c => c.features)
    )
    expect(allFeatures).toHaveLength(163)
  })

  test('should have unique feature IDs', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allIds = features.flatMap(g =>
      g.categories.flatMap(c => c.features.map(f => f.id))
    )
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(allIds.length)
  })

  test('should have unique group IDs', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const groupIds = features.map(g => g.id)
    const uniqueIds = new Set(groupIds)
    expect(uniqueIds.size).toBe(groupIds.length)
  })

  test('should have unique category IDs within their context', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allCategoryIds = features.flatMap(g =>
      g.categories.map(c => c.id)
    )
    const uniqueIds = new Set(allCategoryIds)
    expect(uniqueIds.size).toBe(allCategoryIds.length)
  })

  test('should have valid weight values', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allWeights = features.flatMap(g =>
      g.categories.flatMap(c =>
        c.features
          .map(f => f.weight)
          .filter((w): w is number => w !== undefined)
      )
    )

    allWeights.forEach((weight) => {
      expect(weight).toBeGreaterThanOrEqual(0.5)
      expect(weight).toBeLessThanOrEqual(3.0)
    })
  })

  test('should have all features with non-empty names', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allFeatures = features.flatMap(g =>
      g.categories.flatMap(c => c.features)
    )

    allFeatures.forEach((feature) => {
      expect(feature.name).toBeTruthy()
      expect(feature.name.length).toBeGreaterThan(0)
    })
  })

  test('should have all features with non-empty descriptions', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allFeatures = features.flatMap(g =>
      g.categories.flatMap(c => c.features)
    )

    allFeatures.forEach((feature) => {
      expect(feature.description).toBeTruthy()
      expect(feature.description.length).toBeGreaterThan(0)
    })
  })

  test('should have all features with non-empty IDs', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allFeatures = features.flatMap(g =>
      g.categories.flatMap(c => c.features)
    )

    allFeatures.forEach((feature) => {
      expect(feature.id).toBeTruthy()
      expect(feature.id.length).toBeGreaterThan(0)
    })
  })

  test('should have all groups with non-empty names and descriptions', () => {
    const features = validatePWAFeatures(pwaFeaturesData)

    features.forEach((group) => {
      expect(group.name).toBeTruthy()
      expect(group.name.length).toBeGreaterThan(0)
      expect(group.description).toBeTruthy()
      expect(group.description.length).toBeGreaterThan(0)
    })
  })

  test('should have all categories with non-empty names and descriptions', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allCategories = features.flatMap(g => g.categories)

    allCategories.forEach((category) => {
      expect(category.name).toBeTruthy()
      expect(category.name.length).toBeGreaterThan(0)
      expect(category.description).toBeTruthy()
      expect(category.description.length).toBeGreaterThan(0)
    })
  })

  test('should have valid status objects when present', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const featuresWithStatus = features.flatMap(g =>
      g.categories.flatMap(c =>
        c.features.filter(f => f.status !== undefined)
      )
    )

    featuresWithStatus.forEach((feature) => {
      expect(typeof feature.status?.experimental).toBe('boolean')
      expect(typeof feature.status?.standard_track).toBe('boolean')
      expect(typeof feature.status?.deprecated).toBe('boolean')
    })
  })

  test('should have at least one feature per category', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allCategories = features.flatMap(g => g.categories)

    allCategories.forEach((category) => {
      expect(category.features.length).toBeGreaterThan(0)
    })
  })

  test('should have at least one category per group', () => {
    const features = validatePWAFeatures(pwaFeaturesData)

    features.forEach((group) => {
      expect(group.categories.length).toBeGreaterThan(0)
    })
  })

  test('should have specific core groups present', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const groupIds = features.map(g => g.id)

    // Check for some expected core groups
    expect(groupIds).toContain('installation-core')
    expect(groupIds).toContain('security-privacy')
  })

  test('should have icons for all groups', () => {
    const features = validatePWAFeatures(pwaFeaturesData)

    features.forEach((group) => {
      if (group.icon) {
        expect(group.icon).toBeTruthy()
        expect(group.icon.length).toBeGreaterThan(0)
      }
    })
  })

  test('should have consistent ID format (kebab-case)', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allIds = [
      ...features.map(g => g.id),
      ...features.flatMap(g => g.categories.map(c => c.id)),
      ...features.flatMap(g =>
        g.categories.flatMap(c => c.features.map(f => f.id))
      )
    ]

    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/

    allIds.forEach((id) => {
      expect(id).toMatch(kebabCaseRegex)
    })
  })
})
