import { assign, createActor, setup, type SnapshotFrom } from 'xstate'
import type { DraftMeasurementMode, MeasurementDraftPoint, MeasurementToolType } from '../../types/viewer'

export type MeasurementInteractionState =
  | { kind: 'idle' }
  | { kind: 'selected'; viewportKey: string; measurementId: string }
  | { kind: 'creating'; viewportKey: string; toolType: MeasurementToolType }
  | { kind: 'move_pending'; viewportKey: string; measurementId: string; startPoint: MeasurementDraftPoint }
  | { kind: 'moving'; viewportKey: string; measurementId: string; lastPoint: MeasurementDraftPoint; hasChanged: boolean }
  | { kind: 'editing_handle'; viewportKey: string; measurementId: string; handleIndex: number; hasChanged: boolean }

interface MeasurementInteractionContext {
  handleIndex: number | null
  hasChanged: boolean
  lastPoint: MeasurementDraftPoint | null
  measurementId: string | null
  startPoint: MeasurementDraftPoint | null
  toolType: MeasurementToolType | null
  viewportKey: string | null
}

type MeasurementInteractionEvent =
  | { type: 'RESET' }
  | { type: 'SELECT'; viewportKey: string; measurementId: string }
  | { type: 'START_CREATE'; viewportKey: string; toolType: MeasurementToolType }
  | { type: 'START_MOVE_PENDING'; viewportKey: string; measurementId: string; startPoint: MeasurementDraftPoint }
  | { type: 'START_MOVING'; lastPoint: MeasurementDraftPoint }
  | { type: 'START_EDITING_HANDLE'; viewportKey: string; measurementId: string; handleIndex: number }
  | { type: 'MARK_CHANGED' }
  | { type: 'UPDATE_LAST_POINT'; lastPoint: MeasurementDraftPoint }

const INITIAL_CONTEXT: MeasurementInteractionContext = {
  handleIndex: null,
  hasChanged: false,
  lastPoint: null,
  measurementId: null,
  startPoint: null,
  toolType: null,
  viewportKey: null
}

const measurementInteractionMachine = setup({
  types: {
    context: {} as MeasurementInteractionContext,
    events: {} as MeasurementInteractionEvent
  },
  actions: {
    resetContext: assign(() => ({ ...INITIAL_CONTEXT })),
    assignSelection: assign(({ event }) =>
      event.type === 'SELECT'
        ? {
            ...INITIAL_CONTEXT,
            viewportKey: event.viewportKey,
            measurementId: event.measurementId
          }
        : {}
    ),
    assignCreation: assign(({ event }) =>
      event.type === 'START_CREATE'
        ? {
            ...INITIAL_CONTEXT,
            viewportKey: event.viewportKey,
            toolType: event.toolType
          }
        : {}
    ),
    assignPendingMove: assign(({ event }) =>
      event.type === 'START_MOVE_PENDING'
        ? {
            ...INITIAL_CONTEXT,
            viewportKey: event.viewportKey,
            measurementId: event.measurementId,
            startPoint: event.startPoint
          }
        : {}
    ),
    assignMoving: assign(({ context, event }) =>
      event.type === 'START_MOVING'
        ? {
            ...context,
            lastPoint: event.lastPoint,
            hasChanged: false
          }
        : {}
    ),
    assignEditingHandle: assign(({ event }) =>
      event.type === 'START_EDITING_HANDLE'
        ? {
            ...INITIAL_CONTEXT,
            viewportKey: event.viewportKey,
            measurementId: event.measurementId,
            handleIndex: event.handleIndex
          }
        : {}
    ),
    markChanged: assign(() => ({ hasChanged: true })),
    updateLastPoint: assign(({ event }) =>
      event.type === 'UPDATE_LAST_POINT'
        ? {
            lastPoint: event.lastPoint
          }
        : {}
    )
  }
}).createMachine({
  id: 'measurementInteraction',
  initial: 'idle',
  context: { ...INITIAL_CONTEXT },
  states: {
    idle: {
      on: {
        // 收到SELECT 事件， 转为selected 状态 ，同时触发assignSelection 动作。
        SELECT: { target: 'selected', actions: 'assignSelection' },
        START_CREATE: { target: 'creating', actions: 'assignCreation' },
        START_MOVE_PENDING: { target: 'move_pending', actions: 'assignPendingMove' },
        START_EDITING_HANDLE: { target: 'editing_handle', actions: 'assignEditingHandle' }
      }
    },
    selected: {
      on: {
        RESET: { target: 'idle', actions: 'resetContext' },
        SELECT: { target: 'selected', actions: 'assignSelection' },
        START_CREATE: { target: 'creating', actions: 'assignCreation' },
        START_MOVE_PENDING: { target: 'move_pending', actions: 'assignPendingMove' },
        START_EDITING_HANDLE: { target: 'editing_handle', actions: 'assignEditingHandle' }
      }
    },
    creating: {
      on: {
        RESET: { target: 'idle', actions: 'resetContext' },
        SELECT: { target: 'selected', actions: 'assignSelection' }
      }
    },
    move_pending: {
      on: {
        RESET: { target: 'idle', actions: 'resetContext' },
        SELECT: { target: 'selected', actions: 'assignSelection' },
        START_MOVING: { target: 'moving', actions: 'assignMoving' }
      }
    },
    moving: {
      on: {
        RESET: { target: 'idle', actions: 'resetContext' },
        SELECT: { target: 'selected', actions: 'assignSelection' },
        MARK_CHANGED: { actions: 'markChanged' },
        UPDATE_LAST_POINT: { actions: 'updateLastPoint' }
      }
    },
    editing_handle: {
      on: {
        RESET: { target: 'idle', actions: 'resetContext' },
        SELECT: { target: 'selected', actions: 'assignSelection' },
        MARK_CHANGED: { actions: 'markChanged' }
      }
    }
  }
})

