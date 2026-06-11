import { describe, expect, it } from 'vitest'
import { normalizeMprSegmentationConfig } from './viewer'

describe('normalizeMprSegmentationConfig', () => {
  it('clamps HU, sorts bounds, opacity, color, and VOI ranges', () => {
    expect(
      normalizeMprSegmentationConfig({
        enabled: true,
        lowerHu: 5000,
        upperHu: -5000,
        opacity: 2,
        color: 'cyan',
        voiBox: {
          xMin: 0.8,
          xMax: 0.2,
          yMin: -1,
          yMax: 0.6,
          zMin: 0.4,
          zMax: 2
        }
      })
    ).toEqual({
      enabled: true,
      lowerHu: -1024,
      upperHu: 3071,
      opacity: 1,
      color: '#22d3ee',
      voiBox: {
        xMin: 0.2,
        xMax: 0.8,
        yMin: 0,
        yMax: 0.6,
        zMin: 0.4,
        zMax: 1
      }
    })
  })
})
