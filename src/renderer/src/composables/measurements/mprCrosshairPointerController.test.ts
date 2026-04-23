import { describe, expect, it } from 'vitest'
import { resolveCrosshairHitTarget, resolveCrosshairRotationPayload } from './mprCrosshairPointerController'
import { getMprViewportDerivedCrosshairGeometry } from '../workspace/views/mprFrameGeometry'

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

  it('converts clockwise screen drag to counter-clockwise geometry angle for backend rotation', () => {
    const geometry = {
      center: { x: 0.5, y: 0.5 },
      horizontalAngleRad: 0,
      verticalAngleRad: Math.PI / 2
    }
    const containerRect = new DOMRect(0, 0, 200, 200)
    const imageRect = new DOMRect(0, 0, 200, 200)

    const payload = resolveCrosshairRotationPayload(
      { x: 0.75, y: 0.75 },
      {
        containerRect,
        imageRect,
        geometry,
        line: 'horizontal'
      }
    )

    expect(payload).not.toBeNull()
    expect(payload?.angleRad).toBeCloseTo(-Math.PI / 4, 6)
  })

  it('uses the nearest opposite half of an undirected line while converting rotation angle', () => {
    const geometry = {
      center: { x: 0.5, y: 0.5 },
      horizontalAngleRad: 0,
      verticalAngleRad: Math.PI / 2
    }
    const containerRect = new DOMRect(0, 0, 200, 200)
    const imageRect = new DOMRect(0, 0, 200, 200)

    const payload = resolveCrosshairRotationPayload(
      { x: 0.5, y: 0.25 },
      {
        containerRect,
        imageRect,
        geometry,
        line: 'vertical'
      }
    )

    expect(payload).not.toBeNull()
    expect(payload?.angleRad).toBeCloseTo(Math.PI / 2, 6)
  })
})
