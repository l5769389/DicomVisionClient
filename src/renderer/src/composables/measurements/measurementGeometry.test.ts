import { describe, expect, it } from 'vitest'
import type { MeasurementOverlay } from '../../types/viewer'
import {
  createMeasurementDraft,
  findHandleIndexAtPoint,
  findMeasurementAtPoint,
  getSmoothCurveSegments,
  isMeasurementHit,
  isValidMeasurement,
  resolveMeasurementPointerDownIntent,
  sampleSmoothCurvePoints,
  translateMeasurementPoints,
  updateEditedMeasurementPoints
} from './measurementGeometry'

function createRect(left = 0, top = 0, width = 200, height = 100): DOMRect {
  return {
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect
}

describe('measurementGeometry', () => {
  it('validates line and angle measurements', () => {
    expect(
      isValidMeasurement('line', [
        { x: 0.1, y: 0.1 },
        { x: 0.1, y: 0.1 }
      ])
    ).toBe(false)

    expect(
      isValidMeasurement('line', [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.3 }
      ])
    ).toBe(true)

    expect(
      isValidMeasurement('angle', [
        { x: 0.2, y: 0.2 },
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.5 }
      ])
    ).toBe(false)

    expect(
      isValidMeasurement('angle', [
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.4 },
        { x: 0.6, y: 0.5 }
      ])
    ).toBe(true)
  })

  it('validates freehand curve and freeform measurements', () => {
    expect(
      isValidMeasurement('curve', [
        { x: 0.1, y: 0.1 },
        { x: 0.12, y: 0.12 }
      ])
    ).toBe(true)

    expect(
      isValidMeasurement('curve', [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.25 }
      ])
    ).toBe(true)

    expect(
      isValidMeasurement('freeform', [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.1 },
        { x: 0.4, y: 0.5 },
        { x: 0.1, y: 0.5 }
      ])
    ).toBe(true)
  })

  it('builds bezier segments through curve control points', () => {
    const segments = getSmoothCurveSegments([
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.4 },
      { x: 0.7, y: 0.2 }
    ])

    expect(segments).toHaveLength(2)
    expect(segments[0]?.start).toEqual({ x: 0.1, y: 0.1 })
    expect(segments[0]?.end).toEqual({ x: 0.3, y: 0.4 })
    expect(segments[1]?.end).toEqual({ x: 0.7, y: 0.2 })
  })

  it('samples smooth curve paths for render-aligned hit testing', () => {
    const sampledPoints = sampleSmoothCurvePoints(
      [
        { x: 0.1, y: 0.8 },
        { x: 0.5, y: 0.1 },
        { x: 0.9, y: 0.8 }
      ],
      false,
      2
    )

    expect(sampledPoints).toHaveLength(5)
    expect(sampledPoints[1]?.x).toBeCloseTo(0.275)
    expect(sampledPoints[1]?.y).toBeCloseTo(0.40625)
  })

  it('finds handle hits before body hits', () => {
    const measurement: MeasurementOverlay = {
      measurementId: 'rect-1',
      toolType: 'rect',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.7 }
      ],
      labelLines: []
    }

    const rect = createRect(0, 0, 200, 100)
    const handleHit = isMeasurementHit(measurement, { x: 0.2, y: 0.2 }, rect)
    const bodyHit = isMeasurementHit(measurement, { x: 0.5, y: 0.4 }, rect)

    expect(handleHit.hit).toBe(true)
    expect(handleHit.handleIndex).toBe(0)
    expect(bodyHit.hit).toBe(true)
    expect(bodyHit.handleIndex).toBeNull()
  })

  it('selects the closest measurement at a point', () => {
    const rect = createRect(0, 0, 300, 300)
    const measurements: MeasurementOverlay[] = [
      {
        measurementId: 'outer',
        toolType: 'rect',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.9 }
        ],
        labelLines: []
      },
      {
        measurementId: 'inner',
        toolType: 'rect',
        points: [
          { x: 0.4, y: 0.4 },
          { x: 0.6, y: 0.6 }
        ],
        labelLines: []
      }
    ]

    const match = findMeasurementAtPoint(measurements, { x: 0.5, y: 0.5 }, rect)

    expect(match?.measurement.measurementId).toBe('inner')
  })

  it('hits freehand curve segments and freeform polygon interiors', () => {
    const rect = createRect(0, 0, 300, 300)
    const curve: MeasurementOverlay = {
      measurementId: 'curve-1',
      toolType: 'curve',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.45, y: 0.45 },
        { x: 0.8, y: 0.2 }
      ],
      labelLines: []
    }
    const freeform: MeasurementOverlay = {
      measurementId: 'freeform-1',
      toolType: 'freeform',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.7, y: 0.2 },
        { x: 0.65, y: 0.7 },
        { x: 0.2, y: 0.65 }
      ],
      labelLines: []
    }

    expect(isMeasurementHit(curve, { x: 0.46, y: 0.44 }, rect).hit).toBe(true)
    expect(isMeasurementHit(freeform, { x: 0.4, y: 0.4 }, rect).hit).toBe(true)
    expect(isMeasurementHit(freeform, { x: 0.9, y: 0.9 }, rect).hit).toBe(false)
  })

  it('hits the visible smooth curve path instead of only control-point chords', () => {
    const rect = createRect(0, 0, 300, 300)
    const curve: MeasurementOverlay = {
      measurementId: 'smooth-curve',
      toolType: 'curve',
      points: [
        { x: 0.1, y: 0.8 },
        { x: 0.5, y: 0.1 },
        { x: 0.9, y: 0.8 }
      ],
      labelLines: []
    }

    const hit = isMeasurementHit(curve, { x: 0.275, y: 0.40625 }, rect)

    expect(hit.hit).toBe(true)
  })

  it('selects committed smooth curves from the visible path', () => {
    const rect = createRect(0, 0, 300, 300)
    const curve: MeasurementOverlay = {
      measurementId: 'smooth-curve',
      toolType: 'curve',
      points: [
        { x: 0.1, y: 0.8 },
        { x: 0.5, y: 0.1 },
        { x: 0.9, y: 0.8 }
      ],
      labelLines: []
    }

    expect(
      resolveMeasurementPointerDownIntent({
        committedMeasurements: [curve],
        existingDraft: null,
        point: { x: 0.275, y: 0.40625 },
        rect
      })
    ).toEqual({
      kind: 'select_committed',
      measurement: curve
    })
  })

  it('prefers the later measurement when overlapping hits have the same score', () => {
    const rect = createRect(0, 0, 300, 300)
    const overlapping: MeasurementOverlay[] = [
      {
        measurementId: 'first',
        toolType: 'rect',
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.6, y: 0.6 }
        ],
        labelLines: []
      },
      {
        measurementId: 'second',
        toolType: 'rect',
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.6, y: 0.6 }
        ],
        labelLines: []
      }
    ]

    const match = findMeasurementAtPoint(overlapping, { x: 0.4, y: 0.4 }, rect)
    expect(match?.measurement.measurementId).toBe('second')
  })

  it('updates rectangle corners against the opposite handle', () => {
    const nextPoints = updateEditedMeasurementPoints(
      'rect',
      [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.8 }
      ],
      0,
      { x: 0.1, y: 0.3 }
    )

    expect(nextPoints).toEqual([
      { x: 0.1, y: 0.3 },
      { x: 0.8, y: 0.8 }
    ])
  })

  it('translates points while clamping them inside the viewport', () => {
    const nextPoints = translateMeasurementPoints(
      [
        { x: 0.8, y: 0.8 },
        { x: 1, y: 1 }
      ],
      0.4,
      0.3
    )

    expect(nextPoints).toEqual([
      { x: 0.8, y: 0.8 },
      { x: 1, y: 1 }
    ])
  })

  it('creates editable drafts with explicit metadata', () => {
    const draft = createMeasurementDraft(
      'line',
      [
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.4 }
      ],
      'm-1'
    )

    expect(draft.measurementId).toBe('m-1')
    expect(findHandleIndexAtPoint('line', draft.points, { x: 0.2, y: 0.2 }, createRect(0, 0, 200, 200))).toBe(0)
  })

  it('resolves pointer-down intent against draft and committed measurements', () => {
    const rect = createRect(0, 0, 300, 300)
    const existingDraft = createMeasurementDraft(
      'rect',
      [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.8 }
      ],
      'draft-1'
    )
    const committedMeasurements: MeasurementOverlay[] = [
      {
        measurementId: 'committed-1',
        toolType: 'line',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.15, y: 0.15 }
        ],
        labelLines: []
      }
    ]

    expect(
      resolveMeasurementPointerDownIntent({
        committedMeasurements,
        existingDraft,
        point: { x: 0.2, y: 0.2 },
        rect
      })
    ).toEqual({ kind: 'edit_handle', handleIndex: 0 })

    expect(
      resolveMeasurementPointerDownIntent({
        committedMeasurements,
        existingDraft,
        point: { x: 0.12, y: 0.12 },
        rect
      })
    ).toEqual({
      kind: 'select_committed',
      measurement: committedMeasurements[0]
    })

    expect(
      resolveMeasurementPointerDownIntent({
        committedMeasurements: [],
        existingDraft,
        point: { x: 0.5, y: 0.5 },
        rect
      })
    ).toEqual({ kind: 'move_draft' })

    expect(
      resolveMeasurementPointerDownIntent({
        committedMeasurements: [],
        existingDraft,
        point: { x: 0.95, y: 0.05 },
        rect
      })
    ).toEqual({ kind: 'clear_draft' })

    expect(
      resolveMeasurementPointerDownIntent({
        committedMeasurements: [],
        existingDraft: null,
        point: { x: 0.4, y: 0.4 },
        rect
      })
    ).toEqual({ kind: 'create_new' })
  })
})
