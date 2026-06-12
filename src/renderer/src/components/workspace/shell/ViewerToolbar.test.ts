import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ViewerToolbar from './ViewerToolbar.vue'
import type { StackTool } from './toolbarTypes'
import type { ViewerTabItem } from '../../../types/viewer'

vi.mock('vuetify/components', () => ({
  VBtn: {
    name: 'VBtn',
    props: {
      active: Boolean,
      disabled: Boolean,
      title: String
    },
    template: `
      <button type="button" v-bind="$attrs" :disabled="disabled" :title="title">
        <slot />
      </button>
    `
  },
  VCard: {
    name: 'VCard',
    template: '<section v-bind="$attrs"><slot /></section>'
  },
  VMenu: {
    name: 'VMenu',
    props: {
      modelValue: Boolean
    },
    emits: ['update:modelValue'],
    template: `
      <div class="v-menu-stub">
        <slot name="activator" :props="{}" />
        <div v-if="modelValue" class="v-menu-stub__content">
          <slot />
        </div>
      </div>
    `
  }
}))

vi.mock('../../../composables/ui/useUiLocale', () => ({
  useUiLocale: () => ({
    toolbarCopy: {
      hideTabs: 'Hide tabs',
      pausePlayback: 'Pause',
      resumePlayback: 'Resume',
      showTabs: 'Show tabs',
      stopPlayback: 'Stop',
      toolOptions: (label: string) => label
    }
  })
}))

const fusionRegistrationTool: StackTool = {
  key: 'fusionRegistration',
  label: '配准',
  icon: 'crosshair',
  inlineKind: 'fusionRegistration'
}

afterEach(() => {
  document.body.innerHTML = ''
})

function createFusionTab(manualRegistration = false): ViewerTabItem {
  return {
    key: 'fusion:ct:pet',
    seriesId: 'ct',
    seriesTitle: 'CT',
    title: 'CT + PET',
    viewType: 'PETCTFusion',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false },
    pseudocolorPreset: 'bw',
    fusionManualRegistration: manualRegistration
  } as ViewerTabItem
}

function mountToolbar(manualRegistration = false, openMenuKey: string | null = null) {
  return mount(ViewerToolbar, {
    props: {
      activeTab: createFusionTab(manualRegistration),
      activeTools: [fusionRegistrationTool],
      areToolbarActionsDisabled: false,
      isPlaying: false,
      isPlaybackPaused: false,
      isToolSelected: (tool: StackTool) => tool.key === 'fusionRegistration' && manualRegistration,
      openMenuKey,
      stackToolSelections: {},
      toolbarIconSize: 18,
      menuIconSize: 16,
      toggleIconSize: 14
    },
    global: {
      stubs: {
        AppIcon: true,
        FusionPetDisplayTool: true,
        LayoutMenuPanel: true,
        MprLayoutMenuPanel: true,
        PseudocolorBand: true
      }
    }
  })
}

describe('ViewerToolbar fusion registration inline tool', () => {
  it('shows only the registration toggle before manual registration is enabled', async () => {
    const wrapper = mountToolbar(false)

    expect(wrapper.find('[data-testid="fusion-registration-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fusion-registration-menu-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fusion-registration-action-reset"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fusion-registration-action-load"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fusion-registration-action-save"]').exists()).toBe(false)

    await wrapper.find('[data-testid="fusion-registration-toggle"]').trigger('click')

    expect(wrapper.emitted('selectToolOption')).toEqual([[fusionRegistrationTool, 'fusionRegistration:toggle']])
    wrapper.unmount()
  })

  it('shows registration actions in a dropdown after manual registration is enabled', async () => {
    const wrapper = mountToolbar(true, 'fusionRegistration')

    expect(wrapper.find('[data-testid="fusion-registration-menu-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fusion-registration-menu"]').text()).toContain('重置配准')
    expect(wrapper.find('[data-testid="fusion-registration-menu"]').text()).toContain('加载配准')
    expect(wrapper.find('[data-testid="fusion-registration-menu"]').text()).toContain('保存配准')
    expect(wrapper.find('[data-testid="fusion-registration-menu"]').text()).toContain('退出配准模式')
    expect(wrapper.find('[data-testid="fusion-registration-menu"]').text()).toContain('使用说明')

    await wrapper.find('[data-testid="fusion-registration-action-exit"]').trigger('click')

    expect(wrapper.emitted('selectToolOption')).toEqual([[fusionRegistrationTool, 'fusionRegistration:exit']])
    wrapper.unmount()
  })

  it('opens the manual registration help panel from the dropdown', async () => {
    const wrapper = mountToolbar(true, 'fusionRegistration')

    await wrapper.find('[data-testid="fusion-registration-action-help"]').trigger('click')

    const help = document.body.querySelector('[data-testid="fusion-registration-help"]')
    expect(help?.textContent).toContain('手动配准使用说明')
    expect(help?.textContent).toContain('用于对图像融合位置进行微调')
    expect(help?.textContent).toContain('鼠标左键：可平移 PET 图像')
    expect(wrapper.emitted('selectToolOption')).toBeUndefined()
    expect(wrapper.emitted('setMenuOpen')).toEqual([[null]])

    document.body.querySelector<HTMLElement>('[data-testid="fusion-registration-help-close"]')?.click()
    await nextTick()
    expect(document.body.querySelector('[data-testid="fusion-registration-help"]')).toBeNull()
    wrapper.unmount()
  })

  it('closes the manual registration help panel with Escape and backdrop click', async () => {
    const wrapper = mountToolbar(true, 'fusionRegistration')

    await wrapper.find('[data-testid="fusion-registration-action-help"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    expect(document.body.querySelector('[data-testid="fusion-registration-help"]')).toBeNull()

    await wrapper.find('[data-testid="fusion-registration-action-help"]').trigger('click')
    document.body.querySelector<HTMLElement>('[data-testid="fusion-registration-help-overlay"]')?.click()
    await nextTick()
    expect(document.body.querySelector('[data-testid="fusion-registration-help"]')).toBeNull()

    wrapper.unmount()
  })
})
