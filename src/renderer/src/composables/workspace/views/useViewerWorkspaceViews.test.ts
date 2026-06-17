import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnnotationOverlay, CornerInfo, FusionInfo, MeasurementOverlay, MprCrosshairInfo, ViewerTabItem } from '../../../types/viewer'
import { useViewerWorkspaceViews } from './useViewerWorkspaceViews'
import {
  createDefaultTransformInfo,
  createEmptyCornerInfo,
  createEmptyFusionComposites,
  createEmptyFusionCornerInfos,
  createEmptyFusionImages,
  createEmptyFusionLayerImages,
  createEmptyFusionOrientations,
  createEmptyFusionPseudocolorPresets,
  createEmptyFusionScaleBars,
  createEmptyFusionSliceLabels,
  createEmptyFusionTransformStates,
  createEmptyFusionViewIds,
  createEmptyFusionWindowLabels,
  createEmptyMprSegmentationOverlays,
  createEmptyMprTransformStates,
  createEmptyOrientationInfo,
  FUSION_OVERLAY_AXIAL_PANE_KEY
} from './viewerWorkspaceTabs'

function createFusionInfo(revision: number): FusionInfo {
  return {
    paneRole: FUSION_OVERLAY_AXIAL_PANE_KEY,
    ctSeriesId: 'ct-series',
    petSeriesId: 'pet-series',
    petPseudocolorPreset: 'petct-rainbow',
    alpha: 0.52,
    revision,
    registration: {
      translateRowMm: 0,
      translateColMm: 0,
      rotationDegrees: 0,
      saved: false
    }
  }
}

function createMprCrosshair(centerX: number, centerY: number): MprCrosshairInfo {
  return {
    centerX,
    centerY,
    hitRadius: 8,
    horizontalPosition: centerY,
    verticalPosition: centerX,
    horizontalAngleRad: 0,
    verticalAngleRad: Math.PI / 2
  }
}

function createFusionTab(): ViewerTabItem {
  const cornerInfo = createEmptyCornerInfo()
  return {
    key: 'fusion-tab',
    seriesId: 'ct-series',
    seriesTitle: 'CT',
    title: 'PET/CT',
    viewType: 'PETCTFusion',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo,
    orientation: createEmptyOrientationInfo(),
    fusionSeriesIds: { ctSeriesId: 'ct-series', petSeriesId: 'pet-series' },
    fusionViewIds: {
      ...createEmptyFusionViewIds(),
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: 'overlay-view'
    },
    fusionImages: {
      ...createEmptyFusionImages(),
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: 'blob:ct-base'
    },
    fusionLayerImages: {
      ...createEmptyFusionLayerImages(),
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
        ct: 'blob:ct-base',
        pet: 'blob:pet-old',
        revision: 1,
        width: 200,
        height: 200
      }
    },
    fusionComposites: createEmptyFusionComposites(),
    fusionCornerInfos: {
      ...createEmptyFusionCornerInfos(),
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: cornerInfo
    },
    fusionOrientations: createEmptyFusionOrientations(),
    fusionTransformStates: {
      ...createEmptyFusionTransformStates(),
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: createDefaultTransformInfo()
    },
    fusionPseudocolorPresets: createEmptyFusionPseudocolorPresets(),
    fusionScaleBars: createEmptyFusionScaleBars(),
    fusionSliceLabels: createEmptyFusionSliceLabels(),
    fusionWindowLabels: createEmptyFusionWindowLabels(),
    fusionInfo: createFusionInfo(1),
    fusionRegistrationDragActive: false
  } as ViewerTabItem
}

