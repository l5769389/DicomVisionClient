import type {
  CompareStackPaneKey,
  MprViewportKey,
  ViewerLayoutSlot,
  ViewerLayoutTemplate,
  ViewerTabItem
} from '../../../types/viewer'

export interface LayoutImageClone {
  imageSrc: string | null
  ownsImageSrc: boolean
}

export type CloneLayoutImageSrc = (imageSrc: string | null | undefined) => Promise<LayoutImageClone>

const MPR_LAYOUT_VIEWPORT_KEYS: MprViewportKey[] = ['mpr-ax', 'mpr-cor', 'mpr-sag']
const COMPARE_LAYOUT_PANE_KEYS: CompareStackPaneKey[] = ['compare-a', 'compare-b']
const SEED_SLOT_GEOMETRY = {
  row: 0,
  column: 0,
  rowSpan: 1,
  columnSpan: 1
} as const

export function getOwnedLayoutSlotImageSrcs(slots: ViewerLayoutSlot[] | null | undefined): string[] {
  return (slots ?? [])
    .filter((slot) => slot.ownsImageSrc && Boolean(slot.imageSrc))
    .map((slot) => slot.imageSrc!)
}

function mergeLayoutSlot(baseSlot: ViewerLayoutSlot, seedSlot: ViewerLayoutSlot): ViewerLayoutSlot {
  return {
    ...baseSlot,
    ...seedSlot,
    id: baseSlot.id,
    row: baseSlot.row,
    column: baseSlot.column,
    rowSpan: baseSlot.rowSpan,
    columnSpan: baseSlot.columnSpan
  }
}

function prioritizeSeedSlots(seedSlots: ViewerLayoutSlot[], preferredViewportKey?: string | null): ViewerLayoutSlot[] {
  if (!preferredViewportKey) {
    return seedSlots
  }

  const preferredIndex = seedSlots.findIndex(
    (slot) => slot.id === preferredViewportKey || slot.viewportKey === preferredViewportKey
  )
  if (preferredIndex <= 0) {
    return seedSlots
  }

  const preferredSlot = seedSlots[preferredIndex]
  return [
    preferredSlot,
    ...seedSlots.slice(0, preferredIndex),
    ...seedSlots.slice(preferredIndex + 1)
  ]
}

async function withClonedPreview(
  slot: ViewerLayoutSlot,
  imageSrc: string | null | undefined,
  cloneImageSrc: CloneLayoutImageSrc
): Promise<ViewerLayoutSlot> {
  const clonedImage = await cloneImageSrc(imageSrc)
  return {
    ...slot,
    imageSrc: clonedImage.imageSrc,
    ownsImageSrc: clonedImage.ownsImageSrc
  }
}

function createSeedSlot(overrides: Omit<ViewerLayoutSlot, 'row' | 'column' | 'rowSpan' | 'columnSpan'>): ViewerLayoutSlot {
  return {
    ...SEED_SLOT_GEOMETRY,
    ...overrides
  }
}

async function createStackLayoutSeedSlot(
  tab: ViewerTabItem,
  cloneImageSrc: CloneLayoutImageSrc
): Promise<ViewerLayoutSlot> {
  return await withClonedPreview(
    createSeedSlot({
      id: 'seed-stack',
      seriesId: tab.seriesId,
      seriesTitle: tab.seriesTitle,
      viewType: tab.viewType,
      sourceViewType: tab.viewType,
      viewportKey: 'single',
      viewId: tab.viewId,
      sliceLabel: tab.sliceLabel,
      windowLabel: tab.windowLabel,
      initialWindowInfo: tab.initialWindowInfo ?? null
    }),
    tab.imageSrc,
    cloneImageSrc
  )
}

async function createMprLayoutSeedSlots(
  tab: ViewerTabItem,
  cloneImageSrc: CloneLayoutImageSrc
): Promise<ViewerLayoutSlot[]> {
  return await Promise.all(
    MPR_LAYOUT_VIEWPORT_KEYS.map(async (viewportKey) => {
      return await withClonedPreview(
        createSeedSlot({
          id: `seed-${viewportKey}`,
          seriesId: tab.seriesId,
          seriesTitle: tab.seriesTitle,
          viewType: tab.viewType,
          sourceViewType: tab.viewType,
          viewportKey,
          viewId: tab.viewportViewIds?.[viewportKey] ?? null,
          sliceLabel: tab.viewportSliceLabels?.[viewportKey] ?? '',
          windowLabel: tab.windowLabel,
          initialWindowInfo: tab.viewportInitialWindowInfos?.[viewportKey] ?? null
        }),
        tab.viewportImages?.[viewportKey],
        cloneImageSrc
      )
    })
  )
}

async function createCompareLayoutSeedSlots(
  tab: ViewerTabItem,
  cloneImageSrc: CloneLayoutImageSrc
): Promise<ViewerLayoutSlot[]> {
  return await Promise.all(
    COMPARE_LAYOUT_PANE_KEYS.map(async (paneKey) => {
      return await withClonedPreview(
        createSeedSlot({
          id: `seed-${paneKey}`,
          seriesId: tab.compareSeriesIds?.[paneKey] ?? null,
          seriesTitle: tab.compareSeriesTitles?.[paneKey] ?? null,
          viewType: 'Stack',
          sourceViewType: 'CompareStack',
          viewportKey: paneKey,
          viewId: tab.compareViewIds?.[paneKey] ?? null,
          sliceLabel: tab.compareSliceLabels?.[paneKey] ?? '',
          windowLabel: tab.compareWindowLabels?.[paneKey] ?? '',
          initialWindowInfo: tab.compareInitialWindowInfos?.[paneKey] ?? null
        }),
        tab.compareImages?.[paneKey],
        cloneImageSrc
      )
    })
  )
}

async function createLayoutSeedSlots(
  tab: ViewerTabItem | null,
  cloneImageSrc: CloneLayoutImageSrc
): Promise<ViewerLayoutSlot[]> {
  if (!tab) {
    return []
  }

  if (tab.viewType === 'CompareStack') {
    return await createCompareLayoutSeedSlots(tab, cloneImageSrc)
  }
  if (tab.viewType === 'MPR' || tab.viewType === '4D') {
    return await createMprLayoutSeedSlots(tab, cloneImageSrc)
  }
  if (tab.viewType === 'Stack' || tab.viewType === '3D') {
    return [await createStackLayoutSeedSlot(tab, cloneImageSrc)]
  }
  if (tab.viewType === 'Layout') {
    return await Promise.all(
      (tab.layoutSlots ?? []).map(async (slot) => {
        return await withClonedPreview(slot, slot.imageSrc, cloneImageSrc)
      })
    )
  }
  return []
}

export async function createSeededLayoutSlots(
  template: ViewerLayoutTemplate,
  sourceTab: ViewerTabItem | null,
  cloneImageSrc: CloneLayoutImageSrc,
  preferredViewportKey?: string | null
): Promise<ViewerLayoutSlot[]> {
  const baseSlots = template.slots.map((slot) => ({ ...slot }))
  const rawSeedSlots = await createLayoutSeedSlots(sourceTab, cloneImageSrc)
  const seedSlots =
    baseSlots.length < rawSeedSlots.length
      ? prioritizeSeedSlots(rawSeedSlots, preferredViewportKey)
      : rawSeedSlots
  seedSlots.slice(0, baseSlots.length).forEach((seedSlot, index) => {
    baseSlots[index] = mergeLayoutSlot(baseSlots[index]!, seedSlot)
  })
  return baseSlots
}
