import { ref, type Ref } from 'vue'

const DEFAULT_STORAGE_KEY = 'dicomvision-key-slice-stars'
const MAX_KEY_SLICE_LABEL_LENGTH = 40

export interface KeySliceStarItem {
  sliceIndex: number
  label?: string
}

type KeySliceStarStore = Record<string, KeySliceStarItem[]>
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

function normalizeSliceLabel(value: unknown): string | undefined {
  const label = String(value ?? '').trim().slice(0, MAX_KEY_SLICE_LABEL_LENGTH)
  return label.length > 0 ? label : undefined
}

function normalizeSliceStarItem(value: unknown): KeySliceStarItem | null {
  if (typeof value === 'number' || typeof value === 'string') {
    const sliceIndex = normalizeSliceIndex(value)
    return sliceIndex === null ? null : { sliceIndex }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const rawItem = value as { sliceIndex?: unknown; index?: unknown; label?: unknown }
  const sliceIndex = normalizeSliceIndex(rawItem.sliceIndex ?? rawItem.index)
  if (sliceIndex === null) {
    return null
  }

  const label = normalizeSliceLabel(rawItem.label)
  return label ? { sliceIndex, label } : { sliceIndex }
}

function normalizeSliceItems(values: unknown): KeySliceStarItem[] {
  if (!Array.isArray(values)) {
    return []
  }

  const byIndex = new Map<number, KeySliceStarItem>()
  for (const value of values) {
    const item = normalizeSliceStarItem(value)
    if (item) {
      byIndex.set(item.sliceIndex, item)
    }
  }
  return [...byIndex.values()].sort((a, b) => a.sliceIndex - b.sliceIndex)
}

function normalizeSliceIndexes(values: unknown): number[] {
  return normalizeSliceItems(values).map((item) => item.sliceIndex)
}

function normalizeStore(value: unknown): KeySliceStarStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([seriesId, items]) => [seriesId, normalizeSliceItems(items)] as const)
      .filter(([seriesId, items]) => Boolean(seriesId) && items.length > 0)
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

  function getStarredSlices(seriesId: string | null | undefined): KeySliceStarItem[] {
    if (!seriesId) {
      return []
    }
    return normalizeSliceItems(starredBySeries.value[seriesId])
  }

  function isSliceStarred(seriesId: string | null | undefined, sliceIndex: number | null | undefined): boolean {
    const normalizedIndex = normalizeSliceIndex(sliceIndex)
    return Boolean(seriesId && normalizedIndex !== null && getStarredSliceIndexes(seriesId).includes(normalizedIndex))
  }

  function toggleSliceStar(seriesId: string | null | undefined, sliceIndex: number | null | undefined): boolean {
    const normalizedIndex = normalizeSliceIndex(sliceIndex)
    if (!seriesId || normalizedIndex === null) {
      return false
    }

    const existing = getStarredSlices(seriesId)
    const isExisting = existing.some((item) => item.sliceIndex === normalizedIndex)
    const nextItems = isExisting
      ? existing.filter((item) => item.sliceIndex !== normalizedIndex)
      : [...existing, { sliceIndex: normalizedIndex }].sort((a, b) => a.sliceIndex - b.sliceIndex)
    const nextStore = { ...starredBySeries.value }

    if (nextItems.length > 0) {
      nextStore[seriesId] = nextItems
    } else {
      delete nextStore[seriesId]
    }
    persist(nextStore)
    return !isExisting
  }

  function updateSliceStarLabel(
    seriesId: string | null | undefined,
    sliceIndex: number | null | undefined,
    label: string | null | undefined
  ): boolean {
    const normalizedIndex = normalizeSliceIndex(sliceIndex)
    if (!seriesId || normalizedIndex === null || !isSliceStarred(seriesId, normalizedIndex)) {
      return false
    }

    const normalizedLabel = normalizeSliceLabel(label)
    const nextItems = getStarredSlices(seriesId).map((item) => {
      if (item.sliceIndex !== normalizedIndex) {
        return item
      }
      return normalizedLabel ? { ...item, label: normalizedLabel } : { sliceIndex: item.sliceIndex }
    })
    persist({
      ...starredBySeries.value,
      [seriesId]: nextItems
    })
    return true
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
    getStarredSlices,
    getStarredSliceIndexes,
    getStarredSliceCount,
    clearSeriesStars,
    isSliceStarred,
    toggleSliceStar,
    updateSliceStarLabel
  }
}
