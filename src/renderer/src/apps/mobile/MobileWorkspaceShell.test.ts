import { computed, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import MobileWorkspaceShell from './MobileWorkspaceShell.vue'
import type { FolderSeriesItem, ViewerTabItem } from '../../types/viewer'

const postApiMock = vi.fn()
const setApiBaseURLMock = vi.fn()
const getBackendStatusMock = vi.fn()
let mockViewer: ReturnType<typeof createMockViewer>

vi.mock('../../composables/ui/useUiLocale', () => ({
  useUiLocale: () => ({
    locale: ref('zh-CN')
  })
}))

vi.mock('../../composables/ui/useUiPreferences', () => ({
  useUiPreferences: () => ({
    windowPresets: ref([
      {
        id: 'lung',
        source: 'system',
        ww: 1500,
        wl: -600,
        accent: 'linear-gradient(135deg,#6fd3ff,#f7fbff)',
        labels: { 'zh-CN': 'Lung CN', 'en-US': 'Lung' }
      },
      {
        id: 'soft',
        source: 'custom',
        ww: 400,
        wl: 40,
        accent: 'linear-gradient(135deg,#ffd0b6,#ff8452)',
        labels: { 'zh-CN': 'Soft CN', 'en-US': 'Soft Tissue' }
      }
    ]),
    getWindowPresetLabel: (preset: { labels: Record<string, string> }) => preset.labels['zh-CN'],
    locale: ref('zh-CN'),
    selectedPseudocolorKey: ref('bw'),
    selectedWindowPresetId: ref('lung'),
    setLocale: vi.fn(),
    themeId: ref('industrial-utility')
  })
}))

vi.mock('./useMobileViewerPreferences', () => ({
  MOBILE_STACK_PLAYBACK_FPS_OPTIONS: [1, 2, 5, 10, 15, 30],
  useMobileViewerPreferences: () => ({
    defaultShowCornerInfo: ref(true),
    defaultShowScaleBar: ref(true),
    gestureSensitivity: ref('normal'),
    mprDefaultTool: ref('crosshair'),
    mprDefaultViewport: ref('mpr-ax'),
    mprShowReferenceThumbnails: ref(true),
    orientationLock: ref('unlocked'),
    stackDefaultTool: ref('scroll'),
    stackPlaybackFps: ref(5),
    setDefaultShowCornerInfo: vi.fn(),
    setDefaultShowScaleBar: vi.fn(),
    setGestureSensitivity: vi.fn(),
    setMprDefaultTool: vi.fn(),
    setMprDefaultViewport: vi.fn(),
    setMprShowReferenceThumbnails: vi.fn(),
    setOrientationLock: vi.fn(),
    setStackDefaultTool: vi.fn(),
    setStackPlaybackFps: vi.fn()
  })
}))

vi.mock('../../services/api', () => ({
  setApiBaseURL: (...args: unknown[]) => setApiBaseURLMock(...args)
}))

vi.mock('../../services/typedApi', () => ({
  postApi: (...args: unknown[]) => postApiMock(...args)
}))

vi.mock('../../platform/runtime', () => ({
  viewerRuntime: {
    getBackendStatus: (...args: unknown[]) => getBackendStatusMock(...args)
  }
}))

vi.mock('../../composables/workspace/core/useViewerWorkspace', () => ({
  useViewerWorkspace: () => mockViewer
}))

function createSeries(overrides: Partial<FolderSeriesItem> = {}): FolderSeriesItem {
  return {
    instanceCount: 24,
    modality: 'CT',
    seriesDescription: 'CT Demo',
    seriesId: 'series-1',
    ...overrides
  } as FolderSeriesItem
}

function createStackTab(seriesId = 'series-1', overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    activeTool: 'pan',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    imageSrc: 'blob:image',
    key: 'stack-tab',
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    pseudocolorPreset: 'bw',
    scaleBar: null,
    seriesId,
    seriesTitle: 'CT Demo',
    showCornerInfo: true,
    showScaleBar: true,
    sliceLabel: '1 / 24',
    title: 'CT Demo',
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false, zoom: 1, offsetX: 0, offsetY: 0 },
    viewId: 'view-1',
    viewType: 'Stack',
    windowLabel: 'WW 400 WL 40',
    ...overrides
  } as ViewerTabItem
}

