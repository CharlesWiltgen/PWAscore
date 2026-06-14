<script setup lang="ts">
import { computed } from 'vue'
import type { ScorePoint } from '../composables/useBrowserScore'

const props = withDefaults(
  defineProps<{ series: ScorePoint[], width?: number, height?: number }>(),
  { width: 120, height: 28 }
)

// Map each point to an "x,y" pair. x spreads evenly across width; y inverts
// the 0–100 weighted score so higher scores sit higher in the box.
const points = computed(() => {
  const n = props.series.length
  if (n === 0) return ''
  const stepX = n > 1 ? props.width / (n - 1) : 0
  return props.series
    .map((p, i) => {
      const x = Math.round(i * stepX)
      const y = Math.round(props.height - (p.weighted / 100) * props.height)
      return `${x},${y}`
    })
    .join(' ')
})
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    fill="none"
    aria-hidden="true"
    class="overflow-visible"
  >
    <polyline
      v-if="points"
      :points="points"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      class="opacity-70"
    />
  </svg>
</template>
