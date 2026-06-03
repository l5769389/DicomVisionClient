import { DRAG_ACTION_TYPES, type ViewOperationType, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { ViewOperationInput } from '../../../services/socket'

type TimerHandle = ReturnType<typeof window.setTimeout>

interface ScheduledMprOperation {
  payload: ViewOperationInput
  viewportKey: string
}

interface ThrottledOperationEmitter {
  lastSentAt: number
  pending: ScheduledMprOperation | null
  timer: TimerHandle | null
}

interface MprInteractionOperationSchedulerOptions {
  clearTimeout?: (handle: TimerHandle) => void
  emit: (viewportKey: string, payload: ViewOperationInput) => void
  now?: () => number
  setTimeout?: (callback: () => void, timeoutMs: number) => TimerHandle
}

const MPR_INTERACTIVE_MOVE_OPERATION_TYPES = new Set<ViewOperationType>([
  VIEW_OPERATION_TYPES.crosshair,
  VIEW_OPERATION_TYPES.mprOblique,
  VIEW_OPERATION_TYPES.pan,
  VIEW_OPERATION_TYPES.window,
  VIEW_OPERATION_TYPES.zoom
])

const DEFAULT_MPR_MOVE_INTERVAL_MS = 80
const MIN_MPR_MOVE_INTERVAL_MS = 60
const MAX_MPR_MOVE_INTERVAL_MS = 240
const BACKEND_PREVIEW_EWMA_ALPHA = 0.25
const DUPLICATE_PREVIEW_REVISION_WINDOW_MS = 20

function getOperationQueueKey(viewportKey: string, payload: ViewOperationInput): string | null {
  if (!MPR_INTERACTIVE_MOVE_OPERATION_TYPES.has(payload.opType)) {
    return null
  }

  const lineKey = payload.opType === VIEW_OPERATION_TYPES.mprOblique ? payload.line ?? '' : ''
  return `${viewportKey}:${payload.opType}:${lineKey}`
}

function clampMoveInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MPR_MOVE_INTERVAL_MS
  }
  return Math.min(MAX_MPR_MOVE_INTERVAL_MS, Math.max(MIN_MPR_MOVE_INTERVAL_MS, value))
}

function logCoalescingStats(scheduledMoves: number, emittedMoves: number, intervalMs: number): void {
  if (!import.meta.env.DEV || scheduledMoves <= 0 || scheduledMoves % 120 !== 0) {
    return
  }

  console.debug('[mpr perf] interactive moves throttled', {
    emittedMoves,
    intervalMs,
    scheduledMoves
  })
}

export function createMprInteractionOperationScheduler(options: MprInteractionOperationSchedulerOptions) {
  const emitters = new Map<string, ThrottledOperationEmitter>()
  const getNow = options.now ?? (() => performance.now())
  const scheduleTimeout = options.setTimeout ?? ((callback, timeoutMs) => window.setTimeout(callback, timeoutMs))
  const cancelTimeout = options.clearTimeout ?? ((handle) => window.clearTimeout(handle))
  let scheduledMoves = 0
  let emittedMoves = 0
  let backendPreviewIntervalMs = DEFAULT_MPR_MOVE_INTERVAL_MS
  let lastBackendPreviewAt: number | null = null
  let lastBackendPreviewRevision: number | null = null

  function getMoveIntervalMs(): number {
    return clampMoveInterval(backendPreviewIntervalMs)
  }

  function getEmitter(key: string): ThrottledOperationEmitter {
    const existing = emitters.get(key)
    if (existing) {
      return existing
    }
    const emitter: ThrottledOperationEmitter = {
      lastSentAt: 0,
      pending: null,
      timer: null
    }
    emitters.set(key, emitter)
    return emitter
  }

  function clearTimer(emitter: ThrottledOperationEmitter): void {
    if (emitter.timer == null) {
      return
    }
    cancelTimeout(emitter.timer)
    emitter.timer = null
  }

  function emitScheduled(emitter: ThrottledOperationEmitter): void {
    const operation = emitter.pending
    if (!operation) {
      clearTimer(emitter)
      return
    }

    clearTimer(emitter)
    emitter.pending = null
    emitter.lastSentAt = getNow()
    emittedMoves += 1
    options.emit(operation.viewportKey, operation.payload)
    logCoalescingStats(scheduledMoves, emittedMoves, getMoveIntervalMs())
  }

  function schedulePending(emitter: ThrottledOperationEmitter): void {
    if (!emitter.pending || emitter.timer != null) {
      return
    }

    const intervalMs = getMoveIntervalMs()
    const elapsedMs = getNow() - emitter.lastSentAt
    if (elapsedMs >= intervalMs) {
      emitScheduled(emitter)
      return
    }

    emitter.timer = scheduleTimeout(() => {
      emitScheduled(emitter)
    }, Math.max(0, intervalMs - elapsedMs))
  }

  function flushKey(key: string): void {
    const emitter = emitters.get(key)
    if (!emitter) {
      return
    }
    emitScheduled(emitter)
  }

  function cancelKey(key: string): void {
    const emitter = emitters.get(key)
    if (!emitter) {
      return
    }
    clearTimer(emitter)
    emitter.pending = null
  }

  function emit(viewportKey: string, payload: ViewOperationInput): void {
    const queueKey = getOperationQueueKey(viewportKey, payload)
    if (!queueKey || payload.actionType !== DRAG_ACTION_TYPES.move) {
      if (queueKey && payload.actionType === DRAG_ACTION_TYPES.end) {
        flushKey(queueKey)
      } else if (queueKey && payload.actionType === DRAG_ACTION_TYPES.start) {
        cancelKey(queueKey)
      }
      options.emit(viewportKey, payload)
      return
    }

    scheduledMoves += 1
    const emitter = getEmitter(queueKey)
    emitter.pending = { viewportKey, payload }
    schedulePending(emitter)
  }

  function flush(): void {
    emitters.forEach((_, key) => flushKey(key))
  }

  function cancel(): void {
    emitters.forEach((_, key) => cancelKey(key))
  }

  function recordBackendPreview(mprRevision?: number | null): void {
    const now = getNow()
    if (mprRevision != null && mprRevision === lastBackendPreviewRevision) {
      return
    }
    if (mprRevision == null && lastBackendPreviewAt != null && now - lastBackendPreviewAt < DUPLICATE_PREVIEW_REVISION_WINDOW_MS) {
      return
    }
    if (lastBackendPreviewAt != null) {
      const sampleMs = clampMoveInterval(now - lastBackendPreviewAt)
      backendPreviewIntervalMs =
        backendPreviewIntervalMs * (1 - BACKEND_PREVIEW_EWMA_ALPHA) + sampleMs * BACKEND_PREVIEW_EWMA_ALPHA
    }
    lastBackendPreviewAt = now
    lastBackendPreviewRevision = mprRevision ?? null
  }

  return {
    cancel,
    emit,
    flush,
    recordBackendPreview
  }
}
