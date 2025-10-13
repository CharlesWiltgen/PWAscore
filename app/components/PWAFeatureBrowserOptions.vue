<script setup lang="ts">
const props = defineProps<{
  isAllExpanded: boolean
  hideExperimental: boolean
}>()

const emit = defineEmits<{
  expandAll: []
  collapseAll: []
  toggleHideExperimental: []
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
      <!-- Left: Hide Experimental checkbox -->
      <div class="flex-1">
        <UCheckbox
          :model-value="hideExperimental"
          label="Hide Experimental"
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
          :label="isAllExpanded ? 'Collapse All' : 'Expand All'"
          color="neutral"
          variant="ghost"
          size="md"
          @click="handleToggle"
        />
      </div>

      <!-- Right: How Scores Work disclosure -->
      <div class="flex-1 flex justify-end">
        <UButton
          label="How Scores Work"
          color="neutral"
          variant="ghost"
          size="md"
          trailing-icon="i-lucide-chevron-down"
          :aria-expanded="isScoresInfoOpen"
          aria-controls="scores-info-content"
          :ui="{
            trailingIcon: 'transition-transform duration-200 '
              + (isScoresInfoOpen ? 'rotate-180' : '')
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
          class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <strong>About PWA Scores:</strong>
          </p>
          <ul class="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
            <li>The main score shown is weighted for feature importance</li>
            <li>Only stable (non-experimental) features are counted</li>
            <li>
              Tap or hover any score to see:
              <ul class="ml-6 mt-1 space-y-0.5 list-[circle]">
                <li>Raw scores (simple % of supported features)</li>
                <li>Experimental feature scores</li>
              </ul>
            </li>
          </ul>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Learn more about our methodology on the
            <NuxtLink
              to="/about"
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              About page
            </NuxtLink>.
          </p>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
