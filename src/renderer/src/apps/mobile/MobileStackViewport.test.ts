import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import MobileStackViewport from './MobileStackViewport.vue'
import type { ViewerTabItem } from '../../types/viewer'

function createStackTab(): ViewerTabItem {
  return {
    activeTool: 'pan',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    imageSrc: 'blob:image',
    key: 'stack-tab',
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    pseudocolorPreset: 'bw',
    scaleBar: null,
    seriesId: 'series-1',
    seriesTitle: 'CT Demo',
    showCornerInfo: true,
    showScaleBar: true,
    sliceLabel: '1 / 24',
    title: 'CT Demo',
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false, zoom: 1, offsetX: 0, offsetY: 0 },
    viewId: 'view-1',
    viewType: 'Stack',
    windowLabel: 'WW 400 WL 40'
  } as ViewerTabItem
}

function mountStackViewport(activeOperation = `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.pan}`) {
  return mount(MobileStackViewport, {
    props: {
      activeOperation,
      activeTab: createStackTab(),
      isViewLoading: false
    },
    global: {
      stubs: {
        ViewerCanvasStage: {
          emits: ['pointerDown', 'pointerMove', 'pointerUp', 'pointerCancel'],
          template:
            '<div data-testid="stack-stage" @pointerdown="$emit(\'pointerDown\', $event)" @pointermove="$emit(\'pointerMove\', $event)" @pointerup="$emit(\'pointerUp\', $event)" @pointercancel="$emit(\'pointerCancel\', $event)"></div>'
        }
      }
    }
  })
}

async function dispatchPointerEvent(
  element: Element,
  type: string,
  init: { clientX: number; clientY: number; pointerId: number }
): Promise<void> {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    pointerId: { value: init.pointerId }
  })
  element.dispatchEvent(event)
  await nextTick()
}

describe('MobileStackViewport', () => {
  it('emits thresholded pan drags for one-finger movement', async () => {
    const wrapper = mountStackViewport()
    const stage = wrapper.get('[data-testid="stack-stage"]')

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 20, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 20, clientY: 24, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 20, clientY: 24, pointerId: 1 })

    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.pan, phase: 'start', viewportKey: 'single' }
    ])
    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 10, deltaY: 4, opType: VIEW_OPERATION_TYPES.pan, phase: 'move', viewportKey: 'single' }
    ])
    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.pan, phase: 'end', viewportKey: 'single' }
    ])
  })

  it('uses two-finger gestures for simultaneous zoom and pan', async () => {
    const wrapper = mountStackViewport(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`)
    const stage = wrapper.get('[data-testid="stack-stage"]')

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 0, pointerId: 2 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 20, clientY: 4, pointerId: 2 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 20, clientY: 4, pointerId: 2 })

    const dragEvents = wrapper.emitted('viewportDrag') ?? []
    expect(dragEvents).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.zoom, phase: 'start', viewportKey: 'single' }
    ])
    expect(dragEvents).toContainEqual([
      { deltaX: 0, deltaY: 0, opType: VIEW_OPERATION_TYPES.pan, phase: 'start', viewportKey: 'single' }
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
