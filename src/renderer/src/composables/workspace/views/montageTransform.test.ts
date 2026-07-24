import { describe, expect, it } from 'vitest'
import {
  applyMontagePanDrag,
  applyMontageZoomDrag,
  normalizeMontageTransform,
  resetMontageTransform
} from './montageTransform'

describe('montageTransform', () => {
  it('clamps zoom and prevents an image from being translated completely outside its tile', () => {
    expect(normalizeMontageTransform({ zoom: 20, offsetX: 99, offsetY: -99 })).toEqual({
      zoom: 10,
      offsetX: 4.5,
      offsetY: -4.5
    })
    expect(normalizeMontageTransform({ zoom: 1, offsetX: 0.4, offsetY: -0.4 })).toEqual({
      zoom: 1,
      offsetX: 0.4,
      offsetY: -0.4
    })
  })

  it('stores panning relative to tile size and preserves it while zooming', () => {
    expect(applyMontagePanDrag({ zoom: 1, offsetX: 0, offsetY: 0 }, 25, -10, 100)).toEqual({
      zoom: 1,
      offsetX: 0.25,
      offsetY: -0.1
    })
    expect(applyMontagePanDrag({ zoom: 2, offsetX: 0, offsetY: 0 }, 50, -25, 100)).toEqual({
      zoom: 2,
      offsetX: 0.5,
      offsetY: -0.25
    })
    const zoomed = applyMontageZoomDrag({ zoom: 2, offsetX: 0.2, offsetY: -0.2 }, -90)
    expect(zoomed.zoom).toBeGreaterThan(2)
    expect(zoomed.offsetX).toBe(0.2)
    expect(zoomed.offsetY).toBe(-0.2)
  })

  it('resets pan independently and returns to center when zoom is reset', () => {
    expect(resetMontageTransform({ zoom: 3, offsetX: 0.5, offsetY: -0.5 }, 'pan')).toEqual({
      zoom: 3,
      offsetX: 0,
      offsetY: 0
    })
    expect(resetMontageTransform({ zoom: 3, offsetX: 0.5, offsetY: -0.5 }, 'zoom')).toEqual({
      zoom: 1,
      offsetX: 0,
      offsetY: 0
    })
  })
})
