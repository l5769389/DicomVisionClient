import type { MprMipConfig } from '../../../types/viewer'

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

export interface ViewerToolbarActionPayload {
  action: ViewerToolbarAction
  value?: string
  config?: MprMipConfig
}
