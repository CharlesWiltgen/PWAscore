# PWAscore.com - Source Code

The authoritative PWA browser compatibility reference, built with Nuxt 4 and deployed on Cloudflare Workers.

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

## Architecture

### Tech Stack
- **Nuxt 4**: Latest Nuxt with app/ directory structure
- **Vue 3**: Composition API with TypeScript
- **Nuxt UI v4**: Tailwind-based component library
- **Cloudflare Workers**: Edge-optimized deployment
- **CanIUse Data**: Real browser compatibility data

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

### Current Browser Versions

**Dynamically derived from CanIUse data** in `app/utils/canIUseLoader.ts`:
- Chrome for Android: Uses `agents.and_chr.current_version`
- Firefox for Android: Uses `agents.and_ff.current_version`
- Safari on iOS: Finds highest iOS version from `agents.ios_saf.version_list`

Versions automatically stay current with CanIUse data (no manual updates needed).

## Deployment

Deploys to Cloudflare Workers via Wrangler:

```bash
pnpm deploy
```

**Configuration:** `wrangler.toml`
- Compatibility flags: `nodejs_compat`
- Assets directory: `.output/public`
- Main entry: `.output/server/index.mjs`

## Adding New Features

1. Add feature to `app/data/pwa-features.ts` with CanIUse ID
2. Data automatically fetched on mount
3. Support status and score update automatically

## Performance

- Bundle size: ~855 KB gzipped
- Worker startup: ~39ms
- Edge caching: 1-day TTL
- Global CDN distribution via Cloudflare

## Known Issues

- Development mode doesn't use Cache API (production only)
- Some CanIUse IDs may return 'unknown' if not found
- Deployment shows harmless esbuild warnings (safe to ignore)

See parent [README.md](../README.md) for project overview and roadmap.
