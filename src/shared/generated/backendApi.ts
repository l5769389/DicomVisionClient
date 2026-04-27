// Generated from DicomVisionServer FastAPI OpenAPI schemas.
// Do not edit by hand. Regenerate with:
//   uv run python scripts/generate_openapi_types.py --output ../DicomVisionClient/src/shared/generated/backendApi.ts


export interface CornerInfoPayload {
  topLeft?: string[]
  topRight?: string[]
  bottomLeft?: string[]
  bottomRight?: string[]
}

export interface CornerInfoRequest {
  seriesId: string
}

export interface CornerInfoResponse {
  cornerInfo: CornerInfoPayload
}

export interface DicomTagItem {
  tag: string
  keyword: string
  name: string
  vr: string
  value: string
  depth?: number
}

export interface DicomTagsRequest {
  seriesId: string
  index?: number
}

export interface DicomTagsResponse {
  seriesId: string
  index: number
  total: number
  instanceNumber?: number | null
  sopInstanceUid?: string | null
  filePath?: string | null
  items?: DicomTagItem[]
}

export interface FourDPhaseItem {
  phaseIndex: number
  label: string
  seriesId?: string | null
  imageSrc?: string
  viewportImages?: Record<string, string>
  status?: 'pending' | 'ready' | 'error'
}

export interface FourDPhasesRequest {
  seriesId: string
}

export interface FourDPhasesResponse {
  seriesId: string
  isFourDSeries?: boolean
  fourDPhaseCount?: number
  fourDPhases?: FourDPhaseItem[]
}

export interface HTTPValidationError {
  detail?: ValidationError[]
}

export interface LoadFolderRequest {
  folderPath: string
}

export interface LoadFolderResponse {
  seriesId?: string | null
  seriesList?: SeriesSummary[]
}

export interface LoadSampleResponse {
  seriesId?: string | null
  seriesList?: SeriesSummary[]
  samplePath: string
}

export interface MeasurementOverlayPayload {
  measurementId: string
  toolType: string
  points: MeasurementPointPayload[]
  labelLines?: string[]
}

export interface MeasurementPointPayload {
  x: number
  y: number
}

export interface MprCrosshairInfo {
  centerX: number
  centerY: number
  hitRadius: number
  horizontalPosition?: number | null
  verticalPosition?: number | null
  horizontalAngleRad?: number | null
  verticalAngleRad?: number | null
}

export interface MprCursorInfo {
  centerWorld: [number, number, number]
  referenceCenterWorld: [number, number, number]
  orientationWorld: [[number, number, number], [number, number, number], [number, number, number]]
  linkedToVolumeRotation?: boolean
}

export interface MprFrameInfo {
  center: [number, number, number]
  axisSlice: [number, number, number]
  axisRow: [number, number, number]
  axisCol: [number, number, number]
}

export interface MprMipConfig {
  enabled?: boolean
  algorithm?: 'maximum' | 'minimum' | 'average' | 'sum'
  viewports?: Record<string, MprMipViewportConfig>
}

export interface MprMipViewportConfig {
  thickness?: number
}

export interface MprPlaneInfo {
  viewport: string
  centerWorld: [number, number, number]
  cursorCenterWorld: [number, number, number]
  rowWorld: [number, number, number]
  colWorld: [number, number, number]
  normalWorld: [number, number, number]
  pixelSpacingRowMm: number
  pixelSpacingColMm: number
  outputShape: [number, number]
  row: [number, number, number]
  col: [number, number, number]
  normal: [number, number, number]
  isOblique: boolean
}

export interface MtfCurvePointPayload {
  frequency: number
  value: number
}

export interface MtfMetricsPayload {
  mtf50?: number | null
  mtf10?: number | null
  fwhmW?: number | null
  fwhmH?: number | null
  peakValue?: number | null
  sampleCount?: number | null
  unit?: string | null
}

export interface OperationAcceptedResponse {
  success?: boolean
  message: string
  viewId: string
}

export interface OrientationInfo {
  top?: string | null
  right?: string | null
  bottom?: string | null
  left?: string | null
  volumeQuaternion?: [number, number, number, number] | null
}

export interface QaWaterAccuracyMetricsPayload {
  centerMean: number
  deviationHu: number
  targetHu?: number
  unit?: string
}

