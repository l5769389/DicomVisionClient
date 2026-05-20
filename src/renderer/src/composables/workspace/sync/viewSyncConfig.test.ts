import { describe, expect, it } from 'vitest'
import { VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { ViewerTabItem } from '../../../types/viewer'
import {
  COMPARE_SYNC_DEFAULTS,
  LAYOUT_SYNC_DEFAULTS,
  createCompareSyncDefaults,
  createLayoutSyncDefaults,
  getViewSyncEnabled,
  shouldSyncViewOperation,
  withViewSyncValue
} from './viewSyncConfig'

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
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false },
    pseudocolorPreset: 'bw',
    ...overrides
  } as ViewerTabItem
}

describe('viewSyncConfig', () => {
  it('creates explicit sync defaults for compare and layout tabs', () => {
    expect(createCompareSyncDefaults()).toEqual({
      compareSyncScroll: COMPARE_SYNC_DEFAULTS.scroll,
      compareSyncWindow: COMPARE_SYNC_DEFAULTS.window,
      compareSyncPseudocolor: COMPARE_SYNC_DEFAULTS.pseudocolor,
      compareSyncView: COMPARE_SYNC_DEFAULTS.view,
      compareSyncTransform: COMPARE_SYNC_DEFAULTS.transform,
      compareSyncReset: COMPARE_SYNC_DEFAULTS.reset
    })
    expect(createLayoutSyncDefaults()).toEqual({
      layoutSyncScroll: LAYOUT_SYNC_DEFAULTS.scroll,
      layoutSyncWindow: LAYOUT_SYNC_DEFAULTS.window,
      layoutSyncPseudocolor: LAYOUT_SYNC_DEFAULTS.pseudocolor,
      layoutSyncView: LAYOUT_SYNC_DEFAULTS.view,
      layoutSyncTransform: LAYOUT_SYNC_DEFAULTS.transform,
      layoutSyncReset: LAYOUT_SYNC_DEFAULTS.reset
    })
  })

  it('maps view operations to the correct compare sync switches', () => {
    const tab = createTab({ viewType: 'CompareStack' })

    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.scroll)).toBe(true)
    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.window)).toBe(true)
    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.pseudocolor)).toBe(true)
    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.pan)).toBe(true)
    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.zoom)).toBe(true)
    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.transform2d)).toBe(false)
    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.reset)).toBe(true)
    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.measurement)).toBe(false)
    expect(shouldSyncViewOperation(tab, VIEW_OPERATION_TYPES.setSize)).toBe(false)
  })

  it('keeps layout independent by default but honors explicit sync overrides', () => {
    const layoutTab = createTab({ viewType: 'Layout' })

    expect(getViewSyncEnabled(layoutTab, 'scroll')).toBe(false)
    expect(shouldSyncViewOperation(layoutTab, VIEW_OPERATION_TYPES.scroll)).toBe(false)

    const syncedLayout = withViewSyncValue(layoutTab, 'scroll', true)
    expect(syncedLayout).not.toBe(layoutTab)
    expect(syncedLayout.layoutSyncScroll).toBe(true)
    expect(shouldSyncViewOperation(syncedLayout, VIEW_OPERATION_TYPES.scroll)).toBe(true)
  })

  it('honors explicit compare overrides and ignores unsupported tab types', () => {
    const compareTab = createTab({ viewType: 'CompareStack', compareSyncView: false })
    const stackTab = createTab({ viewType: 'Stack' })

    expect(getViewSyncEnabled(compareTab, 'view')).toBe(false)
    expect(shouldSyncViewOperation(compareTab, VIEW_OPERATION_TYPES.pan)).toBe(false)
    expect(withViewSyncValue(stackTab, 'scroll', true)).toBe(stackTab)
    expect(shouldSyncViewOperation(stackTab, VIEW_OPERATION_TYPES.scroll)).toBe(false)
  })
})