function toMeasurementInteractionState(
  state: SnapshotFrom<typeof measurementInteractionMachine>
): MeasurementInteractionState {
  const context = state.context

  if (state.matches('selected') && context.viewportKey && context.measurementId) {
    return {
      kind: 'selected',
      viewportKey: context.viewportKey,
      measurementId: context.measurementId
    }
  }

  if (state.matches('creating') && context.viewportKey && context.toolType) {
    return {
      kind: 'creating',
      viewportKey: context.viewportKey,
      toolType: context.toolType
    }
  }

  if (state.matches('move_pending') && context.viewportKey && context.measurementId && context.startPoint) {
    return {
      kind: 'move_pending',
      viewportKey: context.viewportKey,
      measurementId: context.measurementId,
      startPoint: context.startPoint
    }
  }

  if (state.matches('moving') && context.viewportKey && context.measurementId && context.lastPoint) {
    return {
      kind: 'moving',
      viewportKey: context.viewportKey,
      measurementId: context.measurementId,
      lastPoint: context.lastPoint,
      hasChanged: context.hasChanged
    }
  }

  if (state.matches('editing_handle') && context.viewportKey && context.measurementId && context.handleIndex != null) {
    return {
      kind: 'editing_handle',
      viewportKey: context.viewportKey,
      measurementId: context.measurementId,
      handleIndex: context.handleIndex,
      hasChanged: context.hasChanged
    }
  }

  return { kind: 'idle' }
}

export function createMeasurementInteractionController() {
  const actor = createActor(measurementInteractionMachine)
  actor.start()

  return {
    getState(): MeasurementInteractionState {
      return toMeasurementInteractionState(actor.getSnapshot())
    },
    reset(): void {
      actor.send({ type: 'RESET' })
    },
    select(viewportKey: string, measurementId: string): void {
      actor.send({ type: 'SELECT', viewportKey, measurementId })
    },
    startCreate(viewportKey: string, toolType: MeasurementToolType): void {
      actor.send({ type: 'START_CREATE', viewportKey, toolType })
    },
    startMovePending(viewportKey: string, measurementId: string, startPoint: MeasurementDraftPoint): void {
      actor.send({ type: 'START_MOVE_PENDING', viewportKey, measurementId, startPoint })
    },
    startMoving(lastPoint: MeasurementDraftPoint): void {
      actor.send({ type: 'START_MOVING', lastPoint })
    },
    startEditingHandle(viewportKey: string, measurementId: string, handleIndex: number): void {
      actor.send({ type: 'START_EDITING_HANDLE', viewportKey, measurementId, handleIndex })
    },
    markChanged(): void {
      actor.send({ type: 'MARK_CHANGED' })
    },
    updateLastPoint(lastPoint: MeasurementDraftPoint): void {
      actor.send({ type: 'UPDATE_LAST_POINT', lastPoint })
    }
  }
}

export function resolveDraftMeasurementMode(
  state: MeasurementInteractionState,
  viewportKey: string,
  hasMeasurementId: boolean
): DraftMeasurementMode {
  if (hasMeasurementId && state.kind !== 'idle' && state.viewportKey === viewportKey) {
    if (state.kind === 'moving') {
      return 'moving'
    }
    if (state.kind === 'selected' || state.kind === 'move_pending') {
      return 'selected'
    }
  }

  return 'draft'
}
