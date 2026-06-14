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
          props: ['viewportKey', 'orientation', 'loadingLabel', 'loadingProgressPercent', 'imageSrc', 'imageLayers'],
          template:
            '<div class="viewer-stage-stub viewer-viewport" :data-viewport-key="viewportKey" :data-orientation-top="orientation.top" :data-loading-label="loadingLabel" :data-loading-progress="loadingProgressPercent" :data-layer-count="imageLayers?.length ?? 0" :data-layer-transform="imageLayers?.[0]?.style?.transform ?? \'\'" :data-layer-transform-origin="imageLayers?.[0]?.style?.transformOrigin ?? \'\'"><img v-if="imageSrc" class="viewer-image" :src="imageSrc" /></div>'
        }
      }
    }
  })
}

function mockOverlayGeometry(wrapper: ReturnType<typeof mountFusionView>, width = 200, height = 200): void {
  const overlayPane = wrapper.find(`[data-fusion-pane-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
  const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
  const overlayImage = overlayStage.find('.viewer-image')
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
  vi.spyOn(overlayPane.element, 'getBoundingClientRect').mockReturnValue(rect)
  vi.spyOn(overlayStage.element, 'getBoundingClientRect').mockReturnValue(rect)
  vi.spyOn(overlayImage.element, 'getBoundingClientRect').mockReturnValue(rect)
  Object.defineProperty(overlayImage.element, 'naturalWidth', { configurable: true, value: width })
  Object.defineProperty(overlayImage.element, 'naturalHeight', { configurable: true, value: height })
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

  it('passes PET image layer to the overlay pane', () => {
    const wrapper = mountFusionView(createFusionTab({
      fusionLayerImages: {
        [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
          pet: 'pet-layer',
          revision: 3,
          width: 512,
          height: 512
        }
      }
    }))

    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    const petStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_PET_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-count')).toBe('1')
    expect(petStage.attributes('data-layer-count')).toBe('0')

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

  it('emits backend-driven translate registration drags without applying a local image transform', async () => {
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
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 31, clientX: 10, clientY: 20, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 31, clientX: 34, clientY: 38, button: 0 }))
    await nextTick()

    expect(wrapper.find('[data-testid="fusion-registration-local-preview"]').exists()).toBe(false)
    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-transform')).toBe('')
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      {
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'move',
        subOpType: 'translate',
        deltaX: 24,
        deltaY: 18,
        anchorX: 10,
        anchorY: 20,
        currentX: 34,
        currentY: 38,
        pivotX: 0,
        pivotY: 0
      }
    ])

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 31, clientX: 54, clientY: 45, button: 0 }))
    await nextTick()
    expect(wrapper.find('[data-testid="fusion-registration-local-preview"]').exists()).toBe(false)
    expect(overlayStage.attributes('data-layer-transform')).toBe('')
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
        pivotX: 0,
        pivotY: 0
      }
    ])

    await wrapper.setProps({
      activeTab: createFusionTab({
        fusionInfo: createFusionInfo(2),
        fusionManualRegistration: true,
        fusionLayerImages: {
          [FUSION_OVERLAY_AXIAL_PANE_KEY]: {
            pet: 'pet-layer',
            revision: 1,
            width: 512,
            height: 512
          },
          [FUSION_PET_AXIAL_PANE_KEY]: {
            pet: 'pet-preview-layer',
            revision: 2,
            width: 512,
            height: 512
          }
        }
      })
    })
    await nextTick()
    expect(overlayStage.attributes('data-layer-transform')).toBe('')

    await wrapper.setProps({
      activeTab: createFusionTab({
        fusionInfo: createFusionInfo(3),
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
    expect(overlayStage.attributes('data-layer-transform')).toBe('')

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
    await nextTick()

    expect(overlayStage.attributes('data-layer-transform')).toBe('')
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

    wrapper.unmount()
  })

  it('emits backend-driven rotate registration drags without applying a local image transform', async () => {
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
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()
    mockOverlayGeometry(wrapper)

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 32, clientX: 150, clientY: 100, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 32, clientX: 100, clientY: 150, button: 2 }))
    await nextTick()

    expect(wrapper.find('[data-testid="fusion-registration-local-preview"]').exists()).toBe(false)
    const overlayStage = wrapper.find(`.viewer-stage-stub[data-viewport-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
    expect(overlayStage.attributes('data-layer-transform')).toBe('')
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      {
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'move',
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

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 32, clientX: 100, clientY: 150, button: 2 }))
    await nextTick()
    expect(wrapper.find('[data-testid="fusion-registration-local-preview"]').exists()).toBe(false)
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

    wrapper.unmount()
  })

  it('accumulates manual registration rotation across the 180 degree wrap without reversing', async () => {
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

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 33, clientX: 50, clientY: 102, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 33, clientX: 50, clientY: 98, button: 2 }))
    await nextTick()

    const lastMove = wrapper.emitted('fusionRegistrationDrag')?.at(-1)?.[0] as { rotationDeltaDegrees?: number }
    expect(lastMove.rotationDeltaDegrees).toBeCloseTo(4.58, 1)

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
