import { describe, expect, test } from 'vitest'
import { usePWAFeatures } from '../composables/usePWAFeatures'

const CANIUSE_URL
  = 'https://raw.githubusercontent.com/Fyrd/caniuse/refs/heads/main/fulldata-json/data-2.0.json'

// Special cases that are handled in code (see canIUseLoader.ts:12)
const UNIVERSALLY_SUPPORTED_FEATURES = ['web-app-manifest']

describe('canIUseId integration', () => {
  test(
    'all canIUseIds in pwa-features.json should be valid',
    { timeout: 30000 },
    async () => {
      // Fetch CanIUse data from GitHub
      const response = await fetch(CANIUSE_URL)
      expect(response.ok).toBe(true)

      const canIUseData = await response.json()
      expect(canIUseData).toHaveProperty('data')

      // Extract all canIUseId values from pwa-features.json
      const { getAllFeatures } = usePWAFeatures()
      const allFeatures = getAllFeatures()

      const canIUseIds = new Set<string>()
      allFeatures.forEach((feature) => {
        if (feature.canIUseId) {
          canIUseIds.add(feature.canIUseId)
        }
      })

      expect(canIUseIds.size).toBeGreaterThan(0)

      // Validate each ID
      const invalidIds: string[] = []
      const validIds: string[] = []
      const specialCaseIds: string[] = []

      for (const id of canIUseIds) {
        if (UNIVERSALLY_SUPPORTED_FEATURES.includes(id)) {
          specialCaseIds.push(id)
        } else if (canIUseData.data[id]) {
          validIds.push(id)
        } else {
          invalidIds.push(id)
        }
      }

      // Log summary for debugging
      if (invalidIds.length > 0) {
        console.error('Invalid canIUseIds found:', invalidIds)
      }

      // All IDs must be either valid or special cases
      expect(invalidIds).toEqual([])
      expect(validIds.length + specialCaseIds.length).toBe(canIUseIds.size)
    }
  )

  test(
    'all mdnBcdPaths in pwa-features.json should be valid',
    { timeout: 30000 },
    async () => {
      // Load MDN BCD data
      const bcd = await import('@mdn/browser-compat-data')
      const bcdData = bcd.default || bcd

      // Extract all mdnBcdPath values from pwa-features.json
      const { getAllFeatures } = usePWAFeatures()
      const allFeatures = getAllFeatures()

      const mdnBcdPaths = new Set<string>()
      allFeatures.forEach((feature) => {
        if (feature.mdnBcdPath) {
          mdnBcdPaths.add(feature.mdnBcdPath)
        }
      })

      // If no mdnBcdPaths found, skip test
      if (mdnBcdPaths.size === 0) {
        console.log('No mdnBcdPaths found - skipping validation')
        return
      }

      // Validate each path
      const invalidPaths: string[] = []
      const validPaths: string[] = []

      for (const path of mdnBcdPaths) {
        // Navigate the BCD structure
        const parts = path.split('.')
        let current = bcdData as unknown as Record<string, unknown>

        let found = true
        for (const part of parts) {
          const next = current?.[part]
          if (!next) {
            found = false
            break
          }
          current = next as Record<string, unknown>
        }

        if (
          found
          && (current as Record<string, unknown> & { __compat?: unknown })
            ?.__compat
        ) {
          validPaths.push(path)
        } else {
          invalidPaths.push(path)
        }
      }

      // Log summary for debugging
      if (invalidPaths.length > 0) {
        console.error('Invalid mdnBcdPaths found:', invalidPaths)
      }

      // All paths must be valid
      expect(invalidPaths).toEqual([])
      expect(validPaths.length).toBe(mdnBcdPaths.size)
    }
  )
})
