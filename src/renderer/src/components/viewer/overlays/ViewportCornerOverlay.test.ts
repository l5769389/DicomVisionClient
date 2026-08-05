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
    expect(overlay.classes()).not.toContain('viewer-corner-overlay--light-background')
    wrapper.unmount()
  })

  it('keeps PET adaptive red treatment even when a generic custom corner color is configured', () => {
    preferenceState.current = {
      ...preferenceState.current,
      colorMode: 'custom',
      customDarkColor: '#22d3ee',
      customLightColor: '#182334'
    }
    const wrapper = mount(ViewportCornerOverlay, {
      props: {
        viewportKey: 'pet-stack',
        pet: true,
        pseudocolorPreset: 'bwinverse',
        cornerInfo: {
          topLeft: ['PET_Animal'],
          topRight: [],
          bottomLeft: [],
          bottomRight: []
        }
      }
    })

    const overlay = wrapper.get('.viewer-corner-overlay')
    expect(overlay.classes()).toContain('viewer-corner-overlay--pet')
    expect(overlay.classes()).not.toContain('viewer-corner-overlay--custom-color')
    expect(overlay.attributes('style') ?? '').not.toContain('--viewer-corner-custom')
    wrapper.unmount()
  })

  it('uses a dark high-contrast treatment for a light LUT background in automatic mode', () => {
    const wrapper = mount(ViewportCornerOverlay, {
      props: {
        viewportKey: 'viewport-1',
        pseudocolorPreset: 'bwinverse',
        cornerInfo: {
          topLeft: ['ZHANG SAN'],
          topRight: [],
          bottomLeft: [],
          bottomRight: []
        }
      }
    })

    expect(wrapper.get('.viewer-corner-overlay').classes()).toContain('viewer-corner-overlay--light-background')
    wrapper.unmount()
  })

  it('keeps the fixed-width coordinate line DOM node stable while hover text changes', async () => {
    preferenceState.current = {
      ...preferenceState.current,
      topLeft: [],
      bottomRight: ['coordinates']
    }
    const wrapper = mount(ViewportCornerOverlay, {
      props: {
        viewportKey: 'viewport-1',
        cornerInfo: {
          topLeft: [],
          topRight: [],
          bottomLeft: [],
          bottomRight: ['X:   9 Y:   7     12 HU'],
          tags: { coordinates: ['X:   9 Y:   7     12 HU'] }
        }
      }
    })

    const initialLine = wrapper.get('.viewer-corner-line--coordinates').element
    await wrapper.setProps({
      cornerInfo: {
        topLeft: [],
        topRight: [],
        bottomLeft: [],
        bottomRight: ['X: 512 Y:1024  -1024 HU'],
        tags: { coordinates: ['X: 512 Y:1024  -1024 HU'] }
      }
    })

    expect(wrapper.get('.viewer-corner-line--coordinates').element).toBe(initialLine)
    expect(wrapper.get('.viewer-corner-line--coordinates').text()).toBe('X: 512 Y:1024  -1024 HU')
    wrapper.unmount()
  })

  it('keeps every configured PET corner row and reveals only the truncated row', async () => {
    preferenceState.current = {
      ...preferenceState.current,
      topLeft: ['patientName', 'studyDate', 'seriesDescription']
    }
    const wrapper = mount(ViewportCornerOverlay, {
      props: {
        viewportKey: 'pet-mpr-ax',
        pet: true,
        cornerInfo: {
          topLeft: ['PET_Animal', 'Animal PET/SPECT/CT', 'PET TOMO[Recon]_L'],
          topRight: [],
          bottomLeft: [],
          bottomRight: [],
          tags: {
            patientName: ['PET_Animal'],
            studyDate: ['2026.04.21'],
            seriesDescription: ['PET TOMO[Recon]_L']
          }
        },
        pseudocolorPreset: 'hotiron'
      }
    })

    expect(wrapper.get('.viewer-corner-overlay').classes()).toContain('viewer-corner-overlay--pet')
    expect(wrapper.get('.viewer-corner-overlay').classes()).toContain('z-[6]')
    expect(wrapper.findAll('.viewer-corner-block--topLeft > .viewer-corner-line')).toHaveLength(3)
    expect(wrapper.findAll('.viewer-corner-block--topLeft > .viewer-corner-line').map((line) => line.text())).toEqual([
      'PET_Animal',
      '2026.04.21',
      'PET TOMO[Recon]_L'
    ])
    expect(wrapper.find('.viewer-corner-detail').exists()).toBe(false)

    const lines = wrapper.findAll('.viewer-corner-block--topLeft > .viewer-corner-line')
    Object.defineProperties(lines[2]!.element, {
      clientWidth: { configurable: true, value: 80 },
      scrollWidth: { configurable: true, value: 220 }
    })
    await lines[2]!.trigger('pointerenter')
    expect(lines[2]!.attributes('title')).toBe('PET TOMO[Recon]_L')
    expect(wrapper.get('.viewer-corner-detail').text()).toBe('PET TOMO[Recon]_L')
    expect(wrapper.get('.viewer-corner-detail').text()).not.toContain('PET_Animal')

    await lines[2]!.trigger('pointerleave')
    expect(wrapper.find('.viewer-corner-detail').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not open details for a row that fits in non-PET views', async () => {
    preferenceState.current = {
      ...preferenceState.current,
      topLeft: ['patientName', 'studyDate']
    }
    const wrapper = mount(ViewportCornerOverlay, {
      props: {
        viewportKey: 'ct-stack',
        cornerInfo: {
          topLeft: ['A very long patient name', '2026.07.28'],
          topRight: [],
          bottomLeft: [],
          bottomRight: [],
          tags: {
            patientName: ['A very long patient name'],
            studyDate: ['2026.07.28']
          }
        }
      }
    })

    expect(wrapper.findAll('.viewer-corner-block--topLeft > .viewer-corner-line')).toHaveLength(2)
    const firstLine = wrapper.findAll('.viewer-corner-block--topLeft > .viewer-corner-line')[0]!
    Object.defineProperties(firstLine.element, {
      clientWidth: { configurable: true, value: 240 },
      scrollWidth: { configurable: true, value: 240 }
    })
    await firstLine.trigger('pointerenter')
    expect(wrapper.find('.viewer-corner-detail').exists()).toBe(false)
    wrapper.unmount()
  })

  it('pins one truncated PET row on click and closes it when another area is clicked', async () => {
    const wrapper = mount(ViewportCornerOverlay, {
      attachTo: document.body,
      props: {
        viewportKey: 'pet-stack',
        pet: true,
        cornerInfo: {
          topLeft: ['PET_Animal'],
          topRight: [],
          bottomLeft: [],
          bottomRight: [],
          tags: {
            patientName: ['PET_Animal']
          }
        }
      }
    })

    const line = wrapper.get('.viewer-corner-block--topLeft > .viewer-corner-line')
    Object.defineProperties(line.element, {
      clientWidth: { configurable: true, value: 60 },
      scrollWidth: { configurable: true, value: 160 }
    })
    await line.trigger('click')
    expect(line.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.viewer-corner-detail').exists()).toBe(true)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.viewer-corner-detail').exists()).toBe(false)
    wrapper.unmount()
  })
})
