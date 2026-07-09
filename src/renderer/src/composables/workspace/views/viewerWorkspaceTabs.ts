import type {
  CornerInfo,
  CornerPosition,
  CompareStackPaneKey,
  FusionPaneKey,
  FusionInfo,
  FusionCompositeInfo,
  FusionLayerImages,
  FusionProjectionInfo,
  FourDPhaseItem,
  FolderSeriesItem,
  MprCursorInfo,
  MprFrameInfo,
  MprPlaneInfo,
  MprSegmentationOverlay,
  MprViewportKey,
  OrientationInfo,
  PetInfo,
  ScaleBarInfo,
  ViewTransformInfo,
  ViewProgressInfo,
  ViewerLayoutTemplate,
  ViewerTabItem,
  ViewType,
  WindowLevelInfo
} from '../../../types/viewer'
import { createDefaultMprMipConfig, createDefaultMprSegmentationConfig, createDefaultVolumeRenderOptions } from '../../../types/viewer'
import {
  DEFAULT_FUSION_PET_WINDOW_MAX,
  DEFAULT_FUSION_PET_WINDOW_MIN,
  DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET,
  DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET,
  DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET,
  DEFAULT_PSEUDOCOLOR_PRESET
} from '../../../constants/pseudocolor'
import { createDefaultSurfaceRenderConfig } from '../volume/surfaceRenderConfig'
import { cloneViewerLayoutTemplate } from '../layout/viewerLayoutTemplates'
import { createCompareSyncDefaults, createLayoutSyncDefaults } from '../sync/viewSyncConfig'

const CORNER_POSITIONS: CornerPosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
export const COMPARE_STACK_SOURCE_PANE_KEY: CompareStackPaneKey = 'compare-a'
export const COMPARE_STACK_TARGET_PANE_KEY: CompareStackPaneKey = 'compare-b'
export const COMPARE_STACK_PANE_KEYS: CompareStackPaneKey[] = [COMPARE_STACK_SOURCE_PANE_KEY, COMPARE_STACK_TARGET_PANE_KEY]
export const FUSION_CT_AXIAL_PANE_KEY: FusionPaneKey = 'fusion-ct-ax'
export const FUSION_PET_AXIAL_PANE_KEY: FusionPaneKey = 'fusion-pet-ax'
export const FUSION_OVERLAY_AXIAL_PANE_KEY: FusionPaneKey = 'fusion-overlay-ax'
export const FUSION_PET_CORONAL_MIP_PANE_KEY: FusionPaneKey = 'fusion-pet-cor-mip'
export const FUSION_PANE_KEYS: FusionPaneKey[] = [
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY
]

export function createComparePaneRecord<T>(
  factory: (paneKey: CompareStackPaneKey, index: number) => T
): Record<CompareStackPaneKey, T> {
  const record = {} as Record<CompareStackPaneKey, T>
  COMPARE_STACK_PANE_KEYS.forEach((paneKey, index) => {
    record[paneKey] = factory(paneKey, index)
  })
  return record
}

export function createFusionPaneRecord<T>(
  factory: (paneKey: FusionPaneKey, index: number) => T
): Record<FusionPaneKey, T> {
  const record = {} as Record<FusionPaneKey, T>
  FUSION_PANE_KEYS.forEach((paneKey, index) => {
    record[paneKey] = factory(paneKey, index)
  })
  return record
}

export function isFusionPaneKey(value: string | null | undefined): value is FusionPaneKey {
  return Boolean(value && (FUSION_PANE_KEYS as string[]).includes(value))
}

export function resolveFusionPaneKey(value: string | null | undefined): FusionPaneKey {
  return isFusionPaneKey(value) ? value : FUSION_OVERLAY_AXIAL_PANE_KEY
}

export function resolveFusionPaneSeriesId(
  paneKey: FusionPaneKey,
  fusionSeriesIds: ViewerTabItem['fusionSeriesIds'] | null | undefined,
  fallbackSeriesId: string
): string {
  if (paneKey === FUSION_PET_AXIAL_PANE_KEY || paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY) {
    return fusionSeriesIds?.petSeriesId ?? fallbackSeriesId
  }
  return fusionSeriesIds?.ctSeriesId ?? fallbackSeriesId
}

