import { DRAG_ACTION_TYPES, STACK_DRAG_OPERATIONS, type ViewOperationType, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { ViewOperationInput } from '../../../services/socket'
import { isViewerPerfDebugEnabled } from './viewerPerfDebug'

type TimerHandle = ReturnType<typeof window.setTimeout>

type SchedulableViewOperation = Pick<ViewOperationInput, 'actionType' | 'line' | 'opType'>

interface ScheduledViewOperation<TPayload extends SchedulableViewOperation> {
  operationKey: string
  payload: TPayload
}

interface ThrottledOperationEmitter {
  awaitingFeedback: boolean
  lastSentAt: number | null
  operationKey: string
  pending: ScheduledViewOperation<SchedulableViewOperation> | null
  timer: TimerHandle | null
}

interface BackendPreviewSample {
  at: number
  revision: number | null
}

interface MprInteractionOperationSchedulerOptions<TPayload extends SchedulableViewOperation = ViewOperationInput> {
  clearTimeout?: (handle: TimerHandle) => void
  emit: (operationKey: string, payload: TPayload) => void
  now?: () => number
  setTimeout?: (callback: () => void, timeoutMs: number) => TimerHandle
}

const INTERACTIVE_MOVE_OPERATION_TYPES = new Set<ViewOperationType>([
  ...STACK_DRAG_OPERATIONS,
  VIEW_OPERATION_TYPES.crosshair,
  VIEW_OPERATION_TYPES.fusionRegistration,
  VIEW_OPERATION_TYPES.mprMipConfig,
  VIEW_OPERATION_TYPES.mprSegmentation,
  VIEW_OPERATION_TYPES.mprOblique
])

const BACKEND_PREVIEW_EWMA_ALPHA = 0.25
const DUPLICATE_PREVIEW_FEEDBACK_WINDOW_MS = 2
const BACKEND_FEEDBACK_IDLE_GAP_MS = 5000
const FASTEST_VIEW_MOVE_INTERVAL_MS = 16
const FRONTEND_RENDER_MARGIN_MS = 4
const MATCHED_FEEDBACK_OPERATION_TYPES = new Set<ViewOperationType>([
  ...STACK_DRAG_OPERATIONS,
  VIEW_OPERATION_TYPES.mprMipConfig,
  VIEW_OPERATION_TYPES.mprSegmentation
])

function getOperationQueueKey(operationKey: string, payload: SchedulableViewOperation): string | null {
  if (!INTERACTIVE_MOVE_OPERATION_TYPES.has(payload.opType)) {
    return null
  }

  const lineKey = payload.opType === VIEW_OPERATION_TYPES.mprOblique ? payload.line ?? '' : ''
  return `${operationKey}:${payload.opType}:${lineKey}`
}

function normalizeMoveInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return FASTEST_VIEW_MOVE_INTERVAL_MS
  }
  return Math.max(FASTEST_VIEW_MOVE_INTERVAL_MS, value)
}

function estimateMoveIntervalFromBackendSample(sampleMs: number): number {
  return normalizeMoveInterval(sampleMs + FRONTEND_RENDER_MARGIN_MS)
}

function shouldWaitForMatchingFeedback(payload: SchedulableViewOperation): boolean {
  return MATCHED_FEEDBACK_OPERATION_TYPES.has(payload.opType)
}

function shouldFlushPendingBeforeEnd(payload: SchedulableViewOperation): boolean {
  return payload.opType !== VIEW_OPERATION_TYPES.fusionRegistration
}

function logCoalescingStats(
  scheduledMoves: number,
  emittedMoves: number,
  intervalMs: number,
  operation: ScheduledViewOperation<SchedulableViewOperation>
): void {
  if (!isViewerPerfDebugEnabled() || scheduledMoves <= 0 || scheduledMoves % 120 !== 0) {
    return
  }

  console.debug('[view perf] interactive moves throttled', {
    emittedMoves,
    intervalMs,
    operationKey: operation.operationKey,
    opType: operation.payload.opType,
    scheduledMoves
  })
}

