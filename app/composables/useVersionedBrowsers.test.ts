import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import { getBrowserReleases } from '../utils/canIUseLoader'
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

  test('defaultVersionFor maps a browserId to its brand current version', async () => {
    const vb = useVersionedBrowsers(GROUPS)
    await vb.init(['safari_ios'])
    expect(vb.defaultVersionFor('safari_ios')).toBe('26.4')
    expect(vb.defaultVersionFor('chrome_android')).toBe('146')
  })
})
