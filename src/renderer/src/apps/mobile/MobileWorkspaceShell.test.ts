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

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size
      },
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, String(value))
    }
  })
}

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
    height: 512,
    instanceCount: 24,
    isImageSeries: true,
    modality: 'CT',
    seriesDescription: 'CT Demo',
    seriesId: 'series-1',
    width: 512,
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

function createCompareTab(sourceSeriesId = 'series-1', targetSeriesId = 'series-2', overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return createStackTab(sourceSeriesId, {
    compareCornerInfos: {
      'compare-a': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      'compare-b': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] }
    },
    compareImages: {
      'compare-a': 'blob:compare-a',
      'compare-b': 'blob:compare-b'
    },
    compareScaleBars: {
      'compare-a': null,
      'compare-b': null
    },
    compareSeriesIds: {
      'compare-a': sourceSeriesId,
      'compare-b': targetSeriesId
    },
    compareSeriesTitles: {
      'compare-a': 'Source CT',
      'compare-b': 'Target CT'
    },
    compareSliceLabels: {
      'compare-a': '1 / 10',
      'compare-b': '3 / 12'
    },
    compareViewIds: {
      'compare-a': 'compare-view-a',
      'compare-b': 'compare-view-b'
    },
    key: 'compare-tab',
    title: 'Compare',
    viewId: '',
    viewType: 'CompareStack',
    ...overrides
  })
}

function createVolumeTab(seriesId = 'series-1', overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return createStackTab(seriesId, {
    key: 'volume-tab',
    render3dMode: 'volume',
    title: 'CT 3D',
    viewId: 'volume-view',
    viewType: '3D',
    volumePreset: 'volumePreset:bone',
    ...overrides
  })
}

