import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('detects renderable layout slots as render targets', () => {
    expect(hasRenderableTabView(createTab({ viewId: undefined, layoutSlots: [{ id: 'slot-1', viewId: 'layout-view' }] as ViewerTabItem['layoutSlots'] }))).toBe(true)
  })

  it('debounces repeated resize notifications into one render for the latest active tab', () => {
    const renderTab = vi.fn()
    let activeTab = createTab({ key: 'tab-1' })
    const scheduler = createResizeRenderScheduler({
      debounceMs: 180,
      getActiveTab: () => activeTab,
      isViewLoading: () => false,
      renderTab
    })

    scheduler.schedule()
    vi.advanceTimersByTime(90)
    scheduler.schedule()
    activeTab = createTab({ key: 'tab-2' })

    vi.advanceTimersByTime(179)
    expect(renderTab).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(renderTab).toHaveBeenCalledTimes(1)
    expect(renderTab).toHaveBeenCalledWith('tab-2')
  })

  it('does not render while the active view is loading', () => {
    const renderTab = vi.fn()
    const scheduler = createResizeRenderScheduler({
      getActiveTab: () => createTab(),
      isViewLoading: () => true,
      renderTab
    })

    scheduler.schedule()
    vi.advanceTimersByTime(180)

    expect(renderTab).not.toHaveBeenCalled()
  })

  it('cancels a pending resize render', () => {
    const timerHandle = 42 as unknown as ReturnType<typeof window.setTimeout>
    const clearTimeout = vi.fn()
    const scheduler = createResizeRenderScheduler({
      clearTimeout,
      getActiveTab: () => createTab(),
      isViewLoading: () => false,
      renderTab: vi.fn(),
      setTimeout: () => timerHandle
    })

    scheduler.schedule()
    scheduler.cancel()

    expect(clearTimeout).toHaveBeenCalledWith(timerHandle)
  })
})
