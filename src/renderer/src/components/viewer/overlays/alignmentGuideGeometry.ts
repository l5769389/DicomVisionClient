import type { MeasurementToolType, ViewTransformInfo } from '../../../types/viewer'
import type { OverlayScreenPoint } from './overlayGeometry'

export interface AlignmentGuideGeometry {
  x1: number
  y1: number
  x2: number
  y2: number
  arcPath: string
}

function rotateVector(x: number, y: number, degrees: number): OverlayScreenPoint {
  const radians = (degrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return { x: cosine * x - sine * y, y: sine * x + cosine * y }
}

export function buildAlignmentGuideGeometry(
  toolType: MeasurementToolType,
  screenPoints: OverlayScreenPoint[],
  transform: ViewTransformInfo | null | undefined
): AlignmentGuideGeometry | null {
  if ((toolType !== 'alignment-horizontal' && toolType !== 'alignment-vertical') || screenPoints.length < 2) {
    return null
  }

  const [anchor, end] = screenPoints
  const measuredX = end.x - anchor.x
  const measuredY = end.y - anchor.y
  const measuredLength = Math.hypot(measuredX, measuredY)
  if (measuredLength < 0.5) {
    return null
  }

  const sourceAxis = toolType === 'alignment-horizontal'
    ? { x: transform?.horFlip ? -1 : 1, y: 0 }
    : { x: 0, y: transform?.verFlip ? -1 : 1 }
  let reference = rotateVector(sourceAxis.x, sourceAxis.y, transform?.rotationDegrees ?? 0)
  const measuredUnit = { x: measuredX / measuredLength, y: measuredY / measuredLength }
  if (reference.x * measuredUnit.x + reference.y * measuredUnit.y < 0) {
    reference = { x: -reference.x, y: -reference.y }
  }

  const guideHalfLength = Math.max(42, Math.min(72, measuredLength * 0.65))
  const radius = Math.max(18, Math.min(34, measuredLength * 0.28))
  const referenceAngle = Math.atan2(reference.y, reference.x)
  const measuredAngle = Math.atan2(measuredUnit.y, measuredUnit.x)
  let delta = measuredAngle - referenceAngle
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2

  const arcStart = {
    x: anchor.x + reference.x * radius,
    y: anchor.y + reference.y * radius
  }
  const arcEnd = {
    x: anchor.x + measuredUnit.x * radius,
    y: anchor.y + measuredUnit.y * radius
  }

  return {
    x1: anchor.x - reference.x * guideHalfLength,
    y1: anchor.y - reference.y * guideHalfLength,
    x2: anchor.x + reference.x * guideHalfLength,
    y2: anchor.y + reference.y * guideHalfLength,
    arcPath: Math.abs(delta) < 0.005
      ? ''
      : `M ${arcStart.x},${arcStart.y} A ${radius},${radius} 0 0 ${delta >= 0 ? 1 : 0} ${arcEnd.x},${arcEnd.y}`
  }
}
