import type { DragActionType } from '@shared/viewerConstants'
import type { MprCrosshairMode, MprMipConfig, MprSegmentationConfig, MprSegmentationConfigActionType } from '../../../types/viewer'

export type ViewerDisplayOverlayKey = 'cornerInfo' | 'scaleBar' | 'pseudocolorBar' | 'sliceSlider'
export type ViewerTransformResetScope = 'all' | 'pan' | 'zoom'

export type ViewerToolbarAction =
  | 'reset'
  | 'transformReset'
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
  | 'fusionRegistrationLoad'
  | 'fusionPseudocolor'
  | 'fusionPetUnit'
  | 'fusionPetWindow'
  | 'fusionPetDisplayReset'
  | 'petUnit'
  | 'petWindow'
  | 'petDisplayReset'
  | 'displayOverlay'

export interface ViewerToolbarActionPayload {
  action: ViewerToolbarAction
  actionType?: DragActionType | MprSegmentationConfigActionType
  enabled?: boolean
  overlay?: ViewerDisplayOverlayKey
  transformScope?: ViewerTransformResetScope
  value?: string
  config?: MprMipConfig
  segmentationConfig?: MprSegmentationConfig
  mode?: MprCrosshairMode
  registrationFile?: Record<string, unknown>
}
