import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PetCtFusionView from './PetCtFusionView.vue'
import type { FusionInfo, FusionPaneKey, FusionProjectionInfo, OrientationInfo, ViewerTabItem } from '../../../types/viewer'
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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

function createFusionInfo(revision: number): FusionInfo {
  return {
    paneRole: FUSION_OVERLAY_AXIAL_PANE_KEY,
    ctSeriesId: 'ct',
    petSeriesId: 'pet',
    petPseudocolorPreset: 'hot',
    petUnit: 'SUVbw',
    alpha: 0.65,
    revision,
    registration: {
      translateRowMm: 0,
      translateColMm: 0,
      rotationDegrees: 0
    }
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
          props: ['viewportKey', 'orientation', 'loadingLabel', 'loadingProgressPercent', 'imageSrc', 'imageStyle', 'imageLayers', 'isLoading', 'lightSurface', 'showCornerInfo', 'showScaleBar', 'stageSurfaceClass'],
          template:
            '<div class="viewer-stage-stub viewer-viewport" :class="{ \'viewer-viewport--light-surface\': lightSurface }" :data-viewport-key="viewportKey" :data-orientation-top="orientation.top" :data-loading-label="loadingLabel" :data-loading-progress="loadingProgressPercent" :data-image-src="imageSrc" :data-image-transform="imageStyle?.transform ?? \'\'" :data-image-transform-origin="imageStyle?.transformOrigin ?? \'\'" :data-is-loading="isLoading ? \'true\' : \'false\'" :data-layer-count="imageLayers?.length ?? 0" :data-layer-key="imageLayers?.[0]?.key ?? \'\'" :data-layer-src="imageLayers?.[0]?.src ?? \'\'" :data-layer-transform="imageLayers?.[0]?.style?.transform ?? \'\'" :data-layer-transform-origin="imageLayers?.[0]?.style?.transformOrigin ?? \'\'" :data-light-surface="lightSurface ? \'true\' : \'false\'" :data-show-corner-info="showCornerInfo ? \'true\' : \'false\'" :data-show-scale-bar="showScaleBar ? \'true\' : \'false\'" :data-stage-surface-class="stageSurfaceClass"><img v-if="imageSrc" class="viewer-image" :src="imageSrc" :style="imageStyle" /></div>'
        }
      }
    }
  })
}

function mockPaneGeometry(wrapper: ReturnType<typeof mountFusionView>, paneKey: FusionPaneKey, width = 200, height = 200): void {
  const pane = wrapper.find(`[data-fusion-pane-key="${paneKey}"]`)
  const stage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${paneKey}"]`)
  const image = stage.find('.viewer-image')
  const rect = {
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({})
  } as DOMRect
  vi.spyOn(pane.element, 'getBoundingClientRect').mockReturnValue(rect)
  vi.spyOn(stage.element, 'getBoundingClientRect').mockReturnValue(rect)
  if (image.exists()) {
    vi.spyOn(image.element, 'getBoundingClientRect').mockReturnValue(rect)
    Object.defineProperty(image.element, 'naturalWidth', { configurable: true, value: width })
    Object.defineProperty(image.element, 'naturalHeight', { configurable: true, value: height })
  }
}

function mockOverlayGeometry(wrapper: ReturnType<typeof mountFusionView>, width = 200, height = 200): void {
  mockPaneGeometry(wrapper, FUSION_OVERLAY_AXIAL_PANE_KEY, width, height)
}

function createPointerEvent(type: string, init: { pointerId: number; clientX: number; clientY: number; button?: number }): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    button: { value: init.button ?? 0 }
  })
  return event
}

function dispatchPointerEvent(target: Element, type: string, init: { pointerId: number; clientX: number; clientY: number; button?: number }): void {
  const event = createPointerEvent(type, init)
  target.dispatchEvent(event)
}

async function flushManualRegistrationMoveFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    const schedule = window.requestAnimationFrame ?? ((callback: FrameRequestCallback): number => window.setTimeout(() => callback(performance.now()), 0))
    schedule(() => resolve())
  })
  await nextTick()
}

function parseCssMatrix(transform: string): [number, number, number, number, number, number] {
  const match = transform.match(/^matrix\(([-.\d]+), ([-.\d]+), ([-.\d]+), ([-.\d]+), ([-.\d]+), ([-.\d]+)\)$/)
  expect(match).not.toBeNull()
  return match!.slice(1).map(Number) as [number, number, number, number, number, number]
}

