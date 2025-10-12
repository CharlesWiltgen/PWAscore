import { describe, expect, test, vi, beforeEach } from 'vitest'
import { useBrowserSupport } from './useBrowserSupport'
import type { BrowserVersions } from '../utils/canIUseLoader'

// Mock the canIUseLoader module
vi.mock('../utils/canIUseLoader', () => ({
  getBrowserVersions: vi.fn(async () => ({
    chrome: '141',
    firefox: '143',
    safari: '18.4'
  })),
  getCanIUseSupport: vi.fn(async (canIUseId: string, _versions: BrowserVersions) => {
    // Mock CanIUse data
    if (canIUseId === 'serviceworkers') {
      return {
        chrome_android: 'supported' as const,
        firefox_android: 'supported' as const,
        safari_ios: 'supported' as const
      }
    }
    return {
      chrome_android: 'unknown' as const,
      firefox_android: 'unknown' as const,
      safari_ios: 'unknown' as const
    }
  }),
  getMdnBcdSupport: vi.fn(async (mdnBcdPath: string, _versions: BrowserVersions) => {
    // Mock MDN BCD data
    if (mdnBcdPath === 'api.Navigator.setAppBadge') {
      return {
        chrome_android: 'not-supported' as const,
        firefox_android: 'not-supported' as const,
        safari_ios: 'supported' as const,
        status: {
          experimental: false,
          standard_track: true,
          deprecated: false
        }
      }
    }
    return {
      chrome_android: 'unknown' as const,
      firefox_android: 'unknown' as const,
      safari_ios: 'unknown' as const
    }
  }),
  getMdnUrlFromBcd: vi.fn(async () => undefined)
}))

