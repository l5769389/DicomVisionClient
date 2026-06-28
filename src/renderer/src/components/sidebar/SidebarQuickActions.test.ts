import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SidebarQuickActions from './SidebarQuickActions.vue'
import type { FolderSeriesItem } from '../../types/viewer'

const pwaCanInstallMock = vi.hoisted(() => ({ value: false }))
const pwaIsInstalledMock = vi.hoisted(() => ({ value: false }))
const promptInstallMock = vi.hoisted(() => vi.fn(() => Promise.resolve('accepted')))

vi.mock('vuetify/components', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    VBtn: defineComponent({
      name: 'VBtn',
      props: ['disabled'],
      emits: ['click'],
      setup(props, { attrs, emit, slots }) {
        return () =>
          h(
            'button',
            {
              ...attrs,
              disabled: props.disabled,
              type: 'button',
              onClick: (event: MouseEvent) => emit('click', event)
            },
            slots.default?.()
          )
      }
    }),
    VCard: defineComponent({
      name: 'VCard',
      setup(_, { attrs, slots }) {
        return () => h('section', attrs, slots.default?.())
      }
    }),
    VMenu: defineComponent({
      name: 'VMenu',
      setup(_, { slots }) {
        return () => [
          slots.activator?.({ props: {} }),
          slots.default?.()
        ]
      }
    })
  }
})

vi.mock('../../composables/ui/useUiLocale', async () => {
  const { ref } = await import('vue')
  return {
    useUiLocale: () => ({
      locale: ref('en-US'),
      t: (key: string) =>
        ({
          loadFolder: 'Load folder',
          loadSample: 'Load sample',
          quickPreview: 'Quick preview',
          uploadDicom: 'Upload DICOM',
          uploadFiles: 'Upload files',
          uploadFilesHint: 'Choose DICOM files',
          uploadFolder: 'Upload folder',
          uploadFolderHint: 'Choose a DICOM folder'
        })[key] ?? key
    })
  }
})

vi.mock('../../utils/svg', () => ({
  normalizeInlineSvg: () => '<svg />'
}))

vi.mock('../../assets/dicom-action-icons/dicom-file.svg?raw', () => ({
  default: '<svg />'
}))

vi.mock('../../platform/pwaInstall', () => ({
  canInstall: pwaCanInstallMock,
  isInstalled: pwaIsInstalledMock,
  promptInstall: promptInstallMock
}))

const globalStubs = {
  AppIcon: {
    props: ['name'],
    template: '<span class="app-icon-stub">{{ name }}</span>'
  }
}

function createSeries(overrides: Partial<FolderSeriesItem> = {}): FolderSeriesItem {
  return {
    seriesId: 'series-1',
    seriesInstanceUid: '1.2.3.series',
    studyInstanceUid: '1.2.3.study',
    patientId: 'PID',
    patientName: 'Patient',
    studyDate: '20260530',
    studyDescription: 'Study',
    accessionNumber: 'ACC',
    modality: 'CT',
    seriesDescription: 'CT Volume',
    instanceCount: 80,
    width: 512,
    height: 512,
    thumbnailSrc: '',
    thumbnailUrl: '',
    folderPath: '.',
    isImageSeries: true,
    standardObjectType: null,
    preferredViewType: null,
    compatibilityIssues: [],
    ...overrides
  }
}

function mountQuickActions(
  selectedSeries: FolderSeriesItem | null,
  overrides: Partial<{
    viewerFolderSourceMode: 'desktop-picker' | 'web-upload' | 'server-sample'
    viewerPlatform: 'desktop' | 'web'
  }> = {}
) {
  return mount(SidebarQuickActions, {
    props: {
      hasSelectedSeries: Boolean(selectedSeries),
      isSelectedSeriesFourD: false,
      selectedSeries,
      viewerFolderSourceMode: 'desktop-picker',
      viewerPlatform: 'desktop',
      ...overrides
    },
    global: {
      stubs: globalStubs
    }
  })
}

afterEach(() => {
  pwaCanInstallMock.value = false
  pwaIsInstalledMock.value = false
  promptInstallMock.mockClear()
})

describe('SidebarQuickActions', () => {
  it('uses the 2D action to open the PET viewer for PET series without showing a PET action', async () => {
    const wrapper = mountQuickActions(createSeries({ modality: 'PT', seriesDescription: 'PET FDG SUV' }))
    const labels = wrapper.findAll('.quick-action-label').map((label) => label.text())

    expect(labels).toContain('2D')
    expect(labels).not.toContain('PET')

    await wrapper.findAll('button.quick-action-button--secondary')[0]!.trigger('click')

    expect(wrapper.emitted('openView')).toEqual([['PET']])
    wrapper.unmount()
  })

  it('uses the same 2D action to open Stack for non-PET image series', async () => {
    const wrapper = mountQuickActions(createSeries({ modality: 'CT' }))

    await wrapper.findAll('button.quick-action-button--secondary')[0]!.trigger('click')

    expect(wrapper.emitted('openView')).toEqual([['Stack']])
    wrapper.unmount()
  })

  it('shows and triggers the install app action when the web app can be installed', async () => {
    pwaCanInstallMock.value = true
    const wrapper = mountQuickActions(null, {
      viewerFolderSourceMode: 'web-upload',
      viewerPlatform: 'web'
    })

    const installAction = wrapper.get('[data-testid="quick-actions-install-app"]')
    expect(installAction.text()).toContain('Install app')
    expect(installAction.find('.app-icon-stub').text()).toBe('install-app')

    await installAction.trigger('click')

    expect(promptInstallMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('hides the install app action outside installable web mode', () => {
    pwaCanInstallMock.value = true
    const desktopWrapper = mountQuickActions(null)
    expect(desktopWrapper.find('[data-testid="quick-actions-install-app"]').exists()).toBe(false)
    desktopWrapper.unmount()

    pwaIsInstalledMock.value = true
    const installedWebWrapper = mountQuickActions(null, {
      viewerFolderSourceMode: 'web-upload',
      viewerPlatform: 'web'
    })
    expect(installedWebWrapper.find('[data-testid="quick-actions-install-app"]').exists()).toBe(false)
    installedWebWrapper.unmount()
  })
})
