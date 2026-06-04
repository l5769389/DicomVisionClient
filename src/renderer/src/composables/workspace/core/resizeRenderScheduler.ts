import type { ViewerTabItem } from '../../../types/viewer'

interface ResizeRenderSchedulerOptions {
  clearTimeout?: (handle: ReturnType<typeof window.setTimeout>) => void
  debounceMs?: number
  getActiveTab: () => ViewerTabItem | null
  isViewLoading: () => boolean
  renderTab: (tabKey: string) => void
  setTimeout?: (callback: () => void, timeout: number) => ReturnType<typeof window.setTimeout>
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
  const setTimer = options.setTimeout ?? window.setTimeout.bind(window)
  const clearTimer = options.clearTimeout ?? window.clearTimeout.bind(window)
  const debounceMs = Math.max(0, options.debounceMs ?? 180)
  let pendingTimer: ReturnType<typeof window.setTimeout> | null = null

  function schedule(): void {
    if (pendingTimer != null) {
      clearTimer(pendingTimer)
    }

    pendingTimer = setTimer(() => {
      pendingTimer = null
      const tab = options.getActiveTab()
      if (tab && hasRenderableTabView(tab) && !options.isViewLoading()) {
        options.renderTab(tab.key)
      }
    }, debounceMs)
  }

  function cancel(): void {
    if (pendingTimer == null) {
      return
    }
    clearTimer(pendingTimer)
    pendingTimer = null
  }

  return {
    cancel,
    schedule
  }
}
