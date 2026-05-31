import { describe, expect, it } from 'vitest'
import type { FolderSeriesItem } from '../../../types/viewer'
import { isSeriesViewSupported, isSeriesVolumeViewSupported, resolveInitialSeriesViewType } from './seriesViewSupport'

function createSeries(overrides: Partial<FolderSeriesItem> = {}): FolderSeriesItem {
  return {
    seriesId: 'series-1',
    seriesInstanceUid: '1.2.3.series',
    studyInstanceUid: '1.2.3.study',
    patientId: 'PID',
    patientName: 'Patient',
    studyDate: '20260530',
    studyDescription: 'Study',
    accessionNumber: 'ACC',
    modality: 'CT',
    seriesDescription: 'CT Volume',
    instanceCount: 80,
    width: 512,
    height: 512,
    thumbnailSrc: '',
    thumbnailUrl: '',
    folderPath: '.',
    isImageSeries: true,
    standardObjectType: null,
    preferredViewType: null,
    compatibilityIssues: [],
    ...overrides
  }
}

describe('series view support', () => {
  it('supports 3D and MPR for multi-slice image series', () => {
    const series = createSeries()

    expect(isSeriesVolumeViewSupported(series)).toBe(true)
    expect(isSeriesViewSupported(series, '3D')).toBe(true)
    expect(isSeriesViewSupported(series, 'MPR')).toBe(true)
  })

  it('disables 3D and MPR for single-frame report-like images', () => {
    const series = createSeries({
      seriesDescription: 'Dose Report',
      instanceCount: 1,
      width: 675,
      height: 257
    })

    expect(isSeriesViewSupported(series, 'Stack')).toBe(true)
    expect(isSeriesViewSupported(series, '3D')).toBe(false)
    expect(isSeriesViewSupported(series, 'MPR')).toBe(false)
  })

  it('disables volume views for non-image DICOM documents but keeps tags available', () => {
    const series = createSeries({
      isImageSeries: false,
      standardObjectType: 'DICOM_SR',
      preferredViewType: 'Tag',
      modality: 'SR',
      instanceCount: 1,
      width: null,
      height: null
    })

    expect(isSeriesViewSupported(series, 'Stack')).toBe(false)
    expect(isSeriesViewSupported(series, '3D')).toBe(false)
    expect(isSeriesViewSupported(series, 'MPR')).toBe(false)
    expect(isSeriesViewSupported(series, 'Tag')).toBe(true)
  })

  it('resolves tag-preferred series to Tag regardless of preferredViewType casing', () => {
    expect(resolveInitialSeriesViewType(createSeries({ preferredViewType: 'tag' }))).toBe('Tag')
    expect(resolveInitialSeriesViewType(createSeries({ preferredViewType: ' TAG ' }))).toBe('Tag')
  })

  it('disables Stack for tag-preferred image series but keeps tags available', () => {
    const series = createSeries({ preferredViewType: 'tag' })

    expect(isSeriesViewSupported(series, 'Stack')).toBe(false)
    expect(isSeriesViewSupported(series, 'Tag')).toBe(true)
  })

  it('keeps 4D gated by explicit phase metadata', () => {
    expect(isSeriesViewSupported(createSeries(), '4D')).toBe(false)
    expect(isSeriesViewSupported(createSeries({ isFourDSeries: true, fourDPhaseCount: 3 }), '4D')).toBe(true)
  })
})
