<template>
  <UHeader>
    <template #left>
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
      >
        <span class="text-xl font-bold text-primary">PWAscore</span>
      </NuxtLink>
    </template>

    <template #right>
      <UColorModeButton />
    </template>
  </UHeader>
</template>
