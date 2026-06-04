import type { DragActionType } from '@shared/viewerConstants'
import type { MprCrosshairMode, MprMipConfig } from '../../../types/viewer'

export type ViewerToolbarAction =
  | 'reset'
  | 'clearMeasurements'
  | 'clearMtf'
  | 'clearAnnotations'
  | 'resetAll'
  | 'volumePreset'
  | 'render3dMode'
  | 'rotate'
  | 'pseudocolor'
  | 'windowPreset'
  | 'mprMipConfig'
  | 'mprCrosshairMode'

export interface ViewerToolbarActionPayload {
  action: ViewerToolbarAction
  actionType?: DragActionType
  value?: string
  config?: MprMipConfig
  mode?: MprCrosshairMode
}