export function createEmptyMprImages(): Record<MprViewportKey, string> {
  return {
    'mpr-ax': '',
    'mpr-cor': '',
    'mpr-sag': ''
  }
}

export function createEmptyMprSliceLabels(): Record<MprViewportKey, string> {
  return {
    'mpr-ax': '',
    'mpr-cor': '',
    'mpr-sag': ''
  }
}

export function createEmptyMprViewIds(): Record<MprViewportKey, string> {
  return {
    'mpr-ax': '',
    'mpr-cor': '',
    'mpr-sag': ''
  }
}

export function createEmptyMprCrosshairs(): Record<MprViewportKey, null> {
  return {
    'mpr-ax': null,
    'mpr-cor': null,
    'mpr-sag': null
  }
}

export function createEmptyMprPlanes(): Record<MprViewportKey, null> {
  return {
    'mpr-ax': null,
    'mpr-cor': null,
    'mpr-sag': null
  }
}

export function createEmptyMprScaleBars(): Record<MprViewportKey, null> {
  return {
    'mpr-ax': null,
    'mpr-cor': null,
    'mpr-sag': null
  }
}

export function createEmptyMprSegmentationOverlays(): Record<MprViewportKey, MprSegmentationOverlay | null> {
  return {
    'mpr-ax': null,
    'mpr-cor': null,
    'mpr-sag': null
  }
}

export function createEmptyOrientationInfo(): OrientationInfo {
  return {
    top: null,
    right: null,
    bottom: null,
    left: null,
    volumeQuaternion: null
  }
}

export function createEmptyMprOrientations(): Record<MprViewportKey, OrientationInfo> {
  return {
    'mpr-ax': createEmptyOrientationInfo(),
    'mpr-cor': createEmptyOrientationInfo(),
    'mpr-sag': createEmptyOrientationInfo()
  }
}

export function createDefaultTransformInfo(): ViewTransformInfo {
  return {
    rotationDegrees: 0,
    horFlip: false,
    verFlip: false,
    zoom: 1,
    offsetX: 0,
    offsetY: 0
  }
}

export function createEmptyMprTransformStates(): Record<MprViewportKey, ViewTransformInfo> {
  return {
    'mpr-ax': createDefaultTransformInfo(),
    'mpr-cor': createDefaultTransformInfo(),
    'mpr-sag': createDefaultTransformInfo()
  }
}

export function createEmptyMprPseudocolorPresets(): Record<MprViewportKey, string> {
  return {
    'mpr-ax': DEFAULT_PSEUDOCOLOR_PRESET,
    'mpr-cor': DEFAULT_PSEUDOCOLOR_PRESET,
    'mpr-sag': DEFAULT_PSEUDOCOLOR_PRESET
  }
}

export function createEmptyCompareViewIds(): Record<CompareStackPaneKey, string> {
  return createComparePaneRecord(() => '')
}

export function createEmptyFusionViewIds(): Record<FusionPaneKey, string> {
  return createFusionPaneRecord(() => '')
}

export function createEmptyCompareImages(): Record<CompareStackPaneKey, string> {
  return createComparePaneRecord(() => '')
}

export function createEmptyFusionImages(): Record<FusionPaneKey, string> {
  return createFusionPaneRecord(() => '')
}

export function createEmptyFusionLayerImages(): Record<FusionPaneKey, FusionLayerImages | null> {
  return createFusionPaneRecord(() => null)
}

export function createEmptyFusionComposites(): Record<FusionPaneKey, FusionCompositeInfo | null> {
  return createFusionPaneRecord(() => null)
}

export function createEmptyCompareSliceLabels(): Record<CompareStackPaneKey, string> {
  return createComparePaneRecord(() => '')
}

export function createEmptyFusionSliceLabels(): Record<FusionPaneKey, string> {
  return createFusionPaneRecord(() => '')
}

export function createEmptyCompareWindowLabels(): Record<CompareStackPaneKey, string> {
  return createComparePaneRecord(() => '')
}

export function createEmptyFusionWindowLabels(): Record<FusionPaneKey, string> {
  return createFusionPaneRecord(() => '')
}

export function createEmptyMprInitialWindowInfos(): Partial<Record<MprViewportKey, WindowLevelInfo>> {
  return {}
}

export function createEmptyMprCurrentWindowInfos(): Partial<Record<MprViewportKey, WindowLevelInfo>> {
  return {}
}

