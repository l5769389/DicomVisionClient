import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import MobileMprViewport from './MobileMprViewport.vue'
import type { MprViewportKey, ViewerTabItem } from '../../types/viewer'

function createMprTab(): ViewerTabItem {
  return {
    activeTool: 'pan',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    imageSrc: '',
    key: 'mpr-tab',
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    pseudocolorPreset: 'bw',
    scaleBar: null,
    seriesId: 'series-1',
    seriesTitle: 'CT Demo',
    showCornerInfo: true,
    showScaleBar: true,
    sliceLabel: '',
    title: 'CT MPR',
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false, zoom: 1, offsetX: 0, offsetY: 0 },
    viewId: '',
    viewType: 'MPR',
    viewportImages: {
      'mpr-ax': 'blob:ax',
      'mpr-cor': 'blob:cor',
      'mpr-sag': 'blob:sag'
    },
    viewportSliceLabels: {
      'mpr-ax': '2 / 8',
      'mpr-cor': '4 / 12',
      'mpr-sag': '6 / 10'
    },
    viewportViewIds: {
      'mpr-ax': 'view-ax',
      'mpr-cor': 'view-cor',
      'mpr-sag': 'view-sag'
    },
    windowLabel: 'WW 400 WL 40'
  } as ViewerTabItem
}

