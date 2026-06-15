import { describe, expect, it } from 'vitest'
import {
  isStaleMprSegmentationPreviewConfig,
  mergeMprSegmentationPreviewConfig,
  normalizeMprSegmentationConfig,
  recolorMprSegmentationConfig,
  resolveMprLegacyVoiSphere,
  type MprThresholdRegion
} from './viewer'

function createRegion(depthMm = 1, sampleCount = 0): MprThresholdRegion {
  return {
    id: 'r1',
    enabled: true,
    label: '1',
    thresholdHu: 300,
    thresholdMode: 'hu',
    thresholdPercentile: 80,
    color: '#ff4df8',
    box: {
      centerWorld: [0, 0, 0],
      rowWorld: [0, 1, 0],
      colWorld: [0, 0, 1],
      normalWorld: [1, 0, 0],
      widthMm: 20,
      heightMm: 30,
      depthMm,
      sourceViewport: 'mpr-ax'
    },
    stats: sampleCount > 0
      ? {
          huMean: 120,
          huMin: 20,
          huMax: 300,
          huStdDev: 12,
          volumeCm3: 1.25,
          sampleCount,
          effectiveThresholdHu: 300
        }
      : null
  }
}

describe('normalizeMprSegmentationConfig', () => {
  it('resolves the legacy VOI sphere from selected id with first-item fallback', () => {
    const spheres = [
      {
        id: 'v1',
        label: '1',
        enabled: true,
        centerWorld: [0, 0, 0] as [number, number, number],
        radiusMm: 12,
        color: '#22d3ee',
        stats: null
      },
      {
        id: 'v2',
        label: '2',
        enabled: true,
        centerWorld: [1, 2, 3] as [number, number, number],
        radiusMm: 16,
        color: '#22d3ee',
        stats: null
      }
    ]

    expect(resolveMprLegacyVoiSphere(spheres, 'v2')).toBe(spheres[1])
    expect(resolveMprLegacyVoiSphere(spheres, 'missing')).toBe(spheres[0])
    expect(resolveMprLegacyVoiSphere([], 'v1')).toBeNull()
  })

  it('honors explicit threshold selection when fallback has a selected VOI', () => {
    const fallback = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 7,
      selectedRegionId: null,
      selectedVoi: true,
      selectedVoiId: 'v1',
      thresholdRegions: [createRegion()],
      voiSpheres: [
        {
          id: 'v1',
          label: '1',
          enabled: true,
          centerWorld: [0, 0, 0],
          radiusMm: 12,
          color: '#22d3ee',
          stats: null
        }
      ]
    })

    expect(
      normalizeMprSegmentationConfig(
        {
          ...fallback,
          selectedRegionId: 'r1',
          selectedVoi: false,
          selectedVoiId: null
        },
        fallback
      )
    ).toEqual(expect.objectContaining({
      selectedRegionId: 'r1',
      selectedVoi: false,
      selectedVoiId: null
    }))
  })

  it('normalizes threshold regions, selected region, stats, and VOI sphere', () => {
    expect(
      normalizeMprSegmentationConfig({
        enabled: true,
        clientRevision: 4,
        selectedRegionId: 'missing',
        selectedVoi: true,
        thresholdRegions: [
          {
            id: 'r1',
            enabled: true,
            label: '',
            thresholdHu: 5000,
            thresholdMode: 'percentile',
            thresholdPercentile: 99.5,
            color: 'cyan',
            box: {
              centerWorld: [1, 2, 3],
              rowWorld: [0, 2, 0],
              colWorld: [0, 0, 3],
              normalWorld: [4, 0, 0],
              widthMm: -1,
              heightMm: 8,
              depthMm: 0,
              sourceViewport: 'mpr-cor'
            },
            stats: {
              huMean: 10,
              huMin: 5,
              huMax: 20,
              huStdDev: 2,
              volumeCm3: 1.5,
              sampleCount: 42,
              effectiveThresholdHu: 88.8
            }
          }
        ],
        voiSphere: {
          id: 'legacy-voi',
          label: 'A',
          enabled: true,
          centerWorld: [9, 8, 7],
          radiusMm: -2,
          color: '#22D3EE',
          stats: {
            huMean: 100,
            huMin: 50,
            huMax: 150,
            huStdDev: 8,
            volumeCm3: 2.5,
            sampleCount: 123
          }
        }
      })
    ).toEqual({
      enabled: true,
      clientRevision: 4,
      selectedRegionId: null,
      selectedVoi: true,
      selectedVoiId: 'legacy-voi',
      thresholdRegions: [
        {
          id: 'r1',
          enabled: true,
          label: '',
          thresholdHu: 3071,
          thresholdMode: 'percentile',
          thresholdPercentile: 99.5,
          color: '#ff4df8',
          box: {
            centerWorld: [1, 2, 3],
            rowWorld: [0, 1, 0],
            colWorld: [0, 0, 1],
            normalWorld: [1, 0, 0],
            widthMm: 0.1,
            heightMm: 8,
            depthMm: 0.1,
            sourceViewport: 'mpr-cor'
          },
          stats: {
            huMean: 10,
            huMin: 5,
            huMax: 20,
            huStdDev: 2,
            volumeCm3: 1.5,
            sampleCount: 42,
            effectiveThresholdHu: 88.8
          }
        }
      ],
      voiSpheres: [
        {
          id: 'legacy-voi',
          label: 'A',
          enabled: true,
          centerWorld: [9, 8, 7],
          radiusMm: 0.1,
          color: '#22d3ee',
          stats: {
            huMean: 100,
            huMin: 50,
            huMax: 150,
            huStdDev: 8,
            volumeCm3: 2.5,
            sampleCount: 123
          }
        }
      ],
      voiSphere: {
        id: 'legacy-voi',
        label: 'A',
        enabled: true,
        centerWorld: [9, 8, 7],
        radiusMm: 0.1,
        color: '#22d3ee',
        stats: {
          huMean: 100,
          huMin: 50,
          huMax: 150,
          huStdDev: 8,
          volumeCm3: 2.5,
          sampleCount: 123
        }
      }
    })
  })

  it('allows editable segmentation labels to be cleared', () => {
    const normalized = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 1,
      thresholdRegions: [
        {
          ...createRegion(),
          label: ''
        }
      ],
      voiSpheres: [
        {
          id: 'v1',
          label: '',
          enabled: true,
          centerWorld: [0, 0, 0],
          radiusMm: 12,
          color: '#22d3ee',
          stats: null
        }
      ],
      voiSphere: {
        id: 'v1',
        label: '',
        enabled: true,
        centerWorld: [0, 0, 0],
        radiusMm: 12,
        color: '#22d3ee',
        stats: null
      }
    })

    expect(normalized.thresholdRegions[0]?.label).toBe('')
    expect(normalized.voiSpheres[0]?.label).toBe('')
    expect(normalized.voiSphere?.label).toBe('')
  })

  it('accepts legacy fields without regenerating legacy output fields', () => {
    expect(
      normalizeMprSegmentationConfig({
        enabled: true,
        clientRevision: -1,
        lowerHu: 5000,
        upperHu: -5000,
        opacity: 2,
        color: 'cyan',
        voiBox: {
          xMin: 0.8,
          xMax: 0.2,
          yMin: -1,
          yMax: 0.6,
          zMin: 0.4,
          zMax: 2
        }
      })
    ).toEqual({
      enabled: true,
      clientRevision: 0,
      selectedRegionId: null,
      selectedVoi: false,
      selectedVoiId: null,
      thresholdRegions: [],
      voiSpheres: [],
      voiSphere: null
    })
  })

  it('merges matching backend preview stats without replacing local threshold geometry', () => {
    const current = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 3,
      selectedRegionId: 'r1',
      thresholdRegions: [createRegion(3)]
    })
    const incoming = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 3,
      selectedRegionId: 'r1',
      thresholdRegions: [createRegion(3, 8)]
    })
    const currentRegion = current.thresholdRegions[0]!
    const incomingRegion = incoming.thresholdRegions[0]!

    expect(mergeMprSegmentationPreviewConfig(current, incoming).thresholdRegions[0]).toEqual({
      ...currentRegion,
      stats: incomingRegion.stats
    })
  })

  it('does not let stale backend preview depth override the local threshold geometry', () => {
    const current = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 7,
      selectedRegionId: 'r1',
      thresholdRegions: [createRegion(12)]
    })
    const staleIncoming = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 6,
      selectedRegionId: 'r1',
      thresholdRegions: [createRegion(3, 8)]
    })

    expect(mergeMprSegmentationPreviewConfig(current, staleIncoming).thresholdRegions[0]).toEqual(current.thresholdRegions[0]!)
    expect(isStaleMprSegmentationPreviewConfig(current, staleIncoming)).toBe(true)
  })

  it('merges matching backend VOI stats without replacing local VOI geometry', () => {
    const current = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 9,
      selectedVoi: true,
      selectedVoiId: 'v1',
      voiSpheres: [
        {
          id: 'v1',
          label: '1',
          enabled: true,
          centerWorld: [1, 2, 3],
          radiusMm: 12,
          color: '#22d3ee',
          stats: null
        }
      ],
      voiSphere: {
        id: 'v1',
        label: '1',
        enabled: true,
        centerWorld: [1, 2, 3],
        radiusMm: 12,
        color: '#22d3ee',
        stats: null
      }
    })
    const incoming = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 9,
      selectedVoi: true,
      selectedVoiId: 'v1',
      voiSpheres: [
        {
          id: 'v1',
          label: '1',
          enabled: true,
          centerWorld: [1, 2, 3],
          radiusMm: 12,
          color: '#22d3ee',
          stats: {
            huMean: 20,
            huMin: 10,
            huMax: 30,
            huStdDev: 2,
            volumeCm3: 1.5,
            sampleCount: 15
          }
        }
      ],
      voiSphere: {
        id: 'v1',
        label: '1',
        enabled: true,
        centerWorld: [1, 2, 3],
        radiusMm: 12,
        color: '#22d3ee',
        stats: {
          huMean: 20,
          huMin: 10,
          huMax: 30,
          huStdDev: 2,
          volumeCm3: 1.5,
          sampleCount: 15
        }
      }
    })

    expect(mergeMprSegmentationPreviewConfig(current, incoming).voiSphere).toEqual({
      ...current.voiSphere,
      stats: incoming.voiSphere?.stats
    })
    expect(mergeMprSegmentationPreviewConfig(current, incoming).voiSpheres[0]).toEqual({
      ...current.voiSpheres[0],
      stats: incoming.voiSpheres[0]?.stats
    })
  })

  it('merges backend stats after display-only recolor without reverting local colors', () => {
    const current = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 10,
      selectedRegionId: null,
      selectedVoi: true,
      selectedVoiId: 'v1',
      thresholdRegions: [
        {
          ...createRegion(),
          color: '#112233'
        }
      ],
      voiSpheres: [
        {
          id: 'v1',
          label: '1',
          enabled: true,
          centerWorld: [1, 2, 3],
          radiusMm: 12,
          color: '#445566',
          stats: null
        }
      ],
      voiSphere: {
        id: 'v1',
        label: '1',
        enabled: true,
        centerWorld: [1, 2, 3],
        radiusMm: 12,
        color: '#445566',
        stats: null
      }
    })
    const incoming = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 10,
      selectedRegionId: null,
      selectedVoi: true,
      selectedVoiId: 'v1',
      thresholdRegions: [createRegion(1, 8)],
      voiSpheres: [
        {
          id: 'v1',
          label: '1',
          enabled: true,
          centerWorld: [1, 2, 3],
          radiusMm: 12,
          color: '#22d3ee',
          stats: {
            huMean: 20,
            huMin: 10,
            huMax: 30,
            huStdDev: 2,
            volumeCm3: 1.5,
            sampleCount: 15
          }
        }
      ],
      voiSphere: {
        id: 'v1',
        label: '1',
        enabled: true,
        centerWorld: [1, 2, 3],
        radiusMm: 12,
        color: '#22d3ee',
        stats: {
          huMean: 20,
          huMin: 10,
          huMax: 30,
          huStdDev: 2,
          volumeCm3: 1.5,
          sampleCount: 15
        }
      }
    })

    const merged = mergeMprSegmentationPreviewConfig(current, incoming)

    expect(merged.thresholdRegions[0]).toEqual({
      ...current.thresholdRegions[0],
      stats: incoming.thresholdRegions[0]?.stats ?? null
    })
    expect(merged.voiSpheres[0]).toEqual({
      ...current.voiSpheres[0],
      stats: incoming.voiSpheres[0]?.stats ?? null
    })
    expect(merged.voiSphere).toEqual({
      ...current.voiSphere,
      stats: incoming.voiSphere?.stats ?? null
    })
  })

  it('preserves local selection when backend preview returns an older selected item', () => {
    const current = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 11,
      selectedRegionId: 'r1',
      selectedVoi: false,
      selectedVoiId: null,
      thresholdRegions: [createRegion()],
      voiSpheres: [
        {
          id: 'v1',
          label: '1',
          enabled: true,
          centerWorld: [1, 2, 3],
          radiusMm: 12,
          color: '#22d3ee',
          stats: null
        }
      ],
      voiSphere: {
        id: 'v1',
        label: '1',
        enabled: true,
        centerWorld: [1, 2, 3],
        radiusMm: 12,
        color: '#22d3ee',
        stats: null
      }
    })
    const incoming = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 11,
      selectedRegionId: null,
      selectedVoi: true,
      selectedVoiId: 'v1',
      thresholdRegions: [createRegion(1, 8)],
      voiSpheres: [
        {
          id: 'v1',
          label: '1',
          enabled: true,
          centerWorld: [1, 2, 3],
          radiusMm: 12,
          color: '#22d3ee',
          stats: {
            huMean: 20,
            huMin: 10,
            huMax: 30,
            huStdDev: 2,
            volumeCm3: 1.5,
            sampleCount: 15
          }
        }
      ],
      voiSphere: {
        id: 'v1',
        label: '1',
        enabled: true,
        centerWorld: [1, 2, 3],
        radiusMm: 12,
        color: '#22d3ee',
        stats: {
          huMean: 20,
          huMin: 10,
          huMax: 30,
          huStdDev: 2,
          volumeCm3: 1.5,
          sampleCount: 15
        }
      }
    })

    const merged = mergeMprSegmentationPreviewConfig(current, incoming)

    expect(merged).toEqual(expect.objectContaining({
      selectedRegionId: 'r1',
      selectedVoi: false,
      selectedVoiId: null
    }))
    expect(merged.thresholdRegions[0]?.stats).toEqual(incoming.thresholdRegions[0]?.stats)
    expect(merged.voiSpheres[0]?.stats).toEqual(incoming.voiSpheres[0]?.stats)
  })

  it('recolors threshold and VOI items without changing metrics or selection', () => {
    const current = normalizeMprSegmentationConfig({
      enabled: true,
      clientRevision: 12,
      selectedRegionId: null,
      selectedVoi: true,
      selectedVoiId: 'v1',
      thresholdRegions: [createRegion(8, 20)],
      voiSpheres: [
        {
          id: 'v1',
          label: 'target',
          enabled: true,
          centerWorld: [1, 2, 3],
          radiusMm: 14,
          color: '#22d3ee',
          stats: {
            huMean: 22,
            huMin: 10,
            huMax: 35,
            huStdDev: 4,
            volumeCm3: 1.8,
            sampleCount: 18
          }
        }
      ],
      voiSphere: {
        id: 'v1',
        label: 'target',
        enabled: true,
        centerWorld: [1, 2, 3],
        radiusMm: 14,
        color: '#22d3ee',
        stats: {
          huMean: 22,
          huMin: 10,
          huMax: 35,
          huStdDev: 4,
          volumeCm3: 1.8,
          sampleCount: 18
        }
      }
    })

    expect(recolorMprSegmentationConfig(current, '#112233', '#445566')).toEqual({
      ...current,
      thresholdRegions: [
        {
          ...current.thresholdRegions[0]!,
          color: '#112233'
        }
      ],
      voiSpheres: [
        {
          ...current.voiSpheres[0]!,
          color: '#445566'
        }
      ],
      voiSphere: {
        ...current.voiSphere!,
        color: '#445566'
      }
    })
  })
})