function createMprTab(): ViewerTabItem {
  const cornerInfo = createEmptyCornerInfo()
  return {
    key: 'mpr-tab',
    seriesId: 'ct-series',
    seriesTitle: 'CT',
    title: 'MPR',
    viewType: 'MPR',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo,
    orientation: createEmptyOrientationInfo(),
    transformState: createDefaultTransformInfo(),
    pseudocolorPreset: 'gray',
    viewportViewIds: {
      'mpr-ax': 'mpr-ax-view',
      'mpr-cor': '',
      'mpr-sag': ''
    },
    viewportImages: {
      'mpr-ax': 'blob:mpr-ax',
      'mpr-cor': '',
      'mpr-sag': ''
    },
    viewportMeasurements: {
      'mpr-ax': [
        {
          measurementId: 'm1',
          toolType: 'line',
          points: [{ x: 0.2, y: 0.3 }, { x: 0.7, y: 0.8 }],
          labelLines: ['12 mm']
        }
      ]
    },
    viewportTransformStates: {
      ...createEmptyMprTransformStates(),
      'mpr-ax': {
        ...createDefaultTransformInfo(),
        zoom: 1.7,
        offsetX: 12,
        offsetY: -8
      }
    },
    viewportSegmentationOverlays: createEmptyMprSegmentationOverlays(),
    mprSegmentationConfig: {
      enabled: true,
      clientRevision: 4,
      selectedRegionId: 'r1',
      selectedVoi: false,
      selectedVoiId: null,
      thresholdRegions: [
        {
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
            widthMm: 10,
            heightMm: 10,
            depthMm: 2,
            sourceViewport: 'mpr-ax'
          },
          stats: null
        }
      ],
      voiSpheres: [],
      voiSphere: null,
      voiBox: null,
      lowerHu: 300,
      upperHu: 700,
      opacity: 0.35,
      color: '#ff4df8'
    }
  } as ViewerTabItem
}

function createStackTab(): ViewerTabItem {
  const cornerInfo = createEmptyCornerInfo()
  return {
    key: 'stack-tab',
    seriesId: 'ct-series',
    seriesTitle: 'CT',
    title: 'Stack',
    viewType: 'Stack',
    viewId: 'stack-view',
    imageSrc: 'blob:stack',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo,
    orientation: createEmptyOrientationInfo(),
    transformState: {
      ...createDefaultTransformInfo(),
      zoom: 1.6,
      offsetX: 9,
      offsetY: -5
    },
    pseudocolorPreset: 'gray',
    measurements: [
      {
        measurementId: 'm1',
        toolType: 'line',
        points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.9 }],
        labelLines: ['20 mm']
      }
    ],
    annotations: [
      {
        annotationId: 'a1',
        toolType: 'arrow',
        points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.4 }],
        text: 'A',
        color: '#ffd166',
        size: 'md'
      }
    ]
  } as ViewerTabItem
}

function createHarness() {
  const viewerTabs = ref<ViewerTabItem[]>([createFusionTab()])
  const emptyCornerInfo: CornerInfo = createEmptyCornerInfo()
  const views = useViewerWorkspaceViews({
    activeMprCrosshairDragLock: ref(null),
    activeTabKey: ref('fusion-tab'),
    activeViewportKey: ref(FUSION_OVERLAY_AXIAL_PANE_KEY),
    clearPendingVolumeConfig: vi.fn(),
    completeActiveMprCrosshairDragLock: vi.fn(),
    ensureSeriesCornerInfo: vi.fn(async () => emptyCornerInfo),
    isViewLoading: ref(false),
    message: ref(''),
    selectedSeries: computed(() => null),
    selectedSeriesId: ref('ct-series'),
    seriesCornerInfoMap: ref({
      'ct-series': emptyCornerInfo,
      'pet-series': emptyCornerInfo
    }),
    seriesList: ref([]),
    stripHoverCornerInfo: (cornerInfo) => cornerInfo,
    viewportElements: ref({}),
    viewerStage: ref(null),
    viewerTabs,
    withHoverCornerInfo: (cornerInfo) => cornerInfo
  })
  return { viewerTabs, views }
}

function createMprHarness() {
  const viewerTabs = ref<ViewerTabItem[]>([createMprTab()])
  const emptyCornerInfo: CornerInfo = createEmptyCornerInfo()
  const views = useViewerWorkspaceViews({
    activeMprCrosshairDragLock: ref(null),
    activeTabKey: ref('mpr-tab'),
    activeViewportKey: ref('mpr-ax'),
    clearPendingVolumeConfig: vi.fn(),
    completeActiveMprCrosshairDragLock: vi.fn(),
    ensureSeriesCornerInfo: vi.fn(async () => emptyCornerInfo),
    isViewLoading: ref(false),
    message: ref(''),
    selectedSeries: computed(() => null),
    selectedSeriesId: ref('ct-series'),
    seriesCornerInfoMap: ref({
      'ct-series': emptyCornerInfo
    }),
    seriesList: ref([]),
    stripHoverCornerInfo: (cornerInfo) => cornerInfo,
    viewportElements: ref({}),
    viewerStage: ref(null),
    viewerTabs,
    withHoverCornerInfo: (cornerInfo) => cornerInfo
  })
  return { viewerTabs, views }
}

