import type {
  CornerInfoResponse as BackendCornerInfoResponse,
  LoadFolderResponse as BackendLoadFolderResponse,
  MeasurementPointPayload as BackendMeasurementPointPayload,
  MprCrosshairInfo as BackendMprCrosshairInfo,
  MprCursorInfo as BackendMprCursorInfo,
  MprFrameInfo as BackendMprFrameInfo,
  MprPlaneInfo as BackendMprPlaneInfo,
  OperationAcceptedResponse as BackendOperationAcceptedResponse,
  OrientationInfo as BackendOrientationInfo,
  ScaleBarInfo as BackendScaleBarInfo,
  SeriesSummary as BackendSeriesSummary,
  ViewCreateResponse as BackendViewCreateResponse,
  ViewHoverRequest as BackendViewHoverRequest,
  ViewHoverResponse as BackendViewHoverResponse
} from '@shared/generated/backendApi'

export type FolderSeriesItem = BackendSeriesSummary & {
  isFourDSeries?: boolean
  fourDPhaseCount?: number | null
  fourDPhases?: FourDPhaseItem[] | null
}
export type LoadFolderResponse = BackendLoadFolderResponse
export type ViewCreateResponse = BackendViewCreateResponse

export type BackendCreateViewType = 'Stack' | 'MPR' | '3D' | 'AX' | 'COR' | 'SAG'
export type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

export interface CornerInfo {
  topLeft: string[]
  topRight: string[]
  bottomLeft: string[]
  bottomRight: string[]
}

export type CornerInfoResponse = BackendCornerInfoResponse
export type OperationAcceptedResponse = BackendOperationAcceptedResponse

export interface WorkspaceReadyPayload {
  element: HTMLElement | null
  viewportKey: string
  viewportElements?: Partial<Record<MprViewportKey, HTMLElement | null>>
}

export type MprViewportKey = 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
export type MprCrosshairLineTarget = 'horizontal' | 'vertical'
export type MprCrosshairInteractionMode = 'move' | 'rotate'
export type MeasurementToolType = 'line' | 'rect' | 'ellipse' | 'angle'
export type AnnotationToolType = 'arrow'
export type AnnotationSize = 'sm' | 'md' | 'lg'
export type MprMipAlgorithm = 'maximum' | 'minimum' | 'average' | 'sum'

export interface MprCrosshairInteractionPayload {
  viewportKey: string
  phase: 'start' | 'move' | 'end'
  x: number
  y: number
  mode?: MprCrosshairInteractionMode
  line?: MprCrosshairLineTarget
}

export type MeasurementDraftPoint = BackendMeasurementPointPayload

export interface MeasurementDraft {
  measurementId?: string
  toolType: MeasurementToolType
  points: MeasurementDraftPoint[]
  labelLines?: string[]
}

export type DraftMeasurementMode = 'draft' | 'selected' | 'moving'

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

export interface AnnotationDraft {
  annotationId?: string
  toolType: AnnotationToolType
  points: MeasurementDraftPoint[]
  text: string
  color: string
  size: AnnotationSize
}

export interface AnnotationOverlay {
  annotationId: string
  toolType: AnnotationToolType
  points: MeasurementDraftPoint[]
  text: string
  color: string
  size: AnnotationSize
}

export interface MprMipViewportConfig {
  thickness: number
}

export interface MprMipConfig {
  enabled: boolean
  algorithm: MprMipAlgorithm
  viewports: Record<MprViewportKey, MprMipViewportConfig>
}

export type MprMipOperationConfig = (Partial<Omit<MprMipConfig, 'enabled'>> & { enabled: boolean })

export function createDefaultMprMipConfig(): MprMipConfig {
  return {
    enabled: false,
    algorithm: 'maximum',
    viewports: {
      'mpr-ax': { thickness: 12 },
      'mpr-cor': { thickness: 12 },
      'mpr-sag': { thickness: 12 }
    }
  }
}

