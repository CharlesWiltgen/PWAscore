<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()

const otherLocale = computed(() =>
  (locales.value as Array<{ code: string, name: string }>)
    .find(l => l.code !== locale.value)!
)

// Use setLocale (navigates to the chosen locale) and record the choice in the
// cookie the root decision reads (server/plugins/locale-choice.ts) — without it,
// "/" would fall back to Accept-Language on the next visit and a French-preferring
// browser could never stay on English. Keep the href for SEO/right-click;
// intercept the normal click.
function changeLocale(code: 'en' | 'fr'): void {
  const { langChoiceCookie } = useRuntimeConfig().public
  document.cookie = `${langChoiceCookie}=${code}; path=/; max-age=31536000; samesite=lax`
  setLocale(code)
}
</script>

<template>
  <UHeader
    :toggle="false"
    :ui="{
      root: 'relative lg:sticky lg:top-0 lg:z-50'
    }"
  >
    <template #left>
      <NuxtLink
        :to="localePath('/')"
        class="flex items-center gap-2"
      >
        <span class="text-xl font-bold text-primary">{{ t('site.name') }}</span>
      </NuxtLink>
    </template>

    <template #right>
      <div class="flex items-center gap-3">
        <NuxtLink
          :to="localePath('/about')"
          class="text-sm font-medium hover:text-primary transition-colors"
        >
          {{ t('nav.about') }}
        </NuxtLink>
        <!-- prefetch={false}: Nuxt prefetches a visible link's payload, and the
             i18n server plugin writes the i18n_redirected cookie for any
             locale-prefixed route it serves — so prefetching /fr on an English
             page silently re-armed French and the next load of / bounced to /fr
             (the switch never stuck, and Chrome kept offering to translate). -->
        <NuxtLink
          :to="switchLocalePath(otherLocale.code as 'en' | 'fr')"
          :prefetch="false"
          class="text-sm font-medium hover:text-primary transition-colors"
          @click.prevent="changeLocale(otherLocale.code as 'en' | 'fr')"
        >
          {{ otherLocale.name }}
        </NuxtLink>
        <UColorModeButton />
      </div>
    </template>
  </UHeader>
</template>
