import { describe, expect, it } from 'vitest'
import { classifyMobileTwoFingerGesture } from './mobileViewportGesture'

describe('mobileViewportGesture', () => {
  it('classifies two fingers moving together as slice scrolling', () => {
    expect(classifyMobileTwoFingerGesture({
      initialCenter: { x: 50, y: 50 },
      initialDistance: 80,
      currentCenter: { x: 52, y: 82 },
      currentDistance: 81
    })).toBe('scroll')
  })

  it('classifies fingers moving apart as zoom even when the center also moves', () => {
    expect(classifyMobileTwoFingerGesture({
      initialCenter: { x: 50, y: 50 },
      initialDistance: 80,
      currentCenter: { x: 54, y: 60 },
      currentDistance: 105
    })).toBe('zoom')
  })

  it('keeps small ambiguous movement pending', () => {
    expect(classifyMobileTwoFingerGesture({
      initialCenter: { x: 50, y: 50 },
      initialDistance: 80,
      currentCenter: { x: 52, y: 54 },
      currentDistance: 82
    })).toBe('pending')
  })
})
