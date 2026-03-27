# Desktop Browser Support

Add desktop browser comparison alongside existing mobile browsers, toggled via a segmented control.

## Platform Model

New `Platform` type: `'mobile' | 'desktop'`

`BrowserId` expands from:

```
'chrome_android' | 'firefox_android' | 'safari_ios'
```

to also include:

```
'chrome' | 'firefox' | 'safari'
```

## Browser Configs

### Mobile (existing)

| ID                | Name    | Platform |
| ----------------- | ------- | -------- |
| `chrome_android`  | Chrome  | Android  |
| `firefox_android` | Firefox | Android  |
| `safari_ios`      | Safari  | iOS      |

### Desktop (new)

| ID        | Name    | Platform       |
| --------- | ------- | -------------- |
| `chrome`  | Chrome  | Cross-platform |
| `firefox` | Firefox | Cross-platform |
| `safari`  | Safari  | macOS          |

Versions auto-derived from CanIUse data — no manual version management.

A `getBrowsersForPlatform(platform: Platform)` function returns the 3 browser configs for the selected platform.

## Data Sources

Support resolution follows the same three-tier priority as mobile:

1. **CanIUse** — desktop agent keys: `chrome`, `firefox`, `safari`
2. **MDN BCD** — fields `chrome`, `firefox`, `safari` (these are the native/default keys in MDN data, simpler than mobile)
3. **Manual support data** — `manual-browser-support.json` expanded with desktop entries per feature where applicable

## BrowserSupport Interface

Add desktop fields alongside existing mobile fields:

```
chrome: SupportLevel
firefox: SupportLevel
safari: SupportLevel
chromeVersion?: string
firefoxVersion?: string
safariVersion?: string
```

Valibot schemas updated to validate the new fields.

## Caching

Cache keys already use feature ID + browser ID. Desktop and mobile use different `BrowserId` keys, so they cache separately without conflicts.

## Scoring

No algorithm changes. `useBrowserScore` calculates scores from whatever `BrowserId` entries it receives. Switching platform just passes different browser IDs.

## UI

### Segmented Control

- iOS-style segmented control in `PWAFeatureBrowserOptions` bar (alongside existing controls)
- Two segments: "Mobile" | "Desktop"
- Default: "Mobile" (preserves current behavior)
- Built with `UButtonGroup` + `UButton`

### Layout

No layout changes. Still 3 browsers, still 3 columns (desktop viewport) or tabs (mobile viewport). The grid structure stays identical.

### Behavior on Toggle

- Browser columns swap to the 3 desktop browsers
- Scores recalculate for desktop support data
- On mobile viewport (< lg), browser tabs update to desktop browser names/icons
- Accordion expand/collapse state preserved across toggle (same feature list, different support data)

### i18n

Add translation keys (en + fr):

- `options.mobile` / `options.desktop` — segmented control labels
- Desktop platform strings: "Cross-platform", "macOS"

## Files Changed

### Source files (~8 files modified, no new files)

1. `app/composables/useBrowserSupport.ts` — expand `BrowserId`, add `Platform` type, expand `browserConfig`, add `getBrowsersForPlatform()`
2. `app/utils/canIUseLoader.ts` — extract desktop agent keys
3. `app/data/manual-browser-support.json` — add desktop entries
4. `app/data/manual-browser-support.schema.ts` — expand schema
5. `app/components/PWAFeatureBrowserOptions.vue` — add segmented control
6. `app/components/PWAFeatureBrowser.vue` — accept platform prop, pass to composables
7. `i18n/locales/en.json` — desktop labels and platform strings
8. `i18n/locales/fr.json` — French translations

### Test files (existing files extended, no new files)

- `app/composables/useBrowserScore.test.ts` — desktop `BrowserId` inputs
- `app/composables/useBrowserSupport.test.ts` — desktop support resolution
- `app/utils/canIUseLoader.test.ts` — desktop agent key extraction
- `app/data/manual-browser-support.data.test.ts` — desktop entry validation
