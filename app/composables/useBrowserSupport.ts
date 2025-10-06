/**
 * Browser support data composable
 * Returns real browser support data from CanIUse
 */

import { ref } from 'vue'
import { getCanIUseSupport } from '../utils/canIUseLoader'

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
 * Browser versions to check support for
 */
const BROWSER_VERSIONS = {
  chrome: '131',
  firefox: '138',
  safari: '18.4'
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
 * Get browser support status for PWA features
 */
export function useBrowserSupport() {
  const supportCache = ref<Map<string, BrowserSupport>>(new Map())
  const isLoading = ref(false)

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

    // Load from CanIUse
    try {
      const support = await getCanIUseSupport(canIUseId, BROWSER_VERSIONS)
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
    isLoading
  }
}
