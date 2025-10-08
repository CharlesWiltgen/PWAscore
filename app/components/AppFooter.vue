<template>
  <USeparator class="h-px" />

  <UFooter>
    <template #left>
      <p class="text-sm text-muted">
        Data sourced from
        <a
          href="https://caniuse.com"
          target="_blank"
          class="underline"
        >Can I Use</a>
        (CC BY 4.0) and
        <a
          href="https://github.com/mdn/browser-compat-data"
          target="_blank"
          class="underline"
        >MDN BCD</a>
        (CC0) • © {{ new Date().getFullYear() }}
      </p>
    </template>

    <template #right>
      <UButton
        to="https://github.com/yourusername/pwascore"
        target="_blank"
        icon="i-simple-icons-github"
        aria-label="PWAscore on GitHub"
        color="neutral"
        variant="ghost"
      />
    </template>
  </UFooter>
</template>
