import { describe, expect, it } from 'vitest'
import type { FolderSeriesItem } from '../../../types/viewer'
import { getFolderSeriesDedupKey, mergeLoadedFolderSeries } from './folderSeriesMerge'

function createSeries(seriesId: string, overrides: Partial<FolderSeriesItem> = {}): FolderSeriesItem {
  return {
    seriesId,
    folderPath: `C:/dicom/${seriesId}`,
    seriesInstanceUid: `uid-${seriesId}`,
    patientName: 'Anonymous',
    patientId: 'patient-1',
    studyDate: '20260521',
    studyDescription: '',
    accessionNumber: '',
    modality: 'CT',
    seriesDescription: seriesId,
    instanceCount: 1,
    thumbnailSrc: '',
    ...overrides
  } as FolderSeriesItem
}

describe('folderSeriesMerge', () => {
  it('uses stable backend seriesId before folder and uid fallback', () => {
    expect(
      getFolderSeriesDedupKey(
        createSeries('series-a', {
          folderPath: 'C:/other/path',
          seriesInstanceUid: 'shared-series-instance-uid'
        })
      )
    ).toBe('series-a')
  })

  it('updates existing series while preserving existing thumbnails when reload has none', () => {
    const existing = createSeries('series-a', {
      instanceCount: 1,
      thumbnailSrc: 'old-thumb',
      thumbnailUrl: 'old-url'
    })
    const incoming = createSeries('series-a', {
      instanceCount: 8,
      thumbnailSrc: '',
      thumbnailUrl: ''
    })

    const result = mergeLoadedFolderSeries([existing], [incoming])

    expect(result.seriesList).toHaveLength(1)
    expect(result.appendedSeries).toHaveLength(0)
    expect(result.loadedSeries[0]?.instanceCount).toBe(8)
    expect(result.loadedSeries[0]?.thumbnailSrc).toBe('old-thumb')
    expect(result.loadedSeries[0]?.thumbnailUrl).toBe('old-url')
  })

  it('places newly loaded series before existing series and exposes the loaded series in incoming order', () => {
    const existing = createSeries('series-a')
    const incomingB = createSeries('series-b')
    const incomingC = createSeries('series-c')

    const result = mergeLoadedFolderSeries([existing], [incomingB, incomingC])

    expect(result.seriesList.map((item) => item.seriesId)).toEqual(['series-b', 'series-c', 'series-a'])
    expect(result.loadedSeries.map((item) => item.seriesId)).toEqual(['series-b', 'series-c'])
    expect(result.appendedSeries.map((item) => item.seriesId)).toEqual(['series-b', 'series-c'])
  })

  it('moves reloaded existing series to the front of the series list', () => {
    const existingA = createSeries('series-a')
    const existingB = createSeries('series-b', { instanceCount: 1 })
    const incomingB = createSeries('series-b', { instanceCount: 12 })

    const result = mergeLoadedFolderSeries([existingA, existingB], [incomingB])

    expect(result.seriesList.map((item) => item.seriesId)).toEqual(['series-b', 'series-a'])
    expect(result.seriesList[0]?.instanceCount).toBe(12)
    expect(result.loadedSeries.map((item) => item.seriesId)).toEqual(['series-b'])
    expect(result.appendedSeries).toEqual([])
  })

  it('propagates incoming 4D metadata to an already loaded phase mate', () => {
    const existingPhase0 = createSeries('phase-0')
    const incomingPhase1 = createSeries('phase-1', {
      isFourDSeries: true,
      fourDPhaseCount: 2,
      fourDPhases: [
        { phaseIndex: 0, label: 'Phase 0%', seriesId: 'phase-0' },
        { phaseIndex: 1, label: 'Phase 50%', seriesId: 'phase-1' }
      ]
    })

    const result = mergeLoadedFolderSeries([existingPhase0], [incomingPhase1])

    expect(result.seriesList.find((item) => item.seriesId === 'phase-0')?.isFourDSeries).toBe(true)
    expect(result.seriesList.find((item) => item.seriesId === 'phase-0')?.fourDPhaseCount).toBe(2)
    expect(result.loadedSeries[0]?.fourDPhases?.map((phase) => phase.seriesId)).toEqual(['phase-0', 'phase-1'])
  })

  it('updates the selected phase when a parent folder reload returns the same series as 4D', () => {
    const existingPhase0 = createSeries('phase-0', {
      isFourDSeries: false,
      fourDPhaseCount: null,
      fourDPhases: null
    })
    const incomingPhase0 = createSeries('phase-0', {
      isFourDSeries: true,
      fourDPhaseCount: 2,
      fourDPhases: [
        { phaseIndex: 0, label: 'Phase 0%', seriesId: 'phase-0' },
        { phaseIndex: 1, label: 'Phase 50%', seriesId: 'phase-1' }
      ]
    })

    const result = mergeLoadedFolderSeries([existingPhase0], [incomingPhase0, createSeries('phase-1')])

    expect(result.seriesList.find((item) => item.seriesId === 'phase-0')?.isFourDSeries).toBe(true)
    expect(result.seriesList.find((item) => item.seriesId === 'phase-0')?.fourDPhaseCount).toBe(2)
    expect(result.loadedSeries[0]?.seriesId).toBe('phase-0')
    expect(result.appendedSeries.map((item) => item.seriesId)).toEqual(['phase-1'])
  })
})
