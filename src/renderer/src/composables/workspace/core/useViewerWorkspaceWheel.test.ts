import { describe, expect, it } from 'vitest'
import { normalizeViewportWheelScrollDelta } from './useViewerWorkspace'

describe('normalizeViewportWheelScrollDelta', () => {
  it('normalizes mouse wheel deltas to one page by default', () => {
    expect(normalizeViewportWheelScrollDelta(120)).toBe(1)
    expect(normalizeViewportWheelScrollDelta(0.25)).toBe(1)
    expect(normalizeViewportWheelScrollDelta(-240)).toBe(-1)
    expect(normalizeViewportWheelScrollDelta(-0.25)).toBe(-1)
  })

  it('preserves exact programmatic scroll deltas', () => {
    expect(normalizeViewportWheelScrollDelta(4.9, true)).toBe(4)
    expect(normalizeViewportWheelScrollDelta(-3.9, true)).toBe(-3)
    expect(normalizeViewportWheelScrollDelta(0, true)).toBe(0)
  })

  it('ignores non-finite deltas', () => {
    expect(normalizeViewportWheelScrollDelta(Number.NaN)).toBe(0)
    expect(normalizeViewportWheelScrollDelta(Number.POSITIVE_INFINITY, true)).toBe(0)
  })
})
