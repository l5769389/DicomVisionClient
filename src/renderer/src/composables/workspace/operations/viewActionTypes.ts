import type { DragActionType } from '@shared/viewerConstants'
import type { MprCrosshairMode, MprMipConfig, MprSegmentationConfig } from '../../../types/viewer'

export type ViewerDisplayOverlayKey = 'cornerInfo' | 'scaleBar'

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
  | 'mprSegmentation'
  | 'mprCrosshairMode'
  | 'fusionManualRegistration'
  | 'fusionRegistrationReset'
  | 'fusionRegistrationSave'
  | 'fusionPseudocolor'
  | 'fusionPetUnit'
  | 'fusionPetWindow'
  | 'displayOverlay'

export interface ViewerToolbarActionPayload {
  action: ViewerToolbarAction
  actionType?: DragActionType
  enabled?: boolean
  overlay?: ViewerDisplayOverlayKey
  value?: string
  config?: MprMipConfig
  segmentationConfig?: MprSegmentationConfig
  mode?: MprCrosshairMode
}
