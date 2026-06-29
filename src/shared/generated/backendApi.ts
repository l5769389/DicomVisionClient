// Generated from DicomVisionServer FastAPI OpenAPI schemas.
// Do not edit by hand. Regenerate with:
//   uv run python scripts/generate_openapi_types.py --output ../DicomVisionClient/src/shared/generated/backendApi.ts


export interface AnnotationOverlayPayload {
  annotationId: string
  toolType: string
  points: MeasurementPointPayload[]
  text?: string
  color?: string
  size?: string
  scope?: 'image' | 'series'
  sliceIndex?: number | null
}

export interface Body_upload_dicom_files_api_v1_dicom_upload_post {
  files: string[]
  relativePaths?: string[] | null
}

export interface CornerInfoPayload {
  topLeft?: string[]
  topRight?: string[]
  bottomLeft?: string[]
  bottomRight?: string[]
  tags?: Record<string, string[]>
}

export interface CornerInfoRequest {
  seriesId: string
}

export interface CornerInfoResponse {
  cornerInfo: CornerInfoPayload
}

export interface DicomCompatibilityIssue {
  code: string
  severity?: 'info' | 'warning' | 'error'
  title: string
  detail?: string | null
  affectedInstances?: number
}

export interface DicomCompatibilityRequest {
  seriesId: string
}

export interface DicomCompatibilityResponse {
  seriesId: string
  issues?: DicomCompatibilityIssue[]
}

export interface DicomDeidentifyRequest {
  seriesId: string
  fieldKeys?: ('patientIdentity' | 'patientDemographics' | 'datesAndTimes' | 'accessionInstitution' | 'physiciansOperators' | 'descriptions' | 'deviceInfo' | 'privateTags' | 'uids')[]
  replacementPrefix?: string
}

export interface DicomTagItem {
  tag: string
  keyword: string
  name: string
  vr: string
  value: string
  depth?: number
  tagPath?: string[]
}

export interface DicomTagModifyJobStatusResponse {
  jobId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  statusUrl: string
  artifactUrl?: string | null
  error?: string | null
  artifactKind?: 'dicom' | 'zip' | null
  fileName?: string | null
  mediaType?: string | null
  modifiedCount?: number | null
  processedCount?: number
  progressPercent?: number
  seriesFolder?: string | null
  totalCount?: number
  createdAt: string
  completedAt?: string | null
}

export interface DicomTagModifyRequest {
  seriesId: string
  index?: number
  tagPath: string[]
  value: string
  scope?: 'current' | 'series'
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
  includePreviewImages?: boolean
  previewPhaseIndex?: number | null
}

export interface FourDPhasesResponse {
  seriesId: string
  isFourDSeries?: boolean
  fourDPhaseCount?: number
  fourDPhases?: FourDPhaseItem[]
}

export interface FourDPlaybackFpsRequest {
  tabKey: string
  fps: number
}

export interface FourDPlaybackPhaseEvent {
  tabKey: string
  phaseIndex: number
}

export interface FourDPlaybackStartRequest {
  tabKey: string
  phaseIndex: number
  phaseCount: number
  fps: number
}

export interface FourDPlaybackStateEvent {
  tabKey: string
  isPlaying: boolean
  fps?: number | null
  phaseIndex?: number | null
}

export interface FourDPlaybackStopRequest {
  tabKey: string
}

export interface FusionCompositeInfo {
  mode?: string
  revision: number
  alpha: number
  registration: FusionRegistrationInfo
  width: number
  height: number
  layers: FusionCompositeLayerInfo[]
  primaryImageUnchanged?: boolean
}

export interface FusionCompositeLayerInfo {
  key: string
  role: string
  imageFormat?: string
}

export interface FusionInfo {
  paneRole: string
  ctSeriesId: string
  petSeriesId: string
  petPseudocolorPreset: string
  petUnit?: string
  petUnitLabel?: string
  petWindowMin?: number | null
  petWindowMax?: number | null
  alpha: number
  revision: number
  registration: FusionRegistrationInfo
}

