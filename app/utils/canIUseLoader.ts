/**
 * CanIUse data loader and parser
 * Loads browser compatibility data from GitHub with edge caching
 */

import type { SupportLevel } from '../composables/useBrowserSupport'
import { safeParseCanIUseData, safeParseMdnBcdFeature, type CanIUseData as ValidatedCanIUseData } from '../schemas/canIUse'

/**
 * Features that are universally supported but not in CanIUse data-2.0.json
 * These features exist in features-json but are missing from the main data file
 */
const UNIVERSALLY_SUPPORTED_FEATURES = ['web-app-manifest'] as const

// Use Valibot-inferred type for CanIUse data
type CanIUseData = ValidatedCanIUseData

export interface BrowserVersions {
  chrome: string
  firefox: string
  safari: string
}

// GitHub URL for CanIUse data
const CANIUSE_URL
  = 'https://raw.githubusercontent.com/Fyrd/caniuse/refs/heads/main/fulldata-json/data-2.0.json'

// Cache version - update this to force cache refresh
const CACHE_VERSION = '2025-10-06'

// In-memory cache
let canIUseData: CanIUseData | null = null
let loadingPromise: Promise<CanIUseData> | null = null

/**
 * Load CanIUse data from GitHub with Cache API
 * Uses Cloudflare Cache API to store compressed data at the edge
 * Cache TTL: 1 day (86400 seconds)
 * Prevents concurrent fetches by using a loading promise
 */
async function loadCanIUseData(): Promise<CanIUseData> {
  // Return cached data if available in memory
  if (canIUseData) {
    return canIUseData
  }

  // If already loading, wait for that promise instead of starting another fetch
  if (loadingPromise) {
    return loadingPromise
  }

  // Create the loading promise
  const promise = (async (): Promise<CanIUseData> => {
    try {
      // Use Cache API on server-side in production (Cloudflare Workers)
      if (
        import.meta.server
          // @ts-expect-error - Cloudflare Workers specific properties
          && import.meta.prod
          && typeof caches !== 'undefined'
      ) {
        // @ts-expect-error - Cloudflare Workers cache API
        const cache = caches.default
        const cacheKey = new Request(
          `https://pwascore-cache/caniuse/${CACHE_VERSION}`
        )

        let response = await cache.match(cacheKey)

        if (!response) {
          console.log('[CanIUse] Cache miss - fetching from GitHub')

          // Fetch from GitHub (already compressed via gzip)
          response = await fetch(CANIUSE_URL, {
            headers: {
              'Accept-Encoding': 'gzip, br'
            }
          })

          if (!response.ok) {
            throw new Error(`Failed to load CanIUse data: ${response.status}`)
          }

          // Cache for 1 day
          const headers = new Headers(response.headers)
          headers.set('Cache-Control', 'public, max-age=86400')

          const cachedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          })

          // Store in cache
          await cache.put(cacheKey, cachedResponse.clone())
          response = cachedResponse

          console.log('[CanIUse] Data cached at edge')
        } else {
          console.log('[CanIUse] Cache hit - using cached data')
        }

        const rawData = await response.json()

        // Validate CanIUse data structure
        const validationResult = safeParseCanIUseData(rawData)
        if (!validationResult.success) {
          console.error('[CanIUse] Validation failed:', validationResult.error)
          throw new Error(`CanIUse data validation failed: ${validationResult.error}`)
        }

        // TypeScript: data is guaranteed to be defined after success check
        const data = validationResult.data!
        canIUseData = data // Assign immediately to prevent race condition
        return data
      }

      // Development or client-side fallback - fetch directly from GitHub
      const response = await fetch(CANIUSE_URL)

      if (!response.ok) {
        throw new Error(`Failed to load CanIUse data: ${response.status}`)
      }

      const rawData = await response.json()

      // Validate CanIUse data structure
      const validationResult = safeParseCanIUseData(rawData)
      if (!validationResult.success) {
        console.error('[CanIUse] Validation failed:', validationResult.error)
        throw new Error(`CanIUse data validation failed: ${validationResult.error}`)
      }

      // TypeScript: data is guaranteed to be defined after success check
      const data = validationResult.data!
      canIUseData = data // Assign immediately to prevent race condition
      return data
    } catch (error) {
      console.error('[CanIUse] Error loading data:', error)
      throw error
    }
  })()

  loadingPromise = promise

  try {
    return await promise
  } finally {
    // Always clear if still the same promise (handles both success and error)
    if (loadingPromise === promise) {
      loadingPromise = null
    }
  }
}

