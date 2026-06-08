import type {
  CornerInfoResponse as BackendCornerInfoResponse,
  LoadFolderResponse as BackendLoadFolderResponse,
  AnnotationOverlayPayload as BackendAnnotationOverlayPayload,
  MeasurementPointPayload as BackendMeasurementPointPayload,
  MprCrosshairInfo as BackendMprCrosshairInfo,
  MprCrosshairMode as BackendMprCrosshairMode,
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
  thumbnailUrl?: string
  isImageSeries?: boolean
  standardObjectType?: string | null
  preferredViewType?: ViewType | string | null
  isFourDSeries?: boolean
  fourDPhaseCount?: number | null
  fourDPhases?: FourDPhaseItem[] | null
}

export function isFourDSeriesItem(
  series: Pick<FolderSeriesItem, 'isFourDSeries' | 'fourDPhaseCount' | 'fourDPhases'> | null | undefined
): boolean {
  return Boolean(series?.isFourDSeries || series?.fourDPhaseCount || series?.fourDPhases?.length)
}

export type LoadFolderResponse = BackendLoadFolderResponse
export type ViewCreateResponse = BackendViewCreateResponse

export type BackendCreateViewType =
  | 'Stack'
  | 'MPR'
  | '3D'
  | 'AX'
  | 'COR'
  | 'SAG'
  | 'FusionCTAxial'
  | 'FusionPETAxial'
  | 'FusionOverlayAxial'
  | 'FusionPETCoronalMip'
export type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

export interface CornerInfo {
  topLeft: string[]
  topRight: string[]
  bottomLeft: string[]
  bottomRight: string[]
  tags?: Record<string, string[]>
}

export type CornerInfoResponse = BackendCornerInfoResponse
export type OperationAcceptedResponse = BackendOperationAcceptedResponse

export interface WorkspaceReadyPayload {
  element: HTMLElement | null
  viewportKey: string
  viewportElements?: Partial<Record<string, HTMLElement | null>>
}

export type MprViewportKey = 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
export type FusionPaneKey = 'fusion-ct-ax' | 'fusion-pet-ax' | 'fusion-overlay-ax' | 'fusion-pet-cor-mip'
export type MprLayoutKey = 'three-columns' | 'right-primary' | 'three-rows' | 'quad' | 'mpr-3d'
export type CompareStackPaneKey = 'compare-a' | 'compare-b'
export type ViewSyncSettingKey = 'scroll' | 'window' | 'pseudocolor' | 'view' | 'transform' | 'reset'
export type CompareSyncSettingKey = ViewSyncSettingKey
export type ViewProgressPhase = 'queued' | 'waiting' | 'volume' | 'normalize' | 'initialize' | 'render' | 'encode' | 'complete'
export type MprCrosshairLineTarget = 'horizontal' | 'vertical'
export type MprCrosshairInteractionMode = 'move' | 'rotate'
export type MeasurementToolType = 'line' | 'rect' | 'ellipse' | 'angle' | 'curve' | 'freeform'
export type AnnotationToolType = 'arrow'
export type AnnotationSize = 'sm' | 'md' | 'lg'
export type MprMipAlgorithm = 'maximum' | 'minimum' | 'average' | 'sum'

export interface ViewProgressInfo {
  viewId: string
  phase: ViewProgressPhase | string
  progressPercent?: number | null
  loadedCount?: number | null
  totalCount?: number | null
  message?: string | null
}

export interface MprCrosshairInteractionPayload {
  viewportKey: string
  phase: 'start' | 'move' | 'end'
  x: number
  y: number
  canvasX?: number
  canvasY?: number
  canvasWidth?: number
  canvasHeight?: number
  mode?: MprCrosshairInteractionMode
  line?: MprCrosshairLineTarget
}

export type MeasurementDraftPoint = BackendMeasurementPointPayload
export type BackendAnnotationOverlay = BackendAnnotationOverlayPayload

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

export interface FusionRegistrationInfo {
  translateRowMm: number
  translateColMm: number
  rotationDegrees: number
  saved?: boolean
}

