import { describe, expect, it } from 'vitest'
import { DEFAULT_PSEUDOCOLOR_PRESET } from '../../../constants/pseudocolor'
import type { ViewTransformInfo, ViewerTabItem } from '../../../types/viewer'
import type { ViewportOperationTarget } from '../views/viewerViewportTargets'
import {
  applyPseudocolorToTabTargets,
  applyTransformToTabTargets,
  resetMprViewportState,
  resetTabViewStateTargets
} from './viewTabPatches'

const DEFAULT_TRANSFORM: ViewTransformInfo = {
  rotationDegrees: 0,
  horFlip: false,
  verFlip: false,
  zoom: 1,
  offsetX: 0,
  offsetY: 0
}

const ROTATED_TRANSFORM: ViewTransformInfo = {
  rotationDegrees: 90,
  horFlip: true,
  verFlip: false,
  zoom: 1,
  offsetX: 0,
  offsetY: 0
}

function createTab(overrides: Partial<ViewerTabItem>): ViewerTabItem {
  return {
    key: 'tab',
    seriesId: 'series',
    seriesTitle: 'Series',
    title: 'Series Stack',
    viewType: 'Stack',
    viewId: 'view',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    transformState: DEFAULT_TRANSFORM,
    pseudocolorPreset: DEFAULT_PSEUDOCOLOR_PRESET,
    ...overrides
  } as ViewerTabItem
}

function target(target: ViewportOperationTarget): ViewportOperationTarget {
  return target
}

describe('viewTabPatches', () => {
  it('patches only targeted compare panes', () => {
    const tab = createTab({
      viewType: 'CompareStack',
      compareViewIds: {
        'compare-a': 'view-a',
        'compare-b': 'view-b'
      }
    })

    const transformed = applyTransformToTabTargets(
      tab,
      [target({ viewId: 'view-b', viewportKey: 'compare-b', kind: 'compare' })],
      ROTATED_TRANSFORM
    )
    const recolored = applyPseudocolorToTabTargets(
      transformed,
      [target({ viewId: 'view-b', viewportKey: 'compare-b', kind: 'compare' })],
      'hotIron'
    )

    expect(recolored.compareTransformStates?.['compare-a']).toEqual(DEFAULT_TRANSFORM)
    expect(recolored.compareTransformStates?.['compare-b']).toEqual(ROTATED_TRANSFORM)
    expect(recolored.comparePseudocolorPresets?.['compare-a']).toBe(DEFAULT_PSEUDOCOLOR_PRESET)
    expect(recolored.comparePseudocolorPresets?.['compare-b']).toBe('hotIron')
  })

  it('patches layout slots by resolved operation targets', () => {
    const tab = createTab({
      viewType: 'Layout',
      layoutSlots: [
        {
          id: 'slot-a',
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          viewType: 'Stack',
          viewId: 'view-a',
          pseudocolorPreset: 'bw',
          transformState: DEFAULT_TRANSFORM
        },
        {
          id: 'slot-b',
          row: 0,
          column: 1,
          rowSpan: 1,
          columnSpan: 1,
          viewType: 'Stack',
          viewId: 'view-b',
          pseudocolorPreset: 'bw',
          transformState: DEFAULT_TRANSFORM
        }
      ]
    })

    const nextTab = applyPseudocolorToTabTargets(
      applyTransformToTabTargets(
        tab,
        [target({ viewId: 'view-b', viewportKey: 'slot-b', kind: 'layout' })],
        ROTATED_TRANSFORM
      ),
      [target({ viewId: 'view-b', viewportKey: 'slot-b', kind: 'layout' })],
      'cardiac'
    )

    expect(nextTab.layoutSlots?.[0]?.transformState).toEqual(DEFAULT_TRANSFORM)
    expect(nextTab.layoutSlots?.[0]?.pseudocolorPreset).toBe('bw')
    expect(nextTab.layoutSlots?.[1]?.transformState).toEqual(ROTATED_TRANSFORM)
    expect(nextTab.layoutSlots?.[1]?.pseudocolorPreset).toBe('cardiac')
  })

  it('resets only the supplied targets in a multi-viewport tab', () => {
    const tab = createTab({
      viewType: 'MPR',
      viewportTransformStates: {
        'mpr-ax': ROTATED_TRANSFORM,
        'mpr-cor': ROTATED_TRANSFORM,
        'mpr-sag': ROTATED_TRANSFORM
      },
      viewportPseudocolorPresets: {
        'mpr-ax': 'rainbow',
        'mpr-cor': 'hotIron',
        'mpr-sag': 'cardiac'
      }
    })

    const nextTab = resetTabViewStateTargets(
      tab,
      [target({ viewId: 'cor-view', viewportKey: 'mpr-cor', kind: 'mpr' })],
      DEFAULT_TRANSFORM
    )

    expect(nextTab.viewportTransformStates?.['mpr-ax']).toEqual(ROTATED_TRANSFORM)
    expect(nextTab.viewportTransformStates?.['mpr-cor']).toEqual(DEFAULT_TRANSFORM)
    expect(nextTab.viewportPseudocolorPresets?.['mpr-ax']).toBe('rainbow')
    expect(nextTab.viewportPseudocolorPresets?.['mpr-cor']).toBe(DEFAULT_PSEUDOCOLOR_PRESET)
  })

  it('creates reset state for selected MPR viewports', () => {
    expect(resetMprViewportState(['mpr-ax', 'mpr-sag'], DEFAULT_TRANSFORM)).toEqual({
      viewportTransformStates: {
        'mpr-ax': DEFAULT_TRANSFORM,
        'mpr-cor': DEFAULT_TRANSFORM,
        'mpr-sag': DEFAULT_TRANSFORM
      },
      viewportPseudocolorPresets: {
        'mpr-ax': DEFAULT_PSEUDOCOLOR_PRESET,
        'mpr-cor': DEFAULT_PSEUDOCOLOR_PRESET,
        'mpr-sag': DEFAULT_PSEUDOCOLOR_PRESET
      }
    })
  })
})
