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

/** One point in a score-over-time series: a release version, its date, and the weighted score at that version. */
export interface ScorePoint {
  version: string
  releaseDate: string | null
  weighted: number
}

type ScoreAccumulator = {
  weightedPoints: number
  totalPossibleWeight: number
  unweightedPoints: number
  featureCount: number
}

function createAccumulator(): ScoreAccumulator {
  return { weightedPoints: 0, totalPossibleWeight: 0, unweightedPoints: 0, featureCount: 0 }
}

function addToAccumulator(acc: ScoreAccumulator, supportLevel: number, featureWeight: number): void {
  acc.weightedPoints += supportLevel * featureWeight
  acc.totalPossibleWeight += featureWeight
  acc.unweightedPoints += supportLevel
  acc.featureCount++
}

function calculatePercentages(stable: ScoreAccumulator, full: ScoreAccumulator): BrowserScores {
  return {
    weighted:
      stable.featureCount > 0 && stable.totalPossibleWeight > 0
        ? Math.round((stable.weightedPoints / stable.totalPossibleWeight) * 100)
        : 0,
    unweighted:
      stable.featureCount > 0
        ? Math.round((stable.unweightedPoints / stable.featureCount) * 100)
        : 0,
    weightedFull:
      full.featureCount > 0 && full.totalPossibleWeight > 0
        ? Math.round((full.weightedPoints / full.totalPossibleWeight) * 100)
        : 0,
    unweightedFull:
      full.featureCount > 0
        ? Math.round((full.unweightedPoints / full.featureCount) * 100)
        : 0
  }
}

/**
 * Calculate browser score based on feature support
 */
export function useBrowserScore() {
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

  const shouldExcludeFromPrimaryScore = (support: BrowserSupport): boolean => {
    if (!support.status) return false
    return (
      support.status.experimental
      || !support.status.standard_track
      || support.status.deprecated
    )
  }

  const calculateBrowserScore = (
    browserId: BrowserId,
    featureGroups: PWAFeatureGroup[],
    getSupportFn: (
      featureId: string,
      canIUseId?: string,
      mdnBcdPath?: string
    ) => BrowserSupport
  ): BrowserScoreResult => {
    const overallStable = createAccumulator()
    const overallFull = createAccumulator()
    const groupScores: Record<string, BrowserScores> = {}

    for (const group of featureGroups) {
      const groupStable = createAccumulator()
      const groupFull = createAccumulator()

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

            addToAccumulator(overallFull, supportLevel, featureWeight)
            addToAccumulator(groupFull, supportLevel, featureWeight)

            if (!excludeFromPrimary) {
              addToAccumulator(overallStable, supportLevel, featureWeight)
              addToAccumulator(groupStable, supportLevel, featureWeight)
            }
          }
        }
      }

      groupScores[group.id] = calculatePercentages(groupStable, groupFull)
    }

    return {
      ...calculatePercentages(overallStable, overallFull),
      groupScores
    }
  }

  const calculateScoreSeries = (
    browserId: BrowserId,
    featureGroups: PWAFeatureGroup[],
    releases: Array<{ version: string, releaseDate: string | null }>,
    getSupportAt: (
      version: string
    ) => (featureId: string, canIUseId?: string, mdnBcdPath?: string) => BrowserSupport
  ): ScorePoint[] =>
    releases.map(r => ({
      version: r.version,
      releaseDate: r.releaseDate,
      weighted: calculateBrowserScore(browserId, featureGroups, getSupportAt(r.version)).weighted
    }))

  return {
    calculateBrowserScore,
    calculateScoreSeries
  }
}
