import { describe, expect, it } from 'vitest'
import { resolveDockResize } from './dockResize'

describe('resolveDockResize', () => {
  const leftConfig = { collapsedWidth: 64, collapseThreshold: 220, minWidth: 280, maxWidth: 480 }
  const rightConfig = { collapsedWidth: 58, collapseThreshold: 170, minWidth: 196, maxWidth: 360 }

  it('starts from the actual collapsed width instead of a saved expanded width', () => {
    expect(resolveDockResize(64, 30, leftConfig)).toEqual({ collapsed: true, rawWidth: 94, width: 94 })
    expect(resolveDockResize(58, 42, rightConfig)).toEqual({ collapsed: true, rawWidth: 100, width: 100 })
  })

  it('expands at the threshold and clamps expanded widths', () => {
    expect(resolveDockResize(58, 112, rightConfig)).toEqual({ collapsed: false, rawWidth: 170, width: 196 })
    expect(resolveDockResize(300, 200, rightConfig).width).toBe(360)
    expect(resolveDockResize(320, -500, rightConfig)).toEqual({ collapsed: true, rawWidth: -180, width: 58 })
  })

  it('supports mirrored right-side pointer deltas', () => {
    expect(resolveDockResize(220, 40, rightConfig).width).toBe(260)
    expect(resolveDockResize(220, -40, rightConfig).width).toBe(196)
  })
})