function createStackHarness() {
  const viewerTabs = ref<ViewerTabItem[]>([createStackTab()])
  const emptyCornerInfo: CornerInfo = createEmptyCornerInfo()
  const views = useViewerWorkspaceViews({
    activeMprCrosshairDragLock: ref(null),
    activeTabKey: ref('stack-tab'),
    activeViewportKey: ref('single'),
    clearPendingVolumeConfig: vi.fn(),
    completeActiveMprCrosshairDragLock: vi.fn(),
    ensureSeriesCornerInfo: vi.fn(async () => emptyCornerInfo),
    isViewLoading: ref(false),
    message: ref(''),
    selectedSeries: computed(() => null),
    selectedSeriesId: ref('ct-series'),
    seriesCornerInfoMap: ref({
      'ct-series': emptyCornerInfo
    }),
    seriesList: ref([]),
    stripHoverCornerInfo: (cornerInfo) => cornerInfo,
    viewportElements: ref({}),
    viewerStage: ref(null),
    viewerTabs,
    withHoverCornerInfo: (cornerInfo) => cornerInfo
  })
  return { viewerTabs, views }
}

describe('useViewerWorkspaceViews fusion layer updates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts final unchanged-primary PET layer updates after registration drag ends', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:generated-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createHarness()

    views.updateTabImage(
      'fusion-tab',
      {
        viewId: 'overlay-view',
        imageFormat: 'png',
        fusionInfo: createFusionInfo(2),
        fusionComposite: {
          mode: 'ctPetLayers',
          revision: 2,
          alpha: 0.52,
          registration: {
            translateRowMm: 4,
            translateColMm: 8,
            rotationDegrees: 12,
            saved: false
          },
          width: 200,
          height: 200,
          layers: [{ key: 'pet', role: 'pet', imageFormat: 'png' }],
          primaryImageUnchanged: true
        }
      },
      new Uint8Array([1, 2, 3]),
      { pet: new Uint8Array([4, 5, 6]) }
    )

    const tab = viewerTabs.value[0]
    expect(tab.fusionImages?.[FUSION_OVERLAY_AXIAL_PANE_KEY]).toBe('blob:ct-base')
    expect(tab.fusionLayerImages?.[FUSION_OVERLAY_AXIAL_PANE_KEY]).toMatchObject({
      ct: 'blob:ct-base',
      pet: 'blob:generated-1',
      revision: 2,
      width: 200,
      height: 200
    })
  })
})

