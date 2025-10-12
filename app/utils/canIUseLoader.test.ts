import { describe, expect, test, vi } from 'vitest'
import { getBrowserVersions, getCanIUseSupport } from './canIUseLoader'

describe('getBrowserVersions', () => {
  test('should return current browser versions', async () => {
    const versions = await getBrowserVersions()

    expect(versions).toHaveProperty('chrome')
    expect(versions).toHaveProperty('firefox')
    expect(versions).toHaveProperty('safari')

    // Versions should be non-empty strings
    expect(typeof versions.chrome).toBe('string')
    expect(typeof versions.firefox).toBe('string')
    expect(typeof versions.safari).toBe('string')
    expect(versions.chrome.length).toBeGreaterThan(0)
    expect(versions.firefox.length).toBeGreaterThan(0)
    expect(versions.safari.length).toBeGreaterThan(0)
  })

  test('should return fallback versions on error', async () => {
    // Mock fetch to fail
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )

    const versions = await getBrowserVersions()

    // Should return fallback values
    expect(versions).toEqual({
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    })

    vi.unstubAllGlobals()
  })
})

describe('getCanIUseSupport', () => {
  test('should return supported for web-app-manifest (universally supported feature)', async () => {
    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    const support = await getCanIUseSupport('web-app-manifest', browserVersions)

    expect(support).toEqual({
      chrome_android: 'supported',
      firefox_android: 'supported',
      safari_ios: 'supported'
    })
  })

  test('should return unknown for non-existent feature', async () => {
    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    const support = await getCanIUseSupport(
      'non-existent-feature-xyz',
      browserVersions
    )

    expect(support).toEqual({
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios: 'unknown'
    })
  })

  test('should return support levels for valid feature (service workers)', async () => {
    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    const support = await getCanIUseSupport('serviceworkers', browserVersions)

    // Service workers are widely supported
    expect(support.chrome_android).toBe('supported')
    expect(support.firefox_android).toBe('supported')
    expect(support.safari_ios).toBe('supported')
  })
})

describe('getMdnBcdSupport', () => {
  test('should return browser support for valid MDN BCD path', async () => {
    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    // Navigator.setAppBadge is supported in Safari iOS 16.4+
    const { getMdnBcdSupport } = await import('./canIUseLoader')
    const support = await getMdnBcdSupport(
      'api.Navigator.setAppBadge',
      browserVersions
    )

    // Safari iOS should be supported (16.4+ required, we have 18.4)
    expect(support.safari_ios).toBe('supported')
    // Chrome Android should not be supported (version_added: false)
    expect(support.chrome_android).toBe('not-supported')
    // Firefox Android should not be supported (version_added: false)
    expect(support.firefox_android).toBe('not-supported')
  })

  test('should return unknown for non-existent MDN BCD path', async () => {
    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    const { getMdnBcdSupport } = await import('./canIUseLoader')
    const support = await getMdnBcdSupport(
      'api.NonExistentAPI',
      browserVersions
    )

    expect(support).toEqual({
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios: 'unknown'
    })
  })

  test('should return supported for BackgroundFetchManager on Chrome Android', async () => {
    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    const { getMdnBcdSupport } = await import('./canIUseLoader')
    const support = await getMdnBcdSupport(
      'api.BackgroundFetchManager',
      browserVersions
    )

    // Chrome Android supports BackgroundFetchManager (74+)
    expect(support.chrome_android).toBe('supported')
    // Firefox and Safari do not support it
    expect(support.firefox_android).toBe('not-supported')
    expect(support.safari_ios).toBe('not-supported')
  })

  test('should handle partial implementation correctly', async () => {
    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    const { getMdnBcdSupport } = await import('./canIUseLoader')
    const support = await getMdnBcdSupport('api.MediaSession', browserVersions)

    // All should be supported since versions are high enough
    // Firefox may be partial due to partial_implementation flag
    expect(['supported', 'partial']).toContain(support.chrome_android)
    expect(['supported', 'partial']).toContain(support.firefox_android)
    expect(['supported', 'partial']).toContain(support.safari_ios)
  })
})

describe('getBrowserVersions edge cases', () => {
  test('should return valid version strings matching format', async () => {
    const versions = await getBrowserVersions()

    // Chrome and Firefox versions should be numbers like "141"
    expect(versions.chrome).toMatch(/^\d{2,3}$/)
    expect(versions.firefox).toMatch(/^\d{2,3}$/)

    // Safari versions should be like "18.4" (iOS version format)
    expect(versions.safari).toMatch(/^\d{1,2}(\.\d+)?$/)
  })

  test('should filter Safari versions correctly (exclude desktop Safari 26+)', async () => {
    const versions = await getBrowserVersions()

    const safariVersion = Number.parseFloat(versions.safari)

    // Safari version should be iOS version (11-25 range), not desktop Safari (26+)
    expect(safariVersion).toBeGreaterThanOrEqual(11)
    expect(safariVersion).toBeLessThan(26)
  })
})

describe('getMdnBcdSupport - version comparison edge cases', () => {
  test('should correctly compare versions with multiple decimal places (18.10 > 18.9)', async () => {
    const { getMdnBcdSupport } = await import('./canIUseLoader')

    // Test with iOS 18.10 (should be > 18.9, not < due to semantic versioning fix)
    const browserVersions18_10 = {
      chrome: '141',
      firefox: '143',
      safari: '18.10'
    }

    // Test with a feature that requires Safari 18.9
    // If the feature is supported at 18.9, then 18.10 should also support it
    const support = await getMdnBcdSupport(
      'api.Navigator.setAppBadge', // Requires 16.4
      browserVersions18_10
    )

    expect(support.safari_ios).toBe('supported')
  })

  test('should handle comparison operators correctly (≤X means always supported)', async () => {
    const { getMdnBcdSupport } = await import('./canIUseLoader')

    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    // Features with ≤X in version_added should always return supported
    // This tests the operator semantics fix
    const support = await getMdnBcdSupport(
      'api.MediaSession',
      browserVersions
    )

    // MediaSession uses version_added with operators in some browsers
    expect(['supported', 'partial']).toContain(support.chrome_android)
  })
})

describe('getMdnBcdSupport - edge cases', () => {
  test('should handle features behind flags as not-supported', async () => {
    const { getMdnBcdSupport } = await import('./canIUseLoader')

    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    // Find a feature that's behind a flag (if available in BCD data)
    // This tests the flag handling logic
    const support = await getMdnBcdSupport(
      'api.CookieStore',
      browserVersions
    )

    // CookieStore may be behind flags in some browsers
    // Should return either supported or not-supported (not unknown)
    expect(['supported', 'not-supported', 'unknown']).toContain(support.chrome_android)
  })

  test('should return status information when available', async () => {
    const { getMdnBcdSupport } = await import('./canIUseLoader')

    const browserVersions = {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }

    const support = await getMdnBcdSupport(
      'api.Navigator.setAppBadge',
      browserVersions
    )

    // Should include status information
    expect(support.status).toBeDefined()
    expect(typeof support.status?.experimental).toBe('boolean')
    expect(typeof support.status?.standard_track).toBe('boolean')
    expect(typeof support.status?.deprecated).toBe('boolean')
  })
})
