<script setup lang="ts">
useSeoMeta({
  title: 'About — PWAscore',
  description:
    'Learn about PWAscore, the definitive Progressive Web App browser scorecard that helps developers compare PWA support across browsers.'
})

const content = `
PWAscore provides objective, data-driven comparisons of Progressive Web App (PWA) capabilities across popular mobile (and soon, desktop) browsers.

## Why

I built this to scratch an itch and fill an informational vacuum. Instead of relying on anecdotes or outdated information, PWAscores are based on data sourced from authoritative compatibility databases, augmented by research to also address experimental and vendor-specific features.

## What

PWAscore evaluates browsers across 200+ PWA features, including:

- **Installation & Lifecycle** — App install prompts, standalone mode, service workers
- **Device Integration** — Camera, geolocation, sensors, file system access
- **Offline Capabilities** — Background sync, caching strategies, offline detection
- **UI/UX Features** — Display modes, splash screens, app shortcuts
- **Performance APIs** — Web Workers, IndexedDB, Cache API

Each feature is weighted by importance, with core PWA capabilities counting more than experimental features. Browsers receive separate scores for stable features (production-ready) and all features (including experimental).

## Where

All compatibility data comes from two trusted sources:

- [Can I Use](https://caniuse.com) (CC BY 4.0) — Browser feature compatibility tables
- [MDN Browser Compat Data](https://github.com/mdn/browser-compat-data) (CC0) — Feature status and standardization info

Browser versions are automatically derived from this data, ensuring PWAscore always reflects the latest releases.

## How

PWAscore is built with these modern web technologies:

- **TypeScript** — Type-safe development
- **Vue 3** — Reactive UI framework
- **Nuxt 4** — Full-stack Vue framework
- **Nuxt UI** — Tailwind-based component library
- **Cloudflare Workers** — Edge-optimized global deployment

The site is open source and available on [GitHub](https://github.com/CharlesWiltgen/PWAscore).

## About the Author

PWAscore was created by [Charles Wiltgen](https://github.com/CharlesWiltgen).

## Contributing

Found an issue or have a suggestion? Please [open an issue on GitHub](https://github.com/CharlesWiltgen/PWAscore/issues).
`
</script>

<template>
  <UContainer>
    <UPageHeader
      title="About PWAscore"
      :ui="{
        wrapper: 'py-8 lg:py-12 lg:pb-0'
      }"
    />

    <UPageBody
      prose
      class="prose-headings:scroll-mt-20"
    >
      <MDC
        :value="content"
        tag="article"
      />
    </UPageBody>
  </UContainer>
</template>
