import type { MeasurementDraftPoint } from '../../types/viewer'
import { translateMeasurementPoints } from './measurementGeometry'
import { updateEditedRectRoiPoints } from './rectRoiGeometry'

export function hasRectRoiDragExceededThreshold(
  startPoint: MeasurementDraftPoint,
  currentPoint: MeasurementDraftPoint,
  imageRect: DOMRect,
  thresholdPx: number
): boolean {
  const movementX = (currentPoint.x - startPoint.x) * imageRect.width
  const movementY = (currentPoint.y - startPoint.y) * imageRect.height
  return Math.max(Math.abs(movementX), Math.abs(movementY)) >= thresholdPx
}

export function buildRectRoiDraftPoints(
  anchorPoint: MeasurementDraftPoint,
  currentPoint: MeasurementDraftPoint
): MeasurementDraftPoint[] {
  return [anchorPoint, currentPoint]
}

export function moveRectRoiDraftPoints(
  points: MeasurementDraftPoint[],
  lastPoint: MeasurementDraftPoint,
  currentPoint: MeasurementDraftPoint
): MeasurementDraftPoint[] {
  return translateMeasurementPoints(points, currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y)
}

export function editRectRoiDraftPoints(
  points: MeasurementDraftPoint[],
  handleIndex: number,
  currentPoint: MeasurementDraftPoint
): MeasurementDraftPoint[] {
  return updateEditedRectRoiPoints(points, handleIndex, currentPoint)
}
