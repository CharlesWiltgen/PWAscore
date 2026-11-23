import type { PWAFeature, PWAFeatureGroup } from '../data/pwa-features.schema'

export type BrowserFeature = Pick<
  PWAFeature,
  'id' | 'canIUseId' | 'mdnBcdPath' | 'status'
>

export type FeatureStatusLookup = (
  feature: BrowserFeature
) => BrowserFeature['status']

export function collectBrowserFeatures(
  groups: PWAFeatureGroup[]
): BrowserFeature[] {
  return groups.flatMap(group =>
    group.categories.flatMap(category =>
      category.features.map(feature => ({
        id: feature.id,
        canIUseId: feature.canIUseId,
        mdnBcdPath: feature.mdnBcdPath,
        status: feature.status
      }))
    )
  )
}

export function collectExperimentalFeatureIds(
  groups: PWAFeatureGroup[],
  statusFor: FeatureStatusLookup
): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const category of group.categories) {
      for (const feature of category.features) {
        const status = statusFor(feature)
        // Hide if experimental OR not on standards track (non-standard)
        if (status?.experimental === true || status?.standard_track === false) {
          ids.add(feature.id)
        }
      }
    }
  }
  return ids
}

export function collectExperimentalCategoryIds(
  groups: PWAFeatureGroup[],
  experimentalFeatures: ReadonlySet<string>
): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const category of group.categories) {
      // Check if ALL features in this category are experimental
      if (
        category.features.every(feature => experimentalFeatures.has(feature.id))
      ) {
        ids.add(category.id)
      }
    }
  }
  return ids
}

export function collectExperimentalGroupIds(
  groups: PWAFeatureGroup[],
  experimentalCategories: ReadonlySet<string>
): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    // Check if ALL categories in this group are experimental
    if (
      group.categories.every(category =>
        experimentalCategories.has(category.id)
      )
    ) {
      ids.add(group.id)
    }
  }
  return ids
}

/**
 * Find the group id a keyboard Cmd/Ctrl+Enter or Cmd/Ctrl+Space on an
 * accordion header should expand. Keyboard activation accepts Meta or Ctrl;
 * mouse activation stays Meta-only, so Ctrl+click remains a context-menu
 * gesture. Returns undefined for an ordinary click/keypress, or when the
 * target is not inside a group header.
 */
export function groupIdForMetaActivation(
  target: Element | null,
  event: { metaKey: boolean, ctrlKey?: boolean, key?: string }
): string | undefined {
  const key = event.key
  if (!event.metaKey && !(key !== undefined && event.ctrlKey)) {
    return undefined
  }
  if (key !== undefined && key !== 'Enter' && key !== ' ') {
    return undefined
  }

  const groupEl = target?.closest<HTMLElement>('[data-group-id]')
    ?? target?.closest('button')?.querySelector<HTMLElement>('[data-group-id]')
  return groupEl?.dataset.groupId
}

export function activateGroupFromMetaEvent(
  event: {
    metaKey: boolean
    ctrlKey?: boolean
    key?: string
    target: EventTarget | null
  },
  expand: (groupId: string) => void
): void {
  const groupId = groupIdForMetaActivation(
    event.target as Element | null,
    event
  )
  if (groupId) expand(groupId)
}
