<script setup lang="ts">
const { t, locale, locales } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()

const otherLocale = computed(() =>
  (locales.value as Array<{ code: string, name: string }>)
    .find(l => l.code !== locale.value)!
)
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
        <NuxtLink
          :to="switchLocalePath(otherLocale.code as 'en' | 'fr')"
          class="text-sm font-medium hover:text-primary transition-colors"
        >
          {{ otherLocale.name }}
        </NuxtLink>
        <UColorModeButton />
      </div>
    </template>
  </UHeader>
</template>
