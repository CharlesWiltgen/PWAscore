/**
 * Browser score calculation composable
 * Calculates PWA support scores based on feature support data
 */

import type { PWAFeatureGroup } from '../data/pwa-features'
import type { BrowserSupport, SupportLevel } from './useBrowserSupport'

/**
 * Calculate browser score based on feature support
 */
export function useBrowserScore() {
  /**
   * Get weight for a support level
   */
  const getSupportWeight = (level: SupportLevel): number => {
    switch (level) {
      case 'supported':
        return 1.0
      case 'partial':
        return 0.5
      case 'not-supported':
        return 0.0
      case 'unknown':
        return 0.0
    }
  }

  /**
   * Calculate score for a specific browser across all features
   * Only includes features with known support status (excludes 'unknown')
   */
  const calculateBrowserScore = (
    browserId: keyof BrowserSupport,
    featureGroups: PWAFeatureGroup[],
    getSupportFn: (featureId: string, canIUseId?: string) => BrowserSupport
  ): number => {
    let totalWeight = 0
    let featureCount = 0

    // Iterate through all feature groups, categories, and features
    for (const group of featureGroups) {
      for (const category of group.categories) {
        for (const feature of category.features) {
          const support = getSupportFn(feature.id, feature.canIUseId)
          const browserSupport = support[browserId]

          // Only count features with known support status
          if (browserSupport !== 'unknown') {
            totalWeight += getSupportWeight(browserSupport)
            featureCount++
          }
        }
      }
    }

    if (featureCount === 0) return 0

    // Calculate percentage score based on known features only
    return Math.round((totalWeight / featureCount) * 100)
  }

  return {
    calculateBrowserScore
  }
}
