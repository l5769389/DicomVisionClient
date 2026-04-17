import type { AnnotationOverlay, MeasurementDraftPoint } from '../../types/viewer'

const DISTINCT_POINT_EPSILON = 0.001
const ANNOTATION_HANDLE_HIT_RADIUS_PX = 14
const ANNOTATION_LINE_HIT_RADIUS_PX = 16

export interface AnnotationHitResult {
  hit: boolean
  handleIndex: number | null
  score: number
}

function isDistinctPoint(a: MeasurementDraftPoint, b: MeasurementDraftPoint): boolean {
  return Math.abs(a.x - b.x) > DISTINCT_POINT_EPSILON || Math.abs(a.y - b.y) > DISTINCT_POINT_EPSILON
}

export function isValidArrowAnnotation(points: MeasurementDraftPoint[]): boolean {
  return points.length >= 2 && isDistinctPoint(points[0], points[1])
}

export function findArrowHandleIndexAtPoint(
  points: MeasurementDraftPoint[],
  point: MeasurementDraftPoint,
  rect: DOMRect
): number | null {
  let bestIndex: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < Math.min(points.length, 2); index += 1) {
    const dx = (points[index].x - point.x) * rect.width
    const dy = (points[index].y - point.y) * rect.height
    const distance = dx * dx + dy * dy
    if (distance <= ANNOTATION_HANDLE_HIT_RADIUS_PX ** 2 && distance < bestDistance) {
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

export function isArrowAnnotationHit(
  annotation: AnnotationOverlay,
  point: MeasurementDraftPoint,
  rect: DOMRect
): AnnotationHitResult {
  const handleIndex = findArrowHandleIndexAtPoint(annotation.points, point, rect)
  if (handleIndex != null) {
    return { hit: true, handleIndex, score: 0 }
  }

  if (annotation.points.length < 2) {
    return { hit: false, handleIndex: null, score: Number.POSITIVE_INFINITY }
  }

  const distance = pointToSegmentDistanceSquared(point, annotation.points[0], annotation.points[1], rect)
  return {
    hit: distance <= ANNOTATION_LINE_HIT_RADIUS_PX ** 2,
    handleIndex: null,
    score: distance
  }
}

export function findArrowAnnotationAtPoint(
  annotations: AnnotationOverlay[],
  point: MeasurementDraftPoint,
  rect: DOMRect
): { annotation: AnnotationOverlay; handleIndex: number | null } | null {
  let bestMatch: { annotation: AnnotationOverlay; handleIndex: number | null; score: number } | null = null

  for (const annotation of annotations) {
    const result = isArrowAnnotationHit(annotation, point, rect)
    if (!result.hit) {
      continue
    }

    if (!bestMatch || result.score <= bestMatch.score) {
      bestMatch = {
        annotation,
        handleIndex: result.handleIndex,
        score: result.score
      }
    }
  }

  return bestMatch ? { annotation: bestMatch.annotation, handleIndex: bestMatch.handleIndex } : null
}

export function translateAnnotationPoints(
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

export function updateEditedArrowPoints(
  points: MeasurementDraftPoint[],
  selectedHandleIndex: number,
  nextPoint: MeasurementDraftPoint
): MeasurementDraftPoint[] {
  return points.map((point, index) => (index === selectedHandleIndex ? nextPoint : point))
}