export interface FusionInfo {
  paneRole: FusionPaneKey | string
  ctSeriesId: string
  petSeriesId: string
  petPseudocolorPreset: string
  alpha: number
  revision: number
  registration: FusionRegistrationInfo
}

export type MprMipOperationConfig = (Partial<Omit<MprMipConfig, 'enabled'>> & { enabled: boolean })

export function createDefaultMprMipConfig(): MprMipConfig {
  return {
    enabled: false,
    algorithm: 'maximum',
    viewports: {
      'mpr-ax': { thickness: 10 },
      'mpr-cor': { thickness: 10 },
      'mpr-sag': { thickness: 10 }
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
    return Math.max(0, Math.min(100, Math.round(numericThickness)))
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

export type FourDPhaseLoadStatus = 'pending' | 'preview' | 'loading' | 'ready' | 'error'

export interface FourDPhaseCacheItem {
  status: FourDPhaseLoadStatus
  viewportImages?: Partial<Record<MprViewportKey, string>>
  viewportSliceLabels?: Partial<Record<MprViewportKey, string>>
  viewportPlanes?: Partial<Record<MprViewportKey, MprPlaneInfo | null>>
  viewportCrosshairs?: Partial<Record<MprViewportKey, MprCrosshairInfo | null>>
  viewportScaleBars?: Partial<Record<MprViewportKey, ScaleBarInfo | null>>
  viewportMeasurements?: Partial<Record<MprViewportKey, MeasurementOverlay[]>>
  viewportCornerInfos?: Partial<Record<MprViewportKey, CornerInfo>>
  viewportOrientations?: Partial<Record<MprViewportKey, OrientationInfo>>
  viewportTransformStates?: Partial<Record<MprViewportKey, ViewTransformInfo>>
  viewportPseudocolorPresets?: Partial<Record<MprViewportKey, string>>
  mprCursor?: MprCursorInfo | null
  mprFrame?: MprFrameInfo | null
  mprRevision?: number | null
  windowLabel?: string
}

export interface FourDPhasesResponse {
  seriesId: string
  isFourDSeries: boolean
  fourDPhaseCount: number
  fourDPhases: FourDPhaseItem[]
}

export interface FourDPlaybackStartRequest {
  tabKey: string
  phaseIndex: number
  phaseCount: number
  fps: number
}

export interface FourDPlaybackStopRequest {
  tabKey: string
}

export interface FourDPlaybackFpsRequest {
  tabKey: string
  fps: number
}

export interface FourDPlaybackPhaseEvent {
  tabKey: string
  phaseIndex: number
}

export interface FourDPlaybackStateEvent {
  tabKey: string
  isPlaying: boolean
  fps?: number | null
  phaseIndex?: number | null
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
export type MprCrosshairMode = BackendMprCrosshairMode
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

export type Render3DMode = 'volume' | 'surface'

export interface SurfaceRenderConfig {
  preset: string
  isoValue: number
  smoothing: number
  decimation: number
  color: string
  ambient: number
  diffuse: number
  specular: number
  roughness: number
}

export interface ViewTransformInfo {
  rotationDegrees: number
  horFlip: boolean
  verFlip: boolean
  zoom?: number | null
  offsetX?: number | null
  offsetY?: number | null
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
  mprRevision?: number | null
  mprPlane?: MprPlaneInfo | null
  mprCursor?: MprCursorInfo | null
  mpr_crosshair?: MprCrosshairInfo | null
  scaleBar?: ScaleBarInfo | null
  measurements?: MeasurementOverlay[]
  annotations?: AnnotationOverlay[]
  cornerInfo?: unknown
  orientation?: unknown
  volumePreset?: string
  volumeConfig?: VolumeRenderConfig | null
  render3dMode?: Render3DMode | null
  surfaceConfig?: SurfaceRenderConfig | null
  transform?: ViewTransformInfo | null
  color?: ViewColorInfo | null
  mprMipConfig?: MprMipOperationConfig | null
  mprCrosshairMode?: MprCrosshairMode | null
  fusionInfo?: FusionInfo | null
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
  tagPath?: string[]
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
  compareSeriesIds?: Record<CompareStackPaneKey, string>
  compareSeriesTitles?: Record<CompareStackPaneKey, string>
  compareViewIds?: Partial<Record<CompareStackPaneKey, string>>
  compareImages?: Partial<Record<CompareStackPaneKey, string>>
  compareSliceLabels?: Partial<Record<CompareStackPaneKey, string>>
  compareWindowLabels?: Partial<Record<CompareStackPaneKey, string>>
  compareScaleBars?: Partial<Record<CompareStackPaneKey, ScaleBarInfo | null>>
  compareCornerInfos?: Partial<Record<CompareStackPaneKey, CornerInfo>>
  compareOrientations?: Partial<Record<CompareStackPaneKey, OrientationInfo>>
  compareTransformStates?: Partial<Record<CompareStackPaneKey, ViewTransformInfo>>
  comparePseudocolorPresets?: Partial<Record<CompareStackPaneKey, string>>
  fusionSeriesIds?: { ctSeriesId: string; petSeriesId: string }
  fusionViewIds?: Partial<Record<FusionPaneKey, string>>
  fusionImages?: Partial<Record<FusionPaneKey, string>>
  fusionSliceLabels?: Partial<Record<FusionPaneKey, string>>
  fusionWindowLabels?: Partial<Record<FusionPaneKey, string>>
  fusionScaleBars?: Partial<Record<FusionPaneKey, ScaleBarInfo | null>>
  fusionCornerInfos?: Partial<Record<FusionPaneKey, CornerInfo>>
  fusionOrientations?: Partial<Record<FusionPaneKey, OrientationInfo>>
  fusionTransformStates?: Partial<Record<FusionPaneKey, ViewTransformInfo>>
  fusionPseudocolorPresets?: Partial<Record<FusionPaneKey, string>>
  fusionInfo?: FusionInfo | null
  fusionManualRegistration?: boolean
  compareSyncScroll?: boolean
  compareSyncWindow?: boolean
  compareSyncPseudocolor?: boolean
  compareSyncView?: boolean
  compareSyncTransform?: boolean
  compareSyncReset?: boolean
  layoutSyncScroll?: boolean
  layoutSyncWindow?: boolean
  layoutSyncPseudocolor?: boolean
  layoutSyncView?: boolean
  layoutSyncTransform?: boolean
  layoutSyncReset?: boolean
  viewportViewIds?: Partial<Record<MprViewportKey, string>>
  viewportImages?: Partial<Record<MprViewportKey, string>>
  viewportLoadingProgress?: Partial<Record<MprViewportKey, ViewProgressInfo | null>>
  viewportSliceLabels?: Partial<Record<MprViewportKey, string>>
  mprCursor?: MprCursorInfo | null
  mprFrame?: MprFrameInfo | null
  viewportPlanes?: Partial<Record<MprViewportKey, MprPlaneInfo | null>>
  viewportCrosshairs?: Partial<Record<MprViewportKey, MprCrosshairInfo | null>>
  mprRevision?: number | null
  viewportScaleBars?: Partial<Record<MprViewportKey, ScaleBarInfo | null>>
  measurements?: MeasurementOverlay[]
  scaleBar?: ScaleBarInfo | null
  annotations?: AnnotationOverlay[]
  cornerInfo: CornerInfo
  showCornerInfo?: boolean
  showScaleBar?: boolean
  viewportCornerInfos?: Partial<Record<MprViewportKey, CornerInfo>>
  viewportMeasurements?: Partial<Record<string, MeasurementOverlay[]>>
  viewportAnnotations?: Partial<Record<string, AnnotationOverlay[]>>
  orientation: OrientationInfo
  viewportOrientations?: Partial<Record<MprViewportKey, OrientationInfo>>
  transformState: ViewTransformInfo
  viewportTransformStates?: Partial<Record<MprViewportKey, ViewTransformInfo>>
  pseudocolorPreset: string
  viewportPseudocolorPresets?: Partial<Record<MprViewportKey, string>>
  mprMipConfig?: MprMipConfig | null
  mprCrosshairMode?: MprCrosshairMode
  volumePreset?: string
  volumeRenderConfig?: VolumeRenderConfig | null
  render3dMode?: Render3DMode
  surfaceRenderConfig?: SurfaceRenderConfig | null
  mtfState?: ViewerMtfState | null
  tagIndex?: number
  tagTotal?: number
  tagItems?: DicomTagItem[]
  tagFilePath?: string | null
  tagSopInstanceUid?: string | null
  tagInstanceNumber?: number | null
  tagIsLoading?: boolean
  tagLoadError?: string | null
  layoutTemplate?: ViewerLayoutTemplate | null
  layoutSlots?: ViewerLayoutSlot[]
  fourDPhaseIndex?: number
  fourDPhaseCount?: number
  fourDPhaseItems?: FourDPhaseItem[]
  fourDPlaybackFps?: number
  fourDPhaseViewIds?: Record<string, Partial<Record<MprViewportKey, string>>>
  fourDPhaseCache?: Record<string, FourDPhaseCacheItem>
  fourDIsPlaying?: boolean
  fourDIsPreloading?: boolean
  loadingProgress?: ViewProgressInfo | null
}

export type StackViewerTabItem = ViewerTabItem & { viewType: 'Stack' }
export type CompareStackViewerTabItem = ViewerTabItem & { viewType: 'CompareStack' }
export type MprViewerTabItem = ViewerTabItem & { viewType: 'MPR' }
export type VolumeViewerTabItem = ViewerTabItem & { viewType: '3D' }
export type FourDViewerTabItem = ViewerTabItem & { viewType: '4D' }
export type PetCtFusionViewerTabItem = ViewerTabItem & { viewType: 'PETCTFusion' }
export type TagViewerTabItem = ViewerTabItem & { viewType: 'Tag' }
export type LayoutViewerTabItem = ViewerTabItem & { viewType: 'Layout' }

export type DiscriminatedViewerTabItem =
  | StackViewerTabItem
  | CompareStackViewerTabItem
  | MprViewerTabItem
  | VolumeViewerTabItem
  | FourDViewerTabItem
  | PetCtFusionViewerTabItem
  | TagViewerTabItem
  | LayoutViewerTabItem

export function isCompareStackViewerTab(tab: ViewerTabItem | null | undefined): tab is CompareStackViewerTabItem {
  return tab?.viewType === 'CompareStack'
}

export function isLayoutViewerTab(tab: ViewerTabItem | null | undefined): tab is LayoutViewerTabItem {
  return tab?.viewType === 'Layout'
}

export function isMprViewerTab(tab: ViewerTabItem | null | undefined): tab is MprViewerTabItem {
  return tab?.viewType === 'MPR'
}

export function isStackViewerTab(tab: ViewerTabItem | null | undefined): tab is StackViewerTabItem {
  return tab?.viewType === 'Stack'
}

export interface ViewerOperationItem {
  value: string
  icon: string
  label: string
}

export interface ViewerLayoutSlot {
  id: string
  row: number
  column: number
  rowSpan: number
  columnSpan: number
  seriesId?: string | null
  seriesTitle?: string | null
  viewType?: ViewType | null
  sourceViewType?: ViewType | null
  viewportKey?: string | null
  viewId?: string | null
  imageSrc?: string | null
  ownsImageSrc?: boolean
  sliceLabel?: string | null
  windowLabel?: string | null
  cornerInfo?: CornerInfo | null
  orientation?: OrientationInfo | null
  scaleBar?: ScaleBarInfo | null
  transformState?: ViewTransformInfo | null
  pseudocolorPreset?: string | null
}

export interface ViewerLayoutTemplate {
  key: string
  label: string
  rows: number
  columns: number
  slots: ViewerLayoutSlot[]
  source: 'preset' | 'custom'
}

export type ConnectionState = 'idle' | 'starting' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
export type ViewType = 'Stack' | 'CompareStack' | 'MPR' | '3D' | '4D' | 'PETCTFusion' | 'Tag' | 'Layout'
