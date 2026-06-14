# French Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add French localization to PWAscore using @nuxtjs/i18n with prefix_except_default routing strategy.

**Architecture:** Install @nuxtjs/i18n, extract ~60 UI strings into locale JSON files (en/fr), localize the about page via per-locale TS content files, add a language switcher to the header. Feature names/API names in pwa-features.json are technical terms and stay in English. Feature descriptions are deferred to a future phase.

**Tech Stack:** @nuxtjs/i18n (Nuxt I18n v10), Vue I18n Composition API

**Critical implementation notes:**

- All `NuxtLink to="/path"` must use `useLocalePath('/path')` — hardcoded paths break the French locale
- `langDir: 'i18n/locales'` is required in the i18n config so locale files are found
- The hardcoded `ogLocale: 'en_US'` in app.vue must be removed — `useLocaleHead()` handles it
- `nitro.prerender.routes` must include `/fr` and `/fr/about` for Cloudflare deployment

---

## Scoping Decision: What Gets Translated

| Content                                         | Translate?   | Rationale                      |
| ----------------------------------------------- | ------------ | ------------------------------ |
| UI chrome (nav, labels, tooltips, buttons)      | Yes          | ~60 strings, high user impact  |
| About page prose                                | Yes          | User-facing content page       |
| SEO metadata (title, description, OG tags)      | Yes          | Locale-aware SEO               |
| Screen reader announcements & aria-labels       | Yes          | Accessibility parity           |
| Feature names (Push API, IndexedDB, etc.)       | No           | Universal technical/API terms  |
| Feature descriptions in pwa-features.json       | No (phase 2) | 200+ descriptions, high effort |
| Support level labels (Supported, Partial, etc.) | Yes          | Short UI labels                |

## File Structure

```
src/
├── i18n/
│   ├── i18n.config.ts          # CREATE - Vue I18n runtime config
│   ├── schema.ts               # CREATE - TypeScript message schema
│   └── locales/
│       ├── en.json             # CREATE - English UI strings (~60 keys)
│       └── fr.json             # CREATE - French UI strings (~60 keys)
├── content/
│   └── about/                  # May need restructuring for locale content
├── nuxt.config.ts              # MODIFY - Add @nuxtjs/i18n module + config
├── app/
│   ├── app.vue                 # MODIFY - Add useLocaleHead(), localize strings
│   ├── components/
│   │   ├── AppHeader.vue       # MODIFY - Add language switcher, localize
│   │   ├── AppFooter.vue       # MODIFY - Localize strings
│   │   ├── PWAFeatureBrowser.vue        # MODIFY - Localize UI strings
│   │   └── PWAFeatureBrowserOptions.vue # MODIFY - Localize UI strings
│   └── pages/
│       ├── index.vue           # MODIFY - Localize SEO meta + hero
│       └── about.vue           # MODIFY - Locale-aware content loading
```

---

### Task 1: Install @nuxtjs/i18n and configure

**Files:**

- Modify: `src/nuxt.config.ts`
- Create: `src/i18n/i18n.config.ts`
- Create: `src/i18n/schema.ts`
- Create: `src/i18n/locales/en.json`
- Create: `src/i18n/locales/fr.json`

- [ ] **Step 1: Install the package**

```bash
cd src && pnpm add @nuxtjs/i18n
```

- [ ] **Step 2: Create English locale file with all UI strings**

Create `src/i18n/locales/en.json`:

