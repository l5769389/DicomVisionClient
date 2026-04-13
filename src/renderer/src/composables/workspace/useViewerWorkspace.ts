import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import {
  DRAG_ACTION_TYPES,
  STACK_DEFAULT_OPERATION,
  STACK_DRAG_OPERATIONS,
  type ViewOperationType,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import { api } from '../../services/api'
import { emitViewOperation } from '../../services/socket'
import { isMprViewportKey, normalizeCornerInfo } from './viewerWorkspaceTabs'
import { useViewerWorkspaceConnection } from './useViewerWorkspaceConnection'
import { useViewerWorkspaceHover } from './useViewerWorkspaceHover'
import { useViewerWorkspaceViews } from './useViewerWorkspaceViews'
import { useVolumeConfigSync } from './useVolumeConfigSync'
import {
  createDefaultVolumeRenderConfig,
  normalizeVolumePresetKey,
  normalizeVolumeRenderConfig
} from './volumeRenderConfig'
import type {
  CornerInfo,
  CornerInfoResponse,
  ConnectionState,
  FolderSeriesItem,
  MeasurementDraftPoint,
  MeasurementToolType,
  MprViewportKey,
  ViewImageResponse,
  ViewerTabItem,
  ViewType,
  VolumeRenderConfig,
  WorkspaceReadyPayload
} from '../../types/viewer'

interface ViewerWorkspaceState {
  activeOperation: Ref<string>
  activeTab: ComputedRef<ViewerTabItem | null>
  activeTabKey: Ref<string>
  activateTab: (tabKey: string) => void
  chooseFolder: () => Promise<void>
  closeTab: (tabKey: string) => void
  connectionState: Ref<ConnectionState>
  hasSelectedSeries: ComputedRef<boolean>
  handleViewportWheel: (deltaY: number) => void
  handleViewportDrag: (payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'start' | 'move' | 'end'
    viewportKey: string
  }) => void
  handleHoverViewportChange: (payload: { viewportKey: string; x: number | null; y: number | null }) => void
  handleMeasurementDraft: (payload: {
    viewportKey: string
    toolType: MeasurementToolType
    phase: 'start' | 'move' | 'end'
    points: MeasurementDraftPoint[]
  }) => void
  handleMprCrosshair: (payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }) => void
  handleMeasurementCreate: (payload: {
    viewportKey: string
    toolType: MeasurementToolType
    points: MeasurementDraftPoint[]
    measurementId?: string
  }) => void
  handleVolumeConfigChange: (config: VolumeRenderConfig) => void
  isLoadingFolder: Ref<boolean>
  isSidebarCollapsed: Ref<boolean>
  isViewLoading: Ref<boolean>
  message: Ref<string>
  openSeriesView: (seriesId: string, viewType: ViewType) => Promise<void>
  openView: (viewType: ViewType) => Promise<void>
  removeSeries: (seriesId: string) => void
  selectSeries: (seriesId: string) => void
  selectedSeriesId: Ref<string>
  seriesList: Ref<FolderSeriesItem[]>
  setActiveOperation: (value: string) => void
  setActiveViewportKey: (viewportKey: string) => void
  setViewerStage: (payload: WorkspaceReadyPayload) => void
  toggleSidebar: () => void
  triggerViewAction: (payload: { action: 'reset' | 'volumePreset'; value?: string }) => void
  viewerStage: Ref<HTMLElement | null>
  viewerTabs: Ref<ViewerTabItem[]>
}

