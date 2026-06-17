import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import SidebarSettingsDialog from './SidebarSettingsDialog.vue'

vi.mock('../../platform/exporting', () => ({
  canChooseCustomExportDirectory: () => false,
  chooseCustomExportDirectory: vi.fn(),
  getDefaultExportLocationLabel: () => Promise.resolve('Default export location'),
  openExportLocation: vi.fn()
}))

vi.mock('../../platform/runtime', () => ({
  viewerRuntime: {
    platform: 'web',
    webAppMode: 'web'
  }
}))

vi.mock('./settings/ExportSettingsPanel.vue', () => ({
  default: {
    name: 'ExportSettingsPanel',
    template: '<div />'
  }
}))

vi.mock('./settings/PacsSettingsPanel.vue', () => ({
  default: {
    name: 'PacsSettingsPanel',
    template: '<div />'
  }
}))

vi.mock('../workspace/shell/MprLayoutMenuPanel.vue', () => ({
  default: {
    name: 'MprLayoutMenuPanel',
    template: '<div />'
  }
}))

function mountSettingsDialog() {
  return mount(SidebarSettingsDialog, {
    props: {
      isOpen: true
    },
    global: {
      stubs: {
        ExportSettingsPanel: true,
        MprLayoutMenuPanel: true,
        PacsSettingsPanel: true,
        Teleport: true
      }
    }
  })
}

async function openToolbarLayoutSection(
  wrapper: ReturnType<typeof mountSettingsDialog>,
  labels = { display: '显示', toolbarLayout: '操作区布局' }
): Promise<void> {
  const displayGroupButton = wrapper.findAll('.settings-nav-item').find((button) => button.text().includes(labels.display))
  expect(displayGroupButton).toBeTruthy()
  await displayGroupButton!.trigger('click')

  const toolbarLayoutButton = wrapper.findAll('.settings-nav-subitem').find((button) => button.text().includes(labels.toolbarLayout))
  expect(toolbarLayoutButton).toBeTruthy()
  await toolbarLayoutButton!.trigger('click')
  await nextTick()
}

describe('SidebarSettingsDialog toolbar layout settings', () => {
  beforeEach(() => {
    window.localStorage.clear()
    const preferences = useUiPreferences()
    preferences.setLocale('zh-CN')
    preferences.viewerToolbarPlacement.value = 'top'
  })

  it('shows toolbar layout skeleton cards and switches placement', async () => {
    const preferences = useUiPreferences()
    const wrapper = mountSettingsDialog()

    await openToolbarLayoutSection(wrapper)

    expect(wrapper.find('[data-testid="settings-toolbar-layout-top"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-toolbar-layout-right"]').exists()).toBe(true)
    expect(wrapper.find('.settings-toolbar-layout-skeleton__button-group').exists()).toBe(true)
    expect(wrapper.find('.settings-toolbar-layout-skeleton__panel').exists()).toBe(true)

    await wrapper.find('[data-testid="settings-toolbar-layout-right"]').trigger('click')

    expect(preferences.viewerToolbarPlacement.value).toBe('right')
    expect(wrapper.find('[data-testid="settings-toolbar-layout-right"]').classes()).toContain('settings-toolbar-layout-choice--active')

    wrapper.unmount()
  })

  it('shows English toolbar layout copy when the locale is English', async () => {
    const preferences = useUiPreferences()
    preferences.setLocale('en-US')
    const wrapper = mountSettingsDialog()

    await openToolbarLayoutSection(wrapper, { display: 'Display', toolbarLayout: 'Toolbar Layout' })

    expect(wrapper.text()).toContain('Viewer Toolbar Layout')
    expect(wrapper.text()).toContain('Top Toolbar')
    expect(wrapper.text()).toContain('Right Dock')

    await wrapper.find('[data-testid="settings-toolbar-layout-right"]').trigger('click')

    expect(preferences.viewerToolbarPlacement.value).toBe('right')
    expect(wrapper.text()).toContain('Right Dock')

    wrapper.unmount()
  })

  it('resets toolbar layout back to right dock', async () => {
    const preferences = useUiPreferences()
    preferences.viewerToolbarPlacement.value = 'top'
    const wrapper = mountSettingsDialog()

    await openToolbarLayoutSection(wrapper)
    preferences.viewerToolbarPlacement.value = 'top'
    await nextTick()
    expect(wrapper.find('[data-testid="settings-toolbar-layout-top"]').classes()).toContain('settings-toolbar-layout-choice--active')

    const resetButton = wrapper.findAll('button').find((button) => button.text().trim() === '恢复默认')
    expect(resetButton).toBeTruthy()
    await resetButton!.trigger('click')

    expect(preferences.viewerToolbarPlacement.value).toBe('right')
    expect(wrapper.find('[data-testid="settings-toolbar-layout-right"]').classes()).toContain('settings-toolbar-layout-choice--active')

    wrapper.unmount()
  })
})
