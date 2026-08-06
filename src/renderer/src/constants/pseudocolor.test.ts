import { describe, expect, it } from 'vitest'
import {
  FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS,
  PSEUDOCOLOR_PRESET_OPTIONS,
  PSEUDOCOLOR_REGISTRY_VERSION,
  getFusionPetPseudocolorGradient,
  getPseudocolorBackgroundColor,
  getPseudocolorGradient
} from './pseudocolor'

async function lutHash(lut: readonly (readonly [number, number, number])[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(lut.flat()))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('pseudocolor registry', () => {
  it('exposes complete versioned 256-entry tables with verified hashes', async () => {
    expect(PSEUDOCOLOR_REGISTRY_VERSION).toBe('dicomvision-2026.2')
    expect(PSEUDOCOLOR_PRESET_OPTIONS.map((option) => option.key)).toEqual([
      'blackbody',
      'bw',
      'bwinverse',
      'hotiron',
      'hotmetal',
      'pet',
      'rainbow'
    ])

    for (const option of PSEUDOCOLOR_PRESET_OPTIONS) {
      expect(option.lut).toHaveLength(256)
      expect(await lutHash(option.lut)).toBe(option.sha256)
      expect(option.gradient.match(/rgb\(/g)).toHaveLength(256)
    }
  })

  it('keeps zero intensity, previews, and historical fusion aliases consistent', () => {
    expect(getPseudocolorBackgroundColor('hotiron')).toBe('#000000')
    expect(getPseudocolorBackgroundColor('bwinverse')).toBe('#ffffff')
    expect(getPseudocolorBackgroundColor('rainbow')).toBe('#330066')

    const hotMetal = PSEUDOCOLOR_PRESET_OPTIONS.find((option) => option.key === 'hotmetal')!
    const historicalFusion = FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS.find(
      (option) => option.key === 'petct-rainbow'
    )!
    expect(historicalFusion.sha256).toBe(hotMetal.sha256)
    expect(historicalFusion.lut).toBe(hotMetal.lut)
    expect(getFusionPetPseudocolorGradient('petct-rainbow')).toBe(getPseudocolorGradient('hotmetal'))
  })
})
