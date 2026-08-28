import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ViewUnavailableDialog from './ViewUnavailableDialog.vue'

vi.mock('vuetify/components', () => ({
  VBtn: defineComponent({
    name: 'VBtn',
    emits: ['click'],
    setup(_, { attrs, emit, slots }) {
      return () => h('button', { ...attrs, type: 'button', onClick: () => emit('click') }, slots.default?.())
    }
  }),
  VCard: defineComponent({
    name: 'VCard',
    setup(_, { attrs, slots }) {
      return () => h('section', attrs, slots.default?.())
    }
  }),
  VDialog: defineComponent({
    name: 'VDialog',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup(props, { attrs, slots }) {
      return () => props.modelValue ? h('div', attrs, slots.default?.()) : null
    }
  })
}))

vi.mock('../../composables/ui/useUiLocale', async () => {
  const { ref } = await import('vue')
  return {
    useUiLocale: () => ({ locale: ref('zh-CN') })
  }
})

describe('ViewUnavailableDialog', () => {
  it('shows a localized geometry reason and backend technical detail', () => {
    const wrapper = mount(ViewUnavailableDialog, {
      props: {
        notice: {
          viewType: '4D',
          blockedCode: 'phase-mpr-unavailable',
          detail: 'Phase 25%: irregular slice spacing.'
        }
      },
      global: {
        stubs: {
          AppIcon: { template: '<span />' }
        }
      }
    })

    expect(wrapper.get('[data-testid="view-unavailable-dialog"]').text()).toContain('无法打开 4D 视图')
    expect(wrapper.text()).toContain('每个相位都能构建 MPR')
    expect(wrapper.text()).toContain('Phase 25%: irregular slice spacing.')
  })

  it('can be dismissed from the close and acknowledge buttons', async () => {
    const wrapper = mount(ViewUnavailableDialog, {
      props: {
        notice: { viewType: 'MPR', blockedCode: 'irregular-slice-spacing' }
      },
      global: {
        stubs: {
          AppIcon: { template: '<span />' }
        }
      }
    })

    await wrapper.get('[data-testid="view-unavailable-close"]').trigger('click')
    await wrapper.get('[data-testid="view-unavailable-acknowledge"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it.each([
    ['missing-image-size', '缺少有效的行列尺寸'],
    ['mixed-image-size', '切片行列尺寸不一致'],
    ['missing-pixel-spacing', '缺少有效的 PixelSpacing'],
    ['mixed-pixel-spacing', 'PixelSpacing 不一致'],
    ['invalid-spatial-geometry', '无效的空间坐标或方向信息']
  ])('localizes the volume geometry block code %s', (blockedCode, message) => {
    const wrapper = mount(ViewUnavailableDialog, {
      props: {
        notice: { viewType: 'MPR', blockedCode }
      },
      global: {
        stubs: {
          AppIcon: { template: '<span />' }
        }
      }
    })

    expect(wrapper.text()).toContain(message)
  })
})
