<script setup lang="ts">
import { computed } from 'vue'
import type { ScorePoint } from '../composables/useBrowserScore'

const props = withDefaults(
  defineProps<{
    series: ScorePoint[]
    domainStart?: string
    domainEnd?: string
    width?: number
    height?: number
    showMarkers?: boolean
    yMin?: number
  }>(),
  { width: 120, height: 28, showMarkers: false, yMin: 0 }
)

// x is positioned by release date within the shared [domainStart, domainEnd]
// timeline so every browser's sparkline sits on the same calendar axis (a
// browser that shipped few releases shows few, widely-spaced points rather than
// being stretched to full width). Falls back to even spacing without a domain.
// y inverts the fixed 0–100 weighted score so higher scores sit higher.
const layout = computed(() => {
  const n = props.series.length
  if (n === 0) return { line: '', area: '', markers: [] as Array<{ x: number, y: number }> }

  const startMs = props.domainStart ? new Date(props.domainStart).getTime() : Number.NaN
  const endMs = props.domainEnd ? new Date(props.domainEnd).getTime() : Number.NaN
  const haveDomain = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs

  const xAt = (point: ScorePoint, i: number): number => {
    if (haveDomain && point.releaseDate) {
      const ms = new Date(point.releaseDate).getTime()
      if (!Number.isNaN(ms)) return ((ms - startMs) / (endMs - startMs)) * props.width
    }
    return n > 1 ? (i / (n - 1)) * props.width : 0
  }
  // Scores cluster in the 65–100 band, so a 0–100 axis squashes every curve
  // against the top. yMin raises the floor (e.g. 50) to spread the band over the
  // box; values are clamped so anything at/below the floor sits on the baseline.
  const yAt = (point: ScorePoint): number => {
    const span = 100 - props.yMin
    const frac = span > 0 ? (point.weighted - props.yMin) / span : 0
    const clamped = Math.max(0, Math.min(1, frac))
    return props.height - clamped * props.height
  }

  const markers = props.series.map((p, i) => ({
    x: Math.round(xAt(p, i)),
    y: Math.round(yAt(p))
  }))
  const line = markers.map(p => `${p.x},${p.y}`).join(' ')
  const first = markers[0]!
  const last = markers[markers.length - 1]!
  const area = `${first.x},${props.height} ${line} ${last.x},${props.height}`
  return { line, area, markers }
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
    <polygon
      v-if="layout.area"
      :points="layout.area"
      fill="currentColor"
      class="opacity-10"
    />
    <polyline
      v-if="layout.line"
      :points="layout.line"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      class="opacity-70"
    />
    <template v-if="showMarkers">
      <circle
        v-for="(m, i) in layout.markers"
        :key="i"
        :cx="m.x"
        :cy="m.y"
        r="2.5"
        fill="currentColor"
        class="opacity-80"
      />
    </template>
  </svg>
</template>
