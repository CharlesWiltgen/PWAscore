import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CANIUSE_URL = 'https://raw.githubusercontent.com/Fyrd/caniuse/refs/heads/main/fulldata-json/data-2.0.json'

// Special cases that are handled in code (see canIUseLoader.ts:12)
const UNIVERSALLY_SUPPORTED_FEATURES = ['web-app-manifest']

describe('canIUseId integration', () => {
  test('all canIUseIds in pwa-features.ts should be valid', { timeout: 30000 }, async () => {
    // Fetch CanIUse data from GitHub
    const response = await fetch(CANIUSE_URL)
    expect(response.ok).toBe(true)

    const canIUseData = await response.json()
    expect(canIUseData).toHaveProperty('data')

    // Extract all canIUseId values from pwa-features.ts
    const pwaFeaturesPath = join(__dirname, '../data/pwa-features.ts')
    const pwaFeaturesContent = readFileSync(pwaFeaturesPath, 'utf-8')

    // Extract canIUseId values using regex
    const canIUseIdRegex = /canIUseId:\s*['"]([^'"]+)['"]/g
    const canIUseIds = new Set<string>()
    let match

    while ((match = canIUseIdRegex.exec(pwaFeaturesContent)) !== null) {
      if (match[1]) {
        canIUseIds.add(match[1])
      }
    }

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
  })

  test('all mdnBcdPaths in pwa-features.ts should be valid', { timeout: 30000 }, async () => {
    // Load MDN BCD data
    const bcd = await import('@mdn/browser-compat-data')
    const bcdData = bcd.default || bcd

    // Extract all mdnBcdPath values from pwa-features.ts
    const pwaFeaturesPath = join(__dirname, '../data/pwa-features.ts')
    const pwaFeaturesContent = readFileSync(pwaFeaturesPath, 'utf-8')

    // Extract mdnBcdPath values using regex
    const mdnBcdPathRegex = /mdnBcdPath:\s*['"]([^'"]+)['"]/g
    const mdnBcdPaths = new Set<string>()
    let match

    while ((match = mdnBcdPathRegex.exec(pwaFeaturesContent)) !== null) {
      if (match[1]) {
        mdnBcdPaths.add(match[1])
      }
    }

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

      if (found && (current as Record<string, unknown> & { __compat?: unknown })?.__compat) {
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
  })
})
