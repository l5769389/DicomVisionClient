import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FourDView from './FourDView.vue'
import { createDefaultMprMipConfig, type FourDPhaseItem, type MprViewportKey, type ViewerTabItem } from '../../../types/viewer'
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

vi.mock('../../../composables/ui/useUiLocale', async () => {
  const { computed, ref } = await import('vue')
  const { uiMessages } = await import('../../../composables/ui/uiMessages')
  return {
    useUiLocale: () => ({
      locale: ref('en-US'),
      mprProjectionCopy: computed(() => uiMessages['en-US'].mprProjection),
      toolbarCopy: computed(() => uiMessages['en-US'].toolbar),
      viewerCopy: computed(() => uiMessages['en-US'].viewer)
    })
  }
})

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
  VMenu: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: `
      <div class="v-menu-stub">
        <slot name="activator" :props="{}" />
        <slot />
      </div>
    `
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
  it('requests backend playback start when play is toggled on', async () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps()
      },
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.find('button[aria-label="Play 4D playback"]').trigger('click')

    expect(wrapper.emitted('playbackChange')).toEqual([[true]])
    wrapper.unmount()
  })

  it('keeps playback controls locked while phases are preloading', async () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps({
          activeTab: createFourDTab({
            fourDIsPreloading: true
          })
        })
      },
      global: {
        stubs: globalStubs
      }
    })

    const playButton = wrapper.find('button[aria-label="Loading 4D playback"]')
    expect(playButton.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.four-d-state-overlay').exists()).toBe(true)
    await playButton.trigger('click')

    expect(wrapper.emitted('playbackChange')).toBeUndefined()
    expect(wrapper.text()).toContain('Loading 4D phases')
    expect(wrapper.find('.four-d-phase-runtime__dot--loading').exists()).toBe(true)
    expect(wrapper.find('.four-d-phase-runtime__count').text()).toBe('03/03')
    expect(wrapper.find('.four-d-phase-runtime').attributes('aria-label')).toContain('Loading 4D phases')
    wrapper.unmount()
  })

  it('requests backend playback stop when play is toggled off', async () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps({
          activeTab: createFourDTab({
            fourDIsPlaying: true
          })
        })
      },
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.find('button[aria-label="Pause 4D playback"]').trigger('click')

    expect(wrapper.emitted('playbackChange')).toEqual([[false]])
    wrapper.unmount()
  })

  it('shows playback state in the phase footer without covering the viewport', () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps({
          activeTab: createFourDTab({
            fourDIsPlaying: true,
            fourDPhaseIndex: 1,
            fourDPlaybackFps: 5
          })
        })
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.find('.four-d-state-overlay').exists()).toBe(false)
    expect(wrapper.find('.four-d-phase-runtime__dot--playing').exists()).toBe(true)
    expect(wrapper.find('.four-d-phase-runtime__count').text()).toBe('03/03')
    expect(wrapper.find('.four-d-phase-runtime').attributes('aria-label')).toContain('Playing 5 FPS')
    expect(wrapper.text()).not.toContain('02 / 03')
    wrapper.unmount()
  })

  it('emits phase change when a phase selector is clicked', async () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps()
      },
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.findAll('.four-d-phase-button')[1]!.trigger('click')

    expect(wrapper.emitted('phaseChange')).toEqual([[1]])
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

  it('places 4D status controls below the right dock toolbar', async () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps({
          toolbarPlacement: 'right',
          activeMprMipConfig: createDefaultMprMipConfig(),
          isMprMipPanelOpen: true,
          isToolSelected: (tool: StackTool) => tool.key === 'pan'
        })
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.find('.viewer-toolbar-stub').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__status .four-d-phase-runtime').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__status .four-d-tab-strip-toggle-button').exists()).toBe(false)
    const dockChildren = wrapper.find('.viewer-toolbar-dock__body').element.children
    expect(dockChildren[0]?.classList.contains('viewer-toolbar-dock__tools-region')).toBe(true)
    expect(dockChildren[1]?.classList.contains('viewer-toolbar-dock__status')).toBe(true)
    expect(dockChildren[2]?.classList.contains('viewer-toolbar-dock__panel')).toBe(true)
    expect(dockChildren[3]?.classList.contains('viewer-toolbar-dock__footer')).toBe(true)
    const dockButtons = wrapper.findAll('.viewer-toolbar-dock__button')
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(dockButtons[1]!.classes()).not.toContain('viewer-toolbar-dock__button--active')
    expect(dockButtons[4]!.classes()).toContain('viewer-toolbar-dock__button--active')

    await wrapper.findAll('.viewer-toolbar-dock__status .four-d-phase-button')[1]!.trigger('click')
    expect(wrapper.emitted('phaseChange')).toEqual([[1]])
    wrapper.unmount()
  })

  it('renders result content in the right dock below the 4D status controls', () => {
    const qaTool: StackTool = { key: 'qa', label: 'QA', icon: 'qa', kind: 'mode' }
    const props = createFourDProps({
      toolbarPlacement: 'right',
      activeTools: [qaTool, ...createFourDProps().activeTools],
      resultPanelIcon: 'mtf',
      resultPanelOpen: true,
      resultPanelTitle: 'MTF Curve',
      resultPanelToolKey: 'qa'
    })
    const wrapper = mount(FourDView, {
      props,
      slots: {
        result: '<div data-testid="four-d-result">MTF result</div>'
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.find('.viewer-toolbar-dock__status .four-d-phase-runtime').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('MTF Curve')
    expect(wrapper.find('[data-testid="four-d-result"]').text()).toBe('MTF result')
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[0]!.classes()).toContain('viewer-toolbar-dock__button--active')
    wrapper.unmount()
  })

  it('renders compact frame selectors with not-loaded and loaded phase states', () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps({
          activeTab: createFourDTab({
            fourDPhaseItems: phaseItems.map((phase, index) => ({
              ...phase,
              status: index === 0 ? 'ready' : 'pending'
            }))
          })
        })
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.findAll('.four-d-phase-button')[0]!.text()).toContain('01')
    expect(wrapper.findAll('.four-d-phase-button--unloaded').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.four-d-phase-button--loaded').length).toBeGreaterThan(0)
    expect(wrapper.find('.four-d-phase-legend').exists()).toBe(true)
    expect(wrapper.text()).toContain('Not loaded')
    expect(wrapper.text()).not.toContain('Pending')
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

  it('keeps phase load progress compact while playback is running', () => {
    const wrapper = mount(FourDView, {
      props: {
        ...createFourDProps({
          activeTab: createFourDTab({
            fourDIsPlaying: true,
            fourDPhaseIndex: 1,
            fourDPlaybackFps: 5,
            fourDPhaseItems: phaseItems.map((phase, index) => ({
              ...phase,
              status: index === 0 ? 'ready' : 'pending'
            }))
          })
        })
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.find('.four-d-phase-runtime__count').text()).toBe('01/03')
    expect(wrapper.find('.four-d-phase-runtime').attributes('aria-label')).toContain('1 loaded, 0 loading, 2 not loaded')
    expect(wrapper.text()).not.toContain('Pending')
    wrapper.unmount()
  })
})
