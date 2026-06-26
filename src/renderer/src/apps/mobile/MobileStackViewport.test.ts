import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import MobileStackViewport from './MobileStackViewport.vue'
import type { ViewerTabItem } from '../../types/viewer'

function createStackTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
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
    windowLabel: 'WW 400 WL 40',
    ...overrides
  } as ViewerTabItem
}

function mountStackViewport(
  activeOperation = `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.pan}`,
  activeTab = createStackTab()
) {
  return mount(MobileStackViewport, {
    props: {
      activeOperation,
      activeTab,
      isViewLoading: false
    },
    global: {
      stubs: {
        ViewerCanvasStage: {
          props: ['draftMeasurement', 'draftMeasurementMode'],
          emits: ['pointerDown', 'pointerMove', 'pointerUp', 'pointerCancel', 'pointerLeave'],
          template:
            '<div class="viewer-viewport" data-testid="stack-stage" data-viewport-key="single" :data-draft-mode="draftMeasurementMode || \'\'" :data-draft-id="draftMeasurement?.measurementId || \'\'" :data-draft-tool="draftMeasurement?.toolType || \'\'" :data-draft-points="draftMeasurement ? JSON.stringify(draftMeasurement.points) : \'\'" @pointerdown="$emit(\'pointerDown\', $event)" @pointermove="$emit(\'pointerMove\', $event)" @pointerup="$emit(\'pointerUp\', $event)" @pointercancel="$emit(\'pointerCancel\', $event)" @pointerleave="$emit(\'pointerLeave\', \'single\')"><img class="viewer-image" src="blob:image" /></div>'
        }
      }
    }
  })
}

async function dispatchPointerEvent(
  element: Element,
  type: string,
  init: { button?: number; clientX: number; clientY: number; isPrimary?: boolean; pointerId: number; timeStamp?: number }
): Promise<void> {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(element, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true)
  })
  Object.defineProperties(event, {
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    isPrimary: { value: init.isPrimary ?? true },
    pointerId: { value: init.pointerId }
  })
  if (typeof init.timeStamp === 'number') {
    Object.defineProperty(event, 'timeStamp', { value: init.timeStamp })
  }
  element.dispatchEvent(event)
  await nextTick()
}

function stubViewportRect(wrapper: ReturnType<typeof mountStackViewport>): void {
  const stage = wrapper.get('[data-testid="stack-stage"]')
  const image = wrapper.get('.viewer-image')
  const rect = {
    bottom: 100,
    height: 100,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
    toJSON: () => ({})
  } as DOMRect
  vi.spyOn(stage.element, 'getBoundingClientRect').mockReturnValue(rect)
  vi.spyOn(image.element, 'getBoundingClientRect').mockReturnValue(rect)
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

  it('creates rectangular measurements from drag gestures', async () => {
    const wrapper = mountStackViewport('measure:rect')
    stubViewportRect(wrapper)
    const stage = wrapper.get('[data-testid="stack-stage"]')

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 20, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 60, clientY: 80, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 60, clientY: 80, pointerId: 1 })

    const payload = wrapper.emitted('measurementCreate')?.[0]?.[0] as {
      measurementId?: string
      points: Array<{ x: number; y: number }>
      toolType: string
      viewportKey: string
    }
    expect(payload).toMatchObject({
      toolType: 'rect',
      viewportKey: 'single',
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.6, y: 0.8 }
      ]
    })
    expect(payload.measurementId).toEqual(expect.any(String))
  })

  it('selects committed measurements on tap so they can be edited', async () => {
    const wrapper = mountStackViewport(
      'measure:line',
      createStackTab({
        measurements: [
          {
            measurementId: 'measure-line-1',
            toolType: 'line',
            points: [
              { x: 0.1, y: 0.2 },
              { x: 0.6, y: 0.2 }
            ],
            labelLines: ['42.0 mm']
          }
        ]
      })
    )
    stubViewportRect(wrapper)
    const stage = wrapper.get('[data-testid="stack-stage"]')

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 35, clientY: 20, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 35, clientY: 20, pointerId: 1 })

    expect(stage.attributes('data-draft-mode')).toBe('selected')
    expect(stage.attributes('data-draft-id')).toBe('measure-line-1')
  })

  it('creates angle measurements by confirming three mobile points', async () => {
    const wrapper = mountStackViewport('measure:angle')
    stubViewportRect(wrapper)
    const stage = wrapper.get('[data-testid="stack-stage"]')

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 50, clientY: 10, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 10, pointerId: 1 })
    expect(wrapper.emitted('measurementCreate')).toBeUndefined()

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 50, clientY: 10, pointerId: 2 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 10, pointerId: 2 })
    expect(wrapper.emitted('measurementCreate')).toBeUndefined()

    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 50, clientY: 50, pointerId: 2 })
    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 3 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 50, pointerId: 3 })

    const payload = wrapper.emitted('measurementCreate')?.[0]?.[0] as {
      points: Array<{ x: number; y: number }>
      toolType: string
    }
    expect(payload.toolType).toBe('angle')
    expect(payload.points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.5, y: 0.5 }
    ])
  })

  it('finishes curve measurements with a double tap on the last point', async () => {
    const wrapper = mountStackViewport('measure:curve')
    stubViewportRect(wrapper)
    const stage = wrapper.get('[data-testid="stack-stage"]')

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1, timeStamp: 0 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 10, clientY: 10, pointerId: 1, timeStamp: 10 })
    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 2, timeStamp: 500 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 50, pointerId: 2, timeStamp: 510 })
    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 3, timeStamp: 700 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 50, pointerId: 3, timeStamp: 710 })

    const payload = wrapper.emitted('measurementCreate')?.[0]?.[0] as {
      points: Array<{ x: number; y: number }>
      toolType: string
    }
    expect(payload.toolType).toBe('curve')
    expect(payload.points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 }
    ])
  })
})
