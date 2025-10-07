/**
 * CanIUse data loader and parser
 * Loads browser compatibility data from GitHub with edge caching
 */

import type { SupportLevel } from '../composables/useBrowserSupport'

interface CanIUseData {
  agents: Record<string, {
    browser: string
    current_version?: string
    version_list: Array<{ version: string }>
  }>
  data: Record<string, {
    stats: Record<string, Record<string, string>>
  }>
}

export interface BrowserVersions {
  chrome: string
  firefox: string
  safari: string
}

// GitHub URL for CanIUse data
const CANIUSE_URL = 'https://raw.githubusercontent.com/Fyrd/caniuse/refs/heads/main/fulldata-json/data-2.0.json'

// Cache version - update this to force cache refresh
const CACHE_VERSION = '2025-10-06'

// In-memory cache
let canIUseData: CanIUseData | null = null

/**
 * Load CanIUse data from GitHub with Cache API
 * Uses Cloudflare Cache API to store compressed data at the edge
 * Cache TTL: 1 day (86400 seconds)
 */
async function loadCanIUseData(): Promise<CanIUseData> {
  // Return cached data if available in memory
  if (canIUseData) {
    return canIUseData
  }

  try {
    // Use Cache API on server-side in production (Cloudflare Workers)
    if (import.meta.server && import.meta.prod && typeof caches !== 'undefined') {
      const cache = caches.default
      const cacheKey = new Request(`https://pwascore-cache/caniuse/${CACHE_VERSION}`)

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

      canIUseData = await response.json()
      return canIUseData!
    }

    // Development or client-side fallback - fetch directly from GitHub
    console.log('[CanIUse] Development/client-side fetch from GitHub')
    const response = await fetch(CANIUSE_URL)

    if (!response.ok) {
      throw new Error(`Failed to load CanIUse data: ${response.status}`)
    }

    canIUseData = await response.json()
    return canIUseData!

  } catch (error) {
    console.error('[CanIUse] Error loading data:', error)
    throw error
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

    // For iOS Safari, find the highest iOS version from version_list
    // iOS Safari uses iOS version numbers (18.x) not Safari version numbers (26.x)
    let safariVersion = '18.4' // Fallback
    const safariAgent = data.agents.ios_saf
    if (safariAgent?.version_list) {
      // Find all iOS versions (not ranges, just single versions like "18.0")
      const versions = safariAgent.version_list
        .map(v => v.version)
        .filter(v => !v.includes('-') && Number.parseFloat(v) < 20) // Filter out Safari versions (26.x)
        .map(v => Number.parseFloat(v))
        .filter(v => !Number.isNaN(v))

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
        const [rangeStart, rangeEnd] = versionKey.split('-').map(v => Number.parseFloat(v))
        if (!Number.isNaN(rangeStart) && !Number.isNaN(rangeEnd)) {
          // Check if target version is within or close to the range
          // Allow matching if target is within ±1 major version of the range
          if (targetMajor >= rangeStart - 1 && targetMajor <= rangeEnd + 1) {
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
 */
export async function getCanIUseSupport(
  canIUseId: string,
  browserVersions: {
    chrome: string
    firefox: string
    safari: string
  }
): Promise<{
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
}> {
  try {
    const data = await loadCanIUseData()

    // Check if feature exists
    const featureData = data.data[canIUseId]
    if (!featureData) {
      console.log(`CanIUse feature not found: ${canIUseId}`)
      return {
        chrome: 'unknown',
        firefox: 'unknown',
        safari: 'unknown'
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
      chrome: parseStatus(chromeStatus),
      firefox: parseStatus(firefoxStatus),
      safari: parseStatus(safariStatus)
    }
  } catch (error) {
    console.error(`Error getting CanIUse support for ${canIUseId}:`, error)
    return {
      chrome: 'unknown',
      firefox: 'unknown',
      safari: 'unknown'
    }
  }
}
