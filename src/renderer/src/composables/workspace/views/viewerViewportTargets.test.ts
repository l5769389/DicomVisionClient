import { describe, expect, it } from 'vitest'
import { VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { ViewerTabItem } from '../../../types/viewer'
import {
  resolveCompareOperationPaneKeys,
  resolveCompareOperationViewIds,
  resolveComparePaneKey,
  resolveOperationTargets,
  resolveMprViewportKey,
  resolveViewIdForTabViewport
} from './viewerViewportTargets'

function createTab(overrides: Partial<ViewerTabItem>): ViewerTabItem {
  return {
    key: 'tab',
    seriesId: 'series',
    seriesTitle: 'Series',
    title: 'Series · Stack',
    viewId: 'stack-view',
    viewType: 'Stack',
    ...overrides
  } as ViewerTabItem
}

describe('viewer viewport targets', () => {
  it('normalizes unknown viewport keys to primary panes', () => {
    expect(resolveMprViewportKey('unknown')).toBe('mpr-ax')
    expect(resolveComparePaneKey('unknown')).toBe('compare-a')
  })

  it('resolves view ids by view type', () => {
    expect(resolveViewIdForTabViewport(createTab({ viewId: 'stack-view' }), 'single')).toBe('stack-view')
    expect(
      resolveViewIdForTabViewport(
        createTab({
          viewType: 'MPR',
          viewportViewIds: {
            'mpr-ax': 'ax',
            'mpr-cor': 'cor',
            'mpr-sag': 'sag'
          }
        }),
        'mpr-cor'
      )
    ).toBe('cor')
    expect(
      resolveViewIdForTabViewport(
        createTab({
          compareViewIds: {
            'compare-a': 'view-a',
            'compare-b': 'view-b'
          },
          viewType: 'CompareStack'
        }),
        'compare-b'
      )
    ).toBe('view-b')
    expect(
      resolveViewIdForTabViewport(
        createTab({
          layoutSlots: [
            {
              id: 'slot-1-1',
              row: 0,
              column: 0,
              rowSpan: 1,
              columnSpan: 1,
              viewType: 'Stack',
              viewId: 'layout-view-a'
            }
          ],
          viewType: 'Layout'
        }),
        'slot-1-1'
      )
    ).toBe('layout-view-a')
  })

  it('keeps MPR + 3D volume operations on the volume view id', () => {
    const tab = createTab({
      viewType: 'MPR',
      viewId: 'volume-view',
      viewportViewIds: {
        'mpr-ax': 'axial-view',
        'mpr-cor': 'coronal-view',
        'mpr-sag': 'sagittal-view'
      }
    })

    expect(resolveViewIdForTabViewport(tab, 'volume')).toBe('volume-view')
    expect(resolveOperationTargets(tab, 'volume', VIEW_OPERATION_TYPES.rotate3d)).toEqual([
      {
        viewId: 'volume-view',
        viewportKey: 'volume',
        kind: 'mpr-volume'
      }
    ])
  })

  it('orders compare operation targets from the active pane', () => {
    const tab = createTab({
      compareSyncScroll: true,
      compareViewIds: {
        'compare-a': 'view-a',
        'compare-b': 'view-b'
      },
      viewType: 'CompareStack'
    })

    expect(resolveCompareOperationPaneKeys(tab, 'compare-b', VIEW_OPERATION_TYPES.scroll)).toEqual([
      'compare-b',
      'compare-a'
    ])
    expect(resolveCompareOperationViewIds(tab, 'compare-b', VIEW_OPERATION_TYPES.scroll)).toEqual([
      'view-b',
      'view-a'
    ])
  })

  it('keeps compare targets local when sync is disabled', () => {
    const tab = createTab({
      compareSyncScroll: false,
      compareViewIds: {
        'compare-a': 'view-a',
        'compare-b': 'view-b'
      },
      viewType: 'CompareStack'
    })

    expect(resolveCompareOperationViewIds(tab, 'compare-b', VIEW_OPERATION_TYPES.scroll)).toEqual(['view-b'])
  })

  it('uses compare reset sync to decide whether reset targets one pane or both panes', () => {
    const tab = createTab({
      compareViewIds: {
        'compare-a': 'view-a',
        'compare-b': 'view-b'
      },
      viewType: 'CompareStack'
    })

    expect(resolveCompareOperationViewIds(tab, 'compare-b', VIEW_OPERATION_TYPES.reset)).toEqual([
      'view-b',
      'view-a'
    ])
    expect(resolveCompareOperationViewIds({ ...tab, compareSyncReset: false }, 'compare-b', VIEW_OPERATION_TYPES.reset)).toEqual(['view-b'])
  })

  it('keeps layout operation targets local until layout sync is enabled', () => {
    const tab = createTab({
      layoutSlots: [
        {
          id: 'slot-1-1',
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          viewType: 'Stack',
          viewId: 'layout-view-a'
        },
        {
          id: 'slot-1-2',
          row: 0,
          column: 1,
          rowSpan: 1,
          columnSpan: 1,
          viewType: 'Stack',
          viewId: 'layout-view-b'
        }
      ],
      viewType: 'Layout'
    })

    expect(resolveCompareOperationViewIds(tab, 'slot-1-2', VIEW_OPERATION_TYPES.scroll)).toEqual(['layout-view-b'])
    expect(
      resolveCompareOperationViewIds(
        {
          ...tab,
          layoutSyncScroll: true
        },
        'slot-1-2',
        VIEW_OPERATION_TYPES.scroll
      )
    ).toEqual(['layout-view-b', 'layout-view-a'])
    expect(resolveCompareOperationViewIds(tab, 'slot-1-2', VIEW_OPERATION_TYPES.reset)).toEqual(['layout-view-b'])
    expect(resolveCompareOperationViewIds({ ...tab, layoutSyncReset: true }, 'slot-1-2', VIEW_OPERATION_TYPES.reset)).toEqual([
      'layout-view-b',
      'layout-view-a'
    ])
  })
})
