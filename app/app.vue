<script setup lang="ts">
const colorMode = useColorMode()

const color = computed(() => (colorMode.value === 'dark' ? '#171717' : 'white'))

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'en'
  }
})

const siteUrl = 'https://pwascore.com'
const siteTitle = 'PWAscore - PWA Browser Scorecards'
const siteDescription
  = 'Compare Progressive Web App capabilities across popular mobile browsers. See which browsers best support PWA features like Service Workers, Web App Manifest, and more.'
const ogImageUrl = `${siteUrl}/og-image.png`

useSeoMeta({
  // Basic Meta
  title: siteTitle,
  description: siteDescription,

  // Open Graph (Facebook, LinkedIn, Bluesky)
  ogType: 'website',
  ogUrl: siteUrl,
  ogTitle: siteTitle,
  ogDescription: siteDescription,
  ogImage: ogImageUrl,
  ogImageWidth: '1200',
  ogImageHeight: '630',
  ogImageAlt: 'PWAscore - Compare PWA support across mobile browsers',
  ogSiteName: 'PWAscore',
  ogLocale: 'en_US',

  // Twitter Cards
  twitterCard: 'summary_large_image',
  twitterTitle: siteTitle,
  twitterDescription: siteDescription,
  twitterImage: ogImageUrl,
  twitterImageAlt: 'PWAscore - Compare PWA support across mobile browsers',
  twitterSite: '@pwascore',
  twitterCreator: '@pwascore'
})
</script>

<template>
  <UApp :toaster="{ expand: false }">
    <UBanner :ui="{ title: 'text-md', root: '-my-0.5' }">
      <template #title>
        <span>This is a <strong>preview release</strong> of PWAscore • Please
          report issues at
          <a
            href="https://github.com/charleswiltgen/pwascore/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 hover:underline ml-[1px]"
          >
            <UIcon
              name="i-simple-icons-github"
              class="w-5 h-5 relative top-[4px]"
            />
          </a>
        </span>
      </template>
    </UBanner>

    <AppHeader />

    <UMain>
      <NuxtPage />
    </UMain>

    <AppFooter />
  </UApp>
</template>
