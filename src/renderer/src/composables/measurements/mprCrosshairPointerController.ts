import type { MprCrosshairInfo } from '../../types/viewer'
import type { CrosshairLineTarget, MprViewportCrosshairGeometry } from '../workspace/views/mprFrameGeometry'

const CROSSHAIR_LINE_HIT_TOLERANCE_PX = 6
const CROSSHAIR_ROTATION_DEAD_ZONE_PX = 18

export type CrosshairHitTarget = 'center' | CrosshairLineTarget | 'none'

interface NormalizedPoint {
  x: number
  y: number
}

interface CrosshairPointerGeometryInput {
  containerRect: DOMRect
  imageRect: DOMRect
  geometry: MprViewportCrosshairGeometry
}

export function resolveCrosshairRotationPayload(
  viewportPoint: NormalizedPoint,
  input: CrosshairPointerGeometryInput & { line: CrosshairLineTarget }
): { angleRad: number; x: number; y: number } | null {
  const { containerRect, imageRect, geometry } = input
  if (!containerRect.width || !containerRect.height || !imageRect.width || !imageRect.height) {
    return null
  }
  const pointerX = imageRect.left - containerRect.left + viewportPoint.x * imageRect.width
  const pointerY = imageRect.top - containerRect.top + viewportPoint.y * imageRect.height
  const centerX = imageRect.left - containerRect.left + geometry.center.x * imageRect.width
  const centerY = imageRect.top - containerRect.top + geometry.center.y * imageRect.height
  const screenLineAngle = input.line === 'vertical' ? geometry.verticalAngleRad : geometry.horizontalAngleRad
  const rawGeometryAngle = Math.atan2(centerY - pointerY, pointerX - centerX)
  const referenceGeometryAngle = resolveNearestUndirectedLineAngle(rawGeometryAngle, -screenLineAngle)
  return {
    angleRad: unwrapAngleAround(rawGeometryAngle, referenceGeometryAngle),
    x: viewportPoint.x,
    y: viewportPoint.y
  }
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

function resolveNearestUndirectedLineAngle(angleRad: number, lineAngleRad: number): number {
  const candidates = [lineAngleRad - Math.PI, lineAngleRad, lineAngleRad + Math.PI]
  return candidates.reduce((nearest, candidate) =>
    Math.abs(angleRad - candidate) < Math.abs(angleRad - nearest) ? candidate : nearest
  )
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
