import { describe, expect, it } from 'vitest'
import type { MeasurementOverlay } from '../../types/viewer'
import {
  createMeasurementDraft,
  findHandleIndexAtPoint,
  findMeasurementAtPoint,
  isMeasurementHit,
  isValidMeasurement,
  resolveMeasurementPointerDownIntent,
  translateMeasurementPoints,
  updateEditedMeasurementPoints
} from './measurementGeometry'

function createRect(left = 0, top = 0, width = 200, height = 100): DOMRect {
  return new DOMRect(left, top, width, height)
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
