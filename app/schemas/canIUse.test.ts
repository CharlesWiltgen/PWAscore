import { describe, expect, test } from 'vitest'
import {
  safeParseCanIUseData,
  safeParseMdnBcdFeature,
  safeParseBrowserSupport
} from './canIUse'

describe('CanIUse schema validation', () => {
  describe('safeParseCanIUseData', () => {
    test('should accept valid CanIUse data structure', () => {
      const validData = {
        agents: {
          chrome: {
            browser: 'Chrome',
            current_version: '141',
            version_list: [{ version: '141' }, { version: '140' }]
          }
        },
        data: {
          serviceworkers: {
            stats: {
              chrome: {
                141: 'y'
              }
            }
          }
        }
      }

      const result = safeParseCanIUseData(validData)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.agents?.chrome?.browser).toBe('Chrome')
    })

    test('should reject CanIUse data missing required fields', () => {
      const invalidData = {
        agents: {} // Missing agent data
        // Missing data field entirely
      }

      const result = safeParseCanIUseData(invalidData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('validation failed')
    })

    test('should reject CanIUse data with incorrect agent structure', () => {
      const invalidData = {
        agents: {
          chrome: {
            // Missing browser field
            version_list: 'not-an-array' // Should be array
          }
        },
        data: {}
      }

      const result = safeParseCanIUseData(invalidData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('should accept CanIUse data with optional fields', () => {
      const validData = {
        agents: {
          chrome: {
            browser: 'Chrome',
            // current_version is optional
            version_list: [
              {
                version: '141',
                global_usage: 0.5, // Optional field
                release_date: 1234567890 // Optional field
              }
            ]
          }
        },
        data: {}
      }

      const result = safeParseCanIUseData(validData)

      expect(result.success).toBe(true)
    })
  })

  describe('safeParseMdnBcdFeature', () => {
    test('should accept valid MDN BCD feature structure', () => {
      const validFeature = {
        __compat: {
          mdn_url: 'https://developer.mozilla.org/docs/Web/API/Feature',
          support: {
            chrome_android: {
              version_added: '83'
            },
            firefox_android: {
              version_added: false
            },
            safari_ios: {
              version_added: '16.4',
              partial_implementation: true
            }
          },
          status: {
            experimental: false,
            standard_track: true,
            deprecated: false
          }
        }
      }

      const result = safeParseMdnBcdFeature(validFeature)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    test('should accept MDN BCD feature with array of support objects', () => {
      const validFeature = {
        __compat: {
          support: {
            chrome_android: [
              { version_added: '83' },
              { version_added: '80', version_removed: '83' }
            ]
          }
        }
      }

      const result = safeParseMdnBcdFeature(validFeature)

      expect(result.success).toBe(true)
    })

    test('should accept MDN BCD feature with flags', () => {
      const validFeature = {
        __compat: {
          support: {
            chrome_android: {
              version_added: '90',
              flags: [
                {
                  name: 'Experimental Web Platform Features',
                  type: 'preference',
                  value_to_set: 'enabled'
                }
              ]
            }
          }
        }
      }

      const result = safeParseMdnBcdFeature(validFeature)

      expect(result.success).toBe(true)
    })

    test('should accept MDN BCD feature without __compat', () => {
      // Some features are just containers with nested features
      const validFeature = {
        someNestedFeature: {
          __compat: {
            support: {}
          }
        }
      }

      const result = safeParseMdnBcdFeature(validFeature)

      expect(result.success).toBe(true)
    })

    test('should accept MDN BCD feature with null version_added', () => {
      const validFeature = {
        __compat: {
          support: {
            chrome_android: {
              version_added: null // Unknown version
            }
          }
        }
      }

      const result = safeParseMdnBcdFeature(validFeature)

      expect(result.success).toBe(true)
    })
  })

  describe('safeParseBrowserSupport', () => {
    test('should accept valid browser support structure', () => {
      const validSupport = {
        chrome_android: 'supported',
        firefox_android: 'partial',
        safari_ios: 'not-supported',
        status: {
          experimental: false,
          standard_track: true,
          deprecated: false
        }
      }

      const result = safeParseBrowserSupport(validSupport)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.chrome_android).toBe('supported')
    })

    test('should accept browser support with version strings', () => {
      const validSupport = {
        chrome_android: 'supported',
        firefox_android: 'not-supported',
        safari_ios: 'supported',
        chrome_androidVersion: '83',
        firefox_androidVersion: '80',
        safari_iosVersion: '16.4'
      }

      const result = safeParseBrowserSupport(validSupport)

      expect(result.success).toBe(true)
      expect(result.data?.chrome_androidVersion).toBe('83')
    })

    test('should reject browser support with invalid support level', () => {
      const invalidSupport = {
        chrome_android: 'maybe-supported', // Invalid level
        firefox_android: 'not-supported',
        safari_ios: 'unknown'
      }

      const result = safeParseBrowserSupport(invalidSupport)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('should reject browser support missing required fields', () => {
      const invalidSupport = {
        chrome_android: 'supported'
        // Missing firefox_android and safari_ios
      }

      const result = safeParseBrowserSupport(invalidSupport)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('should accept browser support without optional status', () => {
      const validSupport = {
        chrome_android: 'supported',
        firefox_android: 'supported',
        safari_ios: 'supported'
        // status is optional
      }

      const result = safeParseBrowserSupport(validSupport)

      expect(result.success).toBe(true)
    })

    test('should reject browser support with invalid status structure', () => {
      const invalidSupport = {
        chrome_android: 'supported',
        firefox_android: 'supported',
        safari_ios: 'supported',
        status: {
          experimental: 'yes', // Should be boolean
          standard_track: true,
          deprecated: false
        }
      }

      const result = safeParseBrowserSupport(invalidSupport)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
