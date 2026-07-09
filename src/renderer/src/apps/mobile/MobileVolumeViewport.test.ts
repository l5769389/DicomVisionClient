import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import MobileVolumeViewport from './MobileVolumeViewport.vue'
import type { ViewerTabItem } from '../../types/viewer'

function createVolumeTab(): ViewerTabItem {
  return {
    activeTool: 'rotate3d',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    imageSrc: 'blob:volume',
    key: 'volume-tab',
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    pseudocolorPreset: 'bw',
    scaleBar: null,
    seriesId: 'series-1',
    seriesTitle: 'CT Demo',
    showCornerInfo: true,
    showScaleBar: true,
    sliceLabel: '',
    title: 'CT 3D',
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false, zoom: 1, offsetX: 0, offsetY: 0 },
    viewId: 'volume-view',
    viewType: '3D',
    windowLabel: 'WW 400 WL 40'
  } as ViewerTabItem
}

function mountVolumeViewport(activeOperation: string) {
  return mount(MobileVolumeViewport, {
    props: {
      activeOperation,
      activeTab: createVolumeTab()
    },
    global: {
      stubs: {
        VolumeView: {
          props: ['activeOperation', 'activeTab'],
          emits: ['pointerDown', 'pointerMove', 'pointerUp', 'pointerCancel', 'viewportClick'],
          template:
            '<div data-testid="volume-stage" data-viewport-key="volume" @pointerdown="$emit(\'pointerDown\', $event)" @pointermove="$emit(\'pointerMove\', $event)" @pointerup="$emit(\'pointerUp\', $event)" @pointercancel="$emit(\'pointerCancel\', $event)" @click="$emit(\'viewportClick\', \'volume\')"></div>'
        }
      }
    }
  })
}

function installStageRect(element: Element): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
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
    isPrimary: { value: init.isPrimary ?? true },
    pointerId: { value: init.pointerId }
  })
  element.dispatchEvent(event)
  await nextTick()
}