export function createEmptyCompareInitialWindowInfos(): Partial<Record<CompareStackPaneKey, WindowLevelInfo>> {
  return {}
}

export function createEmptyCompareCurrentWindowInfos(): Partial<Record<CompareStackPaneKey, WindowLevelInfo>> {
  return {}
}

export function createEmptyFusionInitialWindowInfos(): Partial<Record<FusionPaneKey, WindowLevelInfo>> {
  return {}
}

export function createEmptyCompareScaleBars(): Record<CompareStackPaneKey, null> {
  return createComparePaneRecord(() => null)
}

export function createEmptyFusionScaleBars(): Record<FusionPaneKey, null> {
  return createFusionPaneRecord(() => null)
}

export function createEmptyCompareCornerInfos(): Record<CompareStackPaneKey, CornerInfo> {
  return createComparePaneRecord(() => createEmptyCornerInfo())
}

export function createEmptyFusionCornerInfos(): Record<FusionPaneKey, CornerInfo> {
  return createFusionPaneRecord(() => createEmptyCornerInfo())
}

export function createEmptyCompareOrientations(): Record<CompareStackPaneKey, OrientationInfo> {
  return createComparePaneRecord(() => createEmptyOrientationInfo())
}

export function createEmptyFusionOrientations(): Record<FusionPaneKey, OrientationInfo> {
  return createFusionPaneRecord(() => createEmptyOrientationInfo())
}

export function createEmptyCompareTransformStates(): Record<CompareStackPaneKey, ViewTransformInfo> {
  return createComparePaneRecord(() => createDefaultTransformInfo())
}

export function createEmptyFusionTransformStates(): Record<FusionPaneKey, ViewTransformInfo> {
  return createFusionPaneRecord(() => createDefaultTransformInfo())
}

export function createEmptyComparePseudocolorPresets(): Record<CompareStackPaneKey, string> {
  return createComparePaneRecord(() => DEFAULT_PSEUDOCOLOR_PRESET)
}

export function createEmptyFusionPseudocolorPresets(): Record<FusionPaneKey, string> {
  return createFusionPaneRecord((paneKey) => {
    if (paneKey === FUSION_CT_AXIAL_PANE_KEY) {
      return DEFAULT_PSEUDOCOLOR_PRESET
    }
    if (paneKey === FUSION_OVERLAY_AXIAL_PANE_KEY) {
      return DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET
    }
    return DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET
  })
}

export function createEmptyFusionProjections(): Record<FusionPaneKey, null> {
  return createFusionPaneRecord(() => null)
}

export function createEmptyFusionLoadingProgress(): Record<FusionPaneKey, ViewProgressInfo | null> {
  return createFusionPaneRecord(() => null)
}

export function createDefaultFusionInfo(ctSeriesId = '', petSeriesId = ''): FusionInfo {
  return {
    paneRole: FUSION_OVERLAY_AXIAL_PANE_KEY,
    ctSeriesId,
    petSeriesId,
    petPseudocolorPreset: DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET,
    petUnit: 'SUVbw',
    petUnitLabel: 'g/ml (SUVbw)',
    petWindowMin: DEFAULT_FUSION_PET_WINDOW_MIN,
    petWindowMax: DEFAULT_FUSION_PET_WINDOW_MAX,
    alpha: 0.52,
    revision: 0,
    registration: {
      translateRowMm: 0,
      translateColMm: 0,
      rotationDegrees: 0,
      saved: false
    }
  }
}

export function createDefaultPetInfo(seriesId = ''): PetInfo {
  return {
    seriesId,
    petUnit: 'SUVbw',
    petUnitLabel: 'g/ml (SUVbw)',
    petWindowMin: DEFAULT_FUSION_PET_WINDOW_MIN,
    petWindowMax: DEFAULT_FUSION_PET_WINDOW_MAX,
    pseudocolorPreset: DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET
  }
}

export function createPetCtFusionTabKey(ctSeriesId: string, petSeriesId: string): string {
  return `fusion:${ctSeriesId}:${petSeriesId}`
}

export function createDefaultFourDPhaseItems(phaseCount = 10): FourDPhaseItem[] {
  return Array.from({ length: Math.max(1, phaseCount) }, (_, index) => ({
    phaseIndex: index,
    label: `Phase ${String(index + 1).padStart(2, '0')}`,
    seriesId: null,
    imageSrc: '',
    status: 'pending'
  }))
}

