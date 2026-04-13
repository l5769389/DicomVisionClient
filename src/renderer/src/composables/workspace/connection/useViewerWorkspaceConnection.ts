import { ref, type Ref } from 'vue'
import { connectSocket, getSocket } from '../../../services/socket'
import { setApiBaseURL } from '../../../services/api'
import type { ConnectionState, ViewHoverResponse } from '../../../types/viewer'

interface ViewerWorkspaceConnectionOptions {
  backendOrigin: Ref<string>
  onConnected: () => void
  onDisconnected: () => void
  onReconnecting: () => void
  onImageUpdate: (...args: unknown[]) => void
  onHoverInfo: (payload: ViewHoverResponse | undefined) => void
  onImageError: (error: { message?: string } | undefined) => void
}

export function useViewerWorkspaceConnection(options: ViewerWorkspaceConnectionOptions) {
  const connectionState = ref<ConnectionState>('connecting')

  function updateConnectionState(state: ConnectionState): void {
    connectionState.value = state
  }

  function handleSocketConnect(): void {
    updateConnectionState('connected')
    options.onConnected()
  }

  function handleSocketDisconnect(): void {
    updateConnectionState('disconnected')
    options.onDisconnected()
  }

  function handleSocketReconnectAttempt(): void {
    updateConnectionState('reconnecting')
    options.onReconnecting()
  }

  function handleSocketReconnect(): void {
    updateConnectionState('connected')
    options.onConnected()
  }

  function handleSocketReconnectError(): void {
    updateConnectionState('reconnecting')
    options.onReconnecting()
  }

  function handleSocketReconnectFailed(): void {
    updateConnectionState('disconnected')
    options.onDisconnected()
  }

  function cleanupSocketListeners(): void {
    const socket = getSocket()
    if (!socket) {
      return
    }

    socket.off('connect', handleSocketConnect)
    socket.off('disconnect', handleSocketDisconnect)
    socket.io.off('reconnect_attempt', handleSocketReconnectAttempt)
    socket.io.off('reconnect', handleSocketReconnect)
    socket.io.off('reconnect_error', handleSocketReconnectError)
    socket.io.off('reconnect_failed', handleSocketReconnectFailed)
    socket.off('image_update', options.onImageUpdate)
    socket.off('hover_info', options.onHoverInfo)
    socket.off('image_error', options.onImageError)
    socket.off('render_error', options.onImageError)
  }

  function connectBackend(): void {
    cleanupSocketListeners()
    updateConnectionState('connecting')
    setApiBaseURL(`${options.backendOrigin.value}/api/v1`)

    const socket = connectSocket(options.backendOrigin.value)
    socket.on('connect', handleSocketConnect)
    socket.on('disconnect', handleSocketDisconnect)
    socket.io.on('reconnect_attempt', handleSocketReconnectAttempt)
    socket.io.on('reconnect', handleSocketReconnect)
    socket.io.on('reconnect_error', handleSocketReconnectError)
    socket.io.on('reconnect_failed', handleSocketReconnectFailed)
    socket.on('image_update', options.onImageUpdate)
    socket.on('hover_info', options.onHoverInfo)
    socket.on('image_error', options.onImageError)
    socket.on('render_error', options.onImageError)
  }

  return {
    cleanupSocketListeners,
    connectBackend,
    connectionState
  }
}
