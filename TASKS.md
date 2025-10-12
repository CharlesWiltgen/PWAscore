# PWAscore - Refactoring Tasks

This document tracks medium-priority refactoring tasks identified during code review. All critical bugs have been resolved. These tasks focus on improving maintainability, reducing bundle size, and improving separation of concerns.

---

## 1. Data Architecture Refactor: Extract PWA Features to JSON

**Status**: 🔴 Not Started
**Priority**: Medium
**Effort**: Large (3-4 hours)
**Impact**: Maintainability, Bundle Size, Separation of Concerns

### Current State

`app/data/pwa-features.ts` contains **1,971 lines** of TypeScript code defining 200+ PWA features with their metadata, CanIUse IDs, MDN BCD paths, and feature status flags.

**Location**: `/Users/Charles/Projects/PWAscore/src/app/data/pwa-features.ts`

**Current structure**:
```typescript
export const pwaFeatures: PWAFeature[] = [
  {
    id: 'web-app-manifest',
    name: 'Web App Manifest',
    category: 'Core',
    subcategory: 'Installation',
    weight: 3.0,
    canIUseId: 'web-app-manifest',
    mdnBcdPath: 'html.manifest',
    // ... 200+ features like this
  }
]
```

### Problem

1. **Bundle Size**: 1,971 lines of data inflates the JavaScript bundle unnecessarily
2. **Type Safety**: Runtime data mixed with compile-time types
3. **Editability**: Non-technical contributors can't easily update feature data
4. **Git Diffs**: Small changes to feature data create large TypeScript diffs
5. **Hot Reload**: Changes require TypeScript recompilation during development

### Proposed Solution

Extract feature data to JSON while maintaining type safety through validation:

**New structure**:
```
app/data/
├── pwa-features.json          # Feature data (runtime)
└── pwa-features.schema.ts     # Types + validation (compile-time)
```

**JSON format** (`pwa-features.json`):
```json
[
  {
    "id": "web-app-manifest",
    "name": "Web App Manifest",
    "category": "Core",
    "subcategory": "Installation",
    "weight": 3.0,
    "canIUseId": "web-app-manifest",
    "mdnBcdPath": "html.manifest"
  }
]
```

**Schema file** (`pwa-features.schema.ts`):
```typescript
import * as v from 'valibot'

// Type definitions (compile-time)
export const PWAFeatureSchema = v.object({
  id: v.string(),
  name: v.string(),
  category: v.string(),
  subcategory: v.optional(v.string()),
  weight: v.number(),
  canIUseId: v.optional(v.string()),
  mdnBcdPath: v.optional(v.string()),
  status: v.optional(v.object({
    experimental: v.boolean(),
    standard_track: v.boolean(),
    deprecated: v.boolean()
  }))
})

export type PWAFeature = v.InferOutput<typeof PWAFeatureSchema>

// Runtime validation
export function validatePWAFeatures(data: unknown): PWAFeature[] {
  const result = v.safeParse(v.array(PWAFeatureSchema), data)
  if (!result.success) {
    throw new Error(`Invalid PWA features data: ${JSON.stringify(v.flatten(result.issues))}`)
  }
  return result.output
}
```

**Loader composable** (`composables/usePWAFeatures.ts`):
```typescript
import pwaFeaturesData from '~/data/pwa-features.json'
import { validatePWAFeatures } from '~/data/pwa-features.schema'

// Validate once at module load time
const pwaFeatures = validatePWAFeatures(pwaFeaturesData)

export function usePWAFeatures() {
  return {
    features: pwaFeatures,
    getFeature: (id: string) => pwaFeatures.find(f => f.id === id),
    getFeaturesByCategory: (category: string) =>
      pwaFeatures.filter(f => f.category === category)
  }
}
```

### Benefits

1. ✅ **Smaller Bundle**: JSON is more compact than TypeScript (~20-30% reduction)
2. ✅ **Type Safety**: Valibot validation catches errors at runtime
3. ✅ **Editability**: Non-developers can edit JSON directly
4. ✅ **Better Git Diffs**: JSON changes are cleaner
5. ✅ **Faster Dev**: No TypeScript recompilation for data changes
6. ✅ **Consistency**: Same validation pattern as CanIUse/MDN BCD data

### Implementation Steps

1. Create `pwa-features.schema.ts` with Valibot schemas
2. Extract current data from `pwa-features.ts` to `pwa-features.json`
3. Create `composables/usePWAFeatures.ts` loader with validation
4. Update all imports from `~/data/pwa-features` to use new composable
5. Add validation test to ensure JSON matches schema
6. Update README.md with new data architecture
7. Delete old `pwa-features.ts` file