describe('useViewerWorkspaceViews overlay payload preservation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves stack measurements and annotations when a preview image update omits overlay fields', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:stack-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createStackHarness()
    const previousMeasurements = viewerTabs.value[0].measurements
    const previousAnnotations = viewerTabs.value[0].annotations
    const previousTransform = viewerTabs.value[0].transformState

    views.updateTabImage(
      'stack-tab',
      {
        viewId: 'stack-view',
        imageFormat: 'png',
        window_info: { ww: 900, wl: 120 }
      },
      new Uint8Array([1, 2, 3])
    )

    const tab = viewerTabs.value[0]
    expect(tab.windowLabel).toBe('WW 900  WL 120')
    expect(tab.measurements).toBe(previousMeasurements)
    expect(tab.annotations).toBe(previousAnnotations)
    expect(tab.transformState).toBe(previousTransform)
  })

  it('rounds window labels and corner tags from decimal image updates', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:stack-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createStackHarness()

    views.updateTabImage(
      'stack-tab',
      {
        viewId: 'stack-view',
        imageFormat: 'png',
        renderIntent: 'pixel-only',
        window_info: { ww: 888.6, wl: 43.4 }
      },
      new Uint8Array([1, 2, 3])
    )

    const tab = viewerTabs.value[0]
    expect(tab.windowLabel).toBe('WW 889  WL 43')
    expect(tab.cornerInfo.tags?.windowLevel).toEqual(['WW 889  WL 43'])
  })

  it('treats stack pixel-only updates as image/window changes without overlay or transform changes', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:stack-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createStackHarness()
    const previousMeasurements = viewerTabs.value[0].measurements
    const previousAnnotations = viewerTabs.value[0].annotations
    const previousTransform = viewerTabs.value[0].transformState

    views.updateTabImage(
      'stack-tab',
      {
        viewId: 'stack-view',
        imageFormat: 'png',
        renderIntent: 'pixel-only',
        window_info: { ww: 888, wl: 44 },
        measurements: [],
        annotations: [],
        transform: {
          ...createDefaultTransformInfo(),
          zoom: 4,
          offsetX: 100,
          offsetY: 100
        }
      },
      new Uint8Array([1, 1, 1])
    )

    const tab = viewerTabs.value[0]
    expect(tab.windowLabel).toBe('WW 888  WL 44')
    expect(tab.measurements).toBe(previousMeasurements)
    expect(tab.annotations).toBe(previousAnnotations)
    expect(tab.transformState).toBe(previousTransform)
    expect(tab.cornerInfo.tags?.windowLevel).toEqual(['WW 888  WL 44'])
  })

  it('lets geometry-preview update stack transform and projected overlay positions', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:stack-geometry'),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createStackHarness()
    const nextTransform = {
      ...createDefaultTransformInfo(),
      zoom: 2.4,
      offsetX: 42,
      offsetY: -18
    }
    const nextMeasurements: MeasurementOverlay[] = [
      {
        measurementId: 'm1',
        toolType: 'line',
        points: [{ x: 0.22, y: 0.33 }, { x: 0.66, y: 0.77 }],
        labelLines: ['20 mm']
      }
    ]
    const nextAnnotations: AnnotationOverlay[] = [
      {
        annotationId: 'a1',
        toolType: 'arrow',
        points: [{ x: 0.25, y: 0.25 }, { x: 0.45, y: 0.45 }],
        text: 'A',
        color: '#ffd166',
        size: 'md'
      }
    ]

    views.updateTabImage(
      'stack-tab',
      {
        viewId: 'stack-view',
        imageFormat: 'png',
        renderIntent: 'geometry-preview',
        measurements: nextMeasurements,
        annotations: nextAnnotations,
        transform: nextTransform
      },
      new Uint8Array([2, 2, 2])
    )

    const tab = viewerTabs.value[0]
    expect(tab.measurements).toEqual(nextMeasurements)
    expect(tab.annotations).toEqual(nextAnnotations)
    expect(tab.transformState).toEqual(nextTransform)
  })

  it('drops stale stack image updates by render revision', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:stack-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createStackHarness()

    views.updateTabImage(
      'stack-tab',
      {
        viewId: 'stack-view',
        imageFormat: 'png',
        renderIntent: 'pixel-only',
        renderRevision: 5,
        window_info: { ww: 900, wl: 90 }
      },
      new Uint8Array([3, 3, 3])
    )
    views.updateTabImage(
      'stack-tab',
      {
        viewId: 'stack-view',
        imageFormat: 'png',
        renderIntent: 'pixel-only',
        renderRevision: 4,
        window_info: { ww: 100, wl: 10 }
      },
      new Uint8Array([4, 4, 4])
    )

    const tab = viewerTabs.value[0]
    expect(tab.windowLabel).toBe('WW 900  WL 90')
    expect(tab.imageUpdateRevisions?.['stack-view']).toBe(5)
  })
})