export function createEmptyCornerInfo(): CornerInfo {
  return {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight: [],
    tags: {}
  }
}

export function createEmptyMprCornerInfos(): Record<MprViewportKey, CornerInfo> {
  return {
    'mpr-ax': createEmptyCornerInfo(),
    'mpr-cor': createEmptyCornerInfo(),
    'mpr-sag': createEmptyCornerInfo()
  }
}

function normalizeCornerLines(value: unknown): string[] {
  if (value == null) {
    return []
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeCornerLines(item))
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if ('lines' in record) {
      return normalizeCornerLines(record.lines)
    }
    if ('text' in record) {
      return normalizeCornerLines(record.text)
    }
    if ('value' in record) {
      return normalizeCornerLines(record.value)
    }
  }

  return []
}

function getCornerValue(source: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (alias in source) {
      return source[alias]
    }
  }

  return undefined
}

function normalizeCornerTagMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>((accumulator, [key, tagValue]) => {
    const normalizedLines = normalizeCornerLines(tagValue)
    if (normalizedLines.length) {
      accumulator[key] = normalizedLines
    }
    return accumulator
  }, {})
}

export function normalizeCornerInfo(value: unknown): CornerInfo {
  if (!value) {
    return createEmptyCornerInfo()
  }

  if (Array.isArray(value)) {
    const [topLeft, topRight, bottomLeft, bottomRight] = value
    return {
      topLeft: normalizeCornerLines(topLeft),
      topRight: normalizeCornerLines(topRight),
      bottomLeft: normalizeCornerLines(bottomLeft),
      bottomRight: normalizeCornerLines(bottomRight),
      tags: {}
    }
  }

  if (typeof value !== 'object') {
    return createEmptyCornerInfo()
  }

  const record = value as Record<string, unknown>
  const nestedCorners = (record.cornerInfo ?? record.corner_info ?? record.corners ?? record.overlay) as unknown
  if (nestedCorners && nestedCorners !== value) {
    return normalizeCornerInfo(nestedCorners)
  }

  return {
    topLeft: normalizeCornerLines(getCornerValue(record, ['topLeft', 'top_left', 'leftTop', 'left_top', 'lt'])),
    topRight: normalizeCornerLines(getCornerValue(record, ['topRight', 'top_right', 'rightTop', 'right_top', 'rt'])),
    bottomLeft: normalizeCornerLines(
      getCornerValue(record, ['bottomLeft', 'bottom_left', 'leftBottom', 'left_bottom', 'bl'])
    ),
    bottomRight: normalizeCornerLines(
      getCornerValue(record, ['bottomRight', 'bottom_right', 'rightBottom', 'right_bottom', 'br'])
    ),
    tags: normalizeCornerTagMap(getCornerValue(record, ['tags', 'tagLines', 'tag_lines']))
  }
}

export function normalizeOrientationInfo(value: unknown): OrientationInfo {
  if (!value || typeof value !== 'object') {
    return createEmptyOrientationInfo()
  }

  const record = value as Record<string, unknown>
  const nestedOrientation = (record.orientation ?? record.orientationInfo ?? record.direction) as unknown
  if (nestedOrientation && nestedOrientation !== value) {
    return normalizeOrientationInfo(nestedOrientation)
  }

  const normalize = (field: unknown): string | null => {
    if (field == null) {
      return null
    }
    const text = String(field).trim()
    return text || null
  }

  return {
    top: normalize(record.top),
    right: normalize(record.right),
    bottom: normalize(record.bottom),
    left: normalize(record.left),
    volumeQuaternion: Array.isArray(record.volumeQuaternion) && record.volumeQuaternion.length === 4
      ? (record.volumeQuaternion.map((item) => Number(item)) as [number, number, number, number])
      : null
  }
}

export function normalizeScaleBarInfo(value: unknown): ScaleBarInfo | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const lengthNorm =
    typeof record.lengthNorm === 'number'
      ? record.lengthNorm
      : typeof record.length_norm === 'number'
        ? record.length_norm
        : Number.NaN
  const label = typeof record.label === 'string' ? record.label.trim() : ''

  if (!Number.isFinite(lengthNorm) || lengthNorm <= 0 || !label) {
    return null
  }

  return {
    lengthNorm,
    label
  }
}

