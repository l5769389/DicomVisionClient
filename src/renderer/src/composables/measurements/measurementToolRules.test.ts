import { describe, expect, it } from 'vitest'
import {
  getFinalizedPointSequencePoints,
  getMeasurementPointRequirement,
  hasRequiredMeasurementPoints,
  isMeasurementToolType,
  isPointSequenceMeasurement,
  isTwoPointLineMeasurement
} from './measurementToolRules'

describe('measurementToolRules', () => {
  it('recognizes measurement and point-sequence tools', () => {
    expect(isMeasurementToolType('line')).toBe(true)
    expect(isMeasurementToolType('alignment-horizontal')).toBe(true)
    expect(isMeasurementToolType('freeform')).toBe(true)
    expect(isMeasurementToolType('mtf')).toBe(false)
    expect(isPointSequenceMeasurement('curve')).toBe(true)
    expect(isPointSequenceMeasurement('rect')).toBe(false)
    expect(isTwoPointLineMeasurement('alignment-vertical')).toBe(true)
    expect(isTwoPointLineMeasurement('angle')).toBe(false)
  })

  it('resolves minimum point requirements', () => {
    expect(getMeasurementPointRequirement('line')).toEqual({ minPoints: 2, acceptsMorePoints: false })
    expect(getMeasurementPointRequirement('alignment-horizontal')).toEqual({ minPoints: 2, acceptsMorePoints: false })
    expect(getMeasurementPointRequirement('angle')).toEqual({ minPoints: 3, acceptsMorePoints: false })
    expect(getMeasurementPointRequirement('curve')).toEqual({ minPoints: 2, acceptsMorePoints: true })
    expect(getMeasurementPointRequirement('freeform')).toEqual({ minPoints: 3, acceptsMorePoints: true })
    expect(hasRequiredMeasurementPoints('curve', 4)).toBe(true)
    expect(hasRequiredMeasurementPoints('line', 3)).toBe(false)
  })

  it('drops the preview point from unfinished point sequences', () => {
    expect(
      getFinalizedPointSequencePoints([
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2 },
        { x: 0.2, y: 0.2 }
      ])
    ).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 }
    ])
  })
})
