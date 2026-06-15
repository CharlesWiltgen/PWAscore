import { ref } from 'vue'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import type { BrowserId, BrowserSupport, FeatureInput } from './useBrowserSupport'
import { useBrowserSupport, BRAND_BY_BROWSER } from './useBrowserSupport'
import { useBrowserScore } from './useBrowserScore'
import type { BrowserScoreResult, ScorePoint } from './useBrowserScore'
import {
  getBrowserReleases,
  type BrowserRelease
} from '../utils/canIUseLoader'
import scoreHistoryData from '../data/score-history.json'

// Build-time precomputed score-over-time series (see scripts/generate-score-history.ts).
// A time-based 5-year window per browser, anchored at the newest release across
// browsers so the sparklines are comparable across release cadences.
type ScoreHistory = {
  domainStart: string
  domainEnd: string
  series: Partial<Record<BrowserId, ScorePoint[]>>
}
const scoreHistory = scoreHistoryData as ScoreHistory

function flattenFeatures(groups: PWAFeatureGroup[]): FeatureInput[] {
  const out: FeatureInput[] = []
  for (const group of groups) {
    for (const category of group.categories) {
      for (const feature of category.features) {
        out.push({
          id: feature.id,
          canIUseId: feature.canIUseId,
          mdnBcdPath: feature.mdnBcdPath,
          status: feature.status
        })
      }
    }
  }
  return out
}

export function useVersionedBrowsers(featureGroups: PWAFeatureGroup[]) {
  const {
    getSupportAt,
    loadSupportAtVersion,
    loadMultipleSupport,
    loadBrowserVersions,
    browserVersions
  } = useBrowserSupport()
  const { calculateBrowserScore } = useBrowserScore()

  const features = flattenFeatures(featureGroups)

  const selectedVersion = ref<Partial<Record<BrowserId, string>>>({})
  const releasesByBrowser = ref<Partial<Record<BrowserId, BrowserRelease[]>>>({})
  const isVersionLoading = ref<Partial<Record<BrowserId, boolean>>>({})

  const defaultVersionFor = (browserId: BrowserId): string =>
    browserVersions.value[BRAND_BY_BROWSER[browserId]]

  const init = async (browserIds: BrowserId[]): Promise<void> => {
    await loadBrowserVersions()
    await loadMultipleSupport(features)
    const results = await Promise.all(
      browserIds.map(async (id) => {
        const current = defaultVersionFor(id)
        return { id, current, releases: await getBrowserReleases(id, current) }
      })
    )
    selectedVersion.value = Object.fromEntries(
      results.map(r => [r.id, r.current])
    ) as Partial<Record<BrowserId, string>>
    releasesByBrowser.value = Object.fromEntries(
      results.map(r => [r.id, r.releases])
    ) as Partial<Record<BrowserId, BrowserRelease[]>>
  }

  const isDefaultVersion = (browserId: BrowserId, version: string | undefined): boolean =>
    !version || version === defaultVersionFor(browserId)

  const columnSupport = (
    browserId: BrowserId,
    featureId: string,
    canIUseId?: string,
    mdnBcdPath?: string
  ): BrowserSupport => {
    const version = selectedVersion.value[browserId]
    return getSupportAt({
      browserId,
      featureId,
      canIUseId,
      mdnBcdPath,
      version: isDefaultVersion(browserId, version) ? undefined : version
    })
  }

  // Monotonic per-browser request token. setVersion commits its result only if
  // it is still the latest request for that browser, so a slow earlier load can
  // never overwrite a faster later selection (last-resolving-wins race).
  const versionRequest = new Map<BrowserId, number>()
  const nextRequest = (browserId: BrowserId): number => {
    const token = (versionRequest.get(browserId) ?? 0) + 1
    versionRequest.set(browserId, token)
    return token
  }
  const isLatestRequest = (browserId: BrowserId, token: number): boolean =>
    versionRequest.get(browserId) === token

  // Load-then-swap: for a non-default version, fetch its support BEFORE
  // mutating selectedVersion, so the column keeps rendering the previous
  // (cached) version until the new one is ready — no flash of unknown rows.
  const setVersion = async (browserId: BrowserId, version: string): Promise<void> => {
    const token = nextRequest(browserId)
    if (isDefaultVersion(browserId, version)) {
      // Default needs no load; it becomes the latest request immediately and
      // clears any spinner a superseded non-default load may have left on.
      selectedVersion.value = { ...selectedVersion.value, [browserId]: version }
      isVersionLoading.value = { ...isVersionLoading.value, [browserId]: false }
      return
    }
    isVersionLoading.value = { ...isVersionLoading.value, [browserId]: true }
    try {
      await loadSupportAtVersion(features, browserId, version)
      if (isLatestRequest(browserId, token)) {
        selectedVersion.value = { ...selectedVersion.value, [browserId]: version }
      }
    } finally {
      if (isLatestRequest(browserId, token)) {
        isVersionLoading.value = { ...isVersionLoading.value, [browserId]: false }
      }
    }
  }

  const columnScores = (browserId: BrowserId): BrowserScoreResult =>
    calculateBrowserScore(browserId, featureGroups, (featureId, canIUseId, mdnBcdPath) =>
      columnSupport(browserId, featureId, canIUseId, mdnBcdPath)
    )

  // Score-over-time series is precomputed at build time (no runtime fan-out).
  const sparklineSeries = (browserId: BrowserId): ScorePoint[] =>
    scoreHistory.series[browserId] ?? []

  // Shared date domain for the x-axis so every column's sparkline is on the same
  // 5-year timeline regardless of how many releases each browser shipped.
  const sparklineDomain = {
    start: scoreHistory.domainStart,
    end: scoreHistory.domainEnd
  }

  return {
    selectedVersion,
    releasesByBrowser,
    isVersionLoading,
    defaultVersionFor,
    init,
    columnSupport,
    setVersion,
    columnScores,
    sparklineSeries,
    sparklineDomain
  }
}
