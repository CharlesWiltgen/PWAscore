/**
 * CanIUse data loader and parser
 * Loads browser compatibility data from GitHub with edge caching
 */

import type { SupportLevel, BrowserId } from '../composables/useBrowserSupport'
import {
  safeParseCanIUseData,
  safeParseMdnBcdFeature,
  safeParseBcdRelease,
  type CanIUseData as ValidatedCanIUseData
} from '../schemas/canIUse'

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
const CACHE_VERSION = '2026-06-14'

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
          throw new Error(
            `CanIUse data validation failed: ${validationResult.error}`
          )
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
        throw new Error(
          `CanIUse data validation failed: ${validationResult.error}`
        )
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
    const chromeVersion = data.agents.and_chr?.current_version || '146'
    const firefoxVersion = data.agents.and_ff?.current_version || '148'

    // For iOS Safari, use current_version directly if available (most reliable)
    // iOS Safari uses iOS version numbers (18.x, 26.x) matching the iOS release version
    let safariVersion = '26.3' // Fallback
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
      chrome: '146',
      firefox: '148',
      safari: '26.3'
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
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
}> {
  try {
    // Special case: Some features are universally supported but not in data-2.0.json
    if (
      (UNIVERSALLY_SUPPORTED_FEATURES as readonly string[]).includes(canIUseId)
    ) {
      return {
        chrome_android: 'supported',
        firefox_android: 'supported',
        safari_ios: 'supported',
        chrome: 'supported',
        firefox: 'supported',
        safari: 'supported'
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
        safari_ios: 'unknown',
        chrome: 'unknown',
        firefox: 'unknown',
        safari: 'unknown'
      }
    }

    // Query mobile browser agents
    // and_chr = Chrome for Android
    // and_ff = Firefox for Android
    // ios_saf = Safari on iOS
    const chromeAndroidStatus = findBrowserVersion(
      featureData.stats?.and_chr,
      browserVersions.chrome
    )
    const firefoxAndroidStatus = findBrowserVersion(
      featureData.stats?.and_ff,
      browserVersions.firefox
    )
    const safariIosStatus = findBrowserVersion(
      featureData.stats?.ios_saf,
      browserVersions.safari
    )

    // Query desktop browser agents
    // chrome = Chrome Desktop
    // firefox = Firefox Desktop
    // safari = Safari Desktop
    const chromeDesktopStatus = findBrowserVersion(
      featureData.stats?.chrome,
      browserVersions.chrome
    )
    const firefoxDesktopStatus = findBrowserVersion(
      featureData.stats?.firefox,
      browserVersions.firefox
    )
    const safariDesktopStatus = findBrowserVersion(
      featureData.stats?.safari,
      browserVersions.safari
    )

    return {
      chrome_android: parseStatus(chromeAndroidStatus),
      firefox_android: parseStatus(firefoxAndroidStatus),
      safari_ios: parseStatus(safariIosStatus),
      chrome: parseStatus(chromeDesktopStatus),
      firefox: parseStatus(firefoxDesktopStatus),
      safari: parseStatus(safariDesktopStatus)
    }
  } catch (error) {
    console.error(`Error getting CanIUse support for ${canIUseId}:`, error)
    return {
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios: 'unknown',
      chrome: 'unknown',
      firefox: 'unknown',
      safari: 'unknown'
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
  = 'https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data@8.0.3/data.json'

// Cache version for MDN BCD
const MDN_BCD_CACHE_VERSION = '2026-06-14'

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
    console.warn(
      `[MDN BCD] Feature validation failed for ${path}:`,
      validationResult.error
    )
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
    ? support.length > 0
      ? support[0]
      : null
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
  if (
    requiredVersion.startsWith('≥')
    || requiredVersion.startsWith('>')
    || requiredVersion.startsWith('<')
  ) {
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
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
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
        safari_ios: 'unknown',
        chrome: 'unknown',
        firefox: 'unknown',
        safari: 'unknown'
      }
    }

    const support = feature.__compat.support
    const status = feature.__compat.status

    // Check mobile browser support
    const chromeAndroid = support.chrome_android
      ? isVersionSupported(support.chrome_android, browserVersions.chrome)
      : { level: 'unknown' as const, partial: false }
    const firefoxAndroid = support.firefox_android
      ? isVersionSupported(support.firefox_android, browserVersions.firefox)
      : { level: 'unknown' as const, partial: false }
    const safariIos = support.safari_ios
      ? isVersionSupported(support.safari_ios, browserVersions.safari)
      : { level: 'unknown' as const, partial: false }

    // Check desktop browser support
    const chromeDesktop = support.chrome
      ? isVersionSupported(support.chrome, browserVersions.chrome)
      : { level: 'unknown' as const, partial: false }
    const firefoxDesktop = support.firefox
      ? isVersionSupported(support.firefox, browserVersions.firefox)
      : { level: 'unknown' as const, partial: false }
    const safariDesktop = support.safari
      ? isVersionSupported(support.safari, browserVersions.safari)
      : { level: 'unknown' as const, partial: false }

    return {
      chrome_android: chromeAndroid.partial ? 'partial' : chromeAndroid.level,
      firefox_android: firefoxAndroid.partial
        ? 'partial'
        : firefoxAndroid.level,
      safari_ios: safariIos.partial ? 'partial' : safariIos.level,
      chrome: chromeDesktop.partial ? 'partial' : chromeDesktop.level,
      firefox: firefoxDesktop.partial ? 'partial' : firefoxDesktop.level,
      safari: safariDesktop.partial ? 'partial' : safariDesktop.level,
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
      safari_ios: 'unknown',
      chrome: 'unknown',
      firefox: 'unknown',
      safari: 'unknown'
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

export type ReleaseChannel = 'released' | 'current' | 'beta'

export interface BrowserRelease {
  version: string
  releaseDate: string | null
  channel: ReleaseChannel
}

const RECENT_MAJORS = 8
const UPCOMING_STATUSES = new Set(['beta', 'nightly', 'planned'])

function majorOf(version: string): number {
  return Number.parseInt(version.split('.')[0] ?? '', 10)
}

/**
 * Get a windowed, channel-classified release list for a browser from MDN BCD.
 * Sourced from bcd.browsers[browserId].releases (CIU lacks mobile evergreen history).
 * Returns ascending by version; [] on error or unknown browser key.
 */
export async function getBrowserReleases(
  browserId: BrowserId,
  currentVersion: string,
  recentMajors: number = RECENT_MAJORS
): Promise<BrowserRelease[]> {
  try {
    const data = (await loadMdnBcdData()) as {
      browsers?: Record<string, { releases?: Record<string, unknown> }>
    }
    const rawReleases = data.browsers?.[browserId]?.releases
    if (!rawReleases) {
      return []
    }

    type Parsed = { version: string, releaseDate: string | null, upcoming: boolean }
    const parsed: Parsed[] = []
    for (const [version, info] of Object.entries(rawReleases)) {
      if (Number.isNaN(majorOf(version))) continue // skip TP and non-numeric
      const result = safeParseBcdRelease(info)
      if (!result.success || !result.data) continue
      const releaseDate = result.data.release_date ?? null
      const upcoming
        = releaseDate === null
          || (result.data.status !== undefined && UPCOMING_STATUSES.has(result.data.status))
      parsed.push({ version, releaseDate, upcoming })
    }

    const atOrBelow = parsed.filter(r => compareVersions(r.version, currentVersion) <= 0)
    const above = parsed.filter(r => compareVersions(r.version, currentVersion) > 0)

    // Latest representative release per major, among atOrBelow.
    const latestPerMajor = new Map<number, Parsed>()
    for (const r of atOrBelow) {
      const major = majorOf(r.version)
      const existing = latestPerMajor.get(major)
      if (!existing || compareVersions(r.version, existing.version) > 0) {
        latestPerMajor.set(major, r)
      }
    }
    const windowedMajors = [...latestPerMajor.keys()]
      .sort((a, b) => a - b)
      .slice(-recentMajors)
    const belowReleases = windowedMajors.map(m => latestPerMajor.get(m)!)

    const combined = [...belowReleases, ...above].sort((a, b) =>
      compareVersions(a.version, b.version)
    )

    return combined.map(r => ({
      version: r.version,
      releaseDate: r.releaseDate,
      // Use compareVersions (not ===) so a semantically-equal version in a
      // different format (e.g. '26.4.0' vs '26.4') still gets the current badge.
      channel: compareVersions(r.version, currentVersion) === 0
        ? 'current'
        : r.upcoming
          ? 'beta'
          : 'released'
    }))
  } catch (error) {
    console.error(`[BCD] Error getting releases for ${browserId}:`, error)
    return []
  }
}

export interface DatedRelease {
  version: string
  releaseDate: string
}

/**
 * All dated, numeric-versioned releases for a browser from MDN BCD (unwindowed,
 * unsorted). Skips Technology Preview and releases without a date. [] on error.
 * Used by the build-time score-history generator to define a time-based window.
 */
export async function getBrowserReleaseDates(
  browserId: BrowserId
): Promise<DatedRelease[]> {
  try {
    const data = (await loadMdnBcdData()) as {
      browsers?: Record<string, { releases?: Record<string, unknown> }>
    }
    const rawReleases = data.browsers?.[browserId]?.releases
    if (!rawReleases) return []

    const out: DatedRelease[] = []
    for (const [version, info] of Object.entries(rawReleases)) {
      if (Number.isNaN(majorOf(version))) continue
      const result = safeParseBcdRelease(info)
      if (!result.success || !result.data?.release_date) continue
      out.push({ version, releaseDate: result.data.release_date })
    }
    return out
  } catch (error) {
    console.error(`[BCD] Error getting release dates for ${browserId}:`, error)
    return []
  }
}

/**
 * Each major's LAUNCH (earliest-dated release) within [anchorDate - years,
 * anchorDate], ascending by version. Pure: enables a time-based (not count-based)
 * score-over-time window comparable across browsers with very different cadences.
 *
 * Uses the launch, not the latest patch: Safari backports security fixes to old
 * majors for years, so "latest release of major N" can be dated long after N
 * shipped (e.g. 15.6 in 2022 for a major that launched 2021-09) — which would
 * leave the start of the window empty. The launch date is what belongs on a
 * timeline. A major is included only if its launch falls inside the window.
 */
export function windowMajorLaunchesByDate(
  releases: DatedRelease[],
  anchorDate: Date,
  years: number
): DatedRelease[] {
  const cutoff = new Date(anchorDate)
  cutoff.setFullYear(cutoff.getFullYear() - years)
  const anchorMs = anchorDate.getTime()
  const cutoffMs = cutoff.getTime()

  const launchPerMajor = new Map<number, DatedRelease>()
  for (const r of releases) {
    const ms = new Date(r.releaseDate).getTime()
    if (Number.isNaN(ms)) continue
    const major = majorOf(r.version)
    const existing = launchPerMajor.get(major)
    if (!existing || ms < new Date(existing.releaseDate).getTime()) {
      launchPerMajor.set(major, r)
    }
  }
  return [...launchPerMajor.values()]
    .filter((r) => {
      const ms = new Date(r.releaseDate).getTime()
      return ms >= cutoffMs && ms <= anchorMs
    })
    .sort((a, b) => compareVersions(a.version, b.version))
}