export interface FusionProjectionInfo {
  paneRole: string
  referenceWorld: [number, number, number]
  referenceX: number
  referenceY: number
  normalizedToWorldOrigin: [number, number, number]
  normalizedToWorldX: [number, number, number]
  normalizedToWorldY: [number, number, number]
  worldToNormalizedX: [number, number, number, number]
  worldToNormalizedY: [number, number, number, number]
}

export interface FusionRegistrationArtifactExportRequest {
  viewId: string
  mode: 'newDicom' | 'br'
  seriesDescription?: string | null
}

export interface FusionRegistrationExportRequest {
  viewId: string
  mode: 'newDicom' | 'br'
  seriesDescription?: string | null
  outputDirectory: string
}

export interface FusionRegistrationExportResponse {
  mode: 'newDicom' | 'br'
  directoryPath: string
  filePath?: string | null
  fileCount: number
  seriesDescription: string
  petUnit: string
  petUnitLabel: string
}

export interface FusionRegistrationInfo {
  translateRowMm?: number
  translateColMm?: number
  rotationDegrees?: number
  saved?: boolean
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
  scope?: 'image' | 'series'
  sliceIndex?: number | null
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
  horizontalSlabOffsetX?: number | null
  horizontalSlabOffsetY?: number | null
  verticalSlabOffsetX?: number | null
  verticalSlabOffsetY?: number | null
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
  pixelSpacingNormalMm?: number
  outputShape: [number, number]
  row: [number, number, number]
  col: [number, number, number]
  normal: [number, number, number]
  imageToCanvasMatrix?: [[number, number, number], [number, number, number], [number, number, number]] | null
  isOblique: boolean
}

export interface MprSegmentationConfig {
  enabled?: boolean
  clientRevision?: number
  selectedRegionId?: string | null
  selectedVoi?: boolean
  selectedVoiId?: string | null
  thresholdRegions?: MprThresholdRegion[]
  voiSpheres?: MprVoiSphere[]
  voiSphere?: MprVoiSphere | null
  lowerHu?: number | null
  upperHu?: number | null
  opacity?: number
  color?: string
  voiBox?: MprSegmentationVoiBox | null
}

export interface MprSegmentationOverlay {
  regions?: MprSegmentationOverlayRegion[]
}

export interface MprSegmentationOverlayRect {
  xMin?: number
  yMin?: number
  xMax?: number
  yMax?: number
}

export interface MprSegmentationOverlayRegion {
  regionId: string
  visible?: boolean
  rect?: MprSegmentationOverlayRect | null
  sampleRevision?: number
  samples?: MprSegmentationOverlaySamples | null
}

export interface MprSegmentationOverlaySamples {
  points?: number[]
  totalCount?: number
  sampledCount?: number
}

export interface MprSegmentationVoiBox {
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  zMin?: number
  zMax?: number
}

export interface MprThresholdRegion {
  id: string
  enabled?: boolean
  label?: string
  thresholdHu?: number
  thresholdMode?: string
  thresholdPercentile?: number
  color?: string
  box: MprThresholdRegionBox
  stats?: MprThresholdRegionStats | null
}

export interface MprThresholdRegionBox {
  centerWorld: [number, number, number]
  rowWorld: [number, number, number]
  colWorld: [number, number, number]
  normalWorld: [number, number, number]
  widthMm?: number
  heightMm?: number
  depthMm?: number
  sourceViewport?: string
}

export interface MprThresholdRegionStats {
  huMean?: number | null
  huMin?: number | null
  huMax?: number | null
  huStdDev?: number | null
  volumeCm3?: number
  sampleCount?: number
  effectiveThresholdHu?: number | null
}

export interface MprVoiSphere {
  id?: string | null
  label?: string
  enabled?: boolean
  centerWorld: [number, number, number]
  radiusMm?: number
  color?: string
  stats?: MprVoiSphereStats | null
}

