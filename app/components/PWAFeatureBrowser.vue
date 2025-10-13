<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useSwipe } from '@vueuse/core'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import type {
  BrowserSupport,
  BrowserId
} from '../composables/useBrowserSupport'
import { getMdnUrlFromBcd } from '../utils/canIUseLoader'

const { features: pwaFeatures } = usePWAFeatures()
const { getSupport, loadMultipleSupport } = useBrowserSupport()
const { calculateBrowserScore } = useBrowserScore()
const route = useRoute()
const router = useRouter()

// Shared accordion state across all browser columns
const openGroups = ref<string[]>([])
const openCategories = ref<string[]>([])

// Hide experimental features state
const hideExperimental = ref<boolean>(false)

// Mobile browser selector state
const selectedBrowserIndex = ref<number>(0)

// Breakpoint detection (1024px = lg breakpoint in Tailwind)
const isLargeScreen = ref<boolean>(true) // Default to desktop for SSR

// Update breakpoint on resize
function updateBreakpoint() {
  if (import.meta.client) {
    isLargeScreen.value = window.matchMedia('(min-width: 1024px)').matches
  }
}

// Store precomputed MDN URLs by feature ID
const mdnUrls = ref<Map<string, string | undefined>>(new Map())

// Pre-computed Sets of experimental/non-standard features (populated once in onMounted)
const experimentalFeatureIds = ref<Set<string>>(new Set())
const experimentalCategoryIds = ref<Set<string>>(new Set())
const experimentalGroupIds = ref<Set<string>>(new Set())

// Check if all groups and categories are expanded
const isAllExpanded = computed(() => {
  const allGroupIds = pwaFeatures.map(g => g.id)
  const allCategoryIds = pwaFeatures.flatMap(g =>
    g.categories.map(c => c.id)
  )

  return (
    allGroupIds.every(id => openGroups.value.includes(id))
    && allCategoryIds.every(id => openCategories.value.includes(id))
  )
})

/**
 * Expand all groups and categories
 */
function expandAll(): void {
  const allGroupIds = pwaFeatures.map(g => g.id)
  const allCategoryIds = pwaFeatures.flatMap(g =>
    g.categories.map(c => c.id)
  )

  openGroups.value = [...allGroupIds]
  openCategories.value = [...allCategoryIds]
}

/**
 * Collapse all groups and categories
 */
function collapseAll(): void {
  openGroups.value = []
  openCategories.value = []
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent): void {
  // Cmd/Ctrl + E to expand all
  if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
    event.preventDefault()
    expandAll()
  }
  // Cmd/Ctrl + W to collapse all
  if ((event.metaKey || event.ctrlKey) && event.key === 'w') {
    event.preventDefault()
    collapseAll()
  }
}

/**
 * Initialize hideExperimental from URL parameter
 */
function initializeHideExperimental(): void {
  const urlParam = route.query.hideExperimental
  if (urlParam === 'true') {
    hideExperimental.value = true
  } else if (urlParam === 'false') {
    hideExperimental.value = false
  }
  // If not specified in URL, default to false (already set)
}

/**
 * Toggle hideExperimental state and update URL
 */
function toggleHideExperimental(): void {
  hideExperimental.value = !hideExperimental.value
}

// Watch hideExperimental and sync to URL
watch(hideExperimental, (newValue) => {
  const query = { ...route.query }
  if (newValue) {
    query.hideExperimental = 'true'
  } else {
    delete query.hideExperimental
  }
  router.replace({ query })
})

