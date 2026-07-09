import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from './AppIcon.vue'

describe('AppIcon bed visibility icons', () => {
  it('renders bed-visible as a larger eye over a curved bed board', () => {
    const wrapper = mount(AppIcon, {
      props: {
        name: 'bed-visible',
        size: 18
      }
    })

    const icon = wrapper.get('[data-bed-icon="bed-visible"]')
    expect(icon.find('.app-icon-svg__bed-eye').exists()).toBe(true)
    expect(icon.find('.app-icon-svg__bed-board').exists()).toBe(true)
    expect(icon.find('.app-icon-svg__bed-slash').exists()).toBe(false)
    expect(icon.get('.app-icon-svg__bed-eye').attributes('transform')).toBe('matrix(0.78 0 0 0.58 2.64 2.08)')
    expect(icon.get('.app-icon-svg__bed-board').attributes('d')).toContain('16.98')
  })

  it('renders bed-hidden with the same bed board and an eye slash', () => {
    const wrapper = mount(AppIcon, {
      props: {
        name: 'bed-hidden',
        size: 18
      }
    })

    const icon = wrapper.get('[data-bed-icon="bed-hidden"]')
    expect(icon.find('.app-icon-svg__bed-eye').exists()).toBe(true)
    expect(icon.find('.app-icon-svg__bed-board').exists()).toBe(true)
    expect(icon.find('.app-icon-svg__bed-slash').exists()).toBe(true)
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
})
