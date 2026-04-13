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
          labelLines: ['ROI'],
          selectedHandleIndex: null,
          isMoving: false,
          isCommitted: true
        }
      }
    })

    expect(wrapper.findAll('svg').length).toBe(1)
    expect(wrapper.findAll('line').length).toBe(2)
    expect(wrapper.findAll('rect').length).toBe(2)
    expect(wrapper.text()).toContain('12.4 mm')
    expect(wrapper.text()).toContain('ROI')
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
          labelLines: [],
          selectedHandleIndex: -1,
          isMoving: true,
          isCommitted: false
        }
      }
    })

    expect(wrapper.findAll('ellipse').length).toBe(2)
    expect(wrapper.findAll('circle').length).toBe(4)
  })
})