/**
 * Extract current browser versions from CanIUse data
 * Returns the latest version for each mobile browser
 */
export async function getBrowserVersions(): Promise<BrowserVersions> {
  try {
    const data = await loadCanIUseData()

    // Get Chrome and Firefox versions directly from agents
    const chromeVersion = data.agents.and_chr?.current_version || '141'
    const firefoxVersion = data.agents.and_ff?.current_version || '143'

    // For iOS Safari, use current_version directly if available (most reliable)
    // iOS Safari uses iOS version numbers (18.x, 26.x) matching the iOS release version
    let safariVersion = '18.4' // Fallback
    const safariAgent = data.agents.ios_saf

    if (safariAgent?.current_version) {
      // Use the explicitly provided current version (future-proof, no hardcoded limits)
      safariVersion = safariAgent.current_version
    } else if (safariAgent?.version_list) {
      // Fallback: find the highest released version
      // Exclude ranges (containing '-') and unreleased versions (release_date === null)
      const versions = safariAgent.version_list
        .filter((v) => {
          if (v.version.includes('-')) return false // Skip ranges like "18.5-18.6"
          if (!v.release_date) return false // Skip unreleased versions (TP, future releases)
          return true
        })
        .map(v => Number.parseFloat(v.version))
        .filter(num => !Number.isNaN(num))

      if (versions.length > 0) {
        const maxVersion = Math.max(...versions)
        safariVersion = maxVersion.toString()
      }
    }

    return {
      chrome: chromeVersion,
      firefox: firefoxVersion,
      safari: safariVersion
    }
  } catch (error) {
    console.error('[CanIUse] Error getting browser versions:', error)
    // Return fallback versions
    return {
      chrome: '141',
      firefox: '143',
      safari: '18.4'
    }
  }
}

/**
 * Parse CanIUse status code to SupportLevel
 * y = supported
 * a = partial (alternative implementation)
 * n = not supported
 * u = unknown
 * p = polyfill available
 * x = prefix required
 * Codes can be combined like "y x" or include notes like "n d #2"
 */
function parseStatus(status: string | undefined): SupportLevel {
  if (!status) {
    return 'unknown'
  }

  const normalized = status.toLowerCase().trim()

  // Extract first character which is the main status
  const mainStatus = normalized.charAt(0)

  switch (mainStatus) {
    case 'y':
      return 'supported'
    case 'a':
      return 'partial'
    case 'n':
    case 'u':
      return 'not-supported'
    case 'p':
    case 'x':
      return 'partial' // Polyfill or prefix required = partial support
    default:
      return 'unknown'
  }
}

/**
 * Find best matching browser version
 * For Safari 18.4, try: 18.4, then 18, then version ranges (18.5-18.6), then TP (tech preview)
 */
function findBrowserVersion(
  stats: Record<string, string> | undefined,
  targetVersion: string
): string | undefined {
  if (!stats) {
    return undefined
  }

  // Try exact match first
  const exactMatch = stats[targetVersion]
  if (exactMatch) {
    return exactMatch
  }

  // For Safari fractional versions (18.4), try major version (18)
  if (targetVersion.includes('.')) {
    const majorVersion = targetVersion.split('.')[0]
    const majorMatch = majorVersion ? stats[majorVersion] : undefined
    if (majorMatch) {
      return majorMatch
    }

    // Try to find a version range that contains the target version
    // iOS Safari uses ranges like "18.5-18.6"
    const targetMajor = Number.parseFloat(targetVersion)
    for (const [versionKey, support] of Object.entries(stats)) {
      if (versionKey.includes('-')) {
        const [rangeStart, rangeEnd] = versionKey
          .split('-')
          .map(v => Number.parseFloat(v))
        if (
          rangeStart !== undefined
          && rangeEnd !== undefined
          && !Number.isNaN(rangeStart)
          && !Number.isNaN(rangeEnd)
        ) {
          // Check if target version is within the range (exact match required)
          if (targetMajor >= rangeStart && targetMajor <= rangeEnd) {
            return support
          }
        }
      }
    }
  }

  // Try TP (technology preview) as fallback for Safari
  const tpMatch = stats.TP
  if (tpMatch) {
    return tpMatch
  }

  return undefined
}

/**
 * Get browser support for a specific feature from CanIUse data
 * Queries mobile browser agents: Chrome for Android, Firefox for Android, Safari on iOS
 * Returns platform-specific browser keys (chrome_android, firefox_android, safari_ios)
 */
