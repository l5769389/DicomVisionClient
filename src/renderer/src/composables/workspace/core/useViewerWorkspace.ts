import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import {
  DRAG_ACTION_TYPES,
  STACK_DEFAULT_OPERATION,
  STACK_DRAG_OPERATIONS,
  type ViewOperationType,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import { DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'
import { api } from '../../../services/api'
import {emitViewOperation, ViewOperationInput} from '../../../services/socket'
import {
  createEmptyMprCrosshairs,
  createEmptyMprOrientations,
  createEmptyMprScaleBars,
  isMprViewportKey,
  normalizeCornerInfo
} from '../views/viewerWorkspaceTabs'
import { useViewerWorkspaceConnection } from '../connection/useViewerWorkspaceConnection'
import { useViewerWorkspaceHover } from '../hover/useViewerWorkspaceHover'
import { useViewerWorkspaceViews } from '../views/useViewerWorkspaceViews'
import { viewerRuntime, WEB_SAMPLE_FOLDER_SENTINEL } from '../../../platform/runtime'
import { DEFAULT_PSEUDOCOLOR_PRESET, normalizePseudocolorPresetKey } from '../../../constants/pseudocolor'
import { createDefaultMprMipConfig } from '../../../types/viewer'
import { useUiPreferences } from '../../ui/useUiPreferences'
import { useVolumeConfigSync } from '../volume/useVolumeConfigSync'
import {
  createDefaultVolumeRenderConfig,
  normalizeVolumePresetKey,
  normalizeVolumeRenderConfig
} from '../volume/volumeRenderConfig'
import type {
  CornerInfo,
  CornerInfoResponse,
  ConnectionState,
  FolderSeriesItem,
  MtfAnalyzeRequest,
  MtfAnalyzeResponse,
  MeasurementDraftPoint,
  MeasurementOverlay,
  MeasurementToolType,
  MprCrosshairInteractionPayload,
  MprMipConfig,
  MprMipOperationConfig,
  MprViewportKey,
  ViewImageResponse,
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
  handleMprCrosshair: (payload: MprCrosshairInteractionPayload) => void
  handleMeasurementCreate: (payload: {
    viewportKey: string
    toolType: MeasurementToolType
    points: MeasurementDraftPoint[]
    measurementId?: string
    labelLines?: string[]
  }) => void
  handleMeasurementDelete: (payload: { viewportKey: string; measurementId: string }) => void
  handleTagIndexChange: (payload: { tabKey: string; index: number }) => Promise<void>
  handleMtfClear: (payload?: { mtfId?: string | null }) => void
  handleMtfCommit: (payload: { viewportKey: string; points: MeasurementDraftPoint[]; mtfId?: string }) => Promise<void>
  handleMtfCopy: (payload?: { mtfId?: string | null }) => Promise<boolean>
  handleMtfSelect: (payload: { mtfId: string | null }) => void
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
  triggerViewAction: (payload: { action: 'reset' | 'clearMeasurements' | 'clearMtf' | 'clearAnnotations' | 'resetAll' | 'volumePreset' | 'rotate' | 'pseudocolor' | 'windowPreset' | 'mprMipConfig'; value?: string; config?: MprMipConfig }) => void
  viewerFolderSourceMode: 'desktop-picker' | 'web-prompt' | 'server-sample'
  viewerPlatform: 'desktop' | 'web'
  viewerStage: Ref<HTMLElement | null>
  viewerTabs: Ref<ViewerTabItem[]>
}

export function useViewerWorkspace(): ViewerWorkspaceState {
  const VOLUME_CONFIG_DEBOUNCE_MS = 120
  const MPR_MIP_CONFIG_DEBOUNCE_MS = 120
  const backendOrigin = ref(DESKTOP_DEV_BACKEND_ORIGIN)
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
  const DEFAULT_VIEW_TRANSFORM: ViewTransformInfo = {
    rotationDegrees: 0,
    horFlip: false,
    verFlip: false
  }
  const { selectedPseudocolorKey } = useUiPreferences()

  const selectedSeries = computed(
    () => seriesList.value.find((item) => item.seriesId === selectedSeriesId.value) ?? null
  )
  const activeTab = computed(() => viewerTabs.value.find((item) => item.key === activeTabKey.value) ?? null)
  const hasSelectedSeries = computed(() => Boolean(selectedSeriesId.value))

  let resizeObserver: ResizeObserver | null = null
  let observedViewerStage: HTMLElement | null = null
  let pendingMprMipConfigTimer: ReturnType<typeof window.setTimeout> | null = null
  let pendingMprMipConfigPayload: { viewIds: string[]; config: MprMipConfig } | null = null

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
        Math.abs(point.x - otherPoint.x) < 0.0005 &&
        Math.abs(point.y - otherPoint.y) < 0.0005
      )
    })
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
    if (tab.viewType === 'MPR') {
      return tab.viewportTransformStates?.[viewportKey as MprViewportKey] ?? DEFAULT_VIEW_TRANSFORM
    }
    return tab.transformState ?? DEFAULT_VIEW_TRANSFORM
  }

  function updateTabTransformState(
    tabKey: string,
    transform: ViewTransformInfo,
    viewportKey?: string
  ): void {
    viewerTabs.value = viewerTabs.value.map((item) => {
      if (item.key !== tabKey) {
        return item
      }

      if (item.viewType === 'MPR' && viewportKey && isMprViewportKey(viewportKey)) {
        return {
          ...item,
          viewportTransformStates: {
            ...(item.viewportTransformStates ?? {}),
            [viewportKey]: transform
          }
        }
      }

      return {
        ...item,
        transformState: transform
      }
    })
  }

  function createMprMipOperationConfig(config: MprMipConfig): MprMipOperationConfig {
    if (!config.enabled) {
      return { enabled: false }
    }

    return config
  }

  function emitMprMipConfig(viewIds: string[], config: MprMipConfig): void {
    const mprMipConfig = createMprMipOperationConfig(config)
    viewIds.forEach((viewId) => {
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.mprMipConfig,
        mprMipConfig
      })
    })
  }

  function clearPendingMprMipConfig(): void {
    if (pendingMprMipConfigTimer != null) {
      window.clearTimeout(pendingMprMipConfigTimer)
      pendingMprMipConfigTimer = null
    }
    pendingMprMipConfigPayload = null
  }

  function flushPendingMprMipConfig(): void {
    if (!pendingMprMipConfigPayload) {
      return
    }
    const { viewIds, config } = pendingMprMipConfigPayload
    clearPendingMprMipConfig()
    emitMprMipConfig(viewIds, config)
  }

  function scheduleMprMipConfigEmit(viewIds: string[], config: MprMipConfig): void {
    pendingMprMipConfigPayload = { viewIds, config }
    if (pendingMprMipConfigTimer != null) {
      window.clearTimeout(pendingMprMipConfigTimer)
    }
    pendingMprMipConfigTimer = window.setTimeout(() => {
      flushPendingMprMipConfig()
    }, MPR_MIP_CONFIG_DEBOUNCE_MS)
  }

  function triggerViewAction(payload: { action: 'reset' | 'clearMeasurements' | 'clearMtf' | 'clearAnnotations' | 'resetAll' | 'volumePreset' | 'rotate' | 'pseudocolor' | 'windowPreset' | 'mprMipConfig'; value?: string; config?: MprMipConfig }): void {
    const tab = activeTab.value
    if (!tab) {
      return
    }

    if ((payload.action === 'reset' || payload.action === 'resetAll') && tab.viewType !== 'Stack' && tab.viewType !== '3D' && tab.viewType !== 'MPR') {
      return
    }

    if (payload.action === 'volumePreset' && tab.viewType !== '3D') {
      return
    }

    if (payload.action === 'rotate' && tab.viewType !== 'Stack' && tab.viewType !== 'MPR') {
      return
    }

    if (payload.action === 'pseudocolor' && tab.viewType !== 'Stack' && tab.viewType !== 'MPR') {
      return
    }

    if (payload.action === 'windowPreset' && tab.viewType !== 'Stack' && tab.viewType !== 'MPR') {
      return
    }

    if (payload.action === 'mprMipConfig' && tab.viewType !== 'MPR') {
      return
    }

    if ((payload.action === 'clearMeasurements' || payload.action === 'clearMtf' || payload.action === 'clearAnnotations') && tab.viewType !== 'Stack' && tab.viewType !== 'MPR' && tab.viewType !== '3D') {
      return
    }

    if (!tab.viewId && tab.viewType !== 'MPR') {
      return
    }

    if (tab.viewId) {
      clearPendingVolumeConfig(tab.viewId)
    }

    if (payload.action === 'clearMtf' || payload.action === 'resetAll') {
      clearActiveTabMtf()
      if (payload.action === 'clearMtf') {
        const viewId =
          tab.viewType === 'MPR' ? tab.viewportViewIds?.[activeViewportKey.value as MprViewportKey] ?? '' : tab.viewId
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
      const viewId =
        tab.viewType === 'MPR' ? tab.viewportViewIds?.[activeViewportKey.value as MprViewportKey] ?? '' : tab.viewId
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
      const viewId =
        tab.viewType === 'MPR' ? tab.viewportViewIds?.[activeViewportKey.value as MprViewportKey] ?? '' : tab.viewId
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

    if (payload.action === 'mprMipConfig' && payload.config) {
      const viewIds = Object.values(tab.viewportViewIds ?? {}).filter((viewId): viewId is string => Boolean(viewId))
      if (!viewIds.length) {
        return
      }
      const previousConfig = tab.mprMipConfig ?? createDefaultMprMipConfig()
      const shouldEmitDisabled = previousConfig.enabled && !payload.config.enabled

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
          clearPendingMprMipConfig()
          emitMprMipConfig(viewIds, payload.config)
        }
        return
      }

      scheduleMprMipConfigEmit(viewIds, payload.config)
      return
    }

    if ((payload.action === 'reset' || payload.action === 'resetAll') && tab.viewType === '3D') {
      const defaultConfig = createDefaultVolumeRenderConfig('aaa')
      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              pseudocolorPreset: DEFAULT_PSEUDOCOLOR_PRESET,
              volumePreset: 'volumePreset:aaa',
              volumeRenderConfig: defaultConfig
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
      const viewId =
        tab.viewType === 'MPR' ? tab.viewportViewIds?.[activeViewportKey.value as MprViewportKey] ?? '' : tab.viewId
      if (!viewId) {
        return
      }

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

      updateTabTransformState(tab.key, nextTransform, activeViewportKey.value)
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.transform2d,
        rotationDegrees: nextTransform.rotationDegrees,
        hor_flip: nextTransform.horFlip,
        ver_flip: nextTransform.verFlip
      })
      return
    }

    if (payload.action === 'pseudocolor' && payload.value) {
      const presetKey = normalizePseudocolorPresetKey(payload.value)
      const viewId =
        tab.viewType === 'MPR' ? tab.viewportViewIds?.[activeViewportKey.value as MprViewportKey] ?? '' : tab.viewId
      if (!viewId) {
        return
      }

      viewerTabs.value = viewerTabs.value.map((item) => {
        if (item.key !== tab.key) {
          return item
        }

        if (item.viewType === 'MPR' && isMprViewportKey(activeViewportKey.value)) {
          return {
            ...item,
            viewportPseudocolorPresets: {
              ...(item.viewportPseudocolorPresets ?? {}),
              [activeViewportKey.value]: presetKey
            }
          }
        }

        return {
          ...item,
          pseudocolorPreset: presetKey
        }
      })

      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.pseudocolor,
        pseudocolorPreset: presetKey
      })
      return
    }

    if (payload.action === 'windowPreset' && payload.value) {
      const [wwRaw, wlRaw] = payload.value.split('|')
      const ww = Number.parseFloat(wwRaw)
      const wl = Number.parseFloat(wlRaw)
      const viewId =
        tab.viewType === 'MPR' ? tab.viewportViewIds?.[activeViewportKey.value as MprViewportKey] ?? '' : tab.viewId
      if (!viewId || !Number.isFinite(ww) || !Number.isFinite(wl)) {
        return
      }

      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.window,
        ww,
        wl
      })
      return
    }

    if (payload.action === 'reset' || payload.action === 'resetAll') {
      if (tab.viewType === 'MPR') {
        const viewportKey = activeViewportKey.value as MprViewportKey
        const viewId = tab.viewportViewIds?.[viewportKey] ?? ''
        if (!viewId) {
          return
        }
        clearPendingMprMipConfig()

        viewerTabs.value = viewerTabs.value.map((item) => {
          if (item.key !== tab.key) {
            return item
          }

          return {
            ...item,
            mprCursor: null,
            mprFrame: null,
            mprMipConfig: createDefaultMprMipConfig(),
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
          opType: VIEW_OPERATION_TYPES.reset,
          subOpType: payload.action === 'resetAll' ? 'all' : 'view'
        })
        return
      }

      viewerTabs.value = viewerTabs.value.map((item) =>
        item.key === tab.key
          ? {
              ...item,
              pseudocolorPreset: DEFAULT_PSEUDOCOLOR_PRESET
            }
          : item
      )

      emitViewOperation({
        viewId: tab.viewId,
        opType: VIEW_OPERATION_TYPES.reset,
        subOpType: payload.action === 'resetAll' ? 'all' : 'view'
      })
      return
    }

    if (tab.viewType === 'MPR') {
      const viewportKey = activeViewportKey.value as MprViewportKey
      const viewId = tab.viewportViewIds?.[viewportKey] ?? ''
      if (!viewId) {
        return
      }
      clearPendingMprMipConfig()

      viewerTabs.value = viewerTabs.value.map((item) => {
        if (item.key !== tab.key) {
          return item
        }

        return {
          ...item,
          mprCursor: null,
          mprFrame: null,
          mprMipConfig: createDefaultMprMipConfig(),
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
    payload: ViewOperationInput
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

    const operationPayload: ViewOperationInput = {
      opType: VIEW_OPERATION_TYPES.measurement,
      measurementId: payload.measurementId,
      subOpType: payload.toolType,
      actionType: payload.phase,
      viewportKey: payload.viewportKey,
      points: payload.points
    }

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

  function resolveViewIdForViewport(viewportKey: string): string | null {
    const tab = activeTab.value
    if (!tab) {
      return null
    }

    if (tab.viewType === 'MPR') {
      if (!isMprViewportKey(viewportKey)) {
        return null
      }
      return tab.viewportViewIds?.[viewportKey] ?? null
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
    if (!tab || (tab.viewType !== 'Stack' && tab.viewType !== 'MPR')) {
      return
    }

    const viewId = resolveViewIdForViewport(payload.viewportKey)
    if (!viewId) {
      return
    }

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
      const requestPayload: MtfAnalyzeRequest = {
        viewId,
        viewportKey: payload.viewportKey,
        points: payload.points,
        qaTask: 'mtf'
      }
      const { data } = await api.post<MtfAnalyzeResponse>('/view/mtf/analyze', requestPayload)

      updateActiveTabMtfState((item) =>
        updateMtfItemCollection(
          item,
          {
            mtfId,
            viewportKey: data.viewportKey,
            points: data.points,
            status: 'ready',
            metrics: data.metrics,
            curve: data.curve,
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

  function handleMprCrosshair(payload: MprCrosshairInteractionPayload): void {
    emitMprViewOperation(payload.viewportKey, {
      opType: payload.mode === 'rotate' ? VIEW_OPERATION_TYPES.mprOblique : VIEW_OPERATION_TYPES.crosshair,
      actionType: payload.phase,
      x: payload.x,
      y: payload.y,
      line: payload.line
    })
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
      return [...list, nextOverlay]
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
    if (tab && (tab.viewType === 'Stack' || tab.viewType === 'MPR') && payload.measurementId?.trim()) {
      viewerTabs.value = viewerTabs.value.map((item) => {
        if (item.key !== tab.key) {
          return item
        }

        if (item.viewType === 'MPR') {
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
    if (!tab || (tab.viewType !== 'Stack' && tab.viewType !== 'MPR') || !payload.measurementId) {
      return
    }

    viewerTabs.value = viewerTabs.value.map((item) => {
      if (item.key !== tab.key) {
        return item
      }

      if (item.viewType === 'MPR') {
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

  function handleMeasurementDraft(payload: {
    viewportKey: string
    toolType: MeasurementToolType
    phase: 'start' | 'move' | 'end'
    points: MeasurementDraftPoint[]
  }): void {
    emitMeasurementOperation(payload)
  }

  function clearActiveTabMtf(): void {
    updateActiveTabMtfState((item) => ({
      ...item,
      mtfState: null
    }))
  }

  async function chooseFolder(): Promise<void> {
    const picked = await viewerRuntime.chooseFolder()
    if (!picked) {
      return
    }

    await loadFolderSeries(picked)
  }

  async function loadFolderSeries(path: string): Promise<void> {
    isLoadingFolder.value = true

    try {
      const { data } =
        path === WEB_SAMPLE_FOLDER_SENTINEL
          ? await api.post<{ seriesList?: FolderSeriesItem[]; samplePath?: string }>('/dicom/loadSample')
          : await api.post<{ seriesList?: FolderSeriesItem[] }>('/dicom/loadFolder', {
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
    void (async () => {
      const resolvedBackendOrigin = await viewerRuntime.getBackendOrigin()
      if (resolvedBackendOrigin) {
        backendOrigin.value = resolvedBackendOrigin
      }
      connectBackend()
    })()
  })

  onBeforeUnmount(() => {
    flushAllPendingVolumeConfig()
    flushPendingMprMipConfig()
    cleanupHover()
    cleanupSocketListeners()
    if (resizeObserver && observedViewerStage) {
      resizeObserver.unobserve(observedViewerStage)
    }
    resizeObserver?.disconnect()
  })

  async function handleTagIndexChange(payload: { tabKey: string; index: number }): Promise<void> {
    await views.setTagTabIndex(payload.tabKey, payload.index)
  }

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
    handleMeasurementDelete,
    handleMeasurementDraft,
    handleTagIndexChange,
    handleMtfClear,
    handleMtfCommit,
    handleMtfCopy,
    handleMtfSelect,
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
    viewerFolderSourceMode: viewerRuntime.folderSourceMode,
    viewerPlatform: viewerRuntime.platform,
    viewerStage,
    viewerTabs
  }
}
