import { describe, expect, it } from 'vitest'
import type { FolderSeriesItem } from '../../../types/viewer'
import { isLayoutStackDropSeriesSupported, resolveLayoutStackDropSeries } from './layoutDropSeries'

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

describe('layout drop series support', () => {
  it('rejects unsupported series for layout Stack slots', () => {
    const series = createSeries({
      preferredViewType: 'tag'
    })

    expect(isLayoutStackDropSeriesSupported(series)).toBe(false)
    expect(resolveLayoutStackDropSeries([series])).toBeNull()
  })

  it('chooses the first Stack-supported series from a DICOM drop result', () => {
    const tagSeries = createSeries({
      seriesId: 'tag-series',
      preferredViewType: 'Tag'
    })
    const stackSeries = createSeries({
      seriesId: 'stack-series'
    })

    expect(resolveLayoutStackDropSeries([tagSeries, stackSeries])).toBe(stackSeries)
  })

  it('returns null when a DICOM drop has no Stack-supported series', () => {
    const documentSeries = createSeries({
      seriesId: 'document-series',
      isImageSeries: false,
      instanceCount: 1,
      width: null,
      height: null,
      modality: 'SR',
      standardObjectType: 'DICOM_SR'
    })
    const tagSeries = createSeries({
      seriesId: 'tag-series',
      preferredViewType: ' TAG '
    })

    expect(resolveLayoutStackDropSeries([documentSeries, tagSeries])).toBeNull()
  })
})
