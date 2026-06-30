import { beforeEach, describe, expect, it } from 'vitest'
import { parseSliceLabel, useKeySliceStars } from './useKeySliceStars'

const STORAGE_KEY = 'dicomvision-key-slice-stars-test'

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size
      },
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, String(value))
    }
  })
}

describe('useKeySliceStars', () => {
  beforeEach(() => {
    installLocalStorageMock()
    window.localStorage.clear()
  })

  it('parses one-based slice labels into zero-based indexes', () => {
    expect(parseSliceLabel('1 / 40')).toEqual({ current: 1, total: 40, index: 0 })
    expect(parseSliceLabel('12/40')).toEqual({ current: 12, total: 40, index: 11 })
    expect(parseSliceLabel('99 / 40')).toEqual({ current: 40, total: 40, index: 39 })
    expect(parseSliceLabel('Slice --')).toBeNull()
  })

  it('toggles, sorts, and persists key slice indexes per series', () => {
    const stars = useKeySliceStars(STORAGE_KEY)

    expect(stars.toggleSliceStar('series-a', 8)).toBe(true)
    expect(stars.toggleSliceStar('series-a', 2)).toBe(true)
    expect(stars.getStarredSliceIndexes('series-a')).toEqual([2, 8])
    expect(stars.getStarredSlices('series-a')).toEqual([{ sliceIndex: 2 }, { sliceIndex: 8 }])
    expect(stars.getStarredSliceCount('series-a')).toBe(2)
    expect(stars.isSliceStarred('series-a', 8)).toBe(true)

    const reloaded = useKeySliceStars(STORAGE_KEY)
    expect(reloaded.getStarredSliceIndexes('series-a')).toEqual([2, 8])

    expect(reloaded.toggleSliceStar('series-a', 8)).toBe(false)
    expect(reloaded.getStarredSliceIndexes('series-a')).toEqual([2])
  })

  it('migrates old arrays and persists editable labels', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'series-a': [1, 4] }))
    const stars = useKeySliceStars(STORAGE_KEY)

    expect(stars.getStarredSlices('series-a')).toEqual([{ sliceIndex: 1 }, { sliceIndex: 4 }])
    expect(stars.updateSliceStarLabel('series-a', 4, '  Follow up slice  ')).toBe(true)
    expect(stars.getStarredSlices('series-a')).toEqual([
      { sliceIndex: 1 },
      { sliceIndex: 4, label: 'Follow up slice' }
    ])

    const reloaded = useKeySliceStars(STORAGE_KEY)
    expect(reloaded.getStarredSlices('series-a')).toEqual([
      { sliceIndex: 1 },
      { sliceIndex: 4, label: 'Follow up slice' }
    ])

    expect(reloaded.updateSliceStarLabel('series-a', 4, '   ')).toBe(true)
    expect(reloaded.getStarredSlices('series-a')).toEqual([{ sliceIndex: 1 }, { sliceIndex: 4 }])
  })

  it('shares reactive state across composable instances', () => {
    const left = useKeySliceStars(STORAGE_KEY)
    const right = useKeySliceStars(STORAGE_KEY)

    left.toggleSliceStar('series-a', 4)

    expect(right.getStarredSliceIndexes('series-a')).toEqual([4])
    expect(right.isSliceStarred('series-a', 4)).toBe(true)
  })

  it('clears all key slices for one series', () => {
    const stars = useKeySliceStars(STORAGE_KEY)
    stars.toggleSliceStar('series-a', 1)
    stars.toggleSliceStar('series-a', 5)
    stars.toggleSliceStar('series-b', 2)

    expect(stars.clearSeriesStars('series-a')).toBe(true)
    expect(stars.getStarredSliceIndexes('series-a')).toEqual([])
    expect(stars.getStarredSliceIndexes('series-b')).toEqual([2])
    expect(stars.clearSeriesStars('series-a')).toBe(false)
  })

  it('ignores invalid stored values', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'series-a': [3, -1, 3, '5', null],
        'series-labeled': [{ sliceIndex: 8, label: '  A  ' }, { index: 9, label: '' }],
        'series-b': 'invalid',
        '': [1]
      })
    )

    const stars = useKeySliceStars(STORAGE_KEY)
    expect(stars.getStarredSliceIndexes('series-a')).toEqual([3, 5])
    expect(stars.getStarredSlices('series-labeled')).toEqual([{ sliceIndex: 8, label: 'A' }, { sliceIndex: 9 }])
    expect(stars.getStarredSliceIndexes('series-b')).toEqual([])
  })
})
