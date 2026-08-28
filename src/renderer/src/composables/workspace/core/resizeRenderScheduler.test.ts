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

  it('detects fusion and cached 4D phase views as render targets', () => {
    expect(hasRenderableTabView(createTab({ viewId: undefined, fusionViewIds: { 'fusion-overlay-ax': 'fusion-view' } }))).toBe(true)
    expect(hasRenderableTabView(createTab({
      viewId: undefined,
      fourDPhaseViewIds: { 'phase-1': { 'mpr-ax': 'phase-view' } }
    }))).toBe(true)
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

  it('retains a resize while loading and renders it when loading finishes', async () => {
    const renderTab = vi.fn()
    let loading = true
    const scheduler = createResizeRenderScheduler({
      getActiveTab: () => createTab(),
      isViewLoading: () => loading,
      retryMs: 40,
      renderTab
    })

    scheduler.schedule()
    vi.advanceTimersByTime(180)
    expect(renderTab).not.toHaveBeenCalled()

    loading = false
    await vi.advanceTimersByTimeAsync(40)

    expect(renderTab).toHaveBeenCalledTimes(1)
    expect(renderTab).toHaveBeenCalledWith('tab-1')
  })

  it('queues the latest resize that arrives while a render is in flight', async () => {
    let finishRender: () => void = () => undefined
    const renderTab = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRender = resolve
        })
    )
    const scheduler = createResizeRenderScheduler({
      debounceMs: 20,
      getActiveTab: () => createTab(),
      isViewLoading: () => false,
      renderTab,
      retryMs: 10
    })

    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(20)
    expect(renderTab).toHaveBeenCalledTimes(1)

    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(20)
    expect(renderTab).toHaveBeenCalledTimes(1)

    finishRender()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(10)

    expect(renderTab).toHaveBeenCalledTimes(2)
  })

  it('retries a failed final resize render without another observer notification', async () => {
    const renderTab = vi.fn()
      .mockRejectedValueOnce(new Error('temporary resize failure'))
      .mockResolvedValue(undefined)
    const scheduler = createResizeRenderScheduler({
      debounceMs: 20,
      getActiveTab: () => createTab(),
      isViewLoading: () => false,
      renderTab,
      retryMs: 10
    })

    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(20)
    expect(renderTab).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10)
    expect(renderTab).toHaveBeenCalledTimes(2)
  })

  it('stops retrying after the configured resize failure limit', async () => {
    const renderTab = vi.fn().mockRejectedValue(new Error('permanent resize failure'))
    const scheduler = createResizeRenderScheduler({
      debounceMs: 20,
      getActiveTab: () => createTab(),
      isViewLoading: () => false,
      maxFailureRetries: 2,
      renderTab,
      retryMs: 10
    })

    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(50)

    expect(renderTab).toHaveBeenCalledTimes(3)
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
