/**
 * Default-suite network guard (PWAscore-3o4).
 *
 * Unit tests must be deterministic and offline: any un-stubbed fetch fails
 * loudly instead of silently hitting live caniuse/BCD. Live-data coverage is
 * opt-in via RUN_INTEGRATION=1 (see canIUseLoader.integration.test.ts).
 */
import { vi } from 'vitest'

// Root-level setup files sit outside the nuxt tsconfig projects, so avoid
// @types/node-dependent imports; read the flag off globalThis instead.
const runIntegration = (globalThis as {
  process?: { env: Record<string, string | undefined> }
}).process?.env?.RUN_INTEGRATION

if (runIntegration !== '1') {
  vi.stubGlobal('fetch', (input: unknown) =>
    Promise.reject(
      new Error(
        `Unexpected network fetch in default test suite: ${String(input)}. `
        + 'Stub fetch, or run live checks with RUN_INTEGRATION=1'
      )
    )
  )
}
