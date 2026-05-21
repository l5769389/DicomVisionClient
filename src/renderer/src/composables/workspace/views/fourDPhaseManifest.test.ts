import { describe, expect, it } from 'vitest'
import type { FolderSeriesItem, FourDPhasesResponse } from '../../../types/viewer'
import {
  mergeFourDManifestIntoSeriesList,
  mergeFourDSeriesMetadataIntoSeriesList,
  normalizeFourDManifestResponse,
  resolveFourDPhasePlan
} from './fourDPhaseManifest'

function createSeries(seriesId: string, overrides: Partial<FolderSeriesItem> = {}): FolderSeriesItem {
  return {
    seriesId,
    studyInstanceUid: 'study-1',
    seriesInstanceUid: seriesId,
    seriesDescription: seriesId,
    modality: 'CT',
    instanceCount: 1,
    folderPath: '',
    ...overrides
  } as FolderSeriesItem
}

function createManifest(overrides: Partial<FourDPhasesResponse> = {}): FourDPhasesResponse {
  return {
    seriesId: 'root',
    isFourDSeries: true,
    fourDPhaseCount: 2,
    fourDPhases: [
      { phaseIndex: 0, label: 'P0', seriesId: 'phase-0' },
      { phaseIndex: 1, label: 'P1', seriesId: 'phase-1' }
    ],
    ...overrides
  }
}

describe('fourDPhaseManifest', () => {
  it('normalizes backend manifest responses with contiguous phases', () => {
    expect(
      normalizeFourDManifestResponse(
        {
          isFourDSeries: true,
          fourDPhases: [
            { phaseIndex: 3, label: 'Late', seriesId: 'late' },
            { phaseIndex: 1, label: 'Early', seriesId: 'early' }
          ]
        },
        'fallback'
      )
    ).toEqual({
      seriesId: 'fallback',
      isFourDSeries: true,
      fourDPhaseCount: 2,
      fourDPhases: [
        { phaseIndex: 0, label: 'Early', seriesId: 'early', imageSrc: '', viewportImages: {}, status: 'pending' },
        { phaseIndex: 1, label: 'Late', seriesId: 'late', imageSrc: '', viewportImages: {}, status: 'pending' }
      ]
    })
  })

  it('merges canonical manifest metadata into root and phase series', () => {
    const merged = mergeFourDManifestIntoSeriesList(
      [createSeries('root'), createSeries('phase-0'), createSeries('phase-1'), createSeries('other')],
      'root',
      createManifest()
    )

    expect(merged.find((series) => series.seriesId === 'root')?.isFourDSeries).toBe(true)
    expect(merged.find((series) => series.seriesId === 'phase-0')?.fourDPhaseCount).toBe(2)
    expect(merged.find((series) => series.seriesId === 'phase-1')?.fourDPhases?.[1]?.seriesId).toBe('phase-1')
    expect(merged.find((series) => series.seriesId === 'other')?.isFourDSeries).toBeUndefined()
  })

  it('keeps richer existing phase metadata when backend manifest is less specific', () => {
    const existingPhases = [
      { phaseIndex: 0, label: 'Existing P0', seriesId: 'phase-0' },
      { phaseIndex: 1, label: 'Existing P1', seriesId: 'phase-1' }
    ]
    const merged = mergeFourDManifestIntoSeriesList(
      [
        createSeries('root', {
          isFourDSeries: true,
          fourDPhaseCount: 2,
          fourDPhases: existingPhases
        })
      ],
      'root',
      createManifest({
        fourDPhases: [
          { phaseIndex: 0, label: 'Fallback P0', seriesId: null },
          { phaseIndex: 1, label: 'Fallback P1', seriesId: null }
        ]
      })
    )

    expect(merged[0]?.fourDPhases).toBe(existingPhases)
  })

  it('propagates metadata from a newly loaded phase series to an existing phase mate', () => {
    const phaseManifest = createManifest({
      seriesId: 'phase-1',
      fourDPhases: [
        { phaseIndex: 0, label: 'P0', seriesId: 'phase-0' },
        { phaseIndex: 1, label: 'P1', seriesId: 'phase-1' }
      ]
    })

    const merged = mergeFourDSeriesMetadataIntoSeriesList(
      [createSeries('phase-0'), createSeries('phase-1')],
      [
        createSeries('phase-1', {
          isFourDSeries: phaseManifest.isFourDSeries,
          fourDPhaseCount: phaseManifest.fourDPhaseCount,
          fourDPhases: phaseManifest.fourDPhases
        })
      ]
    )

    expect(merged.find((series) => series.seriesId === 'phase-0')?.isFourDSeries).toBe(true)
    expect(merged.find((series) => series.seriesId === 'phase-0')?.fourDPhaseCount).toBe(2)
    expect(merged.find((series) => series.seriesId === 'phase-1')?.fourDPhases?.[0]?.seriesId).toBe('phase-0')
  })

  it('resolves backend, series, and default phase plans in priority order', () => {
    const series = createSeries('root', {
      fourDPhaseCount: 4,
      fourDPhases: [{ phaseIndex: 0, label: 'Series P0', seriesId: 'series-phase' }]
    })

    expect(resolveFourDPhasePlan(series, createManifest()).hasBackendManifest).toBe(true)
    expect(resolveFourDPhasePlan(series, null).phaseItems[0]?.label).toBe('Series P0')
    expect(resolveFourDPhasePlan(createSeries('empty'), null, 3).phaseCount).toBe(3)
  })
})