function createMprTab(seriesId = 'series-1', overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return createStackTab(seriesId, {
    imageSrc: '',
    key: 'mpr-tab',
    sliceLabel: '',
    title: 'CT MPR',
    viewId: '',
    viewType: 'MPR',
    viewportImages: {
      'mpr-ax': 'blob:ax',
      'mpr-cor': 'blob:cor',
      'mpr-sag': 'blob:sag'
    },
    viewportSliceLabels: {
      'mpr-ax': '2 / 8',
      'mpr-cor': '4 / 12',
      'mpr-sag': '6 / 10'
    },
    viewportViewIds: {
      'mpr-ax': 'view-ax',
      'mpr-cor': 'view-cor',
      'mpr-sag': 'view-sag'
    },
    ...overrides
  })
}

function createTagTab(seriesId = 'series-1', overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return createStackTab(seriesId, {
    imageSrc: '',
    key: 'tag-tab',
    tagIndex: 0,
    tagItems: [
      { depth: 0, keyword: 'PatientName', name: 'Patient Name', tag: '(0010,0010)', value: 'Demo', vr: 'PN' },
      { depth: 0, keyword: 'Modality', name: 'Modality', tag: '(0008,0060)', value: 'CT', vr: 'CS' }
    ],
    tagTotal: 2,
    title: 'DICOM Tag',
    viewId: '',
    viewType: 'Tag',
    ...overrides
  })
}