export function createMprInteractionOperationScheduler<TPayload extends SchedulableViewOperation = ViewOperationInput>(
  options: MprInteractionOperationSchedulerOptions<TPayload>
) {
  const emitters = new Map<string, ThrottledOperationEmitter>()
  const getNow = options.now ?? (() => performance.now())
  const scheduleTimeout = options.setTimeout ?? ((callback, timeoutMs) => window.setTimeout(callback, timeoutMs))
  const cancelTimeout = options.clearTimeout ?? ((handle) => window.clearTimeout(handle))
  let scheduledMoves = 0
  let emittedMoves = 0
  let fallbackPreviewIntervalMs: number | null = null
  const backendPreviewIntervalByKey = new Map<string, number>()
  const lastBackendPreviewByKey = new Map<string, BackendPreviewSample>()
  const sentMoveAtByKey = new Map<string, number>()

  function getMoveIntervalMs(operationKey?: string): number {
    const intervalMs = operationKey ? backendPreviewIntervalByKey.get(operationKey) ?? fallbackPreviewIntervalMs : fallbackPreviewIntervalMs
    return intervalMs == null ? FASTEST_VIEW_MOVE_INTERVAL_MS : normalizeMoveInterval(intervalMs)
  }

  function getEmitter(key: string, operationKey: string): ThrottledOperationEmitter {
    const existing = emitters.get(key)
    if (existing) {
      return existing
    }
    const emitter: ThrottledOperationEmitter = {
      awaitingFeedback: false,
      lastSentAt: null,
      operationKey,
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
    const sentAt = getNow()
    emitter.lastSentAt = sentAt
    emittedMoves += 1
    if (shouldWaitForMatchingFeedback(operation.payload)) {
      emitter.awaitingFeedback = true
      sentMoveAtByKey.set(operation.operationKey, sentAt)
    }
    options.emit(operation.operationKey, operation.payload as TPayload)
    logCoalescingStats(scheduledMoves, emittedMoves, getMoveIntervalMs(operation.operationKey), operation)
  }

  function schedulePending(emitter: ThrottledOperationEmitter): void {
    if (!emitter.pending || emitter.timer != null) {
      return
    }
    if (emitter.awaitingFeedback && shouldWaitForMatchingFeedback(emitter.pending.payload)) {
      return
    }

    const intervalMs = getMoveIntervalMs(emitter.operationKey)
    const elapsedMs = emitter.lastSentAt == null ? intervalMs : getNow() - emitter.lastSentAt
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
    emitter.awaitingFeedback = false
    emitter.lastSentAt = null
    emitter.pending = null
  }

  function emit(operationKey: string, payload: TPayload): void {
    const queueKey = getOperationQueueKey(operationKey, payload)
    if (!queueKey || payload.actionType !== DRAG_ACTION_TYPES.move) {
      if (queueKey && payload.actionType === DRAG_ACTION_TYPES.end) {
        if (shouldFlushPendingBeforeEnd(payload)) {
          flushKey(queueKey)
        } else {
          cancelKey(queueKey)
        }
      } else if (queueKey && payload.actionType === DRAG_ACTION_TYPES.start) {
        cancelKey(queueKey)
      }
      options.emit(operationKey, payload)
      return
    }

    scheduledMoves += 1
    const emitter = getEmitter(queueKey, operationKey)
    emitter.pending = { operationKey, payload }
    schedulePending(emitter)
  }

  function flush(): void {
    emitters.forEach((_, key) => flushKey(key))
  }

  function cancel(): void {
    emitters.forEach((_, key) => cancelKey(key))
  }

  function recordBackendPreview(feedbackKey: string, mprRevision?: number | null): void {
    const now = getNow()
    const lastBackendPreview = lastBackendPreviewByKey.get(feedbackKey)
    if (
      lastBackendPreview != null &&
      now - lastBackendPreview.at < DUPLICATE_PREVIEW_FEEDBACK_WINDOW_MS &&
      (mprRevision == null || mprRevision === lastBackendPreview.revision)
    ) {
      return
    }
    const sentAt = sentMoveAtByKey.get(feedbackKey)
    sentMoveAtByKey.delete(feedbackKey)
    if (sentAt != null) {
      const sampleMs = estimateMoveIntervalFromBackendSample(now - sentAt)
      const previousIntervalMs = backendPreviewIntervalByKey.get(feedbackKey)
      const nextIntervalMs =
        previousIntervalMs == null
          ? sampleMs
          : previousIntervalMs * (1 - BACKEND_PREVIEW_EWMA_ALPHA) + sampleMs * BACKEND_PREVIEW_EWMA_ALPHA
      backendPreviewIntervalByKey.set(feedbackKey, nextIntervalMs)
    } else if (lastBackendPreview != null) {
      const elapsedSinceLastFeedbackMs = now - lastBackendPreview.at
      if (elapsedSinceLastFeedbackMs <= BACKEND_FEEDBACK_IDLE_GAP_MS) {
        const sampleMs = normalizeMoveInterval(elapsedSinceLastFeedbackMs)
        fallbackPreviewIntervalMs =
          fallbackPreviewIntervalMs == null
            ? sampleMs
            : fallbackPreviewIntervalMs * (1 - BACKEND_PREVIEW_EWMA_ALPHA) + sampleMs * BACKEND_PREVIEW_EWMA_ALPHA
      }
    }
    lastBackendPreviewByKey.set(feedbackKey, {
      at: now,
      revision: mprRevision ?? null
    })
    emitters.forEach((emitter) => {
      if (emitter.operationKey !== feedbackKey || !emitter.awaitingFeedback) {
        return
      }
      emitter.awaitingFeedback = false
      schedulePending(emitter)
    })
  }

  return {
    cancel,
    emit,
    flush,
    recordBackendPreview
  }
}
