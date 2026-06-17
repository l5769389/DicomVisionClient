import { describe, expect, it } from 'vitest'
import type { MprSegmentationConfig, MprThresholdRegion, MprVoiSphere } from '../../../types/viewer'
import {
  MPR_SEGMENTATION_SIDECAR_KIND,
  buildMprSegmentationSidecar,
  buildMprSegmentationSidecarFileName,
  mergeMprSegmentationSidecarItems,
  parseMprSegmentationSidecarPayload,
  parseMprSegmentationSidecarText
} from './mprSegmentationSidecar'

function createRegion(patch: Partial<MprThresholdRegion> = {}): MprThresholdRegion {
  return {
    id: 'r1',
    enabled: true,
    label: 'Threshold 1',
    thresholdHu: 320,
    thresholdMode: 'hu',
    thresholdPercentile: 80,
    color: '#ff4df8',
    box: {
      centerWorld: [1, 2, 3],
      rowWorld: [0, 1, 0],
      colWorld: [0, 0, 1],
      normalWorld: [1, 0, 0],
      widthMm: 20,
      heightMm: 30,
      depthMm: 8,
      sourceViewport: 'mpr-ax'
    },
    stats: {
      huMean: 100,
      huMin: 10,
      huMax: 500,
      huStdDev: 4,
      volumeCm3: 2.5,
      sampleCount: 25,
      effectiveThresholdHu: 320
    },
    ...patch
  }
}

function createVoi(patch: Partial<MprVoiSphere> = {}): MprVoiSphere {
  return {
    id: 'v1',
    enabled: true,
    label: 'VOI 1',
    centerWorld: [4, 5, 6],
    radiusMm: 12,
    color: '#22d3ee',
    stats: {
      huMean: 50,
      huMin: 20,
      huMax: 80,
      huStdDev: 2,
      volumeCm3: 7,
      sampleCount: 42
    },
    ...patch
  }
}

function createConfig(): MprSegmentationConfig {
  const region = createRegion()
  const voi = createVoi()
  return {
    enabled: true,
    clientRevision: 4,
    selectedRegionId: region.id,
    selectedVoi: false,
    selectedVoiId: null,
    thresholdRegions: [region],
    voiSpheres: [voi],
    voiSphere: voi
  }
}

