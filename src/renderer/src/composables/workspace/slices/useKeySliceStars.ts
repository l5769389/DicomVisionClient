import { ref, type Ref } from 'vue'

const DEFAULT_STORAGE_KEY = 'dicomvision-key-slice-stars'

type KeySliceStarStore = Record<string, number[]>
const sharedStores = new Map<string, Ref<KeySliceStarStore>>()

export interface ParsedSliceLabel {
  current: number
  total: number
  index: number
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeSliceIndex(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null
  }
  return Math.trunc(numeric)
}

function normalizeSliceIndexes(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return []
  }

  return [...new Set(values.map(normalizeSliceIndex).filter((value): value is number => value !== null))].sort((a, b) => a - b)
}

function normalizeStore(value: unknown): KeySliceStarStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([seriesId, indexes]) => [seriesId, normalizeSliceIndexes(indexes)] as const)
      .filter(([seriesId, indexes]) => Boolean(seriesId) && indexes.length > 0)
  )
}

function readStore(storageKey: string): KeySliceStarStore {
  const storage = getStorage()
  if (!storage) {
    return {}
  }

  try {
    return normalizeStore(JSON.parse(storage.getItem(storageKey) ?? '{}'))
  } catch {
    return {}
  }
}

function writeStore(storageKey: string, store: KeySliceStarStore): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(storageKey, JSON.stringify(normalizeStore(store)))
  } catch {
    // localStorage may be unavailable or full; keep the in-memory state usable.
  }
}

function resolveSharedStore(storageKey: string): Ref<KeySliceStarStore> {
  const storedValue = readStore(storageKey)
  const existing = sharedStores.get(storageKey)
  if (existing) {
    existing.value = storedValue
    return existing
  }

  const nextStore = ref<KeySliceStarStore>(storedValue)
  sharedStores.set(storageKey, nextStore)
  return nextStore
}

export function parseSliceLabel(sliceLabel: string | null | undefined): ParsedSliceLabel | null {
  const match = sliceLabel?.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return null
  }

  const current = Number(match[1])
  const total = Number(match[2])
  if (!Number.isFinite(current) || !Number.isFinite(total) || current <= 0 || total <= 0) {
    return null
  }

  const clampedCurrent = Math.min(Math.trunc(current), Math.trunc(total))
  return {
    current: clampedCurrent,
    total: Math.trunc(total),
    index: clampedCurrent - 1
  }
}

export function useKeySliceStars(storageKey = DEFAULT_STORAGE_KEY) {
  const starredBySeries = resolveSharedStore(storageKey)

  function persist(nextStore: KeySliceStarStore): void {
    starredBySeries.value = normalizeStore(nextStore)
    writeStore(storageKey, starredBySeries.value)
  }

  function getStarredSliceIndexes(seriesId: string | null | undefined): number[] {
    if (!seriesId) {
      return []
    }
    return normalizeSliceIndexes(starredBySeries.value[seriesId])
  }

  function isSliceStarred(seriesId: string | null | undefined, sliceIndex: number | null | undefined): boolean {
    const normalizedIndex = normalizeSliceIndex(sliceIndex)
    return Boolean(seriesId && normalizedIndex !== null && starredBySeries.value[seriesId]?.includes(normalizedIndex))
  }

  function toggleSliceStar(seriesId: string | null | undefined, sliceIndex: number | null | undefined): boolean {
    const normalizedIndex = normalizeSliceIndex(sliceIndex)
    if (!seriesId || normalizedIndex === null) {
      return false
    }

    const existing = getStarredSliceIndexes(seriesId)
    const nextIndexes = existing.includes(normalizedIndex)
      ? existing.filter((index) => index !== normalizedIndex)
      : [...existing, normalizedIndex].sort((a, b) => a - b)
    const nextStore = { ...starredBySeries.value }

    if (nextIndexes.length > 0) {
      nextStore[seriesId] = nextIndexes
    } else {
      delete nextStore[seriesId]
    }
    persist(nextStore)
    return nextIndexes.includes(normalizedIndex)
  }

  function clearSeriesStars(seriesId: string | null | undefined): boolean {
    if (!seriesId || !starredBySeries.value[seriesId]?.length) {
      return false
    }

    const nextStore = { ...starredBySeries.value }
    delete nextStore[seriesId]
    persist(nextStore)
    return true
  }

  function getStarredSliceCount(seriesId: string | null | undefined): number {
    return getStarredSliceIndexes(seriesId).length
  }

  return {
    starredBySeries,
    getStarredSliceIndexes,
    getStarredSliceCount,
    clearSeriesStars,
    isSliceStarred,
    toggleSliceStar
  }
}
