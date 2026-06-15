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
  todayISO: string
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
    releaseDates.set(browserId, await getBrowserReleaseDates(browserId))
  }

  // Anchor the window at "now" (not the newest release, which can be a future
  // beta) so the right edge is today and each series ends at its current version.
  const anchorDate = new Date()
  const todayISO = anchorDate.toISOString().slice(0, 10)
  const domainStart = new Date(anchorDate)
  domainStart.setFullYear(domainStart.getFullYear() - WINDOW_YEARS)

  const series: Record<string, ScorePoint[]> = {}
  for (const browserId of BROWSERS) {
    const windowed = windowMajorLaunchesByDate(
      releaseDates.get(browserId) ?? [],
      anchorDate,
      WINDOW_YEARS
    )
    series[browserId] = await seriesForBrowser(browserId, windowed, current, todayISO)
    const pts = series[browserId]
    console.log(
      `${browserId}: ${pts.length} points, score ${pts[0]?.weighted ?? '-'} -> ${pts.at(-1)?.weighted ?? '-'}`
    )
    // Fail loudly: a transient fetch failure makes getBrowserReleaseDates return
    // [] -> an empty series. Never write a silently-broken data file.
    if (pts.length === 0) {
      throw new Error(
        `No score-history points for ${browserId} (likely a data-fetch failure) — aborting without writing.`
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
