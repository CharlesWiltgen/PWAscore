# MDN Browser Compatibility Data (BCD) Evaluation

**Date**: 2025-10-07
**Package**: `@mdn/browser-compat-data` v7.1.11
**Evaluator**: Research for PWAscore PWA feature browser compatibility tracking

---

## Executive Summary

✅ **RECOMMENDATION**: Integrate MDN BCD as a fallback data source for PWA features not covered by CanIUse.

MDN BCD provides comprehensive, well-maintained browser compatibility data for **5 out of 6** PWA feature categories that were previously showing "unknown" support. The data includes mobile browser support (Chrome Android, Firefox Android, Safari iOS) and is updated regularly.

---

## Package Overview

| Property          | Value                                        |
| ----------------- | -------------------------------------------- |
| Package Name      | `@mdn/browser-compat-data`                   |
| Version           | 7.1.11 (as of 2025-10-07)                    |
| License           | CC0-1.0 (Public Domain)                      |
| Size              | ~450KB compressed                            |
| Total API Entries | 1,070+                                       |
| Update Frequency  | Active (timestamp: 2025-10-07T14:22:11.452Z) |
| Used By           | VSCode, TypeScript, CanIUse, MDN Docs        |

---

## PWA Feature Coverage Analysis

### ✅ Features with MDN BCD Data

#### 1. Badge API (`api.Navigator.setAppBadge`)

**BCD Path**: `api.Navigator.setAppBadge`

| Browser         | Support          | Version | Notes                                                                              |
| --------------- | ---------------- | ------- | ---------------------------------------------------------------------------------- |
| Chrome Android  | ❌ Not Supported | false   | -                                                                                  |
| Firefox Android | ❌ Not Supported | false   | -                                                                                  |
| Safari iOS      | ✅ Supported     | 16.4+   | Badge shown for home screen apps. Passing `0` clears badge instead of showing dot. |

**MDN URL**: https://developer.mozilla.org/docs/Web/API/Navigator/setAppBadge

**Impact**: 2 PWA features can now show accurate support data instead of "unknown"

---

#### 2. Background Fetch API (`api.BackgroundFetchManager`)

**BCD Path**: `api.BackgroundFetchManager`

| Browser         | Support          | Version | Notes |
| --------------- | ---------------- | ------- | ----- |
| Chrome Android  | ✅ Supported     | 74+     | -     |
| Firefox Android | ❌ Not Supported | false   | -     |
| Safari iOS      | ❌ Not Supported | false   | -     |

**Available Methods**: `fetch`, `get`, `getIds`

**Impact**: 3 PWA features can now show accurate support data instead of "unknown"

---

#### 3. Media Session API (`api.MediaSession`)

**BCD Path**: `api.MediaSession`

| Browser         | Support      | Version | Notes                                         |
| --------------- | ------------ | ------- | --------------------------------------------- |
| Chrome Android  | ✅ Supported | 57+     | -                                             |
| Firefox Android | ⚠️ Partial   | 82+     | API exposed but no user-facing media controls |
| Safari iOS      | ✅ Supported | 15+     | -                                             |

**Available Properties**: `metadata`, `playbackState`, `setActionHandler`, `setCameraActive`, `setMicrophoneActive`, `setPositionState`, `setScreenshareActive`

**Impact**: 1 PWA feature can now show accurate support data instead of "unknown"

---

#### 4. Barcode Detection API (`api.BarcodeDetector`)

**BCD Path**: `api.BarcodeDetector`

| Browser         | Support          | Version | Notes                                             |
| --------------- | ---------------- | ------- | ------------------------------------------------- |
| Chrome Android  | ✅ Supported     | 83+     | -                                                 |
| Firefox Android | ❌ Not Supported | false   | Bug tracker: https://bugzil.la/1553738            |
| Safari iOS      | 🚩 Behind Flag   | 17+     | Requires "Shape Detection API" preference enabled |

**Impact**: 2 PWA features can now show accurate support data instead of "unknown"

---

#### 5. Performance Timeline API (`api.PerformanceObserver`)

**BCD Path**: `api.PerformanceObserver`

| Browser         | Support      | Version | Notes |
| --------------- | ------------ | ------- | ----- |
| Chrome Android  | ✅ Supported | 52+     | -     |
| Firefox Android | ✅ Supported | 57+     | -     |
| Safari iOS      | ✅ Supported | 11+     | -     |

**Impact**: 2 PWA features can now show accurate support data instead of "unknown"

---

### ❌ Features WITHOUT MDN BCD Data

#### 6. Shape Detection API

**Missing APIs**:

- `api.FaceDetector` - NOT FOUND in BCD
- `api.TextDetector` - NOT FOUND in BCD

**Impact**: 3 PWA features will continue showing "unknown" support

**Alternatives**:

- Could use BarcodeDetector data as a proxy for general Shape Detection API support
- Manual research for these specific APIs
- Leave as "unknown" with explanatory notes

---

## Data Structure

### Browser Support Format

```typescript
interface BrowserSupport {
  version_added: string | boolean | null
  version_removed?: string
  partial_implementation?: boolean
  notes?: string | string[]
  flags?: Array<{
    name: string
    type: 'preference' | 'runtime_flag'
    value_to_set?: string
  }>
  impl_url?: string // Bug tracker or implementation URL
}
```

### Mobile Browser Keys

- `chrome_android`: Chrome on Android
- `firefox_android`: Firefox on Android
- `safari_ios`: Safari on iOS

### Example Data Access

```typescript
import bcd from '@mdn/browser-compat-data' with { type: 'json' }

// Access Badge API support
const badgeSupport = bcd.api.Navigator.setAppBadge.__compat.support.safari_ios
// Result: { version_added: "16.4", notes: [...] }
```

---

## Integration Approach

