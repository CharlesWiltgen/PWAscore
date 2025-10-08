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

useSeoMeta({
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/landing-light.png',
  twitterImage: 'https://ui.nuxt.com/assets/templates/nuxt/landing-light.png',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp :toaster="{ expand: false }">
    <UBanner :ui="{ title: 'text-lg' }">
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
