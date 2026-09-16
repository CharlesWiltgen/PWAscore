// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // @nuxt/content is used only for the <MDC> component + code highlighting —
  // pages render bundled i18n MDC strings, no content collections exist
  // (PWAscore-uof). Expected build-time noise: the module's "no content
  // configuration" and "switching to D1 binding DB" warnings are module-level
  // on the cloudflare-module preset; nothing queries content at runtime, so no
  // D1 binding is needed.
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', '@nuxt/content', '@nuxtjs/i18n'],

  devtools: {
    enabled: process.env.NUXT_DEVTOOLS_ENABLED !== 'false'
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark'
  },

  mdc: {
    highlight: {
      noApiRoute: false
    }
  },

  runtimeConfig: {
    public: {
      // Cookie the language switcher writes to record an *explicit* choice;
      // read by server/plugins/locale-choice.ts for the "/" decision.
      langChoiceCookie: 'pwascore_lang'
    }
  },

  compatibilityDate: '2026-09-08',

  nitro: {
    preset: 'cloudflare-module',
    prerender: {
      routes: ['/', '/about', '/fr', '/fr/about']
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'locales',
    baseUrl: 'https://pwascore.com',
    // Off on purpose: the module mirrors the locale of every URL it serves into
    // its cookie (server-side on /fr and its payloads, client-side on hydration),
    // so any stray French URL load re-armed it and the next "/" visit redirected
    // to /fr with no user action (verified from request logs, 2026-09-16). The
    // root decision now lives in server/plugins/locale-choice.ts and honours only
    // an explicit choice, else Accept-Language.
    detectBrowserLanguage: false,
    locales: [
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
        file: 'en.json'
      },
      {
        code: 'fr',
        language: 'fr-FR',
        name: 'Français',
        file: 'fr.json'
      }
    ]
  }
})
