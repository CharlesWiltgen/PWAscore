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
import manualSupportData from '../data/manual-browser-support.json'
import { validateManualSupport } from '../data/manual-browser-support.schema'

export type SupportLevel = 'supported' | 'partial' | 'not-supported' | 'unknown'

export type Platform = 'mobile' | 'desktop'

/**
 * Platform-specific browser identifiers
 * Mobile: chrome_android, firefox_android, safari_ios
 * Desktop: chrome, firefox, safari
 */
export type BrowserId
  = | 'chrome_android'
    | 'firefox_android'
    | 'safari_ios'
    | 'chrome'
    | 'firefox'
    | 'safari'

export interface BrowserSupport {
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
  status?: FeatureStatus
  chrome_androidVersion?: string
  firefox_androidVersion?: string
  safari_iosVersion?: string
  chromeVersion?: string
  firefoxVersion?: string
  safariVersion?: string
}

const UNKNOWN_SUPPORT: BrowserSupport = {
  chrome_android: 'unknown',
  firefox_android: 'unknown',
  safari_ios: 'unknown',
  chrome: 'unknown',
  firefox: 'unknown',
  safari: 'unknown'
}

/**
 * Manual browser support data for features without Can I Use or MDN BCD entries
 * Used for vendor-specific APIs that aren't tracked by standard databases
 * Validated at module load time to catch errors early
 */
function normalizeManualSupport(
  data: Record<string, unknown>
): Record<string, BrowserSupport> {
  const validated = validateManualSupport(data)
  const result: Record<string, BrowserSupport> = {}
  for (const [key, entry] of Object.entries(validated)) {
    result[key] = {
      ...UNKNOWN_SUPPORT,
      ...entry
    }
  }
  return result
}

const MANUAL_SUPPORT: Record<string, BrowserSupport>
  = normalizeManualSupport(manualSupportData)

type BrandKey = 'chrome' | 'firefox' | 'safari'

const BRAND_BY_BROWSER: Record<BrowserId, BrandKey> = {
  chrome: 'chrome',
  chrome_android: 'chrome',
  firefox: 'firefox',
  firefox_android: 'firefox',
  safari: 'safari',
  safari_ios: 'safari'
}

function baseKey(featureId: string, canIUseId?: string, mdnBcdPath?: string): string {
  return mdnBcdPath && canIUseId
    ? `${canIUseId}|${mdnBcdPath}`
    : canIUseId || mdnBcdPath || featureId
}

function versionedKey(base: string, brand: BrandKey, version: string): string {
  return `${base}@${brand}=${version}`
}

function hasKnownSupport(s: {
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
}): boolean {
  return (
    s.chrome_android !== 'unknown'
    || s.firefox_android !== 'unknown'
    || s.safari_ios !== 'unknown'
    || s.chrome !== 'unknown'
    || s.firefox !== 'unknown'
    || s.safari !== 'unknown'
  )
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
    const cacheKey = baseKey(featureId, canIUseId, mdnBcdPath)
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
    mdnBcdPath?: string,
    manualStatus?: FeatureStatus
  ): Promise<BrowserSupport> => {
    const cacheKey = baseKey(featureId, canIUseId, mdnBcdPath)

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
        if (hasKnownSupport(support)) {
          // Merge with manual status override if provided
          const result = manualStatus
            ? { ...UNKNOWN_SUPPORT, ...support, status: manualStatus }
            : { ...UNKNOWN_SUPPORT, ...support }
          supportCache.value[cacheKey] = result
          return result
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
        if (hasKnownSupport(support)) {
          // Merge with manual status override if provided
          const result = manualStatus
            ? { ...UNKNOWN_SUPPORT, ...support, status: manualStatus }
            : { ...UNKNOWN_SUPPORT, ...support }
          supportCache.value[cacheKey] = result
          return result
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
    features: Array<{
      id: string
      canIUseId?: string
      mdnBcdPath?: string
      status?: FeatureStatus
    }>
  ): Promise<void> => {
    isLoading.value = true
    try {
      await Promise.all(
        features.map(f =>
          loadSupport(f.id, f.canIUseId, f.mdnBcdPath, f.status)
        )
      )
    } finally {
      isLoading.value = false
    }
  }

  type FeatureInput = {
    id: string
    canIUseId?: string
    mdnBcdPath?: string
    status?: FeatureStatus
  }

  /**
   * Load support for features resolved at an explicit version of one browser.
   * Pins that browser's brand field of BrowserVersions; other brands stay current.
   * Writes into a version-keyed cache so versions never collide. Additive — the
   * current-version path (loadSupport/getSupport) is unchanged.
   * Caveat: pinning a brand's version also re-resolves that brand's other platform variant (e.g. pinning chrome_android also sets desktop chrome's version, since both read BrowserVersions.chrome). The cached object is therefore only meaningful for support[browserId]; read only the queried browser's field.
   */
  const loadSupportAtVersion = async (
    features: FeatureInput[],
    browserId: BrowserId,
    version: string
  ): Promise<void> => {
    await loadBrowserVersions()
    const brand = BRAND_BY_BROWSER[browserId]
    // Cast: spread + computed key widens away from BrowserVersions; the brand
    // key is always one of chrome|firefox|safari, so this is sound.
    const versions = { ...browserVersions.value, [brand]: version } as BrowserVersions

    await Promise.all(
      features.map(async (f) => {
        const key = versionedKey(baseKey(f.id, f.canIUseId, f.mdnBcdPath), brand, version)
        if (supportCache.value[key]) return

        let resolved: BrowserSupport | null = null

        if (f.mdnBcdPath) {
          try {
            const s = await getMdnBcdSupport(f.mdnBcdPath, versions)
            if (hasKnownSupport(s)) {
              resolved = f.status
                ? { ...UNKNOWN_SUPPORT, ...s, status: f.status }
                : { ...UNKNOWN_SUPPORT, ...s }
            }
          } catch (error) {
            console.error(`Failed to load MDN BCD support for ${f.id}@${version}:`, error)
          }
        }

        if (!resolved && f.canIUseId) {
          try {
            const s = await getCanIUseSupport(f.canIUseId, versions)
            if (hasKnownSupport(s)) {
              resolved = f.status
                ? { ...UNKNOWN_SUPPORT, ...s, status: f.status }
                : { ...UNKNOWN_SUPPORT, ...s }
            }
          } catch (error) {
            console.error(`Failed to load CanIUse support for ${f.id}@${version}:`, error)
          }
        }

        supportCache.value[key] = resolved ?? MANUAL_SUPPORT[f.id] ?? UNKNOWN_SUPPORT
      })
    )
  }

  /**
   * Synchronously read support at an explicit version (after loadSupportAtVersion).
   * With no version, delegates to the current-version getSupport.
   */
  const getSupportAt = (
    browserId: BrowserId,
    featureId: string,
    canIUseId?: string,
    mdnBcdPath?: string,
    version?: string
  ): BrowserSupport => {
    if (!version) {
      return getSupport(featureId, canIUseId, mdnBcdPath)
    }
    const brand = BRAND_BY_BROWSER[browserId]
    const key = versionedKey(baseKey(featureId, canIUseId, mdnBcdPath), brand, version)
    return supportCache.value[key] ?? MANUAL_SUPPORT[featureId] ?? UNKNOWN_SUPPORT
  }

  return {
    getSupport,
    loadSupport,
    loadMultipleSupport,
    loadBrowserVersions,
    loadSupportAtVersion,
    getSupportAt,
    browserVersions,
    isLoading
  }
}
