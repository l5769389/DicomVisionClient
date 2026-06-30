import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SidebarSeriesList from './SidebarSeriesList.vue'
import type { FolderSeriesItem } from '../../types/viewer'

const postApiMock = vi.hoisted(() => vi.fn())
const dispatchWorkspaceStatusToastMock = vi.hoisted(() => vi.fn())
const resolveBackendErrorDetailMock = vi.hoisted(() => vi.fn())
const clearSeriesStarsMock = vi.hoisted(() => vi.fn())
const getStarredSlicesMock = vi.hoisted(() => vi.fn<(seriesId?: string) => Array<{ sliceIndex: number; label?: string }>>(() => []))
const getStarredSliceIndexesMock = vi.hoisted(() => vi.fn<(seriesId?: string) => number[]>(() => []))
const getStarredSliceCountMock = vi.hoisted(() => vi.fn<(seriesId?: string) => number>(() => 0))
const updateSliceStarLabelMock = vi.hoisted(() => vi.fn())

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
              class: ['v-btn-stub', attrs.class],
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
      setup(_, { slots }) {
        return () => h('section', { class: 'v-card-stub' }, slots.default?.())
      }
    }),
    VChip: defineComponent({
      name: 'VChip',
      setup(_, { slots }) {
        return () => h('span', { class: 'v-chip-stub' }, slots.default?.())
      }
    }),
    VDialog: defineComponent({
      name: 'VDialog',
      props: ['modelValue'],
      setup(props, { slots }) {
        return () => (props.modelValue ? h('div', { class: 'v-dialog-stub' }, slots.default?.()) : null)
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

vi.mock('../../services/typedApi', () => ({
  getDicomDeidentifyJob: vi.fn(),
  getDicomDeidentifyJobArtifact: vi.fn(),
  postApi: postApiMock,
  postDicomDeidentifyJob: vi.fn()
}))

vi.mock('../../composables/workspace/tasks/workspaceStatus', () => ({
  dispatchWorkspaceStatusToast: dispatchWorkspaceStatusToastMock,
  resolveBackendErrorDetail: resolveBackendErrorDetailMock
}))

vi.mock('../../composables/workspace/tasks/dicomJobTask', () => ({
  getDicomJobProgress: vi.fn(),
  showDicomJobProgressToast: vi.fn(),
  waitForDicomJob: vi.fn()
}))

vi.mock('../../platform/exporting', () => ({
  saveBinaryFile: vi.fn()
}))

vi.mock('../../composables/workspace/slices/useKeySliceStars', () => ({
  useKeySliceStars: () => ({
    clearSeriesStars: clearSeriesStarsMock,
    getStarredSlices: getStarredSlicesMock,
    getStarredSliceIndexes: getStarredSliceIndexesMock,
    getStarredSliceCount: getStarredSliceCountMock,
    updateSliceStarLabel: updateSliceStarLabelMock
  })
}))

vi.mock('../../composables/ui/useUiPreferences', async () => {
  const { ref } = await import('vue')
  return {
    useUiPreferences: () => ({
      dicomDeidentifyPreference: ref({
        selectedFieldKeys: [],
        replacementPrefix: 'anon'
      }),
      exportPreference: ref({
        locationMode: 'default',
        desktopDirectory: ''
      })
    })
  }
})

vi.mock('../../composables/ui/useUiLocale', async () => {
  const { computed, ref } = await import('vue')
  return {
    useUiLocale: () => ({
      locale: ref('en-US'),
      t: (key: string) =>
        ({
          deleteSeries: 'Remove series from list',
          loadingMoreSeries: 'Loading more series',
          loadingSeries: 'Loading series',
          noSeriesDesc: 'No series',
          quickPreview: 'Quick preview',
          seriesList: 'Series',
          seriesListSubtitle: 'Loaded series',
          unnamedSeries: 'Unnamed series'
        })[key] ?? key,
      viewerCopy: computed(() => ({
        keySliceClearTitle: 'Clear key slices',
        keySliceDialogTitle: 'Key slices',
        keySliceLabel: (sliceNumber: number) => `Slice ${sliceNumber}`,
        keySliceReviewAction: (count: number) => `${count} key slice(s)`,
        keySliceReviewSubtitle: 'Review key slices'
      }))
    })
  }
})

const globalStubs = {
  AppIcon: {
    props: ['name'],
    template: '<span class="app-icon-stub">{{ name }}</span>'
  },
  SeriesListCard: {
    props: ['series', 'selected', 'keySliceCount'],
    emits: ['seriesContextMenu'],
    template: `
      <button class="series-card-stub" type="button" @contextmenu.prevent="$emit('seriesContextMenu', $event, series)">
        {{ series.seriesDescription }}
      </button>
    `
  },
  VBtn: {
    props: ['disabled'],
    emits: ['click'],
    template: `
      <button class="v-btn-stub" type="button" :disabled="disabled" @click="$emit('click', $event)">
        <slot />
      </button>
    `
  },
  VCard: {
    template: '<section class="v-card-stub"><slot /></section>'
  },
  VChip: {
    template: '<span class="v-chip-stub"><slot /></span>'
  },
  VDialog: {
    props: ['modelValue'],
    template: '<div v-if="modelValue" class="v-dialog-stub"><slot /></div>'
  },
  VMenu: {
    props: ['modelValue'],
    template: '<div v-if="modelValue" class="v-menu-stub"><slot /></div>'
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
    seriesDescription: 'CT RGB',
    instanceCount: 1,
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

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

function mountSidebar(seriesList: FolderSeriesItem[] = [createSeries()]) {
  return mount(SidebarSeriesList, {
    props: {
      isLoadingFolder: false,
      selectedSeriesId: '',
      seriesList
    },
    global: {
      stubs: globalStubs
    }
  })
}

async function openCompatibilityAction(wrapper: ReturnType<typeof mountSidebar>) {
  await wrapper.find('.series-card-stub').trigger('contextmenu', {
    clientX: 20,
    clientY: 30
  })
  await nextTick()
  const action = wrapper
    .findAll('button.series-context-menu__item')
    .find((button) => button.text().includes('Compatibility Check') || button.text().includes('CHK'))
  expect(action).toBeTruthy()
  await action!.trigger('click')
  await flushPromises()
}

afterEach(() => {
  delete (window as Window & { viewerApi?: unknown }).viewerApi
  vi.clearAllMocks()
  getStarredSliceIndexesMock.mockImplementation(() => [])
  getStarredSlicesMock.mockImplementation(() => [])
  getStarredSliceCountMock.mockImplementation(() => 0)
  updateSliceStarLabelMock.mockReset()
  resolveBackendErrorDetailMock.mockReset()
})

describe('SidebarSeriesList compatibility check', () => {
  it('opens compatibility check from the series context menu and renders returned details', async () => {
    const deferred = createDeferred<{
      seriesId: string
      issues: NonNullable<FolderSeriesItem['compatibilityIssues']>
    }>()
    postApiMock.mockReturnValueOnce(deferred.promise)
    const wrapper = mountSidebar()

    await openCompatibilityAction(wrapper)

    expect(postApiMock).toHaveBeenCalledWith('CheckDicomCompatibilityApiV1DicomCompatibilityPost', {
      seriesId: 'series-1'
    })
    expect(wrapper.text()).toContain('Checking series compatibility')

    deferred.resolve({
      seriesId: 'series-1',
      issues: [
        {
          code: 'missing-pixel-spacing',
          title: 'Missing Pixel Spacing',
          detail: 'Pixel Spacing is absent.',
          severity: 'warning',
          affectedInstances: 2
        }
      ]
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Missing Pixel Spacing')
    expect(wrapper.text()).toContain('Pixel Spacing is absent.')
    expect(wrapper.text()).toContain('missing-pixel-spacing')
    expect(wrapper.text()).toContain('2 affected instance(s)')

    wrapper.unmount()
  })

  it('renders an empty compatibility result without reusing series summary issue chips', async () => {
    postApiMock.mockResolvedValueOnce({ seriesId: 'series-1', issues: [] })
    const wrapper = mountSidebar([
      createSeries({
        compatibilityIssues: [
          {
            code: 'legacy-summary-issue',
            title: 'Legacy Summary Issue',
            severity: 'warning',
            affectedInstances: 1
          }
        ]
      })
    ])

    await openCompatibilityAction(wrapper)
    await flushPromises()

    expect(wrapper.text()).toContain('No compatibility notices found')
    expect(wrapper.text()).not.toContain('Legacy Summary Issue')

    wrapper.unmount()
  })

  it('renders compatibility check errors and dispatches a status toast', async () => {
    resolveBackendErrorDetailMock.mockReturnValue('Backend down')
    postApiMock.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountSidebar()

    await openCompatibilityAction(wrapper)
    await flushPromises()

    expect(wrapper.text()).toContain('Backend down')
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith('Compatibility check failed', 'error', {
      detail: 'Backend down',
      busy: false,
      durationMs: 8000
    })

    wrapper.unmount()
  })

  it('disables unsupported 3D, 4D, and MPR actions for dose report style series', async () => {
    const wrapper = mountSidebar([
      createSeries({
        seriesDescription: 'Dose Report',
        instanceCount: 1,
        width: 675,
        height: 257
      })
    ])

    await wrapper.find('.series-card-stub').trigger('contextmenu', {
      clientX: 20,
      clientY: 30
    })
    await nextTick()

    const actions = wrapper.findAll('button.series-context-menu__item')
    const mprAction = actions.find((button) => button.text().includes('MPR'))
    const volumeAction = actions.find((button) => button.text().includes('Volume rendering'))
    const fourDAction = actions.find((button) => button.text().includes('Respiratory phase playback'))

    expect(mprAction?.attributes('disabled')).toBeDefined()
    expect(volumeAction?.attributes('disabled')).toBeDefined()
    expect(fourDAction?.attributes('disabled')).toBeDefined()

    await mprAction!.trigger('click')
    expect(wrapper.emitted('openSeriesView')).toBeUndefined()

    wrapper.unmount()
  })

  it('does not render a secondary description for the delete series context action', async () => {
    const wrapper = mountSidebar()

    await wrapper.find('.series-card-stub').trigger('contextmenu', {
      clientX: 20,
      clientY: 30
    })
    await nextTick()

    expect(wrapper.text()).toContain('Remove series from list')
    expect(wrapper.text()).not.toContain('Remove this series from the workspace')

    wrapper.unmount()
  })

  it('merges standalone PET into the 2D context action and opens the PET viewer for PET series', async () => {
    const wrapper = mountSidebar([
      createSeries({
        modality: 'PT',
        seriesDescription: 'PET FDG SUV'
      })
    ])

    await wrapper.find('.series-card-stub').trigger('contextmenu', {
      clientX: 20,
      clientY: 30
    })
    await nextTick()

    const actions = wrapper.findAll('button.series-context-menu__item')
    const twoDimensionalAction = actions.find((button) => button.text().includes('Quick preview') || button.text().includes('2D'))
    expect(twoDimensionalAction).toBeTruthy()
    expect(actions.some((button) => button.text().includes('PET view'))).toBe(false)

    await twoDimensionalAction!.trigger('click')

    expect(wrapper.emitted('openSeriesView')).toEqual([['series-1', 'PET']])
    wrapper.unmount()
  })

  it('opens the series source folder from the desktop context menu', async () => {
    const openPathInFileManager = vi.fn().mockResolvedValue(true)
    ;(window as Window & { viewerApi?: unknown }).viewerApi = {
      openPathInFileManager
    } as unknown as Window['viewerApi']

    const wrapper = mountSidebar([
      createSeries({
        folderPath: 'D:/dicom/source'
      })
    ])

    await wrapper.find('.series-card-stub').trigger('contextmenu', {
      clientX: 20,
      clientY: 30
    })
    await nextTick()

    const action = wrapper
      .findAll('button.series-context-menu__item')
      .find((button) => button.text().includes('Open in Explorer') || button.text().includes('DIR'))
    expect(action).toBeTruthy()
    await action!.trigger('click')
    await flushPromises()

    expect(openPathInFileManager).toHaveBeenCalledWith({
      path: 'D:/dicom/source'
    })
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith('Opened source folder', 'success', {
      detail: 'D:/dicom/source',
      busy: false,
      durationMs: 5000
    })

    wrapper.unmount()
  })

  it('shows loaded favorite slices and opens the selected series slice', async () => {
    getStarredSliceIndexesMock.mockImplementation((seriesId?: string) =>
      seriesId === 'series-1' ? [1] : seriesId === 'series-2' ? [3] : []
    )
    getStarredSlicesMock.mockImplementation((seriesId?: string) =>
      seriesId === 'series-1'
        ? [{ sliceIndex: 1, label: 'Baseline' }]
        : seriesId === 'series-2'
          ? [{ sliceIndex: 3 }]
          : []
    )
    getStarredSliceCountMock.mockImplementation((seriesId?: string) =>
      seriesId === 'series-1' || seriesId === 'series-2' ? 1 : 0
    )
    const wrapper = mountSidebar([
      createSeries({ seriesId: 'series-1', patientName: 'ZHANG^SAN', seriesDescription: 'CT A' }),
      createSeries({ seriesId: 'series-2', patientName: 'LI^SI', seriesDescription: 'CT B' })
    ])

    const action = wrapper.find('[data-testid="series-list-open-all-key-slices"]')
    expect(action.exists()).toBe(true)
    expect(action.text()).toContain('View favorite slices 2')

    await action.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('ZHANG SAN')
    expect(wrapper.text()).toContain('CT A')
    expect(wrapper.text()).toContain('Baseline')
    expect(wrapper.text()).toContain('LI SI')
    expect(wrapper.text()).toContain('CT B')
    expect(wrapper.text()).toContain('Slice 4')

    await wrapper.findAll('.key-slice-dialog__edit-action')[0]!.trigger('click')
    const input = wrapper.find('.key-slice-dialog__label-input')
    expect(input.exists()).toBe(true)
    await input.setValue('Follow up')
    await input.trigger('keydown.enter')
    expect(updateSliceStarLabelMock).toHaveBeenCalledWith('series-1', 1, 'Follow up')

    const clearButton = wrapper.findAll('.v-btn-stub').find((button) => button.text().includes('Clear favorites'))
    expect(clearButton).toBeTruthy()
    await clearButton!.trigger('click')
    expect(clearSeriesStarsMock).toHaveBeenCalledWith('series-1')
    expect(clearSeriesStarsMock).toHaveBeenCalledWith('series-2')

    await wrapper.findAll('.key-slice-dialog__action')[1]!.trigger('click')

    expect(wrapper.emitted('openKeySlice')).toEqual([['series-2', 3]])
    wrapper.unmount()
  })
})