```json
{
  "site": {
    "name": "PWAscore",
    "title": "PWAscore - PWA Browser Scorecards",
    "description": "Compare Progressive Web App capabilities across popular mobile browsers. See which browsers best support PWA features like Service Workers, Web App Manifest, and more.",
    "ogImageAlt": "PWAscore - Compare PWA support across mobile browsers"
  },
  "banner": {
    "previewRelease": "This is a {strong} of PWAscore",
    "previewReleaseStrong": "preview release",
    "reportIssuesAt": "Please report issues at",
    "reportIssuesGitHub": "Report issues on GitHub"
  },
  "nav": {
    "skipToContent": "Skip to main content",
    "about": "About"
  },
  "hero": {
    "title": "PWA Browser Scorecards",
    "description": "Compare Progressive Web App capabilities across popular mobile (and soon, desktop) browsers."
  },
  "browser": {
    "for": "for",
    "version": "Version {version}",
    "scoreLabel": "{name} score: {score}. Press for details.",
    "selectBrowser": "Select browser",
    "showing": "Showing {name}",
    "allExpanded": "All groups expanded",
    "allCollapsed": "All groups collapsed",
    "platform": {
      "android": "Android",
      "ios": "iOS"
    }
  },
  "scores": {
    "stableFeatures": "Stable features:",
    "raw": "{score} raw",
    "withExperimental": "With experimental/non-standard:",
    "weightedAndRaw": "{weighted} weighted, {raw} raw"
  },
  "support": {
    "supported": "Supported",
    "partial": "Partial",
    "notSupported": "Not Supported",
    "unknown": "Unknown"
  },
  "features": {
    "experimental": "Experimental: This feature is experimental and subject to change",
    "nonStandard": "Non-standard: This feature is not on the standards track",
    "deprecated": "Deprecated: This feature is deprecated and may be removed",
    "viewOnCIU": "{name} on Can I Use",
    "viewOnMDN": "{name} on MDN Web Docs",
    "ciuTooltip": "View browser compatibility on Can I Use",
    "mdnTooltip": "View documentation on MDN Web Docs",
    "experimentalHidden": "Experimental features hidden",
    "experimentalShown": "Experimental features shown"
  },
  "options": {
    "hideExperimental": "Hide Experimental",
    "expandAll": "Expand All",
    "collapseAll": "Collapse All",
    "howScoresWork": "How Scores Work"
  },
  "scoresInfo": {
    "title": "About PWA Scores:",
    "weightedImportance": "The main score shown is weighted for feature importance",
    "stableOnly": "Only stable (non-experimental) features are counted",
    "tapOrHover": "Tap or hover any score to see:",
    "rawScores": "Raw scores (simple % of supported features)",
    "experimentalScores": "Experimental feature scores",
    "learnMore": "Learn more about our methodology on the",
    "aboutPage": "About page"
  },
  "footer": {
    "dataSources": "Data sourced from {ciu} (CC BY 4.0) and {mdn} (CC0)",
    "copyright": "© {year} by Charles Wiltgen",
    "blueskyLabel": "Charles Wiltgen on Bluesky",
    "githubLabel": "PWAscore on GitHub"
  },
  "about": {
    "title": "About — PWAscore",
    "description": "Learn about PWAscore, the definitive Progressive Web App browser scorecard that helps developers compare PWA support across browsers.",
    "heading": "About PWAscore"
  }
}
```

- [ ] **Step 3: Create French locale file**

Create `src/i18n/locales/fr.json` with the same keys, translated to French. Use a native-quality translation (not machine-translated feel). Keep technical terms (PWA, API names, Can I Use, MDN, GitHub) in English.

