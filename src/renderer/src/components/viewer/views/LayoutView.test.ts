import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { CornerInfo, ViewerLayoutSlot, ViewerTabItem } from '../../../types/viewer'
import LayoutView from './LayoutView.vue'

vi.mock('./ViewerCanvasStage.vue', () => ({
  default: {
    name: 'ViewerCanvasStage',
    props: ['viewportKey', 'pseudocolorPreset', 'pseudocolorWindowInfo', 'showCornerInfo', 'showPseudocolorBar', 'showScaleBar', 'showVolumeOrientationCube', 'hideDraftHandles', 'softImage', 'isLoading', 'isActive', 'cornerInfo'],
    emits: ['doubleClickViewport', 'volumeOrientationSelect'],
    template:
      '<div class="viewer-canvas-stage-stub" :data-viewport-key="viewportKey" :data-pseudocolor-preset="pseudocolorPreset ?? \'\'" :data-pseudocolor-ww="pseudocolorWindowInfo?.ww ?? \'\'" :data-show-corner-info="showCornerInfo ? \'true\' : \'false\'" :data-show-pseudocolor-bar="showPseudocolorBar ? \'true\' : \'false\'" :data-show-scale-bar="showScaleBar ? \'true\' : \'false\'" :data-show-volume-cube="showVolumeOrientationCube ? \'true\' : \'false\'" :data-hide-draft-handles="hideDraftHandles ? \'true\' : \'false\'" :data-soft-image="softImage ? \'true\' : \'false\'" :data-loading="isLoading ? \'true\' : \'false\'" :data-active="isActive ? \'true\' : \'false\'" :data-corner-top-left="cornerInfo?.topLeft?.join(\'|\') ?? \'\'" @click="$emit(\'volumeOrientationSelect\', \'R\')" @dblclick="$emit(\'doubleClickViewport\', viewportKey)"></div>'
  }
}))

const emptyCornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

function createLayoutSlot(id: string, column: number): ViewerLayoutSlot {
  return {
    id,
    row: 0,
    column,
    rowSpan: 1,
    columnSpan: 1,
    viewType: 'Stack',
    viewId: `${id}-view`,
    imageSrc: `blob:${id}`,
    cornerInfo: emptyCornerInfo,
    sliceLabel: '1 / 10',
    currentWindowInfo: {
      ww: 350,
      wl: 40
    },
    pseudocolorPreset: 'rainbow',
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false
    }
  }
}

function createLayoutTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  const slots = [createLayoutSlot('slot-1-1', 0), createLayoutSlot('slot-1-2', 1)]
  return {
    key: 'layout-tab',
    seriesId: 'series-1',
    seriesTitle: 'Layout',
    title: 'Layout',
    viewType: 'Layout',
    viewId: '',
    layoutTemplate: {
      key: '1x2',
      label: '1 x 2',
      rows: 1,
      columns: 2,
      slots,
      source: 'preset'
    },
    layoutSlots: slots,
    cornerInfo: emptyCornerInfo,
    orientation: {
      top: 'A',
      right: 'L',
      bottom: 'P',
      left: 'R',
      volumeQuaternion: null
    },
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false
    },
    ...overrides
  } as ViewerTabItem
}

function mountLayoutView(activeTab: ViewerTabItem) {
  return mount(LayoutView, {
    props: {
      activeOperation: 'stack:window',
      activeTab,
      activeViewportKey: 'slot-1-1',
      getAnnotations: () => [],
      getCursorClass: () => '',
      getDraftAnnotation: () => null,
      getDraftMeasurementMode: () => null,
      getDraftMeasurement: () => null,
      getMeasurements: () => []
    }
  })
}