export function normalizeMprMipConfig(
  value?: MprMipOperationConfig | MprMipConfig | null,
  fallback: MprMipConfig = createDefaultMprMipConfig()
): MprMipConfig {
  const isAlgorithm = (algorithm: unknown): algorithm is MprMipAlgorithm =>
    algorithm === 'maximum' || algorithm === 'minimum' || algorithm === 'average' || algorithm === 'sum'
  const clampThickness = (thickness: unknown, fallbackThickness: number): number => {
    const numericThickness = Number(thickness)
    if (!Number.isFinite(numericThickness)) {
      return fallbackThickness
    }
    return Math.max(1, Math.min(80, Math.round(numericThickness)))
  }

  return {
    enabled: value?.enabled ?? fallback.enabled,
    algorithm: isAlgorithm(value?.algorithm) ? value.algorithm : fallback.algorithm,
    viewports: {
      'mpr-ax': {
        thickness: clampThickness(value?.viewports?.['mpr-ax']?.thickness, fallback.viewports['mpr-ax'].thickness)
      },
      'mpr-cor': {
        thickness: clampThickness(value?.viewports?.['mpr-cor']?.thickness, fallback.viewports['mpr-cor'].thickness)
      },
      'mpr-sag': {
        thickness: clampThickness(value?.viewports?.['mpr-sag']?.thickness, fallback.viewports['mpr-sag'].thickness)
      }
    }
  }
}

export interface MtfMetrics {
  mtf50: number | null
  mtf10: number | null
  fwhmW: number | null
  fwhmH: number | null
  peakValue: number | null
  sampleCount: number | null
  unit?: string | null
}

export interface MtfCurvePoint {
  frequency: number
  value: number
}

export interface ViewerMtfItem {
  mtfId: string
  viewportKey: string
  points: MeasurementDraftPoint[]
  status: 'calculating' | 'ready' | 'error'
  metrics?: MtfMetrics | null
  curve?: MtfCurvePoint[]
  errorMessage?: string | null
  isPlaceholder?: boolean
}

export interface ViewerMtfState {
  items: ViewerMtfItem[]
  selectedMtfId?: string | null
}

export interface FourDPhaseItem {
  phaseIndex: number
  label: string
  seriesId?: string | null
  imageSrc?: string
  viewportImages?: Partial<Record<MprViewportKey, string>>
  status?: 'pending' | 'ready' | 'error'
}

export type QaWaterMetricKey = 'accuracy' | 'uniformity' | 'noise'

export interface QaWaterRoi {
  id: string
  label: string
  kind: 'water' | 'air'
  center: MeasurementDraftPoint
  radius: number
}

export interface QaWaterMetrics {
  accuracy?: {
    centerMean: number
    deviationHu: number
    targetHu: number
    unit: string
  } | null
  uniformity?: {
    centerMean: number
    maxDeviation: number
    peripheralMeans: number[]
    roiStats: Array<{
      id: string
      label: string
      kind: 'water' | 'air'
      area: number
      width: number
      height: number
      mean: number
      stdDev: number
      sampleCount: number
      deviationFromCenter: number | null
      sizeUnit: string
      areaUnit: string
      unit: string
    }>
    unit: string
  } | null
  noise?: {
    stdDev: number
    unit: string
  } | null
}

export interface QaWaterAnalysis {
  viewId?: string
  viewportKey: string
  rois: QaWaterRoi[]
  metrics?: QaWaterMetrics
  status?: 'loading' | 'ready' | 'error'
  message?: string
}

export interface QaWaterAnalyzeRequest {
  viewId: string
  viewportKey: string
  metrics: QaWaterMetricKey[]
}

export interface QaWaterAnalyzeResponse {
  viewId: string
  viewportKey: string
  rois: QaWaterRoi[]
  metrics?: QaWaterMetrics
  status?: 'ready' | 'error'
  message?: string | null
}

export interface MtfAnalyzeRequest {
  viewId: string
  viewportKey: string
  points: MeasurementDraftPoint[]
  qaTask?: 'mtf'
}