```json
{
  "site": {
    "name": "PWAscore",
    "title": "PWAscore - Fiches d'évaluation PWA des navigateurs",
    "description": "Comparez les capacités des Progressive Web Apps sur les navigateurs mobiles populaires. Découvrez quels navigateurs prennent le mieux en charge les fonctionnalités PWA.",
    "ogImageAlt": "PWAscore - Comparez la prise en charge PWA entre navigateurs mobiles"
  },
  "banner": {
    "previewRelease": "Ceci est une {strong} de PWAscore",
    "previewReleaseStrong": "version préliminaire",
    "reportIssuesAt": "Signalez les problèmes sur",
    "reportIssuesGitHub": "Signaler un problème sur GitHub"
  },
  "nav": {
    "skipToContent": "Aller au contenu principal",
    "about": "À propos"
  },
  "hero": {
    "title": "Fiches d'évaluation PWA des navigateurs",
    "description": "Comparez les capacités des Progressive Web Apps sur les navigateurs mobiles populaires (et bientôt de bureau)."
  },
  "browser": {
    "for": "pour",
    "version": "Version {version}",
    "scoreLabel": "Score {name} : {score}. Appuyez pour les détails.",
    "selectBrowser": "Sélectionner un navigateur",
    "showing": "Affichage de {name}",
    "allExpanded": "Tous les groupes développés",
    "allCollapsed": "Tous les groupes réduits",
    "platform": {
      "android": "Android",
      "ios": "iOS"
    }
  },
  "scores": {
    "stableFeatures": "Fonctionnalités stables :",
    "raw": "{score} brut",
    "withExperimental": "Avec expérimentales/non standard :",
    "weightedAndRaw": "{weighted} pondéré, {raw} brut"
  },
  "support": {
    "supported": "Pris en charge",
    "partial": "Partiel",
    "notSupported": "Non pris en charge",
    "unknown": "Inconnu"
  },
  "features": {
    "experimental": "Expérimental : cette fonctionnalité est expérimentale et peut évoluer",
    "nonStandard": "Non standard : cette fonctionnalité ne fait pas partie des standards",
    "deprecated": "Obsolète : cette fonctionnalité est obsolète et pourrait être supprimée",
    "viewOnCIU": "{name} sur Can I Use",
    "viewOnMDN": "{name} sur MDN Web Docs",
    "ciuTooltip": "Voir la compatibilité navigateur sur Can I Use",
    "mdnTooltip": "Voir la documentation sur MDN Web Docs",
    "experimentalHidden": "Fonctionnalités expérimentales masquées",
    "experimentalShown": "Fonctionnalités expérimentales affichées"
  },
  "options": {
    "hideExperimental": "Masquer les expérimentales",
    "expandAll": "Tout développer",
    "collapseAll": "Tout réduire",
    "howScoresWork": "Calcul des scores"
  },
  "scoresInfo": {
    "title": "À propos des scores PWA :",
    "weightedImportance": "Le score principal est pondéré selon l'importance des fonctionnalités",
    "stableOnly": "Seules les fonctionnalités stables (non expérimentales) sont comptées",
    "tapOrHover": "Appuyez ou survolez un score pour voir :",
    "rawScores": "Scores bruts (pourcentage simple de fonctionnalités prises en charge)",
    "experimentalScores": "Scores des fonctionnalités expérimentales",
    "learnMore": "En savoir plus sur notre méthodologie sur la",
    "aboutPage": "page À propos"
  },
  "footer": {
    "dataSources": "Données issues de {ciu} (CC BY 4.0) et {mdn} (CC0)",
    "copyright": "© {year} par Charles Wiltgen",
    "blueskyLabel": "Charles Wiltgen sur Bluesky",
    "githubLabel": "PWAscore sur GitHub"
  },
  "about": {
    "title": "À propos — PWAscore",
    "description": "Découvrez PWAscore, la fiche d'évaluation PWA de référence qui aide les développeurs à comparer la prise en charge PWA entre navigateurs.",
    "heading": "À propos de PWAscore"
  }
}
```

- [ ] **Step 4: Create TypeScript message schema**

Create `src/i18n/schema.ts`:

```ts
import type en from './locales/en.json'

export type MessageSchema = typeof en
```

- [ ] **Step 5: Create i18n runtime config**

Create `src/i18n/i18n.config.ts`:

```ts
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en'
}))
```

- [ ] **Step 6: Add @nuxtjs/i18n to nuxt.config.ts**

Add the module and i18n config block to `src/nuxt.config.ts`. Add `'@nuxtjs/i18n'` to the modules array. Add the `i18n` key with:

Also update `nitro.prerender.routes` to include `['/']` (already there), `'/fr'`, and `'/fr/about'`.

```ts
i18n: {
  defaultLocale: 'en',
  strategy: 'prefix_except_default',
  langDir: 'i18n/locales',
  baseUrl: 'https://pwascore.com',
  detectBrowserLanguage: {
    useCookie: true,
    redirectOn: 'root'
  },
  locales: [
    {
      code: 'en',
      language: 'en-US',
      name: 'English',
      file: 'en.json'
    },
    {
      code: 'fr',
      language: 'fr-FR',
      name: 'Français',
      file: 'fr.json'
    }
  ]
}
```

- [ ] **Step 7: Verify the app starts with i18n**

```bash
cd src && pnpm run dev
```

Visit http://localhost:3000 — should render as before (English, no prefix).
Visit http://localhost:3000/fr — should render the same (strings not wired yet, but no crash).

- [ ] **Step 8: Run typecheck**

