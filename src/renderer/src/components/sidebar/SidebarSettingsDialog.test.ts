import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import SidebarSettingsDialog from './SidebarSettingsDialog.vue'

const preferenceStorage = vi.hoisted(() => ({
  value: null as string | null
}))

vi.mock('../../platform/preferencesStorage', () => ({
  loadUiPreferencesFromStorage: () => Promise.resolve(preferenceStorage.value),
  saveUiPreferencesToStorage: (value: string) => {
    preferenceStorage.value = value
    return Promise.resolve()
  }
}))

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

async function openViewportLayoutSection(
  wrapper: ReturnType<typeof mountSettingsDialog>,
  labels = { display: '显示', viewportLayout: '视口布局' }
): Promise<void> {
  const displayGroupButton = wrapper.findAll('.settings-nav-item').find((button) => button.text().includes(labels.display))
  expect(displayGroupButton).toBeTruthy()
  await displayGroupButton!.trigger('click')

  const viewportLayoutButton = wrapper.findAll('.settings-nav-subitem').find((button) => button.text().includes(labels.viewportLayout))
  expect(viewportLayoutButton).toBeTruthy()
  await viewportLayoutButton!.trigger('click')
  await nextTick()
}

async function openCornerInfoSection(wrapper: ReturnType<typeof mountSettingsDialog>): Promise<void> {
  const displayGroupButton = wrapper.findAll('.settings-nav-item').find((button) => button.text().includes('Display'))
  expect(displayGroupButton).toBeTruthy()
  await displayGroupButton!.trigger('click')

  const cornerInfoButton = wrapper.findAll('.settings-nav-subitem').find((button) => button.text().includes('Corner Info'))
  expect(cornerInfoButton).toBeTruthy()
  await cornerInfoButton!.trigger('click')
  await nextTick()
}

async function openMeasurementStyleSection(wrapper: ReturnType<typeof mountSettingsDialog>): Promise<void> {
  const displayGroupButton = wrapper.findAll('.settings-nav-item').find((button) => button.text().includes('Display'))
  expect(displayGroupButton).toBeTruthy()
  await displayGroupButton!.trigger('click')

  const measurementButton = wrapper.findAll('.settings-nav-subitem').find((button) => button.text().includes('Measurement & Annotation'))
  expect(measurementButton).toBeTruthy()
  await measurementButton!.trigger('click')
  await nextTick()
}

