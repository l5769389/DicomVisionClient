import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ViewportScaleBarOverlay from './ViewportScaleBarOverlay.vue'

vi.mock('../../../composables/ui/useUiPreferences', () => ({
  useUiPreferences: () => ({
    scaleBarPreference: {
      value: {
        enabled: true,
        color: '#ffffff'
      }
    }
  })
}))

describe('ViewportScaleBarOverlay', () => {
  it('anchors the scale bar to the viewport bottom instead of the image frame', async () => {
    const wrapper = mount(ViewportScaleBarOverlay, {
      props: {
        stageWidth: 400,
        stageHeight: 300,
        scaleBar: {
          lengthNorm: 0.25,
          label: '10 cm'
        }
      }
    })

    const scaleBar = wrapper.find('.pointer-events-none')
    expect(scaleBar.attributes('style')).toContain('left: 150px')
    expect(scaleBar.attributes('style')).toContain('top: 254px')

    await wrapper.setProps({
      imageFrame: {
        left: 120,
        top: 80,
        width: 160,
        height: 90
      }
    } as never)

    expect(scaleBar.attributes('style')).toContain('left: 150px')
    expect(scaleBar.attributes('style')).toContain('top: 254px')
    wrapper.unmount()
  })
})
