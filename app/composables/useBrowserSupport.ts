/**
 * Browser support data composable
 * Returns mobile browser support data from CanIUse and MDN BCD
 * Tracks platform-specific browser support (e.g., Chrome for Android vs Chrome Desktop)
 */

import { ref } from 'vue'
import {
  compareVersions,
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

export const BRAND_BY_BROWSER: Record<
  BrowserId,
  'chrome' | 'firefox' | 'safari'
> = {
  chrome: 'chrome',
  chrome_android: 'chrome',
  firefox: 'firefox',
  firefox_android: 'firefox',
  safari: 'safari',
  safari_ios: 'safari'
}

const BROWSER_KEYS = [
  'chrome_android',
  'firefox_android',
  'safari_ios',
  'chrome',
  'firefox',
  'safari'
] as const

/**
 * A recorded anchor is a hard floor, mirroring isVersionSupported's rule for a
 * dated BCD version_added: at or above it the recorded level stands, below it
 * the browser did not support the feature. No anchor → the level stays
 * version-invariant. Only supported/partial carry meaning with an anchor; an
 * anchor on any other level is data noise (guarded by a dataset test).
 */
function levelAtAnchor(
  level: SupportLevel,
  anchor: string | undefined,
  version: string
): SupportLevel {
  if (!anchor || (level !== 'supported' && level !== 'partial')) return level
  return compareVersions(version, anchor) >= 0 ? level : 'not-supported'
}

/**
 * Resolve a manual entry at an explicit BrowserVersions set. Each key is
 * compared against its own anchor field (safari_iosVersion for safari_ios,
 * safariVersion for safari) using that key's brand version — the same
 * brand-pinning convention loadSupportAtVersion documents.
 */
export function honorManualAnchors(
  entry: BrowserSupport,
  versions: BrowserVersions
): BrowserSupport {
  const out = { ...entry }
  for (const key of BROWSER_KEYS) {
    out[key] = levelAtAnchor(
      entry[key],
      entry[`${key}Version`],
      versions[BRAND_BY_BROWSER[key]]
    )
  }
  return out
}

function baseKey(
  featureId: string,
  canIUseId?: string,
  mdnBcdPath?: string
): string {
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
export const DEFAULT_BROWSER_VERSIONS: BrowserVersions = {
  chrome: '141',
  firefox: '143',
  safari: '18.4'
}

export type FeatureInput = {
  id: string
  canIUseId?: string
  mdnBcdPath?: string
  status?: FeatureStatus
}

/** Arguments for getSupportAt: a feature, the browser to read, and an optional pinned version. */
export type SupportAtQuery = {
  browserId: BrowserId
  featureId: string
  canIUseId?: string
  mdnBcdPath?: string
  version?: string
}

/**
 * Resolve a feature's support against an explicit BrowserVersions set:
 * MDN BCD first (when it yields known support), then CanIUse, then manual data,
 * finally UNKNOWN. `label` is only used for error-log context.
 * Shared by the current-version path (loadSupport) and the versioned path
 * (loadSupportAtVersion) so resolution order stays in one place.
 */
export async function resolveSupport(
  feature: FeatureInput,
  versions: BrowserVersions,
  label: string
): Promise<BrowserSupport> {
  const merge = (
    s: Awaited<ReturnType<typeof getMdnBcdSupport>>
  ): BrowserSupport =>
    feature.status
      ? { ...UNKNOWN_SUPPORT, ...s, status: feature.status }
      : { ...UNKNOWN_SUPPORT, ...s }

  if (feature.mdnBcdPath) {
    try {
      const support = await getMdnBcdSupport(feature.mdnBcdPath, versions)
      // Only use MDN BCD data if at least one browser has known support;
      // otherwise fall through to CanIUse.
      if (hasKnownSupport(support)) return merge(support)
    } catch (error) {
      console.error(`Failed to load MDN BCD support for ${label}:`, error)
    }
  }

  if (feature.canIUseId) {
    try {
      const support = await getCanIUseSupport(feature.canIUseId, versions)
      if (hasKnownSupport(support)) return merge(support)
    } catch (error) {
      console.error(`Failed to load CanIUse support for ${label}:`, error)
    }
  }

  const manual = MANUAL_SUPPORT[feature.id]
  return manual ? honorManualAnchors(manual, versions) : UNKNOWN_SUPPORT
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

    // Check manual support. Honor the entry's anchors with whatever versions
    // are known, but only cache once real versions have loaded: a pre-load read
    // is answered from DEFAULT_BROWSER_VERSIONS and must not pin that onto the key.
    const manual = MANUAL_SUPPORT[featureId]
    if (manual) {
      const honored = honorManualAnchors(manual, browserVersions.value)
      if (versionsLoaded.value) {
        supportCache.value[cacheKey] = honored
      }
      return honored
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

    // Ensure browser versions are loaded
    await loadBrowserVersions()

    const result = await resolveSupport(
      { id: featureId, canIUseId, mdnBcdPath, status: manualStatus },
      browserVersions.value,
      featureId
    )
    supportCache.value[cacheKey] = result
    return result
  }

  /**
   * Load support data for multiple features at once
   */
  const loadMultipleSupport = async (
    features: FeatureInput[]
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
    const versions = {
      ...browserVersions.value,
      [brand]: version
    } as BrowserVersions

    await Promise.all(
      features.map(async (f) => {
        const key = versionedKey(
          baseKey(f.id, f.canIUseId, f.mdnBcdPath),
          brand,
          version
        )
        if (supportCache.value[key]) return
        supportCache.value[key] = await resolveSupport(
          f,
          versions,
          `${f.id}@${version}`
        )
      })
    )
  }

  /**
   * Synchronously read support at an explicit version (after loadSupportAtVersion).
   * With no version, delegates to the current-version getSupport.
   */
  const getSupportAt = (query: SupportAtQuery): BrowserSupport => {
    const { browserId, featureId, canIUseId, mdnBcdPath, version } = query
    if (!version) {
      return getSupport(featureId, canIUseId, mdnBcdPath)
    }
    const brand = BRAND_BY_BROWSER[browserId]
    const key = versionedKey(
      baseKey(featureId, canIUseId, mdnBcdPath),
      brand,
      version
    )
    const cached = supportCache.value[key]
    if (cached) return cached
    const manual = MANUAL_SUPPORT[featureId]
    if (!manual) return UNKNOWN_SUPPORT
    // Cold cache: answer for the requested version rather than the raw entry.
    const versions = {
      ...browserVersions.value,
      [brand]: version
    } as BrowserVersions
    return honorManualAnchors(manual, versions)
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