```bash
pnpm run precommit
```

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(i18n): add @nuxtjs/i18n with English and French locale files"
```

---

### Task 2: Localize app.vue (skip link, banner, SEO, head)

**Files:**

- Modify: `src/app/app.vue`

- [ ] **Step 1: Wire up useI18n, useLocaleHead, and localized strings**

In `app.vue`:

- Add `const { t } = useI18n()` and `const head = useLocaleHead({ addSeoAttributes: true })`
- Replace hardcoded `lang: 'en'` htmlAttrs — `useLocaleHead()` sets this automatically
- Remove hardcoded `ogLocale: 'en_US'` — `useLocaleHead()` handles locale-specific OG tags
- Replace `siteTitle`, `siteDescription`, `ogImageAlt` with `t()` calls
- Replace skip link text with `{{ t('nav.skipToContent') }}`
- Replace banner text with `t()` calls
- Use `useHead` to merge the locale head attributes

- [ ] **Step 2: Verify English still works, check /fr route**

- [ ] **Step 3: Run precommit**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(i18n): localize app.vue — SEO, banner, skip link"
```

---

### Task 3: Localize AppHeader with language switcher

**Files:**

- Modify: `src/app/components/AppHeader.vue`

- [ ] **Step 1: Add language switcher and localize nav**

- Add `const { t } = useI18n()`, `const switchLocalePath = useSwitchLocalePath()`, and `const localePath = useLocalePath()`
- Replace "About" with `{{ t('nav.about') }}`
- Replace "PWAscore" with `{{ t('site.name') }}`
- **Critical:** Replace hardcoded `to="/"` with `:to="localePath('/')"` and `to="/about"` with `:to="localePath('/about')"` — without this, links from `/fr` pages navigate back to English
- Add a locale switcher button/link next to the color mode button using `switchLocalePath`
- Use the locale's `name` field for display (e.g., "Français" / "English")

- [ ] **Step 2: Verify switching between /en and /fr works**

- [ ] **Step 3: Run precommit**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(i18n): add language switcher to header, localize nav"
```

---

### Task 4: Localize PWAFeatureBrowserOptions

**Files:**

- Modify: `src/app/components/PWAFeatureBrowserOptions.vue`

- [ ] **Step 1: Replace all hardcoded strings with t() calls**

- "Hide Experimental" → `t('options.hideExperimental')`
- "Expand All" / "Collapse All" → `t('options.expandAll')` / `t('options.collapseAll')`
- "How Scores Work" → `t('options.howScoresWork')`
- All scores info panel text → corresponding `t('scoresInfo.*')` calls
- "About page" link → `t('scoresInfo.aboutPage')` with **`useLocalePath('/about')`** for the `NuxtLink to` (hardcoded `/about` breaks French locale)

- [ ] **Step 2: Verify both locales render correctly**

- [ ] **Step 3: Run precommit**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(i18n): localize options bar and scores info panel"
```

---

### Task 5: Localize PWAFeatureBrowser

**Files:**

- Modify: `src/app/components/PWAFeatureBrowser.vue`

- [ ] **Step 1: Localize browser header area**

- "for" → `t('browser.for')`
- "Version {version}" → `t('browser.version', { version: browser.version })`
- Platform sr-only text → `t('browser.platform.android')` / `t('browser.platform.ios')`
- Score aria-label → `t('browser.scoreLabel', { name: browser.name, score: ... })`
- Section heading → use `t()` for the sr-only h2

- [ ] **Step 2: Localize tooltip content**

- "Stable features:" → `t('scores.stableFeatures')`
- Raw/weighted score text → `t('scores.raw', { score })`, `t('scores.weightedAndRaw', { weighted, raw })`
- "With experimental/non-standard:" → `t('scores.withExperimental')`

- [ ] **Step 3: Localize support badges and feature status tooltips**

- getSupportLabel() → return `t('support.*')` values
- Experimental/Non-standard/Deprecated tooltip text → `t('features.*')`
- CIU/MDN aria-labels → `t('features.viewOnCIU', { name })`, `t('features.viewOnMDN', { name })`
- CIU/MDN tooltip text → `t('features.ciuTooltip')`, `t('features.mdnTooltip')`

- [ ] **Step 4: Localize screen reader announcements**

