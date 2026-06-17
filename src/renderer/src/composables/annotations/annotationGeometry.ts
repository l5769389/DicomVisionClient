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

export interface AnnotationScreenPoint {
  x: number
  y: number
}

export interface AnnotationProjectionFrame {
  left: number
  top: number
  width: number
  height: number
  naturalWidth?: number
  naturalHeight?: number
}

function normalizedPointToScreenPoint(point: MeasurementDraftPoint, frame: AnnotationProjectionFrame): AnnotationScreenPoint {
  return {
    x: frame.left + point.x * frame.width,
    y: frame.top + point.y * frame.height
  }
}

function pointToScreenSegmentDistanceSquared(
  point: AnnotationScreenPoint,
  start: AnnotationScreenPoint,
  end: AnnotationScreenPoint
): number {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    const ox = point.x - start.x
    const oy = point.y - start.y
    return ox * ox + oy * oy
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  const cx = start.x + dx * t
  const cy = start.y + dy * t
  const ox = point.x - cx
  const oy = point.y - cy
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

export function findArrowAnnotationAtScreenPoint(
  annotations: AnnotationOverlay[],
  point: AnnotationScreenPoint,
  frame: AnnotationProjectionFrame
): { annotation: AnnotationOverlay; handleIndex: number | null } | null {
  let bestMatch: { annotation: AnnotationOverlay; handleIndex: number | null; score: number } | null = null

  for (const annotation of annotations) {
    const screenPoints = annotation.points
      .slice(0, 2)
      .map((annotationPoint) => normalizedPointToScreenPoint(annotationPoint, frame))
    if (!screenPoints.length) {
      continue
    }

    let handleIndex: number | null = null
    let handleScore = Number.POSITIVE_INFINITY
    for (let index = 0; index < screenPoints.length; index += 1) {
      const dx = screenPoints[index].x - point.x
      const dy = screenPoints[index].y - point.y
      const distance = dx * dx + dy * dy
      if (distance <= ANNOTATION_HANDLE_HIT_RADIUS_PX ** 2 && distance < handleScore) {
        handleScore = distance
        handleIndex = index
      }
    }

    const score =
      handleIndex != null
        ? handleScore
        : screenPoints.length >= 2
          ? pointToScreenSegmentDistanceSquared(point, screenPoints[0], screenPoints[1])
          : Number.POSITIVE_INFINITY
    const hit = handleIndex != null || score <= ANNOTATION_LINE_HIT_RADIUS_PX ** 2
    if (!hit) {
      continue
    }

    if (!bestMatch || score <= bestMatch.score) {
      bestMatch = {
        annotation,
        handleIndex,
        score
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
