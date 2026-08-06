import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ViewportPseudocolorBarOverlay from './ViewportPseudocolorBarOverlay.vue'

describe('ViewportPseudocolorBarOverlay', () => {
  it('renders a vertical preset gradient with current window bounds', () => {
    const wrapper = mount(ViewportPseudocolorBarOverlay, {
      props: {
        stageWidth: 400,
        stageHeight: 300,
        pseudocolorPreset: 'bw',
        windowInfo: {
          ww: 350,
          wl: 40
        }
      }
    })

    expect(wrapper.text()).toContain('215')
    expect(wrapper.text()).toContain('-135')
    const barStyle = wrapper.get('.rounded-\\[2px\\]').attributes('style')
    expect(barStyle).toContain('width: 6px')
    expect(barStyle).toContain('height: 138px')
    expect(barStyle).toContain('--viewport-pseudocolor-gradient: linear-gradient(0deg')
    wrapper.unmount()
  })

  it('uses the larger compact width on desktop-sized stages', () => {
    const wrapper = mount(ViewportPseudocolorBarOverlay, {
      props: {
        stageWidth: 500,
        stageHeight: 300,
        pseudocolorPreset: 'bw'
      }
    })

    expect(wrapper.get('.rounded-\\[2px\\]').attributes('style')).toContain('width: 8px')
    wrapper.unmount()
  })

  it('keeps sub-unit PET display bounds legible', () => {
    const wrapper = mount(ViewportPseudocolorBarOverlay, {
      props: {
        stageWidth: 500,
        stageHeight: 300,
        pseudocolorPreset: 'hotmetal',
        windowInfo: {
          ww: 0.07,
          wl: 0.035
        },
        valueDecimalPlaces: 2
      }
    })

    expect(wrapper.text()).toContain('0.07')
    expect(wrapper.text()).toContain('0.00')
    wrapper.unmount()
  })

  it('keeps the bar visible without labels when window info is unavailable', () => {
    const wrapper = mount(ViewportPseudocolorBarOverlay, {
      props: {
        stageWidth: 400,
        stageHeight: 300,
        pseudocolorPreset: 'rainbow'
      }
    })

    expect(wrapper.find('.pointer-events-none').exists()).toBe(true)
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })

  it('hides on tiny stages or missing presets', () => {
    const tiny = mount(ViewportPseudocolorBarOverlay, {
      props: {
        stageWidth: 80,
        stageHeight: 100,
        pseudocolorPreset: 'bw'
      }
    })
    expect(tiny.find('.pointer-events-none').exists()).toBe(false)
    tiny.unmount()

    const missingPreset = mount(ViewportPseudocolorBarOverlay, {
      props: {
        stageWidth: 400,
        stageHeight: 300
      }
    })
    expect(missingPreset.find('.pointer-events-none').exists()).toBe(false)
    missingPreset.unmount()
  })
})
