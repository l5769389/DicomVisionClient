import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mdiBedEmpty, mdiContentCut, mdiCubeOutline, mdiCubeScan, mdiEyeOffOutline, mdiEyeOutline, mdiSegment } from '@mdi/js'
import AppIcon from './AppIcon.vue'

describe('AppIcon bed visibility icons', () => {
  it('renders bed-visible from official MDI eye and bed paths', () => {
    const wrapper = mount(AppIcon, {
      props: {
        name: 'bed-visible',
        size: 18
      }
    })

    const icon = wrapper.get('[data-bed-icon="bed-visible"]')
    expect(icon.find('.app-icon-svg__bed-eye').exists()).toBe(true)
    expect(icon.find('.app-icon-svg__bed-board').exists()).toBe(true)
    expect(icon.get('.app-icon-svg__bed-eye').attributes('d')).toBe(mdiEyeOutline)
    expect(icon.get('.app-icon-svg__bed-board').attributes('d')).toBe(mdiBedEmpty)
    expect(icon.get('.app-icon-svg__bed-eye').attributes('transform')).toBe('matrix(0.66 0 0 0.66 4.08 -0.72)')
    expect(icon.get('.app-icon-svg__bed-board').attributes('transform')).toBe('matrix(0.78 0 0 0.52 2.64 10.55)')
  })

  it('renders bed-hidden with the official MDI eye-off path', () => {
    const wrapper = mount(AppIcon, {
      props: {
        name: 'bed-hidden',
        size: 18
      }
    })

    const icon = wrapper.get('[data-bed-icon="bed-hidden"]')
    expect(icon.get('.app-icon-svg__bed-eye').attributes('d')).toBe(mdiEyeOffOutline)
    expect(icon.get('.app-icon-svg__bed-board').attributes('d')).toBe(mdiBedEmpty)
  })

  it('keeps remove-bed as a compatibility alias for bed-visible', () => {
    const wrapper = mount(AppIcon, {
      props: {
        name: 'remove-bed',
        size: 18
      }
    })

    expect(wrapper.find('[data-bed-icon="bed-visible"]').exists()).toBe(true)
  })

  it('uses the requested MDI icons for clipping, segmentation, and render presets', () => {
    const clip = mount(AppIcon, { props: { name: 'volume-clip' } })
    const segmentation = mount(AppIcon, { props: { name: 'segmentation' } })
    const preset = mount(AppIcon, { props: { name: 'volumePreset' } })

    expect(clip.get('path').attributes('d')).toBe(mdiContentCut)
    expect(segmentation.get('path').attributes('d')).toBe(mdiSegment)
    expect(preset.get('path').attributes('d')).toBe(mdiCubeOutline)
  })

  it('renders pseudocolor as the shared grayscale circular swatch', () => {
    const pseudocolor = mount(AppIcon, { props: { name: 'pseudocolor' } })

    expect(pseudocolor.find('defs').exists()).toBe(true)
    expect(pseudocolor.findAll('circle')).toHaveLength(2)
  })

  it('uses compact V and S letter icons for the 3D render modes', () => {
    const volume = mount(AppIcon, { props: { name: 'render-volume' } })
    const surface = mount(AppIcon, { props: { name: 'render-surface' } })

    expect(volume.get('[data-render-mode-icon="render-volume"]').text()).toBe('V')
    expect(surface.get('[data-render-mode-icon="render-surface"]').text()).toBe('S')
  })

  it('uses a neutral layers icon for the render-mode primary button', () => {
    const renderMode = mount(AppIcon, { props: { name: 'render-mode' } })

    expect(renderMode.find('[data-render-mode-icon]').exists()).toBe(false)
    expect(renderMode.get('path').attributes('d')).toBeTruthy()
  })

  it('uses a fixed MDI surface icon for the Surface preset primary button', () => {
    const preset = mount(AppIcon, { props: { name: 'surface-preset' } })

    expect(preset.find('[data-render-mode-icon]').exists()).toBe(false)
    expect(preset.get('path').attributes('d')).toBeTruthy()
  })

  it('renders active 3D orientation as a compact face letter icon', () => {
    const face = mount(AppIcon, { props: { name: 'orientation-face-L' } })
    const oblique = mount(AppIcon, { props: { name: 'orientation-face-oblique' } })

    expect(face.get('[data-orientation-face-icon="L"]').text()).toContain('L')
    expect(face.find('.app-icon-svg__orientation-face-box').exists()).toBe(false)
    expect(face.find('rect').exists()).toBe(false)
    expect(oblique.find('[data-orientation-face-icon]').exists()).toBe(false)
    expect(oblique.get('path').attributes('d')).toBe(mdiCubeScan)
  })
})
