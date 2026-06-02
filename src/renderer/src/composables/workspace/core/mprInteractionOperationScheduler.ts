import { DRAG_ACTION_TYPES, type ViewOperationType, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { createLatestFrameEmitter } from '../../measurements/viewportDragMoveScheduler'
import type { ViewOperationInput } from '../../../services/socket'

type FrameRequest = (callback: FrameRequestCallback) => number
type FrameCancel = (handle: number) => void

interface ScheduledMprOperation {
  payload: ViewOperationInput
  viewportKey: string
}

interface MprInteractionOperationSchedulerOptions {
  cancelAnimationFrame?: FrameCancel
  emit: (viewportKey: string, payload: ViewOperationInput) => void
  requestAnimationFrame?: FrameRequest
}

const MPR_INTERACTIVE_MOVE_OPERATION_TYPES = new Set<ViewOperationType>([
  VIEW_OPERATION_TYPES.crosshair,
  VIEW_OPERATION_TYPES.mprOblique,
  VIEW_OPERATION_TYPES.pan,
  VIEW_OPERATION_TYPES.window,
  VIEW_OPERATION_TYPES.zoom
])

function getOperationQueueKey(viewportKey: string, payload: ViewOperationInput): string | null {
  if (!MPR_INTERACTIVE_MOVE_OPERATION_TYPES.has(payload.opType)) {
    return null
  }

  const lineKey = payload.opType === VIEW_OPERATION_TYPES.mprOblique ? payload.line ?? '' : ''
  return `${viewportKey}:${payload.opType}:${lineKey}`
}

function logCoalescingStats(scheduledMoves: number, emittedMoves: number): void {
  if (!import.meta.env.DEV || scheduledMoves <= 0 || scheduledMoves % 120 !== 0) {
    return
  }

  console.debug('[mpr perf] interactive moves coalesced', {
    emittedMoves,
    scheduledMoves
  })
}

export function createMprInteractionOperationScheduler(options: MprInteractionOperationSchedulerOptions) {
  const emitters = new Map<
    string,
    ReturnType<typeof createLatestFrameEmitter<ScheduledMprOperation>>
  >()
  let scheduledMoves = 0
  let emittedMoves = 0

  function getEmitter(key: string) {
    const existing = emitters.get(key)
    if (existing) {
      return existing
    }

    const emitter = createLatestFrameEmitter<ScheduledMprOperation>({
      emit: (operation) => {
        emittedMoves += 1
        options.emit(operation.viewportKey, operation.payload)
        logCoalescingStats(scheduledMoves, emittedMoves)
      },
      requestAnimationFrame: options.requestAnimationFrame,
      cancelAnimationFrame: options.cancelAnimationFrame
    })
    emitters.set(key, emitter)
    return emitter
  }

  function flushKey(key: string): void {
    emitters.get(key)?.flush()
  }

  function cancelKey(key: string): void {
    emitters.get(key)?.cancel()
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
    getEmitter(queueKey).schedule({ viewportKey, payload })
  }

  function flush(): void {
    emitters.forEach((emitter) => emitter.flush())
  }

  function cancel(): void {
    emitters.forEach((emitter) => emitter.cancel())
  }

  return {
    cancel,
    emit,
    flush
  }
}
