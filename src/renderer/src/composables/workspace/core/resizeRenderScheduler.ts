import type { ViewerTabItem } from '../../../types/viewer'

interface ResizeRenderSchedulerOptions {
  clearTimeout?: (handle: ReturnType<typeof window.setTimeout>) => void
  debounceMs?: number
  getActiveTab: () => ViewerTabItem | null
  isViewLoading: () => boolean
  renderTab: (tabKey: string) => Promise<void> | void
  maxFailureRetries?: number
  retryMs?: number
  setTimeout?: (callback: () => void, timeout: number) => ReturnType<typeof window.setTimeout>
}

export function hasRenderableTabView(tab: ViewerTabItem | null): boolean {
  return Boolean(
    tab?.viewId ||
      Object.values(tab?.compareViewIds ?? {}).some(Boolean) ||
      Object.values(tab?.fusionViewIds ?? {}).some(Boolean) ||
      Object.values(tab?.viewportViewIds ?? {}).some(Boolean) ||
      Object.values(tab?.fourDPhaseViewIds ?? {}).some((viewIds) => Object.values(viewIds ?? {}).some(Boolean)) ||
      tab?.layoutSlots?.some((slot) => Boolean(slot.viewId))
  )
}

export function createResizeRenderScheduler(options: ResizeRenderSchedulerOptions) {
  const setTimer = options.setTimeout ?? window.setTimeout.bind(window)
  const clearTimer = options.clearTimeout ?? window.clearTimeout.bind(window)
  const debounceMs = Math.max(0, options.debounceMs ?? 180)
  const retryMs = Math.max(1, options.retryMs ?? 60)
  const maxFailureRetries = Math.max(0, options.maxFailureRetries ?? 3)
  let pendingTimer: ReturnType<typeof window.setTimeout> | null = null
  let renderInFlight = false
  let resizePending = false
  let failureRetryCount = 0

  function queueAttempt(delayMs: number): void {
    if (pendingTimer != null) {
      clearTimer(pendingTimer)
    }
    pendingTimer = setTimer(attemptRender, delayMs)
  }

  function attemptRender(): void {
    pendingTimer = null
    if (!resizePending) {
      return
    }

    const tab = options.getActiveTab()
    if (!tab || !hasRenderableTabView(tab)) {
      resizePending = false
      return
    }
    if (options.isViewLoading() || renderInFlight) {
      queueAttempt(retryMs)
      return
    }

    resizePending = false
    renderInFlight = true
    void Promise.resolve(options.renderTab(tab.key))
      .then(() => {
        failureRetryCount = 0
      })
      .catch(() => {
        if (failureRetryCount < maxFailureRetries) {
          failureRetryCount += 1
          resizePending = true
        }
      })
      .finally(() => {
        renderInFlight = false
        if (resizePending && pendingTimer == null) {
          queueAttempt(retryMs)
        }
      })
  }

  function schedule(): void {
    resizePending = true
    failureRetryCount = 0
    queueAttempt(debounceMs)
  }

  function cancel(): void {
    resizePending = false
    failureRetryCount = 0
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