export async function getCanIUseSupport(
  canIUseId: string,
  browserVersions: {
    chrome: string
    firefox: string
    safari: string
  }
): Promise<{
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
}> {
  try {
    // Special case: Some features are universally supported but not in data-2.0.json
    if (
      (UNIVERSALLY_SUPPORTED_FEATURES as readonly string[]).includes(canIUseId)
    ) {
      return {
        chrome_android: 'supported',
        firefox_android: 'supported',
        safari_ios: 'supported'
      }
    }

    const data = await loadCanIUseData()

    // Check if feature exists
    const featureData = data.data[canIUseId]
    if (!featureData) {
      // Only log if not a known special case (to reduce console noise)
      if (
        !(UNIVERSALLY_SUPPORTED_FEATURES as readonly string[]).includes(
          canIUseId
        )
      ) {
        console.log(`CanIUse feature not found: ${canIUseId}`)
      }
      return {
        chrome_android: 'unknown',
        firefox_android: 'unknown',
        safari_ios: 'unknown'
      }
    }

    // Query mobile browser agents
    // and_chr = Chrome for Android
    // and_ff = Firefox for Android
    // ios_saf = Safari on iOS
    const chromeStatus = findBrowserVersion(
      featureData.stats?.and_chr,
      browserVersions.chrome
    )
    const firefoxStatus = findBrowserVersion(
      featureData.stats?.and_ff,
      browserVersions.firefox
    )
    const safariStatus = findBrowserVersion(
      featureData.stats?.ios_saf,
      browserVersions.safari
    )

    return {
      chrome_android: parseStatus(chromeStatus),
      firefox_android: parseStatus(firefoxStatus),
      safari_ios: parseStatus(safariStatus)
    }
  } catch (error) {
    console.error(`Error getting CanIUse support for ${canIUseId}:`, error)
    return {
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios: 'unknown'
    }
  }
}

/**
 * MDN Browser Compatibility Data types
 */
interface MdnBcdSupport {
  version_added: string | boolean | null
  version_removed?: string
  partial_implementation?: boolean
  flags?: Array<{
    name: string
    type: string
    value_to_set?: string
  }>
}

interface MdnBcdStatus {
  experimental?: boolean
  standard_track?: boolean
  deprecated?: boolean
}

interface MdnBcdFeature {
  __compat?: {
    mdn_url?: string
    support?: Record<string, MdnBcdSupport | MdnBcdSupport[]>
    status?: MdnBcdStatus
  }
  [key: string]: unknown
}

// MDN BCD CDN URL
const MDN_BCD_URL
  = 'https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data@7.1.11/data.json'

// Cache version for MDN BCD
const MDN_BCD_CACHE_VERSION = '2025-10-07'

// In-memory cache for MDN BCD data
let mdnBcdData: unknown = null
let mdnBcdLoadingPromise: Promise<unknown> | null = null

/**
 * Clear in-memory caches (for testing only)
 * @internal
 */
export function clearCaches(): void {
  canIUseData = null
  loadingPromise = null
  mdnBcdData = null
  mdnBcdLoadingPromise = null
}

/**
 * Load MDN Browser Compatibility Data from CDN
 * Uses Cloudflare Cache API to store at the edge
 * Cache TTL: 1 day (86400 seconds)
 * Prevents concurrent fetches by using a loading promise
 */
async function loadMdnBcdData(): Promise<unknown> {
  if (mdnBcdData) {
    return mdnBcdData
  }

  // If already loading, wait for that promise
  if (mdnBcdLoadingPromise) {
    return mdnBcdLoadingPromise
  }

  const promise = (async () => {
    try {
      // Use Cache API on server-side in production (Cloudflare Workers)
      if (
        import.meta.server
          // @ts-expect-error - Cloudflare Workers specific properties
          && import.meta.prod
          && typeof caches !== 'undefined'
      ) {
        // @ts-expect-error - Cloudflare Workers cache API
        const cache = caches.default
        const cacheKey = new Request(
          `https://pwascore-cache/mdn-bcd/${MDN_BCD_CACHE_VERSION}`
        )

        let response = await cache.match(cacheKey)

        if (!response) {
          console.log('[MDN BCD] Cache miss - fetching from CDN')

          // Fetch from CDN
          response = await fetch(MDN_BCD_URL)

          if (!response.ok) {
            throw new Error(`Failed to load MDN BCD data: ${response.status}`)
          }

          // Cache for 1 day
          const headers = new Headers(response.headers)
          headers.set('Cache-Control', 'public, max-age=86400')

          const cachedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          })

          // Store in cache
          await cache.put(cacheKey, cachedResponse.clone())
          response = cachedResponse

          console.log('[MDN BCD] Data cached at edge')
        } else {
          console.log('[MDN BCD] Cache hit - using cached data')
        }

        const data = await response.json()
        mdnBcdData = data // Assign immediately to prevent race condition
        return data
      }

      // Development or client-side fallback - fetch directly from CDN
      const response = await fetch(MDN_BCD_URL)

      if (!response.ok) {
        throw new Error(`Failed to load MDN BCD data: ${response.status}`)
      }

      const data = await response.json()
      mdnBcdData = data // Assign immediately to prevent race condition
      return data
    } catch (error) {
      console.error('[MDN BCD] Error loading data:', error)
      throw error
    }
  })()

  mdnBcdLoadingPromise = promise

  try {
    return await promise
  } finally {
    // Always clear if still the same promise (handles both success and error)
    if (mdnBcdLoadingPromise === promise) {
      mdnBcdLoadingPromise = null
    }
  }
}

