<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('site.title'),
  description: () => t('hero.description')
})
</script>

<template>
  <div class="pb-16">
    <UPageHero
      :title="t('hero.title')"
      :description="t('hero.description')"
      :ui="{
        container: '!pb-12 pt-6 lg:pt-12',
        title: 'max-w-3xl mx-auto'
      }"
    />

    <PWAFeatureBrowser />
  </div>
</template>
