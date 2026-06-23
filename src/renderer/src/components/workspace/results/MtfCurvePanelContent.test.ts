import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import type { ViewerMtfItem } from '../../../types/viewer'
import MtfCurvePanelContent from './MtfCurvePanelContent.vue'

const mtfItem: ViewerMtfItem = {
  mtfId: 'mtf-1',
  viewportKey: 'single',
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.8 }
  ],
  status: 'ready',
  metrics: {
    mtf50: 0.42,
    mtf10: 0.88,
    fwhmW: 1.24,
    fwhmH: 1.48,
    peakValue: 512,
    sampleCount: 128,
    unit: 'lp/mm'
  },
  curve: [
    { frequency: 0, value: 1 },
    { frequency: 0.42, value: 0.5 },
    { frequency: 0.88, value: 0.1 }
  ]
}

describe('MtfCurvePanelContent', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useUiPreferences().setLocale('en-US')
  })

  it('renders curve metrics and compact reading guidance without dialog or menu UI', () => {
    const wrapper = mount(MtfCurvePanelContent, {
      props: { mtfItem }
    })

    expect(wrapper.text()).toContain('MTF50')
    expect(wrapper.text()).toContain('0.420 lp/mm')
    expect(wrapper.text()).toContain('MTF10')
    expect(wrapper.text()).toContain('Reading Guide')
    expect(wrapper.text()).toContain('Higher curves')
    expect(wrapper.text()).not.toContain('Measured from the current ROI')
    expect(wrapper.text()).not.toContain('Based on current ROI')
    expect(wrapper.text()).not.toContain('Normalized MTF against spatial frequency')
    expect(wrapper.text()).not.toContain('MTF50 MTF50')
    expect(wrapper.text()).not.toContain('MTF10 MTF10')
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('.mtf-curve-panel-content__svg').attributes('viewBox')).toBe('0 0 100 100')
    expect(wrapper.find('.mtf-curve-panel-content__curve').exists()).toBe(true)
    expect(wrapper.find('.mtf-curve-panel-content__chart').exists()).toBe(true)
    expect(wrapper.find('.v-menu').exists()).toBe(false)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('fixed')
    wrapper.unmount()
  })

  it('exposes selected MTF copy and delete actions from the result panel', async () => {
    const wrapper = mount(MtfCurvePanelContent, {
      props: { mtfItem }
    })

    await wrapper.get('button:not(.mtf-curve-panel-content__action-button--danger)').trigger('click')
    await wrapper.get('.mtf-curve-panel-content__action-button--danger').trigger('click')

    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
    expect(wrapper.find('.mtf-curve-panel-content__scroll').exists()).toBe(true)
    expect(wrapper.find('.mtf-curve-panel-content__actions').element.parentElement).toBe(wrapper.element)
    expect(wrapper.text()).toContain('Copy MTF ROI')
    expect(wrapper.text()).toContain('Delete MTF ROI')
    wrapper.unmount()
  })
})