export interface QaWaterMetricsPayload {
  accuracy?: QaWaterAccuracyMetricsPayload | null
  uniformity?: QaWaterUniformityMetricsPayload | null
  noise?: QaWaterNoiseMetricsPayload | null
}

export interface QaWaterNoiseMetricsPayload {
  stdDev: number
  unit?: string
}

export interface QaWaterRoiPayload {
  id: string
  label: string
  kind: 'water' | 'air'
  center: MeasurementPointPayload
  radius: number
}

export interface QaWaterRoiStatsPayload {
  id: string
  label: string
  kind: 'water' | 'air'
  area: number
  width: number
  height: number
  mean: number
  stdDev: number
  sampleCount: number
  deviationFromCenter?: number | null
  sizeUnit: string
  areaUnit: string
  unit?: string
}

export interface QaWaterUniformityMetricsPayload {
  centerMean: number
  maxDeviation: number
  peripheralMeans: number[]
  roiStats?: QaWaterRoiStatsPayload[]
  unit?: string
}

export interface ScaleBarInfo {
  lengthNorm: number
  label: string
}

export interface SeriesSummary {
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
  isFourDSeries?: boolean
  fourDPhaseCount?: number | null
  fourDPhases?: FourDPhaseItem[] | null
}

export interface SliceInfo {
  current: number
  total: number
}

export interface ValidationError {
  loc: (string | number)[]
  msg: string
  type: string
  input?: unknown
  ctx?: Record<string, unknown>
}

export interface ViewCloseRequest {
  viewId: string
}

export interface ViewColorInfo {
  pseudocolorPreset: string
}

export interface ViewCreateRequest {
  seriesId: string
  viewType: 'Stack' | 'MPR' | '3D' | 'AX' | 'COR' | 'SAG'
  viewGroupKey?: string | null
}

export interface ViewCreateResponse {
  viewId: string
}

export interface ViewExportAnnotationOverlayPayload {
  annotationId: string
  toolType: string
  points: ViewExportPointPayload[]
  text?: string
  color?: string
  size?: string
}

export interface ViewExportMeasurementOverlayPayload {
  measurementId: string
  toolType: string
  points: ViewExportPointPayload[]
  labelLines?: string[]
}

export interface ViewExportOverlaysPayload {
  annotations?: ViewExportAnnotationOverlayPayload[]
  measurements?: ViewExportMeasurementOverlayPayload[]
}

export interface ViewExportPointPayload {
  x: number
  y: number
}

export interface ViewExportRequest {
  viewId: string
  exportFormat: 'png' | 'dicom'
  overlays?: ViewExportOverlaysPayload
  overlayMode?: string | null
  preserveSourceDicom?: boolean
}

export interface ViewHoverRequest {
  viewId: string
  x: number
  y: number
}

export interface ViewHoverResponse {
  viewId: string
  row: number
  col: number
}

export interface ViewImageResponse {
  slice_info: SliceInfo
  window_info: WindowInfo
  imageFormat: 'png' | 'jpeg'
  viewId: string
  mpr_crosshair?: MprCrosshairInfo | null
  mprCursor?: MprCursorInfo | null
  mprFrame?: MprFrameInfo | null
  mprPlane?: MprPlaneInfo | null
  scaleBar?: ScaleBarInfo | null
  cornerInfo?: CornerInfoPayload | null
  measurements?: MeasurementOverlayPayload[]
  orientation?: OrientationInfo | null
  transform?: ViewTransformPayload | null
  color?: ViewColorInfo | null
  mprMipConfig?: MprMipConfig | null
  volumePreset?: string | null
  volumeConfig?: VolumeRenderConfig | null
}

export interface ViewMtfAnalyzeRequest {
  viewId: string
  viewportKey: string
  points: MeasurementPointPayload[]
}

export interface ViewMtfAnalyzeResponse {
  viewId: string
  viewportKey: string
  points: MeasurementPointPayload[]
  metrics: MtfMetricsPayload
  curve: MtfCurvePointPayload[]
  isPlaceholder?: boolean
}

