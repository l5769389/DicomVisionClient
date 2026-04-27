import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import FourDView from './FourDView.vue'
import type { FourDPhaseItem, MprViewportKey, ViewerTabItem } from '../../../types/viewer'
import type { StackTool } from '../../workspace/shell/toolbarTypes'

vi.mock('../../workspace/shell/ViewerToolbar.vue', () => ({
  default: {
    name: 'ViewerToolbar',
    props: ['activeTools'],
    emits: ['applyTool', 'selectToolOption', 'setMenuOpen'],
    template: `
      <div class="viewer-toolbar-stub">
        <button
          v-for="tool in activeTools"
          :key="tool.key"
          class="viewer-toolbar-tool"
          type="button"
          @click="$emit('applyTool', tool)"
        >
          {{ tool.label }}
        </button>
      </div>
    `
  }
}))

const phaseItems: FourDPhaseItem[] = [
  {
    phaseIndex: 0,
    label: 'Phase 0%',
    seriesId: 'phase-0',
    imageSrc: 'ax-0',
    viewportImages: {
      'mpr-ax': 'ax-0',
      'mpr-cor': 'cor-0',
      'mpr-sag': 'sag-0'
    },
    status: 'ready'
  },
  {
    phaseIndex: 1,
    label: 'Phase 50%',
    seriesId: 'phase-50',
    imageSrc: 'ax-50',
    viewportImages: {
      'mpr-ax': 'ax-50',
      'mpr-cor': 'cor-50',
      'mpr-sag': 'sag-50'
    },
    status: 'ready'
  },
  {
    phaseIndex: 2,
    label: 'Phase 100%',
    seriesId: 'phase-100',
    imageSrc: 'ax-100',
    viewportImages: {
      'mpr-ax': 'ax-100',
      'mpr-cor': 'cor-100',
      'mpr-sag': 'sag-100'
    },
    status: 'ready'
  }
]

function createFourDTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'series-1::4D',
    seriesId: 'series-1',
    seriesTitle: 'Series 1',
    title: 'Series 1 / 4D',
    viewType: '4D',
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
    orientation: {
      top: null,
      right: null,
      bottom: null,
      left: null,
      volumeQuaternion: null
    },
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false
    },
    pseudocolorPreset: 'bw',
    fourDPhaseIndex: 0,
    fourDPhaseCount: phaseItems.length,
    fourDPhaseItems: phaseItems,
    fourDPlaybackFps: 2,
    ...overrides
  }
}

const globalStubs = {
  AppIcon: {
    template: '<span />'
  },
  ViewerCanvasStage: {
    props: ['viewportKey', 'imageSrc', 'placeholder'],
    template: '<div class="viewer-stage-stub" :data-viewport-key="viewportKey">{{ imageSrc || placeholder }}</div>'
  }
}

function createFourDProps(overrides: Partial<InstanceType<typeof FourDView>['$props']> = {}) {
  const activeTools: StackTool[] = [
    { key: 'crosshair', label: 'Crosshair', icon: 'crosshair', kind: 'mode' },
    { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode' },
    { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode' },
    { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
    { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' },
    { key: 'reset', label: 'Reset', icon: 'reset', kind: 'action' }
  ]

  return {
    activeTab: createFourDTab(),
    activeOperation: 'stack:pan',
    activeViewportKey: 'mpr-ax',
    activeTools,
    areToolbarActionsDisabled: false,
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
    getCornerInfo: (_viewportKey: MprViewportKey) => ({
      topLeft: [],
      topRight: [],
      bottomLeft: [],
      bottomRight: []
    }),
    isToolSelected: () => false,
    menuIconSize: 16,
    openMenuKey: null,
    stackToolSelections: {},
    toolbarIconSize: 20,
    toggleIconSize: 12,
    ...overrides
  }
}

describe('FourDView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('plays respiratory phases at the selected frame rate and loops', async () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps()
      },
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.find('button[aria-label="Play 4D playback"]').trigger('click')

    vi.advanceTimersByTime(500)
    await nextTick()
    vi.advanceTimersByTime(500)
    await nextTick()
    vi.advanceTimersByTime(500)
    await nextTick()

    expect(wrapper.emitted('phaseChange')).toEqual([[1], [2], [0]])
    wrapper.unmount()
  })

  it('emits the current phase again when playback is paused', async () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps()
      },
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.find('button[aria-label="Play 4D playback"]').trigger('click')
    vi.advanceTimersByTime(500)
    await nextTick()
    await wrapper.find('button[aria-label="Pause 4D playback"]').trigger('click')

    expect(wrapper.emitted('phaseChange')).toEqual([[1], [1]])
    wrapper.unmount()
  })

  it('uses the normal MPR toolbar tools inside the compact 4D toolbar', async () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps({
          activeOperation: 'stack:crosshair'
        })
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.text()).toContain('Crosshair')
    expect(wrapper.text()).toContain('Pan')
    expect(wrapper.text()).toContain('Zoom')
    expect(wrapper.text()).toContain('Window')
    expect(wrapper.text()).toContain('MIP')

    await wrapper.findAll('.viewer-toolbar-tool')[1]!.trigger('click')
    expect(wrapper.emitted('applyTool')?.[0]?.[0]).toMatchObject({ key: 'pan' })
    wrapper.unmount()
  })

  it('renders compact frame selectors without phase or cache status text', () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps({
          activeTab: createFourDTab({
            fourDPhaseItems: phaseItems.map((phase) => ({
              ...phase,
              status: 'pending'
            }))
          })
        })
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.findAll('.four-d-phase-button')[0]!.text()).toBe('01')
    expect(wrapper.text()).not.toContain('Preview')
    expect(wrapper.text()).not.toContain('Cached')
    expect(wrapper.text()).not.toContain('Caching')
    expect(wrapper.text()).not.toContain('Phase Control')
    expect(wrapper.text()).not.toContain('4D MPR')
    expect(wrapper.text()).not.toContain('Stack')
    expect(wrapper.text()).not.toContain('MPR')
    expect(wrapper.text()).not.toContain('3D')
    wrapper.unmount()
  })
})
