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
const mockLocale = vi.hoisted(() => ({ value: 'zh-CN' }))
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
    locale: mockLocale,
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

vi.mock('../../components/workspace/SurfaceRenderConfigPanel.vue', () => ({
  default: {
    props: ['config'],
    emits: ['close', 'configChange'],
    template: '<div data-testid="mobile-surface-config-panel"><button data-testid="mobile-surface-config-change" @click="$emit(\'configChange\', config)">Config</button></div>'
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
      locale: mockLocale,
      mprSegmentationStylePreference: ref({
        thresholdColor: '#ff4df8',
        voiColor: '#22d3ee'
      }),
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
      viewportCornerInfoPreference: ref({
        topLeft: ['patientName'],
        topRight: ['patientSummary'],
        bottomLeft: ['windowLevel'],
        bottomRight: ['zoom'],
        typographyPreset: 'comfortable',
        colorMode: 'auto',
        customDarkColor: '#f8fafc',
        customLightColor: '#182334'
      }),
      windowPresets
    })
  }
})

vi.mock('./useMobileViewerPreferences', () => ({
  MOBILE_STACK_PLAYBACK_FPS_OPTIONS: [1, 2, 5, 10, 15, 30],
  useMobileViewerPreferences: () => ({
    defaultShowCornerInfo: ref(true),
    defaultShowPseudocolorBar: ref(true),
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
    setDefaultShowPseudocolorBar: vi.fn(),
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

vi.mock('../../services/apiBase', () => ({
  getApiBaseURL: () => 'http://127.0.0.1:8000',
  getBackendOrigin: () => 'http://127.0.0.1:8000',
  onApiBaseURLChange: vi.fn(() => vi.fn()),
  resolveBackendAssetUrl: (url: string) => url,
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

function createPetTab(seriesId = 'pet-series', overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return createStackTab(seriesId, {
    key: 'pet-tab',
    seriesTitle: 'PET Demo',
    title: 'PET Demo',
    viewId: 'pet-view',
    viewType: 'PET',
    ...overrides
  })
}

function createFusionTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return createStackTab('ct-series', {
    fusionCornerInfos: {
      'fusion-ct-ax': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      'fusion-pet-ax': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      'fusion-overlay-ax': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
      'fusion-pet-cor-mip': { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] }
    },
    fusionImages: {
      'fusion-ct-ax': 'blob:ct',
      'fusion-pet-ax': 'blob:pet',
      'fusion-overlay-ax': 'blob:fusion',
      'fusion-pet-cor-mip': 'blob:mip'
    },
    fusionManualRegistration: false,
    fusionPseudocolorPresets: {
      'fusion-ct-ax': 'petct-rainbow',
      'fusion-pet-ax': 'petct-rainbow',
      'fusion-overlay-ax': 'petct-rainbow',
      'fusion-pet-cor-mip': 'petct-rainbow'
    },
    fusionScaleBars: {
      'fusion-ct-ax': null,
      'fusion-pet-ax': null,
      'fusion-overlay-ax': null,
      'fusion-pet-cor-mip': null
    },
    fusionSeriesIds: {
      ctSeriesId: 'ct-series',
      petSeriesId: 'pet-series'
    },
    fusionSliceLabels: {
      'fusion-ct-ax': '1 / 10',
      'fusion-pet-ax': '2 / 20',
      'fusion-overlay-ax': '1 / 10',
      'fusion-pet-cor-mip': '1 / 1'
    },
    fusionViewIds: {
      'fusion-ct-ax': 'fusion-ct',
      'fusion-pet-ax': 'fusion-pet',
      'fusion-overlay-ax': 'fusion-overlay',
      'fusion-pet-cor-mip': 'fusion-mip'
    },
    key: 'fusion-tab',
    title: 'PET/CT Fusion',
    viewId: '',
    viewType: 'PETCTFusion',
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
    handleFusionRegistrationDrag: vi.fn(),
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
    handleSurfaceConfigChange: vi.fn(),
    handleViewportDrag: vi.fn(),
    handleViewportWheel: vi.fn(),
    handleVolumeClip: vi.fn(),
    isLoadingFolder: ref(false),
    isViewLoading: ref(false),
    openLayoutView: vi.fn(),
    openSeriesCompare: vi.fn(),
    openPetCtFusion: vi.fn(),
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
        SurfaceRenderConfigPanel: {
          props: ['config'],
          emits: ['close', 'configChange'],
          template: '<div data-testid="mobile-surface-config-panel"><button data-testid="mobile-surface-config-change" @click="$emit(\'configChange\', config)">Config</button></div>'
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
          emits: ['activeViewportChange', 'mprSegmentationConfigChange', 'mprSegmentationModeChange'],
          template: '<div class="mobile-mpr-stub"><button data-testid="stub-mpr-cor" @click="$emit(\'activeViewportChange\', \'mpr-cor\')">COR</button><button data-testid="stub-mpr-seg-mode" @click="$emit(\'mprSegmentationModeChange\', \'segmentation:threshold\', \'mpr-ax\')">Seg</button></div>'
        },
        MobilePetCtFusionViewport: {
          emits: ['activeViewportChange', 'fusionRegistrationDrag'],
          template: '<div data-testid="mobile-fusion-stub"><button data-testid="stub-fusion-pet" @click="$emit(\'activeViewportChange\', \'fusion-pet-ax\')">PET</button><button data-testid="stub-fusion-drag" @click="$emit(\'fusionRegistrationDrag\', { viewportKey: \'fusion-overlay-ax\', phase: \'move\', subOpType: \'translate\', deltaX: 3, deltaY: 4 })">Drag</button></div>'
        },
        MprSegmentationPanel: {
          props: {
            config: { type: Object, required: true },
            embedded: Boolean,
            mobile: Boolean
          },
          emits: ['close', 'configChange', 'modeChange'],
          template: '<div data-testid="mobile-segmentation-panel" :data-embedded="embedded ? \'true\' : \'false\'" :data-mobile="mobile ? \'true\' : \'false\'"><button data-testid="mobile-segmentation-config-change" @click="$emit(\'configChange\', config, \'local\')">Config</button><button data-testid="mobile-segmentation-mode-change" @click="$emit(\'modeChange\', \'segmentation:voi\', \'mpr-cor\')">Mode</button></div>'
        },
        MobileSettingsOverlay: {
          props: ['isOpen'],
          emits: ['close', 'orientationLockRequest'],
          template: '<div v-if="isOpen" data-testid="mobile-settings-overlay"><button data-testid="mobile-settings-close-stub" @click="$emit(\'close\')">Close</button><button data-testid="mobile-settings-landscape-stub" @click="$emit(\'orientationLockRequest\', \'landscape\')">Landscape</button></div>'
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
  mockLocale.value = 'zh-CN'
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
    expect(wrapper.find('[data-testid="mobile-brand-title"]').text()).toContain('DicomVision')
    expect(wrapper.find('[data-testid="mobile-title-series-button"]').exists()).toBe(false)
    expect(wrapper.find('.mobile-shell__eyebrow').exists()).toBe(false)
    expect(wrapper.find('.mobile-shell__empty-title').text()).toBe('DicomVision')
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

  it('defaults mobile demo loading to the server sample instead of a dev local path', async () => {
    vi.stubEnv('VITE_MOBILE_SAMPLE_MODE', '')
    vi.stubEnv('VITE_MOBILE_DEV_SAMPLE_DICOM_PATH', 'D:/test/sample')
    const series = createSeries()
    postApiMock.mockResolvedValue({ seriesList: [series] })
    mockViewer.applyLoadedDicomSeries.mockImplementation(async () => {
      mockViewer.seriesList.value = [series]
      return [series]
    })

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-load-demo"]').trigger('click')
    await flushPromises()

    expect(postApiMock).toHaveBeenCalledWith('LoadSampleFolderApiV1DicomLoadSamplePost', undefined)
    expect(postApiMock).not.toHaveBeenCalledWith('LoadFolderApiV1DicomLoadFolderPost', {
      folderPath: 'D:/test/sample'
    })
    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })
  })

  it('opens the first loaded PET series as Stack on mobile', async () => {
    vi.stubEnv('VITE_MOBILE_SAMPLE_MODE', 'server-sample')
    const series = createSeries({ modality: 'PT', seriesId: 'pet-series', seriesDescription: 'PET Demo' })
    postApiMock.mockResolvedValue({ seriesList: [series] })
    mockViewer.applyLoadedDicomSeries.mockImplementation(async () => {
      mockViewer.seriesList.value = [series]
      return [series]
    })

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-load-demo"]').trigger('click')
    await flushPromises()

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('pet-series', 'Stack', { useHangingProtocol: false })
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

  it('keeps local folder and PACS load actions fixed in the loaded series sheet', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())
    chooseFolderMock.mockResolvedValue(null)

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')

    expect(wrapper.findAll('.mobile-shell__series-row')).toHaveLength(1)
    expect(wrapper.find('.mobile-shell__series-footer').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-series-load-local"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-series-open-pacs"]').exists()).toBe(true)
    expect(wrapper.find('.mobile-shell__sheet-content [data-testid="mobile-series-load-local"]').exists()).toBe(false)

    await wrapper.get('[data-testid="mobile-series-load-local"]').trigger('click')
    await flushPromises()
    expect(chooseFolderMock).toHaveBeenCalledWith('folder')

    await wrapper.get('[data-testid="mobile-series-open-pacs"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-pacs-dialog"]').exists()).toBe(true)
  })

  it('keeps the active image unchanged when selecting a series row without choosing a view', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'series-1', seriesDescription: 'Primary CT' }),
      createSeries({ seriesId: 'series-2', seriesDescription: 'Follow-up CT' })
    ]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createMprTab('series-1'))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    mockViewer.selectSeries.mockClear()
    mockViewer.openSeriesView.mockClear()

    await wrapper.findAll('.mobile-shell__series-row')[1].trigger('click')
    await flushPromises()

    expect(mockViewer.selectSeries).not.toHaveBeenCalled()
    expect(mockViewer.openSeriesView).not.toHaveBeenCalled()
    expect(wrapper.find('.mobile-shell__sheet').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-series"]').classes()).toContain('mobile-shell__sheet-tab--active')
    expect(wrapper.findAll('.mobile-shell__series-row')[1].classes()).toContain('mobile-shell__series-row--active')
    expect(wrapper.findAll('.mobile-shell__series-row')[1].get('[data-testid="mobile-open-stack"]').attributes('data-active')).toBe('false')

    await wrapper.findAll('.mobile-shell__series-row')[1].get('[data-testid="mobile-open-stack"]').trigger('click')
    await flushPromises()

    expect(mockViewer.selectSeries).toHaveBeenCalledWith('series-2')
    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-2', 'Stack', { useHangingProtocol: false })
  })

  it('records recently opened mobile views and lets users reopen or delete them', async () => {
    mockViewer.seriesList.value = [createSeries({ seriesId: 'series-1', seriesDescription: 'Primary CT' })]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', { seriesTitle: 'Primary CT', title: 'Primary CT' }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-history"]').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-open-stack"]').trigger('click')
    await flushPromises()

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })

    mockViewer.openSeriesView.mockClear()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-history"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-history-summary"]').text()).toContain('1')
    expect(wrapper.get('[data-testid="mobile-history-record"]').text()).toContain('Primary CT')
    expect(wrapper.get('[data-testid="mobile-history-record"]').text()).toContain('2D')

    await wrapper.get('[data-testid="mobile-open-history-record"]').trigger('click')
    await flushPromises()

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('series-1', 'Stack', { useHangingProtocol: false })

    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-history"]').trigger('click')
    await wrapper.get('[data-testid="mobile-remove-history-record"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-history-empty"]').exists()).toBe(true)
  })

  it('switches bottom toolbar tools through stack operations', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-window"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-tool-zoom"]').exists()).toBe(true)
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.window}`)
  })

  it('exposes zoom as a direct toolbar operation across mobile image views', async () => {
    const cases: Array<{ tab: ViewerTabItem; series: FolderSeriesItem[] }> = [
      { tab: createStackTab(), series: [createSeries()] },
      { tab: createPetTab(), series: [createSeries({ modality: 'PT', seriesId: 'pet-series' })] },
      { tab: createMprTab(), series: [createSeries()] },
      { tab: createFourDTab(), series: [createSeries({ fourDPhaseCount: 4, isFourDSeries: true })] },
      { tab: createFusionTab(), series: [createSeries({ seriesId: 'ct-series', modality: 'CT' }), createSeries({ seriesId: 'pet-series', modality: 'PT' })] },
      { tab: createVolumeTab(), series: [createSeries()] }
    ]

    for (const item of cases) {
      mockViewer.seriesList.value = item.series
      mockViewer.selectedSeriesId.value = item.tab.seriesId
      mockViewer.__setActiveTab(item.tab)
      mockViewer.setActiveOperation.mockClear()

      const wrapper = mountShell()
      await wrapper.get('[data-testid="mobile-tool-zoom"]').trigger('click')

      expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.zoom}`)
      wrapper.unmount()
    }
  })

  it('opens PET from the selected PET series 2D action', async () => {
    mockViewer.seriesList.value = [createSeries({ modality: 'PT', seriesId: 'pet-series', seriesDescription: 'PET Demo' })]
    mockViewer.selectedSeriesId.value = 'pet-series'
    mockViewer.__setActiveTab(createPetTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    expect(wrapper.get('[data-testid="mobile-open-pet"]').text()).toBe('2D')
    await wrapper.get('[data-testid="mobile-open-pet"]').trigger('click')

    expect(mockViewer.openSeriesView).toHaveBeenCalledWith('pet-series', 'PET', { useHangingProtocol: false })
  })

  it('auto-opens PET/CT fusion when a selected series has one compatible pair', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'ct-series', modality: 'CT', studyInstanceUid: 'study-1' }),
      createSeries({ seriesId: 'pet-series', modality: 'PT', studyInstanceUid: 'study-1' })
    ]
    mockViewer.selectedSeriesId.value = 'ct-series'
    mockViewer.__setActiveTab(createStackTab('ct-series'))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-open-petct-fusion"]').trigger('click')

    expect(mockViewer.openPetCtFusion).toHaveBeenCalledWith('ct-series', 'pet-series')
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('fusion-overlay-ax')
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

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'single', deltaY: 4, exact: true })
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
    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'mpr-cor', deltaY: 4, exact: true })
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
    expect(wrapper.get('.mobile-shell__sheet').classes()).toContain('mobile-shell__sheet--presentation-menu')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-history"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mobile-sheet-tab-series"]').text()).toContain('series')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-window"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-display"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-compare"]').exists()).toBe(false)
    expect(wrapper.find('.mobile-shell__sheet-subtitle').exists()).toBe(false)
    expect(wrapper.find('.mobile-shell__window-system-list').exists()).toBe(true)
    await wrapper.get('[data-testid="mobile-sheet-tab-display"]').trigger('click')
    expect(wrapper.get('.mobile-shell__sheet').classes()).toContain('mobile-shell__sheet--presentation-menu')
    expect(wrapper.find('[data-testid="mobile-display-cornerInfo"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-display-pseudocolorBar"]').exists()).toBe(true)

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

    expect(wrapper.get('[data-testid="mobile-inline-tool-panel"]').classes()).toContain('mobile-shell__inline-tool-panel--icon-only')
    expect(mockViewer.setActiveOperation.mock.calls.map(([operation]) => operation)).toContain('measure:line')
    expect(wrapper.get('[data-testid="mobile-tool-measure-line"]').classes()).toContain('mobile-shell__inline-tool--active')
    expect(wrapper.get('[data-testid="mobile-tool-measure-line"]').attributes('aria-label')).toBeTruthy()
    expect(wrapper.get('[data-testid="mobile-tool-measure-line"]').attributes('title')).toBe(wrapper.get('[data-testid="mobile-tool-measure-line"]').attributes('aria-label'))
    expect(wrapper.findAll('.mobile-shell__inline-tool--active')).toHaveLength(1)
    expect(wrapper.findAll('.mobile-shell__tool--active')).toHaveLength(1)
    expect(wrapper.get('[data-testid="mobile-tool-measure"]').classes()).toContain('mobile-shell__tool--active')

    for (const toolType of ['line', 'rect', 'ellipse', 'angle', 'curve', 'freeform']) {
      expect(wrapper.find(`[data-testid="mobile-tool-measure-${toolType}"]`).exists()).toBe(true)
    }

    await wrapper.get('[data-testid="mobile-tool-measure-rect"]').trigger('click')

    expect(mockViewer.setActiveOperation.mock.calls.map(([operation]) => operation)).toContain('measure:rect')
    expect(wrapper.findAll('.mobile-shell__inline-tool--active')).toHaveLength(1)
    expect(wrapper.get('[data-testid="mobile-tool-measure-rect"]').classes()).toContain('mobile-shell__inline-tool--active')

    await wrapper.get('[data-testid="mobile-tool-pan"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(false)
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.pan}`)
    expect(wrapper.get('[data-testid="mobile-tool-pan"]').classes()).toContain('mobile-shell__tool--active')
  })

  it('keeps Stack primary tools common and moves measure, annotate, export, and QA into the lower/more tiers', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    const toolbarRows = wrapper.findAll('.mobile-shell__toolbar-row')
    const primaryToolbarIds = toolbarRows[0].findAll('button').map((button) => button.attributes('data-testid'))
    const secondaryToolbarIds = toolbarRows[1].findAll('button').map((button) => button.attributes('data-testid'))

    expect(primaryToolbarIds).toEqual([
      'mobile-tool-window',
      'mobile-tool-pan',
      'mobile-tool-zoom',
      'mobile-tool-scroll',
      'mobile-tool-measure'
    ])
    expect(secondaryToolbarIds).toEqual([
      'mobile-tool-play',
      'mobile-tool-annotate',
      'mobile-tool-color',
      'mobile-tool-transform',
      'mobile-more-button',
      'mobile-tool-reset'
    ])
    expect(wrapper.get('[data-testid="mobile-more-button"] .app-icon-stub').text()).toBe('dots-horizontal')
    expect(wrapper.find('[data-testid="mobile-tool-qa"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-export"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-tag"]').exists()).toBe(false)

    await wrapper.get('[data-testid="mobile-tool-play"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-inline-playback-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-inline-playback-fps-slider"]').exists()).toBe(true)
    await wrapper.get('[data-testid="mobile-inline-tool-back"]').trigger('click')

    await wrapper.get('[data-testid="mobile-tool-annotate"]').trigger('click')
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}annotate:arrow`)

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-measure"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-annotate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-export"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-tag"]').exists()).toBe(true)
    await wrapper.get('[data-testid="mobile-sheet-tab-qa"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-qa-open-mtf"]').exists()).toBe(false)
    await wrapper.findAll('[data-testid="mobile-qa-tool"]')[1].trigger('click')
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}qa:water-phantom`)

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-export"]').trigger('click')
    expect(wrapper.findAll('[data-testid="mobile-export-format"]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="mobile-sheet-title-icon"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="mobile-export-row-icon"]')).toHaveLength(0)

    await wrapper.get('[data-testid="mobile-sheet-tab-annotate"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-annotate-arrow"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-annotate-clear"]').exists()).toBe(true)
  })

  it('keeps mobile reset and clear actions in fixed sheet footers', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', {
      initialWindowInfo: { ww: 350, wl: 45 }
    }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-sheet-footer-actions"]').exists()).toBe(true)
    const windowPanel = wrapper.get('.mobile-shell__window-panel')
    const windowScroll = wrapper.get('.mobile-shell__window-panel .mobile-shell__sheet-scroll')
    const windowFooter = wrapper.get('[data-testid="mobile-sheet-footer-actions"]')
    expect(windowPanel.element.lastElementChild).toBe(windowFooter.element)
    expect(windowFooter.element.previousElementSibling).toBe(windowScroll.element)
    expect(wrapper.find('[data-testid="mobile-window-custom-dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-window-custom-zh"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="mobile-window-add-custom"]').classes()).toContain('mobile-shell__footer-action')
    expect(wrapper.get('[data-testid="mobile-window-add-custom"]').classes()).toContain('mobile-shell__footer-action--primary')
    await wrapper.get('[data-testid="mobile-window-add-custom"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-window-custom-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-window-custom-zh"]').exists()).toBe(true)
    await wrapper.get('[data-testid="mobile-window-custom-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-window-custom-dialog"]').exists()).toBe(false)

    await wrapper.get('[data-testid="mobile-window-add-custom"]').trigger('click')
    await wrapper.get('[data-testid="mobile-window-custom-zh"]').setValue('测试窗')
    await wrapper.get('[data-testid="mobile-window-custom-en"]').setValue('Test Window')
    await wrapper.get('[data-testid="mobile-window-custom-ww"]').setValue('420')
    await wrapper.get('[data-testid="mobile-window-custom-wl"]').setValue('24')
    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-window-custom-confirm"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'windowPreset', value: '400|40' })
    expect(wrapper.find('[data-testid="mobile-window-custom-dialog"]').exists()).toBe(false)

    expect(wrapper.get('[data-testid="mobile-window-reset"]').classes()).toContain('mobile-shell__footer-action')
    expect(wrapper.get('[data-testid="mobile-window-reset"]').classes()).toContain('mobile-shell__footer-action--danger')
    expect(wrapper.get('[data-testid="mobile-window-reset"]').classes()).not.toContain('mobile-shell__footer-action--warning')
    expect(wrapper.get('[data-testid="mobile-window-reset"] .app-icon-stub').text()).toBe('reset')
    expect(wrapper.find('[data-testid="mobile-window-reset"] small').exists()).toBe(false)
    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-window-reset"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'windowPreset', value: '350|45' })
    expect(wrapper.find('.mobile-shell__sheet').exists()).toBe(true)

    await wrapper.findAll('[data-testid="mobile-window-preset"]')[0].trigger('click')
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-window-reset"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'windowPreset', value: '1500|-600' })

    await wrapper.get('[data-testid="mobile-sheet-tab-transform"]').trigger('click')
    expect(wrapper.get('[data-testid="mobile-transform-reset"]').classes()).toContain('mobile-shell__footer-action')
    expect(wrapper.get('[data-testid="mobile-transform-reset"]').classes()).toContain('mobile-shell__footer-action--danger')
    expect(wrapper.get('[data-testid="mobile-transform-reset"] .app-icon-stub').text()).toBe('reset')
    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-transform-reset"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'transformReset' })
    expect(wrapper.find('.mobile-shell__sheet').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-sheet-tab-measure"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-measure-line"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mobile-measure-clear"]').classes()).toContain('mobile-shell__footer-action')
    expect(wrapper.get('[data-testid="mobile-measure-clear"] .app-icon-stub').text()).toBe('reset')
    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-measure-clear"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'clearMeasurements' })
    expect(wrapper.find('.mobile-shell__sheet').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-sheet-tab-annotate"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-annotate-arrow"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mobile-annotate-clear"]').classes()).toContain('mobile-shell__footer-action')
    expect(wrapper.get('[data-testid="mobile-annotate-clear"]').classes()).not.toContain('mobile-shell__action-row')
    expect(wrapper.get('[data-testid="mobile-annotate-clear"] .app-icon-stub').text()).toBe('reset')
    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-annotate-clear"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'clearAnnotations' })
    expect(wrapper.find('.mobile-shell__sheet').exists()).toBe(true)
  })

  it('uses the same menu sheet presentation for More across mobile view types', async () => {
    const cases: Array<{
      name: string
      tab: ViewerTabItem
      series: ReturnType<typeof createSeries>[]
      colorTab?: boolean
    }> = [
      { name: 'stack', tab: createStackTab(), series: [createSeries()], colorTab: true },
      { name: 'pet', tab: createPetTab(), series: [createSeries({ modality: 'PT', seriesId: 'pet-series' })], colorTab: true },
      {
        name: 'compare',
        tab: createCompareTab(),
        series: [
          createSeries({ seriesId: 'series-1' }),
          createSeries({ seriesId: 'series-2', seriesDescription: 'Target CT' })
        ],
        colorTab: true
      },
      { name: 'mpr', tab: createMprTab(), series: [createSeries()], colorTab: true },
      { name: 'four-d', tab: createFourDTab(), series: [createSeries({ fourDPhaseCount: 4, isFourDSeries: true })], colorTab: true },
      { name: 'volume', tab: createVolumeTab(), series: [createSeries()], colorTab: true },
      {
        name: 'fusion',
        tab: createFusionTab(),
        series: [
          createSeries({ seriesId: 'ct-series', modality: 'CT' }),
          createSeries({ seriesId: 'pet-series', modality: 'PT' })
        ]
      }
    ]

    for (const item of cases) {
      mockViewer.seriesList.value = item.series
      mockViewer.selectedSeriesId.value = item.series[0]?.seriesId ?? 'series-1'
      mockViewer.__setActiveTab(item.tab)
      const wrapper = mountShell()

      await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
      expect(wrapper.get('.mobile-shell__sheet').classes(), item.name).toContain('mobile-shell__sheet--presentation-menu')
      expect(wrapper.get('.mobile-shell__sheet').classes(), item.name).not.toContain('mobile-shell__sheet--presentation-focused')

      for (const tabKey of ['favorites', 'window']) {
        if (!wrapper.find(`[data-testid="mobile-sheet-tab-${tabKey}"]`).exists()) {
          continue
        }
        await wrapper.get(`[data-testid="mobile-sheet-tab-${tabKey}"]`).trigger('click')
        expect(wrapper.get('.mobile-shell__sheet').classes(), `${item.name} ${tabKey}`).toContain('mobile-shell__sheet--presentation-menu')
        expect(wrapper.find('.mobile-shell__sheet-handle').exists(), `${item.name} ${tabKey}`).toBe(true)
        expect(wrapper.find('.mobile-shell__sheet-header').exists(), `${item.name} ${tabKey}`).toBe(true)
        expect(wrapper.find('.mobile-shell__sheet-tabs').exists(), `${item.name} ${tabKey}`).toBe(true)
      }

      if (item.colorTab && wrapper.find('[data-testid="mobile-sheet-tab-color"]').exists()) {
        await wrapper.get('[data-testid="mobile-sheet-tab-color"]').trigger('click')
        expect(wrapper.get('.mobile-shell__sheet').classes(), `${item.name} color`).toContain('mobile-shell__sheet--presentation-menu')
        expect(wrapper.get('.mobile-shell__sheet').classes(), `${item.name} color`).toContain('mobile-shell__sheet--color')
        expect(wrapper.get('.mobile-shell__sheet').classes(), `${item.name} color`).not.toContain('mobile-shell__sheet--presentation-focused')
      }

      wrapper.unmount()
    }
  })

  it('toggles mobile display overlays through viewer actions', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab('series-1', { showCornerInfo: true, showPseudocolorBar: true, showScaleBar: true }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-display"]').trigger('click')
    await wrapper.get('[data-testid="mobile-display-cornerInfo"]').trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({
      action: 'displayOverlay',
      overlay: 'cornerInfo',
      enabled: false
    })

    await wrapper.get('[data-testid="mobile-display-pseudocolorBar"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({
      action: 'displayOverlay',
      overlay: 'pseudocolorBar',
      enabled: false
    })
  })

  it('offers 2D, MPR, 3D, and 4D open actions from the mobile series sheet', async () => {
    mockViewer.seriesList.value = [createSeries({ fourDPhaseCount: 4, isFourDSeries: true })]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-title-series-button"]').trigger('click')
    expect(wrapper.get('[data-testid="mobile-open-stack"]').text()).toBe('2D')
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

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'compare-b', deltaY: 3, exact: true })
  })

  it('toggles Compare sync settings from the unified More sheet', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'series-1', seriesDescription: 'Source CT' }),
      createSeries({ seriesId: 'series-2', seriesDescription: 'Target CT' })
    ]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createCompareTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    expect(wrapper.get('.mobile-shell__sheet').classes()).toContain('mobile-shell__sheet--presentation-menu')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-compare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-compare"]').classes()).toContain('mobile-shell__sheet-tab--active')
    await wrapper.findAll('[data-testid="mobile-compare-sync"]')[0].trigger('click')

    expect(mockViewer.handleCompareSyncChange).toHaveBeenCalledWith({
      tabKey: 'compare-tab',
      key: 'scroll',
      value: false
    })
  })

  it('highlights the active 2D, MPR, 3D, or 4D view action in the series sheet', async () => {
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
    expect(wrapper.find('[data-testid="mobile-tool-zoom"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-measure"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-transform"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-color"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-volumeParams"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-layout"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-tool-export"]').exists()).toBe(false)
    const toolbarRows = wrapper.findAll('.mobile-shell__toolbar-row')
    expect(toolbarRows[0].findAll('.mobile-shell__tool')).toHaveLength(5)
    expect(toolbarRows[1].findAll('.mobile-shell__tool')).toHaveLength(5)
    expect(wrapper.get('[data-testid="mobile-tool-volumeRemoveBed"]').text()).toContain('去床板')
    expect(wrapper.get('[data-testid="mobile-tool-volumeRemoveBed"] .app-icon-stub').text()).toBe('bed-visible')

    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-tool-volumeRemoveBed"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({
      action: 'volumeRenderOptions',
      enabled: true
    })

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-export"]').trigger('click')
    expect(wrapper.findAll('[data-testid="mobile-export-format"]')).toHaveLength(2)
    await wrapper.get('.mobile-shell__sheet-close').trigger('click')

    await wrapper.get('[data-testid="mobile-tool-color"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(false)
    const modeButtons = wrapper.findAll('[data-testid="mobile-volume-render-mode"]')
    expect(modeButtons[0].classes()).toContain('mobile-shell__action-row--active')
    const presetButtons = wrapper.findAll('[data-testid="mobile-volume-preset"]')
    expect(presetButtons.some((button) => button.classes().includes('mobile-shell__action-row--active'))).toBe(true)
    await modeButtons[0].trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'render3dMode', value: 'render3dMode:volume' })

    await wrapper.get('[data-testid="mobile-tool-volumeParams"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-volume-config-panel"]').exists()).toBe(true)

    mockViewer.__setActiveTab(createVolumeTab('series-1', {
      volumeRenderOptions: {
        removeBed: true,
        clip: null
      }
    }))
    await flushPromises()
    expect(wrapper.get('[data-testid="mobile-tool-volumeRemoveBed"]').text()).toContain('已去床板')
    expect(wrapper.get('[data-testid="mobile-tool-volumeRemoveBed"] .app-icon-stub').text()).toBe('bed-hidden')
    expect(wrapper.get('[data-testid="mobile-tool-volumeRemoveBed"]').classes()).toContain('mobile-shell__tool--active')

    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-tool-volumeRemoveBed"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({
      action: 'volumeRenderOptions',
      enabled: false
    })

    mockViewer.activeOperation.value = `${STACK_OPERATION_PREFIX}volumeClip:outside`
    mockViewer.setActiveOperation.mockClear()
    await wrapper.get('[data-testid="mobile-tool-volumeClip"]').trigger('click')

    expect(mockViewer.setActiveOperation).toHaveBeenCalledWith(`${STACK_OPERATION_PREFIX}volumeClip:inside`)
    expect(wrapper.find('[data-testid="mobile-volume-clip-footer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-volume-clip-reset"]').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-tool-volume-clip-reset"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'volumeClipReset' })
    expect(mockViewer.setActiveOperation).toHaveBeenCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.rotate3d}`)
  })

  it('shows mobile surface presets and opens surface 3D params for surface rendering', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createVolumeTab('series-1', {
      render3dMode: 'surface',
      surfaceRenderConfig: {
        preset: 'softTissue'
      } as ViewerTabItem['surfaceRenderConfig']
    }))

    const wrapper = mountShell()

    await wrapper.get('[data-testid="mobile-tool-color"]').trigger('click')

    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(false)
    const modeButtons = wrapper.findAll('[data-testid="mobile-volume-render-mode"]')
    expect(modeButtons[1].classes()).toContain('mobile-shell__action-row--active')
    const presetButtons = wrapper.findAll('[data-testid="mobile-volume-preset"]')
    const softTissuePreset = presetButtons.find((button) => button.text().includes('Soft Tissue'))
    expect(softTissuePreset?.classes()).toContain('mobile-shell__action-row--active')

    mockViewer.triggerViewAction.mockClear()
    const highDensityPreset = presetButtons.find((button) => button.text().includes('High Density'))
    expect(highDensityPreset).toBeTruthy()
    await highDensityPreset!.trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({
      action: 'surfacePreset',
      value: 'surfacePreset:highDensity'
    })

    await wrapper.get('[data-testid="mobile-tool-volumeParams"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-surface-config-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-volume-config-panel"]').exists()).toBe(false)
  })

  it('renders mobile PET/CT fusion and forwards registration actions', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'ct-series', modality: 'CT' }),
      createSeries({ seriesId: 'pet-series', modality: 'PT' })
    ]
    mockViewer.selectedSeriesId.value = 'ct-series'
    mockViewer.__setActiveTab(createFusionTab())

    const wrapper = mountShell()

    expect(wrapper.find('[data-testid="mobile-fusion-stub"]').exists()).toBe(true)
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('fusion-overlay-ax')

    const toolbarRows = wrapper.findAll('.mobile-shell__toolbar-row')
    const primaryToolbarIds = toolbarRows[0].findAll('button').map((button) => button.attributes('data-testid'))
    const secondaryToolbarIds = toolbarRows[1].findAll('button').map((button) => button.attributes('data-testid'))
    const toolbarTestIds = [...primaryToolbarIds, ...secondaryToolbarIds]
    expect(primaryToolbarIds).toEqual([
      'mobile-tool-window',
      'mobile-tool-pan',
      'mobile-tool-zoom',
      'mobile-tool-scroll',
      'mobile-tool-fusion'
    ])
    expect(secondaryToolbarIds).toEqual([
      'mobile-tool-measure',
      'mobile-tool-annotate',
      'mobile-more-button',
      'mobile-tool-reset'
    ])
    expect(toolbarTestIds).not.toContain('mobile-tool-export')
    expect(toolbarTestIds).not.toContain('mobile-tool-tag')
    expect(toolbarTestIds).not.toContain('mobile-tool-color')

    await wrapper.get('[data-testid="stub-fusion-pet"]').trigger('click')
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('fusion-pet-ax')

    await wrapper.get('[data-testid="stub-fusion-drag"]').trigger('click')
    expect(mockViewer.handleFusionRegistrationDrag).toHaveBeenCalledWith({
      viewportKey: 'fusion-overlay-ax',
      phase: 'move',
      subOpType: 'translate',
      deltaX: 3,
      deltaY: 4
    })

    expect(wrapper.find('[data-testid="mobile-tool-reset"]').exists()).toBe(true)
    await wrapper.get('[data-testid="mobile-tool-reset"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'reset' })
    mockViewer.triggerViewAction.mockClear()

    await wrapper.get('[data-testid="mobile-tool-measure"]').trigger('click')
    expect(mockViewer.setActiveOperation.mock.calls.map(([operation]) => operation)).toContain('measure:line')
    expect(wrapper.find('[data-testid="mobile-tool-measure-line"]').exists()).toBe(true)

    await wrapper.get('[data-testid="mobile-inline-tool-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-tool-annotate"]').trigger('click')
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}annotate:arrow`)
    expect(wrapper.get('[data-testid="mobile-tool-annotate"]').classes()).toContain('mobile-shell__tool--active')

    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-export"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-tag"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-sheet-tab-color"]').exists()).toBe(false)
    await wrapper.get('[data-testid="mobile-sheet-tab-export"]').trigger('click')
    expect(wrapper.findAll('[data-testid="mobile-export-format"]')).toHaveLength(4)
    await wrapper.get('.mobile-shell__sheet-close').trigger('click')

    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(false)
    await wrapper.get('[data-testid="mobile-tool-fusion"]').trigger('click')
    expect(wrapper.find('.mobile-shell__sheet').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-inline-tool-back"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-fusionRegistrationToggle"]').exists()).toBe(true)
    expect(wrapper.get("[data-testid='mobile-tool-fusionRegistrationToggle']").text()).toContain("crosshair")
    expect(wrapper.find('[data-testid="mobile-tool-fusionRegistrationTranslate"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mobile-tool-fusionRegistrationTranslate"]').classes()).toContain('mobile-shell__inline-tool')
    expect(wrapper.get('[data-testid="mobile-tool-fusionRegistrationTranslate"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="mobile-tool-fusionRegistrationRotate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-fusionRegistrationReset"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-fusionRegistrationSave"]').exists()).toBe(true)
    expect(wrapper.findAll('.mobile-shell__inline-tool--active')).toHaveLength(0)
    expect(wrapper.findAll('.mobile-shell__tool--active')).toHaveLength(1)
    expect(wrapper.get('[data-testid="mobile-tool-fusion"]').classes()).toContain('mobile-shell__tool--active')
    expect(mockViewer.triggerViewAction).not.toHaveBeenCalledWith({ action: 'fusionManualRegistration', enabled: true })

    await wrapper.get('[data-testid="mobile-tool-fusionRegistrationToggle"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'fusionManualRegistration', enabled: true })

    mockViewer.__setActiveTab(createFusionTab({ fusionManualRegistration: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="mobile-tool-fusionRegistrationToggle"]').classes()).toContain('mobile-shell__inline-tool--warm')
    expect(wrapper.get('[data-testid="mobile-tool-fusionRegistrationTranslate"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="mobile-tool-fusionRegistrationTranslate"]').classes()).toContain('mobile-shell__inline-tool--active')
    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-tool-fusionRegistrationRotate"]').trigger('click')
    expect(mockViewer.triggerViewAction).not.toHaveBeenCalled()
    expect(wrapper.findAll('.mobile-shell__inline-tool--active')).toHaveLength(1)
    expect(wrapper.get('[data-testid="mobile-tool-fusionRegistrationRotate"]').classes()).toContain('mobile-shell__inline-tool--active')
    await wrapper.get('[data-testid="mobile-tool-fusionRegistrationReset"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'fusionRegistrationReset' })
    await wrapper.get('[data-testid="mobile-tool-fusionRegistrationSave"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'fusionRegistrationSave' })
    expect(wrapper.find('[data-testid="mobile-tool-color"]').exists()).toBe(false)

    await wrapper.get('[data-testid="mobile-inline-tool-back"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-more-button"]').exists()).toBe(true)
  })

  it('keeps PET/CT registration submenu open when selecting window', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'ct-series', modality: 'CT' }),
      createSeries({ seriesId: 'pet-series', modality: 'PT' })
    ]
    mockViewer.selectedSeriesId.value = 'ct-series'
    mockViewer.__setActiveTab(createFusionTab({ fusionManualRegistration: true }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-fusion"]').trigger('click')
    mockViewer.triggerViewAction.mockClear()

    await wrapper.get('[data-testid="mobile-tool-window"]').trigger('click')

    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.window}`)
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(true)
    expect(mockViewer.triggerViewAction).not.toHaveBeenCalledWith({ action: 'fusionManualRegistration', enabled: false })
    expect(wrapper.findAll('.mobile-shell__tool--active')).toHaveLength(1)
    expect(wrapper.get('[data-testid="mobile-tool-window"]').classes()).toContain('mobile-shell__tool--active')
    expect(wrapper.get('[data-testid="mobile-tool-fusion"]').classes()).not.toContain('mobile-shell__tool--active')
  })

  it('exits enabled PET/CT registration when selecting ordinary primary tools', async () => {
    for (const tool of [
      { key: 'pan', operation: VIEW_OPERATION_TYPES.pan },
      { key: 'zoom', operation: VIEW_OPERATION_TYPES.zoom },
      { key: 'scroll', operation: VIEW_OPERATION_TYPES.scroll }
    ]) {
      mockViewer.seriesList.value = [
        createSeries({ seriesId: 'ct-series', modality: 'CT' }),
        createSeries({ seriesId: 'pet-series', modality: 'PT' })
      ]
      mockViewer.selectedSeriesId.value = 'ct-series'
      mockViewer.__setActiveTab(createFusionTab({ fusionManualRegistration: true }))
      mockViewer.triggerViewAction.mockClear()
      mockViewer.setActiveOperation.mockClear()

      const wrapper = mountShell()
      await wrapper.get('[data-testid="mobile-tool-fusion"]').trigger('click')
      mockViewer.triggerViewAction.mockClear()

      await wrapper.get(`[data-testid="mobile-tool-${tool.key}"]`).trigger('click')

      expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'fusionManualRegistration', enabled: false })
      expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${tool.operation}`)
      expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(false)
      expect(wrapper.get(`[data-testid="mobile-tool-${tool.key}"]`).classes()).toContain('mobile-shell__tool--active')
      wrapper.unmount()
    }
  })

  it('exits enabled PET/CT registration before opening measurement tools', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'ct-series', modality: 'CT' }),
      createSeries({ seriesId: 'pet-series', modality: 'PT' })
    ]
    mockViewer.selectedSeriesId.value = 'ct-series'
    mockViewer.__setActiveTab(createFusionTab({ fusionManualRegistration: true }))
    mockViewer.triggerViewAction.mockClear()
    mockViewer.setActiveOperation.mockClear()

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-fusion"]').trigger('click')
    await wrapper.get('[data-testid="mobile-inline-tool-back"]').trigger('click')
    mockViewer.triggerViewAction.mockClear()

    await wrapper.get('[data-testid="mobile-tool-measure"]').trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'fusionManualRegistration', enabled: false })
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith('measure:line')
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(true)
  })

  it('closes PET/CT registration submenu without sending disable when registration is not enabled', async () => {
    mockViewer.seriesList.value = [
      createSeries({ seriesId: 'ct-series', modality: 'CT' }),
      createSeries({ seriesId: 'pet-series', modality: 'PT' })
    ]
    mockViewer.selectedSeriesId.value = 'ct-series'
    mockViewer.__setActiveTab(createFusionTab({ fusionManualRegistration: false }))

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-fusion"]').trigger('click')
    mockViewer.triggerViewAction.mockClear()

    await wrapper.get('[data-testid="mobile-tool-zoom"]').trigger('click')

    expect(mockViewer.triggerViewAction).not.toHaveBeenCalledWith({ action: 'fusionManualRegistration', enabled: false })
    expect(mockViewer.setActiveOperation).toHaveBeenLastCalledWith(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.zoom}`)
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="mobile-tool-zoom"]').classes()).toContain('mobile-shell__tool--active')
  })

  it('uses 4D phase controls, hides plane tabs, and exposes playback in the first toolbar row', async () => {
    mockViewer.seriesList.value = [createSeries({ fourDPhaseCount: 4, isFourDSeries: true })]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createFourDTab())

    const wrapper = mountShell()
    const toolbarRows = wrapper.findAll('.mobile-shell__toolbar-row')
    expect(toolbarRows[0].findAll('button').map((button) => button.attributes('data-testid'))).toEqual([
      'mobile-tool-window',
      'mobile-tool-pan',
      'mobile-tool-zoom',
      'mobile-tool-crosshair',
      'mobile-tool-play'
    ])
    expect(toolbarRows[1].findAll('button').map((button) => button.attributes('data-testid'))).not.toContain('mobile-tool-play')
    expect(wrapper.find('[data-testid="mobile-mpr-plane-tabs"]').exists()).toBe(false)

    const phaseRange = wrapper.get('[data-testid="mobile-four-d-phase-range"]')
    ;(phaseRange.element as HTMLInputElement).value = '3'
    await phaseRange.trigger('input')

    expect(mockViewer.handleFourDPhaseChange).toHaveBeenCalledWith({ tabKey: 'four-d-tab', phaseIndex: 2 })
    expect(wrapper.get('[data-testid="mobile-four-d-phase-panel"]').classes()).toContain('mobile-shell__slice-control-row')
    expect(wrapper.get('[data-testid="mobile-four-d-phase-panel"]').text()).toContain('时相')
    expect(wrapper.get('[data-testid="mobile-four-d-phase-panel"]').text()).not.toContain('4D Phase')
    expect(wrapper.get('.mobile-shell__slice-copy').text()).toContain('切片')

    const slider = wrapper.get('[data-testid="mobile-slice-range"]')
    ;(slider.element as HTMLInputElement).value = '7'
    await slider.trigger('input')
    await slider.trigger('pointerup')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'mpr-ax', deltaY: 5, exact: true })
    mockViewer.handleViewportWheel.mockClear()

    await wrapper.get('[data-testid="mobile-tool-play"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-four-d-phase-play"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-inline-playback-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-inline-playback-fps-slider"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-inline-playback-toggle"]').exists()).toBe(true)
    expect(wrapper.findAll('button[data-testid^="mobile-inline-playback-fps-"]')).toHaveLength(0)

    await wrapper.get('[data-testid="mobile-four-d-phase-play"]').trigger('click')
    expect(mockViewer.handleFourDPlaybackChange).toHaveBeenCalledWith({ tabKey: 'four-d-tab', isPlaying: true })
    expect(wrapper.get('[data-testid="mobile-tool-play"]').classes()).toContain('mobile-shell__tool--active')
    expect(mockViewer.handleViewportWheel).not.toHaveBeenCalled()
  })

  it('localizes mobile 4D phase and slice labels in English', () => {
    mockLocale.value = 'en-US'
    mockViewer.seriesList.value = [createSeries({ fourDPhaseCount: 4, isFourDSeries: true })]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createFourDTab())

    const wrapper = mountShell()

    expect(wrapper.get('[data-testid="mobile-four-d-phase-panel"]').text()).toContain('Phase')
    expect(wrapper.get('[data-testid="mobile-four-d-phase-panel"]').text()).not.toContain('4D Phase')
    expect(wrapper.get('.mobile-shell__slice-copy').text()).toContain('Slice')
  })

  it('uses the active MPR plane for plane switches and slice slider deltas', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createMprTab('series-1'))

    const wrapper = mountShell()
    expect(wrapper.find('[data-testid="mobile-tool-play"]').exists()).toBe(true)
    await wrapper.get('[data-testid="mobile-tool-play"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-inline-playback-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-inline-playback-fps-slider"]').exists()).toBe(true)
    await wrapper.get('[data-testid="mobile-inline-tool-back"]').trigger('click')

    await wrapper.get('[data-testid="mobile-mpr-plane-mpr-cor"]').trigger('click')

    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('mpr-cor')

    const slider = wrapper.get('[data-testid="mobile-slice-range"]')
    ;(slider.element as HTMLInputElement).value = '7'
    await slider.trigger('input')
    await slider.trigger('pointerup')

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'mpr-cor', deltaY: 3, exact: true })
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

    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'mpr-cor', deltaY: 3, exact: true })
  })

  it('opens mobile MPR segmentation controls and forwards config updates', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createMprTab('series-1', {
      mprSegmentationConfig: {
        enabled: false,
        clientRevision: 1,
        selectedRegionId: 'r1',
        selectedVoi: false,
        selectedVoiId: null,
        thresholdRegions: [
          {
            id: 'r1',
            enabled: true,
            label: '',
            thresholdHu: 300,
            thresholdMode: 'hu',
            thresholdPercentile: 80,
            color: '#ff4df8',
            box: {
              centerWorld: [0, 0, 0],
              rowWorld: [1, 0, 0],
              colWorld: [0, 1, 0],
              normalWorld: [0, 0, 1],
              widthMm: 20,
              heightMm: 20,
              depthMm: 10,
              sourceViewport: 'mpr-ax'
            },
            stats: null
          }
        ],
        voiSpheres: [],
        voiSphere: null
      }
    }))

    const wrapper = mountShell()
    const toolbarRows = wrapper.findAll('.mobile-shell__toolbar-row')
    expect(toolbarRows[0].findAll('button').map((button) => button.attributes('data-testid'))).toEqual([
      'mobile-tool-window',
      'mobile-tool-pan',
      'mobile-tool-zoom',
      'mobile-tool-crosshair',
      'mobile-tool-measure'
    ])
    expect(toolbarRows[1].findAll('button').map((button) => button.attributes('data-testid'))).not.toContain('mobile-tool-measure')

    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-tool-segmentation"]').trigger('click')

    expect(mockViewer.setActiveOperation).toHaveBeenCalledWith(`${STACK_OPERATION_PREFIX}segmentation:threshold`)
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mprSegmentation',
      actionType: 'end',
      segmentationConfig: expect.objectContaining({ enabled: true })
    }))
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-tool-segmentation-exit"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="mobile-tool-segmentation-threshold"]').text()).toContain('阈值分割')
    expect(wrapper.get('[data-testid="mobile-tool-segmentation-threshold"]').find('.app-icon-stub').exists()).toBe(false)
    expect(wrapper.get('[data-testid="mobile-tool-segmentation-voi"]').find('.app-icon-stub').exists()).toBe(false)
    expect(wrapper.get('[data-testid="mobile-tool-segmentation-details"]').text()).toContain('dots-vertical')
    expect(wrapper.get('[data-testid="mobile-tool-segmentation-threshold"]').classes()).toContain('mobile-shell__inline-tool--active')
    expect(wrapper.get('.mobile-shell__toolbar').classes()).not.toContain('mobile-shell__toolbar--inline-expanded')
    expect(wrapper.get('[data-testid="mobile-inline-tool-panel"]').classes()).not.toContain('mobile-shell__inline-tool-panel--segmentation-control')
    const thresholdControl = wrapper.get('[data-testid="mobile-segmentation-threshold-control"]')
    expect(wrapper.get('.mobile-shell__viewer').element.contains(thresholdControl.element)).toBe(true)
    const thresholdInput = wrapper.get('[data-testid="mobile-segmentation-threshold-input"]')
    expect(thresholdInput.attributes('type')).toBe('number')
    expect(thresholdInput.attributes('inputmode')).toBe('decimal')
    expect(thresholdInput.attributes('autocomplete')).toBe('off')
    expect(thresholdInput.attributes('min')).toBe('-1024')
    expect(thresholdInput.attributes('max')).toBe('3071')
    const thresholdSlider = wrapper.get<HTMLInputElement>('[data-testid="mobile-segmentation-threshold-slider"]')
    thresholdSlider.element.value = '420'
    mockViewer.triggerViewAction.mockClear()
    await thresholdSlider.trigger('input')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mprSegmentation',
      actionType: 'local',
      segmentationConfig: expect.objectContaining({
        selectedRegionId: 'r1',
        thresholdRegions: [expect.objectContaining({ id: 'r1', thresholdHu: 420, stats: null })]
      })
    }))
    await thresholdSlider.trigger('change')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mprSegmentation',
      actionType: 'end'
    }))
    const depthSlider = wrapper.get<HTMLInputElement>('[data-testid="mobile-segmentation-depth-slider"]')
    const depthInput = wrapper.get('[data-testid="mobile-segmentation-depth-input"]')
    expect(depthInput.attributes('type')).toBe('number')
    expect(depthInput.attributes('inputmode')).toBe('decimal')
    expect(depthInput.attributes('autocomplete')).toBe('off')
    expect(depthInput.attributes('min')).toBe('0.1')
    expect(depthInput.attributes('max')).toBe('500')
    depthSlider.element.value = '18'
    mockViewer.triggerViewAction.mockClear()
    await depthSlider.trigger('input')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mprSegmentation',
      actionType: 'local',
      segmentationConfig: expect.objectContaining({
        selectedRegionId: 'r1',
        thresholdRegions: [expect.objectContaining({
          id: 'r1',
          box: expect.objectContaining({ depthMm: 18 }),
          stats: null
        })]
      })
    }))
    await wrapper.get('[data-testid="mobile-tool-segmentation-voi"]').trigger('click')
    expect(mockViewer.setActiveOperation).toHaveBeenCalledWith(`${STACK_OPERATION_PREFIX}segmentation:voi`)
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('mpr-ax')
    expect(wrapper.get('[data-testid="mobile-tool-segmentation-voi"]').classes()).toContain('mobile-shell__inline-tool--active')

    await wrapper.get('[data-testid="mobile-tool-segmentation-details"]').trigger('click')
    const segmentationPanel = wrapper.get('[data-testid="mobile-segmentation-panel"]')
    expect(segmentationPanel.attributes('data-embedded')).toBe('true')
    expect(segmentationPanel.attributes('data-mobile')).toBe('true')

    await wrapper.get('[data-testid="mobile-segmentation-config-change"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mprSegmentation',
      actionType: 'local'
    }))

    await wrapper.get('[data-testid="mobile-segmentation-mode-change"]').trigger('click')
    expect(mockViewer.setActiveOperation).toHaveBeenCalledWith(`${STACK_OPERATION_PREFIX}segmentation:voi`)
    expect(mockViewer.setActiveViewportKey).toHaveBeenCalledWith('mpr-cor')
  })

  it('applies mobile color, transform, and reset actions through focused toolbar entries', async () => {
    mockViewer.seriesList.value = [createSeries()]
    mockViewer.selectedSeriesId.value = 'series-1'
    mockViewer.__setActiveTab(createStackTab())

    const wrapper = mountShell()
    await wrapper.get('[data-testid="mobile-tool-color"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-sheet-tab-window"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-inline-tool-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="mobile-pseudocolor-reset"]').classes()).toContain('mobile-shell__footer-action')
    expect(wrapper.get('[data-testid="mobile-pseudocolor-reset"] .app-icon-stub').text()).toBe('reset')
    mockViewer.triggerViewAction.mockClear()
    await wrapper.get('[data-testid="mobile-pseudocolor-reset"]').trigger('click')
    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'pseudocolor', value: 'pseudocolor:bw' })
    expect(wrapper.find('.mobile-shell__sheet').exists()).toBe(true)

    const blackbodyPreset = wrapper.findAll('[data-testid="mobile-pseudocolor"]').find((button) => button.text().includes('BlackBody'))
    expect(blackbodyPreset).toBeTruthy()
    expect(blackbodyPreset!.find('small').exists()).toBe(false)
    mockViewer.triggerViewAction.mockClear()
    await blackbodyPreset!.trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'pseudocolor', value: 'pseudocolor:blackbody' })

    mockViewer.__setActiveTab(createMprTab())
    const mprWrapper = mountShell()
    await mprWrapper.get('[data-testid="mobile-tool-color"]').trigger('click')
    expect(mprWrapper.findAll('[data-testid="mobile-pseudocolor"]').length).toBeGreaterThan(0)
    expect(mprWrapper.find('[data-testid="mobile-pseudocolor-reset"]').exists()).toBe(true)
    mprWrapper.unmount()
    mockViewer.__setActiveTab(createStackTab())
    await flushPromises()

    await wrapper.get('[data-testid="mobile-tool-transform"]').trigger('click')
    await wrapper.get('[data-testid="mobile-tool-transform-rotate-cw90"]').trigger('click')

    expect(mockViewer.triggerViewAction).toHaveBeenCalledWith({ action: 'rotate', value: 'rotate:cw90' })

    await wrapper.get('[data-testid="mobile-inline-tool-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-more-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-sheet-tab-reset"]').trigger('click')
    const resetOptions = wrapper.findAll('[data-testid="mobile-reset-option"]')
    expect(resetOptions[1].find('.app-icon-stub').text()).toBe('reset')
    expect(resetOptions[2].find('.app-icon-stub').text()).toBe('reset')
    expect(resetOptions[3].find('.app-icon-stub').text()).toBe('reset')
    await resetOptions[0].trigger('click')

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
    expect(mockViewer.handleViewportWheel).not.toHaveBeenCalled()

    vi.advanceTimersByTime(210)
    expect(mockViewer.handleViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-ax', deltaY: 1 })

    mockViewer.handleViewportWheel.mockClear()
    await wrapper.get('[data-testid="mobile-mpr-plane-mpr-cor"]').trigger('click')
    vi.advanceTimersByTime(210)

    expect(mockViewer.handleViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-ax', deltaY: 1 })
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
      'series-1': [{ sliceIndex: 2 }]
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
    expect(mockViewer.handleViewportWheel).toHaveBeenCalledWith({ viewportKey: 'single', deltaY: 4, exact: true })

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

  it('requests orientation lock immediately from the mobile settings overlay', async () => {
    const lockMock = vi.fn().mockResolvedValue(undefined)
    const unlockMock = vi.fn()
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: {
        lock: lockMock,
        unlock: unlockMock
      }
    })
    const wrapper = mountShell()

    await wrapper.get('[data-testid="mobile-settings-button"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-landscape-stub"]').trigger('click')

    expect(lockMock).toHaveBeenCalledWith('landscape-primary')
  })
})
