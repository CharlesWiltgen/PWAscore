import { describe, expect, test } from 'vitest'
import * as v from 'valibot'
import {
  PWAFeatureSchema,
  PWAFeatureCategorySchema,
  PWAFeatureGroupSchema,
  PWAFeaturesArraySchema,
  validatePWAFeatures
} from './pwa-features.schema'

describe('PWAFeatureSchema', () => {
  test('should validate complete feature with all fields', () => {
    const validFeature = {
      id: 'test-feature',
      name: 'Test Feature',
      description: 'A test feature description',
      apiName: 'TestAPI',
      specification: 'https://example.com/spec',
      canIUseId: 'test-feature',
      mdnBcdPath: 'api.TestFeature',
      weight: 2.0,
      status: {
        experimental: true,
        standard_track: true,
        deprecated: false
      }
    }

    const result = v.safeParse(PWAFeatureSchema, validFeature)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output).toEqual(validFeature)
    }
  })

  test('should validate minimal feature with required fields only', () => {
    const minimalFeature = {
      id: 'minimal',
      name: 'Minimal Feature',
      description: 'Minimal feature description'
    }

    const result = v.safeParse(PWAFeatureSchema, minimalFeature)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output.id).toBe('minimal')
      expect(result.output.name).toBe('Minimal Feature')
      expect(result.output.apiName).toBeUndefined()
    }
  })

  test('should reject feature missing id', () => {
    const invalidFeature = {
      name: 'Invalid',
      description: 'Missing ID'
    }

    const result = v.safeParse(PWAFeatureSchema, invalidFeature)
    expect(result.success).toBe(false)
  })

  test('should reject feature missing name', () => {
    const invalidFeature = {
      id: 'invalid',
      description: 'Missing name'
    }

    const result = v.safeParse(PWAFeatureSchema, invalidFeature)
    expect(result.success).toBe(false)
  })

  test('should reject feature missing description', () => {
    const invalidFeature = {
      id: 'invalid',
      name: 'Invalid'
    }

    const result = v.safeParse(PWAFeatureSchema, invalidFeature)
    expect(result.success).toBe(false)
  })

  test('should reject feature with invalid weight type', () => {
    const invalidFeature = {
      id: 'invalid',
      name: 'Invalid',
      description: 'Invalid weight',
      weight: 'not-a-number'
    }

    const result = v.safeParse(PWAFeatureSchema, invalidFeature)
    expect(result.success).toBe(false)
  })

  test('should validate feature with partial status', () => {
    const featureWithStatus = {
      id: 'test',
      name: 'Test',
      description: 'Test description',
      status: {
        experimental: false,
        standard_track: true,
        deprecated: false
      }
    }

    const result = v.safeParse(PWAFeatureSchema, featureWithStatus)
    expect(result.success).toBe(true)
  })
})

describe('PWAFeatureCategorySchema', () => {
  test('should validate category with features', () => {
    const validCategory = {
      id: 'test-category',
      name: 'Test Category',
      description: 'A test category',
      features: [
        {
          id: 'feature-1',
          name: 'Feature 1',
          description: 'First feature'
        },
        {
          id: 'feature-2',
          name: 'Feature 2',
          description: 'Second feature',
          weight: 2.0
        }
      ]
    }

    const result = v.safeParse(PWAFeatureCategorySchema, validCategory)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output.features).toHaveLength(2)
    }
  })

  test('should validate category with empty features array', () => {
    const emptyCategory = {
      id: 'empty',
      name: 'Empty Category',
      description: 'No features',
      features: []
    }

    const result = v.safeParse(PWAFeatureCategorySchema, emptyCategory)
    expect(result.success).toBe(true)
  })

  test('should reject category missing features array', () => {
    const invalidCategory = {
      id: 'invalid',
      name: 'Invalid',
      description: 'Missing features'
    }

    const result = v.safeParse(PWAFeatureCategorySchema, invalidCategory)
    expect(result.success).toBe(false)
  })

  test('should reject category with invalid feature', () => {
    const invalidCategory = {
      id: 'invalid',
      name: 'Invalid',
      description: 'Invalid feature',
      features: [
        {
          id: 'feature-1'
          // missing name and description
        }
      ]
    }

    const result = v.safeParse(PWAFeatureCategorySchema, invalidCategory)
    expect(result.success).toBe(false)
  })
})

