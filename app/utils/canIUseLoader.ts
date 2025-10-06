/**
 * CanIUse data loader and parser
 * Loads browser compatibility data from /data/caniuse-data.json
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

let canIUseData: CanIUseData | null = null

/**
 * Load CanIUse data from static JSON file
 */
async function loadCanIUseData(): Promise<CanIUseData> {
  if (canIUseData) {
    return canIUseData
  }

  try {
    const response = await fetch('/data/caniuse-data.json')
    if (!response.ok) {
      throw new Error(`Failed to load CanIUse data: ${response.status}`)
    }
    canIUseData = await response.json()
    return canIUseData!
  } catch (error) {
    console.error('Error loading CanIUse data:', error)
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
