import { computed, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import MobileWorkspaceShell from './MobileWorkspaceShell.vue'
import type { FolderSeriesItem, ViewerTabItem } from '../../types/viewer'

const postApiMock = vi.fn()
const postDicomUploadMock = vi.fn()
const setApiBaseURLMock = vi.fn()
const getBackendStatusMock = vi.fn()
const chooseFolderMock = vi.fn()
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
    locale: ref('zh-CN'),
    workspaceExportCopy: computed(() => ({
      cancel: 'Cancel',
      closeExportNotification: 'Close',
      editNameHint: 'Edit name',
      export: 'Export',
      exportComplete: 'Export complete',
      exportFailed: 'Export failed',
      exportFailedMessage: 'Export failed',
      exportName: 'Export name',
      exportNotCompleted: 'Export not completed',
      invalidFileName: 'Invalid file name',
      openFileLocation: 'Open location',
      openLocationFailed: 'Open location failed',
      sentToDownloads: (formatLabel: string) => `${formatLabel} downloaded`,
      setExportName: 'Set export name',
      unableToExport: 'Unable to export',
      exportedTo: (location: string) => `Exported to ${location}`
    }))
  })
}))

vi.mock('../../components/viewer/overlays/MtfCurveDialog.vue', () => ({
  default: {
    props: ['isOpen', 'mtfItem'],
    emits: ['close'],
    template: '<div v-if="isOpen" data-testid="mobile-mtf-dialog"></div>'
  }
}))

vi.mock('../../components/workspace/VolumeRenderConfigPanel.vue', () => ({
  default: {
    props: ['config'],
    emits: ['close', 'configChange'],
    template: '<div data-testid="mobile-volume-config-panel"><button data-testid="mobile-volume-config-change" @click="$emit(\'configChange\', config)">Config</button></div>'
  }
}))

vi.mock('../../components/workspace/export/WorkspaceExportNameDialog.vue', () => ({
  default: {
    props: ['copy', 'error', 'extension', 'format', 'modelValue'],
    emits: ['cancel', 'confirm', 'update:modelValue', 'update:inputRef'],
    template: '<div data-testid="mobile-export-name-dialog"></div>'
  }
}))

vi.mock('../../components/workspace/export/WorkspaceExportNotice.vue', () => ({
  default: {
    props: ['copy', 'notice'],
    emits: ['close', 'openLocation'],
    template: '<div data-testid="mobile-export-notice"></div>'
  }
}))

vi.mock('../../composables/ui/useUiPreferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../composables/ui/useUiPreferences')>()
  const windowPresets = ref([
    {
      id: 'lung',
      source: 'system' as const,
      ww: 1500,
      wl: -600,
      accent: 'linear-gradient(135deg,#6fd3ff,#f7fbff)',
      labels: { 'zh-CN': 'Lung CN', 'en-US': 'Lung' }
    },
    {
      id: 'soft',
      source: 'custom' as const,
      ww: 400,
      wl: 40,
      accent: 'linear-gradient(135deg,#ffd0b6,#ff8452)',
      labels: { 'zh-CN': 'Soft CN', 'en-US': 'Soft Tissue' }
    }
  ])

  return {
    ...actual,
    useUiPreferences: () => ({
      addCustomWindowPreset: vi.fn(() => 'soft'),
      getWindowPresetLabel: (preset: { labels: Record<string, string> }) => preset.labels['zh-CN'],
      locale: ref('zh-CN'),
      pacsPreference: ref({
        activeProfileId: 'pacs-1',
        enabled: true,
        localSourceEnabled: true,
        profiles: [
          {
            id: 'pacs-1',
            name: 'Demo PACS',
            enabled: true,
            protocol: 'dicomweb'
          }
        ]
      }),
      exportPreference: ref({
        includeDicomAnnotations: true,
        includeDicomMeasurements: true,
        includePngAnnotations: true,
        includePngCornerInfo: true,
        includePngMeasurements: true,
        useDefaultFileName: true
      }),
      qaWaterMetrics: ref([
        { key: 'accuracy', enabled: true },
        { key: 'uniformity', enabled: true },
        { key: 'noise', enabled: true }
      ]),
      removeCustomWindowPresets: vi.fn(),
      roiStatOptions: ref([]),
      selectedPseudocolorKey: ref('bw'),
      selectedWindowPresetId: ref('lung'),
      setLocale: vi.fn(),
      systemWindowPresets: windowPresets.value.filter((preset) => preset.source === 'system'),
      themeId: ref('industrial-utility'),
      viewportCornerInfoPreference: ref({ topLeft: true, topRight: true, bottomLeft: true, bottomRight: true }),
      windowPresets
    })
  }
})

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
    volumeDefaultTool: ref('rotate3d'),
    setDefaultShowCornerInfo: vi.fn(),
    setDefaultShowScaleBar: vi.fn(),
    setGestureSensitivity: vi.fn(),
    setMprDefaultTool: vi.fn(),
    setMprDefaultViewport: vi.fn(),
    setMprShowReferenceThumbnails: vi.fn(),
    setOrientationLock: vi.fn(),
    setStackDefaultTool: vi.fn(),
    setStackPlaybackFps: vi.fn(),
    setVolumeDefaultTool: vi.fn()
  })
}))

