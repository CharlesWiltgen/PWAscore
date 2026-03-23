<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <USeparator class="h-px" />

  <UFooter>
    <template #left>
      <i18n-t
        keypath="footer.dataSources"
        tag="p"
        class="text-sm text-muted"
      >
        <template #ciu>
          <a
            href="https://caniuse.com"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
          >Can I Use</a>
        </template>
        <template #mdn>
          <a
            href="https://github.com/mdn/browser-compat-data"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
          >MDN BCD</a>
        </template>
      </i18n-t>
    </template>

    <template #right>
      <div class="flex items-center gap-4">
        <p class="text-sm text-muted">
          {{ t('footer.copyright', { year: new Date().getFullYear() }) }}
        </p>
        <div class="flex items-center gap-2">
          <UButton
            to="https://bsky.app/profile/wiltgen.net"
            target="_blank"
            icon="i-simple-icons-bluesky"
            :aria-label="t('footer.blueskyLabel')"
            color="neutral"
            variant="ghost"
          />
          <UButton
            to="https://github.com/CharlesWiltgen/PWAscore"
            target="_blank"
            icon="i-simple-icons-github"
            :aria-label="t('footer.githubLabel')"
            color="neutral"
            variant="ghost"
          />
        </div>
      </div>
    </template>
  </UFooter>
</template>
