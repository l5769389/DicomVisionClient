import type { MeasurementDraftPoint } from '../../types/viewer'

export const RECT_ROI_HANDLE_HIT_RADIUS_PX = 14

export function getRectRoiBounds(points: MeasurementDraftPoint[]): {
  left: number
  right: number
  top: number
  bottom: number
} | null {
  if (points.length < 2) {
    return null
  }

  return {
    left: Math.min(points[0].x, points[1].x),
    right: Math.max(points[0].x, points[1].x),
    top: Math.min(points[0].y, points[1].y),
    bottom: Math.max(points[0].y, points[1].y)
  }
}

export function getRectRoiHandlePoints(points: MeasurementDraftPoint[]): MeasurementDraftPoint[] {
  const bounds = getRectRoiBounds(points)
  if (!bounds) {
    return points
  }

  return [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom }
  ]
}

function getDistanceSquared(a: MeasurementDraftPoint, b: MeasurementDraftPoint, rect: DOMRect): number {
  const dx = (a.x - b.x) * rect.width
  const dy = (a.y - b.y) * rect.height
  return dx * dx + dy * dy
}

export function findRectRoiHandleIndexAtPoint(
  points: MeasurementDraftPoint[],
  point: MeasurementDraftPoint,
  rect: DOMRect,
  hitRadiusPx = RECT_ROI_HANDLE_HIT_RADIUS_PX
): number | null {
  const handles = getRectRoiHandlePoints(points)
  let bestIndex: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < handles.length; index += 1) {
    const distance = getDistanceSquared(handles[index], point, rect)
    if (distance <= hitRadiusPx * hitRadiusPx && distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  return bestIndex
}

export function isPointInsideRectRoi(points: MeasurementDraftPoint[], point: MeasurementDraftPoint): boolean {
  const bounds = getRectRoiBounds(points)
  if (!bounds) {
    return false
  }

  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom
}

export function updateEditedRectRoiPoints(
  points: MeasurementDraftPoint[],
  selectedHandleIndex: number,
  nextPoint: MeasurementDraftPoint
): MeasurementDraftPoint[] {
  if (points.length < 2) {
    return points
  }

  const handles = getRectRoiHandlePoints(points)
  const oppositeIndex = (selectedHandleIndex + 2) % 4
  const opposite = handles[oppositeIndex]
  return [
    { x: Math.min(nextPoint.x, opposite.x), y: Math.min(nextPoint.y, opposite.y) },
    { x: Math.max(nextPoint.x, opposite.x), y: Math.max(nextPoint.y, opposite.y) }
  ]
}