export interface MtfAnalyzeResponse {
  viewId: string
  viewportKey: string
  points: MeasurementDraftPoint[]
  metrics: MtfMetrics
  curve: MtfCurvePoint[]
  isPlaceholder?: boolean
}

export type MprCrosshairInfo = BackendMprCrosshairInfo
export type MprCursorInfo = BackendMprCursorInfo
export type MprFrameInfo = BackendMprFrameInfo
export type MprPlaneInfo = BackendMprPlaneInfo
export type ScaleBarInfo = BackendScaleBarInfo
export type OrientationInfo = BackendOrientationInfo

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

export interface ViewTransformInfo {
  rotationDegrees: number
  horFlip: boolean
  verFlip: boolean
}

export interface ViewColorInfo {
  pseudocolorPreset: string
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
  mprFrame?: MprFrameInfo | null
  mprPlane?: MprPlaneInfo | null
  mprCursor?: MprCursorInfo | null
  mpr_crosshair?: MprCrosshairInfo | null
  scaleBar?: ScaleBarInfo | null
  measurements?: MeasurementOverlay[]
  cornerInfo?: unknown
  orientation?: unknown
  volumePreset?: string
  volumeConfig?: VolumeRenderConfig | null
  transform?: ViewTransformInfo | null
  color?: ViewColorInfo | null
  mprMipConfig?: MprMipOperationConfig | null
}
export type ViewHoverPayload = BackendViewHoverRequest
export type ViewHoverResponse = BackendViewHoverResponse

export interface DicomTagItem {
  tag: string
  keyword: string
  name: string
  vr: string
  value: string
  depth: number
}

export interface DicomTagsResponse {
  seriesId: string
  index: number
  total: number
  instanceNumber?: number | null
  sopInstanceUid?: string | null
  filePath?: string | null
  items: DicomTagItem[]
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
  mprCursor?: MprCursorInfo | null
  mprFrame?: MprFrameInfo | null
  viewportPlanes?: Partial<Record<MprViewportKey, MprPlaneInfo | null>>
  viewportCrosshairs?: Partial<Record<MprViewportKey, MprCrosshairInfo | null>>
  viewportScaleBars?: Partial<Record<MprViewportKey, ScaleBarInfo | null>>
  measurements?: MeasurementOverlay[]
  scaleBar?: ScaleBarInfo | null
  annotations?: AnnotationOverlay[]
  cornerInfo: CornerInfo
  viewportCornerInfos?: Partial<Record<MprViewportKey, CornerInfo>>
  viewportMeasurements?: Partial<Record<MprViewportKey, MeasurementOverlay[]>>
  viewportAnnotations?: Partial<Record<MprViewportKey, AnnotationOverlay[]>>
  orientation: OrientationInfo
  viewportOrientations?: Partial<Record<MprViewportKey, OrientationInfo>>
  transformState: ViewTransformInfo
  viewportTransformStates?: Partial<Record<MprViewportKey, ViewTransformInfo>>
  pseudocolorPreset: string
  viewportPseudocolorPresets?: Partial<Record<MprViewportKey, string>>
  mprMipConfig?: MprMipConfig | null
  volumePreset?: string
  volumeRenderConfig?: VolumeRenderConfig | null
  mtfState?: ViewerMtfState | null
  tagIndex?: number
  tagTotal?: number
  tagItems?: DicomTagItem[]
  tagFilePath?: string | null
  tagSopInstanceUid?: string | null
  tagInstanceNumber?: number | null
  tagIsLoading?: boolean
  tagLoadError?: string | null
  fourDPhaseIndex?: number
  fourDPhaseCount?: number
  fourDPhaseItems?: FourDPhaseItem[]
  fourDPlaybackFps?: number
}

export interface ViewerOperationItem {
  value: string
  icon: string
  label: string
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
export type ViewType = 'Stack' | 'MPR' | '3D' | '4D' | 'Tag'