describe('useBrowserSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSupport', () => {
    test('should return unknown for features not yet loaded', () => {
      const { getSupport } = useBrowserSupport()

      const support = getSupport('unknown-feature')

      expect(support.chrome_android).toBe('unknown')
      expect(support.firefox_android).toBe('unknown')
      expect(support.safari_ios).toBe('unknown')
    })

    test('should return cached support for previously loaded features', async () => {
      const { getSupport, loadSupport } = useBrowserSupport()

      // Load a feature first
      await loadSupport('test-feature', 'serviceworkers')

      // Now getSupport should return cached data
      const support = getSupport('test-feature', 'serviceworkers')

      expect(support.chrome_android).toBe('supported')
      expect(support.firefox_android).toBe('supported')
      expect(support.safari_ios).toBe('supported')
    })

    test('should return manual support for vendor-specific features', () => {
      const { getSupport } = useBrowserSupport()

      // apple-pay is in MANUAL_SUPPORT
      const support = getSupport('apple-pay')

      expect(support.safari_ios).toBe('supported')
      expect(support.chrome_android).toBe('not-supported')
      expect(support.firefox_android).toBe('not-supported')
      expect(support.status?.experimental).toBe(false)
      expect(support.status?.standard_track).toBe(false)
    })

    test('should cache manual support lookups', () => {
      const { getSupport } = useBrowserSupport()

      // First call
      const support1 = getSupport('google-pay')
      // Second call should use cache
      const support2 = getSupport('google-pay')

      expect(support1).toEqual(support2)
      expect(support1.chrome_android).toBe('supported')
      expect(support1.safari_ios).toBe('not-supported')
    })
  })

  describe('loadSupport', () => {
    test('should load support from MDN BCD when available', async () => {
      const { loadSupport } = useBrowserSupport()

      const support = await loadSupport(
        'app-badge',
        undefined,
        'api.Navigator.setAppBadge'
      )

      expect(support.chrome_android).toBe('not-supported')
      expect(support.firefox_android).toBe('not-supported')
      expect(support.safari_ios).toBe('supported')
      expect(support.status).toBeDefined()
    })

    test('should fall back to CanIUse when MDN BCD returns unknown', async () => {
      const { loadSupport } = useBrowserSupport()

      const support = await loadSupport(
        'test-feature',
        'serviceworkers',
        'api.NonExistent'
      )

      // MDN BCD returns unknown, should fall back to CanIUse
      expect(support.chrome_android).toBe('supported')
    })

    test('should use CanIUse when MDN BCD is not provided', async () => {
      const { loadSupport } = useBrowserSupport()

      const support = await loadSupport(
        'test-feature',
        'serviceworkers'
      )

      expect(support.chrome_android).toBe('supported')
      expect(support.firefox_android).toBe('supported')
      expect(support.safari_ios).toBe('supported')
    })

    test('should use manual support when neither CanIUse nor MDN BCD provided', async () => {
      const { loadSupport } = useBrowserSupport()

      const support = await loadSupport('google-pay')

      expect(support.chrome_android).toBe('supported')
      expect(support.safari_ios).toBe('not-supported')
    })

    test('should cache loaded support data', async () => {
      const { loadSupport, getSupport } = useBrowserSupport()

      await loadSupport('test-feature', 'serviceworkers')

      // Second call should use cache (not call the mock again)
      const support = getSupport('test-feature', 'serviceworkers')

      expect(support.chrome_android).toBe('supported')
    })

    test('should override status with manual status when provided', async () => {
      const { loadSupport } = useBrowserSupport()

      const manualStatus = {
        experimental: true,
        standard_track: false,
        deprecated: false
      }

      const support = await loadSupport(
        'test-feature',
        undefined,
        'api.Navigator.setAppBadge',
        manualStatus
      )

      // Should use MDN BCD support but override with manual status
      expect(support.safari_ios).toBe('supported')
      expect(support.status).toEqual(manualStatus)
    })
  })

  describe('loadMultipleSupport', () => {
    test('should load multiple features in parallel', async () => {
      const { loadMultipleSupport, getSupport } = useBrowserSupport()

      const features = [
        { id: 'feature-1', canIUseId: 'serviceworkers' },
        { id: 'feature-2', mdnBcdPath: 'api.Navigator.setAppBadge' },
        { id: 'feature-3' } // No data source, will use manual or unknown
      ]

      await loadMultipleSupport(features)

      // All features should now be cached
      const support1 = getSupport('feature-1', 'serviceworkers')
      const support2 = getSupport('feature-2', undefined, 'api.Navigator.setAppBadge')

      expect(support1.chrome_android).toBe('supported')
      expect(support2.safari_ios).toBe('supported')
    })

    test('should handle errors gracefully and continue loading other features', async () => {
      const { loadMultipleSupport } = useBrowserSupport()

      const features = [
        { id: 'valid-feature', canIUseId: 'serviceworkers' },
        { id: 'invalid-feature', canIUseId: 'non-existent' }
      ]

      // Should not throw, even if some features fail
      await expect(loadMultipleSupport(features)).resolves.not.toThrow()
    })
  })

  describe('loadBrowserVersions', () => {
    test('should load browser versions from CanIUse data', async () => {
      const { loadBrowserVersions, browserVersions } = useBrowserSupport()

      await loadBrowserVersions()

      expect(browserVersions.value.chrome).toBe('141')
      expect(browserVersions.value.firefox).toBe('143')
      expect(browserVersions.value.safari).toBe('18.4')
    })

    test('should only load browser versions once', async () => {
      const { loadBrowserVersions } = useBrowserSupport()
      const { getBrowserVersions } = await import('../utils/canIUseLoader')

      await loadBrowserVersions()
      await loadBrowserVersions() // Second call should not fetch again

      // Mock should only be called once
      expect(getBrowserVersions).toHaveBeenCalledTimes(1)
    })
  })

  describe('cache key precedence', () => {
    test('should use canIUseId as cache key when provided', async () => {
      const { loadSupport, getSupport } = useBrowserSupport()

      await loadSupport('feature-1', 'serviceworkers', 'api.Navigator.setAppBadge')

      // Cache key is 'serviceworkers' (canIUseId takes precedence)
      const support1 = getSupport('feature-1', 'serviceworkers')
      expect(support1.chrome_android).not.toBe('unknown')

      // Looking up with different cache key (mdnBcdPath) won't find it
      const support2 = getSupport('feature-1', undefined, 'api.Navigator.setAppBadge')
      expect(support2.chrome_android).toBe('unknown') // Different cache key
    })

    test('should use mdnBcdPath when canIUseId not provided', async () => {
      const { loadSupport, getSupport } = useBrowserSupport()

      await loadSupport('feature-2', undefined, 'api.Navigator.setAppBadge')

      const support = getSupport('feature-2', undefined, 'api.Navigator.setAppBadge')
      expect(support.safari_ios).toBe('supported')
    })

    test('should use featureId when neither canIUseId nor mdnBcdPath provided', async () => {
      const { loadSupport, getSupport } = useBrowserSupport()

      await loadSupport('google-pay')

      const support = getSupport('google-pay')
      expect(support.chrome_android).toBe('supported')
    })
  })
})
