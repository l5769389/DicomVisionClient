import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ViewportCornerInfoPreference } from '../../../composables/ui/viewportCornerInfo'
import ViewportCornerOverlay from './ViewportCornerOverlay.vue'

const preferenceState = vi.hoisted(() => ({
  current: {
    topLeft: ['patientName'],
    topRight: [],
    bottomLeft: [],
    bottomRight: [],
    typographyPreset: 'comfortable',
    colorMode: 'auto',
    customDarkColor: '#f8fafc',
    customLightColor: '#182334'
  } as ViewportCornerInfoPreference
}))

vi.mock('../../../composables/ui/useUiPreferences', () => ({
  useUiPreferences: () => ({
    viewportCornerInfoPreference: {
      get value() {
        return preferenceState.current
      }
    }
  })
}))

describe('ViewportCornerOverlay', () => {
  beforeEach(() => {
    preferenceState.current = {
      topLeft: ['patientName'],
      topRight: [],
      bottomLeft: [],
      bottomRight: [],
      typographyPreset: 'comfortable',
      colorMode: 'auto',
      customDarkColor: '#f8fafc',
      customLightColor: '#182334'
    }
  })

  it('applies the selected typography preset and custom color to the overlay root', () => {
    preferenceState.current = {
      ...preferenceState.current,
      typographyPreset: 'standard',
      colorMode: 'custom',
      customDarkColor: '#22d3ee',
      customLightColor: '#182334'
    }

    const wrapper = mount(ViewportCornerOverlay, {
      props: {
        viewportKey: 'viewport-1',
        cornerInfo: {
          topLeft: [],
          topRight: ['ZHANG SAN'],
          bottomLeft: [],
          bottomRight: []
        }
      }
    })

    const overlay = wrapper.get('.viewer-corner-overlay')
    expect(overlay.classes()).toContain('viewer-corner-overlay--standard')
    expect(overlay.classes()).toContain('viewer-corner-overlay--custom-color')
    expect(overlay.attributes('style')).toContain('--viewer-corner-custom-dark-color: #22d3ee')
    expect(overlay.attributes('style')).toContain('--viewer-corner-custom-light-color: #182334')
    expect(wrapper.text()).toContain('ZHANG SAN')
    wrapper.unmount()
  })

  it('keeps automatic color mode without custom color class', () => {
    preferenceState.current = {
      ...preferenceState.current,
      typographyPreset: 'compact'
    }

    const wrapper = mount(ViewportCornerOverlay, {
      props: {
        viewportKey: 'viewport-1',
        cornerInfo: {
          topLeft: [],
          topRight: ['ZHANG SAN'],
          bottomLeft: [],
          bottomRight: []
        }
      }
    })

    const overlay = wrapper.get('.viewer-corner-overlay')
    expect(overlay.classes()).toContain('viewer-corner-overlay--compact')
    expect(overlay.classes()).not.toContain('viewer-corner-overlay--custom-color')
    wrapper.unmount()
  })
})
