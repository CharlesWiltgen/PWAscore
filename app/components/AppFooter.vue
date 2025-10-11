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
        (CC0)
      </p>
    </template>

    <template #right>
      <div class="flex items-center gap-4">
        <p class="text-sm text-muted">
          © {{ new Date().getFullYear() }} by Charles Wiltgen
        </p>
        <div class="flex items-center gap-2">
          <UButton
            to="https://bsky.app/profile/wiltgen.net"
            target="_blank"
            icon="i-simple-icons-bluesky"
            aria-label="Charles Wiltgen on Bluesky"
            color="neutral"
            variant="ghost"
          />
          <UButton
            to="https://github.com/CharlesWiltgen/PWAscore"
            target="_blank"
            icon="i-simple-icons-github"
            aria-label="PWAscore on GitHub"
            color="neutral"
            variant="ghost"
          />
        </div>
      </div>
    </template>
  </UFooter>
</template>
