import type { MeasurementDraftPoint } from '../../../types/viewer'

export interface OverlayImageFrame {
  left: number
  top: number
  width: number
  height: number
}

export interface OverlayScreenPoint {
  x: number
  y: number
}

export interface OverlayRectBounds {
  left: number
  top: number
  width: number
  height: number
}

export function toOverlayScreenPoint(frame: OverlayImageFrame, point: MeasurementDraftPoint): OverlayScreenPoint {
  return {
    x: frame.left + point.x * frame.width,
    y: frame.top + point.y * frame.height
  }
}

export function getOverlayRectBoundsFromScreenPoints(
  screenPoints: OverlayScreenPoint[]
): OverlayRectBounds | null {
  if (screenPoints.length < 2) {
    return null
  }

  const [start, end] = screenPoints
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

export function getOverlayHandlePointsFromRectBounds(
  rectBounds: OverlayRectBounds | null
): OverlayScreenPoint[] {
  if (!rectBounds) {
    return []
  }

  return [
    { x: rectBounds.left, y: rectBounds.top },
    { x: rectBounds.left + rectBounds.width, y: rectBounds.top },
    { x: rectBounds.left + rectBounds.width, y: rectBounds.top + rectBounds.height },
    { x: rectBounds.left, y: rectBounds.top + rectBounds.height }
  ]
}

export function getOverlayRectBounds(
  frame: OverlayImageFrame,
  points: MeasurementDraftPoint[] | undefined | null
): OverlayRectBounds | null {
  if (!points || points.length < 2 || frame.width <= 0 || frame.height <= 0) {
    return null
  }

  return getOverlayRectBoundsFromScreenPoints(points.map((point) => toOverlayScreenPoint(frame, point)))
}
