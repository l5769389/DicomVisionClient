import type { ViewerTabItem } from '../../../types/viewer'

interface ResizeRenderSchedulerOptions {
  cancelAnimationFrame?: (handle: number) => void
  getActiveTab: () => ViewerTabItem | null
  isViewLoading: () => boolean
  renderTab: (tabKey: string) => void
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
}

export function hasRenderableTabView(tab: ViewerTabItem | null): boolean {
  return Boolean(
    tab?.viewId ||
      Object.values(tab?.compareViewIds ?? {}).some(Boolean) ||
      Object.values(tab?.viewportViewIds ?? {}).some(Boolean) ||
      tab?.layoutSlots?.some((slot) => Boolean(slot.viewId))
  )
}

export function createResizeRenderScheduler(options: ResizeRenderSchedulerOptions) {
  const requestFrame = options.requestAnimationFrame ?? window.requestAnimationFrame.bind(window)
  const cancelFrame = options.cancelAnimationFrame ?? window.cancelAnimationFrame.bind(window)
  let pendingFrame: number | null = null

  function schedule(): void {
    if (pendingFrame != null) {
      return
    }

    pendingFrame = requestFrame(() => {
      pendingFrame = null
      const tab = options.getActiveTab()
      if (tab && hasRenderableTabView(tab) && !options.isViewLoading()) {
        options.renderTab(tab.key)
      }
    })
  }

  function cancel(): void {
    if (pendingFrame == null) {
      return
    }
    cancelFrame(pendingFrame)
    pendingFrame = null
  }

  return {
    cancel,
    schedule
  }
}