// Load support data for all features on mount
onMounted(async () => {
  // Initialize hideExperimental from URL
  initializeHideExperimental()
  const allFeatures: Array<{
    id: string
    canIUseId?: string
    mdnBcdPath?: string
    status?: {
      experimental: boolean
      standard_track: boolean
      deprecated: boolean
    }
  }> = []

  for (const group of pwaFeatures) {
    for (const category of group.categories) {
      for (const feature of category.features) {
        allFeatures.push({
          id: feature.id,
          canIUseId: feature.canIUseId,
          mdnBcdPath: feature.mdnBcdPath,
          status: feature.status
        })
      }
    }
  }

  // Load support data and MDN URLs for all features in parallel
  await Promise.all([
    loadMultipleSupport(allFeatures),
    ...allFeatures.map(async (feature) => {
      if (feature.mdnBcdPath) {
        const url = await getMdnUrlFromBcd(feature.mdnBcdPath)
        mdnUrls.value.set(feature.id, url)
      }
    })
  ])

  // Pre-compute which features are experimental/non-standard (once, after support data loads)
  for (const group of pwaFeatures) {
    for (const category of group.categories) {
      for (const feature of category.features) {
        const support = getSupport(
          feature.id,
          feature.canIUseId,
          feature.mdnBcdPath
        )
        const status = support.status

        // Hide if experimental OR not on standards track (non-standard)
        if (status?.experimental === true || status?.standard_track === false) {
          experimentalFeatureIds.value.add(feature.id)
        }
      }
    }
  }

  // Pre-compute which categories are all-experimental
  for (const group of pwaFeatures) {
    for (const category of group.categories) {
      // Check if ALL features in this category are experimental
      if (
        category.features.every(feature =>
          experimentalFeatureIds.value.has(feature.id)
        )
      ) {
        experimentalCategoryIds.value.add(category.id)
      }
    }
  }

  // Pre-compute which groups are all-experimental
  for (const group of pwaFeatures) {
    // Check if ALL categories in this group are experimental
    if (
      group.categories.every(category =>
        experimentalCategoryIds.value.has(category.id)
      )
    ) {
      experimentalGroupIds.value.add(group.id)
    }
  }

  // Add keyboard shortcut listeners
  window.addEventListener('keydown', handleKeydown)

  // Initialize and listen for breakpoint changes
  updateBreakpoint()
  window.addEventListener('resize', updateBreakpoint)
})

// Clean up event listeners on unmount
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateBreakpoint)
})

// Auto-expand all categories when a group is opened
watch(openGroups, (newGroups, oldGroups) => {
  // Find newly opened groups
  const newlyOpened = newGroups.filter(id => !oldGroups.includes(id))

  // Expand categories for each newly opened group
  newlyOpened.forEach(groupId => expandGroupCategories(groupId))
})

interface BrowserColumn {
  id: BrowserId
  name: string
  icon: string
  version: string
  color: string
  platformIcon: string
}

const browserConfig: BrowserColumn[] = [
  {
    id: 'chrome_android',
    name: 'Chrome',
    icon: 'i-simple-icons-googlechrome',
    version: '131',
    color: 'text-green-600 dark:text-green-400',
    platformIcon: 'i-simple-icons-android'
  },
  {
    id: 'firefox_android',
    name: 'Firefox',
    icon: 'i-simple-icons-firefox',
    version: '138',
    color: 'text-orange-600 dark:text-orange-400',
    platformIcon: 'i-simple-icons-android'
  },
  {
    id: 'safari_ios',
    name: 'Safari',
    icon: 'i-simple-icons-safari',
    version: '26',
    color: 'text-blue-600 dark:text-blue-400',
    platformIcon: 'i-simple-icons-apple'
  }
]

const browsers = computed(() =>
  browserConfig.map(browser => ({
    ...browser,
    scores: calculateBrowserScore(browser.id, pwaFeatures, getSupport)
  }))
)

// Visible browsers based on screen size
const visibleBrowsers = computed(() => {
  if (isLargeScreen.value) {
    return browsers.value // Show all 3 browsers on desktop
  }
  const selectedBrowser = browsers.value[selectedBrowserIndex.value]
  return selectedBrowser ? [selectedBrowser] : [] // Show only selected browser on mobile
})

// Browser tabs for mobile selector
const browserTabs = computed(() =>
  browsers.value.map((browser, index) => ({
    label: browser.name,
    icon: browser.icon,
    value: String(index)
  }))
)

// Computed property for v-model binding (converts between string and number)
const selectedBrowserTab = computed({
  get: () => String(selectedBrowserIndex.value),
  set: (value: string) => {
    selectedBrowserIndex.value = Number(value)
  }
})

// Swipe gesture support for mobile
const swipeContainer = ref<HTMLElement>()

