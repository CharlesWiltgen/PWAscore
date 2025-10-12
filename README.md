# PWAscore

[PWAscore](https://pwascore.com/) gives popular browsers a score based on their support for [Progressive web apps](https://en.wikipedia.org/wiki/Progressive_web_app) features.

## Architecture

### Tech Stack

- **Nuxt 4** – Latest Nuxt framework
- **Vue 3** – Composition API with TypeScript
- **Nuxt UI** – Tailwind-based component library
- **Cloudflare Workers** – Edge-optimized deployment
- **CanIUse Data** – Real browser compatibility data

### Key Files

```
app/
├── components/
│   └── PWAFeatureBrowser.vue    # Main 3-column browser view
├── composables/
│   ├── useBrowserSupport.ts     # Browser support data fetching
│   └── useBrowserScore.ts       # Score calculation logic
├── data/
│   └── pwa-features.ts          # 200+ PWA features catalog
├── pages/
│   └── index.vue                # Homepage
└── utils/
    └── canIUseLoader.ts         # CanIUse data loader with edge caching
```

### Browser Support System

**Data Flow:**

1. PWA features defined in `app/data/pwa-features.ts`
2. CanIUse IDs mapped to each feature
3. Data fetched from GitHub and cached at Cloudflare edge
4. `useBrowserSupport` composable manages caching and lookup
5. `useBrowserScore` calculates weighted scores

**Caching Strategy:**

- Cloudflare Cache API for production (1-day TTL)
- In-memory cache for development
- Version-based cache invalidation

### Scoring System

**Dual Score Approach:**

PWAscore uses two scoring systems to provide accurate, production-focused metrics:

**Primary Score (Displayed):**

- Excludes experimental features (`status.experimental === true`)
- Excludes non-standard features (`status.standard_track === false`)
- Excludes deprecated features (`status.deprecated === true`)
- Reflects production-ready PWA support
- Weighted by feature importance (core features count more)

**Full Score (Tooltip):**

- Includes all features regardless of status
- Shows complete browser PWA capabilities
- Includes both weighted and unweighted percentages

**Design Philosophy:**

The weighting system ensures scores reflect production-ready PWA capabilities rather than raw feature counts. Not all web platform capabilities are equally important for building legitimate PWA alternatives to native apps.

**Weight Tiers:**

- **3.0** — Core PWA features (Web App Manifest, Service Workers)
- **2.0** — Important features (Push Notifications, Background Sync, Add to Home Screen)
- **1.0** — Standard features (default weight)
- **0.5** — Nice-to-have/experimental features (WebXR/AR/VR, experimental APIs)

This prevents browsers from inflating scores with niche capabilities while lacking fundamentals. For example, a browser supporting AR/VR (0.5 weight) but missing Service Workers (3.0 weight) will score appropriately low, reflecting the reality that it cannot support most production PWAs.

**Example:**

```
Primary display: 85
Tooltip:
  Stable features: 85 raw
  With experimental/non-standard:
    90 weighted, 87 raw
```

**Status Indicators:**

- 🧪 Flask icon: Experimental feature
- ⚠️ Triangle icon: Non-standard feature
- ❌ X-circle icon: Deprecated feature

Status data sourced from [MDN Browser Compatibility Data](https://github.com/mdn/browser-compat-data).

### Current Browser Versions

**Dynamically derived from CanIUse data** in `app/utils/canIUseLoader.ts`

- Chrome for Android: Uses `agents.and_chr.current_version`
- Firefox for Android: Uses `agents.and_ff.current_version`
- Safari for iOS: Finds highest iOS version from `agents.ios_saf.version_list`

Versions automatically stay current with CanIUse data (no manual updates needed).

## Features

### Expand all

Meta-click (⌘ on Mac, Windows key on Windows) on any feature group to see all sub-categories and their features.

## Deployment

Deploys to Cloudflare Workers via Wrangler:

```bash
pnpm deploy
```

## Performance

- Bundle size: ~855 KB gzipped
- Worker startup: ~39ms
- Edge caching: 1-day TTL
- Global CDN distribution via Cloudflare

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (localhost:3000)
pnpm dev

# Type check
pnpm typecheck

# Lint code
pnpm lint

# Format code
pnpm prettier:fix

# Build for production
pnpm build

# Deploy to Cloudflare Workers
pnpm deploy
```
