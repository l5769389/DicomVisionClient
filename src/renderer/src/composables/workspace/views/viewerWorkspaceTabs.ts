import type {
  CornerInfo,
  CornerPosition,
  FourDPhaseItem,
  FolderSeriesItem,
  MprCursorInfo,
  MprFrameInfo,
  MprPlaneInfo,
  MprViewportKey,
  OrientationInfo,
  ScaleBarInfo,
  ViewTransformInfo,
  ViewerTabItem,
  ViewType
} from '../../../types/viewer'
import { createDefaultMprMipConfig } from '../../../types/viewer'
import { DEFAULT_PSEUDOCOLOR_PRESET } from '../../../constants/pseudocolor'
import { createDefaultVolumeRenderConfig } from '../volume/volumeRenderConfig'

const CORNER_POSITIONS: CornerPosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

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
    verFlip: false
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
    bottomRight: []
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
      bottomRight: normalizeCornerLines(bottomRight)
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
    )
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

  return {
    viewport: typeof record.viewport === 'string' ? record.viewport : '',
    centerWorld: normalizeMprFrameAxisOrFallback(record.centerWorld ?? record.center_world, [0, 0, 0]),
    cursorCenterWorld: normalizeMprFrameAxisOrFallback(record.cursorCenterWorld ?? record.cursor_center_world, [0, 0, 0]),
    rowWorld,
    colWorld,
    normalWorld,
    pixelSpacingRowMm: Number.isFinite(pixelSpacingRowMm) ? pixelSpacingRowMm : 1,
    pixelSpacingColMm: Number.isFinite(pixelSpacingColMm) ? pixelSpacingColMm : 1,
    outputShape: [
      Number.isFinite(outputShape[0]) ? outputShape[0] : 0,
      Number.isFinite(outputShape[1]) ? outputShape[1] : 0
    ],
    row,
    col,
    normal,
    isOblique: Boolean(record.isOblique ?? record.is_oblique ?? false)
  }
}

export function mergeCornerInfo(base: CornerInfo, overlay: CornerInfo): CornerInfo {
  return CORNER_POSITIONS.reduce(
    (accumulator, position) => {
      const merged = [...base[position], ...overlay[position]]
      accumulator[position] = merged.filter((item, index) => merged.indexOf(item) === index)
      return accumulator
    },
    createEmptyCornerInfo()
  )
}

export function isMprViewportKey(viewportKey: string): viewportKey is MprViewportKey {
  return viewportKey === 'mpr-ax' || viewportKey === 'mpr-cor' || viewportKey === 'mpr-sag'
}

export function createTabKey(seriesId: string, viewType: ViewType): string {
  return `${seriesId}::${viewType}`
}

export function getSeriesDisplayName(series: FolderSeriesItem | null, fallbackSeriesId: string): string {
  if (!series) {
    return fallbackSeriesId
  }

  return series.seriesDescription || series.seriesInstanceUid || series.seriesId
}

export function buildTabTitle(series: FolderSeriesItem | null, viewType: ViewType, fallbackSeriesId: string): string {
  return `${getSeriesDisplayName(series, fallbackSeriesId)} 路 ${viewType}`
}

export function createTab(series: FolderSeriesItem, viewType: ViewType): ViewerTabItem {
  const seriesTitle = getSeriesDisplayName(series, series.seriesId)

  return {
    key: createTabKey(series.seriesId, viewType),
    seriesId: series.seriesId,
    seriesTitle,
    title: `${seriesTitle} 路 ${viewType}`,
    viewType,
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    viewportViewIds: createEmptyMprViewIds(),
    viewportImages: createEmptyMprImages(),
    viewportSliceLabels: createEmptyMprSliceLabels(),
    mprCursor: null,
    mprFrame: null,
    viewportPlanes: createEmptyMprPlanes(),
    viewportCrosshairs: createEmptyMprCrosshairs(),
    viewportScaleBars: createEmptyMprScaleBars(),
    cornerInfo: createEmptyCornerInfo(),
    viewportCornerInfos: createEmptyMprCornerInfos(),
    orientation: createEmptyOrientationInfo(),
    viewportOrientations: createEmptyMprOrientations(),
    transformState: createDefaultTransformInfo(),
    viewportTransformStates: createEmptyMprTransformStates(),
    scaleBar: null,
    pseudocolorPreset: DEFAULT_PSEUDOCOLOR_PRESET,
    viewportPseudocolorPresets: createEmptyMprPseudocolorPresets(),
    mprMipConfig: createDefaultMprMipConfig(),
    volumePreset: 'volumePreset:aaa',
    volumeRenderConfig: createDefaultVolumeRenderConfig('aaa'),
    tagIndex: 0,
    tagTotal: 0,
    tagItems: [],
    tagFilePath: null,
    tagSopInstanceUid: null,
    tagInstanceNumber: null,
    tagIsLoading: false,
    tagLoadError: null,
    fourDPhaseIndex: 0,
    fourDPhaseCount: 10,
    fourDPhaseItems: createDefaultFourDPhaseItems(10),
    fourDPlaybackFps: 2
  }
}
