import { describe, expect, it } from 'vitest'
import type { ViewerTabItem } from '../../../types/viewer'
import { createKeyedLatestRequestGuard } from '../requests/latestRequest'
import { applyMtfAnalysisResultToTabs, buildMtfAnalysisRequest } from './mtfAnalysisState'

function createTab(key: string, mtfId: string): ViewerTabItem {
  return {
    key,
    title: key,
    viewType: 'Stack',
    seriesId: `series-${key}`,
    mtfState: {
      selectedMtfId: mtfId,
      items: [
        {
          mtfId,
          viewportKey: 'single',
          points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
          status: 'calculating'
        }
      ]
    }
  } as ViewerTabItem
}

describe('MTF analysis result routing', () => {
  it('pins the backend request to the source slice shown when the ROI was committed', () => {
    expect(buildMtfAnalysisRequest({
      viewId: 'view-1',
      viewportKey: 'single',
      points: [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.9 }],
      sourceSliceIndex: 7
    })).toEqual({
      viewId: 'view-1',
      viewportKey: 'single',
      points: [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.9 }],
      sourceSliceIndex: 7
    })
  })

  it('updates the initiating tab even after another tab becomes active', () => {
    const source = createTab('source', 'mtf-1')
    const active = createTab('active', 'mtf-2')

    const nextTabs = applyMtfAnalysisResultToTabs([source, active], 'source', 'mtf-1', (tab) => ({
      ...tab,
      title: 'source-updated'
    }))

    expect(nextTabs[0]?.title).toBe('source-updated')
    expect(nextTabs[1]).toBe(active)
  })

  it('does not recreate an ROI that was removed while analysis was pending', () => {
    const source = { ...createTab('source', 'mtf-1'), mtfState: null }
    const nextTabs = applyMtfAnalysisResultToTabs([source], 'source', 'mtf-1', (tab) => ({
      ...tab,
      title: 'should-not-update'
    }))

    expect(nextTabs[0]).toBe(source)
  })

  it('rejects an older response for the same tab and ROI', () => {
    const guard = createKeyedLatestRequestGuard<string>()
    const key = 'source:mtf-1'
    const older = guard.start(key)
    const latest = guard.start(key)

    expect(guard.isCurrent(key, older.token)).toBe(false)
    expect(guard.isCurrent(key, latest.token)).toBe(true)
  })
})