function normalizeMprFrameAxis(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null
  }

  const numeric = value.map((item) => Number(item))
  if (numeric.some((item) => !Number.isFinite(item))) {
    return null
  }

  return [numeric[0]!, numeric[1]!, numeric[2]!]
}

function normalizeMprFrameAxisOrFallback(value: unknown, fallback: [number, number, number]): [number, number, number] {
  return normalizeMprFrameAxis(value) ?? fallback
}

export function normalizeMprFrameInfo(value: unknown): MprFrameInfo | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const nestedFrame = (record.mprFrame ?? record.mpr_frame ?? record.frame) as unknown
  if (nestedFrame && nestedFrame !== value) {
    return normalizeMprFrameInfo(nestedFrame)
  }

  const center = normalizeMprFrameAxis(record.center)
  const axisSlice = normalizeMprFrameAxis(record.axisSlice ?? record.axis_slice)
  const axisRow = normalizeMprFrameAxis(record.axisRow ?? record.axis_row)
  const axisCol = normalizeMprFrameAxis(record.axisCol ?? record.axis_col)
  if (!center || !axisSlice || !axisRow || !axisCol) {
    return null
  }

  return {
    center,
    axisSlice,
    axisRow,
    axisCol
  }
}

export function normalizeMprCursorInfo(value: unknown): MprCursorInfo | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const nestedCursor = (record.mprCursor ?? record.mpr_cursor ?? record.cursor) as unknown
  if (nestedCursor && nestedCursor !== value) {
    return normalizeMprCursorInfo(nestedCursor)
  }

  const orientationValue = record.orientationWorld ?? record.orientation_world
  const orientationWorld = Array.isArray(orientationValue) && orientationValue.length === 3
    ? orientationValue.map((row, index) =>
        normalizeMprFrameAxisOrFallback(
          row,
          index === 0 ? [1, 0, 0] : index === 1 ? [0, 1, 0] : [0, 0, 1]
        )
      )
    : [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ]

  return {
    centerWorld: normalizeMprFrameAxisOrFallback(record.centerWorld ?? record.center_world, [0, 0, 0]),
    referenceCenterWorld: normalizeMprFrameAxisOrFallback(record.referenceCenterWorld ?? record.reference_center_world, [0, 0, 0]),
    orientationWorld: orientationWorld as MprCursorInfo['orientationWorld'],
    linkedToVolumeRotation: Boolean(record.linkedToVolumeRotation ?? record.linked_to_volume_rotation ?? false)
  }
}

