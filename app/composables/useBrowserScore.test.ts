import { describe, expect, test } from 'vitest'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import type { BrowserSupport, SupportLevel } from './useBrowserSupport'
import { useBrowserScore } from './useBrowserScore'

describe('useBrowserScore', () => {
  const { calculateBrowserScore } = useBrowserScore()

  type FeatureSpec = {
    supportLevel: SupportLevel
    weight?: number
    experimental?: boolean
    standardTrack?: boolean
  }

  function createTestData(features: FeatureSpec[]): {
    groups: PWAFeatureGroup[]
    getSupport: (featureId: string) => BrowserSupport
  } {
    const groups: PWAFeatureGroup[] = [
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

    const getSupport = (featureId: string): BrowserSupport => {
      const index = Number.parseInt(featureId.replace('feature-', ''), 10)
      const feature = features[index]
      return {
        chrome_android: feature?.supportLevel || 'unknown',
        firefox_android: feature?.supportLevel || 'unknown',
        safari_ios: feature?.supportLevel || 'unknown',
        chrome: feature?.supportLevel || 'unknown',
        firefox: feature?.supportLevel || 'unknown',
        safari: feature?.supportLevel || 'unknown',
        status: {
          experimental: feature?.experimental ?? false,
          standard_track: feature?.standardTrack ?? true,
          deprecated: false
        }
      }
    }

    return { groups, getSupport }
  }

  describe('getSupportWeight', () => {
    test('should return 1.0 for supported', () => {
      const { groups, getSupport } = createTestData([{ supportLevel: 'supported' }])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(100)
      expect(scores.unweighted).toBe(100)
    })

    test('should return 0.5 for partial support', () => {
      const { groups, getSupport } = createTestData([{ supportLevel: 'partial' }])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(50)
      expect(scores.unweighted).toBe(50)
    })

    test('should return 0.0 for not-supported', () => {
      const { groups, getSupport } = createTestData([{ supportLevel: 'not-supported' }])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(0)
    })

    test('should return 0.0 for unknown (treat as not supported)', () => {
      const { groups, getSupport } = createTestData([{ supportLevel: 'unknown' }])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(0)
    })
  })

  describe('shouldExcludeFromPrimaryScore', () => {
    test('should exclude experimental features', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported', experimental: true, standardTrack: true }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(0)
      expect(scores.weightedFull).toBe(100)
    })

    test('should exclude non-standard features', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported', experimental: false, standardTrack: false }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(0)
      expect(scores.weightedFull).toBe(100)
    })

    test('should include stable standard features in both scores', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported', experimental: false, standardTrack: true }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(100)
      expect(scores.weightedFull).toBe(100)
    })
  })

  describe('calculateBrowserScore', () => {
    test('should return 0 for empty feature list', () => {
      const { getSupport } = createTestData([])
      const scores = calculateBrowserScore('chrome_android', [], getSupport)
      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(0)
      expect(scores.weightedFull).toBe(0)
      expect(scores.unweightedFull).toBe(0)
    })

    test('should handle all unknown features (division by zero protection)', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'unknown' },
        { supportLevel: 'unknown' },
        { supportLevel: 'unknown' }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(0)
    })

    test('should handle mixed support levels', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported' },
        { supportLevel: 'partial' },
        { supportLevel: 'not-supported' }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      // (1.0 + 0.5 + 0.0) / 3.0 = 50%
      expect(scores.weighted).toBe(50)
      expect(scores.unweighted).toBe(50)
    })

    test('should apply custom weights correctly', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported', weight: 3.0 },
        { supportLevel: 'supported', weight: 1.0 }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      // (3.0*1.0 + 1.0*1.0) / (3.0+1.0) = 100%
      expect(scores.weighted).toBe(100)
      expect(scores.unweighted).toBe(100)
    })

    test('should weight core features more heavily', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'not-supported', weight: 3.0 },
        { supportLevel: 'supported', weight: 1.0 },
        { supportLevel: 'supported', weight: 1.0 }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      // weighted: (0.0 + 1.0 + 1.0) / (3.0+1.0+1.0) = 2.0/5.0 = 40%
      // unweighted: (0.0 + 1.0 + 1.0) / 3 = 67%
      expect(scores.weighted).toBe(40)
      expect(scores.unweighted).toBe(67)
    })

    test('should handle features with weight 0 (division by zero protection)', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported', weight: 0 },
        { supportLevel: 'supported', weight: 0 }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(0)
      expect(scores.unweighted).toBe(100)
    })

    test('should round scores correctly', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported' },
        { supportLevel: 'supported' },
        { supportLevel: 'partial' }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      // (1.0 + 1.0 + 0.5) / 3.0 = 83%
      expect(scores.weighted).toBe(83)
      expect(scores.unweighted).toBe(83)
    })

    test('should separate stable and full scores correctly', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported', experimental: false, standardTrack: true },
        { supportLevel: 'supported', experimental: true, standardTrack: true },
        { supportLevel: 'supported', experimental: false, standardTrack: false }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(100)
      expect(scores.weightedFull).toBe(100)
      expect(scores.unweighted).toBe(100)
      expect(scores.unweightedFull).toBe(100)
    })

    test('should handle stable vs experimental feature scores correctly', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported', experimental: false, standardTrack: true },
        { supportLevel: 'not-supported', experimental: true, standardTrack: true }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      expect(scores.weighted).toBe(100)
      expect(scores.unweighted).toBe(100)
      expect(scores.weightedFull).toBe(50)
      expect(scores.unweightedFull).toBe(50)
    })

    test('should compute exact scores for extreme weights', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported', weight: 10.0 },
        { supportLevel: 'partial', weight: 0.1 }
      ])
      const scores = calculateBrowserScore('chrome_android', groups, getSupport)
      // weighted: (10.0*1.0 + 0.1*0.5) / (10.0+0.1) = 10.05/10.1 = 100% (rounded)
      expect(scores.weighted).toBe(100)
      // unweighted: (1.0 + 0.5) / 2 = 75%
      expect(scores.unweighted).toBe(75)
      expect(scores.weightedFull).toBe(100)
      expect(scores.unweightedFull).toBe(75)
    })
  })

  describe('desktop browser scoring', () => {
    test('should calculate scores for desktop browser IDs', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported' },
        { supportLevel: 'partial' },
        { supportLevel: 'not-supported' }
      ])
      const scores = calculateBrowserScore('chrome', groups, getSupport)
      // (1.0 + 0.5 + 0.0) / 3.0 = 50%
      expect(scores.weighted).toBe(50)
      expect(scores.unweighted).toBe(50)
    })

    test('should calculate scores for safari desktop', () => {
      const { groups, getSupport } = createTestData([
        { supportLevel: 'supported' }
      ])
      const scores = calculateBrowserScore('safari', groups, getSupport)
      expect(scores.weighted).toBe(100)
    })
  })

  describe('calculateScoreSeries', () => {
    const { calculateScoreSeries } = useBrowserScore()

    test('weighted score steps up at the version a feature is added', () => {
      const groups: PWAFeatureGroup[] = [
        {
          id: 'g',
          name: 'G',
          description: 'G',
          categories: [
            {
              id: 'c',
              name: 'C',
              description: 'C',
              features: [
                {
                  id: 'feature-0',
                  name: 'F0',
                  description: 'F0',
                  status: { experimental: false, standard_track: true, deprecated: false }
                }
              ]
            }
          ]
        }
      ]

      const getSupportAt = (version: string) => (): BrowserSupport => ({
        chrome_android: 'unknown',
        firefox_android: 'unknown',
        safari_ios: Number(version) >= 18 ? 'supported' : 'not-supported',
        chrome: 'unknown',
        firefox: 'unknown',
        safari: 'unknown',
        status: { experimental: false, standard_track: true, deprecated: false }
      })

      // safari_ios gains support at v18, so 17 -> 0, 18 & 26 -> 100
      const releases = [
        { version: '17', releaseDate: '2023-09-18' },
        { version: '18', releaseDate: '2024-09-16' },
        { version: '26', releaseDate: '2025-09-15' }
      ]

      const series = calculateScoreSeries('safari_ios', groups, releases, getSupportAt)

      expect(series).toEqual([
        { version: '17', releaseDate: '2023-09-18', weighted: 0 },
        { version: '18', releaseDate: '2024-09-16', weighted: 100 },
        { version: '26', releaseDate: '2025-09-15', weighted: 100 }
      ])
    })
  })

  describe('groupScores', () => {
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
          chrome: f?.supportLevel || 'unknown',
          firefox: f?.supportLevel || 'unknown',
          safari: f?.supportLevel || 'unknown',
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