function createMockViewer() {
  const seriesList = ref<FolderSeriesItem[]>([])
  const selectedSeriesId = ref('')
  const activeTabValue = ref<ViewerTabItem | null>(null)
  return {
    activeOperation: ref(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`),
    activeTab: computed(() => activeTabValue.value),
    activeTabKey: ref(''),
    applyLoadedDicomSeries: vi.fn(),
    closeTab: vi.fn(),
    handleHoverViewportChange: vi.fn(),
    handleMprCrosshair: vi.fn(),
    handleTagIndexChange: vi.fn(),
    handleViewportDrag: vi.fn(),
    handleViewportWheel: vi.fn(),
    isLoadingFolder: ref(false),
    isViewLoading: ref(false),
    openSeriesView: vi.fn(),
    selectSeries: vi.fn((seriesId: string) => {
      selectedSeriesId.value = seriesId
    }),
    selectedSeriesId,
    seriesList,
    setActiveOperation: vi.fn((operation: string) => {
      mockViewer.activeOperation.value = operation
    }),
    setActiveViewportKey: vi.fn(),
    setViewerStage: vi.fn(),
    showStatusToast: vi.fn(),
    statusToast: ref(null),
    dismissStatusToast: vi.fn(),
    triggerViewAction: vi.fn(),
    __setActiveTab: (tab: ViewerTabItem | null) => {
      activeTabValue.value = tab
    }
  }
}

function mountShell() {
  return mount(MobileWorkspaceShell, {
    global: {
      stubs: {
        AppIcon: { props: ['name'], template: '<span class="app-icon-stub">{{ name }}</span>' },
        MobileMprViewport: {
          emits: ['activeViewportChange'],
          template: '<div class="mobile-mpr-stub"><button data-testid="stub-mpr-cor" @click="$emit(\'activeViewportChange\', \'mpr-cor\')">COR</button></div>'
        },
        MobileSettingsOverlay: {
          props: ['isOpen'],
          emits: ['close'],
          template: '<div v-if="isOpen" data-testid="mobile-settings-overlay"><button data-testid="mobile-settings-close-stub" @click="$emit(\'close\')">Close</button></div>'
        },
        MobileStackViewport: { template: '<div class="mobile-stack-stub" />' }
      }
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mockViewer = createMockViewer()
  getBackendStatusMock.mockResolvedValue({ origin: 'http://backend.test', ready: true, starting: false, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('MobileWorkspaceShell', () => {
  it('renders the demo loading entry before any Stack tab is open', () => {
    const wrapper = mountShell()
    expect(wrapper.find('.mobile-shell__primary-action').exists()).toBe(true)
  })

  it('loads the server sample and opens the first series as Stack without hanging protocol', async () => {
    const series = createSeries()
    postApiMock.mockResolvedValue({ seriesList: [series] })
    mockViewer.applyLoadedDicomSeries.mockResolvedValue([series])

    const wrapper = mountShell()
    await wrapper.find('.mobile-shell__primary-action').trigger('click')
    await flushPromises()

    expect(setApiBaseURLMock).toHaveBeenCalledWith('http://backend.test/api/v1')
    expect(postApiMock).toHaveBeenCalledWith('LoadSampleFolderApiV1DicomLoadSamplePost', undefined)
    expect(mockViewer.applyLoadedDicomSeries).toHaveBeenCalledWith(
      { seriesList: [series] },
      { openFirstSeriesView: false, selectLoadedSeries: true }
    )
    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })
  })

  it('falls back to the configured local dev sample path when the server sample path is missing', async () => {
    const series = createSeries()
    postApiMock
      .mockRejectedValueOnce({ response: { data: { detail: 'WEB_SAMPLE_DICOM_PATH is not configured' } } })
      .mockResolvedValueOnce({ seriesList: [series] })
    mockViewer.applyLoadedDicomSeries.mockResolvedValue([series])

    const wrapper = mountShell()
    await wrapper.find('.mobile-shell__primary-action').trigger('click')
    await flushPromises()

    expect(postApiMock).toHaveBeenNthCalledWith(1, 'LoadSampleFolderApiV1DicomLoadSamplePost', undefined)
    expect(postApiMock).toHaveBeenNthCalledWith(2, 'LoadFolderApiV1DicomLoadFolderPost', {
      folderPath: 'D:/testDicom/sample'
    })
    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })
  })

  it('switches bottom toolbar tools through stack operations', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    const windowButton = wrapper.findAll('.mobile-shell__tool')[1]
    await windowButton.trigger('click')

    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.window}`)
  })

  it('uses the slice slider to emit relative Stack scroll deltas', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', { sliceLabel: '3 / 9' }))

    const wrapper = mountShell()
    const slider = wrapper.get('[data-testid="mobile-slice-range"]')
    ;(slider.element as HTMLInputElement).value = '7'
    await slider.trigger('input')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'single', deltaY: 4 })
  })

  it('keeps slice slider deltas based on local draft values during continuous input', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createMprTab('series-1', {
      viewportSliceLabels: {
        'mpr-ax': '2 / 8',
        'mpr-cor': '4 / 12',
        'mpr-sag': '6 / 10'
      }
    }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-mpr-plane-mpr-cor"]').trigger('click')
    const slider = wrapper.get('[data-testid="mobile-slice-range"]')
    ;(slider.element as HTMLInputElement).value = '7'
    await slider.trigger('input')
    ;(slider.element as HTMLInputElement).value = '8'
    await slider.trigger('input')

    expect(mockViewer.handleViewportWheel).toHaveBeenNthCalledWith(1, { viewportKey: 'mpr-cor', deltaY: 3 })
    expect(mockViewer.handleViewportWheel).toHaveBeenNthCalledWith(2, { viewportKey: 'mpr-cor', deltaY: 1 })
    expect((slider.element as HTMLInputElement).value).toBe('8')
  })

  it('opens the More sheet and applies a window preset action', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-window-preset"]').exists()).toBe(true)

    await wrapper.findAll('[data-testid="mobile-window-preset"]')[0].trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'windowPreset', value: '1500|-600' })
  })

  it('switches sheet sections and filters the series list to image series', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'series-1', isImageSeries: true }),
      createSeries({ seriesId: 'sr-1', modality: 'SR', seriesDescription: 'Report', isImageSeries: false })
    ]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-display"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-display-cornerInfo"]').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-sheet-tab-series"]').trigger('click')
    expect(wrapper.findAll('.mobile-shell__series-row')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Report')
  })

  it('toggles mobile display overlays through viewer actions', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', { showCornerInfo: true, showScaleBar: true }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-display"]').trigger('click')
    await wrapper.get('[data-testid="mobile-display-cornerInfo"]').trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({
      action: 'displayOverlay',
      overlay: 'cornerInfo',
      enabled: false
    })
  })

  it('offers Stack and MPR open actions from the mobile series sheet', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-series"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-stack"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })

    await wrapper.get('[data-testid="mobile-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-mpr"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'MPR', { useHangingProtocol: false })
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('mpr-ax')
  })

  it('highlights the active Stack or MPR view action in the series sheet', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-series-button"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-open-stack"]').attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="mobile-open-mpr"]').attributes('data-active')).toBe('false')

    mockViewer.__setActiveTab(createMprTab())
    await flushPromises()
    await wrapper.get('[data-testid="mobile-series-button"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-open-stack"]').attributes('data-active')).toBe('false')
    expect(wrapper.get('[data-testid="mobile-open-mpr"]').attributes('data-active')).toBe('true')
  })

  it('uses the active MPR plane for plane switches and slice slider deltas', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createMprTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-mpr-plane-mpr-cor"]').trigger('click')

    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('mpr-cor')

    const slider = wrapper.get('[data-testid="mobile-slice-range"]')
    ;(slider.element as HTMLInputElement).value = '7'
    await slider.trigger('input')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'mpr-cor', deltaY: 3 })
  })

  it('syncs the active MPR plane when the MPR viewport emits a thumbnail switch', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createMprTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="stub-mpr-cor"]').trigger('click')

    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('mpr-cor')

    const slider = wrapper.get('[data-testid="mobile-slice-range"]')
    ;(slider.element as HTMLInputElement).value = '7'
    await slider.trigger('input')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'mpr-cor', deltaY: 3 })
  })

  it('applies mobile color, transform, and reset actions through the More sheet', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-color"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-pseudocolor"]')[0].trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'pseudocolor', value: 'pseudocolor:blackbody' })

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-transform"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-transform"]')[0].trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'rotate', value: 'rotate:cw90' })

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-display"]').trigger('click')
    await wrapper.get('[data-testid="mobile-reset-view"]').trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'reset' })
  })

  it('plays Stack slices with a front-end timer and stops when the tab changes', async () => {
    vi.useFakeTimers()
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.activeTabKey.value = 'stack-tab'
    mockViewer.__setActiveTab(createStackTab('series-1', { sliceLabel: '1 / 24' }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-play"]').trigger('click')

    vi.advanceTimersByTime(210)
    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'single', deltaY: 1 })

    mockViewer.activeTabKey.value = 'next-tab'
    await flushPromises()
    mockViewer.handleViewportWheel.mockClear()
    vi.advanceTimersByTime(250)

    expect(mockViewer.handleViewportWheel).not.toHaveBeenCalled()
  })

  it('stars the current Stack slice from the transform sheet', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', { sliceLabel: '3 / 9' }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-transform"]').trigger('click')
    await wrapper.get('[data-testid="mobile-toggle-star"]').trigger('click')

    expect(JSON.parse(window.localStorage.getItem('dicomvision-key-slice-stars') ?? '{}')).toEqual({
      'series-1': [2]
    })
  })

  it('opens Tag as a read-only mobile view and pages tag instances', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-tag"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-tag"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Tag', { useHangingProtocol: false })

    mockViewer.__setActiveTab(createTagTab())
    await flushPromises()
    await wrapper.findAll('.mobile-shell__tag-pager button')[1].trigger('click')

    expect(mockViewer.handleTagIndexChange).toHaveBeenCalledWith({ tabKey: 'tag-tab', index: 1 })

    await wrapper.get('[data-testid="mobile-close-tag"]').trigger('click')

    expect(mockViewer.closeTab).toHaveBeenCalledWith('tag-tab')
  })

  it('filters mobile Tag rows by tag metadata and can clear the search', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createTagTab())

    const wrapper = mountShell()

    expect(wrapper.findAll('.mobile-shell__tag-row')).toHaveLength(2)

    await wrapper.get('[data-testid="mobile-tag-search"]').setValue('modality')

    expect(wrapper.findAll('.mobile-shell__tag-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('Modality')
    expect(wrapper.text()).not.toContain('PatientName')

    await wrapper.get('[data-testid="mobile-tag-search-clear"]').trigger('click')

    expect(wrapper.findAll('.mobile-shell__tag-row')).toHaveLength(2)
  })

  it('opens the lightweight mobile settings overlay from the header', async () => {
    const wrapper = mountShell()

    await wrapper.get('[data-testid="mobile-settings-button"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-settings-overlay"]').exists()).toBe(true)
  })
})