describe('mprSegmentationSidecar', () => {
  it('builds a selected-items sidecar without stats', () => {
    const sidecar = buildMprSegmentationSidecar({
      appVersion: '1.2.3',
      config: {
        ...createConfig(),
        thresholdRegions: [createRegion(), createRegion({ id: 'r2' })],
        voiSpheres: [createVoi(), createVoi({ id: 'v2' })]
      },
      createdAt: new Date('2026-06-16T10:20:30.000Z'),
      selectedThresholdRegionIds: ['r2'],
      selectedVoiSphereIds: ['v1'],
      source: {
        seriesId: 'series-a',
        seriesLabel: 'Chest CT',
        viewType: 'MPR'
      }
    })

    expect(sidecar.kind).toBe(MPR_SEGMENTATION_SIDECAR_KIND)
    expect(sidecar.version).toBe(1)
    expect(sidecar.createdAt).toBe('2026-06-16T10:20:30.000Z')
    expect(sidecar.appVersion).toBe('1.2.3')
    expect(sidecar.source).toEqual({
      seriesId: 'series-a',
      seriesLabel: 'Chest CT',
      viewType: 'MPR'
    })
    expect(sidecar.items.thresholdRegions.map((region) => region.id)).toEqual(['r2'])
    expect(sidecar.items.voiSpheres.map((sphere) => sphere.id)).toEqual(['v1'])
    expect(sidecar.items.thresholdRegions[0]).not.toHaveProperty('stats')
    expect(sidecar.items.voiSpheres[0]).not.toHaveProperty('stats')
  })

  it('validates sidecar kind and version', () => {
    expect(() => parseMprSegmentationSidecarPayload({ kind: 'other', version: 1, items: {} })).toThrow(
      'Unsupported segmentation file type.'
    )
    expect(() => parseMprSegmentationSidecarPayload({ kind: MPR_SEGMENTATION_SIDECAR_KIND, version: 99, items: {} })).toThrow(
      'Unsupported segmentation file version.'
    )
    expect(() => parseMprSegmentationSidecarText('{')).toThrow('Segmentation file is not valid JSON.')
  })

  it('parses rect-only, VOI-only, and mixed sidecars', () => {
    const rectOnly = parseMprSegmentationSidecarPayload({
      kind: MPR_SEGMENTATION_SIDECAR_KIND,
      version: 1,
      items: {
        thresholdRegions: [createRegion()],
        voiSpheres: []
      }
    })
    expect(rectOnly.thresholdRegions).toHaveLength(1)
    expect(rectOnly.voiSpheres).toHaveLength(0)

    const voiOnly = parseMprSegmentationSidecarPayload({
      kind: MPR_SEGMENTATION_SIDECAR_KIND,
      version: 1,
      items: {
        thresholdRegions: [],
        voiSpheres: [createVoi()]
      }
    })
    expect(voiOnly.thresholdRegions).toHaveLength(0)
    expect(voiOnly.voiSpheres).toHaveLength(1)

    const mixed = parseMprSegmentationSidecarPayload({
      kind: MPR_SEGMENTATION_SIDECAR_KIND,
      version: 1,
      items: {
        thresholdRegions: [createRegion()],
        voiSpheres: [createVoi()]
      }
    })
    expect(mixed.thresholdRegions).toHaveLength(1)
    expect(mixed.voiSpheres).toHaveLength(1)
  })

  it('rejects empty sidecars', () => {
    expect(() => parseMprSegmentationSidecarPayload({
      kind: MPR_SEGMENTATION_SIDECAR_KIND,
      version: 1,
      items: {
        thresholdRegions: [],
        voiSpheres: []
      }
    })).toThrow('Segmentation file has no valid items.')
  })

  it('merges imported items with deterministic ID conflict suffixes', () => {
    const current = createConfig()
    const imported = {
      thresholdRegions: [createRegion(), createRegion({ id: 'r1' })],
      voiSpheres: [createVoi(), createVoi({ id: 'v1' })]
    }

    const result = mergeMprSegmentationSidecarItems(current, imported)

    expect(result.importedThresholdRegionIds).toEqual(['r1-2', 'r1-3'])
    expect(result.importedVoiSphereIds).toEqual(['v1-2', 'v1-3'])
    expect(result.skippedThresholdRegionCount).toBe(0)
    expect(result.skippedVoiSphereCount).toBe(0)
    expect(result.config.enabled).toBe(true)
    expect(result.config.clientRevision).toBe(5)
    expect(result.config.selectedRegionId).toBe('r1-2')
    expect(result.config.selectedVoi).toBe(false)
    expect(result.config.thresholdRegions.map((region) => region.id)).toEqual(['r1', 'r1-2', 'r1-3'])
    expect(result.config.voiSpheres.map((sphere) => sphere.id)).toEqual(['v1', 'v1-2', 'v1-3'])
    expect(result.config.thresholdRegions[1]?.stats).toBeNull()
    expect(result.config.voiSpheres[1]?.stats).toBeNull()
  })

  it('respects merge capacity limits and reports skipped items', () => {
    const current = {
      ...createConfig(),
      thresholdRegions: [createRegion({ id: 'r1' }), createRegion({ id: 'r2' })],
      voiSpheres: [createVoi({ id: 'v1' })]
    }
    const result = mergeMprSegmentationSidecarItems(
      current,
      {
        thresholdRegions: [createRegion({ id: 'r3' }), createRegion({ id: 'r4' })],
        voiSpheres: [createVoi({ id: 'v2' }), createVoi({ id: 'v3' })]
      },
      {
        maxThresholdRegions: 3,
        maxVoiSpheres: 1
      }
    )

    expect(result.importedThresholdRegionIds).toEqual(['r3'])
    expect(result.importedVoiSphereIds).toEqual([])
    expect(result.skippedThresholdRegionCount).toBe(1)
    expect(result.skippedVoiSphereCount).toBe(2)
    expect(result.config.thresholdRegions.map((region) => region.id)).toEqual(['r1', 'r2', 'r3'])
    expect(result.config.voiSpheres.map((sphere) => sphere.id)).toEqual(['v1'])
  })

  it('uses a stable default file name', () => {
    expect(buildMprSegmentationSidecarFileName(new Date(2026, 5, 16, 9, 8, 7))).toBe(
      'dicomvision-mpr-segmentation-20260616-090807.dvsseg.json'
    )
  })
})
