type FrameRequest = (callback: FrameRequestCallback) => number
type FrameCancel = (handle: number) => void

interface RenderTabSchedulerOptions {
  cancelAnimationFrame?: FrameCancel
  renderNow: (tabKey: string, force?: boolean) => Promise<void>
  requestAnimationFrame?: FrameRequest
}

interface PendingRender {
  force: boolean
  rejecters: Array<(reason?: unknown) => void>
  resolvers: Array<() => void>
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

export function createRenderTabScheduler(options: RenderTabSchedulerOptions) {
  const requestFrame = options.requestAnimationFrame ?? resolveRequestAnimationFrame()
  const cancelFrame = options.cancelAnimationFrame ?? resolveCancelAnimationFrame()
  const pending = new Map<string, PendingRender>()
  let frameHandle: number | null = null

  const flush = async () => {
    frameHandle = null
    const batch = [...pending.entries()]
    pending.clear()

    for (const [tabKey, request] of batch) {
      try {
        await options.renderNow(tabKey, request.force)
        request.resolvers.forEach((resolve) => resolve())
      } catch (error) {
        request.rejecters.forEach((reject) => reject(error))
      }
    }
  }

  function ensureFrame(): void {
    if (frameHandle != null) {
      return
    }
    frameHandle = requestFrame(() => {
      void flush()
    })
  }

  function schedule(tabKey: string, force = false): Promise<void> {
    if (!tabKey) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const existing = pending.get(tabKey)
      if (existing) {
        existing.force = existing.force || force
        existing.resolvers.push(resolve)
        existing.rejecters.push(reject)
      } else {
        pending.set(tabKey, {
          force,
          resolvers: [resolve],
          rejecters: [reject]
        })
      }
      ensureFrame()
    })
  }

  function cancel(): void {
    if (frameHandle != null) {
      cancelFrame(frameHandle)
      frameHandle = null
    }
    pending.forEach((request) => {
      request.resolvers.forEach((resolve) => resolve())
    })
    pending.clear()
  }

  return {
    cancel,
    schedule
  }
}
