import { describe, expect, test } from 'vitest'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import type { BrowserSupport, SupportLevel } from './useBrowserSupport'
import { useBrowserScore } from './useBrowserScore'

describe('useBrowserScore', () => {
  const { calculateBrowserScore } = useBrowserScore()

  // Test helper to create minimal test data
  function createMockFeatureGroup(
    features: Array<{
      weight?: number
      supportLevel: SupportLevel
      experimental?: boolean
      standardTrack?: boolean
    }>
  ): PWAFeatureGroup[] {
    return [
      {
        id: 'test-group',
        name: 'Test Group',
        description: 'Test group',
        categories: [
          {
            id: 'test-category',
            name: 'Test Category',
            description: 'Test category',
            features: features.map((f, i) => ({
              id: `feature-${i}`,
              name: `Feature ${i}`,
              description: `Feature ${i}`,
              weight: f.weight,
              status: {
                experimental: f.experimental ?? false,
                standard_track: f.standardTrack ?? true,
                deprecated: false
              }
            }))
          }
        ]
      }
    ]
  }

  function createMockGetSupport(
    features: Array<{
      weight?: number
      supportLevel: SupportLevel
      experimental?: boolean
      standardTrack?: boolean
    }>
  ) {
    return (featureId: string): BrowserSupport => {
      const index = Number.parseInt(featureId.replace('feature-', ''), 10)
      const feature = features[index]

      return {
        chrome_android: feature?.supportLevel || 'unknown',
        firefox_android: feature?.supportLevel || 'unknown',
        safari_ios: feature?.supportLevel || 'unknown',
        status: {
          experimental: feature?.experimental ?? false,
          standard_track: feature?.standardTrack ?? true,
          deprecated: false
        }
      }
    }
  }

  describe('getSupportWeight', () => {
    test('should return 1.0 for supported', () => {
      const features = createMockFeatureGroup([{ supportLevel: 'supported' }])
      const getSupport = createMockGetSupport([{ supportLevel: 'supported' }])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // One feature with weight 1.0 (default), fully supported = 100%
      expect(scores.weighted).toBe(100)
      expect(scores.unweighted).toBe(100)
    })

    test('should return 0.5 for partial support', () => {
      const features = createMockFeatureGroup([{ supportLevel: 'partial' }])
      const getSupport = createMockGetSupport([{ supportLevel: 'partial' }])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // One feature with weight 1.0, partially supported = 50%
      expect(scores.weighted).toBe(50)
      expect(scores.unweighted).toBe(50)
    })

    test('should return 0.0 for not-supported', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'not-supported' }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'not-supported' }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // One feature not supported = 0%
      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(0)
    })

    test('should return 0.0 for unknown (treat as not supported)', () => {
      const features = createMockFeatureGroup([{ supportLevel: 'unknown' }])
      const getSupport = createMockGetSupport([{ supportLevel: 'unknown' }])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // Unknown features are excluded from score (0 features counted)
      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(0)
    })
  })

  describe('shouldExcludeFromPrimaryScore', () => {
    test('should exclude experimental features', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported', experimental: true, standardTrack: true }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported', experimental: true, standardTrack: true }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // Experimental features excluded from stable score
      expect(scores.weighted).toBe(0) // Stable score
      expect(scores.weightedFull).toBe(100) // Full score includes it
    })

    test('should exclude non-standard features', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported', experimental: false, standardTrack: false }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported', experimental: false, standardTrack: false }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // Non-standard features excluded from stable score
      expect(scores.weighted).toBe(0) // Stable score
      expect(scores.weightedFull).toBe(100) // Full score includes it
    })

    test('should include stable standard features in both scores', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported', experimental: false, standardTrack: true }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported', experimental: false, standardTrack: true }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // Stable standard features included in both scores
      expect(scores.weighted).toBe(100)
      expect(scores.weightedFull).toBe(100)
    })
  })

  describe('calculateBrowserScore', () => {
    test('should return 0 for empty feature list', () => {
      const emptyFeatures: PWAFeatureGroup[] = []
      const getSupport = createMockGetSupport([])

      const scores = calculateBrowserScore(
        'chrome_android',
        emptyFeatures,
        getSupport
      )

      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(0)
      expect(scores.weightedFull).toBe(0)
      expect(scores.unweightedFull).toBe(0)
    })

    test('should handle all unknown features (division by zero protection)', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'unknown' },
        { supportLevel: 'unknown' },
        { supportLevel: 'unknown' }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'unknown' },
        { supportLevel: 'unknown' },
        { supportLevel: 'unknown' }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // All unknown = 0 features counted, should not crash
      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(0)
    })

    test('should handle mixed support levels', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported' },
        { supportLevel: 'partial' },
        { supportLevel: 'not-supported' }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported' },
        { supportLevel: 'partial' },
        { supportLevel: 'not-supported' }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // 3 features: 1.0 + 0.5 + 0.0 = 1.5 / 3.0 = 50%
      expect(scores.weighted).toBe(50)
      expect(scores.unweighted).toBe(50)
    })

    test('should apply custom weights correctly', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported', weight: 3.0 }, // Core feature
        { supportLevel: 'supported', weight: 1.0 } // Standard feature
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported', weight: 3.0 },
        { supportLevel: 'supported', weight: 1.0 }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // weighted: (3.0 * 1.0 + 1.0 * 1.0) / (3.0 + 1.0) = 4.0 / 4.0 = 100%
      // unweighted: (1.0 + 1.0) / 2 = 100%
      expect(scores.weighted).toBe(100)
      expect(scores.unweighted).toBe(100)
    })

    test('should weight core features more heavily', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'not-supported', weight: 3.0 }, // Core feature missing
        { supportLevel: 'supported', weight: 1.0 },
        { supportLevel: 'supported', weight: 1.0 }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'not-supported', weight: 3.0 },
        { supportLevel: 'supported', weight: 1.0 },
        { supportLevel: 'supported', weight: 1.0 }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // weighted: (3.0 * 0.0 + 1.0 * 1.0 + 1.0 * 1.0) / (3.0 + 1.0 + 1.0) = 2.0 / 5.0 = 40%
      // unweighted: (0.0 + 1.0 + 1.0) / 3 = 67%
      expect(scores.weighted).toBe(40)
      expect(scores.unweighted).toBe(67)
    })

    test('should handle features with weight 0 (division by zero protection)', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported', weight: 0 },
        { supportLevel: 'supported', weight: 0 }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported', weight: 0 },
        { supportLevel: 'supported', weight: 0 }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // Weight 0 features: totalPossibleWeight = 0, should not crash
      expect(scores.weighted).toBe(0) // Protected by stableTotalPossibleWeight > 0 check
      expect(scores.unweighted).toBe(100) // Unweighted still works
    })

    test('should round scores correctly', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported' },
        { supportLevel: 'supported' },
        { supportLevel: 'partial' } // 0.5
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported' },
        { supportLevel: 'supported' },
        { supportLevel: 'partial' }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // (1.0 + 1.0 + 0.5) / 3.0 = 2.5 / 3.0 = 0.8333... = 83% (rounded)
      expect(scores.weighted).toBe(83)
      expect(scores.unweighted).toBe(83)
    })

    test('should separate stable and full scores correctly', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported', experimental: false, standardTrack: true }, // Stable
        { supportLevel: 'supported', experimental: true, standardTrack: true }, // Experimental
        { supportLevel: 'supported', experimental: false, standardTrack: false } // Non-standard
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported', experimental: false, standardTrack: true },
        { supportLevel: 'supported', experimental: true, standardTrack: true },
        { supportLevel: 'supported', experimental: false, standardTrack: false }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // Stable: Only 1 feature = 100%
      // Full: All 3 features = 100%
      expect(scores.weighted).toBe(100)
      expect(scores.weightedFull).toBe(100)
      expect(scores.unweighted).toBe(100)
      expect(scores.unweightedFull).toBe(100)
    })

    test('should handle stable vs experimental feature scores correctly', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported', experimental: false, standardTrack: true },
        {
          supportLevel: 'not-supported',
          experimental: true,
          standardTrack: true
        }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported', experimental: false, standardTrack: true },
        {
          supportLevel: 'not-supported',
          experimental: true,
          standardTrack: true
        }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // Stable score: 1 supported feature = 100%
      expect(scores.weighted).toBe(100)
      expect(scores.unweighted).toBe(100)

      // Full score: 1 supported + 1 not-supported = 50%
      // Note: Full score can be LOWER than stable score when experimental features are poorly supported
      expect(scores.weightedFull).toBe(50)
      expect(scores.unweightedFull).toBe(50)
    })

    test('should ensure scores are always 0-100', () => {
      const features = createMockFeatureGroup([
        { supportLevel: 'supported', weight: 10.0 },
        { supportLevel: 'partial', weight: 0.1 }
      ])
      const getSupport = createMockGetSupport([
        { supportLevel: 'supported', weight: 10.0 },
        { supportLevel: 'partial', weight: 0.1 }
      ])

      const scores = calculateBrowserScore(
        'chrome_android',
        features,
        getSupport
      )

      // All scores must be 0-100
      expect(scores.weighted).toBeGreaterThanOrEqual(0)
      expect(scores.weighted).toBeLessThanOrEqual(100)
      expect(scores.unweighted).toBeGreaterThanOrEqual(0)
      expect(scores.unweighted).toBeLessThanOrEqual(100)
      expect(scores.weightedFull).toBeGreaterThanOrEqual(0)
      expect(scores.weightedFull).toBeLessThanOrEqual(100)
      expect(scores.unweightedFull).toBeGreaterThanOrEqual(0)
      expect(scores.unweightedFull).toBeLessThanOrEqual(100)
    })
  })

  describe('groupScores', () => {
    type FeatureSpec = {
      supportLevel: SupportLevel
      weight?: number
      experimental?: boolean
      standardTrack?: boolean
    }

    function createMultiGroupData(
      groups: Array<{
        id: string
        categories: Array<{ id: string, features: FeatureSpec[] }>
      }>
    ): PWAFeatureGroup[] {
      return groups.map(g => ({
        id: g.id,
        name: g.id,
        description: g.id,
        categories: g.categories.map(c => ({
          id: c.id,
          name: c.id,
          description: c.id,
          features: c.features.map((f, i) => ({
            id: `${g.id}-${c.id}-f${i}`,
            name: `Feature ${i}`,
            description: `Feature ${i}`,
            weight: f.weight,
            status: {
              experimental: f.experimental ?? false,
              standard_track: f.standardTrack ?? true,
              deprecated: false
            }
          }))
        }))
      }))
    }

    function createMultiGroupGetSupport(
      groups: Array<{
        id: string
        categories: Array<{ id: string, features: FeatureSpec[] }>
      }>
    ) {
      const featureMap = new Map<string, FeatureSpec>()
      for (const g of groups) {
        for (const c of g.categories) {
          c.features.forEach((f, i) => {
            featureMap.set(`${g.id}-${c.id}-f${i}`, f)
          })
        }
      }
      return (featureId: string): BrowserSupport => {
        const f = featureMap.get(featureId)
        return {
          chrome_android: f?.supportLevel || 'unknown',
          firefox_android: f?.supportLevel || 'unknown',
          safari_ios: f?.supportLevel || 'unknown',
          status: {
            experimental: f?.experimental ?? false,
            standard_track: f?.standardTrack ?? true,
            deprecated: false
          }
        }
      }
    }

    test('should return groupScores keyed by group id', () => {
      const groupDefs = [
        { id: 'group-a', categories: [{ id: 'cat-1', features: [{ supportLevel: 'supported' as const }] }] },
        { id: 'group-b', categories: [{ id: 'cat-2', features: [{ supportLevel: 'not-supported' as const }] }] }
      ]
      const data = createMultiGroupData(groupDefs)
      const getSupport = createMultiGroupGetSupport(groupDefs)

      const result = calculateBrowserScore('chrome_android', data, getSupport)

      expect(Object.keys(result.groupScores).sort()).toEqual(['group-a', 'group-b'])
    })

    test('should compute correct weighted score per group', () => {
      const groupDefs = [
        { id: 'group-a', categories: [{ id: 'cat-1', features: [
          { supportLevel: 'supported' as const, weight: 3.0 },
          { supportLevel: 'not-supported' as const, weight: 1.0 }
        ] }] },
        { id: 'group-b', categories: [{ id: 'cat-2', features: [
          { supportLevel: 'supported' as const }
        ] }] }
      ]
      const data = createMultiGroupData(groupDefs)
      const getSupport = createMultiGroupGetSupport(groupDefs)

      const result = calculateBrowserScore('chrome_android', data, getSupport)

      // group-a: (3.0*1.0 + 1.0*0.0) / (3.0+1.0) = 3.0/4.0 = 75%
      expect(result.groupScores['group-a']!.weighted).toBe(75)
      // group-b: 1.0/1.0 = 100%
      expect(result.groupScores['group-b']!.weighted).toBe(100)
    })

    test('should accumulate across multiple categories in a group', () => {
      const groupDefs = [
        { id: 'group-a', categories: [
          { id: 'cat-1', features: [{ supportLevel: 'supported' as const }] },
          { id: 'cat-2', features: [{ supportLevel: 'not-supported' as const }] }
        ] }
      ]
      const data = createMultiGroupData(groupDefs)
      const getSupport = createMultiGroupGetSupport(groupDefs)

      const result = calculateBrowserScore('chrome_android', data, getSupport)

      // (1.0 + 0.0) / 2.0 = 50%
      expect(result.groupScores['group-a']!.weighted).toBe(50)
    })

    test('should exclude experimental features from stable group scores', () => {
      const groupDefs = [
        { id: 'group-a', categories: [{ id: 'cat-1', features: [
          { supportLevel: 'supported' as const, experimental: false },
          { supportLevel: 'supported' as const, experimental: true }
        ] }] }
      ]
      const data = createMultiGroupData(groupDefs)
      const getSupport = createMultiGroupGetSupport(groupDefs)

      const result = calculateBrowserScore('chrome_android', data, getSupport)

      // Stable: 1 feature = 100%
      expect(result.groupScores['group-a']!.weighted).toBe(100)
      // Full: 2 features both supported = 100%
      expect(result.groupScores['group-a']!.weightedFull).toBe(100)
    })

    test('should return 0 for group with all unknown features', () => {
      const groupDefs = [
        { id: 'group-a', categories: [{ id: 'cat-1', features: [
          { supportLevel: 'unknown' as const },
          { supportLevel: 'unknown' as const }
        ] }] }
      ]
      const data = createMultiGroupData(groupDefs)
      const getSupport = createMultiGroupGetSupport(groupDefs)

      const result = calculateBrowserScore('chrome_android', data, getSupport)

      expect(result.groupScores['group-a']!.weighted).toBe(0)
      expect(result.groupScores['group-a']!.unweighted).toBe(0)
    })

    test('should not affect overall scores', () => {
      const groupDefs = [
        { id: 'group-a', categories: [{ id: 'cat-1', features: [{ supportLevel: 'supported' as const }] }] },
        { id: 'group-b', categories: [{ id: 'cat-2', features: [{ supportLevel: 'not-supported' as const }] }] }
      ]
      const data = createMultiGroupData(groupDefs)
      const getSupport = createMultiGroupGetSupport(groupDefs)

      const result = calculateBrowserScore('chrome_android', data, getSupport)

      // Overall: (1.0 + 0.0) / 2.0 = 50%
      expect(result.weighted).toBe(50)
    })
  })
})
