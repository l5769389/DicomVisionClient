import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import {
  DRAG_ACTION_TYPES,
  STACK_DEFAULT_OPERATION,
  STACK_DRAG_OPERATIONS,
  STACK_OPERATION_PREFIX,
  type ViewOperationType,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import throttle from 'lodash/throttle'
import { api, setApiBaseURL } from '../services/api'
import { bindView, connectSocket, emitViewHover, emitViewOperation, getSocket } from '../services/socket'
import {
  buildTabTitle,
  createEmptyCornerInfo,
  createEmptyMprCrosshairs,
  createEmptyMprCornerInfos,
  createEmptyMprImages,
  createEmptyMprOrientations,
  createEmptyMprSliceLabels,
  createEmptyMprViewIds,
  createEmptyOrientationInfo,
  createTab,
  createTabKey,
  getSeriesDisplayName,
  isMprViewportKey,
  mergeCornerInfo,
  normalizeCornerInfo,
  normalizeOrientationInfo
} from './viewerWorkspaceTabs'
import {
  createDefaultVolumeRenderConfig,
  normalizeVolumePresetKey,
  normalizeVolumeRenderConfig
} from './volumeRenderConfig'
import type {
  BackendCreateViewType,
  CornerInfo,
  CornerInfoResponse,
  ConnectionState,
  FolderSeriesItem,
  LoadFolderResponse,
  MeasurementDraftPoint,
  MeasurementOverlay,
  MeasurementToolType,
  MprViewportKey,
  OperationAcceptedResponse,
  OrientationInfo,
  VolumeRenderConfig,
  ViewCreateResponse,
  ViewHoverResponse,
  ViewImageResponse,
  ViewerOperationItem,
  ViewerTabItem,
  ViewType,
  WorkspaceReadyPayload
} from '../types/viewer'

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
    phase: 'start' | 'move' | 'end'
    viewportKey: string
  }) => void
  handleHoverViewportChange: (payload: { viewportKey: string; x: number | null; y: number | null }) => void
  handleMeasurementDraft: (payload: { viewportKey: string; toolType: MeasurementToolType; phase: 'start' | 'move' | 'end'; points: MeasurementDraftPoint[] }) => void
  handleMprCrosshair: (payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }) => void
  handleMeasurementCreate: (payload: { viewportKey: string; toolType: MeasurementToolType; points: MeasurementDraftPoint[] }) => void
  handleVolumeConfigChange: (config: VolumeRenderConfig) => void
  isLoadingFolder: Ref<boolean>
  isSidebarCollapsed: Ref<boolean>
  isViewLoading: Ref<boolean>
  message: Ref<string>
  operationItems: ViewerOperationItem[]
  openView: (viewType: ViewType) => Promise<void>
  openSeriesView: (seriesId: string, viewType: ViewType) => Promise<void>
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
  const HOVER_EMIT_THROTTLE_MS = 30
  const backendOrigin = ref('http://127.0.0.1:8000')
  const message = ref('')
  const isSidebarCollapsed = ref(false)
  const isLoadingFolder = ref(false)
  const isViewLoading = ref(false)
  const connectionState = ref<ConnectionState>('connecting')
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
  const viewSizeCache = new Map<string, string>()
  const pendingVolumeConfigByViewId = new Map<string, VolumeRenderConfig>()
  const volumeConfigTimers = new Map<string, ReturnType<typeof window.setTimeout>>()
  const hoveredViewIds = new Set<string>()

  const operationItems: ViewerOperationItem[] = []

  const selectedSeries = computed(() =>
    seriesList.value.find((item) => item.seriesId === selectedSeriesId.value) ?? null
  )

  const activeTab = computed(() => viewerTabs.value.find((item) => item.key === activeTabKey.value) ?? null)

  const hasSelectedSeries = computed(() => Boolean(selectedSeriesId.value))

  let resizeObserver: ResizeObserver | null = null
  let observedViewerStage: HTMLElement | null = null
  const emitThrottledViewHover = throttle(
    (payload: { viewId: string; x: number; y: number }) => {
      emitViewHover(payload)
    },
    HOVER_EMIT_THROTTLE_MS,
    { leading: true, trailing: true }
  )
  const hoverCornerPattern = /^X:\s*-?\d+\s+Y:\s*-?\d+$/i

  function stripHoverCornerInfo(cornerInfo: CornerInfo): CornerInfo {
    return {
      ...cornerInfo,
      bottomRight: cornerInfo.bottomRight.filter((line) => !hoverCornerPattern.test(line.trim()))
    }
  }

  function withHoverCornerInfo(cornerInfo: CornerInfo, row: number | null = null, col: number | null = null): CornerInfo {
    const hoverLine = cornerInfo.bottomRight.find((line) => hoverCornerPattern.test(line.trim())) ?? null
    const bottomRight = cornerInfo.bottomRight.filter((line) => !hoverCornerPattern.test(line.trim()))
    if (row != null && col != null) {
      bottomRight.push(`X:${col} Y:${row}`)
    } else if (hoverLine) {
      bottomRight.push(hoverLine)
    }
    return {
      ...cornerInfo,
      bottomRight
    }
  }

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
          ...(item.viewportCornerInfos ?? createEmptyMprCornerInfos()),
          [viewportKey]: withHoverCornerInfo(item.viewportCornerInfos?.[viewportKey] ?? item.cornerInfo, row, col)
        }
      }
    })
  }

  function findTab(seriesId: string, viewType?: ViewType): ViewerTabItem | undefined {
    return viewerTabs.value.find((item) =>
      viewType ? item.seriesId === seriesId && item.viewType === viewType : item.seriesId === seriesId
    )
  }

  function findTabByViewId(viewId: string): ViewerTabItem | undefined {
    return viewerTabs.value.find(
      (item) => item.viewId === viewId || Object.values(item.viewportViewIds ?? {}).includes(viewId)
    )
  }

  function ensureTab(seriesId: string, viewType: ViewType): string {
    const existingTab = findTab(seriesId, viewType)
    if (existingTab) {
      activeTabKey.value = existingTab.key
      return existingTab.key
    }

    const series = seriesList.value.find((item) => item.seriesId === seriesId)
    if (!series) {
      return ''
    }

    const tab = createTab(series, viewType)
    viewerTabs.value = [...viewerTabs.value, tab]
    activeTabKey.value = tab.key
    return tab.key
  }

  function toggleSidebar(): void {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  function setActiveOperation(value: string): void {
    activeOperation.value = value
  }

  function flushVolumeConfig(viewId: string): void {

    const pendingConfig = pendingVolumeConfigByViewId.get(viewId)
    if (!pendingConfig) {
      return
    }

    const timer = volumeConfigTimers.get(viewId)
    if (timer) {
      window.clearTimeout(timer)
      volumeConfigTimers.delete(viewId)
    }

    pendingVolumeConfigByViewId.delete(viewId)
    emitViewOperation({
      viewId,
      opType: VIEW_OPERATION_TYPES.volumeConfig,
      volumeConfig: pendingConfig
    })
  }

  function clearPendingVolumeConfig(viewId: string): void {
    const timer = volumeConfigTimers.get(viewId)
    if (timer) {
      window.clearTimeout(timer)
      volumeConfigTimers.delete(viewId)
    }
    pendingVolumeConfigByViewId.delete(viewId)
  }

  function scheduleVolumeConfigEmit(viewId: string, config: VolumeRenderConfig): void {
    pendingVolumeConfigByViewId.set(viewId, config)
    const existingTimer = volumeConfigTimers.get(viewId)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }
    volumeConfigTimers.set(
      viewId,
      window.setTimeout(() => {
        volumeConfigTimers.delete(viewId)
        flushVolumeConfig(viewId)
      }, VOLUME_CONFIG_DEBOUNCE_MS)
    )
  }

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

  function getCreateViewTypeForViewport(viewportKey: MprViewportKey): BackendCreateViewType {
    if (viewportKey === 'mpr-cor') {
      return 'COR'
    }
    if (viewportKey === 'mpr-sag') {
      return 'SAG'
    }
    return 'AX'
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

  function emitMeasurementOperation(
    payload: {
      viewportKey: string
      toolType: MeasurementToolType
      phase: 'start' | 'move' | 'end'
      points: MeasurementDraftPoint[]
    }
  ): void {
    const tab = activeTab.value
    if (!tab || (tab.viewType !== 'Stack' && tab.viewType !== 'MPR') || !payload.points.length) {
      return
    }

    const operationPayload = {
      opType: VIEW_OPERATION_TYPES.measurement,
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

  function updateConnectionState(state: ConnectionState): void {
    connectionState.value = state
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

  function rebindOpenViews(): void {
    viewerTabs.value.forEach((tab) => {
      if (tab.viewId) {
        bindView(tab.viewId)
      }
      Object.values(tab.viewportViewIds ?? {}).forEach((viewId) => {
        if (viewId) {
          bindView(viewId)
        }
      })
    })
  }

  function handleSocketConnect(): void {
    updateConnectionState('connected')
    rebindOpenViews()
  }

  function handleSocketDisconnect(): void {
    updateConnectionState('disconnected')
  }

  function handleSocketReconnectAttempt(): void {
    updateConnectionState('reconnecting')
  }

  function handleSocketReconnect(): void {
    updateConnectionState('connected')
    rebindOpenViews()
  }

  function handleSocketReconnectError(): void {
    updateConnectionState('reconnecting')
  }

  function handleSocketReconnectFailed(): void {
    updateConnectionState('disconnected')
  }

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

    const tab = findTabByViewId(viewId)
    if (!tab) {
      return
    }

    updateTabImage(tab.key, payload, imageBinary)
  }

  function handleImageError(error: { message?: string } | undefined): void {
    if (error?.message) {
      message.value = error.message
    }
  }

  function handleHoverInfo(payload: ViewHoverResponse | undefined): void {
    if (!payload?.viewId || !hoveredViewIds.has(payload.viewId)) {
      return
    }
    updateHoverCornerInfoByViewId(payload.viewId, payload.row, payload.col)
  }

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

  function handleMeasurementCreate(payload: { viewportKey: string; toolType: MeasurementToolType; points: MeasurementDraftPoint[] }): void {
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
    if (payload.phase === DRAG_ACTION_TYPES.start) {
      // Draft label lines are now owned by ViewerWorkspace local draft state.
    }

    emitMeasurementOperation(payload)
  }

  function handleHoverViewportChange(payload: { viewportKey: string; x: number | null; y: number | null }): void {
    const tab = activeTab.value
    if (!tab || (tab.viewType !== 'Stack' && tab.viewType !== 'MPR')) {
      return
    }

    const viewId =
      tab.viewType === 'MPR' ? tab.viewportViewIds?.[payload.viewportKey as MprViewportKey] ?? '' : tab.viewId
    if (!viewId) {
      return
    }

    if (payload.x == null || payload.y == null) {
      emitThrottledViewHover.cancel()
      hoveredViewIds.delete(viewId)
      updateHoverCornerInfoByViewId(viewId)
      return
    }

    hoveredViewIds.add(viewId)
    emitThrottledViewHover({
      viewId,
      x: payload.x,
      y: payload.y
    })
  }

  function cleanupSocketListeners(): void {
    const socket = getSocket()
    if (!socket) {
      return
    }

    socket.off('connect', handleSocketConnect)
    socket.off('disconnect', handleSocketDisconnect)
    socket.io.off('reconnect_attempt', handleSocketReconnectAttempt)
    socket.io.off('reconnect', handleSocketReconnect)
    socket.io.off('reconnect_error', handleSocketReconnectError)
    socket.io.off('reconnect_failed', handleSocketReconnectFailed)
    socket.off('image_update', handleImageUpdate)
    socket.off('hover_info', handleHoverInfo)
    socket.off('image_error', handleImageError)
    socket.off('render_error', handleImageError)
  }

  function connectBackend(): void {
    cleanupSocketListeners()
    updateConnectionState('connecting')
    setApiBaseURL(`${backendOrigin.value}/api/v1`)

    const socket = connectSocket(backendOrigin.value)
    socket.on('connect', handleSocketConnect)
    socket.on('disconnect', handleSocketDisconnect)
    socket.io.on('reconnect_attempt', handleSocketReconnectAttempt)
    socket.io.on('reconnect', handleSocketReconnect)
    socket.io.on('reconnect_error', handleSocketReconnectError)
    socket.io.on('reconnect_failed', handleSocketReconnectFailed)
    socket.on('image_update', handleImageUpdate)
    socket.on('hover_info', handleHoverInfo)
    socket.on('image_error', handleImageError)
    socket.on('render_error', handleImageError)
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
      const { data } = await api.post<LoadFolderResponse>('/dicom/loadFolder', {
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
        selectSeries(nextSeriesId)
      }

      message.value = ''
    } catch (error) {
      message.value = '加载文件夹失败。'
      console.error(error)
    } finally {
      isLoadingFolder.value = false
    }
  }

  function selectSeries(seriesId: string): void {
    selectedSeriesId.value = seriesId

    const activeSeriesTab = viewerTabs.value.find((item) => item.seriesId === seriesId && item.key === activeTabKey.value)
    if (activeSeriesTab) {
      return
    }

    const existingTab = findTab(seriesId, 'Stack') ?? findTab(seriesId)
    activeTabKey.value = existingTab?.key ?? ''
  }

  function activateTab(tabKey: string): void {
    activeTabKey.value = tabKey
    const tab = viewerTabs.value.find((item) => item.key === tabKey)
    if (tab) {
      selectedSeriesId.value = tab.seriesId
      activeViewportKey.value = tab.viewType === 'MPR' ? 'mpr-ax' : tab.viewType === '3D' ? 'volume' : 'single'
    }
  }

  function closeTab(tabKey: string): void {
    const currentIndex = viewerTabs.value.findIndex((item) => item.key === tabKey)
    if (currentIndex < 0) {
      return
    }

    const closingTab = viewerTabs.value[currentIndex]
    if (closingTab.viewId) {
      clearPendingVolumeConfig(closingTab.viewId)
    }
    if (closingTab.viewId) {
      viewSizeCache.delete(closingTab.viewId)
    }
    Object.values(closingTab.viewportViewIds ?? {}).forEach((viewId) => {
      if (viewId) {
        viewSizeCache.delete(viewId)
      }
    })
    const closingImageSrc = viewerTabs.value[currentIndex]?.imageSrc
    if (closingImageSrc?.startsWith('blob:')) {
      URL.revokeObjectURL(closingImageSrc)
    }
    Object.values(closingTab.viewportImages ?? {}).forEach((imageSrc) => {
      if (imageSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc)
      }
    })

    const nextTabs = viewerTabs.value.filter((item) => item.key !== tabKey)
    viewerTabs.value = nextTabs

    const relatedTabs = nextTabs.filter((item) => item.seriesId === closingTab.seriesId)
    if (selectedSeriesId.value === closingTab.seriesId) {
      selectedSeriesId.value =
        relatedTabs[0]?.seriesId ?? nextTabs[currentIndex]?.seriesId ?? nextTabs[currentIndex - 1]?.seriesId ?? ''
    }

    if (activeTabKey.value === tabKey) {
      const fallbackTab = relatedTabs[0] ?? nextTabs[currentIndex] ?? nextTabs[currentIndex - 1] ?? null
      activeTabKey.value = fallbackTab?.key ?? ''
    }

    if (!nextTabs.length) {
      message.value = ''
    }
  }

  function removeSeries(seriesId: string): void {
    const nextSeries = seriesList.value.filter((item) => item.seriesId !== seriesId)
    seriesList.value = nextSeries
    const nextSeriesCornerInfoMap = { ...seriesCornerInfoMap.value }
    delete nextSeriesCornerInfoMap[seriesId]
    seriesCornerInfoMap.value = nextSeriesCornerInfoMap

    const relatedTabs = viewerTabs.value.filter((item) => item.seriesId === seriesId)
    relatedTabs.forEach((tab) => closeTab(tab.key))

    if (selectedSeriesId.value === seriesId) {
      const fallbackSeriesId = nextSeries[0]?.seriesId ?? ''
      selectedSeriesId.value = fallbackSeriesId
      if (fallbackSeriesId) {
        selectSeries(fallbackSeriesId)
      }
    }
  }

  function updateTabImage(tabKey: string, payload: Partial<ViewImageResponse>, imageBinary: ArrayBuffer | Uint8Array): void {
    viewerTabs.value = viewerTabs.value.map((item) => {
      if (item.key !== tabKey) {
        return item
      }

      const ww = payload.window_info?.ww
      const wl = payload.window_info?.wl
      const mimeType = payload.imageFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
      const bytes = new Uint8Array(imageBinary)
      const imageSrc = URL.createObjectURL(new Blob([bytes], { type: mimeType }))
      const sliceLabel = payload.slice_info ? `${payload.slice_info.current + 1} / ${payload.slice_info.total}` : item.sliceLabel
      const windowLabel = ww != null || wl != null ? `WW ${ww ?? '-'}  WL ${wl ?? '-'}` : item.windowLabel
      const seriesCornerInfo = seriesCornerInfoMap.value[item.seriesId] ?? createEmptyCornerInfo()
      const sliceCornerInfo = stripHoverCornerInfo(normalizeCornerInfo(payload.cornerInfo))
      const orientationInfo = normalizeOrientationInfo(payload.orientation)
      const volumePreset = payload.volumePreset ? `volumePreset:${normalizeVolumePresetKey(payload.volumePreset)}` : item.volumePreset
      const volumeRenderConfig = payload.volumeConfig
        ? normalizeVolumeRenderConfig(payload.volumeConfig, payload.volumePreset ?? item.volumePreset)
        : item.volumeRenderConfig

      const viewportKey = Object.entries(item.viewportViewIds ?? {}).find(([, viewId]) => viewId === payload.viewId)?.[0] as
        | MprViewportKey
        | undefined
      if (viewportKey && item.viewType === 'MPR') {
        const currentViewportImage = item.viewportImages?.[viewportKey]
        if (currentViewportImage?.startsWith('blob:')) {
          URL.revokeObjectURL(currentViewportImage)
        }

        return {
          ...item,
          windowLabel,
          viewportImages: {
            ...(item.viewportImages ?? createEmptyMprImages()),
            [viewportKey]: imageSrc
          },
          viewportSliceLabels: {
            ...(item.viewportSliceLabels ?? createEmptyMprSliceLabels()),
            [viewportKey]: sliceLabel
          },
          viewportCrosshairs: {
            ...(item.viewportCrosshairs ?? createEmptyMprCrosshairs()),
            [viewportKey]: payload.mpr_crosshair ?? null
          },
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [viewportKey]: (payload.measurements ?? []) as MeasurementOverlay[]
          },
          viewportCornerInfos: {
            ...(item.viewportCornerInfos ?? createEmptyMprCornerInfos()),
            [viewportKey]: withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo))
          },
          viewportOrientations: {
            ...(item.viewportOrientations ?? createEmptyMprOrientations()),
            [viewportKey]: orientationInfo
          },
          volumePreset,
          volumeRenderConfig
        }
      }

      if (item.imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(item.imageSrc)
      }

      return {
        ...item,
        viewId: payload.viewId ?? item.viewId,
        imageSrc,
        sliceLabel,
        windowLabel,
        measurements: (payload.measurements ?? []) as MeasurementOverlay[],
        cornerInfo: withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo)),
        orientation: orientationInfo,
        volumePreset,
        volumeRenderConfig
      }
    })
  }

  function getViewportSize(element: HTMLElement | null = viewerStage.value): { width: number; height: number } | null {
    if (!element) {
      return null
    }

    const styles = window.getComputedStyle(element)
    const horizontalPadding = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0')
    const verticalPadding = parseFloat(styles.paddingTop || '0') + parseFloat(styles.paddingBottom || '0')
    const width = element.clientWidth - horizontalPadding
    const height = element.clientHeight - verticalPadding

    const nextWidth = Math.floor(width)
    const nextHeight = Math.floor(height)
    if (nextWidth <= 0 || nextHeight <= 0) {
      return null
    }

    return {
      width: nextWidth,
      height: nextHeight
    }
  }

  function hasViewSizeChanged(viewId: string, size: { width: number; height: number }): boolean {
    const nextSignature = `${size.width}x${size.height}`
    const previousSignature = viewSizeCache.get(viewId)
    if (previousSignature === nextSignature) {
      return false
    }
    viewSizeCache.set(viewId, nextSignature)
    return true
  }

  async function renderTab(tabKey: string): Promise<void> {
    const tab = viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab) {
      return
    }

    if (tab.viewType === 'MPR') {
      const entries = Object.entries(tab.viewportViewIds ?? {}) as [MprViewportKey, string][]
      const tasks = entries
        .filter(([, viewId]) => Boolean(viewId))
        .map(async ([viewportKey, viewId]) => {
          const size = getViewportSize(viewportElements.value[viewportKey] ?? null)
          if (!size) {
            return
          }
          bindView(viewId)
          if (!hasViewSizeChanged(viewId, size)) {
            return
          }
          await api.post<OperationAcceptedResponse>('/view/setSize', {
            opType: VIEW_OPERATION_TYPES.setSize,
            size,
            viewId
          })
        })
      await Promise.all(tasks)
      return
    }

    if (!tab.viewId) {
      return
    }

    const size = getViewportSize()
    if (!size) {
      return
    }

    bindView(tab.viewId)
    if (!hasViewSizeChanged(tab.viewId, size)) {
      return
    }
    await api.post<OperationAcceptedResponse>('/view/setSize', {
      opType: VIEW_OPERATION_TYPES.setSize,
      size,
      viewId: tab.viewId
    })
  }

  async function openSeriesView(seriesId: string, viewType: ViewType): Promise<void> {
    if (!seriesId) {
      return
    }

    selectedSeriesId.value = seriesId

    const existingTab = findTab(seriesId, viewType)
    const hasExistingView =
      viewType === 'MPR'
        ? Object.values(existingTab?.viewportViewIds ?? {}).some(Boolean)
        : Boolean(existingTab?.viewId)
    if (hasExistingView && existingTab) {
      activeTabKey.value = existingTab.key
      return
    }

    const tabKey = existingTab?.key ?? ensureTab(seriesId, viewType)
    if (!tabKey) {
      return
    }

    isViewLoading.value = true

    try {
      const seriesCornerInfo = withHoverCornerInfo(await ensureSeriesCornerInfo(selectedSeriesId.value))
      let nextViewId = ''
      let nextViewportViewIds = createEmptyMprViewIds()
      if (viewType === 'MPR') {
        const viewportKeys: MprViewportKey[] = ['mpr-ax', 'mpr-cor', 'mpr-sag']
        const responses = await Promise.all(
          viewportKeys.map(async (viewportKey) => {
            const { data } = await api.post<ViewCreateResponse>('/view/create', {
              seriesId,
              viewType: getCreateViewTypeForViewport(viewportKey)
            })
            return [viewportKey, data.viewId] as const
          })
        )
        nextViewportViewIds = responses.reduce(
          (accumulator, [viewportKey, viewId]) => ({
            ...accumulator,
            [viewportKey]: viewId
          }),
          createEmptyMprViewIds()
        )
      } else {
        const { data } = await api.post<ViewCreateResponse>('/view/create', {
          seriesId,
          viewType
        })
        nextViewId = data.viewId
      }

      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tabKey
          ? {
              ...item,
              viewType,
              title: buildTabTitle(selectedSeries.value, viewType, item.seriesId),
              viewId: nextViewId,
              imageSrc: '',
              sliceLabel: '',
              windowLabel: '',
              viewportViewIds: nextViewportViewIds,
              viewportImages: createEmptyMprImages(),
              viewportSliceLabels: createEmptyMprSliceLabels(),
              viewportCrosshairs: createEmptyMprCrosshairs(),
              measurements: [],
              cornerInfo: seriesCornerInfo,
              orientation: createEmptyOrientationInfo(),
              viewportCornerInfos:
                viewType === 'MPR'
                  ? {
                      'mpr-ax': seriesCornerInfo,
                      'mpr-cor': seriesCornerInfo,
                      'mpr-sag': seriesCornerInfo
                    }
                  : createEmptyMprCornerInfos(),
              viewportMeasurements: {},
              viewportOrientations: createEmptyMprOrientations(),
              volumePreset: 'volumePreset:aaa',
              volumeRenderConfig: createDefaultVolumeRenderConfig('aaa')
            }
          : item
      )

      if (viewType === 'MPR') {
        Object.values(nextViewportViewIds).forEach((viewId) => {
          if (viewId) {
            bindView(viewId)
          }
        })
      } else if (nextViewId) {
        bindView(nextViewId)
      }
      activeViewportKey.value = viewType === 'MPR' ? 'mpr-ax' : viewType === '3D' ? 'volume' : 'single'
      activeTabKey.value = tabKey
      await nextTick()
      await renderTab(tabKey)
      message.value = ''
    } catch (error) {
      message.value = `${viewType} 视图打开失败。`
      console.error(error)
    } finally {
      isViewLoading.value = false
    }
  }

  async function openView(viewType: ViewType): Promise<void> {
    if (!selectedSeriesId.value) {
      return
    }

    await openSeriesView(selectedSeriesId.value, viewType)
  }

  function setupResizeObserver(): void {
    if (!viewerStage.value || typeof ResizeObserver === 'undefined') {
      return
    }

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        const hasRenderableView =
          Boolean(activeTab.value?.viewId) || Object.values(activeTab.value?.viewportViewIds ?? {}).some(Boolean)
        if (hasRenderableView && !isViewLoading.value) {
          void renderTab(activeTab.value!.key)
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
    for (const viewId of Array.from(pendingVolumeConfigByViewId.keys())) {
      flushVolumeConfig(viewId)
    }
    emitThrottledViewHover.cancel()
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
    activateTab,
    chooseFolder,
    closeTab,
    connectionState,
    handleHoverViewportChange,
    handleMeasurementDraft,
    handleMeasurementCreate,
    handleMprCrosshair,
    handleVolumeConfigChange,
    handleViewportDrag,
    handleViewportWheel,
    hasSelectedSeries,
    isLoadingFolder,
    isSidebarCollapsed,
    isViewLoading,
    message,
    openSeriesView,
    openView,
    operationItems,
    removeSeries,
    selectSeries,
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

