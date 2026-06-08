import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PetCtFusionView from './PetCtFusionView.vue'
import type { FusionPaneKey, OrientationInfo, ViewerTabItem } from '../../../types/viewer'
import {
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PANE_KEYS,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY
} from '../../../composables/workspace/views/viewerWorkspaceTabs'

vi.mock('../../../composables/ui/useUiLocale', async () => {
  const { computed, ref } = await import('vue')
  return {
    useUiLocale: () => ({
      locale: ref('en-US'),
      viewerCopy: computed(() => ({
        loadingView: 'Loading view',
        loadingStackView: 'Loading stack'
      }))
    })
  }
})

const emptyOrientation: OrientationInfo = {
  top: null,
  right: null,
  bottom: null,
  left: null,
  volumeQuaternion: null
}

const fusionOrientations: Record<FusionPaneKey, OrientationInfo> = {
  'fusion-ct-ax': { top: 'A', right: 'L', bottom: 'P', left: 'R', volumeQuaternion: null },
  'fusion-pet-ax': { top: 'S', right: 'L', bottom: 'I', left: 'R', volumeQuaternion: null },
  'fusion-overlay-ax': { top: 'A', right: 'R', bottom: 'P', left: 'L', volumeQuaternion: null },
  'fusion-pet-cor-mip': { top: 'S', right: 'R', bottom: 'I', left: 'L', volumeQuaternion: null }
}

function createFusionTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'fusion:ct:pet',
    seriesId: 'ct',
    seriesTitle: 'CT',
    title: 'CT + PET',
    viewType: 'PETCTFusion',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo: {
      topLeft: [],
      topRight: [],
      bottomLeft: [],
      bottomRight: []
    },
    orientation: emptyOrientation,
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false
    },
    pseudocolorPreset: 'bw',
    fusionImages: {
      [FUSION_CT_AXIAL_PANE_KEY]: 'ct-image',
      [FUSION_PET_AXIAL_PANE_KEY]: 'pet-image',
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: 'overlay-image',
      [FUSION_PET_CORONAL_MIP_PANE_KEY]: 'mip-image'
    },
    fusionOrientations,
    fusionCornerInfos: {
      [FUSION_CT_AXIAL_PANE_KEY]: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      [FUSION_PET_AXIAL_PANE_KEY]: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      [FUSION_PET_CORONAL_MIP_PANE_KEY]: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] }
    },
    fusionScaleBars: {
      [FUSION_CT_AXIAL_PANE_KEY]: null,
      [FUSION_PET_AXIAL_PANE_KEY]: null,
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: null,
      [FUSION_PET_CORONAL_MIP_PANE_KEY]: null
    },
    fusionManualRegistration: false,
    ...overrides
  } as ViewerTabItem
}

function mountFusionView(activeTab = createFusionTab()) {
  return mount(PetCtFusionView, {
    props: {
      activeTab,
      activeOperation: 'stack:window',
      activeViewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
      getAnnotations: () => [],
      getCursorClass: () => '',
      getDraftAnnotation: () => null,
      getDraftMeasurementMode: () => null,
      getDraftMeasurement: () => null,
      getMeasurements: () => []
    },
    global: {
      stubs: {
        ViewerCanvasStage: {
          name: 'ViewerCanvasStage',
          props: ['viewportKey', 'orientation'],
          template: '<div class="viewer-stage-stub" :data-viewport-key="viewportKey" :data-orientation-top="orientation.top" />'
        }
      }
    }
  })
}

describe('PetCtFusionView', () => {
  it('passes pane-specific orientation to every fusion viewport', () => {
    const wrapper = mountFusionView()

    FUSION_PANE_KEYS.forEach((paneKey) => {
      const stage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${paneKey}"]`)
      expect(stage.exists()).toBe(true)
      expect(stage.attributes('data-orientation-top')).toBe(fusionOrientations[paneKey].top ?? '')
    })

    wrapper.unmount()
  })

  it('hides pane names once fusion images are loaded', () => {
    const wrapper = mountFusionView()

    expect(wrapper.text()).not.toContain('CT Axial')
    expect(wrapper.text()).not.toContain('PET Axial')
    expect(wrapper.text()).not.toContain('Fusion Axial')
    expect(wrapper.text()).not.toContain('PET Coronal MIP')

    wrapper.unmount()
  })
})
