import { describe, expect, it } from 'vitest'
import type { MprSegmentationVoiBox } from '../../types/viewer'
import {
  getVoiPlaneAxes,
  getVoiPlaneRect,
  normalizeVoiRectFromPoints,
  resizeVoiPlaneRect,
  translateVoiPlaneRect,
  updateVoiBoxFromPlaneRect
} from './mprVoiGeometry'

const box: MprSegmentationVoiBox = {
  xMin: 0.1,
  xMax: 0.8,
  yMin: 0.2,
  yMax: 0.9,
  zMin: 0.3,
  zMax: 0.7
}

describe('mprVoiGeometry', () => {
  it('maps VOI axes per MPR plane', () => {
    expect(getVoiPlaneAxes('mpr-ax')).toEqual({ horizontal: 'x', vertical: 'y' })
    expect(getVoiPlaneAxes('mpr-cor')).toEqual({ horizontal: 'x', vertical: 'z' })
    expect(getVoiPlaneAxes('mpr-sag')).toEqual({ horizontal: 'y', vertical: 'z' })
  })

  it('projects the box onto AX/COR/SAG rectangles', () => {
    expect(getVoiPlaneRect(box, 'mpr-ax')).toEqual({ xMin: 0.1, xMax: 0.8, yMin: 0.2, yMax: 0.9 })
    expect(getVoiPlaneRect(box, 'mpr-cor')).toEqual({ xMin: 0.1, xMax: 0.8, yMin: 0.3, yMax: 0.7 })
    expect(getVoiPlaneRect(box, 'mpr-sag')).toEqual({ xMin: 0.2, xMax: 0.9, yMin: 0.3, yMax: 0.7 })
  })

  it('updates only the axes owned by the active plane', () => {
    expect(
      updateVoiBoxFromPlaneRect(box, 'mpr-cor', {
        xMin: 0.15,
        xMax: 0.55,
        yMin: 0.25,
        yMax: 0.65
      })
    ).toEqual({
      xMin: 0.15,
      xMax: 0.55,
      yMin: 0.2,
      yMax: 0.9,
      zMin: 0.25,
      zMax: 0.65
    })
  })

  it('clamps movement and resizing to normalized volume ranges', () => {
    expect(translateVoiPlaneRect({ xMin: 0.2, xMax: 0.6, yMin: 0.2, yMax: 0.5 }, 0.7, -0.5)).toEqual({
      xMin: 0.6,
      xMax: 1,
      yMin: 0,
      yMax: 0.3
    })

    expect(resizeVoiPlaneRect({ xMin: 0.2, xMax: 0.6, yMin: 0.2, yMax: 0.5 }, 'nw', { x: -1, y: 2 })).toEqual({
      xMin: 0,
      xMax: 0.6,
      yMin: 0.5,
      yMax: 1
    })
  })

  it('creates a normalized rectangle regardless of drag direction', () => {
    expect(normalizeVoiRectFromPoints({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 })).toEqual({
      xMin: 0.2,
      xMax: 0.8,
      yMin: 0.1,
      yMax: 0.7
    })
  })
})