export function normalizeMprPlaneInfo(value: unknown): MprPlaneInfo | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const nestedPlane = (record.mprPlane ?? record.mpr_plane ?? record.plane) as unknown
  if (nestedPlane && nestedPlane !== value) {
    return normalizeMprPlaneInfo(nestedPlane)
  }

  const row = normalizeMprFrameAxisOrFallback(record.row, [0, 1, 0])
  const col = normalizeMprFrameAxisOrFallback(record.col, [0, 0, 1])
  const normal = normalizeMprFrameAxisOrFallback(record.normal, [1, 0, 0])
  const rowWorld = normalizeMprFrameAxisOrFallback(record.rowWorld ?? record.row_world, row)
  const colWorld = normalizeMprFrameAxisOrFallback(record.colWorld ?? record.col_world, col)
  const normalWorld = normalizeMprFrameAxisOrFallback(record.normalWorld ?? record.normal_world, normal)
  const outputShapeValue = record.outputShape ?? record.output_shape
  const outputShape = Array.isArray(outputShapeValue) && outputShapeValue.length === 2
    ? [Number(outputShapeValue[0]), Number(outputShapeValue[1])]
    : [0, 0]
  const pixelSpacingRowMm = Number(record.pixelSpacingRowMm ?? record.pixel_spacing_row_mm ?? 1)
  const pixelSpacingColMm = Number(record.pixelSpacingColMm ?? record.pixel_spacing_col_mm ?? 1)
  const pixelSpacingNormalMm = Number(record.pixelSpacingNormalMm ?? record.pixel_spacing_normal_mm ?? 1)
  const imageToCanvasMatrixValue = record.imageToCanvasMatrix ?? record.image_to_canvas_matrix
  const imageToCanvasMatrix = Array.isArray(imageToCanvasMatrixValue) && imageToCanvasMatrixValue.length === 3
    ? imageToCanvasMatrixValue.map((rowValue) =>
        Array.isArray(rowValue) && rowValue.length === 3
          ? [
              Number(rowValue[0]),
              Number(rowValue[1]),
              Number(rowValue[2])
            ]
          : [Number.NaN, Number.NaN, Number.NaN]
      )
    : null
  const normalizedImageToCanvasMatrix =
    imageToCanvasMatrix &&
    imageToCanvasMatrix.every((rowValue) => rowValue.every((entry) => Number.isFinite(entry)))
      ? imageToCanvasMatrix as [[number, number, number], [number, number, number], [number, number, number]]
      : null

  return {
    viewport: typeof record.viewport === 'string' ? record.viewport : '',
    centerWorld: normalizeMprFrameAxisOrFallback(record.centerWorld ?? record.center_world, [0, 0, 0]),
    cursorCenterWorld: normalizeMprFrameAxisOrFallback(record.cursorCenterWorld ?? record.cursor_center_world, [0, 0, 0]),
    rowWorld,
    colWorld,
    normalWorld,
    pixelSpacingRowMm: Number.isFinite(pixelSpacingRowMm) ? pixelSpacingRowMm : 1,
    pixelSpacingColMm: Number.isFinite(pixelSpacingColMm) ? pixelSpacingColMm : 1,
    pixelSpacingNormalMm: Number.isFinite(pixelSpacingNormalMm) ? pixelSpacingNormalMm : 1,
    outputShape: [
      Number.isFinite(outputShape[0]) ? outputShape[0] : 0,
      Number.isFinite(outputShape[1]) ? outputShape[1] : 0
    ],
    row,
    col,
    normal,
    imageToCanvasMatrix: normalizedImageToCanvasMatrix,
    isOblique: Boolean(record.isOblique ?? record.is_oblique ?? false)
  }
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function normalizeVec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) {
    return fallback
  }
  return [
    normalizeFiniteNumber(value[0], fallback[0]),
    normalizeFiniteNumber(value[1], fallback[1]),
    normalizeFiniteNumber(value[2], fallback[2])
  ]
}

function normalizeVec4(value: unknown, fallback: [number, number, number, number]): [number, number, number, number] {
  if (!Array.isArray(value) || value.length < 4) {
    return fallback
  }
  return [
    normalizeFiniteNumber(value[0], fallback[0]),
    normalizeFiniteNumber(value[1], fallback[1]),
    normalizeFiniteNumber(value[2], fallback[2]),
    normalizeFiniteNumber(value[3], fallback[3])
  ]
}

export function normalizeFusionProjectionInfo(value: unknown): FusionProjectionInfo | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const nestedProjection = (record.fusionProjection ?? record.fusion_projection ?? record.projection) as unknown
  if (nestedProjection && nestedProjection !== value) {
    return normalizeFusionProjectionInfo(nestedProjection)
  }

  const paneRole = typeof (record.paneRole ?? record.pane_role) === 'string'
    ? String(record.paneRole ?? record.pane_role)
    : FUSION_OVERLAY_AXIAL_PANE_KEY
  return {
    paneRole,
    referenceWorld: normalizeVec3(record.referenceWorld ?? record.reference_world, [0, 0, 0]),
    referenceX: normalizeFiniteNumber(record.referenceX ?? record.reference_x, 0.5),
    referenceY: normalizeFiniteNumber(record.referenceY ?? record.reference_y, 0.5),
    normalizedToWorldOrigin: normalizeVec3(record.normalizedToWorldOrigin ?? record.normalized_to_world_origin, [0, 0, 0]),
    normalizedToWorldX: normalizeVec3(record.normalizedToWorldX ?? record.normalized_to_world_x, [1, 0, 0]),
    normalizedToWorldY: normalizeVec3(record.normalizedToWorldY ?? record.normalized_to_world_y, [0, 1, 0]),
    worldToNormalizedX: normalizeVec4(record.worldToNormalizedX ?? record.world_to_normalized_x, [0, 0, 0, 0.5]),
    worldToNormalizedY: normalizeVec4(record.worldToNormalizedY ?? record.world_to_normalized_y, [0, 0, 0, 0.5])
  }
}

