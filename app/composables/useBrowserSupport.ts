/**
 * Browser support data composable
 * Returns mobile browser support data from CanIUse and MDN BCD
 * Tracks platform-specific browser support (e.g., Chrome for Android vs Chrome Desktop)
 */

import { ref } from 'vue'
import {
  getCanIUseSupport,
  getMdnBcdSupport,
  getBrowserVersions,
  type BrowserVersions,
  type FeatureStatus
} from '../utils/canIUseLoader'

export type SupportLevel = 'supported' | 'partial' | 'not-supported' | 'unknown'

/**
 * Platform-specific browser identifiers
 * Mobile browsers: chrome_android, firefox_android, safari_ios
 * (Desktop browsers will be added in the future: chrome, firefox, safari)
 */
export type BrowserId = 'chrome_android' | 'firefox_android' | 'safari_ios'

/**
 * Browser support data for a feature across platforms
 * Properties use platform-specific naming to match CanIUse/MDN BCD conventions
 */
export interface BrowserSupport {
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
  status?: FeatureStatus
  // Version where feature was added (optional, for future use)
  chrome_androidVersion?: string
  firefox_androidVersion?: string
  safari_iosVersion?: string
}

/**
 * Unknown support fallback
 */
const UNKNOWN_SUPPORT: BrowserSupport = {
  chrome_android: 'unknown',
  firefox_android: 'unknown',
  safari_ios: 'unknown'
}

/**
 * Manual browser support data for features without Can I Use or MDN BCD entries
 * Used for vendor-specific APIs that aren't tracked by standard databases
 */
