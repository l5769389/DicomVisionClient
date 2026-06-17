import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  DRAG_ACTION_TYPES,
  STACK_DEFAULT_OPERATION,
  STACK_DRAG_OPERATIONS,
  type ViewOperationType,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import { DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'
import { postApi, postDicomUpload, type DicomUploadProgress, type LoadFolderResponse } from '../../../services/typedApi'
import {
  emitFourDPlaybackFps,
  emitFourDPlaybackStart,
  emitFourDPlaybackStop,
  emitViewOperation,
  emitViewOperationWithAck,
  type ViewOperationInput,
  type ViewOperationPayload
} from '../../../services/socket'
import {
  COMPARE_STACK_PANE_KEYS,
  FUSION_PANE_KEYS,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY,
  createEmptyMprCrosshairs,
  createEmptyMprOrientations,
  createEmptyMprScaleBars,
  isCompareStackPaneKey,
  isFusionPaneKey,
  isMprViewportKey,
  normalizeCornerInfo
} from '../views/viewerWorkspaceTabs'
import {
  hasOperableView,
  isMprLikeViewType,
  isStackLikeViewType,
  resolveComparePaneKey,
  resolveFusionPaneKey,
  resolveOperationTargets,
  resolveViewIdForTabViewport
} from '../views/viewerViewportTargets'
import { withViewSyncValue } from '../sync/viewSyncConfig'
import {
  applyPseudocolorToTabTargets,
  applyTransformToTabTargets,
  resetTabViewStateTargets
} from '../operations/viewTabPatches'
import type { ViewerToolbarActionPayload } from '../operations/viewActionTypes'
import { useViewerWorkspaceConnection } from '../connection/useViewerWorkspaceConnection'
import { useViewerWorkspaceHover } from '../hover/useViewerWorkspaceHover'
import { getTabViewportCrosshairGeometry } from '../views/mprFrameGeometry'
import {
  resolveOptimisticMprCrosshairCenter,
  resolveOptimisticMprCrosshairRotation,
  resolveOptimisticMprCrosshairSlabOffsets,
  shouldPreserveLocalMprCrosshair,
  type ActiveMprCrosshairDragLock,
  type IncomingMprViewportUpdate
} from '../views/mprInteractionGuard'
import { useViewerWorkspaceViews } from '../views/useViewerWorkspaceViews'
import { MPR_VIEWPORT_KEYS } from '../views/fourDPhaseState'
import { createLatestRequestGuard } from '../requests/latestRequest'
import {
  createLayoutTemplateFromHangingProtocolRule,
  findMatchingHangingProtocolRule
} from '../layout/hangingProtocolRules'
import { mergeLoadedFolderSeries } from './folderSeriesMerge'
import { isLayoutStackDropSeriesSupported, resolveLayoutStackDropSeries } from './layoutDropSeries'
import { createResizeRenderScheduler } from './resizeRenderScheduler'
import { createMprInteractionOperationScheduler } from './mprInteractionOperationScheduler'
import { isViewerPerfDebugEnabled } from './viewerPerfDebug'
import { parseSliceLabel } from '../slices/useKeySliceStars'
import { resolveInitialSeriesViewType } from '../views/seriesViewSupport'
import {
  viewerRuntime,
  type BackendStatus,
  type DicomDropInput,
  type DicomLoadSelection,
  type DicomLoadSource,
  type WebUploadPickMode
} from '../../../platform/runtime'
import {
  DEFAULT_FUSION_PET_WINDOW_MAX,
  DEFAULT_FUSION_PET_WINDOW_MIN,
  DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET,
  DEFAULT_PSEUDOCOLOR_PRESET,
  normalizeFusionPetPseudocolorPresetKey,
  normalizePseudocolorPresetKey
} from '../../../constants/pseudocolor'
import {
  createDefaultMprMipConfig,
  createDefaultMprSegmentationConfig,
  normalizeMprSegmentationConfig,
  recolorMprSegmentationConfig
} from '../../../types/viewer'
import { useUiPreferences } from '../../ui/useUiPreferences'
import { useUiLocale } from '../../ui/useUiLocale'
import { useVolumeConfigSync } from '../volume/useVolumeConfigSync'
import {
  createDefaultVolumeRenderConfig,
  normalizeVolumePresetKey,
  normalizeVolumeRenderConfig
} from '../volume/volumeRenderConfig'
import {
  createDefaultSurfaceRenderConfig,
  normalizeRender3DMode,
  normalizeSurfaceRenderConfig
} from '../volume/surfaceRenderConfig'
import type {
  CornerInfo,
  ConnectionState,
  CompareStackPaneKey,
  CompareSyncSettingKey,
  FolderSeriesItem,
  FourDPlaybackPhaseEvent,
  FourDPlaybackStateEvent,
  MtfCurvePoint,
  MtfMetrics,
  MeasurementDraftPoint,
  MeasurementOverlay,
  MeasurementToolType,
  MprLayoutKey,
  MprCrosshairInteractionPayload,
  MprCrosshairMode,
  MprMipConfig,
  MprMipOperationConfig,
  MprSegmentationConfig,
  MprViewportKey,
  ViewImageResponse,
  ViewProgressInfo,
  ViewerLayoutTemplate,
  ViewTransformInfo,
  ViewerMtfItem,
  ViewerTabItem,
  ViewType,
  VolumeRenderConfig,
  WorkspaceReadyPayload
} from '../../../types/viewer'

interface ViewerWorkspaceState {
  activeOperation: Ref<string>
  activeTab: ComputedRef<ViewerTabItem | null>
  activeTabKey: Ref<string>
  activateTab: (tabKey: string) => void
  applyLoadedDicomSeries: (data: LoadFolderResponse, options?: LoadFolderSeriesOptions) => Promise<FolderSeriesItem[]>
  chooseFolder: (mode?: WebUploadPickMode) => Promise<void>
  closeTab: (tabKey: string) => void
  closeOtherTabs: (tabKey: string) => void
  connectionState: Ref<ConnectionState>
  hasSelectedSeries: ComputedRef<boolean>
  handleViewportWheel: (payload: number | { viewportKey: string; deltaY: number }) => void
  handleViewportDrag: (payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'start' | 'move' | 'end'
    viewportKey: string
  }) => void
  handleFusionRegistrationDrag: (payload: {
    deltaX: number
    deltaY: number
    phase: 'start' | 'move' | 'end'
    subOpType: 'translate' | 'rotate'
    viewportKey: string
    anchorX?: number
    anchorY?: number
    currentX?: number
    currentY?: number
    pivotX?: number
    pivotY?: number
  }) => void
  handleFusionConfigChange: (payload: {
    manualRegistration?: boolean
    pseudocolorPreset?: string
    petUnit?: string
    petWindowMin?: number
    petWindowMax?: number
    action?: 'reset' | 'save'
  }) => void
  handleHoverViewportChange: (payload: { viewportKey: string; x: number | null; y: number | null }) => void
  handleMeasurementDraft: (payload: {
    viewportKey: string
    toolType: MeasurementToolType
    phase: 'start' | 'move' | 'end'
    points: MeasurementDraftPoint[]
  }) => void
  handleMprCrosshair: (payload: MprCrosshairInteractionPayload) => void
  handleMeasurementCreate: (payload: {
    viewportKey: string
    toolType: MeasurementToolType
    points: MeasurementDraftPoint[]
    measurementId?: string
    labelLines?: string[]
  }) => void
  handleMeasurementDelete: (payload: { viewportKey: string; measurementId: string }) => void
  handleAnnotationOperation: (payload: {
    viewportKey: string
    annotationId?: string
    actionType: 'end' | 'delete'
    toolType?: string
    points?: MeasurementDraftPoint[]
    text?: string
    color?: string
    size?: string
  }) => void
  handleTagIndexChange: (payload: { tabKey: string; index: number }) => Promise<void>
  handleMtfClear: (payload?: { mtfId?: string | null }) => void
  handleMtfCommit: (payload: { viewportKey: string; points: MeasurementDraftPoint[]; mtfId?: string }) => Promise<void>
  handleMtfCopy: (payload?: { mtfId?: string | null }) => Promise<boolean>
  handleMtfSelect: (payload: { mtfId: string | null }) => void
  handleFourDPhaseChange: (payload: { tabKey: string; phaseIndex: number }) => void
  handleFourDFpsChange: (payload: { tabKey: string; fps: number }) => void
  handleFourDPlaybackChange: (payload: { tabKey: string; isPlaying: boolean }) => void
  handleCompareSyncChange: (payload: { tabKey: string; key: CompareSyncSettingKey; value: boolean }) => void
  handleViewportLayoutChange: (payload?: { layoutKey?: MprLayoutKey | null }) => Promise<void>
  handleLayoutSlotDicomDrop: (payload: { tabKey: string; slotId: string; drop: DicomDropInput }) => Promise<void>
  handleLayoutSlotSeriesDrop: (payload: {
    tabKey: string
    slotId: string
    seriesId: string
    folderPath?: string
    seriesInstanceUid?: string | null
  }) => Promise<void>
  handleVolumeConfigChange: (config: VolumeRenderConfig) => void
  isLoadingFolder: Ref<boolean>
  isSidebarCollapsed: Ref<boolean>
  isViewLoading: Ref<boolean>
  loadDroppedDicomFiles: (drop: DicomDropInput) => Promise<void>
  loadDicomPaths: (paths: string[]) => Promise<void>
  message: Ref<string>
  openSeriesCompare: (sourceSeriesId: string, targetSeriesId: string) => Promise<void>
  openPetCtFusion: (ctSeriesId: string, petSeriesId: string) => Promise<void>
  openKeySlice: (seriesId: string, sliceIndex: number) => Promise<void>
  openSeriesView: (seriesId: string, viewType: ViewType, options?: OpenSeriesViewOptions) => Promise<void>
  openLayoutView: (template: ViewerLayoutTemplate) => Promise<void>
  openView: (viewType: ViewType) => Promise<void>
  removeSeries: (seriesId: string) => void
  selectSeries: (seriesId: string) => void
  selectedSeriesId: Ref<string>
  seriesList: Ref<FolderSeriesItem[]>
  setActiveOperation: (value: string) => void
  setActiveViewportKey: (viewportKey: string) => void
  setViewerStage: (payload: WorkspaceReadyPayload) => void
  statusToast: Ref<WorkspaceStatusToast | null>
  dismissStatusToast: () => void
  showStatusToast: (messageText: string, tone?: WorkspaceStatusToastTone, options?: WorkspaceStatusToastOptions) => void
  toggleSidebar: () => void
  triggerViewAction: (payload: ViewerToolbarActionPayload) => void
  viewerFolderSourceMode: 'desktop-picker' | 'web-upload' | 'server-sample'
  viewerPlatform: 'desktop' | 'web'
  viewerStage: Ref<HTMLElement | null>
  viewerTabs: Ref<ViewerTabItem[]>
}

type WorkspaceStatusToastTone = 'info' | 'success' | 'warning' | 'error'

interface WorkspaceStatusToast {
  id: number
  message: string
  tone: WorkspaceStatusToastTone
  detail?: string | null
  directoryPath?: string | null
  filePath?: string | null
  canOpenLocation?: boolean
  busy?: boolean
  progressLabel?: string | null
  progressPercent?: number | null
}

interface WorkspaceStatusToastOptions {
  detail?: string | null
  directoryPath?: string | null
  filePath?: string | null
  canOpenLocation?: boolean
  busy?: boolean
  progressLabel?: string | null
  progressPercent?: number | null
  durationMs?: number
}

interface LoadFolderSeriesOptions {
  openFirstSeriesView?: boolean
  selectLoadedSeries?: boolean
}

interface OpenSeriesViewOptions {
  useHangingProtocol?: boolean
}

interface DicomUploadToastProgress {
  loaded: number
  total: number
  percent: number | null
}

