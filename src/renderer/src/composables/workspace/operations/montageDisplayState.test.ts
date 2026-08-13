import { describe, expect, it } from 'vitest'
import type { PetInfo, ViewerTabItem } from '../../../types/viewer'
import {
  commitMontagePseudocolor,
  commitMontageWindowInfo
} from './montageDisplayState'

function createMontageTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'montage-series',
    seriesId: 'series',
    seriesTitle: 'Series',
    title: 'Series Montage',
    viewType: 'Montage',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: 'WW 400 / WL 40',
    initialWindowInfo: { ww: 400, wl: 40 },
    currentWindowInfo: { ww: 400, wl: 40 },
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [], tags: {} },
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false, zoom: 1, offsetX: 0, offsetY: 0 },
    pseudocolorPreset: 'bw',
    montageDisplayRevision: 3,
    ...overrides
  }
}

function createPetInfo(): PetInfo {
  return {
    seriesId: 'series',
    sourceUnit: 'BQML',
    sourceUnitLabel: 'Source (BQML)',
    petUnit: 'SUVbw',
    petUnitLabel: 'g/ml (SUVbw)',
    petWindowMin: 0,
    petWindowMax: 0.63,
    pseudocolorPreset: 'bwinverse',
    unitOptions: [{ unit: 'SUVbw', label: 'g/ml (SUVbw)', available: true }],
    quantitative: true,
    quantificationStatus: 'valid',
    supportStatus: 'static-supported',
    warnings: []
  }
}

describe('montageDisplayState', () => {
  it('commits a CT window template and advances the display revision', () => {
    const next = commitMontageWindowInfo(createMontageTab(), { ww: 1500, wl: -600 }, { seedInitial: false })

    expect(next.currentWindowInfo).toEqual({ ww: 1500, wl: -600 })
    expect(next.windowLabel).toBe('WW 1500 / WL -600')
    expect(next.cornerInfo.tags?.windowLevel).toEqual(['W: 1500 L: -600'])
    expect(next.montageDisplayRevision).toBe(4)
  })

  it('preserves fractional PET window widths instead of applying the CT minimum', () => {
    const next = commitMontageWindowInfo(
      createMontageTab({
        currentWindowInfo: { ww: 0.63, wl: 0.315 },
        initialWindowInfo: { ww: 0.63, wl: 0.315 },
        petInfo: createPetInfo(),
        pseudocolorPreset: 'bwinverse'
      }),
      { ww: 0.08, wl: 0.04 },
      { seedInitial: false }
    )

    expect(next.currentWindowInfo).toEqual({ ww: 0.08, wl: 0.04 })
    expect(next.petInfo?.petWindowMin).toBe(0)
    expect(next.petInfo?.petWindowMax).toBe(0.08)
    expect(next.montageDisplayRevision).toBe(4)
  })

  it('commits PET pseudocolor to both montage fields without changing intensity', () => {
    const tab = createMontageTab({
      currentWindowInfo: { ww: 0.63, wl: 0.315 },
      petInfo: createPetInfo(),
      pseudocolorPreset: 'bwinverse'
    })
    const next = commitMontagePseudocolor(tab, 'pseudocolor:rainbow')

    expect(next.pseudocolorPreset).toBe('rainbow')
    expect(next.petInfo?.pseudocolorPreset).toBe('rainbow')
    expect(next.currentWindowInfo).toEqual({ ww: 0.63, wl: 0.315 })
    expect(next.montageDisplayRevision).toBe(4)
  })
})
