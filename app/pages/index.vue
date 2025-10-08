<script setup lang="ts">
useSeoMeta({
  title: 'PWAscore - PWA Browser Scorecards',
  description:
    'Compare Progressive Web App support across popular mobile and desktop browsers. Get definitive scores and settle developer arguments.'
})
</script>

<template>
  <div class="pb-16">
    <UPageHero
      title="PWA Browser Scorecards"
      description="Compare Progressive Web App capabilities across popular mobile and desktop browsers."
      :ui="{
        container: '!pb-15 pt-0 lg:pt-12',
        title: 'max-w-3xl mx-auto'
      }"
    />

    <PWAFeatureBrowser />
  </div>
</template>
