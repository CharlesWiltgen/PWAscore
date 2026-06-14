# Desktop Browser Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add desktop browser comparison (Chrome, Firefox, Safari) alongside existing mobile browsers, toggled via a segmented control in the options bar.

**Architecture:** Expand `BrowserId` type to include desktop variants (`chrome`, `firefox`, `safari`). Add a `Platform` type that parameterizes which browser configs are active. The CanIUse loader and MDN BCD loader extract desktop agent keys alongside mobile ones. A segmented control in the options bar switches the active platform. The scoring algorithm requires no changes.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nuxt UI v4, Valibot, Vitest, @vueuse/core

---

### Task 1: Expand BrowserId, Platform type, and BrowserSupport interface

**Files:**

- Modify: `app/composables/useBrowserSupport.ts:18-49`
- Modify: `app/schemas/canIUse.ts:98-106`
- Test: `app/composables/useBrowserSupport.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test to `app/composables/useBrowserSupport.test.ts` that verifies desktop browser IDs are valid and manual support returns desktop fields:

```typescript
describe('desktop browser support', () => {
  test('should return unknown for desktop browser fields on unloaded features', () => {
    const { getSupport } = useBrowserSupport()

    const support = getSupport('unknown-feature')

    expect(support.chrome).toBe('unknown')
    expect(support.firefox).toBe('unknown')
    expect(support.safari).toBe('unknown')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/Charles/Projects/PWAscore && npx vitest run app/composables/useBrowserSupport.test.ts`
Expected: FAIL — `support.chrome` is `undefined` because the type doesn't include desktop fields yet.

- [ ] **Step 3: Expand the types and interfaces**

In `app/composables/useBrowserSupport.ts`, update:

```typescript
export type SupportLevel = 'supported' | 'partial' | 'not-supported' | 'unknown'

export type Platform = 'mobile' | 'desktop'

/**
 * Platform-specific browser identifiers
 * Mobile: chrome_android, firefox_android, safari_ios
 * Desktop: chrome, firefox, safari
 */
export type BrowserId =
  | 'chrome_android'
  | 'firefox_android'
  | 'safari_ios'
  | 'chrome'
  | 'firefox'
  | 'safari'

/**
 * Browser support data for a feature across platforms
 */
export interface BrowserSupport {
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
  status?: FeatureStatus
  chrome_androidVersion?: string
  firefox_androidVersion?: string
  safari_iosVersion?: string
  chromeVersion?: string
  firefoxVersion?: string
  safariVersion?: string
}
```

Update `UNKNOWN_SUPPORT`:

```typescript
const UNKNOWN_SUPPORT: BrowserSupport = {
  chrome_android: 'unknown',
  firefox_android: 'unknown',
  safari_ios: 'unknown',
  chrome: 'unknown',
  firefox: 'unknown',
  safari: 'unknown'
}
```

In `app/schemas/canIUse.ts`, update `BrowserSupportSchema`:

```typescript
export const BrowserSupportSchema = v.object({
  chrome_android: SupportLevelSchema,
  firefox_android: SupportLevelSchema,
  safari_ios: SupportLevelSchema,
  chrome: v.optional(SupportLevelSchema),
  firefox: v.optional(SupportLevelSchema),
  safari: v.optional(SupportLevelSchema),
  status: v.optional(FeatureStatusSchema),
  chrome_androidVersion: v.optional(v.string()),
  firefox_androidVersion: v.optional(v.string()),
  safari_iosVersion: v.optional(v.string()),
  chromeVersion: v.optional(v.string()),
  firefoxVersion: v.optional(v.string()),
  safariVersion: v.optional(v.string())
})
```

Note: Desktop fields in the schema are `v.optional()` because existing manual-browser-support.json entries don't have them yet. The `BrowserSupport` TypeScript interface keeps them required (defaulting to `'unknown'` at runtime via `UNKNOWN_SUPPORT` and the loader functions).

- [ ] **Step 4: Fix MANUAL_SUPPORT type compatibility**

The `validateManualSupport` function returns data matching the schema (where desktop fields are optional), but `MANUAL_SUPPORT` is typed as `Record<string, BrowserSupport>` (where desktop fields are required). Add a transform after validation in `app/composables/useBrowserSupport.ts`:

```typescript
function normalizeManualSupport(
  data: Record<string, unknown>
): Record<string, BrowserSupport> {
  const validated = validateManualSupport(data)
  const result: Record<string, BrowserSupport> = {}
  for (const [key, entry] of Object.entries(validated)) {
    result[key] = {
      ...UNKNOWN_SUPPORT,
      ...entry
    }
  }
  return result
}

const MANUAL_SUPPORT: Record<string, BrowserSupport> =
  normalizeManualSupport(manualSupportData)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/Charles/Projects/PWAscore && npx vitest run app/composables/useBrowserSupport.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/composables/useBrowserSupport.ts app/schemas/canIUse.ts app/composables/useBrowserSupport.test.ts
git commit -m "feat: expand BrowserId and BrowserSupport to include desktop browsers"
```

---

### Task 2: Add desktop support to CanIUse loader

**Files:**

- Modify: `app/utils/canIUseLoader.ts:317-391` (getCanIUseSupport)
- Modify: `app/utils/canIUseLoader.ts:713-773` (getMdnBcdSupport)
- Test: `app/utils/canIUseLoader.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `app/utils/canIUseLoader.test.ts`:

```typescript
describe('getCanIUseSupport - desktop browsers', () => {
  test('should return desktop support for service workers', async () => {
    const browserVersions = {
      chrome: '146',
      firefox: '148',
      safari: '26.3'
    }

    const support = await getCanIUseSupport('serviceworkers', browserVersions)

    // Desktop browsers should also have support data
    expect(support.chrome).toBe('supported')
    expect(support.firefox).toBe('supported')
    expect(support.safari).toBe('supported')
  })

  test('should return desktop support for universally supported features', async () => {
    const browserVersions = {
      chrome: '146',
      firefox: '148',
      safari: '26.3'
    }

    const support = await getCanIUseSupport('web-app-manifest', browserVersions)

    expect(support.chrome).toBe('supported')
    expect(support.firefox).toBe('supported')
    expect(support.safari).toBe('supported')
  })

  test('should return unknown for non-existent feature on desktop', async () => {
    const browserVersions = {
      chrome: '146',
      firefox: '148',
      safari: '26.3'
    }

    const support = await getCanIUseSupport(
      'non-existent-feature-xyz',
      browserVersions
    )

    expect(support.chrome).toBe('unknown')
    expect(support.firefox).toBe('unknown')
    expect(support.safari).toBe('unknown')
  })
})

describe('getMdnBcdSupport - desktop browsers', () => {
  test('should return desktop support for valid MDN BCD path', async () => {
    const browserVersions = {
      chrome: '146',
      firefox: '148',
      safari: '26.3'
    }

    const { getMdnBcdSupport } = await import('./canIUseLoader')
    const support = await getMdnBcdSupport(
      'api.Navigator.setAppBadge',
      browserVersions
    )

    // Desktop Chrome supports setAppBadge (version 81+)
    expect(support.chrome).toBe('supported')
    // Desktop Firefox does not support it
    expect(support.firefox).toBe('not-supported')
    // Desktop Safari supports it (17.0+)
    expect(support.safari).toBe('supported')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/Charles/Projects/PWAscore && npx vitest run app/utils/canIUseLoader.test.ts`
Expected: FAIL — `support.chrome` is `undefined`

- [ ] **Step 3: Update getCanIUseSupport to include desktop browsers**

In `app/utils/canIUseLoader.ts`, update the `getCanIUseSupport` function return type and body. The function already receives `browserVersions` with `chrome`, `firefox`, `safari` keys. Add desktop agent lookups:

```typescript
export async function getCanIUseSupport(
  canIUseId: string,
  browserVersions: {
    chrome: string
    firefox: string
    safari: string
  }
): Promise<{
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
}> {
  try {
    if (
      (UNIVERSALLY_SUPPORTED_FEATURES as readonly string[]).includes(canIUseId)
    ) {
      return {
        chrome_android: 'supported',
        firefox_android: 'supported',
        safari_ios: 'supported',
        chrome: 'supported',
        firefox: 'supported',
        safari: 'supported'
      }
    }

    const data = await loadCanIUseData()

    const featureData = data.data[canIUseId]
    if (!featureData) {
      if (
        !(UNIVERSALLY_SUPPORTED_FEATURES as readonly string[]).includes(
          canIUseId
        )
      ) {
        console.log(`CanIUse feature not found: ${canIUseId}`)
      }
      return {
        chrome_android: 'unknown',
        firefox_android: 'unknown',
        safari_ios: 'unknown',
        chrome: 'unknown',
        firefox: 'unknown',
        safari: 'unknown'
      }
    }

    // Mobile browser agents
    const chromeAndroidStatus = findBrowserVersion(
      featureData.stats?.and_chr,
      browserVersions.chrome
    )
    const firefoxAndroidStatus = findBrowserVersion(
      featureData.stats?.and_ff,
      browserVersions.firefox
    )
    const safariIosStatus = findBrowserVersion(
      featureData.stats?.ios_saf,
      browserVersions.safari
    )

    // Desktop browser agents
    const chromeDesktopStatus = findBrowserVersion(
      featureData.stats?.chrome,
      browserVersions.chrome
    )
    const firefoxDesktopStatus = findBrowserVersion(
      featureData.stats?.firefox,
      browserVersions.firefox
    )
    const safariDesktopStatus = findBrowserVersion(
      featureData.stats?.safari,
      browserVersions.safari
    )

    return {
      chrome_android: parseStatus(chromeAndroidStatus),
      firefox_android: parseStatus(firefoxAndroidStatus),
      safari_ios: parseStatus(safariIosStatus),
      chrome: parseStatus(chromeDesktopStatus),
      firefox: parseStatus(firefoxDesktopStatus),
      safari: parseStatus(safariDesktopStatus)
    }
  } catch (error) {
    console.error(`Error getting CanIUse support for ${canIUseId}:`, error)
    return {
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios: 'unknown',
      chrome: 'unknown',
      firefox: 'unknown',
      safari: 'unknown'
    }
  }
}
```

- [ ] **Step 4: Update getMdnBcdSupport to include desktop browsers**

In `app/utils/canIUseLoader.ts`, update `getMdnBcdSupport` similarly. Add desktop browser lookups using the native MDN BCD keys (`chrome`, `firefox`, `safari`):

```typescript
export async function getMdnBcdSupport(
  mdnBcdPath: string,
  browserVersions: BrowserVersions
): Promise<{
  chrome_android: SupportLevel
  firefox_android: SupportLevel
  safari_ios: SupportLevel
  chrome: SupportLevel
  firefox: SupportLevel
  safari: SupportLevel
  status?: FeatureStatus
}> {
  try {
    const bcdData = await loadMdnBcdData()
    const feature = navigateMdnBcdPath(bcdData, mdnBcdPath)

    if (!feature || !feature.__compat?.support) {
      console.log(`MDN BCD feature not found: ${mdnBcdPath}`)
      return {
        chrome_android: 'unknown',
        firefox_android: 'unknown',
        safari_ios: 'unknown',
        chrome: 'unknown',
        firefox: 'unknown',
        safari: 'unknown'
      }
    }

    const support = feature.__compat.support
    const status = feature.__compat.status

    // Mobile browser support
    const chromeAndroidSupport = support.chrome_android
    const firefoxAndroidSupport = support.firefox_android
    const safariIosSupport = support.safari_ios

    const chromeAndroid = chromeAndroidSupport
      ? isVersionSupported(chromeAndroidSupport, browserVersions.chrome)
      : { level: 'unknown' as const, partial: false }
    const firefoxAndroid = firefoxAndroidSupport
      ? isVersionSupported(firefoxAndroidSupport, browserVersions.firefox)
      : { level: 'unknown' as const, partial: false }
    const safariIos = safariIosSupport
      ? isVersionSupported(safariIosSupport, browserVersions.safari)
      : { level: 'unknown' as const, partial: false }

    // Desktop browser support
    const chromeDesktopSupport = support.chrome
    const firefoxDesktopSupport = support.firefox
    const safariDesktopSupport = support.safari

    const chromeDesktop = chromeDesktopSupport
      ? isVersionSupported(chromeDesktopSupport, browserVersions.chrome)
      : { level: 'unknown' as const, partial: false }
    const firefoxDesktop = firefoxDesktopSupport
      ? isVersionSupported(firefoxDesktopSupport, browserVersions.firefox)
      : { level: 'unknown' as const, partial: false }
    const safariDesktop = safariDesktopSupport
      ? isVersionSupported(safariDesktopSupport, browserVersions.safari)
      : { level: 'unknown' as const, partial: false }

    return {
      chrome_android: chromeAndroid.partial ? 'partial' : chromeAndroid.level,
      firefox_android: firefoxAndroid.partial
        ? 'partial'
        : firefoxAndroid.level,
      safari_ios: safariIos.partial ? 'partial' : safariIos.level,
      chrome: chromeDesktop.partial ? 'partial' : chromeDesktop.level,
      firefox: firefoxDesktop.partial ? 'partial' : firefoxDesktop.level,
      safari: safariDesktop.partial ? 'partial' : safariDesktop.level,
      status: status
        ? {
            experimental: status.experimental || false,
            standard_track: status.standard_track !== false,
            deprecated: status.deprecated || false
          }
        : undefined
    }
  } catch (error) {
    console.error(`Error getting MDN BCD support for ${mdnBcdPath}:`, error)
    return {
      chrome_android: 'unknown',
      firefox_android: 'unknown',
      safari_ios: 'unknown',
      chrome: 'unknown',
      firefox: 'unknown',
      safari: 'unknown'
    }
  }
}
```

- [ ] **Step 5: Update hasKnownSupport checks in useBrowserSupport.ts**

In `app/composables/useBrowserSupport.ts`, the `loadSupport` function checks `hasKnownSupport` by looking at only mobile fields. Update both checks to also include desktop fields:

```typescript
const hasKnownSupport =
  support.chrome_android !== 'unknown' ||
  support.firefox_android !== 'unknown' ||
  support.safari_ios !== 'unknown' ||
  support.chrome !== 'unknown' ||
  support.firefox !== 'unknown' ||
  support.safari !== 'unknown'
```

Apply this in both the MDN BCD check block (around line 165) and the CanIUse check block (around line 194).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/Charles/Projects/PWAscore && npx vitest run app/utils/canIUseLoader.test.ts app/composables/useBrowserSupport.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/utils/canIUseLoader.ts app/utils/canIUseLoader.test.ts app/composables/useBrowserSupport.ts
git commit -m "feat: add desktop browser support to CanIUse and MDN BCD loaders"
```

---

### Task 3: Update useBrowserScore tests for desktop BrowserIds

**Files:**

- Test: `app/composables/useBrowserScore.test.ts`

- [ ] **Step 1: Update test helper to include desktop fields in BrowserSupport**

In `app/composables/useBrowserScore.test.ts`, update the `createTestData` helper's `getSupport` function and the `createMultiGroupGetSupport` function to return desktop fields:

```typescript
const getSupport = (featureId: string): BrowserSupport => {
  const index = Number.parseInt(featureId.replace('feature-', ''), 10)
  const feature = features[index]
  return {
    chrome_android: feature?.supportLevel || 'unknown',
    firefox_android: feature?.supportLevel || 'unknown',
    safari_ios: feature?.supportLevel || 'unknown',
    chrome: feature?.supportLevel || 'unknown',
    firefox: feature?.supportLevel || 'unknown',
    safari: feature?.supportLevel || 'unknown',
    status: {
      experimental: feature?.experimental ?? false,
      standard_track: feature?.standardTrack ?? true,
      deprecated: false
    }
  }
}
```

Apply the same pattern to `createMultiGroupGetSupport`:

```typescript
return (featureId: string): BrowserSupport => {
  const f = featureMap.get(featureId)
  return {
    chrome_android: f?.supportLevel || 'unknown',
    firefox_android: f?.supportLevel || 'unknown',
    safari_ios: f?.supportLevel || 'unknown',
    chrome: f?.supportLevel || 'unknown',
    firefox: f?.supportLevel || 'unknown',
    safari: f?.supportLevel || 'unknown',
    status: {
      experimental: f?.experimental ?? false,
      standard_track: f?.standardTrack ?? true,
      deprecated: false
    }
  }
}
```

- [ ] **Step 2: Add a test for desktop browser scoring**

```typescript
describe('desktop browser scoring', () => {
  test('should calculate scores for desktop browser IDs', () => {
    const { groups, getSupport } = createTestData([
      { supportLevel: 'supported' },
      { supportLevel: 'partial' },
      { supportLevel: 'not-supported' }
    ])
    const scores = calculateBrowserScore('chrome', groups, getSupport)
    // (1.0 + 0.5 + 0.0) / 3.0 = 50%
    expect(scores.weighted).toBe(50)
    expect(scores.unweighted).toBe(50)
  })

  test('should calculate scores for safari desktop', () => {
    const { groups, getSupport } = createTestData([
      { supportLevel: 'supported' }
    ])
    const scores = calculateBrowserScore('safari', groups, getSupport)
    expect(scores.weighted).toBe(100)
  })
})
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd /Users/Charles/Projects/PWAscore && npx vitest run app/composables/useBrowserScore.test.ts`
Expected: PASS — the scoring algorithm is already generic, it just indexes into `BrowserSupport[browserId]`.

- [ ] **Step 4: Commit**

```bash
git add app/composables/useBrowserScore.test.ts
git commit -m "test: add desktop browser scoring tests"
```

---

### Task 4: Add desktop entries to manual-browser-support.json

**Files:**

- Modify: `app/data/manual-browser-support.json`
- Test: `app/data/manual-browser-support.data.test.ts` (existing tests should still pass)

- [ ] **Step 1: Add desktop fields to all manual support entries**

For each entry in `app/data/manual-browser-support.json`, add the three desktop fields. The values should reflect actual desktop browser support:

- `apple-pay`: `"chrome": "not-supported", "firefox": "not-supported", "safari": "supported"` (Apple Pay works on desktop Safari)
- `google-pay`: `"chrome": "supported", "firefox": "not-supported", "safari": "not-supported"` (Google Pay works in desktop Chrome)
- `declarative-web-push`: `"chrome": "not-supported", "firefox": "not-supported", "safari": "supported"` (Safari desktop supports this)
- `viewport-control`: `"chrome": "supported", "firefox": "supported", "safari": "supported"` (universal)
- `window-controls-overlay`: `"chrome": "supported", "firefox": "not-supported", "safari": "not-supported"` (Chrome desktop supports WCO)
- `tabbed-mode`: `"chrome": "not-supported", "firefox": "not-supported", "safari": "not-supported"` (experimental everywhere)
- `https-requirement`: `"chrome": "supported", "firefox": "supported", "safari": "supported"` (universal)
- `same-origin-policy`: `"chrome": "supported", "firefox": "supported", "safari": "supported"` (universal)
- `secure-contexts`: `"chrome": "supported", "firefox": "supported", "safari": "supported"` (universal)
- `file-type-associations`: `"chrome": "supported", "firefox": "not-supported", "safari": "not-supported"` (Chrome desktop supports this)
- `open-with-pwa`: `"chrome": "not-supported", "firefox": "not-supported", "safari": "not-supported"`
- `url-scheme-handling`: `"chrome": "not-supported", "firefox": "not-supported", "safari": "not-supported"`
- `jump-list`: `"chrome": "supported", "firefox": "not-supported", "safari": "not-supported"` (Chrome desktop)
- `quick-actions`: `"chrome": "supported", "firefox": "not-supported", "safari": "not-supported"` (Chrome desktop)
- `face-detection`, `text-detection`, `shape-detection`: `"chrome": "not-supported", "firefox": "not-supported", "safari": "not-supported"`
- `element-capture`, `region-capture`: `"chrome": "not-supported", "firefox": "not-supported", "safari": "not-supported"`
- `proximity`: `"chrome": "not-supported", "firefox": "not-supported", "safari": "not-supported"` (not available on desktop)
- `background-audio`: `"chrome": "supported", "firefox": "supported", "safari": "supported"`
- `push-api`: `"chrome": "supported", "firefox": "supported", "safari": "supported"` (all desktop browsers support Push API)
- `notification-api`: `"chrome": "supported", "firefox": "supported", "safari": "supported"`

Example of updated entry format:

```json
{
  "apple-pay": {
    "safari_ios": "supported",
    "chrome_android": "not-supported",
    "firefox_android": "not-supported",
    "chrome": "not-supported",
    "firefox": "not-supported",
    "safari": "supported",
    "safari_iosVersion": "10.1",
    "safariVersion": "11.1",
    "status": {
      "experimental": false,
      "standard_track": false,
      "deprecated": false
    }
  }
}
```

- [ ] **Step 2: Run data validation tests**

Run: `cd /Users/Charles/Projects/PWAscore && npx vitest run app/data/`
Expected: PASS — the schema now accepts optional desktop fields.

- [ ] **Step 3: Commit**

```bash
git add app/data/manual-browser-support.json
git commit -m "feat: add desktop browser support data to manual entries"
```

---

### Task 5: Add getBrowsersForPlatform and platform-aware browser config

**Files:**

- Modify: `app/components/PWAFeatureBrowser.vue:246-280`
- No new test file (this is Vue component config, tested via the component)

- [ ] **Step 1: Add desktop browser config and getBrowsersForPlatform**

In `app/components/PWAFeatureBrowser.vue`, replace the current `browserConfig` with a platform-aware setup:

```typescript
import type { Platform } from '../composables/useBrowserSupport'

interface BrowserColumn {
  id: BrowserId
  name: string
  icon: string
  version: string
  color: string
  platformLabel: string
  platformIcon?: string
}

const mobileBrowserConfig: BrowserColumn[] = [
  {
    id: 'chrome_android',
    name: 'Chrome',
    icon: 'i-simple-icons-googlechrome',
    version: '131',
    color: 'text-green-600 dark:text-green-400',
    platformLabel: t('browser.platform.android'),
    platformIcon: 'i-simple-icons-android'
  },
  {
    id: 'firefox_android',
    name: 'Firefox',
    icon: 'i-simple-icons-firefox',
    version: '138',
    color: 'text-orange-600 dark:text-orange-400',
    platformLabel: t('browser.platform.android'),
    platformIcon: 'i-simple-icons-android'
  },
  {
    id: 'safari_ios',
    name: 'Safari',
    icon: 'i-simple-icons-safari',
    version: '26',
    color: 'text-blue-600 dark:text-blue-400',
    platformLabel: t('browser.platform.ios'),
    platformIcon: 'i-simple-icons-apple'
  }
]

const desktopBrowserConfig: BrowserColumn[] = [
  {
    id: 'chrome',
    name: 'Chrome',
    icon: 'i-simple-icons-googlechrome',
    version: '131',
    color: 'text-green-600 dark:text-green-400',
    platformLabel: t('browser.platform.crossPlatform')
  },
  {
    id: 'firefox',
    name: 'Firefox',
    icon: 'i-simple-icons-firefox',
    version: '138',
    color: 'text-orange-600 dark:text-orange-400',
    platformLabel: t('browser.platform.crossPlatform')
  },
  {
    id: 'safari',
    name: 'Safari',
    icon: 'i-simple-icons-safari',
    version: '26',
    color: 'text-blue-600 dark:text-blue-400',
    platformLabel: t('browser.platform.macos'),
    platformIcon: 'i-simple-icons-apple'
  }
]

// Platform state
const activePlatform = ref<Platform>('mobile')

const activeBrowserConfig = computed(() =>
  activePlatform.value === 'mobile' ? mobileBrowserConfig : desktopBrowserConfig
)

const browsers = computed(() =>
  activeBrowserConfig.value.map((browser) => ({
    ...browser,
    scores: calculateBrowserScore(browser.id, pwaFeatures, getSupport)
  }))
)
```

- [ ] **Step 2: Update the browser header template to use platformLabel**

Replace the platform display logic in the template. Currently it checks `browser.platformIcon === 'i-simple-icons-android'` to decide between Android/iOS labels. Replace with the `platformLabel` field:

```html
<div class="text-lg flex items-center gap-1">
  <span class="font-semibold">{{ browser.name }}</span>
  <span
    class="font-normal text-gray-500 dark:text-gray-400 flex items-center gap-1"
  >
    {{ t('browser.for') }}
    <UIcon
      v-if="browser.platformIcon"
      :name="browser.platformIcon"
      aria-hidden="true"
      class="w-4 h-4"
    />
    <span class="sr-only">{{ browser.platformLabel }}</span>
  </span>
</div>
```

And update the `<h2>` screen-reader heading similarly:

```html
<h2 :id="`heading-${browser.id}`" class="sr-only">
  {{ browser.name }} {{ t('browser.for') }} {{ browser.platformLabel }}
</h2>
```

- [ ] **Step 3: Run the dev server to verify no regressions**

Run: `cd /Users/Charles/Projects/PWAscore && npx nuxt dev`
Verify the page loads and mobile browsers display correctly. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/components/PWAFeatureBrowser.vue
git commit -m "feat: add platform-aware browser config with desktop entries"
```

---

### Task 6: Add segmented control to PWAFeatureBrowserOptions

**Files:**

- Modify: `app/components/PWAFeatureBrowserOptions.vue`
- Modify: `app/components/PWAFeatureBrowser.vue` (pass platform prop)

- [ ] **Step 1: Add platform prop and emit to PWAFeatureBrowserOptions**

In `app/components/PWAFeatureBrowserOptions.vue`, update the script section:

```typescript
import type { Platform } from '../composables/useBrowserSupport'

const { t } = useI18n()
const localePath = useLocalePath()

const props = defineProps<{
  isAllExpanded: boolean
  hideExperimental: boolean
  platform: Platform
}>()

const emit = defineEmits<{
  expandAll: []
  collapseAll: []
  toggleHideExperimental: []
  'update:platform': [platform: Platform]
}>()
```

- [ ] **Step 2: Add the segmented control to the template**

Insert the segmented control between the "Hide Experimental" checkbox and the "Expand/Collapse" button. Update the three-column layout to accommodate four items, or place the segmented control as a second row. The cleanest approach: replace the current 3-column flex with a layout that puts the platform toggle on the left alongside the checkbox:

```html
<div class="flex items-center justify-between mb-6">
  <!-- Left: Platform toggle + Hide Experimental -->
  <div class="flex-1 flex items-center gap-4">
    <UButtonGroup size="sm">
      <UButton
        :label="t('options.mobile')"
        :color="props.platform === 'mobile' ? 'primary' : 'neutral'"
        :variant="props.platform === 'mobile' ? 'solid' : 'outline'"
        @click="emit('update:platform', 'mobile')"
      />
      <UButton
        :label="t('options.desktop')"
        :color="props.platform === 'desktop' ? 'primary' : 'neutral'"
        :variant="props.platform === 'desktop' ? 'solid' : 'outline'"
        @click="emit('update:platform', 'desktop')"
      />
    </UButtonGroup>
    <UCheckbox
      :model-value="hideExperimental"
      :label="t('options.hideExperimental')"
      @update:model-value="handleHideExperimentalToggle"
    />
  </div>

  <!-- Center: Expand/Collapse toggle -->
  <div class="flex-1 flex justify-center">
    <!-- (existing expand/collapse button, unchanged) -->
  </div>

  <!-- Right: How Scores Work disclosure -->
  <div class="flex-1 flex justify-end">
    <!-- (existing disclosure button, unchanged) -->
  </div>
</div>
```

- [ ] **Step 3: Wire up the platform prop in PWAFeatureBrowser.vue**

In `app/components/PWAFeatureBrowser.vue`, pass the `activePlatform` to the options component:

```html
<PWAFeatureBrowserOptions
  :is-all-expanded="isAllExpanded"
  :hide-experimental="hideExperimental"
  :platform="activePlatform"
  @expand-all="expandAll"
  @collapse-all="collapseAll"
  @toggle-hide-experimental="toggleHideExperimental"
  @update:platform="activePlatform = $event"
/>
```

- [ ] **Step 4: Run the dev server to verify the segmented control renders and toggles**

Run: `cd /Users/Charles/Projects/PWAscore && npx nuxt dev`
Verify: segmented control shows "Mobile" | "Desktop", clicking switches the browser columns. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/components/PWAFeatureBrowserOptions.vue app/components/PWAFeatureBrowser.vue
git commit -m "feat: add Mobile/Desktop segmented control to options bar"
```

---

### Task 7: Add i18n translation keys

**Files:**

- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/fr.json`

- [ ] **Step 1: Add English translations**

In `i18n/locales/en.json`, add to `options`:

```json
"options": {
  "hideExperimental": "Hide Experimental",
  "expandAll": "Expand All",
  "collapseAll": "Collapse All",
  "howScoresWork": "How Scores Work",
  "mobile": "Mobile",
  "desktop": "Desktop"
}
```

Add to `browser.platform`:

```json
"browser": {
  "platform": {
    "android": "Android",
    "ios": "iOS",
    "crossPlatform": "Cross-platform",
    "macos": "macOS"
  }
}
```

Update `hero.description` to remove "(and soon, desktop)" since desktop is now available:

```json
"hero": {
  "description": "Compare Progressive Web App capabilities across popular mobile and desktop browsers."
}
```

- [ ] **Step 2: Add French translations**

In `i18n/locales/fr.json`, add to `options`:

```json
"options": {
  "hideExperimental": "Masquer les expérimentales",
  "expandAll": "Tout développer",
  "collapseAll": "Tout réduire",
  "howScoresWork": "Calcul des scores",
  "mobile": "Mobile",
  "desktop": "Bureau"
}
```

Add to `browser.platform`:

```json
"browser": {
  "platform": {
    "android": "Android",
    "ios": "iOS",
    "crossPlatform": "Multiplateforme",
    "macos": "macOS"
  }
}
```

Update `hero.description`:

```json
"hero": {
  "description": "Comparez les capacités des Progressive Web Apps sur les navigateurs mobiles et de bureau populaires."
}
```

- [ ] **Step 3: Run typecheck to verify no missing keys**

Run: `cd /Users/Charles/Projects/PWAscore && npx nuxt typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add i18n/locales/en.json i18n/locales/fr.json
git commit -m "feat(i18n): add desktop platform labels and segmented control translations"
```

---

### Task 8: Run all tests and verify build

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/Charles/Projects/PWAscore && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck and lint**

Run: `cd /Users/Charles/Projects/PWAscore && npx nuxt typecheck && npx eslint .`
Expected: PASS

- [ ] **Step 3: Run the production build**

Run: `cd /Users/Charles/Projects/PWAscore && npx nuxt build`
Expected: Build succeeds

- [ ] **Step 4: Verify in dev server**

Run: `cd /Users/Charles/Projects/PWAscore && npx nuxt dev`
Verify:

- Default view shows "Mobile" selected with Chrome/Firefox/Safari for Android/iOS
- Clicking "Desktop" switches to Chrome/Firefox/Safari for Cross-platform/macOS
- Scores recalculate (desktop scores differ from mobile)
- Accordion expand/collapse state preserved across toggle
- Mobile viewport: tabs update to show desktop browser names
- French locale works with translated labels

- [ ] **Step 5: Run prettier**

Run: `cd /Users/Charles/Projects/PWAscore && npx prettier --write app/composables/useBrowserSupport.ts app/utils/canIUseLoader.ts app/schemas/canIUse.ts app/components/PWAFeatureBrowser.vue app/components/PWAFeatureBrowserOptions.vue`
Expected: Files formatted
