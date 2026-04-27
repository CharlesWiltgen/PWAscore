<script setup lang="ts">
const { t } = useI18n()
const head = useLocaleHead({ seo: true })
const colorMode = useColorMode()

const color = computed(() => (colorMode.value === 'dark' ? '#171717' : 'white'))

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
    ...(head.value.meta || [])
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    ...(head.value.link || [])
  ],
  htmlAttrs: {
    lang: head.value.htmlAttrs?.lang
  }
})

const siteUrl = 'https://pwascore.com'
const siteTitle = computed(() => t('site.title'))
const siteDescription = computed(() => t('site.description'))
const ogImageUrl = `${siteUrl}/og-image.png`

useSeoMeta({
  title: () => siteTitle.value,
  description: () => siteDescription.value,

  ogType: 'website',
  ogUrl: siteUrl,
  ogTitle: () => siteTitle.value,
  ogDescription: () => siteDescription.value,
  ogImage: ogImageUrl,
  ogImageWidth: '1200',
  ogImageHeight: '630',
  ogImageAlt: () => t('site.ogImageAlt'),
  ogSiteName: 'PWAscore',

  twitterCard: 'summary_large_image',
  twitterTitle: () => siteTitle.value,
  twitterDescription: () => siteDescription.value,
  twitterImage: ogImageUrl,
  twitterImageAlt: () => t('site.ogImageAlt')
})
</script>

<template>
  <UApp :toaster="{ expand: false }">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
    >
      {{ t('nav.skipToContent') }}
    </a>

    <UBanner :ui="{ container: 'flex items-center justify-center gap-3 h-12', title: 'text-md', root: '-my-0.5' }">
      <template #title>
        <span class="hidden lg:inline">{{ t('banner.reportIssuesAt') }}</span> <a
          href="https://github.com/charleswiltgen/pwascore/issues"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 hover:underline ml-0.5"
          :aria-label="t('banner.reportIssuesGitHub')"
        >
          <UIcon
            name="i-simple-icons-github"
            class="w-5 h-5 relative top-[4px]"
          />
        </a>
      </template>
    </UBanner>

    <AppHeader />

    <UMain id="main-content">
      <NuxtPage />
    </UMain>

    <AppFooter />
  </UApp>
</template>