### Recommended Architecture

```typescript
interface PWAFeature {
  name: string
  canIUseId?: string // Existing CanIUse ID (primary source)
  mdnBcdPath?: string // NEW: MDN BCD API path (fallback source)
  // ... other fields
}
```

### Data Source Priority

1. **Primary**: CanIUse (`canIUseId`) - 80+ features
2. **Fallback**: MDN BCD (`mdnBcdPath`) - 10+ features
3. **Manual Override**: Universally supported features - 1 feature (web-app-manifest)
4. **Default**: "unknown" - remaining features

### Support Level Mapping

| BCD Value                      | PWAscore SupportLevel                |
| ------------------------------ | ------------------------------------ |
| `version_added: "X.Y"`         | `'supported'` (if current >= X.Y)    |
| `version_added: false`         | `'not-supported'`                    |
| `partial_implementation: true` | `'partial'`                          |
| Not found / null               | `'unknown'`                          |
| `flags: [...]`                 | `'not-supported'` or custom handling |

---

## Pros and Cons

### ✅ Pros

1. **Comprehensive Coverage**: 5/6 PWA feature categories have data
2. **Mobile-First**: Includes chrome_android, firefox_android, safari_ios
3. **Rich Metadata**: Version numbers, notes, flags, partial support
4. **Public Domain**: CC0-1.0 license, no legal concerns
5. **Well-Maintained**: Updated Oct 7, 2025 (same day as evaluation!)
6. **Industry Standard**: Used by VSCode, TypeScript, CanIUse
7. **Modest Size**: ~450KB compressed (acceptable overhead)
8. **Type-Safe**: JSON structure with TypeScript support available
9. **MDN URLs**: Includes links to MDN documentation

### ⚠️ Cons

1. **Bundle Size**: +450KB to client bundle (mitigable via build-time processing)
2. **Shape Detection Gap**: FaceDetector/TextDetector not included
3. **Complex Flags**: Need to decide how to handle flag-gated features
4. **Partial Support**: Need to map `partial_implementation` to our SupportLevel enum
5. **Version Comparison**: Need logic to compare browser versions
6. **Different Structure**: Not as straightforward as CanIUse's version-range format

---

## Implementation Plan

### Phase 1: Foundation

- [ ] Add `mdnBcdPath` property to PWAFeature interface
- [ ] Create `getMdnBcdSupport()` function parallel to `getCanIUseSupport()`
- [ ] Implement version comparison logic for MDN data

### Phase 2: Data Population

- [ ] Add mdnBcdPath to 10 PWA features currently lacking canIUseId:
  - Badge API: `api.Navigator.setAppBadge`
  - Background Fetch: `api.BackgroundFetchManager`
  - Media Session: `api.MediaSession`
  - Barcode Detection: `api.BarcodeDetector`
  - Performance Observer: `api.PerformanceObserver`

### Phase 3: Integration

- [ ] Update `canIUseLoader.ts` to check mdnBcdPath when canIUseId is missing
- [ ] Handle `partial_implementation` flag → map to `'partial'` SupportLevel
- [ ] Handle flags → document in feature descriptions or map to `'not-supported'`

### Phase 4: Testing

- [ ] Extend integration test to validate mdnBcdPath values
- [ ] Add unit tests for MDN BCD data parsing
- [ ] Verify support levels match real browser behavior

### Phase 5: Optimization (Optional)

- [ ] Consider build-time extraction of only needed BCD data
- [ ] Cache compiled support data to reduce runtime processing
- [ ] Document BCD update process

---

## Risks and Mitigations

| Risk                          | Impact | Mitigation                                                    |
| ----------------------------- | ------ | ------------------------------------------------------------- |
| Bundle size increase          | Medium | Use build-time processing to extract only needed data         |
| BCD data changes format       | Low    | BCD is stable; add integration test to catch breaking changes |
| Version comparison complexity | Low    | Use existing libraries (semver) or simple string comparison   |
| Partial support ambiguity     | Low    | Document partial support cases; potentially show in UI        |
| FaceDetector/TextDetector gap | Low    | Continue showing "unknown" for these 3 features               |

---

## Alternatives Considered

1. **Manual Data Entry**: Too error-prone, hard to maintain
2. **Web Platform Tests**: Too low-level, no version information
3. **Can I Use Only**: Missing 10+ PWA features we care about
4. **Browser Release Notes**: Too fragmented, inconsistent
5. **WebKit/Chromium Bug Trackers**: Unreliable, no Firefox data

**Winner**: MDN BCD provides the best balance of coverage, accuracy, and maintainability.

---

## Conclusion

MDN Browser Compatibility Data is an **excellent fit** as a fallback data source for PWAscore. It will:

- ✅ Provide real support data for **10 PWA features** currently showing "unknown"
- ✅ Maintain accuracy with frequent updates from Mozilla/community
- ✅ Reduce user confusion by showing accurate browser support
- ✅ Align with industry standards (same data source as VSCode/TypeScript)
- ⚠️ Add ~450KB to bundle (manageable with build-time optimization)

**Recommendation**: Proceed with integration using the phased approach outlined above.

---

## Next Steps

1. Present this evaluation to stakeholder (user)
2. Get approval to proceed with implementation
3. Begin Phase 1: Add mdnBcdPath to PWAFeature interface
4. Implement getMdnBcdSupport() function
5. Update integration tests to validate MDN BCD data

---

## References

- MDN BCD Package: https://www.npmjs.com/package/@mdn/browser-compat-data
- MDN BCD GitHub: https://github.com/mdn/browser-compat-data
- BCD Data Schema: https://github.com/mdn/browser-compat-data/blob/main/schemas/compat-data.schema.json
- License: https://github.com/mdn/browser-compat-data/blob/main/LICENSE
