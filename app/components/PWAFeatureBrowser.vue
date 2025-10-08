<script setup lang="ts">
import { onMounted, watch } from "vue";
import type { PWAFeatureGroup } from "../data/pwa-features";
import { pwaFeatures } from "../data/pwa-features";
import type {
  BrowserSupport,
  BrowserId,
} from "../composables/useBrowserSupport";

const { getSupport, loadMultipleSupport } = useBrowserSupport();
const { calculateBrowserScore } = useBrowserScore();

// Shared accordion state across all browser columns
const openGroups = ref<string[]>([]);
const openCategories = ref<string[]>([]);

// Load support data for all features on mount
onMounted(async () => {
  const allFeatures: Array<{
    id: string;
    canIUseId?: string;
    mdnBcdPath?: string;
  }> = [];

  for (const group of pwaFeatures) {
    for (const category of group.categories) {
      for (const feature of category.features) {
        allFeatures.push({
          id: feature.id,
          canIUseId: feature.canIUseId,
          mdnBcdPath: feature.mdnBcdPath,
        });
      }
    }
  }

  await loadMultipleSupport(allFeatures);
});

// Auto-expand all categories when a group is opened
watch(openGroups, (newGroups, oldGroups) => {
  // Find newly opened groups
  const newlyOpened = newGroups.filter((id) => !oldGroups.includes(id));

  // Expand categories for each newly opened group
  newlyOpened.forEach((groupId) => expandGroupCategories(groupId));
});

interface BrowserColumn {
  id: BrowserId;
  name: string;
  icon: string;
  version: string;
  color: string;
  platformIcon: string;
}

const browserConfig: BrowserColumn[] = [
  {
    id: "chrome",
    name: "Chrome",
    icon: "i-simple-icons-googlechrome",
    version: "131",
    color: "text-green-600 dark:text-green-400",
    platformIcon: "i-simple-icons-android",
  },
  {
    id: "firefox",
    name: "Firefox",
    icon: "i-simple-icons-firefox",
    version: "138",
    color: "text-orange-600 dark:text-orange-400",
    platformIcon: "i-simple-icons-android",
  },
  {
    id: "safari",
    name: "Safari",
    icon: "i-simple-icons-safari",
    version: "26",
    color: "text-blue-600 dark:text-blue-400",
    platformIcon: "i-simple-icons-apple",
  },
];

const browsers = computed(() =>
  browserConfig.map((browser) => ({
    ...browser,
    scores: calculateBrowserScore(browser.id, pwaFeatures, getSupport),
  })),
);

/**
 * Get support data for a feature across all browsers
 */
function getFeatureSupport(
  featureId: string,
  canIUseId?: string,
  mdnBcdPath?: string,
): BrowserSupport {
  return getSupport(featureId, canIUseId, mdnBcdPath);
}

/**
 * Get badge color based on support level
 */
function getSupportBadgeColor(
  support: "supported" | "partial" | "not-supported" | "unknown",
): "success" | "warning" | "error" | "neutral" {
  switch (support) {
    case "supported":
      return "success";
    case "partial":
      return "warning";
    case "not-supported":
      return "error";
    case "unknown":
      return "neutral";
  }
}

/**
 * Get label text for support level
 */
function getSupportLabel(
  support: "supported" | "partial" | "not-supported" | "unknown",
): string {
  switch (support) {
    case "supported":
      return "Supported";
    case "partial":
      return "Partial";
    case "not-supported":
      return "Not Supported";
    case "unknown":
      return "Unknown";
  }
}

/**
 * Build CanIUse URL if feature has canIUseId
 */
function getCanIUseUrl(canIUseId?: string): string | undefined {
  return canIUseId ? `https://caniuse.com/${canIUseId}` : undefined;
}

/**
 * Build MDN URL from mdnBcdPath
 * Converts "api.Navigator.setAppBadge" to "https://developer.mozilla.org/docs/Web/API/Navigator/setAppBadge"
 */
