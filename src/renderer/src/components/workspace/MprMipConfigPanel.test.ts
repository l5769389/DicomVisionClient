import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MprMipConfigPanel from './MprMipConfigPanel.vue'
import { createDefaultMprMipConfig, type MprMipConfig } from '../../types/viewer'

function createEnabledMipConfig(thickness = 12): MprMipConfig {
  const config = createDefaultMprMipConfig()
  return {
    ...config,
    enabled: true,
    viewports: {
      'mpr-ax': { thickness },
      'mpr-cor': { thickness },
      'mpr-sag': { thickness }
    }
  }
}

describe('MprMipConfigPanel', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the local slider draft while stale backend config props arrive', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MprMipConfigPanel, {
      props: {
        config: createEnabledMipConfig(12)
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const slider = wrapper.find<HTMLInputElement>('input[type="range"]')
    expect(slider.attributes('min')).toBe('0')
    expect(slider.attributes('max')).toBe('100')
    await slider.trigger('pointerdown')
    slider.element.value = '24'
    await slider.trigger('input')

    expect(wrapper.emitted('configChange')).toBeUndefined()
    expect(slider.element.value).toBe('24')

    vi.advanceTimersByTime(50)

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        viewports: expect.objectContaining({
          'mpr-ax': { thickness: 24 }
        })
      }),
      'move'
    ])

    await wrapper.setProps({
      config: createEnabledMipConfig(12)
    })

    expect(slider.element.value).toBe('24')

    slider.element.value = '30'
    await slider.trigger('change')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        viewports: expect.objectContaining({
          'mpr-ax': { thickness: 30 }
        })
      }),
      'end'
    ])
  })

  it('starts the next thickness drag from the submitted local value while backend props are stale', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MprMipConfigPanel, {
      props: {
        config: createEnabledMipConfig(12)
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const slider = wrapper.find<HTMLInputElement>('input[type="range"]')
    await slider.trigger('pointerdown')
    slider.element.value = '24'
    await slider.trigger('input')
    slider.element.value = '24'
    await slider.trigger('change')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        viewports: expect.objectContaining({
          'mpr-ax': { thickness: 24 }
        })
      }),
      'end'
    ])

    await wrapper.setProps({
      config: createEnabledMipConfig(12)
    })

    expect(slider.element.value).toBe('24')

    await slider.trigger('pointerdown')
    expect(slider.element.value).toBe('24')

    slider.element.value = '36'
    await slider.trigger('input')
    vi.advanceTimersByTime(50)

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        viewports: expect.objectContaining({
          'mpr-ax': { thickness: 36 }
        })
      }),
      'move'
    ])
  })

  it('resets all viewport thickness values to the default 10mm', async () => {
    const wrapper = mount(MprMipConfigPanel, {
      props: {
        config: createEnabledMipConfig(42)
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    await wrapper.find('[data-testid="mpr-mip-reset"]').trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        viewports: {
          'mpr-ax': { thickness: 10 },
          'mpr-cor': { thickness: 10 },
          'mpr-sag': { thickness: 10 }
        }
      }),
      'end'
    ])
  })

  it('uses a full embedded layout without the compact collapse control', async () => {
    const wrapper = mount(MprMipConfigPanel, {
      props: {
        config: createEnabledMipConfig(42),
        embedded: true
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    expect(wrapper.classes()).toContain('mpr-mip-config-panel--embedded')
    expect(wrapper.findAll('[data-testid="mpr-mip-reset"]')).toHaveLength(1)
    expect(wrapper.findAll('button').some((button) => /Collapse|Expand/.test(button.attributes('title') ?? ''))).toBe(false)

    await wrapper.find('[data-testid="mpr-mip-reset"]').trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        viewports: {
          'mpr-ax': { thickness: 10 },
          'mpr-cor': { thickness: 10 },
          'mpr-sag': { thickness: 10 }
        }
      }),
      'end'
    ])
  })

  it('exposes the enable switch before reset and algorithm radio choices above the sliders', async () => {
    const wrapper = mount(MprMipConfigPanel, {
      props: {
        config: createEnabledMipConfig(10)
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const toggle = wrapper.find('[data-testid="mpr-mip-enable-toggle"]')
    const reset = wrapper.find('[data-testid="mpr-mip-reset"]')
    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]')
    const sliders = wrapper.findAll<HTMLInputElement>('input[type="range"]')

    expect(toggle.exists()).toBe(true)
    expect(reset.exists()).toBe(true)
    expect(toggle.classes()).not.toContain('border')
    expect(toggle.element.compareDocumentPosition(reset.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(radios).toHaveLength(4)
    expect(sliders).toHaveLength(3)
    expect(wrapper.text()).toContain('MaxIP')
    expect(wrapper.text()).toContain('MinIP')
    expect(wrapper.text()).toContain('Average')
    expect(wrapper.text()).toContain('Sum')
    expect(wrapper.text()).not.toContain('算法')
    expect(radios[0]!.element.compareDocumentPosition(sliders[0]!.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await toggle.trigger('click')

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        enabled: false
      }),
      'end'
    ])
  })

  it('hides the MIP text from the switch in collapsed mode', async () => {
    const wrapper = mount(MprMipConfigPanel, {
      props: {
        config: createEnabledMipConfig(10)
      },
      global: {
        stubs: {
          AppIcon: true
        }
      }
    })

    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1]!.trigger('click')

    expect(wrapper.find('[data-testid="mpr-mip-enable-toggle"]').text()).toBe('')
  })
})