function applyCssMatrix(
  matrix: [number, number, number, number, number, number],
  point: { x: number; y: number }
): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrix
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f
  }
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

  it('uses a white viewport surface for standalone PET fusion panes', () => {
    const wrapper = mountFusionView()

    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_AXIAL_PANE_KEY}"]`).attributes('data-stage-surface-class')).toBe('viewer-stage-surface--white')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_CORONAL_MIP_PANE_KEY}"]`).attributes('data-stage-surface-class')).toBe('viewer-stage-surface--white')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_AXIAL_PANE_KEY}"]`).attributes('data-light-surface')).toBe('true')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_CORONAL_MIP_PANE_KEY}"]`).attributes('data-light-surface')).toBe('true')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_AXIAL_PANE_KEY}"]`).classes()).toContain('viewer-viewport--light-surface')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_CORONAL_MIP_PANE_KEY}"]`).classes()).toContain('viewer-viewport--light-surface')
    expect(wrapper.find(`[data-fusion-pane-key="${FUSION_PET_AXIAL_PANE_KEY}"]`).classes()).toContain('pet-ct-fusion-view__pane--pet-standalone')
    expect(wrapper.find(`[data-fusion-pane-key="${FUSION_PET_CORONAL_MIP_PANE_KEY}"]`).classes()).toContain('pet-ct-fusion-view__pane--pet-standalone')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`).attributes('data-stage-surface-class')).toBe('')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_CT_AXIAL_PANE_KEY}"]`).attributes('data-stage-surface-class')).toBe('')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`).attributes('data-light-surface')).toBe('false')
    expect(wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_CT_AXIAL_PANE_KEY}"]`).attributes('data-light-surface')).toBe('false')
    expect(wrapper.find(`[data-fusion-pane-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`).classes()).not.toContain('pet-ct-fusion-view__pane--pet-standalone')
    expect(wrapper.find(`[data-fusion-pane-key="${FUSION_CT_AXIAL_PANE_KEY}"]`).classes()).not.toContain('pet-ct-fusion-view__pane--pet-standalone')

    wrapper.unmount()
  })

  it('hides image overlays for fusion panes before image content is available', () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionImages: {
        [FUSION_CT_AXIAL_PANE_KEY]: '',
        [FUSION_PET_AXIAL_PANE_KEY]: '',
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: '',
        [FUSION_PET_CORONAL_MIP_PANE_KEY]: ''
      },
      fusionScaleBars: {
        [FUSION_CT_AXIAL_PANE_KEY]: { label: '10 cm', widthPx: 120, pixelsPerMm: 1.2 },
        [FUSION_PET_AXIAL_PANE_KEY]: { label: '10 cm', widthPx: 120, pixelsPerMm: 1.2 },
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: { label: '10 cm', widthPx: 120, pixelsPerMm: 1.2 },
        [FUSION_PET_CORONAL_MIP_PANE_KEY]: { label: '10 cm', widthPx: 120, pixelsPerMm: 1.2 }
      }
    }))

    FUSION_PANE_KEYS.forEach((paneKey) => {
      const stage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${paneKey}"]`)
      expect(stage.attributes('data-image-src')).toBe('')
      expect(stage.attributes('data-is-loading')).toBe('true')
      expect(stage.attributes('data-orientation-top')).toBeUndefined()
      expect(stage.attributes('data-show-corner-info')).toBe('false')
      expect(stage.attributes('data-show-scale-bar')).toBe('false')
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

  it('passes PET image layer to the overlay pane', () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 3,
          width: 512,
          height: 512
        },
        [FUSION_PET_AXIAL_PANE_KEY]: {
          pet: 'pet-axial-layer',
          revision: 3,
          width: 512,
          height: 512
        },
        [FUSION_PET_CORONAL_MIP_PANE_KEY]: {
          pet: 'pet-mip-layer',
          revision: 3,
          width: 512,
          height: 512
        }
      }
    }))

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    const petStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_AXIAL_PANE_KEY}"]`)
    const mipStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_CORONAL_MIP_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-count')).toBe('1')
    expect(overlayStage.attributes('data-layer-key')).toBe('pet-registration-layer')
    expect(petStage.attributes('data-layer-count')).toBe('0')
    expect(mipStage.attributes('data-layer-count')).toBe('0')

    wrapper.unmount()
  })

  it('keeps the PET overlay layer key stable across backend preview revisions', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer-1',
          revision: 3,
          width: 512,
          height: 512
        }
      }
    }))

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-key')).toBe('pet-registration-layer')

    await wrapper.setProps({
      activeTab: createFusionTab({
        fusionLayerImages: {
          [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
            pet: 'pet-layer-2',
            revision: 4,
            width: 512,
            height: 512
          }
        }
      })
    })
    await nextTick()

    expect(overlayStage.attributes('data-layer-key')).toBe('pet-registration-layer')

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

  it('keeps manual registration marker positions fixed when PET projection changes', async () => {
    const fusionProjections = {
      [FUSION_CT_AXIAL_PANE_KEY]: createProjection(FUSION_CT_AXIAL_PANE_KEY),
      [FUSION_PET_AXIAL_PANE_KEY]: createProjection(FUSION_PET_AXIAL_PANE_KEY),
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: createProjection(FUSION_OVERLAY_AXIAL_PANE_KEY),
      [FUSION_PET_CORONAL_MIP_PANE_KEY]: createProjection(FUSION_PET_CORONAL_MIP_PANE_KEY)
    }
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionProjections
    }))
    await nextTick()

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

    const petPane = panes[FUSION_PANE_KEYS.indexOf(FUSION_PET_AXIAL_PANE_KEY)]!
    const petMarker = petPane.find<HTMLButtonElement>('.pet-ct-fusion-view__marker')
    await wrapper.setProps({
      activeTab: createFusionTab({
        fusionManualRegistration: true,
        fusionProjections: {
          ...fusionProjections,
          [FUSION_PET_AXIAL_PANE_KEY]: createProjection(FUSION_PET_AXIAL_PANE_KEY, {
            worldToNormalizedX: [1, 0, 0, 0.25],
            worldToNormalizedY: [0, 1, 0, 0.2]
          })
        }
      })
    })
    await nextTick()

    expect(petMarker.attributes('style')).toContain('left: 100px')
    expect(petMarker.attributes('style')).toContain('top: 50px')

    wrapper.unmount()
  })

  it('shows manual registration state and highlights the overlay viewport', () => {
    const wrapper = mountFusionView(createFusionTab({ fusionManualRegistration: true }))

    expect(wrapper.find('[data-testid="fusion-registration-mode-banner"]').exists()).toBe(true)
    expect(wrapper.find('.pet-ct-fusion-view').classes()).toContain('pet-ct-fusion-view--manual-registration')
    expect(
      wrapper
        .find(`.pet-ct-fusion-view__pane[data-fusion-pane-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
        .classes()
    ).toContain('pet-ct-fusion-view__pane--manual-registration-target')

    wrapper.unmount()
  })

  it('exits manual registration with Escape without resetting registration state', async () => {
    const wrapper = mountFusionView(createFusionTab({ fusionManualRegistration: true }))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()

    expect(wrapper.emitted('fusionConfigChange')).toEqual([[{ manualRegistration: false }]])
    wrapper.unmount()
  })

  it('does not exit manual registration when Escape is pressed inside editable fields', async () => {
    const wrapper = mountFusionView(createFusionTab({ fusionManualRegistration: true }))
    const input = document.createElement('input')
    document.body.appendChild(input)

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()

    expect(wrapper.emitted('fusionConfigChange')).toBeUndefined()
    input.remove()
    wrapper.unmount()
  })

  it('previews translate drags by moving the PET layer and PET axial image together', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionInfo: createFusionInfo(1),
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 512,
          height: 512
        }
      }
    }))
    mockOverlayGeometry(wrapper)
    mockPaneGeometry(wrapper, FUSION_PET_AXIAL_PANE_KEY)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 31, clientX: 10, clientY: 20, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 31, clientX: 34, clientY: 38, button: 0 }))
    await flushManualRegistrationMoveFrame()

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    const petStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(24px, 18px)')
    expect(overlayStage.attributes('data-layer-transform-origin')).toBe('124px 118px')
    expect(petStage.attributes('data-image-transform')).toBe('translate(24px, 18px)')
    expect(petStage.attributes('data-image-transform-origin')).toBe('124px 118px')
    expect(petStage.attributes('data-image-src')).toBe('pet-image')
    expect(wrapper.emitted('fusionRegistrationDrag')).toEqual([
      [{
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'start',
        subOpType: 'translate',
        deltaX: 0,
        deltaY: 0,
        anchorX: 10,
        anchorY: 20,
        currentX: 10,
        currentY: 20,
        pivotX: 100,
        pivotY: 100
      }],
      [{
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'move',
        subOpType: 'translate',
        deltaX: 24,
        deltaY: 18,
        anchorX: 10,
        anchorY: 20,
        currentX: 34,
        currentY: 38,
        pivotX: 100,
        pivotY: 100
      }]
    ])

    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 31, clientX: 44, clientY: 42, button: 0 }))
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 31, clientX: 54, clientY: 45, button: 0 }))
    await flushManualRegistrationMoveFrame()
    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(44px, 25px)')
    expect(petStage.attributes('data-image-transform')).toBe('translate(44px, 25px)')
    expect(wrapper.emitted('fusionRegistrationDrag')).toHaveLength(3)
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      {
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'move',
        subOpType: 'translate',
        deltaX: 44,
        deltaY: 25,
        anchorX: 10,
        anchorY: 20,
        currentX: 54,
        currentY: 45,
        pivotX: 100,
        pivotY: 100
      }
    ])

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 31, clientX: 54, clientY: 45, button: 0 }))
    await nextTick()
    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(44px, 25px)')
    expect(petStage.attributes('data-image-transform')).toBe('translate(44px, 25px)')
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      {
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'end',
        subOpType: 'translate',
        deltaX: 44,
        deltaY: 25,
        anchorX: 10,
        anchorY: 20,
        currentX: 54,
        currentY: 45,
        pivotX: 100,
        pivotY: 100
      }
    ])

    await wrapper.setProps({
      activeTab: createFusionTab({
        fusionInfo: createFusionInfo(2),
        fusionManualRegistration: true,
        fusionLayerImages: {
          [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
            pet: 'pet-layer-next',
            revision: 2,
            width: 512,
            height: 512
          }
        }
      })
    })
    await nextTick()
    expect(overlayStage.attributes('data-layer-src')).toBe('pet-layer')
    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(44px, 25px)')
    expect(petStage.attributes('data-image-src')).toBe('pet-image')
    expect(petStage.attributes('data-image-transform')).toBe('translate(44px, 25px)')

    wrapper.unmount()
  })

  it('clears the local registration preview when registration reset changes in manual mode', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 512,
          height: 512
        }
      }
    }))
    mockOverlayGeometry(wrapper)
    mockPaneGeometry(wrapper, FUSION_PET_AXIAL_PANE_KEY)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 49, clientX: 10, clientY: 20, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 49, clientX: 34, clientY: 38, button: 0 }))
    await flushManualRegistrationMoveFrame()

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    const petStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-src')).toBe('pet-layer')
    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(24px, 18px)')
    expect(petStage.attributes('data-image-transform')).toBe('translate(24px, 18px)')

    await wrapper.setProps({
      activeTab: createFusionTab({
        fusionManualRegistration: true,
        fusionRegistrationResetRevision: 1,
        fusionImages: {
          [FUSION_CT_AXIAL_PANE_KEY]: 'ct-image',
          [FUSION_PET_AXIAL_PANE_KEY]: 'pet-image-reset',
          [FUSION_OVERLAY_AXIAL_PANE_KEY]: 'overlay-image',
          [FUSION_PET_CORONAL_MIP_PANE_KEY]: 'mip-image'
        },
        fusionLayerImages: {
          [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
            pet: 'pet-layer-reset',
            revision: 2,
            width: 512,
            height: 512
          }
        }
      })
    })
    await nextTick()

    expect(overlayStage.attributes('data-layer-src')).toBe('pet-layer-reset')
    expect(overlayStage.attributes('data-layer-transform')).toBe('')
    expect(petStage.attributes('data-image-src')).toBe('pet-image-reset')
    expect(petStage.attributes('data-image-transform')).toBe('')

    wrapper.unmount()
  })

  it('sends backend registration deltas in rendered image canvas coordinates', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 1000,
          height: 500
        }
      }
    }))
    const overlayPane = wrapper.find<HTMLElement>(`.pet-ct-fusion-view__pane[data-fusion-pane-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    const overlayImage = overlayPane.find<HTMLImageElement>('.viewer-image')
    const renderedRect = {
      left: 0,
      top: 0,
      width: 500,
      height: 250,
      right: 500,
      bottom: 250,
      x: 0,
      y: 0,
      toJSON: () => ({})
    } as DOMRect
    vi.spyOn(overlayPane.element, 'getBoundingClientRect').mockReturnValue(renderedRect)
    vi.spyOn(overlayStage.element, 'getBoundingClientRect').mockReturnValue(renderedRect)
    vi.spyOn(overlayImage.element, 'getBoundingClientRect').mockReturnValue(renderedRect)
    Object.defineProperty(overlayImage.element, 'naturalWidth', { configurable: true, value: 1000 })
    Object.defineProperty(overlayImage.element, 'naturalHeight', { configurable: true, value: 500 })

    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 41, clientX: 50, clientY: 60, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 41, clientX: 75, clientY: 90, button: 0 }))
    await flushManualRegistrationMoveFrame()

    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(25px, 30px)')
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      expect.objectContaining({
        phase: 'move',
        deltaX: 50,
        deltaY: 60,
        anchorX: 100,
        anchorY: 120,
        currentX: 150,
        currentY: 180
      })
    ])

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 41, clientX: 75, clientY: 90, button: 0 }))
    await nextTick()

    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      expect.objectContaining({
        phase: 'end',
        deltaX: 50,
        deltaY: 60,
        anchorX: 100,
        anchorY: 120,
        currentX: 150,
        currentY: 180
      })
    ])

    wrapper.unmount()
  })

  it('commits the last previewed translate pose when pointerup lands at a newer coordinate', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 512,
          height: 512
        }
      }
    }))
    mockOverlayGeometry(wrapper)
    mockPaneGeometry(wrapper, FUSION_PET_AXIAL_PANE_KEY)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 43, clientX: 10, clientY: 20, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 43, clientX: 34, clientY: 38, button: 0 }))
    await flushManualRegistrationMoveFrame()

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 43, clientX: 80, clientY: 90, button: 0 }))
    await nextTick()

    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      expect.objectContaining({
        phase: 'end',
        subOpType: 'translate',
        deltaX: 24,
        deltaY: 18,
        currentX: 34,
        currentY: 38
      })
    ])

    wrapper.unmount()
  })

  it('keeps the last local manual registration preview on pointer cancel', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 512,
          height: 512
        }
      }
    }))
    mockOverlayGeometry(wrapper)
    mockPaneGeometry(wrapper, FUSION_PET_AXIAL_PANE_KEY)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 42, clientX: 20, clientY: 25, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 42, clientX: 44, clientY: 55, button: 0 }))
    await flushManualRegistrationMoveFrame()

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(24px, 30px)')

    stage!.vm.$emit('pointerCancel', createPointerEvent('pointercancel', { pointerId: 42, clientX: 44, clientY: 55, button: 0 }))
    await nextTick()

    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(24px, 30px)')
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      expect.objectContaining({
        phase: 'end',
        deltaX: 24,
        deltaY: 30
      })
    ])

    wrapper.unmount()
  })

  it('commits the last previewed rotate pose when pointerup lands at a newer angle', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 512,
          height: 512
        }
      }
    }))
    mockOverlayGeometry(wrapper)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()
    mockOverlayGeometry(wrapper)

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 44, clientX: 150, clientY: 100, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 44, clientX: 100, clientY: 150, button: 2 }))
    await flushManualRegistrationMoveFrame()

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 44, clientX: 50, clientY: 100, button: 2 }))
    await nextTick()

    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      expect.objectContaining({
        phase: 'end',
        subOpType: 'rotate',
        deltaX: -50,
        deltaY: 50,
        currentX: 100,
        currentY: 150,
        rotationDeltaDegrees: 90
      })
    ])

    wrapper.unmount()
  })

  it('previews rotate drags without converting rotation pointer deltas into translation', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 512,
          height: 512
        }
      }
    }))
    mockPaneGeometry(wrapper, FUSION_PET_AXIAL_PANE_KEY)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()
    mockOverlayGeometry(wrapper)

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 32, clientX: 150, clientY: 100, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 32, clientX: 100, clientY: 150, button: 2 }))
    await flushManualRegistrationMoveFrame()

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    const petStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 200, 0)')
    expect(overlayStage.attributes('data-layer-transform-origin')).toBe('0px 0px')
    expect(petStage.attributes('data-image-transform')).toBe('matrix(0, 1, -1, 0, 200, 0)')
    expect(wrapper.emitted('fusionRegistrationDrag')).toEqual([
      [expect.objectContaining({
        phase: 'start',
        subOpType: 'rotate',
        rotationDeltaDegrees: 0
      })],
      [expect.objectContaining({
        phase: 'move',
        subOpType: 'rotate',
        deltaX: -50,
        deltaY: 50,
        pivotX: 100,
        pivotY: 100,
        rotationDeltaDegrees: 90
      })]
    ])

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 32, clientX: 100, clientY: 150, button: 2 }))
    await nextTick()
    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 200, 0)')
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      {
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'end',
        subOpType: 'rotate',
        deltaX: -50,
        deltaY: 50,
        anchorX: 150,
        anchorY: 100,
        currentX: 100,
        currentY: 150,
        pivotX: 100,
        pivotY: 100,
        rotationDeltaDegrees: 90
      }
    ])

    await wrapper.setProps({
      activeTab: createFusionTab({
        fusionInfo: createFusionInfo(2),
        fusionManualRegistration: true,
        fusionLayerImages: {
          [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
            pet: 'pet-layer-next',
            revision: 2,
            width: 512,
            height: 512
          }
        }
      })
    })
    await nextTick()
    expect(overlayStage.attributes('data-layer-src')).toBe('pet-layer')
    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 200, 0)')
    expect(petStage.attributes('data-image-src')).toBe('pet-image')
    expect(petStage.attributes('data-image-transform')).toBe('matrix(0, 1, -1, 0, 200, 0)')

    wrapper.unmount()
  })

  it('keeps the translated PET pose stable when rotating after a translate drag', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 512,
          height: 512
        }
      }
    }))
    mockOverlayGeometry(wrapper)
    mockPaneGeometry(wrapper, FUSION_PET_AXIAL_PANE_KEY)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 45, clientX: 10, clientY: 20, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 45, clientX: 34, clientY: 38, button: 0 }))
    await flushManualRegistrationMoveFrame()
    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 45, clientX: 34, clientY: 38, button: 0 }))
    await nextTick()

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-transform')).toBe('translate(24px, 18px)')

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 46, clientX: 150, clientY: 100, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 46, clientX: 142, clientY: 144, button: 2 }))
    await flushManualRegistrationMoveFrame()

    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 224, 18)')
    const transformedPressPoint = applyCssMatrix(
      parseCssMatrix(overlayStage.attributes('data-layer-transform') ?? ''),
      { x: 126, y: 82 }
    )
    expect(transformedPressPoint.x).toBeCloseTo(142, 3)
    expect(transformedPressPoint.y).toBeCloseTo(144, 3)
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      expect.objectContaining({
        phase: 'move',
        subOpType: 'rotate',
        deltaX: -8,
        deltaY: 44,
        pivotX: 124,
        pivotY: 118,
        rotationDeltaDegrees: 90
      })
    ])

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 46, clientX: 142, clientY: 144, button: 2 }))
    await nextTick()

    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 224, 18)')
    wrapper.unmount()
  })

  it('keeps translate drags in screen coordinates after an existing rotation', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 512,
          height: 512
        }
      }
    }))
    mockOverlayGeometry(wrapper)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 47, clientX: 150, clientY: 100, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 47, clientX: 100, clientY: 150, button: 2 }))
    await flushManualRegistrationMoveFrame()
    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 47, clientX: 100, clientY: 150, button: 2 }))
    await nextTick()

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 200, 0)')

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 48, clientX: 20, clientY: 20, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 48, clientX: 40, clientY: 20, button: 0 }))
    await flushManualRegistrationMoveFrame()

    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 220, 0)')
    const translatedRotatedPoint = applyCssMatrix(
      parseCssMatrix(overlayStage.attributes('data-layer-transform') ?? ''),
      { x: 150, y: 100 }
    )
    expect(translatedRotatedPoint.x).toBeCloseTo(120, 3)
    expect(translatedRotatedPoint.y).toBeCloseTo(150, 3)
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      expect.objectContaining({
        phase: 'move',
        subOpType: 'translate',
        deltaX: 20,
        deltaY: 0
      })
    ])

    wrapper.unmount()
  })

  it('unwraps manual registration rotation across the 180 degree boundary', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 200,
          height: 200
        }
      }
    }))
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()
    mockOverlayGeometry(wrapper)

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 33, clientX: 50, clientY: 105, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 33, clientX: 50, clientY: 95, button: 2 }))
    await flushManualRegistrationMoveFrame()

    const lastMove = wrapper.emitted('fusionRegistrationDrag')?.at(-1)?.[0] as { phase?: string; rotationDeltaDegrees?: number }
    expect(lastMove.phase).toBe('move')
    expect(lastMove.rotationDeltaDegrees).toBeCloseTo(11.42, 2)

    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 33, clientX: 50, clientY: 85, button: 2 }))
    await flushManualRegistrationMoveFrame()

    const secondMove = wrapper.emitted('fusionRegistrationDrag')?.at(-1)?.[0] as { phase?: string; rotationDeltaDegrees?: number }
    expect(secondMove.phase).toBe('move')
    expect(secondMove.rotationDeltaDegrees).toBeCloseTo(22.41, 2)

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 33, clientX: 50, clientY: 85, button: 2 }))
    await nextTick()

    const lastEnd = wrapper.emitted('fusionRegistrationDrag')?.at(-1)?.[0] as { rotationDeltaDegrees?: number }
    expect(lastEnd.rotationDeltaDegrees).toBeCloseTo(22.41, 2)

    wrapper.unmount()
  })

  it('pauses rotation updates while the pointer is too close to the pivot', async () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionManualRegistration: true,
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 1,
          width: 200,
          height: 200
        }
      }
    }))
    mockOverlayGeometry(wrapper)
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 34, clientX: 150, clientY: 100, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 34, clientX: 100, clientY: 150, button: 2 }))
    await flushManualRegistrationMoveFrame()

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 200, 0)')

    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 34, clientX: 105, clientY: 105, button: 2 }))
    await flushManualRegistrationMoveFrame()

    const nearPivotMove = wrapper.emitted('fusionRegistrationDrag')?.at(-1)?.[0] as { phase?: string; rotationDeltaDegrees?: number }
    expect(nearPivotMove.phase).toBe('move')
    expect(nearPivotMove.rotationDeltaDegrees).toBeCloseTo(90, 2)
    expect(overlayStage.attributes('data-layer-transform')).toBe('matrix(0, 1, -1, 0, 200, 0)')

    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 34, clientX: 50, clientY: 100, button: 2 }))
    await flushManualRegistrationMoveFrame()

    const firstValidAfterPivot = wrapper.emitted('fusionRegistrationDrag')?.at(-1)?.[0] as { phase?: string; rotationDeltaDegrees?: number }
    expect(firstValidAfterPivot.phase).toBe('move')
    expect(firstValidAfterPivot.rotationDeltaDegrees).toBeCloseTo(90, 2)

    wrapper.unmount()
  })

  it('exits manual registration on a right-button double click in the overlay viewport', async () => {
    const wrapper = mountFusionView(createFusionTab({ fusionManualRegistration: true }))
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 21, clientX: 32, clientY: 40, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 21, clientX: 33, clientY: 40, button: 2 }))
    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 22, clientX: 33, clientY: 40, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 22, clientX: 33, clientY: 41, button: 2 }))
    await nextTick()

    expect(wrapper.emitted('fusionConfigChange')).toEqual([[{ manualRegistration: false }]])
    const registrationDragEndEvents = (wrapper.emitted('fusionRegistrationDrag') ?? [])
      .filter((event) => (event[0] as { phase?: string }).phase === 'end')
    expect(registrationDragEndEvents).toEqual([
      [{
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'end',
        subOpType: 'rotate',
        deltaX: 0,
        deltaY: 0,
        anchorX: 32,
        anchorY: 40,
        currentX: 33,
        currentY: 40,
        pivotX: 0,
        pivotY: 0,
        rotationDeltaDegrees: 0
      }],
      [{
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'end',
        subOpType: 'rotate',
        deltaX: 0,
        deltaY: 0,
        anchorX: 33,
        anchorY: 40,
        currentX: 33,
        currentY: 41,
        pivotX: 0,
        pivotY: 0,
        rotationDeltaDegrees: 0
      }]
    ])
    wrapper.unmount()
  })

})