- "All groups expanded" → `t('browser.allExpanded')`
- "All groups collapsed" → `t('browser.allCollapsed')`
- "Showing {name}" → `t('browser.showing', { name })`
- "Experimental features hidden/shown" → `t('features.experimentalHidden')` / `t('features.experimentalShown')`
- "Select browser" → `t('browser.selectBrowser')`

- [ ] **Step 5: Verify both locales render correctly**

- [ ] **Step 6: Run precommit**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(i18n): localize browser comparison component"
```

---

### Task 6: Localize AppFooter

**Files:**

- Modify: `src/app/components/AppFooter.vue`

- [ ] **Step 1: Replace all hardcoded strings**

- Data sources sentence → use `t('footer.dataSources', { ciu, mdn })` with Vue I18n's component interpolation to embed the `<a>` links for Can I Use and MDN BCD inside the translated string. The license text (CC BY 4.0, CC0) is part of the message string itself.
- Copyright text → `t('footer.copyright', { year: new Date().getFullYear() })`
- Aria-labels → `t('footer.blueskyLabel')`, `t('footer.githubLabel')`

- [ ] **Step 2: Verify both locales**

- [ ] **Step 3: Run precommit**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(i18n): localize footer"
```

---

### Task 7: Localize index page (hero + SEO)

**Files:**

- Modify: `src/app/pages/index.vue`

- [ ] **Step 1: Localize SEO meta and hero props**

- `useSeoMeta` title/description → use `t()` calls
- UPageHero title → `t('hero.title')`
- UPageHero description → `t('hero.description')`

- [ ] **Step 2: Verify both locales**

- [ ] **Step 3: Run precommit**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(i18n): localize home page hero and SEO meta"
```

---

### Task 8: Localize about page

**Files:**

- Modify: `src/app/pages/about.vue`
- Create: `src/content/about.en.md` (or use @nuxt/content locale support)

The about page currently has markdown content inline in the Vue file. Two options:

**Option A (simpler):** Keep content inline, use `t()` for SEO meta and heading, and create two markdown content strings in the locale files (one key with the full markdown).

**Option B (cleaner):** Move content to @nuxt/content markdown files with locale suffixes (`about.en.md`, `about.fr.md`) and load via `queryContent().locale()`.

Recommend **Option A** for simplicity since the content is already inline and short. Put the markdown body in a separate file that gets imported per locale, since JSON doesn't handle multiline well.

- [ ] **Step 1: Create locale-specific about content files**

Create `src/i18n/content/about.en.ts` and `src/i18n/content/about.fr.ts` exporting the markdown string for each locale.

- [ ] **Step 2: Localize about.vue**

- SEO meta → `t('about.title')`, `t('about.description')`
- Page header → `t('about.heading')`
- Load content from locale-specific file based on current locale

- [ ] **Step 3: Verify both locales**

- [ ] **Step 4: Run precommit**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(i18n): localize about page with French content"
```

---

### Task 9: Final integration testing and cleanup

- [ ] **Step 1: Full smoke test**

Test the following flows:

- Visit `/` — English, no prefix, all strings in English
- Visit `/fr` — French, all strings in French
- Click language switcher on `/` — navigates to `/fr`
- Click language switcher on `/fr` — navigates to `/`
- Visit `/about` — English about page
- Visit `/fr/about` — French about page
- Check that browser detection cookie works (visit `/`, close, reopen)
- Verify `hideExperimental` query param works on both locales
- Verify keyboard shortcut (Ctrl+E) works on both locales
- Verify mobile browser tab switching works on both locales

- [ ] **Step 2: Verify SEO output**

Check rendered HTML for:

- `<html lang="en">` on English pages
- `<html lang="fr">` on French pages
- `hreflang` alternate links present
- OG locale tags present
- Canonical URLs correct

- [ ] **Step 3: Run full test suite**

```bash
pnpm run test
pnpm run precommit
```

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat(i18n): complete French localization integration"
```

---

## Future Phases (out of scope)

- **Phase 2:** Translate pwa-features.json descriptions (200+ entries)
- **Phase 3:** Add more locales (es, de, ja, zh, etc.)
- **Phase 4:** Community translation workflow (Crowdin, Weblate, or similar)