const MANUAL_SUPPORT: Record<string, BrowserSupport> = {
  'apple-pay': {
    safari_ios: 'supported',
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_iosVersion: '10.1', // Safari iOS 10.1
    status: {
      experimental: false,
      standard_track: false,
      deprecated: false
    }
  },
  'google-pay': {
    chrome_android: 'supported',
    safari_ios: 'not-supported',
    firefox_android: 'not-supported',
    chrome_androidVersion: '61', // Chrome for Android 61
    status: {
      experimental: false,
      standard_track: false,
      deprecated: false
    }
  },
  'declarative-web-push': {
    safari_ios: 'supported',
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_iosVersion: '18.4', // Safari iOS 18.4
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'viewport-control': {
    chrome_android: 'supported',
    firefox_android: 'supported',
    safari_ios: 'supported',
    chrome_androidVersion: '18', // Chrome for Android 18
    firefox_androidVersion: '4', // Firefox for Android 4
    safari_iosVersion: '3.1', // Safari iOS 3.1
    status: {
      experimental: false,
      standard_track: false, // Not in spec but universally adopted
      deprecated: false
    }
  },
  'window-controls-overlay': {
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'tabbed-mode': {
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'https-requirement': {
    chrome_android: 'supported',
    firefox_android: 'supported',
    safari_ios: 'supported',
    chrome_androidVersion: '45', // Chrome for Android 45 (Service Workers requirement)
    firefox_androidVersion: '44', // Firefox for Android 44 (Service Workers requirement)
    safari_iosVersion: '11.1', // Safari iOS 11.1 (Service Workers requirement)
    status: {
      experimental: false,
      standard_track: true,
      deprecated: false
    }
  },
  'same-origin-policy': {
    chrome_android: 'supported',
    firefox_android: 'supported',
    safari_ios: 'supported',
    status: {
      experimental: false,
      standard_track: true,
      deprecated: false
    }
  },
  'secure-contexts': {
    chrome_android: 'supported',
    firefox_android: 'supported',
    safari_ios: 'supported',
    chrome_androidVersion: '47', // Chrome for Android 47
    firefox_androidVersion: '49', // Firefox for Android 49
    safari_iosVersion: '11.1', // Safari iOS 11.1
    status: {
      experimental: false,
      standard_track: true,
      deprecated: false
    }
  },
  'file-type-associations': {
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'open-with-pwa': {
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'url-scheme-handling': {
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'jump-list': {
    chrome_android: 'supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    chrome_androidVersion: '84', // Chrome for Android 84 (manifest shortcuts)
    status: {
      experimental: false,
      standard_track: true,
      deprecated: false
    }
  },
  'quick-actions': {
    chrome_android: 'supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    chrome_androidVersion: '84', // Chrome for Android 84 (manifest shortcuts)
    status: {
      experimental: false,
      standard_track: true,
      deprecated: false
    }
  },
  'face-detection': {
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'text-detection': {
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'shape-detection': {
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_ios: 'not-supported',
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  }
}

/**
 * Default browser versions (used as fallback)
 */
const DEFAULT_BROWSER_VERSIONS: BrowserVersions = {
  chrome: '141',
  firefox: '143',
  safari: '18.4'
}

/**
 * Get browser support status for PWA features
 */
export function useBrowserSupport() {
  const supportCache = ref<Record<string, BrowserSupport>>({})
  const browserVersions = ref<BrowserVersions>(DEFAULT_BROWSER_VERSIONS)
  const isLoading = ref(false)
  const versionsLoaded = ref(false)

  /**
   * Load browser versions from CanIUse data
   */
  const loadBrowserVersions = async (): Promise<void> => {
    if (versionsLoaded.value) return

    try {
      browserVersions.value = await getBrowserVersions()
      versionsLoaded.value = true
    } catch (error) {
      console.error('Failed to load browser versions:', error)
      browserVersions.value = DEFAULT_BROWSER_VERSIONS
    }
  }

  /**
   * Get support data for a feature
   * Returns cached data if available, otherwise returns unknown
   * Call loadSupport() first to populate cache with real data
   */
  const getSupport = (
    featureId: string,
    canIUseId?: string,
    mdnBcdPath?: string
  ): BrowserSupport => {
    // Check cache first - try canIUseId, then mdnBcdPath, then featureId
    const cacheKey = canIUseId || mdnBcdPath || featureId
    const cached = supportCache.value[cacheKey]
    if (cached) {
      return cached
    }

    // Check manual support and cache it
    const manual = MANUAL_SUPPORT[featureId]
    if (manual) {
      supportCache.value[cacheKey] = manual
      return manual
    }

    // Return unknown if not in cache or manual support
    return UNKNOWN_SUPPORT
  }

  /**
   * Load support data for a feature from CanIUse or MDN BCD
   * Tries CanIUse first, then MDN BCD as fallback
   * Caches the result for future lookups
   */
  const loadSupport = async (
    featureId: string,
    canIUseId?: string,
    mdnBcdPath?: string
  ): Promise<BrowserSupport> => {
    const cacheKey = canIUseId || mdnBcdPath || featureId

    // Check cache first
    const cached = supportCache.value[cacheKey]
    if (cached) {
      return cached
    }

    // If no data sources, check manual support first
    if (!canIUseId && !mdnBcdPath) {
      const manual = MANUAL_SUPPORT[featureId]
      const result = manual || UNKNOWN_SUPPORT
      supportCache.value[cacheKey] = result
      return result
    }

    // Ensure browser versions are loaded
    await loadBrowserVersions()

    // Try MDN BCD first when available (has both browser support + status)
    if (mdnBcdPath) {
      try {
        const support = await getMdnBcdSupport(
          mdnBcdPath,
          browserVersions.value
        )
        // Only use MDN BCD data if at least one browser has known support
        // If all are 'unknown', fall back to CanIUse
        const hasKnownSupport = support.chrome_android !== 'unknown'
          || support.firefox_android !== 'unknown'
          || support.safari_ios !== 'unknown'

        if (hasKnownSupport) {
          supportCache.value[cacheKey] = support
          return support
        }
        // Fall through to CanIUse if MDN BCD returned all unknown
      } catch (error) {
        console.error(`Failed to load MDN BCD support for ${featureId}:`, error)
        // Continue to try CanIUse if available
      }
    }

    // Try CanIUse as fallback
    if (canIUseId) {
      try {
        const support = await getCanIUseSupport(
          canIUseId,
          browserVersions.value
        )
        // Only use Can I Use data if at least one browser has known support
        const hasKnownSupport = support.chrome_android !== 'unknown'
          || support.firefox_android !== 'unknown'
          || support.safari_ios !== 'unknown'

        if (hasKnownSupport) {
          supportCache.value[cacheKey] = support
          return support
        }
      } catch (error) {
        console.error(`Failed to load CanIUse support for ${featureId}:`, error)
      }
    }

    // If all sources failed, check manual support as final fallback
    const manual = MANUAL_SUPPORT[featureId]
    const result = manual || UNKNOWN_SUPPORT
    supportCache.value[cacheKey] = result
    return result
  }

  /**
   * Load support data for multiple features at once
   */
  const loadMultipleSupport = async (
    features: Array<{ id: string, canIUseId?: string, mdnBcdPath?: string }>
  ): Promise<void> => {
    isLoading.value = true
    try {
      await Promise.all(
        features.map(f => loadSupport(f.id, f.canIUseId, f.mdnBcdPath))
      )
    } finally {
      isLoading.value = false
    }
  }

  return {
    getSupport,
    loadSupport,
    loadMultipleSupport,
    loadBrowserVersions,
    browserVersions,
    isLoading
  }
}
