import { describe, expect, test } from 'vitest'
import overridesData from './bcd-release-overrides.json'
import { validateBcdReleaseOverrides } from './bcd-release-overrides.schema'

describe('BCD Release Overrides Data Integrity', () => {
  test('should validate entire dataset without errors', () => {
    expect(() => validateBcdReleaseOverrides(overridesData)).not.toThrow()
  })

  test('should only date releases in the past', () => {
    const today = new Date().toISOString().slice(0, 10)
    const data = validateBcdReleaseOverrides(overridesData)

    Object.entries(data).forEach(([browserId, versions]) => {
      Object.entries(versions).forEach(([version, override]) => {
        // An override asserts a release already shipped, so a future date means
        // either a typo or a beta being pre-announced as released.
        expect(
          override.releaseDate <= today,
          `${browserId} ${version} is dated ${override.releaseDate} (future)`
        ).toBe(true)
      })
    })
  })

  test('should state the removal condition in every note', () => {
    const data = validateBcdReleaseOverrides(overridesData)

    Object.entries(data).forEach(([browserId, versions]) => {
      Object.entries(versions).forEach(([version, override]) => {
        // The table is temporary by construction: each entry must say what makes
        // it deletable, so cleanup is mechanical rather than archaeology.
        expect(
          override.note.toLowerCase(),
          `${browserId} ${version} does not state a removal condition`
        ).toContain('remove')
      })
    })
  })
})
