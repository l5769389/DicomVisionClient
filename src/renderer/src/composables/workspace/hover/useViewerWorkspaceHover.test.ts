import { computed } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CornerInfo, ViewerTabItem } from '../../../types/viewer'
import { emitViewHover } from '../../../services/socket'
import { useViewerWorkspaceHover } from './useViewerWorkspaceHover'

vi.mock('../../../services/socket', () => ({
  emitViewHover: vi.fn()
}))

function createHoverHelpers() {
  return useViewerWorkspaceHover({
    activeTab: computed(() => null),
    activeViewportKey: { value: 'single' },
    updateHoverCornerInfoByViewId: vi.fn()
  })
}

function createCornerInfo(bottomRight: string[]): CornerInfo {
  return {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight
  }
}

function createInteractiveHoverHelpers() {
  return useViewerWorkspaceHover({
    activeTab: computed(
      () =>
        ({
          viewType: 'Stack',
          viewId: 'view-1'
        }) as ViewerTabItem
    ),
    activeViewportKey: { value: 'single' },
    updateHoverCornerInfoByViewId: vi.fn()
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useViewerWorkspaceHover corner info', () => {
  it('preserves fixed zoom and pan offset lines when stripping hover cursor lines', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'X:12 Y:-4', 'Cursor X:210 Y:99'])

    expect(hover.stripHoverCornerInfo(cornerInfo).bottomRight).toEqual(['Zoom:1.25x', 'X:12 Y:-4'])
  })

  it('updates the single X/Y coordinate line when hover pixels are available', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'X:12 Y:-4'])

    expect(hover.withHoverCornerInfo(cornerInfo, 99, 210).bottomRight).toEqual([
      'Zoom:1.25x',
      'X:210 Y:99'
    ])
  })

  it('normalizes existing cursor coordinate lines into the single X/Y line', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'Cursor X:210 Y:99'])

    expect(hover.withHoverCornerInfo(cornerInfo).bottomRight).toEqual([
      'Zoom:1.25x',
      'X:210 Y:99'
    ])
  })

  it('cancels pending hover coordinate requests when pointer interaction starts', () => {
    vi.useFakeTimers()
    const hover = createInteractiveHoverHelpers()
    const emitHover = vi.mocked(emitViewHover)

    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.1, y: 0.2 })
    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.3, y: 0.4 })
    hover.handleHoverViewportChange({ viewportKey: 'single', x: null, y: null })
    vi.advanceTimersByTime(60)

    expect(emitHover).toHaveBeenCalledTimes(1)
    expect(emitHover).toHaveBeenCalledWith({ viewId: 'view-1', x: 0.1, y: 0.2 })
  })
})