function getMdnUrl(mdnBcdPath?: string): string | undefined {
  if (!mdnBcdPath) return undefined;

  // Convert dot notation to URL path: api.Navigator.setAppBadge → /Web/API/Navigator/setAppBadge
  const parts = mdnBcdPath.split(".");
  const urlPath = parts.join("/");

  return `https://developer.mozilla.org/docs/Web/${urlPath}`;
}

/**
 * Expand all categories for a given group
 */
function expandGroupCategories(groupId: string): void {
  const group = pwaFeatures.find((g) => g.id === groupId);
  if (!group) return;

  // Add all category IDs to openCategories array
  const categoryIds = group.categories.map((c) => c.id);
  openCategories.value = [
    ...openCategories.value.filter((id) => !categoryIds.includes(id)),
    ...categoryIds,
  ];
}

/**
 * Handle Meta-click (⌘ on Mac, ⊞ on Windows) on group accordions
 * to expand group + all its categories
 */
function handleGroupMetaClick(event: MouseEvent): void {
  // Only process Meta-clicks
  if (!event.metaKey) return;

  // Find the clicked accordion button
  const target = event.target as HTMLElement;
  const button = target.closest("button");
  if (!button) return;

  // Find the group ID by matching button text with group names
  const buttonText = button.textContent?.trim();
  const group = pwaFeatures.find((g) => g.name === buttonText);
  if (!group) return;

  // Expand all categories in this group
  expandGroupCategories(group.id);
}

/**
 * Create accordion items for feature groups
 */
function createGroupItems(groups: PWAFeatureGroup[]) {
  return groups.map((group) => ({
    label: group.name,
    description: group.description,
    icon: group.icon,
    slot: group.id,
    value: group.id,
    defaultOpen: false,
  }));
}

/**
 * Create accordion items for categories within a group
 * This function is called reactively from the template
 */
function createCategoryItems(group: PWAFeatureGroup) {
  return group.categories.map((category) => ({
    label: category.name,
    description: category.description,
    slot: category.id,
    value: category.id,
    defaultOpen: false,
  }));
}

const groupItems = createGroupItems(pwaFeatures);
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
              <UTooltip>
                <template #text>
                  <div class="text-xs space-y-1">
                    <div>
                      Stable features: {{ browser.scores.unweighted }}% raw
                    </div>
                    <div class="text-gray-400">
                      With experimental/non-standard:
                    </div>
                    <div class="pl-2">
                      {{ browser.scores.weightedFull }}% weighted,
                      {{ browser.scores.unweightedFull }}% raw
                    </div>
                  </div>
                </template>
                <div :class="['text-4xl font-bold', browser.color]">
                  {{ browser.scores.weighted }}
                </div>
              </UTooltip>
            </div>
          </template>
        </UCard>

        <!-- Feature Groups Accordion -->
        <div @click.capture="handleGroupMetaClick">
          <UAccordion v-model="openGroups" :items="groupItems" type="multiple">
            <template v-for="group in pwaFeatures" :key="group.id" #[group.id]>
              <!-- Categories within this group -->
              <div class="pl-6">
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
                    <div class="space-y-1 pl-6 pb-3">
                      <div
                        v-for="feature in category.features"
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
                                    feature.mdnBcdPath,
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
                                    feature.mdnBcdPath,
                                  ).status &&
                                  !getFeatureSupport(
                                    feature.id,
                                    feature.canIUseId,
                                    feature.mdnBcdPath,
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
                                    feature.mdnBcdPath,
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
                                  :href="getMdnUrl(feature.mdnBcdPath)"
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
                                  feature.mdnBcdPath,
                                )[browser.id],
                              )
                            "
                            size="sm"
                          >
                            {{
                              getSupportLabel(
                                getFeatureSupport(
                                  feature.id,
                                  feature.canIUseId,
                                  feature.mdnBcdPath,
                                )[browser.id],
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
  </div>
</template>
