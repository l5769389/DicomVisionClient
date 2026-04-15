import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ViewportMeasurementOverlay from './ViewportMeasurementOverlay.vue'

describe('ViewportMeasurementOverlay', () => {
  it('renders committed measurement and selected draft together', () => {
    const wrapper = mount(ViewportMeasurementOverlay, {
      props: {
        imageFrame: {
          left: 10,
          top: 20,
          width: 200,
          height: 100
        },
        measurements: [
          {
            measurementId: 'committed-1',
            toolType: 'line',
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.7, y: 0.5 }
            ],
            labelLines: ['12.4 mm']
          }
        ],
        draftMeasurement: {
          measurementId: 'draft-1',
          toolType: 'rect',
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.6, y: 0.7 }
          ],
          labelLines: ['ROI']
        },
        draftMeasurementMode: 'selected'
      }
    })

    expect(wrapper.findAll('svg').length).toBe(1)
    expect(wrapper.findAll('line').length).toBe(2)
    expect(wrapper.findAll('rect').length).toBe(2)
    expect(wrapper.text()).toContain('12.4 mm')
    expect(wrapper.text()).toContain('ROI')
  })

  it('shows copy and delete actions for selected draft measurement', async () => {
    const wrapper = mount(ViewportMeasurementOverlay, {
      props: {
        imageFrame: {
          left: 0,
          top: 0,
          width: 300,
          height: 200
        },
        draftMeasurementMode: 'selected',
        draftMeasurement: {
          measurementId: 'm-selected',
          toolType: 'line',
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.5, y: 0.4 }
          ],
          labelLines: ['12.3 mm']
        },
        measurements: []
      }
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.attributes('aria-label')).toBe('复制测量')
    expect(buttons[1]?.attributes('aria-label')).toBe('删除测量')

    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')

    expect(wrapper.emitted('copySelectedMeasurement')).toHaveLength(1)
    expect(wrapper.emitted('deleteSelectedMeasurement')).toHaveLength(1)
  })

  it('shows handles for a moving draft measurement', () => {
    const wrapper = mount(ViewportMeasurementOverlay, {
      props: {
        imageFrame: {
          left: 0,
          top: 0,
          width: 300,
          height: 300
        },
        measurements: [],
        draftMeasurement: {
          measurementId: 'draft-moving',
          toolType: 'ellipse',
          points: [
            { x: 0.2, y: 0.3 },
            { x: 0.8, y: 0.9 }
          ],
          labelLines: []
        },
        draftMeasurementMode: 'moving'
      }
    })

    expect(wrapper.findAll('ellipse').length).toBe(2)
    expect(wrapper.findAll('circle').length).toBe(4)
  })

  it('renders keyed roi labels in aligned key-value columns', () => {
    const wrapper = mount(ViewportMeasurementOverlay, {
      props: {
        imageFrame: {
          left: 0,
          top: 0,
          width: 320,
          height: 240
        },
        measurements: [
          {
            measurementId: 'rect-1',
            toolType: 'rect',
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.5, y: 0.5 }
            ],
            labelLines: ['Size 120.0 * 120.0 mm', 'Area 2400.0 mm2', 'Mean 42.0']
          }
        ]
      }
    })

    const labelRows = wrapper.findAll('[class*="grid-cols-[2.8rem_minmax(0,1fr)]"]')
    expect(labelRows).toHaveLength(3)
    expect(wrapper.text()).toContain('Size')
    expect(wrapper.text()).toContain('120.0 * 120.0 mm')
    expect(wrapper.text()).toContain('Area')
    expect(wrapper.text()).toContain('2400.0 mm2')
  })
})
