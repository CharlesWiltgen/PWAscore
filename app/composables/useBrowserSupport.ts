/**
 * Browser support data composable
 * Returns real browser support data from CanIUse
 */

import { ref } from 'vue'
import { getCanIUseSupport, getBrowserVersions, type BrowserVersions } from '../utils/canIUseLoader'

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
  const supportCache = ref<Map<string, BrowserSupport>>(new Map())
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
    canIUseId?: string
  ): BrowserSupport => {
    // Check cache first
    const cacheKey = canIUseId || featureId
    const cached = supportCache.value.get(cacheKey)
    if (cached) {
      return cached
    }

    // Return unknown if not in cache and no canIUseId
    return UNKNOWN_SUPPORT
  }

  /**
   * Load support data for a feature from CanIUse
   * Caches the result for future lookups
   */
  const loadSupport = async (
    featureId: string,
    canIUseId?: string
  ): Promise<BrowserSupport> => {
    const cacheKey = canIUseId || featureId

    // Check cache first
    const cached = supportCache.value.get(cacheKey)
    if (cached) {
      return cached
    }

    // If no canIUseId, return unknown immediately
    if (!canIUseId) {
      supportCache.value.set(cacheKey, UNKNOWN_SUPPORT)
      return UNKNOWN_SUPPORT
    }

    // Ensure browser versions are loaded
    await loadBrowserVersions()

    // Load from CanIUse
    try {
      const support = await getCanIUseSupport(canIUseId, browserVersions.value)
      supportCache.value.set(cacheKey, support)
      return support
    } catch (error) {
      console.error(`Failed to load support for ${featureId}:`, error)
      supportCache.value.set(cacheKey, UNKNOWN_SUPPORT)
      return UNKNOWN_SUPPORT
    }
  }

  /**
   * Load support data for multiple features at once
   */
  const loadMultipleSupport = async (
    features: Array<{ id: string, canIUseId?: string }>
  ): Promise<void> => {
    isLoading.value = true
    try {
      await Promise.all(
        features.map(f => loadSupport(f.id, f.canIUseId))
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
