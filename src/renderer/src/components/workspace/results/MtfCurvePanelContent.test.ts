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
    expect(wrapper.text()).not.toContain('Higher curves')
    expect(wrapper.find('.mtf-curve-panel-content__guide-heading .dock-info-popover__trigger').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Measured from the current ROI')
    expect(wrapper.text()).not.toContain('Based on current ROI')
    expect(wrapper.text()).not.toContain('Normalized MTF against spatial frequency')
    expect(wrapper.text()).not.toContain('MTF50 MTF50')
    expect(wrapper.text()).not.toContain('MTF10 MTF10')
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('.mtf-curve-panel-content__svg').attributes('viewBox')).toBe('0 0 100 100')
    expect(wrapper.find('.mtf-curve-panel-content__curve').exists()).toBe(true)
    expect(wrapper.find('.mtf-curve-panel-content__chart').exists()).toBe(true)
    expect(wrapper.findAll('.mtf-curve-panel-content__radial-metric')).toHaveLength(2)
    expect(wrapper.findAll('.mtf-curve-panel-content__direction-row')).toHaveLength(4)
    expect(wrapper.find('.mtf-curve-panel-content__metric').exists()).toBe(false)
    expect(wrapper.find('.v-menu').exists()).toBe(false)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('fixed')
    wrapper.unmount()
  })

  it('exposes selected MTF copy and delete actions from the result panel', async () => {
    const wrapper = mount(MtfCurvePanelContent, {
      props: { mtfItem }
    })

    await wrapper.findAll('.mtf-curve-panel-content__action-button')[0]!.trigger('click')
    await wrapper.get('.mtf-curve-panel-content__action-button--danger').trigger('click')

    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
    expect(wrapper.find('.mtf-curve-panel-content__scroll').exists()).toBe(true)
    expect(wrapper.find('.mtf-curve-panel-content__actions').element.parentElement).toBe(wrapper.element)
    expect(wrapper.text()).toContain('Copy MTF ROI')
    expect(wrapper.text()).toContain('Delete MTF ROI')
    wrapper.unmount()
  })

  it('renders directional values, Nyquist bounds, invalid FWHM and quality warnings', () => {
    const wrapper = mount(MtfCurvePanelContent, {
      props: {
        mtfItem: {
          ...mtfItem,
          metrics: {
            ...mtfItem.metrics!,
            mtf50: null,
            mtf10: 0.88,
            mtf50W: 0.41,
            mtf10W: null,
            mtf50H: 0.37,
            mtf10H: 0.79,
            radialNyquist: 1,
            nyquistW: 1.25,
            nyquistH: 0.625,
            fwhmW: null,
            sourceSizeCorrected: false
          },
          qualityWarnings: [
            { code: 'source-size-uncorrected', message: 'Finite point-source size correction was not applied.' },
            { code: 'mtf50-beyond-nyquist', message: 'Radial MTF50 remains above its threshold at Nyquist.' },
            { code: 'mtf10-w-beyond-nyquist', message: 'MTF10-W remains above its threshold at Nyquist.' },
            { code: 'fwhm-w-incomplete', message: 'FWHM-W is incomplete.' }
          ],
          curve: [
            { frequency: 0, value: 1 },
            { frequency: 0.5, value: 1.35 },
            { frequency: 1, value: 0.65 }
          ]
        }
      }
    })

    expect(wrapper.text()).toContain('MTF50 Radial')
    expect(wrapper.text()).toContain('> 1.000 lp/mm')
    expect(wrapper.get('.mtf-curve-panel-content__direction-row--header').text()).toContain('W')
    expect(wrapper.get('.mtf-curve-panel-content__direction-row--header').text()).toContain('H')
    expect(wrapper.text()).toContain('MTF50')
    expect(wrapper.text()).toContain('0.410 lp/mm')
    expect(wrapper.text()).toContain('MTF10')
    expect(wrapper.text()).toContain('> 1.250 lp/mm')
    expect(wrapper.text()).toContain('FWHM')
    expect(wrapper.text()).toContain('Not measurable')
    expect(wrapper.text()).toContain('Quality Notes')
    expect(wrapper.text()).toContain('Finite point-source size correction was not applied.')
    expect(wrapper.get('.mtf-curve-panel-content__warnings summary').text()).toContain('4')
    expect(wrapper.get('.mtf-curve-panel-content__warnings').attributes('open')).toBeUndefined()
    expect(wrapper.text()).toContain('1.4')
    wrapper.unmount()
  })

  it('flags a large W/H difference without turning it into a pass-fail result', () => {
    const wrapper = mount(MtfCurvePanelContent, {
      props: {
        mtfItem: {
          ...mtfItem,
          metrics: {
            ...mtfItem.metrics!,
            mtf50W: 1.591,
            mtf50H: 0.282,
            mtf10W: 2.18,
            mtf10H: 0.393,
            fwhmW: 0.618,
            fwhmH: 1.72
          }
        }
      }
    })

    const warning = wrapper.get('.mtf-curve-panel-content__direction-warning')
    expect(warning.text()).toContain('5.6x')
    expect(warning.text()).toContain('approximately round')
    expect(wrapper.findAll('.mtf-curve-panel-content__direction-row')).toHaveLength(4)
    wrapper.unmount()
  })

  it('uses the actual curve Nyquist as the chart x-axis maximum', () => {
    const wrapper = mount(MtfCurvePanelContent, {
      props: {
        mtfItem: {
          ...mtfItem,
          metrics: {
            ...mtfItem.metrics!,
            mtf50: 0.2,
            mtf10: 0.5,
            radialNyquist: 0.625
          },
          curve: [
            { frequency: 0, value: 1 },
            { frequency: 0.2, value: 0.5 },
            { frequency: 0.625, value: 0.08 }
          ]
        }
      }
    })

    expect(wrapper.findAll('.mtf-curve-panel-content__tick').some((item) => item.text() === '0.625')).toBe(true)
    expect(wrapper.get('.mtf-curve-panel-content__curve').attributes('d')).toContain('L 98.00')
    wrapper.unmount()
  })

  it('renders calculating state in the result panel before metrics are ready', () => {
    const wrapper = mount(MtfCurvePanelContent, {
      props: {
        mtfItem: {
          ...mtfItem,
          status: 'calculating',
          metrics: null,
          curve: []
        }
      }
    })

    expect(wrapper.text()).toContain('Calculating')
    expect(wrapper.find('.mtf-curve-panel-content__spinner').exists()).toBe(true)
    expect(wrapper.find('.mtf-curve-panel-content__chart').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders structured failure reason and suggestion instead of the HTTP status text', () => {
    const wrapper = mount(MtfCurvePanelContent, {
      props: {
        mtfItem: {
          ...mtfItem,
          status: 'error',
          metrics: null,
          curve: [],
          errorCode: 'mtf-no-detectable-source',
          errorMessage: 'No stable point source could be detected in the ROI.',
          errorSuggestion: 'Select one isolated point source with surrounding background.'
        }
      }
    })

    expect(wrapper.text()).toContain('No stable point source could be detected')
    expect(wrapper.text()).toContain('Select one isolated point source')
    expect(wrapper.text()).toContain('mtf-no-detectable-source')
    expect(wrapper.text()).not.toContain('Request failed with status code')
    wrapper.unmount()
  })
})
