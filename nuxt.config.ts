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
    detectBrowserLanguage: {
      useCookie: true,
      redirectOn: 'root'
    },
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