export interface ViewOperationRequest {
  viewId: string
  opType: 'scroll' | 'crosshair' | 'pan' | 'zoom' | 'window' | 'pseudocolor' | 'transform2d' | 'rotate3d' | 'reset' | 'volumePreset' | 'volumeConfig' | 'mprMipConfig' | 'mprOblique' | 'mprStateSync' | 'measurement'
  measurementId?: string | null
  viewportKey?: string | null
  subOpType?: string | null
  actionType?: 'start' | 'move' | 'end' | 'delete' | null
  x?: number | null
  y?: number | null
  line?: 'horizontal' | 'vertical' | null
  points?: MeasurementPointPayload[] | null
  zoom?: number | null
  delta?: number | null
  ww?: number | null
  wl?: number | null
  pseudocolorPreset?: string | null
  mprMipConfig?: MprMipConfig | null
  sourceViewId?: string | null
  rotationDegrees?: number | null
  hor_flip?: boolean | null
  ver_flip?: boolean | null
  volumeConfig?: VolumeRenderConfig | null
}

export interface ViewQaWaterAnalyzeRequest {
  viewId: string
  viewportKey: string
  metrics?: string[]
}

export interface ViewQaWaterAnalyzeResponse {
  viewId: string
  viewportKey: string
  rois: QaWaterRoiPayload[]
  metrics?: QaWaterMetricsPayload
  status?: 'ready' | 'error'
  message?: string | null
}

export interface ViewSetSizeRequest {
  opType: 'setSize'
  size: ViewSize
  viewId: string
}

export interface ViewSize {
  width: number
  height: number
}

export interface ViewTransformPayload {
  rotationDegrees?: number
  horFlip?: boolean
  verFlip?: boolean
}

export interface VolumeLayerConfig {
  key: string
  label: string
  enabled?: boolean
  ww: number
  wl: number
  opacity: number
  colorStart: string
  colorEnd: string
}

export interface VolumeLightingConfig {
  shading?: boolean
  interpolation?: 'nearest' | 'linear' | 'cubic'
  ambient?: number
  diffuse?: number
  specular?: number
  roughness?: number
}

export interface VolumeRenderConfig {
  preset: string
  blendMode: 'composite' | 'mip'
  layers: VolumeLayerConfig[]
  lighting?: VolumeLightingConfig
}

export interface WindowInfo {
  ww?: number | null
  wl?: number | null
}

export interface ApiOperations {
  GetCornerInfoApiV1DicomCornerInfoPost: { method: 'POST'; path: '/api/v1/dicom/cornerInfo'; request: CornerInfoRequest; response: CornerInfoResponse }
  GetFourDPhasesApiV1DicomFourDPhasesPost: { method: 'POST'; path: '/api/v1/dicom/fourD/phases'; request: FourDPhasesRequest; response: FourDPhasesResponse }
  LoadFolderApiV1DicomLoadFolderPost: { method: 'POST'; path: '/api/v1/dicom/loadFolder'; request: LoadFolderRequest; response: LoadFolderResponse }
  LoadSampleFolderApiV1DicomLoadSamplePost: { method: 'POST'; path: '/api/v1/dicom/loadSample'; request: never; response: LoadSampleResponse }
  GetDicomTagsApiV1DicomTagsPost: { method: 'POST'; path: '/api/v1/dicom/tags'; request: DicomTagsRequest; response: DicomTagsResponse }
  CloseViewApiV1ViewClosePost: { method: 'POST'; path: '/api/v1/view/close'; request: ViewCloseRequest; response: OperationAcceptedResponse }
  CreateViewApiV1ViewCreatePost: { method: 'POST'; path: '/api/v1/view/create'; request: ViewCreateRequest; response: ViewCreateResponse }
  ExportViewApiV1ViewExportPost: { method: 'POST'; path: '/api/v1/view/export'; request: ViewExportRequest; response: unknown }
  AnalyzeMtfApiV1ViewMtfAnalyzePost: { method: 'POST'; path: '/api/v1/view/mtf/analyze'; request: ViewMtfAnalyzeRequest; response: ViewMtfAnalyzeResponse }
  AnalyzeQaWaterApiV1ViewQaWaterAnalyzePost: { method: 'POST'; path: '/api/v1/view/qa/water/analyze'; request: ViewQaWaterAnalyzeRequest; response: ViewQaWaterAnalyzeResponse }
  SetViewSizeApiV1ViewSetSizePost: { method: 'POST'; path: '/api/v1/view/setSize'; request: ViewSetSizeRequest; response: OperationAcceptedResponse }
  HealthcheckHealthGet: { method: 'GET'; path: '/health'; request: never; response: Record<string, string> }
}
