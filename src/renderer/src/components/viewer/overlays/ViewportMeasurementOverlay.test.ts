import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ViewportMeasurementOverlay from './ViewportMeasurementOverlay.vue'

vi.mock('../../../composables/ui/useUiPreferences', async () => {
  const { ref } = await import('vue')
  return {
    useUiPreferences: () => ({
      locale: ref('zh-CN'),
      measurementStylePreference: ref({
        completedColor: '#38bdf8',
        completedLineStyle: 'solid',
        editingColor: '#f59e0b',
        editingLineStyle: 'solid',
        lineWidth: 2
      })
    })
  }
})

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

    const measurementSvg = wrapper.find('svg.absolute')
    expect(wrapper.findAll('svg.absolute')).toHaveLength(1)
    expect(measurementSvg.findAll('line')).toHaveLength(2)
    expect(measurementSvg.findAll('rect')).toHaveLength(2)
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
    await buttons[1]!.trigger('pointerdown')

    expect(wrapper.emitted('copySelectedMeasurement')).toHaveLength(1)
    expect(wrapper.emitted('deleteSelectedMeasurement')).toHaveLength(1)
    expect(wrapper.emitted('deleteSelectedMeasurement')?.[0]).toEqual(['m-selected'])
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

  it('renders curve and freeform measurements', () => {
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
            measurementId: 'curve-1',
            toolType: 'curve',
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.35, y: 0.4 },
              { x: 0.7, y: 0.2 }
            ],
            labelLines: ['42.0 mm']
          },
          {
            measurementId: 'freeform-1',
            toolType: 'freeform',
            points: [
              { x: 0.2, y: 0.2 },
              { x: 0.6, y: 0.2 },
              { x: 0.5, y: 0.6 },
              { x: 0.2, y: 0.5 }
            ],
            labelLines: ['Area 1200.0 px2']
          }
        ]
      }
    })

    expect(wrapper.findAll('polyline')).toHaveLength(0)
    expect(wrapper.findAll('polygon')).toHaveLength(0)
    expect(wrapper.findAll('path')).toHaveLength(4)
    expect(wrapper.text()).toContain('42.0 mm')
    expect(wrapper.text()).toContain('Area')
  })

  it('replaces a committed measurement with its active draft', () => {
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
            measurementId: 'curve-1',
            toolType: 'curve',
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.35, y: 0.4 },
              { x: 0.7, y: 0.2 }
            ],
            labelLines: ['Committed']
          }
        ],
        draftMeasurement: {
          measurementId: 'curve-1',
          toolType: 'curve',
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.4, y: 0.45 },
            { x: 0.75, y: 0.25 }
          ],
          labelLines: ['Draft']
        },
        draftMeasurementMode: 'selected'
      }
    })

    expect(wrapper.find('svg.absolute').findAll('path')).toHaveLength(2)
    expect(wrapper.text()).toContain('Draft')
    expect(wrapper.text()).not.toContain('Committed')
  })

  it('keeps freeform drafts open until the third confirmed point', () => {
    const wrapper = mount(ViewportMeasurementOverlay, {
      props: {
        imageFrame: {
          left: 0,
          top: 0,
          width: 320,
          height: 240
        },
        measurements: [],
        draftMeasurement: {
          toolType: 'freeform',
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.6, y: 0.2 },
            { x: 0.6, y: 0.2 }
          ],
          labelLines: ['Area 1200.0 px2']
        },
        draftMeasurementMode: 'draft'
      }
    })

    expect(wrapper.find('path').attributes('d')).not.toContain(' Z')
    expect(wrapper.text()).toContain('Area')
  })

  it('closes freeform drafts after the third confirmed point', () => {
    const wrapper = mount(ViewportMeasurementOverlay, {
      props: {
        imageFrame: {
          left: 0,
          top: 0,
          width: 320,
          height: 240
        },
        measurements: [],
        draftMeasurement: {
          toolType: 'freeform',
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.6, y: 0.2 },
            { x: 0.5, y: 0.6 },
            { x: 0.5, y: 0.6 }
          ],
          labelLines: ['Area 1200.0 px2']
        },
        draftMeasurementMode: 'draft'
      }
    })

    expect(wrapper.find('path').attributes('d')).toContain(' Z')
    expect(wrapper.text()).toContain('Area')
  })

  it('hides matching committed point-sequence overlays while the draft is unfinished', () => {
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
            measurementId: 'premature-curve',
            toolType: 'curve',
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.35, y: 0.4 },
              { x: 0.7, y: 0.2 }
            ],
            labelLines: ['Committed']
          }
        ],
        draftMeasurement: {
          toolType: 'curve',
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.35, y: 0.4 },
            { x: 0.7, y: 0.2 },
            { x: 0.7, y: 0.2 }
          ],
          labelLines: ['Draft']
        },
        draftMeasurementMode: 'draft'
      }
    })

    expect(wrapper.findAll('path')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('Committed')
    expect(wrapper.text()).toContain('Draft')
  })
})
