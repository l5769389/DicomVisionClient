import { describe, expect, it } from 'vitest'
import { getDistinctFourDPhaseSeriesIds, resolveFourDPhaseSeriesId } from './fourDPhaseMetadata'

describe('fourDPhaseMetadata', () => {
  it('collects distinct phase series ids and retains the fallback series id', () => {
    expect(
      getDistinctFourDPhaseSeriesIds(
        [
          { phaseIndex: 0, label: 'P0', seriesId: 'phase-0' },
          { phaseIndex: 1, label: 'P1', seriesId: 'phase-1' },
          { phaseIndex: 2, label: 'P2', seriesId: 'phase-1' },
          { phaseIndex: 3, label: 'P3', seriesId: null }
        ],
        'root-series'
      )
    ).toEqual(['root-series', 'phase-0', 'phase-1'])
  })

  it('resolves the correct series id for a given phase key and falls back safely', () => {
    const tab = {
      seriesId: 'root-series',
      fourDPhaseItems: [
        { phaseIndex: 0, label: 'P0', seriesId: 'phase-0' },
        { phaseIndex: 1, label: 'P1', seriesId: 'phase-1' },
        { phaseIndex: 2, label: 'P2', seriesId: null }
      ]
    }

    expect(resolveFourDPhaseSeriesId(tab, '0')).toBe('phase-0')
    expect(resolveFourDPhaseSeriesId(tab, '1')).toBe('phase-1')
    expect(resolveFourDPhaseSeriesId(tab, '2')).toBe('root-series')
    expect(resolveFourDPhaseSeriesId(tab, 'not-a-phase')).toBe('root-series')
    expect(resolveFourDPhaseSeriesId(tab, null)).toBe('root-series')
  })
})
