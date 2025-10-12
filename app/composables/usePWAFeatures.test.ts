import { describe, expect, test } from 'vitest'
import { usePWAFeatures } from './usePWAFeatures'

describe('usePWAFeatures', () => {
  test('should return validated features array', () => {
    const { features } = usePWAFeatures()

    expect(features).toBeDefined()
    expect(Array.isArray(features)).toBe(true)
    expect(features.length).toBe(14)
  })

  test('should return consistent data on multiple calls (caching)', () => {
    const first = usePWAFeatures()
    const second = usePWAFeatures()

    // Should return the same cached instance
    expect(first.features).toBe(second.features)
  })

  test('should provide metadata', () => {
    const { metadata } = usePWAFeatures()

    expect(metadata.groupCount).toBe(14)
    expect(metadata.categoryCount).toBe(43)
    expect(metadata.featureCount).toBe(163)
  })

  test('should get feature by ID', () => {
    const { getFeature } = usePWAFeatures()

    const manifestFeature = getFeature('web-app-manifest')
    expect(manifestFeature).toBeDefined()
    expect(manifestFeature?.name).toBe('Web App Manifest')
    expect(manifestFeature?.weight).toBe(3.0)
  })

  test('should return undefined for non-existent feature ID', () => {
    const { getFeature } = usePWAFeatures()

    const nonExistent = getFeature('does-not-exist')
    expect(nonExistent).toBeUndefined()
  })

  test('should get group by ID', () => {
    const { getGroup } = usePWAFeatures()

    const installationGroup = getGroup('installation-core')
    expect(installationGroup).toBeDefined()
    expect(installationGroup?.name).toBe('Installation & Core PWA Features')
    expect(installationGroup?.categories).toBeDefined()
  })

  test('should return undefined for non-existent group ID', () => {
    const { getGroup } = usePWAFeatures()

    const nonExistent = getGroup('does-not-exist')
    expect(nonExistent).toBeUndefined()
  })

  test('should get category by ID', () => {
    const { getCategory } = usePWAFeatures()

    const appInstallCategory = getCategory('app-installation')
    expect(appInstallCategory).toBeDefined()
    expect(appInstallCategory?.name).toBe('App Installation')
    expect(appInstallCategory?.features).toBeDefined()
  })

  test('should return undefined for non-existent category ID', () => {
    const { getCategory } = usePWAFeatures()

    const nonExistent = getCategory('does-not-exist')
    expect(nonExistent).toBeUndefined()
  })

  test('should get features by category ID', () => {
    const { getFeaturesByCategory } = usePWAFeatures()

    const features = getFeaturesByCategory('app-installation')
    expect(features).toBeDefined()
    expect(Array.isArray(features)).toBe(true)
    expect(features.length).toBeGreaterThan(0)

    // Check specific known features
    const featureIds = features.map(f => f.id)
    expect(featureIds).toContain('web-app-manifest')
  })

  test('should return empty array for non-existent category ID', () => {
    const { getFeaturesByCategory } = usePWAFeatures()

    const features = getFeaturesByCategory('does-not-exist')
    expect(features).toEqual([])
  })

  test('should get features by group ID', () => {
    const { getFeaturesByGroup } = usePWAFeatures()

    const features = getFeaturesByGroup('installation-core')
    expect(features).toBeDefined()
    expect(Array.isArray(features)).toBe(true)
    expect(features.length).toBeGreaterThan(0)
  })

  test('should return empty array for non-existent group ID', () => {
    const { getFeaturesByGroup } = usePWAFeatures()

    const features = getFeaturesByGroup('does-not-exist')
    expect(features).toEqual([])
  })

  test('should get all features as flat array', () => {
    const { getAllFeatures } = usePWAFeatures()

    const allFeatures = getAllFeatures()
    expect(allFeatures).toBeDefined()
    expect(Array.isArray(allFeatures)).toBe(true)
    expect(allFeatures).toHaveLength(163)

    // Verify structure
    allFeatures.forEach((feature) => {
      expect(feature.id).toBeDefined()
      expect(feature.name).toBeDefined()
      expect(feature.description).toBeDefined()
    })
  })

  test('should have all features with unique IDs in getAllFeatures', () => {
    const { getAllFeatures } = usePWAFeatures()

    const allFeatures = getAllFeatures()
    const ids = allFeatures.map(f => f.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
  })

  test('should find features with different properties', () => {
    const { getAllFeatures } = usePWAFeatures()

    const allFeatures = getAllFeatures()

    // Find a feature with canIUseId
    const withCanIUse = allFeatures.find(f => f.canIUseId !== undefined)
    expect(withCanIUse).toBeDefined()

    // Find a feature with mdnBcdPath
    const withMdn = allFeatures.find(f => f.mdnBcdPath !== undefined)
    expect(withMdn).toBeDefined()

    // Find a feature with status
    const withStatus = allFeatures.find(f => f.status !== undefined)
    expect(withStatus).toBeDefined()
  })

  test('should get correct features from nested categories', () => {
    const { getFeature, features } = usePWAFeatures()

    // Get a feature from a nested category
    const pushFeature = getFeature('push-api')
    expect(pushFeature).toBeDefined()

    // Verify it's in the correct group
    const notificationsGroup = features.find(
      g => g.id === 'notifications-communication'
    )
    expect(notificationsGroup).toBeDefined()

    const pushCategory = notificationsGroup?.categories.find(
      c => c.id === 'push-notifications'
    )
    expect(pushCategory).toBeDefined()

    const pushInCategory = pushCategory?.features.find(
      f => f.id === 'push-api'
    )
    expect(pushInCategory).toEqual(pushFeature)
  })

  test('should handle features with all optional fields', () => {
    const { getAllFeatures } = usePWAFeatures()

    const allFeatures = getAllFeatures()

    // Find features with no optional fields
    const minimalFeatures = allFeatures.filter(
      f =>
        !f.apiName
        && !f.specification
        && !f.canIUseId
        && !f.mdnBcdPath
        && !f.status
    )

    // Should still have required fields
    if (minimalFeatures.length > 0) {
      minimalFeatures.forEach((feature) => {
        expect(feature.id).toBeDefined()
        expect(feature.name).toBeDefined()
        expect(feature.description).toBeDefined()
      })
    }
  })

  test('should get features from security group', () => {
    const { getFeaturesByGroup } = usePWAFeatures()

    const securityFeatures = getFeaturesByGroup('security-privacy')
    expect(securityFeatures.length).toBeGreaterThan(0)

    const featureIds = securityFeatures.map(f => f.id)
    expect(featureIds).toContain('permissions-api')
  })

  test('should preserve feature weights', () => {
    const { getAllFeatures } = usePWAFeatures()

    const allFeatures = getAllFeatures()
    const manifestFeature = allFeatures.find(f => f.id === 'web-app-manifest')

    expect(manifestFeature?.weight).toBe(3.0)

    // Verify all weights are in valid range
    allFeatures.forEach((feature) => {
      if (feature.weight !== undefined) {
        expect(feature.weight).toBeGreaterThanOrEqual(0.5)
        expect(feature.weight).toBeLessThanOrEqual(3.0)
      }
    })
  })
})