vi.mock('../../services/api', () => ({
  setApiBaseURL: (...args: unknown[]) => setApiBaseURLMock(...args)
}))

vi.mock('../../services/typedApi', () => ({
  postApi: (...args: unknown[]) => postApiMock(...args),
  postDicomUpload: (...args: unknown[]) => postDicomUploadMock(...args)
}))

vi.mock('../../platform/runtime', () => ({
  viewerRuntime: {
    canChooseFolder: true,
    chooseFolder: (...args: unknown[]) => chooseFolderMock(...args),
    folderSourceMode: 'web-upload',
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
    handleMtfClear: vi.fn(),
    handleMtfCommit: vi.fn(),
    handleMtfCopy: vi.fn(),
    handleMtfSelect: vi.fn(),
    handleMprCrosshair: vi.fn(),
    handleTagIndexChange: vi.fn(),
    handleMeasurementCreate: vi.fn(),
    handleMeasurementDelete: vi.fn(),
    handleVolumeConfigChange: vi.fn(),
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
        MtfCurveDialog: {
          props: ['isOpen', 'mtfItem'],
          emits: ['close'],
          template: '<div v-if="isOpen" data-testid="mobile-mtf-dialog"></div>'
        },
        VolumeRenderConfigPanel: {
          props: ['config'],
          emits: ['close', 'configChange'],
          template: '<div data-testid="mobile-volume-config-panel"><button data-testid="mobile-volume-config-change" @click="$emit(\'configChange\', config)">Config</button></div>'
        },
        WorkspaceExportNameDialog: {
          props: ['copy', 'error', 'extension', 'format', 'modelValue'],
          emits: ['cancel', 'confirm', 'update:modelValue', 'update:inputRef'],
          template: '<div data-testid="mobile-export-name-dialog"></div>'
        },
        WorkspaceExportNotice: {
          props: ['copy', 'notice'],
          emits: ['close', 'openLocation'],
          template: '<div data-testid="mobile-export-notice"></div>'
        },
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
        PacsBrowserDialog: {
          props: ['isOpen', 'loadedSeriesList'],
          emits: ['close', 'seriesLoaded'],
          template: '<div v-if="isOpen" data-testid="mobile-pacs-dialog"><button data-testid="mobile-pacs-load-stub" @click="$emit(\'seriesLoaded\', { seriesList: [{ seriesId: \'series-pacs\', seriesDescription: \'PACS CT\', modality: \'CT\', instanceCount: 3, isImageSeries: true }] })">Load PACS</button></div>'
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
  it('renders demo, local file, and PACS entries before any Stack tab is open', () => {
    const wrapper = mountShell()
    expect(wrapper.find('[data-testid="mobile-load-demo"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-load-local"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-open-pacs"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mobile-open-pacs"]').attributes('disabled')).toBeUndefined()
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
    await wrapper.get('[data-testid="mobile-load-demo"]').trigger('click')
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
    await wrapper.get('[data-testid="mobile-load-demo"]').trigger('click')
    await flushPromises()

    expect(postApiMock).toHaveBeenCalledTimes(1)
    expect(postApiMock).toHaveBeenCalledWith('LoadFolderApiV1DicomLoadFolderPost', {
      folderPath: 'D:/test/sample'
    })
    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })
  })

  it('loads a local folder from the mobile entry and opens the first Stack series', async () => {
    const file = new File(['dicom'], 'image.dcm', { type: 'application/dicom' })
    const series = createSeries()
    chooseFolderMock.mockResolvedValue({
      kind: 'files',
      files: [{ file, relativePath: 'image.dcm' }]
    })
    postDicomUploadMock.mockResolvedValue({ seriesList: [series] })
    mockViewer.applyLoadedDicomSeries.mockImplementation(async () => {
      mockViewer.seriesList.value = [series]
      return [series]
    })

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-load-local"]').trigger('click')
    await flushPromises()

    expect(chooseFolderMock).toHaveBeenCalledWith('folder')
    expect(postDicomUploadMock).toHaveBeenCalledWith([{ file, relativePath: 'image.dcm' }])
    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })
  })

  it('opens PACS from the mobile entry and opens loaded PACS series as Stack', async () => {
    const series = createSeries({ seriesId: 'series-pacs', seriesDescription: 'PACS CT' })
    mockViewer.applyLoadedDicomSeries.mockImplementation(async () => {
      mockViewer.seriesList.value = [series]
      return [series]
    })

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-open-pacs"]').trigger('click')
    await wrapper.get('[data-testid="mobile-pacs-load-stub"]').trigger('click')
    await flushPromises()

    expect(mockViewer.applyLoadedDicomSeries).toHaveBeenCalledWith(
      { seriesList: [{ seriesId: 'series-pacs', seriesDescription: 'PACS CT', modality: 'CT', instanceCount: 3, isImageSeries: true }] },
      { openFirstSeriesView: false, selectLoadedSeries: true }
    )
    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-pacs', 'Stack', { useHangingProtocol: false })
  })

  it('switches bottom toolbar tools through stack operations', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-window"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-tool-zoom"]').exists()).toBe(false)
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

  it('switches the Window toolbar tool directly', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-window"]').trigger('click')

    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.window}`)
  })

  it('opens focused sheets and filters the series list to image series', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'series-1', isImageSeries: true }),
      createSeries({ seriesId: 'sr-1', modality: 'SR', seriesDescription: 'Report', isImageSeries: false })
    ]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    expect(wrapper.get('[data-testid="mobile-sheet-tab-series"]').text()).toContain('series')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-window"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-display"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-compare"]').exists()).toBe(false)
    expect(wrapper.find('.mobile-shell__sheet-subtitle').exists()).toBe(false)
    expect(wrapper.find('.mobile-shell__window-system-list').exists()).toBe(true)
    await wrapper.get('[data-testid="mobile-sheet-tab-display"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-display-cornerInfo"]').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    expect(wrapper.findAll('.mobile-shell__series-row')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Report')
  })

  it('offers every measurement mode from the mobile measurement sheet', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-measure"]').trigger('click')

    for (const toolType of ['line', 'rect', 'ellipse', 'angle', 'curve', 'freeform']) {
      expect(wrapper.find(`[data-testid="mobile-measure-${toolType}"]`).exists()).toBe(true)
    }

    await wrapper.get('[data-testid="mobile-measure-rect"]').trigger('click')

    expect(mockViewer.setActiveOperation.mock.calls.map(([operation]) => operation)).toContain('measure:rect')
  })

  it('adds mobile Stack annotation/export entries and keeps QA in More', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()

    expect(wrapper.find('[data-testid="mobile-tool-zoom"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-annotate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-qa"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-export"]').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-tool-annotate"]').trigger('click')
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}annotate:arrow`)

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-qa"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-qa-open-mtf"]').exists()).toBe(false)
    await wrapper.findAll('[data-testid="mobile-qa-tool"]')[1].trigger('click')
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}qa:water-phantom`)

    await wrapper.get('[data-testid="mobile-tool-export"]').trigger('click')
    expect(wrapper.findAll('[data-testid="mobile-export-format"]')).toHaveLength(4)
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
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-stack"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })

    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-mpr"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'MPR', { useHangingProtocol: false })
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('mpr-ax')

    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-3d"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', '3D', { useHangingProtocol: false })
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('volume')

    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-4d"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', '4D', { useHangingProtocol: false })
  })

  it('hides unsupported view actions from the mobile series sheet', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-open-stack"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-open-mpr"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-open-3d"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-open-4d"]').exists()).toBe(false)
  })

  it('opens Compare from the mobile series sheet using the current series as source', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'series-1', seriesDescription: 'Source CT' }),
      createSeries({ seriesId: 'series-2', seriesDescription: 'Target CT' })
    ]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1'))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    const rows = wrapper.findAll('.mobile-shell__series-row')
    await rows[0].trigger('click')
    const compareButtons = wrapper.findAll('[data-testid="mobile-open-compare"]')

    expect(compareButtons).toHaveLength(1)
    expect(compareButtons[0].attributes('disabled')).toBeUndefined()

    await compareButtons[0].trigger('click')
    await wrapper.get('[data-testid="mobile-compare-target"]').trigger('click')

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

  it('toggles Compare sync settings from a focused Compare sheet opened via More', async () => {
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
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-open-stack"]').attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="mobile-open-mpr"]').attributes('data-active')).toBe('false')

    mockViewer.__setActiveTab(createMprTab())
    await flushPromises()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-open-stack"]').attributes('data-active')).toBe('false')
    expect(wrapper.get('[data-testid="mobile-open-mpr"]').attributes('data-active')).toBe('true')

    mockViewer.__setActiveTab(createVolumeTab())
    await flushPromises()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-open-3d"]').attributes('data-active')).toBe('true')

    mockViewer.__setActiveTab(createFourDTab())
    await flushPromises()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-open-4d"]').attributes('data-active')).toBe('true')
  })

  it('renders the mobile 3D viewport and exposes volume render controls', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createVolumeTab())

    const wrapper = mountShell()

    expect(wrapper.find('[data-testid="mobile-volume-stub"]').exists()).toBe(true)
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.rotate3d}`)
    expect(wrapper.find('[data-testid="mobile-tool-zoom"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-measure"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-transform"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-volumeParams"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-export"]').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-tool-color"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-volume-render-mode"]')[0].trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'render3dMode', value: 'render3dMode:volume' })

    await wrapper.get('[data-testid="mobile-tool-volumeParams"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-volume-config-panel"]').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-tool-export"]').trigger('click')
    expect(wrapper.findAll('[data-testid="mobile-export-format"]')).toHaveLength(2)
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

    await wrapper.get('[data-testid="mobile-slice-play"]').trigger('click')
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

  it('applies mobile color, transform, and reset actions through focused toolbar entries', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-color"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-window"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="mobile-pseudocolor"]').length).toBeGreaterThan(0)
    await wrapper.findAll('[data-testid="mobile-pseudocolor"]')[0].trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'pseudocolor', value: 'pseudocolor:blackbody' })

    await wrapper.get('[data-testid="mobile-tool-transform"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-transform"]')[0].trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'rotate', value: 'rotate:cw90' })

    await wrapper.get('[data-testid="mobile-tool-reset"]').trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'reset' })
  })

  it('plays Stack slices with a front-end timer and stops when the tab changes', async () => {
    vi.useFakeTimers()
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.activeTabKey.value = 'stack-tab'
    mockViewer.__setActiveTab(createStackTab('series-1', { sliceLabel: '1 / 24' }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-slice-play"]').trigger('click')

    vi.advanceTimersByTime(210)
    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'single', deltaY: 1 })

    mockViewer.activeTabKey.value = 'next-tab'
    await flushPromises()
    mockViewer.handleViewportWheel.mockClear()
    vi.advanceTimersByTime(250)

    expect(mockViewer.handleViewportWheel).not.toHaveBeenCalled()
  })

  it('plays the active MPR viewport with the front-end timer', async () => {
    vi.useFakeTimers()
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.activeTabKey.value = 'mpr-tab'
    mockViewer.__setActiveTab(createMprTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-slice-play"]').trigger('click')

    vi.advanceTimersByTime(210)
    expect(mockViewer.handleViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-ax', deltaY: 1 })

    mockViewer.handleViewportWheel.mockClear()
    await wrapper.get('[data-testid="mobile-mpr-plane-mpr-cor"]').trigger('click')
    vi.advanceTimersByTime(210)

    expect(mockViewer.handleViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-cor', deltaY: 1 })
  })

  it('uses a discrete FPS slider in the mobile playback sheet', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', { sliceLabel: '1 / 24' }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-playback"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-playback-fps"]').exists()).toBe(false)

    const slider = wrapper.get('[data-testid="mobile-playback-fps-slider"]')
    ;(slider.element as HTMLInputElement).value = '4'
    await slider.trigger('input')

    expect((slider.element as HTMLInputElement).value).toBe('4')
    expect(wrapper.get('[data-testid="mobile-playback-fps-control"]').text()).toContain('15 FPS')
  })

  it('stars the current Stack slice from the slice panel star control', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', { sliceLabel: '3 / 9' }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-toggle-star"]').trigger('click')

    expect(JSON.parse(window.localStorage.getItem('dicomvision-key-slice-stars') ?? '{}')).toEqual({
      'series-1': [2]
    })
  })

  it('shows all favorite DICOM slices from the More sheet', async () => {
    window.localStorage.setItem('dicomvision-key-slice-stars', JSON.stringify({ 'series-1': [4] }))
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', { sliceLabel: '1 / 9' }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-favorites"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-favorites-summary"]').text()).toContain('1')
    expect(wrapper.findAll('[data-testid="mobile-favorite-slice"]')).toHaveLength(1)

    await wrapper.get('[data-testid="mobile-open-favorite-slice"]').trigger('click')
    await flushPromises()

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })
    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'single', deltaY: 4 })

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-favorites"]').trigger('click')
    await wrapper.get('[data-testid="mobile-remove-favorite-slice"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-favorites-empty"]').exists()).toBe(true)
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
