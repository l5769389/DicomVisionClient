import { describe, expect, it } from 'vitest'
import type { FolderSeriesItem } from '../../types/viewer'
import { buildSeriesTreeGroups } from './seriesGrouping'

type SeriesGroupFixture = Partial<FolderSeriesItem> & {
  accessionNumber?: string | null
  patientName?: string | null
  studyDate?: string | null
  studyDescription?: string | null
}

function createSeries(overrides: SeriesGroupFixture): FolderSeriesItem {
  return {
    folderPath: '',
    instanceCount: 20,
    modality: 'CT',
    patientId: 'patient-a',
    seriesDescription: 'Series A',
    seriesId: 'series-a',
    seriesInstanceUid: 'series-uid-a',
    studyInstanceUid: 'study-uid-a',
    thumbnailSrc: '',
    width: 512,
    height: 512,
    ...overrides
  } as FolderSeriesItem
}

describe('seriesGrouping', () => {
  it('formats patient names and study dates without showing technical identifiers', () => {
    const groups = buildSeriesTreeGroups(
      [
        createSeries({
          accessionNumber: 'ACC-1',
          patientName: 'Tag^Tester',
          studyDate: '20260519',
          studyDescription: 'Chest CT',
          studyInstanceUid: '1.2.3.4.5.6'
        })
      ],
      'en-US'
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].title).toBe('Tag Tester')
    expect(groups[0].subtitle).toBe('')
    expect(groups[0].studies[0].title).toBe('2026-05-19')
    expect(groups[0].studies[0].subtitle).toBe('Chest CT \u00b7 ACC ACC-1')
    expect(groups[0].studies[0].title).not.toContain('1.2.3')
    expect(groups[0].studies[0].subtitle).not.toContain('1.2.3')
  })

  it('groups by patient and study, then sorts studies by newest date first', () => {
    const groups = buildSeriesTreeGroups(
      [
        createSeries({
          seriesId: 'old-series',
          seriesInstanceUid: 'old-series-uid',
          studyInstanceUid: 'old-study-uid',
          studyDate: '20260518'
        }),
        createSeries({
          seriesId: 'new-series',
          seriesInstanceUid: 'new-series-uid',
          studyInstanceUid: 'new-study-uid',
          studyDate: '20260520'
        })
      ],
      'en-US'
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(2)
    expect(groups[0].studies.map((study) => study.title)).toEqual(['2026-05-20', '2026-05-18'])
  })

  it('uses localized fallback labels when patient and study fields are missing', () => {
    const groups = buildSeriesTreeGroups(
      [
        createSeries({
          patientId: '',
          patientName: '',
          studyDate: '',
          studyDescription: '',
          studyInstanceUid: ''
        })
      ],
      'zh-CN'
    )

    expect(groups[0].title).toBe('\u672a\u77e5\u60a3\u8005')
    expect(groups[0].studies[0].title).toBe('\u672a\u77e5\u68c0\u67e5')
    expect(groups[0].studies[0].subtitle).toBe('')
  })
})