/**
 * Navigate MDN BCD data structure using dot-notation path
 * Example: "api.Navigator.setAppBadge" -> bcd.api.Navigator.setAppBadge
 * Now with runtime validation to ensure data structure is correct
 */
function navigateMdnBcdPath(data: unknown, path: string): MdnBcdFeature | null {
  const parts = path.split('.')
  let current = data as Record<string, unknown>

  for (const part of parts) {
    const next = current?.[part]
    if (!next) {
      return null
    }
    current = next as Record<string, unknown>
  }

  // Validate the feature data structure before returning
  const validationResult = safeParseMdnBcdFeature(current)

  if (!validationResult.success) {
    console.warn(`[MDN BCD] Feature validation failed for ${path}:`, validationResult.error)
    // Return the unvalidated data but log the warning
    // This prevents breaking existing functionality while alerting us to schema mismatches
    return current as unknown as MdnBcdFeature
  }

  // TypeScript: data is guaranteed to be defined after success check
  return validationResult.data!
}

/**
 * Compare two version strings semantically
 * Returns: negative if a < b, 0 if equal, positive if a > b
 * Handles versions like "18.10" vs "18.9" correctly (18.10 > 18.9)
 * Supports pre-release versions (18.0-alpha < 18.0) and wildcards (17.x = 17.0)
 */
export function compareVersions(a: string, b: string): number {
  // Split on '-' to handle pre-release versions (e.g., "18.0-alpha")
  const aSplit = a.split('-')
  const bSplit = b.split('-')
  const aVersion = aSplit[0] || '0'
  const bVersion = bSplit[0] || '0'
  const aPrerelease = aSplit[1]
  const bPrerelease = bSplit[1]

  const aParts = aVersion.split('.').map((part) => {
    // Handle wildcards: 'x' or '*' mean "any version" (treat as 0)
    if (part === 'x' || part === '*') return 0
    const num = Number.parseInt(part, 10)
    return Number.isNaN(num) ? 0 : num
  })

  const bParts = bVersion.split('.').map((part) => {
    if (part === 'x' || part === '*') return 0
    const num = Number.parseInt(part, 10)
    return Number.isNaN(num) ? 0 : num
  })

  const maxLength = Math.max(aParts.length, bParts.length)

  // Compare numeric parts first
  for (let i = 0; i < maxLength; i++) {
    const aVal = aParts[i] || 0
    const bVal = bParts[i] || 0
    if (aVal !== bVal) {
      return aVal - bVal
    }
  }

  // If numeric parts equal, compare pre-release tags
  // No pre-release > has pre-release (18.0 > 18.0-alpha)
  if (!aPrerelease && bPrerelease) return 1
  if (aPrerelease && !bPrerelease) return -1
  if (aPrerelease && bPrerelease) {
    return aPrerelease.localeCompare(bPrerelease)
  }

  return 0
}

/**
 * Compare browser version with MDN BCD support data
 * Returns true if the current version supports the feature
 */
