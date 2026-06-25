import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import MobileMprViewport from './MobileMprViewport.vue'
import type { MprSegmentationConfig, MprViewportKey, ViewerTabItem } from '../../types/viewer'

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
          props: [
            'viewportKey',
            'isActive',
            'showCornerInfo',
            'showScaleBar',
            'activeOperation',
            'mprSegmentationConfig',
            'mprSegmentationDefaultThresholdColor',
            'mprSegmentationDefaultVoiColor',
            'mprSegmentationOverlay',
            'voiEditable'
          ],
          emits: [
            'clickViewport',
            'hoverViewportChange',
            'wheelViewport',
            'pointerDown',
            'pointerMove',
            'pointerUp',
            'pointerCancel',
            'pointerLeave',
            'mprSegmentationConfigChange',
            'mprSegmentationModeChange'
          ],
          template:
            '<div class="viewer-stage-stub" data-active-render-surface="true" :data-active="isActive ? \'true\' : \'false\'" :data-active-operation="activeOperation" :data-show-corner-info="showCornerInfo" :data-show-scale-bar="showScaleBar" :data-viewport-key="viewportKey" :data-voi-editable="voiEditable ? \'true\' : \'false\'" @click="$emit(\'clickViewport\', viewportKey)" @pointerdown="$emit(\'pointerDown\', $event, viewportKey)" @pointermove="$emit(\'pointerMove\', $event)" @pointerup="$emit(\'pointerUp\', $event)" @pointercancel="$emit(\'pointerCancel\', $event)"><button class="segmentation-config-stub" @click.stop="$emit(\'mprSegmentationConfigChange\', mprSegmentationConfig, \'end\')">Config</button><button class="segmentation-mode-stub" @click.stop="$emit(\'mprSegmentationModeChange\', \'segmentation:voi\')">Mode</button></div>'
        }
      }
    }
  })
}

