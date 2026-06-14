import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import { getBrowserReleases, getMdnBcdSupport } from '../utils/canIUseLoader'
import { useVersionedBrowsers } from './useVersionedBrowsers'

vi.mock('../utils/canIUseLoader', () => ({
  getBrowserVersions: vi.fn(async () => ({ chrome: '146', firefox: '148', safari: '26.4' })),
  getBrowserReleases: vi.fn(async () => [
    { version: '18.5', releaseDate: '2025-05-12', channel: 'released' },
    { version: '26.4', releaseDate: '2026-03-24', channel: 'current' },
    { version: '26.5', releaseDate: null, channel: 'beta' }
  ]),
  getCanIUseSupport: vi.fn(async () => ({
    chrome_android: 'unknown', firefox_android: 'unknown', safari_ios: 'unknown',
    chrome: 'unknown', firefox: 'unknown', safari: 'unknown'
  })),
  getMdnBcdSupport: vi.fn(async (_path: string, versions: { safari: string }) => ({
    chrome_android: 'unknown', firefox_android: 'unknown',
    safari_ios: versions.safari === '18.5' ? 'not-supported' : 'supported',
    chrome: 'unknown', firefox: 'unknown', safari: 'unknown'
  })),
  getMdnUrlFromBcd: vi.fn(async () => undefined)
}))

const GROUPS: PWAFeatureGroup[] = [
  {
    id: 'g', name: 'G', description: 'G',
    categories: [{
      id: 'c', name: 'C', description: 'C',
      features: [{
        id: 'badging', name: 'Badging', description: 'Badging',
        mdnBcdPath: 'api.Navigator.setAppBadge',
        status: { experimental: false, standard_track: true, deprecated: false }
      }]
    }]
  }
]

describe('useVersionedBrowsers', () => {
  beforeEach(() => vi.clearAllMocks())

  test('init loads current versions and per-browser releases, defaulting selection to current', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])

    expect(vb.selectedVersion.value.safari_ios).toBe('26.4')
    expect(vb.releasesByBrowser.value.safari_ios).toEqual([
      { version: '18.5', releaseDate: '2025-05-12', channel: 'released' },
      { version: '26.4', releaseDate: '2026-03-24', channel: 'current' },
      { version: '26.5', releaseDate: null, channel: 'beta' }
    ])
    expect(vi.mocked(getBrowserReleases)).toHaveBeenCalledWith('safari_ios', '26.4')
  })

  test('init populates releases for ALL requested browsers (no last-writer-wins race)', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios', 'chrome_android', 'firefox_android'])

    // Every requested browser must have BOTH a selected version and a releases list.
    for (const id of ['safari_ios', 'chrome_android', 'firefox_android'] as const) {
      expect(vb.selectedVersion.value[id]).toBeTruthy()
      expect((vb.releasesByBrowser.value[id] ?? []).length).toBeGreaterThan(0)
    }
  })

  test('defaultVersionFor maps a browserId to its brand current version', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    expect(vb.defaultVersionFor('safari_ios')).toBe('26.4')
    expect(vb.defaultVersionFor('chrome_android')).toBe('146')
  })
})

