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
            '<div data-testid="volume-stage" @pointerdown="$emit(\'pointerDown\', $event)" @pointermove="$emit(\'pointerMove\', $event)" @pointerup="$emit(\'pointerUp\', $event)" @pointercancel="$emit(\'pointerCancel\', $event)" @click="$emit(\'viewportClick\', \'volume\')"></div>'
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
    isPrimary: { value: init.isPrimary ?? true },
    pointerId: { value: init.pointerId }
  })
  element.dispatchEvent(event)
  await nextTick()
}

describe('MobileVolumeViewport', () => {
  it('reduces one-finger 3D rotate deltas with mobile sensitivity', async () => {
    const wrapper = mountVolumeViewport(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.rotate3d}`)
    const stage = wrapper.get('[data-testid="volume-stage"]')

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 50, clientY: 30, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 30, pointerId: 1 })

    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 10, deltaY: 5, opType: VIEW_OPERATION_TYPES.rotate3d, phase: 'move', viewportKey: 'volume' }
    ])
  })

  it('keeps explicit 3D zoom deltas at full strength', async () => {
    const wrapper = mountVolumeViewport(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.zoom}`)
    const stage = wrapper.get('[data-testid="volume-stage"]')

    await dispatchPointerEvent(stage.element, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointermove', { clientX: 50, clientY: 30, pointerId: 1 })
    await dispatchPointerEvent(stage.element, 'pointerup', { clientX: 50, clientY: 30, pointerId: 1 })

    expect(wrapper.emitted('viewportDrag')).toContainEqual([
      { deltaX: 40, deltaY: 20, opType: VIEW_OPERATION_TYPES.zoom, phase: 'move', viewportKey: 'volume' }
    ])
  })
})
