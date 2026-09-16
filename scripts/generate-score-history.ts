/**
 * Build-time generator for the score-over-time sparkline.
 *
 * Emits app/data/score-history.json: a time-based (5-year) weighted-score series
 * per browser, anchored at the newest release across all browsers so the windows
 * are comparable across very different release cadences (Chrome ships ~10
 * majors/yr, Safari ~1). Reuses the exact runtime resolution (resolveSupport)
 * and scoring (calculateBrowserScore) via jiti, so precomputed scores match what
 * the app would compute live — no drift.
 *
 * Run: pnpm generate-score-history   (re-run after pnpm update-caniuse)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getBrowserVersions,
  getBrowserReleaseDates,
  windowMajorLaunchesByDate,
  compareVersions,
  type DatedRelease
} from '../app/utils/canIUseLoader'
import {
  resolveSupport,
  BRAND_BY_BROWSER,
  type BrowserId,
  type FeatureInput
} from '../app/composables/useBrowserSupport'
import { useBrowserScore } from '../app/composables/useBrowserScore'
import type { PWAFeatureGroup } from '../app/data/pwa-features.schema'
import type { ScorePoint } from '../app/composables/useBrowserScore'

const WINDOW_YEARS = 5
const BROWSERS: BrowserId[] = [
  'chrome_android',
  'firefox_android',
  'safari_ios',
  'chrome',
  'firefox',
  'safari'
]

const here = dirname(fileURLToPath(import.meta.url))
const featuresPath = join(here, '../app/data/pwa-features.json')
const outPath = join(here, '../app/data/score-history.json')

const featureGroups = JSON.parse(
  readFileSync(featuresPath, 'utf8')
) as PWAFeatureGroup[]

const features: FeatureInput[] = featureGroups.flatMap(g =>
  g.categories.flatMap(c =>
    c.features.map(f => ({
      id: f.id,
      canIUseId: f.canIUseId,
      mdnBcdPath: f.mdnBcdPath,
      status: f.status
    }))
  )
)

const supportKey = (id: string, canIUseId?: string, mdnBcdPath?: string): string =>
  `${id}|${canIUseId ?? ''}|${mdnBcdPath ?? ''}`

async function seriesForBrowser(
  browserId: BrowserId,
  launches: DatedRelease[],
  current: { chrome: string, firefox: string, safari: string },
  todayISO: string,
  domainStartISO: string,
  startVersion: string | undefined
): Promise<ScorePoint[]> {
  const { calculateBrowserScore } = useBrowserScore()
  const brand = BRAND_BY_BROWSER[browserId]

  const scoreAtVersion = async (version: string): Promise<number> => {
    const versions = { ...current, [brand]: version }
    const supportByKey = new Map<string, Awaited<ReturnType<typeof resolveSupport>>>()
    await Promise.all(
      features.map(async (f) => {
        const support = await resolveSupport(f, versions, `${f.id}@${browserId}=${version}`)
        supportByKey.set(supportKey(f.id, f.canIUseId, f.mdnBcdPath), support)
      })
    )
    return calculateBrowserScore(
      browserId,
      featureGroups,
      (id, canIUseId, mdnBcdPath) => supportByKey.get(supportKey(id, canIUseId, mdnBcdPath))!
    ).weighted
  }

  const points: ScorePoint[] = []

  // Anchor the LEFT edge: plot the version live at the window start so every
  // browser's line begins at the same x, regardless of when its first in-window
  // major happened to ship (otherwise Safari, whose majors land in September,
  // starts visibly later than Chrome/Firefox).
  if (startVersion) {
    points.push({
      version: startVersion,
      releaseDate: domainStartISO,
      weighted: await scoreAtVersion(startVersion)
    })
  }

  for (const release of launches) {
    points.push({
      version: release.version,
      releaseDate: release.releaseDate,
      weighted: await scoreAtVersion(release.version)
    })
  }

  // End every series at "now" with the current version's score so a browser that
  // shipped its latest major months ago (Safari) still reaches the right edge.
  // If the current version is already the last launch, move that point to today;
  // otherwise append it.
  const currentVersion = current[brand]
  const last = points[points.length - 1]
  if (last && last.version === currentVersion) {
    last.releaseDate = todayISO
  } else {
    points.push({
      version: currentVersion,
      releaseDate: todayISO,
      weighted: await scoreAtVersion(currentVersion)
    })
  }
  return points
}

async function main(): Promise<void> {
  const current = await getBrowserVersions()

  const releaseDates = new Map<BrowserId, DatedRelease[]>()
  for (const browserId of BROWSERS) {
    const releases = await getBrowserReleaseDates(browserId)
    // getBrowserReleaseDates swallows fetch errors and returns [], which would
    // otherwise collapse the series to its trailing point and be committed as
    // data (seen 2026-09-16: a flaky jsDelivr fetch wrote 1-point series).
    if (releases.length === 0) {
      throw new Error(
        `No release data for ${browserId} (likely a BCD fetch failure) — aborting without writing.`
      )
    }
    // getBrowserVersions swallows a caniuse failure and falls back to hardcoded
    // versions that lag these releases, which would append a trailing point
    // stepping *backwards* in version (seen 2026-09-16: a CIU failure ended the
    // chrome series 153 -> 146). getBrowserReleaseDates only returns shipped,
    // dated releases, so the newest of those is the floor the current version
    // must clear.
    const newest = releases.reduce((a, b) =>
      compareVersions(b.version, a.version) > 0 ? b : a
    )
    const brand = BRAND_BY_BROWSER[browserId]
    if (compareVersions(current[brand], newest.version) < 0) {
      throw new Error(
        `Current ${brand} version ${current[brand]} is older than the newest dated release ${newest.version} (likely a caniuse fetch failure) — aborting without writing.`
      )
    }
    releaseDates.set(browserId, releases)
  }

  // Anchor the window at "now" (not the newest release, which can be a future
  // beta) so the right edge is today and each series ends at its current version.
  const anchorDate = new Date()
  const todayISO = anchorDate.toISOString().slice(0, 10)
  const domainStart = new Date(anchorDate)
  domainStart.setFullYear(domainStart.getFullYear() - WINDOW_YEARS)
  const domainStartISO = domainStart.toISOString().slice(0, 10)
  const domainStartMs = domainStart.getTime()

  // The version live at the window start (latest release on or before domainStart).
  const versionAtOrBefore = (releases: DatedRelease[]): string | undefined => {
    let best: DatedRelease | undefined
    for (const r of releases) {
      const ms = new Date(r.releaseDate).getTime()
      if (Number.isNaN(ms) || ms > domainStartMs) continue
      if (!best || ms > new Date(best.releaseDate).getTime()) best = r
    }
    return best?.version
  }

  const series: Record<string, ScorePoint[]> = {}
  for (const browserId of BROWSERS) {
    const releases = releaseDates.get(browserId) ?? []
    const windowed = windowMajorLaunchesByDate(releases, anchorDate, WINDOW_YEARS)
    series[browserId] = await seriesForBrowser(
      browserId,
      windowed,
      current,
      todayISO,
      domainStartISO,
      versionAtOrBefore(releases)
    )
    const pts = series[browserId]
    console.log(
      `${browserId}: ${pts.length} points, score ${pts[0]?.weighted ?? '-'} -> ${pts.at(-1)?.weighted ?? '-'}`
    )
    // Fail loudly: a transient fetch failure (or a window with no launches)
    // leaves nothing but the trailing/anchor points. Never write a
    // silently-broken data file.
    if (pts.length <= 1) {
      throw new Error(
        `Score history for ${browserId} has ${pts.length} point(s) (likely a data-fetch failure) — aborting without writing.`
      )
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    years: WINDOW_YEARS,
    domainStart: domainStart.toISOString().slice(0, 10),
    domainEnd: anchorDate.toISOString().slice(0, 10),
    series
  }
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`\nWrote ${outPath}`)
}

await main()
