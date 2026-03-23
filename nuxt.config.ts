// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
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

  compatibilityDate: '2025-01-15',

  nitro: {
    preset: 'cloudflare-module',
    prerender: {
      routes: ['/', '/fr', '/fr/about']
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