export function mergeCornerInfo(base: CornerInfo, overlay: CornerInfo): CornerInfo {
  const mergedCornerInfo = CORNER_POSITIONS.reduce(
    (accumulator, position) => {
      const merged = [...base[position], ...overlay[position]]
      accumulator[position] = merged.filter((item, index) => merged.indexOf(item) === index)
      return accumulator
    },
    createEmptyCornerInfo()
  )
  const mergedTags = { ...(base.tags ?? {}) }
  for (const [key, lines] of Object.entries(overlay.tags ?? {})) {
    const merged = [...(mergedTags[key] ?? []), ...lines]
    mergedTags[key] = merged.filter((item, index) => merged.indexOf(item) === index)
  }
  mergedCornerInfo.tags = mergedTags
  return mergedCornerInfo
}

export function isMprViewportKey(viewportKey: string): viewportKey is MprViewportKey {
  return viewportKey === 'mpr-ax' || viewportKey === 'mpr-cor' || viewportKey === 'mpr-sag'
}

export function isCompareStackPaneKey(viewportKey: string): viewportKey is CompareStackPaneKey {
  return COMPARE_STACK_PANE_KEYS.includes(viewportKey as CompareStackPaneKey)
}

export function createTabKey(seriesId: string, viewType: ViewType): string {
  return `${seriesId}::${viewType}`
}

export function createCompareStackTabKey(sourceSeriesId: string, targetSeriesId: string): string {
  return `${sourceSeriesId}::CompareStack::${targetSeriesId}`
}

export function createLayoutTabKey(seriesId: string, templateKey: string): string {
  return `${seriesId}::Layout::${templateKey}`
}

export function getSeriesDisplayName(series: FolderSeriesItem | null, fallbackSeriesId: string): string {
  if (!series) {
    return fallbackSeriesId
  }

  return series.seriesDescription || series.seriesInstanceUid || series.seriesId
}

export function getViewTypeDisplayLabel(viewType: ViewType, locale: 'zh-CN' | 'en-US' = 'en-US'): string {
  if (viewType === 'Stack' || viewType === 'PET') {
    return '2D'
  }
  if (viewType === 'CompareStack') {
    return locale === 'zh-CN' ? '2D 对比' : '2D Compare'
  }
  if (viewType === 'PETCTFusion') {
    return 'PET/CT'
  }
  return viewType
}

export function buildTabTitle(series: FolderSeriesItem | null, viewType: ViewType, fallbackSeriesId: string): string {
  return `${getSeriesDisplayName(series, fallbackSeriesId)} · ${getViewTypeDisplayLabel(viewType)}`
}

