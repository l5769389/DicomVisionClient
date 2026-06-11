import type { MprSegmentationVoiBox, MprViewportKey } from '../../types/viewer'
import { normalizeMprSegmentationVoiBox } from '../../types/viewer'

export type VoiAxis = 'x' | 'y' | 'z'
export type VoiResizeHandle = 'nw' | 'ne' | 'se' | 'sw'

export interface NormalizedVoiPoint {
  x: number
  y: number
}

export interface NormalizedVoiRect {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface VoiPlaneAxes {
  horizontal: VoiAxis
  vertical: VoiAxis
}

const MIN_VOI_RECT_SIZE = 0.01
const NORMALIZED_PRECISION = 1_000_000

function roundNormalized(value: number): number {
  return Math.round(value * NORMALIZED_PRECISION) / NORMALIZED_PRECISION
}

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return roundNormalized(Math.max(0, Math.min(1, value)))
}

export function getVoiPlaneAxes(viewportKey: MprViewportKey): VoiPlaneAxes {
  if (viewportKey === 'mpr-cor') {
    return {
      horizontal: 'x',
      vertical: 'z'
    }
  }
  if (viewportKey === 'mpr-sag') {
    return {
      horizontal: 'y',
      vertical: 'z'
    }
  }
  return {
    horizontal: 'x',
    vertical: 'y'
  }
}

function getAxisRange(box: MprSegmentationVoiBox, axis: VoiAxis): [number, number] {
  if (axis === 'x') {
    return [box.xMin, box.xMax]
  }
  if (axis === 'y') {
    return [box.yMin, box.yMax]
  }
  return [box.zMin, box.zMax]
}

function setAxisRange(box: MprSegmentationVoiBox, axis: VoiAxis, min: number, max: number): MprSegmentationVoiBox {
  if (axis === 'x') {
    return {
      ...box,
      xMin: min,
      xMax: max
    }
  }
  if (axis === 'y') {
    return {
      ...box,
      yMin: min,
      yMax: max
    }
  }
  return {
    ...box,
    zMin: min,
    zMax: max
  }
}

export function normalizeVoiRect(rect: NormalizedVoiRect): NormalizedVoiRect {
  const xA = clampUnit(rect.xMin)
  const xB = clampUnit(rect.xMax)
  const yA = clampUnit(rect.yMin)
  const yB = clampUnit(rect.yMax)

  return {
    xMin: Math.min(xA, xB),
    xMax: Math.max(xA, xB),
    yMin: Math.min(yA, yB),
    yMax: Math.max(yA, yB)
  }
}

function expandTinyRect(rect: NormalizedVoiRect): NormalizedVoiRect {
  const normalized = normalizeVoiRect(rect)
  const width = normalized.xMax - normalized.xMin
  const height = normalized.yMax - normalized.yMin
  const centerX = (normalized.xMin + normalized.xMax) / 2
  const centerY = (normalized.yMin + normalized.yMax) / 2
  const halfWidth = Math.max(width, MIN_VOI_RECT_SIZE) / 2
  const halfHeight = Math.max(height, MIN_VOI_RECT_SIZE) / 2

  return normalizeVoiRect({
    xMin: centerX - halfWidth,
    xMax: centerX + halfWidth,
    yMin: centerY - halfHeight,
    yMax: centerY + halfHeight
  })
}

export function getVoiPlaneRect(box: MprSegmentationVoiBox, viewportKey: MprViewportKey): NormalizedVoiRect {
  const normalizedBox = normalizeMprSegmentationVoiBox(box)
  const axes = getVoiPlaneAxes(viewportKey)
  const [xMin, xMax] = getAxisRange(normalizedBox, axes.horizontal)
  const [yMin, yMax] = getAxisRange(normalizedBox, axes.vertical)
  return normalizeVoiRect({
    xMin,
    xMax,
    yMin,
    yMax
  })
}

export function normalizeVoiRectFromPoints(
  anchor: NormalizedVoiPoint,
  current: NormalizedVoiPoint
): NormalizedVoiRect {
  return expandTinyRect({
    xMin: anchor.x,
    xMax: current.x,
    yMin: anchor.y,
    yMax: current.y
  })
}

export function updateVoiBoxFromPlaneRect(
  box: MprSegmentationVoiBox,
  viewportKey: MprViewportKey,
  rect: NormalizedVoiRect
): MprSegmentationVoiBox {
  const normalizedBox = normalizeMprSegmentationVoiBox(box)
  const normalizedRect = normalizeVoiRect(rect)
  const axes = getVoiPlaneAxes(viewportKey)
  const withHorizontal = setAxisRange(normalizedBox, axes.horizontal, normalizedRect.xMin, normalizedRect.xMax)
  return normalizeMprSegmentationVoiBox(setAxisRange(withHorizontal, axes.vertical, normalizedRect.yMin, normalizedRect.yMax))
}

export function translateVoiPlaneRect(
  rect: NormalizedVoiRect,
  deltaX: number,
  deltaY: number
): NormalizedVoiRect {
  const normalized = normalizeVoiRect(rect)
  const width = normalized.xMax - normalized.xMin
  const height = normalized.yMax - normalized.yMin
  const nextXMin = clampUnit(normalized.xMin + deltaX)
  const nextYMin = clampUnit(normalized.yMin + deltaY)
  const xMin = Math.min(nextXMin, 1 - width)
  const yMin = Math.min(nextYMin, 1 - height)

  return normalizeVoiRect({
    xMin,
    xMax: xMin + width,
    yMin,
    yMax: yMin + height
  })
}

export function resizeVoiPlaneRect(
  rect: NormalizedVoiRect,
  handle: VoiResizeHandle,
  point: NormalizedVoiPoint
): NormalizedVoiRect {
  const normalized = normalizeVoiRect(rect)
  const nextPoint = {
    x: clampUnit(point.x),
    y: clampUnit(point.y)
  }

  if (handle === 'nw') {
    return expandTinyRect({
      ...normalized,
      xMin: nextPoint.x,
      yMin: nextPoint.y
    })
  }
  if (handle === 'ne') {
    return expandTinyRect({
      ...normalized,
      xMax: nextPoint.x,
      yMin: nextPoint.y
    })
  }
  if (handle === 'se') {
    return expandTinyRect({
      ...normalized,
      xMax: nextPoint.x,
      yMax: nextPoint.y
    })
  }
  return expandTinyRect({
    ...normalized,
    xMin: nextPoint.x,
    yMax: nextPoint.y
  })
}
