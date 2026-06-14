import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import VersionScoreSparkline from './VersionScoreSparkline.vue'

const series = [
  { version: '18.5', releaseDate: '2025-05-12', weighted: 0 },
  { version: '26.4', releaseDate: '2026-03-24', weighted: 50 },
  { version: '26.5', releaseDate: null, weighted: 100 }
]

describe('VersionScoreSparkline', () => {
  test('renders a polyline with one point per series entry', () => {
    const wrapper = mount(VersionScoreSparkline, {
      props: { series, width: 100, height: 20 }
    })
    const points = wrapper.get('polyline').attributes('points')
    expect(points?.trim().split(/\s+/).length).toBe(3)
  })

  test('maps weighted 0 to the bottom and 100 to the top of the box (y inverted)', () => {
    const wrapper = mount(VersionScoreSparkline, {
      props: { series, width: 100, height: 20 }
    })
    const pairs = wrapper.get('polyline').attributes('points')!.trim().split(/\s+/)
    const yOf = (pair: string) => Number(pair.split(',')[1])
    expect(yOf(pairs[0]!)).toBe(20)
    expect(yOf(pairs[2]!)).toBe(0)
  })

  test('renders nothing drawable for an empty series', () => {
    const wrapper = mount(VersionScoreSparkline, { props: { series: [] } })
    expect(wrapper.find('polyline').exists()).toBe(false)
  })
})
