import { ref } from 'vue'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import type { BrowserId, BrowserSupport } from './useBrowserSupport'
import { useBrowserSupport, BRAND_BY_BROWSER } from './useBrowserSupport'
import { useBrowserScore } from './useBrowserScore'
import type { BrowserScoreResult, ScorePoint } from './useBrowserScore'
import {
  getBrowserReleases,
  type BrowserRelease
} from '../utils/canIUseLoader'

type FeatureInput = {
  id: string
  canIUseId?: string
  mdnBcdPath?: string
  status?: { experimental: boolean, standard_track: boolean, deprecated: boolean }
}

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
  const { calculateBrowserScore, calculateScoreSeries } = useBrowserScore()

  const features = flattenFeatures(featureGroups)

  const selectedVersion = ref<Partial<Record<BrowserId, string>>>({})
  const releasesByBrowser = ref<Partial<Record<BrowserId, BrowserRelease[]>>>({})
  const isVersionLoading = ref<Partial<Record<BrowserId, boolean>>>({})
  const sparklineLoaded = ref<Set<BrowserId>>(new Set())

  const defaultVersionFor = (browserId: BrowserId): string =>
    browserVersions.value[BRAND_BY_BROWSER[browserId]]

  const init = async (browserIds: BrowserId[]): Promise<void> => {
    await loadBrowserVersions()
    await loadMultipleSupport(features)
    await Promise.all(
      browserIds.map(async (id) => {
        const current = defaultVersionFor(id)
        selectedVersion.value = { ...selectedVersion.value, [id]: current }
        releasesByBrowser.value = {
          ...releasesByBrowser.value,
          [id]: await getBrowserReleases(id, current)
        }
      })
    )
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
    return getSupportAt(
      browserId,
      featureId,
      canIUseId,
      mdnBcdPath,
      isDefaultVersion(browserId, version) ? undefined : version
    )
  }

  // Load-then-swap: for a non-default version, fetch its support BEFORE
  // mutating selectedVersion, so the column keeps rendering the previous
  // (cached) version until the new one is ready — no flash of unknown rows.
  const setVersion = async (browserId: BrowserId, version: string): Promise<void> => {
    if (isDefaultVersion(browserId, version)) {
      selectedVersion.value = { ...selectedVersion.value, [browserId]: version }
      return
    }
    isVersionLoading.value = { ...isVersionLoading.value, [browserId]: true }
    try {
      await loadSupportAtVersion(features, browserId, version)
      selectedVersion.value = { ...selectedVersion.value, [browserId]: version }
    } finally {
      isVersionLoading.value = { ...isVersionLoading.value, [browserId]: false }
    }
  }

  const columnScores = (browserId: BrowserId): BrowserScoreResult =>
    calculateBrowserScore(browserId, featureGroups, (featureId, canIUseId, mdnBcdPath) =>
      columnSupport(browserId, featureId, canIUseId, mdnBcdPath)
    )

  const loadSparkline = async (browserId: BrowserId): Promise<void> => {
    if (sparklineLoaded.value.has(browserId)) return
    const releases = releasesByBrowser.value[browserId] ?? []
    await Promise.all(
      releases
        .filter(r => !isDefaultVersion(browserId, r.version))
        .map(r => loadSupportAtVersion(features, browserId, r.version))
    )
    sparklineLoaded.value = new Set([...sparklineLoaded.value, browserId])
  }

  const sparklineSeries = (browserId: BrowserId): ScorePoint[] => {
    const releases = releasesByBrowser.value[browserId] ?? []
    return calculateScoreSeries(
      browserId,
      featureGroups,
      releases.map(r => ({ version: r.version, releaseDate: r.releaseDate })),
      version => (featureId, canIUseId, mdnBcdPath) =>
        getSupportAt(
          browserId,
          featureId,
          canIUseId,
          mdnBcdPath,
          isDefaultVersion(browserId, version) ? undefined : version
        )
    )
  }

  return {
    selectedVersion,
    releasesByBrowser,
    isVersionLoading,
    defaultVersionFor,
    init,
    getSupportAt,
    loadSupportAtVersion,
    calculateBrowserScore,
    calculateScoreSeries,
    features,
    columnSupport,
    setVersion,
    columnScores,
    loadSparkline,
    sparklineSeries
  }
}