### Files to Update

**Create**:
- `app/data/pwa-features.json` (new)
- `app/data/pwa-features.schema.ts` (new)
- `app/composables/usePWAFeatures.ts` (new)
- `app/composables/usePWAFeatures.test.ts` (new test)

**Update**:
- `app/components/PWAFeatureBrowser.vue` (import change)
- `app/composables/useBrowserScore.ts` (import change)
- Any other files importing from `~/data/pwa-features`

**Delete**:
- `app/data/pwa-features.ts` (old file)

### Testing

```typescript
// app/composables/usePWAFeatures.test.ts
import { describe, expect, test } from 'vitest'
import pwaFeaturesData from '~/data/pwa-features.json'
import { validatePWAFeatures } from '~/data/pwa-features.schema'

describe('usePWAFeatures', () => {
  test('should validate JSON data successfully', () => {
    expect(() => validatePWAFeatures(pwaFeaturesData)).not.toThrow()
  })

  test('should return 200+ features', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    expect(features.length).toBeGreaterThan(200)
  })

  test('should have required fields on all features', () => {
    const features = validatePWAFeatures(pwaFeaturesData)
    features.forEach(feature => {
      expect(feature.id).toBeDefined()
      expect(feature.name).toBeDefined()
      expect(feature.category).toBeDefined()
      expect(typeof feature.weight).toBe('number')
    })
  })
})
```

---

## 2. Extract Manual Support Data to JSON

**Status**: 🔴 Not Started
**Priority**: Medium
**Effort**: Medium (2-3 hours)
**Impact**: Maintainability, Consistency

### Current State

`app/composables/useBrowserSupport.ts` contains **247 lines** (lines 54-301) of hardcoded `MANUAL_SUPPORT` data for vendor-specific features without CanIUse/MDN BCD entries.

**Location**: `/Users/Charles/Projects/PWAscore/src/app/composables/useBrowserSupport.ts:54-301`

**Current structure**:
```typescript
const MANUAL_SUPPORT: Record<string, BrowserSupport> = {
  'apple-pay': {
    safari_ios: 'supported',
    chrome_android: 'not-supported',
    firefox_android: 'not-supported',
    safari_iosVersion: '10.1',
    status: { experimental: false, standard_track: false, deprecated: false }
  },
  'google-pay': { /* ... */ },
  // ... 20+ more entries
}
```

### Problem

1. **Separation of Concerns**: Data mixed with logic in composable
2. **Consistency**: Should use same pattern as main PWA features (JSON)
3. **Maintainability**: Adding new vendor features requires editing TypeScript
4. **Validation**: No runtime validation of manual support data
5. **Testing**: Hard to test data separately from composable logic

### Proposed Solution

Extract to JSON with validation, following same pattern as Task #1:

**New structure**:
```
app/data/
├── manual-browser-support.json        # Manual support data (runtime)
└── manual-browser-support.schema.ts   # Types + validation (compile-time)
```

**JSON format** (`manual-browser-support.json`):
```json
{
  "apple-pay": {
    "safari_ios": "supported",
    "chrome_android": "not-supported",
    "firefox_android": "not-supported",
    "safari_iosVersion": "10.1",
    "status": {
      "experimental": false,
      "standard_track": false,
      "deprecated": false
    }
  },
  "google-pay": {
    "chrome_android": "supported",
    "safari_ios": "not-supported",
    "firefox_android": "not-supported",
    "chrome_androidVersion": "61",
    "status": {
      "experimental": false,
      "standard_track": false,
      "deprecated": false
    }
  }
}
```

**Schema file** (`manual-browser-support.schema.ts`):
```typescript
import * as v from 'valibot'
import { BrowserSupportSchema } from '~/schemas/canIUse'

// Type for manual support data
export const ManualBrowserSupportSchema = v.record(
  v.string(), // feature ID
  BrowserSupportSchema // reuse existing schema
)

export type ManualBrowserSupport = v.InferOutput<typeof ManualBrowserSupportSchema>

// Runtime validation
export function validateManualSupport(data: unknown): ManualBrowserSupport {
  const result = v.safeParse(ManualBrowserSupportSchema, data)
  if (!result.success) {
    throw new Error(`Invalid manual support data: ${JSON.stringify(v.flatten(result.issues))}`)
  }
  return result.output
}
```

**Update composable** (`composables/useBrowserSupport.ts`):
```typescript
import manualSupportData from '~/data/manual-browser-support.json'
import { validateManualSupport } from '~/data/manual-browser-support.schema'

// Validate once at module load time
const MANUAL_SUPPORT = validateManualSupport(manualSupportData)

// Remove lines 54-301 (old hardcoded data)
// Rest of composable remains the same
```

