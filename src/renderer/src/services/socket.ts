import { io, type Socket } from 'socket.io-client'
import type { DragActionType, ViewOperationType } from '@shared/viewerConstants'
import type { MeasurementDraftPayload, MeasurementDraftPoint, ViewHoverPayload, VolumeRenderConfig } from '../types/viewer'

let socket: Socket | null = null

export function connectSocket(origin: string): Socket {
  if (socket) {
    socket.disconnect()
  }

  socket = io(origin, {
    transports: ['websocket', 'polling'],
    forceNew: true
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

export function emitViewOperation(payload: {
  viewId: string
  opType: ViewOperationType
  subOpType?: string
  actionType?: DragActionType
  x?: number
  y?: number
  points?: MeasurementDraftPoint[]
  viewportKey?: string
  zoom?: number
  delta?: number
  hor_flip?: boolean
  ver_flip?: boolean
  volumeConfig?: VolumeRenderConfig
}): void {
  if (!socket || !payload.viewId) {
    return
  }
  socket.emit('view_operation', payload)
}

export function emitViewHover(payload: ViewHoverPayload): void {
  if (!socket || !payload.viewId) {
    return
  }
  socket.emit('view_hover', payload)
}

export function onMeasurementDraft(handler: (payload: MeasurementDraftPayload) => void): void {
  socket?.on('measurement_draft', handler)
}

export function offMeasurementDraft(handler: (payload: MeasurementDraftPayload) => void): void {
  socket?.off('measurement_draft', handler)
}
