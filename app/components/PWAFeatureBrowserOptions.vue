<script setup lang="ts">
const props = defineProps<{
  isAllExpanded: boolean
}>()

const emit = defineEmits<{
  expandAll: []
  collapseAll: []
}>()

function handleToggle() {
  if (props.isAllExpanded) {
    emit('collapseAll')
  } else {
    emit('expandAll')
  }
}
</script>

<template>
  <div class="flex items-center justify-between mb-6">
    <!-- Left: Future filters/options -->
    <div class="flex-1" />

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
        size="sm"
        @click="handleToggle"
      />
    </div>

    <!-- Right: Future mobile/desktop selector -->
    <div class="flex-1" />
  </div>
</template>
