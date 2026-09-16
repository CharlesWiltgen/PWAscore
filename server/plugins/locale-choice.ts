import { pickLocaleFromAcceptLanguage } from '../utils/locale-choice'

/**
 * Root-path locale decision (replaces `detectBrowserLanguage.redirectOn: 'root'`).
 *
 * Only `/` is redirected, and only when the visitor has made no explicit choice:
 * the switcher records one in `public.langChoiceCookie` (see AppHeader.vue). That
 * keeps a French-language visitor landing on French, while making it impossible
 * for a stray `/fr` load (another tab, a link, a prefetched payload, a crawler) to
 * change what `/` serves — which the module's own cookie silently did.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => {
    if (event.method !== 'GET') return

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
    if (target === defaultLocale) return

    return sendRedirect(event, `/${target}${url.search}`, 302)
  })
})
