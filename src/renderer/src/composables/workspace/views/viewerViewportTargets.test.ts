import { describe, expect, it } from 'vitest'
import { VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { ViewerTabItem } from '../../../types/viewer'
import {
  resolveCompareOperationPaneKeys,
  resolveCompareOperationViewIds,
  resolveComparePaneKey,
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
})
