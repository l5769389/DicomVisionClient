import type { MprCrosshairInfo } from '../../types/viewer'
import type { CrosshairLineTarget, MprViewportCrosshairGeometry } from '../workspace/views/mprFrameGeometry'

const CROSSHAIR_LINE_HIT_TOLERANCE_PX = 6
const CROSSHAIR_ROTATION_DEAD_ZONE_PX = 18

export type CrosshairHitTarget = 'center' | CrosshairLineTarget | 'none'

interface NormalizedPoint {
  x: number
  y: number
}

export interface CrosshairRotationDragState {
  centerX: number
  centerY: number
  startPointerAngleRad: number
  lastPointerAngleRad: number
}

interface CrosshairRotationDragInput {
  containerRect: DOMRect
  imageRect: DOMRect
  geometry: Pick<MprViewportCrosshairGeometry, 'center'>
}

function resolveViewportPixelPoint(
  viewportPoint: NormalizedPoint,
  input: { containerRect: DOMRect; imageRect: DOMRect }
): { pointerX: number; pointerY: number } | null {
  const { containerRect, imageRect } = input
  if (!containerRect.width || !containerRect.height || !imageRect.width || !imageRect.height) {
    return null
  }
  return {
    pointerX: imageRect.left - containerRect.left + viewportPoint.x * imageRect.width,
    pointerY: imageRect.top - containerRect.top + viewportPoint.y * imageRect.height
  }
}

function resolvePointerAngleRad(pointerX: number, pointerY: number, centerX: number, centerY: number): number {
  // Keep drag deltas in the same screen-space convention as the rendered
  // crosshair angles: +Y points downward in canvas coordinates.
  return Math.atan2(pointerY - centerY, pointerX - centerX)
}

export function createCrosshairRotationDragState(
  viewportPoint: NormalizedPoint,
  input: CrosshairRotationDragInput
): { dragState: CrosshairRotationDragState; x: number; y: number } | null {
  const pixelPoint = resolveViewportPixelPoint(viewportPoint, input)
  if (!pixelPoint) {
    return null
  }
  const { containerRect, imageRect, geometry } = input
  const centerX = imageRect.left - containerRect.left + geometry.center.x * imageRect.width
  const centerY = imageRect.top - containerRect.top + geometry.center.y * imageRect.height
  const pointerAngleRad = resolvePointerAngleRad(pixelPoint.pointerX, pixelPoint.pointerY, centerX, centerY)
  return {
    dragState: {
      centerX,
      centerY,
      startPointerAngleRad: pointerAngleRad,
      lastPointerAngleRad: pointerAngleRad
    },
    x: viewportPoint.x,
    y: viewportPoint.y
  }
}

export function resolveCrosshairRotationDeltaPayload(
  viewportPoint: NormalizedPoint,
  input: { containerRect: DOMRect; imageRect: DOMRect; dragState: CrosshairRotationDragState }
): { deltaAngleRad: number; x: number; y: number; lastPointerAngleRad: number } | null {
  const pixelPoint = resolveViewportPixelPoint(viewportPoint, input)
  if (!pixelPoint) {
    return null
  }
  const currentPointerAngleRad = resolvePointerAngleRad(
    pixelPoint.pointerX,
    pixelPoint.pointerY,
    input.dragState.centerX,
    input.dragState.centerY
  )
  const unwrappedPointerAngleRad = unwrapAngleAround(currentPointerAngleRad, input.dragState.lastPointerAngleRad)
  return {
    deltaAngleRad: unwrappedPointerAngleRad - input.dragState.startPointerAngleRad,
    lastPointerAngleRad: unwrappedPointerAngleRad,
    x: viewportPoint.x,
    y: viewportPoint.y
  }
}

export function toMprObliqueDeltaAngleRad(screenDeltaAngleRad: number): number {
  // Protocol contract: deltaAngleRad is cumulative from drag start in the
  // same screen-space convention used by the rendered crosshair angles.
  return screenDeltaAngleRad
}

function unwrapAngleAround(angleRad: number, referenceRad: number): number {
  const fullTurn = Math.PI * 2
  let nextAngle = angleRad
  while (nextAngle - referenceRad > Math.PI) {
    nextAngle -= fullTurn
  }
  while (nextAngle - referenceRad <= -Math.PI) {
    nextAngle += fullTurn
  }
  return nextAngle
}

export function resolveCrosshairHitTarget(input: {
  containerPoint: NormalizedPoint
  crosshairInfo: MprCrosshairInfo | null | undefined
  containerRect: DOMRect
  imageRect: DOMRect
  geometry: MprViewportCrosshairGeometry | null | undefined
}): CrosshairHitTarget {
  const { containerPoint, crosshairInfo, containerRect, imageRect, geometry } = input
  if (!crosshairInfo || !geometry || !containerRect.width || !containerRect.height || !imageRect.width || !imageRect.height) {
    return 'none'
  }

  const imageOffsetX = imageRect.left - containerRect.left
  const imageOffsetY = imageRect.top - containerRect.top
  const minDimension = Math.min(imageRect.width, imageRect.height)
  const hitRadius = crosshairInfo.hitRadius * minDimension
  const deltaX = containerPoint.x * containerRect.width - (imageOffsetX + geometry.center.x * imageRect.width)
  const deltaY = containerPoint.y * containerRect.height - (imageOffsetY + geometry.center.y * imageRect.height)
  const distanceFromCenterSquared = deltaX * deltaX + deltaY * deltaY
  if (distanceFromCenterSquared <= hitRadius * hitRadius) {
    return 'center'
  }

  const pointerX = containerPoint.x * containerRect.width
  const pointerY = containerPoint.y * containerRect.height
  const centerX = imageOffsetX + geometry.center.x * imageRect.width
  const centerY = imageOffsetY + geometry.center.y * imageRect.height
  const lineTolerance = Math.max(CROSSHAIR_LINE_HIT_TOLERANCE_PX, hitRadius * 0.45)
  const rotationDeadZone = Math.max(CROSSHAIR_ROTATION_DEAD_ZONE_PX, hitRadius + 4)
  if (distanceFromCenterSquared <= rotationDeadZone * rotationDeadZone) {
    return 'none'
  }

  const distanceToLine = (line: CrosshairLineTarget): number => {
    const angle = line === 'vertical' ? geometry.verticalAngleRad : geometry.horizontalAngleRad
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)
    return Math.abs((pointerX - centerX) * dirY - (pointerY - centerY) * dirX)
  }
  const horizontalDistance = distanceToLine('horizontal')
  const verticalDistance = distanceToLine('vertical')
  const closestLine = horizontalDistance <= verticalDistance ? 'horizontal' : 'vertical'
  const closestDistance = Math.min(horizontalDistance, verticalDistance)

  return closestDistance <= lineTolerance ? closestLine : 'none'
}
