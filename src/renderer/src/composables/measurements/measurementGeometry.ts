import type { MeasurementDraft, MeasurementDraftPoint, MeasurementOverlay, MeasurementToolType } from '../../types/viewer'
import {
  findRectRoiHandleIndexAtPoint,
  getRectRoiBounds,
  getRectRoiHandlePoints,
  isPointInsideRectRoi,
  updateEditedRectRoiPoints
} from './rectRoiGeometry'

const DISTINCT_POINT_EPSILON = 0.001
const MEASUREMENT_HIT_RADIUS_PX = 14
const FREEHAND_MIN_POINTS = 3

export interface MeasurementHitResult {
  hit: boolean
  handleIndex: number | null
  score: number
}

export type MeasurementPointerDownIntent =
  | { kind: 'edit_handle'; handleIndex: number }
  | { kind: 'select_committed'; measurement: MeasurementOverlay }
  | { kind: 'move_draft' }
  | { kind: 'clear_draft' }
  | { kind: 'create_new' }

export function createMeasurementDraft(
  toolType: MeasurementToolType,
  points: MeasurementDraftPoint[],
  measurementId?: string
): MeasurementDraft {
  return {
    measurementId,
    toolType,
    points
  }
}

export function getMeasurementHandlePoints(
  toolType: MeasurementToolType,
  points: MeasurementDraftPoint[]
): MeasurementDraftPoint[] {
  if ((toolType === 'rect' || toolType === 'ellipse') && points.length >= 2) {
    return getRectRoiHandlePoints(points)
  }
  return points
}

export function isValidMeasurement(toolType: MeasurementToolType, points: MeasurementDraftPoint[]): boolean {
  if (toolType === 'curve') {
    return points.length >= FREEHAND_MIN_POINTS && getPolylineLengthSquared(points) > DISTINCT_POINT_EPSILON ** 2
  }
  if (toolType === 'freeform') {
    return points.length >= FREEHAND_MIN_POINTS && Math.abs(getPolygonSignedArea(points)) > DISTINCT_POINT_EPSILON ** 2
  }
  if (toolType === 'angle') {
    if (points.length < 3) {
      return false
    }
    return isDistinctPoint(points[1], points[0]) && isDistinctPoint(points[1], points[2])
  }
  if (points.length < 2) {
    return false
  }
  return isDistinctPoint(points[0], points[1])
}

function getPolylineLengthSquared(points: MeasurementDraftPoint[]): number {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    length += Math.hypot(current.x - previous.x, current.y - previous.y)
  }
  return length * length
}