export function useViewerWorkspace(): ViewerWorkspaceState {
  // These operations can be adjusted continuously from sliders/draggers. The UI
  // stays optimistic, while the backend receives only the last value in a burst.
  const VOLUME_CONFIG_DEBOUNCE_MS = 120
  const PREVIEW_PERF_IDLE_GAP_MS = 5000
  const FUSION_PET_WINDOW_DRAG_RANGE_FRACTION = 0.01
  // During MPR crosshair drag, incoming render frames may lag behind the pointer.
  // Keep the active viewport locally anchored, with the timer as a missing-end fallback.
  const MPR_CROSSHAIR_DRAG_LOCK_TTL_MS = 1800
  // After pointerup, the final PNG may arrive behind one or more stale previews.
  // Keep protecting the active viewport until the authoritative final frame lands.
  const MPR_CROSSHAIR_SETTLING_LOCK_TTL_MS = 250
  const FOUR_D_FPS_MIN = 1
  const FOUR_D_FPS_MAX = 30
  const FOUR_D_DEFAULT_FPS = 2
  const POINT_SET_CLOSE_EPSILON = 0.0005
  const backendOrigin = ref(DESKTOP_DEV_BACKEND_ORIGIN)
  const message = ref('')
  const statusToast = ref<WorkspaceStatusToast | null>(null)
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
  const viewportElements = ref<Partial<Record<string, HTMLElement | null>>>({})
  const seriesCornerInfoMap = ref<Record<string, CornerInfo>>({})
  const loadingSeriesCornerInfo = new Map<string, Promise<CornerInfo>>()
  const stageReadyRenderKeys = new Set<string>()
  const DEFAULT_VIEW_TRANSFORM: ViewTransformInfo = {
    rotationDegrees: 0,
    horFlip: false,
    verFlip: false,
    zoom: 1,
    offsetX: 0,
    offsetY: 0
  }
  const { hangingProtocolRules, mprSegmentationStylePreference, selectedPseudocolorKey } = useUiPreferences()
  const { locale, workspaceStatusCopy } = useUiLocale()
  let statusToastId = 0
  let statusToastTimer: ReturnType<typeof window.setTimeout> | null = null
  let hasStartedBackendConnection = false
  let backendConnectionPromise: Promise<void> | null = null
  let removeBackendOriginChangedListener: (() => void) | null = null
  let removeBackendStatusChangedListener: (() => void) | null = null
  const selectedSeries = computed(
    () => seriesList.value.find((item) => item.seriesId === selectedSeriesId.value) ?? null
  )
  const activeTab = computed(() => viewerTabs.value.find((item) => item.key === activeTabKey.value) ?? null)
  const hasSelectedSeries = computed(() => Boolean(selectedSeriesId.value))

  watch(
    () => [mprSegmentationStylePreference.value.thresholdColor, mprSegmentationStylePreference.value.voiColor] as const,
    ([thresholdColor, voiColor], [previousThresholdColor, previousVoiColor]) => {
      if (thresholdColor === previousThresholdColor && voiColor === previousVoiColor) {
        return
      }
      viewerTabs.value = viewerTabs.value.map((tab) => {
        const config = tab.viewType === 'MPR' ? tab.mprSegmentationConfig : null
        if (!config) {
          return tab
        }
        return {
          ...tab,
          mprSegmentationConfig: recolorMprSegmentationConfig(config, thresholdColor, voiColor)
        }
      })
    }
  )

  let resizeObserver: ResizeObserver | null = null
  let observedViewerStage: HTMLElement | null = null
  let activeMprCrosshairDragLockTimer: ReturnType<typeof window.setTimeout> | null = null
  const folderLoadRequestGuard = createLatestRequestGuard()
  const fourDPlaybackStartTokens = new Map<string, number>()
  const FOUR_D_SHARED_MPR_OPERATION_TYPES = new Set<string>()
  const activeMprCrosshairDragLock = ref<ActiveMprCrosshairDragLock | null>(null)
  let fusionPetWindowDragOriginMax: number | null = null

  function dismissStatusToast(): void {
    if (statusToastTimer != null) {
      window.clearTimeout(statusToastTimer)
      statusToastTimer = null
    }
    statusToast.value = null
  }

  function showStatusToast(messageText: string, tone: WorkspaceStatusToastTone = 'info', options: WorkspaceStatusToastOptions = {}): void {
    if (statusToastTimer != null) {
      window.clearTimeout(statusToastTimer)
    }
    statusToastId += 1
    const id = statusToastId
    statusToast.value = {
      id,
      message: messageText,
      tone,
      detail: options.detail ?? null,
      directoryPath: options.directoryPath ?? null,
      filePath: options.filePath ?? null,
      canOpenLocation: Boolean(options.canOpenLocation),
      busy: Boolean(options.busy),
      progressLabel: options.progressLabel ?? null,
      progressPercent:
        typeof options.progressPercent === 'number' && Number.isFinite(options.progressPercent)
          ? Math.max(0, Math.min(100, options.progressPercent))
          : null
    }
    const durationMs = options.durationMs ?? (options.detail || options.canOpenLocation ? 9000 : 3600)
    if (durationMs > 0) {
      statusToastTimer = window.setTimeout(() => {
        if (statusToast.value?.id === id) {
          statusToast.value = null
        }
        statusToastTimer = null
      }, durationMs)
    } else {
      statusToastTimer = null
    }
  }

  function getLayoutSlotLoadedToastMessage(): string {
    return locale.value === 'zh-CN' ? '布局视口已加载' : 'Layout slot loaded'
  }

  function resolveBackendErrorDetail(error: unknown): string {
    const responseData = (error as { response?: { data?: unknown } } | null)?.response?.data
    if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
      const detail = (responseData as { detail?: unknown }).detail
      if (typeof detail === 'string' && detail.trim()) {
        return detail.trim()
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message.trim()
    }

    return ''
  }

  function buildLoadFailureToastMessage(error: unknown): string {
    const fallbackMessage = workspaceStatusCopy.value.folderLoadFailed
    const detail = resolveBackendErrorDetail(error)
    return detail ? `${fallbackMessage} ${detail}` : fallbackMessage
  }

  function formatUploadBytes(value: number): string {
    const safeValue = Math.max(0, Number.isFinite(value) ? value : 0)
    const units = ['B', 'KB', 'MB', 'GB']
    let nextValue = safeValue
    let unitIndex = 0
    while (nextValue >= 1024 && unitIndex < units.length - 1) {
      nextValue /= 1024
      unitIndex += 1
    }
    const fractionDigits = unitIndex === 0 || nextValue >= 100 ? 0 : 1
    return `${nextValue.toFixed(fractionDigits)} ${units[unitIndex]}`
  }

  function getUploadSourceTotalBytes(source: DicomLoadSource): number {
    if (source.kind !== 'files') {
      return 0
    }
    return source.files.reduce((total, item) => total + Math.max(0, item.file.size || 0), 0)
  }

  function normalizeUploadProgress(progress: DicomUploadProgress, fallbackTotal: number): DicomUploadToastProgress {
    const loaded = Math.max(0, progress.loaded || 0)
    const total = Math.max(0, progress.total ?? fallbackTotal)
    return {
      loaded,
      total,
      percent: total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : null
    }
  }

  function showDicomUploadToast(progress: DicomUploadToastProgress): void {
    const isUploadComplete = progress.percent != null && progress.percent >= 100
    showStatusToast(
      isUploadComplete ? workspaceStatusCopy.value.uploadDicomParsing : workspaceStatusCopy.value.uploadDicomProgress,
      'info',
      {
        busy: true,
        progressPercent: progress.percent,
        progressLabel: progress.total > 0
          ? `${formatUploadBytes(progress.loaded)} / ${formatUploadBytes(progress.total)}`
          : formatUploadBytes(progress.loaded),
        durationMs: 0
      }
    )
  }

  function getActiveViewIdForTab(tab: ViewerTabItem, viewportKey = activeViewportKey.value): string {
    return resolveViewIdForTabViewport(tab, viewportKey)
  }

  function normalizeMprCrosshairMode(value: unknown): MprCrosshairMode {
    return value === 'double-oblique' ? 'double-oblique' : 'orthogonal'
  }

  function getActiveMprOperationViewId(tab: ViewerTabItem): string {
    if (isMprViewportKey(activeViewportKey.value)) {
      return tab.viewportViewIds?.[activeViewportKey.value] ?? ''
    }
    return Object.values(tab.viewportViewIds ?? {}).find((viewId): viewId is string => Boolean(viewId)) ?? ''
  }

  function getMprViewIdForPreferredViewport(
    viewIds: Partial<Record<MprViewportKey, string>> | undefined,
    preferredViewportKey: MprViewportKey
  ): string {
    const fallbackViewId = MPR_VIEWPORT_KEYS.map((viewportKey) => viewIds?.[viewportKey] ?? '').find(Boolean)
    return viewIds?.[preferredViewportKey] || fallbackViewId || ''
  }

  function getMprCrosshairModeTargetViewIds(tab: ViewerTabItem, fallbackViewId: string): string[] {
    if (tab.viewType !== '4D') {
      return fallbackViewId ? [fallbackViewId] : []
    }

    const preferredViewportKey = isMprViewportKey(activeViewportKey.value) ? activeViewportKey.value : 'mpr-ax'
    const phaseViewIds = Object.values(tab.fourDPhaseViewIds ?? {})
    const candidateViewIds = [
      fallbackViewId,
      getMprViewIdForPreferredViewport(tab.viewportViewIds, preferredViewportKey),
      ...phaseViewIds.map((viewIds) => getMprViewIdForPreferredViewport(viewIds, preferredViewportKey))
    ]

    return Array.from(new Set(candidateViewIds.filter(Boolean)))
  }

  function isFourDPlaybackLocked(tab: ViewerTabItem | null | undefined): boolean {
    return Boolean(tab?.viewType === '4D' && tab.fourDIsPlaying)
  }

  function clearActiveMprCrosshairDragLock(): void {
    if (activeMprCrosshairDragLockTimer != null) {
      window.clearTimeout(activeMprCrosshairDragLockTimer)
      activeMprCrosshairDragLockTimer = null
    }
    activeMprCrosshairDragLock.value = null
  }

  function armActiveMprCrosshairDragLockTimer(ttlMs: number): void {
    if (activeMprCrosshairDragLockTimer != null) {
      window.clearTimeout(activeMprCrosshairDragLockTimer)
    }
    activeMprCrosshairDragLockTimer = window.setTimeout(() => {
      activeMprCrosshairDragLockTimer = null
      activeMprCrosshairDragLock.value = null
    }, ttlMs)
  }

  function completeActiveMprCrosshairDragLock(update: IncomingMprViewportUpdate): void {
    const lock = activeMprCrosshairDragLock.value
    if (lock?.status !== 'settling' || !shouldPreserveLocalMprCrosshair(lock, update)) {
      return
    }
    clearActiveMprCrosshairDragLock()
  }

  function getCurrentMprCrosshairPhaseKey(tab: ViewerTabItem): string | null {
    return tab.viewType === '4D' ? String(Math.max(0, Math.trunc(tab.fourDPhaseIndex ?? 0))) : null
  }

  function getFinitePositiveNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
  }

  function getOptimisticMprCrosshairPointer(payload: MprCrosshairInteractionPayload): {
    x: number
    y: number
    canvasWidth?: number
    canvasHeight?: number
  } {
    return {
      x: typeof payload.canvasX === 'number' && Number.isFinite(payload.canvasX) ? payload.canvasX : payload.x,
      y: typeof payload.canvasY === 'number' && Number.isFinite(payload.canvasY) ? payload.canvasY : payload.y,
      canvasWidth: getFinitePositiveNumber(payload.canvasWidth) ?? undefined,
      canvasHeight: getFinitePositiveNumber(payload.canvasHeight) ?? undefined
    }
  }

  function getMprPointerAngleRad(pointer: { x: number; y: number; canvasWidth?: number; canvasHeight?: number }, centerX: number, centerY: number): number {
    const canvasWidth = getFinitePositiveNumber(pointer.canvasWidth) ?? 1
    const canvasHeight = getFinitePositiveNumber(pointer.canvasHeight) ?? 1
    return Math.atan2((pointer.y - centerY) * canvasHeight, (pointer.x - centerX) * canvasWidth)
  }

  function refreshActiveMprCrosshairDragLock(payload: MprCrosshairInteractionPayload): void {
    const tab = activeTab.value
    if (!tab || !isMprLikeViewType(tab.viewType) || !isMprViewportKey(payload.viewportKey)) {
      clearActiveMprCrosshairDragLock()
      return
    }

    const phaseKey = getCurrentMprCrosshairPhaseKey(tab)
    const mode = payload.mode === 'rotate' ? 'rotate' : 'move'
    const previousLock = activeMprCrosshairDragLock.value
    const optimisticPointer = getOptimisticMprCrosshairPointer(payload)

    if (payload.phase === DRAG_ACTION_TYPES.end) {
      const shouldSettlePrevious =
        previousLock != null &&
        previousLock.tabKey === tab.key &&
        previousLock.viewportKey === payload.viewportKey &&
        previousLock.phaseKey === phaseKey &&
        previousLock.mode === mode
      if (!shouldSettlePrevious) {
        clearActiveMprCrosshairDragLock()
        return
      }

      activeMprCrosshairDragLock.value = {
        ...previousLock,
        status: 'settling',
        line: payload.line ?? previousLock.line ?? null,
        lastPointerX: optimisticPointer.x,
        lastPointerY: optimisticPointer.y,
        canvasWidth: optimisticPointer.canvasWidth ?? previousLock.canvasWidth,
        canvasHeight: optimisticPointer.canvasHeight ?? previousLock.canvasHeight,
        endedAt: Date.now()
      }
      armActiveMprCrosshairDragLockTimer(MPR_CROSSHAIR_SETTLING_LOCK_TTL_MS)
      return
    }

    const shouldReusePreviousOffsets =
      payload.phase !== DRAG_ACTION_TYPES.start &&
      previousLock != null &&
      previousLock.tabKey === tab.key &&
      previousLock?.viewportKey === payload.viewportKey &&
      previousLock?.phaseKey === phaseKey &&
      previousLock?.mode === mode

    const nextLock: ActiveMprCrosshairDragLock = shouldReusePreviousOffsets
      ? {
          ...previousLock,
          status: 'dragging',
          lastPointerX: optimisticPointer.x,
          lastPointerY: optimisticPointer.y,
          canvasWidth: optimisticPointer.canvasWidth ?? previousLock.canvasWidth,
          canvasHeight: optimisticPointer.canvasHeight ?? previousLock.canvasHeight
        }
      : (() => {
          const geometry = getTabViewportCrosshairGeometry(tab, payload.viewportKey)
          const currentCrosshair = tab.viewportCrosshairs?.[payload.viewportKey] ?? null
          if (mode === 'move') {
            return {
              tabKey: tab.key,
              viewportKey: payload.viewportKey,
              phaseKey,
              mode,
              status: 'dragging',
              lastPointerX: optimisticPointer.x,
              lastPointerY: optimisticPointer.y,
              canvasWidth: optimisticPointer.canvasWidth,
              canvasHeight: optimisticPointer.canvasHeight,
              pointerOffsetX: (geometry?.center.x ?? optimisticPointer.x) - optimisticPointer.x,
              pointerOffsetY: (geometry?.center.y ?? optimisticPointer.y) - optimisticPointer.y
            }
          }

          const centerX = geometry?.center.x ?? optimisticPointer.x
          const centerY = geometry?.center.y ?? optimisticPointer.y
          return {
            tabKey: tab.key,
            viewportKey: payload.viewportKey,
            phaseKey,
            mode,
            status: 'dragging',
            line: payload.line ?? null,
            centerX,
            centerY,
            lastPointerX: optimisticPointer.x,
            lastPointerY: optimisticPointer.y,
            canvasWidth: optimisticPointer.canvasWidth,
            canvasHeight: optimisticPointer.canvasHeight,
            startPointerAngleRad: getMprPointerAngleRad(optimisticPointer, centerX, centerY),
            startHorizontalAngleRad: geometry?.horizontalAngleRad ?? 0,
            startVerticalAngleRad: geometry?.verticalAngleRad ?? Math.PI / 2,
            startHorizontalSlabOffsetX: currentCrosshair?.horizontalSlabOffsetX ?? null,
            startHorizontalSlabOffsetY: currentCrosshair?.horizontalSlabOffsetY ?? null,
            startVerticalSlabOffsetX: currentCrosshair?.verticalSlabOffsetX ?? null,
            startVerticalSlabOffsetY: currentCrosshair?.verticalSlabOffsetY ?? null,
            isDoubleOblique: tab.mprCrosshairMode === 'double-oblique'
          }
        })()
    activeMprCrosshairDragLock.value = nextLock
    armActiveMprCrosshairDragLockTimer(MPR_CROSSHAIR_DRAG_LOCK_TTL_MS)
  }

  function findFourDTab(tabKey: string): ViewerTabItem | null {
    const tab = viewerTabs.value.find((item) => item.key === tabKey)
    return tab?.viewType === '4D' ? tab : null
  }

  function getFourDPhaseCount(tab: ViewerTabItem): number {
    const phaseItemsCount = tab.fourDPhaseItems?.length ?? 0
    const phaseCount = phaseItemsCount || tab.fourDPhaseCount || 1
    return Math.max(1, Math.trunc(Number(phaseCount) || 1))
  }

  function clampFourDFps(value: number | null | undefined, fallback = FOUR_D_DEFAULT_FPS): number {
    const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback
    return Math.max(FOUR_D_FPS_MIN, Math.min(FOUR_D_FPS_MAX, Math.trunc(numericValue)))
  }

  function generateMtfId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `mtf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  function clampNormalizedPoint(point: MeasurementDraftPoint): MeasurementDraftPoint {
    return {
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y))
    }
  }

  function offsetMtfPoints(points: MeasurementDraftPoint[], delta: number): MeasurementDraftPoint[] {
    const shiftedPoints = points.map((point) =>
      clampNormalizedPoint({
        x: point.x + delta,
        y: point.y + delta
      })
    )

    const changed = shiftedPoints.some((point, index) => point.x !== points[index]?.x || point.y !== points[index]?.y)
    if (changed) {
      return shiftedPoints
    }

    return points.map((point) =>
      clampNormalizedPoint({
        x: point.x - delta,
        y: point.y - delta
      })
    )
  }

  function arePointSetsClose(a: MeasurementDraftPoint[], b: MeasurementDraftPoint[]): boolean {
    if (a.length !== b.length) {
      return false
    }

    return a.every((point, index) => {
      const otherPoint = b[index]
      return (
        otherPoint != null &&
        Math.abs(point.x - otherPoint.x) < POINT_SET_CLOSE_EPSILON &&
        Math.abs(point.y - otherPoint.y) < POINT_SET_CLOSE_EPSILON
      )
    })
  }

  function updateHoverCornerInfoByViewId(viewId: string, row: number | null = null, col: number | null = null): void {
    viewerTabs.value = viewerTabs.value.map((item) => {
      if (item.viewId === viewId && (item.viewType === 'Stack' || item.viewType === 'PET')) {
        return {
          ...item,
          cornerInfo: withHoverCornerInfo(item.cornerInfo, row, col)
        }
      }

      const compareViewportKey = Object.entries(item.compareViewIds ?? {}).find(([, candidateViewId]) => candidateViewId === viewId)?.[0]
      if (item.viewType === 'CompareStack' && compareViewportKey && isCompareStackPaneKey(compareViewportKey)) {
        return {
          ...item,
          compareCornerInfos: {
            ...(item.compareCornerInfos ?? {}),
            [compareViewportKey]: withHoverCornerInfo(item.compareCornerInfos?.[compareViewportKey] ?? item.cornerInfo, row, col)
          }
        }
      }

      if (item.viewType === 'Layout' && (item.layoutSlots ?? []).some((slot) => slot.viewId === viewId)) {
        return {
          ...item,
          layoutSlots: (item.layoutSlots ?? []).map((slot) =>
            slot.viewId === viewId
              ? {
                  ...slot,
                  cornerInfo: withHoverCornerInfo(slot.cornerInfo ?? item.cornerInfo, row, col)
                }
              : slot
          )
        }
      }

      const fusionViewportKey = Object.entries(item.fusionViewIds ?? {}).find(([, candidateViewId]) => candidateViewId === viewId)?.[0]
      if (item.viewType === 'PETCTFusion' && fusionViewportKey && isFusionPaneKey(fusionViewportKey)) {
        return {
          ...item,
          fusionCornerInfos: {
            ...(item.fusionCornerInfos ?? {}),
            [fusionViewportKey]: withHoverCornerInfo(item.fusionCornerInfos?.[fusionViewportKey] ?? item.cornerInfo, row, col)
          }
        }
      }

      const viewportKey = Object.entries(item.viewportViewIds ?? {}).find(([, candidateViewId]) => candidateViewId === viewId)?.[0] as
        | MprViewportKey
        | undefined
      if (!viewportKey || !isMprLikeViewType(item.viewType)) {
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

  function normalizeQuarterTurnRotation(rotationDegrees: number): number {
    const normalized = ((Math.round(rotationDegrees / 90) * 90) % 360 + 360) % 360
    return normalized
  }

  function getCurrentViewportTransform(tab: ViewerTabItem, viewportKey: string): ViewTransformInfo {
    if (isMprLikeViewType(tab.viewType)) {
      return tab.viewportTransformStates?.[viewportKey as MprViewportKey] ?? DEFAULT_VIEW_TRANSFORM
    }
    if (tab.viewType === 'CompareStack') {
      return tab.compareTransformStates?.[resolveComparePaneKey(viewportKey)] ?? DEFAULT_VIEW_TRANSFORM
    }
    if (tab.viewType === 'PETCTFusion') {
      return tab.fusionTransformStates?.[resolveFusionPaneKey(viewportKey)] ?? DEFAULT_VIEW_TRANSFORM
    }
    if (tab.viewType === 'Layout') {
      return tab.layoutSlots?.find((slot) => slot.id === viewportKey)?.transformState ?? DEFAULT_VIEW_TRANSFORM
    }
    return tab.transformState ?? DEFAULT_VIEW_TRANSFORM
  }

  function createMprMipOperationConfig(config: MprMipConfig): MprMipOperationConfig {
    if (!config.enabled) {
      return { enabled: false }
    }

    return config
  }

  function emitMprMipConfig(viewId: string, config: MprMipConfig, actionType: 'move' | 'end' = 'end'): void {
    const mprMipConfig = createMprMipOperationConfig(config)
    viewInteractionOperationScheduler.emit(viewId, {
      viewId,
      opType: VIEW_OPERATION_TYPES.mprMipConfig,
      actionType,
      mprMipConfig
    })
  }

  function emitMprSegmentationConfig(viewId: string, config: MprSegmentationConfig, actionType: 'move' | 'end' = 'end'): void {
    viewInteractionOperationScheduler.emit(viewId, {
      viewId,
      opType: VIEW_OPERATION_TYPES.mprSegmentation,
      actionType,
      mprSegmentationConfig: normalizeMprSegmentationConfig(config)
    })
  }

  function emitMprCrosshairMode(viewId: string, mode: MprCrosshairMode): void {
    emitViewOperation({
      viewId,
      opType: VIEW_OPERATION_TYPES.mprCrosshairMode,
      mprCrosshairMode: mode
    })
  }

  function hasVolumeView(tab: ViewerTabItem): boolean {
    return tab.viewType === '3D' || (tab.viewType === 'MPR' && Boolean(tab.viewId))
  }

  function isMprVolumeViewport(tab: ViewerTabItem, viewportKey: string): boolean {
    return tab.viewType === 'MPR' && viewportKey === 'volume' && Boolean(tab.viewId)
  }

  function triggerViewAction(payload: ViewerToolbarActionPayload): void {
    const tab = activeTab.value
    if (!tab) {
      return
    }

    if (isFourDPlaybackLocked(tab)) {
      return
    }

    if ((payload.action === 'reset' || payload.action === 'resetAll') && !isStackLikeViewType(tab.viewType) && tab.viewType !== '3D' && !isMprLikeViewType(tab.viewType)) {
      return
    }

    if ((payload.action === 'volumePreset' || payload.action === 'render3dMode') && !hasVolumeView(tab)) {
      return
    }

    if (payload.action === 'rotate' && !isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType)) {
      return
    }

    if (payload.action === 'pseudocolor' && !isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType)) {
      return
    }

    if (payload.action === 'windowPreset' && !isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType)) {
      return
    }

    if (payload.action === 'mprMipConfig' && !isMprLikeViewType(tab.viewType)) {
      return
    }

    if (payload.action === 'mprSegmentation' && tab.viewType !== 'MPR') {
      return
    }

    if (payload.action === 'mprCrosshairMode' && !isMprLikeViewType(tab.viewType)) {
      return
    }

    if (payload.action === 'displayOverlay' && tab.viewType !== 'Stack' && tab.viewType !== 'PET' && tab.viewType !== 'PETCTFusion' && !isMprLikeViewType(tab.viewType)) {
      return
    }

    if ((payload.action === 'clearMeasurements' || payload.action === 'clearMtf' || payload.action === 'clearAnnotations') && !isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType) && tab.viewType !== '3D') {
      return
    }

    if (payload.action === 'displayOverlay') {
      const overlay = payload.overlay
      if (overlay !== 'cornerInfo' && overlay !== 'scaleBar') {
        return
      }

      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              ...(overlay === 'cornerInfo'
                ? { showCornerInfo: payload.enabled ?? item.showCornerInfo === false }
                : { showScaleBar: payload.enabled ?? item.showScaleBar === false })
            }
          : item
      )
      return
    }

    if (payload.action === 'fusionManualRegistration') {
      if (tab.viewType !== 'PETCTFusion') {
        return
      }
      handleFusionConfigChange({ manualRegistration: payload.enabled ?? !(tab.fusionManualRegistration === true) })
      return
    }

    if (payload.action === 'fusionRegistrationLoad') {
      if (tab.viewType !== 'PETCTFusion' || !payload.registrationFile) {
        return
      }
      void handleFusionRegistrationLoad(payload.registrationFile)
      return
    }

    if (payload.action === 'fusionRegistrationReset' || payload.action === 'fusionRegistrationSave') {
      if (tab.viewType !== 'PETCTFusion') {
        return
      }
      handleFusionConfigChange({ action: payload.action === 'fusionRegistrationReset' ? 'reset' : 'save' })
      return
    }

    if (payload.action === 'fusionPseudocolor' && payload.value) {
      if (tab.viewType !== 'PETCTFusion') {
        return
      }
      handleFusionConfigChange({ pseudocolorPreset: payload.value.replace(/^fusionPseudocolor:/, '') })
      return
    }

    if (payload.action === 'fusionPetUnit' && payload.value) {
      if (tab.viewType !== 'PETCTFusion') {
        return
      }
      handleFusionConfigChange({ petUnit: payload.value.replace(/^fusionPetUnit:/, '') })
      return
    }

    if (payload.action === 'fusionPetWindow' && payload.value) {
      if (tab.viewType !== 'PETCTFusion') {
        return
      }
      const [, maxValue] = payload.value.replace(/^fusionPetWindow:/, '').split(':')
      const petWindowMax = Number(maxValue)
      if (Number.isFinite(petWindowMax)) {
        handleFusionConfigChange({ petWindowMin: 0, petWindowMax })
      }
      return
    }

    if (payload.action === 'petUnit' && payload.value) {
      if (tab.viewType !== 'PET') {
        return
      }
      handlePetConfigChange({ petUnit: payload.value.replace(/^petUnit:/, '') })
      return
    }

    if (payload.action === 'petWindow' && payload.value) {
      if (tab.viewType !== 'PET') {
        return
      }
      const [, maxValue] = payload.value.replace(/^petWindow:/, '').split(':')
      const petWindowMax = Number(maxValue)
      if (Number.isFinite(petWindowMax)) {
        handlePetConfigChange({ petWindowMin: 0, petWindowMax })
      }
      return
    }

    if (!hasOperableView(tab) && !isMprLikeViewType(tab.viewType)) {
      return
    }

    if (tab.viewId) {
      clearPendingVolumeConfig(tab.viewId)
    }

    if (payload.action === 'reset' || payload.action === 'resetAll') {
      clearActiveMprCrosshairDragLock()
      viewInteractionOperationScheduler.cancel()
    }

    if (payload.action === 'clearMtf' || payload.action === 'resetAll') {
      clearActiveTabMtf()
      if (payload.action === 'clearMtf') {
        const viewId = getActiveViewIdForTab(tab)
        if (!viewId) {
          return
        }
        emitViewOperation({
          viewId,
          opType: VIEW_OPERATION_TYPES.reset,
          subOpType: 'mtf'
        })
        return
      }
    }

    if (payload.action === 'clearAnnotations') {
      const viewId = getActiveViewIdForTab(tab)
      if (!viewId) {
        return
      }
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.reset,
        subOpType: 'annotations'
      })
      return
    }

    if (payload.action === 'clearMeasurements') {
      const viewId = getActiveViewIdForTab(tab)
      if (!viewId) {
        return
      }

      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.reset,
        subOpType: 'measurements'
      })
      return
    }

    if (payload.action === 'mprCrosshairMode') {
      const mode = normalizeMprCrosshairMode(payload.mode ?? payload.value)
      const viewId = getActiveMprOperationViewId(tab)
      const targetViewIds = getMprCrosshairModeTargetViewIds(tab, viewId)
      if (!targetViewIds.length) {
        return
      }

      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              mprCrosshairMode: mode
            }
          : item
      )
      targetViewIds.forEach((targetViewId) => {
        emitMprCrosshairMode(targetViewId, mode)
      })
      if (tab.viewType === '4D') {
        views.invalidateFourDMprState(tab.key)
      }
      return
    }

    if (payload.action === 'mprMipConfig' && payload.config) {
      const viewId = getActiveMprOperationViewId(tab)
      if (!viewId) {
        return
      }
      const previousConfig = tab.mprMipConfig ?? createDefaultMprMipConfig()
      const shouldEmitDisabled = previousConfig.enabled && !payload.config.enabled
      const actionType = payload.actionType === DRAG_ACTION_TYPES.move ? DRAG_ACTION_TYPES.move : DRAG_ACTION_TYPES.end

      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              mprMipConfig: payload.config
            }
          : item
      )

      if (!payload.config.enabled) {
        if (shouldEmitDisabled) {
          viewInteractionOperationScheduler.cancel()
          emitMprMipConfig(viewId, payload.config, DRAG_ACTION_TYPES.end)
        }
        return
      }

      emitMprMipConfig(viewId, payload.config, actionType)
      return
    }

    if (payload.action === 'mprSegmentation' && payload.segmentationConfig) {
      const viewId = getActiveMprOperationViewId(tab)
      if (!viewId) {
        return
      }
      const previousConfig = tab.mprSegmentationConfig ?? createDefaultMprSegmentationConfig()
      const normalizedConfig = normalizeMprSegmentationConfig(payload.segmentationConfig, previousConfig)
      if (payload.actionType === 'local' || payload.actionType === 'select' || payload.actionType === 'style') {
        viewerTabs.value = viewerTabs.value.map((item) =>
          item.key === tab.key
            ? {
                ...item,
                mprSegmentationConfig: normalizedConfig
              }
            : item
        )
        return
      }
      const nextConfig = normalizeMprSegmentationConfig({
        ...normalizedConfig,
        clientRevision: Math.max(previousConfig.clientRevision ?? 0, normalizedConfig.clientRevision ?? 0) + 1
      }, normalizedConfig)
      const shouldEmitDisabled = previousConfig.enabled && !nextConfig.enabled
      const actionType = payload.actionType === DRAG_ACTION_TYPES.move ? DRAG_ACTION_TYPES.move : DRAG_ACTION_TYPES.end
      const shouldShowSegmentationProgress =
        nextConfig.enabled && nextConfig.thresholdRegions.some((region) => region.enabled)

      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              viewportLoadingProgress: MPR_VIEWPORT_KEYS.reduce<Partial<Record<MprViewportKey, ViewProgressInfo | null>>>(
                (progress, viewportKey) => {
                  progress[viewportKey] = shouldShowSegmentationProgress
                    ? {
                        viewId,
                        phase: 'render',
                        progressPercent: null,
                        message: null
                      }
                    : null
                  return progress
                },
                {
                  ...(item.viewportLoadingProgress ?? {})
                }
              ),
              mprSegmentationConfig: nextConfig
            }
          : item
      )

      if (!nextConfig.enabled) {
        if (shouldEmitDisabled) {
          viewInteractionOperationScheduler.cancel()
          emitMprSegmentationConfig(viewId, nextConfig, DRAG_ACTION_TYPES.end)
        }
        return
      }

      emitMprSegmentationConfig(viewId, nextConfig, actionType)
      return
    }

    if ((payload.action === 'reset' || payload.action === 'resetAll') && (tab.viewType === '3D' || isMprVolumeViewport(tab, activeViewportKey.value))) {
      const defaultConfig = createDefaultVolumeRenderConfig('bone')
      const defaultSurfaceConfig = createDefaultSurfaceRenderConfig()
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              pseudocolorPreset: DEFAULT_PSEUDOCOLOR_PRESET,
              volumePreset: 'volumePreset:bone',
              volumeRenderConfig: defaultConfig,
              render3dMode: 'volume',
              surfaceRenderConfig: defaultSurfaceConfig
            }
          : item
      )

      if (payload.action === 'resetAll') {
        emitViewOperation({
          viewId: tab.viewId,
          opType: VIEW_OPERATION_TYPES.reset,
          subOpType: 'all'
        })
        return
      }
      emitViewOperation({
        viewId: tab.viewId,
        opType: VIEW_OPERATION_TYPES.reset,
        subOpType: 'view'
      })
      emitViewOperation({
        viewId: tab.viewId,
        opType: VIEW_OPERATION_TYPES.volumeConfig,
        volumeConfig: defaultConfig
      })
      return
    }

    if (payload.action === 'render3dMode' && payload.value) {
      const render3dMode = normalizeRender3DMode(payload.value.replace(/^render3dMode:/, ''))
      const surfaceConfig = normalizeSurfaceRenderConfig(tab.surfaceRenderConfig ?? createDefaultSurfaceRenderConfig())
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              render3dMode,
              surfaceRenderConfig: surfaceConfig
            }
          : item
      )

      emitViewOperation({
        viewId: tab.viewId,
        opType: VIEW_OPERATION_TYPES.render3dMode,
        render3dMode
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

    if (payload.action === 'rotate' && payload.value) {
      const currentTransform = getCurrentViewportTransform(tab, activeViewportKey.value)
      let nextTransform: ViewTransformInfo = currentTransform

      if (payload.value === 'rotate:cw90') {
        nextTransform = {
          ...currentTransform,
          rotationDegrees: normalizeQuarterTurnRotation(currentTransform.rotationDegrees + 90)
        }
      } else if (payload.value === 'rotate:ccw90') {
        nextTransform = {
          ...currentTransform,
          rotationDegrees: normalizeQuarterTurnRotation(currentTransform.rotationDegrees - 90)
        }
      } else if (payload.value === 'rotate:mirror-h') {
        nextTransform = {
          ...currentTransform,
          horFlip: !currentTransform.horFlip
        }
      } else if (payload.value === 'rotate:mirror-v') {
        nextTransform = {
          ...currentTransform,
          verFlip: !currentTransform.verFlip
        }
      } else {
        return
      }

      const targets = resolveOperationTargets(tab, activeViewportKey.value, VIEW_OPERATION_TYPES.transform2d)
      if (!targets.length) {
        return
      }

      viewerTabs.value = viewerTabs.value.map((item) => {
        if (item.key !== tab.key) {
          return item
        }
        return applyTransformToTabTargets(item, targets, nextTransform)
      })

      targets.forEach((target) => {
        emitViewOperation({
          viewId: target.viewId,
          opType: VIEW_OPERATION_TYPES.transform2d,
          rotationDegrees: nextTransform.rotationDegrees,
          hor_flip: nextTransform.horFlip,
          ver_flip: nextTransform.verFlip
        })
      })
      return
    }

    if (payload.action === 'pseudocolor' && payload.value) {
      const presetKey = normalizePseudocolorPresetKey(payload.value)
      const targets = resolveOperationTargets(tab, activeViewportKey.value, VIEW_OPERATION_TYPES.pseudocolor)
      if (!targets.length) {
        return
      }

      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key ? applyPseudocolorToTabTargets(item, targets, presetKey) : item
      )

      targets.forEach((target) => {
        emitViewOperation({
          viewId: target.viewId,
          opType: VIEW_OPERATION_TYPES.pseudocolor,
          pseudocolorPreset: presetKey
        })
      })
      return
    }

    if (payload.action === 'windowPreset' && payload.value) {
      const [wwRaw, wlRaw] = payload.value.split('|')
      const ww = Number.parseFloat(wwRaw)
      const wl = Number.parseFloat(wlRaw)
      const viewId = getActiveViewIdForTab(tab)
      if (!viewId || !Number.isFinite(ww) || !Number.isFinite(wl)) {
        return
      }

      resolveOperationTargets(tab, activeViewportKey.value, VIEW_OPERATION_TYPES.window).forEach((target) => {
        emitViewOperation({
          viewId: target.viewId,
          opType: VIEW_OPERATION_TYPES.window,
          ww,
          wl
        })
      })
      return
    }

    if (payload.action === 'reset' || payload.action === 'resetAll') {
      if (isMprLikeViewType(tab.viewType)) {
        const viewportKey = activeViewportKey.value as MprViewportKey
        const viewId = tab.viewportViewIds?.[viewportKey] ?? ''
        if (!viewId) {
          return
        }
        viewInteractionOperationScheduler.cancel()

        viewerTabs.value = viewerTabs.value.map((item) => {
          if (item.key !== tab.key) {
            return item
          }

          return {
            ...item,
            mprCursor: null,
            mprFrame: null,
            mprMipConfig: createDefaultMprMipConfig(),
            mprSegmentationConfig: createDefaultMprSegmentationConfig(),
            mprCrosshairMode: 'orthogonal',
            viewportCrosshairs: createEmptyMprCrosshairs(),
            viewportScaleBars: createEmptyMprScaleBars(),
            viewportOrientations: createEmptyMprOrientations(),
            viewportTransformStates: {
              'mpr-ax': DEFAULT_VIEW_TRANSFORM,
              'mpr-cor': DEFAULT_VIEW_TRANSFORM,
              'mpr-sag': DEFAULT_VIEW_TRANSFORM
            },
            viewportPseudocolorPresets: {
              'mpr-ax': DEFAULT_PSEUDOCOLOR_PRESET,
              'mpr-cor': DEFAULT_PSEUDOCOLOR_PRESET,
              'mpr-sag': DEFAULT_PSEUDOCOLOR_PRESET
            }
          }
        })
        if (tab.viewType === '4D') {
          views.invalidateFourDMprState(tab.key)
        }

        emitViewOperation({
          viewId,
          opType: VIEW_OPERATION_TYPES.reset,
          subOpType: payload.action === 'resetAll' ? 'all' : 'view'
        })
        return
      }

      const targets = resolveOperationTargets(tab, activeViewportKey.value, VIEW_OPERATION_TYPES.reset)
      if (!targets.length) {
        return
      }

      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key ? resetTabViewStateTargets(item, targets, DEFAULT_VIEW_TRANSFORM) : item
      )

      targets.forEach((target) => {
        emitViewOperation({
          viewId: target.viewId,
          opType: VIEW_OPERATION_TYPES.reset,
          subOpType: payload.action === 'resetAll' ? 'all' : 'view'
        })
      })
      return
    }

    if (isMprLikeViewType(tab.viewType)) {
      const viewportKey = activeViewportKey.value as MprViewportKey
      const viewId = tab.viewportViewIds?.[viewportKey] ?? ''
      if (!viewId) {
        return
      }
      viewInteractionOperationScheduler.cancel()

      viewerTabs.value = viewerTabs.value.map((item) => {
        if (item.key !== tab.key) {
          return item
        }

        return {
          ...item,
          mprCursor: null,
          mprFrame: null,
          mprMipConfig: createDefaultMprMipConfig(),
          mprSegmentationConfig: createDefaultMprSegmentationConfig(),
          viewportCrosshairs: createEmptyMprCrosshairs(),
          viewportScaleBars: createEmptyMprScaleBars(),
          viewportOrientations: createEmptyMprOrientations(),
          viewportTransformStates: {
            'mpr-ax': DEFAULT_VIEW_TRANSFORM,
            'mpr-cor': DEFAULT_VIEW_TRANSFORM,
            'mpr-sag': DEFAULT_VIEW_TRANSFORM
          },
          viewportPseudocolorPresets: {
            'mpr-ax': DEFAULT_PSEUDOCOLOR_PRESET,
            'mpr-cor': DEFAULT_PSEUDOCOLOR_PRESET,
            'mpr-sag': DEFAULT_PSEUDOCOLOR_PRESET
          }
        }
      })

      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.reset
      })
      return
    }
  }

  function handleVolumeConfigChange(config: VolumeRenderConfig): void {
    const tab = activeTab.value
    if (!tab || !hasVolumeView(tab) || !tab.viewId) {
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

  function handleCompareSyncChange(payload: { tabKey: string; key: CompareSyncSettingKey; value: boolean }): void {
    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === payload.tabKey ? withViewSyncValue(item, payload.key, payload.value) : item
    )
  }

  async function handleViewportLayoutChange(payload: { layoutKey?: MprLayoutKey | null } = {}): Promise<void> {
    const tab = activeTab.value
    if (!tab || isViewLoading.value) {
      return
    }

    await ensureBackendConnection()
    if (tab.viewType === 'MPR' && payload.layoutKey === 'mpr-3d') {
      await views.ensureMprVolumeView(tab.key)
    }
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    await views.renderTab(tab.key, true)
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
    if (!tab || !isMprLikeViewType(tab.viewType) || !isMprViewportKey(viewportKey) || isFourDPlaybackLocked(tab)) {
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

  function getFourDSharedMprViewIds(tab: ViewerTabItem, viewportKey: MprViewportKey, fallbackViewId: string): string[] {
    const viewIds = [
      fallbackViewId,
      ...Object.values(tab.fourDPhaseViewIds ?? {}).map((phaseViewIds) => phaseViewIds?.[viewportKey] ?? '')
    ]
    return Array.from(new Set(viewIds.filter(Boolean)))
  }

  function emitScheduledViewOperation(payload: ViewOperationPayload): void {
    viewInteractionOperationScheduler.emit(payload.viewId, payload)
  }

  function emitMprViewOperation(
    viewportKey: string,
    payload: ViewOperationInput
  ): void {
    const context = getMprOperationContext(viewportKey)
    if (!context) {
      return
    }

    const viewIds =
      context.tab.viewType === '4D' && FOUR_D_SHARED_MPR_OPERATION_TYPES.has(payload.opType)
        ? getFourDSharedMprViewIds(context.tab, context.viewportKey, context.viewId)
        : [context.viewId]

    viewIds.forEach((viewId) => {
      emitScheduledViewOperation({
        ...payload,
        viewId
      })
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
    if (!tab || isFourDPlaybackLocked(tab) || (!isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType)) || !payload.points.length) {
      return
    }

    const operationPayload: ViewOperationInput = {
      opType: VIEW_OPERATION_TYPES.measurement,
      measurementId: payload.measurementId,
      subOpType: payload.toolType,
      actionType: payload.phase,
      viewportKey: payload.viewportKey,
      points: payload.points
    }

    if (isMprLikeViewType(tab.viewType)) {
      emitMprViewOperation(payload.viewportKey, operationPayload)
      return
    }

    const viewId = getActiveViewIdForTab(tab, payload.viewportKey)
    if (!viewId) {
      return
    }

    emitViewOperation({
      viewId,
      ...operationPayload
    })
  }

  function emitAnnotationOperation(payload: {
    viewportKey: string
    annotationId?: string
    actionType: 'end' | 'delete'
    toolType?: string
    points?: MeasurementDraftPoint[]
    text?: string
    color?: string
    size?: string
  }): void {
    const tab = activeTab.value
    if (!tab || isFourDPlaybackLocked(tab) || (!isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType))) {
      return
    }

    if (payload.actionType !== 'delete' && !payload.points?.length) {
      return
    }

    const operationPayload: ViewOperationInput = {
      opType: VIEW_OPERATION_TYPES.annotation,
      annotationId: payload.annotationId,
      subOpType: payload.toolType ?? 'arrow',
      toolType: payload.toolType ?? 'arrow',
      actionType: payload.actionType,
      viewportKey: payload.viewportKey,
      points: payload.points,
      text: payload.text,
      color: payload.color,
      size: payload.size
    }

    if (isMprLikeViewType(tab.viewType)) {
      emitMprViewOperation(payload.viewportKey, operationPayload)
      return
    }

    const viewId = getActiveViewIdForTab(tab, payload.viewportKey)
    if (!viewId) {
      return
    }

    emitViewOperation({
      viewId,
      ...operationPayload
    })
  }

  function resolveViewIdForViewport(viewportKey: string): string | null {
    const tab = activeTab.value
    if (!tab) {
      return null
    }

    if (isMprLikeViewType(tab.viewType)) {
      if (!isMprViewportKey(viewportKey)) {
        return null
      }
      return tab.viewportViewIds?.[viewportKey] ?? null
    }

    if (tab.viewType === 'CompareStack') {
      return tab.compareViewIds?.[resolveComparePaneKey(viewportKey)] ?? null
    }

    if (tab.viewType === 'Layout') {
      return resolveViewIdForTabViewport(tab, viewportKey) || null
    }

    if (tab.viewType !== 'Stack') {
      return null
    }

    return tab.viewId || null
  }

  function updateActiveTabMtfState(updater: (current: ViewerTabItem) => ViewerTabItem): void {
    const tab = activeTab.value
    if (!tab) {
      return
    }

    viewerTabs.value = viewerTabs.value.map((item) => (item.key === tab.key ? updater(item) : item))
  }

  function findMtfItem(item: ViewerTabItem, mtfId?: string | null): ViewerMtfItem | null {
    if (!mtfId) {
      return null
    }

    return item.mtfState?.items.find((candidate) => candidate.mtfId === mtfId) ?? null
  }

  function updateMtfItemCollection(
    item: ViewerTabItem,
    nextMtfItem: ViewerMtfItem,
    options: {
      remove?: boolean
      selectMtfId?: string | null
    } = {}
  ): ViewerTabItem {
    const previousItems = item.mtfState?.items ?? []
    const nextItems = options.remove
      ? previousItems.filter((candidate) => candidate.mtfId !== nextMtfItem.mtfId)
      : (() => {
          const index = previousItems.findIndex((candidate) => candidate.mtfId === nextMtfItem.mtfId)
          if (index === -1) {
            return [...previousItems, nextMtfItem]
          }

          return previousItems.map((candidate, currentIndex) => (currentIndex === index ? nextMtfItem : candidate))
        })()

    if (!nextItems.length) {
      return {
        ...item,
        mtfState: null
      }
    }

    const fallbackSelectedId =
      item.mtfState?.selectedMtfId && nextItems.some((candidate) => candidate.mtfId === item.mtfState?.selectedMtfId)
        ? item.mtfState.selectedMtfId
        : nextItems[nextItems.length - 1]?.mtfId ?? null
    const selectedMtfId =
      options.selectMtfId === undefined
        ? fallbackSelectedId
        : options.selectMtfId && nextItems.some((candidate) => candidate.mtfId === options.selectMtfId)
          ? options.selectMtfId
          : fallbackSelectedId

    return {
      ...item,
      mtfState: {
        items: nextItems,
        selectedMtfId
      }
    }
  }

  async function handleMtfCommit(payload: {
    viewportKey: string
    points: MeasurementDraftPoint[]
    mtfId?: string
  }): Promise<void> {
    const tab = activeTab.value
    if (!tab || isFourDPlaybackLocked(tab) || (!isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType))) {
      return
    }

    const viewId = resolveViewIdForViewport(payload.viewportKey)
    if (!viewId) {
      return
    }

    await ensureBackendConnection()
    const mtfId = payload.mtfId ?? generateMtfId()
    const nextSelectedMtfId = payload.mtfId ? mtfId : null
    updateActiveTabMtfState((item) =>
      updateMtfItemCollection(
        item,
        {
          mtfId,
          viewportKey: payload.viewportKey,
          points: payload.points,
          status: 'calculating',
          metrics: null,
          curve: [],
          errorMessage: null
        },
        {
          selectMtfId: nextSelectedMtfId
        }
      )
    )

    try {
      const data = await postApi('AnalyzeMtfApiV1ViewMtfAnalyzePost', {
        viewId,
        viewportKey: payload.viewportKey,
        points: payload.points
      })

      updateActiveTabMtfState((item) =>
        updateMtfItemCollection(
          item,
          {
            mtfId,
            viewportKey: data.viewportKey,
            points: data.points,
            status: 'ready',
            metrics: data.metrics as MtfMetrics,
            curve: data.curve as MtfCurvePoint[],
            errorMessage: null,
            isPlaceholder: data.isPlaceholder ?? false
          },
          {
            selectMtfId: nextSelectedMtfId
          }
        )
      )
    } catch (error) {
      const fallbackMessage =
        typeof error === 'object' && error != null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'MTF 分析失败'

      updateActiveTabMtfState((item) =>
        updateMtfItemCollection(
          item,
          {
            mtfId,
            viewportKey: payload.viewportKey,
            points: payload.points,
            status: 'error',
            metrics: null,
            curve: [],
            errorMessage: fallbackMessage
          },
          {
            selectMtfId: nextSelectedMtfId
          }
        )
      )
    }
  }

  function handleMtfSelect(payload: { mtfId: string | null }): void {
    updateActiveTabMtfState((item) => {
      const mtfItems = item.mtfState?.items ?? []
      if (!mtfItems.length) {
        return item
      }

      const selectedMtfId =
        payload.mtfId === null
          ? null
          : payload.mtfId && mtfItems.some((candidate) => candidate.mtfId === payload.mtfId)
            ? payload.mtfId
            : mtfItems[mtfItems.length - 1]?.mtfId ?? null

      return {
        ...item,
        mtfState: {
          items: mtfItems,
          selectedMtfId
        }
      }
    })
  }

  function handleFourDPhaseChange(payload: { tabKey: string; phaseIndex: number }): void {
    const tab = findFourDTab(payload.tabKey)
    if (!tab || tab.fourDIsPlaying) {
      return
    }
    const phaseIndex = Number.isFinite(payload.phaseIndex) ? Math.max(0, Math.trunc(payload.phaseIndex)) : 0
    void views.setFourDPhase(payload.tabKey, phaseIndex)
  }

  function handleFourDFpsChange(payload: { tabKey: string; fps: number }): void {
    const fps = clampFourDFps(payload.fps)
    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === payload.tabKey && item.viewType === '4D'
        ? {
            ...item,
            fourDPlaybackFps: fps
          }
        : item
    )

    const tab = findFourDTab(payload.tabKey)
    if (tab?.fourDIsPlaying) {
      emitFourDPlaybackFps({
        tabKey: payload.tabKey,
        fps
      })
    }
  }

  function nextFourDPlaybackStartToken(tabKey: string): number {
    const token = (fourDPlaybackStartTokens.get(tabKey) ?? 0) + 1
    fourDPlaybackStartTokens.set(tabKey, token)
    return token
  }

  async function startFourDPlaybackAfterPreload(tabKey: string): Promise<void> {
    const token = nextFourDPlaybackStartToken(tabKey)
    try {
      await views.preloadFourDPhases(tabKey)
    } catch (error) {
      console.error(error)
      return
    }
    if (fourDPlaybackStartTokens.get(tabKey) !== token) {
      return
    }

    const refreshedTab = findFourDTab(tabKey)
    if (!refreshedTab || refreshedTab.fourDIsPlaying) {
      return
    }

    emitFourDPlaybackStart({
      tabKey,
      phaseIndex: Math.max(0, Math.trunc(refreshedTab.fourDPhaseIndex ?? 0)),
      phaseCount: getFourDPhaseCount(refreshedTab),
      fps: clampFourDFps(refreshedTab.fourDPlaybackFps)
    })
  }

  function handleFourDPlaybackChange(payload: { tabKey: string; isPlaying: boolean }): void {
    const tab = findFourDTab(payload.tabKey)
    if (!tab) {
      return
    }
    if (payload.isPlaying) {
      void startFourDPlaybackAfterPreload(payload.tabKey)
      return
    }
    nextFourDPlaybackStartToken(payload.tabKey)
    emitFourDPlaybackStop({ tabKey: payload.tabKey })
  }

  function handleFourDPhaseIndex(payload: FourDPlaybackPhaseEvent | undefined): void {
    if (!payload?.tabKey) {
      return
    }
    const tab = findFourDTab(payload.tabKey)
    if (!tab) {
      return
    }
    const phaseIndex = Number.isFinite(payload.phaseIndex) ? Math.max(0, Math.trunc(payload.phaseIndex)) : 0
    void views.setFourDPhase(payload.tabKey, phaseIndex)
  }

  function handleFourDPlaybackState(payload: FourDPlaybackStateEvent | undefined): void {
    if (!payload?.tabKey) {
      return
    }

    const normalizedPhaseIndex =
      typeof payload.phaseIndex === 'number' && Number.isFinite(payload.phaseIndex)
        ? Math.max(0, Math.trunc(payload.phaseIndex))
        : null

    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === payload.tabKey && item.viewType === '4D'
        ? {
            ...item,
            fourDIsPlaying: Boolean(payload.isPlaying),
            fourDPlaybackFps:
              typeof payload.fps === 'number' && Number.isFinite(payload.fps)
                ? clampFourDFps(payload.fps)
                : item.fourDPlaybackFps
          }
        : item
    )

    if (normalizedPhaseIndex !== null) {
      void views.setFourDPhase(payload.tabKey, normalizedPhaseIndex)
    }
  }

  function handleMtfClear(payload?: { mtfId?: string | null }): void {
    updateActiveTabMtfState((item) => {
      const targetMtfId = payload?.mtfId ?? item.mtfState?.selectedMtfId ?? null
      const targetItem = findMtfItem(item, targetMtfId)
      if (!targetItem) {
        return item
      }

      return updateMtfItemCollection(item, targetItem, {
        remove: true
      })
    })
  }

  async function handleMtfCopy(payload?: { mtfId?: string | null }): Promise<boolean> {
    const tab = activeTab.value
    if (!tab?.mtfState?.items.length) {
      return false
    }

    const sourceItem = findMtfItem(tab, payload?.mtfId ?? tab.mtfState.selectedMtfId ?? null)
    if (!sourceItem) {
      return false
    }

    const occupiedPointSets = tab.mtfState.items.map((item) => item.points)
    let copiedPoints = sourceItem.points
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const candidate = offsetMtfPoints(sourceItem.points, 0.01 * attempt)
      if (!occupiedPointSets.some((points) => arePointSetsClose(points, candidate))) {
        copiedPoints = candidate
        break
      }
    }

    await handleMtfCommit({
      viewportKey: sourceItem.viewportKey,
      points: copiedPoints,
      mtfId: generateMtfId()
    })

    return true
  }

  function hasReadyViewport(payload: WorkspaceReadyPayload, viewportKey: string): boolean {
    const element = payload.viewportElements?.[viewportKey] ?? payload.element ?? null
    return Boolean(
      element?.isConnected &&
        element.dataset.activeRenderSurface &&
        element.dataset.viewportKey === viewportKey
    )
  }

  function shouldRenderOnViewportReady(tab: ViewerTabItem | null, payload: WorkspaceReadyPayload): boolean {
    if (!tab || isViewLoading.value) {
      return false
    }
    if (tab.viewType === '3D') {
      return Boolean(tab.viewId && !tab.imageSrc && hasReadyViewport(payload, 'volume'))
    }
    if (isStackLikeViewType(tab.viewType)) {
      return Boolean(tab.viewId && !tab.imageSrc && hasReadyViewport(payload, 'single'))
    }
    if (tab.viewType === 'MPR') {
      return Boolean(
        Object.values(tab.viewportViewIds ?? {}).some(Boolean) &&
          Object.values(tab.viewportImages ?? {}).some((imageSrc) => !imageSrc) &&
          (hasReadyViewport(payload, 'mpr-ax') || hasReadyViewport(payload, 'mpr-cor') || hasReadyViewport(payload, 'mpr-sag'))
      )
    }
    if (tab.viewType === 'PETCTFusion') {
      return Boolean(
        Object.values(tab.fusionViewIds ?? {}).some(Boolean) &&
          Object.values(tab.fusionImages ?? {}).some((imageSrc) => !imageSrc) &&
          FUSION_PANE_KEYS.some((viewportKey) => hasReadyViewport(payload, viewportKey))
      )
    }
    return false
  }

  function renderActiveTabWhenViewportReady(payload: WorkspaceReadyPayload): void {
    const tab = activeTab.value
    if (!tab || !shouldRenderOnViewportReady(tab, payload) || stageReadyRenderKeys.has(tab.key)) {
      return
    }

    stageReadyRenderKeys.add(tab.key)
    void views.renderTab(tab.key).finally(() => {
      stageReadyRenderKeys.delete(tab.key)
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
      renderActiveTabWhenViewportReady(payload)
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

    const request = postApi('GetCornerInfoApiV1DicomCornerInfoPost', { seriesId })
      .then((data) => {
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
    activeMprCrosshairDragLock,
    clearPendingVolumeConfig,
    completeActiveMprCrosshairDragLock,
    ensureSeriesCornerInfo,
    isViewLoading,
    message,
    onBeforeCloseTab: (tab) => {
      if (tab.viewType === '4D') {
        emitFourDPlaybackStop({ tabKey: tab.key })
      }
    },
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
  const resizeRenderScheduler = createResizeRenderScheduler({
    getActiveTab: () => activeTab.value,
    isViewLoading: () => isViewLoading.value,
    renderTab: (tabKey) => {
      void views.renderTab(tabKey)
    }
  })
  const viewInteractionOperationScheduler = createMprInteractionOperationScheduler<ViewOperationPayload>({
    emit: (_operationKey, payload) => emitViewOperation(payload)
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

  function normalizeExtraImageBinaries(value: unknown): Record<string, ArrayBuffer | Uint8Array> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    const normalized: Record<string, ArrayBuffer | Uint8Array> = {}
    Object.entries(value as Record<string, unknown>).forEach(([key, binaryValue]) => {
      const binary = normalizeImageBinary(binaryValue)
      if (binary) {
        normalized[key] = binary
      }
    })
    return normalized
  }

  function normalizeImageUpdateArgs(
    args: unknown[]
  ): { payload: Partial<ViewImageResponse>; imageBinary?: ArrayBuffer | Uint8Array; extraImageBinaries: Record<string, ArrayBuffer | Uint8Array> } | null {
    if (!args.length) {
      return null
    }

    if (Array.isArray(args[0])) {
      const [payload, imageBinary, extraImageBinaries] = args[0] as [Partial<ViewImageResponse> | undefined, unknown, unknown]
      return payload
        ? {
            payload,
            imageBinary: normalizeImageBinary(imageBinary) ?? undefined,
            extraImageBinaries: normalizeExtraImageBinaries(extraImageBinaries)
          }
        : null
    }

    const [payload, imageBinary, extraImageBinaries] = args as [Partial<ViewImageResponse> | undefined, unknown, unknown]
    return payload
      ? {
          payload,
          imageBinary: normalizeImageBinary(imageBinary) ?? undefined,
          extraImageBinaries: normalizeExtraImageBinaries(extraImageBinaries)
        }
      : null
  }

  function handleImageUpdate(...args: unknown[]): void {
    const normalized = normalizeImageUpdateArgs(args)
    if (!normalized) {
      return
    }

    const { payload, imageBinary, extraImageBinaries } = normalized
    const viewId = payload.viewId
    if (!viewId || !imageBinary) {
      return
    }

    const tab = views.findTabByViewId(viewId)
    if (!tab) {
      return
    }

    logInteractivePreviewReceiveInterval(tab, payload)
    logFusionRegistrationImageReceive(tab, payload, imageBinary, extraImageBinaries)
    if (isInteractivePreviewPayload(payload)) {
      const rawMprRevision = payload.mprRevision ?? ((payload as { mpr_revision?: unknown }).mpr_revision ?? null)
      viewInteractionOperationScheduler.recordBackendPreview(
        viewId,
        typeof rawMprRevision === 'number' && Number.isFinite(rawMprRevision) ? rawMprRevision : null
      )
    }
    views.updateTabImage(tab.key, payload, imageBinary, extraImageBinaries)
  }

  const interactivePreviewTimingByView = new Map<string, number>()
  const fusionRegistrationDragTimingByView = new Map<string, {
    phase: 'start' | 'move' | 'end'
    sentAt: number
    sequence: number
    deltaX: number
    deltaY: number
    rotationDeltaDegrees: number | null
  }>()
  const fusionRegistrationImageReceiveTimingByView = new Map<string, number>()
  let fusionRegistrationDragSequence = 0

  function isInteractivePreviewPayload(payload: Partial<ViewImageResponse>): boolean {
    const rawFastPreview = payload.fastPreview ?? ((payload as { fast_preview?: unknown }).fast_preview ?? null)
    if (typeof rawFastPreview === 'boolean') {
      return rawFastPreview
    }
    return payload.imageFormat === 'jpeg'
  }

  function logInteractivePreviewReceiveInterval(tab: ViewerTabItem, payload: Partial<ViewImageResponse>): void {
    if (!isViewerPerfDebugEnabled() || !payload.viewId || !isInteractivePreviewPayload(payload)) {
      return
    }

    const perfScope = tab.viewType === 'PETCTFusion'
      ? 'fusion'
      : isMprLikeViewType(tab.viewType)
        ? 'mpr'
        : isStackLikeViewType(tab.viewType)
          ? 'stack'
          : null
    if (!perfScope) {
      return
    }

    const key = `${perfScope}:${payload.viewId}`
    const now = performance.now()
    const previousAt = interactivePreviewTimingByView.get(key)
    interactivePreviewTimingByView.set(key, now)
    if (previousAt == null) {
      return
    }
    const deltaMs = now - previousAt
    if (deltaMs > PREVIEW_PERF_IDLE_GAP_MS) {
      console.debug(`[${perfScope} perf] image_update interval restarted`, {
        idleMs: Math.round(deltaMs * 10) / 10,
        fastPreview: payload.fastPreview,
        format: payload.imageFormat,
        viewType: tab.viewType,
        viewId: payload.viewId
      })
      return
    }
    const rawMprRevision = payload.mprRevision ?? ((payload as { mpr_revision?: unknown }).mpr_revision ?? null)
    console.debug(`[${perfScope} perf] image_update interval`, {
      deltaMs: Math.round(deltaMs * 10) / 10,
      fastPreview: payload.fastPreview,
      format: payload.imageFormat,
      mprRevision: typeof rawMprRevision === 'number' && Number.isFinite(rawMprRevision) ? rawMprRevision : null,
      viewType: tab.viewType,
      viewId: payload.viewId
    })
  }

  function getBinaryByteLength(binary: ArrayBuffer | Uint8Array | undefined): number | null {
    if (!binary) {
      return null
    }
    return binary.byteLength
  }

  function getPayloadFusionComposite(payload: Partial<ViewImageResponse>) {
    return payload.fusionComposite ?? ((payload as { fusion_composite?: ViewImageResponse['fusionComposite'] }).fusion_composite ?? null)
  }

  function getPayloadFusionInfo(payload: Partial<ViewImageResponse>) {
    return payload.fusionInfo ?? ((payload as { fusion_info?: ViewImageResponse['fusionInfo'] }).fusion_info ?? null)
  }

  function shouldLogFusionRegistrationImageReceive(
    tab: ViewerTabItem,
    payload: Partial<ViewImageResponse>,
    extraImageBinaries: Record<string, ArrayBuffer | Uint8Array>
  ): boolean {
    if (!isViewerPerfDebugEnabled() || tab.viewType !== 'PETCTFusion' || !payload.viewId) {
      return false
    }
    const overlayViewId = tab.fusionViewIds?.[FUSION_OVERLAY_AXIAL_PANE_KEY]
    if (payload.viewId !== overlayViewId) {
      return false
    }
    const fusionInfo = getPayloadFusionInfo(payload)
    if (fusionInfo?.paneRole && resolveFusionPaneKey(fusionInfo.paneRole) !== FUSION_OVERLAY_AXIAL_PANE_KEY) {
      return false
    }
    const fusionComposite = getPayloadFusionComposite(payload)
    if (!fusionComposite || fusionComposite.mode !== 'ctPetLayers' || !extraImageBinaries.pet) {
      return false
    }
    if (fusionComposite.primaryImageUnchanged === true) {
      return true
    }

    const latestDrag = fusionRegistrationDragTimingByView.get(payload.viewId)
    return latestDrag != null && performance.now() - latestDrag.sentAt <= 10_000
  }

  function logFusionRegistrationImageReceive(
    tab: ViewerTabItem,
    payload: Partial<ViewImageResponse>,
    imageBinary: ArrayBuffer | Uint8Array,
    extraImageBinaries: Record<string, ArrayBuffer | Uint8Array>
  ): void {
    if (!shouldLogFusionRegistrationImageReceive(tab, payload, extraImageBinaries) || !payload.viewId) {
      return
    }

    const now = performance.now()
    const latestDrag = fusionRegistrationDragTimingByView.get(payload.viewId)
    const previousReceiveAt = fusionRegistrationImageReceiveTimingByView.get(payload.viewId)
    fusionRegistrationImageReceiveTimingByView.set(payload.viewId, now)
    const fusionComposite = getPayloadFusionComposite(payload)
    const fusionInfo = getPayloadFusionInfo(payload)
    console.debug('[fusion registration perf] image_update received', {
      receiveAt: new Date().toISOString(),
      receiveAtMs: Math.round(now * 10) / 10,
      sinceLastDragSentMs: latestDrag ? Math.round((now - latestDrag.sentAt) * 10) / 10 : null,
      sincePreviousRegistrationImageMs: previousReceiveAt == null ? null : Math.round((now - previousReceiveAt) * 10) / 10,
      dragPhase: latestDrag?.phase ?? null,
      dragSequence: latestDrag?.sequence ?? null,
      deltaX: latestDrag?.deltaX ?? null,
      deltaY: latestDrag?.deltaY ?? null,
      rotationDeltaDegrees: latestDrag?.rotationDeltaDegrees ?? null,
      viewId: payload.viewId,
      tabKey: tab.key,
      fastPreview: payload.fastPreview ?? ((payload as { fast_preview?: unknown }).fast_preview ?? null),
      imageFormat: payload.imageFormat,
      primaryImageUnchanged: fusionComposite?.primaryImageUnchanged === true,
      fusionRevision: fusionComposite?.revision ?? fusionInfo?.revision ?? null,
      compositeSize: fusionComposite ? `${fusionComposite.width}x${fusionComposite.height}` : null,
      primaryBytes: getBinaryByteLength(imageBinary),
      petBytes: getBinaryByteLength(extraImageBinaries.pet)
    })
  }

  let pendingViewSizeRecovery = false

  async function recoverFromMissingViewSize(): Promise<void> {
    if (pendingViewSizeRecovery) {
      return
    }
    pendingViewSizeRecovery = true
    try {
      await nextTick()
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      await views.renderTab(activeTabKey.value, true)
    } finally {
      pendingViewSizeRecovery = false
    }
  }

  function handleImageError(error: { message?: string } | undefined): void {
    if (error?.message) {
      message.value = error.message
      if (error.message.toLowerCase().includes('view size has not been set')) {
        void recoverFromMissingViewSize()
      }
    }
  }

  function handleViewProgress(payload: ViewProgressInfo | undefined): void {
    views.updateViewProgress(payload)
  }

  const {
    cleanupSocketListeners,
    configureBackendOrigin,
    connectBackend,
    connectionState,
    updateConnectionState
  } = useViewerWorkspaceConnection({
    backendOrigin,
    onConnected: views.rebindOpenViews,
    onDisconnected: () => {
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.viewType === '4D'
          ? {
              ...item,
              fourDIsPlaying: false
            }
          : item
      )
    },
    onReconnecting: () => {
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.viewType === '4D'
          ? {
              ...item,
              fourDIsPlaying: false
            }
          : item
      )
    },
    onFourDPhaseIndex: handleFourDPhaseIndex,
    onFourDPlaybackState: handleFourDPlaybackState,
    onHoverInfo: handleHoverInfo,
    onImageError: handleImageError,
    onImageUpdate: handleImageUpdate,
    onViewProgress: handleViewProgress
  })

  function setBackendOrigin(origin: string): boolean {
    const nextOrigin = origin.trim().replace(/\/+$/, '')
    if (!nextOrigin) {
      return false
    }

    const changed = backendOrigin.value !== nextOrigin
    backendOrigin.value = nextOrigin
    configureBackendOrigin(nextOrigin)
    return changed
  }

  function applyBackendOrigin(origin: string, options: { connect?: boolean } = {}): void {
    const changed = setBackendOrigin(origin)
    if (!options.connect) {
      return
    }

    const isConnectionActive =
      connectionState.value === 'connected' ||
      connectionState.value === 'connecting' ||
      connectionState.value === 'reconnecting'
    if (hasStartedBackendConnection && !changed && isConnectionActive) {
      return
    }

    hasStartedBackendConnection = true
    connectBackend()
  }

  function applyBackendStatus(status: BackendStatus): void {
    if (status.ready) {
      applyBackendOrigin(status.origin, { connect: true })
      return
    }

    setBackendOrigin(status.origin)
    if (status.starting) {
      updateConnectionState('starting')
      return
    }

    if (status.error) {
      updateConnectionState('disconnected')
    }
  }

  async function waitForBackendReady(timeoutMs = 20000): Promise<BackendStatus> {
    const startedAt = Date.now()
    let latestStatus = await viewerRuntime.getBackendStatus()
    applyBackendStatus(latestStatus)

    while (!latestStatus.ready && (latestStatus.starting || !latestStatus.error) && Date.now() - startedAt < timeoutMs) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250))
      latestStatus = await viewerRuntime.getBackendStatus()
      applyBackendStatus(latestStatus)
    }

    return latestStatus
  }

  async function ensureBackendConnection(): Promise<void> {
    if (connectionState.value === 'connected' || connectionState.value === 'connecting' || connectionState.value === 'reconnecting') {
      return
    }

    if (!backendConnectionPromise) {
      backendConnectionPromise = (async () => {
        const status = await waitForBackendReady()
        if (!status.ready) {
          throw new Error(status.error || 'Backend service is not ready.')
        }
        applyBackendOrigin(status.origin, { connect: true })
      })().finally(() => {
        backendConnectionPromise = null
      })
    }

    await backendConnectionPromise
  }

  function handleViewportWheel(payload: number | { viewportKey: string; deltaY: number }): void {
    const tab = activeTab.value
    if (!tab) {
      return
    }

    const viewportKey = typeof payload === 'number' ? activeViewportKey.value : payload.viewportKey
    const deltaY = typeof payload === 'number' ? payload : payload.deltaY
    const viewId = getActiveViewIdForTab(tab, viewportKey)
    if (!viewId || isFourDPlaybackLocked(tab) || (!isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType))) {
      return
    }

    const normalizedDelta = Number.isFinite(deltaY) ? Math.trunc(deltaY) : 0
    const scroll = normalizedDelta > 0 ? normalizedDelta : normalizedDelta < 0 ? normalizedDelta : 0
    if (!scroll) {
      return
    }

    if (isMprLikeViewType(tab.viewType)) {
      if (isMprVolumeViewport(tab, viewportKey)) {
        return
      }
      emitMprViewOperation(viewportKey, {
        opType: VIEW_OPERATION_TYPES.scroll,
        delta: scroll
      })
      return
    }

    resolveOperationTargets(tab, viewportKey, VIEW_OPERATION_TYPES.scroll).forEach((target) => {
      emitViewOperation({
        viewId: target.viewId,
        opType: VIEW_OPERATION_TYPES.scroll,
        delta: scroll
      })
    })
  }

  function isFusionPetDisplayPane(viewportKey: string): boolean {
    const paneKey = resolveFusionPaneKey(viewportKey)
    return paneKey === FUSION_PET_AXIAL_PANE_KEY || paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY
  }

  function resolveFusionPetWindowMax(tab: ViewerTabItem): number {
    const value = Number(tab.fusionInfo?.petWindowMax ?? DEFAULT_FUSION_PET_WINDOW_MAX)
    return Number.isFinite(value) ? Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, value) : DEFAULT_FUSION_PET_WINDOW_MAX
  }

  function resolveFusionPetWindowDragSensitivity(windowMax: number): number {
    return Math.max(0.001, Math.abs(windowMax) * FUSION_PET_WINDOW_DRAG_RANGE_FRACTION)
  }

  function applyOptimisticFusionPetWindowRange(tabKey: string, petWindowMax: number): void {
    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === tabKey
        ? {
            ...item,
            fusionInfo: item.fusionInfo
              ? {
                  ...item.fusionInfo,
                  petWindowMin: DEFAULT_FUSION_PET_WINDOW_MIN,
                  petWindowMax
                }
              : item.fusionInfo
          }
        : item
    )
  }

  function handleFusionPetWindowDrag(
    tab: ViewerTabItem,
    payload: {
      deltaX: number
      deltaY: number
      opType: ViewOperationType
      phase: 'start' | 'move' | 'end'
      viewportKey: string
    }
  ): boolean {
    if (tab.viewType !== 'PETCTFusion' || payload.opType !== VIEW_OPERATION_TYPES.window || !isFusionPetDisplayPane(payload.viewportKey)) {
      return false
    }

    const paneKey = resolveFusionPaneKey(payload.viewportKey)
    const viewId = tab.fusionViewIds?.[paneKey] ?? ''
    if (!viewId) {
      return true
    }

    if (payload.phase === DRAG_ACTION_TYPES.start) {
      fusionPetWindowDragOriginMax = resolveFusionPetWindowMax(tab)
      return true
    }

    if (payload.phase === DRAG_ACTION_TYPES.end) {
      const petWindowMax = resolveFusionPetWindowMax(tab)
      fusionPetWindowDragOriginMax = null
      emitScheduledViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.fusionConfig,
        actionType: DRAG_ACTION_TYPES.end,
        fusionPetWindowMin: DEFAULT_FUSION_PET_WINDOW_MIN,
        fusionPetWindowMax: petWindowMax
      })
      return true
    }

    if (!payload.deltaX && !payload.deltaY) {
      return true
    }

    const baseMax = fusionPetWindowDragOriginMax ?? resolveFusionPetWindowMax(tab)
    const dragSensitivity = resolveFusionPetWindowDragSensitivity(baseMax)
    const petWindowMax = Math.max(
      DEFAULT_FUSION_PET_WINDOW_MIN,
      baseMax + (Number(payload.deltaX || 0) - Number(payload.deltaY || 0)) * dragSensitivity
    )
    applyOptimisticFusionPetWindowRange(tab.key, petWindowMax)
    emitScheduledViewOperation({
      viewId,
      opType: VIEW_OPERATION_TYPES.fusionConfig,
      actionType: DRAG_ACTION_TYPES.move,
      fusionPetWindowMin: DEFAULT_FUSION_PET_WINDOW_MIN,
      fusionPetWindowMax: petWindowMax
    })
    return true
  }

  function handleViewportDrag(payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'start' | 'move' | 'end'
    viewportKey: string
  }): void {
    const tab = activeTab.value
    if (!tab || isFourDPlaybackLocked(tab) || !STACK_DRAG_OPERATIONS.includes(payload.opType as (typeof STACK_DRAG_OPERATIONS)[number])) {
      return
    }

    const viewId = getActiveViewIdForTab(tab, payload.viewportKey)
    if (!viewId) {
      return
    }

    if (handleFusionPetWindowDrag(tab, payload)) {
      return
    }

    if (payload.phase === DRAG_ACTION_TYPES.move && !payload.deltaX && !payload.deltaY) {
      return
    }

    if (isMprLikeViewType(tab.viewType) && !isMprVolumeViewport(tab, payload.viewportKey)) {
      emitMprViewOperation(payload.viewportKey, {
        opType: payload.opType,
        actionType: payload.phase,
        x: payload.deltaX,
        y: payload.deltaY
      })
      return
    }

    resolveOperationTargets(tab, payload.viewportKey, payload.opType).forEach((target) => {
      emitScheduledViewOperation({
        viewId: target.viewId,
        opType: payload.opType,
        actionType: payload.phase,
        x: payload.deltaX,
        y: payload.deltaY
      })
    })
  }

  function handleFusionRegistrationDrag(payload: {
    deltaX: number
    deltaY: number
    phase: 'start' | 'move' | 'end'
    subOpType: 'translate' | 'rotate'
    viewportKey: string
    anchorX?: number
    anchorY?: number
    currentX?: number
    currentY?: number
    pivotX?: number
    pivotY?: number
    rotationDeltaDegrees?: number
  }): void {
    const tab = activeTab.value
    if (!tab || tab.viewType !== 'PETCTFusion' || !tab.fusionManualRegistration) {
      return
    }
    const viewportKey = resolveFusionPaneKey(payload.viewportKey)
    if (viewportKey !== FUSION_OVERLAY_AXIAL_PANE_KEY) {
      return
    }
    const viewId = tab.fusionViewIds?.[viewportKey] ?? ''
    if (!viewId) {
      return
    }
    if (payload.phase === DRAG_ACTION_TYPES.start || payload.phase === DRAG_ACTION_TYPES.end) {
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              fusionRegistrationDragActive: payload.phase === DRAG_ACTION_TYPES.start
            }
          : item
      )
    }
    if (payload.phase === DRAG_ACTION_TYPES.move && !payload.deltaX && !payload.deltaY) {
      return
    }
    if (isViewerPerfDebugEnabled()) {
      fusionRegistrationDragTimingByView.set(viewId, {
        phase: payload.phase,
        sentAt: performance.now(),
        sequence: ++fusionRegistrationDragSequence,
        deltaX: payload.deltaX,
        deltaY: payload.deltaY,
        rotationDeltaDegrees: typeof payload.rotationDeltaDegrees === 'number' && Number.isFinite(payload.rotationDeltaDegrees)
          ? payload.rotationDeltaDegrees
          : null
      })
    }
    emitScheduledViewOperation({
      viewId,
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: payload.phase,
      subOpType: payload.subOpType,
      x: payload.deltaX,
      y: payload.deltaY,
      anchorX: payload.anchorX,
      anchorY: payload.anchorY,
      currentX: payload.currentX,
      currentY: payload.currentY,
      pivotX: payload.pivotX,
      pivotY: payload.pivotY,
      rotationDeltaDegrees: payload.rotationDeltaDegrees
    })
  }

  function handlePetConfigChange(payload: {
    petUnit?: string
    petWindowMin?: number
    petWindowMax?: number
  }): void {
    const tab = activeTab.value
    if (!tab || tab.viewType !== 'PET') {
      return
    }
    const viewId = tab.viewId
    if (!viewId) {
      return
    }

    const petUnit = payload.petUnit
    const petWindowMin = Number.isFinite(payload.petWindowMin)
      ? Number(payload.petWindowMin)
      : (tab.petInfo?.petWindowMin ?? DEFAULT_FUSION_PET_WINDOW_MIN)
    const petWindowMax = Number.isFinite(payload.petWindowMax)
      ? Number(payload.petWindowMax)
      : (tab.petInfo?.petWindowMax ?? DEFAULT_FUSION_PET_WINDOW_MAX)

    viewerTabs.value = viewerTabs.value.map((item) =>
      item.key === tab.key
        ? {
            ...item,
            petInfo: {
              seriesId: item.seriesId,
              ...(item.petInfo ?? {}),
              ...(petUnit ? { petUnit } : {}),
              ...(payload.petWindowMin != null || payload.petWindowMax != null
                ? { petWindowMin, petWindowMax }
                : {})
            }
          }
        : item
    )

    emitViewOperation({
      viewId,
      opType: VIEW_OPERATION_TYPES.petConfig,
      ...(petUnit ? { petUnit } : {}),
      ...(payload.petWindowMin != null || payload.petWindowMax != null
        ? {
            petWindowMin,
            petWindowMax
          }
        : {})
    })
  }

  function handleFusionConfigChange(payload: {
    manualRegistration?: boolean
    pseudocolorPreset?: string
    petUnit?: string
    petWindowMin?: number
    petWindowMax?: number
    action?: 'reset' | 'save'
  }): void {
    const tab = activeTab.value
    if (!tab || tab.viewType !== 'PETCTFusion') {
      return
    }
    const viewId = tab.fusionViewIds?.[FUSION_OVERLAY_AXIAL_PANE_KEY] ?? Object.values(tab.fusionViewIds ?? {}).find(Boolean) ?? ''
    if (!viewId) {
      return
    }

    if (typeof payload.manualRegistration === 'boolean') {
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              fusionManualRegistration: payload.manualRegistration
            }
          : item
      )
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.fusionConfig,
        fusionManualRegistration: payload.manualRegistration
      })
      return
    }

    if (payload.pseudocolorPreset) {
      const presetKey = normalizeFusionPetPseudocolorPresetKey(payload.pseudocolorPreset)
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              fusionInfo: item.fusionInfo
                ? {
                    ...item.fusionInfo,
                    petPseudocolorPreset: presetKey
                  }
                : item.fusionInfo,
              fusionPseudocolorPresets: {
                ...(item.fusionPseudocolorPresets ?? {}),
                [FUSION_PET_AXIAL_PANE_KEY]: DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET,
                [FUSION_OVERLAY_AXIAL_PANE_KEY]: presetKey,
                [FUSION_PET_CORONAL_MIP_PANE_KEY]: DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET
              }
            }
          : item
      )
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.fusionConfig,
        pseudocolorPreset: presetKey
      })
      return
    }

    if (payload.petUnit) {
      const petUnit = payload.petUnit
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              fusionInfo: item.fusionInfo
                ? {
                    ...item.fusionInfo,
                    petUnit
                  }
                : item.fusionInfo
            }
          : item
      )
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.fusionConfig,
        fusionPetUnit: petUnit
      })
      return
    }

    if (payload.petWindowMin != null || payload.petWindowMax != null) {
      const petWindowMin = Number.isFinite(payload.petWindowMin)
        ? Number(payload.petWindowMin)
        : (tab.fusionInfo?.petWindowMin ?? DEFAULT_FUSION_PET_WINDOW_MIN)
      const petWindowMax = Number.isFinite(payload.petWindowMax)
        ? Number(payload.petWindowMax)
        : (tab.fusionInfo?.petWindowMax ?? DEFAULT_FUSION_PET_WINDOW_MAX)
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              fusionInfo: item.fusionInfo
                ? {
                    ...item.fusionInfo,
                    petWindowMin,
                    petWindowMax
                  }
                : item.fusionInfo
            }
          : item
      )
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.fusionConfig,
        fusionPetWindowMin: petWindowMin,
        fusionPetWindowMax: petWindowMax
      })
      return
    }

    if (payload.action) {
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.fusionRegistration,
        actionType: 'end',
        subOpType: payload.action
      })
    }
  }

  async function handleFusionRegistrationLoad(registrationFile: Record<string, unknown>): Promise<void> {
    const tab = activeTab.value
    if (!tab || tab.viewType !== 'PETCTFusion') {
      return
    }
    const viewId = tab.fusionViewIds?.[FUSION_OVERLAY_AXIAL_PANE_KEY] ?? Object.values(tab.fusionViewIds ?? {}).find(Boolean) ?? ''
    if (!viewId) {
      showStatusToast('融合视图尚未初始化，请等待图像加载完成后再加载配准文件。', 'warning')
      return
    }
    const ok = await emitViewOperationWithAck({
      viewId,
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: 'end',
      subOpType: 'load',
      fusionRegistrationFile: registrationFile
    })
    showStatusToast(ok ? '配准文件已加载。' : '加载配准文件失败，请确认 CT/PET 序列匹配。', ok ? 'success' : 'error')
  }

  function applyOptimisticMprCrosshair(payload: MprCrosshairInteractionPayload): void {
    if (
      (payload.phase !== DRAG_ACTION_TYPES.move && payload.phase !== DRAG_ACTION_TYPES.end) ||
      !isMprViewportKey(payload.viewportKey)
    ) {
      return
    }

    const viewportKey = payload.viewportKey
    const isRotateDrag = payload.mode === 'rotate'
    const optimisticPointer = getOptimisticMprCrosshairPointer(payload)
    viewerTabs.value = viewerTabs.value.map((item) => {
      if (item.key !== activeTabKey.value || !isMprLikeViewType(item.viewType)) {
        return item
      }

      const previousCrosshair = item.viewportCrosshairs?.[viewportKey] ?? null
      const geometry = getTabViewportCrosshairGeometry(item, viewportKey)
      const phaseKey = getCurrentMprCrosshairPhaseKey(item)
      const update = {
        tabKey: item.key,
        viewportKey,
        phaseKey
      }
      const nextCrosshair = isRotateDrag
        ? (() => {
            const rotation = resolveOptimisticMprCrosshairRotation({
              lock: activeMprCrosshairDragLock.value,
              pointerX: optimisticPointer.x,
              pointerY: optimisticPointer.y,
              canvasWidth: optimisticPointer.canvasWidth,
              canvasHeight: optimisticPointer.canvasHeight,
              line: payload.line,
              update,
              currentHorizontalAngleRad: previousCrosshair?.horizontalAngleRad ?? geometry?.horizontalAngleRad ?? null,
              currentVerticalAngleRad: previousCrosshair?.verticalAngleRad ?? geometry?.verticalAngleRad ?? null
            })
            if (!rotation) {
              return null
            }
            const centerX = previousCrosshair?.centerX ?? geometry?.center.x ?? 0.5
            const centerY = previousCrosshair?.centerY ?? geometry?.center.y ?? 0.5
            const slabOffsets = resolveOptimisticMprCrosshairSlabOffsets({
              currentCrosshair: previousCrosshair,
              lock: activeMprCrosshairDragLock.value,
              horizontalAngleRad: rotation.horizontalAngleRad,
              verticalAngleRad: rotation.verticalAngleRad,
              canvasWidth: optimisticPointer.canvasWidth,
              canvasHeight: optimisticPointer.canvasHeight
            })
            return {
              ...(previousCrosshair ?? {}),
              centerX,
              centerY,
              hitRadius: previousCrosshair?.hitRadius ?? 0.025,
              horizontalPosition: previousCrosshair?.horizontalPosition ?? centerY,
              verticalPosition: previousCrosshair?.verticalPosition ?? centerX,
              horizontalAngleRad: rotation.horizontalAngleRad,
              verticalAngleRad: rotation.verticalAngleRad,
              ...slabOffsets
            }
          })()
        : (() => {
            const optimisticCenter = resolveOptimisticMprCrosshairCenter({
              lock: activeMprCrosshairDragLock.value,
              pointerX: optimisticPointer.x,
              pointerY: optimisticPointer.y,
              update
            })
            return {
              ...(previousCrosshair ?? {}),
              centerX: optimisticCenter.x,
              centerY: optimisticCenter.y,
              hitRadius: previousCrosshair?.hitRadius ?? 0.025,
              horizontalPosition: optimisticCenter.y,
              verticalPosition: optimisticCenter.x,
              horizontalAngleRad: previousCrosshair?.horizontalAngleRad ?? null,
              verticalAngleRad: previousCrosshair?.verticalAngleRad ?? null
            }
          })()
      if (!nextCrosshair) {
        return item
      }
      const viewportCrosshairs = {
        ...(item.viewportCrosshairs ?? createEmptyMprCrosshairs()),
        [viewportKey]: nextCrosshair
      }

      if (item.viewType !== '4D') {
        return {
          ...item,
          viewportCrosshairs
        }
      }

      const currentPhaseKey = String(Math.max(0, Math.trunc(item.fourDPhaseIndex ?? 0)))
      const phaseCache = item.fourDPhaseCache?.[currentPhaseKey]
      return {
        ...item,
        viewportCrosshairs,
        fourDPhaseCache: phaseCache
          ? {
              ...(item.fourDPhaseCache ?? {}),
              [currentPhaseKey]: {
                ...phaseCache,
                viewportCrosshairs: {
                  ...(phaseCache.viewportCrosshairs ?? createEmptyMprCrosshairs()),
                  [viewportKey]: nextCrosshair
                }
              }
            }
          : item.fourDPhaseCache
      }
    })
  }

  function handleMprCrosshair(payload: MprCrosshairInteractionPayload): void {
    const tab = activeTab.value
    refreshActiveMprCrosshairDragLock(payload)
    applyOptimisticMprCrosshair(payload)
    emitMprViewOperation(payload.viewportKey, {
      opType: payload.mode === 'rotate' ? VIEW_OPERATION_TYPES.mprOblique : VIEW_OPERATION_TYPES.crosshair,
      actionType: payload.phase,
      x: payload.x,
      y: payload.y,
      line: payload.line
    })
    if (tab?.viewType === '4D' && !isFourDPlaybackLocked(tab) && payload.phase === DRAG_ACTION_TYPES.end) {
      views.invalidateFourDMprState(tab.key)
    }
  }

  function upsertMeasurementOverlay(
    list: MeasurementOverlay[],
    payload: {
      toolType: MeasurementToolType
      points: MeasurementDraftPoint[]
      measurementId?: string
      labelLines?: string[]
    }
  ): MeasurementOverlay[] {
    const nextMeasurementId = payload.measurementId?.trim()
    if (!nextMeasurementId) {
      return list
    }

    const nextOverlay: MeasurementOverlay = {
      measurementId: nextMeasurementId,
      toolType: payload.toolType,
      points: payload.points,
      labelLines: payload.labelLines ?? []
    }

    const index = list.findIndex((measurement) => measurement.measurementId === nextMeasurementId)
    if (index === -1) {
      return [
        ...list.filter(
          (measurement) =>
            measurement.toolType !== nextOverlay.toolType ||
            !arePointSetsClose(measurement.points, nextOverlay.points)
        ),
        nextOverlay
      ]
    }

    return list.map((measurement, currentIndex) => (currentIndex === index ? nextOverlay : measurement))
  }

  function handleMeasurementCreate(payload: {
    viewportKey: string
    toolType: MeasurementToolType
    points: MeasurementDraftPoint[]
    measurementId?: string
    labelLines?: string[]
  }): void {
    const tab = activeTab.value
    if (tab && !isFourDPlaybackLocked(tab) && (isStackLikeViewType(tab.viewType) || isMprLikeViewType(tab.viewType)) && payload.measurementId?.trim()) {
      viewerTabs.value = viewerTabs.value.map((item) => {
        if (item.key !== tab.key) {
          return item
        }

        if (isMprLikeViewType(item.viewType) || item.viewType === 'CompareStack' || item.viewType === 'Layout') {
          return {
            ...item,
            viewportMeasurements: {
              ...(item.viewportMeasurements ?? {}),
              [payload.viewportKey]: upsertMeasurementOverlay(
                item.viewportMeasurements?.[payload.viewportKey as MprViewportKey] ?? [],
                payload
              )
            }
          }
        }

        return {
          ...item,
          measurements: upsertMeasurementOverlay(item.measurements ?? [], payload)
        }
      })
    }

    emitMeasurementOperation({
      ...payload,
      phase: DRAG_ACTION_TYPES.end
    })
  }

  function handleMeasurementDelete(payload: { viewportKey: string; measurementId: string }): void {
    const tab = activeTab.value
    if (!tab || isFourDPlaybackLocked(tab) || (!isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType)) || !payload.measurementId) {
      return
    }

    viewerTabs.value = viewerTabs.value.map((item) => {
      if (item.key !== tab.key) {
        return item
      }

        if (isMprLikeViewType(item.viewType) || item.viewType === 'CompareStack' || item.viewType === 'Layout') {
          return {
            ...item,
            viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [payload.viewportKey]: (item.viewportMeasurements?.[payload.viewportKey as MprViewportKey] ?? []).filter(
              (measurement) => measurement.measurementId !== payload.measurementId
            )
          }
        }
      }

      return {
        ...item,
        measurements: (item.measurements ?? []).filter((measurement) => measurement.measurementId !== payload.measurementId)
      }
    })

    const operationPayload: ViewOperationInput = {
      opType: VIEW_OPERATION_TYPES.measurement,
      actionType: 'delete',
      measurementId: payload.measurementId,
      viewportKey: payload.viewportKey
    }

    if (isMprLikeViewType(tab.viewType)) {
      emitMprViewOperation(payload.viewportKey, operationPayload)
      return
    }

    const viewId = getActiveViewIdForTab(tab, payload.viewportKey)
    if (!viewId) {
      return
    }

    emitViewOperation({
      viewId,
      ...operationPayload
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

  function handleAnnotationOperation(payload: {
    viewportKey: string
    annotationId?: string
    actionType: 'end' | 'delete'
    toolType?: string
    points?: MeasurementDraftPoint[]
    text?: string
    color?: string
    size?: string
  }): void {
    emitAnnotationOperation(payload)
  }

  function clearActiveTabMtf(): void {
    updateActiveTabMtfState((item) => ({
      ...item,
      mtfState: null
    }))
  }

  async function openSeriesViewWithHangingProtocol(
    seriesId: string,
    viewType: ViewType,
    options: OpenSeriesViewOptions = {}
  ): Promise<void> {
    await ensureBackendConnection()
    const series = seriesList.value.find((item) => item.seriesId === seriesId) ?? null
    if (series?.isImageSeries === false && viewType !== 'Tag') {
      await views.openSeriesView(seriesId, 'Tag')
      return
    }

    if (viewType !== 'Stack' || options.useHangingProtocol === false) {
      await views.openSeriesView(seriesId, viewType)
      return
    }

    const rule = findMatchingHangingProtocolRule(hangingProtocolRules.value, series)
    if (!rule) {
      await views.openSeriesView(seriesId, viewType)
      return
    }

    await views.openSeriesView(seriesId, 'Stack')
    await views.openLayoutView(createLayoutTemplateFromHangingProtocolRule(rule))
  }

  async function openKeySlice(seriesId: string, sliceIndex: number): Promise<void> {
    if (!seriesId) {
      return
    }

    await ensureBackendConnection()
    const targetIndex = Number.isFinite(sliceIndex) ? Math.max(0, Math.trunc(sliceIndex)) : 0
    await views.openSeriesView(seriesId, 'Stack')
    await nextTick()

    const tab = activeTab.value
    if (!tab || tab.viewType !== 'Stack' || tab.seriesId !== seriesId) {
      return
    }

    const slice = parseSliceLabel(tab.sliceLabel)
    const clampedTargetIndex = slice ? Math.min(targetIndex, Math.max(0, slice.total - 1)) : targetIndex
    const currentIndex = slice?.index ?? 0
    const delta = clampedTargetIndex - currentIndex
    if (delta !== 0) {
      handleViewportWheel({ viewportKey: 'single', deltaY: delta })
    }
  }

  async function openViewWithHangingProtocol(viewType: ViewType): Promise<void> {
    if (!selectedSeriesId.value) {
      return
    }
    await openSeriesViewWithHangingProtocol(selectedSeriesId.value, viewType)
  }

  async function openLayoutViewWithBackend(template: ViewerLayoutTemplate): Promise<void> {
    await ensureBackendConnection()
    await views.openLayoutView(template)
  }

  async function openSeriesCompareWithBackend(sourceSeriesId: string, targetSeriesId: string): Promise<void> {
    await ensureBackendConnection()
    await views.openSeriesCompare(sourceSeriesId, targetSeriesId)
  }

  async function openPetCtFusionWithBackend(ctSeriesId: string, petSeriesId: string): Promise<void> {
    await ensureBackendConnection()
    await views.openPetCtFusion(ctSeriesId, petSeriesId)
  }

  function shouldAutoSelectLoadedSeries(): boolean {
    return !selectedSeriesId.value
  }

  function normalizeDicomLoadSelection(selection: DicomLoadSelection): DicomLoadSource[] {
    return Array.isArray(selection) ? selection : [selection]
  }

  async function chooseFolder(mode?: WebUploadPickMode): Promise<void> {
    const selection = await viewerRuntime.chooseFolder(mode)
    if (!selection) {
      return
    }

    let shouldSelectLoadedSeries = shouldAutoSelectLoadedSeries()
    for (const source of normalizeDicomLoadSelection(selection)) {
      const loadedSeries = await loadDicomSource(source, { selectLoadedSeries: shouldSelectLoadedSeries })
      if (loadedSeries.length && shouldSelectLoadedSeries) {
        shouldSelectLoadedSeries = false
      }
    }
  }

  async function loadDroppedDicomFiles(drop: DicomDropInput): Promise<void> {
    const sources = await viewerRuntime.resolveDroppedDicomSources(drop)
    if (!sources.length) {
      message.value = ''
      showStatusToast(workspaceStatusCopy.value.folderLoadFailed, 'warning')
      return
    }

    let shouldSelectLoadedSeries = shouldAutoSelectLoadedSeries()
    for (const source of sources) {
      const loadedSeries = await loadDicomSource(source, { selectLoadedSeries: shouldSelectLoadedSeries })
      if (loadedSeries.length && shouldSelectLoadedSeries) {
        shouldSelectLoadedSeries = false
      }
    }
  }

  async function loadDicomPaths(paths: string[]): Promise<void> {
    const sources = await viewerRuntime.resolveDicomPathSources(paths)
    if (!sources.length) {
      message.value = ''
      showStatusToast(workspaceStatusCopy.value.folderLoadFailed, 'warning')
      return
    }

    let shouldOpenLoadedSeries = true
    for (const source of sources) {
      const loadedSeries = await loadDicomSource(source, {
        selectLoadedSeries: shouldOpenLoadedSeries,
        openFirstSeriesView: shouldOpenLoadedSeries
      })
      if (loadedSeries.length && shouldOpenLoadedSeries) {
        shouldOpenLoadedSeries = false
      }
    }
  }

  async function handleLayoutSlotDicomDrop(payload: { tabKey: string; slotId: string; drop: DicomDropInput }): Promise<void> {
    const sources = await viewerRuntime.resolveDroppedDicomSources(payload.drop)
    if (!sources.length) {
      message.value = ''
      showStatusToast(workspaceStatusCopy.value.folderLoadFailed, 'warning')
      return
    }

    for (const source of sources) {
      const loadedSeries = await loadDicomSource(source, { selectLoadedSeries: false })
      const nextSeries = resolveLayoutStackDropSeries(loadedSeries)
      if (!nextSeries) {
        continue
      }

      await views.setLayoutSlotSeries({
        tabKey: payload.tabKey,
        slotId: payload.slotId,
        series: nextSeries,
        activateSlot: false
      })
      showStatusToast(getLayoutSlotLoadedToastMessage(), 'success')
      return
    }

    showStatusToast(workspaceStatusCopy.value.noUsableSeries, 'warning')
  }

  function resolveDroppedLayoutSeries(payload: {
    seriesId: string
    folderPath?: string
    seriesInstanceUid?: string | null
  }): FolderSeriesItem | null {
    const candidates = seriesList.value.filter((item) => item.seriesId === payload.seriesId)
    const hasSnapshotIdentity = Boolean(payload.folderPath || payload.seriesInstanceUid)
    if (!hasSnapshotIdentity) {
      return candidates[0] ?? null
    }

    return (
      candidates.find((item) => {
        const folderMatches = payload.folderPath ? item.folderPath === payload.folderPath : true
        const uidMatches = payload.seriesInstanceUid ? item.seriesInstanceUid === payload.seriesInstanceUid : true
        return folderMatches && uidMatches
      }) ?? null
    )
  }

  async function handleLayoutSlotSeriesDrop(payload: {
    tabKey: string
    slotId: string
    seriesId: string
    folderPath?: string
    seriesInstanceUid?: string | null
  }): Promise<void> {
    const series = resolveDroppedLayoutSeries(payload)
    if (!series) {
      showStatusToast(workspaceStatusCopy.value.noUsableSeries, 'warning')
      return
    }
    if (!isLayoutStackDropSeriesSupported(series)) {
      showStatusToast(workspaceStatusCopy.value.noUsableSeries, 'warning')
      return
    }

    await views.setLayoutSlotSeries({
      tabKey: payload.tabKey,
      slotId: payload.slotId,
      series,
      activateSlot: false
    })
    showStatusToast(getLayoutSlotLoadedToastMessage(), 'success')
  }

  async function applyLoadedDicomSeries(
    data: LoadFolderResponse,
    options: LoadFolderSeriesOptions = {}
  ): Promise<FolderSeriesItem[]> {
    const { openFirstSeriesView = false, selectLoadedSeries = true } = options
    const incomingSeries = (data.seriesList ?? []) as FolderSeriesItem[]
    if (!incomingSeries.length) {
      message.value = ''
      showStatusToast(workspaceStatusCopy.value.noUsableSeries, 'warning')
      return []
    }

    const { seriesList: nextSeriesList, loadedSeries, appendedSeries } = mergeLoadedFolderSeries(
      seriesList.value,
      incomingSeries
    )
    seriesList.value = nextSeriesList

    const nextSeriesId = appendedSeries[0]?.seriesId ?? loadedSeries[0]?.seriesId ?? selectedSeriesId.value
    const nextSeries = nextSeriesList.find((item) => item.seriesId === nextSeriesId) ?? null
    if (selectLoadedSeries && nextSeriesId) {
      views.selectSeries(nextSeriesId)
    }

    if (openFirstSeriesView && nextSeriesId) {
      await openSeriesViewWithHangingProtocol(nextSeriesId, resolveInitialSeriesViewType(nextSeries))
    }

    message.value = ''
    return loadedSeries
  }

  async function loadDicomSource(source: DicomLoadSource, options: LoadFolderSeriesOptions = {}): Promise<FolderSeriesItem[]> {
    const request = folderLoadRequestGuard.start()
    const uploadTotalBytes = getUploadSourceTotalBytes(source)
    isLoadingFolder.value = true

    try {
      await ensureBackendConnection()
      if (source.kind === 'files') {
        showDicomUploadToast({ loaded: 0, total: uploadTotalBytes, percent: uploadTotalBytes > 0 ? 0 : null })
      }

      const data = await loadDicomSourceData(source, request.signal, (progress) => {
        if (!folderLoadRequestGuard.isCurrent(request.token)) {
          return
        }
        showDicomUploadToast(normalizeUploadProgress(progress, uploadTotalBytes))
      })

      if (!folderLoadRequestGuard.isCurrent(request.token)) {
        return []
      }

      const loadedSeries = await applyLoadedDicomSeries(data, options)
      if (!loadedSeries.length) {
        return []
      }
      if (source.kind === 'files') {
        showStatusToast(workspaceStatusCopy.value.uploadDicomComplete, 'success', {
          progressPercent: 100,
          progressLabel: locale.value === 'zh-CN' ? `${loadedSeries.length} 个序列` : `${loadedSeries.length} series`,
          durationMs: 3600
        })
      }

      message.value = ''
      return loadedSeries
    } catch (error) {
      if (!folderLoadRequestGuard.isCurrent(request.token)) {
        return []
      }
      message.value = ''
      showStatusToast(buildLoadFailureToastMessage(error), 'error')
      console.error(error)
      return []
    } finally {
      if (folderLoadRequestGuard.isCurrent(request.token)) {
        isLoadingFolder.value = false
        folderLoadRequestGuard.finish(request.token)
      }
    }
  }

  async function loadDicomSourceData(
    source: DicomLoadSource,
    signal: AbortSignal,
    onUploadProgress?: (progress: DicomUploadProgress) => void
  ) {
    if (source.kind === 'server-sample') {
      return postApi('LoadSampleFolderApiV1DicomLoadSamplePost', undefined, { signal })
    }

    if (source.kind === 'files') {
      return postDicomUpload(source.files, { signal }, onUploadProgress)
    }

    return postApi(
      'LoadFolderApiV1DicomLoadFolderPost',
      {
        folderPath: source.path
      },
      {
        signal
      }
    )
  }

  function setupResizeObserver(): void {
    if (!viewerStage.value || typeof ResizeObserver === 'undefined') {
      return
    }

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        resizeRenderScheduler.schedule()
      })
    }

    if (observedViewerStage === viewerStage.value) {
      return
    }

    resizeObserver.observe(viewerStage.value)
    observedViewerStage = viewerStage.value
  }

  onMounted(() => {
    removeBackendOriginChangedListener =
      window.viewerApi?.onBackendOriginChanged?.((origin) =>
        applyBackendOrigin(origin, { connect: hasStartedBackendConnection })
      ) ?? null
    removeBackendStatusChangedListener = window.viewerApi?.onBackendStatusChanged?.(applyBackendStatus) ?? null
    void (async () => {
      const backendStatus = await viewerRuntime.getBackendStatus()
      applyBackendStatus(backendStatus)
    })()
  })

  onBeforeUnmount(() => {
    viewInteractionOperationScheduler.cancel()
    flushAllPendingVolumeConfig()
    clearActiveMprCrosshairDragLock()
    cleanupHover()
    cleanupSocketListeners()
    removeBackendOriginChangedListener?.()
    removeBackendOriginChangedListener = null
    removeBackendStatusChangedListener?.()
    removeBackendStatusChangedListener = null
    dismissStatusToast()
    if (resizeObserver && observedViewerStage) {
      resizeObserver.unobserve(observedViewerStage)
    }
    resizeObserver?.disconnect()
    resizeRenderScheduler.cancel()
  })

  async function handleTagIndexChange(payload: { tabKey: string; index: number }): Promise<void> {
    await views.setTagTabIndex(payload.tabKey, payload.index)
  }

  return {
    activeOperation,
    activeTab,
    activeTabKey,
    activateTab: views.activateTab,
    applyLoadedDicomSeries,
    chooseFolder,
    closeTab: views.closeTab,
    closeOtherTabs: views.closeOtherTabs,
    connectionState,
    handleHoverViewportChange,
    handleMeasurementCreate,
    handleMeasurementDelete,
    handleMeasurementDraft,
    handleAnnotationOperation,
    handleTagIndexChange,
    handleMtfClear,
    handleMtfCommit,
    handleMtfCopy,
    handleMtfSelect,
    handleFourDPhaseChange,
    handleFourDFpsChange,
    handleFourDPlaybackChange,
    handleFusionConfigChange,
    handleFusionRegistrationDrag,
    handleMprCrosshair,
    handleCompareSyncChange,
    handleViewportLayoutChange,
    handleLayoutSlotDicomDrop,
    handleLayoutSlotSeriesDrop,
    handleVolumeConfigChange,
    handleViewportDrag,
    handleViewportWheel,
    hasSelectedSeries,
    isLoadingFolder,
    isSidebarCollapsed,
    isViewLoading,
    loadDroppedDicomFiles,
    loadDicomPaths,
    message,
    openKeySlice,
    openSeriesView: openSeriesViewWithHangingProtocol,
    openLayoutView: openLayoutViewWithBackend,
    openPetCtFusion: openPetCtFusionWithBackend,
    openSeriesCompare: openSeriesCompareWithBackend,
    openView: openViewWithHangingProtocol,
    removeSeries: views.removeSeries,
    selectSeries: views.selectSeries,
    selectedSeriesId,
    seriesList,
    setActiveOperation,
    setActiveViewportKey,
    setViewerStage,
    statusToast,
    dismissStatusToast,
    showStatusToast,
    toggleSidebar,
    triggerViewAction,
    viewerFolderSourceMode: viewerRuntime.folderSourceMode,
    viewerPlatform: viewerRuntime.platform,
    viewerStage,
    viewerTabs
  }
}