export function useViewerWorkspace(): ViewerWorkspaceState {
  const VOLUME_CONFIG_DEBOUNCE_MS = 120
  const backendOrigin = ref('http://127.0.0.1:8000')
  const message = ref('')
  const isSidebarCollapsed = ref(false)
  const isLoadingFolder = ref(false)
  const isViewLoading = ref(false)
  const seriesList = ref<FolderSeriesItem[]>([])
  const selectedSeriesId = ref('')
  const viewerTabs = ref<ViewerTabItem[]>([])
  const activeTabKey = ref('')
  const activeOperation = ref(STACK_DEFAULT_OPERATION)
  const viewerStage = ref<HTMLElement | null>(null)
  const activeViewportKey = ref('single')
  const viewportElements = ref<Partial<Record<MprViewportKey, HTMLElement | null>>>({})
  const seriesCornerInfoMap = ref<Record<string, CornerInfo>>({})
  const loadingSeriesCornerInfo = new Map<string, Promise<CornerInfo>>()

  const selectedSeries = computed(
    () => seriesList.value.find((item) => item.seriesId === selectedSeriesId.value) ?? null
  )
  const activeTab = computed(() => viewerTabs.value.find((item) => item.key === activeTabKey.value) ?? null)
  const hasSelectedSeries = computed(() => Boolean(selectedSeriesId.value))

  let resizeObserver: ResizeObserver | null = null
  let observedViewerStage: HTMLElement | null = null

  function updateHoverCornerInfoByViewId(viewId: string, row: number | null = null, col: number | null = null): void {
    viewerTabs.value = viewerTabs.value.map((item) => {
      if (item.viewId === viewId && item.viewType === 'Stack') {
        return {
          ...item,
          cornerInfo: withHoverCornerInfo(item.cornerInfo, row, col)
        }
      }

      const viewportKey = Object.entries(item.viewportViewIds ?? {}).find(([, candidateViewId]) => candidateViewId === viewId)?.[0] as
        | MprViewportKey
        | undefined
      if (!viewportKey || item.viewType !== 'MPR') {
        return item
      }

      return {
        ...item,
        viewportCornerInfos: {
          ...(item.viewportCornerInfos ?? {}),
          [viewportKey]: withHoverCornerInfo(item.viewportCornerInfos?.[viewportKey] ?? item.cornerInfo, row, col)
        }
      }
    })
  }

  function toggleSidebar(): void {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  function setActiveOperation(value: string): void {
    activeOperation.value = value
  }

  const { clearPendingVolumeConfig, flushAllPendingVolumeConfig, scheduleVolumeConfigEmit } = useVolumeConfigSync({
    debounceMs: VOLUME_CONFIG_DEBOUNCE_MS,
    emitVolumeConfig: (viewId, config) => {
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.volumeConfig,
        volumeConfig: config
      })
    }
  })

  function triggerViewAction(payload: { action: 'reset' | 'volumePreset'; value?: string }): void {
    const tab = activeTab.value
    if (!tab) {
      return
    }

    if (payload.action === 'reset' && tab.viewType !== 'Stack' && tab.viewType !== '3D') {
      return
    }

    if (payload.action === 'volumePreset' && tab.viewType !== '3D') {
      return
    }

    if (!tab.viewId) {
      return
    }

    clearPendingVolumeConfig(tab.viewId)

    if (payload.action === 'reset' && tab.viewType === '3D') {
      const defaultConfig = createDefaultVolumeRenderConfig('aaa')
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              volumePreset: 'volumePreset:aaa',
              volumeRenderConfig: defaultConfig
            }
          : item
      )

      emitViewOperation({
        viewId: tab.viewId,
        opType: VIEW_OPERATION_TYPES.reset
      })
      emitViewOperation({
        viewId: tab.viewId,
        opType: VIEW_OPERATION_TYPES.volumeConfig,
        volumeConfig: defaultConfig
      })
      return
    }

    if (payload.action === 'volumePreset' && payload.value) {
      const presetKey = normalizeVolumePresetKey(payload.value)
      const presetConfig = createDefaultVolumeRenderConfig(presetKey)
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              volumePreset: `volumePreset:${presetKey}`,
              volumeRenderConfig: presetConfig
            }
          : item
      )

      emitViewOperation({
        viewId: tab.viewId,
        opType: VIEW_OPERATION_TYPES.volumeConfig,
        volumeConfig: presetConfig
      })
      return
    }

    emitViewOperation({
      viewId: tab.viewId,
      opType: VIEW_OPERATION_TYPES.reset
    })
  }

  function handleVolumeConfigChange(config: VolumeRenderConfig): void {
    const tab = activeTab.value
    if (!tab || tab.viewType !== '3D' || !tab.viewId) {
      return
    }

    const normalizedConfig = normalizeVolumeRenderConfig(config, config.preset)
    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === tab.key
        ? {
            ...item,
            volumePreset: `volumePreset:${normalizedConfig.preset}`,
            volumeRenderConfig: normalizedConfig
          }
        : item
    )

    scheduleVolumeConfigEmit(tab.viewId, normalizedConfig)
  }

  function setActiveViewportKey(viewportKey: string): void {
    activeViewportKey.value = viewportKey
  }

  function getMprOperationContext(viewportKey: string): {
    tab: ViewerTabItem
    viewId: string
    viewportKey: MprViewportKey
  } | null {
    const tab = activeTab.value
    if (!tab || tab.viewType !== 'MPR' || !isMprViewportKey(viewportKey)) {
      return null
    }

    const viewId = tab.viewportViewIds?.[viewportKey] ?? ''
    if (!viewId) {
      return null
    }

    return {
      tab,
      viewId,
      viewportKey
    }
  }

  function emitMprViewOperation(
    viewportKey: string,
    payload: Omit<Parameters<typeof emitViewOperation>[0], 'viewId'>
  ): void {
    const context = getMprOperationContext(viewportKey)
    if (!context) {
      return
    }

    emitViewOperation({
      ...payload,
      viewId: context.viewId
    })
  }

  function emitMeasurementOperation(payload: {
    viewportKey: string
    toolType: MeasurementToolType
    phase: 'start' | 'move' | 'end'
    points: MeasurementDraftPoint[]
    measurementId?: string
  }): void {
    const tab = activeTab.value
    if (!tab || (tab.viewType !== 'Stack' && tab.viewType !== 'MPR') || !payload.points.length) {
      return
    }

    const operationPayload = {
      opType: VIEW_OPERATION_TYPES.measurement,
      measurementId: payload.measurementId,
      subOpType: payload.toolType,
      actionType: payload.phase,
      viewportKey: payload.viewportKey,
      points: payload.points
    } as const

    if (tab.viewType === 'MPR') {
      emitMprViewOperation(payload.viewportKey, operationPayload)
      return
    }

    if (!tab.viewId) {
      return
    }

    emitViewOperation({
      viewId: tab.viewId,
      ...operationPayload
    })
  }

  function setViewerStage(payload: WorkspaceReadyPayload): void {
    const nextElement = payload.element ?? null
    const previousElement = viewerStage.value
    viewerStage.value = nextElement
    viewportElements.value = payload.viewportElements ?? {}

    if (resizeObserver && previousElement && previousElement !== nextElement) {
      resizeObserver.unobserve(previousElement)
      observedViewerStage = null
    }
    if (nextElement) {
      setupResizeObserver()
    }
  }

  async function ensureSeriesCornerInfo(seriesId: string): Promise<CornerInfo> {
    const cached = seriesCornerInfoMap.value[seriesId]
    if (cached) {
      return cached
    }

    const pending = loadingSeriesCornerInfo.get(seriesId)
    if (pending) {
      return pending
    }

    const request = api
      .post<CornerInfoResponse>('/dicom/cornerInfo', { seriesId })
      .then(({ data }) => {
        const normalized = normalizeCornerInfo(data)
        seriesCornerInfoMap.value = {
          ...seriesCornerInfoMap.value,
          [seriesId]: normalized
        }
        return normalized
      })
      .finally(() => {
        loadingSeriesCornerInfo.delete(seriesId)
      })

    loadingSeriesCornerInfo.set(seriesId, request)
    return request
  }

  const { cleanupHover, handleHoverInfo, handleHoverViewportChange, stripHoverCornerInfo, withHoverCornerInfo } =
    useViewerWorkspaceHover({
      activeTab,
      activeViewportKey,
      updateHoverCornerInfoByViewId
    })

  const views = useViewerWorkspaceViews({
    activeTabKey,
    activeViewportKey,
    clearPendingVolumeConfig,
    ensureSeriesCornerInfo,
    isViewLoading,
    message,
    selectedSeries,
    selectedSeriesId,
    seriesCornerInfoMap,
    seriesList,
    stripHoverCornerInfo,
    viewerStage,
    viewerTabs,
    viewportElements,
    withHoverCornerInfo
  })

  function normalizeImageBinary(value: unknown): ArrayBuffer | Uint8Array | null {
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      return value
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
      return new Uint8Array(value)
    }

    return null
  }

  function normalizeImageUpdateArgs(
    args: unknown[]
  ): { payload: Partial<ViewImageResponse>; imageBinary?: ArrayBuffer | Uint8Array } | null {
    if (!args.length) {
      return null
    }

    if (Array.isArray(args[0])) {
      const [payload, imageBinary] = args[0] as [Partial<ViewImageResponse> | undefined, unknown]
      return payload ? { payload, imageBinary: normalizeImageBinary(imageBinary) ?? undefined } : null
    }

    const [payload, imageBinary] = args as [Partial<ViewImageResponse> | undefined, unknown]
    return payload ? { payload, imageBinary: normalizeImageBinary(imageBinary) ?? undefined } : null
  }

  function handleImageUpdate(...args: unknown[]): void {
    const normalized = normalizeImageUpdateArgs(args)
    if (!normalized) {
      return
    }

    const { payload, imageBinary } = normalized
    const viewId = payload.viewId
    if (!viewId || !imageBinary) {
      return
    }

    const tab = views.findTabByViewId(viewId)
    if (!tab) {
      return
    }

    views.updateTabImage(tab.key, payload, imageBinary)
  }

  function handleImageError(error: { message?: string } | undefined): void {
    if (error?.message) {
      message.value = error.message
    }
  }

  const { cleanupSocketListeners, connectBackend, connectionState } = useViewerWorkspaceConnection({
    backendOrigin,
    onConnected: views.rebindOpenViews,
    onDisconnected: () => {},
    onReconnecting: () => {},
    onHoverInfo: handleHoverInfo,
    onImageError: handleImageError,
    onImageUpdate: handleImageUpdate
  })

  function handleViewportWheel(deltaY: number): void {
    const tab = activeTab.value
    if (!tab) {
      return
    }

    const viewId =
      tab.viewType === 'MPR' ? tab.viewportViewIds?.[activeViewportKey.value as MprViewportKey] ?? '' : tab.viewId
    if (!viewId || (tab.viewType !== 'Stack' && tab.viewType !== 'MPR')) {
      return
    }

    const normalizedDelta = Number.isFinite(deltaY) ? Math.trunc(deltaY) : 0
    const scroll = normalizedDelta > 0 ? normalizedDelta : normalizedDelta < 0 ? normalizedDelta : 0
    if (!scroll) {
      return
    }

    if (tab.viewType === 'MPR') {
      emitMprViewOperation(activeViewportKey.value, {
        opType: VIEW_OPERATION_TYPES.scroll,
        delta: scroll
      })
      return
    }

    emitViewOperation({
      viewId,
      opType: VIEW_OPERATION_TYPES.scroll,
      delta: scroll
    })
  }

  function handleViewportDrag(payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'start' | 'move' | 'end'
    viewportKey: string
  }): void {
    const tab = activeTab.value
    if (!tab || !STACK_DRAG_OPERATIONS.includes(payload.opType as (typeof STACK_DRAG_OPERATIONS)[number])) {
      return
    }

    const viewId =
      tab.viewType === 'MPR' ? tab.viewportViewIds?.[payload.viewportKey as MprViewportKey] ?? '' : tab.viewId
    if (!viewId) {
      return
    }

    if (payload.phase === DRAG_ACTION_TYPES.move && !payload.deltaX && !payload.deltaY) {
      return
    }

    if (tab.viewType === 'MPR') {
      emitMprViewOperation(payload.viewportKey, {
        opType: payload.opType,
        actionType: payload.phase,
        x: payload.deltaX,
        y: payload.deltaY
      })
      return
    }

    emitViewOperation({
      viewId,
      opType: payload.opType,
      actionType: payload.phase,
      x: payload.deltaX,
      y: payload.deltaY
    })
  }

  function handleMprCrosshair(payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }): void {
    emitMprViewOperation(payload.viewportKey, {
      opType: VIEW_OPERATION_TYPES.crosshair,
      actionType: payload.phase,
      x: payload.x,
      y: payload.y
    })
  }

  function handleMeasurementCreate(payload: {
    viewportKey: string
    toolType: MeasurementToolType
    points: MeasurementDraftPoint[]
    measurementId?: string
  }): void {
    emitMeasurementOperation({
      ...payload,
      phase: DRAG_ACTION_TYPES.end
    })
  }

  function handleMeasurementDraft(payload: {
    viewportKey: string
    toolType: MeasurementToolType
    phase: 'start' | 'move' | 'end'
    points: MeasurementDraftPoint[]
  }): void {
    emitMeasurementOperation(payload)
  }

  async function chooseFolder(): Promise<void> {
    const picked = await window.viewerApi?.chooseFolder?.()
    if (!picked) {
      return
    }

    await loadFolderSeries(picked)
  }

  async function loadFolderSeries(path: string): Promise<void> {
    isLoadingFolder.value = true

    try {
      const { data } = await api.post<{ seriesList?: FolderSeriesItem[] }>('/dicom/loadFolder', {
        folderPath: path
      })

      const incomingSeries = data.seriesList ?? []
      if (!incomingSeries.length) {
        message.value = '所选文件夹中未找到可用序列。'
        return
      }

      const existingSeriesKeys = new Set(
        seriesList.value.map((item) => item.seriesInstanceUid || `${item.folderPath}::${item.seriesId}`)
      )
      const appendedSeries = incomingSeries.filter((item) => {
        const seriesKey = item.seriesInstanceUid || `${item.folderPath}::${item.seriesId}`
        if (existingSeriesKeys.has(seriesKey)) {
          return false
        }
        existingSeriesKeys.add(seriesKey)
        return true
      })

      if (appendedSeries.length) {
        seriesList.value = [...seriesList.value, ...appendedSeries]
      }

      const nextSeriesId = appendedSeries[0]?.seriesId ?? selectedSeriesId.value
      if (nextSeriesId) {
        views.selectSeries(nextSeriesId)
      }

      message.value = ''
    } catch (error) {
      message.value = '加载文件夹失败。'
      console.error(error)
    } finally {
      isLoadingFolder.value = false
    }
  }

  function setupResizeObserver(): void {
    if (!viewerStage.value || typeof ResizeObserver === 'undefined') {
      return
    }

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        const hasRenderableView =
          Boolean(activeTab.value?.viewId) || Object.values(activeTab.value?.viewportViewIds ?? {}).some(Boolean)
        if (hasRenderableView && !isViewLoading.value && activeTab.value) {
          void views.renderTab(activeTab.value.key)
        }
      })
    }

    if (observedViewerStage === viewerStage.value) {
      return
    }

    resizeObserver.observe(viewerStage.value)
    observedViewerStage = viewerStage.value
  }

  onMounted(() => {
    connectBackend()
  })

  onBeforeUnmount(() => {
    flushAllPendingVolumeConfig()
    cleanupHover()
    cleanupSocketListeners()
    if (resizeObserver && observedViewerStage) {
      resizeObserver.unobserve(observedViewerStage)
    }
    resizeObserver?.disconnect()
  })

  return {
    activeOperation,
    activeTab,
    activeTabKey,
    activateTab: views.activateTab,
    chooseFolder,
    closeTab: views.closeTab,
    connectionState,
    handleHoverViewportChange,
    handleMeasurementCreate,
    handleMeasurementDraft,
    handleMprCrosshair,
    handleVolumeConfigChange,
    handleViewportDrag,
    handleViewportWheel,
    hasSelectedSeries,
    isLoadingFolder,
    isSidebarCollapsed,
    isViewLoading,
    message,
    openSeriesView: views.openSeriesView,
    openView: views.openView,
    removeSeries: views.removeSeries,
    selectSeries: views.selectSeries,
    selectedSeriesId,
    seriesList,
    setActiveOperation,
    setActiveViewportKey,
    setViewerStage,
    toggleSidebar,
    triggerViewAction,
    viewerStage,
    viewerTabs
  }
}
