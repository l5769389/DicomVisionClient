import type {
  CornerInfo,
  CornerPosition,
  FolderSeriesItem,
  MprViewportKey,
  OrientationInfo,
  ViewTransformInfo,
  ViewerTabItem,
  ViewType
} from '../../../types/viewer'
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
    viewportCrosshairs: createEmptyMprCrosshairs(),
    cornerInfo: createEmptyCornerInfo(),
    viewportCornerInfos: createEmptyMprCornerInfos(),
    orientation: createEmptyOrientationInfo(),
    viewportOrientations: createEmptyMprOrientations(),
    transformState: createDefaultTransformInfo(),
    viewportTransformStates: createEmptyMprTransformStates(),
    pseudocolorPreset: DEFAULT_PSEUDOCOLOR_PRESET,
    viewportPseudocolorPresets: createEmptyMprPseudocolorPresets(),
    volumePreset: 'volumePreset:aaa',
    volumeRenderConfig: createDefaultVolumeRenderConfig('aaa'),
    tagIndex: 0,
    tagTotal: 0,
    tagItems: [],
    tagFilePath: null,
    tagSopInstanceUid: null,
    tagInstanceNumber: null,
    tagIsLoading: false,
    tagLoadError: null
  }
}