describe('SidebarSettingsDialog viewport layout settings', () => {
  beforeEach(() => {
    preferenceStorage.value = null
    const preferences = useUiPreferences()
    preferences.setLocale('zh-CN')
    preferences.viewportAutoFitEnabled.value = true
  })

  it('keeps the settings search outside the independently scrolling navigation list', () => {
    const wrapper = mountSettingsDialog()

    expect(wrapper.find('.settings-nav-search-wrap').exists()).toBe(true)
    expect(wrapper.find('.settings-nav-scroll').exists()).toBe(true)
    expect(wrapper.find('.settings-nav-scroll').find('.settings-nav-search-wrap').exists()).toBe(false)

    wrapper.unmount()
  })

  it('removes toolbar placement controls and keeps viewport adaptation', async () => {
    const preferences = useUiPreferences()
    const wrapper = mountSettingsDialog()

    await openViewportLayoutSection(wrapper)

    expect(wrapper.find('[data-testid="settings-toolbar-layout-top"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="settings-toolbar-layout-right"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('顶部工具栏')
    expect(wrapper.find('[data-testid="settings-viewport-auto-fit"]').exists()).toBe(true)

    await wrapper.find('[data-testid="settings-viewport-auto-fit"]').trigger('click')
    expect(preferences.viewportAutoFitEnabled.value).toBe(false)

    wrapper.unmount()
  })

  it('shows English viewport layout copy without toolbar placement choices', async () => {
    const preferences = useUiPreferences()
    preferences.setLocale('en-US')
    const wrapper = mountSettingsDialog()

    await openViewportLayoutSection(wrapper, { display: 'Display', viewportLayout: 'Viewport Layout' })

    expect(wrapper.text()).toContain('Viewport Layout')
    expect(wrapper.text()).toContain('Adapt Viewports to Window')
    expect(wrapper.text()).not.toContain('Top Toolbar')
    expect(wrapper.text()).not.toContain('Right Dock')

    wrapper.unmount()
  })

  it('resets viewport adaptation to enabled', async () => {
    const preferences = useUiPreferences()
    preferences.viewportAutoFitEnabled.value = false
    const wrapper = mountSettingsDialog()

    await openViewportLayoutSection(wrapper)

    const resetButton = wrapper.findAll('button').find((button) => button.text().trim() === '恢复默认')
    expect(resetButton).toBeTruthy()
    await resetButton!.trigger('click')

    expect(preferences.viewportAutoFitEnabled.value).toBe(true)

    wrapper.unmount()
  })
})

describe('SidebarSettingsDialog corner info style settings', () => {
  beforeEach(() => {
    preferenceStorage.value = null
    const preferences = useUiPreferences()
    preferences.setLocale('en-US')
    preferences.setViewportCornerInfoPreference({
      ...preferences.viewportCornerInfoPreference.value,
      typographyPreset: 'comfortable',
      colorMode: 'auto',
      customDarkColor: '#f8fafc',
      customLightColor: '#182334'
    })
  })

  it('updates corner info typography and custom color from the settings panel', async () => {
    const preferences = useUiPreferences()
    const wrapper = mountSettingsDialog()

    await openCornerInfoSection(wrapper)

    expect(wrapper.find('[data-testid="settings-corner-typography-slider"]').exists()).toBe(true)
    expect(wrapper.findAll('.corner-info-style-preview-surface')).toHaveLength(2)

    await wrapper.get('[data-testid="settings-corner-typography-slider"]').setValue('1')
    await wrapper.get('[data-testid="settings-corner-color-mode-custom"]').trigger('click')
    await wrapper.findAll('[data-testid="settings-corner-dark-color-preset"]')[2].trigger('click')
    await wrapper.findAll('[data-testid="settings-corner-light-color-preset"]')[3].trigger('click')

    expect(preferences.viewportCornerInfoPreference.value).toMatchObject({
      typographyPreset: 'standard',
      colorMode: 'custom',
      customDarkColor: '#22d3ee',
      customLightColor: '#facc15'
    })

    wrapper.unmount()
  })
})

describe('SidebarSettingsDialog image transport settings', () => {
  beforeEach(() => {
    preferenceStorage.value = null
    const preferences = useUiPreferences()
    preferences.setLocale('en-US')
  })

  it('does not expose the server-controlled 3D transport as a user setting', async () => {
    const wrapper = mountSettingsDialog()

    expect(wrapper.find('[data-testid="settings-3d-transport-webp"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="settings-3d-transport-webrtc"]').exists()).toBe(false)

    wrapper.unmount()
  })
})

describe('SidebarSettingsDialog measurement and annotation settings', () => {
  beforeEach(() => {
    preferenceStorage.value = null
    const preferences = useUiPreferences()
    preferences.setLocale('en-US')
    preferences.setDrawingScopePreference({
      measurement: 'image',
      annotation: 'image',
      qaWater: 'image',
      mtf: 'image'
    })
  })

  it('shows drawing scope controls only for drawings that can span a series', async () => {
    const preferences = useUiPreferences()
    const wrapper = mountSettingsDialog()

    await openMeasurementStyleSection(wrapper)

    expect(wrapper.find('[data-testid="settings-drawing-scope-measurement-series"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-drawing-scope-annotation-series"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-drawing-scope-qaWater-series"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-drawing-scope-mtf-series"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('MTF analysis always remains bound to its source image.')

    await wrapper.get('[data-testid="settings-drawing-scope-annotation-series"]').trigger('click')

    expect(preferences.drawingScopePreference.value).toEqual({
      measurement: 'image',
      annotation: 'series',
      qaWater: 'image',
      mtf: 'image'
    })

    wrapper.unmount()
  })
})
