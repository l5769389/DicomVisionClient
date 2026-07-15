import type { DragActionType } from '@shared/viewerConstants'
import type { MprCrosshairMode, MprMipConfig, MprSegmentationConfig, MprSegmentationConfigActionType } from '../../../types/viewer'

export type ViewerDisplayOverlayKey = 'cornerInfo' | 'scaleBar' | 'pseudocolorBar' | 'sliceSlider' | 'crosshair' | 'volumeOrientationCube'
export type ViewerTransformResetScope = 'all' | 'pan' | 'zoom'

export type ViewerToolbarAction =
  | 'reset'
  | 'transformReset'
  | 'transformZoomPreset'
  | 'clearMeasurements'
  | 'clearMtf'
  | 'clearAnnotations'
  | 'resetAll'
  | 'volumePreset'
  | 'surfacePreset'
  | 'render3dMode'
  | 'volumeRenderOptions'
  | 'volumeClipReset'
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
  | 'mprCrosshairReset'
  | 'rotate3dReset'
  | 'volumeOrientation'
  | 'displayOverlay'

export interface ViewerToolbarActionPayload {
  action: ViewerToolbarAction
  actionType?: DragActionType | MprSegmentationConfigActionType
  enabled?: boolean
  overlay?: ViewerDisplayOverlayKey
  transformScope?: ViewerTransformResetScope
  transformZoom?: number
  viewportKey?: string
  value?: string
  config?: MprMipConfig
  segmentationConfig?: MprSegmentationConfig
  mode?: MprCrosshairMode
  registrationFile?: Record<string, unknown>
}
