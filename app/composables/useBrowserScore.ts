/**
 * Browser score calculation composable
 * Calculates PWA support scores based on feature support data
 */

import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import type {
  BrowserSupport,
  BrowserId,
  SupportLevel
} from './useBrowserSupport'

/**
 * Browser scores with both weighted and unweighted values
 */
export interface BrowserScores {
  /** Weighted score based on feature importance - excludes experimental/non-standard/deprecated (primary display) */
  weighted: number
  /** Unweighted raw coverage score - excludes experimental/non-standard/deprecated (for comparison) */
  unweighted: number
  /** Full weighted score including all features (shown in tooltip) */
  weightedFull: number
  /** Full unweighted score including all features (shown in tooltip) */
  unweightedFull: number
}

/**
 * Browser score result including per-group breakdowns
 */
export interface BrowserScoreResult extends BrowserScores {
  groupScores: Record<string, BrowserScores>
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
   * Check if a feature should be excluded from the primary score
   * Excludes experimental, non-standard, and deprecated features
   */
  const shouldExcludeFromPrimaryScore = (support: BrowserSupport): boolean => {
    if (!support.status) return false
    return (
      support.status.experimental
      || !support.status.standard_track
      || support.status.deprecated
    )
  }

  /**
   * Calculate score for a specific browser across all features
   * Only includes features with known support status (excludes 'unknown')
   * Returns both stable scores (excluding experimental/non-standard/deprecated) and full scores
   */
  const calculatePercentages = (
    stableWeightedPoints: number,
    stableTotalPossibleWeight: number,
    stableUnweightedPoints: number,
    stableFeatureCount: number,
    fullWeightedPoints: number,
    fullTotalPossibleWeight: number,
    fullUnweightedPoints: number,
    fullFeatureCount: number
  ): BrowserScores => ({
    weighted:
      stableFeatureCount > 0 && stableTotalPossibleWeight > 0
        ? Math.round((stableWeightedPoints / stableTotalPossibleWeight) * 100)
        : 0,
    unweighted:
      stableFeatureCount > 0
        ? Math.round((stableUnweightedPoints / stableFeatureCount) * 100)
        : 0,
    weightedFull:
      fullFeatureCount > 0 && fullTotalPossibleWeight > 0
        ? Math.round((fullWeightedPoints / fullTotalPossibleWeight) * 100)
        : 0,
    unweightedFull:
      fullFeatureCount > 0
        ? Math.round((fullUnweightedPoints / fullFeatureCount) * 100)
        : 0
  })

  const calculateBrowserScore = (
    browserId: BrowserId,
    featureGroups: PWAFeatureGroup[],
    getSupportFn: (
      featureId: string,
      canIUseId?: string,
      mdnBcdPath?: string
    ) => BrowserSupport
  ): BrowserScoreResult => {
    // Overall accumulators
    let stableWeightedPoints = 0
    let stableTotalPossibleWeight = 0
    let stableUnweightedPoints = 0
    let stableFeatureCount = 0
    let fullWeightedPoints = 0
    let fullTotalPossibleWeight = 0
    let fullUnweightedPoints = 0
    let fullFeatureCount = 0

    const groupScores: Record<string, BrowserScores> = {}

    for (const group of featureGroups) {
      // Per-group accumulators
      let gStableWP = 0
      let gStableTPW = 0
      let gStableUP = 0
      let gStableFC = 0
      let gFullWP = 0
      let gFullTPW = 0
      let gFullUP = 0
      let gFullFC = 0

      for (const category of group.categories) {
        for (const feature of category.features) {
          const support = getSupportFn(
            feature.id,
            feature.canIUseId,
            feature.mdnBcdPath
          )
          const browserSupport = support[browserId]

          if (browserSupport !== 'unknown') {
            const supportLevel = getSupportWeight(browserSupport)
            const featureWeight = feature.weight ?? 1.0
            const excludeFromPrimary = shouldExcludeFromPrimaryScore(support)

            fullWeightedPoints += supportLevel * featureWeight
            fullTotalPossibleWeight += featureWeight
            fullUnweightedPoints += supportLevel
            fullFeatureCount++
            gFullWP += supportLevel * featureWeight
            gFullTPW += featureWeight
            gFullUP += supportLevel
            gFullFC++

            if (!excludeFromPrimary) {
              stableWeightedPoints += supportLevel * featureWeight
              stableTotalPossibleWeight += featureWeight
              stableUnweightedPoints += supportLevel
              stableFeatureCount++
              gStableWP += supportLevel * featureWeight
              gStableTPW += featureWeight
              gStableUP += supportLevel
              gStableFC++
            }
          }
        }
      }

      groupScores[group.id] = calculatePercentages(
        gStableWP, gStableTPW, gStableUP, gStableFC,
        gFullWP, gFullTPW, gFullUP, gFullFC
      )
    }

    return {
      ...calculatePercentages(
        stableWeightedPoints, stableTotalPossibleWeight, stableUnweightedPoints, stableFeatureCount,
        fullWeightedPoints, fullTotalPossibleWeight, fullUnweightedPoints, fullFeatureCount
      ),
      groupScores
    }
  }

  return {
    calculateBrowserScore
  }
}
