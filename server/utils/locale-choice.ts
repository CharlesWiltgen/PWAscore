/**
 * Locale choice for the root path.
 *
 * `detectBrowserLanguage` is deliberately off (see nuxt.config.ts): the module's
 * own cookie is written for *whatever locale a URL served* — by the server on
 * /fr and its payloads, and by the client on hydration — so fetching a French
 * URL for any reason (a tab, a link, a prefetch, a crawler) silently changed the
 * visitor's remembered locale and the next "/" load redirected there, with no
 * user action (verified from request logs, 2026-09-16).
 *
 * Instead, the cookie is only ever written by the header's language switcher —
 * an explicit choice — and root visits fall back to `Accept-Language` when there
 * is none. A stale module cookie from an older build is simply ignored.
 */

/**
 * Locale for a first visit: the highest-q `Accept-Language` entry whose primary
 * subtag matches a site locale (so `fr-CA` counts as `fr`), else the default.
 * Unparseable or unmatched headers fall back rather than guessing.
 */
export function pickLocaleFromAcceptLanguage(
  header: string | null | undefined,
  locales: readonly string[],
  fallback: string
): string {
  if (!header) return fallback

  const preferences = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.split(';')
      const q = params
        .map(p => p.trim())
        .find(p => p.startsWith('q='))
        ?.slice(2)
      const quality = Number.parseFloat(q ?? '1')
      return {
        tag: tag.trim().toLowerCase(),
        quality: Number.isNaN(quality) ? 0 : quality,
        index
      }
    })
    .filter(p => p.tag && p.tag !== '*')
    .sort((a, b) => b.quality - a.quality || a.index - b.index)

  for (const { tag } of preferences) {
    const primary = tag.split('-')[0] ?? ''
    const match = locales.find(locale => locale.toLowerCase() === primary)
    if (match) return match
  }

  return fallback
}
