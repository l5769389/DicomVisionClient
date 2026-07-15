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
  it('removes every stale coordinate/value line while preserving fixed zoom information', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'X:12 Y:4 CT:99 HU', 'Cursor X:210 Y:99'])

    expect(hover.stripHoverCornerInfo(cornerInfo).bottomRight).toEqual(['Zoom:1.25x'])
  })

  it('uses the authoritative backend X/Y and value text without calculating it locally', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'X:12 Y:-4'])

    const updated = hover.withHoverCornerInfo(cornerInfo, {
      displayText: 'X: 210 Y:  99    115 HU'
    })

    expect(updated.bottomRight).toEqual(['Zoom:1.25x', 'X: 210 Y:  99    115 HU'])
    expect(updated.tags?.coordinates).toEqual(['X: 210 Y:  99    115 HU'])
  })

  it('shows an always-present placeholder before the first hover result', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'Cursor X:210 Y:99'])

    expect(hover.withHoverCornerInfo(cornerInfo).bottomRight).toEqual([
      'Zoom:1.25x',
      `X:${' '.repeat(4)} Y:${' '.repeat(4)} ${' '.repeat(6)} ${' '.repeat(2)}`
    ])
  })

  it('updates configured coordinate tags even when the line is not pinned to bottomRight', () => {
    const hover = createHoverHelpers()
    const cornerInfo = {
      ...createCornerInfo(['Zoom:1.25x']),
      tags: {
        coordinates: ['X:12 Y:4']
      }
    }

    const updated = hover.withHoverCornerInfo(cornerInfo, {
      displayText: 'X:  88 Y:  37    -32 HU'
    })

    expect(updated.bottomRight).toEqual(['Zoom:1.25x', 'X:  88 Y:  37    -32 HU'])
    expect(updated.tags?.coordinates).toEqual(['X:  88 Y:  37    -32 HU'])
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

  it('ignores locally estimated hover pixels and waits for backend mapped coordinates', () => {
    const { hover, updateHoverCornerInfoByViewId } = createInteractiveHoverHelpers()

    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.1, y: 0.2, row: 999, col: 999 })

    expect(updateHoverCornerInfoByViewId).not.toHaveBeenCalled()

    hover.handleHoverInfo({
      viewId: 'view-1',
      row: 999,
      col: 999,
      pixelValue: -999,
      valueLabel: 'wrong',
      valueUnit: 'wrong',
      displayText: 'X:  34 Y:  12     81 HU'
    })

    expect(updateHoverCornerInfoByViewId).toHaveBeenLastCalledWith('view-1', {
      displayText: 'X:  34 Y:  12     81 HU'
    })
  })

  it('keeps the last valid coordinate and value when the backend reports an out-of-range position', () => {
    const { hover, updateHoverCornerInfoByViewId } = createInteractiveHoverHelpers()

    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.1, y: 0.2 })
    hover.handleHoverInfo({ viewId: 'view-1', row: 12, col: 34, displayText: 'X:  34 Y:  12     70 HU' })
    hover.handleHoverInfo({ viewId: 'view-1', row: 0, col: 0, displayText: null })

    expect(updateHoverCornerInfoByViewId).toHaveBeenCalledTimes(1)
    expect(hover.getLastHoverSample('view-1')).toEqual({
      displayText: 'X:  34 Y:  12     70 HU'
    })
  })

  it('keeps the last valid coordinate and value after the pointer leaves the image area', () => {
    const { hover, updateHoverCornerInfoByViewId } = createInteractiveHoverHelpers()

    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.1, y: 0.2 })
    hover.handleHoverInfo({ viewId: 'view-1', row: 7, col: 9, displayText: 'X:   9 Y:   7    123 HU' })
    hover.handleHoverViewportChange({ viewportKey: 'single', x: null, y: null })

    expect(updateHoverCornerInfoByViewId).toHaveBeenCalledTimes(1)
    expect(hover.getLastHoverSample('view-1')?.displayText).toBe('X:   9 Y:   7    123 HU')
  })

  it('stores hover samples independently per view and clears only the closed view', () => {
    const { hover } = createInteractiveHoverHelpers()
    hover.handleHoverViewportChange({ viewportKey: 'single', x: 0.1, y: 0.2 })
    hover.handleHoverInfo({ viewId: 'view-1', row: 2, col: 3, displayText: 'X:   3 Y:   2      4 HU' })

    expect(hover.getLastHoverSample('view-1')?.displayText).toBe('X:   3 Y:   2      4 HU')
    expect(hover.getLastHoverSample('view-2')).toBeNull()

    hover.clearHoverSample('view-1')
    expect(hover.getLastHoverSample('view-1')).toBeNull()
  })
})
