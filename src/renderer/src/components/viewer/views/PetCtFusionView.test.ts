import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

function mockPetPreviewColorization(
  petOutputSrc = 'data:image/png;base64/colorized-pet-preview'
): void {
  const outputQueue = [petOutputSrc]
  class MockImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    naturalWidth = 2
    naturalHeight = 1
    width = 2
    height = 1

    set src(_value: string) {
      window.setTimeout(() => this.onload?.(), 0)
    }
  }

  vi.stubGlobal('Image', MockImage)
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    if (tagName.toLowerCase() !== 'canvas') {
      return originalCreateElement(tagName, options)
    }
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({
          data: new Uint8ClampedArray([
            255, 255, 255, 255,
            0, 0, 0, 255
          ])
        }),
        putImageData: vi.fn()
      }),
      toDataURL: () => outputQueue.shift() ?? petOutputSrc
    } as unknown as HTMLCanvasElement
  }) as typeof document.createElement)
}

async function flushPetPreviewColorization(): Promise<void> {
  await Promise.resolve()
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
  await nextTick()
}

function findManualRegistrationPreview(wrapper: ReturnType<typeof mountFusionView>, paneKey: FusionPaneKey) {
  return wrapper.find(`[data-testid="fusion-registration-local-preview"][data-fusion-preview-pane-key="${paneKey}"]`)
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

  it('shows an immediate local PET preview while manual registration is dragged', async () => {
    mockPetPreviewColorization()
    const wrapper = mountFusionView(createFusionTab({ fusionManualRegistration: true }))
    await flushPetPreviewColorization()
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 31, clientX: 10, clientY: 20, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 31, clientX: 34, clientY: 38, button: 0 }))
    await nextTick()

    const petAxialPreview = findManualRegistrationPreview(wrapper, FUSION_PET_AXIAL_PANE_KEY)
    const petAxialLayer = petAxialPreview.find('.pet-ct-fusion-view__manual-preview-image--pet')
    expect(petAxialPreview.exists()).toBe(true)
    expect(petAxialPreview.find('.pet-ct-fusion-view__manual-preview-image--ct').exists()).toBe(false)
    expect(petAxialLayer.attributes('src')).toBe('pet-image')
    expect(petAxialLayer.attributes('style')).toContain('translate3d(24.00px, 18.00px, 0)')

    const preview = findManualRegistrationPreview(wrapper, FUSION_OVERLAY_AXIAL_PANE_KEY)
    const ctLayer = preview.find('.pet-ct-fusion-view__manual-preview-image--ct')
    const petLayer = preview.find('.pet-ct-fusion-view__manual-preview-image--pet')
    expect(preview.exists()).toBe(true)
    expect(ctLayer.attributes('src')).toBe('ct-image')
    expect(petLayer.attributes('src')).toBe('data:image/png;base64/colorized-pet-preview')
    expect(petLayer.attributes('src')).not.toBe('pet-image')
    expect(petLayer.attributes('style')).toContain('translate3d(24.00px, 18.00px, 0)')
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      {
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'move',
        subOpType: 'translate',
        deltaX: 24,
        deltaY: 18
      }
    ])

    stage!.vm.$emit('pointerUp', createPointerEvent('pointerup', { pointerId: 31, clientX: 54, clientY: 45, button: 0 }))
    await nextTick()
    expect(petLayer.attributes('style')).toContain('translate3d(24.00px, 18.00px, 0)')
    expect(wrapper.emitted('fusionRegistrationDrag')?.at(-1)).toEqual([
      {
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'end',
        subOpType: 'translate',
        deltaX: 24,
        deltaY: 18
      }
    ])

    wrapper.unmount()
  })

  it('keeps the local PET preview stable when a backend overlay frame arrives mid-drag', async () => {
    mockPetPreviewColorization()
    const activeTab = createFusionTab({ fusionManualRegistration: true })
    const wrapper = mountFusionView(activeTab)
    await flushPetPreviewColorization()
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 33, clientX: 10, clientY: 20, button: 0 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 33, clientX: 24, clientY: 32, button: 0 }))
    await nextTick()

    await wrapper.setProps({
      activeTab: {
        ...activeTab,
        fusionImages: {
          ...activeTab.fusionImages,
          [FUSION_OVERLAY_AXIAL_PANE_KEY]: 'late-backend-overlay-image'
        }
      }
    })
    await flushPetPreviewColorization()

    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 33, clientX: 36, clientY: 44, button: 0 }))
    await nextTick()

    const preview = findManualRegistrationPreview(wrapper, FUSION_OVERLAY_AXIAL_PANE_KEY)
    const petLayer = preview.find('.pet-ct-fusion-view__manual-preview-image--pet')
    expect(preview.exists()).toBe(true)
    expect(petLayer.attributes('src')).toBe('data:image/png;base64/colorized-pet-preview')
    expect(petLayer.attributes('style')).toContain('translate3d(26.00px, 24.00px, 0)')

    wrapper.unmount()
  })

  it('rotates the local PET preview during right-button manual registration drags', async () => {
    mockPetPreviewColorization()
    const wrapper = mountFusionView(createFusionTab({ fusionManualRegistration: true }))
    await flushPetPreviewColorization()
    const stage = wrapper
      .findAllComponents({ name: 'ViewerCanvasStage' })
      .find((component) => component.props('viewportKey') === FUSION_OVERLAY_AXIAL_PANE_KEY)
    expect(stage).toBeTruthy()

    stage!.vm.$emit('pointerDown', createPointerEvent('pointerdown', { pointerId: 32, clientX: 10, clientY: 20, button: 2 }), FUSION_OVERLAY_AXIAL_PANE_KEY)
    stage!.vm.$emit('pointerMove', createPointerEvent('pointermove', { pointerId: 32, clientX: 30, clientY: 20, button: 2 }))
    await nextTick()

    const petLayer = wrapper
      .find(`[data-testid="fusion-registration-local-preview"][data-fusion-preview-pane-key="${FUSION_OVERLAY_AXIAL_PANE_KEY}"]`)
      .find('.pet-ct-fusion-view__manual-preview-image--pet')
    expect(petLayer.attributes('style')).toContain('rotate(7.000deg)')

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
        deltaY: 0
      }],
      [{
        viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
        phase: 'end',
        subOpType: 'rotate',
        deltaX: 0,
        deltaY: 0
      }]
    ])
    wrapper.unmount()
  })

})
