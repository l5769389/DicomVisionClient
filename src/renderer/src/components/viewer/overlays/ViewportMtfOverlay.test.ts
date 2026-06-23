import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import type { ViewerMtfItem } from '../../../types/viewer'
import ViewportMtfOverlay from './ViewportMtfOverlay.vue'

const mtfItem: ViewerMtfItem = {
  mtfId: 'mtf-1',
  viewportKey: 'single',
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.42, y: 0.38 }
  ],
  status: 'ready',
  metrics: {
    mtf50: 0.51,
    mtf10: 0.94,
    fwhmW: 0.72,
    fwhmH: 0.63,
    peakValue: 400,
    sampleCount: 80,
    unit: 'lp/mm'
  },
  curve: [
    { frequency: 0, value: 1 },
    { frequency: 0.51, value: 0.5 },
    { frequency: 0.94, value: 0.1 }
  ]
}

describe('ViewportMtfOverlay', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useUiPreferences().setLocale('en-US')
  })

  it('renders selected ROI actions without an open-curve chart button', async () => {
    const wrapper = mount(ViewportMtfOverlay, {
      props: {
        imageFrame: {
          left: 0,
          top: 0,
          width: 300,
          height: 240
        },
        mtfItems: [mtfItem],
        selectedMtfId: mtfItem.mtfId
      }
    })

    expect(wrapper.find('[aria-label="View MTF curve"]').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(2)

    await wrapper.get('[aria-label="Copy MTF ROI"]').trigger('click')
    await wrapper.get('[aria-label="Delete MTF ROI"]').trigger('click')

    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('openCurve')).toBeUndefined()
    wrapper.unmount()
  })
})
