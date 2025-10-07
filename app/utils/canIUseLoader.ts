/**
 * CanIUse data loader and parser
 * Loads browser compatibility data from GitHub with edge caching
 */

import type { SupportLevel } from '../composables/useBrowserSupport'

interface CanIUseData {
  agents: Record<string, {
    browser: string
    version_list: Array<{ version: string }>
  }>
  data: Record<string, {
    stats: Record<string, Record<string, string>>
  }>
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
 * For Safari 18.4, try: 18.4, then 18, then TP (tech preview)
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

    // Get support for each browser
    const chromeStatus = findBrowserVersion(
      featureData.stats?.chrome,
      browserVersions.chrome
    )
    const firefoxStatus = findBrowserVersion(
      featureData.stats?.firefox,
      browserVersions.firefox
    )
    const safariStatus = findBrowserVersion(
      featureData.stats?.safari,
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
