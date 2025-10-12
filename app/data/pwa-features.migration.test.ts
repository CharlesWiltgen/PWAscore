import { describe, expect, test } from 'vitest'
import pwaFeaturesData from './pwa-features.json'
import { validatePWAFeatures } from './pwa-features.schema'

/**
 * Migration verification tests
 * Verifies that the extracted JSON data matches expected structure and known values
 * Based on extraction script output: 14 groups, 43 categories, 163 features
 */
describe('Migration Verification', () => {
  test('should have extracted all 14 groups', () => {
    expect(pwaFeaturesData).toHaveLength(14)
  })

  test('should have extracted all 43 categories', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const categories = features.flatMap(g => g.categories)
    expect(categories).toHaveLength(43)
  })

  test('should have extracted all 163 features', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allFeatures = features.flatMap(g =>
      g.categories.flatMap(c => c.features)
    )
    expect(allFeatures).toHaveLength(163)
  })

  test('should include expected core groups', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const groupIds = features.map(g => g.id)

    // Verify some known core groups exist
    expect(groupIds).toContain('installation-core')
    expect(groupIds).toContain('notifications-communication')
    expect(groupIds).toContain('security-privacy')
    expect(groupIds).toContain('device-hardware')
  })

  test('should preserve web-app-manifest feature with correct properties', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const installationGroup = features.find(g => g.id === 'installation-core')
    expect(installationGroup).toBeDefined()

    const appInstallCategory = installationGroup?.categories.find(
      c => c.id === 'app-installation'
    )
    expect(appInstallCategory).toBeDefined()

    const manifestFeature = appInstallCategory?.features.find(
      f => f.id === 'web-app-manifest'
    )
    expect(manifestFeature).toBeDefined()
    expect(manifestFeature?.name).toBe('Web App Manifest')
    expect(manifestFeature?.weight).toBe(3.0)
    expect(manifestFeature?.canIUseId).toBe('web-app-manifest')
  })

  test('should preserve service-worker-registration feature', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const installationGroup = features.find(g => g.id === 'installation-core')
    const serviceWorkerCategory = installationGroup?.categories.find(
      c => c.id === 'service-workers'
    )
    const swFeature = serviceWorkerCategory?.features.find(
      f => f.id === 'service-worker-registration'
    )

    expect(swFeature).toBeDefined()
    expect(swFeature?.name).toBe('Service Worker Registration')
    expect(swFeature?.weight).toBe(3.0)
    expect(swFeature?.canIUseId).toBe('serviceworkers')
  })

  test('should preserve push-api feature with correct properties', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const notificationsGroup = features.find(
      g => g.id === 'notifications-communication'
    )
    const pushCategory = notificationsGroup?.categories.find(
      c => c.id === 'push-notifications'
    )
    const pushFeature = pushCategory?.features.find(f => f.id === 'push-api')

    expect(pushFeature).toBeDefined()
    expect(pushFeature?.name).toBe('Push API')
    expect(pushFeature?.weight).toBe(2.0)
    expect(pushFeature?.canIUseId).toBe('push-api')
    expect(pushFeature?.mdnBcdPath).toBe('api.PushManager')
  })

  test('should preserve features with status objects', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const backgroundGroup = features.find(
      g => g.id === 'background-capabilities'
    )
    const syncCategory = backgroundGroup?.categories.find(
      c => c.id === 'background-sync'
    )
    const syncFeature = syncCategory?.features.find(
      f => f.id === 'background-sync-api'
    )

    expect(syncFeature).toBeDefined()
    expect(syncFeature?.status).toBeDefined()
    expect(syncFeature?.status?.experimental).toBe(true)
    expect(syncFeature?.status?.standard_track).toBe(false)
    expect(syncFeature?.status?.deprecated).toBe(false)
  })

  test('should have all groups with icons', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    features.forEach((group) => {
      expect(group.icon).toBeDefined()
      expect(group.icon).toBeTruthy()
    })
  })

  test('should validate entire dataset with schema', () => {
    expect(() => validatePWAFeatures(pwaFeaturesData)).not.toThrow()
  })

  test('should have all features with required fields', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allFeatures = features.flatMap(g =>
      g.categories.flatMap(c => c.features)
    )

    allFeatures.forEach((feature) => {
      expect(feature.id).toBeTruthy()
      expect(feature.name).toBeTruthy()
      expect(feature.description).toBeTruthy()
    })
  })

  test('should have correct weight distribution', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allFeatures = features.flatMap(g =>
      g.categories.flatMap(c => c.features)
    )

    // All 163 features should have weights
    const featuresWithWeights = allFeatures.filter(
      f => f.weight !== undefined
    )
    expect(featuresWithWeights).toHaveLength(163)

    // Check some core features have weight 3.0
    const coreFeatures = allFeatures.filter(f => f.weight === 3.0)
    expect(coreFeatures.length).toBeGreaterThan(0)

    // Verify expected core features
    const coreFeatureIds = coreFeatures.map(f => f.id)
    expect(coreFeatureIds).toContain('web-app-manifest')
    expect(coreFeatureIds).toContain('service-worker-registration')
  })

  test('should preserve security and privacy features', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const securityGroup = features.find(g => g.id === 'security-privacy')

    expect(securityGroup).toBeDefined()
    expect(securityGroup?.name).toBe('Security & Privacy')

    const permissionsCategory = securityGroup?.categories.find(
      c => c.id === 'permissions'
    )
    expect(permissionsCategory).toBeDefined()

    const permissionsFeature = permissionsCategory?.features.find(
      f => f.id === 'permissions-api'
    )
    expect(permissionsFeature).toBeDefined()
  })

  test('should preserve file system features', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const fileGroup = features.find(g => g.id === 'file-data-management')
    expect(fileGroup).toBeDefined()

    const fileSystemCategory = fileGroup?.categories.find(
      c => c.id === 'file-system'
    )
    expect(fileSystemCategory).toBeDefined()

    const fileAccessFeature = fileSystemCategory?.features.find(
      f => f.id === 'file-system-access'
    )
    expect(fileAccessFeature).toBeDefined()
    expect(fileAccessFeature?.canIUseId).toBe('native-filesystem-api')
  })

  test('should have no duplicate feature IDs', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const allIds = features.flatMap(g =>
      g.categories.flatMap(c => c.features.map(f => f.id))
    )
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(allIds.length)
  })

  test('should have no duplicate group IDs', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    const groupIds = features.map(g => g.id)
    const uniqueIds = new Set(groupIds)
    expect(uniqueIds.size).toBe(groupIds.length)
  })

  test('should have consistent data structure across all groups', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    features.forEach((group) => {
      expect(group.id).toBeTruthy()
      expect(group.name).toBeTruthy()
      expect(group.description).toBeTruthy()
      expect(group.categories).toBeInstanceOf(Array)
      expect(group.categories.length).toBeGreaterThan(0)

      group.categories.forEach((category) => {
        expect(category.id).toBeTruthy()
        expect(category.name).toBeTruthy()
        expect(category.description).toBeTruthy()
        expect(category.features).toBeInstanceOf(Array)
        expect(category.features.length).toBeGreaterThan(0)
      })
    })
  })
})
