export interface FolderSeriesItem {
  seriesId: string
  seriesInstanceUid?: string | null
  studyInstanceUid?: string | null
  patientId?: string | null
  modality?: string | null
  seriesDescription?: string | null
  instanceCount: number
  width?: number | null
  height?: number | null
  folderPath: string
}

export interface LoadFolderResponse {
  seriesId?: string | null
  seriesList?: FolderSeriesItem[]
}

export interface ViewCreateResponse {
  viewId: string
}

export type BackendCreateViewType = ViewType | 'AX' | 'COR' | 'SAG'
export type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

export interface CornerInfo {
  topLeft: string[]
  topRight: string[]
  bottomLeft: string[]
  bottomRight: string[]
}

export interface CornerInfoResponse {
  cornerInfo?: unknown
}

export interface OperationAcceptedResponse {
  success: boolean
  message: string
  viewId: string
}

export interface WorkspaceReadyPayload {
  element: HTMLElement | null
  viewportKey: string
  viewportElements?: Partial<Record<MprViewportKey, HTMLElement | null>>
}

export type MprViewportKey = 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
export type MeasurementToolType = 'line' | 'rect' | 'ellipse' | 'angle'

export interface MeasurementDraftPoint {
  x: number
  y: number
}

export interface MeasurementDraft {
  measurementId?: string
  toolType: MeasurementToolType
  points: MeasurementDraftPoint[]
  labelLines?: string[]
  isCommitted?: boolean
  isMoving?: boolean
  selectedHandleIndex?: number | null
}

export interface MeasurementDraftPayload {
  viewId: string
  viewportKey: string
  toolType: MeasurementToolType
  labelLines: string[]
  sliceIndex?: number
}

export interface MeasurementOverlay {
  measurementId: string
  toolType: MeasurementToolType
  points: MeasurementDraftPoint[]
  labelLines: string[]
}

export interface MprCrosshairInfo {
  centerX: number
  centerY: number
  hitRadius: number
  horizontalPosition: number | null
  verticalPosition: number | null
}

export interface OrientationInfo {
  top: string | null
  right: string | null
  bottom: string | null
  left: string | null
  volumeQuaternion?: [number, number, number, number] | null
}

export type VolumeBlendMode = 'composite' | 'mip'

export interface VolumeLayerConfig {
  key: string
  label: string
  enabled: boolean
  ww: number
  wl: number
  opacity: number
  colorStart: string
  colorEnd: string
}

export type VolumeInterpolationMode = 'nearest' | 'linear' | 'cubic'

export interface VolumeLightingConfig {
  shading: boolean
  interpolation: VolumeInterpolationMode
  ambient: number
  diffuse: number
  specular: number
  roughness: number
}

export interface VolumeRenderConfig {
  preset: string
  blendMode: VolumeBlendMode
  layers: VolumeLayerConfig[]
  lighting: VolumeLightingConfig
}

export interface ViewImageResponse {
  imageFormat?: 'png' | 'jpeg'
  viewId: string
  slice_info?: {
    current: number
    total: number
  }
  window_info?: {
    ww?: number | null
    wl?: number | null
  }
  mpr_crosshair?: MprCrosshairInfo | null
  measurements?: MeasurementOverlay[]
  cornerInfo?: unknown
  orientation?: unknown
  volumePreset?: string
  volumeConfig?: VolumeRenderConfig | null
}

export interface ViewHoverPayload {
  viewId: string
  x: number
  y: number
}

export interface ViewHoverResponse {
  viewId: string
  row: number
  col: number
}

export interface ViewerTabItem {
  key: string
  seriesId: string
  seriesTitle: string
  title: string
  viewType: ViewType
  viewId: string
  imageSrc: string
  sliceLabel: string
  windowLabel: string
  viewportViewIds?: Partial<Record<MprViewportKey, string>>
  viewportImages?: Partial<Record<MprViewportKey, string>>
  viewportSliceLabels?: Partial<Record<MprViewportKey, string>>
  viewportCrosshairs?: Partial<Record<MprViewportKey, MprCrosshairInfo | null>>
  measurements?: MeasurementOverlay[]
  cornerInfo: CornerInfo
  viewportCornerInfos?: Partial<Record<MprViewportKey, CornerInfo>>
  viewportMeasurements?: Partial<Record<MprViewportKey, MeasurementOverlay[]>>
  orientation: OrientationInfo
  viewportOrientations?: Partial<Record<MprViewportKey, OrientationInfo>>
  volumePreset?: string
  volumeRenderConfig?: VolumeRenderConfig | null
}

export interface ViewerOperationItem {
  value: string
  icon: string
  label: string
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
export type ViewType = 'Stack' | 'MPR' | '3D'
