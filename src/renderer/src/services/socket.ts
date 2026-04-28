import { io, type Socket } from 'socket.io-client'
import type { DragActionType, ViewOperationType } from '@shared/viewerConstants'
import type {
  FourDPlaybackFpsRequest,
  FourDPlaybackStartRequest,
  FourDPlaybackStopRequest,
  MeasurementDraftPayload,
  MeasurementDraftPoint,
  MprMipOperationConfig,
  ViewHoverPayload,
  VolumeRenderConfig
} from '../types/viewer'

type ViewActionType = DragActionType | 'delete'

export interface ViewOperationPayload {
  viewId: string
  opType: ViewOperationType
  measurementId?: string
  subOpType?: string
  actionType?: ViewActionType
  x?: number
  y?: number
  line?: 'horizontal' | 'vertical'
  points?: MeasurementDraftPoint[]
  viewportKey?: string
  zoom?: number
  delta?: number
  rotationDegrees?: number
  ww?: number
  wl?: number
  pseudocolorPreset?: string
  mprMipConfig?: MprMipOperationConfig
  sourceViewId?: string
  hor_flip?: boolean
  ver_flip?: boolean
  volumeConfig?: VolumeRenderConfig
}

export type ViewOperationInput = Omit<ViewOperationPayload, 'viewId'>

let socket: Socket | null = null
const measurementDraftHandlers = new Set<(payload: MeasurementDraftPayload) => void>()

export function connectSocket(origin: string): Socket {
  if (socket) {
    socket.disconnect()
  }

  socket = io(origin, {
    transports: ['websocket', 'polling'],
    forceNew: true
  })
  measurementDraftHandlers.forEach((handler) => {
    socket?.on('measurement_draft', handler)
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function bindView(viewId: string): void {
  if (!socket || !viewId) {
    return
  }

  socket.emit('bind_view', { viewId })
}

export function bindViewSilently(viewId: string): void {
  if (!socket || !viewId) {
    return
  }

  socket.emit('bind_view', { viewId, render: false })
}

export function bindViewSilentlyWithAck(viewId: string, timeoutMs = 3000): Promise<boolean> {
  if (!socket || !viewId) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    socket
      ?.timeout(timeoutMs)
      .emit('bind_view', { viewId, render: false }, (error: Error | null, response?: { ok?: boolean }) => {
        resolve(!error && response?.ok !== false)
      })
  })
}

export function emitViewOperation(payload: ViewOperationPayload): void {
  if (!socket || !payload.viewId) {
    return
  }
  socket.emit('view_operation', payload)
}

export function emitViewOperationWithAck(payload: ViewOperationPayload, timeoutMs = 8000): Promise<boolean> {
  if (!socket || !payload.viewId) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    socket
      ?.timeout(timeoutMs)
      .emit('view_operation', payload, (error: Error | null, response?: { ok?: boolean }) => {
        resolve(!error && response?.ok !== false)
      })
  })
}

export function emitViewHover(payload: ViewHoverPayload): void {
  if (!socket || !payload.viewId) {
    return
  }
  socket.emit('view_hover', payload)
}

export function emitFourDPlaybackStart(payload: FourDPlaybackStartRequest): void {
  if (!socket || !payload.tabKey) {
    return
  }
  socket.emit('four_d_playback_start', payload)
}

export function emitFourDPlaybackStop(payload: FourDPlaybackStopRequest): void {
  if (!socket || !payload.tabKey) {
    return
  }
  socket.emit('four_d_playback_stop', payload)
}

export function emitFourDPlaybackFps(payload: FourDPlaybackFpsRequest): void {
  if (!socket || !payload.tabKey) {
    return
  }
  socket.emit('four_d_playback_fps', payload)
}

export function onMeasurementDraft(handler: (payload: MeasurementDraftPayload) => void): void {
  measurementDraftHandlers.add(handler)
  socket?.on('measurement_draft', handler)
}

export function offMeasurementDraft(handler: (payload: MeasurementDraftPayload) => void): void {
  measurementDraftHandlers.delete(handler)
  socket?.off('measurement_draft', handler)
}
