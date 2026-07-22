import type { MeasurementDraftPoint, MeasurementToolType } from '../../types/viewer'

const MEASUREMENT_TOOL_TYPES = new Set<MeasurementToolType>([
  'line',
  'rect',
  'ellipse',
  'angle',
  'curve',
  'freeform',
  'alignment-horizontal',
  'alignment-vertical'
])
const POINT_SEQUENCE_TOOL_TYPES = new Set<MeasurementToolType>(['curve', 'freeform'])
const TWO_POINT_LINE_TOOL_TYPES = new Set<MeasurementToolType>([
  'line',
  'alignment-horizontal',
  'alignment-vertical'
])

export interface MeasurementPointRequirement {
  minPoints: number
  acceptsMorePoints: boolean
}

export function isMeasurementToolType(toolType: string | undefined): toolType is MeasurementToolType {
  return MEASUREMENT_TOOL_TYPES.has(toolType as MeasurementToolType)
}

export function isPointSequenceMeasurement(toolType: MeasurementToolType): boolean {
  return POINT_SEQUENCE_TOOL_TYPES.has(toolType)
}

export function isTwoPointLineMeasurement(toolType: MeasurementToolType): boolean {
  return TWO_POINT_LINE_TOOL_TYPES.has(toolType)
}

export function getFinalizedPointSequencePoints(points: MeasurementDraftPoint[]): MeasurementDraftPoint[] {
  if (points.length <= 1) {
    return points
  }
  return points.slice(0, -1)
}

export function getMeasurementPointRequirement(toolType: MeasurementToolType): MeasurementPointRequirement {
  if (toolType === 'angle') {
    return { minPoints: 3, acceptsMorePoints: false }
  }
  if (isPointSequenceMeasurement(toolType)) {
    return { minPoints: toolType === 'curve' ? 2 : 3, acceptsMorePoints: true }
  }
  return { minPoints: 2, acceptsMorePoints: false }
}

export function hasRequiredMeasurementPoints(toolType: MeasurementToolType, pointCount: number): boolean {
  const requirement = getMeasurementPointRequirement(toolType)
  return requirement.acceptsMorePoints
    ? pointCount >= requirement.minPoints
    : pointCount === requirement.minPoints
}