if (import.meta.client) {
  const { direction } = useSwipe(swipeContainer, {
    passive: true,
    onSwipeEnd() {
      if (!isLargeScreen.value) {
        if (direction.value === 'left' && selectedBrowserIndex.value < browsers.value.length - 1) {
          selectedBrowserIndex.value++
        } else if (direction.value === 'right' && selectedBrowserIndex.value > 0) {
          selectedBrowserIndex.value--
        }
      }
    }
  })
}

/**
 * Get support data for a feature across all browsers
 */
function getFeatureSupport(
  featureId: string,
  canIUseId?: string,
  mdnBcdPath?: string
): BrowserSupport {
  return getSupport(featureId, canIUseId, mdnBcdPath)
}

/**
 * Get badge color based on support level
 */
function getSupportBadgeColor(
  support: 'supported' | 'partial' | 'not-supported' | 'unknown'
): 'success' | 'warning' | 'error' | 'neutral' {
  switch (support) {
    case 'supported':
      return 'success'
    case 'partial':
      return 'warning'
    case 'not-supported':
      return 'error'
    case 'unknown':
      return 'neutral'
  }
}

/**
 * Get label text for support level
 */
function getSupportLabel(
  support: 'supported' | 'partial' | 'not-supported' | 'unknown'
): string {
  switch (support) {
    case 'supported':
      return 'Supported'
    case 'partial':
      return 'Partial'
    case 'not-supported':
      return 'Not Supported'
    case 'unknown':
      return 'Unknown'
  }
}

/**
 * Build CanIUse URL if feature has canIUseId
 */
function getCanIUseUrl(canIUseId?: string): string | undefined {
  return canIUseId ? `https://caniuse.com/${canIUseId}` : undefined
}

/**
 * Get precomputed MDN URL for a feature
 */
function getMdnUrl(featureId: string): string | undefined {
  return mdnUrls.value.get(featureId)
}

/**
 * Lightweight computed that returns pre-computed experimental feature IDs or empty set.
 * O(1) performance - just swaps Set reference based on checkbox state.
 */
const hiddenFeatureIds = computed<Set<string>>(() =>
  hideExperimental.value ? experimentalFeatureIds.value : new Set()
)

/**
 * Lightweight computed that returns pre-computed experimental category IDs or empty set.
 * O(1) performance - just swaps Set reference based on checkbox state.
 */
const hiddenCategoryIds = computed<Set<string>>(() =>
  hideExperimental.value ? experimentalCategoryIds.value : new Set()
)

/**
 * Lightweight computed that returns pre-computed experimental group IDs or empty set.
 * O(1) performance - just swaps Set reference based on checkbox state.
 */
const hiddenGroupIds = computed<Set<string>>(() =>
  hideExperimental.value ? experimentalGroupIds.value : new Set()
)

/**
 * Expand all categories for a given group
 */
function expandGroupCategories(groupId: string): void {
  const group = pwaFeatures.find(g => g.id === groupId)
  if (!group) return

  // Add all category IDs to openCategories array
  const categoryIds = group.categories.map(c => c.id)
  openCategories.value = [
    ...openCategories.value.filter(id => !categoryIds.includes(id)),
    ...categoryIds
  ]
}

/**
 * Handle Meta-click (⌘ on Mac, ⊞ on Windows) on group accordions
 * to expand group + all its categories
 */
function handleGroupMetaClick(event: MouseEvent): void {
  // Only process Meta-clicks
  if (!event.metaKey) return

  // Find the clicked accordion button
  const target = event.target as HTMLElement
  const button = target.closest('button')
  if (!button) return

  // Find the group ID by matching button text with group names
  const buttonText = button.textContent?.trim()
  const group = pwaFeatures.find(g => g.name === buttonText)
  if (!group) return

  // Expand all categories in this group
  expandGroupCategories(group.id)
}

/**
 * Create accordion items for feature groups
 */
function createGroupItems(groups: PWAFeatureGroup[]) {
  return groups.map(group => ({
    label: group.name,
    description: group.description,
    icon: group.icon,
    slot: group.id,
    value: group.id,
    defaultOpen: false
  }))
}

/**
 * Create accordion items for categories within a group
 * This function is called reactively from the template
 */
function createCategoryItems(group: PWAFeatureGroup) {
  return group.categories.map(category => ({
    label: category.name,
    description: category.description,
    slot: category.id,
    value: category.id,
    defaultOpen: false
  }))
}

