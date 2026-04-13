import type { MeasurementDraft, MeasurementDraftPoint, MeasurementOverlay, MeasurementToolType } from '../../types/viewer'

const DISTINCT_POINT_EPSILON = 0.001
const MEASUREMENT_HIT_RADIUS_PX = 14

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
    const left = Math.min(points[0].x, points[1].x)
    const right = Math.max(points[0].x, points[1].x)
    const top = Math.min(points[0].y, points[1].y)
    const bottom = Math.max(points[0].y, points[1].y)
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom }
    ]
  }
  return points
}

export function isValidMeasurement(toolType: MeasurementToolType, points: MeasurementDraftPoint[]): boolean {
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

function isDistinctPoint(a: MeasurementDraftPoint, b: MeasurementDraftPoint): boolean {
  return Math.abs(a.x - b.x) > DISTINCT_POINT_EPSILON || Math.abs(a.y - b.y) > DISTINCT_POINT_EPSILON
}

function getDistanceSquared(a: MeasurementDraftPoint, b: MeasurementDraftPoint, rect: DOMRect): number {
  const dx = (a.x - b.x) * rect.width
  const dy = (a.y - b.y) * rect.height
  return dx * dx + dy * dy
}

export function findHandleIndexAtPoint(
  toolType: MeasurementToolType,
  points: MeasurementDraftPoint[],
  point: MeasurementDraftPoint,
  rect: DOMRect
): number | null {
  const handles = getMeasurementHandlePoints(toolType, points)
  let bestIndex: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < handles.length; index += 1) {
    const distance = getDistanceSquared(handles[index], point, rect)
    if (distance <= MEASUREMENT_HIT_RADIUS_PX * MEASUREMENT_HIT_RADIUS_PX && distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
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

  if ((measurement.toolType === 'rect' || measurement.toolType === 'ellipse') && measurement.points.length >= 2) {
    const left = Math.min(measurement.points[0].x, measurement.points[1].x)
    const right = Math.max(measurement.points[0].x, measurement.points[1].x)
    const top = Math.min(measurement.points[0].y, measurement.points[1].y)
    const bottom = Math.max(measurement.points[0].y, measurement.points[1].y)
    if (measurement.toolType === 'rect') {
      const inside = point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
      const pxLeft = Math.abs((point.x - left) * rect.width)
      const pxRight = Math.abs((right - point.x) * rect.width)
      const pxTop = Math.abs((point.y - top) * rect.height)
      const pxBottom = Math.abs((bottom - point.y) * rect.height)
      const edgeDistance = Math.min(pxLeft, pxRight, pxTop, pxBottom)
      const areaPenalty = (right - left) * rect.width * (bottom - top) * rect.height * 0.0001
      return {
        hit: inside,
        handleIndex: null,
        score: edgeDistance + areaPenalty
      }
    }
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const rx = Math.max((right - left) / 2, 1e-6)
    const ry = Math.max((bottom - top) / 2, 1e-6)
    const nx = (point.x - cx) / rx
    const ny = (point.y - cy) / ry
    const ellipseValue = nx * nx + ny * ny
    const radiusDelta = Math.abs(ellipseValue - 1.0)
    const areaPenalty = (right - left) * rect.width * (bottom - top) * rect.height * 0.0001
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
  if (toolType === 'line' || toolType === 'angle') {
    return points.map((point, index) => (index === selectedHandleIndex ? nextPoint : point))
  }
  if ((toolType === 'rect' || toolType === 'ellipse') && points.length >= 2) {
    const handles = getMeasurementHandlePoints(toolType, points)
    const oppositeIndex = (selectedHandleIndex + 2) % 4
    const opposite = handles[oppositeIndex]
    return [
      { x: Math.min(nextPoint.x, opposite.x), y: Math.min(nextPoint.y, opposite.y) },
      { x: Math.max(nextPoint.x, opposite.x), y: Math.max(nextPoint.y, opposite.y) }
    ]
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
