import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import PetCtFusionView from './PetCtFusionView.vue'
import type { FusionPaneKey, FusionProjectionInfo, OrientationInfo, ViewerTabItem } from '../../../types/viewer'
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

function createProjection(
  paneRole: FusionPaneKey,
  overrides: Partial<FusionProjectionInfo> = {}
): FusionProjectionInfo {
  return {
    paneRole,
    referenceWorld: [0.5, 0.5, 0],
    referenceX: 0.5,
    referenceY: 0.5,
    normalizedToWorldOrigin: [0, 0, 0],
    normalizedToWorldX: [1, 0, 0],
    normalizedToWorldY: [0, 1, 0],
    worldToNormalizedX: [1, 0, 0, 0],
    worldToNormalizedY: [0, 1, 0, 0],
    ...overrides
  }
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
          props: ['viewportKey', 'orientation', 'loadingLabel', 'loadingProgressPercent', 'imageSrc'],
          template:
            '<div class="viewer-stage-stub" :data-viewport-key="viewportKey" :data-orientation-top="orientation.top" :data-loading-label="loadingLabel" :data-loading-progress="loadingProgressPercent"><img v-if="imageSrc" class="viewer-image" :src="imageSrc" /></div>'
        }
      }
    }
  })
}

function dispatchPointerEvent(target: Element, type: string, init: { pointerId: number; clientX: number; clientY: number }): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY }
  })
  target.dispatchEvent(event)
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

  it('passes pane-specific loading progress to every empty fusion viewport', () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionImages: {},
      fusionLoadingProgress: {
        [FUSION_CT_AXIAL_PANE_KEY]: {
          viewId: 'ct-view',
          phase: 'render',
          message: '',
          progressPercent: 82,
          loadedCount: null,
          totalCount: null
        }
      }
    }))

    const stage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_CT_AXIAL_PANE_KEY}"]`)
    expect(stage.attributes('data-loading-progress')).toBe('82')
    expect(stage.attributes('data-loading-label')).toBe('Rendering image')

    wrapper.unmount()
  })

  it('hides calibration markers while fusion panes are loading', () => {
    const wrapper = mountFusionView(createFusionTab({ fusionImages: {} }))

    expect(wrapper.findAll('.pet-ct-fusion-view__marker')).toHaveLength(0)

    wrapper.unmount()
  })

  it('moves the calibration marker across every fusion viewport in sync', async () => {
    const wrapper = mountFusionView()
    const markers = wrapper.findAll<HTMLButtonElement>('.pet-ct-fusion-view__marker')
    expect(markers).toHaveLength(4)

    wrapper.findAll<HTMLElement>('.pet-ct-fusion-view__pane').forEach((pane) => {
      vi.spyOn(pane.element, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        right: 200,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect)
    })

    dispatchPointerEvent(markers[0].element, 'pointerdown', { pointerId: 9, clientX: 100, clientY: 50 })
    dispatchPointerEvent(markers[0].element, 'pointermove', { pointerId: 9, clientX: 40, clientY: 70 })
    await nextTick()

    wrapper.findAll<HTMLButtonElement>('.pet-ct-fusion-view__marker').forEach((marker) => {
      expect(marker.attributes('style')).toContain('left: 40px')
      expect(marker.attributes('style')).toContain('top: 70px')
    })

    wrapper.unmount()
  })

  it('keeps the MIP calibration marker inside the rendered image area when the pane is letterboxed', async () => {
    const wrapper = mountFusionView()
    const panes = wrapper.findAll<HTMLElement>('.pet-ct-fusion-view__pane')
    const mipPane = panes[FUSION_PANE_KEYS.indexOf(FUSION_PET_CORONAL_MIP_PANE_KEY)]!
    const mipMarker = mipPane.find<HTMLButtonElement>('.pet-ct-fusion-view__marker')
    const mipImage = mipPane.find<HTMLImageElement>('.viewer-image')

    vi.spyOn(mipPane.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    } as DOMRect)
    vi.spyOn(mipImage.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    } as DOMRect)
    Object.defineProperty(mipImage.element, 'naturalWidth', { configurable: true, value: 50 })
    Object.defineProperty(mipImage.element, 'naturalHeight', { configurable: true, value: 100 })

    dispatchPointerEvent(mipMarker.element, 'pointerdown', { pointerId: 12, clientX: 20, clientY: 50 })
    await nextTick()

    expect(mipMarker.attributes('style')).toContain('left: 75px')
    expect(mipMarker.attributes('style')).toContain('top: 50px')

    wrapper.unmount()
  })

  it('projects the calibration marker into the MIP pane from the selected physical world point', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionProjections: {
        [FUSION_CT_AXIAL_PANE_KEY]: createProjection(FUSION_CT_AXIAL_PANE_KEY),
        [FUSION_PET_AXIAL_PANE_KEY]: createProjection(FUSION_PET_AXIAL_PANE_KEY),
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: createProjection(FUSION_OVERLAY_AXIAL_PANE_KEY),
        [FUSION_PET_CORONAL_MIP_PANE_KEY]: createProjection(FUSION_PET_CORONAL_MIP_PANE_KEY, {
          worldToNormalizedX: [0, 1, 0, 0],
          worldToNormalizedY: [1, 0, 0, 0]
        })
      }
    }))
    const panes = wrapper.findAll<HTMLElement>('.pet-ct-fusion-view__pane')
    panes.forEach((pane) => {
      vi.spyOn(pane.element, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        right: 200,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect)
    })

    const ctMarker = panes[FUSION_PANE_KEYS.indexOf(FUSION_CT_AXIAL_PANE_KEY)]!.find<HTMLButtonElement>('.pet-ct-fusion-view__marker')
    const mipMarker = panes[FUSION_PANE_KEYS.indexOf(FUSION_PET_CORONAL_MIP_PANE_KEY)]!.find<HTMLButtonElement>('.pet-ct-fusion-view__marker')
    dispatchPointerEvent(ctMarker.element, 'pointerdown', { pointerId: 13, clientX: 50, clientY: 75 })
    await nextTick()

    expect(mipMarker.attributes('style')).toContain('left: 150px')
    expect(mipMarker.attributes('style')).toContain('top: 25px')

    wrapper.unmount()
  })

})