function isVersionSupported(
  support: MdnBcdSupport | MdnBcdSupport[],
  currentVersion: string
): { level: SupportLevel, partial: boolean } {
  // Handle array of support objects (multiple implementation attempts)
  // MDN BCD can return empty arrays when no support information is available
  const supportData = Array.isArray(support)
    ? (support.length > 0 ? support[0] : null)
    : support

  // Empty arrays or null indicate no known support information
  if (!supportData) {
    return { level: 'unknown', partial: false }
  }

  // Handle flags (feature behind flag = not supported for users)
  if (supportData.flags && supportData.flags.length > 0) {
    return { level: 'not-supported', partial: false }
  }

  // Handle version_added
  if (supportData.version_added === false) {
    return { level: 'not-supported', partial: false }
  }

  if (supportData.version_added === true) {
    return {
      level: 'supported',
      partial: supportData.partial_implementation || false
    }
  }

  if (supportData.version_added === null) {
    return { level: 'unknown', partial: false }
  }

  // Compare versions (simple string comparison works for most cases)
  // Safari uses iOS versions like "16.4", Chrome uses "83", etc.
  const requiredVersion = supportData.version_added as string

  // Handle version strings with comparison operators (≤, ≥, <, >)
  // ≤X means "supported since version X or earlier" = definitely supported now
  if (requiredVersion.startsWith('≤')) {
    return {
      level: 'supported',
      partial: supportData.partial_implementation || false
    }
  }

  // ≥X or >X means "requires at least version X" = need to compare
  let versionToCompare = requiredVersion
  if (requiredVersion.startsWith('≥') || requiredVersion.startsWith('>') || requiredVersion.startsWith('<')) {
    versionToCompare = requiredVersion.replace(/^[≥><]=?/, '')
  }

  // Use semantic version comparison instead of parseFloat
  // This correctly handles versions like "18.10" > "18.9"
  const comparison = compareVersions(currentVersion, versionToCompare)

  if (comparison >= 0) {
    return {
      level: 'supported',
      partial: supportData.partial_implementation || false
    }
  } else {
    return { level: 'not-supported', partial: false }
  }
}

export interface FeatureStatus {
  experimental: boolean
  standard_track: boolean
  deprecated: boolean
}

/**
 * Get browser support from MDN BCD for a specific API path
 * Queries mobile browser support: chrome_android, firefox_android, safari_ios
 * Returns platform-specific browser keys with status flags
 */
export async function getMdnBcdSupport(
  mdnBcdPath: string,
  browserVersions: BrowserVersions
): Promise<{
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
  status?: FeatureStatus
}> {
  try {
    const bcdData = await loadMdnBcdData()
    const feature = navigateMdnBcdPath(bcdData, mdnBcdPath)

    if (!feature || !feature.__compat?.support) {
      console.log(`MDN BCD feature not found: ${mdnBcdPath}`)
      return {
        chrome_android: 'unknown',
        firefox_android: 'unknown',
        safari_ios: 'unknown'
      }
    }

    const support = feature.__compat.support
    const status = feature.__compat.status

    // Check mobile browser support
    const chromeSupport = support.chrome_android
    const firefoxSupport = support.firefox_android
    const safariSupport = support.safari_ios

    const chrome = chromeSupport
      ? isVersionSupported(chromeSupport, browserVersions.chrome)
      : { level: 'unknown' as const, partial: false }
    const firefox = firefoxSupport
      ? isVersionSupported(firefoxSupport, browserVersions.firefox)
      : { level: 'unknown' as const, partial: false }
    const safari = safariSupport
      ? isVersionSupported(safariSupport, browserVersions.safari)
      : { level: 'unknown' as const, partial: false }

    return {
      chrome_android: chrome.partial ? 'partial' : chrome.level,
      firefox_android: firefox.partial ? 'partial' : firefox.level,
      safari_ios: safari.partial ? 'partial' : safari.level,
      status: status
        ? {
            experimental: status.experimental || false,
            standard_track: status.standard_track !== false,
            deprecated: status.deprecated || false
          }
        : undefined
    }
  } catch (error) {
    console.error(`Error getting MDN BCD support for ${mdnBcdPath}:`, error)
    return {
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios: 'unknown'
    }
  }
}

/**
 * Get MDN documentation URL from BCD data
 * Walks up parent paths if child doesn't have mdn_url
 */
export async function getMdnUrlFromBcd(
  mdnBcdPath: string
): Promise<string | undefined> {
  try {
    const bcdData = await loadMdnBcdData()
    const parts = mdnBcdPath.split('.')

    // Try to find mdn_url starting from the full path, then walking up parents
    for (let i = parts.length; i > 0; i--) {
      const currentPath = parts.slice(0, i).join('.')
      const feature = navigateMdnBcdPath(bcdData, currentPath)

      if (feature?.__compat?.mdn_url) {
        return feature.__compat.mdn_url
      }
    }

    return undefined
  } catch (error) {
    console.error(`Error getting MDN URL for ${mdnBcdPath}:`, error)
    return undefined
  }
}
