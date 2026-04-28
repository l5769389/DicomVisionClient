import { nextTick, type ComputedRef, type Ref } from 'vue'
import { VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { api } from '../../../services/api'
import {
  bindView,
  bindViewSilently,
  bindViewSilentlyWithAck,
  emitViewOperation,
  emitViewOperationWithAck
} from '../../../services/socket'
import {
  buildTabTitle,
  createEmptyCornerInfo,
  createEmptyMprCornerInfos,
  createEmptyMprCrosshairs,
  createEmptyMprImages,
  createEmptyMprOrientations,
  createEmptyMprPlanes,
  createEmptyMprPseudocolorPresets,
  createEmptyMprScaleBars,
  createEmptyMprSliceLabels,
  createEmptyMprTransformStates,
  createEmptyMprViewIds,
  createEmptyOrientationInfo,
  createDefaultTransformInfo,
  createTab,
  isMprViewportKey,
  mergeCornerInfo,
  normalizeCornerInfo,
  normalizeMprCursorInfo,
  normalizeMprFrameInfo,
  normalizeMprPlaneInfo,
  normalizeOrientationInfo,
  normalizeScaleBarInfo
} from './viewerWorkspaceTabs'
import { getDistinctFourDPhaseSeriesIds, resolveFourDPhaseSeriesId } from './fourDPhaseMetadata'
import {
  FourDPhaseRenderTracker,
  MPR_VIEWPORT_KEYS,
  clampFourDPhaseIndex,
  countDistinctFourDPhaseSeriesIds,
  createFourDPhaseCache,
  createFourDPhaseCacheSeed,
  findFourDPhaseViewportByViewId,
  getFourDPhaseBackendViewIds,
  getFourDPhaseByKey,
  getFourDPhaseDisplayState,
  getFourDPhaseItems,
  getFourDPhaseKey,
  getFourDPhaseSeriesId,
  hasCompleteMprViewportImages,
  hasCompleteMprViewportViewIds,
  hasFourDPhaseImage,
  hasReadyFourDPhaseCache,
  isFourDPhaseDisplayed,
  resolveFourDInitialPhaseIndex
} from './fourDPhaseState'
import {
  mergeFourDManifestIntoSeriesList,
  normalizeFourDManifestResponse,
  resolveFourDPhasePlan
} from './fourDPhaseManifest'
import { normalizePseudocolorPresetKey } from '../../../constants/pseudocolor'
import { createDefaultMprMipConfig, isFourDSeriesItem, normalizeMprMipConfig } from '../../../types/viewer'
import {
  createDefaultVolumeRenderConfig,
  normalizeVolumePresetKey,
  normalizeVolumeRenderConfig
} from '../volume/volumeRenderConfig'
import { resolveMprCrosshairForImageUpdate, type ActiveMprCrosshairDragLock } from './mprInteractionGuard'
import { useUiPreferences } from '../../ui/useUiPreferences'
import type {
  BackendCreateViewType,
  CornerInfo,
  DicomTagsResponse,
  FolderSeriesItem,
  FourDPhaseCacheItem,
  FourDPhaseItem,
  FourDPhasesResponse,
  MeasurementOverlay,
  MprViewportKey,
  OperationAcceptedResponse,
  ViewCreateResponse,
  ViewImageResponse,
  ViewerTabItem,
  ViewType
} from '../../../types/viewer'

interface ViewerWorkspaceViewsOptions {
  activeTabKey: Ref<string>
  activeViewportKey: Ref<string>
  activeMprCrosshairDragLock: Ref<ActiveMprCrosshairDragLock | null>
  isViewLoading: Ref<boolean>
  message: Ref<string>
  onBeforeCloseTab?: (tab: ViewerTabItem) => void
  selectedSeries: ComputedRef<FolderSeriesItem | null>
  selectedSeriesId: Ref<string>
  seriesCornerInfoMap: Ref<Record<string, CornerInfo>>
  seriesList: Ref<FolderSeriesItem[]>
  viewportElements: Ref<Partial<Record<MprViewportKey, HTMLElement | null>>>
  viewerStage: Ref<HTMLElement | null>
  viewerTabs: Ref<ViewerTabItem[]>
  clearPendingVolumeConfig: (viewId: string) => void
  ensureSeriesCornerInfo: (seriesId: string) => Promise<CornerInfo>
  stripHoverCornerInfo: (cornerInfo: CornerInfo) => CornerInfo
  withHoverCornerInfo: (cornerInfo: CornerInfo, row?: number | null, col?: number | null) => CornerInfo
}

interface SetFourDPhaseOptions {
  interactive?: boolean
}

interface MprViewSizeUpdate {
  viewportKey: MprViewportKey
  viewId: string
  size: {
    width: number
    height: number
  }
}

export function useViewerWorkspaceViews(options: ViewerWorkspaceViewsOptions) {
  const viewSizeCache = new Map<string, string>()
  const queuedFourDPreloadTabKeys = new Set<string>()
  const fourDPreloadRequests = new Map<string, Promise<void>>()
  const fourDPhaseSwitchInFlightTabKeys = new Set<string>()
  const queuedFourDPhaseSwitches = new Map<string, { phaseIndex: number; phaseOptions: SetFourDPhaseOptions }>()
  const fourDManifestRequests = new Map<string, Promise<FourDPhasesResponse | null>>()
  const fourDPhaseRenderTracker = new FourDPhaseRenderTracker()
  const { selectedPseudocolorKey } = useUiPreferences()

  function findTab(seriesId: string, viewType?: ViewType): ViewerTabItem | undefined {
    return options.viewerTabs.value.find((item) =>
      viewType ? item.seriesId === seriesId && item.viewType === viewType : item.seriesId === seriesId
    )
  }

  function findTabByViewId(viewId: string): ViewerTabItem | undefined {
    return options.viewerTabs.value.find(
      (item) =>
        item.viewId === viewId ||
        Object.values(item.viewportViewIds ?? {}).includes(viewId) ||
        Boolean(findFourDPhaseViewportByViewId(item, viewId))
    )
  }

  function ensureTab(seriesId: string, viewType: ViewType): string {
    const existingTab = findTab(seriesId, viewType)
    if (existingTab) {
      options.activeTabKey.value = existingTab.key
      return existingTab.key
    }

    const series = options.seriesList.value.find((item) => item.seriesId === seriesId)
    if (!series) {
      return ''
    }

    const tab = createTab(series, viewType)
    options.viewerTabs.value = [...options.viewerTabs.value, tab]
    options.activeTabKey.value = tab.key
    return tab.key
  }

  function resolveInitialTagIndex(seriesId: string): number {
    const stackTab =
      options.viewerTabs.value.find((item) => item.key === options.activeTabKey.value && item.seriesId === seriesId && item.viewType === 'Stack') ??
      options.viewerTabs.value.find((item) => item.seriesId === seriesId && item.viewType === 'Stack')
    if (!stackTab?.sliceLabel) {
      return 0
    }

    const [current] = stackTab.sliceLabel.split('/').map((item) => Number.parseInt(item.trim(), 10))
    if (!Number.isFinite(current) || current <= 0) {
      return 0
    }
    return current - 1
  }

  async function loadTagTab(tabKey: string, index: number): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== 'Tag') {
      return
    }

    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tabKey
        ? {
            ...item,
            tagIsLoading: true,
            tagLoadError: null
          }
        : item
    )

    try {
      const { data } = await api.post<DicomTagsResponse>('/dicom/tags', {
        seriesId: tab.seriesId,
        index
      })

      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === tabKey
          ? {
              ...item,
              tagIndex: data.index,
              tagTotal: data.total,
              tagItems: data.items,
              tagFilePath: data.filePath ?? null,
              tagSopInstanceUid: data.sopInstanceUid ?? null,
              tagInstanceNumber: data.instanceNumber ?? null,
              tagIsLoading: false,
              tagLoadError: null
            }
          : item
      )
      options.message.value = ''
    } catch (error) {
      const fallbackMessage =
        typeof error === 'object' && error != null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'DICOM Tag 加载失败。'

      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === tabKey
          ? {
              ...item,
              tagIsLoading: false,
              tagLoadError: fallbackMessage
            }
          : item
      )
      options.message.value = fallbackMessage
      console.error(error)
    }
  }

  async function setTagTabIndex(tabKey: string, index: number): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== 'Tag') {
      return
    }

    const total = Math.max(1, tab.tagTotal ?? 1)
    const nextIndex = Math.max(0, Math.min(index, total - 1))
    await loadTagTab(tabKey, nextIndex)
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

  async function createMprViewportViews(seriesId: string, viewGroupKey?: string): Promise<Record<MprViewportKey, string>> {
    const responses = await Promise.all(
      MPR_VIEWPORT_KEYS.map(async (viewportKey) => {
        const { data } = await api.post<ViewCreateResponse>('/view/create', {
          seriesId,
          viewType: getCreateViewTypeForViewport(viewportKey),
          ...(viewGroupKey ? { viewGroupKey } : {})
        })
        return [viewportKey, data.viewId] as const
      })
    )

    return responses.reduce(
      (accumulator, [viewportKey, viewId]) => ({
        ...accumulator,
        [viewportKey]: viewId
      }),
      createEmptyMprViewIds()
    )
  }

  function createFourDViewGroupKey(tab: ViewerTabItem, phaseIndex: number): string {
    return `4d:${tab.key}:${getFourDPhaseKey(phaseIndex)}`
  }

  function getFourDMprStateSourceViewId(tab: ViewerTabItem): string {
    const activeViewport = isMprViewportKey(options.activeViewportKey.value) ? options.activeViewportKey.value : 'mpr-ax'
    return tab.viewportViewIds?.[activeViewport] || MPR_VIEWPORT_KEYS.map((viewportKey) => tab.viewportViewIds?.[viewportKey] ?? '').find(Boolean) || ''
  }

  function resolveFourDMprStateSyncTargetViewId(
    viewIds: Partial<Record<MprViewportKey, string>>,
    sourceViewId: string
  ): string {
    const targetViewId = viewIds['mpr-ax'] || MPR_VIEWPORT_KEYS.map((viewportKey) => viewIds[viewportKey] ?? '').find(Boolean) || ''
    if (!targetViewId || !sourceViewId || Object.values(viewIds).includes(sourceViewId)) {
      return ''
    }
    return targetViewId
  }

  async function emitFourDMprStateSync(
    viewIds: Partial<Record<MprViewportKey, string>>,
    sourceViewId: string
  ): Promise<boolean> {
    const targetViewId = resolveFourDMprStateSyncTargetViewId(viewIds, sourceViewId)
    if (!targetViewId) {
      return false
    }
    return emitViewOperationWithAck({
      viewId: targetViewId,
      opType: VIEW_OPERATION_TYPES.mprStateSync,
      sourceViewId
    })
  }

  function bindMprViewIds(viewIds: Partial<Record<MprViewportKey, string>>, render = true): void {
    Object.values(viewIds).forEach((viewId) => {
      if (viewId) {
        if (render) {
          bindView(viewId)
        } else {
          bindViewSilently(viewId)
        }
      }
    })
  }

  async function bindMprViewIdsSilentlyWithAck(viewIds: Partial<Record<MprViewportKey, string>>): Promise<void> {
    await Promise.all(
      Object.values(viewIds).map(async (viewId) => {
        if (viewId) {
          await bindViewSilentlyWithAck(viewId)
        }
      })
    )
  }

  function getTabViewportPseudocolorPreset(tab: ViewerTabItem, viewportKey: MprViewportKey): string {
    return normalizePseudocolorPresetKey(tab.viewportPseudocolorPresets?.[viewportKey] ?? tab.pseudocolorPreset)
  }

  async function emitMprPseudocolorOperations(
    viewIds: Partial<Record<MprViewportKey, string>>,
    tab: ViewerTabItem
  ): Promise<void> {
    const entries = Object.entries(viewIds) as [MprViewportKey, string][]
    await Promise.all(
      entries.map(async ([viewportKey, viewId]) => {
        if (!viewId) {
          return
        }
        await emitViewOperationWithAck({
          viewId,
          opType: VIEW_OPERATION_TYPES.pseudocolor,
          pseudocolorPreset: getTabViewportPseudocolorPreset(tab, viewportKey)
        })
      })
    )
  }

  function resolveMprViewportElement(viewportKey: MprViewportKey): HTMLElement | null {
    const cachedElement = options.viewportElements.value[viewportKey] ?? null
    if (cachedElement?.isConnected) {
      return cachedElement
    }

    return (
      options.viewerStage.value?.querySelector<HTMLElement>(`[data-active-render-surface][data-viewport-key="${viewportKey}"]`) ??
      options.viewerStage.value?.querySelector<HTMLElement>(`[data-viewport-key="${viewportKey}"]`) ??
      null
    )
  }

  function getViewportSize(element: HTMLElement | null = options.viewerStage.value): { width: number; height: number } | null {
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

    return { width: nextWidth, height: nextHeight }
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

  function rebindOpenViews(): void {
    options.viewerTabs.value.forEach((tab) => {
      if (tab.viewId) {
        bindView(tab.viewId)
      }
      Object.values(tab.viewportViewIds ?? {}).forEach((viewId) => {
        if (viewId) {
          bindView(viewId)
        }
      })
      getFourDPhaseBackendViewIds(tab).forEach((viewId) => {
        bindView(viewId)
      })
    })
  }

  async function ensureFourDPhaseCornerInfos(
    phaseItems: FourDPhaseItem[],
    fallbackSeriesId?: string | null
  ): Promise<void> {
    const seriesIds = getDistinctFourDPhaseSeriesIds(phaseItems, fallbackSeriesId)
    if (!seriesIds.length) {
      return
    }
    const results = await Promise.allSettled(seriesIds.map(async (seriesId) => options.ensureSeriesCornerInfo(seriesId)))
    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error(result.reason)
      }
    })
  }

  async function loadFourDManifest(seriesId: string): Promise<FourDPhasesResponse | null> {
    const existingRequest = fourDManifestRequests.get(seriesId)
    if (existingRequest) {
      return existingRequest
    }

    const request = (async () => {
      try {
        const { data } = await api.post<FourDPhasesResponse>('/dicom/fourD/phases', { seriesId })
        const manifest = normalizeFourDManifestResponse(data, seriesId)
        if (!manifest) {
          return null
        }
        options.seriesList.value = mergeFourDManifestIntoSeriesList(options.seriesList.value, seriesId, manifest)
        return manifest
      } catch (error) {
        console.error(error)
        return null
      }
    })()

    fourDManifestRequests.set(seriesId, request)
    try {
      return await request
    } finally {
      fourDManifestRequests.delete(seriesId)
    }
  }

  async function resolveFourDPhaseItems(seriesId: string): Promise<{
    phaseCount: number
    phaseItems: FourDPhaseItem[]
    hasBackendManifest: boolean
  }> {
    const series = options.seriesList.value.find((item) => item.seriesId === seriesId)
    const manifest = await loadFourDManifest(seriesId)
    const refreshedSeries = options.seriesList.value.find((item) => item.seriesId === seriesId) ?? series
    return resolveFourDPhasePlan(refreshedSeries, manifest)
  }

  function updateFourDTab(
    tabKey: string,
    series: FolderSeriesItem,
    phaseCount: number,
    phaseItems: FourDPhaseItem[],
    preferredPhaseIndex?: number
  ): void {
    const hasPreviewImage = phaseItems.some(hasFourDPhaseImage)
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.key !== tabKey) {
        return item
      }

      const maxPhaseIndex = Math.max(0, phaseItems.length - 1)
      const existingPhaseIndex = Number.isFinite(item.fourDPhaseIndex)
        ? Math.trunc(item.fourDPhaseIndex ?? 0)
        : 0
      const currentPhaseIndex = Number.isFinite(preferredPhaseIndex)
        ? Math.trunc(preferredPhaseIndex ?? 0)
        : existingPhaseIndex
      const nextPhaseIndex = Math.max(0, Math.min(currentPhaseIndex, maxPhaseIndex))
      const activePhaseSeriesId = phaseItems[nextPhaseIndex]?.seriesId ?? series.seriesId

      return {
        ...item,
        viewType: '4D',
        title: buildTabTitle(series, '4D', item.seriesId),
        seriesTitle: series.seriesDescription || series.seriesInstanceUid || series.seriesId,
        viewId: '',
        imageSrc: '',
        sliceLabel: '',
        windowLabel: '',
        cornerInfo: options.seriesCornerInfoMap.value[activePhaseSeriesId] ?? createEmptyCornerInfo(),
        orientation: createEmptyOrientationInfo(),
        fourDPhaseIndex: nextPhaseIndex,
        fourDPhaseCount: phaseCount,
        fourDPhaseItems: phaseItems,
        fourDPlaybackFps: item.fourDPlaybackFps ?? 2,
        fourDPhaseViewIds: item.fourDPhaseViewIds ?? {},
        fourDPhaseCache: createFourDPhaseCache(phaseItems, item.fourDPhaseCache),
        fourDIsPlaying: item.fourDIsPlaying ?? false,
        fourDIsPreloading: item.fourDIsPreloading ?? false
      }
    })
    options.message.value = phaseItems.length > 0 || hasPreviewImage ? '' : '4D phase metadata is not available for this series.'
  }

  async function ensureFourDPhaseViewIds(tabKey: string, phaseIndex: number): Promise<Record<MprViewportKey, string> | null> {
    let tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== '4D') {
      return null
    }

    let normalizedPhaseIndex = clampFourDPhaseIndex(tab, phaseIndex)
    const currentPhaseItems = getFourDPhaseItems(tab)
    if (currentPhaseItems.length > 1 && countDistinctFourDPhaseSeriesIds(currentPhaseItems) <= 1) {
      const tabSeriesId = tab.seriesId
      const series = options.seriesList.value.find((item) => item.seriesId === tabSeriesId)
      if (series) {
        const activePhaseIndex = clampFourDPhaseIndex(tab, tab.fourDPhaseIndex ?? 0)
        const { phaseCount, phaseItems } = await resolveFourDPhaseItems(tabSeriesId)
        updateFourDTab(tabKey, series, phaseCount, phaseItems, activePhaseIndex)
        tab = options.viewerTabs.value.find((item) => item.key === tabKey)
        if (!tab || tab.viewType !== '4D') {
          return null
        }
        normalizedPhaseIndex = clampFourDPhaseIndex(tab, phaseIndex)
      }
    }

    const phaseKey = getFourDPhaseKey(normalizedPhaseIndex)
    const existingViewIds = tab.fourDPhaseViewIds?.[phaseKey]
    if (hasCompleteMprViewportViewIds(existingViewIds)) {
      return existingViewIds
    }

    const phaseSeriesId = getFourDPhaseSeriesId(tab, normalizedPhaseIndex)
    if (!phaseSeriesId) {
      return null
    }

    const viewIds = await createMprViewportViews(phaseSeriesId, createFourDViewGroupKey(tab, normalizedPhaseIndex))
    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tabKey && item.viewType === '4D'
        ? {
            ...item,
            fourDPhaseViewIds: {
              ...(item.fourDPhaseViewIds ?? {}),
              [phaseKey]: viewIds
            }
          }
        : item
    )
    return viewIds
  }

  async function applyFourDPhase(tabKey: string, phaseIndex: number, phaseOptions: SetFourDPhaseOptions = {}): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== '4D') {
      return
    }

    const interactive = phaseOptions.interactive ?? true
    const normalizedPhaseIndex = clampFourDPhaseIndex(tab, phaseIndex)
    await options.ensureSeriesCornerInfo(getFourDPhaseSeriesId(tab, normalizedPhaseIndex)).catch((error) => {
      console.error(error)
      return createEmptyCornerInfo()
    })
    const sourceViewId = getFourDMprStateSourceViewId(tab)
    const phaseKey = getFourDPhaseKey(normalizedPhaseIndex)
    const existingViewIds = tab.fourDPhaseViewIds?.[phaseKey]
    const hasExistingViewIds = hasCompleteMprViewportViewIds(existingViewIds)
    const hasReadyPhaseDisplay = hasReadyFourDPhaseCache(tab.fourDPhaseCache?.[phaseKey])
    const shouldDeferDisplaySwitch = interactive && (!hasExistingViewIds || !hasReadyPhaseDisplay)
    if (shouldDeferDisplaySwitch) {
      markFourDPhaseLoading(tabKey, normalizedPhaseIndex)
    }

    const displayViewIds = hasExistingViewIds
      ? existingViewIds
      : createEmptyMprViewIds()
    const displayState = getFourDPhaseDisplayState(tab, normalizedPhaseIndex, options.seriesCornerInfoMap.value)

    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tabKey && item.viewType === '4D'
        ? {
            ...item,
            fourDPhaseIndex: normalizedPhaseIndex,
            ...(shouldDeferDisplaySwitch
              ? {}
              : {
                  viewportViewIds: displayViewIds,
                  ...displayState
                })
          }
        : item
    )

    if (!interactive) {
      bindMprViewIds(displayViewIds)
      return
    }

    if (hasExistingViewIds && hasReadyPhaseDisplay) {
      bindMprViewIds(displayViewIds, false)
      if (!isMprViewportKey(options.activeViewportKey.value)) {
        options.activeViewportKey.value = 'mpr-ax'
      }
      return
    }

    const viewIds = await ensureFourDPhaseViewIds(tabKey, normalizedPhaseIndex)
    if (!viewIds) {
      return
    }

    const refreshedTab = options.viewerTabs.value.find((item) => item.key === tabKey)
    const refreshedDisplayState =
      refreshedTab?.viewType === '4D'
        ? getFourDPhaseDisplayState(refreshedTab, normalizedPhaseIndex, options.seriesCornerInfoMap.value)
        : displayState
    const pseudocolorSourceTab =
      refreshedTab?.viewType === '4D'
        ? ({ ...refreshedTab, ...refreshedDisplayState } as ViewerTabItem)
        : tab

    if (!isMprViewportKey(options.activeViewportKey.value)) {
      options.activeViewportKey.value = 'mpr-ax'
    }

    await nextTick()
    await bindMprViewIdsSilentlyWithAck(viewIds)
    await renderFourDPhaseSizeUpdatesAndWait(tabKey, phaseKey, viewIds)
    await emitMprPseudocolorOperations(viewIds, pseudocolorSourceTab)
    const syncTargetViewId = resolveFourDMprStateSyncTargetViewId(viewIds, sourceViewId)
    const syncRenderWait = syncTargetViewId
      ? fourDPhaseRenderTracker.waitForRender(tabKey, phaseKey, viewIds)
      : Promise.resolve()
    const didSyncState = await emitFourDMprStateSync(viewIds, sourceViewId)
    if (didSyncState) {
      await syncRenderWait
    }

    const renderedTab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (renderedTab?.viewType === '4D') {
      const renderedCache = renderedTab.fourDPhaseCache?.[phaseKey]
      if (!hasExistingViewIds && !hasCompleteMprViewportImages(renderedCache?.viewportImages)) {
        await renderFourDPhaseSizeUpdatesAndWait(tabKey, phaseKey, viewIds, true)
      }
    }

    const finalRenderedTab = options.viewerTabs.value.find((item) => item.key === tabKey)
    const renderedDisplayState =
      finalRenderedTab?.viewType === '4D'
        ? getFourDPhaseDisplayState(finalRenderedTab, normalizedPhaseIndex, options.seriesCornerInfoMap.value)
        : refreshedDisplayState

    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tabKey && item.viewType === '4D'
        ? {
            ...item,
            fourDPhaseIndex: normalizedPhaseIndex,
            viewportViewIds: viewIds,
            ...renderedDisplayState
          }
        : item
    )
  }

  async function setFourDPhase(tabKey: string, phaseIndex: number, phaseOptions: SetFourDPhaseOptions = {}): Promise<void> {
    queuedFourDPhaseSwitches.set(tabKey, {
      phaseIndex,
      phaseOptions
    })

    if (fourDPhaseSwitchInFlightTabKeys.has(tabKey)) {
      return
    }

    fourDPhaseSwitchInFlightTabKeys.add(tabKey)
    try {
      while (true) {
        const nextSwitch = queuedFourDPhaseSwitches.get(tabKey)
        if (!nextSwitch) {
          return
        }
        queuedFourDPhaseSwitches.delete(tabKey)
        await applyFourDPhase(tabKey, nextSwitch.phaseIndex, nextSwitch.phaseOptions)
      }
    } finally {
      fourDPhaseSwitchInFlightTabKeys.delete(tabKey)
    }
  }

  function markFourDPhaseLoading(tabKey: string, phaseIndex: number): void {
    const phaseKey = getFourDPhaseKey(phaseIndex)
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.key !== tabKey || item.viewType !== '4D') {
        return item
      }

      const phase = getFourDPhaseItems(item)[phaseIndex]
      const existingPhaseCache = item.fourDPhaseCache?.[phaseKey]
      const nextPhaseCache = createFourDPhaseCacheSeed(phase, existingPhaseCache)

      return {
        ...item,
        fourDPhaseCache: {
          ...(item.fourDPhaseCache ?? {}),
          [phaseKey]: {
            ...nextPhaseCache,
            status: nextPhaseCache.status === 'ready' ? 'ready' : 'loading'
          }
        }
      }
    })
  }

  function invalidateFourDMprState(tabKey: string): void {
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.key !== tabKey || item.viewType !== '4D') {
        return item
      }

      const activePhaseKey = getFourDPhaseKey(clampFourDPhaseIndex(item, item.fourDPhaseIndex ?? 0))
      const nextCache = Object.entries(item.fourDPhaseCache ?? {}).reduce<Record<string, FourDPhaseCacheItem>>(
        (accumulator, [phaseKey, cache]) => {
          accumulator[phaseKey] =
            phaseKey === activePhaseKey || cache.status === 'error'
              ? cache
              : {
                  ...cache,
                  status: 'pending'
                }
          return accumulator
        },
        {}
      )

      return {
        ...item,
        fourDPhaseCache: nextCache
      }
    })
  }

  async function runPreloadFourDPhases(tabKey: string): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== '4D') {
      return
    }

    const phaseItems = getFourDPhaseItems(tab)
    const preloadSourceViewId = getFourDMprStateSourceViewId(tab)
    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tabKey && item.viewType === '4D'
        ? {
            ...item,
            fourDIsPreloading: true,
            fourDPhaseCache: createFourDPhaseCache(phaseItems, item.fourDPhaseCache)
          }
        : item
    )

    try {
      await ensureFourDPhaseCornerInfos(phaseItems, tab.seriesId)
      for (let phaseIndex = 0; phaseIndex < phaseItems.length; phaseIndex += 1) {
        const currentTab = options.viewerTabs.value.find((item) => item.key === tabKey)
        if (!currentTab || currentTab.viewType !== '4D') {
          return
        }

        const sourceViewId = getFourDMprStateSourceViewId(currentTab) || preloadSourceViewId
        const phaseKey = getFourDPhaseKey(phaseIndex)
        const currentCache = currentTab.fourDPhaseCache?.[phaseKey]
        const existingViewIds = currentTab.fourDPhaseViewIds?.[phaseKey]
        const hasExistingViewIds = hasCompleteMprViewportViewIds(existingViewIds)
        const hasReadyPhaseDisplay = hasReadyFourDPhaseCache(currentCache)

        if (hasExistingViewIds && hasReadyPhaseDisplay) {
          await bindMprViewIdsSilentlyWithAck(existingViewIds)
          continue
        }

        if (!hasReadyPhaseDisplay) {
          markFourDPhaseLoading(tabKey, phaseIndex)
        }

        const viewIds = await ensureFourDPhaseViewIds(tabKey, phaseIndex)
        if (!viewIds) {
          continue
        }

        await nextTick()
        await bindMprViewIdsSilentlyWithAck(viewIds)
        await renderFourDPhaseSizeUpdatesAndWait(tabKey, phaseKey, viewIds)
        await emitMprPseudocolorOperations(viewIds, currentTab)
        const syncTargetViewId = resolveFourDMprStateSyncTargetViewId(viewIds, sourceViewId)
        const syncRenderWait = syncTargetViewId
          ? fourDPhaseRenderTracker.waitForRender(tabKey, phaseKey, viewIds)
          : Promise.resolve()
        const didSyncState = await emitFourDMprStateSync(viewIds, sourceViewId)
        if (didSyncState) {
          await syncRenderWait
        }

        const refreshedTab = options.viewerTabs.value.find((item) => item.key === tabKey)
        const refreshedCache = refreshedTab?.viewType === '4D' ? refreshedTab.fourDPhaseCache?.[phaseKey] : null
        if (!hasCompleteMprViewportImages(refreshedCache?.viewportImages)) {
          await renderFourDPhaseSizeUpdatesAndWait(tabKey, phaseKey, viewIds, true)
        }
      }
    } finally {
      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === tabKey && item.viewType === '4D'
          ? {
              ...item,
              fourDIsPreloading: false
            }
          : item
      )
    }
  }

  async function preloadFourDPhases(tabKey: string): Promise<void> {
    const existingRequest = fourDPreloadRequests.get(tabKey)
    if (existingRequest) {
      queuedFourDPreloadTabKeys.add(tabKey)
      await existingRequest
      return
    }

    const request = runPreloadFourDPhases(tabKey)
    fourDPreloadRequests.set(tabKey, request)
    try {
      await request
    } finally {
      fourDPreloadRequests.delete(tabKey)
    }

    if (queuedFourDPreloadTabKeys.delete(tabKey)) {
      await preloadFourDPhases(tabKey)
    }
  }

  function updateTabImage(tabKey: string, payload: Partial<ViewImageResponse>, imageBinary: ArrayBuffer | Uint8Array): void {
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
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
      const fourDViewportMatch = item.viewType === '4D' ? findFourDPhaseViewportByViewId(item, payload.viewId) : null
      const metadataSeriesId =
        item.viewType === '4D' && fourDViewportMatch
          ? resolveFourDPhaseSeriesId(item, fourDViewportMatch.phaseKey)
          : item.seriesId
      const seriesCornerInfo =
        options.seriesCornerInfoMap.value[metadataSeriesId] ??
        options.seriesCornerInfoMap.value[item.seriesId] ??
        createEmptyCornerInfo()
      const sliceCornerInfo = options.stripHoverCornerInfo(normalizeCornerInfo(payload.cornerInfo))
      const orientationInfo = normalizeOrientationInfo(payload.orientation)
      const transformState = payload.transform ?? createDefaultTransformInfo()
      const pseudocolorPreset = normalizePseudocolorPresetKey(payload.color?.pseudocolorPreset ?? item.pseudocolorPreset)
      const mprMipConfig = normalizeMprMipConfig(payload.mprMipConfig, item.mprMipConfig ?? createDefaultMprMipConfig())
      const mprCursor = normalizeMprCursorInfo(payload.mprCursor ?? ((payload as { mpr_cursor?: unknown }).mpr_cursor ?? null))
      const mprFrame = normalizeMprFrameInfo(payload.mprFrame ?? ((payload as { mpr_frame?: unknown }).mpr_frame ?? null))
      const mprPlane = normalizeMprPlaneInfo(payload.mprPlane ?? ((payload as { mpr_plane?: unknown }).mpr_plane ?? null))
      const mprCrosshair = payload.mpr_crosshair ?? ((payload as { mprCrosshair?: ViewImageResponse['mpr_crosshair'] }).mprCrosshair ?? null)
      const scaleBar = normalizeScaleBarInfo(payload.scaleBar ?? ((payload as { scale_bar?: unknown }).scale_bar ?? null))
      const volumePreset = payload.volumePreset ? `volumePreset:${normalizeVolumePresetKey(payload.volumePreset)}` : item.volumePreset
      const volumeRenderConfig = payload.volumeConfig
        ? normalizeVolumeRenderConfig(payload.volumeConfig, payload.volumePreset ?? item.volumePreset)
        : item.volumeRenderConfig

      const currentViewportKey = Object.entries(item.viewportViewIds ?? {}).find(([, viewId]) => viewId === payload.viewId)?.[0] as
        | MprViewportKey
        | undefined
      const viewportKey = currentViewportKey ?? fourDViewportMatch?.viewportKey
      if (viewportKey && (item.viewType === 'MPR' || item.viewType === '4D')) {
        const currentViewportImage = item.viewportImages?.[viewportKey]
        if (currentViewportKey && currentViewportImage?.startsWith('blob:')) {
          URL.revokeObjectURL(currentViewportImage)
        }

        let nextFourDPhaseCache = item.fourDPhaseCache
        if (item.viewType === '4D' && fourDViewportMatch) {
          fourDPhaseRenderTracker.notifyRendered(tabKey, fourDViewportMatch.phaseKey, payload.viewId ?? '')
          const phase = getFourDPhaseByKey(item, fourDViewportMatch.phaseKey)
          const existingPhaseCache = item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]
          const phaseCacheSeed = createFourDPhaseCacheSeed(phase, existingPhaseCache)
          const previousCachedImage = existingPhaseCache?.viewportImages?.[viewportKey]
          if (previousCachedImage?.startsWith('blob:') && previousCachedImage !== currentViewportImage) {
            URL.revokeObjectURL(previousCachedImage)
          }

          const nextViewportImages = {
            ...(phaseCacheSeed.viewportImages ?? createEmptyMprImages()),
            [viewportKey]: imageSrc
          }
          const nextViewportCrosshair = resolveMprCrosshairForImageUpdate({
            incomingCrosshair: mprCrosshair,
            currentCrosshair: phaseCacheSeed.viewportCrosshairs?.[viewportKey] ?? null,
            lock: options.activeMprCrosshairDragLock.value,
            update: {
              tabKey,
              viewportKey,
              phaseKey: fourDViewportMatch.phaseKey
            }
          })
          nextFourDPhaseCache = {
            ...(item.fourDPhaseCache ?? {}),
            [fourDViewportMatch.phaseKey]: {
              ...phaseCacheSeed,
              status: hasCompleteMprViewportImages(nextViewportImages) ? 'ready' : 'loading',
              windowLabel,
              mprCursor: mprCursor ?? phaseCacheSeed.mprCursor ?? null,
              mprFrame,
              viewportImages: nextViewportImages,
              viewportSliceLabels: {
                ...(phaseCacheSeed.viewportSliceLabels ?? createEmptyMprSliceLabels()),
                [viewportKey]: sliceLabel
              },
              viewportPlanes: {
                ...(phaseCacheSeed.viewportPlanes ?? createEmptyMprPlanes()),
                [viewportKey]: mprPlane
              },
              viewportCrosshairs: {
                ...(phaseCacheSeed.viewportCrosshairs ?? createEmptyMprCrosshairs()),
                [viewportKey]: nextViewportCrosshair
              },
              viewportScaleBars: {
                ...(phaseCacheSeed.viewportScaleBars ?? createEmptyMprScaleBars()),
                [viewportKey]: scaleBar
              },
              viewportMeasurements: {
                ...(phaseCacheSeed.viewportMeasurements ?? {}),
                [viewportKey]: (payload.measurements ?? []) as MeasurementOverlay[]
              },
              viewportCornerInfos: {
                ...(phaseCacheSeed.viewportCornerInfos ?? createEmptyMprCornerInfos()),
                [viewportKey]: options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo))
              },
              viewportOrientations: {
                ...(phaseCacheSeed.viewportOrientations ?? createEmptyMprOrientations()),
                [viewportKey]: orientationInfo
              },
              viewportTransformStates: {
                ...(phaseCacheSeed.viewportTransformStates ?? createEmptyMprTransformStates()),
                [viewportKey]: transformState
              },
              viewportPseudocolorPresets: {
                ...(phaseCacheSeed.viewportPseudocolorPresets ?? createEmptyMprPseudocolorPresets()),
                [viewportKey]: pseudocolorPreset
              }
            }
          }
        }

        if (item.viewType === '4D' && !currentViewportKey) {
          const activePhaseIndex = clampFourDPhaseIndex(item, item.fourDPhaseIndex ?? 0)
          if (
            fourDViewportMatch?.phaseKey === getFourDPhaseKey(activePhaseIndex) &&
            isFourDPhaseDisplayed(item, fourDViewportMatch.phaseKey)
          ) {
            const nextItem = {
              ...item,
              fourDPhaseCache: nextFourDPhaseCache
            }
            return {
              ...nextItem,
              ...getFourDPhaseDisplayState(nextItem, activePhaseIndex, options.seriesCornerInfoMap.value)
            }
          }
          return {
            ...item,
            fourDPhaseCache: nextFourDPhaseCache
          }
        }

        const nextViewportCrosshair = resolveMprCrosshairForImageUpdate({
          incomingCrosshair: mprCrosshair,
          currentCrosshair: item.viewportCrosshairs?.[viewportKey] ?? null,
          lock: options.activeMprCrosshairDragLock.value,
          update: {
            tabKey,
            viewportKey,
            phaseKey:
              item.viewType === '4D'
                ? getFourDPhaseKey(clampFourDPhaseIndex(item, item.fourDPhaseIndex ?? 0))
                : null
          }
        })

        return {
          ...item,
          windowLabel,
          mprCursor: mprCursor ?? item.mprCursor ?? null,
          mprFrame,
          viewportImages: {
            ...(item.viewportImages ?? createEmptyMprImages()),
            [viewportKey]: imageSrc
          },
          viewportSliceLabels: {
            ...(item.viewportSliceLabels ?? createEmptyMprSliceLabels()),
            [viewportKey]: sliceLabel
          },
          viewportPlanes: {
            ...(item.viewportPlanes ?? createEmptyMprPlanes()),
            [viewportKey]: mprPlane
          },
          viewportCrosshairs: {
            ...(item.viewportCrosshairs ?? createEmptyMprCrosshairs()),
            [viewportKey]: nextViewportCrosshair
          },
          viewportScaleBars: {
            ...(item.viewportScaleBars ?? createEmptyMprScaleBars()),
            [viewportKey]: scaleBar
          },
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [viewportKey]: (payload.measurements ?? []) as MeasurementOverlay[]
          },
          viewportCornerInfos: {
            ...(item.viewportCornerInfos ?? createEmptyMprCornerInfos()),
            [viewportKey]: options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo))
          },
          viewportOrientations: {
            ...(item.viewportOrientations ?? createEmptyMprOrientations()),
            [viewportKey]: orientationInfo
          },
          viewportTransformStates: {
            ...(item.viewportTransformStates ?? createEmptyMprTransformStates()),
            [viewportKey]: transformState
          },
          viewportPseudocolorPresets: {
            ...(item.viewportPseudocolorPresets ?? createEmptyMprPseudocolorPresets()),
            [viewportKey]: pseudocolorPreset
          },
          mprMipConfig,
          volumePreset,
          volumeRenderConfig,
          fourDPhaseCache: nextFourDPhaseCache
        }
      }

      if (item.viewType === '4D') {
        URL.revokeObjectURL(imageSrc)
        return item
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
        scaleBar,
        cornerInfo: options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo)),
        orientation: orientationInfo,
        transformState,
        pseudocolorPreset,
        mprMipConfig,
        volumePreset,
        volumeRenderConfig
      }
    })
  }

  function collectMprViewSizeUpdates(
    viewportViewIds: Partial<Record<MprViewportKey, string>> | undefined,
    force = false
  ): MprViewSizeUpdate[] {
    const entries = Object.entries(viewportViewIds ?? {}) as [MprViewportKey, string][]
    return entries
      .filter(([, viewId]) => Boolean(viewId))
      .map(([viewportKey, viewId]) => {
        const size = getViewportSize(resolveMprViewportElement(viewportKey))
        if (!size) {
          return null
        }
        const sizeChanged = hasViewSizeChanged(viewId, size)
        if (!force && !sizeChanged) {
          return null
        }
        return { viewportKey, viewId, size }
      })
      .filter((item): item is MprViewSizeUpdate => Boolean(item))
  }

  function viewSizeUpdatesToViewIds(updates: MprViewSizeUpdate[]): Partial<Record<MprViewportKey, string>> {
    return updates.reduce<Partial<Record<MprViewportKey, string>>>((accumulator, update) => {
      accumulator[update.viewportKey] = update.viewId
      return accumulator
    }, {})
  }

  async function postMprViewSizeUpdates(updates: MprViewSizeUpdate[], renderOnBind = true): Promise<void> {
    await Promise.all(
      updates.map(async ({ viewId, size }) => {
        if (renderOnBind) {
          bindView(viewId)
        } else {
          await bindViewSilentlyWithAck(viewId)
        }
        await api.post<OperationAcceptedResponse>('/view/setSize', {
          opType: VIEW_OPERATION_TYPES.setSize,
          size,
          viewId
        })
      })
    )
  }

  async function renderMprViewIds(
    viewportViewIds: Partial<Record<MprViewportKey, string>> | undefined,
    force = false,
    renderOnBind = true
  ): Promise<Partial<Record<MprViewportKey, string>>> {
    const updates = collectMprViewSizeUpdates(viewportViewIds, force)
    await postMprViewSizeUpdates(updates, renderOnBind)
    return viewSizeUpdatesToViewIds(updates)
  }

  async function renderFourDPhaseSizeUpdatesAndWait(
    tabKey: string,
    phaseKey: string,
    viewportViewIds: Partial<Record<MprViewportKey, string>>,
    force = false
  ): Promise<Partial<Record<MprViewportKey, string>>> {
    const updates = collectMprViewSizeUpdates(viewportViewIds, force)
    const updatedViewIds = viewSizeUpdatesToViewIds(updates)
    const renderWait = updates.length
      ? fourDPhaseRenderTracker.waitForRender(tabKey, phaseKey, updatedViewIds)
      : Promise.resolve()
    await postMprViewSizeUpdates(updates, false)
    await renderWait
    return updatedViewIds
  }

  async function renderTab(tabKey: string, force = false): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab) {
      return
    }

    if (tab.viewType === 'Tag') {
      return
    }

    if (tab.viewType === 'MPR' || tab.viewType === '4D') {
      await renderMprViewIds(tab.viewportViewIds, force)
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
    const sizeChanged = hasViewSizeChanged(tab.viewId, size)
    if (!force && !sizeChanged) {
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

    options.selectedSeriesId.value = seriesId
    const targetSeries = options.seriesList.value.find((item) => item.seriesId === seriesId) ?? null
    if (viewType === '4D' && !isFourDSeriesItem(targetSeries)) {
      options.message.value = '当前序列不是 4D 序列。'
      return
    }

    const existingTab = findTab(seriesId, viewType)
    const hasExistingView =
      viewType === 'Tag' || viewType === '4D'
        ? Boolean(existingTab)
        : viewType === 'MPR'
          ? Object.values(existingTab?.viewportViewIds ?? {}).some(Boolean)
          : Boolean(existingTab?.viewId)
    if (hasExistingView && existingTab) {
      options.activeTabKey.value = existingTab.key
      if (viewType === '4D') {
        options.activeViewportKey.value = 'mpr-ax'
        options.isViewLoading.value = true
        try {
          const series = options.seriesList.value.find((item) => item.seriesId === seriesId)
          if (series) {
            const { phaseCount, phaseItems } = await resolveFourDPhaseItems(seriesId)
            await ensureFourDPhaseCornerInfos(phaseItems, seriesId)
            const initialPhaseIndex = resolveFourDInitialPhaseIndex(seriesId, phaseItems, existingTab.fourDPhaseIndex ?? 0)
            updateFourDTab(existingTab.key, series, phaseCount, phaseItems, initialPhaseIndex)
          }
        } finally {
          options.isViewLoading.value = false
        }
        await nextTick()
        const refreshedTab = options.viewerTabs.value.find((item) => item.key === existingTab.key)
        await setFourDPhase(existingTab.key, refreshedTab?.fourDPhaseIndex ?? existingTab.fourDPhaseIndex ?? 0)
      }
      if (viewType === 'Tag' && !(existingTab.tagItems?.length) && !existingTab.tagIsLoading) {
        await loadTagTab(existingTab.key, existingTab.tagIndex ?? resolveInitialTagIndex(seriesId))
      }
      return
    }

    const tabKey = existingTab?.key ?? ensureTab(seriesId, viewType)
    if (!tabKey) {
      return
    }

    if (viewType === '4D') {
      const series = targetSeries
      if (!series) {
        return
      }

      options.isViewLoading.value = true
      try {
        const { phaseCount, phaseItems } = await resolveFourDPhaseItems(seriesId)
        await ensureFourDPhaseCornerInfos(phaseItems, seriesId)
        const updatedSeries = options.seriesList.value.find((item) => item.seriesId === seriesId) ?? series
        const initialPhaseIndex = resolveFourDInitialPhaseIndex(seriesId, phaseItems, 0)
        updateFourDTab(tabKey, updatedSeries, phaseCount, phaseItems, initialPhaseIndex)
        options.activeViewportKey.value = 'mpr-ax'
        options.activeTabKey.value = tabKey
      } finally {
        options.isViewLoading.value = false
      }
      await nextTick()
      const refreshedTab = options.viewerTabs.value.find((item) => item.key === tabKey)
      await setFourDPhase(tabKey, refreshedTab?.fourDPhaseIndex ?? 0)
      return
    }

    options.isViewLoading.value = true

    try {
      if (viewType === 'Tag') {
        const tabKey = existingTab?.key ?? ensureTab(seriesId, viewType)
        if (!tabKey) {
          return
        }

        const series = options.seriesList.value.find((item) => item.seriesId === seriesId)
        if (!series) {
          return
        }

        const initialIndex = resolveInitialTagIndex(seriesId)
        options.viewerTabs.value = options.viewerTabs.value.map((item) =>
          item.key === tabKey
            ? {
                ...item,
                viewType,
                title: buildTabTitle(options.selectedSeries.value, viewType, item.seriesId),
                seriesTitle: series.seriesDescription || series.seriesInstanceUid || series.seriesId,
                tagIndex: initialIndex,
                tagTotal: Math.max(1, series.instanceCount),
                tagItems: [],
                tagFilePath: null,
                tagSopInstanceUid: null,
                tagInstanceNumber: null,
                tagIsLoading: true,
                tagLoadError: null
              }
            : item
        )

        options.activeViewportKey.value = 'single'
        options.activeTabKey.value = tabKey
        await loadTagTab(tabKey, initialIndex)
        return
      }

      const seriesCornerInfo = options.withHoverCornerInfo(await options.ensureSeriesCornerInfo(options.selectedSeriesId.value))
      let nextViewId = ''
      let nextViewportViewIds = createEmptyMprViewIds()

      if (viewType === 'MPR') {
        const responses = await Promise.all(
          MPR_VIEWPORT_KEYS.map(async (viewportKey) => {
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

      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === tabKey
          ? {
              ...item,
              viewType,
              title: buildTabTitle(options.selectedSeries.value, viewType, item.seriesId),
              viewId: nextViewId,
              imageSrc: '',
              sliceLabel: '',
              windowLabel: '',
              mprFrame: null,
              mprCursor: null,
              viewportViewIds: nextViewportViewIds,
              viewportImages: createEmptyMprImages(),
              viewportSliceLabels: createEmptyMprSliceLabels(),
              viewportPlanes: createEmptyMprPlanes(),
              viewportCrosshairs: createEmptyMprCrosshairs(),
              viewportScaleBars: createEmptyMprScaleBars(),
              measurements: [],
              scaleBar: null,
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
              transformState: createDefaultTransformInfo(),
              viewportTransformStates: createEmptyMprTransformStates(),
              pseudocolorPreset: selectedPseudocolorKey.value,
              viewportPseudocolorPresets:
                viewType === 'MPR'
                  ? {
                      'mpr-ax': selectedPseudocolorKey.value,
                      'mpr-cor': selectedPseudocolorKey.value,
                      'mpr-sag': selectedPseudocolorKey.value
                    }
                  : createEmptyMprPseudocolorPresets(),
              mprMipConfig: createDefaultMprMipConfig(),
              volumePreset: 'volumePreset:aaa',
              volumeRenderConfig: createDefaultVolumeRenderConfig('aaa')
            }
          : item
      )

      if (viewType === 'MPR') {
        Object.values(nextViewportViewIds).forEach((viewId) => {
          if (viewId) {
            bindView(viewId)
            emitViewOperation({
              viewId,
              opType: VIEW_OPERATION_TYPES.pseudocolor,
              pseudocolorPreset: selectedPseudocolorKey.value
            })
          }
        })
      } else if (nextViewId) {
        bindView(nextViewId)
        emitViewOperation({
          viewId: nextViewId,
          opType: VIEW_OPERATION_TYPES.pseudocolor,
          pseudocolorPreset: selectedPseudocolorKey.value
        })
      }

      options.activeViewportKey.value = viewType === 'MPR' ? 'mpr-ax' : viewType === '3D' ? 'volume' : 'single'
      options.activeTabKey.value = tabKey
      await nextTick()
      await renderTab(tabKey)
      options.message.value = ''
    } catch (error) {
      options.message.value = `${viewType} 视图打开失败。`
      console.error(error)
    } finally {
      options.isViewLoading.value = false
    }
  }

  async function openView(viewType: ViewType): Promise<void> {
    if (!options.selectedSeriesId.value) {
      return
    }

    await openSeriesView(options.selectedSeriesId.value, viewType)
  }

  function selectSeries(seriesId: string): void {
    options.selectedSeriesId.value = seriesId

    const activeSeriesTab = options.viewerTabs.value.find(
      (item) => item.seriesId === seriesId && item.key === options.activeTabKey.value
    )
    if (activeSeriesTab) {
      return
    }

    const existingTab = findTab(seriesId, 'Stack') ?? findTab(seriesId)
    options.activeTabKey.value = existingTab?.key ?? ''
  }

  function activateTab(tabKey: string): void {
    options.activeTabKey.value = tabKey
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (tab) {
      options.selectedSeriesId.value = tab.seriesId
      options.activeViewportKey.value = tab.viewType === 'MPR' || tab.viewType === '4D' ? 'mpr-ax' : tab.viewType === '3D' ? 'volume' : 'single'
    }
  }

  function releaseBackendViews(viewIds: Array<string | null | undefined>): void {
    const uniqueViewIds = Array.from(new Set(viewIds.filter((viewId): viewId is string => Boolean(viewId))))
    uniqueViewIds.forEach((viewId) => {
      void api.post<OperationAcceptedResponse>('/view/close', { viewId }).catch(() => {
        viewSizeCache.delete(viewId)
      })
    })
  }

  function closeTab(tabKey: string): void {
    const currentIndex = options.viewerTabs.value.findIndex((item) => item.key === tabKey)
    if (currentIndex < 0) {
      return
    }

    const closingTab = options.viewerTabs.value[currentIndex]
    options.onBeforeCloseTab?.(closingTab)

    fourDPhaseRenderTracker.clearTab(tabKey)
    queuedFourDPhaseSwitches.delete(tabKey)
    fourDPhaseSwitchInFlightTabKeys.delete(tabKey)
    queuedFourDPreloadTabKeys.delete(tabKey)
    fourDPreloadRequests.delete(tabKey)
    releaseBackendViews([closingTab.viewId, ...Object.values(closingTab.viewportViewIds ?? {}), ...getFourDPhaseBackendViewIds(closingTab)])
    if (closingTab.viewId) {
      options.clearPendingVolumeConfig(closingTab.viewId)
      viewSizeCache.delete(closingTab.viewId)
    }
    Object.values(closingTab.viewportViewIds ?? {}).forEach((viewId) => {
      if (viewId) {
        viewSizeCache.delete(viewId)
      }
    })
    getFourDPhaseBackendViewIds(closingTab).forEach((viewId) => {
      viewSizeCache.delete(viewId)
    })

    const closingImageSrc = options.viewerTabs.value[currentIndex]?.imageSrc
    if (closingImageSrc?.startsWith('blob:')) {
      URL.revokeObjectURL(closingImageSrc)
    }
    Object.values(closingTab.viewportImages ?? {}).forEach((imageSrc) => {
      if (imageSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc)
      }
    })
    Object.values(closingTab.fourDPhaseCache ?? {}).forEach((phaseCache) => {
      Object.values(phaseCache.viewportImages ?? {}).forEach((imageSrc) => {
        if (imageSrc?.startsWith('blob:')) {
          URL.revokeObjectURL(imageSrc)
        }
      })
    })

    const nextTabs = options.viewerTabs.value.filter((item) => item.key !== tabKey)
    options.viewerTabs.value = nextTabs

    const relatedTabs = nextTabs.filter((item) => item.seriesId === closingTab.seriesId)
    if (options.selectedSeriesId.value === closingTab.seriesId) {
      options.selectedSeriesId.value =
        relatedTabs[0]?.seriesId ?? nextTabs[currentIndex]?.seriesId ?? nextTabs[currentIndex - 1]?.seriesId ?? ''
    }

    if (options.activeTabKey.value === tabKey) {
      const fallbackTab = relatedTabs[0] ?? nextTabs[currentIndex] ?? nextTabs[currentIndex - 1] ?? null
      options.activeTabKey.value = fallbackTab?.key ?? ''
    }

    if (!nextTabs.length) {
      options.message.value = ''
    }
  }

  function removeSeries(seriesId: string): void {
    const nextSeries = options.seriesList.value.filter((item) => item.seriesId !== seriesId)
    options.seriesList.value = nextSeries

    const nextSeriesCornerInfoMap = { ...options.seriesCornerInfoMap.value }
    delete nextSeriesCornerInfoMap[seriesId]
    options.seriesCornerInfoMap.value = nextSeriesCornerInfoMap

    const relatedTabs = options.viewerTabs.value.filter((item) => item.seriesId === seriesId)
    relatedTabs.forEach((tab) => closeTab(tab.key))

    if (options.selectedSeriesId.value === seriesId) {
      const fallbackSeriesId = nextSeries[0]?.seriesId ?? ''
      options.selectedSeriesId.value = fallbackSeriesId
      if (fallbackSeriesId) {
        selectSeries(fallbackSeriesId)
      }
    }
  }

  return {
    activateTab,
    closeTab,
    findTabByViewId,
    invalidateFourDMprState,
    openSeriesView,
    openView,
    preloadFourDPhases,
    rebindOpenViews,
    removeSeries,
    renderTab,
    setFourDPhase,
    setTagTabIndex,
    selectSeries,
    updateTabImage
  }
}