function createSegmentationConfig(): MprSegmentationConfig {
  return {
    enabled: true,
    clientRevision: 1,
    selectedRegionId: null,
    selectedVoi: false,
    selectedVoiId: null,
    thresholdRegions: [],
    voiSpheres: [],
    voiSphere: null
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

async function waitForWorkspaceReadyFrame(): Promise<void> {
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  await nextTick()
}

describe('MobileMprViewport', () => {
  it('mounts AX, COR, and SAG render surfaces and reports all viewport elements', async () => {
    const wrapper = mountMprViewport()
    await flushPromises()
    await waitForWorkspaceReadyFrame()

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

  it('refreshes pane roles and workspace surfaces after the active MPR plane changes', async () => {
    const wrapper = mountMprViewport('mpr-ax')
    await flushPromises()
    await waitForWorkspaceReadyFrame()

    await wrapper.setProps({ activeMprViewportKey: 'mpr-cor' })
    await flushPromises()
    await waitForWorkspaceReadyFrame()

    expect(wrapper.findAll('[data-testid="mobile-mpr-primary"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="mobile-mpr-primary"] [data-viewport-key="mpr-cor"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="mobile-mpr-reference"] .viewer-stage-stub[data-viewport-key="mpr-ax"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="mobile-mpr-reference"] .viewer-stage-stub[data-viewport-key="mpr-sag"]')).toHaveLength(1)

    const readyEvents = wrapper.emitted('workspaceReady')
    const payload = readyEvents?.at(-1)?.[0] as {
      viewportElements: Record<string, HTMLElement | null>
      viewportKey: string
    }
    expect(payload.viewportKey).toBe('mpr-cor')
    expect(payload.viewportElements['mpr-ax']?.dataset.activeRenderSurface).toBe('true')
    expect(payload.viewportElements['mpr-cor']?.dataset.activeRenderSurface).toBe('true')
    expect(payload.viewportElements['mpr-sag']?.dataset.activeRenderSurface).toBe('true')
  })

  it('shows the active MPR plane as primary and the other two as reference thumbnails', async () => {
    const wrapper = mountMprViewport('mpr-cor')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="mobile-mpr-primary"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="mobile-mpr-primary"] [data-viewport-key="mpr-cor"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mobile-mpr-primary"] [data-viewport-key="mpr-cor"]').attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="mobile-mpr-primary"] [data-viewport-key="mpr-cor"]').attributes('data-voi-editable')).toBe('true')
    expect(wrapper.findAll('[data-testid="mobile-mpr-reference"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="mobile-mpr-reference"] [data-show-corner-info="false"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-mpr-reference"] [data-show-scale-bar="false"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="mobile-mpr-reference"] .viewer-stage-stub').every((stage) => stage.attributes('data-active') === 'false')).toBe(true)
    expect(wrapper.findAll('[data-testid="mobile-mpr-reference"] .viewer-stage-stub').every((stage) => stage.attributes('data-voi-editable') === 'false')).toBe(true)
    const sagReference = wrapper.get('[data-testid="mobile-mpr-reference-switch"][data-viewport-key="mpr-sag"]')
    expect(sagReference.get('.mobile-mpr-viewport__reference-slice').text()).toBe('6 / 10')
    expect(sagReference.get('.mobile-mpr-viewport__reference-title').text()).toBe('SAG')
    expect(sagReference.text()).not.toContain('Im')
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

  it('passes mobile MPR segmentation state through the active render surfaces', async () => {
    const config = createSegmentationConfig()
    const wrapper = mount(MobileMprViewport, {
      props: {
        activeMprViewportKey: 'mpr-ax',
        activeOperation: `${STACK_OPERATION_PREFIX}segmentation:threshold`,
        activeTab: createMprTab(),
        isViewLoading: false,
        mprSegmentationConfig: config,
        mprSegmentationDefaultThresholdColor: '#ff4df8',
        mprSegmentationDefaultVoiColor: '#22d3ee'
      },
      global: {
        stubs: {
          ViewerCanvasStage: {
            props: ['viewportKey', 'activeOperation', 'isActive', 'mprSegmentationConfig', 'voiEditable'],
            emits: ['mprSegmentationConfigChange', 'mprSegmentationModeChange'],
            template:
              '<div data-active-render-surface="true" :data-active="isActive ? \'true\' : \'false\'" :data-active-operation="activeOperation" :data-viewport-key="viewportKey" :data-voi-editable="voiEditable ? \'true\' : \'false\'"><button class="segmentation-config-stub" @click="$emit(\'mprSegmentationConfigChange\', mprSegmentationConfig, \'end\')">Config</button><button class="segmentation-mode-stub" @click="$emit(\'mprSegmentationModeChange\', \'segmentation:voi\')">Mode</button></div>'
          }
        }
      }
    })
    await flushPromises()

    expect(wrapper.get('[data-viewport-key="mpr-ax"]').attributes('data-active-operation')).toBe(`${STACK_OPERATION_PREFIX}segmentation:threshold`)
    expect(wrapper.get('[data-viewport-key="mpr-ax"]').attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-viewport-key="mpr-ax"]').attributes('data-voi-editable')).toBe('true')

    await wrapper.get('[data-viewport-key="mpr-ax"] .segmentation-config-stub').trigger('click')
    expect(wrapper.emitted('mprSegmentationConfigChange')?.at(-1)).toEqual([config, 'end'])

    await wrapper.get('[data-viewport-key="mpr-ax"] .segmentation-mode-stub').trigger('click')
    expect(wrapper.emitted('mprSegmentationModeChange')?.at(-1)).toEqual(['segmentation:voi', 'mpr-ax'])
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

  it('collapses and restores reference MPR thumbnails without unmounting surfaces', async () => {
    const wrapper = mountMprViewport('mpr-ax')
    await flushPromises()

    await wrapper.get('[data-testid="mobile-mpr-reference-toggle"]').trigger('click')

    expect(wrapper.findAll('[data-active-render-surface="true"]')).toHaveLength(3)
    expect(wrapper.findAll('.mobile-mpr-viewport__pane--hidden')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="mobile-mpr-reference-switch"]')).toHaveLength(0)

    await wrapper.get('[data-testid="mobile-mpr-reference-toggle"]').trigger('click')

    expect(wrapper.findAll('.mobile-mpr-viewport__pane--hidden')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="mobile-mpr-reference-switch"]')).toHaveLength(2)
  })

  it('allows dragging the collapsed MPR reference toggle and resets it when thumbnails reopen', async () => {
    const wrapper = mountMprViewport('mpr-ax')
    await flushPromises()

    stubElementRect(wrapper.get('[data-testid="mobile-mpr-viewport"]').element, { left: 0, top: 0, width: 360, height: 640 })
    const toggle = wrapper.get('[data-testid="mobile-mpr-reference-toggle"]')
    stubElementRect(toggle.element, { left: 314, top: 280, width: 36, height: 36 })

    await toggle.trigger('click')
    expect(wrapper.findAll('.mobile-mpr-viewport__pane--hidden')).toHaveLength(2)

    await dispatchPointerEvent(toggle.element, 'pointerdown', { button: 0, clientX: 330, clientY: 298, isPrimary: true, pointerId: 8 })
    await dispatchPointerEvent(toggle.element, 'pointermove', { clientX: 260, clientY: 240, pointerId: 8 })
    await dispatchPointerEvent(toggle.element, 'pointerup', { clientX: 260, clientY: 240, pointerId: 8 })

    expect(wrapper.findAll('.mobile-mpr-viewport__pane--hidden')).toHaveLength(2)
    expect(toggle.attributes('style')).toContain('left: 244px')
    expect(toggle.attributes('style')).toContain('top: 222px')

    await waitForPointerClickSuppressionReset()
    await toggle.trigger('click')

    expect(wrapper.findAll('.mobile-mpr-viewport__pane--hidden')).toHaveLength(0)
    expect(toggle.attributes('style') ?? '').not.toContain('left:')
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
