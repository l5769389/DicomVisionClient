import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MprSegmentationPanel from './MprSegmentationPanel.vue'
import type { MprSegmentationConfig, MprThresholdRegion, MprVoiSphere } from '../../types/viewer'

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
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
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
    expect(status.text()).toBe('Updating')
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

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:threshold'])
    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: 'r1',
        selectedVoi: false,
        selectedVoiId: null
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
      'end'
    ])
  })
})
