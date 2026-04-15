import { assign, createActor, setup, type SnapshotFrom } from 'xstate'
import type { MeasurementDraftPoint } from '../../types/viewer'

export type MtfInteractionState =
  | { kind: 'idle' }
  | { kind: 'selected'; viewportKey: string; mtfId: string }
  | { kind: 'creating'; viewportKey: string }
  | { kind: 'move_pending'; viewportKey: string; mtfId: string; startPoint: MeasurementDraftPoint }
  | { kind: 'moving'; viewportKey: string; mtfId: string; lastPoint: MeasurementDraftPoint; hasChanged: boolean }
  | { kind: 'editing_handle'; viewportKey: string; mtfId: string; handleIndex: number; hasChanged: boolean }

interface MtfInteractionContext {
  handleIndex: number | null
  hasChanged: boolean
  lastPoint: MeasurementDraftPoint | null
  mtfId: string | null
  startPoint: MeasurementDraftPoint | null
  viewportKey: string | null
}

type MtfInteractionEvent =
  | { type: 'RESET' }
  | { type: 'SELECT'; viewportKey: string; mtfId: string }
  | { type: 'START_CREATE'; viewportKey: string }
  | { type: 'START_MOVE_PENDING'; viewportKey: string; mtfId: string; startPoint: MeasurementDraftPoint }
  | { type: 'START_MOVING'; lastPoint: MeasurementDraftPoint }
  | { type: 'START_EDITING_HANDLE'; viewportKey: string; mtfId: string; handleIndex: number }
  | { type: 'MARK_CHANGED' }
  | { type: 'UPDATE_LAST_POINT'; lastPoint: MeasurementDraftPoint }

const INITIAL_CONTEXT: MtfInteractionContext = {
  handleIndex: null,
  hasChanged: false,
  lastPoint: null,
  mtfId: null,
  startPoint: null,
  viewportKey: null
}

const mtfInteractionMachine = setup({
  types: {
    context: {} as MtfInteractionContext,
    events: {} as MtfInteractionEvent
  },
  actions: {
    resetContext: assign(() => ({ ...INITIAL_CONTEXT })),
    assignSelection: assign(({ event }) =>
      event.type === 'SELECT'
        ? {
            ...INITIAL_CONTEXT,
            viewportKey: event.viewportKey,
            mtfId: event.mtfId
          }
        : {}
    ),
    assignCreation: assign(({ event }) =>
      event.type === 'START_CREATE'
        ? {
            ...INITIAL_CONTEXT,
            viewportKey: event.viewportKey
          }
        : {}
    ),
    assignPendingMove: assign(({ event }) =>
      event.type === 'START_MOVE_PENDING'
        ? {
            ...INITIAL_CONTEXT,
            viewportKey: event.viewportKey,
            mtfId: event.mtfId,
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
            mtfId: event.mtfId,
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
  id: 'mtfInteraction',
  initial: 'idle',
  context: { ...INITIAL_CONTEXT },
  states: {
    idle: {
      on: {
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

function toMtfInteractionState(state: SnapshotFrom<typeof mtfInteractionMachine>): MtfInteractionState {
  const context = state.context

  if (state.matches('selected') && context.viewportKey && context.mtfId) {
    return {
      kind: 'selected',
      viewportKey: context.viewportKey,
      mtfId: context.mtfId
    }
  }

  if (state.matches('creating') && context.viewportKey) {
    return {
      kind: 'creating',
      viewportKey: context.viewportKey
    }
  }

  if (state.matches('move_pending') && context.viewportKey && context.mtfId && context.startPoint) {
    return {
      kind: 'move_pending',
      viewportKey: context.viewportKey,
      mtfId: context.mtfId,
      startPoint: context.startPoint
    }
  }

  if (state.matches('moving') && context.viewportKey && context.mtfId && context.lastPoint) {
    return {
      kind: 'moving',
      viewportKey: context.viewportKey,
      mtfId: context.mtfId,
      lastPoint: context.lastPoint,
      hasChanged: context.hasChanged
    }
  }

  if (state.matches('editing_handle') && context.viewportKey && context.mtfId && context.handleIndex != null) {
    return {
      kind: 'editing_handle',
      viewportKey: context.viewportKey,
      mtfId: context.mtfId,
      handleIndex: context.handleIndex,
      hasChanged: context.hasChanged
    }
  }

  return { kind: 'idle' }
}

export function createMtfInteractionController() {
  const actor = createActor(mtfInteractionMachine)
  actor.start()

  return {
    getState(): MtfInteractionState {
      return toMtfInteractionState(actor.getSnapshot())
    },
    subscribe(listener: (state: MtfInteractionState) => void): () => void {
      const subscription = actor.subscribe((snapshot) => {
        listener(toMtfInteractionState(snapshot))
      })
      listener(toMtfInteractionState(actor.getSnapshot()))
      return () => subscription.unsubscribe()
    },
    reset(): void {
      actor.send({ type: 'RESET' })
    },
    select(viewportKey: string, mtfId: string): void {
      actor.send({ type: 'SELECT', viewportKey, mtfId })
    },
    startCreate(viewportKey: string): void {
      actor.send({ type: 'START_CREATE', viewportKey })
    },
    startMovePending(viewportKey: string, mtfId: string, startPoint: MeasurementDraftPoint): void {
      actor.send({ type: 'START_MOVE_PENDING', viewportKey, mtfId, startPoint })
    },
    startMoving(lastPoint: MeasurementDraftPoint): void {
      actor.send({ type: 'START_MOVING', lastPoint })
    },
    startEditingHandle(viewportKey: string, mtfId: string, handleIndex: number): void {
      actor.send({ type: 'START_EDITING_HANDLE', viewportKey, mtfId, handleIndex })
    },
    markChanged(): void {
      actor.send({ type: 'MARK_CHANGED' })
    },
    updateLastPoint(lastPoint: MeasurementDraftPoint): void {
      actor.send({ type: 'UPDATE_LAST_POINT', lastPoint })
    }
  }
}