function mountMprViewport(
  activeMprViewportKey: MprViewportKey = 'mpr-ax',
  activeOperation = `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`,
  activeTab: ViewerTabItem = createMprTab()
) {
  return mount(MobileMprViewport, {
    props: {
      activeMprViewportKey,
      activeOperation,
      activeTab,
      isViewLoading: false
    },
    global: {
      stubs: {
        ViewerCanvasStage: {
          props: ['viewportKey', 'isActive', 'showCornerInfo', 'showScaleBar'],
          emits: [
            'clickViewport',
            'hoverViewportChange',
            'wheelViewport',
            'pointerDown',
            'pointerMove',
            'pointerUp',
            'pointerCancel',
            'pointerLeave'
          ],
          template:
            '<div class="viewer-stage-stub" data-active-render-surface="true" :data-active="isActive" :data-show-corner-info="showCornerInfo" :data-show-scale-bar="showScaleBar" :data-viewport-key="viewportKey" @click="$emit(\'clickViewport\', viewportKey)" @pointerdown="$emit(\'pointerDown\', $event, viewportKey)" @pointermove="$emit(\'pointerMove\', $event)" @pointerup="$emit(\'pointerUp\', $event)" @pointercancel="$emit(\'pointerCancel\', $event)"></div>'
        }
      }
    }
  })
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

describe('MobileMprViewport', () => {
  it('mounts AX, COR, and SAG render surfaces and reports all viewport elements', async () => {
    const wrapper = mountMprViewport()
    await flushPromises()

    expect(wrapper.findAll('[data-active-render-surface="true"]')).toHaveLength(3)
    expect(wrapper.find('[data-viewport-key="mpr-ax"]').exists()).toBe(true)
    expect(wrapper.find('[data-viewport-key="mpr-cor"]').exists()).toBe(true)
    expect(wrapper.find('[data-viewport-key="mpr-sag"]').exists()).toBe(true)

    const readyEvents = wrapper.emitted('workspaceReady')
    expect(readyEvents).toBeTruthy()
    const payload = readyEvents?.at(-1)?.[0] as {
      viewportElements: Record<string, HTMLElement | null>
      viewportKey: string
    }
    expect(payload.viewportKey).toBe('mpr-ax')
    expect(payload.viewportElements['mpr-ax']).toBeInstanceOf(HTMLElement)
    expect(payload.viewportElements['mpr-cor']).toBeInstanceOf(HTMLElement)
    expect(payload.viewportElements['mpr-sag']).toBeInstanceOf(HTMLElement)
  })

  it('shows the active MPR plane as primary and the other two as reference thumbnails', async () => {
    const wrapper = mountMprViewport('mpr-cor')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="mobile-mpr-primary"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="mobile-mpr-primary"] [data-viewport-key="mpr-cor"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="mobile-mpr-reference"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="mobile-mpr-reference"] [data-show-corner-info="false"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-mpr-reference"] [data-show-scale-bar="false"]').exists()).toBe(true)
  })

  it('uses the same mobile MPR surface for 4D tabs', async () => {
    const wrapper = mountMprViewport('mpr-ax', `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`, {
      ...createMprTab(),
      viewType: '4D'
    } as ViewerTabItem)
    await flushPromises()

    expect(wrapper.findAll('[data-active-render-surface="true"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="mobile-mpr-primary"] [data-viewport-key="mpr-ax"]').exists()).toBe(true)
  })

  it('switches the active MPR plane when a reference thumbnail is clicked', async () => {
    const wrapper = mountMprViewport('mpr-ax')
    await flushPromises()

    await wrapper.get('[data-testid="mobile-mpr-reference-switch"][aria-label="Switch to COR"]').trigger('click')

    expect(wrapper.emitted('activeViewportChange')?.at(-1)).toEqual(['mpr-cor'])
  })

  it('switches the active MPR plane at the start of pointer interaction', async () => {
    const wrapper = mountMprViewport('mpr-ax')
    await flushPromises()

    await wrapper.get('[data-testid="mobile-mpr-reference-switch"][data-viewport-key="mpr-cor"]').trigger('pointerdown')

    expect(wrapper.emitted('activeViewportChange')?.at(-1)).toEqual(['mpr-cor'])
  })

  it('switches the active MPR plane at the start of mouse interaction', async () => {
    const wrapper = mountMprViewport('mpr-ax')
    await flushPromises()

    await wrapper.get('[data-testid="mobile-mpr-reference-switch"][data-viewport-key="mpr-cor"]').trigger('mousedown')

    expect(wrapper.emitted('activeViewportChange')?.at(-1)).toEqual(['mpr-cor'])
  })

  it('switches the active MPR plane at the start of touch interaction', async () => {
    const wrapper = mountMprViewport('mpr-ax')
    await flushPromises()

    await wrapper.get('[data-testid="mobile-mpr-reference-switch"][data-viewport-key="mpr-cor"]').trigger('touchstart')

    expect(wrapper.emitted('activeViewportChange')?.at(-1)).toEqual(['mpr-cor'])
  })

  it('keeps reference MPR surfaces mounted when thumbnails are hidden', async () => {
    const wrapper = mount(MobileMprViewport, {
      props: {
        activeMprViewportKey: 'mpr-ax',
        activeOperation: `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`,
        activeTab: createMprTab(),
        isViewLoading: false,
        showReferenceThumbnails: false
      },
      global: {
        stubs: {
          ViewerCanvasStage: {
            props: ['viewportKey'],
            template: '<div class="viewer-stage-stub" data-active-render-surface="true" :data-viewport-key="viewportKey"></div>'
          }
        }
      }
    })
    await flushPromises()

    expect(wrapper.findAll('[data-active-render-surface="true"]')).toHaveLength(3)
    expect(wrapper.findAll('.mobile-mpr-viewport__pane--hidden')).toHaveLength(2)
  })

  it('emits smoothed pan drags for the active MPR viewport', async () => {
    const wrapper = mountMprViewport('mpr-ax', `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.pan}`)
    await flushPromises()
    const primaryStage = wrapper.get('[data-testid="mobile-mpr-primary"] .viewer-stage-stub')

    await dispatchPointerEvent(primaryStage.element, 'pointerdown', { button: 0, clientX: 10, clientY: 20, isPrimary: true, pointerId: 1 })
    await dispatchPointerEvent(primaryStage.element, 'pointermove', { clientX: 18, clientY: 25, pointerId: 1 })
    await dispatchPointerEvent(primaryStage.element, 'pointerup', { clientX: 18, clientY: 25, pointerId: 1 })

    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.pan, phase: 'start', viewportKey: 'mpr-ax' }
    ])
    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 8, deltaY: 5, opType: VIEW_OPERATION_TYPES.pan, phase: 'move', viewportKey: 'mpr-ax' }
    ])
    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.pan, phase: 'end', viewportKey: 'mpr-ax' }
    ])
  })

  it('uses two-finger MPR gestures for zoom and pan on the active plane', async () => {
    const wrapper = mountMprViewport('mpr-cor', `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`)
    await flushPromises()
    const primaryStage = wrapper.get('[data-testid="mobile-mpr-primary"] .viewer-stage-stub')

    await dispatchPointerEvent(primaryStage.element, 'pointerdown', { button: 0, clientX: 0, clientY: 0, isPrimary: true, pointerId: 1 })
    await dispatchPointerEvent(primaryStage.element, 'pointerdown', { button: 0, clientX: 10, clientY: 0, pointerId: 2 })
    await dispatchPointerEvent(primaryStage.element, 'pointermove', { clientX: 20, clientY: 4, pointerId: 2 })
    await dispatchPointerEvent(primaryStage.element, 'pointerup', { clientX: 20, clientY: 4, pointerId: 2 })

    const dragEvents = wrapper.emitted('viewportDrag') ?? []
    expect(dragEvents).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.zoom, phase: 'start', viewportKey: 'mpr-cor' }
    ])
    expect(dragEvents).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.pan, phase: 'start', viewportKey: 'mpr-cor' }
    ])
    expect(
      dragEvents.some(([payload]) => {
        const event = payload as { opType: string; phase: string }
        return event.opType === VIEW_OPERATION_TYPES.zoom && event.phase === 'move'
      })
    ).toBe(true)
    expect(
      dragEvents.some(([payload]) => {
        const event = payload as { opType: string; phase: string }
        return event.opType === VIEW_OPERATION_TYPES.pan && event.phase === 'move'
      })
    ).toBe(true)
  })
})
