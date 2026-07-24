import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useViewerWorkspaceConnection } from './useViewerWorkspaceConnection'

const connectSocketMock = vi.hoisted(() => vi.fn())
const getSocketMock = vi.hoisted(() => vi.fn())
const setApiBaseURLMock = vi.hoisted(() => vi.fn())

vi.mock('../../../services/socket', () => ({
  connectSocket: connectSocketMock,
  getSocket: getSocketMock
}))

vi.mock('../../../services/apiBase', () => ({
  setApiBaseURL: setApiBaseURLMock
}))

type EventHandler = (...args: unknown[]) => void

function createEventTarget() {
  const listeners = new Map<string, Set<EventHandler>>()

  return {
    listeners,
    on(event: string, handler: EventHandler) {
      const eventListeners = listeners.get(event) ?? new Set<EventHandler>()
      eventListeners.add(handler)
      listeners.set(event, eventListeners)
    },
    off(event: string, handler: EventHandler) {
      listeners.get(event)?.delete(handler)
    },
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((handler) => handler(...args))
    }
  }
}

function createSocketHarness() {
  const socketEvents = createEventTarget()
  const managerEvents = createEventTarget()
  const socket = {
    on: socketEvents.on,
    off: socketEvents.off,
    io: {
      on: managerEvents.on,
      off: managerEvents.off
    }
  }

  connectSocketMock.mockReturnValue(socket)
  getSocketMock.mockReturnValue(socket)
  return { managerEvents, socketEvents }
}

function createConnectionHarness() {
  const callbacks = {
    onConnected: vi.fn(),
    onDisconnected: vi.fn(),
    onReconnecting: vi.fn(),
    onImageUpdate: vi.fn(),
    onImageMetadataUpdate: vi.fn(),
    onMprStateUpdate: vi.fn(),
    onViewProgress: vi.fn(),
    onHoverInfo: vi.fn(),
    onImageError: vi.fn(),
    onFourDPhaseIndex: vi.fn(),
    onFourDPlaybackState: vi.fn()
  }
  const connection = useViewerWorkspaceConnection({
    backendOrigin: ref('http://127.0.0.1:18080'),
    ...callbacks
  })
  return { callbacks, connection }
}

afterEach(() => {
  connectSocketMock.mockReset()
  getSocketMock.mockReset()
  setApiBaseURLMock.mockReset()
})

describe('useViewerWorkspaceConnection reconnect lifecycle', () => {
  it('reports disconnect and reconnect states and asks the workspace to rebind views', () => {
    const { managerEvents, socketEvents } = createSocketHarness()
    const { callbacks, connection } = createConnectionHarness()

    connection.connectBackend()

    expect(connection.connectionState.value).toBe('connecting')
    expect(setApiBaseURLMock).toHaveBeenCalledWith('http://127.0.0.1:18080/api/v1')

    socketEvents.emit('connect')
    expect(connection.connectionState.value).toBe('connected')
    expect(callbacks.onConnected).toHaveBeenCalledTimes(1)

    socketEvents.emit('disconnect')
    expect(connection.connectionState.value).toBe('disconnected')
    expect(callbacks.onDisconnected).toHaveBeenCalledTimes(1)

    managerEvents.emit('reconnect_attempt')
    expect(connection.connectionState.value).toBe('reconnecting')
    expect(callbacks.onReconnecting).toHaveBeenCalledTimes(1)

    managerEvents.emit('reconnect')
    expect(connection.connectionState.value).toBe('connected')
    expect(callbacks.onConnected).toHaveBeenCalledTimes(2)
  })

  it('does not accumulate duplicate socket listeners when reconnect setup runs again', () => {
    const { managerEvents, socketEvents } = createSocketHarness()
    const { callbacks, connection } = createConnectionHarness()

    connection.connectBackend()
    connection.connectBackend()

    expect(socketEvents.listeners.get('connect')).toHaveLength(1)
    expect(socketEvents.listeners.get('image_update')).toHaveLength(1)
    expect(managerEvents.listeners.get('reconnect')).toHaveLength(1)

    socketEvents.emit('connect')
    managerEvents.emit('reconnect')
    expect(callbacks.onConnected).toHaveBeenCalledTimes(2)
  })
})
