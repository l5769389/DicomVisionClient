import { describe, expect, it } from 'vitest'
import type { ViewerTabItem } from '../../../types/viewer'
import { createUniformLayoutTemplate } from './viewerLayoutTemplates'
import {
  createSeededLayoutSlots,
  getOwnedLayoutSlotImageSrcs,
  type CloneLayoutImageSrc
} from './viewerLayoutSlotSeeds'

const cloneImageSrc: CloneLayoutImageSrc = async (imageSrc) => ({
  imageSrc: imageSrc ? `copy:${imageSrc}` : null,
  ownsImageSrc: imageSrc?.startsWith('blob:') === true
})

function createTab(overrides: Partial<ViewerTabItem>): ViewerTabItem {
  return {
    key: 'tab',
    seriesId: 'series-a',
    seriesTitle: 'Series A',
    title: 'Series A · Stack',
    viewType: 'Stack',
    viewId: 'view-a',
    imageSrc: 'blob:stack',
    sliceLabel: '4 / 99',
    windowLabel: 'WW 400 WL 40',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false },
    pseudocolorPreset: 'bw',
    ...overrides
  } as ViewerTabItem
}

describe('viewerLayoutSlotSeeds', () => {
  it('keeps slot geometry while seeding the current Stack view into the first slot', async () => {
    const template = createUniformLayoutTemplate(2, 2)
    const slots = await createSeededLayoutSlots(template, createTab({}), cloneImageSrc)

    expect(slots[0]).toMatchObject({
      id: 'slot-1-1',
      row: 0,
      column: 0,
      rowSpan: 1,
      columnSpan: 1,
      seriesId: 'series-a',
      seriesTitle: 'Series A',
      sourceViewType: 'Stack',
      viewportKey: 'single',
      viewId: 'view-a',
      imageSrc: 'copy:blob:stack',
      ownsImageSrc: true,
      sliceLabel: '4 / 99',
      windowLabel: 'WW 400 WL 40'
    })
    expect(slots[1]).toMatchObject({
      id: 'slot-1-2',
      row: 0,
      column: 1
    })
    expect(slots[1]?.imageSrc).toBeUndefined()
  })

  it('seeds the current 3D view as a live volume layout slot', async () => {
    const volumeTab = createTab({
      viewType: '3D',
      viewId: 'volume-view',
      imageSrc: 'blob:volume',
      sliceLabel: '',
      windowLabel: '',
      cornerInfo: { topLeft: ['Patient'], topRight: [], bottomLeft: [], bottomRight: [] },
      orientation: { top: 'A', right: 'L', bottom: 'P', left: 'R', volumeQuaternion: [0, 0, 0, 1] }
    })

    const slots = await createSeededLayoutSlots(createUniformLayoutTemplate(1, 2), volumeTab, cloneImageSrc)

    expect(slots[0]).toMatchObject({
      id: 'slot-1-1',
      seriesId: 'series-a',
      viewType: '3D',
      sourceViewType: '3D',
      viewportKey: 'volume',
      viewId: 'volume-view',
      imageSrc: 'copy:blob:volume',
      ownsImageSrc: true,
      cornerInfo: { topLeft: ['Patient'] },
      orientation: { top: 'A', volumeQuaternion: [0, 0, 0, 1] }
    })
  })

  it('seeds CompareStack panes into the first two slots', async () => {
    const compareTab = createTab({
      viewType: 'CompareStack',
      compareSeriesIds: {
        'compare-a': 'series-a',
        'compare-b': 'series-b'
      },
      compareSeriesTitles: {
        'compare-a': 'Series A',
        'compare-b': 'Series B'
      },
      compareViewIds: {
        'compare-a': 'view-a',
        'compare-b': 'view-b'
      },
      compareImages: {
        'compare-a': 'blob:a',
        'compare-b': 'blob:b'
      },
      compareSliceLabels: {
        'compare-a': '1 / 20',
        'compare-b': '2 / 20'
      },
      compareWindowLabels: {
        'compare-a': 'WW 300 WL 30',
        'compare-b': 'WW 400 WL 40'
      }
    })

    const slots = await createSeededLayoutSlots(createUniformLayoutTemplate(1, 2), compareTab, cloneImageSrc)

    expect(slots[0]).toMatchObject({
      id: 'slot-1-1',
      seriesId: 'series-a',
      sourceViewType: 'CompareStack',
      viewportKey: 'compare-a',
      imageSrc: 'copy:blob:a'
    })
    expect(slots[1]).toMatchObject({
      id: 'slot-1-2',
      seriesId: 'series-b',
      sourceViewType: 'CompareStack',
      viewportKey: 'compare-b',
      imageSrc: 'copy:blob:b'
    })
  })

  it('seeds MPR panes in viewport order', async () => {
    const mprTab = createTab({
      viewType: 'MPR',
      viewportViewIds: {
        'mpr-ax': 'view-ax',
        'mpr-cor': 'view-cor',
        'mpr-sag': 'view-sag'
      },
      viewportImages: {
        'mpr-ax': 'blob:ax',
        'mpr-cor': 'blob:cor',
        'mpr-sag': ''
      },
      viewportSliceLabels: {
        'mpr-ax': 'AX 4',
        'mpr-cor': 'COR 5',
        'mpr-sag': 'SAG 6'
      }
    })

    const slots = await createSeededLayoutSlots(createUniformLayoutTemplate(1, 3), mprTab, cloneImageSrc)

    expect(slots.map((slot) => slot.viewportKey)).toEqual(['mpr-ax', 'mpr-cor', 'mpr-sag'])
    expect(slots[0]).toMatchObject({
      id: 'slot-1-1',
      viewId: 'view-ax',
      imageSrc: 'copy:blob:ax',
      sliceLabel: 'AX 4'
    })
    expect(slots[2]).toMatchObject({
      id: 'slot-1-3',
      viewId: 'view-sag',
      imageSrc: null,
      ownsImageSrc: false,
      sliceLabel: 'SAG 6'
    })
  })

  it('clones existing Layout previews when switching to another layout', async () => {
    const layoutTab = createTab({
      viewType: 'Layout',
      layoutSlots: [
        {
          id: 'existing-a',
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          seriesId: 'series-a',
          seriesTitle: 'Series A',
          viewType: 'Stack',
          sourceViewType: 'Stack',
          viewportKey: 'single',
          imageSrc: 'blob:layout-a',
          ownsImageSrc: true
        }
      ]
    })

    const slots = await createSeededLayoutSlots(createUniformLayoutTemplate(1, 1), layoutTab, cloneImageSrc)

    expect(slots[0]).toMatchObject({
      id: 'slot-1-1',
      row: 0,
      column: 0,
      seriesId: 'series-a',
      sourceViewType: 'Stack',
      imageSrc: 'copy:blob:layout-a',
      ownsImageSrc: true
    })
  })

  it('keeps the active Layout slot first when shrinking the layout', async () => {
    const layoutTab = createTab({
      viewType: 'Layout',
      layoutSlots: [
        {
          id: 'slot-1-1',
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          seriesId: 'series-a',
          seriesTitle: 'Series A',
          viewType: 'Stack',
          sourceViewType: 'Stack',
          viewportKey: 'single',
          viewId: 'view-a',
          imageSrc: 'blob:layout-a',
          ownsImageSrc: true
        },
        {
          id: 'slot-1-2',
          row: 0,
          column: 1,
          rowSpan: 1,
          columnSpan: 1,
          seriesId: 'series-b',
          seriesTitle: 'Series B',
          viewType: 'Stack',
          sourceViewType: 'Stack',
          viewportKey: 'single',
          viewId: 'view-b',
          imageSrc: 'blob:layout-b',
          ownsImageSrc: true
        }
      ]
    })

    const slots = await createSeededLayoutSlots(createUniformLayoutTemplate(1, 1), layoutTab, cloneImageSrc, 'slot-1-2')

    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({
      id: 'slot-1-1',
      seriesId: 'series-b',
      seriesTitle: 'Series B',
      viewId: 'view-b',
      imageSrc: 'copy:blob:layout-b'
    })
  })

  it('returns only owned layout preview object URLs for cleanup', () => {
    expect(
      getOwnedLayoutSlotImageSrcs([
        { id: 'a', row: 0, column: 0, rowSpan: 1, columnSpan: 1, imageSrc: 'blob:a', ownsImageSrc: true },
        { id: 'b', row: 0, column: 1, rowSpan: 1, columnSpan: 1, imageSrc: 'blob:b', ownsImageSrc: false },
        { id: 'c', row: 0, column: 2, rowSpan: 1, columnSpan: 1, imageSrc: null, ownsImageSrc: true }
      ])
    ).toEqual(['blob:a'])
  })
})
