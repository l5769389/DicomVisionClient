import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ViewerTabStrip from './ViewerTabStrip.vue'
import type { ViewerTabItem } from '../../types/viewer'

vi.mock('../../composables/ui/useUiLocale', () => ({
  useUiLocale: () => ({
    locale: { value: 'en-US' },
    t: (key: string) =>
      ({
        closeView: 'Close View',
        scrollTabsLeft: 'Scroll Tabs Left',
        scrollTabsRight: 'Scroll Tabs Right',
        viewerWorkspace: 'Viewer Workspace'
      })[key] ?? key
  })
}))

vi.mock('vuetify/components', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    VBtn: defineComponent({
      name: 'VBtn',
      props: ['disabled'],
      emits: ['click'],
      setup(props, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              class: 'v-btn-stub',
              disabled: props.disabled,
              type: 'button',
              onClick: (event: MouseEvent) => emit('click', event)
            },
            slots.default?.()
          )
      }
    }),
    VMenu: defineComponent({
      name: 'VMenu',
      props: ['modelValue'],
      setup(props, { slots }) {
        return () => (props.modelValue ? h('div', { class: 'v-menu-stub' }, slots.default?.()) : null)
      }
    })
  }
})

const globalStubs = {
  AppIcon: {
    props: ['name'],
    template: '<span class="app-icon-stub">{{ name }}</span>'
  },
  VBtn: {
    props: ['disabled'],
    emits: ['click'],
    template: '<button class="v-btn-stub" :disabled="disabled" type="button" @click="$emit(\'click\', $event)"><slot /></button>'
  },
  VMenu: {
    props: ['modelValue'],
    template: '<div v-if="modelValue" class="v-menu-stub"><slot /></div>'
  }
}

function createTab(key: string, title: string): ViewerTabItem {
  return {
    key,
    seriesId: key,
    seriesTitle: title,
    title,
    viewType: 'Stack',
    viewId: `${key}-view`,
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false },
    pseudocolorPreset: 'gray'
  } as ViewerTabItem
}

function mountTabStrip(viewerTabs: ViewerTabItem[]) {
  return mount(ViewerTabStrip, {
    props: {
      activeTabKey: viewerTabs[0]?.key ?? '',
      canScrollTabsLeft: false,
      canScrollTabsRight: false,
      tabStripRef: null,
      viewerTabs
    },
    global: {
      stubs: globalStubs
    }
  })
}

describe('ViewerTabStrip context menu', () => {
  it('keeps every tab in the same layout class while changing the active tab', async () => {
    const wrapper = mountTabStrip([createTab('tab-1', 'Series A'), createTab('tab-2', 'Series B')])
    const [firstTab, secondTab] = wrapper.findAll('.viewer-tab-item')

    expect(firstTab!.classes()).toContain('viewer-tab-item--active')
    expect(secondTab!.classes()).toContain('viewer-tab-item--inactive')

    await secondTab!.trigger('click')
    expect(wrapper.emitted('activateTab')).toEqual([['tab-2']])
    expect(firstTab!.classes()).toContain('viewer-tab-item')
    expect(secondTab!.classes()).toContain('viewer-tab-item')
  })

  it('keeps tab navigation at opposite ends of the strip', async () => {
    const wrapper = mountTabStrip([createTab('tab-1', 'Series A'), createTab('tab-2', 'Series B')])
    await wrapper.setProps({ canScrollTabsLeft: true, canScrollTabsRight: true })

    const buttons = wrapper.findAll('.tab-scroll-button.v-btn-stub')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.classes()).toContain('tab-scroll-button--left')
    expect(buttons[1]!.classes()).toContain('tab-scroll-button--right')
    expect(buttons[0]!.element.compareDocumentPosition(wrapper.find('.tab-strip-scroll').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.find('.tab-strip-scroll').element.compareDocumentPosition(buttons[1]!.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')

    expect(wrapper.emitted('scrollTabs')).toEqual([['left'], ['right']])
  })

  it('emits close for the tab selected by right click', async () => {
    const wrapper = mountTabStrip([createTab('tab-1', 'Series A'), createTab('tab-2', 'Series B')])

    await wrapper.find('[data-tab-key="tab-2"]').trigger('contextmenu', { clientX: 50, clientY: 60 })
    await nextTick()
    await wrapper.findAll('.viewer-tab-context-menu__item')[0]!.trigger('click')

    expect(wrapper.emitted('closeTab')).toEqual([['tab-2']])
  })

  it('emits closeOtherTabs for the tab selected by right click', async () => {
    const wrapper = mountTabStrip([createTab('tab-1', 'Series A'), createTab('tab-2', 'Series B')])

    await wrapper.find('[data-tab-key="tab-2"]').trigger('contextmenu', { clientX: 50, clientY: 60 })
    await nextTick()
    await wrapper.findAll('.viewer-tab-context-menu__item')[1]!.trigger('click')

    expect(wrapper.emitted('closeOtherTabs')).toEqual([['tab-2']])
  })

  it('disables close other tabs when there is only one tab', async () => {
    const wrapper = mountTabStrip([createTab('tab-1', 'Series A')])

    await wrapper.find('[data-tab-key="tab-1"]').trigger('contextmenu', { clientX: 50, clientY: 60 })
    await nextTick()

    expect(wrapper.findAll('.viewer-tab-context-menu__item')[1]!.attributes('disabled')).toBeDefined()
  })
})
