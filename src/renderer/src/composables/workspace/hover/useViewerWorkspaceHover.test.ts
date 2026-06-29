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
  const updateHoverCornerInfoByViewId = vi.fn()
  const hover = useViewerWorkspaceHover({
    activeTab: computed(
      () =>
        ({
          viewType: 'Stack',
          viewId: 'view-1'
        }) as ViewerTabItem
    ),
    activeViewportKey: { value: 'single' },
    updateHoverCornerInfoByViewId
  })
  return { hover, updateHoverCornerInfoByViewId }
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

    const updated = hover.withHoverCornerInfo(cornerInfo, 99, 210)

    expect(updated.bottomRight).toEqual(['Zoom:1.25x', 'X:210 Y:99'])
    expect(updated.tags?.coordinates).toEqual(['X:210 Y:99'])
  })

  it('normalizes existing cursor coordinate lines into the single X/Y line', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'Cursor X:210 Y:99'])

    expect(hover.withHoverCornerInfo(cornerInfo).bottomRight).toEqual(['Zoom:1.25x', 'X:210 Y:99'])
  })

  it('updates configured coordinate tags even when the line is not pinned to bottomRight', () => {
    const hover = createHoverHelpers()
    const cornerInfo = {
      ...createCornerInfo(['Zoom:1.25x']),
      tags: {
        coordinates: ['X:12 Y:4']
      }
    }

    const updated = hover.withHoverCornerInfo(cornerInfo, 37, 88)

    expect(updated.bottomRight).toEqual(['Zoom:1.25x', 'X:88 Y:37'])
    expect(updated.tags?.coordinates).toEqual(['X:88 Y:37'])
  })

  it('cancels pending hover coordinate requests when pointer interaction starts', () => {
    vi.useFakeTimers()
    const { hover } = createInteractiveHoverHelpers()
    const emitHover = vi.mocked(emitViewHover)

    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.1, y: 0.2 })
    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.3, y: 0.4 })
    hover.handleHoverViewportChange({ viewportKey: 'single', x: null, y: null })
    vi.advanceTimersByTime(60)

    expect(emitHover).toHaveBeenCalledTimes(1)
    expect(emitHover).toHaveBeenCalledWith({ viewId: 'view-1', x: 0.1, y: 0.2 })
  })

  it('keeps the last in-range hover coordinate when the backend returns an out-of-range pixel', () => {
    const { hover, updateHoverCornerInfoByViewId } = createInteractiveHoverHelpers()

    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.1, y: 0.2, row: 12, col: 34 })
    hover.handleHoverInfo({ viewId: 'view-1', row: 0, col: 0 })

    expect(updateHoverCornerInfoByViewId).toHaveBeenLastCalledWith('view-1', 12, 34)
  })

  it('keeps the last in-range hover coordinate after the pointer leaves the image area', () => {
    const { hover, updateHoverCornerInfoByViewId } = createInteractiveHoverHelpers()

    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.1, y: 0.2, row: 7, col: 9 })
    hover.handleHoverViewportChange({ viewportKey: 'single', x: null, y: null })

    expect(updateHoverCornerInfoByViewId).toHaveBeenLastCalledWith('view-1', 7, 9)
  })
})