describe('MobileVolumeViewport', () => {
  it('emits one-finger 3D rotate canvas coordinates without mobile sensitivity scaling', async () => {
    const wrapper = mountVolumeViewport(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.rotate3d}`)
    const stage = wrapper.get('[data-testid="volume-stage"]')
    installStageRect(stage.element)

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 50, clientY: 30, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 70, clientY: 60, pointerId: 1 })

    const payloads = wrapper.emitted('viewportDrag')?.map(([payload]) => payload as {
      phase: string
      opType: string
      deltaX?: number
      deltaY?: number
      viewportKey?: string
      canvasX?: number
      canvasY?: number
      canvasWidth?: number
      canvasHeight?: number
      interactionId?: string
    }) ?? []
    const rotatePayloads = payloads.filter((payload) => payload.opType === VIEW_OPERATION_TYPES.rotate3d)
    const interactionIds = rotatePayloads.map((payload) => payload.interactionId)
    expect(interactionIds.every((interactionId) => typeof interactionId === 'string' && interactionId.length > 0)).toBe(true)
    expect(new Set(interactionIds).size).toBe(1)
    expect(rotatePayloads.at(-2)).toMatchObject({
      phase: 'move',
      deltaX: 0.7,
      deltaY: 0.6,
      canvasX: 70,
      canvasY: 60,
      canvasWidth: 100,
      canvasHeight: 100,
      interactionId: interactionIds[0]
    })
    expect(rotatePayloads.at(-1)).toMatchObject({
      phase: 'end',
      canvasX: 70,
      canvasY: 60,
      interactionId: interactionIds[0]
    })
  })

  it('keeps explicit 3D zoom deltas at full strength', async () => {
    const wrapper = mountVolumeViewport(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.zoom}`)
    const stage = wrapper.get('[data-testid="volume-stage"]')
    installStageRect(stage.element)

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 50, clientY: 30, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 30, pointerId: 1 })

    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 40, deltaY: 20, opType: VIEW_OPERATION_TYPES.zoom, phase: 'move', viewportKey: 'volume' }
    ])
  })

  it('resumes one-finger 3D rotation after a pinch ends with one finger still active', async () => {
    const wrapper = mountVolumeViewport(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.rotate3d}`)
    const stage = wrapper.get('[data-testid="volume-stage"]')
    installStageRect(stage.element)

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 30, clientY: 10, pointerId: 2, isPrimary: false })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 50, clientY: 10, pointerId: 2, isPrimary: false })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 10, pointerId: 2, isPrimary: false })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 25, clientY: 25, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 25, clientY: 25, pointerId: 1 })

    const payloads = wrapper.emitted('viewportDrag')?.map(([payload]) => payload as {
      phase: string
      opType: string
      canvasX?: number
      canvasY?: number
      interactionId?: string
    }) ?? []
    const rotatePayloads = payloads.filter((payload) => payload.opType === VIEW_OPERATION_TYPES.rotate3d)
    const rotateStarts = rotatePayloads.filter((payload) => payload.phase === 'start')

    expect(rotateStarts).toHaveLength(2)
    expect(rotateStarts[0].interactionId).toBeTruthy()
    expect(rotateStarts[1].interactionId).toBeTruthy()
    expect(rotateStarts[1].interactionId).not.toBe(rotateStarts[0].interactionId)
    expect(rotatePayloads).toContainEqual(expect.objectContaining({
      phase: 'move',
      canvasX: 25,
      canvasY: 25,
      interactionId: rotateStarts[1].interactionId
    }))
    expect(rotatePayloads.at(-1)).toMatchObject({
      phase: 'end',
      canvasX: 25,
      canvasY: 25,
      interactionId: rotateStarts[1].interactionId
    })
  })

  it('submits a closed freeform volume clip polygon with one-finger drawing', async () => {
    const wrapper = mountVolumeViewport(`${STACK_OPERATION_PREFIX}volumeClip:inside`)
    const stage = wrapper.get('[data-testid="volume-stage"]')
    installStageRect(stage.element)

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 11 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 80, clientY: 25, pointerId: 11 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 65, clientY: 70, pointerId: 11 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 25, clientY: 65, pointerId: 11 })

    const payload = wrapper.emitted('volumeClip')?.[0]?.[0] as {
      mode: string
      points: Array<{ x: number; y: number }>
      viewportKey: string
    }
    expect(payload).toMatchObject({ mode: 'inside', viewportKey: 'volume' })
    expect(payload.points.length).toBeGreaterThanOrEqual(5)
    expect(payload.points.at(-1)).toEqual(payload.points[0])
    expect(wrapper.emitted('viewportDrag')).toBeUndefined()
  })

  it('simplifies dense mobile volume clip freeform points before submitting', async () => {
    const wrapper = mountVolumeViewport(`${STACK_OPERATION_PREFIX}volumeClip:inside`)
    const stage = wrapper.get('[data-testid="volume-stage"]')
    installStageRect(stage.element)

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 80, clientY: 50, pointerId: 12 })
    for (let index = 1; index <= 360; index += 1) {
      const radians = (index / 360) * Math.PI * 2
      await dispatchPointerEvent(stage.element, 'pointermove', {
        clientX: 50 + Math.cos(radians) * 30,
        clientY: 50 + Math.sin(radians) * 30,
        pointerId: 12
      })
    }
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 80, clientY: 50, pointerId: 12 })

    const payload = wrapper.emitted('volumeClip')?.[0]?.[0] as {
      points: Array<{ x: number; y: number }>
    }
    expect(payload.points.length).toBeLessThanOrEqual(241)
    expect(payload.points.length).toBeGreaterThan(8)
    expect(payload.points.at(-1)).toEqual(payload.points[0])
  })

  it('cancels mobile volume clip drawing when a second finger touches', async () => {
    const wrapper = mountVolumeViewport(`${STACK_OPERATION_PREFIX}volumeClip:outside`)
    const stage = wrapper.get('[data-testid="volume-stage"]')
    installStageRect(stage.element)

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 21 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 80, clientY: 25, pointerId: 21 })
    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 30, clientY: 30, pointerId: 22, isPrimary: false })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 65, clientY: 70, pointerId: 21 })

    expect(wrapper.emitted('volumeClip')).toBeUndefined()
  })
})
