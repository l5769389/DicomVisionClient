import { describe, expect, it, vi } from 'vitest'
import type { CornerInfo, ViewerTabItem } from '../../../types/viewer'
import {
  FourDPhaseRenderTracker,
  clampFourDPhaseIndex,
  createFourDPhaseCache,
  findFourDPhaseViewportByViewId,
  getFourDPhaseBackendViewIds,
  getFourDPhaseDisplayState,
  getFourDPhaseKey,
  hasReadyFourDPhaseCache,
  isFourDPhaseDisplayed,
  normalizeFourDPhaseItems,
  resolveFourDInitialPhaseIndex
} from './fourDPhaseState'

function emptyCornerInfo(): CornerInfo {
  return {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight: []
  }
}

function createFourDTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'root::4D',
    seriesId: 'root',
    seriesTitle: 'Root',
    title: 'Root / 4D',
    viewType: '4D',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo: emptyCornerInfo(),
    orientation: {
      top: null,
      right: null,
      bottom: null,
      left: null,
      volumeQuaternion: null
    },
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false
    },
    pseudocolorPreset: 'bw',
    fourDPhaseIndex: 0,
    fourDPhaseCount: 2,
    fourDPhaseItems: [
      { phaseIndex: 0, label: 'P0', seriesId: 'phase-0', imageSrc: 'preview-0' },
      { phaseIndex: 1, label: 'P1', seriesId: 'phase-1', imageSrc: 'preview-1' }
    ],
    fourDPhaseViewIds: {},
    fourDPhaseCache: {},
    ...overrides
  }
}

describe('fourDPhaseState', () => {
  it('normalizes phase manifests into sorted, contiguous phase items', () => {
    expect(
      normalizeFourDPhaseItems([
        {
          phaseIndex: 5,
          label: '',
          seriesId: 'late',
          viewportImages: {
            'mpr-cor': 'cor-late'
          },
          status: 'pending'
        },
        {
          phaseIndex: 2,
          label: 'Early',
          seriesId: null,
          imageSrc: '',
          status: 'ready'
        }
      ])
    ).toEqual([
      {
        phaseIndex: 0,
        label: 'Early',
        seriesId: null,
        imageSrc: '',
        viewportImages: {},
        status: 'ready'
      },
      {
        phaseIndex: 1,
        label: 'Phase 02',
        seriesId: 'late',
        imageSrc: 'cor-late',
        viewportImages: {
          'mpr-cor': 'cor-late'
        },
        status: 'ready'
      }
    ])
  })

  it('clamps phase keys and initial indexes without leaking NaN', () => {
    const tab = createFourDTab()

    expect(getFourDPhaseKey(Number.NaN)).toBe('0')
    expect(clampFourDPhaseIndex(tab, 99)).toBe(1)
    expect(clampFourDPhaseIndex(tab, Number.NaN)).toBe(0)
    expect(resolveFourDInitialPhaseIndex('phase-1', tab.fourDPhaseItems ?? [], 0)).toBe(1)
    expect(resolveFourDInitialPhaseIndex('missing', tab.fourDPhaseItems ?? [], 99)).toBe(1)
  })

  it('builds cache seeds and display state from preview plus rendered phase data', () => {
    const cachedCornerInfo: CornerInfo = {
      topLeft: ['cached'],
      topRight: [],
      bottomLeft: [],
      bottomRight: []
    }
    const tab = createFourDTab({
      fourDPhaseViewIds: {
        '1': {
          'mpr-ax': 'ax-view',
          'mpr-cor': 'cor-view',
          'mpr-sag': 'sag-view'
        }
      },
      viewportViewIds: {
        'mpr-ax': 'ax-view',
        'mpr-cor': 'cor-view',
        'mpr-sag': 'sag-view'
      },
      fourDPhaseCache: {
        '1': {
          status: 'ready',
          viewportImages: {
            'mpr-ax': 'ax-rendered',
            'mpr-cor': 'cor-rendered',
            'mpr-sag': 'sag-rendered'
          },
          viewportSliceLabels: {
            'mpr-ax': '7 / 20'
          },
          viewportCornerInfos: {
            'mpr-ax': cachedCornerInfo
          },
          windowLabel: 'WW 400  WL 40'
        }
      }
    })

    expect(isFourDPhaseDisplayed(tab, '1')).toBe(true)
    expect(findFourDPhaseViewportByViewId(tab, 'cor-view')).toEqual({ phaseKey: '1', viewportKey: 'mpr-cor' })
    expect(getFourDPhaseBackendViewIds(tab)).toEqual(['ax-view', 'cor-view', 'sag-view'])
    expect(hasReadyFourDPhaseCache(tab.fourDPhaseCache?.['1'])).toBe(true)

    const displayState = getFourDPhaseDisplayState(tab, 1, {
      'phase-1': emptyCornerInfo()
    })
    expect(displayState.viewportImages).toEqual({
      'mpr-ax': 'ax-rendered',
      'mpr-cor': 'cor-rendered',
      'mpr-sag': 'sag-rendered'
    })
    expect(displayState.viewportSliceLabels['mpr-ax']).toBe('7 / 20')
    expect(displayState.cornerInfo).toBe(cachedCornerInfo)

    expect(createFourDPhaseCache(tab.fourDPhaseItems ?? [], tab.fourDPhaseCache)['0']?.status).toBe('preview')
  })

  it('tracks rendered viewport ids and clears pending waits by tab', async () => {
    vi.useFakeTimers()
    try {
      const tracker = new FourDPhaseRenderTracker()
      let rendered = false
      const renderWait = tracker
        .waitForRender(
          'tab-1',
          '0',
          {
            'mpr-ax': 'ax-view',
            'mpr-cor': 'cor-view',
            'mpr-sag': 'sag-view'
          },
          1000
        )
        .then(() => {
          rendered = true
        })

      tracker.notifyRendered('tab-1', '0', 'ax-view')
      await Promise.resolve()
      expect(rendered).toBe(false)

      tracker.notifyRendered('tab-1', '0', 'cor-view')
      tracker.notifyRendered('tab-1', '0', 'sag-view')
      await renderWait
      expect(rendered).toBe(true)

      let timedOut = false
      const timeoutWait = tracker
        .waitForRender('tab-1', '1', { 'mpr-ax': 'ax-view' }, 1000)
        .then(() => {
          timedOut = true
        })
      await vi.advanceTimersByTimeAsync(1000)
      await timeoutWait
      expect(timedOut).toBe(true)

      let cleared = false
      const clearWait = tracker
        .waitForRender('tab-1', '2', { 'mpr-ax': 'ax-view' }, 1000)
        .then(() => {
          cleared = true
        })
      tracker.clearTab('tab-1')
      await clearWait
      expect(cleared).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
