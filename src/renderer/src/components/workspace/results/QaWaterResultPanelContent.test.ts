import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import type { QaWaterAnalysis } from '../../../types/viewer'
import QaWaterResultPanelContent from './QaWaterResultPanelContent.vue'

const readyAnalysis: QaWaterAnalysis = {
  viewId: 'view-1',
  viewportKey: 'single',
  status: 'ready',
  rois: [
    { id: 'center', label: 'C', kind: 'water', center: { x: 0.5, y: 0.5 }, radius: 0.08 }
  ],
  metrics: {
    accuracy: {
      centerMean: 1.2,
      deviationHu: 1.2,
      targetHu: 0,
      unit: 'HU'
    },
    uniformity: {
      centerMean: 1.2,
      maxDeviation: 2.4,
      peripheralMeans: [2.1],
      roiStats: [
        {
          id: 'center',
          label: 'C',
          kind: 'water',
          area: 32.2,
          width: 6.1,
          height: 6.2,
          mean: 1.2,
          stdDev: 3.5,
          sampleCount: 42,
          deviationFromCenter: null,
          sizeUnit: 'mm',
          areaUnit: 'mm2',
          unit: 'HU'
        }
      ],
      unit: 'HU'
    },
    noise: {
      stdDev: 3.5,
      unit: 'HU'
    }
  }
}

describe('QaWaterResultPanelContent', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useUiPreferences().setLocale('en-US')
  })

  it('renders loading state inside the stable report container', () => {
    const wrapper = mount(QaWaterResultPanelContent, {
      props: {
        analysis: {
          viewId: 'view-1',
          viewportKey: 'single',
          status: 'loading',
          rois: []
        }
      }
    })

    expect(wrapper.find('.qa-water-result-panel-content__report').exists()).toBe(true)
    expect(wrapper.text()).toContain('QA Report')
    expect(wrapper.text()).toContain('Analyzing QA')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('.fixed').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders ready metrics and ROI details as a report table', () => {
    const wrapper = mount(QaWaterResultPanelContent, {
      props: { analysis: readyAnalysis }
    })

    expect(wrapper.text()).toContain('QA Report')
    expect(wrapper.text()).not.toContain('Water Phantom QA')
    expect(wrapper.text()).not.toContain('Report generated from')
    expect(wrapper.text()).toContain('Metrics')
    expect(wrapper.text()).toContain('Accuracy')
    expect(wrapper.text()).toContain('1.20 HU')
    expect(wrapper.text()).toContain('Uniformity')
    expect(wrapper.text()).toContain('ROI Size')
    expect(wrapper.text()).toContain('ROI Details')
    expect(wrapper.text()).toContain('C')
    expect(wrapper.findAll('table').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders errors as panel content instead of a fixed dialog', () => {
    const wrapper = mount(QaWaterResultPanelContent, {
      props: {
        analysis: {
          viewId: 'view-1',
          viewportKey: 'single',
          status: 'error',
          rois: [],
          message: 'Detector failed'
        }
      }
    })

    expect(wrapper.find('.qa-water-result-panel-content__report').exists()).toBe(true)
    expect(wrapper.text()).toContain('Detector failed')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('.fixed').exists()).toBe(false)
    wrapper.unmount()
  })

  it('localizes generic automatic QA failure messages', () => {
    useUiPreferences().setLocale('zh-CN')
    const wrapper = mount(QaWaterResultPanelContent, {
      props: {
        analysis: {
          viewId: 'view-1',
          viewportKey: 'single',
          status: 'error',
          rois: [],
          message: 'Water phantom QA analysis failed.'
        }
      }
    })

    expect(wrapper.text()).toContain('水模 QA 分析失败')
    expect(wrapper.text()).not.toContain('Water phantom QA analysis failed.')
    wrapper.unmount()
  })

  it('keeps the same report container mounted while analysis state updates', async () => {
    const wrapper = mount(QaWaterResultPanelContent, {
      props: { analysis: readyAnalysis }
    })
    const reportElement = wrapper.get('.qa-water-result-panel-content__report').element

    await wrapper.setProps({
      analysis: {
        viewId: 'view-1',
        viewportKey: 'single',
        status: 'loading',
        rois: []
      }
    })

    expect(wrapper.get('.qa-water-result-panel-content__report').element).toBe(reportElement)
    expect(wrapper.text()).toContain('Analyzing QA')
    wrapper.unmount()
  })
})
