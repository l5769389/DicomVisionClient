import { describe, expect, it } from 'vitest'
import { buildAlignmentGuideGeometry } from './alignmentGuideGeometry'

describe('buildAlignmentGuideGeometry', () => {
  it('projects the source horizontal reference through display rotation', () => {
    const guide = buildAlignmentGuideGeometry(
      'alignment-horizontal',
      [{ x: 40, y: 20 }, { x: 100, y: 70 }],
      { rotationDegrees: 90, horFlip: false, verFlip: false }
    )

    expect(guide).not.toBeNull()
    expect(guide!.x1).toBeCloseTo(40)
    expect(guide!.x2).toBeCloseTo(40)
    expect(guide!.arcPath).not.toBe('')
  })

  it('keeps the guide equivalent when the measured endpoints are reversed', () => {
    const forward = buildAlignmentGuideGeometry(
      'alignment-horizontal',
      [{ x: 10, y: 10 }, { x: 110, y: 35 }],
      { rotationDegrees: 0, horFlip: false, verFlip: false }
    )
    const reversed = buildAlignmentGuideGeometry(
      'alignment-horizontal',
      [{ x: 110, y: 35 }, { x: 10, y: 10 }],
      { rotationDegrees: 0, horFlip: false, verFlip: false }
    )

    expect(forward?.arcPath).not.toBe('')
    expect(reversed?.arcPath).not.toBe('')
    expect(Math.abs((forward!.x2 - forward!.x1))).toBeCloseTo(Math.abs(reversed!.x2 - reversed!.x1))
  })

  it('does not create a guide for ordinary line measurements', () => {
    expect(buildAlignmentGuideGeometry('line', [{ x: 0, y: 0 }, { x: 100, y: 0 }], null)).toBeNull()
  })
})
