import { describe, expect, it } from 'vitest'
import { resolveDrawingScopeToolKey } from './drawingScopeSupport'

describe('drawing scope support', () => {
  it('keeps MTF analysis bound to the source image', () => {
    expect(resolveDrawingScopeToolKey('qa', 'qa:mtf')).toBeNull()
  })

  it('keeps scope controls for tools whose results support series visibility', () => {
    expect(resolveDrawingScopeToolKey('measure', null)).toBe('measurement')
    expect(resolveDrawingScopeToolKey('annotate', null)).toBe('annotation')
    expect(resolveDrawingScopeToolKey('qa', 'qa:water-phantom')).toBe('qaWater')
  })
})
