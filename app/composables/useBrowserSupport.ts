/**
 * Browser support data composable
 * Returns real browser support data from CanIUse
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

export type BrowserId = 'chrome' | 'firefox' | 'safari'

export interface BrowserSupport {
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
  status?: FeatureStatus
  // Version where feature was added (optional, for future use)
  chromeVersion?: string
  firefoxVersion?: string
  safariVersion?: string
}

/**
 * Unknown support fallback
 */
const UNKNOWN_SUPPORT: BrowserSupport = {
  chrome: 'unknown',
  firefox: 'unknown',
  safari: 'unknown'
}

/**
 * Manual browser support data for features without Can I Use or MDN BCD entries
 * Used for vendor-specific APIs that aren't tracked by standard databases
 */
const MANUAL_SUPPORT: Record<string, BrowserSupport> = {
  'apple-pay': {
    safari: 'supported',
    chrome: 'not-supported',
    firefox: 'not-supported',
    safariVersion: '10.1', // Safari 10.1 (macOS Sierra/iOS 10)
    status: {
      experimental: false,
      standard_track: false,
      deprecated: false
    }
  },
  'google-pay': {
    chrome: 'supported',
    safari: 'not-supported',
    firefox: 'not-supported',
    chromeVersion: '61', // Chrome 61 (September 2017)
    status: {
      experimental: false,
      standard_track: false,
      deprecated: false
    }
  },
  'declarative-web-push': {
    safari: 'supported',
    chrome: 'not-supported',
    firefox: 'not-supported',
    safariVersion: '18.4', // Safari 18.4 (iOS 18.4/macOS 15.5)
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'viewport-control': {
    chrome: 'supported',
    firefox: 'supported',
    safari: 'supported',
    chromeVersion: '18', // Early mobile Chrome
    firefoxVersion: '4', // Early mobile Firefox
    safariVersion: '3.1', // iOS Safari 3.1 (iPhone OS 2.0)
    status: {
      experimental: false,
      standard_track: false, // Not in spec but universally adopted
      deprecated: false
    }
  },
  'window-controls-overlay': {
    chrome: 'supported',
    firefox: 'not-supported',
    safari: 'not-supported',
    chromeVersion: '105', // Chrome 105 (May 2022)
    status: {
      experimental: true,
      standard_track: false,
      deprecated: false
    }
  },
  'tabbed-mode': {
    chrome: 'supported',
    firefox: 'not-supported',
    safari: 'not-supported',
    chromeVersion: '116', // Chrome 116 (experimental)
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

    // Try CanIUse first (primary source)
    if (canIUseId) {
      try {
        const support = await getCanIUseSupport(
          canIUseId,
          browserVersions.value
        )
        supportCache.value[cacheKey] = support
        return support
      } catch (error) {
        console.error(`Failed to load CanIUse support for ${featureId}:`, error)
        // Continue to try MDN BCD if available
      }
    }

    // Try MDN BCD as fallback
    if (mdnBcdPath) {
      try {
        const support = await getMdnBcdSupport(
          mdnBcdPath,
          browserVersions.value
        )
        supportCache.value[cacheKey] = support
        return support
      } catch (error) {
        console.error(`Failed to load MDN BCD support for ${featureId}:`, error)
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
