import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import MobilePetCtFusionViewport from './MobilePetCtFusionViewport.vue'
import type { ViewerTabItem } from '../../types/viewer'

vi.mock('../../components/viewer/views/ViewerCanvasStage.vue', () => ({
  default: {
    props: ['viewportKey', 'cursorClass', 'imageSrc', 'imageLayers', 'isActive', 'lightSurface', 'loadingLabel', 'stageSurfaceClass'],
    emits: [
      'clickViewport',
      'copyAnnotation',
      'deleteAnnotation',
      'hoverViewportChange',
      'measurementCreate',
      'pointerDown',
      'pointerMove',
      'pointerUp',
      'pointerCancel',
      'pointerLeave',
      'updateAnnotationColor',
      'updateAnnotationSize',
      'updateAnnotationText',
      'wheelViewport'
    ],
    template: '<div class="viewer-stage-stub viewer-viewport" :data-viewport-key="viewportKey" :data-active="String(isActive)" :data-cursor-class="cursorClass ?? \'\'" :data-light-surface="String(lightSurface)" :data-loading-label="loadingLabel" :data-stage-surface-class="stageSurfaceClass ?? \'\'" @pointerdown="$emit(\'pointerDown\', $event, viewportKey)" @pointermove="$emit(\'pointerMove\', $event)" @pointerup="$emit(\'pointerUp\', $event)" @pointercancel="$emit(\'pointerCancel\', $event)" @pointerleave="$emit(\'pointerLeave\', viewportKey)"><img class="viewer-image" /></div>'
  }
}))

function createFusionTab(): ViewerTabItem {
  return {
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    fusionCornerInfos: {
      'fusion-ct-ax': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      'fusion-pet-ax': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      'fusion-overlay-ax': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      'fusion-pet-cor-mip': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] }
    },
    fusionImages: {
      'fusion-ct-ax': 'blob:ct',
      'fusion-pet-ax': 'blob:pet',
      'fusion-overlay-ax': 'blob:fusion',
      'fusion-pet-cor-mip': 'blob:mip'
    },
    fusionManualRegistration: false,
    fusionScaleBars: {
      'fusion-ct-ax': null,
      'fusion-pet-ax': null,
      'fusion-overlay-ax': null,
      'fusion-pet-cor-mip': null
    },
    fusionSliceLabels: {
      'fusion-ct-ax': '1 / 10',
      'fusion-pet-ax': '2 / 20',
      'fusion-overlay-ax': '1 / 10',
      'fusion-pet-cor-mip': '1 / 1'
    },
    fusionViewIds: {
      'fusion-ct-ax': 'ct-view',
      'fusion-pet-ax': 'pet-view',
      'fusion-overlay-ax': 'overlay-view',
      'fusion-pet-cor-mip': 'mip-view'
    },
    imageSrc: '',
    key: 'fusion-tab',
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    pseudocolorPreset: 'bw',
    scaleBar: null,
    seriesId: 'ct-series',
    seriesTitle: 'PET/CT Fusion',
    showCornerInfo: true,
    showScaleBar: true,
    sliceLabel: '',
    title: 'PET/CT Fusion',
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false, zoom: 1, offsetX: 0, offsetY: 0 },
    viewId: '',
    viewType: 'PETCTFusion',
    windowLabel: ''
  }
}

async function dispatchPointerEvent(
  element: Element,
  type: string,
  init: { button?: number; clientX: number; clientY: number; isPrimary?: boolean; pointerId: number }
): Promise<void> {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    isPrimary: { value: init.isPrimary ?? false },
    pointerId: { value: init.pointerId }
  })
  element.dispatchEvent(event)
  await nextTick()
}

function stubElementRect(element: Element, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () => ({
    bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 0),
    height: rect.height ?? 0,
    left: rect.left ?? 0,
    right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 0),
    top: rect.top ?? 0,
    width: rect.width ?? 0,
    x: rect.x ?? rect.left ?? 0,
    y: rect.y ?? rect.top ?? 0,
    toJSON: () => ({})
  }) as DOMRect
}

async function waitForPointerClickSuppressionReset(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
  await nextTick()
}