const groupItems = createGroupItems(pwaFeatures)
</script>

<template>
  <div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Options Bar -->
      <PWAFeatureBrowserOptions
        :is-all-expanded="isAllExpanded"
        :hide-experimental="hideExperimental"
        @expand-all="expandAll"
        @collapse-all="collapseAll"
        @toggle-hide-experimental="toggleHideExperimental"
      />
    </div>

    <!-- Mobile Browser Selector (hidden on desktop) - Full width sticky -->
    <div class="lg:hidden sticky top-0 z-40 bg-default shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <UTabs
          v-model="selectedBrowserTab"
          :items="browserTabs"
          orientation="horizontal"
          default-value="0"
          size="lg"
          class="w-full"
          :ui="{
            root: 'border-b-0',
            list: 'border-b-0'
          }"
        />
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <ClientOnly>
        <div
          ref="swipeContainer"
          class="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          <!-- Browser Columns -->
          <div
            v-for="browser in visibleBrowsers"
            :key="browser.id"
            class="flex flex-col space-y-4"
          >
            <!-- Browser Header Card -->
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <UIcon
                      :name="browser.icon"
                      :class="browser.color"
                      class="w-10 h-10"
                    />
                    <div>
                      <div class="text-lg flex items-center gap-1">
                        <span class="font-semibold">{{ browser.name }}</span>
                        <span
                          class="font-normal text-gray-500 dark:text-gray-400 flex items-center"
                          :class="
                            browser.platformIcon === 'i-simple-icons-android'
                              ? 'gap-[5px]'
                              : 'gap-1'
                          "
                        >
                          for
                          <UIcon
                            :name="browser.platformIcon"
                            :class="
                              browser.platformIcon === 'i-simple-icons-android'
                                ? 'w-[18px] h-[18px]'
                                : 'w-4 h-4'
                            "
                          />
                        </span>
                      </div>
                      <div class="text-sm text-gray-500 dark:text-gray-400">
                        Version {{ browser.version }}
                      </div>
                    </div>
                  </div>
                  <UTooltip
                    :ui="{
                      content:
                        'bg-gray-900/90 dark:bg-gray-800/90 flex-col items-start h-auto'
                    }"
                  >
                    <template #content>
                      <div class="text-xs">
                        <div class="mb-2">
                          <span class="text-gray-400">Stable features:</span><br>
                          {{ browser.scores.unweighted }} raw
                        </div>
                        <div>
                          <span class="text-gray-400">With experimental/non-standard:</span><br>
                          {{ browser.scores.weightedFull }} weighted,
                          {{ browser.scores.unweightedFull }} raw
                        </div>
                      </div>
                    </template>
                    <button
                      type="button"
                      :aria-label="`${browser.name} score: ${browser.scores.weighted}. Press for details.`"
                      :class="[
                        'appearance-none bg-transparent border-0 p-0 m-0 font-inherit text-4xl font-bold cursor-pointer border-b-2 border-dotted border-current border-opacity-50 hover:border-opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500',
                        browser.color
                      ]"
                    >
                      {{ browser.scores.weighted }}
                    </button>
                  </UTooltip>
                </div>
              </template>
            </UCard>

            <!-- Feature Groups Accordion -->
            <div @click.capture="handleGroupMetaClick">
              <UAccordion
                v-model="openGroups"
                :items="groupItems"
                type="multiple"
              >
                <template
                  v-for="group in pwaFeatures"
                  :key="group.id"
                  #[group.id]
                >
                  <!-- Categories within this group -->
                  <div
                    v-show="!hiddenGroupIds.has(group.id)"
                    class="pl-6"
                  >
                    <UAccordion
                      v-model="openCategories"
                      :items="createCategoryItems(group)"
                      type="multiple"
                    >
                      <template
                        v-for="category in group.categories"
                        :key="category.id"
                        #[category.id]
                      >
                        <!-- Features within this category -->
                        <div
                          v-show="!hiddenCategoryIds.has(category.id)"
                          class="space-y-1 pl-6 pb-3"
                        >
                          <div
                            v-for="feature in category.features"
                            v-show="!hiddenFeatureIds.has(feature.id)"
                            :key="feature.id"
                            class="flex items-center justify-between py-1"
                          >
                            <div class="flex-1 min-w-0 pr-3">
                              <div class="flex items-center gap-1.5">
                                <UTooltip
                                  :text="
                                    feature.apiName
                                      ? `API: ${feature.apiName} — ${feature.description}`
                                      : feature.description
                                  "
                                >
                                  <div class="text-sm truncate">
                                    {{ feature.name }}
                                  </div>
                                </UTooltip>
                                <!-- Status icons -->
                                <div
                                  class="inline-flex items-center gap-1 flex-shrink-0"
                                >
                                  <UTooltip
                                    v-if="
                                      getFeatureSupport(
                                        feature.id,
                                        feature.canIUseId,
                                        feature.mdnBcdPath
                                      ).status?.experimental
                                    "
                                    text="Experimental: This feature is experimental and subject to change"
                                  >
                                    <UIcon
                                      name="i-heroicons-beaker"
                                      class="w-4 h-4 text-gray-600 dark:text-gray-400"
                                    />
                                  </UTooltip>
                                  <UTooltip
                                    v-if="
                                      getFeatureSupport(
                                        feature.id,
                                        feature.canIUseId,
                                        feature.mdnBcdPath
                                      ).status
                                        && !getFeatureSupport(
                                          feature.id,
                                          feature.canIUseId,
                                          feature.mdnBcdPath
                                        ).status?.standard_track
                                    "
                                    text="Non-standard: This feature is not on the standards track"
                                  >
                                    <UIcon
                                      name="i-heroicons-exclamation-triangle"
                                      class="w-4 h-4 text-gray-600 dark:text-gray-400 translate-y-[0.5px]"
                                    />
                                  </UTooltip>
                                  <UTooltip
                                    v-if="
                                      getFeatureSupport(
                                        feature.id,
                                        feature.canIUseId,
                                        feature.mdnBcdPath
                                      ).status?.deprecated
                                    "
                                    text="Deprecated: This feature is deprecated and may be removed"
                                  >
                                    <UIcon
                                      name="i-heroicons-x-circle"
                                      class="w-4 h-4 text-gray-600 dark:text-gray-400"
                                    />
                                  </UTooltip>
                                </div>
                                <div
                                  v-if="feature.canIUseId || feature.mdnBcdPath"
                                  class="inline-flex items-center flex-shrink-0 rounded-md overflow-hidden border border-primary-500/20 bg-primary-50 dark:bg-primary-950/50"
                                >
                                  <UTooltip
                                    v-if="feature.canIUseId"
                                    text="View browser compatibility on Can I Use"
                                  >
                                    <a
                                      :href="getCanIUseUrl(feature.canIUseId)"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label="View browser compatibility on Can I Use"
                                      class="px-1 py-px text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                                    >
                                      CIU
                                    </a>
                                  </UTooltip>
                                  <div
                                    v-if="feature.canIUseId && feature.mdnBcdPath"
                                    class="w-px self-stretch bg-primary-500/20"
                                  />
                                  <UTooltip
                                    v-if="feature.mdnBcdPath"
                                    text="View documentation on MDN Web Docs"
                                  >
                                    <a
                                      :href="getMdnUrl(feature.id)"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label="View documentation on MDN Web Docs"
                                      class="px-1 py-px text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                                    >
                                      MDN
                                    </a>
                                  </UTooltip>
                                </div>
                              </div>
                            </div>
                            <div class="flex-shrink-0 -mt-1">
                              <UBadge
                                :color="
                                  getSupportBadgeColor(
                                    getFeatureSupport(
                                      feature.id,
                                      feature.canIUseId,
                                      feature.mdnBcdPath
                                    )[browser.id]
                                  )
                                "
                                size="sm"
                              >
                                {{
                                  getSupportLabel(
                                    getFeatureSupport(
                                      feature.id,
                                      feature.canIUseId,
                                      feature.mdnBcdPath
                                    )[browser.id]
                                  )
                                }}
                              </UBadge>
                            </div>
                          </div>
                        </div>
                      </template>
                    </UAccordion>
                  </div>
                </template>
              </UAccordion>
            </div>
          </div>
        </div>
      </ClientOnly>
    </div>
  </div>
</template>
