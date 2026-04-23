import { describe, expect, it } from 'vitest'
import { getMprViewportDerivedCrosshairGeometry } from './mprFrameGeometry'

describe('mprFrameGeometry', () => {
  it('maps default axial geometry to horizontal and vertical screen axes correctly', () => {
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
    expect(geometry?.horizontalAngleRad).toBeCloseTo(0, 6)
    expect(geometry?.verticalAngleRad).toBeCloseTo(Math.PI / 2, 6)
  })

  it('prefers shared mprFrame geometry over explicit cached line angles', () => {
    const frame = {
      center: [2, 3, 3] as [number, number, number],
      axisSlice: [1, 0, 0] as [number, number, number],
      axisRow: [0, 0.9393727128473789, 0.34289780745545134] as [number, number, number],
      axisCol: [0, -0.34289780745545134, 0.9393727128473789] as [number, number, number]
    }
    const geometry = getMprViewportDerivedCrosshairGeometry(
      frame,
      'mpr-ax',
      {
        centerX: 0.5,
        centerY: 0.5,
        hitRadius: 0.03,
        horizontalPosition: 0.5,
        verticalPosition: 0.5,
        horizontalAngleRad: 0,
        verticalAngleRad: Math.PI / 2
      }
    )
    const derivedOnly = getMprViewportDerivedCrosshairGeometry(
      frame,
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
    expect(derivedOnly).not.toBeNull()
    expect(geometry?.horizontalAngleRad).toBeCloseTo(derivedOnly?.horizontalAngleRad ?? 0, 6)
    expect(geometry?.verticalAngleRad).toBeCloseTo(derivedOnly?.verticalAngleRad ?? 0, 6)
    expect(geometry?.horizontalAngleRad).not.toBeCloseTo(0, 6)
    expect(geometry?.verticalAngleRad).not.toBeCloseTo(Math.PI / 2, 6)
  })

  it('prefers resolved viewport plane basis over frame-only basis when they diverge', () => {
    const frame = {
      center: [2, 3, 3] as [number, number, number],
      axisSlice: [-0.867423225594017, 0.17061602137538454, 0.4674046650923646] as [number, number, number],
      axisRow: [0, 0.9393727128473789, -0.34289780745545134] as [number, number, number],
      axisCol: [-0.4975710478917269, -0.29743752219212377, -0.8148337086130757] as [number, number, number]
    }
    const plane = {
      row: [0, -0.9393727128473789, 0.34289780745545134] as [number, number, number],
      col: [0.49757104789172696, 0.29743752219212377, 0.8148337086130757] as [number, number, number],
      normal: [-0.867423225594017, 0.17061602137538454, 0.4674046650923646] as [number, number, number],
      isOblique: true
    }

    const geometryWithPlane = getMprViewportDerivedCrosshairGeometry(
      frame,
      'mpr-ax',
      {
        centerX: 0.5,
        centerY: 0.5,
        hitRadius: 0.03,
        horizontalPosition: 0.5,
        verticalPosition: 0.5
      },
      plane
    )
    const frameOnlyGeometry = getMprViewportDerivedCrosshairGeometry(
      frame,
      'mpr-ax',
      {
        centerX: 0.5,
        centerY: 0.5,
        hitRadius: 0.03,
        horizontalPosition: 0.5,
        verticalPosition: 0.5
      }
    )

    expect(geometryWithPlane).not.toBeNull()
    expect(frameOnlyGeometry).not.toBeNull()
    expect(geometryWithPlane?.horizontalAngleRad).toBeCloseTo(0, 6)
    expect(geometryWithPlane?.verticalAngleRad).toBeCloseTo(Math.PI / 2, 6)
    expect(frameOnlyGeometry?.horizontalAngleRad).toBeCloseTo(2.743268360058433, 6)
    expect(frameOnlyGeometry?.verticalAngleRad).toBeCloseTo(1.172472033263536, 6)
  })

  it('falls back to explicit angles when mprFrame is unavailable', () => {
    const geometry = getMprViewportDerivedCrosshairGeometry(
      null,
      'mpr-ax',
      {
        centerX: 0.4,
        centerY: 0.6,
        hitRadius: 0.03,
        horizontalAngleRad: 0.25,
        verticalAngleRad: 0.25 + Math.PI / 2
      }
    )

    expect(geometry).not.toBeNull()
    expect(geometry?.center).toEqual({ x: 0.4, y: 0.6 })
    expect(geometry?.horizontalAngleRad).toBeCloseTo(0.25, 6)
    expect(geometry?.verticalAngleRad).toBeCloseTo(0.25 + Math.PI / 2, 6)
  })
})
