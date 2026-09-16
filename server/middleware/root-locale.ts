import { pickLocaleFromAcceptLanguage } from '../utils/locale-choice'

/**
 * Root-path locale decision (replaces `detectBrowserLanguage.redirectOn: 'root'`).
 *
 * Only `/` is redirected, and only when the visitor has made no explicit choice:
 * the switcher records one in `public.langChoiceCookie` (see AppHeader.vue) and a
 * stale `i18n_redirected` from older builds is ignored.
 *
 * Routing note: production serves `.output/public` from the assets binding before
 * the Worker runs, so this handler only sees `/` when the asset routing sends it
 * here (`run_worker_first = ["/"]` in wrangler.toml). When it does run and no
 * redirect applies, it answers with the prerendered `index.html` through the
 * ASSETS binding, so making the root reachable by the Worker does not turn the
 * landing page into a per-request SSR render. Methods other than GET/HEAD return
 * before that delegation, so a POST to `/` gets a rendered page rather than the
 * asset layer's method handling.
 *
 * Cache invariant: the 200/304 for `/` carries the asset store's own headers and
 * has no `Vary` of its own (a returned response's headers are immutable here, and
 * rebuilding one risks an encoding mismatch). That is safe only while `/` stays
 * `max-age=0, must-revalidate`: any future positive freshness for `/` must also
 * make the response vary on `Accept-Language, Cookie`, or the root's locale
 * decision goes sticky. The 302 below sets both headers itself.
 */
export default defineEventHandler(async (event) => {
  // HEAD is treated like GET so monitors and link checkers do not trigger a render.
  if (event.method !== 'GET' && event.method !== 'HEAD') return

  const url = getRequestURL(event)
  if (url.pathname !== '/') return

  const config = useRuntimeConfig(event).public
  const i18nConfig = config.i18n
  // Runtime-config values are untyped JSON, so narrow instead of asserting.
  const localeCodes: string[] = []
  for (const locale of i18nConfig?.locales ?? []) {
    if (
      locale
      && typeof locale === 'object'
      && 'code' in locale
      && typeof locale.code === 'string'
    ) {
      localeCodes.push(locale.code)
    }
  }
  const defaultLocale = i18nConfig?.defaultLocale || 'en'

  const choice = getCookie(event, String(config.langChoiceCookie))
  const target
    = choice && localeCodes.includes(choice)
      ? choice
      : pickLocaleFromAcceptLanguage(
          event.headers.get('accept-language'),
          localeCodes,
          defaultLocale
        )

  if (target !== defaultLocale) {
    const response = sendRedirect(event, `/${target}${url.search}`, 302)
    // The decision depends on request headers and the cookie, so it must never
    // be cached by an intermediary or the browser.
    setResponseHeader(event, 'Vary', 'Accept-Language, Cookie')
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return response
  }

  // No redirect: hand the request straight to the assets binding, which resolves
  // `/` to the prerendered index.html (mapping to '/index.html' ourselves gets
  // canonicalized back to '/' with a 307). One invocation, no render; dev has no
  // binding and falls through to SSR as before.
  const cloudflare = (event.context as {
    _platform?: {
      cloudflare?: {
        env?: { ASSETS?: { fetch: (request: Request) => Promise<Response> } }
        request?: Request
      }
    }
  })._platform?.cloudflare
  const assets = cloudflare?.env?.ASSETS
  if (!assets) return

  const request = cloudflare?.request ?? new Request(url.href)
  // A stale edge copy of the previous build's HTML references chunks that the
  // deploy pruned (a replaced entry chunk 404s within minutes of a deploy).
  // Delegating under a build-scoped cache key means a fresh build can never be
  // answered from the previous build's cache entry — the query is ignored for
  // path resolution and the visitor's URL stays `/`.
  const buildId = String(useRuntimeConfig(event).app?.buildId ?? '')
  const assetUrl = buildId ? new URL(request.url) : null
  assetUrl?.searchParams.set('_b', buildId)
  const response = await assets
    .fetch(assetUrl ? new Request(assetUrl.toString(), request) : request)
    .catch(() => undefined)
  // A throwing binding is a failed answer, not an exception worth a 500: fall
  // through to the app render like any other miss.
  if (!response) return
  // A conditional request the store answers with 304 is a successful answer, not
  // a miss: `Response.ok` is false for it, and dropping it would turn every
  // revalidating visit to `/` into a full SSR render — the cost this routing
  // exists to avoid. Everything else non-2xx (404/405/416) really is a miss.
  if (response.status === 304) return response
  return response.ok ? response : undefined
})
