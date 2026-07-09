import { describe, expect, it } from 'vitest'
import {
  VOLUME_PRESET_OPTIONS,
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
    expect(normalizeVolumePresetKey('volumePreset:bonePlusPlate')).toBe('bonePlusPlate')
    expect(normalizeVolumePresetKey('volumePreset:coronaryCta')).toBe('coronaryCta')
    expect(normalizeVolumePresetKey('MR-Angio')).toBe('mrAngio')
    expect(normalizeVolumePresetKey('CBCT-Bone2')).toBe('cbctBone2')
    expect(normalizeVolumePresetKey('unknown')).toBe('bone')

    expect(normalizeVolumeRenderConfig({ preset: 'volumePreset:aaa' }).preset).toBe('aaa')
    expect(normalizeVolumeRenderConfig({ preset: 'unknown' }).preset).toBe('bone')
  })

  it('uses a red-orange AAA fallback until backend adaptive metadata arrives', () => {
    const config = createDefaultVolumeRenderConfig('aaa')

    expect(layerByKey(config, 'blood')).toMatchObject({
      enabled: true,
      ww: 150,
      wl: 160,
      opacity: 0.52,
      colorStart: '#9d0b0b',
      colorEnd: '#ff3b1f'
    })
    expect(layerByKey(config, 'muscle')).toMatchObject({
      enabled: true,
      ww: 260,
      wl: 125,
      opacity: 0.38,
      colorStart: '#d7784a',
      colorEnd: '#ffc090'
    })
    expect(layerByKey(config, 'softTissue')).toMatchObject({
      enabled: true,
      ww: 300,
      wl: 130,
      opacity: 0.44,
      colorStart: '#8f2d18',
      colorEnd: '#e89b64'
    })
    expect(layerByKey(config, 'bone')).toMatchObject({
      enabled: true,
      ww: 560,
      wl: 330,
      opacity: 0.58
    })
    expect(config.lighting).toMatchObject({
      ambient: 0.38,
      diffuse: 0.62,
      specular: 0.08,
      roughness: 0.92
    })
  })

  it('exposes the expanded grouped 3D preset catalog', () => {
    expect(VOLUME_PRESET_OPTIONS.map((option) => option.value)).toEqual(expect.arrayContaining([
      'volumePreset:aaa',
      'volumePreset:xray',
      'volumePreset:bonePlusPlate',
      'volumePreset:coronaryCta',
      'volumePreset:mrAngio',
      'volumePreset:cbctBone2'
    ]))
    expect(new Set(VOLUME_PRESET_OPTIONS.map((option) => option.group))).toEqual(
      new Set(['General', 'CT', 'CTA', 'MR', 'CBCT'])
    )
  })

  it('creates fallback configs for newly added presets', () => {
    const bone = createDefaultVolumeRenderConfig('bone')
    const red = createDefaultVolumeRenderConfig('red')
    const cta = createDefaultVolumeRenderConfig('coronaryCta')
    const mrMip = createDefaultVolumeRenderConfig('mrMip')

    expect(bone.preset).toBe('bone')
    expect(layerByKey(bone, 'bone')).toMatchObject({ enabled: true, wl: 360, opacity: 0.96 })
    expect(red.preset).toBe('red')
    expect(layerByKey(red, 'bone')).toMatchObject({ enabled: true, wl: 115, opacity: 1 })
    expect(cta.preset).toBe('coronaryCta')
    expect(layerByKey(cta, 'blood')).toMatchObject({ enabled: true, wl: 240 })
    expect(mrMip.preset).toBe('mrMip')
    expect(mrMip.blendMode).toBe('mip')
    expect(layerByKey(mrMip, 'custom')).toMatchObject({ enabled: true, opacity: 0.72 })
  })
})
