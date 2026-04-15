import type { MeasurementDraftPoint, ViewerMtfItem } from '../../types/viewer'
import { translateMeasurementPoints } from './measurementGeometry'
import {
  RECT_ROI_HANDLE_HIT_RADIUS_PX,
  findRectRoiHandleIndexAtPoint,
  getRectRoiHandlePoints,
  isPointInsideRectRoi,
  updateEditedRectRoiPoints
} from './rectRoiGeometry'

export type MtfPointerDownIntent =
  | { kind: 'edit_handle'; handleIndex: number }
  | { kind: 'select_item'; item: ViewerMtfItem }
  | { kind: 'move_selected' }
  | { kind: 'clear_selection' }
  | { kind: 'create_new' }

export function getMtfHandlePoints(points: MeasurementDraftPoint[]): MeasurementDraftPoint[] {
  return getRectRoiHandlePoints(points)
}

export function findMtfHandleIndexAtPoint(
  points: MeasurementDraftPoint[],
  point: MeasurementDraftPoint,
  rect: DOMRect
): number | null {
  return findRectRoiHandleIndexAtPoint(points, point, rect, RECT_ROI_HANDLE_HIT_RADIUS_PX)
}

export function isMtfRoiHit(points: MeasurementDraftPoint[], point: MeasurementDraftPoint): boolean {
  return isPointInsideRectRoi(points, point)
}

export function findMtfItemAtPoint(items: ViewerMtfItem[], point: MeasurementDraftPoint): ViewerMtfItem | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isMtfRoiHit(items[index].points, point)) {
      return items[index]
    }
  }

  return null
}

export function resolveMtfPointerDownIntent(params: {
  items: ViewerMtfItem[]
  selectedItem: ViewerMtfItem | null
  point: MeasurementDraftPoint
  rect: DOMRect
}): MtfPointerDownIntent {
  const { items, selectedItem, point, rect } = params

  if (selectedItem) {
    const handleIndex = findMtfHandleIndexAtPoint(selectedItem.points, point, rect)
    if (handleIndex != null) {
      return { kind: 'edit_handle', handleIndex }
    }

    if (isMtfRoiHit(selectedItem.points, point)) {
      return { kind: 'move_selected' }
    }
  }

  const hitItem = findMtfItemAtPoint(items, point)
  if (hitItem) {
    return { kind: 'select_item', item: hitItem }
  }

  if (selectedItem) {
    return { kind: 'clear_selection' }
  }

  return { kind: 'create_new' }
}

export function updateEditedMtfPoints(
  points: MeasurementDraftPoint[],
  selectedHandleIndex: number,
  nextPoint: MeasurementDraftPoint
): MeasurementDraftPoint[] {
  return updateEditedRectRoiPoints(points, selectedHandleIndex, nextPoint)
}

export function translateMtfPoints(
  points: MeasurementDraftPoint[],
  deltaX: number,
  deltaY: number
): MeasurementDraftPoint[] {
  return translateMeasurementPoints(points, deltaX, deltaY)
}
