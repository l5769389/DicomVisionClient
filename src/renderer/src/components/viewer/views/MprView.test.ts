import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MprView from './MprView.vue'
import type { MprViewportKey, ViewerTabItem } from '../../../types/viewer'

const emptyCornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

const emptyOrientation = {
  top: null,
  right: null,
  bottom: null,
  left: null,
  volumeQuaternion: null
}

function createMprTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'series-1::mpr',
    seriesId: 'series-1',
    seriesTitle: 'Series 1',
    title: 'Series 1 / MPR',
    viewType: 'MPR',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    viewportImages: {
      'mpr-ax': 'axial.png',
      'mpr-cor': 'coronal.png',
      'mpr-sag': 'sagittal.png'
    },
    cornerInfo: emptyCornerInfo,
    orientation: emptyOrientation,
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false
    },
    pseudocolorPreset: 'bw',
    ...overrides
  }
}

const globalStubs = {
  ViewerCanvasStage: {
    name: 'ViewerCanvasStage',
    props: ['viewportKey', 'viewportClass', 'isActive'],
    emits: ['clickViewport', 'doubleClickViewport'],
    template: `
      <button
        class="viewer-stage-stub"
        type="button"
        :data-viewport-key="viewportKey"
        :data-viewport-class="viewportClass"
        :data-active="isActive ? 'true' : 'false'"
        @click="$emit('clickViewport', viewportKey)"
        @dblclick="$emit('doubleClickViewport', viewportKey)"
      >
        {{ viewportKey }}
      </button>
    `
  }
}

function createMprProps(overrides: Partial<InstanceType<typeof MprView>['$props']> = {}) {
  return {
    activeTab: createMprTab(),
    activeOperation: 'stack:pan',
    activeViewportKey: 'mpr-ax',
    getAnnotations: () => [],
    getCursorClass: () => '',
    getDraftAnnotation: () => null,
    getDraftMeasurementMode: () => null,
    getDraftMeasurement: () => null,
    getMeasurements: () => [],
    getMtfDraftMode: () => null,
    getMtfDraft: () => null,
    getMtfItems: () => [],
    selectedMtfId: null,
    getCornerInfo: (_viewportKey: MprViewportKey) => emptyCornerInfo,
    ...overrides
  }
}

describe('MprView', () => {
  it('renders the default three viewport layout', () => {
    const wrapper = mount(MprView, {
      props: createMprProps(),
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.findAll('.viewer-stage-stub')).toHaveLength(3)
    expect(wrapper.findAll('.viewer-stage-stub').map((stage) => stage.attributes('data-viewport-key'))).toEqual([
      'mpr-ax',
      'mpr-sag',
      'mpr-cor'
    ])
    wrapper.unmount()
  })

  it('applies the selected MPR viewport layout', () => {
    const wrapper = mount(MprView, {
      props: createMprProps({
        layoutKey: 'three-rows'
      }),
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.findAll('.viewer-stage-stub').map((stage) => stage.attributes('data-viewport-key'))).toEqual([
      'mpr-ax',
      'mpr-cor',
      'mpr-sag'
    ])
    expect(wrapper.findAll('.viewer-stage-stub').map((stage) => stage.attributes('data-viewport-class'))).toEqual([
      'col-start-1 row-start-1',
      'col-start-1 row-start-2',
      'col-start-1 row-start-3'
    ])
    wrapper.unmount()
  })

  it('maximizes a viewport on double click and restores the three viewport layout on the next double click', async () => {
    const wrapper = mount(MprView, {
      props: createMprProps(),
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.findAll('.viewer-stage-stub')[1]!.trigger('dblclick')

    expect(wrapper.findAll('.viewer-stage-stub')).toHaveLength(1)
    expect(wrapper.find('.viewer-stage-stub').attributes('data-viewport-key')).toBe('mpr-sag')
    expect(wrapper.find('.viewer-stage-stub').attributes('data-active')).toBe('true')
    expect(wrapper.emitted('viewportClick')).toEqual([['mpr-sag']])

    await wrapper.find('.viewer-stage-stub').trigger('dblclick')

    expect(wrapper.findAll('.viewer-stage-stub')).toHaveLength(3)
    wrapper.unmount()
  })

  it('does not switch layout while a drawing operation owns double click', async () => {
    const wrapper = mount(MprView, {
      props: createMprProps({
        activeOperation: 'measure:freeform'
      }),
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.findAll('.viewer-stage-stub')[1]!.trigger('dblclick')

    expect(wrapper.findAll('.viewer-stage-stub')).toHaveLength(3)
    expect(wrapper.emitted('viewportClick')).toEqual([['mpr-sag']])
    wrapper.unmount()
  })

  it('resets a maximized viewport when the tab changes', async () => {
    const wrapper = mount(MprView, {
      props: createMprProps(),
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.findAll('.viewer-stage-stub')[2]!.trigger('dblclick')
    expect(wrapper.findAll('.viewer-stage-stub')).toHaveLength(1)

    await wrapper.setProps({
      activeTab: createMprTab({
        key: 'series-2::mpr',
        seriesId: 'series-2'
      })
    })

    expect(wrapper.findAll('.viewer-stage-stub')).toHaveLength(3)
    wrapper.unmount()
  })

  it('restores the three viewport layout when maximization is disabled', async () => {
    const wrapper = mount(MprView, {
      props: createMprProps(),
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.findAll('.viewer-stage-stub')[2]!.trigger('dblclick')
    expect(wrapper.findAll('.viewer-stage-stub')).toHaveLength(1)

    await wrapper.setProps({
      allowViewportMaximize: false
    })

    expect(wrapper.findAll('.viewer-stage-stub')).toHaveLength(3)
    wrapper.unmount()
  })
})
