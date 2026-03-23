<script setup lang="ts">
import aboutEn from '../../i18n/content/about.en'
import aboutFr from '../../i18n/content/about.fr'

const { t, locale } = useI18n()

useSeoMeta({
  title: () => t('about.title'),
  description: () => t('about.description')
})

const content = computed(() => locale.value === 'fr' ? aboutFr : aboutEn)
</script>

<template>
  <UContainer>
    <UPageHeader
      :title="t('about.heading')"
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
