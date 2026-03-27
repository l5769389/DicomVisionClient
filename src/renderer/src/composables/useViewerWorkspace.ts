import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import {
  DRAG_ACTION_TYPES,
  STACK_DEFAULT_OPERATION,
  STACK_DRAG_OPERATIONS,
  STACK_OPERATION_PREFIX,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import { api, setApiBaseURL } from '../services/api'
import { bindView, connectSocket, emitViewOperation, getSocket } from '../services/socket'
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
import type {
  BackendCreateViewType,
  CornerInfo,
  CornerInfoResponse,
  ConnectionState,
  FolderSeriesItem,
  LoadFolderResponse,
  MprViewportKey,
  OperationAcceptedResponse,
  OrientationInfo,
  ViewCreateResponse,
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
  handleMprCrosshair: (payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }) => void
  isLoadingFolder: Ref<boolean>
  isSidebarCollapsed: Ref<boolean>
  isViewLoading: Ref<boolean>
  message: Ref<string>
  operationItems: ViewerOperationItem[]
  openView: (viewType: ViewType) => Promise<void>
  removeSeries: (seriesId: string) => void
  selectSeries: (seriesId: string) => void
  selectedSeriesId: Ref<string>
  seriesList: Ref<FolderSeriesItem[]>
  setActiveOperation: (value: string) => void
  setActiveViewportKey: (viewportKey: string) => void
  setViewerStage: (payload: WorkspaceReadyPayload) => void
  toggleSidebar: () => void
  viewerStage: Ref<HTMLElement | null>
  viewerTabs: Ref<ViewerTabItem[]>
}

export function useViewerWorkspace(): ViewerWorkspaceState {
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

  const operationItems: ViewerOperationItem[] = []

  const selectedSeries = computed(() =>
    seriesList.value.find((item) => item.seriesId === selectedSeriesId.value) ?? null
  )

  const activeTab = computed(() => viewerTabs.value.find((item) => item.key === activeTabKey.value) ?? null)

  const hasSelectedSeries = computed(() => Boolean(selectedSeriesId.value))

  let resizeObserver: ResizeObserver | null = null
  let observedViewerStage: HTMLElement | null = null

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

    const scroll = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0
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

  function getActiveDragOperation(): string | null {
    const normalizedOperation = activeOperation.value.startsWith(STACK_OPERATION_PREFIX)
      ? activeOperation.value.slice(STACK_OPERATION_PREFIX.length)
      : activeOperation.value
    const opType = normalizedOperation.split(':')[0]

    return STACK_DRAG_OPERATIONS.includes(opType as (typeof STACK_DRAG_OPERATIONS)[number]) ? opType : null
  }

  function handleViewportDrag(payload: {
    deltaX: number
    deltaY: number
    phase: 'start' | 'move' | 'end'
    viewportKey: string
  }): void {
    const tab = activeTab.value
    const opType = getActiveDragOperation()
    if (!tab || !opType) {
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
        opType,
        actionType: payload.phase,
        x: payload.deltaX,
        y: payload.deltaY
      })
      return
    }

    emitViewOperation({
      viewId,
      opType,
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

      const existingIds = new Set(seriesList.value.map((item) => item.seriesId))
      const appendedSeries = incomingSeries.filter((item) => !existingIds.has(item.seriesId))

      if (appendedSeries.length) {
        seriesList.value = [...seriesList.value, ...appendedSeries]
      }

      const nextSeriesId = data.seriesId ?? incomingSeries[0]?.seriesId ?? selectedSeriesId.value
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
      const sliceCornerInfo = normalizeCornerInfo(payload.cornerInfo)
      const orientationInfo = normalizeOrientationInfo(payload.orientation)

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
          viewportCornerInfos: {
            ...(item.viewportCornerInfos ?? createEmptyMprCornerInfos()),
            [viewportKey]: mergeCornerInfo(seriesCornerInfo, sliceCornerInfo)
          },
          viewportOrientations: {
            ...(item.viewportOrientations ?? createEmptyMprOrientations()),
            [viewportKey]: orientationInfo
          }
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
        cornerInfo: mergeCornerInfo(seriesCornerInfo, sliceCornerInfo),
        orientation: orientationInfo
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
    await api.post<OperationAcceptedResponse>('/view/setSize', {
      opType: VIEW_OPERATION_TYPES.setSize,
      size,
      viewId: tab.viewId
    })
  }

  async function openView(viewType: ViewType): Promise<void> {
    if (!selectedSeriesId.value) {
      return
    }

    const existingTab = findTab(selectedSeriesId.value, viewType)
    const hasExistingView =
      viewType === 'MPR'
        ? Object.values(existingTab?.viewportViewIds ?? {}).some(Boolean)
        : Boolean(existingTab?.viewId)
    if (hasExistingView && existingTab) {
      activeTabKey.value = existingTab.key
      await nextTick()
      await renderTab(existingTab.key)
      return
    }

    const tabKey = existingTab?.key ?? ensureTab(selectedSeriesId.value, viewType)
    if (!tabKey) {
      return
    }

    isViewLoading.value = true

    try {
      const seriesCornerInfo = await ensureSeriesCornerInfo(selectedSeriesId.value)
      let nextViewId = ''
      let nextViewportViewIds = createEmptyMprViewIds()
      if (viewType === 'MPR') {
        const viewportKeys: MprViewportKey[] = ['mpr-ax', 'mpr-cor', 'mpr-sag']
        const responses = await Promise.all(
          viewportKeys.map(async (viewportKey) => {
            const { data } = await api.post<ViewCreateResponse>('/view/create', {
              seriesId: selectedSeriesId.value,
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
          seriesId: selectedSeriesId.value,
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
              viewportOrientations: createEmptyMprOrientations()
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
    handleMprCrosshair,
    handleViewportDrag,
    handleViewportWheel,
    hasSelectedSeries,
    isLoadingFolder,
    isSidebarCollapsed,
    isViewLoading,
    message,
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
    viewerStage,
    viewerTabs
  }
}