export interface MprVoiSphereStats {
  huMean?: number | null
  huMin?: number | null
  huMax?: number | null
  huStdDev?: number | null
  volumeCm3?: number
  sampleCount?: number
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

export interface PacsDicomwebProfile {
  id: string
  name: string
  baseUrl: string
  qidoPath?: string
  wadoPath?: string
  authType?: 'none' | 'basic' | 'bearer'
  username?: string | null
  password?: string | null
  bearerToken?: string | null
  timeoutSeconds?: number
  preset?: 'orthanc' | 'dcm4chee' | 'custom'
}

export interface PacsDicomwebTestRequest {
  profile: PacsDicomwebProfile
}

export interface PacsDicomwebTestResponse {
  ok: boolean
  statusCode?: number | null
  message: string
}

export interface PacsDimseProfile {
  id: string
  name: string
  host: string
  port?: number
  calledAeTitle?: string
  clientAeTitle?: string
  queryModel?: 'study-root' | 'patient-root'
  timeoutSeconds?: number
}

export interface PacsDimseSeriesDownloadJobStatusResponse {
  jobId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  statusUrl: string
  error?: string | null
  folderPath?: string | null
  processedCount?: number
  progressPercent?: number
  seriesId?: string | null
  seriesList?: SeriesSummary[]
  totalCount?: number
  createdAt: string
  completedAt?: string | null
}

export interface PacsDimseSeriesDownloadRequest {
  profile: PacsDimseProfile
  studyInstanceUid: string
  seriesInstanceUid: string
}

export interface PacsDimseSeriesQueryRequest {
  profile: PacsDimseProfile
  studyInstanceUid: string
  seriesInstanceUid?: string | null
  modality?: string | null
  seriesDescription?: string | null
  bodyPartExamined?: string | null
  limit?: number
  offset?: number
}

export interface PacsDimseStudyQueryRequest {
  profile: PacsDimseProfile
  studyInstanceUid?: string | null
  patientId?: string | null
  patientName?: string | null
  accessionNumber?: string | null
  studyDescription?: string | null
  studyDateFrom?: string | null
  studyDateTo?: string | null
  modality?: string | null
  limit?: number
  offset?: number
}

export interface PacsDimseTestRequest {
  profile: PacsDimseProfile
}

export interface PacsQidoSeriesQueryRequest {
  profile: PacsDicomwebProfile
  studyInstanceUid: string
  seriesInstanceUid?: string | null
  modality?: string | null
  seriesDescription?: string | null
  bodyPartExamined?: string | null
  limit?: number
  offset?: number
}

export interface PacsQidoSeriesQueryResponse {
  items?: PacsSeriesItem[]
}

export interface PacsQidoStudyQueryRequest {
  profile: PacsDicomwebProfile
  studyInstanceUid?: string | null
  patientId?: string | null
  patientName?: string | null
  accessionNumber?: string | null
  studyDescription?: string | null
  studyDateFrom?: string | null
  studyDateTo?: string | null
  modality?: string | null
  limit?: number
  offset?: number
}

export interface PacsQidoStudyQueryResponse {
  items?: PacsStudyItem[]
}

export interface PacsSeriesItem {
  studyInstanceUid: string
  seriesInstanceUid: string
  seriesNumber?: string | null
  modality?: string | null
  seriesDescription?: string | null
  bodyPartExamined?: string | null
  numberOfSeriesRelatedInstances?: number | null
  raw?: Record<string, unknown>
}

export interface PacsSeriesPreviewRequest {
  profile: PacsDicomwebProfile
  studyInstanceUid: string
  seriesInstanceUid: string
  thumbnail?: boolean
}

export interface PacsSeriesPreviewResponse {
  studyInstanceUid: string
  seriesInstanceUid: string
  instanceCount?: number
  rows?: number | null
  columns?: number | null
  numberOfFrames?: number | null
  hasMultiFrameInstances?: boolean
  transferSyntaxes?: string[]
  isCompressed?: boolean
  photometricInterpretations?: string[]
  sopInstanceUid?: string | null
  thumbnailSrc?: string | null
  thumbnailError?: string | null
}

export interface PacsStudyItem {
  studyInstanceUid: string
  patientName?: string | null
  patientId?: string | null
  studyDate?: string | null
  studyTime?: string | null
  accessionNumber?: string | null
  studyDescription?: string | null
  modalitiesInStudy?: string[]
  numberOfStudyRelatedSeries?: number | null
  numberOfStudyRelatedInstances?: number | null
  raw?: Record<string, unknown>
}

export interface PacsWadoSeriesDownloadJobStatusResponse {
  jobId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  statusUrl: string
  error?: string | null
  folderPath?: string | null
  processedCount?: number
  progressPercent?: number
  seriesId?: string | null
  seriesList?: SeriesSummary[]
  totalCount?: number
  createdAt: string
  completedAt?: string | null
}

export interface PacsWadoSeriesDownloadRequest {
  profile: PacsDicomwebProfile
  studyInstanceUid: string
  seriesInstanceUid: string
}

export interface PetInfo {
  seriesId: string
  petUnit?: string
  petUnitLabel?: string
  petWindowMin?: number | null
  petWindowMax?: number | null
  pseudocolorPreset?: string
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
  patientName?: string | null
  studyDate?: string | null
  studyDescription?: string | null
  accessionNumber?: string | null
  modality?: string | null
  seriesDescription?: string | null
  instanceCount: number
  width?: number | null
  height?: number | null
  thumbnailSrc?: string
  thumbnailUrl?: string
  folderPath: string
  isImageSeries?: boolean
  standardObjectType?: string | null
  preferredViewType?: string | null
  isFourDSeries?: boolean
  fourDPhaseCount?: number | null
  fourDPhases?: FourDPhaseItem[] | null
  compatibilityIssues?: DicomCompatibilityIssue[]
}

export interface SliceInfo {
  current: number
  total: number
}

export interface SurfaceRenderConfig {
  preset?: string
  isoValue?: number
  smoothing?: number
  decimation?: number
  color?: string
  ambient?: number
  diffuse?: number
  specular?: number
  roughness?: number
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
  viewType: 'Stack' | 'MPR' | '3D' | 'PET' | 'AX' | 'COR' | 'SAG' | 'FusionCTAxial' | 'FusionPETAxial' | 'FusionOverlayAxial' | 'FusionPETCoronalMip'
  secondarySeriesId?: string | null
  fusionPaneRole?: string | null
  viewGroupKey?: string | null
  fourDPhaseIndex?: number | null
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
  exportFormat: 'png' | 'dicom' | 'dicom-sr' | 'dicom-gsps'
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
  imageFormat: 'png' | 'jpeg' | 'webp'
  viewId: string
  mpr_crosshair?: MprCrosshairInfo | null
  mprCursor?: MprCursorInfo | null
  mprFrame?: MprFrameInfo | null
  mprRevision?: number | null
  mprPlane?: MprPlaneInfo | null
  scaleBar?: ScaleBarInfo | null
  cornerInfo?: CornerInfoPayload | null
  measurements?: MeasurementOverlayPayload[]
  annotations?: AnnotationOverlayPayload[]
  orientation?: OrientationInfo | null
  transform?: ViewTransformPayload | null
  color?: ViewColorInfo | null
  petInfo?: PetInfo | null
  fusionInfo?: FusionInfo | null
  fusionComposite?: FusionCompositeInfo | null
  fusionProjection?: FusionProjectionInfo | null
  mprMipConfig?: MprMipConfig | null
  mprSegmentationConfig?: MprSegmentationConfig | null
  mprSegmentationOverlay?: MprSegmentationOverlay | null
  mprCrosshairMode?: 'orthogonal' | 'double-oblique'
  volumePreset?: string | null
  volumeConfig?: VolumeRenderConfig | null
  render3dMode?: 'volume' | 'surface' | null
  surfaceConfig?: SurfaceRenderConfig | null
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
  opType: 'scroll' | 'crosshair' | 'pan' | 'zoom' | 'window' | 'pseudocolor' | 'transform2d' | 'rotate3d' | 'reset' | 'volumePreset' | 'volumeConfig' | 'render3dMode' | 'surfaceConfig' | 'mprMipConfig' | 'mprSegmentation' | 'mprOblique' | 'mprCrosshairMode' | 'mprStateSync' | 'measurement' | 'annotation' | 'fusionRegistration' | 'fusionConfig' | 'petConfig'
  imageFormat?: 'png' | 'jpeg' | 'webp'
  measurementId?: string | null
  annotationId?: string | null
  viewportKey?: string | null
  subOpType?: string | null
  actionType?: 'start' | 'move' | 'end' | 'delete' | null
  x?: number | null
  y?: number | null
  anchorX?: number | null
  anchorY?: number | null
  currentX?: number | null
  currentY?: number | null
  pivotX?: number | null
  pivotY?: number | null
  rotationDeltaDegrees?: number | null
  line?: 'horizontal' | 'vertical' | null
  points?: MeasurementPointPayload[] | null
  zoom?: number | null
  delta?: number | null
  ww?: number | null
  wl?: number | null
  pseudocolorPreset?: string | null
  fusionAlpha?: number | null
  fusionManualRegistration?: boolean | null
  fusionPetUnit?: string | null
  fusionPetWindowMin?: number | null
  fusionPetWindowMax?: number | null
  petUnit?: string | null
  petWindowMin?: number | null
  petWindowMax?: number | null
  fusionRegistrationFile?: Record<string, unknown> | null
  mprMipConfig?: MprMipConfig | null
  mprSegmentationConfig?: MprSegmentationConfig | null
  mprCrosshairMode?: 'orthogonal' | 'double-oblique' | null
  toolType?: string | null
  text?: string | null
  color?: string | null
  size?: string | null
  scope?: 'image' | 'series' | null
  sliceIndex?: number | null
  sourceViewId?: string | null
  rotationDegrees?: number | null
  hor_flip?: boolean | null
  ver_flip?: boolean | null
  volumeConfig?: VolumeRenderConfig | null
  render3dMode?: 'volume' | 'surface' | null
  surfaceConfig?: SurfaceRenderConfig | null
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
  imageFormat?: 'png' | 'jpeg' | 'webp'
}

export interface ViewSize {
  width: number
  height: number
}

export interface ViewTransformPayload {
  rotationDegrees?: number
  horFlip?: boolean
  verFlip?: boolean
  zoom?: number
  offsetX?: number
  offsetY?: number
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
  CheckDicomCompatibilityApiV1DicomCompatibilityPost: { method: 'POST'; path: '/api/v1/dicom/compatibility'; request: DicomCompatibilityRequest; response: DicomCompatibilityResponse }
  GetCornerInfoApiV1DicomCornerInfoPost: { method: 'POST'; path: '/api/v1/dicom/cornerInfo'; request: CornerInfoRequest; response: CornerInfoResponse }
  DeidentifyDicomSeriesApiV1DicomDeidentifyPost: { method: 'POST'; path: '/api/v1/dicom/deidentify'; request: DicomDeidentifyRequest; response: unknown }
  CreateDeidentifyDicomSeriesJobApiV1DicomDeidentifyJobsPost: { method: 'POST'; path: '/api/v1/dicom/deidentify/jobs'; request: DicomDeidentifyRequest; response: unknown }
  GetDeidentifyDicomSeriesJobApiV1DicomDeidentifyJobsJobIdGet: { method: 'GET'; path: '/api/v1/dicom/deidentify/jobs/{job_id}'; request: never; response: DicomTagModifyJobStatusResponse }
  GetDeidentifyDicomSeriesJobArtifactApiV1DicomDeidentifyJobsJobIdArtifactGet: { method: 'GET'; path: '/api/v1/dicom/deidentify/jobs/{job_id}/artifact'; request: never; response: unknown }
  GetFourDPhasesApiV1DicomFourDPhasesPost: { method: 'POST'; path: '/api/v1/dicom/fourD/phases'; request: FourDPhasesRequest; response: FourDPhasesResponse }
  GetFourDPreviewApiV1DicomFourDPreviewGet: { method: 'GET'; path: '/api/v1/dicom/fourD/preview'; request: never; response: unknown }
  LoadFolderApiV1DicomLoadFolderPost: { method: 'POST'; path: '/api/v1/dicom/loadFolder'; request: LoadFolderRequest; response: LoadFolderResponse }
  LoadSampleFolderApiV1DicomLoadSamplePost: { method: 'POST'; path: '/api/v1/dicom/loadSample'; request: never; response: LoadSampleResponse }
  ModifyDicomTagApiV1DicomModifyTagPost: { method: 'POST'; path: '/api/v1/dicom/modifyTag'; request: DicomTagModifyRequest; response: unknown }
  CreateModifyDicomTagJobApiV1DicomModifyTagJobsPost: { method: 'POST'; path: '/api/v1/dicom/modifyTag/jobs'; request: DicomTagModifyRequest; response: unknown }
  GetModifyDicomTagJobApiV1DicomModifyTagJobsJobIdGet: { method: 'GET'; path: '/api/v1/dicom/modifyTag/jobs/{job_id}'; request: never; response: DicomTagModifyJobStatusResponse }
  GetModifyDicomTagJobArtifactApiV1DicomModifyTagJobsJobIdArtifactGet: { method: 'GET'; path: '/api/v1/dicom/modifyTag/jobs/{job_id}/artifact'; request: never; response: unknown }
  GetDicomTagsApiV1DicomTagsPost: { method: 'POST'; path: '/api/v1/dicom/tags'; request: DicomTagsRequest; response: DicomTagsResponse }
  GetSeriesThumbnailApiV1DicomThumbnailGet: { method: 'GET'; path: '/api/v1/dicom/thumbnail'; request: never; response: unknown }
  UploadDicomFilesApiV1DicomUploadPost: { method: 'POST'; path: '/api/v1/dicom/upload'; request: never; response: LoadFolderResponse }
  CreateDicomwebSeriesDownloadJobApiV1PacsDicomwebDownloadSeriesJobsPost: { method: 'POST'; path: '/api/v1/pacs/dicomweb/downloadSeries/jobs'; request: PacsWadoSeriesDownloadRequest; response: PacsWadoSeriesDownloadJobStatusResponse }
  GetDicomwebSeriesDownloadJobApiV1PacsDicomwebDownloadSeriesJobsJobIdGet: { method: 'GET'; path: '/api/v1/pacs/dicomweb/downloadSeries/jobs/{job_id}'; request: never; response: PacsWadoSeriesDownloadJobStatusResponse }
  CancelDicomwebSeriesDownloadJobApiV1PacsDicomwebDownloadSeriesJobsJobIdCancelPost: { method: 'POST'; path: '/api/v1/pacs/dicomweb/downloadSeries/jobs/{job_id}/cancel'; request: never; response: PacsWadoSeriesDownloadJobStatusResponse }
  QueryDicomwebSeriesApiV1PacsDicomwebSeriesPost: { method: 'POST'; path: '/api/v1/pacs/dicomweb/series'; request: PacsQidoSeriesQueryRequest; response: PacsQidoSeriesQueryResponse }
  PreviewDicomwebSeriesApiV1PacsDicomwebSeriesPreviewPost: { method: 'POST'; path: '/api/v1/pacs/dicomweb/seriesPreview'; request: PacsSeriesPreviewRequest; response: PacsSeriesPreviewResponse }
  QueryDicomwebStudiesApiV1PacsDicomwebStudiesPost: { method: 'POST'; path: '/api/v1/pacs/dicomweb/studies'; request: PacsQidoStudyQueryRequest; response: PacsQidoStudyQueryResponse }
  TestDicomwebConnectionApiV1PacsDicomwebTestPost: { method: 'POST'; path: '/api/v1/pacs/dicomweb/test'; request: PacsDicomwebTestRequest; response: PacsDicomwebTestResponse }
  CreateDimseSeriesDownloadJobApiV1PacsDimseDownloadSeriesJobsPost: { method: 'POST'; path: '/api/v1/pacs/dimse/downloadSeries/jobs'; request: PacsDimseSeriesDownloadRequest; response: PacsDimseSeriesDownloadJobStatusResponse }
  GetDimseSeriesDownloadJobApiV1PacsDimseDownloadSeriesJobsJobIdGet: { method: 'GET'; path: '/api/v1/pacs/dimse/downloadSeries/jobs/{job_id}'; request: never; response: PacsDimseSeriesDownloadJobStatusResponse }
  CancelDimseSeriesDownloadJobApiV1PacsDimseDownloadSeriesJobsJobIdCancelPost: { method: 'POST'; path: '/api/v1/pacs/dimse/downloadSeries/jobs/{job_id}/cancel'; request: never; response: PacsDimseSeriesDownloadJobStatusResponse }
  QueryDimseSeriesApiV1PacsDimseSeriesPost: { method: 'POST'; path: '/api/v1/pacs/dimse/series'; request: PacsDimseSeriesQueryRequest; response: PacsQidoSeriesQueryResponse }
  QueryDimseStudiesApiV1PacsDimseStudiesPost: { method: 'POST'; path: '/api/v1/pacs/dimse/studies'; request: PacsDimseStudyQueryRequest; response: PacsQidoStudyQueryResponse }
  TestDimseConnectionApiV1PacsDimseTestPost: { method: 'POST'; path: '/api/v1/pacs/dimse/test'; request: PacsDimseTestRequest; response: PacsDicomwebTestResponse }
  CloseViewApiV1ViewClosePost: { method: 'POST'; path: '/api/v1/view/close'; request: ViewCloseRequest; response: OperationAcceptedResponse }
  CreateViewApiV1ViewCreatePost: { method: 'POST'; path: '/api/v1/view/create'; request: ViewCreateRequest; response: ViewCreateResponse }
  ExportViewApiV1ViewExportPost: { method: 'POST'; path: '/api/v1/view/export'; request: ViewExportRequest; response: unknown }
  ExportFusionRegistrationApiV1ViewFusionRegistrationExportPost: { method: 'POST'; path: '/api/v1/view/fusion/registration/export'; request: FusionRegistrationExportRequest; response: FusionRegistrationExportResponse }
  ExportFusionRegistrationArtifactApiV1ViewFusionRegistrationExportArtifactPost: { method: 'POST'; path: '/api/v1/view/fusion/registration/export/artifact'; request: FusionRegistrationArtifactExportRequest; response: unknown }
  AnalyzeMtfApiV1ViewMtfAnalyzePost: { method: 'POST'; path: '/api/v1/view/mtf/analyze'; request: ViewMtfAnalyzeRequest; response: ViewMtfAnalyzeResponse }
  AnalyzeQaWaterApiV1ViewQaWaterAnalyzePost: { method: 'POST'; path: '/api/v1/view/qa/water/analyze'; request: ViewQaWaterAnalyzeRequest; response: ViewQaWaterAnalyzeResponse }
  SetViewSizeApiV1ViewSetSizePost: { method: 'POST'; path: '/api/v1/view/setSize'; request: ViewSetSizeRequest; response: OperationAcceptedResponse }
  ReleaseWorkspaceApiV1WorkspaceReleasePost: { method: 'POST'; path: '/api/v1/workspace/release'; request: never; response: Record<string, unknown> }
  GetWorkspaceStatsApiV1WorkspaceStatsGet: { method: 'GET'; path: '/api/v1/workspace/stats'; request: never; response: Record<string, unknown> }
  HealthcheckHealthGet: { method: 'GET'; path: '/health'; request: never; response: Record<string, string> }
}
