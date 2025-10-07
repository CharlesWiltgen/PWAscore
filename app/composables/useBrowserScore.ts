/**
 * Browser score calculation composable
 * Calculates PWA support scores based on feature support data
 */

import type { PWAFeatureGroup } from '../data/pwa-features'
import type { BrowserSupport, SupportLevel } from './useBrowserSupport'

/**
 * Browser scores with both weighted and unweighted values
 */
export interface BrowserScores {
  /** Weighted score based on feature importance (primary display) */
  weighted: number
  /** Unweighted raw coverage score (for comparison) */
  unweighted: number
}

/**
 * Calculate browser score based on feature support
 */
export function useBrowserScore() {
  /**
   * Get weight for a support level
   * Treat 'unknown' as 0.0 to allow scores to start at 0 and only increment
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
   * Returns both weighted (by feature importance) and unweighted scores
   */
  const calculateBrowserScore = (
    browserId: keyof BrowserSupport,
    featureGroups: PWAFeatureGroup[],
    getSupportFn: (featureId: string, canIUseId?: string, mdnBcdPath?: string) => BrowserSupport
  ): BrowserScores => {
    let weightedPoints = 0
    let totalPossibleWeight = 0
    let unweightedPoints = 0
    let featureCount = 0

    // Iterate through all feature groups, categories, and features
    for (const group of featureGroups) {
      for (const category of group.categories) {
        for (const feature of category.features) {
          const support = getSupportFn(feature.id, feature.canIUseId, feature.mdnBcdPath)
          const browserSupport = support[browserId]

          // Only count features with known support status
          if (browserSupport !== 'unknown') {
            const supportLevel = getSupportWeight(browserSupport)
            const featureWeight = feature.weight ?? 1.0

            // Weighted score: support level × feature weight
            weightedPoints += supportLevel * featureWeight
            totalPossibleWeight += featureWeight

            // Unweighted score: support level × 1.0
            unweightedPoints += supportLevel
            featureCount++
          }
        }
      }
    }

    if (featureCount === 0) {
      return { weighted: 0, unweighted: 0 }
    }

    // Calculate percentage scores
    return {
      weighted: Math.round((weightedPoints / totalPossibleWeight) * 100),
      unweighted: Math.round((unweightedPoints / featureCount) * 100)
    }
  }

  return {
    calculateBrowserScore
  }
}
