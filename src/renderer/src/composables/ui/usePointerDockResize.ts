import { computed, onScopeDispose, shallowRef } from 'vue'
import { resolveDockResize, type DockResizeConfig, type DockResizeResult } from './dockResize'

export interface PointerDockResizeRequest<T extends string> {
  config: DockResizeConfig
  direction: 'left' | 'right'
  key: T
  startWidth: number
}

interface ActivePointerDockResize<T extends string> extends PointerDockResizeRequest<T> {
  latestClientX: number
  startX: number
}

export interface PointerDockResizePreview<T extends string> {
  key: T
  result: DockResizeResult
}

export function usePointerDockResize<T extends string>(options: {
  onCommit: (key: T, result: DockResizeResult) => void
}) {
  const active = shallowRef<ActivePointerDockResize<T> | null>(null)
  const preview = shallowRef<PointerDockResizePreview<T> | null>(null)
  let animationFrame: number | null = null

  const isResizing = computed(() => active.value != null)

  function getResult(session: ActivePointerDockResize<T>, clientX: number): DockResizeResult {
    const pointerDelta = (clientX - session.startX) * (session.direction === 'left' ? 1 : -1)
    return resolveDockResize(session.startWidth, pointerDelta, session.config)
  }

  function flushPreview(): void {
    animationFrame = null
    const session = active.value
    if (!session) {
      return
    }
    preview.value = { key: session.key, result: getResult(session, session.latestClientX) }
  }

  function schedulePreview(): void {
    if (animationFrame != null) {
      return
    }
    animationFrame = window.requestAnimationFrame(flushPreview)
  }

  function cleanupListeners(): void {
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleEnd)
    window.removeEventListener('pointercancel', cancel)
  }

  function clearAnimationFrame(): void {
    if (animationFrame != null) {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }

  function handleMove(event: PointerEvent): void {
    const session = active.value
    if (!session) {
      return
    }
    session.latestClientX = event.clientX
    schedulePreview()
  }

  function finish(): void {
    active.value = null
    preview.value = null
    clearAnimationFrame()
    cleanupListeners()
  }

  function cancel(): void {
    finish()
  }

  function handleEnd(event: PointerEvent): void {
    const session = active.value
    if (!session) {
      return
    }
    const result = getResult(session, event.clientX)
    options.onCommit(session.key, result)
    finish()
  }

  function start(event: PointerEvent, request: PointerDockResizeRequest<T>): void {
    event.preventDefault()
    finish()
    active.value = {
      ...request,
      latestClientX: event.clientX,
      startX: event.clientX
    }
    preview.value = {
      key: request.key,
      result: resolveDockResize(request.startWidth, 0, request.config)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', cancel)
  }

  onScopeDispose(cancel)

  return {
    active,
    cancel,
    isResizing,
    preview,
    start
  }
}