describe('MobilePetCtFusionViewport', () => {
  it('uses the active pane as the primary image and switches from thumbnails', async () => {
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: 'stack:pan',
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-overlay-ax',
        isViewLoading: false
      }
    })

    expect(wrapper.get('[data-testid="mobile-petct-fusion-primary"]').attributes('data-fusion-pane-key')).toBe('fusion-overlay-ax')
    expect(wrapper.findAll('[data-testid="mobile-petct-fusion-reference"]')).toHaveLength(3)

    const petSwitch = wrapper
      .findAll('[data-testid="mobile-petct-fusion-reference-switch"]')
      .find((button) => button.attributes('data-viewport-key') === 'fusion-pet-ax')
    expect(petSwitch).toBeTruthy()

    await petSwitch?.trigger('click')
    expect(wrapper.emitted('activeViewportChange')?.at(-1)).toEqual(['fusion-pet-ax'])

    await wrapper.setProps({ activeViewportKey: 'fusion-pet-ax' })
    expect(wrapper.get('[data-testid="mobile-petct-fusion-primary"]').attributes('data-fusion-pane-key')).toBe('fusion-pet-ax')
  })

  it('does not render active chrome on the primary pane and keeps thumbnail stages dark', async () => {
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: 'stack:pan',
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-pet-ax',
        isViewLoading: false
      }
    })

    const primary = wrapper.get('[data-testid="mobile-petct-fusion-primary"]')
    const primaryStage = primary.get('.viewer-stage-stub')

    expect(primary.classes()).not.toContain('mobile-petct-fusion-viewport__pane--active')
    expect(primaryStage.attributes('data-active')).toBe('false')
    expect(primaryStage.attributes('data-light-surface')).toBe('true')
    expect(primaryStage.attributes('data-stage-surface-class')).toBe('viewer-stage-surface--white')

    for (const stage of wrapper.findAll('[data-testid="mobile-petct-fusion-reference"] .viewer-stage-stub')) {
      expect(stage.attributes('data-light-surface')).toBe('false')
      expect(stage.attributes('data-stage-surface-class')).toBe('')
    }
  })

  it('uses compact loading labels for reference thumbnails', () => {
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: 'stack:pan',
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-overlay-ax',
        isViewLoading: true
      }
    })

    expect(wrapper.get('[data-testid="mobile-petct-fusion-primary"] .viewer-stage-stub').attributes('data-loading-label')).toBe('正在加载 Fusion Axial...')
    for (const stage of wrapper.findAll('[data-testid="mobile-petct-fusion-reference"] .viewer-stage-stub')) {
      expect(stage.attributes('data-loading-label')).toBe('加载中...')
    }
  })

  it('places reference slice info at the top-left and keeps long pane names visible', () => {
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: 'stack:pan',
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-overlay-ax',
        isViewLoading: false
      }
    })

    const mipReference = wrapper
      .findAll('[data-testid="mobile-petct-fusion-reference"]')
      .find((pane) => pane.attributes('data-fusion-pane-key') === 'fusion-pet-cor-mip')

    expect(mipReference?.get('.mobile-petct-fusion-viewport__reference-slice').text()).toBe('1 / 1')
    expect(mipReference?.get('.mobile-petct-fusion-viewport__reference-title').text()).toBe('PET Coronal MIP')
    expect(mipReference?.get('.mobile-petct-fusion-viewport__reference-title').classes()).toContain('mobile-petct-fusion-viewport__reference-title--compact')
  })

  it('collapses and restores the reference thumbnail rail', async () => {
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: 'stack:pan',
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-overlay-ax',
        isViewLoading: false
      }
    })

    await wrapper.get('[data-testid="mobile-petct-reference-toggle"]').trigger('click')

    expect(wrapper.findAll('.mobile-petct-fusion-viewport__pane--hidden')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="mobile-petct-fusion-reference-switch"]')).toHaveLength(0)

    await wrapper.get('[data-testid="mobile-petct-reference-toggle"]').trigger('click')

    expect(wrapper.findAll('.mobile-petct-fusion-viewport__pane--hidden')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="mobile-petct-fusion-reference-switch"]')).toHaveLength(3)
  })

  it('allows dragging the collapsed PET/CT reference toggle and resets it when thumbnails reopen', async () => {
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: 'stack:pan',
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-overlay-ax',
        isViewLoading: false
      }
    })

    stubElementRect(wrapper.get('[data-testid="mobile-petct-fusion-viewport"]').element, { left: 0, top: 0, width: 390, height: 680 })
    const toggle = wrapper.get('[data-testid="mobile-petct-reference-toggle"]')
    stubElementRect(toggle.element, { left: 340, top: 356, width: 36, height: 36 })

    await toggle.trigger('click')
    expect(wrapper.findAll('.mobile-petct-fusion-viewport__pane--hidden')).toHaveLength(3)

    await dispatchPointerEvent(toggle.element, 'pointerdown', { button: 0, clientX: 358, clientY: 374, isPrimary: true, pointerId: 12 })
    await dispatchPointerEvent(toggle.element, 'pointermove', { clientX: 298, clientY: 330, pointerId: 12 })
    await dispatchPointerEvent(toggle.element, 'pointerup', { clientX: 298, clientY: 330, pointerId: 12 })

    expect(wrapper.findAll('.mobile-petct-fusion-viewport__pane--hidden')).toHaveLength(3)
    expect(toggle.attributes('style')).toContain('left: 280px')
    expect(toggle.attributes('style')).toContain('top: 312px')

    await waitForPointerClickSuppressionReset()
    await toggle.trigger('click')

    expect(wrapper.findAll('.mobile-petct-fusion-viewport__pane--hidden')).toHaveLength(0)
    expect(toggle.attributes('style') ?? '').not.toContain('left:')
  })

  it('gives annotation pointer handlers priority over fusion drag', async () => {
    const annotationPointerDown = vi.fn(() => true)
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: 'stack:annotate:arrow',
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-overlay-ax',
        annotationPointerDown,
        isViewLoading: false
      }
    })

    const stage = wrapper.get('[data-testid="mobile-petct-fusion-primary"] .viewer-stage-stub')
    await dispatchPointerEvent(stage.element, 'pointerdown', { button: 0, clientX: 24, clientY: 32, isPrimary: true, pointerId: 18 })

    expect(annotationPointerDown).toHaveBeenCalledWith(expect.any(Event), 'fusion-overlay-ax')
    expect(wrapper.emitted('viewportDrag')).toBeUndefined()
    expect(wrapper.emitted('fusionRegistrationDrag')).toBeUndefined()
  })

  it('routes mobile PET/CT fusion measurement pointers through measurement creation', async () => {
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: 'measure:line',
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-overlay-ax',
        isViewLoading: false
      }
    })

    const stage = wrapper.get('[data-testid="mobile-petct-fusion-primary"] .viewer-stage-stub')
    const image = stage.get('img')
    stubElementRect(stage.element, { left: 0, top: 0, width: 200, height: 160 })
    stubElementRect(image.element, { left: 0, top: 0, width: 200, height: 160 })
    Object.assign(stage.element, {
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    })

    await dispatchPointerEvent(stage.element, 'pointerdown', { button: 0, clientX: 20, clientY: 24, isPrimary: true, pointerId: 22 })
    await dispatchPointerEvent(stage.element, 'pointerup', { button: 0, clientX: 20, clientY: 24, isPrimary: true, pointerId: 22 })
    await dispatchPointerEvent(stage.element, 'pointerdown', { button: 0, clientX: 140, clientY: 96, isPrimary: true, pointerId: 23 })
    await dispatchPointerEvent(stage.element, 'pointerup', { button: 0, clientX: 140, clientY: 96, isPrimary: true, pointerId: 23 })

    expect(wrapper.emitted('viewportDrag')).toBeUndefined()
    expect(wrapper.emitted('measurementCreate')?.[0]?.[0]).toMatchObject({
      viewportKey: 'fusion-overlay-ax',
      toolType: 'line'
    })
  })

  it('uses a two-finger PET/CT distance change for zoom without panning', async () => {
    const wrapper = mount(MobilePetCtFusionViewport, {
      props: {
        activeOperation: `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`,
        activeTab: createFusionTab(),
        activeViewportKey: 'fusion-overlay-ax',
        isViewLoading: false
      }
    })

    const stage = wrapper.get('[data-testid="mobile-petct-fusion-primary"] .viewer-stage-stub')
    await dispatchPointerEvent(stage.element, 'pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerdown', { button: 0, clientX: 10, clientY: 0, pointerId: 2 })
    await dispatchPointerEvent(stage.element, 'pointermove', { button: 0, clientX: 24, clientY: 6, pointerId: 2 })
    await dispatchPointerEvent(stage.element, 'pointermove', { button: 0, clientX: 28, clientY: 6, pointerId: 2 })
    await dispatchPointerEvent(stage.element, 'pointerup', { button: 0, clientX: 28, clientY: 6, pointerId: 2 })

    const dragEvents = wrapper.emitted('viewportDrag') ?? []
    expect(dragEvents).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.zoom, phase: 'start', viewportKey: 'fusion-overlay-ax' }
    ])
    expect(
      dragEvents.some(([payload]) => {
        const event = payload as { opType: string; phase: string }
        return event.opType === VIEW_OPERATION_TYPES.zoom && event.phase === 'move'
      })
    ).toBe(true)
    expect(dragEvents.some(([payload]) => (payload as { opType: string }).opType === VIEW_OPERATION_TYPES.pan)).toBe(false)
  })
})
