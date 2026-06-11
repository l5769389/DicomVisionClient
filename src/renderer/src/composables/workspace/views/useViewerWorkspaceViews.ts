import { nextTick, type ComputedRef, type Ref } from 'vue'
import { VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { resolveBackendAssetUrl } from '../../../services/api'
import { postApi } from '../../../services/typedApi'
import {
  bindView,
  bindViewSilently,
  bindViewSilentlyWithAck,
  emitViewOperationWithAck
} from '../../../services/socket'
import {
  COMPARE_STACK_PANE_KEYS,
  COMPARE_STACK_SOURCE_PANE_KEY,
  COMPARE_STACK_TARGET_PANE_KEY,
  buildTabTitle,
  createComparePaneRecord,
  createCompareStackTabKey,
  createDefaultFusionInfo,
  createEmptyCompareCornerInfos,
  createEmptyCompareImages,
  createEmptyCompareOrientations,
  createEmptyComparePseudocolorPresets,
  createEmptyCompareScaleBars,
  createEmptyCompareSliceLabels,
  createEmptyCompareTransformStates,
  createEmptyCompareViewIds,
  createEmptyCompareWindowLabels,
  createEmptyCornerInfo,
  createEmptyFusionCornerInfos,
  createEmptyFusionImages,
  createEmptyFusionLoadingProgress,
  createEmptyFusionOrientations,
  createEmptyFusionProjections,
  createEmptyFusionPseudocolorPresets,
  createEmptyFusionScaleBars,
  createEmptyFusionSliceLabels,
  createEmptyFusionTransformStates,
  createEmptyFusionViewIds,
  createEmptyFusionWindowLabels,
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
  createLayoutTab,
  createPetCtFusionTabKey,
  createTab,
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PANE_KEYS,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY,
  getSeriesDisplayName,
  isCompareStackPaneKey,
  isFusionPaneKey,
  isMprViewportKey,
  mergeCornerInfo,
  normalizeCornerInfo,
  normalizeFusionProjectionInfo,
  normalizeMprCursorInfo,
  normalizeMprFrameInfo,
  normalizeMprPlaneInfo,
  normalizeOrientationInfo,
  normalizeScaleBarInfo,
  resolveFusionPaneSeriesId
} from './viewerWorkspaceTabs'
import { cloneViewerLayoutTemplate } from '../layout/viewerLayoutTemplates'
import {
  createSeededLayoutSlots,
  getOwnedLayoutSlotImageSrcs
} from '../layout/viewerLayoutSlotSeeds'
import { getDistinctFourDPhaseSeriesIds, resolveFourDPhaseSeriesId } from './fourDPhaseMetadata'
import { isSeriesViewSupported } from './seriesViewSupport'
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
import {
  DEFAULT_FUSION_PET_WINDOW_MAX,
  DEFAULT_FUSION_PET_WINDOW_MIN,
  DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET,
  DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET,
  DEFAULT_PSEUDOCOLOR_PRESET,
  normalizeFusionPetPseudocolorPresetKey,
  normalizePseudocolorPresetKey
} from '../../../constants/pseudocolor'
import { createDefaultMprMipConfig, isFourDSeriesItem, normalizeMprMipConfig } from '../../../types/viewer'
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
import { createRenderTabScheduler } from './renderTabScheduler'
import { createRenderedImageUrlRegistry } from './renderedImageUrlRegistry'
import { COMPARE_SYNC_DEFAULTS } from '../sync/viewSyncConfig'
import {
  resolveMprCrosshairForImageUpdate,
  shouldCompleteMprCrosshairSettling,
  shouldSuppressMprCrosshairPreviewImageUpdate,
  type ActiveMprCrosshairDragLock,
  type IncomingMprViewportUpdate
} from './mprInteractionGuard'
import { createViewSizeUpdateDeduper } from './viewSizeUpdateDeduper'
import { useUiPreferences } from '../../ui/useUiPreferences'
import { resolveBackendErrorDetail } from '../tasks/workspaceStatus'
import { createKeyedLatestRequestGuard } from '../requests/latestRequest'
import type {
  BackendCreateViewType,
  AnnotationOverlay,
  CompareStackPaneKey,
  CornerInfo,
  DicomTagItem,
  FolderSeriesItem,
  FusionInfo,
  FusionPaneKey,
  FourDPhaseCacheItem,
  FourDPhaseItem,
  FourDPhasesResponse,
  MeasurementOverlay,
  MprViewportKey,
  ViewImageResponse,
  ViewProgressInfo,
  ViewerLayoutSlot,
  ViewerLayoutTemplate,
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
  viewportElements: Ref<Partial<Record<string, HTMLElement | null>>>
  viewerStage: Ref<HTMLElement | null>
  viewerTabs: Ref<ViewerTabItem[]>
  clearPendingVolumeConfig: (viewId: string) => void
  completeActiveMprCrosshairDragLock: (update: IncomingMprViewportUpdate) => void
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

interface ViewSizeUpdate {
  viewId: string
  size: {
    width: number
    height: number
  }
}

interface CompareViewSizeUpdate {
  viewportKey: CompareStackPaneKey
  viewId: string
  size: {
    width: number
    height: number
  }
}

interface FusionViewSizeUpdate {
  viewportKey: FusionPaneKey
  viewId: string
  size: {
    width: number
    height: number
  }
}

interface LayoutViewSizeUpdate {
  slotId: string
  viewId: string
  size: {
    width: number
    height: number
  }
}

const VIEWPORT_LAYOUT_WAIT_FRAMES = 60

export function useViewerWorkspaceViews(options: ViewerWorkspaceViewsOptions) {
  const viewSizeCache = new Map<string, string>()
  const viewSizeUpdateDeduper = createViewSizeUpdateDeduper()
  const queuedFourDPreloadTabKeys = new Set<string>()
  const fourDPreloadRequests = new Map<string, Promise<void>>()
  const fourDPhaseSwitchInFlightTabKeys = new Set<string>()
  const queuedFourDPhaseSwitches = new Map<string, { phaseIndex: number; phaseOptions: SetFourDPhaseOptions }>()
  const fourDManifestRequests = new Map<string, Promise<FourDPhasesResponse | null>>()
  const tagRequestGuard = createKeyedLatestRequestGuard<string>()
  const fourDPhaseRenderTracker = new FourDPhaseRenderTracker()
  const imageUrlRegistry = createRenderedImageUrlRegistry()
  const renderTabScheduler = createRenderTabScheduler({
    renderNow: renderTabNow
  })
  const { locale, selectedPseudocolorKey } = useUiPreferences()

  function viewMessage(zh: string, en: string): string {
    return locale.value === 'zh-CN' ? zh : en
  }

  function getBackendStatusCode(error: unknown): number | null {
    const status = (error as { response?: { status?: unknown } } | null)?.response?.status
    return typeof status === 'number' ? status : null
  }

  function isSeriesMissingError(error: unknown): boolean {
    const detail = resolveBackendErrorDetail(error).toLowerCase()
    return getBackendStatusCode(error) === 404 || detail.includes('seriesid not found')
  }

  function hasBackendViewForTab(tab: ViewerTabItem | null | undefined): boolean {
    if (!tab) {
      return false
    }
    return (
      Boolean(tab.viewId) ||
      Object.values(tab.compareViewIds ?? {}).some(Boolean) ||
      Object.values(tab.fusionViewIds ?? {}).some(Boolean) ||
      Object.values(tab.viewportViewIds ?? {}).some(Boolean) ||
      getLayoutSlotViewIds(tab).length > 0 ||
      getFourDPhaseBackendViewIds(tab).length > 0
    )
  }

  function closeIncompleteTab(tabKey: string): void {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || hasBackendViewForTab(tab)) {
      return
    }
    closeTab(tabKey)
  }

  function handleOpenSeriesViewFailure(error: unknown, seriesId: string, viewType: ViewType, tabKey: string): void {
    const detail = resolveBackendErrorDetail(error)
    closeIncompleteTab(tabKey)
    if (isSeriesMissingError(error)) {
      removeSeries(seriesId)
      options.message.value = viewMessage(
        '当前序列已失效，请重新上传 DICOM 或重新加载示例影像。',
        'The current series is no longer available. Upload DICOM files again or reload the sample images.'
      )
      return
    }
    options.message.value = detail
      ? viewMessage(`${viewType} 视图打开失败：${detail}`, `${viewType} view failed to open: ${detail}`)
      : viewMessage(`${viewType} 视图打开失败。`, `${viewType} view failed to open.`)
  }

  function revokeObjectUrlIfNeeded(imageSrc: string | null | undefined): void {
    imageUrlRegistry.revoke(imageSrc)
  }

  async function cloneLayoutImageSrc(imageSrc: string | null | undefined): Promise<{ imageSrc: string | null; ownsImageSrc: boolean }> {
    return imageUrlRegistry.clone(imageSrc)
  }

  function revokeLayoutSlotImages(slots: ViewerTabItem['layoutSlots']): void {
    imageUrlRegistry.revokeMany(getOwnedLayoutSlotImageSrcs(slots))
  }

  function getLayoutSlotViewIds(tab: ViewerTabItem): string[] {
    return (tab.layoutSlots ?? [])
      .map((slot) => slot.viewId ?? '')
      .filter((viewId): viewId is string => Boolean(viewId))
  }

  function releaseLayoutSlotViewIds(viewIds: string[]): void {
    releaseBackendViews(viewIds)
    viewIds.forEach((viewId) => {
      viewSizeCache.delete(viewId)
    })
  }

  function releaseDiscardedLayoutSlotViews(
    previousSlots: ViewerLayoutSlot[] | null | undefined,
    nextSlots: ViewerLayoutSlot[] | null | undefined
  ): void {
    const nextViewIds = new Set(
      (nextSlots ?? [])
        .map((slot) => slot.viewId ?? '')
        .filter((viewId): viewId is string => Boolean(viewId))
    )
    const discardedViewIds = (previousSlots ?? [])
      .map((slot) => slot.viewId ?? '')
      .filter((viewId): viewId is string => Boolean(viewId) && !nextViewIds.has(viewId))
    if (discardedViewIds.length) {
      releaseLayoutSlotViewIds(discardedViewIds)
    }
  }

  function releaseTabRenderResources(tab: ViewerTabItem): void {
    releaseBackendViews([
      tab.viewId,
      ...Object.values(tab.compareViewIds ?? {}),
      ...Object.values(tab.fusionViewIds ?? {}),
      ...Object.values(tab.viewportViewIds ?? {}),
      ...getFourDPhaseBackendViewIds(tab),
      ...getLayoutSlotViewIds(tab)
    ])
    if (tab.viewId) {
      options.clearPendingVolumeConfig(tab.viewId)
      viewSizeCache.delete(tab.viewId)
    }
    Object.values(tab.compareViewIds ?? {}).forEach((viewId) => {
      if (viewId) {
        viewSizeCache.delete(viewId)
      }
    })
    Object.values(tab.fusionViewIds ?? {}).forEach((viewId) => {
      if (viewId) {
        viewSizeCache.delete(viewId)
      }
    })
    Object.values(tab.viewportViewIds ?? {}).forEach((viewId) => {
      if (viewId) {
        viewSizeCache.delete(viewId)
      }
    })
    getFourDPhaseBackendViewIds(tab).forEach((viewId) => {
      viewSizeCache.delete(viewId)
    })
    getLayoutSlotViewIds(tab).forEach((viewId) => {
      viewSizeCache.delete(viewId)
    })
    revokeObjectUrlIfNeeded(tab.imageSrc)
    Object.values(tab.compareImages ?? {}).forEach(revokeObjectUrlIfNeeded)
    Object.values(tab.fusionImages ?? {}).forEach(revokeObjectUrlIfNeeded)
    Object.values(tab.viewportImages ?? {}).forEach(revokeObjectUrlIfNeeded)
    Object.values(tab.fourDPhaseCache ?? {}).forEach((phaseCache) => {
      Object.values(phaseCache.viewportImages ?? {}).forEach(revokeObjectUrlIfNeeded)
    })
  }

  function resolveSeriesLayoutPreviewSrc(series: FolderSeriesItem): string {
    const phasePreview = series.fourDPhases?.find((phase) => phase.imageSrc || phase.viewportImages?.['mpr-ax'])
    return resolveBackendAssetUrl(
      series.thumbnailSrc ||
        series.thumbnailUrl ||
        phasePreview?.imageSrc ||
        phasePreview?.viewportImages?.['mpr-ax'] ||
        ''
    )
  }

  function getSeriesLayoutSliceLabel(series: FolderSeriesItem): string {
    const instanceCount = Number(series.instanceCount)
    return Number.isFinite(instanceCount) && instanceCount > 0 ? `1 / ${instanceCount}` : ''
  }

  function getFirstLayoutViewportKey(tab: ViewerTabItem): string {
    return tab.layoutSlots?.find((slot) => slot.viewId)?.id ?? tab.layoutSlots?.[0]?.id ?? 'layout'
  }

  function isLayoutStackSlot(slot: ViewerLayoutSlot): boolean {
    return Boolean(
      slot.seriesId &&
        (slot.viewType === 'Stack' || slot.sourceViewType === 'Stack' || slot.sourceViewType === 'CompareStack')
    )
  }

  async function createLayoutStackSlotView(slot: ViewerLayoutSlot, forceNewView: boolean): Promise<ViewerLayoutSlot> {
    if (!isLayoutStackSlot(slot) || !slot.seriesId) {
      return {
        ...slot,
        viewId: null
      }
    }

    if (!forceNewView && slot.viewId) {
      return slot
    }

    const data = await postApi('CreateViewApiV1ViewCreatePost', {
      seriesId: slot.seriesId,
      viewType: 'Stack'
    })
    const pseudocolorPreset = normalizePseudocolorPresetKey(slot.pseudocolorPreset ?? selectedPseudocolorKey.value)
    return {
      ...slot,
      viewType: 'Stack',
      sourceViewType: slot.sourceViewType ?? 'Stack',
      viewportKey: slot.viewportKey ?? 'single',
      viewId: data.viewId,
      pseudocolorPreset,
      transformState: slot.transformState ?? createDefaultTransformInfo()
    }
  }

  async function hydrateLayoutStackSlots(slots: ViewerLayoutSlot[], forceNewViews: boolean): Promise<ViewerLayoutSlot[]> {
    return await Promise.all(slots.map((slot) => createLayoutStackSlotView(slot, forceNewViews)))
  }

  async function emitLayoutPseudocolorOperations(slots: ViewerLayoutSlot[], presetOverride?: string): Promise<void> {
    await Promise.all(
      slots.map(async (slot) => {
        if (!slot.viewId || !isLayoutStackSlot(slot)) {
          return
        }
        await emitViewOperationWithAck({
          viewId: slot.viewId,
          opType: VIEW_OPERATION_TYPES.pseudocolor,
          pseudocolorPreset: normalizePseudocolorPresetKey(presetOverride ?? slot.pseudocolorPreset ?? selectedPseudocolorKey.value)
        })
      })
    )
  }

  function findTab(seriesId: string, viewType?: ViewType): ViewerTabItem | undefined {
    return options.viewerTabs.value.find((item) =>
      viewType ? item.seriesId === seriesId && item.viewType === viewType : item.seriesId === seriesId
    )
  }

  async function emitInitialPseudocolorOperation(viewId: string, preset: string): Promise<void> {
    const normalizedPreset = normalizePseudocolorPresetKey(preset)
    if (!viewId || normalizedPreset === DEFAULT_PSEUDOCOLOR_PRESET) {
      return
    }
    await emitViewOperationWithAck({
      viewId,
      opType: VIEW_OPERATION_TYPES.pseudocolor,
      pseudocolorPreset: normalizedPreset
    })
  }

  function findTabByViewId(viewId: string): ViewerTabItem | undefined {
    return options.viewerTabs.value.find(
      (item) =>
        item.viewId === viewId ||
        Object.values(item.compareViewIds ?? {}).includes(viewId) ||
        Object.values(item.fusionViewIds ?? {}).includes(viewId) ||
        Object.values(item.viewportViewIds ?? {}).includes(viewId) ||
        getLayoutSlotViewIds(item).includes(viewId) ||
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

  function createInlineLayoutTabKey(tab: ViewerTabItem): string {
    if (tab.viewType === 'Layout') {
      return tab.key
    }

    const baseKey = `${tab.key}::Layout`
    if (!options.viewerTabs.value.some((item) => item.key === baseKey)) {
      return baseKey
    }

    let suffix = 2
    let candidateKey = `${baseKey}::${suffix}`
    while (options.viewerTabs.value.some((item) => item.key === candidateKey)) {
      suffix += 1
      candidateKey = `${baseKey}::${suffix}`
    }
    return candidateKey
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

    const request = tagRequestGuard.start(tabKey)

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
      const data = await postApi(
        'GetDicomTagsApiV1DicomTagsPost',
        {
          seriesId: tab.seriesId,
          index
        },
        {
          signal: request.signal
        }
      )
      if (!tagRequestGuard.isCurrent(tabKey, request.token)) {
        return
      }

      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === tabKey
          ? {
              ...item,
              tagIndex: data.index,
              tagTotal: data.total,
              tagItems: (data.items ?? []) as DicomTagItem[],
              tagFilePath: data.filePath ?? null,
              tagSopInstanceUid: data.sopInstanceUid ?? null,
              tagInstanceNumber: data.instanceNumber ?? null,
              tagIsLoading: false,
              tagLoadError: null
            }
          : item
      )
      tagRequestGuard.finish(tabKey, request.token)
      options.message.value = ''
    } catch (error) {
      if (!tagRequestGuard.isCurrent(tabKey, request.token)) {
        return
      }
      const fallbackMessage =
        typeof error === 'object' && error != null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : viewMessage('DICOM Tag 加载失败。', 'Failed to load DICOM tags.')

      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === tabKey
          ? {
              ...item,
              tagIsLoading: false,
              tagLoadError: fallbackMessage
            }
          : item
      )
      tagRequestGuard.finish(tabKey, request.token)
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
        const data = await postApi('CreateViewApiV1ViewCreatePost', {
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

  async function createCompareStackViewIds(sourceSeriesId: string, targetSeriesId: string): Promise<Record<CompareStackPaneKey, string>> {
    const seriesByPane = createComparePaneRecord((paneKey) =>
      paneKey === COMPARE_STACK_SOURCE_PANE_KEY ? sourceSeriesId : targetSeriesId
    )
    const entries = await Promise.all(
      COMPARE_STACK_PANE_KEYS.map(async (viewportKey) => {
        const data = await postApi('CreateViewApiV1ViewCreatePost', {
          seriesId: seriesByPane[viewportKey],
          viewType: 'Stack'
        })
        return [viewportKey, data.viewId] as const
      })
    )

    return entries.reduce(
      (accumulator, [viewportKey, viewId]) => ({
        ...accumulator,
        [viewportKey]: viewId
      }),
      createEmptyCompareViewIds()
    )
  }

  function getCreateViewTypeForFusionPane(paneKey: FusionPaneKey): BackendCreateViewType {
    if (paneKey === FUSION_CT_AXIAL_PANE_KEY) {
      return 'FusionCTAxial'
    }
    if (paneKey === FUSION_PET_AXIAL_PANE_KEY) {
      return 'FusionPETAxial'
    }
    if (paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY) {
      return 'FusionPETCoronalMip'
    }
    return 'FusionOverlayAxial'
  }

  async function createFusionViewIds(
    ctSeriesId: string,
    petSeriesId: string,
    viewGroupKey: string
  ): Promise<Record<FusionPaneKey, string>> {
    const entries = await Promise.all(
      FUSION_PANE_KEYS.map(async (paneKey) => {
        const data = await postApi('CreateViewApiV1ViewCreatePost', {
          seriesId: ctSeriesId,
          secondarySeriesId: petSeriesId,
          viewType: getCreateViewTypeForFusionPane(paneKey),
          fusionPaneRole: paneKey,
          viewGroupKey
        })
        return [paneKey, data.viewId] as const
      })
    )

    return entries.reduce(
      (accumulator, [paneKey, viewId]) => ({
        ...accumulator,
        [paneKey]: viewId
      }),
      createEmptyFusionViewIds()
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

  async function bindFusionViewIdsSilentlyWithAck(viewIds: Partial<Record<FusionPaneKey, string>>): Promise<void> {
    await Promise.all(
      Object.values(viewIds).map(async (viewId) => {
        if (viewId) {
          await bindViewSilentlyWithAck(viewId)
        }
      })
    )
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

  function getTabComparePseudocolorPreset(tab: ViewerTabItem, viewportKey: CompareStackPaneKey): string {
    return normalizePseudocolorPresetKey(tab.comparePseudocolorPresets?.[viewportKey] ?? tab.pseudocolorPreset)
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

  function createComparePseudocolorPresetMap(preset: string): Record<CompareStackPaneKey, string> {
    const normalizedPreset = normalizePseudocolorPresetKey(preset)
    return createComparePaneRecord(() => normalizedPreset)
  }

  async function emitComparePseudocolorOperations(
    viewIds: Partial<Record<CompareStackPaneKey, string>>,
    tab: ViewerTabItem,
    presetOverride?: string
  ): Promise<void> {
    const entries = Object.entries(viewIds) as [CompareStackPaneKey, string][]
    await Promise.all(
      entries.map(async ([viewportKey, viewId]) => {
        if (!viewId) {
          return
        }
        await emitViewOperationWithAck({
          viewId,
          opType: VIEW_OPERATION_TYPES.pseudocolor,
          pseudocolorPreset: presetOverride
            ? normalizePseudocolorPresetKey(presetOverride)
            : getTabComparePseudocolorPreset(tab, viewportKey)
        })
      })
    )
  }

  function resolveCachedViewportSurface(viewportKey: string): HTMLElement | null {
    const cachedElement = options.viewportElements.value[viewportKey] ?? null
    if (!cachedElement?.isConnected) {
      return null
    }
    if (isViewportSurface(cachedElement, viewportKey)) {
      return cachedElement
    }
    return cachedElement.querySelector<HTMLElement>(`[data-active-render-surface][data-viewport-key="${viewportKey}"]`)
  }

  function isViewportSurface(element: HTMLElement | null | undefined, viewportKey: string): boolean {
    return Boolean(element?.dataset.activeRenderSurface && element.dataset.viewportKey === viewportKey)
  }

  function resolveViewportElement(viewportKey: string): HTMLElement | null {
    const cachedSurface = resolveCachedViewportSurface(viewportKey)
    if (cachedSurface) {
      return cachedSurface
    }

    const stage = options.viewerStage.value
    if (stage && isViewportSurface(stage, viewportKey)) {
      return stage
    }

    return (
      stage?.querySelector<HTMLElement>(`[data-active-render-surface][data-viewport-key="${viewportKey}"]`) ??
      stage?.querySelector<HTMLElement>(`[data-viewport-key="${viewportKey}"]`) ??
      null
    )
  }

  function resolveMprViewportElement(viewportKey: MprViewportKey): HTMLElement | null {
    return resolveViewportElement(viewportKey)
  }

  function resolveVolumeViewportElement(): HTMLElement | null {
    return resolveViewportElement('volume')
  }

  function resolveSingleViewportElement(): HTMLElement | null {
    return resolveViewportElement('single') ?? options.viewerStage.value
  }

  function getViewportSize(element: HTMLElement | null = options.viewerStage.value): { width: number; height: number } | null {
    if (!element) {
      return null
    }

    const styles = window.getComputedStyle(element)
    const horizontalPadding = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0')
    const verticalPadding = parseFloat(styles.paddingTop || '0') + parseFloat(styles.paddingBottom || '0')
    const rect = element.getBoundingClientRect()
    const width = (rect.width || element.clientWidth) - horizontalPadding
    const height = (rect.height || element.clientHeight) - verticalPadding

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
      Object.values(tab.compareViewIds ?? {}).forEach((viewId) => {
        if (viewId) {
          bindView(viewId)
        }
      })
      Object.values(tab.fusionViewIds ?? {}).forEach((viewId) => {
        if (viewId) {
          bindView(viewId)
        }
      })
      Object.values(tab.viewportViewIds ?? {}).forEach((viewId) => {
        if (viewId) {
          bindView(viewId)
        }
      })
      getLayoutSlotViewIds(tab).forEach((viewId) => {
        bindView(viewId)
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
        const data = await postApi('GetFourDPhasesApiV1DicomFourDPhasesPost', { seriesId })
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
    options.message.value =
      phaseItems.length > 0 || hasPreviewImage
        ? ''
        : viewMessage('当前序列没有可用的 4D phase 元数据。', '4D phase metadata is not available for this series.')
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
    if (!hasCompleteMprViewportLayout(viewIds)) {
      return
    }
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
        if (!hasCompleteMprViewportLayout(viewIds)) {
          continue
        }
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
    let mprCrosshairSettlingCompletionUpdate: IncomingMprViewportUpdate | null = null
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.key !== tabKey) {
        return item
      }

      const ww = payload.window_info?.ww
      const wl = payload.window_info?.wl
      const mimeType = payload.imageFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
      const imageSrc = imageUrlRegistry.create(imageBinary, mimeType)
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
      const hasCornerInfoPayload = payload.cornerInfo != null
      const hasOrientationPayload = payload.orientation != null
      const hasTransformPayload = payload.transform != null
      const hasMeasurementsPayload = payload.measurements != null
      const hasAnnotationsPayload = payload.annotations != null
      const rawScaleBar = payload.scaleBar ?? ((payload as { scale_bar?: unknown }).scale_bar ?? null)
      const hasScaleBarPayload = rawScaleBar != null
      const sliceCornerInfo = options.stripHoverCornerInfo(normalizeCornerInfo(payload.cornerInfo))
      const orientationInfo = normalizeOrientationInfo(payload.orientation)
      const transformState = payload.transform ?? createDefaultTransformInfo()
      const pseudocolorPreset = normalizePseudocolorPresetKey(payload.color?.pseudocolorPreset ?? item.pseudocolorPreset)
      const mprMipConfig = normalizeMprMipConfig(payload.mprMipConfig, item.mprMipConfig ?? createDefaultMprMipConfig())
      const mprCrosshairMode = payload.mprCrosshairMode === 'double-oblique' ? 'double-oblique' : 'orthogonal'
      const mprCursor = normalizeMprCursorInfo(payload.mprCursor ?? ((payload as { mpr_cursor?: unknown }).mpr_cursor ?? null))
      const mprFrame = normalizeMprFrameInfo(payload.mprFrame ?? ((payload as { mpr_frame?: unknown }).mpr_frame ?? null))
      const mprPlane = normalizeMprPlaneInfo(payload.mprPlane ?? ((payload as { mpr_plane?: unknown }).mpr_plane ?? null))
      const mprCrosshair = payload.mpr_crosshair ?? ((payload as { mprCrosshair?: ViewImageResponse['mpr_crosshair'] }).mprCrosshair ?? null)
      const rawMprRevision = payload.mprRevision ?? ((payload as { mpr_revision?: unknown }).mpr_revision ?? null)
      const mprRevision = typeof rawMprRevision === 'number' && Number.isFinite(rawMprRevision) ? rawMprRevision : null
      const scaleBar = normalizeScaleBarInfo(rawScaleBar)
      const volumePreset = payload.volumePreset ? `volumePreset:${normalizeVolumePresetKey(payload.volumePreset)}` : item.volumePreset
      const volumeRenderConfig = payload.volumeConfig
        ? normalizeVolumeRenderConfig(payload.volumeConfig, payload.volumePreset ?? item.volumePreset)
        : item.volumeRenderConfig
      const render3dMode = payload.render3dMode ? normalizeRender3DMode(payload.render3dMode) : item.render3dMode
      const surfaceRenderConfig = payload.surfaceConfig
        ? normalizeSurfaceRenderConfig(payload.surfaceConfig)
        : item.surfaceRenderConfig
      const payloadAnnotations = (payload.annotations ?? []) as AnnotationOverlay[]

      const layoutSlot = item.viewType === 'Layout'
        ? item.layoutSlots?.find((slot) => slot.viewId === payload.viewId)
        : null
      if (layoutSlot) {
        const expectedLayoutPseudocolorPreset = normalizePseudocolorPresetKey(
          layoutSlot.pseudocolorPreset ?? item.pseudocolorPreset
        )
        const layoutPseudocolorPreset = normalizePseudocolorPresetKey(
          payload.color?.pseudocolorPreset ?? layoutSlot.pseudocolorPreset ?? item.pseudocolorPreset
        )
        if (payload.color?.pseudocolorPreset && layoutPseudocolorPreset !== expectedLayoutPseudocolorPreset) {
          revokeObjectUrlIfNeeded(imageSrc)
          return item
        }

        const layoutSeriesCornerInfo =
          options.seriesCornerInfoMap.value[layoutSlot.seriesId ?? item.seriesId] ??
          options.seriesCornerInfoMap.value[item.seriesId] ??
          createEmptyCornerInfo()

        return {
          ...item,
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [layoutSlot.id]: hasMeasurementsPayload
              ? (payload.measurements ?? []) as MeasurementOverlay[]
              : item.viewportMeasurements?.[layoutSlot.id] ?? []
          },
          viewportAnnotations: {
            ...(item.viewportAnnotations ?? {}),
            [layoutSlot.id]: hasAnnotationsPayload
              ? payloadAnnotations
              : item.viewportAnnotations?.[layoutSlot.id] ?? []
          },
          layoutSlots: (item.layoutSlots ?? []).map((slot) => {
            if (slot.id !== layoutSlot.id) {
              return slot
            }
            if (slot.ownsImageSrc) {
              revokeObjectUrlIfNeeded(slot.imageSrc)
            }
            return {
              ...slot,
              imageSrc,
              ownsImageSrc: true,
              sliceLabel,
              windowLabel,
              scaleBar: hasScaleBarPayload ? scaleBar : slot.scaleBar ?? null,
              cornerInfo: hasCornerInfoPayload
                ? options.withHoverCornerInfo(mergeCornerInfo(layoutSeriesCornerInfo, sliceCornerInfo))
                : slot.cornerInfo ?? options.withHoverCornerInfo(mergeCornerInfo(layoutSeriesCornerInfo, sliceCornerInfo)),
              orientation: hasOrientationPayload ? orientationInfo : slot.orientation ?? orientationInfo,
              transformState: hasTransformPayload ? transformState : slot.transformState ?? transformState,
              pseudocolorPreset: layoutPseudocolorPreset
            }
          })
        }
      }

      const compareViewportKey = Object.entries(item.compareViewIds ?? {}).find(([, viewId]) => viewId === payload.viewId)?.[0] as
        | CompareStackPaneKey
        | undefined
      if (item.viewType === 'CompareStack' && compareViewportKey) {
        const compareSeriesId = item.compareSeriesIds?.[compareViewportKey] ?? item.seriesId
        const compareSeriesCornerInfo =
          options.seriesCornerInfoMap.value[compareSeriesId] ??
          options.seriesCornerInfoMap.value[item.seriesId] ??
          createEmptyCornerInfo()
        const expectedComparePseudocolorPreset = getTabComparePseudocolorPreset(item, compareViewportKey)
        const comparePseudocolorPreset = normalizePseudocolorPresetKey(
          payload.color?.pseudocolorPreset ?? item.comparePseudocolorPresets?.[compareViewportKey] ?? item.pseudocolorPreset
        )
        if (payload.color?.pseudocolorPreset && comparePseudocolorPreset !== expectedComparePseudocolorPreset) {
          revokeObjectUrlIfNeeded(imageSrc)
          return item
        }
        const currentImage = item.compareImages?.[compareViewportKey]
        revokeObjectUrlIfNeeded(currentImage)

        return {
          ...item,
          compareImages: {
            ...(item.compareImages ?? createEmptyCompareImages()),
            [compareViewportKey]: imageSrc
          },
          compareSliceLabels: {
            ...(item.compareSliceLabels ?? createEmptyCompareSliceLabels()),
            [compareViewportKey]: sliceLabel
          },
          compareWindowLabels: {
            ...(item.compareWindowLabels ?? createEmptyCompareWindowLabels()),
            [compareViewportKey]: windowLabel
          },
          compareScaleBars: {
            ...(item.compareScaleBars ?? createEmptyCompareScaleBars()),
            [compareViewportKey]: hasScaleBarPayload
              ? scaleBar
              : item.compareScaleBars?.[compareViewportKey] ?? null
          },
          compareCornerInfos: {
            ...(item.compareCornerInfos ?? createEmptyCompareCornerInfos()),
            [compareViewportKey]: hasCornerInfoPayload
              ? options.withHoverCornerInfo(mergeCornerInfo(compareSeriesCornerInfo, sliceCornerInfo))
              : item.compareCornerInfos?.[compareViewportKey] ?? options.withHoverCornerInfo(mergeCornerInfo(compareSeriesCornerInfo, sliceCornerInfo))
          },
          compareOrientations: {
            ...(item.compareOrientations ?? createEmptyCompareOrientations()),
            [compareViewportKey]: hasOrientationPayload
              ? orientationInfo
              : item.compareOrientations?.[compareViewportKey] ?? orientationInfo
          },
          compareTransformStates: {
            ...(item.compareTransformStates ?? createEmptyCompareTransformStates()),
            [compareViewportKey]: hasTransformPayload
              ? transformState
              : item.compareTransformStates?.[compareViewportKey] ?? transformState
          },
          comparePseudocolorPresets: {
            ...(item.comparePseudocolorPresets ?? createEmptyComparePseudocolorPresets()),
            [compareViewportKey]: comparePseudocolorPreset
          },
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [compareViewportKey]: hasMeasurementsPayload
              ? (payload.measurements ?? []) as MeasurementOverlay[]
              : item.viewportMeasurements?.[compareViewportKey] ?? []
          },
          viewportAnnotations: {
            ...(item.viewportAnnotations ?? {}),
            [compareViewportKey]: hasAnnotationsPayload
              ? payloadAnnotations
              : item.viewportAnnotations?.[compareViewportKey] ?? []
          }
        }
      }

      const fusionViewportKey = Object.entries(item.fusionViewIds ?? {}).find(([, viewId]) => viewId === payload.viewId)?.[0] as
        | FusionPaneKey
        | undefined
      if (item.viewType === 'PETCTFusion' && fusionViewportKey) {
        const previousFusionInfo = item.fusionInfo ?? createDefaultFusionInfo(
          item.fusionSeriesIds?.ctSeriesId ?? item.seriesId,
          item.fusionSeriesIds?.petSeriesId ?? ''
        )
        const rawFusionInfo = payload.fusionInfo ?? ((payload as { fusion_info?: unknown }).fusion_info ?? null)
        const fusionInfo = normalizeFusionInfoPayload(rawFusionInfo, previousFusionInfo)
        const payloadRecord = payload as Record<string, unknown>
        const hasFusionProjectionPayload = 'fusionProjection' in payloadRecord || 'fusion_projection' in payloadRecord
        const rawFusionProjection = payload.fusionProjection ?? ((payload as { fusion_projection?: unknown }).fusion_projection ?? null)
        const fusionProjection = normalizeFusionProjectionInfo(rawFusionProjection)
        const acceptedRevision = item.fusionInfo?.revision ?? null
        const isStalePreview =
          payload.imageFormat === 'jpeg' &&
          acceptedRevision != null &&
          fusionInfo.revision < acceptedRevision
        if (isStalePreview) {
          revokeObjectUrlIfNeeded(imageSrc)
          return item
        }

        const fusionSeriesId = resolveFusionPaneSeriesId(fusionViewportKey, item.fusionSeriesIds, item.seriesId)
        const fusionSeriesCornerInfo =
          options.seriesCornerInfoMap.value[fusionSeriesId] ??
          options.seriesCornerInfoMap.value[item.seriesId] ??
          createEmptyCornerInfo()
        const currentImage = item.fusionImages?.[fusionViewportKey]
        const mergedFusionCornerInfo = hasCornerInfoPayload
          ? options.withHoverCornerInfo(mergeCornerInfo(fusionSeriesCornerInfo, sliceCornerInfo))
          : item.fusionCornerInfos?.[fusionViewportKey] ?? options.withHoverCornerInfo(mergeCornerInfo(fusionSeriesCornerInfo, sliceCornerInfo))
        const fusionCornerInfo = normalizeFusionPetCornerInfo(mergedFusionCornerInfo, fusionInfo, fusionViewportKey)
        revokeObjectUrlIfNeeded(currentImage)

        return {
          ...item,
          fusionInfo,
          fusionImages: {
            ...(item.fusionImages ?? createEmptyFusionImages()),
            [fusionViewportKey]: imageSrc
          },
          fusionLoadingProgress: {
            ...(item.fusionLoadingProgress ?? createEmptyFusionLoadingProgress()),
            [fusionViewportKey]: null
          },
          fusionSliceLabels: {
            ...(item.fusionSliceLabels ?? createEmptyFusionSliceLabels()),
            [fusionViewportKey]: sliceLabel
          },
          fusionWindowLabels: {
            ...(item.fusionWindowLabels ?? createEmptyFusionWindowLabels()),
            [fusionViewportKey]: windowLabel
          },
          fusionScaleBars: {
            ...(item.fusionScaleBars ?? createEmptyFusionScaleBars()),
            [fusionViewportKey]: hasScaleBarPayload
              ? scaleBar
              : item.fusionScaleBars?.[fusionViewportKey] ?? null
          },
          fusionCornerInfos: {
            ...(item.fusionCornerInfos ?? createEmptyFusionCornerInfos()),
            [fusionViewportKey]: fusionCornerInfo
          },
          fusionOrientations: {
            ...(item.fusionOrientations ?? createEmptyFusionOrientations()),
            [fusionViewportKey]: hasOrientationPayload
              ? orientationInfo
              : item.fusionOrientations?.[fusionViewportKey] ?? orientationInfo
          },
          fusionTransformStates: {
            ...(item.fusionTransformStates ?? createEmptyFusionTransformStates()),
            [fusionViewportKey]: hasTransformPayload
              ? transformState
              : item.fusionTransformStates?.[fusionViewportKey] ?? transformState
          },
          fusionPseudocolorPresets: {
            ...(item.fusionPseudocolorPresets ?? createEmptyFusionPseudocolorPresets()),
            [fusionViewportKey]:
              fusionViewportKey === FUSION_CT_AXIAL_PANE_KEY
                ? normalizePseudocolorPresetKey(payload.color?.pseudocolorPreset ?? DEFAULT_PSEUDOCOLOR_PRESET)
                : fusionViewportKey === FUSION_OVERLAY_AXIAL_PANE_KEY
                  ? normalizeFusionPetPseudocolorPresetKey(
                      payload.color?.pseudocolorPreset ??
                        fusionInfo.petPseudocolorPreset ??
                        DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET
                    )
                  : normalizePseudocolorPresetKey(
                      payload.color?.pseudocolorPreset ??
                      DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET
                    )
          },
          fusionProjections: {
            ...(item.fusionProjections ?? createEmptyFusionProjections()),
            [fusionViewportKey]: hasFusionProjectionPayload
              ? fusionProjection
              : item.fusionProjections?.[fusionViewportKey] ?? null
          },
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [fusionViewportKey]: hasMeasurementsPayload
              ? (payload.measurements ?? []) as MeasurementOverlay[]
              : item.viewportMeasurements?.[fusionViewportKey] ?? []
          },
          viewportAnnotations: {
            ...(item.viewportAnnotations ?? {}),
            [fusionViewportKey]: hasAnnotationsPayload
              ? payloadAnnotations
              : item.viewportAnnotations?.[fusionViewportKey] ?? []
          }
        }
      }

      const currentViewportKey = Object.entries(item.viewportViewIds ?? {}).find(([, viewId]) => viewId === payload.viewId)?.[0] as
        | MprViewportKey
        | undefined
      const viewportKey = currentViewportKey ?? fourDViewportMatch?.viewportKey
      if (viewportKey && (item.viewType === 'MPR' || item.viewType === '4D')) {
        const isMprPreview = payload.imageFormat === 'jpeg'
        const activeFourDPhaseKey =
          item.viewType === '4D' ? getFourDPhaseKey(clampFourDPhaseIndex(item, item.fourDPhaseIndex ?? 0)) : null
        const mprViewportUpdate: IncomingMprViewportUpdate = {
          tabKey,
          viewportKey,
          phaseKey: item.viewType === '4D' ? fourDViewportMatch?.phaseKey ?? activeFourDPhaseKey : null,
          mprRevision
        }
        const acceptedMprRevision =
          item.viewType === '4D' && fourDViewportMatch
            ? item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]?.mprRevision ?? null
            : item.mprRevision ?? null
        if (
          shouldSuppressMprCrosshairPreviewImageUpdate({
            acceptedMprRevision,
            lock: options.activeMprCrosshairDragLock.value,
            update: mprViewportUpdate,
            imageFormat: payload.imageFormat
          })
        ) {
          revokeObjectUrlIfNeeded(imageSrc)
          return item
        }
        const shouldCompleteSettling = shouldCompleteMprCrosshairSettling({
          lock: options.activeMprCrosshairDragLock.value,
          update: mprViewportUpdate,
          imageFormat: payload.imageFormat,
          acceptedMprRevision,
          currentCrosshair: item.viewportCrosshairs?.[viewportKey] ?? null,
          incomingCrosshair: mprCrosshair
        })
        if (shouldCompleteSettling) {
          mprCrosshairSettlingCompletionUpdate = mprViewportUpdate
        }
        const mprCrosshairPreservationLock = shouldCompleteSettling ? null : options.activeMprCrosshairDragLock.value
        const currentViewportImage = item.viewportImages?.[viewportKey]
        if (currentViewportKey) {
          revokeObjectUrlIfNeeded(currentViewportImage)
        }

        let nextFourDPhaseCache = item.fourDPhaseCache
        if (item.viewType === '4D' && fourDViewportMatch) {
          fourDPhaseRenderTracker.notifyRendered(tabKey, fourDViewportMatch.phaseKey, payload.viewId ?? '')
          const phase = getFourDPhaseByKey(item, fourDViewportMatch.phaseKey)
          const existingPhaseCache = item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]
          const phaseCacheSeed = createFourDPhaseCacheSeed(phase, existingPhaseCache)
          const previousCachedImage = existingPhaseCache?.viewportImages?.[viewportKey]
          if (previousCachedImage !== currentViewportImage) {
            revokeObjectUrlIfNeeded(previousCachedImage)
          }

          const nextViewportImages = {
            ...(phaseCacheSeed.viewportImages ?? createEmptyMprImages()),
            [viewportKey]: imageSrc
          }
          const nextViewportCrosshair = resolveMprCrosshairForImageUpdate({
            incomingCrosshair: mprCrosshair,
            currentCrosshair: phaseCacheSeed.viewportCrosshairs?.[viewportKey] ?? null,
            lock: mprCrosshairPreservationLock,
            update: mprViewportUpdate
          })
          nextFourDPhaseCache = {
            ...(item.fourDPhaseCache ?? {}),
            [fourDViewportMatch.phaseKey]: {
              ...phaseCacheSeed,
              status: hasCompleteMprViewportImages(nextViewportImages) ? 'ready' : 'loading',
              windowLabel,
              mprCursor: mprCursor ?? phaseCacheSeed.mprCursor ?? null,
              mprFrame: mprFrame ?? phaseCacheSeed.mprFrame ?? null,
              mprRevision: mprRevision ?? phaseCacheSeed.mprRevision ?? null,
              viewportImages: nextViewportImages,
              viewportSliceLabels: {
                ...(phaseCacheSeed.viewportSliceLabels ?? createEmptyMprSliceLabels()),
                [viewportKey]: sliceLabel
              },
              viewportPlanes: {
                ...(phaseCacheSeed.viewportPlanes ?? createEmptyMprPlanes()),
                [viewportKey]: mprPlane ?? phaseCacheSeed.viewportPlanes?.[viewportKey] ?? null
              },
              viewportCrosshairs: {
                ...(phaseCacheSeed.viewportCrosshairs ?? createEmptyMprCrosshairs()),
                [viewportKey]: nextViewportCrosshair
              },
              viewportScaleBars: {
                ...(phaseCacheSeed.viewportScaleBars ?? createEmptyMprScaleBars()),
                [viewportKey]: scaleBar ?? phaseCacheSeed.viewportScaleBars?.[viewportKey] ?? null
              },
              viewportMeasurements: {
                ...(phaseCacheSeed.viewportMeasurements ?? {}),
                [viewportKey]: isMprPreview && !payload.measurements?.length
                  ? phaseCacheSeed.viewportMeasurements?.[viewportKey] ?? []
                  : (payload.measurements ?? []) as MeasurementOverlay[]
              },
              viewportCornerInfos: {
                ...(phaseCacheSeed.viewportCornerInfos ?? createEmptyMprCornerInfos()),
                [viewportKey]: payload.cornerInfo == null
                  ? phaseCacheSeed.viewportCornerInfos?.[viewportKey] ?? options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo))
                  : options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo))
              },
              viewportOrientations: {
                ...(phaseCacheSeed.viewportOrientations ?? createEmptyMprOrientations()),
                [viewportKey]: payload.orientation == null
                  ? phaseCacheSeed.viewportOrientations?.[viewportKey] ?? orientationInfo
                  : orientationInfo
              },
              viewportTransformStates: {
                ...(phaseCacheSeed.viewportTransformStates ?? createEmptyMprTransformStates()),
                [viewportKey]: payload.transform == null
                  ? phaseCacheSeed.viewportTransformStates?.[viewportKey] ?? transformState
                  : transformState
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
          lock: mprCrosshairPreservationLock,
          update: mprViewportUpdate
        })

        return {
          ...item,
          windowLabel,
          mprCursor: mprCursor ?? item.mprCursor ?? null,
          mprFrame: mprFrame ?? item.mprFrame ?? null,
          mprRevision: mprRevision ?? item.mprRevision ?? null,
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
            [viewportKey]: mprPlane ?? item.viewportPlanes?.[viewportKey] ?? null
          },
          viewportCrosshairs: {
            ...(item.viewportCrosshairs ?? createEmptyMprCrosshairs()),
            [viewportKey]: nextViewportCrosshair
          },
          viewportScaleBars: {
            ...(item.viewportScaleBars ?? createEmptyMprScaleBars()),
            [viewportKey]: scaleBar ?? item.viewportScaleBars?.[viewportKey] ?? null
          },
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [viewportKey]: isMprPreview && !payload.measurements?.length
              ? item.viewportMeasurements?.[viewportKey] ?? []
              : (payload.measurements ?? []) as MeasurementOverlay[]
          },
          viewportCornerInfos: {
            ...(item.viewportCornerInfos ?? createEmptyMprCornerInfos()),
            [viewportKey]: payload.cornerInfo == null
              ? item.viewportCornerInfos?.[viewportKey] ?? options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo))
              : options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo))
          },
          viewportOrientations: {
            ...(item.viewportOrientations ?? createEmptyMprOrientations()),
            [viewportKey]: payload.orientation == null
              ? item.viewportOrientations?.[viewportKey] ?? orientationInfo
              : orientationInfo
          },
          viewportTransformStates: {
            ...(item.viewportTransformStates ?? createEmptyMprTransformStates()),
            [viewportKey]: payload.transform == null
              ? item.viewportTransformStates?.[viewportKey] ?? transformState
              : transformState
          },
          viewportPseudocolorPresets: {
            ...(item.viewportPseudocolorPresets ?? createEmptyMprPseudocolorPresets()),
            [viewportKey]: pseudocolorPreset
          },
          viewportLoadingProgress: {
            ...(item.viewportLoadingProgress ?? {}),
            [viewportKey]: null
          },
          mprMipConfig,
          mprCrosshairMode,
          volumePreset,
          volumeRenderConfig,
          render3dMode,
          surfaceRenderConfig,
          fourDPhaseCache: nextFourDPhaseCache
        }
      }

      if (item.viewType === '4D') {
        revokeObjectUrlIfNeeded(imageSrc)
        return item
      }

      revokeObjectUrlIfNeeded(item.imageSrc)

      return {
        ...item,
        viewId: payload.viewId ?? item.viewId,
        imageSrc,
        sliceLabel,
        windowLabel,
        measurements: hasMeasurementsPayload ? (payload.measurements ?? []) as MeasurementOverlay[] : item.measurements ?? [],
        annotations: hasAnnotationsPayload ? payloadAnnotations : item.annotations ?? [],
        scaleBar: hasScaleBarPayload ? scaleBar : item.scaleBar ?? null,
        cornerInfo: hasCornerInfoPayload
          ? options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo))
          : item.cornerInfo ?? options.withHoverCornerInfo(mergeCornerInfo(seriesCornerInfo, sliceCornerInfo)),
        orientation: hasOrientationPayload ? orientationInfo : item.orientation ?? orientationInfo,
        transformState: hasTransformPayload ? transformState : item.transformState ?? transformState,
        pseudocolorPreset,
        mprMipConfig,
        mprCrosshairMode,
        volumePreset,
        volumeRenderConfig,
        render3dMode,
        surfaceRenderConfig,
        loadingProgress: null
      }
    })
    if (mprCrosshairSettlingCompletionUpdate) {
      options.completeActiveMprCrosshairDragLock(mprCrosshairSettlingCompletionUpdate)
    }
  }

  function updateMprState(tabKey: string, payload: Partial<ViewImageResponse>): void {
    let mprStateCompletionUpdate: IncomingMprViewportUpdate | null = null
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.key !== tabKey || (item.viewType !== 'MPR' && item.viewType !== '4D')) {
        return item
      }

      const fourDViewportMatch = item.viewType === '4D' ? findFourDPhaseViewportByViewId(item, payload.viewId) : null
      const currentViewportKey = Object.entries(item.viewportViewIds ?? {}).find(([, viewId]) => viewId === payload.viewId)?.[0] as
        | MprViewportKey
        | undefined
      const viewportKey = currentViewportKey ?? fourDViewportMatch?.viewportKey
      if (!viewportKey) {
        return item
      }
      const activeFourDPhaseKey =
        item.viewType === '4D' ? getFourDPhaseKey(clampFourDPhaseIndex(item, item.fourDPhaseIndex ?? 0)) : null

      const rawMprRevision = payload.mprRevision ?? ((payload as { mpr_revision?: unknown }).mpr_revision ?? null)
      const mprRevision = typeof rawMprRevision === 'number' && Number.isFinite(rawMprRevision) ? rawMprRevision : null
      const acceptedMprRevision =
        item.viewType === '4D' && fourDViewportMatch
          ? item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]?.mprRevision ?? null
          : item.mprRevision ?? null
      if (mprRevision != null && acceptedMprRevision != null && mprRevision < acceptedMprRevision) {
        return item
      }
      mprStateCompletionUpdate = {
        tabKey,
        viewportKey,
        phaseKey: item.viewType === '4D' ? fourDViewportMatch?.phaseKey ?? activeFourDPhaseKey : null,
        mprRevision
      }

      const sliceLabel = payload.slice_info
        ? `${payload.slice_info.current + 1} / ${payload.slice_info.total}`
        : item.viewportSliceLabels?.[viewportKey] ?? item.sliceLabel
      const ww = payload.window_info?.ww
      const wl = payload.window_info?.wl
      const windowLabel = ww != null || wl != null ? `WW ${ww ?? '-'}  WL ${wl ?? '-'}` : item.windowLabel
      const metadataSeriesId =
        item.viewType === '4D' && fourDViewportMatch
          ? resolveFourDPhaseSeriesId(item, fourDViewportMatch.phaseKey)
          : item.seriesId
      const seriesCornerInfo =
        options.seriesCornerInfoMap.value[metadataSeriesId] ??
        options.seriesCornerInfoMap.value[item.seriesId] ??
        createEmptyCornerInfo()
      const hasCornerInfoPayload = payload.cornerInfo != null
      const stateCornerInfo = hasCornerInfoPayload
        ? options.withHoverCornerInfo(
            mergeCornerInfo(seriesCornerInfo, options.stripHoverCornerInfo(normalizeCornerInfo(payload.cornerInfo)))
          )
        : null
      const mprCursor = normalizeMprCursorInfo(payload.mprCursor ?? ((payload as { mpr_cursor?: unknown }).mpr_cursor ?? null))
      const mprFrame = normalizeMprFrameInfo(payload.mprFrame ?? ((payload as { mpr_frame?: unknown }).mpr_frame ?? null))
      const mprPlane = normalizeMprPlaneInfo(payload.mprPlane ?? ((payload as { mpr_plane?: unknown }).mpr_plane ?? null))
      const mprCrosshair = payload.mpr_crosshair ?? ((payload as { mprCrosshair?: ViewImageResponse['mpr_crosshair'] }).mprCrosshair ?? null)
      const rawScaleBar = payload.scaleBar ?? ((payload as { scale_bar?: unknown }).scale_bar ?? null)
      const scaleBar = rawScaleBar != null ? normalizeScaleBarInfo(rawScaleBar) : null
      const orientationInfo = payload.orientation != null ? normalizeOrientationInfo(payload.orientation) : null
      const transformState = payload.transform ?? null
      const mprMipConfig = normalizeMprMipConfig(payload.mprMipConfig, item.mprMipConfig ?? createDefaultMprMipConfig())
      const mprCrosshairMode = payload.mprCrosshairMode === 'double-oblique' ? 'double-oblique' : item.mprCrosshairMode ?? 'orthogonal'

      let nextFourDPhaseCache = item.fourDPhaseCache
      if (item.viewType === '4D' && fourDViewportMatch) {
        const phase = getFourDPhaseByKey(item, fourDViewportMatch.phaseKey)
        const existingPhaseCache = item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]
        const phaseCacheSeed = createFourDPhaseCacheSeed(phase, existingPhaseCache)
        nextFourDPhaseCache = {
          ...(item.fourDPhaseCache ?? {}),
          [fourDViewportMatch.phaseKey]: {
            ...phaseCacheSeed,
            windowLabel,
            mprCursor: mprCursor ?? phaseCacheSeed.mprCursor ?? null,
            mprFrame: mprFrame ?? phaseCacheSeed.mprFrame ?? null,
            mprRevision: mprRevision ?? phaseCacheSeed.mprRevision ?? null,
            viewportSliceLabels: {
              ...(phaseCacheSeed.viewportSliceLabels ?? createEmptyMprSliceLabels()),
              [viewportKey]: sliceLabel
            },
            viewportPlanes: {
              ...(phaseCacheSeed.viewportPlanes ?? createEmptyMprPlanes()),
              [viewportKey]: mprPlane ?? phaseCacheSeed.viewportPlanes?.[viewportKey] ?? null
            },
            viewportCrosshairs: {
              ...(phaseCacheSeed.viewportCrosshairs ?? createEmptyMprCrosshairs()),
              [viewportKey]: mprCrosshair ?? phaseCacheSeed.viewportCrosshairs?.[viewportKey] ?? null
            },
            viewportCornerInfos: {
              ...(phaseCacheSeed.viewportCornerInfos ?? createEmptyMprCornerInfos()),
              [viewportKey]: stateCornerInfo ?? phaseCacheSeed.viewportCornerInfos?.[viewportKey] ?? createEmptyCornerInfo()
            },
            viewportScaleBars: {
              ...(phaseCacheSeed.viewportScaleBars ?? createEmptyMprScaleBars()),
              [viewportKey]: scaleBar ?? phaseCacheSeed.viewportScaleBars?.[viewportKey] ?? null
            },
            viewportOrientations: {
              ...(phaseCacheSeed.viewportOrientations ?? createEmptyMprOrientations()),
              [viewportKey]: orientationInfo ?? phaseCacheSeed.viewportOrientations?.[viewportKey] ?? createEmptyOrientationInfo()
            },
            viewportTransformStates: {
              ...(phaseCacheSeed.viewportTransformStates ?? createEmptyMprTransformStates()),
              [viewportKey]: transformState ?? phaseCacheSeed.viewportTransformStates?.[viewportKey] ?? createDefaultTransformInfo()
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
            fourDPhaseCache: nextFourDPhaseCache,
            mprCrosshairMode,
            mprMipConfig
          }
          return {
            ...nextItem,
            ...getFourDPhaseDisplayState(nextItem, activePhaseIndex, options.seriesCornerInfoMap.value)
          }
        }
        return {
          ...item,
          fourDPhaseCache: nextFourDPhaseCache,
          mprCrosshairMode,
          mprMipConfig
        }
      }

      return {
        ...item,
        windowLabel,
        mprCursor: mprCursor ?? item.mprCursor ?? null,
        mprFrame: mprFrame ?? item.mprFrame ?? null,
        mprRevision: mprRevision ?? item.mprRevision ?? null,
        viewportSliceLabels: {
          ...(item.viewportSliceLabels ?? createEmptyMprSliceLabels()),
          [viewportKey]: sliceLabel
        },
        viewportPlanes: {
          ...(item.viewportPlanes ?? createEmptyMprPlanes()),
          [viewportKey]: mprPlane ?? item.viewportPlanes?.[viewportKey] ?? null
        },
        viewportCrosshairs: {
          ...(item.viewportCrosshairs ?? createEmptyMprCrosshairs()),
          [viewportKey]: mprCrosshair ?? item.viewportCrosshairs?.[viewportKey] ?? null
        },
        viewportCornerInfos: {
          ...(item.viewportCornerInfos ?? createEmptyMprCornerInfos()),
          [viewportKey]: stateCornerInfo ?? item.viewportCornerInfos?.[viewportKey] ?? createEmptyCornerInfo()
        },
        viewportScaleBars: {
          ...(item.viewportScaleBars ?? createEmptyMprScaleBars()),
          [viewportKey]: scaleBar ?? item.viewportScaleBars?.[viewportKey] ?? null
        },
        viewportOrientations: {
          ...(item.viewportOrientations ?? createEmptyMprOrientations()),
          [viewportKey]: orientationInfo ?? item.viewportOrientations?.[viewportKey] ?? createEmptyOrientationInfo()
        },
        viewportTransformStates: {
          ...(item.viewportTransformStates ?? createEmptyMprTransformStates()),
          [viewportKey]: transformState ?? item.viewportTransformStates?.[viewportKey] ?? createDefaultTransformInfo()
        },
        mprMipConfig,
        mprCrosshairMode,
        fourDPhaseCache: nextFourDPhaseCache
      }
    })
    if (mprStateCompletionUpdate) {
      options.completeActiveMprCrosshairDragLock(mprStateCompletionUpdate)
    }
  }

  function normalizeProgressNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null
    }
    return Math.max(0, Math.min(100, value))
  }

  function normalizeViewProgressPayload(payload: ViewProgressInfo | undefined): ViewProgressInfo | null {
    if (!payload) {
      return null
    }

    const record = payload as unknown as Record<string, unknown>
    const viewId = typeof record.viewId === 'string' ? record.viewId : typeof record.view_id === 'string' ? record.view_id : ''
    if (!viewId) {
      return null
    }

    const phase = typeof record.phase === 'string' && record.phase ? record.phase : 'render'
    const loadedCount = typeof record.loadedCount === 'number'
      ? record.loadedCount
      : typeof record.loaded_count === 'number'
        ? record.loaded_count
        : null
    const totalCount = typeof record.totalCount === 'number'
      ? record.totalCount
      : typeof record.total_count === 'number'
        ? record.total_count
        : null

    return {
      viewId,
      phase,
      progressPercent: normalizeProgressNumber(record.progressPercent ?? record.progress_percent),
      loadedCount,
      totalCount,
      message: typeof record.message === 'string' ? record.message : null
    }
  }

  function isLikelyCtWindowLeakedIntoPetRange(minValue: number | null | undefined, maxValue: number | null | undefined, fusionInfo: FusionInfo): boolean {
    if (typeof minValue !== 'number' || typeof maxValue !== 'number') {
      return false
    }
    const unit = String(fusionInfo.petUnit ?? fusionInfo.petUnitLabel ?? '').toLowerCase()
    const isPetQuantUnit = unit.includes('suv') || unit.includes('sul') || unit.includes('g/ml')
    return isPetQuantUnit && minValue < -1 && maxValue >= 100
  }

  function normalizeFusionPetWindowRange(
    minCandidate: unknown,
    maxCandidate: unknown,
    fallback: FusionInfo,
    nextInfo: Pick<FusionInfo, 'petUnit' | 'petUnitLabel'>
  ): { min: number | null | undefined; max: number | null | undefined } {
    const minValue = typeof minCandidate === 'number' && Number.isFinite(minCandidate) ? Number(minCandidate) : fallback.petWindowMin
    const maxValue = typeof maxCandidate === 'number' && Number.isFinite(maxCandidate) ? Number(maxCandidate) : fallback.petWindowMax
    const candidateInfo = {
      ...fallback,
      petUnit: nextInfo.petUnit,
      petUnitLabel: nextInfo.petUnitLabel
    }
    if (!isLikelyCtWindowLeakedIntoPetRange(minValue, maxValue, candidateInfo)) {
      return { min: minValue, max: maxValue }
    }
    const fallbackIsLeaked = isLikelyCtWindowLeakedIntoPetRange(fallback.petWindowMin, fallback.petWindowMax, candidateInfo)
    return {
      min: fallbackIsLeaked ? DEFAULT_FUSION_PET_WINDOW_MIN : fallback.petWindowMin,
      max: fallbackIsLeaked ? DEFAULT_FUSION_PET_WINDOW_MAX : fallback.petWindowMax
    }
  }

  function formatFusionPetWindowLabel(fusionInfo: FusionInfo): string | null {
    const minValue =
      typeof fusionInfo.petWindowMin === 'number' && Number.isFinite(fusionInfo.petWindowMin)
        ? fusionInfo.petWindowMin
        : DEFAULT_FUSION_PET_WINDOW_MIN
    const maxValue =
      typeof fusionInfo.petWindowMax === 'number' && Number.isFinite(fusionInfo.petWindowMax)
        ? fusionInfo.petWindowMax
        : DEFAULT_FUSION_PET_WINDOW_MAX
    const unitLabel = stripTrailingUnitDetail(fusionInfo.petUnitLabel || (fusionInfo.petUnit === 'SUVbw' ? 'g/ml (SUVbw)' : fusionInfo.petUnit) || '')
    const unit = String(fusionInfo.petUnit ?? unitLabel).toLowerCase()
    const prefix = unit.includes('suv') || unit.includes('sul') || unit.includes('g/ml') ? 'SUV' : 'PET'
    return `${prefix}:${minValue.toFixed(2)}--${maxValue.toFixed(2)}${unitLabel}`.trim()
  }

  function stripTrailingUnitDetail(value: string): string {
    return value.replace(/\s*\([^)]*\)\s*$/, '').trim()
  }

  function normalizeFusionPetCornerInfo(cornerInfo: CornerInfo, fusionInfo: FusionInfo, paneKey: FusionPaneKey): CornerInfo {
    const label = formatFusionPetWindowLabel(fusionInfo)
    if (!label) {
      return cornerInfo
    }
    const isPetOnlyPane = paneKey === FUSION_PET_AXIAL_PANE_KEY || paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY
    const isPetWindowLine = (line: string): boolean => /^(?:SUV|PET)\s*:/i.test(line.trim())
    const isWindowLine = (line: string): boolean => /^\s*W\s*:/i.test(line.trim())
    const shouldReplaceLine = (line: string): boolean => isPetWindowLine(line) || (isPetOnlyPane && isWindowLine(line))
    const isMipPane = paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY
    const sliceThicknessLines = new Set(cornerInfo.tags?.sliceThickness ?? [])
    const shouldHideMipSourceSliceLine = (line: string): boolean => isMipPane && sliceThicknessLines.has(line)
    const nextBottomLeft = cornerInfo.bottomLeft
      .map((line) => (shouldReplaceLine(line) ? label : line))
      .filter((line) => !shouldHideMipSourceSliceLine(line))
    const hasPetLabel = nextBottomLeft.some((line) => line === label)
    const nextTags = { ...(cornerInfo.tags ?? {}) }
    if (isPetOnlyPane || (cornerInfo.tags?.windowLevel ?? []).some(isPetWindowLine)) {
      nextTags.windowLevel = [label]
    }
    if (isMipPane) {
      delete nextTags.imageIndex
      delete nextTags.sliceThickness
    }
    return {
      ...cornerInfo,
      bottomLeft: hasPetLabel || !isPetOnlyPane ? nextBottomLeft : [label, ...nextBottomLeft],
      tags: nextTags
    }
  }

  function normalizeFusionInfoPayload(value: unknown, fallback: FusionInfo): FusionInfo {
    if (typeof value !== 'object' || value == null) {
      return fallback
    }

    const record = value as Record<string, unknown>
    const registrationRecord =
      typeof record.registration === 'object' && record.registration != null
        ? (record.registration as Record<string, unknown>)
        : {}
    const numberOrFallback = (candidate: unknown, fallbackValue: number): number =>
      typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallbackValue
    const paneRoleCandidate = record.paneRole ?? record.pane_role
    const petPresetCandidate = record.petPseudocolorPreset ?? record.pet_pseudocolor_preset
    const petUnitCandidate = record.petUnit ?? record.pet_unit
    const petUnitLabelCandidate = record.petUnitLabel ?? record.pet_unit_label
    const petUnit = typeof petUnitCandidate === 'string' ? petUnitCandidate : fallback.petUnit
    const petUnitLabel = typeof petUnitLabelCandidate === 'string' ? petUnitLabelCandidate : fallback.petUnitLabel
    const petWindow = normalizeFusionPetWindowRange(
      record.petWindowMin ?? record.pet_window_min,
      record.petWindowMax ?? record.pet_window_max,
      fallback,
      { petUnit, petUnitLabel }
    )
    return {
      paneRole: typeof paneRoleCandidate === 'string' ? paneRoleCandidate : fallback.paneRole,
      ctSeriesId: typeof (record.ctSeriesId ?? record.ct_series_id) === 'string'
        ? String(record.ctSeriesId ?? record.ct_series_id)
        : fallback.ctSeriesId,
      petSeriesId: typeof (record.petSeriesId ?? record.pet_series_id) === 'string'
        ? String(record.petSeriesId ?? record.pet_series_id)
        : fallback.petSeriesId,
      petPseudocolorPreset: typeof petPresetCandidate === 'string'
        ? normalizeFusionPetPseudocolorPresetKey(petPresetCandidate)
        : fallback.petPseudocolorPreset,
      petUnit,
      petUnitLabel,
      petWindowMin: petWindow.min,
      petWindowMax: petWindow.max,
      alpha: numberOrFallback(record.alpha, fallback.alpha),
      revision: numberOrFallback(record.revision, fallback.revision),
      registration: {
        translateRowMm: numberOrFallback(
          registrationRecord.translateRowMm ?? registrationRecord.translate_row_mm,
          fallback.registration.translateRowMm
        ),
        translateColMm: numberOrFallback(
          registrationRecord.translateColMm ?? registrationRecord.translate_col_mm,
          fallback.registration.translateColMm
        ),
        rotationDegrees: numberOrFallback(
          registrationRecord.rotationDegrees ?? registrationRecord.rotation_degrees,
          fallback.registration.rotationDegrees
        ),
        saved: typeof registrationRecord.saved === 'boolean' ? registrationRecord.saved : fallback.registration.saved
      }
    }
  }

  function updateViewProgress(payload: ViewProgressInfo | undefined): void {
    const progress = normalizeViewProgressPayload(payload)
    if (!progress) {
      return
    }

    const nextProgress = progress.phase === 'complete' ? null : progress
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.viewId === progress.viewId) {
        if (nextProgress && item.imageSrc) {
          return item
        }
        return {
          ...item,
          loadingProgress: nextProgress
        }
      }

      const viewportKey = Object.entries(item.viewportViewIds ?? {}).find(([, viewId]) => viewId === progress.viewId)?.[0] as
        | MprViewportKey
        | undefined
      if (viewportKey && (item.viewType === 'MPR' || item.viewType === '4D')) {
        if (nextProgress && item.viewportImages?.[viewportKey]) {
          return item
        }
        return {
          ...item,
          viewportLoadingProgress: {
            ...(item.viewportLoadingProgress ?? {}),
            [viewportKey]: nextProgress
          }
        }
      }

      const fusionViewportKey = Object.entries(item.fusionViewIds ?? {}).find(([, viewId]) => viewId === progress.viewId)?.[0] as
        | FusionPaneKey
        | undefined
      if (fusionViewportKey && item.viewType === 'PETCTFusion') {
        if (nextProgress && item.fusionImages?.[fusionViewportKey]) {
          return item
        }
        return {
          ...item,
          fusionLoadingProgress: {
            ...(item.fusionLoadingProgress ?? createEmptyFusionLoadingProgress()),
            [fusionViewportKey]: nextProgress
          }
        }
      }

      return item
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
        const update = collectViewSizeUpdate(viewId, resolveMprViewportElement(viewportKey), force)
        if (!update) {
          return null
        }
        return { viewportKey, ...update }
      })
      .filter((item): item is MprViewSizeUpdate => Boolean(item))
  }

  function resolveCompareViewportElement(viewportKey: CompareStackPaneKey): HTMLElement | null {
    const cachedSurface = resolveCachedViewportSurface(viewportKey)
    if (cachedSurface) {
      return cachedSurface
    }

    return (
      options.viewerStage.value?.querySelector<HTMLElement>(`[data-active-render-surface][data-viewport-key="${viewportKey}"]`) ??
      options.viewerStage.value?.querySelector<HTMLElement>(`[data-viewport-key="${viewportKey}"]`) ??
      null
    )
  }

  function collectCompareViewSizeUpdates(
    compareViewIds: Partial<Record<CompareStackPaneKey, string>> | undefined,
    force = false
  ): CompareViewSizeUpdate[] {
    const entries = Object.entries(compareViewIds ?? {}) as [CompareStackPaneKey, string][]
    return entries
      .filter(([viewportKey, viewId]) => isCompareStackPaneKey(viewportKey) && Boolean(viewId))
      .map(([viewportKey, viewId]) => {
        const update = collectViewSizeUpdate(viewId, resolveCompareViewportElement(viewportKey), force)
        if (!update) {
          return null
        }
        return { viewportKey, ...update }
      })
      .filter((item): item is CompareViewSizeUpdate => Boolean(item))
  }

  function resolveFusionViewportElement(viewportKey: FusionPaneKey): HTMLElement | null {
    const cachedSurface = resolveCachedViewportSurface(viewportKey)
    if (cachedSurface) {
      return cachedSurface
    }

    return (
      options.viewerStage.value?.querySelector<HTMLElement>(`[data-active-render-surface][data-viewport-key="${viewportKey}"]`) ??
      options.viewerStage.value?.querySelector<HTMLElement>(`[data-viewport-key="${viewportKey}"]`) ??
      null
    )
  }

  function collectFusionViewSizeUpdates(
    fusionViewIds: Partial<Record<FusionPaneKey, string>> | undefined,
    force = false
  ): FusionViewSizeUpdate[] {
    const entries = Object.entries(fusionViewIds ?? {}) as [FusionPaneKey, string][]
    return entries
      .filter(([viewportKey, viewId]) => isFusionPaneKey(viewportKey) && Boolean(viewId))
      .map(([viewportKey, viewId]) => {
        const update = collectViewSizeUpdate(viewId, resolveFusionViewportElement(viewportKey), force)
        if (!update) {
          return null
        }
        return { viewportKey, ...update }
      })
      .filter((item): item is FusionViewSizeUpdate => Boolean(item))
  }

  function resolveLayoutViewportElement(slotId: string): HTMLElement | null {
    const cachedSurface = resolveCachedViewportSurface(slotId)
    if (cachedSurface) {
      return cachedSurface
    }

    return (
      options.viewerStage.value?.querySelector<HTMLElement>(`[data-active-render-surface][data-viewport-key="${slotId}"]`) ??
      options.viewerStage.value?.querySelector<HTMLElement>(`[data-viewport-key="${slotId}"]`) ??
      null
    )
  }

  function collectLayoutViewSizeUpdates(
    slots: ViewerLayoutSlot[] | undefined,
    force = false
  ): LayoutViewSizeUpdate[] {
    return (slots ?? [])
      .filter((slot) => Boolean(slot.viewId))
      .map((slot) => {
        const update = collectViewSizeUpdate(slot.viewId, resolveLayoutViewportElement(slot.id), force)
        if (!update) {
          return null
        }
        return { slotId: slot.id, ...update }
      })
      .filter((item): item is LayoutViewSizeUpdate => Boolean(item))
  }

  function collectViewSizeUpdate(
    viewId: string | null | undefined,
    element: HTMLElement | null,
    force = false
  ): ViewSizeUpdate | null {
    if (!viewId) {
      return null
    }

    const size = getViewportSize(element)
    if (!size) {
      return null
    }

    const sizeChanged = hasViewSizeChanged(viewId, size)
    if (!force && !sizeChanged) {
      return null
    }

    return { viewId, size }
  }

  function viewSizeUpdatesToViewIds(updates: MprViewSizeUpdate[]): Partial<Record<MprViewportKey, string>> {
    return updates.reduce<Partial<Record<MprViewportKey, string>>>((accumulator, update) => {
      accumulator[update.viewportKey] = update.viewId
      return accumulator
    }, {})
  }

  async function postMprViewSizeUpdates(updates: MprViewSizeUpdate[], renderOnBind = true): Promise<void> {
    await postViewSizeUpdates(updates, renderOnBind)
  }

  async function postCompareViewSizeUpdates(updates: CompareViewSizeUpdate[], renderOnBind = true): Promise<void> {
    await postViewSizeUpdates(updates, renderOnBind)
  }

  async function postFusionViewSizeUpdates(updates: FusionViewSizeUpdate[], renderOnBind = true): Promise<void> {
    await postViewSizeUpdates(updates, renderOnBind)
  }

  async function postLayoutViewSizeUpdates(updates: LayoutViewSizeUpdate[], renderOnBind = true): Promise<void> {
    await postViewSizeUpdates(updates, renderOnBind)
  }

  async function postViewSizeUpdates(updates: ViewSizeUpdate[], renderOnBind = true): Promise<void> {
    await Promise.all(updates.map((update) => postViewSizeUpdate(update, renderOnBind)))
  }

  async function postViewSizeUpdate(update: ViewSizeUpdate | null, renderOnBind = true): Promise<void> {
    if (!update) {
      return
    }

    await viewSizeUpdateDeduper.run(update, renderOnBind, async () => {
      if (renderOnBind) {
        await postApi('SetViewSizeApiV1ViewSetSizePost', {
          opType: VIEW_OPERATION_TYPES.setSize,
          size: update.size,
          viewId: update.viewId
        })
        bindView(update.viewId)
        return
      }

      await bindViewSilentlyWithAck(update.viewId)
      await postApi('SetViewSizeApiV1ViewSetSizePost', {
        opType: VIEW_OPERATION_TYPES.setSize,
        size: update.size,
        viewId: update.viewId
      })
    })
  }

  async function waitForCompareViewportLayout(compareViewIds: Partial<Record<CompareStackPaneKey, string>>): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await nextTick()
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const requiredKeys = (Object.keys(compareViewIds) as CompareStackPaneKey[]).filter((key) => Boolean(compareViewIds[key]))
      if (requiredKeys.length > 0 && requiredKeys.every((key) => Boolean(getViewportSize(resolveCompareViewportElement(key))))) {
        return
      }
    }
  }

  async function waitForFusionViewportLayout(fusionViewIds: Partial<Record<FusionPaneKey, string>>): Promise<void> {
    for (let attempt = 0; attempt < VIEWPORT_LAYOUT_WAIT_FRAMES; attempt += 1) {
      await nextTick()
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const requiredKeys = (Object.keys(fusionViewIds) as FusionPaneKey[]).filter((key) => Boolean(fusionViewIds[key]))
      if (requiredKeys.length > 0 && requiredKeys.every((key) => Boolean(getViewportSize(resolveFusionViewportElement(key))))) {
        return
      }
    }
  }

  async function waitForLayoutViewportLayout(slots: ViewerLayoutSlot[]): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await nextTick()
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const requiredSlotIds = slots.filter((slot) => Boolean(slot.viewId)).map((slot) => slot.id)
      if (!requiredSlotIds.length || requiredSlotIds.every((slotId) => Boolean(getViewportSize(resolveLayoutViewportElement(slotId))))) {
        return
      }
    }
  }

  function getRequiredMprViewportKeys(viewportViewIds: Partial<Record<MprViewportKey, string>>): MprViewportKey[] {
    return (Object.keys(viewportViewIds) as MprViewportKey[]).filter((key) => Boolean(viewportViewIds[key]))
  }

  function getMissingMprViewportLayoutKeys(viewportViewIds: Partial<Record<MprViewportKey, string>>): MprViewportKey[] {
    return getRequiredMprViewportKeys(viewportViewIds).filter((key) => !getViewportSize(resolveMprViewportElement(key)))
  }

  function hasCompleteMprViewportLayout(viewportViewIds: Partial<Record<MprViewportKey, string>>): boolean {
    const requiredKeys = getRequiredMprViewportKeys(viewportViewIds)
    return requiredKeys.length > 0 && getMissingMprViewportLayoutKeys(viewportViewIds).length === 0
  }

  async function waitForMprViewportLayout(viewportViewIds: Partial<Record<MprViewportKey, string>>): Promise<boolean> {
    for (let attempt = 0; attempt < VIEWPORT_LAYOUT_WAIT_FRAMES; attempt += 1) {
      await nextTick()
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      if (hasCompleteMprViewportLayout(viewportViewIds)) {
        return true
      }
    }
    return hasCompleteMprViewportLayout(viewportViewIds)
  }

  async function renderMprViewIds(
    viewportViewIds: Partial<Record<MprViewportKey, string>> | undefined,
    force = false,
    renderOnBind = true
  ): Promise<Partial<Record<MprViewportKey, string>>> {
    let updates = collectMprViewSizeUpdates(viewportViewIds, force)
    if (!updates.length && Object.values(viewportViewIds ?? {}).some(Boolean)) {
      await waitForMprViewportLayout(viewportViewIds ?? {})
      updates = collectMprViewSizeUpdates(viewportViewIds, force)
    }
    await postMprViewSizeUpdates(updates, renderOnBind)
    return viewSizeUpdatesToViewIds(updates)
  }

  async function renderFusionViewIds(
    fusionViewIds: Partial<Record<FusionPaneKey, string>> | undefined,
    force = false
  ): Promise<void> {
    let updates = collectFusionViewSizeUpdates(fusionViewIds, force)
    if (!updates.length && Object.values(fusionViewIds ?? {}).some(Boolean)) {
      await waitForFusionViewportLayout(fusionViewIds ?? {})
      updates = collectFusionViewSizeUpdates(fusionViewIds, force)
    }
    await postFusionViewSizeUpdates(updates)
  }

  async function renderFourDPhaseSizeUpdatesAndWait(
    tabKey: string,
    phaseKey: string,
    viewportViewIds: Partial<Record<MprViewportKey, string>>,
    force = false
  ): Promise<Partial<Record<MprViewportKey, string>>> {
    if (!hasCompleteMprViewportLayout(viewportViewIds)) {
      await waitForMprViewportLayout(viewportViewIds)
    }

    const updates = collectMprViewSizeUpdates(viewportViewIds, force)
    const updatedViewIds = viewSizeUpdatesToViewIds(updates)
    const renderWait = updates.length
      ? fourDPhaseRenderTracker.waitForRender(tabKey, phaseKey, updatedViewIds)
      : Promise.resolve()
    await postMprViewSizeUpdates(updates, false)
    await renderWait
    return updatedViewIds
  }

  async function renderTabNow(tabKey: string, force = false): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab) {
      return
    }

    if (tab.viewType === 'Tag') {
      return
    }

    if (tab.viewType === 'MPR' || tab.viewType === '4D') {
      await renderMprViewIds(tab.viewportViewIds, force)
      if (tab.viewType === 'MPR' && tab.viewId) {
        await postViewSizeUpdate(collectViewSizeUpdate(tab.viewId, resolveVolumeViewportElement(), force))
      }
      return
    }

    if (tab.viewType === 'CompareStack') {
      await postCompareViewSizeUpdates(collectCompareViewSizeUpdates(tab.compareViewIds, force))
      return
    }

    if (tab.viewType === 'PETCTFusion') {
      await renderFusionViewIds(tab.fusionViewIds, force)
      return
    }

    if (tab.viewType === '3D') {
      await postViewSizeUpdate(collectViewSizeUpdate(tab.viewId, resolveVolumeViewportElement(), force))
      return
    }

    if (tab.viewType === 'Layout') {
      await postLayoutViewSizeUpdates(collectLayoutViewSizeUpdates(tab.layoutSlots, force))
      return
    }

    if (!tab.viewId) {
      return
    }

    await postViewSizeUpdate(collectViewSizeUpdate(tab.viewId, resolveSingleViewportElement(), force))
  }

  function renderTab(tabKey: string, force = false): Promise<void> {
    return renderTabScheduler.schedule(tabKey, force)
  }

  async function ensureMprVolumeView(tabKey: string): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== 'MPR' || tab.viewId) {
      return
    }

    const data = await postApi('CreateViewApiV1ViewCreatePost', {
      seriesId: tab.seriesId,
      viewType: '3D'
    })
    const volumeConfig = tab.volumeRenderConfig ?? createDefaultVolumeRenderConfig(tab.volumePreset ?? 'bone')
    const volumePreset = tab.volumePreset ?? `volumePreset:${normalizeVolumePresetKey(volumeConfig.preset)}`
    const surfaceConfig = tab.surfaceRenderConfig ?? createDefaultSurfaceRenderConfig()

    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tabKey && item.viewType === 'MPR'
        ? {
            ...item,
            viewId: data.viewId,
            imageSrc: '',
            loadingProgress: null,
            orientation: createEmptyOrientationInfo(),
            transformState: createDefaultTransformInfo(),
            volumePreset,
            volumeRenderConfig: volumeConfig,
            render3dMode: tab.render3dMode ?? 'volume',
            surfaceRenderConfig: surfaceConfig
          }
        : item
    )
    bindView(data.viewId)
  }

  async function openSeriesView(seriesId: string, viewType: ViewType): Promise<void> {
    if (!seriesId) {
      return
    }
    if (viewType === 'CompareStack' || viewType === 'Layout' || viewType === 'PETCTFusion') {
      return
    }

    options.selectedSeriesId.value = seriesId
    const targetSeries = options.seriesList.value.find((item) => item.seriesId === seriesId) ?? null
    if (!isSeriesViewSupported(targetSeries, viewType)) {
      options.message.value = viewMessage(`当前序列不支持 ${viewType} 视图。`, `${viewType} view is not supported for this series.`)
      return
    }
    if (viewType === '4D' && !isFourDSeriesItem(targetSeries)) {
      options.message.value = viewMessage('当前序列不是 4D 序列。', 'The current series is not a 4D series.')
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
      if (viewType === '3D' && !existingTab.imageSrc) {
        options.activeViewportKey.value = 'volume'
        options.isViewLoading.value = false
        await nextTick()
        await renderTab(existingTab.key, true)
      }
      if (viewType === 'Stack' && !existingTab.imageSrc) {
        options.activeViewportKey.value = 'single'
        options.isViewLoading.value = false
        await nextTick()
        await renderTab(existingTab.key, true)
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
      const initialPseudocolorPreset = normalizePseudocolorPresetKey(selectedPseudocolorKey.value)
      let nextViewId = ''
      let nextViewportViewIds = createEmptyMprViewIds()

      if (viewType === 'MPR') {
        const responses = await Promise.all(
          MPR_VIEWPORT_KEYS.map(async (viewportKey) => {
            const data = await postApi('CreateViewApiV1ViewCreatePost', {
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
        const data = await postApi('CreateViewApiV1ViewCreatePost', {
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
              loadingProgress: null,
              sliceLabel: '',
              windowLabel: '',
              mprFrame: null,
              mprCursor: null,
              viewportViewIds: nextViewportViewIds,
              viewportImages: createEmptyMprImages(),
              viewportLoadingProgress: {},
              viewportSliceLabels: createEmptyMprSliceLabels(),
              viewportPlanes: createEmptyMprPlanes(),
              viewportCrosshairs: createEmptyMprCrosshairs(),
              viewportScaleBars: createEmptyMprScaleBars(),
              measurements: [],
              annotations: [],
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
              viewportAnnotations: {},
              viewportOrientations: createEmptyMprOrientations(),
              transformState: createDefaultTransformInfo(),
              viewportTransformStates: createEmptyMprTransformStates(),
              pseudocolorPreset: initialPseudocolorPreset,
              viewportPseudocolorPresets:
                viewType === 'MPR'
                  ? {
                      'mpr-ax': initialPseudocolorPreset,
                      'mpr-cor': initialPseudocolorPreset,
                      'mpr-sag': initialPseudocolorPreset
                    }
                  : createEmptyMprPseudocolorPresets(),
              mprMipConfig: createDefaultMprMipConfig(),
              volumePreset: 'volumePreset:bone',
              volumeRenderConfig: createDefaultVolumeRenderConfig('bone'),
              render3dMode: 'volume',
              surfaceRenderConfig: createDefaultSurfaceRenderConfig()
            }
          : item
      )

      if (viewType !== 'MPR' && nextViewId) {
        await bindViewSilentlyWithAck(nextViewId)
        await emitInitialPseudocolorOperation(nextViewId, initialPseudocolorPreset)
      }

      options.activeViewportKey.value = viewType === 'MPR' ? 'mpr-ax' : viewType === '3D' ? 'volume' : 'single'
      options.activeTabKey.value = tabKey
      if (viewType === 'MPR') {
        options.isViewLoading.value = false
        await waitForMprViewportLayout(nextViewportViewIds)
        await bindMprViewIdsSilentlyWithAck(nextViewportViewIds)
        await Promise.all(
          Object.values(nextViewportViewIds).map((viewId) => emitInitialPseudocolorOperation(viewId, initialPseudocolorPreset))
        )
      } else if (viewType === '3D') {
        options.isViewLoading.value = false
      } else {
        options.isViewLoading.value = false
      }
      await nextTick()
      await renderTab(tabKey)
      options.message.value = ''
    } catch (error) {
      handleOpenSeriesViewFailure(error, seriesId, viewType, tabKey)
      console.error(error)
    } finally {
      options.isViewLoading.value = false
    }
  }

  async function openPetCtFusion(ctSeriesId: string, petSeriesId: string): Promise<void> {
    if (!ctSeriesId || !petSeriesId || ctSeriesId === petSeriesId) {
      return
    }

    const ctSeries = options.seriesList.value.find((item) => item.seriesId === ctSeriesId) ?? null
    const petSeries = options.seriesList.value.find((item) => item.seriesId === petSeriesId) ?? null
    if (!ctSeries || !petSeries) {
      options.message.value = viewMessage('PET/CT 融合序列不存在或已被移除。', 'The PET/CT fusion series does not exist or has been removed.')
      return
    }

    options.selectedSeriesId.value = ctSeriesId
    const tabKey = createPetCtFusionTabKey(ctSeriesId, petSeriesId)
    const existingTab = options.viewerTabs.value.find((item) => item.key === tabKey)
    const hasExistingViews = FUSION_PANE_KEYS.every((paneKey) => Boolean(existingTab?.fusionViewIds?.[paneKey]))
    if (existingTab && hasExistingViews) {
      options.activeTabKey.value = existingTab.key
      options.activeViewportKey.value = FUSION_OVERLAY_AXIAL_PANE_KEY
      await nextTick()
      await waitForFusionViewportLayout(existingTab.fusionViewIds ?? {})
      await renderTab(existingTab.key, true)
      return
    }

    if (!existingTab) {
      const tab: ViewerTabItem = {
        ...createTab(ctSeries, 'PETCTFusion'),
        key: tabKey,
        title: `${getSeriesDisplayName(ctSeries, ctSeriesId)} + ${getSeriesDisplayName(petSeries, petSeriesId)} · PET/CT`,
        viewType: 'PETCTFusion',
        seriesId: ctSeriesId,
        seriesTitle: getSeriesDisplayName(ctSeries, ctSeriesId),
        viewId: '',
        imageSrc: '',
        fusionSeriesIds: { ctSeriesId, petSeriesId },
        fusionViewIds: createEmptyFusionViewIds(),
        fusionImages: createEmptyFusionImages(),
        fusionSliceLabels: createEmptyFusionSliceLabels(),
        fusionWindowLabels: createEmptyFusionWindowLabels(),
        fusionScaleBars: createEmptyFusionScaleBars(),
        fusionCornerInfos: createEmptyFusionCornerInfos(),
        fusionOrientations: createEmptyFusionOrientations(),
        fusionTransformStates: createEmptyFusionTransformStates(),
        fusionPseudocolorPresets: createEmptyFusionPseudocolorPresets(),
        fusionProjections: createEmptyFusionProjections(),
        fusionLoadingProgress: createEmptyFusionLoadingProgress(),
        fusionInfo: createDefaultFusionInfo(ctSeriesId, petSeriesId),
        fusionManualRegistration: false
      }
      options.viewerTabs.value = [...options.viewerTabs.value, tab]
    }

    options.activeTabKey.value = tabKey
    options.activeViewportKey.value = FUSION_OVERLAY_AXIAL_PANE_KEY
    options.isViewLoading.value = true

    try {
      const [ctCornerInfo, petCornerInfo, nextFusionViewIds] = await Promise.all([
        options.ensureSeriesCornerInfo(ctSeriesId),
        options.ensureSeriesCornerInfo(petSeriesId),
        createFusionViewIds(ctSeriesId, petSeriesId, tabKey)
      ])
      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === tabKey
          ? {
              ...item,
              viewType: 'PETCTFusion',
              title: `${getSeriesDisplayName(ctSeries, ctSeriesId)} + ${getSeriesDisplayName(petSeries, petSeriesId)} · PET/CT`,
              seriesId: ctSeriesId,
              seriesTitle: getSeriesDisplayName(ctSeries, ctSeriesId),
              viewId: '',
              imageSrc: '',
              sliceLabel: '',
              windowLabel: '',
              fusionSeriesIds: { ctSeriesId, petSeriesId },
              fusionViewIds: nextFusionViewIds,
              fusionImages: createEmptyFusionImages(),
              fusionSliceLabels: createEmptyFusionSliceLabels(),
              fusionWindowLabels: createEmptyFusionWindowLabels(),
              fusionScaleBars: createEmptyFusionScaleBars(),
              fusionCornerInfos: {
                [FUSION_CT_AXIAL_PANE_KEY]: options.withHoverCornerInfo(ctCornerInfo),
                [FUSION_PET_AXIAL_PANE_KEY]: options.withHoverCornerInfo(petCornerInfo),
                [FUSION_OVERLAY_AXIAL_PANE_KEY]: options.withHoverCornerInfo(ctCornerInfo),
                [FUSION_PET_CORONAL_MIP_PANE_KEY]: options.withHoverCornerInfo(petCornerInfo)
              },
              fusionOrientations: createEmptyFusionOrientations(),
              fusionTransformStates: createEmptyFusionTransformStates(),
              fusionPseudocolorPresets: createEmptyFusionPseudocolorPresets(),
              fusionProjections: createEmptyFusionProjections(),
              fusionLoadingProgress: createEmptyFusionLoadingProgress(),
              fusionInfo: createDefaultFusionInfo(ctSeriesId, petSeriesId),
              fusionManualRegistration: false,
              viewportMeasurements: {},
              viewportAnnotations: {}
            }
          : item
      )

      options.isViewLoading.value = false
      await nextTick()
      await waitForFusionViewportLayout(nextFusionViewIds)
      await bindFusionViewIdsSilentlyWithAck(nextFusionViewIds)
      await renderTab(tabKey, true)
      options.message.value = ''
    } catch (error) {
      closeIncompleteTab(tabKey)
      const detail = resolveBackendErrorDetail(error)
      options.message.value = detail
        ? viewMessage(`PET/CT 融合浏览打开失败：${detail}`, `Failed to open PET/CT fusion view: ${detail}`)
        : viewMessage('PET/CT 融合浏览打开失败。', 'Failed to open PET/CT fusion view.')
      console.error(error)
    } finally {
      options.isViewLoading.value = false
    }
  }

  async function openSeriesCompare(sourceSeriesId: string, targetSeriesId: string): Promise<void> {
    if (!sourceSeriesId || !targetSeriesId || sourceSeriesId === targetSeriesId) {
      return
    }

    const sourceSeries = options.seriesList.value.find((item) => item.seriesId === sourceSeriesId) ?? null
    const targetSeries = options.seriesList.value.find((item) => item.seriesId === targetSeriesId) ?? null
    if (!sourceSeries || !targetSeries) {
      options.message.value = viewMessage('对比序列不存在或已被移除。', 'The compare series does not exist or has been removed.')
      return
    }

    options.selectedSeriesId.value = sourceSeriesId
    const tabKey = createCompareStackTabKey(sourceSeriesId, targetSeriesId)
    const initialPseudocolorPreset = normalizePseudocolorPresetKey(selectedPseudocolorKey.value)
    const existingTab = options.viewerTabs.value.find((item) => item.key === tabKey)
    const hasExistingViews = COMPARE_STACK_PANE_KEYS.every((viewportKey) => Boolean(existingTab?.compareViewIds?.[viewportKey]))

    if (existingTab && hasExistingViews) {
      options.viewerTabs.value = options.viewerTabs.value.map((item) => {
        if (item.key !== existingTab.key) {
          return item
        }

        Object.values(item.compareImages ?? {}).forEach(revokeObjectUrlIfNeeded)
        return {
          ...item,
          pseudocolorPreset: initialPseudocolorPreset,
          compareImages: createEmptyCompareImages(),
          comparePseudocolorPresets: createComparePseudocolorPresetMap(initialPseudocolorPreset)
        }
      })
      options.activeTabKey.value = existingTab.key
      options.activeViewportKey.value = COMPARE_STACK_SOURCE_PANE_KEY
      await nextTick()
      await waitForCompareViewportLayout(existingTab.compareViewIds ?? {})
      await renderTab(existingTab.key, true)
      const refreshedTab = options.viewerTabs.value.find((item) => item.key === existingTab.key) ?? existingTab
      await emitComparePseudocolorOperations(refreshedTab.compareViewIds ?? {}, refreshedTab, initialPseudocolorPreset)
      return
    }

    if (!existingTab) {
      const tab = {
        ...createTab(sourceSeries, 'CompareStack'),
        key: tabKey,
        title: `${getSeriesDisplayName(sourceSeries, sourceSeriesId)} vs ${getSeriesDisplayName(targetSeries, targetSeriesId)} · Stack`,
        compareSeriesIds: createComparePaneRecord((paneKey) =>
          paneKey === COMPARE_STACK_SOURCE_PANE_KEY ? sourceSeriesId : targetSeriesId
        ),
        compareSeriesTitles: createComparePaneRecord((paneKey) =>
          paneKey === COMPARE_STACK_SOURCE_PANE_KEY
            ? getSeriesDisplayName(sourceSeries, sourceSeriesId)
            : getSeriesDisplayName(targetSeries, targetSeriesId)
        )
      }
      options.viewerTabs.value = [...options.viewerTabs.value, tab]
    }

    options.activeTabKey.value = tabKey
    options.activeViewportKey.value = COMPARE_STACK_SOURCE_PANE_KEY
    options.isViewLoading.value = true

    try {
      const [sourceCornerInfo, targetCornerInfo, nextCompareViewIds] = await Promise.all([
        options.ensureSeriesCornerInfo(sourceSeriesId),
        options.ensureSeriesCornerInfo(targetSeriesId),
        createCompareStackViewIds(sourceSeriesId, targetSeriesId)
      ])

      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === tabKey
          ? {
              ...item,
              viewType: 'CompareStack',
              viewId: '',
              imageSrc: '',
              sliceLabel: '',
              windowLabel: '',
              title: `${getSeriesDisplayName(sourceSeries, sourceSeriesId)} vs ${getSeriesDisplayName(targetSeries, targetSeriesId)} · Stack`,
              seriesId: sourceSeriesId,
              seriesTitle: getSeriesDisplayName(sourceSeries, sourceSeriesId),
              pseudocolorPreset: initialPseudocolorPreset,
              compareSeriesIds: createComparePaneRecord((paneKey) =>
                paneKey === COMPARE_STACK_SOURCE_PANE_KEY ? sourceSeriesId : targetSeriesId
              ),
              compareSeriesTitles: createComparePaneRecord((paneKey) =>
                paneKey === COMPARE_STACK_SOURCE_PANE_KEY
                  ? getSeriesDisplayName(sourceSeries, sourceSeriesId)
                  : getSeriesDisplayName(targetSeries, targetSeriesId)
              ),
              compareViewIds: nextCompareViewIds,
              compareImages: createEmptyCompareImages(),
              compareSliceLabels: createEmptyCompareSliceLabels(),
              compareWindowLabels: createEmptyCompareWindowLabels(),
              compareScaleBars: createEmptyCompareScaleBars(),
              compareCornerInfos: createComparePaneRecord((paneKey) =>
                paneKey === COMPARE_STACK_SOURCE_PANE_KEY
                  ? options.withHoverCornerInfo(sourceCornerInfo)
                  : options.withHoverCornerInfo(targetCornerInfo)
              ),
              compareOrientations: createEmptyCompareOrientations(),
              compareTransformStates: createEmptyCompareTransformStates(),
              comparePseudocolorPresets: createComparePseudocolorPresetMap(initialPseudocolorPreset),
              compareSyncScroll: item.compareSyncScroll ?? COMPARE_SYNC_DEFAULTS.scroll,
              compareSyncWindow: item.compareSyncWindow ?? COMPARE_SYNC_DEFAULTS.window,
              compareSyncPseudocolor: item.compareSyncPseudocolor ?? COMPARE_SYNC_DEFAULTS.pseudocolor,
              compareSyncView: item.compareSyncView ?? COMPARE_SYNC_DEFAULTS.view,
              compareSyncTransform: item.compareSyncTransform ?? COMPARE_SYNC_DEFAULTS.transform,
              compareSyncReset: item.compareSyncReset ?? COMPARE_SYNC_DEFAULTS.reset
            }
          : item
      )

      options.isViewLoading.value = false
      await waitForCompareViewportLayout(nextCompareViewIds)
      await renderTab(tabKey, true)
      const refreshedTab = options.viewerTabs.value.find((item) => item.key === tabKey)
      if (refreshedTab) {
        await emitComparePseudocolorOperations(nextCompareViewIds, refreshedTab, initialPseudocolorPreset)
      }
      options.message.value = ''
    } catch (error) {
      options.message.value = viewMessage('Stack 对比视图打开失败。', 'Failed to open the Stack compare view.')
      console.error(error)
    } finally {
      options.isViewLoading.value = false
    }
  }

  async function openLayoutView(template: ViewerLayoutTemplate): Promise<void> {
    const activeTab = options.viewerTabs.value.find((item) => item.key === options.activeTabKey.value)
    const sourceSeriesId = activeTab?.seriesId ?? options.selectedSeriesId.value
    const sourceSeries = options.seriesList.value.find((item) => item.seriesId === sourceSeriesId)
    if (!sourceSeries) {
      return
    }

    const layoutTemplate = cloneViewerLayoutTemplate(template)
    const seededLayoutSlots = await createSeededLayoutSlots(
      layoutTemplate,
      activeTab ?? null,
      cloneLayoutImageSrc,
      options.activeViewportKey.value
    )
    const layoutSlots = await hydrateLayoutStackSlots(seededLayoutSlots, activeTab?.viewType !== 'Layout')
    const title = `${getSeriesDisplayName(sourceSeries, sourceSeries.seriesId)} - Layout ${layoutTemplate.label}`
    let nextTabKey = ''

    if (activeTab) {
      nextTabKey = createInlineLayoutTabKey(activeTab)
      if (activeTab.viewType !== 'Layout') {
        releaseTabRenderResources(activeTab)
      } else {
        releaseDiscardedLayoutSlotViews(activeTab.layoutSlots, layoutSlots)
      }
      revokeLayoutSlotImages(activeTab.layoutSlots)
      options.viewerTabs.value = options.viewerTabs.value.map((item) =>
        item.key === activeTab.key
          ? {
              ...item,
              key: nextTabKey,
              viewType: 'Layout',
              title,
              viewId: '',
              imageSrc: '',
              sliceLabel: '',
              windowLabel: '',
              compareViewIds: createEmptyCompareViewIds(),
              compareImages: createEmptyCompareImages(),
              compareSliceLabels: createEmptyCompareSliceLabels(),
              compareWindowLabels: createEmptyCompareWindowLabels(),
              viewportViewIds: createEmptyMprViewIds(),
              viewportImages: createEmptyMprImages(),
              viewportSliceLabels: createEmptyMprSliceLabels(),
              fourDPhaseViewIds: {},
              fourDPhaseCache: {},
              fourDIsPlaying: false,
              fourDIsPreloading: false,
              layoutTemplate,
              layoutSlots
            }
          : item
      )
      options.activeTabKey.value = nextTabKey
    } else {
      const tab = {
        ...createLayoutTab(sourceSeries, layoutTemplate),
        title,
        layoutSlots
      }
      options.viewerTabs.value = [...options.viewerTabs.value, tab]
      options.activeTabKey.value = tab.key
      nextTabKey = tab.key
    }

    options.selectedSeriesId.value = sourceSeries.seriesId
    const refreshedTab = options.viewerTabs.value.find((item) => item.key === nextTabKey)
    options.activeViewportKey.value = refreshedTab ? getFirstLayoutViewportKey(refreshedTab) : 'layout'
    await nextTick()
    await waitForLayoutViewportLayout(layoutSlots)
    await renderTab(nextTabKey, true)
    await emitLayoutPseudocolorOperations(layoutSlots)
    options.message.value = ''
  }

  async function setLayoutSlotSeries(payload: { tabKey: string; slotId: string; series: FolderSeriesItem; activateSlot?: boolean }): Promise<void> {
    const seriesTitle = getSeriesDisplayName(payload.series, payload.series.seriesId)
    const tab = options.viewerTabs.value.find((item) => item.key === payload.tabKey)
    const previousSlot = tab?.layoutSlots?.find((slot) => slot.id === payload.slotId)
    const seriesCornerInfo = await options.ensureSeriesCornerInfo(payload.series.seriesId)
    if (previousSlot?.viewId) {
      releaseBackendViews([previousSlot.viewId])
      viewSizeCache.delete(previousSlot.viewId)
    }
    const nextSlot = await createLayoutStackSlotView(
      {
        ...(previousSlot ?? {
          id: payload.slotId,
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          viewType: 'Stack'
        }),
        seriesId: payload.series.seriesId,
        seriesTitle,
        viewType: 'Stack',
        sourceViewType: 'Stack',
        viewportKey: 'single',
        imageSrc: '',
        ownsImageSrc: false,
        sliceLabel: getSeriesLayoutSliceLabel(payload.series),
        windowLabel: '',
        cornerInfo: seriesCornerInfo,
        orientation: createEmptyOrientationInfo(),
        scaleBar: null,
        transformState: createDefaultTransformInfo(),
        pseudocolorPreset: normalizePseudocolorPresetKey(selectedPseudocolorKey.value)
      },
      true
    )

    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.key !== payload.tabKey || item.viewType !== 'Layout') {
        return item
      }

      return {
        ...item,
        viewportMeasurements: {
          ...(item.viewportMeasurements ?? {}),
          [payload.slotId]: []
        },
        mtfState: item.mtfState
          ? {
              items: item.mtfState.items.filter((mtfItem) => mtfItem.viewportKey !== payload.slotId),
              selectedMtfId:
                item.mtfState.selectedMtfId &&
                item.mtfState.items.some((mtfItem) => mtfItem.viewportKey !== payload.slotId && mtfItem.mtfId === item.mtfState?.selectedMtfId)
                  ? item.mtfState.selectedMtfId
                  : null
            }
          : item.mtfState,
        layoutSlots: (item.layoutSlots ?? []).map((slot) => {
          if (slot.id !== payload.slotId) {
            return slot
          }

          if (slot.ownsImageSrc) {
            revokeObjectUrlIfNeeded(slot.imageSrc)
          }

          return nextSlot
        })
      }
    })
    if (payload.activateSlot !== false) {
      options.activeViewportKey.value = payload.slotId
    }
    await nextTick()
    await waitForLayoutViewportLayout([nextSlot])
    await renderTab(payload.tabKey, true)
    await emitLayoutPseudocolorOperations([nextSlot])
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
    if (existingTab) {
      options.activeTabKey.value = existingTab.key
    }
  }

  function activateTab(tabKey: string): void {
    options.activeTabKey.value = tabKey
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (tab) {
      options.selectedSeriesId.value = tab.seriesId
      options.activeViewportKey.value =
        tab.viewType === 'MPR' || tab.viewType === '4D'
          ? 'mpr-ax'
          : tab.viewType === '3D'
            ? 'volume'
            : tab.viewType === 'CompareStack'
              ? COMPARE_STACK_SOURCE_PANE_KEY
              : tab.viewType === 'PETCTFusion'
                ? FUSION_OVERLAY_AXIAL_PANE_KEY
              : tab.viewType === 'Layout'
                ? getFirstLayoutViewportKey(tab)
                : 'single'
    }
  }

  function releaseBackendViews(viewIds: Array<string | null | undefined>): void {
    const uniqueViewIds = Array.from(new Set(viewIds.filter((viewId): viewId is string => Boolean(viewId))))
    uniqueViewIds.forEach((viewId) => {
      void postApi('CloseViewApiV1ViewClosePost', { viewId }).catch(() => {
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
    tagRequestGuard.cancel(tabKey)
    queuedFourDPhaseSwitches.delete(tabKey)
    fourDPhaseSwitchInFlightTabKeys.delete(tabKey)
    queuedFourDPreloadTabKeys.delete(tabKey)
    fourDPreloadRequests.delete(tabKey)
    releaseBackendViews([
      closingTab.viewId,
      ...Object.values(closingTab.compareViewIds ?? {}),
      ...Object.values(closingTab.viewportViewIds ?? {}),
      ...getFourDPhaseBackendViewIds(closingTab),
      ...getLayoutSlotViewIds(closingTab)
    ])
    if (closingTab.viewId) {
      options.clearPendingVolumeConfig(closingTab.viewId)
      viewSizeCache.delete(closingTab.viewId)
    }
    Object.values(closingTab.compareViewIds ?? {}).forEach((viewId) => {
      if (viewId) {
        viewSizeCache.delete(viewId)
      }
    })
    Object.values(closingTab.viewportViewIds ?? {}).forEach((viewId) => {
      if (viewId) {
        viewSizeCache.delete(viewId)
      }
    })
    getFourDPhaseBackendViewIds(closingTab).forEach((viewId) => {
      viewSizeCache.delete(viewId)
    })
    getLayoutSlotViewIds(closingTab).forEach((viewId) => {
      viewSizeCache.delete(viewId)
    })

    const closingImageSrc = options.viewerTabs.value[currentIndex]?.imageSrc
    revokeObjectUrlIfNeeded(closingImageSrc)
    Object.values(closingTab.compareImages ?? {}).forEach((imageSrc) => {
      revokeObjectUrlIfNeeded(imageSrc)
    })
    Object.values(closingTab.viewportImages ?? {}).forEach((imageSrc) => {
      revokeObjectUrlIfNeeded(imageSrc)
    })
    revokeLayoutSlotImages(closingTab.layoutSlots)
    Object.values(closingTab.fourDPhaseCache ?? {}).forEach((phaseCache) => {
      Object.values(phaseCache.viewportImages ?? {}).forEach((imageSrc) => {
        revokeObjectUrlIfNeeded(imageSrc)
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

  function closeOtherTabs(tabKey: string): void {
    const targetTab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!targetTab) {
      return
    }

    const tabKeysToClose = options.viewerTabs.value
      .filter((item) => item.key !== tabKey)
      .map((item) => item.key)
    tabKeysToClose.forEach(closeTab)
    activateTab(tabKey)
  }

  function removeSeries(seriesId: string): void {
    const nextSeries = options.seriesList.value.filter((item) => item.seriesId !== seriesId)
    options.seriesList.value = nextSeries

    const nextSeriesCornerInfoMap = { ...options.seriesCornerInfoMap.value }
    delete nextSeriesCornerInfoMap[seriesId]
    options.seriesCornerInfoMap.value = nextSeriesCornerInfoMap

    const relatedTabs = options.viewerTabs.value.filter(
      (item) =>
        item.seriesId === seriesId ||
        item.fusionSeriesIds?.ctSeriesId === seriesId ||
        item.fusionSeriesIds?.petSeriesId === seriesId
    )
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
    closeOtherTabs,
    ensureMprVolumeView,
    findTabByViewId,
    invalidateFourDMprState,
    openLayoutView,
    openPetCtFusion,
    openSeriesCompare,
    openSeriesView,
    openView,
    preloadFourDPhases,
    rebindOpenViews,
    removeSeries,
    renderTab,
    setFourDPhase,
    setLayoutSlotSeries,
    setTagTabIndex,
    selectSeries,
    updateMprState,
    updateTabImage,
    updateViewProgress
  }
}