function createFourDTab(seriesId = 'series-1', overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return createMprTab(seriesId, {
    fourDIsPlaying: false,
    fourDPhaseCount: 4,
    fourDPhaseIndex: 1,
    fourDPhaseItems: [
      { phaseIndex: 0, label: 'P1', seriesId: 'phase-1' },
      { phaseIndex: 1, label: 'P2', seriesId: 'phase-2' },
      { phaseIndex: 2, label: 'P3', seriesId: 'phase-3' },
      { phaseIndex: 3, label: 'P4', seriesId: 'phase-4' }
    ],
    fourDPlaybackFps: 2,
    key: 'four-d-tab',
    title: 'CT 4D',
    viewType: '4D',
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
    handleCompareSyncChange: vi.fn(),
    handleHoverViewportChange: vi.fn(),
    handleFourDFpsChange: vi.fn(),
    handleFourDPhaseChange: vi.fn(),
    handleFourDPlaybackChange: vi.fn(),
    handleMprCrosshair: vi.fn(),
    handleTagIndexChange: vi.fn(),
    handleViewportDrag: vi.fn(),
    handleViewportWheel: vi.fn(),
    isLoadingFolder: ref(false),
    isViewLoading: ref(false),
    openSeriesCompare: vi.fn(),
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
        MobileCompareStackViewport: {
          emits: ['activeViewportChange'],
          template: '<div data-testid="mobile-compare-stub"><button data-testid="stub-compare-b" @click="$emit(\'activeViewportChange\', \'compare-b\')">B</button></div>'
        },
        MobileMprViewport: {
          emits: ['activeViewportChange'],
          template: '<div class="mobile-mpr-stub"><button data-testid="stub-mpr-cor" @click="$emit(\'activeViewportChange\', \'mpr-cor\')">COR</button></div>'
        },
        MobileSettingsOverlay: {
          props: ['isOpen'],
          emits: ['close'],
          template: '<div v-if="isOpen" data-testid="mobile-settings-overlay"><button data-testid="mobile-settings-close-stub" @click="$emit(\'close\')">Close</button></div>'
        },
        MobileStackViewport: { template: '<div class="mobile-stack-stub" />' },
        MobileVolumeViewport: {
          emits: ['activeViewportChange'],
          template: '<div class="mobile-volume-stub" data-testid="mobile-volume-stub"><button data-testid="stub-volume-active" @click="$emit(\'activeViewportChange\', \'volume\')">Volume</button></div>'
        }
      }
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  installLocalStorageMock()
  window.localStorage.clear()
  mockViewer = createMockViewer()
  getBackendStatusMock.mockResolvedValue({ origin: 'http://backend.test', ready: true, starting: false, error: null })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('MobileWorkspaceShell', () => {
  it('renders the demo loading entry before any Stack tab is open', () => {
    const wrapper = mountShell()
    expect(wrapper.find('.mobile-shell__primary-action').exists()).toBe(true)
  })

  it('loads the server sample and opens the first series as Stack without hanging protocol', async () => {
    vi.stubEnv('VITE_MOBILE_SAMPLE_MODE', 'server-sample')
    const series = createSeries()
    postApiMock.mockResolvedValue({ seriesList: [series] })
    mockViewer.applyLoadedDicomSeries.mockImplementation(async () => {
      mockViewer.seriesList.value = [series]
      return [series]
    })

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

  it('loads the configured local dev sample path directly in local-path mode', async () => {
    vi.stubEnv('VITE_MOBILE_SAMPLE_MODE', 'local-path')
    vi.stubEnv('VITE_MOBILE_DEV_SAMPLE_DICOM_PATH', 'D:/test/sample')
    const series = createSeries()
    postApiMock.mockResolvedValueOnce({ seriesList: [series] })
    mockViewer.applyLoadedDicomSeries.mockImplementation(async () => {
      mockViewer.seriesList.value = [series]
      return [series]
    })

    const wrapper = mountShell()
    await wrapper.find('.mobile-shell__primary-action').trigger('click')
    await flushPromises()

    expect(postApiMock).toHaveBeenCalledTimes(1)
    expect(postApiMock).toHaveBeenCalledWith('LoadFolderApiV1DicomLoadFolderPost', {
      folderPath: 'D:/test/sample'
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
    await slider.trigger('pointerup')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'single', deltaY: 4 })
  })

  it('keeps slice slider deltas based on local draft values and flushes continuous input once', async () => {
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
    await slider.trigger('pointerup')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledTimes(1)
    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'mpr-cor', deltaY: 4 })
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

  it('offers Stack, MPR, 3D, and 4D open actions from the mobile series sheet', async () => {
    mockViewer.seriesList.value = [createSeries({ fourDPhaseCount: 4, isFourDSeries: true })]
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

    await wrapper.get('[data-testid="mobile-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-3d"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', '3D', { useHangingProtocol: false })
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('volume')

    await wrapper.get('[data-testid="mobile-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-4d"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', '4D', { useHangingProtocol: false })
  })

  it('opens Compare from the mobile series sheet using the current series as source', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'series-1', seriesDescription: 'Source CT' }),
      createSeries({ seriesId: 'series-2', seriesDescription: 'Target CT' })
    ]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1'))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-series-button"]').trigger('click')
    const compareButtons = wrapper.findAll('[data-testid="mobile-open-compare"]')

    expect(compareButtons[0].attributes('disabled')).toBeDefined()
    expect(compareButtons[1].attributes('disabled')).toBeUndefined()

    await compareButtons[1].trigger('click')

    expect(mockViewer.openSeriesCompare).toHaveBeenCalledWith('series-1', 'series-2')
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('compare-a')
  })

  it('uses the active Compare pane for slice slider deltas', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'series-1', seriesDescription: 'Source CT' }),
      createSeries({ seriesId: 'series-2', seriesDescription: 'Target CT' })
    ]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createCompareTab())

    const wrapper = mountShell()
    expect(wrapper.find('[data-testid="mobile-compare-stub"]').exists()).toBe(true)

    await wrapper.get('[data-testid="stub-compare-b"]').trigger('click')

    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('compare-b')

    const slider = wrapper.get('[data-testid="mobile-slice-range"]')
    ;(slider.element as HTMLInputElement).value = '6'
    await slider.trigger('input')
    await slider.trigger('pointerup')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'compare-b', deltaY: 3 })
  })

  it('toggles Compare sync settings from the More sheet', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'series-1', seriesDescription: 'Source CT' }),
      createSeries({ seriesId: 'series-2', seriesDescription: 'Target CT' })
    ]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createCompareTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-compare-sync"]')[0].trigger('click')

    expect(mockViewer.handleCompareSyncChange).toHaveBeenCalledWith({
      tabKey: 'compare-tab',
      key: 'scroll',
      value: false
    })
  })

  it('highlights the active Stack, MPR, 3D, or 4D view action in the series sheet', async () => {
    mockViewer.seriesList.value = [createSeries({ fourDPhaseCount: 4, isFourDSeries: true })]
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

    mockViewer.__setActiveTab(createVolumeTab())
    await flushPromises()
    await wrapper.get('[data-testid="mobile-series-button"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-open-3d"]').attributes('data-active')).toBe('true')

    mockViewer.__setActiveTab(createFourDTab())
    await flushPromises()
    await wrapper.get('[data-testid="mobile-series-button"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-open-4d"]').attributes('data-active')).toBe('true')
  })

  it('renders the mobile 3D viewport and exposes volume render controls', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createVolumeTab())

    const wrapper = mountShell()

    expect(wrapper.find('[data-testid="mobile-volume-stub"]').exists()).toBe(true)
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.rotate3d}`)

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-volume-render-mode"]')[0].trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'render3dMode', value: 'render3dMode:volume' })
  })

  it('uses 4D MPR controls for phase, playback, and active plane scrolling', async () => {
    mockViewer.seriesList.value = [createSeries({ fourDPhaseCount: 4, isFourDSeries: true })]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createFourDTab())

    const wrapper = mountShell()
    const phaseRange = wrapper.get('[data-testid="mobile-four-d-phase-range"]')
    ;(phaseRange.element as HTMLInputElement).value = '3'
    await phaseRange.trigger('input')

    expect(mockViewer.handleFourDPhaseChange).toHaveBeenCalledWith({ tabKey: 'four-d-tab', phaseIndex: 2 })

    await wrapper.get('[data-testid="mobile-tool-play"]').trigger('click')
    expect(mockViewer.handleFourDPlaybackChange).toHaveBeenCalledWith({ tabKey: 'four-d-tab', isPlaying: true })

    await wrapper.get('[data-testid="mobile-mpr-plane-mpr-cor"]').trigger('click')
    const slider = wrapper.get('[data-testid="mobile-slice-range"]')
    ;(slider.element as HTMLInputElement).value = '7'
    await slider.trigger('input')
    await slider.trigger('pointerup')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'mpr-cor', deltaY: 3 })
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
    await slider.trigger('pointerup')

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
    await slider.trigger('pointerup')

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
