type FrameRequest = (callback: FrameRequestCallback) => number
type FrameCancel = (handle: number) => void

interface LatestFrameEmitterOptions<T> {
  cancelAnimationFrame?: FrameCancel
  emit: (payload: T) => void
  requestAnimationFrame?: FrameRequest
}

function resolveRequestAnimationFrame(): FrameRequest {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame.bind(window)
  }
  return (callback) => setTimeout(() => callback(Date.now()), 0) as unknown as number
}

function resolveCancelAnimationFrame(): FrameCancel {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    return window.cancelAnimationFrame.bind(window)
  }
  return (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)
}

export function createLatestFrameEmitter<T>(options: LatestFrameEmitterOptions<T>) {
  const requestFrame = options.requestAnimationFrame ?? resolveRequestAnimationFrame()
  const cancelFrame = options.cancelAnimationFrame ?? resolveCancelAnimationFrame()
  let pendingPayload: T | null = null
  let frameHandle: number | null = null

  function emitPending(): void {
    frameHandle = null
    const payload = pendingPayload
    pendingPayload = null
    if (payload !== null) {
      options.emit(payload)
    }
  }

  function schedule(payload: T): void {
    pendingPayload = payload
    if (frameHandle == null) {
      frameHandle = requestFrame(() => emitPending())
    }
  }

  function flush(): void {
    if (frameHandle != null) {
      cancelFrame(frameHandle)
      frameHandle = null
    }
    const payload = pendingPayload
    pendingPayload = null
    if (payload !== null) {
      options.emit(payload)
    }
  }

  function cancel(): void {
    if (frameHandle != null) {
      cancelFrame(frameHandle)
    }
    frameHandle = null
    pendingPayload = null
  }

  return {
    cancel,
    flush,
    schedule
  }
}