describe('useVersionedBrowsers — version-aware support and scores', () => {
  beforeEach(() => vi.clearAllMocks())

  test('columnSupport at the default version uses the current path (no extra load)', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    expect(vb.columnSupport('safari_ios', 'badging', undefined, 'api.Navigator.setAppBadge').safari_ios).toBe('supported')
  })

  test('setVersion loads support at the chosen version and toggles isVersionLoading', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])

    const promise = vb.setVersion('safari_ios', '18.5')
    expect(vb.isVersionLoading.value.safari_ios).toBe(true)
    await promise
    expect(vb.isVersionLoading.value.safari_ios).toBe(false)

    expect(vb.selectedVersion.value.safari_ios).toBe('18.5')
    expect(vb.columnSupport('safari_ios', 'badging', undefined, 'api.Navigator.setAppBadge').safari_ios).toBe('not-supported')
  })

  test('setVersion back to the default does not trigger another load', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    vi.clearAllMocks()
    await vb.setVersion('safari_ios', '26.4') // the default
    expect(vi.mocked(getMdnBcdSupport)).not.toHaveBeenCalled()
  })

  test('columnScores computes the weighted score for the column at its selected version', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    expect(vb.columnScores('safari_ios').weighted).toBe(100) // 26.4 -> supported
    await vb.setVersion('safari_ios', '18.5')
    expect(vb.columnScores('safari_ios').weighted).toBe(0) // 18.5 -> not-supported
  })

  test('concurrent setVersion: a slow earlier request never overwrites a later selection', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])

    // Replace the immediate mock with deferred promises we resolve by hand,
    // keyed by the pinned safari version, so we can control resolution order.
    // vi.clearAllMocks() (beforeEach) clears calls but NOT implementations, so
    // we capture and restore the default to avoid leaking into later tests.
    const defaultImpl = vi.mocked(getMdnBcdSupport).getMockImplementation()
    const resolvers: Record<string, () => void> = {}
    vi.mocked(getMdnBcdSupport).mockImplementation(
      (_path: string, versions: { safari: string }) =>
        new Promise((resolve) => {
          resolvers[versions.safari] = () =>
            resolve({
              chrome_android: 'unknown', firefox_android: 'unknown',
              safari_ios: versions.safari === '18.5' ? 'not-supported' : 'supported',
              chrome: 'unknown', firefox: 'unknown', safari: 'unknown'
            })
        })
    )

    try {
      const slow = vb.setVersion('safari_ios', '18.5') // earlier request
      const fast = vb.setVersion('safari_ios', '26.5') // later request (supersedes)
      await vi.waitFor(() => {
        expect(resolvers['18.5']).toBeDefined()
        expect(resolvers['26.5']).toBeDefined()
      })

      // Resolve the LATER request first, then the earlier one.
      resolvers['26.5']!()
      resolvers['18.5']!()
      await Promise.all([slow, fast])

      // The latest selection (26.5) must win, even though 18.5 resolved last.
      expect(vb.selectedVersion.value.safari_ios).toBe('26.5')
      expect(vb.isVersionLoading.value.safari_ios).toBe(false)
    } finally {
      vi.mocked(getMdnBcdSupport).mockImplementation(defaultImpl!)
    }
  })

  test('setVersion keeps the previous score until the new version load resolves (no flash)', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    expect(vb.columnScores('safari_ios').weighted).toBe(100) // default 26.4 -> supported

    const promise = vb.setVersion('safari_ios', '18.5')
    // Before the load resolves: still the old version's score, NOT unknown/0.
    expect(vb.columnScores('safari_ios').weighted).toBe(100)
    expect(vb.selectedVersion.value.safari_ios).toBe('26.4')

    await promise
    expect(vb.selectedVersion.value.safari_ios).toBe('18.5')
    expect(vb.columnScores('safari_ios').weighted).toBe(0) // now 18.5 -> not-supported
  })
})

describe('useVersionedBrowsers — sparkline series', () => {
  beforeEach(() => vi.clearAllMocks())

  test('loadSparkline loads support at every non-default release version (once), then sparklineSeries returns a point per release', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    vi.clearAllMocks() // isolate loadSparkline's calls from init's current-version load

    await vb.loadSparkline('safari_ios')
    // 18.5 and 26.5 are both non-default -> each loaded at its own version
    expect(vi.mocked(getMdnBcdSupport)).toHaveBeenCalledTimes(2)

    const series = vb.sparklineSeries('safari_ios')
    expect(series).toEqual([
      { version: '18.5', releaseDate: '2025-05-12', weighted: 0 },
      { version: '26.4', releaseDate: '2026-03-24', weighted: 100 },
      { version: '26.5', releaseDate: null, weighted: 100 }
    ])
  })

  test('loadSparkline is memoized — a second call does not reload', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    await vb.loadSparkline('safari_ios')
    vi.clearAllMocks()
    await vb.loadSparkline('safari_ios')
    expect(vi.mocked(getMdnBcdSupport)).not.toHaveBeenCalled()
  })
})
