import { describe, expect, it } from 'vitest'
import type { FolderSeriesItem } from '../../../types/viewer'
import {
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY,
  buildTabTitle,
  createTab,
  createDefaultPetInfo,
  createEmptyFusionPseudocolorPresets,
  getViewTypeDisplayLabel,
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

  it('displays standalone Stack and PET tabs as 2D while keeping internal view types', () => {
    const stackSeries = { seriesId: 'ct-series', patientName: 'Patient CT', seriesDescription: 'AC for PET' } as FolderSeriesItem
    const petSeries = { seriesId: 'pet-series', patientName: 'Patient PET', seriesDescription: 'PET FDG SUV' } as FolderSeriesItem

    const stackTab = createTab(stackSeries, 'Stack')
    const petTab = createTab(petSeries, 'PET')

    expect(stackTab.title).toBe('Patient CT · 2D')
    expect(stackTab.viewType).toBe('Stack')
    expect(petTab.title).toBe('Patient PET · 2D')
    expect(petTab.viewType).toBe('PET')
    expect(buildTabTitle(petSeries, 'PET', 'fallback')).toBe('Patient PET · 2D')
  })

  it('falls back to the series display name when the patient name is absent', () => {
    const series = { seriesId: 'ct-series', seriesDescription: 'CT Head' } as FolderSeriesItem

    expect(buildTabTitle(series, 'Stack', 'fallback')).toBe('CT Head · 2D')
  })

  it('keeps the patient name as the primary label for every tab type', () => {
    const series = { seriesId: 'ct-series', patientName: 'Patient One', seriesDescription: 'Head CT' } as FolderSeriesItem

    expect(createTab(series, 'Tag').seriesTitle).toBe('Patient One')
    expect(createTab(series, 'Tag').title).toBe('Patient One · Tag')
    expect(createTab(series, '4D').seriesTitle).toBe('Patient One')
    expect(createTab(series, '4D').title).toBe('Patient One · 4D')
  })

  it('uses 2D Compare as the user-facing label for CompareStack', () => {
    expect(getViewTypeDisplayLabel('CompareStack')).toBe('2D Compare')
    expect(getViewTypeDisplayLabel('CompareStack', 'zh-CN')).toBe('2D 对比')
  })
})
