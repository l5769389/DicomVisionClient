import { describe, expect, it } from 'vitest'
import {
  createCrosshairRotationDragState,
  resolveCrosshairHitTarget,
  resolveCrosshairRotationDeltaPayload,
  toMprObliqueDeltaAngleRad
} from './mprCrosshairPointerController'
import { getMprViewportDerivedCrosshairGeometry } from '../workspace/views/mprFrameGeometry'
import type { CrosshairLineTarget } from '../workspace/views/mprFrameGeometry'
import type { MprViewportKey } from '../../types/viewer'

const defaultFrame = {
  center: [0, 0, 0] as [number, number, number],
  axisSlice: [1, 0, 0] as [number, number, number],
  axisRow: [0, 1, 0] as [number, number, number],
  axisCol: [0, 0, 1] as [number, number, number]
}

function pointOnLine(angleRad: number, deltaRad = 0): { x: number; y: number } {
  const radius = 0.25
  const angle = angleRad + deltaRad
  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.5 + Math.sin(angle) * radius
  }
}

describe('mprCrosshairPointerController', () => {
  it('keeps axial vertical and horizontal line identities aligned with the rendered lines', () => {
    const geometry = getMprViewportDerivedCrosshairGeometry(
      {
        center: [0, 0, 0],
        axisSlice: [1, 0, 0],
        axisRow: [0, 1, 0],
        axisCol: [0, 0, 1]
      },
      'mpr-ax',
      {
        centerX: 0.5,
        centerY: 0.5,
        hitRadius: 0.03,
        horizontalPosition: 0.5,
        verticalPosition: 0.5
      }
    )

    expect(geometry).not.toBeNull()

    const containerRect = new DOMRect(0, 0, 200, 200)
    const imageRect = new DOMRect(0, 0, 200, 200)
    const crosshairInfo = {
      centerX: 0.5,
      centerY: 0.5,
      hitRadius: 0.03,
      horizontalPosition: 0.5,
      verticalPosition: 0.5
    }

    expect(
      resolveCrosshairHitTarget({
        containerPoint: { x: 0.5, y: 0.2 },
        crosshairInfo,
        containerRect,
        imageRect,
        geometry
      })
    ).toBe('vertical')

    expect(
      resolveCrosshairHitTarget({
        containerPoint: { x: 0.8, y: 0.5 },
        crosshairInfo,
        containerRect,
        imageRect,
        geometry
      })
    ).toBe('horizontal')
  })

  it('converts clockwise screen drag to a continuous screen-space drag delta', () => {
    const geometry = {
      center: { x: 0.5, y: 0.5 }
    }
    const containerRect = new DOMRect(0, 0, 200, 200)
    const imageRect = new DOMRect(0, 0, 200, 200)

    const start = createCrosshairRotationDragState(
      { x: 0.75, y: 0.5 },
      {
        containerRect,
        imageRect,
        geometry
      }
    )
    expect(start).not.toBeNull()

    const payload = resolveCrosshairRotationDeltaPayload(
      { x: 0.75, y: 0.75 },
      {
        containerRect,
        imageRect,
        dragState: start!.dragState
      }
    )

    expect(payload).not.toBeNull()
    expect(payload?.deltaAngleRad).toBeCloseTo(Math.PI / 4, 6)
  })

  it('sends screen-space rotation deltas unchanged to backend oblique rotation', () => {
    expect(toMprObliqueDeltaAngleRad(Math.PI / 4)).toBeCloseTo(Math.PI / 4, 6)
    expect(toMprObliqueDeltaAngleRad(-Math.PI / 6)).toBeCloseTo(-Math.PI / 6, 6)
  })

  it.each([
    ['mpr-ax', 'horizontal'],
    ['mpr-ax', 'vertical'],
    ['mpr-cor', 'horizontal'],
    ['mpr-cor', 'vertical'],
    ['mpr-sag', 'horizontal'],
    ['mpr-sag', 'vertical']
  ] as Array<[MprViewportKey, CrosshairLineTarget]>)(
    'keeps initial %s %s mouse rotation aligned with backend wire delta direction',
    (viewportKey, line) => {
      const geometry = getMprViewportDerivedCrosshairGeometry(
        defaultFrame,
        viewportKey,
        {
          centerX: 0.5,
          centerY: 0.5,
          hitRadius: 0.03,
          horizontalPosition: 0.5,
          verticalPosition: 0.5
        }
      )
      expect(geometry).not.toBeNull()

      const containerRect = new DOMRect(0, 0, 200, 200)
      const imageRect = new DOMRect(0, 0, 200, 200)
      const renderedAngle = line === 'horizontal'
        ? geometry!.horizontalAngleRad
        : geometry!.verticalAngleRad
      const screenDeltaAngleRad = 0.1
      const start = createCrosshairRotationDragState(
        pointOnLine(renderedAngle),
        {
          containerRect,
          imageRect,
          geometry: geometry!
        }
      )
      expect(start).not.toBeNull()

      const payload = resolveCrosshairRotationDeltaPayload(
        pointOnLine(renderedAngle, screenDeltaAngleRad),
        {
          containerRect,
          imageRect,
          dragState: start!.dragState
        }
      )

      expect(payload).not.toBeNull()
      expect(payload?.deltaAngleRad).toBeCloseTo(screenDeltaAngleRad, 6)
      expect(toMprObliqueDeltaAngleRad(payload!.deltaAngleRad)).toBeCloseTo(screenDeltaAngleRad, 6)
    }
  )

  it('unwraps pointer angles continuously across the full-turn branch cut', () => {
    const geometry = {
      center: { x: 0.5, y: 0.5 }
    }
    const containerRect = new DOMRect(0, 0, 200, 200)
    const imageRect = new DOMRect(0, 0, 200, 200)

    const start = createCrosshairRotationDragState(
      { x: 0.25, y: 0.49 },
      {
        containerRect,
        imageRect,
        geometry
      }
    )
    expect(start).not.toBeNull()

    const payload = resolveCrosshairRotationDeltaPayload(
      { x: 0.25, y: 0.51 },
      {
        containerRect,
        imageRect,
        dragState: start!.dragState
      }
    )

    expect(payload).not.toBeNull()
    expect(payload?.deltaAngleRad).toBeCloseTo(-0.079957, 5)
  })
})
