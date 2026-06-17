import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import ViewerResultDock from './ViewerResultDock.vue'

describe('ViewerResultDock', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useUiPreferences().setLocale('en-US')
  })

  it('renders a stable empty result area that can collapse to a narrow strip', async () => {
    const wrapper = mount(ViewerResultDock, {
      props: {
        hasContent: false,
        icon: 'info',
        title: 'Results'
      }
    })

    expect(wrapper.find('.viewer-result-dock__header').exists()).toBe(false)
    expect(wrapper.find('.viewer-result-dock__empty-state').exists()).toBe(true)
    await wrapper.get('.viewer-result-dock__collapse-button').trigger('click')

    expect(wrapper.classes()).toContain('viewer-result-dock--collapsed')
    expect(wrapper.find('.viewer-result-dock__content').exists()).toBe(false)
    expect(wrapper.emitted('dockResize')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders result content with a close button when content is active', async () => {
    const wrapper = mount(ViewerResultDock, {
      props: {
        hasContent: true,
        icon: 'mtf',
        title: 'MTF Curve'
      },
      slots: {
        default: '<div data-testid="result-content">Result</div>'
      }
    })

    expect(wrapper.find('.viewer-result-dock__title').text()).toContain('MTF Curve')
    expect(wrapper.find('[data-testid="result-content"]').text()).toBe('Result')
    await wrapper.get('.viewer-result-dock__close').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
