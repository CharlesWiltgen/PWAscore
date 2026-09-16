import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environment: 'nuxt',
    // The nuxt environment's beforeAll hook boots a Nuxt instance: ~9s on a
    // loaded machine and slower on CI, against vitest's 10s default, which
    // fails the file during *collection* with "Hook timed out in 10000ms" (the
    // 14 failures seen locally while three agents were running; CI runs plain
    // `pnpm test`, so this was a latent CI flake).
    hookTimeout: 60_000,
    environmentOptions: {
      nuxt: {
        mock: {
          intersectionObserver: true,
          indexedDb: true
        }
      }
    }
  }
})
