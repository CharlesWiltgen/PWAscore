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
    // `sonar:scan` runs this suite before SonarScanner; the scanner reads
    // `coverage/lcov.info`. `all` keeps untested source files in the report so
    // the gate cannot be satisfied by simply not importing a file.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      all: true,
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/*.d.ts']
    },
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
