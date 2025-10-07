/**
 * Browser support data composable
 * Returns real browser support data from CanIUse
 */

import { ref } from 'vue'
import { getCanIUseSupport, getMdnBcdSupport, getBrowserVersions, type BrowserVersions } from '../utils/canIUseLoader'

export type SupportLevel
  = | 'supported'
    | 'partial'
    | 'not-supported'
    | 'unknown'

export interface BrowserSupport {
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
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

    // Return unknown if not in cache
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

    // If no data sources, return unknown immediately
    if (!canIUseId && !mdnBcdPath) {
      supportCache.value[cacheKey] = UNKNOWN_SUPPORT
      return UNKNOWN_SUPPORT
    }

    // Ensure browser versions are loaded
    await loadBrowserVersions()

    // Try CanIUse first (primary source)
    if (canIUseId) {
      try {
        const support = await getCanIUseSupport(canIUseId, browserVersions.value)
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
        const support = await getMdnBcdSupport(mdnBcdPath, browserVersions.value)
        supportCache.value[cacheKey] = support
        return support
      } catch (error) {
        console.error(`Failed to load MDN BCD support for ${featureId}:`, error)
      }
    }

    // If all sources failed, return unknown
    supportCache.value[cacheKey] = UNKNOWN_SUPPORT
    return UNKNOWN_SUPPORT
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
