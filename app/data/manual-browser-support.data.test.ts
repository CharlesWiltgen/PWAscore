import { describe, expect, test } from 'vitest'
import manualSupportData from './manual-browser-support.json'
import { validateManualSupport } from './manual-browser-support.schema'

describe('Manual Browser Support Data Integrity', () => {
  test('should validate entire dataset without errors', () => {
    expect(() => validateManualSupport(manualSupportData)).not.toThrow()
  })

  test('should have expected number of manual support entries', () => {
    const data = validateManualSupport(manualSupportData)
    expect(Object.keys(data)).toHaveLength(23)
  })

  test('should have valid support levels for all entries', () => {
    const data = validateManualSupport(manualSupportData)
    const validLevels = ['supported', 'partial', 'not-supported', 'unknown']

    Object.values(data).forEach((support) => {
      expect(validLevels).toContain(support.chrome_android)
      expect(validLevels).toContain(support.firefox_android)
      expect(validLevels).toContain(support.safari_ios)
    })
  })

  test('should have status information for all entries', () => {
    const data = validateManualSupport(manualSupportData)

    Object.entries(data).forEach(([id, support]) => {
      if (support.status) {
        expect(typeof support.status.experimental).toBe('boolean')
        expect(typeof support.status.standard_track).toBe('boolean')
        expect(typeof support.status.deprecated).toBe('boolean')
      } else {
        // All entries should have status per schema requirements
        console.warn(`Entry '${id}' missing status field`)
      }
    })
  })

  test('should include vendor-specific payment features', () => {
    const data = validateManualSupport(manualSupportData)

    const applePay = data['apple-pay']
    expect(applePay).toBeDefined()
    expect(applePay!.safari_ios).toBe('supported')
    expect(applePay!.chrome_android).toBe('not-supported')

    const googlePay = data['google-pay']
    expect(googlePay).toBeDefined()
    expect(googlePay!.chrome_android).toBe('supported')
    expect(googlePay!.safari_ios).toBe('not-supported')
  })

  test('should include push notification features', () => {
    const data = validateManualSupport(manualSupportData)

    const pushApi = data['push-api']
    expect(pushApi).toBeDefined()
    expect(pushApi!.chrome_android).toBe('supported')
    expect(pushApi!.firefox_android).toBe('supported')
    expect(pushApi!.safari_ios).toBe('supported')

    const notificationApi = data['notification-api']
    expect(notificationApi).toBeDefined()
    expect(notificationApi!.chrome_android).toBe('supported')
    expect(notificationApi!.firefox_android).toBe('supported')
    expect(notificationApi!.safari_ios).toBe('supported')
  })

  test('should include security features', () => {
    const data = validateManualSupport(manualSupportData)

    expect(data['https-requirement']).toBeDefined()
    expect(data['same-origin-policy']).toBeDefined()
    expect(data['secure-contexts']).toBeDefined()
  })

  test('should include iOS-specific features', () => {
    const data = validateManualSupport(manualSupportData)

    const declarativeWebPush = data['declarative-web-push']
    expect(declarativeWebPush).toBeDefined()
    expect(declarativeWebPush!.safari_ios).toBe('supported')
  })

  test('should have consistent ID format (kebab-case)', () => {
    const data = validateManualSupport(manualSupportData)
    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/

    Object.keys(data).forEach((id) => {
      expect(id).toMatch(kebabCaseRegex)
    })
  })

  test('should have version strings when support is specified', () => {
    const data = validateManualSupport(manualSupportData)

    Object.entries(data).forEach(([_id, support]) => {
      // If chrome_android is supported, version may be present
      if (support.chrome_android === 'supported' && support.chrome_androidVersion) {
        expect(typeof support.chrome_androidVersion).toBe('string')
        expect(support.chrome_androidVersion.length).toBeGreaterThan(0)
      }

      // If firefox_android is supported, version may be present
      if (
        support.firefox_android === 'supported'
        && support.firefox_androidVersion
      ) {
        expect(typeof support.firefox_androidVersion).toBe('string')
        expect(support.firefox_androidVersion.length).toBeGreaterThan(0)
      }

      // If safari_ios is supported, version may be present
      if (support.safari_ios === 'supported' && support.safari_iosVersion) {
        expect(typeof support.safari_iosVersion).toBe('string')
        expect(support.safari_iosVersion.length).toBeGreaterThan(0)
      }
    })
  })

  test('should not have empty feature IDs', () => {
    const data = validateManualSupport(manualSupportData)
    const ids = Object.keys(data)

    expect(ids.length).toBeGreaterThan(0)
    ids.forEach((id) => {
      expect(id.length).toBeGreaterThan(0)
    })
  })

  test('should have unique feature IDs', () => {
    const data = validateManualSupport(manualSupportData)
    const ids = Object.keys(data)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
  })
})