### Benefits

1. ✅ **Separation of Concerns**: Data separated from composable logic
2. ✅ **Consistency**: Same JSON pattern as PWA features
3. ✅ **Editability**: Easier to add new vendor-specific features
4. ✅ **Validation**: Runtime validation catches typos/errors
5. ✅ **Type Safety**: Reuses existing `BrowserSupportSchema`
6. ✅ **Smaller Composable**: 247 lines → ~10 lines (import + validation)

### Implementation Steps

1. Create `manual-browser-support.schema.ts` with validation
2. Extract `MANUAL_SUPPORT` data to `manual-browser-support.json`
3. Update `useBrowserSupport.ts` to import and validate JSON
4. Add test to verify JSON validation
5. Verify existing tests still pass
6. Update documentation

### Files to Update

**Create**:
- `app/data/manual-browser-support.json` (new)
- `app/data/manual-browser-support.schema.ts` (new)
- `app/data/manual-browser-support.test.ts` (new test)

**Update**:
- `app/composables/useBrowserSupport.ts` (remove lines 54-301, add import)
- `app/composables/useBrowserSupport.test.ts` (ensure tests still pass)

**No files deleted** (just refactoring existing code)

### Testing

```typescript
// app/data/manual-browser-support.test.ts
import { describe, expect, test } from 'vitest'
import manualSupportData from '~/data/manual-browser-support.json'
import { validateManualSupport } from '~/data/manual-browser-support.schema'

describe('manual browser support data', () => {
  test('should validate successfully', () => {
    expect(() => validateManualSupport(manualSupportData)).not.toThrow()
  })

  test('should include vendor-specific features', () => {
    const data = validateManualSupport(manualSupportData)
    expect(data['apple-pay']).toBeDefined()
    expect(data['google-pay']).toBeDefined()
  })

  test('should have valid support levels', () => {
    const data = validateManualSupport(manualSupportData)
    Object.values(data).forEach(support => {
      expect(['supported', 'partial', 'not-supported', 'unknown'])
        .toContain(support.chrome_android)
      expect(['supported', 'partial', 'not-supported', 'unknown'])
        .toContain(support.firefox_android)
      expect(['supported', 'partial', 'not-supported', 'unknown'])
        .toContain(support.safari_ios)
    })
  })

  test('should have status information', () => {
    const data = validateManualSupport(manualSupportData)
    Object.values(data).forEach(support => {
      if (support.status) {
        expect(typeof support.status.experimental).toBe('boolean')
        expect(typeof support.status.standard_track).toBe('boolean')
        expect(typeof support.status.deprecated).toBe('boolean')
      }
    })
  })
})
```

### Notes

- **Dependency**: This task should be done AFTER Task #1 to follow established pattern
- **Validation**: Current code validates at dev startup (lines 307-324) - keep this behavior
- **Schema Reuse**: Leverages existing `BrowserSupportSchema` from `schemas/canIUse.ts`
- **Backward Compatible**: No API changes to `useBrowserSupport` composable

---

## Task Dependencies

```
Task #1 (PWA Features) → Task #2 (Manual Support)
```

Task #2 should follow Task #1 to establish and reuse the JSON + validation pattern.

---

## Success Criteria

### For Task #1:
- [ ] All 200+ features moved to JSON
- [ ] Valibot validation works correctly
- [ ] All 83 tests still pass
- [ ] Bundle size reduced by 15-25%
- [ ] TypeScript compilation faster in dev mode
- [ ] No breaking changes to public API

### For Task #2:
- [ ] All 20+ manual support entries moved to JSON
- [ ] Validation reuses `BrowserSupportSchema`
- [ ] All existing tests still pass
- [ ] Composable file size reduced from 513 → ~280 lines
- [ ] Dev-time validation still catches invalid entries

---

## Related Documentation

- [Valibot Documentation](https://valibot.dev/)
- [Nuxt Data Fetching](https://nuxt.com/docs/getting-started/data-fetching)
- [PWAscore README](./README.md) - Architecture section
- [CanIUse Schemas](./app/schemas/canIUse.ts) - Existing validation patterns

---

## Notes

- Both tasks follow the **separation of concerns** principle: data vs. logic vs. types
- Uses **Valibot** for runtime validation (already in project dependencies)
- Maintains **full type safety** through schema inference
- **No breaking changes** to public APIs (composables work the same)
- Improves **developer experience** (faster dev builds, easier data editing)
- Reduces **bundle size** (JSON more compact than TypeScript)
- Enables **non-developer contributions** (JSON easier to edit than TypeScript)
