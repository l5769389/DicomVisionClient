import { describe, expect, it } from 'vitest'
import {
  createDefaultVolumeRenderConfig,
  normalizeVolumePresetKey,
  normalizeVolumeRenderConfig
} from './volumeRenderConfig'

function layerByKey(config: ReturnType<typeof createDefaultVolumeRenderConfig>, key: string) {
  return config.layers.find((layer) => layer.key === key)!
}

describe('volumeRenderConfig', () => {
  it('defaults to a bone-focused CT preset instead of red angiography layers', () => {
    const config = createDefaultVolumeRenderConfig()

    expect(config.preset).toBe('bone')
    expect(layerByKey(config, 'bone')).toMatchObject({
      enabled: true,
      wl: 360,
      opacity: 0.96
    })
    expect(layerByKey(config, 'softTissue')).toMatchObject({
      enabled: true,
      opacity: 0.075
    })
    expect(layerByKey(config, 'blood').enabled).toBe(false)
    expect(config.lighting).toMatchObject({
      ambient: 0.08,
      specular: 0.32,
      roughness: 0.52
    })
  })

  it('keeps explicit AAA selections while normalizing unknown presets to bone', () => {
    expect(normalizeVolumePresetKey('volumePreset:aaa')).toBe('aaa')
    expect(normalizeVolumePresetKey('ct bone')).toBe('bone')
    expect(normalizeVolumePresetKey('unknown')).toBe('bone')

    expect(normalizeVolumeRenderConfig({ preset: 'volumePreset:aaa' }).preset).toBe('aaa')
    expect(normalizeVolumeRenderConfig({ preset: 'unknown' }).preset).toBe('bone')
  })
})
