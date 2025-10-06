<script setup lang="ts">
import { onMounted } from 'vue'
import type { PWAFeatureGroup } from '../data/pwa-features'
import { pwaFeatures } from '../data/pwa-features'
import type { BrowserSupport } from '../composables/useBrowserSupport'

const { getSupport, loadMultipleSupport } = useBrowserSupport()
const { calculateBrowserScore } = useBrowserScore()

// Shared accordion state across all browser columns
const openGroups = ref<string[]>([])
const openCategories = ref<string[]>([])

// Load support data for all features on mount
onMounted(async () => {
  const allFeatures: Array<{ id: string, canIUseId?: string }> = []

  for (const group of pwaFeatures) {
    for (const category of group.categories) {
      for (const feature of category.features) {
        allFeatures.push({
          id: feature.id,
          canIUseId: feature.canIUseId
        })
      }
    }
  }

  await loadMultipleSupport(allFeatures)
})

interface BrowserColumn {
  id: keyof BrowserSupport
  name: string
  icon: string
  version: string
  color: string
}

const browserConfig: BrowserColumn[] = [
  {
    id: 'chrome',
    name: 'Chrome',
    icon: 'i-simple-icons-googlechrome',
    version: '131',
    color: 'text-green-600 dark:text-green-400'
  },
  {
    id: 'firefox',
    name: 'Firefox',
    icon: 'i-simple-icons-firefox',
    version: '138',
    color: 'text-orange-600 dark:text-orange-400'
  },
  {
    id: 'safari',
    name: 'Safari',
    icon: 'i-simple-icons-safari',
    version: '26',
    color: 'text-blue-600 dark:text-blue-400'
  }
]

const browsers = computed(() =>
  browserConfig.map(browser => ({
    ...browser,
    score: calculateBrowserScore(browser.id, pwaFeatures, getSupport)
  }))
)

/**
 * Get support data for a feature across all browsers
 */
function getFeatureSupport(featureId: string, canIUseId?: string): BrowserSupport {
  return getSupport(featureId, canIUseId)
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
 * Create accordion items for feature groups
 */
function createGroupItems(groups: PWAFeatureGroup[]) {
  return groups.map(group => ({
    label: group.name,
    description: group.description,
    icon: group.icon,
    slot: group.id,
    defaultOpen: false
  }))
}

/**
 * Create accordion items for categories within a group
 */
function createCategoryItems(group: PWAFeatureGroup) {
  return group.categories.map(category => ({
    label: category.name,
    description: category.description,
    slot: category.id,
    defaultOpen: false
  }))
}

const groupItems = createGroupItems(pwaFeatures)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Browser Columns -->
      <div
        v-for="browser in browsers"
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
                  <div class="font-semibold text-lg">
                    {{ browser.name }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    Version {{ browser.version }}
                  </div>
                </div>
              </div>
              <div :class="['text-4xl font-bold', browser.color]">
                {{ browser.score }}
              </div>
            </div>
          </template>
        </UCard>

        <!-- Feature Groups Accordion -->
        <UAccordion
          v-model="openGroups"
          :items="groupItems"
          :multiple="true"
          :ui="{ item: { label: 'font-semibold' } }"
        >
          <template
            v-for="group in pwaFeatures"
            :key="group.id"
            #[group.id]
          >
            <!-- Categories within this group -->
            <div class="pl-6">
              <UAccordion
                v-model="openCategories"
                :items="createCategoryItems(group)"
                :multiple="true"
              >
                <template
                  v-for="category in group.categories"
                  :key="category.id"
                  #[category.id]
                >
                  <!-- Features within this category -->
                  <div class="space-y-1 pl-6 pb-3">
                    <div
                      v-for="feature in category.features"
                      :key="feature.id"
                      class="flex items-center justify-between py-1"
                    >
                    <div class="flex-1 min-w-0 pr-3">
                      <div class="flex items-center gap-2">
                        <UTooltip>
                          <template #text>
                            <div class="space-y-1">
                              <div
                                v-if="feature.apiName"
                                class="font-semibold text-xs"
                              >
                                API: {{ feature.apiName }}
                              </div>
                              <div class="text-xs">
                                {{ feature.description }}
                              </div>
                            </div>
                          </template>
                          <div class="text-sm truncate cursor-help">
                            {{ feature.name }}
                          </div>
                        </UTooltip>
                        <a
                          v-if="feature.canIUseId"
                          :href="getCanIUseUrl(feature.canIUseId)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-xs text-primary hover:underline inline-flex items-center gap-1 flex-shrink-0"
                        >
                          <span>Can I Use</span>
                          <UIcon name="i-heroicons-arrow-top-right-on-square" />
                        </a>
                      </div>
                    </div>
                    <div class="flex-shrink-0 -mt-1">
                      <UBadge
                        :color="
                          getSupportBadgeColor(
                            getFeatureSupport(feature.id, feature.canIUseId)[
                              browser.id as keyof BrowserSupport
                            ]
                          )
                        "
                        size="sm"
                      >
                        {{
                          getSupportLabel(
                            getFeatureSupport(feature.id, feature.canIUseId)[
                              browser.id as keyof BrowserSupport
                            ]
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
</template>
