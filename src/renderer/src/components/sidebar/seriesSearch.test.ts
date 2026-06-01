import { describe, expect, it } from 'vitest'
import type { FolderSeriesItem } from '../../types/viewer'
import {
  buildSeriesSearchTerms,
  createSeriesSearchTermCache,
  doesSeriesMatchSearch,
  normalizeSeriesSearch
} from './seriesSearch'

function createSeries(overrides: Partial<FolderSeriesItem> = {}): FolderSeriesItem {
  return {
    seriesId: 'series-1',
    seriesInstanceUid: '1.2.3.series',
    studyInstanceUid: '1.2.3.study',
    patientId: 'PID',
    patientName: 'Patient',
    studyDate: '20260530',
    studyDescription: 'Foot study',
    accessionNumber: 'ACC',
    modality: 'CT',
    seriesDescription: '  Bone  Surface  ',
    instanceCount: 24,
    width: 512,
    height: 512,
    thumbnailSrc: '',
    thumbnailUrl: '',
    folderPath: 'D:/dicom/source',
    isImageSeries: true,
    standardObjectType: null,
    preferredViewType: null,
    compatibilityIssues: [],
    ...overrides
  }
}

describe('series search helpers', () => {
  it('normalizes whitespace and casing', () => {
    expect(normalizeSeriesSearch('  Bone   Surface  ')).toBe('bone surface')
  })

  it('matches every token against cached normalized series terms', () => {
    const series = createSeries()
    const cache = createSeriesSearchTermCache()

    expect(doesSeriesMatchSearch(series, 'bone ct', cache)).toBe(true)
    expect(doesSeriesMatchSearch(series, 'bone missing', cache)).toBe(false)
  })

  it('invalidates cached terms when a stable series record changes', () => {
    const series = createSeries()
    const cache = createSeriesSearchTermCache()

    expect(cache.get(series)).toContain('bone surface')
    series.seriesDescription = 'Dose Report'

    expect(cache.get(series)).toContain('dose report')
    expect(buildSeriesSearchTerms(series)).toContain('dose report')
  })
})
