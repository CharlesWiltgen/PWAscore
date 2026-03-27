<script setup lang="ts">
import type { Platform } from '../composables/useBrowserSupport'

const { t } = useI18n()
const localePath = useLocalePath()

const props = defineProps<{
  isAllExpanded: boolean
  hideExperimental: boolean
  platform: Platform
}>()

const emit = defineEmits<{
  expandAll: []
  collapseAll: []
  toggleHideExperimental: []
  'update:platform': [platform: Platform]
}>()

function handleToggle() {
  if (props.isAllExpanded) {
    emit('collapseAll')
  } else {
    emit('expandAll')
  }
}

function handleHideExperimentalToggle() {
  emit('toggleHideExperimental')
}

// Disclosure panel state
const isScoresInfoOpen = ref(false)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <!-- Left: Platform toggle + Hide Experimental -->
      <div class="flex-1 flex items-center gap-4">
        <UButtonGroup size="sm">
          <UButton
            :label="t('options.mobile')"
            :color="props.platform === 'mobile' ? 'primary' : 'neutral'"
            :variant="props.platform === 'mobile' ? 'solid' : 'outline'"
            @click="emit('update:platform', 'mobile')"
          />
          <UButton
            :label="t('options.desktop')"
            :color="props.platform === 'desktop' ? 'primary' : 'neutral'"
            :variant="props.platform === 'desktop' ? 'solid' : 'outline'"
            @click="emit('update:platform', 'desktop')"
          />
        </UButtonGroup>
        <UCheckbox
          :model-value="hideExperimental"
          :label="t('options.hideExperimental')"
          @update:model-value="handleHideExperimentalToggle"
        />
      </div>

      <!-- Center: Expand/Collapse toggle -->
      <div class="flex-1 flex justify-center">
        <UButton
          :icon="
            isAllExpanded
              ? 'i-heroicons-chevron-double-up'
              : 'i-heroicons-chevron-double-down'
          "
          :label="isAllExpanded ? t('options.collapseAll') : t('options.expandAll')"
          aria-keyshortcuts="Control+E"
          color="neutral"
          variant="ghost"
          size="md"
          :ui="{
            base: 'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
          }"
          @click="handleToggle"
        />
      </div>

      <!-- Right: How Scores Work disclosure -->
      <div class="flex-1 flex justify-end">
        <UButton
          id="scores-info-button"
          :label="t('options.howScoresWork')"
          color="neutral"
          variant="ghost"
          size="md"
          trailing-icon="i-lucide-chevron-down"
          :aria-expanded="isScoresInfoOpen"
          aria-controls="scores-info-content"
          :ui="{
            trailingIcon: 'transition-transform duration-200 '
              + (isScoresInfoOpen ? 'rotate-180' : ''),
            base: 'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
          }"
          @click="isScoresInfoOpen = !isScoresInfoOpen"
        />
      </div>
    </div>

    <!-- Disclosure Panel -->
    <UCollapsible
      v-model:open="isScoresInfoOpen"
      :unmount-on-hide="false"
      class="mb-6"
    >
      <template #content>
        <div
          id="scores-info-content"
          role="region"
          aria-labelledby="scores-info-button"
          class="px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <strong>{{ t('scoresInfo.title') }}</strong>
          </p>
          <ul class="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
            <li>{{ t('scoresInfo.weightedImportance') }}</li>
            <li>{{ t('scoresInfo.stableOnly') }}</li>
            <li>
              {{ t('scoresInfo.tapOrHover') }}
              <ul class="ml-6 mt-1 space-y-0.5 list-[circle]">
                <li>{{ t('scoresInfo.rawScores') }}</li>
                <li>{{ t('scoresInfo.experimentalScores') }}</li>
              </ul>
            </li>
          </ul>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ t('scoresInfo.learnMore') }}
            <NuxtLink
              :to="localePath('/about')"
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              {{ t('scoresInfo.aboutPage') }}
            </NuxtLink>.
          </p>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