export function createTab(series: FolderSeriesItem, viewType: ViewType): ViewerTabItem {
  const seriesTitle = getSeriesDisplayName(series, series.seriesId)

  return {
    key: createTabKey(series.seriesId, viewType),
    seriesId: series.seriesId,
    seriesTitle,
    title: `${seriesTitle} · ${getViewTypeDisplayLabel(viewType)}`,
    viewType,
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    initialWindowInfo: null,
    currentWindowInfo: null,
    compareSeriesIds: createComparePaneRecord((paneKey) =>
      paneKey === COMPARE_STACK_SOURCE_PANE_KEY ? series.seriesId : ''
    ),
    compareSeriesTitles: createComparePaneRecord((paneKey) =>
      paneKey === COMPARE_STACK_SOURCE_PANE_KEY ? seriesTitle : ''
    ),
    compareViewIds: createEmptyCompareViewIds(),
    compareImages: createEmptyCompareImages(),
    compareSliceLabels: createEmptyCompareSliceLabels(),
    compareWindowLabels: createEmptyCompareWindowLabels(),
    compareInitialWindowInfos: createEmptyCompareInitialWindowInfos(),
    compareCurrentWindowInfos: createEmptyCompareCurrentWindowInfos(),
    compareScaleBars: createEmptyCompareScaleBars(),
    compareCornerInfos: createEmptyCompareCornerInfos(),
    compareOrientations: createEmptyCompareOrientations(),
    compareTransformStates: createEmptyCompareTransformStates(),
    comparePseudocolorPresets: createEmptyComparePseudocolorPresets(),
    fusionSeriesIds: { ctSeriesId: '', petSeriesId: '' },
    fusionViewIds: createEmptyFusionViewIds(),
    fusionImages: createEmptyFusionImages(),
    fusionLayerImages: createEmptyFusionLayerImages(),
    fusionComposites: createEmptyFusionComposites(),
    fusionSliceLabels: createEmptyFusionSliceLabels(),
    fusionWindowLabels: createEmptyFusionWindowLabels(),
    fusionInitialWindowInfos: createEmptyFusionInitialWindowInfos(),
    fusionScaleBars: createEmptyFusionScaleBars(),
    fusionCornerInfos: createEmptyFusionCornerInfos(),
    fusionOrientations: createEmptyFusionOrientations(),
    fusionTransformStates: createEmptyFusionTransformStates(),
    fusionPseudocolorPresets: createEmptyFusionPseudocolorPresets(),
    fusionProjections: createEmptyFusionProjections(),
    fusionInfo: null,
    fusionManualRegistration: false,
    fusionRegistrationDragActive: false,
    fusionRegistrationResetRevision: 0,
    petInfo: viewType === 'PET' ? createDefaultPetInfo(series.seriesId) : null,
    ...createCompareSyncDefaults(),
    ...createLayoutSyncDefaults(),
    viewportViewIds: createEmptyMprViewIds(),
    viewportImages: createEmptyMprImages(),
    viewportSliceLabels: createEmptyMprSliceLabels(),
    mprCursor: null,
    mprFrame: null,
    mprRevision: null,
    viewportMprStateRevisions: {},
    viewportMprImageRevisions: {},
    viewportPlanes: createEmptyMprPlanes(),
    viewportCrosshairs: createEmptyMprCrosshairs(),
    viewportScaleBars: createEmptyMprScaleBars(),
    cornerInfo: createEmptyCornerInfo(),
    showCornerInfo: true,
    showScaleBar: true,
    showPseudocolorBar: true,
    showCrosshair: true,
    viewportCornerInfos: createEmptyMprCornerInfos(),
    orientation: createEmptyOrientationInfo(),
    viewportOrientations: createEmptyMprOrientations(),
    transformState: createDefaultTransformInfo(),
    viewportTransformStates: createEmptyMprTransformStates(),
    scaleBar: null,
    pseudocolorPreset: viewType === 'PET' ? DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET : DEFAULT_PSEUDOCOLOR_PRESET,
    viewportPseudocolorPresets: createEmptyMprPseudocolorPresets(),
    viewportInitialWindowInfos: createEmptyMprInitialWindowInfos(),
    viewportCurrentWindowInfos: createEmptyMprCurrentWindowInfos(),
    mprMipConfig: createDefaultMprMipConfig(),
    mprSegmentationConfig: createDefaultMprSegmentationConfig(),
    viewportSegmentationOverlays: createEmptyMprSegmentationOverlays(),
    mprCrosshairMode: 'orthogonal',
    volumePreset: undefined,
    volumeRenderConfig: null,
    render3dMode: 'volume',
    surfaceRenderConfig: createDefaultSurfaceRenderConfig(),
    volumeRenderOptions: createDefaultVolumeRenderOptions(),
    tagIndex: 0,
    tagTotal: 0,
    tagItems: [],
    tagFilePath: null,
    tagSopInstanceUid: null,
    tagInstanceNumber: null,
    tagIsLoading: false,
    tagLoadError: null,
    layoutTemplate: null,
    layoutSlots: [],
    fourDPhaseIndex: 0,
    fourDPhaseCount: 10,
    fourDPhaseItems: createDefaultFourDPhaseItems(10),
    fourDPlaybackFps: 2,
    fourDPhaseViewIds: {},
    fourDPhaseCache: {},
    fourDIsPlaying: false,
    fourDIsPreloading: false,
    imageUpdateRevisions: {}
  }
}

export function createLayoutTab(series: FolderSeriesItem, template: ViewerLayoutTemplate): ViewerTabItem {
  const layoutTemplate = cloneViewerLayoutTemplate(template)
  const seriesTitle = getSeriesDisplayName(series, series.seriesId)
  return {
    ...createTab(series, 'Layout'),
    key: createLayoutTabKey(series.seriesId, layoutTemplate.key),
    title: `${seriesTitle} · Layout ${layoutTemplate.label}`,
    viewType: 'Layout',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    layoutTemplate,
    layoutSlots: layoutTemplate.slots.map((slot) => ({ ...slot }))
  }
}
