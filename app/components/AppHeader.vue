<template>
  <UHeader
    :toggle="false"
    :ui="{
      root: 'relative lg:sticky lg:top-0 lg:z-50'
    }"
  >
    <template #left>
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
      >
        <span class="text-xl font-bold text-primary">PWAscore</span>
      </NuxtLink>
    </template>

    <template #right>
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/about"
          class="text-sm font-medium hover:text-primary transition-colors"
        >
          About
        </NuxtLink>
        <UColorModeButton />
      </div>
    </template>
  </UHeader>
</template>
