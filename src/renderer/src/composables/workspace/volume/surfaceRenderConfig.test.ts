import { describe, expect, it } from 'vitest'
import {
  createDefaultSurfaceRenderConfig,
  createSurfaceRenderPresetConfig,
  normalizeSurfacePresetKey,
  normalizeSurfaceRenderConfig
} from './surfaceRenderConfig'

describe('surfaceRenderConfig', () => {
  it('defaults to the bone surface preset', () => {
    expect(createDefaultSurfaceRenderConfig()).toMatchObject({
      preset: 'bone',
      isoValue: 240,
      smoothing: 0.28,
      decimation: 0.18,
      color: '#f3eadb'
    })
  })

  it('supports soft tissue and high density presets', () => {
    expect(normalizeSurfacePresetKey('surfacePreset:softTissue')).toBe('softTissue')
    expect(normalizeSurfacePresetKey('high-density')).toBe('highDensity')
    expect(createSurfaceRenderPresetConfig('soft tissue')).toMatchObject({
      preset: 'softTissue',
      isoValue: 85,
      color: '#b86642'
    })
    expect(createSurfaceRenderPresetConfig('metal')).toMatchObject({
      preset: 'highDensity',
      isoValue: 420,
      specular: 0.46
    })
  })

  it('normalizes user-edited surface values around the selected preset', () => {
    expect(
      normalizeSurfaceRenderConfig({
        preset: 'surfacePreset:softTissue',
        isoValue: 120,
        smoothing: 3,
        decimation: -1,
        color: 'bad-color'
      })
    ).toMatchObject({
      preset: 'softTissue',
      isoValue: 120,
      smoothing: 1,
      decimation: 0,
      color: '#b86642'
    })
  })
})
