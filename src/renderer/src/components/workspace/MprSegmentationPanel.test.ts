import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MprSegmentationPanel from './MprSegmentationPanel.vue'
import type { MprSegmentationConfig, MprThresholdRegion, MprVoiSphere } from '../../types/viewer'
import {
  MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS,
  MPR_SEGMENTATION_MAX_VOI_SPHERES
} from '../../types/viewer'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import {
  MPR_SEGMENTATION_SIDECAR_KIND,
  buildMprSegmentationSidecar
} from '../../composables/workspace/segmentation/mprSegmentationSidecar'

const saveBinaryFileMock = vi.hoisted(() => vi.fn())
const chooseCustomExportDirectoryMock = vi.hoisted(() => vi.fn())
const dispatchWorkspaceStatusToastMock = vi.hoisted(() => vi.fn())
const viewerRuntimeMock = vi.hoisted(() => ({
  platform: 'web' as 'desktop' | 'web'
}))

vi.mock('../../platform/exporting', () => ({
  chooseCustomExportDirectory: chooseCustomExportDirectoryMock,
  saveBinaryFile: saveBinaryFileMock
}))

vi.mock('../../platform/runtime', () => ({
  viewerRuntime: viewerRuntimeMock
}))

vi.mock('../../composables/workspace/tasks/workspaceStatus', () => ({
  dispatchWorkspaceStatusToast: dispatchWorkspaceStatusToastMock
}))

function createRegion(patch: Partial<MprThresholdRegion> = {}): MprThresholdRegion {
  return {
    id: 'r1',
    enabled: true,
    label: '1',
    thresholdHu: 300,
    thresholdMode: 'hu',
    thresholdPercentile: 80,
    color: '#ff4df8',
    box: {
      centerWorld: [0, 0, 0],
      rowWorld: [0, 1, 0],
      colWorld: [0, 0, 1],
      normalWorld: [1, 0, 0],
      widthMm: 20,
      heightMm: 30,
      depthMm: 10,
      sourceViewport: 'mpr-ax'
    },
    stats: {
      huMean: 120,
      huMin: 80,
      huMax: 300,
      huStdDev: 12,
      volumeCm3: 1.2,
      sampleCount: 42,
      effectiveThresholdHu: 300
    },
    ...patch
  }
}

function createConfig(region: MprThresholdRegion = createRegion()): MprSegmentationConfig {
  return {
    enabled: true,
    clientRevision: 3,
    selectedRegionId: region.id,
    selectedVoi: false,
    selectedVoiId: null,
    thresholdRegions: [region],
    voiSpheres: [],
    voiSphere: null
  }
}

function createVoiSphere(): MprVoiSphere {
  return {
    id: 'v1',
    label: '1',
    enabled: true,
    centerWorld: [0, 0, 0],
    radiusMm: 12,
    color: '#22d3ee',
    stats: null
  }
}

function createSecondVoiSphere(): MprVoiSphere {
  return {
    ...createVoiSphere(),
    id: 'v2',
    label: '2',
    radiusMm: 18
  }
}

function createMixedConfig(): MprSegmentationConfig {
  const region = createRegion()
  const sphere = createVoiSphere()
  return {
    enabled: true,
    clientRevision: 5,
    selectedRegionId: null,
    selectedVoi: true,
    selectedVoiId: sphere.id,
    thresholdRegions: [region],
    voiSpheres: [sphere],
    voiSphere: sphere
  }
}

