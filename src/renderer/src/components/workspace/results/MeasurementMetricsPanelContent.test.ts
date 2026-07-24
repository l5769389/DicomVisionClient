import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeasurementMetricsPanelContent from './MeasurementMetricsPanelContent.vue'

describe('MeasurementMetricsPanelContent', () => {
  it('shows an alignment angle result like the other measurement tools', () => {
    const wrapper = mount(MeasurementMetricsPanelContent, {
      props: {
        viewportKey: 'single',
        measurement: {
          measurementId: 'alignment-result',
          toolType: 'alignment-horizontal',
          points: [{ x: 0.1, y: 0.4 }, { x: 0.9, y: 0.5 }],
          labelLines: ['ΔH 7.1°', '42.0 mm'],
          scope: 'image'
        }
      }
    })

    expect(wrapper.text()).toContain('相对水平偏角')
    expect(wrapper.text()).toContain('ΔH 7.1°')
    expect(wrapper.text()).toContain('42.0 mm')
  })
})
