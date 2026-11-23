import { describe, expect, test } from 'vitest'
import type { PWAFeatureGroup } from '../data/pwa-features.schema'
import {
  activateGroupFromMetaEvent,
  collectBrowserFeatures,
  collectExperimentalCategoryIds,
  collectExperimentalFeatureIds,
  collectExperimentalGroupIds,
  groupIdForMetaActivation
} from './experimental-features'

const status = (
  experimental: boolean,
  standard_track = true
) => ({ experimental, standard_track, deprecated: false })

const GROUPS: PWAFeatureGroup[] = [
  {
    id: 'mixed',
    name: 'Mixed',
    description: 'Mixed',
    categories: [
      {
        id: 'stable',
        name: 'Stable',
        description: 'Stable',
        features: [
          {
            id: 'normal',
            name: 'Normal',
            description: 'Normal',
            canIUseId: 'normal-ciu',
            mdnBcdPath: 'api.Normal',
            status: status(false)
          },
          {
            id: 'experimental',
            name: 'Experimental',
            description: 'Experimental',
            status: status(true)
          },
          {
            id: 'nonstandard',
            name: 'Non-standard',
            description: 'Non-standard',
            status: status(false, false)
          }
        ]
      },
      {
        id: 'all-experimental',
        name: 'All experimental',
        description: 'All experimental',
        features: [
          {
            id: 'exp2',
            name: 'Experimental 2',
            description: 'Experimental 2',
            status: status(true)
          }
        ]
      }
    ]
  },
  {
    id: 'all-experimental-group',
    name: 'All experimental group',
    description: 'All experimental group',
    categories: [
      {
        id: 'exp-cat',
        name: 'Experimental category',
        description: 'Experimental category',
        features: [
          {
            id: 'exp3',
            name: 'Experimental 3',
            description: 'Experimental 3',
            status: status(true)
          }
        ]
      }
    ]
  },
  {
    id: 'mixed-group',
    name: 'Mixed group',
    description: 'Mixed group',
    categories: [
      {
        id: 'mixed-cat',
        name: 'Mixed category',
        description: 'Mixed category',
        features: [
          {
            id: 'normal2',
            name: 'Normal 2',
            description: 'Normal 2',
            status: status(false)
          }
        ]
      }
    ]
  }
]

describe('experimental feature helpers', () => {
  test('flattens every feature in group/category order', () => {
    const features = collectBrowserFeatures(GROUPS)
    expect(features.map(feature => feature.id)).toEqual([
      'normal',
      'experimental',
      'nonstandard',
      'exp2',
      'exp3',
      'normal2'
    ])
    expect(features.find(feature => feature.id === 'normal')).toMatchObject({
      canIUseId: 'normal-ciu',
      mdnBcdPath: 'api.Normal',
      status: { experimental: false, standard_track: true, deprecated: false }
    })
  })

  test('collects experimental and non-standard features', () => {
    const ids = collectExperimentalFeatureIds(
      GROUPS,
      feature => feature.status
    )
    expect([...ids].sort()).toEqual([
      'exp2',
      'exp3',
      'experimental',
      'nonstandard'
    ])
  })

  test('marks only categories whose every feature is experimental', () => {
    const features = collectExperimentalFeatureIds(
      GROUPS,
      feature => feature.status
    )
    expect([...collectExperimentalCategoryIds(GROUPS, features)].sort()).toEqual(
      ['all-experimental', 'exp-cat']
    )
  })

  test('marks only groups whose every category is all-experimental', () => {
    const features = collectExperimentalFeatureIds(
      GROUPS,
      feature => feature.status
    )
    const categories = collectExperimentalCategoryIds(GROUPS, features)
    expect([...collectExperimentalGroupIds(GROUPS, categories)]).toEqual([
      'all-experimental-group'
    ])
  })

  test('activates a group only for Cmd/Ctrl+Enter or Cmd/Ctrl+Space', () => {
    const root = document.createElement('div')
    root.innerHTML
      = '<button><span data-group-id="group-1">Group</span></button>'
    const span = root.querySelector('span')!
    const button = root.querySelector('button')!

    expect(groupIdForMetaActivation(span, { metaKey: true })).toBe('group-1')
    expect(groupIdForMetaActivation(button, { metaKey: true })).toBe('group-1')
    expect(groupIdForMetaActivation(span, { metaKey: true, key: 'Enter' })).toBe(
      'group-1'
    )
    expect(groupIdForMetaActivation(span, { metaKey: true, key: ' ' })).toBe(
      'group-1'
    )
    expect(groupIdForMetaActivation(span, { metaKey: true, key: 'a' })).toBe(
      undefined
    )
    expect(
      groupIdForMetaActivation(span, {
        metaKey: false,
        ctrlKey: true,
        key: 'Enter'
      })
    ).toBe('group-1')
    expect(
      groupIdForMetaActivation(span, {
        metaKey: false,
        ctrlKey: true,
        key: ' '
      })
    ).toBe('group-1')
    expect(
      groupIdForMetaActivation(span, { metaKey: false, ctrlKey: true })
    ).toBe(undefined)
    expect(groupIdForMetaActivation(span, { metaKey: false })).toBe(undefined)
    expect(groupIdForMetaActivation(null, { metaKey: true })).toBe(undefined)
  })

  test('expands through the callback only for a matching meta activation', () => {
    const root = document.createElement('div')
    root.innerHTML
      = '<button><span data-group-id="group-2">Group</span></button>'
    const span = root.querySelector('span')!
    const expanded: string[] = []
    const expand = (groupId: string) => expanded.push(groupId)

    activateGroupFromMetaEvent(
      { metaKey: true, key: 'Enter', target: span },
      expand
    )
    activateGroupFromMetaEvent(
      { metaKey: false, ctrlKey: true, key: 'Enter', target: span },
      expand
    )
    activateGroupFromMetaEvent({ metaKey: false, target: span }, expand)

    expect(expanded).toEqual(['group-2', 'group-2'])
  })
})