describe('PWAFeatureGroupSchema', () => {
  test('should validate complete group with icon', () => {
    const validGroup = {
      id: 'test-group',
      name: 'Test Group',
      description: 'A test group',
      icon: 'i-heroicons-test',
      categories: [
        {
          id: 'category-1',
          name: 'Category 1',
          description: 'First category',
          features: [
            {
              id: 'feature-1',
              name: 'Feature 1',
              description: 'First feature'
            }
          ]
        }
      ]
    }

    const result = v.safeParse(PWAFeatureGroupSchema, validGroup)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output.icon).toBe('i-heroicons-test')
      expect(result.output.categories).toHaveLength(1)
    }
  })

  test('should validate group without icon', () => {
    const groupWithoutIcon = {
      id: 'no-icon',
      name: 'No Icon Group',
      description: 'Group without icon',
      categories: [
        {
          id: 'category-1',
          name: 'Category 1',
          description: 'First category',
          features: []
        }
      ]
    }

    const result = v.safeParse(PWAFeatureGroupSchema, groupWithoutIcon)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output.icon).toBeUndefined()
    }
  })

  test('should reject group missing categories', () => {
    const invalidGroup = {
      id: 'invalid',
      name: 'Invalid',
      description: 'Missing categories'
    }

    const result = v.safeParse(PWAFeatureGroupSchema, invalidGroup)
    expect(result.success).toBe(false)
  })
})

describe('PWAFeaturesArraySchema', () => {
  test('should validate array of groups', () => {
    const validArray = [
      {
        id: 'group-1',
        name: 'Group 1',
        description: 'First group',
        categories: [
          {
            id: 'cat-1',
            name: 'Category 1',
            description: 'First category',
            features: [
              {
                id: 'feat-1',
                name: 'Feature 1',
                description: 'First feature'
              }
            ]
          }
        ]
      },
      {
        id: 'group-2',
        name: 'Group 2',
        description: 'Second group',
        icon: 'i-heroicons-test',
        categories: []
      }
    ]

    const result = v.safeParse(PWAFeaturesArraySchema, validArray)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output).toHaveLength(2)
    }
  })

  test('should validate empty array', () => {
    const emptyArray: unknown[] = []

    const result = v.safeParse(PWAFeaturesArraySchema, emptyArray)
    expect(result.success).toBe(true)
  })

  test('should reject array with invalid group', () => {
    const invalidArray = [
      {
        id: 'valid',
        name: 'Valid',
        description: 'Valid group',
        categories: []
      },
      {
        id: 'invalid'
        // missing required fields
      }
    ]

    const result = v.safeParse(PWAFeaturesArraySchema, invalidArray)
    expect(result.success).toBe(false)
  })
})

describe('validatePWAFeatures', () => {
  test('should validate correct data successfully', () => {
    const validData = [
      {
        id: 'group-1',
        name: 'Group 1',
        description: 'Test group',
        categories: [
          {
            id: 'cat-1',
            name: 'Category 1',
            description: 'Test category',
            features: [
              {
                id: 'feat-1',
                name: 'Feature 1',
                description: 'Test feature'
              }
            ]
          }
        ]
      }
    ]

    expect(() => validatePWAFeatures(validData)).not.toThrow()
    const result = validatePWAFeatures(validData)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('group-1')
  })

  test('should throw error for invalid data', () => {
    const invalidData = [
      {
        id: 'invalid'
        // missing required fields
      }
    ]

    expect(() => validatePWAFeatures(invalidData)).toThrow(
      /PWA Features data validation failed/
    )
  })

  test('should throw error for non-array data', () => {
    const invalidData = {
      notAnArray: true
    }

    expect(() => validatePWAFeatures(invalidData)).toThrow()
  })

  test('should throw error for null data', () => {
    expect(() => validatePWAFeatures(null)).toThrow()
  })

  test('should throw error for undefined data', () => {
    expect(() => validatePWAFeatures(undefined as unknown)).toThrow()
  })
})
