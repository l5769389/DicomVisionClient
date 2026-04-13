import { assign, createActor, setup, type SnapshotFrom } from 'xstate'

interface PlaybackContext {
  none: true
}

type PlaybackEvent = { type: 'START' } | { type: 'PAUSE' } | { type: 'RESUME' } | { type: 'STOP' }

const playbackMachine = setup({
  types: {
    context: {} as PlaybackContext,
    events: {} as PlaybackEvent
  }
}).createMachine({
  id: 'toolbarPlayback',
  initial: 'stopped',
  context: { none: true },
  states: {
    stopped: {
      on: {
        START: 'playing'
      }
    },
    playing: {
      on: {
        PAUSE: 'paused',
        STOP: 'stopped'
      }
    },
    paused: {
      on: {
        RESUME: 'playing',
        STOP: 'stopped'
      }
    }
  }
})

interface MenuContext {
  openKey: string | null
}

type MenuEvent =
  | { type: 'OPEN'; key: string }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE'; key: string }

const menuMachine = setup({
  types: {
    context: {} as MenuContext,
    events: {} as MenuEvent
  },
  actions: {
    assignOpenKey: assign(({ event }) =>
      event.type === 'OPEN' || event.type === 'TOGGLE'
        ? {
            openKey: event.key
          }
        : {}
    ),
    clearOpenKey: assign(() => ({ openKey: null }))
  }
}).createMachine({
  id: 'toolbarMenu',
  initial: 'closed',
  context: { openKey: null },
  states: {
    closed: {
      on: {
        OPEN: { target: 'open', actions: 'assignOpenKey' },
        TOGGLE: { target: 'open', actions: 'assignOpenKey' }
      }
    },
    open: {
      on: {
        OPEN: { target: 'open', actions: 'assignOpenKey' },
        CLOSE: { target: 'closed', actions: 'clearOpenKey' },
        TOGGLE: [
          {
            guard: ({ context, event }) => context.openKey === event.key,
            target: 'closed',
            actions: 'clearOpenKey'
          },
          {
            target: 'open',
            actions: 'assignOpenKey'
          }
        ]
      }
    }
  }
})

interface ToolbarActivationContext {
  activeKey: string
  returnKey: string | null
  transientKey: string | null
}

type ToolbarActivationEvent =
  | { type: 'SET_ACTIVE'; key: string }
  | { type: 'FLASH'; transientKey: string; returnKey: string }
  | { type: 'CLEAR_TRANSIENT' }

const toolbarActivationMachine = setup({
  types: {
    context: {} as ToolbarActivationContext,
    events: {} as ToolbarActivationEvent
  },
  actions: {
    assignActiveKey: assign(({ context, event }) =>
      event.type === 'SET_ACTIVE'
        ? {
            ...context,
            activeKey: event.key,
            returnKey: null,
            transientKey: null
          }
        : {}
    ),
    assignFlash: assign(({ context, event }) =>
      event.type === 'FLASH'
        ? {
            ...context,
            returnKey: event.returnKey,
            transientKey: event.transientKey
          }
        : {}
    ),
    clearTransient: assign(({ context }) => ({
      ...context,
      activeKey: context.returnKey ?? context.activeKey,
      returnKey: null,
      transientKey: null
    }))
  }
}).createMachine({
  id: 'toolbarActivation',
  initial: 'steady',
  context: {
    activeKey: 'window',
    returnKey: null,
    transientKey: null
  },
  states: {
    steady: {
      on: {
        SET_ACTIVE: { actions: 'assignActiveKey' },
        FLASH: { target: 'transient', actions: 'assignFlash' }
      }
    },
    transient: {
      after: {
        260: {
          target: 'steady',
          actions: 'clearTransient'
        }
      },
      on: {
        SET_ACTIVE: { target: 'steady', actions: 'assignActiveKey' },
        CLEAR_TRANSIENT: { target: 'steady', actions: 'clearTransient' },
        FLASH: { target: 'transient', actions: 'assignFlash' }
      }
    }
  }
})

export function createPlaybackController() {
  const actor = createActor(playbackMachine)
  actor.start()

  return {
    getSnapshot(): SnapshotFrom<typeof playbackMachine> {
      return actor.getSnapshot()
    },
    start(): void {
      actor.send({ type: 'START' })
    },
    pause(): void {
      actor.send({ type: 'PAUSE' })
    },
    resume(): void {
      actor.send({ type: 'RESUME' })
    },
    stop(): void {
      actor.send({ type: 'STOP' })
    },
    subscribe(listener: (snapshot: SnapshotFrom<typeof playbackMachine>) => void) {
      return actor.subscribe(listener)
    },
    shutdown(): void {
      actor.stop()
    }
  }
}

export function createMenuController() {
  const actor = createActor(menuMachine)
  actor.start()

  return {
    getSnapshot(): SnapshotFrom<typeof menuMachine> {
      return actor.getSnapshot()
    },
    open(key: string): void {
      actor.send({ type: 'OPEN', key })
    },
    close(): void {
      actor.send({ type: 'CLOSE' })
    },
    toggle(key: string): void {
      actor.send({ type: 'TOGGLE', key })
    },
    subscribe(listener: (snapshot: SnapshotFrom<typeof menuMachine>) => void) {
      return actor.subscribe(listener)
    },
    shutdown(): void {
      actor.stop()
    }
  }
}

export function createToolbarActivationController(initialKey = 'window') {
  const actor = createActor(toolbarActivationMachine, {
    snapshot: toolbarActivationMachine.resolveState({
      value: 'steady',
      context: {
        activeKey: initialKey,
        returnKey: null,
        transientKey: null
      }
    })
  })
  actor.start()

  return {
    getSnapshot(): SnapshotFrom<typeof toolbarActivationMachine> {
      return actor.getSnapshot()
    },
    setActive(key: string): void {
      actor.send({ type: 'SET_ACTIVE', key })
    },
    flash(transientKey: string, returnKey: string): void {
      actor.send({ type: 'FLASH', transientKey, returnKey })
    },
    clearTransient(): void {
      actor.send({ type: 'CLEAR_TRANSIENT' })
    },
    subscribe(listener: (snapshot: SnapshotFrom<typeof toolbarActivationMachine>) => void) {
      return actor.subscribe(listener)
    },
    shutdown(): void {
      actor.stop()
    }
  }
}
