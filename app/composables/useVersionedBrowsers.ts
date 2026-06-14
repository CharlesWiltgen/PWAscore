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
  const sparklineLoaded = new Set<BrowserId>()

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

  const loadSparkline = async (browserId: BrowserId): Promise<void> => {
    if (sparklineLoaded.has(browserId)) return
    const releases = releasesByBrowser.value[browserId] ?? []
    if (releases.length === 0) return // not initialized yet — don't memoize an empty load
    sparklineLoaded.add(browserId) // mark before await so concurrent calls don't double-fan-out
    await Promise.all(
      releases
        .filter(r => !isDefaultVersion(browserId, r.version))
        .map(r => loadSupportAtVersion(features, browserId, r.version))
    )
  }

  const sparklineSeries = (browserId: BrowserId): ScorePoint[] => {
    const releases = releasesByBrowser.value[browserId] ?? []
    return calculateScoreSeries(
      browserId,
      featureGroups,
      releases,
      version => (featureId, canIUseId, mdnBcdPath) =>
        getSupportAt({
          browserId,
          featureId,
          canIUseId,
          mdnBcdPath,
          version: isDefaultVersion(browserId, version) ? undefined : version
        })
    )
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
    loadSparkline,
    sparklineSeries
  }
}
