import type {
  CornerInfoResponse as BackendCornerInfoResponse,
  LoadFolderResponse as BackendLoadFolderResponse,
  AnnotationOverlayPayload as BackendAnnotationOverlayPayload,
  MeasurementPointPayload as BackendMeasurementPointPayload,
  MprCrosshairInfo as BackendMprCrosshairInfo,
  MprCursorInfo as BackendMprCursorInfo,
  MprFrameInfo as BackendMprFrameInfo,
  MprSegmentationConfig as BackendMprSegmentationConfig,
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
  | 'PET'
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
export type ViewProgressPhase = 'queued' | 'waiting' | 'volume' | 'normalize' | 'preprocess' | 'initialize' | 'render' | 'encode' | 'complete'
export type MprCrosshairLineTarget = 'horizontal' | 'vertical'
export type MprCrosshairInteractionMode = 'move' | 'rotate'
export type MeasurementToolType =
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'angle'
  | 'curve'
  | 'freeform'
  | 'alignment-horizontal'
  | 'alignment-vertical'
export type DrawingScope = 'image' | 'series'
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
  scope?: DrawingScope
  sliceIndex?: number | null
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
  scope?: DrawingScope
  sliceIndex?: number | null
}

export interface AnnotationDraft {
  annotationId?: string
  toolType: AnnotationToolType
  points: MeasurementDraftPoint[]
  text: string
  color: string
  size: AnnotationSize
  scope?: DrawingScope
  sliceIndex?: number | null
}

export interface AnnotationOverlay {
  annotationId: string
  toolType: AnnotationToolType
  points: MeasurementDraftPoint[]
  text: string
  color: string
  size: AnnotationSize
  scope?: DrawingScope
  sliceIndex?: number | null
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
  petUnit?: string
  petUnitLabel?: string
  petWindowMin?: number | null
  petWindowMax?: number | null
  alpha: number
  revision: number
  registration: FusionRegistrationInfo
}

export type ViewerImageTransportFormat = 'png' | 'jpeg' | 'webp'

export interface FusionCompositeLayerInfo {
  key: string
  role: 'ct' | 'pet' | string
  imageFormat?: 'png' | 'jpeg' | string
}

export interface FusionCompositeInfo {
  mode: 'ctPetLayers' | string
  revision: number
  alpha: number
  registration: FusionRegistrationInfo
  width: number
  height: number
  layers: FusionCompositeLayerInfo[]
  primaryImageUnchanged?: boolean
}

export interface FusionLayerImages {
  ct?: string
  pet?: string
  revision?: number | null
  width?: number
  height?: number
}

export interface ViewerImageLayer {
  key: string
  src: string
  alt?: string
  class?: string | string[] | Record<string, boolean>
  style?: Record<string, string>
}

export interface PetInfo {
  seriesId: string
  petUnit?: string
  petUnitLabel?: string
  petWindowMin?: number | null
  petWindowMax?: number | null
  pseudocolorPreset?: string
}

