import type { DragActionType } from '@shared/viewerConstants'
import type { MprCrosshairMode, MprMipConfig, MprSegmentationConfig, MprSegmentationConfigActionType, MprSegmentationPanelState } from '../../../types/viewer'

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
  | 'volumeBlendMode'
  | 'volumeRenderOptions'
  | 'volumeClipReset'
  | 'rotate'
  | 'pseudocolor'
  | 'windowPreset'
  | 'mprMipConfig'
  | 'mprSegmentation'
  | 'mprSegmentationPanelState'
  | 'mprCrosshairMode'
  | 'fusionManualRegistration'
  | 'fusionRegistrationReset'
  | 'fusionRegistrationSave'
  | 'fusionRegistrationLoad'
  | 'fusionPseudocolor'
  | 'fusionPetPanePseudocolor'
  | 'fusionWindowTarget'
  | 'fusionAlpha'
  | 'petPseudocolor'
  | 'fusionPetUnit'
  | 'fusionPetWindow'
  | 'fusionPetControlWindowMax'
  | 'fusionPetDisplayReset'
  | 'petUnit'
  | 'petWindow'
  | 'petControlWindowMax'
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
  segmentationPanelState?: Partial<MprSegmentationPanelState>
  mode?: MprCrosshairMode
  registrationFile?: Record<string, unknown>
}
