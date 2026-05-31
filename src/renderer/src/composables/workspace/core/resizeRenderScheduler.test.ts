import { describe, expect, it, vi } from 'vitest'
import type { ViewerTabItem } from '../../../types/viewer'
import { createResizeRenderScheduler, hasRenderableTabView } from './resizeRenderScheduler'

function createTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'tab-1',
    seriesId: 'series-1',
    viewType: 'Stack',
    viewId: 'view-1',
    title: 'Stack',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false },
    pseudocolorPreset: 'gray',
    ...overrides
  } as ViewerTabItem
}

describe('resize render scheduler', () => {
  it('detects renderable layout slots as render targets', () => {
    expect(hasRenderableTabView(createTab({ viewId: undefined, layoutSlots: [{ id: 'slot-1', viewId: 'layout-view' }] as ViewerTabItem['layoutSlots'] }))).toBe(true)
  })

  it('coalesces repeated resize notifications into one render for the latest active tab', () => {
    const callbacks: FrameRequestCallback[] = []
    const renderTab = vi.fn()
    let activeTab = createTab({ key: 'tab-1' })
    const scheduler = createResizeRenderScheduler({
      getActiveTab: () => activeTab,
      isViewLoading: () => false,
      renderTab,
      requestAnimationFrame: (callback) => {
        callbacks.push(callback)
        return callbacks.length
      },
      cancelAnimationFrame: vi.fn()
    })

    scheduler.schedule()
    scheduler.schedule()
    activeTab = createTab({ key: 'tab-2' })

    expect(callbacks).toHaveLength(1)
    callbacks[0]?.(16)
    expect(renderTab).toHaveBeenCalledTimes(1)
    expect(renderTab).toHaveBeenCalledWith('tab-2')
  })

  it('does not render while the active view is loading', () => {
    const callbacks: FrameRequestCallback[] = []
    const renderTab = vi.fn()
    const scheduler = createResizeRenderScheduler({
      getActiveTab: () => createTab(),
      isViewLoading: () => true,
      renderTab,
      requestAnimationFrame: (callback) => {
        callbacks.push(callback)
        return callbacks.length
      },
      cancelAnimationFrame: vi.fn()
    })

    scheduler.schedule()
    callbacks[0]?.(16)

    expect(renderTab).not.toHaveBeenCalled()
  })

  it('cancels a pending resize render', () => {
    const cancelAnimationFrame = vi.fn()
    const scheduler = createResizeRenderScheduler({
      getActiveTab: () => createTab(),
      isViewLoading: () => false,
      renderTab: vi.fn(),
      requestAnimationFrame: () => 42,
      cancelAnimationFrame
    })

    scheduler.schedule()
    scheduler.cancel()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42)
  })
})
