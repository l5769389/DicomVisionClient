import { describe, expect, it } from 'vitest'
import { resolveCrosshairHitTarget } from './mprCrosshairPointerController'
import { getMprViewportDerivedCrosshairGeometry } from '../workspace/views/mprFrameGeometry'
import type { CrosshairLineTarget } from '../workspace/views/mprFrameGeometry'
import type { MprViewportKey } from '../../types/viewer'

const defaultFrame = {
  center: [0, 0, 0] as [number, number, number],
  axisSlice: [1, 0, 0] as [number, number, number],
  axisRow: [0, 1, 0] as [number, number, number],
  axisCol: [0, 0, 1] as [number, number, number]
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

  it.each([
    ['mpr-ax', 'horizontal'],
    ['mpr-ax', 'vertical'],
    ['mpr-cor', 'horizontal'],
    ['mpr-cor', 'vertical'],
    ['mpr-sag', 'horizontal'],
    ['mpr-sag', 'vertical']
  ] as Array<[MprViewportKey, CrosshairLineTarget]>)(
    'detects initial %s %s line hits without computing a rotation delta',
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
      const radius = 0.25
      const point = {
        x: 0.5 + Math.cos(renderedAngle) * radius,
        y: 0.5 + Math.sin(renderedAngle) * radius
      }

      expect(
        resolveCrosshairHitTarget({
          containerPoint: point,
          crosshairInfo: {
            centerX: 0.5,
            centerY: 0.5,
            hitRadius: 0.03,
            horizontalPosition: 0.5,
            verticalPosition: 0.5
          },
          containerRect,
          imageRect,
          geometry
        })
      ).toBe(line)
    }
  )
})
