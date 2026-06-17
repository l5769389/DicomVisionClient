import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { QaWaterAnalysis } from '../../../types/viewer'
import ViewportQaWaterOverlay from './ViewportQaWaterOverlay.vue'

const readyAnalysis: QaWaterAnalysis = {
  viewId: 'view-1',
  viewportKey: 'single',
  status: 'ready',
  rois: [
    { id: 'center', label: 'C', kind: 'water', center: { x: 0.5, y: 0.5 }, radius: 0.1 },
    { id: 'air', label: 'A', kind: 'air', center: { x: 0.25, y: 0.25 }, radius: 0.05 }
  ],
  metrics: {
    accuracy: {
      centerMean: 1,
      deviationHu: 1,
      targetHu: 0,
      unit: 'HU'
    }
  }
}

describe('ViewportQaWaterOverlay', () => {
  it('renders only ROI markers for ready QA analysis', () => {
    const wrapper = mount(ViewportQaWaterOverlay, {
      props: {
        analysis: readyAnalysis,
        imageFrame: {
          left: 10,
          top: 20,
          width: 200,
          height: 100
        }
      }
    })

    expect(wrapper.findAll('circle')).toHaveLength(2)
    expect(wrapper.findAll('text')).toHaveLength(2)
    expect(wrapper.text()).toContain('C')
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).not.toContain('Water Phantom QA')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not render result content for loading or error states', async () => {
    const wrapper = mount(ViewportQaWaterOverlay, {
      props: {
        analysis: {
          viewId: 'view-1',
          viewportKey: 'single',
          status: 'loading',
          rois: []
        },
        imageFrame: {
          left: 0,
          top: 0,
          width: 100,
          height: 100
        }
      }
    })

    expect(wrapper.html()).toBe('<!--v-if-->')
    await wrapper.setProps({
      analysis: {
        viewId: 'view-1',
        viewportKey: 'single',
        status: 'error',
        rois: [],
        message: 'Failed'
      }
    })
    expect(wrapper.html()).toBe('<!--v-if-->')
    wrapper.unmount()
  })
})
