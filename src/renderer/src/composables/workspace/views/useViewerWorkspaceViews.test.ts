import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CornerInfo, FusionInfo, ViewerTabItem } from '../../../types/viewer'
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
