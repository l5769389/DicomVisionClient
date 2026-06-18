import { describe, expect, it } from 'vitest'
import {
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY,
  createDefaultPetInfo,
  createEmptyFusionPseudocolorPresets,
  resolveFusionPaneSeriesId
} from './viewerWorkspaceTabs'

describe('viewerWorkspaceTabs fusion helpers', () => {
  it('keeps non-overlay fusion panes tied to their own source series', () => {
    const fusionSeriesIds = {
      ctSeriesId: 'ct-series',
      petSeriesId: 'pet-series'
    }

    expect(resolveFusionPaneSeriesId(FUSION_CT_AXIAL_PANE_KEY, fusionSeriesIds, 'fallback')).toBe('ct-series')
    expect(resolveFusionPaneSeriesId(FUSION_OVERLAY_AXIAL_PANE_KEY, fusionSeriesIds, 'fallback')).toBe('ct-series')
    expect(resolveFusionPaneSeriesId(FUSION_PET_AXIAL_PANE_KEY, fusionSeriesIds, 'fallback')).toBe('pet-series')
    expect(resolveFusionPaneSeriesId(FUSION_PET_CORONAL_MIP_PANE_KEY, fusionSeriesIds, 'fallback')).toBe('pet-series')
  })

  it('falls back to the tab series id when fusion series ids are missing', () => {
    expect(resolveFusionPaneSeriesId(FUSION_PET_AXIAL_PANE_KEY, null, 'fallback')).toBe('fallback')
    expect(resolveFusionPaneSeriesId(FUSION_OVERLAY_AXIAL_PANE_KEY, undefined, 'fallback')).toBe('fallback')
  })

  it('uses grayscale PET panes and PET-CT pseudocolor for the overlay by default', () => {
    const presets = createEmptyFusionPseudocolorPresets()

    expect(presets[FUSION_CT_AXIAL_PANE_KEY]).toBe('bw')
    expect(presets[FUSION_PET_AXIAL_PANE_KEY]).toBe('bwinverse')
    expect(presets[FUSION_OVERLAY_AXIAL_PANE_KEY]).toBe('petct-rainbow')
    expect(presets[FUSION_PET_CORONAL_MIP_PANE_KEY]).toBe('bwinverse')
  })

  it('uses the fusion PET-only pseudocolor by default for standalone PET tabs', () => {
    expect(createDefaultPetInfo('pet-series').pseudocolorPreset).toBe('bwinverse')
  })
})
