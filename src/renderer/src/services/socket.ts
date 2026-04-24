import { io, type Socket } from 'socket.io-client'
import type { DragActionType, ViewOperationType } from '@shared/viewerConstants'
import type { MeasurementDraftPayload, MeasurementDraftPoint, MprMipOperationConfig, ViewHoverPayload, VolumeRenderConfig } from '../types/viewer'

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
  angleRad?: number
  deltaAngleRad?: number
  points?: MeasurementDraftPoint[]
  viewportKey?: string
  zoom?: number
  delta?: number
  rotationDegrees?: number
  ww?: number
  wl?: number
  pseudocolorPreset?: string
  mprMipConfig?: MprMipOperationConfig
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

export function emitViewOperation(payload: ViewOperationPayload): void {
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
  measurementDraftHandlers.add(handler)
  socket?.on('measurement_draft', handler)
}

export function offMeasurementDraft(handler: (payload: MeasurementDraftPayload) => void): void {
  measurementDraftHandlers.delete(handler)
  socket?.off('measurement_draft', handler)
}