export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export interface FusionProjectionInfo {
  paneRole: FusionPaneKey | string
  referenceWorld: Vec3
  referenceX: number
  referenceY: number
  normalizedToWorldOrigin: Vec3
  normalizedToWorldX: Vec3
  normalizedToWorldY: Vec3
  worldToNormalizedX: Vec4
  worldToNormalizedY: Vec4
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

export interface MprSegmentationVoiBox {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  zMin: number
  zMax: number
}

export interface MprThresholdRegionStats {
  huMean: number | null
  huMin: number | null
  huMax: number | null
  huStdDev: number | null
  volumeCm3: number
  sampleCount: number
  effectiveThresholdHu: number | null
}

export interface MprThresholdRegionBox {
  centerWorld: Vec3
  rowWorld: Vec3
  colWorld: Vec3
  normalWorld: Vec3
  widthMm: number
  heightMm: number
  depthMm: number
  sourceViewport: MprViewportKey
}

export interface MprThresholdRegion {
  id: string
  enabled: boolean
  label: string
  thresholdHu: number
  thresholdMode: 'hu' | 'percentile'
  thresholdPercentile: number
  color: string
  box: MprThresholdRegionBox
  stats?: MprThresholdRegionStats | null
}

export interface MprVoiSphere {
  id: string
  label: string
  enabled: boolean
  centerWorld: Vec3
  radiusMm: number
  color: string
  stats?: MprVoiSphereStats | null
}

export interface MprVoiSphereStats {
  huMean: number | null
  huMin: number | null
  huMax: number | null
  huStdDev: number | null
  volumeCm3: number
  sampleCount: number
}

export interface MprSegmentationConfig extends Omit<
  BackendMprSegmentationConfig,
  'selectedRegionId' | 'selectedVoi' | 'selectedVoiId' | 'thresholdRegions' | 'voiSpheres' | 'voiSphere' | 'lowerHu' | 'upperHu' | 'opacity' | 'color' | 'voiBox'
> {
  enabled: boolean
  clientRevision: number
  selectedRegionId: string | null
  selectedVoi: boolean
  selectedVoiId: string | null
  thresholdRegions: MprThresholdRegion[]
  voiSpheres: MprVoiSphere[]
  voiSphere?: MprVoiSphere | null
  lowerHu?: number | null
  upperHu?: number | null
  opacity?: number
  color?: string
  voiBox?: MprSegmentationVoiBox | null
}

export type MprSegmentationOperationConfig = MprSegmentationConfig

export interface MprSegmentationOverlayRect {
  xMin: number
  yMin: number
  xMax: number
  yMax: number
}

export interface MprSegmentationOverlayRegion {
  regionId: string
  visible: boolean
  rect: MprSegmentationOverlayRect | null
  sampleRevision?: number
  samples?: MprSegmentationOverlaySamples | null
}

export interface MprSegmentationOverlay {
  regions: MprSegmentationOverlayRegion[]
}

export interface MprSegmentationOverlaySamples {
  points: number[]
  totalCount: number
  sampledCount: number
}

export type MprSegmentationConfigActionType = 'local' | 'select' | 'style' | 'move' | 'end'

export const MPR_SEGMENTATION_HU_LIMITS = {
  min: -1024,
  max: 3071
} as const

export const MPR_SEGMENTATION_DEPTH_LIMITS = {
  min: 0.1,
  max: 500
} as const

export const MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS = 10
export const MPR_SEGMENTATION_MAX_VOI_SPHERES = 10
export const DEFAULT_MPR_SEGMENTATION_THRESHOLD_HU = 300
export const DEFAULT_MPR_SEGMENTATION_COLOR = '#ff4df8'
export const DEFAULT_MPR_VOI_COLOR = '#22d3ee'

export function createDefaultMprSegmentationVoiBox(): MprSegmentationVoiBox {
  return {
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
    zMin: 0,
    zMax: 1
  }
}

export function createDefaultMprSegmentationConfig(): MprSegmentationConfig {
  return {
    enabled: false,
    clientRevision: 0,
    selectedRegionId: null,
    selectedVoi: false,
    selectedVoiId: null,
    thresholdRegions: [],
    voiSpheres: [],
    voiSphere: null
  }
}

function clampUnitRange(value: unknown, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(0, Math.min(1, numericValue))
}

function normalizeVoiRange(minValue: unknown, maxValue: unknown): [number, number] {
  const min = clampUnitRange(minValue, 0)
  const max = clampUnitRange(maxValue, 1)
  return min <= max ? [min, max] : [max, min]
}

export function normalizeMprSegmentationVoiBox(
  value?: Partial<MprSegmentationVoiBox> | null,
  fallback: MprSegmentationVoiBox = createDefaultMprSegmentationVoiBox()
): MprSegmentationVoiBox {
  const [xMin, xMax] = normalizeVoiRange(value?.xMin ?? fallback.xMin, value?.xMax ?? fallback.xMax)
  const [yMin, yMax] = normalizeVoiRange(value?.yMin ?? fallback.yMin, value?.yMax ?? fallback.yMax)
  const [zMin, zMax] = normalizeVoiRange(value?.zMin ?? fallback.zMin, value?.zMax ?? fallback.zMax)
  return { xMin, xMax, yMin, yMax, zMin, zMax }
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(minimum, Math.min(maximum, numericValue))
}

function normalizeHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

function normalizeVec3(value: unknown, fallback: Vec3): Vec3 {
  if (!Array.isArray(value) || value.length !== 3) {
    return fallback
  }
  const next = value.map((component) => Number(component))
  return next.every(Number.isFinite) ? [next[0], next[1], next[2]] : fallback
}

function normalizeUnitVec3(value: unknown, fallback: Vec3): Vec3 {
  const vector = normalizeVec3(value, fallback)
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (!Number.isFinite(length) || length <= 1e-6) {
    return fallback
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function normalizeNullableMetric(value: unknown): number | null {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function normalizeMprViewportKey(value: unknown, fallback: MprViewportKey = 'mpr-ax'): MprViewportKey {
  return value === 'mpr-ax' || value === 'mpr-cor' || value === 'mpr-sag' ? value : fallback
}

export function normalizeMprThresholdRegionStats(value?: Partial<MprThresholdRegionStats> | null): MprThresholdRegionStats | null {
  if (!value) {
    return null
  }
  return {
    huMean: normalizeNullableMetric(value.huMean),
    huMin: normalizeNullableMetric(value.huMin),
    huMax: normalizeNullableMetric(value.huMax),
    huStdDev: normalizeNullableMetric(value.huStdDev),
    volumeCm3: clampNumber(value.volumeCm3, 0, Number.MAX_SAFE_INTEGER, 0),
    sampleCount: Math.round(clampNumber(value.sampleCount, 0, Number.MAX_SAFE_INTEGER, 0)),
    effectiveThresholdHu: normalizeNullableMetric(value.effectiveThresholdHu)
  }
}

function normalizeMprThresholdMode(value: unknown): 'hu' | 'percentile' {
  return value === 'percentile' ? 'percentile' : 'hu'
}

export function normalizeMprThresholdRegionBox(value?: Partial<MprThresholdRegionBox> | null): MprThresholdRegionBox | null {
  if (!value) {
    return null
  }
  return {
    centerWorld: normalizeVec3(value.centerWorld, [0, 0, 0]),
    rowWorld: normalizeUnitVec3(value.rowWorld, [0, 1, 0]),
    colWorld: normalizeUnitVec3(value.colWorld, [0, 0, 1]),
    normalWorld: normalizeUnitVec3(value.normalWorld, [1, 0, 0]),
    widthMm: clampNumber(value.widthMm, 0.1, 10000, 1),
    heightMm: clampNumber(value.heightMm, 0.1, 10000, 1),
    depthMm: clampNumber(value.depthMm, MPR_SEGMENTATION_DEPTH_LIMITS.min, MPR_SEGMENTATION_DEPTH_LIMITS.max, 1),
    sourceViewport: normalizeMprViewportKey(value.sourceViewport)
  }
}

export function normalizeMprThresholdRegion(value?: Partial<MprThresholdRegion> | null): MprThresholdRegion | null {
  if (!value) {
    return null
  }
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const box = normalizeMprThresholdRegionBox(value.box)
  if (!id || !box) {
    return null
  }
  return {
    id,
    enabled: value.enabled !== false,
    label: typeof value.label === 'string' ? value.label.trim() : '',
    thresholdHu: Math.round(clampNumber(value.thresholdHu, MPR_SEGMENTATION_HU_LIMITS.min, MPR_SEGMENTATION_HU_LIMITS.max, DEFAULT_MPR_SEGMENTATION_THRESHOLD_HU)),
    thresholdMode: normalizeMprThresholdMode(value.thresholdMode),
    thresholdPercentile: clampNumber(value.thresholdPercentile, 0, 100, 80),
    color: normalizeHexColor(value.color, DEFAULT_MPR_SEGMENTATION_COLOR),
    box,
    stats: normalizeMprThresholdRegionStats(value.stats)
  }
}

export function normalizeMprVoiSphere(
  value?: Partial<MprVoiSphere> | null,
  fallback?: Partial<MprVoiSphere> | null,
  defaultIndex = 1
): MprVoiSphere | null {
  if (!value) {
    return null
  }
  const rawId = typeof value.id === 'string' && value.id.trim()
    ? value.id.trim()
    : typeof fallback?.id === 'string' && fallback.id.trim()
      ? fallback.id.trim()
      : `voi-${defaultIndex}`
  const rawLabel = typeof value.label === 'string'
    ? value.label.trim()
    : typeof fallback?.label === 'string' && fallback.label.trim()
      ? fallback.label.trim()
      : ''
  return {
    id: rawId,
    label: rawLabel,
    enabled: value.enabled !== false,
    centerWorld: normalizeVec3(value.centerWorld, normalizeVec3(fallback?.centerWorld, [0, 0, 0])),
    radiusMm: clampNumber(value.radiusMm, 0.1, 10000, clampNumber(fallback?.radiusMm, 0.1, 10000, 10)),
    color: normalizeHexColor(value.color, normalizeHexColor(fallback?.color, DEFAULT_MPR_VOI_COLOR)),
    stats: normalizeMprVoiSphereStats(value.stats ?? fallback?.stats)
  }
}

export function normalizeMprVoiSphereStats(value?: Partial<MprVoiSphereStats> | null): MprVoiSphereStats | null {
  if (!value) {
    return null
  }
  return {
    huMean: normalizeNullableMetric(value.huMean),
    huMin: normalizeNullableMetric(value.huMin),
    huMax: normalizeNullableMetric(value.huMax),
    huStdDev: normalizeNullableMetric(value.huStdDev),
    volumeCm3: clampNumber(value.volumeCm3, 0, Number.MAX_SAFE_INTEGER, 0),
    sampleCount: Math.round(clampNumber(value.sampleCount, 0, Number.MAX_SAFE_INTEGER, 0))
  }
}

export function resolveMprLegacyVoiSphere(
  voiSpheres: MprVoiSphere[],
  selectedVoiId?: string | null
): MprVoiSphere | null {
  return (selectedVoiId ? voiSpheres.find((sphere) => sphere.id === selectedVoiId) : null) ?? voiSpheres[0] ?? null
}

export function normalizeMprSegmentationConfig(
  value?: Partial<MprSegmentationOperationConfig | MprSegmentationConfig> | null,
  fallback: MprSegmentationConfig = createDefaultMprSegmentationConfig()
): MprSegmentationConfig {
  const hasSelectionValue = value != null
  const hasSelectedRegionId = hasSelectionValue && Object.prototype.hasOwnProperty.call(value, 'selectedRegionId')
  const hasSelectedVoi = hasSelectionValue && Object.prototype.hasOwnProperty.call(value, 'selectedVoi')
  const hasSelectedVoiId = hasSelectionValue && Object.prototype.hasOwnProperty.call(value, 'selectedVoiId')
  const regions = [
    ...((value?.thresholdRegions ?? fallback.thresholdRegions ?? []) as Array<Partial<MprThresholdRegion>>)
  ]
    .map((region) => normalizeMprThresholdRegion(region))
    .filter((region): region is MprThresholdRegion => region !== null)
  const rawSelectedRegionId = hasSelectedRegionId ? value?.selectedRegionId : fallback.selectedRegionId
  const requestedSelectedId = typeof rawSelectedRegionId === 'string' ? rawSelectedRegionId : null
  const selectedRegionId = requestedSelectedId && regions.some((region) => region.id === requestedSelectedId)
    ? requestedSelectedId
    : hasSelectedRegionId
      ? null
      : regions[0]?.id ?? null
  const rawVoiSpheres = Array.isArray(value?.voiSpheres)
    ? value.voiSpheres
    : value?.voiSphere
      ? [value.voiSphere]
      : fallback.voiSpheres.length > 0
        ? fallback.voiSpheres
        : fallback.voiSphere
          ? [fallback.voiSphere]
          : []
  const usedVoiIds = new Set<string>()
  const voiSpheres = rawVoiSpheres
    .map((sphere, index) => {
      const normalized = normalizeMprVoiSphere(sphere, fallback.voiSpheres[index] ?? null, index + 1)
      if (!normalized) {
        return null
      }
      const baseId = normalized.id
      let nextId = baseId
      let suffix = 2
      while (usedVoiIds.has(nextId)) {
        nextId = `${baseId}-${suffix}`
        suffix += 1
      }
      usedVoiIds.add(nextId)
      return {
        ...normalized,
        id: nextId,
        label: normalized.label
      }
    })
    .filter((sphere): sphere is MprVoiSphere => sphere !== null)
  const rawSelectedVoiId = hasSelectedVoiId ? value?.selectedVoiId : fallback.selectedVoiId
  const requestedSelectedVoiId = typeof rawSelectedVoiId === 'string' && rawSelectedVoiId.trim()
    ? rawSelectedVoiId.trim()
    : !hasSelectedVoiId && typeof fallback.selectedVoiId === 'string' && fallback.selectedVoiId.trim()
      ? fallback.selectedVoiId.trim()
      : null
  const wantsVoiSelection = hasSelectedVoi
    ? value?.selectedVoi === true
    : fallback.selectedVoi
  const selectedVoiId = requestedSelectedVoiId && voiSpheres.some((sphere) => sphere.id === requestedSelectedVoiId)
    ? requestedSelectedVoiId
    : Boolean(wantsVoiSelection)
      ? voiSpheres[0]?.id ?? null
      : null
  const selectedVoi = selectedVoiId !== null
  const legacyVoiSphere = resolveMprLegacyVoiSphere(voiSpheres, selectedVoiId)

  return {
    enabled: Boolean(value?.enabled ?? fallback.enabled),
    clientRevision: Math.round(clampNumber(value?.clientRevision ?? fallback.clientRevision, 0, Number.MAX_SAFE_INTEGER, 0)),
    selectedRegionId: selectedVoi ? null : selectedRegionId,
    selectedVoi,
    selectedVoiId,
    thresholdRegions: regions,
    voiSpheres,
    voiSphere: legacyVoiSphere
  }
}

function nearlyEqualSegmentationNumber(left: number, right: number, epsilon = 1e-3): boolean {
  return Math.abs(left - right) <= epsilon
}

function nearlyEqualSegmentationVec3(left: Vec3, right: Vec3, epsilon = 1e-3): boolean {
  return left.every((value, index) => nearlyEqualSegmentationNumber(value, right[index], epsilon))
}

function isSameMprThresholdRegionGeometry(left: MprThresholdRegion, right: MprThresholdRegion): boolean {
  return left.enabled === right.enabled &&
    left.thresholdHu === right.thresholdHu &&
    left.thresholdMode === right.thresholdMode &&
    nearlyEqualSegmentationNumber(left.thresholdPercentile, right.thresholdPercentile) &&
    left.box.sourceViewport === right.box.sourceViewport &&
    nearlyEqualSegmentationVec3(left.box.centerWorld, right.box.centerWorld) &&
    nearlyEqualSegmentationVec3(left.box.rowWorld, right.box.rowWorld) &&
    nearlyEqualSegmentationVec3(left.box.colWorld, right.box.colWorld) &&
    nearlyEqualSegmentationVec3(left.box.normalWorld, right.box.normalWorld) &&
    nearlyEqualSegmentationNumber(left.box.widthMm, right.box.widthMm) &&
    nearlyEqualSegmentationNumber(left.box.heightMm, right.box.heightMm) &&
    nearlyEqualSegmentationNumber(left.box.depthMm, right.box.depthMm)
}

function isSameMprVoiSphereGeometry(left: MprVoiSphere, right: MprVoiSphere): boolean {
  return left.enabled === right.enabled &&
    nearlyEqualSegmentationVec3(left.centerWorld, right.centerWorld) &&
    nearlyEqualSegmentationNumber(left.radiusMm, right.radiusMm)
}

export function mergeMprSegmentationPreviewConfig(
  currentConfig: MprSegmentationConfig,
  incomingConfig: MprSegmentationConfig
): MprSegmentationConfig {
  if (isStaleMprSegmentationPreviewConfig(currentConfig, incomingConfig)) {
    return currentConfig
  }
  const incomingRegionsById = new Map(incomingConfig.thresholdRegions.map((region) => [region.id, region]))
  const incomingVoiSpheresById = new Map(incomingConfig.voiSpheres.map((sphere) => [sphere.id, sphere]))
  const nextThresholdRegions = currentConfig.thresholdRegions.map((region) => {
    const incomingRegion = incomingRegionsById.get(region.id)
    if (!incomingRegion || !isSameMprThresholdRegionGeometry(region, incomingRegion)) {
      return region
    }
    return {
      ...region,
      stats: incomingRegion.stats ?? null
    }
  })
  const nextVoiSpheres = currentConfig.voiSpheres.map((sphere) => {
    const incomingSphere = incomingVoiSpheresById.get(sphere.id)
    if (!incomingSphere || !isSameMprVoiSphereGeometry(sphere, incomingSphere)) {
      return sphere
    }
    return {
      ...sphere,
      stats: incomingSphere.stats ?? null
    }
  })
  const nextSelectedVoiId = currentConfig.selectedVoi && currentConfig.selectedVoiId && nextVoiSpheres.some((sphere) => sphere.id === currentConfig.selectedVoiId)
    ? currentConfig.selectedVoiId
    : null
  const nextVoiSphere = resolveMprLegacyVoiSphere(nextVoiSpheres, nextSelectedVoiId)
  const nextSelectedRegionId = nextSelectedVoiId === null && currentConfig.selectedRegionId && nextThresholdRegions.some((region) => region.id === currentConfig.selectedRegionId)
    ? currentConfig.selectedRegionId
    : null
  return {
    ...currentConfig,
    clientRevision: incomingConfig.clientRevision,
    selectedRegionId: nextSelectedRegionId,
    selectedVoi: nextSelectedVoiId !== null,
    selectedVoiId: nextSelectedVoiId,
    voiSpheres: nextVoiSpheres,
    voiSphere: nextVoiSphere,
    thresholdRegions: nextThresholdRegions
  }
}

export function recolorMprSegmentationConfig(
  config: MprSegmentationConfig,
  thresholdColor: string,
  voiColor: string
): MprSegmentationConfig {
  const nextVoiSpheres = config.voiSpheres.map((sphere) => ({
    ...sphere,
    color: voiColor
  }))
  return normalizeMprSegmentationConfig({
    ...config,
    thresholdRegions: config.thresholdRegions.map((region) => ({
      ...region,
      color: thresholdColor
    })),
    voiSpheres: nextVoiSpheres,
    voiSphere: resolveMprLegacyVoiSphere(nextVoiSpheres, config.selectedVoiId)
  }, config)
}

export function isStaleMprSegmentationPreviewConfig(
  currentConfig: Pick<MprSegmentationConfig, 'clientRevision'>,
  incomingConfig: Pick<MprSegmentationConfig, 'clientRevision'>
): boolean {
  return (incomingConfig.clientRevision ?? 0) < (currentConfig.clientRevision ?? 0)
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
  scope?: DrawingScope
  sliceIndex?: number | null
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
  viewportInitialWindowInfos?: Partial<Record<MprViewportKey, WindowLevelInfo>>
  viewportCurrentWindowInfos?: Partial<Record<MprViewportKey, WindowLevelInfo>>
  mprCursor?: MprCursorInfo | null
  mprFrame?: MprFrameInfo | null
  mprRevision?: number | null
  viewportMprStateRevisions?: Partial<Record<MprViewportKey, number>>
  viewportMprImageRevisions?: Partial<Record<MprViewportKey, number>>
  windowLabel?: string
  initialWindowInfo?: WindowLevelInfo | null
  currentWindowInfo?: WindowLevelInfo | null
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
export type MprCrosshairMode = 'orthogonal' | 'double-oblique'
export type MprCursorInfo = BackendMprCursorInfo
export type MprFrameInfo = BackendMprFrameInfo
export interface MprPlaneInfo extends BackendMprPlaneInfo {
  pixelSpacingNormalMm: number
  imageToCanvasMatrix?: [[number, number, number], [number, number, number], [number, number, number]] | null
}
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

export type VolumeClipMode = 'inside' | 'outside'

export interface VolumeClipState {
  mode: VolumeClipMode
  points: MeasurementDraftPoint[]
}

export interface VolumeRenderOptions {
  removeBed: boolean
  clip?: VolumeClipState | null
}

export function createDefaultVolumeRenderOptions(): VolumeRenderOptions {
  return {
    removeBed: false,
    clip: null
  }
}

function normalizeVolumeClipMode(value: unknown): VolumeClipMode | null {
  return value === 'inside' || value === 'outside' ? value : null
}

export function normalizeVolumeRenderOptions(
  value?: Partial<VolumeRenderOptions> | null,
  fallback: VolumeRenderOptions = createDefaultVolumeRenderOptions()
): VolumeRenderOptions {
  const rawValue = (value ?? {}) as Partial<VolumeRenderOptions> & {
    remove_bed?: unknown
    clip?: Partial<VolumeClipState> | null
  }
  const rawClip = rawValue.clip ?? fallback.clip ?? null
  const clipMode = normalizeVolumeClipMode(rawClip?.mode)
  const clipPoints = Array.isArray(rawClip?.points)
    ? rawClip.points
        .map((point) => ({
          x: clampUnitRange(point?.x, 0),
          y: clampUnitRange(point?.y, 0)
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : []

  return {
    removeBed: Boolean(rawValue.removeBed ?? rawValue.remove_bed ?? fallback.removeBed),
    clip: clipMode && clipPoints.length >= 3
      ? {
          mode: clipMode,
          points: clipPoints
        }
      : null
  }
}

export interface ViewTransformInfo {
  rotationDegrees: number
  horFlip: boolean
  verFlip: boolean
  zoom?: number | null
  offsetX?: number | null
  offsetY?: number | null
}

export interface MontageTransformInfo {
  zoom: number
  offsetX: number
  offsetY: number
}

export interface WindowLevelInfo {
  ww: number
  wl: number
}

export interface ViewColorInfo {
  pseudocolorPreset: string
}

export interface ViewImageResponse {
  imageFormat?: ViewerImageTransportFormat
  imageTransport?: 'webrtc' | 'webp-final' | 'webp'
  fastPreview?: boolean
  fastPreviewFullResolution?: boolean
  metadataMode?: string
  renderIntent?: 'pixel-only' | 'geometry-preview' | 'overlay-preview' | 'full'
  renderRevision?: number | null
  interactionId?: string | null
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
  volumeRenderOptions?: VolumeRenderOptions | null
  transform?: ViewTransformInfo | null
  color?: ViewColorInfo | null
  mprMipConfig?: MprMipOperationConfig | null
  mprSegmentationConfig?: MprSegmentationOperationConfig | null
  mprSegmentationOverlay?: MprSegmentationOverlay | null
  mprCrosshairMode?: MprCrosshairMode | null
  petInfo?: PetInfo | null
  fusionInfo?: FusionInfo | null
  fusionComposite?: FusionCompositeInfo | null
  fusionProjection?: FusionProjectionInfo | null
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
  initialWindowInfo?: WindowLevelInfo | null
  currentWindowInfo?: WindowLevelInfo | null
  compareSeriesIds?: Record<CompareStackPaneKey, string>
  compareSeriesTitles?: Record<CompareStackPaneKey, string>
  compareViewIds?: Partial<Record<CompareStackPaneKey, string>>
  compareImages?: Partial<Record<CompareStackPaneKey, string>>
  compareSliceLabels?: Partial<Record<CompareStackPaneKey, string>>
  compareWindowLabels?: Partial<Record<CompareStackPaneKey, string>>
  compareInitialWindowInfos?: Partial<Record<CompareStackPaneKey, WindowLevelInfo>>
  compareCurrentWindowInfos?: Partial<Record<CompareStackPaneKey, WindowLevelInfo>>
  compareScaleBars?: Partial<Record<CompareStackPaneKey, ScaleBarInfo | null>>
  compareCornerInfos?: Partial<Record<CompareStackPaneKey, CornerInfo>>
  compareOrientations?: Partial<Record<CompareStackPaneKey, OrientationInfo>>
  compareTransformStates?: Partial<Record<CompareStackPaneKey, ViewTransformInfo>>
  comparePseudocolorPresets?: Partial<Record<CompareStackPaneKey, string>>
  fusionSeriesIds?: { ctSeriesId: string; petSeriesId: string }
  fusionSeriesDescriptions?: { ct?: string | null; pet?: string | null }
  fusionViewIds?: Partial<Record<FusionPaneKey, string>>
  fusionImages?: Partial<Record<FusionPaneKey, string>>
  fusionLayerImages?: Partial<Record<FusionPaneKey, FusionLayerImages | null>>
  fusionComposites?: Partial<Record<FusionPaneKey, FusionCompositeInfo | null>>
  fusionSliceLabels?: Partial<Record<FusionPaneKey, string>>
  fusionWindowLabels?: Partial<Record<FusionPaneKey, string>>
  fusionInitialWindowInfos?: Partial<Record<FusionPaneKey, WindowLevelInfo>>
  fusionScaleBars?: Partial<Record<FusionPaneKey, ScaleBarInfo | null>>
  fusionCornerInfos?: Partial<Record<FusionPaneKey, CornerInfo>>
  fusionOrientations?: Partial<Record<FusionPaneKey, OrientationInfo>>
  fusionTransformStates?: Partial<Record<FusionPaneKey, ViewTransformInfo>>
  fusionPseudocolorPresets?: Partial<Record<FusionPaneKey, string>>
  fusionProjections?: Partial<Record<FusionPaneKey, FusionProjectionInfo | null>>
  fusionLoadingProgress?: Partial<Record<FusionPaneKey, ViewProgressInfo | null>>
  fusionInfo?: FusionInfo | null
  petInfo?: PetInfo | null
  fusionManualRegistration?: boolean
  fusionRegistrationDragActive?: boolean
  fusionRegistrationResetRevision?: number
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
  viewportMprStateRevisions?: Partial<Record<MprViewportKey, number>>
  viewportMprImageRevisions?: Partial<Record<MprViewportKey, number>>
  viewportScaleBars?: Partial<Record<MprViewportKey, ScaleBarInfo | null>>
  measurements?: MeasurementOverlay[]
  scaleBar?: ScaleBarInfo | null
  annotations?: AnnotationOverlay[]
  cornerInfo: CornerInfo
  showCornerInfo?: boolean
  showScaleBar?: boolean
  showPseudocolorBar?: boolean
  showVolumeOrientationCube?: boolean
  showSliceSlider?: boolean
  showCrosshair?: boolean
  viewportCornerInfos?: Partial<Record<MprViewportKey, CornerInfo>>
  viewportMeasurements?: Partial<Record<string, MeasurementOverlay[]>>
  viewportAnnotations?: Partial<Record<string, AnnotationOverlay[]>>
  orientation: OrientationInfo
  viewportOrientations?: Partial<Record<MprViewportKey, OrientationInfo>>
  transformState: ViewTransformInfo
  viewportTransformStates?: Partial<Record<MprViewportKey, ViewTransformInfo>>
  pseudocolorPreset: string
  viewportPseudocolorPresets?: Partial<Record<MprViewportKey, string>>
  viewportInitialWindowInfos?: Partial<Record<MprViewportKey, WindowLevelInfo>>
  viewportCurrentWindowInfos?: Partial<Record<MprViewportKey, WindowLevelInfo>>
  mprMipConfig?: MprMipConfig | null
  mprSegmentationConfig?: MprSegmentationConfig | null
  viewportSegmentationOverlays?: Partial<Record<MprViewportKey, MprSegmentationOverlay | null>>
  mprCrosshairMode?: MprCrosshairMode
  volumePreset?: string
  volumeRenderConfig?: VolumeRenderConfig | null
  render3dMode?: Render3DMode
  surfaceRenderConfig?: SurfaceRenderConfig | null
  volumeRenderOptions?: VolumeRenderOptions | null
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
  imageUpdateRevisions?: Record<string, number>
  montageColumnCount?: number
  montageSelectedSliceIndex?: number
  montageSliceCount?: number
  montageScrollTop?: number
  montageScrollRequestRevision?: number
  montageTransformState?: MontageTransformInfo
  montageCommonInfoExpanded?: boolean
}

export type StackViewerTabItem = ViewerTabItem & { viewType: 'Stack' }
export type PetViewerTabItem = ViewerTabItem & { viewType: 'PET' }
export type MontageViewerTabItem = ViewerTabItem & { viewType: 'Montage' }
export type CompareStackViewerTabItem = ViewerTabItem & { viewType: 'CompareStack' }
export type MprViewerTabItem = ViewerTabItem & { viewType: 'MPR' }
export type VolumeViewerTabItem = ViewerTabItem & { viewType: '3D' }
export type FourDViewerTabItem = ViewerTabItem & { viewType: '4D' }
export type PetCtFusionViewerTabItem = ViewerTabItem & { viewType: 'PETCTFusion' }
export type TagViewerTabItem = ViewerTabItem & { viewType: 'Tag' }
export type LayoutViewerTabItem = ViewerTabItem & { viewType: 'Layout' }

export type DiscriminatedViewerTabItem =
  | StackViewerTabItem
  | PetViewerTabItem
  | MontageViewerTabItem
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
  initialWindowInfo?: WindowLevelInfo | null
  currentWindowInfo?: WindowLevelInfo | null
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
export type ViewType = 'Stack' | 'PET' | 'Montage' | 'CompareStack' | 'MPR' | '3D' | '4D' | 'PETCTFusion' | 'Tag' | 'Layout'
