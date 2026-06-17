import { io, type Socket } from 'socket.io-client'
import type { DragActionType, ViewOperationType } from '@shared/viewerConstants'
import { getWorkspaceId } from './workspaceIdentity'
import type {
  FourDPlaybackFpsRequest,
  FourDPlaybackPhaseEvent,
  FourDPlaybackStartRequest,
  FourDPlaybackStateEvent,
  FourDPlaybackStopRequest,
  MeasurementDraftPayload,
  MeasurementDraftPoint,
  MprCrosshairMode,
  MprMipOperationConfig,
  MprSegmentationOperationConfig,
  ViewProgressInfo,
  ViewHoverPayload,
  ViewHoverResponse,
  ViewImageResponse,
  Render3DMode,
  SurfaceRenderConfig,
  VolumeRenderConfig
} from '../types/viewer'

type ViewActionType = DragActionType | 'delete'
type SocketAckCallback = (error: Error | null, response?: SocketAckPayload) => void
const BIND_VIEW_ACK_TIMEOUT_MS = 3000
const VIEW_OPERATION_ACK_TIMEOUT_MS = 8000

// python-socketio may deliver the binary payload either as two arguments or as a
// single tuple-like message depending on transport/adapter behavior.
export type ImageUpdateExtraBinaries = Record<string, ArrayBuffer | Uint8Array | number[]>

type ImageUpdateSocketArgs =
  | [payload: Partial<ViewImageResponse>, imageBinary: ArrayBuffer | Uint8Array]
  | [payload: Partial<ViewImageResponse>, imageBinary: ArrayBuffer | Uint8Array, extraBinaries: ImageUpdateExtraBinaries]
  | [message: [Partial<ViewImageResponse>, ArrayBuffer | Uint8Array]]
  | [message: [Partial<ViewImageResponse>, ArrayBuffer | Uint8Array, ImageUpdateExtraBinaries]]

interface SocketAckPayload {
  ok?: boolean
  mprRevision?: number
}

interface SocketErrorPayload {
  message?: string
}

interface BindViewPayload {
  viewId: string
  render?: boolean
}

export interface ViewOperationPayload {
  viewId: string
  opType: ViewOperationType
  measurementId?: string
  subOpType?: string
  actionType?: ViewActionType
  x?: number
  y?: number
  anchorX?: number
  anchorY?: number
  currentX?: number
  currentY?: number
  pivotX?: number
  pivotY?: number
  rotationDeltaDegrees?: number
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
  mprSegmentationConfig?: MprSegmentationOperationConfig
  mprCrosshairMode?: MprCrosshairMode
  fusionAlpha?: number
  fusionManualRegistration?: boolean
  fusionPetUnit?: string
  fusionPetWindowMin?: number
  fusionPetWindowMax?: number
  petUnit?: string
  petWindowMin?: number
  petWindowMax?: number
  fusionRegistrationFile?: Record<string, unknown>
  sourceViewId?: string
  hor_flip?: boolean
  ver_flip?: boolean
  volumeConfig?: VolumeRenderConfig
  render3dMode?: Render3DMode
  surfaceConfig?: SurfaceRenderConfig
}

export type ViewOperationInput = Omit<ViewOperationPayload, 'viewId'>

export interface ServerToClientEvents {
  connected: (payload: { sid: string; workspaceId?: string }) => void
  image_update: (...args: ImageUpdateSocketArgs) => void
  image_error: (payload?: SocketErrorPayload) => void
  render_error: (payload?: SocketErrorPayload) => void
  view_progress: (payload?: ViewProgressInfo) => void
  hover_info: (payload?: ViewHoverResponse) => void
  view_ack: (payload: { success?: boolean; message?: string; viewId?: string }) => void
  view_bound: (payload: { viewId: string }) => void
  measurement_draft: (payload: MeasurementDraftPayload) => void
  four_d_phase_index: (payload?: FourDPlaybackPhaseEvent) => void
  four_d_playback_state: (payload?: FourDPlaybackStateEvent) => void
}

interface ClientToServerEvents {
  bind_view: (payload: BindViewPayload, callback?: SocketAckCallback) => void
  view_operation: (payload: ViewOperationPayload, callback?: SocketAckCallback) => void
  view_hover: (payload: ViewHoverPayload) => void
  four_d_playback_start: (payload: FourDPlaybackStartRequest) => void
  four_d_playback_stop: (payload: FourDPlaybackStopRequest) => void
  four_d_playback_fps: (payload: FourDPlaybackFpsRequest) => void
}

export type ViewerSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: ViewerSocket | null = null
const measurementDraftHandlers = new Set<(payload: MeasurementDraftPayload) => void>()

export function connectSocket(origin: string): ViewerSocket {
  if (socket) {
    socket.disconnect()
  }

  socket = io(origin, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    auth: {
      workspaceId: getWorkspaceId()
    }
  }) as ViewerSocket
  measurementDraftHandlers.forEach((handler) => {
    socket?.on('measurement_draft', handler)
  })

  return socket
}

export function getSocket(): ViewerSocket | null {
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

export function bindViewSilentlyWithAck(viewId: string, timeoutMs = BIND_VIEW_ACK_TIMEOUT_MS): Promise<boolean> {
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

export function emitViewOperationWithAck(payload: ViewOperationPayload, timeoutMs = VIEW_OPERATION_ACK_TIMEOUT_MS): Promise<boolean> {
  if (!socket || !payload.viewId) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    socket
      ?.timeout(timeoutMs)
      .emit('view_operation', payload, (error: Error | null, response?: SocketAckPayload) => {
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