describe('LayoutView viewport display controls', () => {
  it('passes corner info and scale bar visibility to layout stages', () => {
    const wrapper = mountLayoutView(
      createLayoutTab({
        showCornerInfo: false,
        showPseudocolorBar: false,
        showScaleBar: false
      })
    )

    const stage = wrapper.find('.viewer-canvas-stage-stub')
    expect(stage.attributes('data-show-corner-info')).toBe('false')
    expect(stage.attributes('data-show-pseudocolor-bar')).toBe('false')
    expect(stage.attributes('data-show-scale-bar')).toBe('false')
    expect(stage.attributes('data-pseudocolor-preset')).toBe('rainbow')
    expect(stage.attributes('data-pseudocolor-ww')).toBe('350')
    wrapper.unmount()
  })

  it('removes the slice slider column when the slice slider is hidden', () => {
    const wrapper = mountLayoutView(
      createLayoutTab({
        showSliceSlider: false
      })
    )

    expect(wrapper.find('.layout-view__slider').exists()).toBe(false)
    expect(wrapper.find('.layout-view__slot-body--no-slider').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders a live 3D layout slot with the same corner treatment as VolumeView', () => {
    const volumeSlot: ViewerLayoutSlot = {
      ...createLayoutSlot('slot-1-1', 0),
      viewType: '3D',
      sourceViewType: '3D',
      viewportKey: 'volume',
      viewId: 'volume-view',
      imageSrc: 'blob:volume',
      cornerInfo: emptyCornerInfo
    }
    const wrapper = mountLayoutView(
      createLayoutTab({
        layoutTemplate: {
          key: '1x1',
          label: '1 x 1',
          rows: 1,
          columns: 1,
          slots: [volumeSlot],
          source: 'preset'
        },
        layoutSlots: [volumeSlot],
        cornerInfo: {
          ...emptyCornerInfo,
          topLeft: ['Patient Name', 'Series 1']
        }
      })
    )

    const stage = wrapper.get('.viewer-canvas-stage-stub[data-viewport-key="slot-1-1"]')
    expect(stage.attributes('data-soft-image')).toBe('true')
    expect(stage.attributes('data-loading')).toBe('false')
    expect(stage.attributes('data-corner-top-left')).toBe('Patient Name|Series 1')
    expect(stage.attributes('data-show-volume-cube')).toBe('true')
    expect(stage.attributes('data-hide-draft-handles')).toBe('false')
    expect(stage.attributes('data-active')).toBe('true')
    expect(wrapper.find('.layout-view__slider').exists()).toBe(false)
    expect(wrapper.find('.layout-view__slot--active').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits orientation selections with the active 3D slot id', async () => {
    const volumeSlot: ViewerLayoutSlot = {
      ...createLayoutSlot('slot-1-2', 1),
      viewType: '3D',
      sourceViewType: '3D',
      viewId: 'volume-view',
      imageSrc: 'blob:volume'
    }
    const wrapper = mountLayoutView(
      createLayoutTab({
        layoutSlots: [createLayoutSlot('slot-1-1', 0), volumeSlot]
      })
    )

    await wrapper.get('.viewer-canvas-stage-stub[data-viewport-key="slot-1-2"]').trigger('click')
    expect(wrapper.emitted('volumeOrientationSelect')).toEqual([[{ viewportKey: 'slot-1-2', face: 'R' }]])
    wrapper.unmount()
  })

  it('keeps a slot maximized when the tab object refreshes without changing layout identity', async () => {
    const tab = createLayoutTab()
    const wrapper = mountLayoutView(tab)

    await wrapper.find('.viewer-canvas-stage-stub[data-viewport-key="slot-1-1"]').trigger('dblclick')
    expect(wrapper.find('.layout-view__slot--maximized').exists()).toBe(true)

    await wrapper.setProps({
      activeTab: {
        ...tab,
        layoutSlots: tab.layoutSlots?.map((slot) =>
          slot.id === 'slot-1-1'
            ? {
                ...slot,
                cornerInfo: {
                  ...emptyCornerInfo,
                  bottomRight: ['X:1 Y:2']
                }
              }
            : slot
        )
      }
    })

    expect(wrapper.find('.layout-view__slot--maximized').exists()).toBe(true)
    wrapper.unmount()
  })
})
