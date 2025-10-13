<script setup lang="ts">
useSeoMeta({
  title: 'PWAscore - PWA Browser Scorecards',
  description:
    'Compare Progressive Web App support across popular mobile (and soon, desktop) browsers.'
})
</script>

<template>
  <div class="pb-16">
    <UPageHero
      title="PWA Browser Scorecards"
      description="Compare Progressive Web App capabilities across popular mobile (and soon, desktop) browsers."
      :ui="{
        container: '!pb-12 pt-6 lg:pt-12',
        title: 'max-w-3xl mx-auto'
      }"
    />

    <PWAFeatureBrowser />
  </div>
</template>