describe('MprSegmentationPanel', () => {
  beforeEach(() => {
    saveBinaryFileMock.mockReset()
    saveBinaryFileMock.mockResolvedValue({
      directoryPath: 'C:/exports',
      filePath: 'C:/exports/segmentation.dvsseg.json',
      locationDescription: 'C:/exports/segmentation.dvsseg.json',
      mode: 'filesystem'
    })
    chooseCustomExportDirectoryMock.mockReset()
    dispatchWorkspaceStatusToastMock.mockReset()
    viewerRuntimeMock.platform = 'web'
    useUiPreferences().setLocale('zh-CN')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('emits depth move updates immediately and preserves the draft through stale props', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const depthSlider = wrapper.findAll<HTMLInputElement>('input[type="range"]')[1]!
    depthSlider.element.value = '42'
    await depthSlider.trigger('input')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [
          expect.objectContaining({
            box: expect.objectContaining({ depthMm: 42 })
          })
        ]
      }),
      'move'
    ])

    await wrapper.setProps({
      config: createConfig(createRegion({ box: { ...createRegion().box, depthMm: 10 } }))
    })
    expect(wrapper.findAll<HTMLInputElement>('input[type="range"]')[1]!.element.value).toBe('42')

    await wrapper.setProps({
      config: createConfig(createRegion({ box: { ...createRegion().box, depthMm: 12 } }))
    })
    expect(wrapper.findAll<HTMLInputElement>('input[type="range"]')[1]!.element.value).toBe('42')
  })

  it('keeps HU slider input local and sends final HU on change', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const huSlider = wrapper.findAll<HTMLInputElement>('input[type="range"]')[0]!
    huSlider.element.value = '420'
    await huSlider.trigger('input')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [
          expect.objectContaining({
            thresholdHu: 420
          })
        ]
      }),
      'local'
    ])

    huSlider.element.value = '430'
    await huSlider.trigger('change')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [
          expect.objectContaining({
            thresholdHu: 430
          })
        ]
      }),
      'end'
    ])
  })

  it('sends the final depth immediately without a trailing move', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const depthSlider = wrapper.findAll<HTMLInputElement>('input[type="range"]')[1]!
    depthSlider.element.value = '32'
    await depthSlider.trigger('input')
    depthSlider.element.value = '36'
    await depthSlider.trigger('change')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [
          expect.objectContaining({
            box: expect.objectContaining({ depthMm: 36 })
          })
        ]
      }),
      'end'
    ])

    expect(wrapper.emitted('configChange')).toHaveLength(2)
  })

  it('emits percentile mode changes from the compact header toggle', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const percentButton = wrapper.findAll('button').find((button) => button.text() === '%')
    expect(percentButton).toBeTruthy()
    await percentButton!.trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [
          expect.objectContaining({
            thresholdMode: 'percentile'
          })
        ]
      }),
      'end'
    ])
  })

  it('shows processing status inside the panel only', () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig(),
        isProcessing: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const status = wrapper.find('[data-testid="mpr-segmentation-processing"]')
    expect(status.exists()).toBe(true)
    expect(status.text()).toBe('更新中')
  })

  it('renders localized labels and shows the depth unit', async () => {
    const preferences = useUiPreferences()
    const zhWrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(zhWrapper.text()).toContain('阈值分割与球形 VOI')
    expect(zhWrapper.text()).toContain('深度')
    expect(zhWrapper.text()).toContain('mm')

    preferences.setLocale('en-US')
    await zhWrapper.vm.$nextTick()

    expect(zhWrapper.text()).toContain('Threshold regions and spherical VOI')
    expect(zhWrapper.text()).toContain('Depth')
  })

  it('renders as an embedded dock panel without floating drag or close affordances', () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig(),
        embedded: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(wrapper.classes()).toContain('mpr-segmentation-panel--embedded')
    expect(wrapper.classes()).not.toContain('mpr-segmentation-panel--floating')
    expect(wrapper.classes()).not.toContain('fixed')
    expect(wrapper.attributes('style') ?? '').not.toContain('left:')
    expect(wrapper.attributes('style') ?? '').not.toContain('top:')
    expect(wrapper.find('[data-testid="mpr-segmentation-panel-drag-handle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mpr-segmentation-close"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mpr-segmentation-import"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mpr-segmentation-export"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mpr-segmentation-record-list"]').classes()).toContain('max-h-none')
  })

  it('renders embedded threshold and VOI mode tabs and switches the visible mode', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig(),
        embedded: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(wrapper.find('[data-testid="mpr-segmentation-mode-tabs"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mpr-segmentation-mode-threshold"]').text()).toContain('阈值分割')
    expect(wrapper.find('[data-testid="mpr-segmentation-mode-voi"]').text()).toContain('VOI')
    expect(wrapper.find('[data-testid="mpr-threshold-select-r1"]').isVisible()).toBe(true)

    await wrapper.find('[data-testid="mpr-segmentation-mode-voi"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:voi'])
    expect(wrapper.find('[data-testid="mpr-threshold-select-r1"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('在 VOI 模式中绘制圆形区域')
  })

  it('uses theme-safe footer actions without hard-coded rose text classes', () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig(createRegion()),
        embedded: true,
        mobile: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(wrapper.classes()).toContain('mpr-segmentation-panel--mobile')
    const clearCurrent = wrapper.get('[data-testid="mpr-segmentation-clear-current"]')
    const clearAll = wrapper.get('[data-testid="mpr-segmentation-clear-all"]')

    expect(wrapper.find('[data-testid="mpr-segmentation-footer"]').exists()).toBe(true)
    expect(clearCurrent.classes()).toContain('mpr-segmentation-panel__clear-button')
    expect(clearAll.classes()).toContain('mpr-segmentation-panel__clear-button--danger')
    expect(clearAll.attributes('class')).not.toContain('text-rose')
    expect(clearAll.attributes('class')).not.toContain('border-white')
    expect(wrapper.get('[data-testid="mpr-segmentation-record-list"]').classes()).toContain('overflow-y-auto')
    expect(wrapper.get('[data-testid="mpr-threshold-metrics-r1"]').classes()).toContain('mpr-segmentation-panel__metrics')
    expect(wrapper.get('[data-testid="mpr-threshold-metrics-r1"]').find('.mpr-segmentation-panel__metric-label').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mpr-threshold-metrics-r1"]').find('.mpr-segmentation-panel__metric-value').exists()).toBe(true)
  })

  it('clears only the active mobile segmentation mode and keeps the other mode intact', async () => {
    const region = createRegion()
    const sphere = createVoiSphere()
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createConfig(region),
          voiSpheres: [sphere],
          voiSphere: sphere
        },
        embedded: true,
        mobile: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.get('[data-testid="mpr-segmentation-clear-current"]').trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [],
        voiSpheres: [expect.objectContaining({ id: 'v1' })]
      }),
      'end'
    ])

    await wrapper.setProps({
      config: {
        ...createMixedConfig(),
        thresholdRegions: [region],
        voiSpheres: [sphere],
        voiSphere: sphere
      }
    })
    await wrapper.get('[data-testid="mpr-segmentation-mode-voi"]').trigger('click')
    await wrapper.get('[data-testid="mpr-segmentation-clear-current"]').trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [expect.objectContaining({ id: 'r1' })],
        selectedVoi: false,
        selectedVoiId: null,
        voiSpheres: [],
        voiSphere: null
      }),
      'end'
    ])
  })

  it('clears threshold and VOI items together from mobile all clear', async () => {
    const region = createRegion()
    const sphere = createVoiSphere()
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createMixedConfig(),
          thresholdRegions: [region],
          voiSpheres: [sphere],
          voiSphere: sphere
        },
        embedded: true,
        mobile: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.get('[data-testid="mpr-segmentation-clear-all"]').trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [],
        voiSpheres: []
      }),
      'end'
    ])
  })

  it('keeps embedded threshold metrics structurally stable while stats are loading and ready', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig(createRegion({ stats: null })),
        embedded: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const loadingMetrics = wrapper.find('[data-testid="mpr-threshold-metrics-r1"]')
    expect(loadingMetrics.exists()).toBe(true)
    expect(loadingMetrics.findAll('.rounded-lg')).toHaveLength(7)
    expect(loadingMetrics.text()).toContain('--')
    expect(wrapper.find('[data-testid="mpr-threshold-summary-r1"]').text()).toContain('HU > 300')
    expect(wrapper.find('[data-testid="mpr-threshold-summary-r1"]').classes().join(' ')).not.toContain('truncate')

    await wrapper.setProps({
      config: createConfig()
    })

    const readyMetrics = wrapper.find('[data-testid="mpr-threshold-metrics-r1"]')
    expect(readyMetrics.findAll('.rounded-lg')).toHaveLength(7)
    expect(readyMetrics.text()).toContain('120.00')
    expect(readyMetrics.text()).toContain('1.20 cm3')
  })

  it('shows embedded VOI metrics in the VOI tab without rendering threshold controls', () => {
    const sphere = {
      ...createVoiSphere(),
      stats: {
        huMean: 10,
        huMin: 1,
        huMax: 30,
        huStdDev: 3,
        volumeCm3: 2,
        sampleCount: 9
      }
    }
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createMixedConfig(),
          thresholdRegions: [createRegion()],
          voiSpheres: [sphere],
          voiSphere: sphere
        },
        embedded: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(wrapper.find('[data-testid="mpr-segmentation-mode-voi"]').classes()).toContain('bg-[var(--theme-accent)]')
    expect(wrapper.find('[data-testid="mpr-threshold-select-r1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mpr-voi-select-v1"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-testid="mpr-voi-metrics-v1"]').findAll('.rounded-lg')).toHaveLength(6)
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(0)
  })

  it('updates threshold and VOI display attributes without clearing stats or recomputing', async () => {
    const regionStats = createRegion().stats
    const sphereStats = {
      huMean: 10,
      huMin: 1,
      huMax: 30,
      huStdDev: 3,
      volumeCm3: 2,
      sampleCount: 9
    }
    const sphere = createVoiSphere()
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createMixedConfig(),
          thresholdRegions: [createRegion({ stats: regionStats })],
          voiSpheres: [{ ...sphere, stats: sphereStats }],
          voiSphere: { ...sphere, stats: sphereStats }
        }
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const regionColor = wrapper.find<HTMLInputElement>('[data-testid="mpr-threshold-color-r1"]')
    regionColor.element.value = '#00ff00'
    await regionColor.trigger('input')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1',
        thresholdRegions: [
          expect.objectContaining({
            color: '#00ff00',
            stats: regionStats
          })
        ]
      }),
      'style'
    ])

    const regionLabel = wrapper.find<HTMLInputElement>('[data-testid="mpr-threshold-label-r1"]')
    regionLabel.element.value = 'liver threshold'
    await regionLabel.trigger('input')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1',
        thresholdRegions: [
          expect.objectContaining({
            label: 'liver threshold',
            stats: regionStats
          })
        ]
      }),
      'style'
    ])

    const voiColor = wrapper.find<HTMLInputElement>('[data-testid="mpr-voi-color-v1"]')
    voiColor.element.value = '#ffcc00'
    await voiColor.trigger('input')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1',
        voiSpheres: [
          expect.objectContaining({
            color: '#ffcc00',
            stats: sphereStats
          })
        ]
      }),
      'style'
    ])

    const voiLabel = wrapper.find<HTMLInputElement>('[data-testid="mpr-voi-label-v1"]')
    voiLabel.element.value = 'target voi'
    await voiLabel.trigger('input')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1',
        voiSpheres: [
          expect.objectContaining({
            label: 'target voi',
            stats: sphereStats
          })
        ]
      }),
      'style'
    ])
  })

  it('updates a non-active VOI display attribute without changing the selected threshold', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createMixedConfig(),
          selectedRegionId: 'r1',
          selectedVoi: false,
          selectedVoiId: null
        }
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const voiLabel = wrapper.find<HTMLInputElement>('[data-testid="mpr-voi-label-v1"]')
    voiLabel.element.value = 'background voi'
    await voiLabel.trigger('input')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: 'r1',
        selectedVoi: false,
        selectedVoiId: null,
        voiSpheres: [
          expect.objectContaining({
            label: 'background voi'
          })
        ]
      }),
      'style'
    ])
  })

  it('drags the panel by the header handle', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    Object.defineProperty(wrapper.element, 'offsetWidth', { value: 320, configurable: true })
    Object.defineProperty(wrapper.element, 'offsetHeight', { value: 240, configurable: true })
    vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({
      bottom: 320,
      height: 240,
      left: 500,
      right: 820,
      top: 80,
      width: 320,
      x: 500,
      y: 80,
      toJSON: () => ({})
    } as DOMRect)

    const handle = wrapper.find('[data-testid="mpr-segmentation-panel-drag-handle"]')
    const down = new Event('pointerdown', { bubbles: true, cancelable: true }) as PointerEvent
    Object.defineProperties(down, {
      button: { value: 0 },
      clientX: { value: 510 },
      clientY: { value: 90 },
      pointerId: { value: 7 }
    })
    handle.element.dispatchEvent(down)
    await wrapper.vm.$nextTick()

    const move = new Event('pointermove') as PointerEvent
    Object.defineProperties(move, {
      clientX: { value: 410 },
      clientY: { value: 130 },
      pointerId: { value: 7 }
    })
    window.dispatchEvent(move)
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('style')).toContain('left: 400px')
    expect(wrapper.attributes('style')).toContain('top: 120px')
  })

  it('selects a threshold region from the panel and clears VOI selection', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const selectButton = wrapper.find('[data-testid="mpr-threshold-select-r1"]')
    expect(selectButton.exists()).toBe(true)
    await selectButton.trigger('click')

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:threshold', 'mpr-ax'])
    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: 'r1',
        selectedVoi: false,
        selectedVoiId: null
      }),
      'select'
    ])
  })

  it('keeps the current VOI active when deleting an unselected threshold region', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-threshold-delete-r1"]').trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1',
        thresholdRegions: []
      }),
      'end'
    ])
  })

  it('selects the next VOI when deleting the active VOI', async () => {
    const sphere = createVoiSphere()
    const secondSphere = createSecondVoiSphere()
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createMixedConfig(),
          selectedVoi: true,
          selectedVoiId: sphere.id,
          voiSpheres: [sphere, secondSphere],
          voiSphere: sphere
        }
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-voi-delete-v1"]').trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v2',
        voiSpheres: [secondSphere],
        voiSphere: secondSphere
      }),
      'end'
    ])
  })

  it('does not expand threshold controls while a VOI is selected', () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(wrapper.findAll('input[type="range"]')).toHaveLength(0)
  })

  it('selects a VOI from the panel and requests VOI mode', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createMixedConfig(),
          selectedVoi: false,
          selectedVoiId: null
        }
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-voi-select-v1"]').trigger('click')

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:voi'])
    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1'
      }),
      'select'
    ])
  })

  it('does not let a selection draft hide later VOI updates from props', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-threshold-select-r1"]').trigger('click')
    expect(wrapper.emitted('configChange')?.at(-1)?.[1]).toBe('select')

    const sphere = createVoiSphere()
    const secondSphere = createSecondVoiSphere()
    await wrapper.setProps({
      config: {
        ...createMixedConfig(),
        selectedRegionId: 'r1',
        selectedVoi: false,
        selectedVoiId: null,
        voiSpheres: [sphere, secondSphere],
        voiSphere: sphere
      }
    })

    expect(wrapper.find('[data-testid="mpr-voi-select-v2"]').exists()).toBe(true)
  })

  it('renders import/export controls and selects all segmentation items in the export dialog by default', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(wrapper.find('[data-testid="mpr-segmentation-import"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mpr-segmentation-export"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mpr-threshold-export-r1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mpr-voi-export-v1"]').exists()).toBe(false)

    await wrapper.find('[data-testid="mpr-segmentation-export"]').trigger('click')
    await flushPromises()

    expect(document.body.querySelector<HTMLInputElement>('[data-testid="mpr-export-dialog-threshold-r1"]')?.checked).toBe(true)
    expect(document.body.querySelector<HTMLInputElement>('[data-testid="mpr-export-dialog-voi-v1"]')?.checked).toBe(true)
  })

  it('uses a description placeholder for empty segmentation labels', () => {
    const voi = { ...createVoiSphere(), label: '' }
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createMixedConfig(),
          thresholdRegions: [createRegion({ label: '' })],
          voiSpheres: [voi],
          voiSphere: voi
        }
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(wrapper.find<HTMLInputElement>('[data-testid="mpr-threshold-label-r1"]').element.placeholder).toBe('描述信息')
    expect(wrapper.find<HTMLInputElement>('[data-testid="mpr-threshold-label-r1"]').element.value).toBe('')
    expect(wrapper.find<HTMLInputElement>('[data-testid="mpr-voi-label-v1"]').element.placeholder).toBe('描述信息')
    expect(wrapper.find<HTMLInputElement>('[data-testid="mpr-voi-label-v1"]').element.value).toBe('')
  })

  it('keeps segmentation records inside a scrolling list area', () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const list = wrapper.find('[data-testid="mpr-segmentation-record-list"]')
    expect(list.exists()).toBe(true)
    expect(list.classes()).toContain('overflow-y-auto')
    expect(list.attributes('class')).toContain('max-h-')
  })

  it('exports only selected items and omits stats from the sidecar', async () => {
    const voi = {
      ...createVoiSphere(),
      stats: {
        huMean: 10,
        huMin: 5,
        huMax: 20,
        huStdDev: 3,
        volumeCm3: 4.5,
        sampleCount: 8
      }
    }
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: {
          ...createMixedConfig(),
          voiSpheres: [voi],
          voiSphere: voi
        },
        seriesId: 'series-a',
        seriesLabel: 'Chest CT'
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-segmentation-export"]').trigger('click')
    await flushPromises()

    const dialog = document.body.querySelector('[data-testid="mpr-segmentation-export-confirm-dialog"]')
    expect(dialog?.textContent).toContain('2 / 2')
    expect(dialog?.textContent).not.toContain('将使用当前平台的默认下载或导出流程。')
    expect(document.body.querySelector('[data-testid="mpr-export-dialog-threshold-metrics-r1"]')?.textContent).toContain('mean 120.00')
    expect(document.body.querySelector('[data-testid="mpr-export-dialog-voi-metrics-v1"]')?.textContent).toContain('mean 10.00')
    const thresholdLabel = document.body.querySelector<HTMLInputElement>('[data-testid="mpr-export-dialog-threshold-label-r1"]')
    thresholdLabel!.value = 'Export threshold'
    thresholdLabel!.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    const voiExport = document.body.querySelector<HTMLInputElement>('[data-testid="mpr-export-dialog-voi-v1"]')
    expect(voiExport?.checked).toBe(true)
    voiExport!.checked = false
    voiExport!.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(dialog?.textContent).toContain('1 / 2')
    const fileNameInput = document.body.querySelector<HTMLInputElement>('[data-testid="mpr-segmentation-export-file-name-stem-input"]')
    expect(fileNameInput?.value).toMatch(/^dicomvision-mpr-segmentation-\d{8}-\d{6}$/)
    expect(fileNameInput?.value).not.toContain('.dvsseg.json')
    expect(document.body.querySelector('[data-testid="mpr-segmentation-export-file-name-suffix"]')?.textContent).toContain('.dvsseg.json')
    fileNameInput!.value = 'custom-segmentation'
    fileNameInput!.dispatchEvent(new Event('input', { bubbles: true }))
    expect(saveBinaryFileMock).not.toHaveBeenCalled()
    document.body.querySelector<HTMLButtonElement>('[data-testid="mpr-segmentation-export-confirm-submit"]')?.click()
    await flushPromises()

    expect(saveBinaryFileMock).toHaveBeenCalledTimes(1)
    const payload = saveBinaryFileMock.mock.calls[0]?.[0]
    const sidecar = JSON.parse(new TextDecoder().decode(payload.data))
    expect(payload.fileName).toBe('custom-segmentation.dvsseg.json')
    expect(payload.mimeType).toBe('application/json')
    expect(sidecar.kind).toBe(MPR_SEGMENTATION_SIDECAR_KIND)
    expect(sidecar.source).toEqual({
      seriesId: 'series-a',
      seriesLabel: 'Chest CT',
      viewType: 'MPR'
    })
    expect(sidecar.items.thresholdRegions.map((region: MprThresholdRegion) => region.id)).toEqual(['r1'])
    expect(sidecar.items.thresholdRegions[0].label).toBe('Export threshold')
    expect(sidecar.items.voiSpheres).toEqual([])
    expect(sidecar.items.thresholdRegions[0]).not.toHaveProperty('stats')
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith('分割文件已导出', 'success', expect.objectContaining({
      filePath: 'C:/exports/segmentation.dvsseg.json'
    }))
  })

  it('falls back to the generated stem when the export name is empty', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-segmentation-export"]').trigger('click')
    await flushPromises()

    const fileNameInput = document.body.querySelector<HTMLInputElement>('[data-testid="mpr-segmentation-export-file-name-stem-input"]')
    fileNameInput!.value = '   '
    fileNameInput!.dispatchEvent(new Event('input', { bubbles: true }))
    document.body.querySelector<HTMLButtonElement>('[data-testid="mpr-segmentation-export-confirm-submit"]')?.click()
    await flushPromises()

    expect(saveBinaryFileMock.mock.calls[0]?.[0].fileName).toMatch(/^dicomvision-mpr-segmentation-\d{8}-\d{6}\.dvsseg\.json$/)
  })

  it('disables export confirmation when no dialog items are selected', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-segmentation-export"]').trigger('click')
    await flushPromises()

    const thresholdExport = document.body.querySelector<HTMLInputElement>('[data-testid="mpr-export-dialog-threshold-r1"]')
    const voiExport = document.body.querySelector<HTMLInputElement>('[data-testid="mpr-export-dialog-voi-v1"]')
    thresholdExport!.checked = false
    thresholdExport!.dispatchEvent(new Event('change', { bubbles: true }))
    voiExport!.checked = false
    voiExport!.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()

    const submit = document.body.querySelector<HTMLButtonElement>('[data-testid="mpr-segmentation-export-confirm-submit"]')
    expect(document.body.querySelector('[data-testid="mpr-segmentation-export-confirm-dialog"]')).not.toBeNull()
    expect(submit?.disabled).toBe(true)
    expect(saveBinaryFileMock).not.toHaveBeenCalled()
  })

  it('edits the desktop export path before confirming', async () => {
    viewerRuntimeMock.platform = 'desktop'
    chooseCustomExportDirectoryMock.mockResolvedValue({ desktopDirectory: 'E:/chosen' })
    Object.defineProperty(window, 'viewerApi', {
      configurable: true,
      value: {
        getDefaultExportDirectory: vi.fn().mockResolvedValue('D:/exports')
      }
    })
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-segmentation-export"]').trigger('click')
    await flushPromises()

    const dialog = document.body.querySelector('[data-testid="mpr-segmentation-export-confirm-dialog"]')
    expect(dialog?.textContent).toContain('保存位置')
    expect(dialog?.textContent).toContain('文件名')
    const directoryInput = document.body.querySelector<HTMLInputElement>('[data-testid="mpr-segmentation-export-directory-input"]')
    expect(directoryInput?.value).toBe('D:/exports')
    directoryInput!.value = 'E:/manual'
    directoryInput!.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(directoryInput?.value).toBe('E:/manual')
    document.body.querySelector<HTMLButtonElement>('[data-testid="mpr-segmentation-export-directory-choose"]')?.click()
    await flushPromises()
    expect(directoryInput?.value).toBe('E:/chosen')
    expect(saveBinaryFileMock).not.toHaveBeenCalled()
    document.body.querySelector<HTMLButtonElement>('[data-testid="mpr-segmentation-export-confirm-submit"]')?.click()
    await flushPromises()

    const payload = saveBinaryFileMock.mock.calls[0]?.[0]
    expect(payload.preference).toEqual(expect.objectContaining({
      desktopDirectory: 'E:/chosen',
      locationMode: 'custom'
    }))
  })

  it('does not export when the confirmation dialog is cancelled', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-segmentation-export"]').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('[data-testid="mpr-segmentation-export-confirm-dialog"]')?.textContent).toContain('2 / 2')
    document.body.querySelector<HTMLButtonElement>('[data-testid="mpr-segmentation-export-confirm-cancel"]')?.click()
    await flushPromises()

    expect(document.body.querySelector('[data-testid="mpr-segmentation-export-confirm-dialog"]')).toBeNull()
    expect(saveBinaryFileMock).not.toHaveBeenCalled()
  })

  it('imports a valid sidecar by merging items and clearing imported stats', async () => {
    const sidecar = buildMprSegmentationSidecar({
      config: {
        ...createMixedConfig(),
        thresholdRegions: [createRegion({ id: 'r1', label: 'Imported threshold' })],
        voiSpheres: [createVoiSphere()]
      }
    })
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })
    const input = wrapper.find<HTMLInputElement>('[data-testid="mpr-segmentation-import-input"]')
    const file = new File([JSON.stringify(sidecar)], 'segmentation.dvsseg.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file]
    })

    await input.trigger('change')

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:threshold', 'mpr-ax'])
    const emitted = wrapper.emitted('configChange')?.at(-1)
    expect(emitted?.[1]).toBe('end')
    const config = emitted?.[0] as MprSegmentationConfig
    expect(config.enabled).toBe(true)
    expect(config.clientRevision).toBe(6)
    expect(config.selectedRegionId).toBe('r1-2')
    expect(config.thresholdRegions.map((region) => region.id)).toEqual(['r1', 'r1-2'])
    expect(config.voiSpheres.map((sphere) => sphere.id)).toEqual(['v1', 'v1-2'])
    expect(config.thresholdRegions[1]?.stats).toBeNull()
    expect(config.voiSpheres[1]?.stats).toBeNull()
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith('已导入分割项: 2', 'success')
  })

  it('limits imported sidecar items to the remaining threshold and VOI capacity', async () => {
    const existingRegions = Array.from({ length: MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS - 1 }, (_, index) =>
      createRegion({ id: `r${index + 1}`, label: `${index + 1}` })
    )
    const existingSpheres = Array.from({ length: MPR_SEGMENTATION_MAX_VOI_SPHERES }, (_, index) => ({
      ...createVoiSphere(),
      id: `v${index + 1}`,
      label: `${index + 1}`
    }))
    const currentConfig: MprSegmentationConfig = {
      enabled: true,
      clientRevision: 9,
      selectedRegionId: existingRegions[0]?.id ?? null,
      selectedVoi: false,
      selectedVoiId: null,
      thresholdRegions: existingRegions,
      voiSpheres: existingSpheres,
      voiSphere: existingSpheres[0] ?? null
    }
    const sidecar = buildMprSegmentationSidecar({
      config: {
        ...createMixedConfig(),
        thresholdRegions: [
          createRegion({ id: 'imported-r1' }),
          createRegion({ id: 'imported-r2' }),
          createRegion({ id: 'imported-r3' })
        ],
        voiSpheres: [
          { ...createVoiSphere(), id: 'imported-v1' },
          { ...createVoiSphere(), id: 'imported-v2' }
        ]
      }
    })
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: currentConfig
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })
    const input = wrapper.find<HTMLInputElement>('[data-testid="mpr-segmentation-import-input"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([JSON.stringify(sidecar)], 'segmentation.dvsseg.json', { type: 'application/json' })]
    })

    await input.trigger('change')

    const emitted = wrapper.emitted('configChange')?.at(-1)
    const config = emitted?.[0] as MprSegmentationConfig
    expect(config.thresholdRegions).toHaveLength(MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS)
    expect(config.voiSpheres).toHaveLength(MPR_SEGMENTATION_MAX_VOI_SPHERES)
    expect(config.thresholdRegions.at(-1)?.id).toBe('imported-r1')
    expect(config.voiSpheres.some((sphere) => sphere.id.startsWith('imported-v'))).toBe(false)
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith(expect.stringContaining('4'), 'warning', { durationMs: 6000 })
  })

  it('shows an error and does not update config for an invalid import file', async () => {
    const wrapper = mount(MprSegmentationPanel, {
      props: {
        config: createMixedConfig()
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })
    const input = wrapper.find<HTMLInputElement>('[data-testid="mpr-segmentation-import-input"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['{'], 'broken.json', { type: 'application/json' })]
    })

    await input.trigger('change')

    expect(wrapper.emitted('configChange')).toBeUndefined()
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith('Segmentation file is not valid JSON.', 'error', { durationMs: 6000 })
  })
})
