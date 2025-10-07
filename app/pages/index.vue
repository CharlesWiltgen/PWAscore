<script setup lang="ts">
useSeoMeta({
  title: 'PWAscore - The PWA Browser Compatibility Reference',
  description:
    'Compare Progressive Web App support across popular mobile and desktop browsers. Get definitive scores and settle developer arguments.'
})
</script>

<template>
  <div class="pb-16">
    <UPageHero
      title="The PWA Browser Compatibility Reference"
      description="Compare Progressive Web App capabilities across popular mobile and desktop browsers. PWAscore provides support data to help inform implementation decisions."
      :ui="{
        container: '!pb-15 pt-3 lg:pt-15',
        title: 'max-w-3xl mx-auto'
      }"
    />

    <PWAFeatureBrowser />
  </div>
</template>