function getPolygonSignedArea(points: MeasurementDraftPoint[]): number {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

function isDistinctPoint(a: MeasurementDraftPoint, b: MeasurementDraftPoint): boolean {
  return Math.abs(a.x - b.x) > DISTINCT_POINT_EPSILON || Math.abs(a.y - b.y) > DISTINCT_POINT_EPSILON
}

export function findHandleIndexAtPoint(
  toolType: MeasurementToolType,
  points: MeasurementDraftPoint[],
  point: MeasurementDraftPoint,
  rect: DOMRect
): number | null {
  if ((toolType === 'rect' || toolType === 'ellipse') && points.length >= 2) {
    return findRectRoiHandleIndexAtPoint(points, point, rect, MEASUREMENT_HIT_RADIUS_PX)
  }

  const handles = getMeasurementHandlePoints(toolType, points)
  let bestIndex: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < handles.length; index += 1) {
    const dx = (handles[index].x - point.x) * rect.width
    const dy = (handles[index].y - point.y) * rect.height
    const distance = dx * dx + dy * dy
    if (distance <= MEASUREMENT_HIT_RADIUS_PX * MEASUREMENT_HIT_RADIUS_PX && distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function isFreeformPointInsidePolygon(points: MeasurementDraftPoint[], point: MeasurementDraftPoint): boolean {
  let inside = false
  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index, index += 1) {
    const current = points[index]
    const previous = points[previousIndex]
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || 1e-9) + current.x
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

function getPolylineHitResult(
  points: MeasurementDraftPoint[],
  point: MeasurementDraftPoint,
  rect: DOMRect,
  closePath = false
): MeasurementHitResult {
  let bestDistance = Number.POSITIVE_INFINITY
  const segmentCount = closePath ? points.length : points.length - 1
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    bestDistance = Math.min(bestDistance, pointToSegmentDistanceSquared(point, start, end, rect))
  }

  const hitRadius = MEASUREMENT_HIT_RADIUS_PX * 1.25
  return {
    hit: bestDistance <= hitRadius ** 2,
    handleIndex: null,
    score: bestDistance
  }
}

function pointToSegmentDistanceSquared(
  point: MeasurementDraftPoint,
  start: MeasurementDraftPoint,
  end: MeasurementDraftPoint,
  rect: DOMRect
): number {
  const px = point.x * rect.width
  const py = point.y * rect.height
  const x1 = start.x * rect.width
  const y1 = start.y * rect.height
  const x2 = end.x * rect.width
  const y2 = end.y * rect.height
  const dx = x2 - x1
  const dy = y2 - y1
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    const ox = px - x1
    const oy = py - y1
    return ox * ox + oy * oy
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  const cx = x1 + dx * t
  const cy = y1 + dy * t
  const ox = px - cx
  const oy = py - cy
  return ox * ox + oy * oy
}

export function isMeasurementHit(
  measurement: MeasurementOverlay,
  point: MeasurementDraftPoint,
  rect: DOMRect
): MeasurementHitResult {
  const handleIndex = findHandleIndexAtPoint(measurement.toolType, measurement.points, point, rect)
  if (handleIndex != null) {
    return { hit: true, handleIndex, score: 0 }
  }

  if (measurement.toolType === 'line' && measurement.points.length >= 2) {
    const distance = pointToSegmentDistanceSquared(point, measurement.points[0], measurement.points[1], rect)
    const hitRadius = MEASUREMENT_HIT_RADIUS_PX * 1.35
    return {
      hit: distance <= hitRadius ** 2,
      handleIndex: null,
      score: distance
    }
  }

  if (measurement.toolType === 'curve' && measurement.points.length >= 2) {
    return getPolylineHitResult(measurement.points, point, rect)
  }

  if (measurement.toolType === 'freeform' && measurement.points.length >= 3) {
    const edgeHit = getPolylineHitResult(measurement.points, point, rect, true)
    if (edgeHit.hit) {
      return edgeHit
    }
    const inside = isFreeformPointInsidePolygon(measurement.points, point)
    return {
      hit: inside,
      handleIndex: null,
      score: inside ? MEASUREMENT_HIT_RADIUS_PX ** 2 : Number.POSITIVE_INFINITY
    }
  }

  if ((measurement.toolType === 'rect' || measurement.toolType === 'ellipse') && measurement.points.length >= 2) {
    const bounds = getRectRoiBounds(measurement.points)
    if (!bounds) {
      return { hit: false, handleIndex: null, score: Number.POSITIVE_INFINITY }
    }

    if (measurement.toolType === 'rect') {
      const inside = isPointInsideRectRoi(measurement.points, point)
      const pxLeft = Math.abs((point.x - bounds.left) * rect.width)
      const pxRight = Math.abs((bounds.right - point.x) * rect.width)
      const pxTop = Math.abs((point.y - bounds.top) * rect.height)
      const pxBottom = Math.abs((bounds.bottom - point.y) * rect.height)
      const edgeDistance = Math.min(pxLeft, pxRight, pxTop, pxBottom)
      const areaPenalty = (bounds.right - bounds.left) * rect.width * (bounds.bottom - bounds.top) * rect.height * 0.0001
      return {
        hit: inside,
        handleIndex: null,
        score: edgeDistance + areaPenalty
      }
    }
    const cx = (bounds.left + bounds.right) / 2
    const cy = (bounds.top + bounds.bottom) / 2
    const rx = Math.max((bounds.right - bounds.left) / 2, 1e-6)
    const ry = Math.max((bounds.bottom - bounds.top) / 2, 1e-6)
    const nx = (point.x - cx) / rx
    const ny = (point.y - cy) / ry
    const ellipseValue = nx * nx + ny * ny
    const radiusDelta = Math.abs(ellipseValue - 1.0)
    const areaPenalty = (bounds.right - bounds.left) * rect.width * (bounds.bottom - bounds.top) * rect.height * 0.0001
    return {
      hit: ellipseValue <= 1.0,
      handleIndex: null,
      score: radiusDelta * 100 + (ellipseValue < 0.72 ? 40 : 0) + areaPenalty
    }
  }

  if (measurement.toolType === 'angle' && measurement.points.length >= 3) {
    const firstDistance = pointToSegmentDistanceSquared(point, measurement.points[0], measurement.points[1], rect)
    const secondDistance = pointToSegmentDistanceSquared(point, measurement.points[1], measurement.points[2], rect)
    const distance = Math.min(firstDistance, secondDistance)
    const hitRadius = MEASUREMENT_HIT_RADIUS_PX * 1.2
    return {
      hit: distance <= hitRadius ** 2,
      handleIndex: null,
      score: distance
    }
  }

  return { hit: false, handleIndex: null, score: Number.POSITIVE_INFINITY }
}

export function findMeasurementAtPoint(
  measurements: MeasurementOverlay[],
  point: MeasurementDraftPoint,
  rect: DOMRect,
  excludeMeasurementId?: string
): { measurement: MeasurementOverlay; handleIndex: number | null } | null {
  let bestMatch: { measurement: MeasurementOverlay; handleIndex: number | null; score: number } | null = null
  for (const measurement of measurements) {
    if (measurement.measurementId === excludeMeasurementId) {
      continue
    }
    const result = isMeasurementHit(measurement, point, rect)
    if (!result.hit) {
      continue
    }
    if (!bestMatch || result.score <= bestMatch.score) {
      bestMatch = {
        measurement,
        handleIndex: result.handleIndex,
        score: result.score
      }
    }
  }
  return bestMatch ? { measurement: bestMatch.measurement, handleIndex: bestMatch.handleIndex } : null
}

export function resolveMeasurementPointerDownIntent(params: {
  committedMeasurements: MeasurementOverlay[]
  existingDraft: MeasurementDraft | null
  point: MeasurementDraftPoint
  rect: DOMRect
}): MeasurementPointerDownIntent {
  const { committedMeasurements, existingDraft, point, rect } = params

  if (existingDraft?.measurementId) {
    const handleIndex = findHandleIndexAtPoint(existingDraft.toolType, existingDraft.points, point, rect)
    if (handleIndex != null) {
      return { kind: 'edit_handle', handleIndex }
    }

    const currentDraftHit = isMeasurementHit(
      {
        measurementId: existingDraft.measurementId,
        toolType: existingDraft.toolType,
        points: existingDraft.points,
        labelLines: existingDraft.labelLines ?? []
      },
      point,
      rect
    )
    if (currentDraftHit.hit) {
      return { kind: 'move_draft' }
    }
  }

  const committedMeasurementHit = findMeasurementAtPoint(
    committedMeasurements,
    point,
    rect,
    existingDraft?.measurementId
  )
  if (committedMeasurementHit) {
    return {
      kind: 'select_committed',
      measurement: committedMeasurementHit.measurement
    }
  }

  if (existingDraft?.measurementId) {
    return { kind: 'clear_draft' }
  }

  return { kind: 'create_new' }
}

export function updateEditedMeasurementPoints(
  toolType: MeasurementToolType,
  points: MeasurementDraftPoint[],
  selectedHandleIndex: number,
  nextPoint: MeasurementDraftPoint
): MeasurementDraftPoint[] {
  if (toolType === 'line' || toolType === 'angle' || toolType === 'curve' || toolType === 'freeform') {
    return points.map((point, index) => (index === selectedHandleIndex ? nextPoint : point))
  }
  if ((toolType === 'rect' || toolType === 'ellipse') && points.length >= 2) {
    return updateEditedRectRoiPoints(points, selectedHandleIndex, nextPoint)
  }
  return points
}

export function translateMeasurementPoints(
  points: MeasurementDraftPoint[],
  deltaX: number,
  deltaY: number
): MeasurementDraftPoint[] {
  if (!points.length) {
    return points
  }

  const clampedDeltaX = Math.max(
    Math.max(...points.map((currentPoint) => -currentPoint.x)),
    Math.min(deltaX, Math.min(...points.map((currentPoint) => 1 - currentPoint.x)))
  )
  const clampedDeltaY = Math.max(
    Math.max(...points.map((currentPoint) => -currentPoint.y)),
    Math.min(deltaY, Math.min(...points.map((currentPoint) => 1 - currentPoint.y)))
  )

  return points.map((currentPoint) => ({
    x: currentPoint.x + clampedDeltaX,
    y: currentPoint.y + clampedDeltaY
  }))
}