describe('useViewerWorkspaceViews MPR segmentation preview updates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts stale segmentation preview samples without rolling back the local config', () => {
    const { viewerTabs, views } = createMprHarness()

    views.updateTabImage(
      'mpr-tab',
      {
        viewId: 'mpr-ax-view',
        imageFormat: 'png',
        mprSegmentationConfig: {
          enabled: true,
          clientRevision: 3,
          selectedRegionId: 'r1',
          selectedVoi: false,
          selectedVoiId: null,
          thresholdRegions: [],
          voiSpheres: [],
          voiSphere: null
        },
        mprSegmentationOverlay: {
          regions: [
            {
              regionId: 'r1',
              visible: true,
              rect: null,
              sampleRevision: 9,
              samples: {
                points: [1.5, 2.5, 512],
                totalCount: 1,
                sampledCount: 1
              }
            }
          ]
        }
      },
      new Uint8Array([1, 2, 3])
    )

    const tab = viewerTabs.value[0]
    expect(tab.mprSegmentationConfig?.clientRevision).toBe(4)
    expect(tab.mprSegmentationConfig?.thresholdRegions).toHaveLength(1)
    expect(tab.viewportSegmentationOverlays?.['mpr-ax']?.regions[0]?.samples?.points).toEqual([1.5, 2.5, 512])
  })

  it('preserves segmentation overlay samples when an image update has no segmentation payload', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:mpr-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createMprHarness()
    const existingOverlay = {
      regions: [
        {
          regionId: 'r1',
          visible: true,
          rect: null,
          sampleRevision: 7,
          samples: {
            points: [8, 12, 512],
            totalCount: 1,
            sampledCount: 1
          }
        }
      ]
    }
    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === 'mpr-tab'
        ? {
            ...item,
            viewportSegmentationOverlays: {
              ...(item.viewportSegmentationOverlays ?? createEmptyMprSegmentationOverlays()),
              'mpr-ax': existingOverlay
            }
          }
        : item
    )

    views.updateTabImage(
      'mpr-tab',
      {
        viewId: 'mpr-ax-view',
        imageFormat: 'png',
        window_info: { ww: 1200, wl: 400 }
      },
      new Uint8Array([9, 9, 9])
    )

    const tab = viewerTabs.value[0]
    expect(tab.windowLabel).toBe('WW 1200  WL 400')
    expect(tab.viewportSegmentationOverlays?.['mpr-ax']).toEqual(existingOverlay)
    expect(tab.mprSegmentationConfig?.clientRevision).toBe(4)
  })

  it('treats MPR pixel-only updates as image/window changes without overlay or geometry changes', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:mpr-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createMprHarness()
    const previousMeasurements = viewerTabs.value[0].viewportMeasurements?.['mpr-ax']
    const previousTransform = viewerTabs.value[0].viewportTransformStates?.['mpr-ax']
    const previousCrosshair = createMprCrosshair(0.52, 0.48)
    const existingOverlay = {
      regions: [
        {
          regionId: 'r1',
          visible: true,
          rect: null,
          sampleRevision: 7,
          samples: {
            points: [8, 12, 512],
            totalCount: 1,
            sampledCount: 1
          }
        }
      ]
    }
    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === 'mpr-tab'
        ? {
            ...item,
            viewportSegmentationOverlays: {
              ...(item.viewportSegmentationOverlays ?? createEmptyMprSegmentationOverlays()),
              'mpr-ax': existingOverlay
            },
            viewportCrosshairs: {
              ...(item.viewportCrosshairs ?? {}),
              'mpr-ax': previousCrosshair
            }
          }
        : item
    )

    views.updateTabImage(
      'mpr-tab',
      {
        viewId: 'mpr-ax-view',
        imageFormat: 'png',
        renderIntent: 'pixel-only',
        window_info: { ww: 1500, wl: 300 },
        measurements: [],
        mprSegmentationOverlay: { regions: [] },
        transform: {
          ...createDefaultTransformInfo(),
          zoom: 8,
          offsetX: 99,
          offsetY: 99
        }
      },
      new Uint8Array([1, 2, 3])
    )

    const tab = viewerTabs.value[0]
    expect(tab.windowLabel).toBe('WW 1500  WL 300')
    expect(tab.viewportMeasurements?.['mpr-ax']).toBe(previousMeasurements)
    expect(tab.viewportTransformStates?.['mpr-ax']).toBe(previousTransform)
    expect(tab.viewportCrosshairs?.['mpr-ax']).toEqual(previousCrosshair)
    expect(tab.viewportCornerInfos?.['mpr-ax']?.tags?.windowLevel).toEqual(['WW 1500  WL 300'])
    expect(tab.viewportSegmentationOverlays?.['mpr-ax']).toEqual(existingOverlay)
  })

  it('lets MPR geometry-preview update transform and measurements while preserving segmentation samples', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:mpr-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createMprHarness()
    const existingOverlay = {
      regions: [
        {
          regionId: 'r1',
          visible: true,
          rect: null,
          sampleRevision: 9,
          samples: {
            points: [1, 2, 512],
            totalCount: 1,
            sampledCount: 1
          }
        }
      ]
    }
    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === 'mpr-tab'
        ? {
            ...item,
            viewportSegmentationOverlays: {
              ...(item.viewportSegmentationOverlays ?? createEmptyMprSegmentationOverlays()),
              'mpr-ax': existingOverlay
            }
          }
        : item
    )
    const nextTransform = {
      ...createDefaultTransformInfo(),
      zoom: 2.25,
      offsetX: 30,
      offsetY: -12
    }
    const nextCrosshair = createMprCrosshair(0.61, 0.42)
    const nextMeasurements: MeasurementOverlay[] = [
      {
        measurementId: 'm1',
        toolType: 'line',
        points: [{ x: 0.25, y: 0.35 }, { x: 0.75, y: 0.85 }],
        labelLines: ['12 mm']
      }
    ]

    views.updateTabImage(
      'mpr-tab',
      {
        viewId: 'mpr-ax-view',
        imageFormat: 'png',
        renderIntent: 'geometry-preview',
        measurements: nextMeasurements,
        mpr_crosshair: nextCrosshair,
        mprSegmentationOverlay: { regions: [] },
        transform: nextTransform
      },
      new Uint8Array([4, 5, 6])
    )

    const tab = viewerTabs.value[0]
    expect(tab.viewportMeasurements?.['mpr-ax']).toEqual(nextMeasurements)
    expect(tab.viewportTransformStates?.['mpr-ax']).toEqual(nextTransform)
    expect(tab.viewportCrosshairs?.['mpr-ax']).toEqual(nextCrosshair)
    expect(tab.viewportSegmentationOverlays?.['mpr-ax']).toEqual(existingOverlay)
  })

  it.each(['png', 'jpeg'] as const)('preserves MPR measurements when a %s image update omits overlay fields', (imageFormat) => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:mpr-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createMprHarness()
    const previousMeasurements = viewerTabs.value[0].viewportMeasurements?.['mpr-ax']
    const previousTransform = viewerTabs.value[0].viewportTransformStates?.['mpr-ax']

    views.updateTabImage(
      'mpr-tab',
      {
        viewId: 'mpr-ax-view',
        imageFormat,
        window_info: { ww: 1100, wl: 350 }
      },
      new Uint8Array([4, 5, 6])
    )

    const tab = viewerTabs.value[0]
    expect(tab.windowLabel).toBe('WW 1100  WL 350')
    expect(tab.viewportMeasurements?.['mpr-ax']).toBe(previousMeasurements)
    expect(tab.viewportTransformStates?.['mpr-ax']).toBe(previousTransform)
  })

  it('clears MPR measurements only when the payload explicitly contains an empty measurements array', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:mpr-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createMprHarness()

    views.updateTabImage(
      'mpr-tab',
      {
        viewId: 'mpr-ax-view',
        imageFormat: 'png',
        measurements: []
      },
      new Uint8Array([7, 8, 9])
    )

    expect(viewerTabs.value[0].viewportMeasurements?.['mpr-ax']).toEqual([])
  })

  it('preserves MPR viewport transform when a preview update sends transform as null', () => {
    let urlIndex = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:mpr-${++urlIndex}`),
      revokeObjectURL: vi.fn()
    })
    const { viewerTabs, views } = createMprHarness()
    const previousTransform = viewerTabs.value[0].viewportTransformStates?.['mpr-ax']

    views.updateTabImage(
      'mpr-tab',
      {
        viewId: 'mpr-ax-view',
        imageFormat: 'png',
        transform: null
      },
      new Uint8Array([10, 11, 12])
    )

    expect(viewerTabs.value[0].viewportTransformStates?.['mpr-ax']).toBe(previousTransform)
  })
})
