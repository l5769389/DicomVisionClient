import { nextTick, watch, type ComputedRef, type Ref } from 'vue'
import { VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { resolveBackendAssetUrl } from '../../../services/apiBase'
import { stripVolumeCornerInfo } from '../../ui/viewportCornerInfo'
import {
  bindView,
  bindViewSilently,
  bindViewSilentlyWithAck,
  emitViewOperationWithAck,
  VIEWER_IMAGE_TRANSPORT_FORMAT
} from '../../../services/socket'
import {
  COMPARE_STACK_PANE_KEYS,
  COMPARE_STACK_SOURCE_PANE_KEY,
  COMPARE_STACK_TARGET_PANE_KEY,
  buildTabTitle,
  createComparePaneRecord,
  createCompareStackTabKey,
  createDefaultFusionInfo,
  createDefaultPetInfo,
  createEmptyCompareCornerInfos,
  createEmptyCompareCurrentWindowInfos,
  createEmptyCompareImages,
  createEmptyCompareInitialWindowInfos,
  createEmptyCompareOrientations,
  createEmptyComparePseudocolorPresets,
  createEmptyCompareScaleBars,
  createEmptyCompareSliceLabels,
  createEmptyCompareTransformStates,
  createEmptyCompareViewIds,
  createEmptyCompareWindowLabels,
  createEmptyCornerInfo,
  createEmptyFusionComposites,
  createEmptyFusionCornerInfos,
  createEmptyFusionImages,
  createEmptyFusionInitialWindowInfos,
  createEmptyFusionLayerImages,
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
  createEmptyMprCurrentWindowInfos,
  createEmptyMprImages,
  createEmptyMprInitialWindowInfos,
  createEmptyMprOrientations,
  createEmptyMprPlanes,
  createEmptyMprPseudocolorPresets,
  createEmptyMprScaleBars,
  createEmptyMprSegmentationOverlays,
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
  getViewTypeDisplayLabel,
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
import { isPetSeries, isSeriesViewSupported, resolvePrimaryTwoDimensionalViewType } from './seriesViewSupport'
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
  DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET,
  DEFAULT_PSEUDOCOLOR_PRESET,
  normalizeFusionPetPseudocolorPresetKey,
  normalizePseudocolorPresetKey
} from '../../../constants/pseudocolor'
import {
  createDefaultVolumeRenderOptions,
  createDefaultMprMipConfig,
  createDefaultMprSegmentationConfig,
  isStaleMprSegmentationPreviewConfig,
  isFourDSeriesItem,
  mergeMprSegmentationPreviewConfig,
  normalizeMprMipConfig,
  normalizeMprSegmentationConfig,
  normalizeVolumeRenderOptions
} from '../../../types/viewer'
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

let typedApiModulePromise: Promise<typeof import('../../../services/typedApi')> | null = null

function loadTypedApi() {
  typedApiModulePromise ??= import('../../../services/typedApi')
  return typedApiModulePromise
}
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
  FusionCompositeInfo,
  FusionPaneKey,
  FusionLayerImages,
  FourDPhaseCacheItem,
  FourDPhaseItem,
  FourDPhasesResponse,
  MeasurementOverlay,
  MprSegmentationOverlay,
  MprViewportKey,
  PetInfo,
  ViewImageResponse,
  ViewProgressInfo,
  ViewTransformInfo,
  ViewerLayoutSlot,
  ViewerLayoutTemplate,
  ViewerTabItem,
  ViewType,
  WindowLevelInfo
} from '../../../types/viewer'
import type { HoverCornerSample } from '../hover/useViewerWorkspaceHover'

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
  getLastHoverSample?: (viewId: string | null | undefined) => HoverCornerSample | null
  withHoverCornerInfo: (cornerInfo: CornerInfo, sample?: HoverCornerSample | null) => CornerInfo
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

function getMprSegmentationConfigPayload(payload: Partial<ViewImageResponse>) {
  return payload.mprSegmentationConfig ?? (payload as { mpr_segmentation_config?: ViewImageResponse['mprSegmentationConfig'] | null }).mpr_segmentation_config
}

function normalizeMprRevision(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function maxMprRevision(...values: Array<number | null | undefined>): number | null {
  return values.reduce<number | null>((maxValue, value) => {
    const revision = normalizeMprRevision(value)
    if (revision == null) {
      return maxValue
    }
    return maxValue == null ? revision : Math.max(maxValue, revision)
  }, null)
}

function mergeViewportMprRevision(
  revisions: Partial<Record<MprViewportKey, number>> | undefined,
  viewportKey: MprViewportKey,
  revision: number | null
): Partial<Record<MprViewportKey, number>> | undefined {
  if (revision == null) {
    return revisions
  }
  return {
    ...(revisions ?? {}),
    [viewportKey]: Math.max(revisions?.[viewportKey] ?? revision, revision)
  }
}

function getMprSegmentationOverlayPayload(payload: Partial<ViewImageResponse>) {
  return payload.mprSegmentationOverlay ?? (payload as { mpr_segmentation_overlay?: ViewImageResponse['mprSegmentationOverlay'] | null }).mpr_segmentation_overlay
}

function hasMprSegmentationOverlayPayload(payload: Partial<ViewImageResponse>): boolean {
  return Object.prototype.hasOwnProperty.call(payload, 'mprSegmentationOverlay') ||
    Object.prototype.hasOwnProperty.call(payload, 'mpr_segmentation_overlay')
}

function getMprCrosshairPayload(payload: Partial<ViewImageResponse>) {
  return payload.mpr_crosshair ?? ((payload as { mprCrosshair?: ViewImageResponse['mpr_crosshair'] | null }).mprCrosshair ?? null)
}

function hasMprCrosshairPayload(payload: Partial<ViewImageResponse>): boolean {
  return Object.prototype.hasOwnProperty.call(payload, 'mpr_crosshair') ||
    Object.prototype.hasOwnProperty.call(payload, 'mprCrosshair')
}

function hasImageUpdatePayloadField(payload: Partial<ViewImageResponse>, key: keyof ViewImageResponse): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key)
}

type ImageUpdateRenderIntent = NonNullable<ViewImageResponse['renderIntent']>

interface ImageUpdateLayerPolicy {
  geometry: boolean
  pixelCornerTags: boolean
  projectedOverlay: boolean
  semanticOverlay: boolean
}

const IMAGE_UPDATE_LAYER_POLICIES: Record<ImageUpdateRenderIntent, ImageUpdateLayerPolicy> = {
  'pixel-only': {
    geometry: false,
    pixelCornerTags: true,
    projectedOverlay: false,
    semanticOverlay: false
  },
  'geometry-preview': {
    geometry: true,
    pixelCornerTags: true,
    projectedOverlay: true,
    semanticOverlay: false
  },
  'overlay-preview': {
    geometry: true,
    pixelCornerTags: true,
    projectedOverlay: true,
    semanticOverlay: true
  },
  full: {
    geometry: true,
    pixelCornerTags: true,
    projectedOverlay: true,
    semanticOverlay: true
  }
}

function mergePixelCornerTags(
  current: CornerInfo | null | undefined,
  nextWindowLabel: string | null,
  fallback: CornerInfo
): CornerInfo {
  const base = current ?? fallback
  if (!nextWindowLabel) {
    return base
  }
  return {
    ...base,
    tags: {
      ...(base.tags ?? {}),
      windowLevel: [nextWindowLabel]
    }
  }
}

function formatWindowInfoValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) {
    return '-'
  }
  return String(Math.round(Number(value)))
}

function formatWindowInfoLabel(ww: number | null | undefined, wl: number | null | undefined): string | null {
  if (ww == null && wl == null) {
    return null
  }
  return `WW ${formatWindowInfoValue(ww)}  WL ${formatWindowInfoValue(wl)}`
}

function normalizeTransformRotationDegrees(value: number | null | undefined): number {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) {
    return 0
  }
  const normalized = Math.round(numeric) % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function formatTransformCornerInfoLabel(transform: ViewTransformInfo | null | undefined): string {
  const rotation = normalizeTransformRotationDegrees(transform?.rotationDegrees)
  const flipParts = [
    transform?.horFlip ? 'H' : '',
    transform?.verFlip ? 'V' : ''
  ].filter(Boolean)
  return `Rot:${rotation}° / Flip:${flipParts.join('') || '-'}`
}

function stripTransformCornerInfoTag(cornerInfo: CornerInfo): CornerInfo {
  const tags = { ...(cornerInfo.tags ?? {}) }
  delete tags.transform2dState
  return {
    ...cornerInfo,
    tags
  }
}

function mergeTransformCornerInfoTag(
  cornerInfo: CornerInfo,
  transform: ViewTransformInfo | null | undefined,
  includeTransform = true
): CornerInfo {
  if (!includeTransform) {
    return stripTransformCornerInfoTag(cornerInfo)
  }
  return {
    ...cornerInfo,
    tags: {
      ...(cornerInfo.tags ?? {}),
      transform2dState: [formatTransformCornerInfoLabel(transform)]
    }
  }
}

function preserveMeasurementScopeMetadata(
  incoming: MeasurementOverlay[],
  current: MeasurementOverlay[] | null | undefined
): MeasurementOverlay[] {
  const currentById = new Map((current ?? []).map((item) => [item.measurementId, item]))
  return incoming.map((item) => {
    const previous = currentById.get(item.measurementId)
    const scope = item.scope ?? previous?.scope
    const sliceIndex = item.sliceIndex ?? previous?.sliceIndex
    return {
      ...item,
      ...(scope != null ? { scope } : {}),
      ...(sliceIndex !== undefined ? { sliceIndex } : {})
    }
  })
}

function preserveAnnotationScopeMetadata(
  incoming: AnnotationOverlay[],
  current: AnnotationOverlay[] | null | undefined
): AnnotationOverlay[] {
  const currentById = new Map((current ?? []).map((item) => [item.annotationId, item]))
  return incoming.map((item) => {
    const previous = currentById.get(item.annotationId)
    const scope = item.scope ?? previous?.scope
    const sliceIndex = item.sliceIndex ?? previous?.sliceIndex
    return {
      ...item,
      ...(scope != null ? { scope } : {}),
      ...(sliceIndex !== undefined ? { sliceIndex } : {})
    }
  })
}

function normalizeWindowLevelInfo(ww: number | null | undefined, wl: number | null | undefined): WindowLevelInfo | null {
  const width = Number(ww)
  const level = Number(wl)
  return Number.isFinite(width) && width > 0 && Number.isFinite(level)
    ? {
        ww: width,
        wl: level
      }
    : null
}

function rememberInitialWindowInfo(
  current: WindowLevelInfo | null | undefined,
  ww: number | null | undefined,
  wl: number | null | undefined
): WindowLevelInfo | null | undefined {
  return current ?? normalizeWindowLevelInfo(ww, wl) ?? current
}

function resolveCurrentWindowInfo(
  current: WindowLevelInfo | null | undefined,
  initial: WindowLevelInfo | null | undefined,
  ww: number | null | undefined,
  wl: number | null | undefined
): WindowLevelInfo | null {
  return normalizeWindowLevelInfo(ww, wl) ?? current ?? initial ?? null
}

function getImageUpdateMetadataMode(payload: Partial<ViewImageResponse>): string {
  const raw = payload.metadataMode ?? (payload as { metadata_mode?: unknown }).metadata_mode
  return typeof raw === 'string' ? raw : ''
}

function getImageMimeType(imageFormat: string | null | undefined): string {
  if (imageFormat === 'jpeg') {
    return 'image/jpeg'
  }
  if (imageFormat === 'webp') {
    return 'image/webp'
  }
  return 'image/png'
}

function normalizeImageUpdateRenderIntent(payload: Partial<ViewImageResponse>): ImageUpdateRenderIntent {
  const rawIntent = payload.renderIntent ?? (payload as { render_intent?: unknown }).render_intent
  if (
    rawIntent === 'pixel-only' ||
    rawIntent === 'geometry-preview' ||
    rawIntent === 'overlay-preview' ||
    rawIntent === 'full'
  ) {
    return rawIntent
  }

  const metadataMode = getImageUpdateMetadataMode(payload)
  if (metadataMode === 'stack-pixel-preview' || metadataMode === 'mpr-pixel-preview') {
    return 'pixel-only'
  }
  if (
    metadataMode === 'stack-geometry-preview' ||
    metadataMode === 'stack-zoom-preview' ||
    metadataMode === 'mpr-pan-zoom-preview' ||
    metadataMode === 'mpr-zoom-preview' ||
    metadataMode === 'mpr-crosshair-preview' ||
    metadataMode === 'stack-preview-lite' ||
    metadataMode === 'fusion-zoom-preview'
  ) {
    return 'geometry-preview'
  }
  if (metadataMode === 'mpr-segmentation-preview' || metadataMode === 'fusion-registration-layer-preview') {
    return 'overlay-preview'
  }

  const rawFastPreview = payload.fastPreview ?? ((payload as { fast_preview?: unknown }).fast_preview ?? null)
  if (rawFastPreview === true || payload.imageFormat === 'jpeg') {
    return 'geometry-preview'
  }
  return 'full'
}

function getImageUpdateRenderRevision(payload: Partial<ViewImageResponse>): number | null {
  const raw = payload.renderRevision ?? (payload as { render_revision?: unknown }).render_revision ?? null
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

function updateImageUpdateRevisions(
  item: ViewerTabItem,
  viewId: string | undefined,
  renderRevision: number | null
): Record<string, number> | undefined {
  if (!viewId || renderRevision == null) {
    return item.imageUpdateRevisions
  }
  return {
    ...(item.imageUpdateRevisions ?? {}),
    [viewId]: renderRevision
  }
}

function mergeMprSegmentationOverlaySamples(
  currentOverlay: MprSegmentationOverlay | null | undefined,
  incomingOverlay: MprSegmentationOverlay | null | undefined
): MprSegmentationOverlay | null {
  if (!incomingOverlay) {
    return incomingOverlay ?? null
  }
  const currentRegionsById = new Map((currentOverlay?.regions ?? []).map((region) => [region.regionId, region]))
  return {
    ...incomingOverlay,
    regions: incomingOverlay.regions.map((region) => {
      if (region.samples?.points?.length) {
        return region
      }
      const currentRegion = currentRegionsById.get(region.regionId)
      if (currentRegion?.samples?.points?.length) {
        return {
          ...region,
          samples: currentRegion.samples
        }
      }
      return region
    })
  }
}

function hasMprSegmentationOverlaySamples(overlay: MprSegmentationOverlay | null | undefined): boolean {
  return Boolean(overlay?.regions?.some((region) => region.samples?.points?.length))
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
  const { locale, montageColumnCount, selectedPseudocolorKey } = useUiPreferences()
  let tabActivationHistory: string[] = []

  function withRuntimeCornerInfo(
    cornerInfo: CornerInfo,
    transform: ViewTransformInfo | null | undefined,
    row?: number | null,
    col?: number | null,
    includeTransform = true,
    viewId?: string | null
  ): CornerInfo {
    void row
    void col
    return options.withHoverCornerInfo(
      mergeTransformCornerInfoTag(cornerInfo, transform, includeTransform),
      options.getLastHoverSample?.(viewId) ?? null
    )
  }

  function mergePixelRuntimeCornerInfo(
    current: CornerInfo | null | undefined,
    nextWindowLabel: string | null,
    fallback: CornerInfo,
    transform: ViewTransformInfo | null | undefined,
    includeTransform = true
  ): CornerInfo {
    return mergeTransformCornerInfoTag(mergePixelCornerTags(current, nextWindowLabel, fallback), transform, includeTransform)
  }

  function rememberActiveTabKey(tabKey: string): void {
    if (!tabKey) {
      return
    }
    tabActivationHistory = [...tabActivationHistory.filter((key) => key !== tabKey), tabKey]
  }

  function getMostRecentRemainingTabKey(nextTabs: ViewerTabItem[], closingTabKey: string): string {
    const remainingKeys = new Set(nextTabs.map((tab) => tab.key))
    return [...tabActivationHistory]
      .reverse()
      .find((key) => key !== closingTabKey && remainingKeys.has(key)) ?? ''
  }

  watch(
    () => options.activeTabKey.value,
    (tabKey) => {
      rememberActiveTabKey(tabKey)
    },
    { immediate: true }
  )

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
    Object.values(tab.fusionLayerImages ?? {}).forEach((layerImages) => {
      revokeObjectUrlIfNeeded(layerImages?.pet)
    })
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

  function isLayoutVolumeSlot(slot: ViewerLayoutSlot): boolean {
    return Boolean(slot.seriesId && (slot.viewType === '3D' || slot.sourceViewType === '3D'))
  }

  async function createLayoutSlotView(slot: ViewerLayoutSlot, forceNewView: boolean): Promise<ViewerLayoutSlot> {
    const isStackSlot = isLayoutStackSlot(slot)
    const isVolumeSlot = isLayoutVolumeSlot(slot)
    if ((!isStackSlot && !isVolumeSlot) || !slot.seriesId) {
      return {
        ...slot,
        viewId: null
      }
    }

    if (!forceNewView && slot.viewId) {
      return slot
    }

    const { postApi } = await loadTypedApi()
    const data = await postApi('CreateViewApiV1ViewCreatePost', {
      seriesId: slot.seriesId,
      viewType: isVolumeSlot ? '3D' : 'Stack'
    })
    if (isVolumeSlot) {
      return {
        ...slot,
        viewType: '3D',
        sourceViewType: '3D',
        viewportKey: slot.viewportKey ?? 'volume',
        viewId: data.viewId
      }
    }

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

  async function hydrateLayoutSlots(slots: ViewerLayoutSlot[], forceNewViews: boolean): Promise<ViewerLayoutSlot[]> {
    return await Promise.all(slots.map((slot) => createLayoutSlotView(slot, forceNewViews)))
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

  async function emitInitialPetConfigOperation(viewId: string, preset: string): Promise<void> {
    const normalizedPreset = normalizePseudocolorPresetKey(preset)
    if (!viewId) {
      return
    }
    await emitViewOperationWithAck({
      viewId,
      opType: VIEW_OPERATION_TYPES.petConfig,
      pseudocolorPreset: normalizedPreset,
      petWindowMin: DEFAULT_FUSION_PET_WINDOW_MIN,
      petWindowMax: DEFAULT_FUSION_PET_WINDOW_MAX
    })
  }

  function normalizeStandalonePetPseudocolorPreset(): string {
    return DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET
  }

  async function migrateStandalonePetPseudocolorIfNeeded(tab: ViewerTabItem): Promise<boolean> {
    if (tab.viewType !== 'PET') {
      return false
    }
    const nextPreset = normalizeStandalonePetPseudocolorPreset()
    if (tab.pseudocolorPreset === nextPreset && tab.petInfo?.pseudocolorPreset === nextPreset) {
      return false
    }

    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tab.key
        ? {
            ...item,
            pseudocolorPreset: nextPreset,
            petInfo: {
              ...createDefaultPetInfo(item.seriesId),
              ...(item.petInfo ?? {}),
              pseudocolorPreset: nextPreset
            }
          }
        : item
    )
    if (tab.viewId) {
      await emitInitialPetConfigOperation(tab.viewId, nextPreset)
    }
    return true
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
      const { postApi } = await loadTypedApi()
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
    const { postApi } = await loadTypedApi()
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
    const { postApi } = await loadTypedApi()
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
    const { postApi } = await loadTypedApi()
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
        const { postApi } = await loadTypedApi()
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
        seriesTitle: getSeriesDisplayName(series, item.seriesId),
        viewId: '',
        imageSrc: '',
        sliceLabel: '',
        windowLabel: '',
        currentWindowInfo: null,
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

  function updateTabImage(
    tabKey: string,
    payload: Partial<ViewImageResponse>,
    imageBinary: ArrayBuffer | Uint8Array,
    extraImageBinaries: Record<string, ArrayBuffer | Uint8Array> = {}
  ): void {
    let mprCrosshairSettlingCompletionUpdate: IncomingMprViewportUpdate | null = null
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.key !== tabKey) {
        return item
      }

      const renderIntent = normalizeImageUpdateRenderIntent(payload)
      const layerPolicy = IMAGE_UPDATE_LAYER_POLICIES[renderIntent]
      const allowGeometryUpdate = layerPolicy.geometry
      const allowPixelCornerTagsUpdate = layerPolicy.pixelCornerTags
      const allowMeasurementOverlayUpdate = layerPolicy.projectedOverlay
      const allowSegmentationOverlayUpdate = layerPolicy.semanticOverlay
      const renderRevision = getImageUpdateRenderRevision(payload)
      if (payload.viewId && renderRevision != null) {
        const acceptedRenderRevision = item.imageUpdateRevisions?.[payload.viewId]
        if (acceptedRenderRevision != null && renderRevision < acceptedRenderRevision) {
          return item
        }
      }
      const withRenderRevision = (nextItem: ViewerTabItem): ViewerTabItem => ({
        ...nextItem,
        imageUpdateRevisions: updateImageUpdateRevisions(nextItem, payload.viewId, renderRevision)
      })

      const ww = payload.window_info?.ww
      const wl = payload.window_info?.wl
      const mimeType = getImageMimeType(payload.imageFormat)
      const currentMprSegmentationConfig = normalizeMprSegmentationConfig(
        item.mprSegmentationConfig,
        createDefaultMprSegmentationConfig()
      )
      const mprSegmentationPayload = allowSegmentationOverlayUpdate ? getMprSegmentationConfigPayload(payload) : null
      const incomingMprSegmentationConfig = normalizeMprSegmentationConfig(
        mprSegmentationPayload,
        currentMprSegmentationConfig
      )
      const mprSegmentationOverlayPayload = allowSegmentationOverlayUpdate ? getMprSegmentationOverlayPayload(payload) : null
      const hasMprSegmentationOverlayUpdate = allowSegmentationOverlayUpdate && hasMprSegmentationOverlayPayload(payload)
      const isStaleMprSegmentationPreview =
        mprSegmentationPayload != null &&
        isStaleMprSegmentationPreviewConfig(currentMprSegmentationConfig, incomingMprSegmentationConfig)
      if (isStaleMprSegmentationPreview && (!hasMprSegmentationOverlayUpdate || !hasMprSegmentationOverlaySamples(mprSegmentationOverlayPayload))) {
        return item
      }
      let incomingImageSrc: string | null = null
      const preserveCurrentImageSource =
        imageBinary.byteLength === 0 && payload.imageTransport === 'webrtc'
      const getIncomingImageSrc = (currentImageSrc?: string | null): string => {
        if (preserveCurrentImageSource) {
          return currentImageSrc ?? ''
        }
        if (incomingImageSrc == null) {
          incomingImageSrc = imageUrlRegistry.create(imageBinary, mimeType)
        }
        return incomingImageSrc
      }
      const revokeIncomingImageSrcIfNeeded = (): void => {
        if (incomingImageSrc == null) {
          return
        }
        revokeObjectUrlIfNeeded(incomingImageSrc)
        incomingImageSrc = null
      }
      const sliceLabel = payload.slice_info ? `${payload.slice_info.current + 1} / ${payload.slice_info.total}` : item.sliceLabel
      const windowLabel = formatWindowInfoLabel(ww, wl) ?? item.windowLabel
      const pixelWindowLabel = allowPixelCornerTagsUpdate && (ww != null || wl != null) ? windowLabel : null
      const fourDViewportMatch = item.viewType === '4D' ? findFourDPhaseViewportByViewId(item, payload.viewId) : null
      const metadataSeriesId =
        item.viewType === '4D' && fourDViewportMatch
          ? resolveFourDPhaseSeriesId(item, fourDViewportMatch.phaseKey)
          : item.seriesId
      const seriesCornerInfo =
        options.seriesCornerInfoMap.value[metadataSeriesId] ??
        options.seriesCornerInfoMap.value[item.seriesId] ??
        createEmptyCornerInfo()
      const hasCornerInfoPayload = allowGeometryUpdate && payload.cornerInfo != null
      const hasOrientationPayload = allowGeometryUpdate && payload.orientation != null
      const hasTransformPayload = allowGeometryUpdate && payload.transform != null
      const hasMeasurementsPayload = allowMeasurementOverlayUpdate && hasImageUpdatePayloadField(payload, 'measurements')
      const hasAnnotationsPayload = allowMeasurementOverlayUpdate && hasImageUpdatePayloadField(payload, 'annotations')
      const rawScaleBar = allowGeometryUpdate ? payload.scaleBar ?? ((payload as { scale_bar?: unknown }).scale_bar ?? null) : null
      const hasScaleBarPayload = rawScaleBar != null
      const sliceCornerInfo = options.stripHoverCornerInfo(normalizeCornerInfo(payload.cornerInfo))
      const orientationInfo = normalizeOrientationInfo(payload.orientation)
      const transformState = allowGeometryUpdate ? payload.transform ?? createDefaultTransformInfo() : createDefaultTransformInfo()
      const pseudocolorPreset = normalizePseudocolorPresetKey(payload.color?.pseudocolorPreset ?? item.pseudocolorPreset)
      const mprMipConfig = allowGeometryUpdate
        ? normalizeMprMipConfig(payload.mprMipConfig, item.mprMipConfig ?? createDefaultMprMipConfig())
        : item.mprMipConfig ?? createDefaultMprMipConfig()
      const mprSegmentationConfig = mprSegmentationPayload == null
        ? currentMprSegmentationConfig
        : isStaleMprSegmentationPreview
          ? currentMprSegmentationConfig
          : mergeMprSegmentationPreviewConfig(currentMprSegmentationConfig, incomingMprSegmentationConfig)
      const shouldAcceptMprSegmentationOverlay =
        hasMprSegmentationOverlayUpdate &&
        (
          mprSegmentationPayload == null ||
          (isStaleMprSegmentationPreview && hasMprSegmentationOverlaySamples(mprSegmentationOverlayPayload)) ||
          incomingMprSegmentationConfig.clientRevision >= currentMprSegmentationConfig.clientRevision
        )
      const mprCrosshairMode = allowGeometryUpdate
        ? payload.mprCrosshairMode === 'double-oblique' ? 'double-oblique' : 'orthogonal'
        : item.mprCrosshairMode ?? 'orthogonal'
      const mprCursor = allowGeometryUpdate ? normalizeMprCursorInfo(payload.mprCursor ?? ((payload as { mpr_cursor?: unknown }).mpr_cursor ?? null)) : null
      const mprFrame = allowGeometryUpdate ? normalizeMprFrameInfo(payload.mprFrame ?? ((payload as { mpr_frame?: unknown }).mpr_frame ?? null)) : null
      const mprPlane = allowGeometryUpdate ? normalizeMprPlaneInfo(payload.mprPlane ?? ((payload as { mpr_plane?: unknown }).mpr_plane ?? null)) : null
      const hasMprCrosshairUpdate = allowGeometryUpdate && hasMprCrosshairPayload(payload)
      const mprCrosshair = hasMprCrosshairUpdate ? getMprCrosshairPayload(payload) : null
      const rawMprRevision = allowGeometryUpdate ? payload.mprRevision ?? ((payload as { mpr_revision?: unknown }).mpr_revision ?? null) : null
      const mprRevision = normalizeMprRevision(rawMprRevision)
      const scaleBar = normalizeScaleBarInfo(rawScaleBar)
      const volumePreset = payload.volumePreset ? `volumePreset:${normalizeVolumePresetKey(payload.volumePreset)}` : item.volumePreset
      const volumeRenderConfig = payload.volumeConfig
        ? normalizeVolumeRenderConfig(payload.volumeConfig, payload.volumePreset ?? item.volumePreset)
        : item.volumeRenderConfig
      const render3dMode = payload.render3dMode ? normalizeRender3DMode(payload.render3dMode) : item.render3dMode
      const surfaceRenderConfig = payload.surfaceConfig
        ? normalizeSurfaceRenderConfig(payload.surfaceConfig)
        : item.surfaceRenderConfig
      const volumeRenderOptionsPayload =
        payload.volumeRenderOptions ??
        ((payload as { volume_render_options?: ViewImageResponse['volumeRenderOptions'] | null }).volume_render_options ?? null)
      const volumeRenderOptions = volumeRenderOptionsPayload
        ? normalizeVolumeRenderOptions(volumeRenderOptionsPayload, item.volumeRenderOptions ?? createDefaultVolumeRenderOptions())
        : item.volumeRenderOptions ?? createDefaultVolumeRenderOptions()
      const payloadAnnotations = (payload.annotations ?? []) as AnnotationOverlay[]

      const layoutSlot = item.viewType === 'Layout'
        ? item.layoutSlots?.find((slot) => slot.viewId === payload.viewId)
        : null
      if (layoutSlot) {
        const isVolumeLayoutSlot = layoutSlot.viewType === '3D' || layoutSlot.sourceViewType === '3D'
        const expectedLayoutPseudocolorPreset = normalizePseudocolorPresetKey(
          layoutSlot.pseudocolorPreset ?? item.pseudocolorPreset
        )
        const layoutPseudocolorPreset = normalizePseudocolorPresetKey(
          payload.color?.pseudocolorPreset ?? layoutSlot.pseudocolorPreset ?? item.pseudocolorPreset
        )
        if (payload.color?.pseudocolorPreset && layoutPseudocolorPreset !== expectedLayoutPseudocolorPreset) {
          revokeIncomingImageSrcIfNeeded()
          return item
        }

        const layoutSeriesCornerInfo =
          options.seriesCornerInfoMap.value[layoutSlot.seriesId ?? item.seriesId] ??
          options.seriesCornerInfoMap.value[item.seriesId] ??
          createEmptyCornerInfo()

        return withRenderRevision({
          ...item,
          volumePreset: isVolumeLayoutSlot ? volumePreset : item.volumePreset,
          volumeRenderConfig: isVolumeLayoutSlot ? volumeRenderConfig : item.volumeRenderConfig,
          render3dMode: isVolumeLayoutSlot ? render3dMode : item.render3dMode,
          surfaceRenderConfig: isVolumeLayoutSlot ? surfaceRenderConfig : item.surfaceRenderConfig,
          volumeRenderOptions: isVolumeLayoutSlot ? volumeRenderOptions : item.volumeRenderOptions,
          loadingProgress: isVolumeLayoutSlot ? null : item.loadingProgress,
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [layoutSlot.id]: hasMeasurementsPayload
              ? preserveMeasurementScopeMetadata((payload.measurements ?? []) as MeasurementOverlay[], item.viewportMeasurements?.[layoutSlot.id] ?? [])
              : item.viewportMeasurements?.[layoutSlot.id] ?? []
          },
          viewportAnnotations: {
            ...(item.viewportAnnotations ?? {}),
            [layoutSlot.id]: hasAnnotationsPayload
              ? preserveAnnotationScopeMetadata(payloadAnnotations, item.viewportAnnotations?.[layoutSlot.id] ?? [])
              : item.viewportAnnotations?.[layoutSlot.id] ?? []
          },
          layoutSlots: (item.layoutSlots ?? []).map((slot) => {
            if (slot.id !== layoutSlot.id) {
              return slot
            }
            if (!preserveCurrentImageSource && slot.ownsImageSrc) {
              revokeObjectUrlIfNeeded(slot.imageSrc)
            }
            const slotTransformState = hasTransformPayload ? transformState : slot.transformState ?? transformState
            const slotCornerFallback = withRuntimeCornerInfo(
              mergeCornerInfo(layoutSeriesCornerInfo, sliceCornerInfo),
              slotTransformState,
              null,
              null,
              !isVolumeLayoutSlot,
              payload.viewId
            )
            const nextSlotCornerInfo = hasCornerInfoPayload
              ? slotCornerFallback
              : mergePixelRuntimeCornerInfo(
                  slot.cornerInfo,
                  pixelWindowLabel,
                  slotCornerFallback,
                  slotTransformState,
                  !isVolumeLayoutSlot
                )
            return {
              ...slot,
              imageSrc: getIncomingImageSrc(slot.imageSrc),
              ownsImageSrc: preserveCurrentImageSource ? slot.ownsImageSrc : true,
              sliceLabel,
              windowLabel,
              initialWindowInfo: rememberInitialWindowInfo(slot.initialWindowInfo, ww, wl) ?? null,
              currentWindowInfo: resolveCurrentWindowInfo(slot.currentWindowInfo, slot.initialWindowInfo, ww, wl),
              scaleBar: hasScaleBarPayload ? scaleBar : slot.scaleBar ?? null,
              cornerInfo: isVolumeLayoutSlot ? stripVolumeCornerInfo(nextSlotCornerInfo) : nextSlotCornerInfo,
              orientation: hasOrientationPayload ? orientationInfo : slot.orientation ?? orientationInfo,
              transformState: slotTransformState,
              pseudocolorPreset: layoutPseudocolorPreset
            }
          })
        })
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
          revokeIncomingImageSrcIfNeeded()
          return item
        }
        const currentImage = item.compareImages?.[compareViewportKey]
        if (!preserveCurrentImageSource) {
          revokeObjectUrlIfNeeded(currentImage)
        }
        const compareTransformState = hasTransformPayload
          ? transformState
          : item.compareTransformStates?.[compareViewportKey] ?? transformState
        const compareCornerFallback = withRuntimeCornerInfo(
          mergeCornerInfo(compareSeriesCornerInfo, sliceCornerInfo),
          compareTransformState,
          null,
          null,
          true,
          payload.viewId
        )

        return withRenderRevision({
          ...item,
          compareImages: {
            ...(item.compareImages ?? createEmptyCompareImages()),
            [compareViewportKey]: getIncomingImageSrc(currentImage)
          },
          compareSliceLabels: {
            ...(item.compareSliceLabels ?? createEmptyCompareSliceLabels()),
            [compareViewportKey]: sliceLabel
          },
          compareWindowLabels: {
            ...(item.compareWindowLabels ?? createEmptyCompareWindowLabels()),
            [compareViewportKey]: windowLabel
          },
          compareInitialWindowInfos: {
            ...(item.compareInitialWindowInfos ?? createEmptyCompareInitialWindowInfos()),
            [compareViewportKey]: rememberInitialWindowInfo(item.compareInitialWindowInfos?.[compareViewportKey], ww, wl)
          },
          compareCurrentWindowInfos: {
            ...(item.compareCurrentWindowInfos ?? createEmptyCompareCurrentWindowInfos()),
            [compareViewportKey]: resolveCurrentWindowInfo(
              item.compareCurrentWindowInfos?.[compareViewportKey],
              item.compareInitialWindowInfos?.[compareViewportKey],
              ww,
              wl
            )
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
              ? compareCornerFallback
              : mergePixelRuntimeCornerInfo(
                  item.compareCornerInfos?.[compareViewportKey],
                  pixelWindowLabel,
                  compareCornerFallback,
                  compareTransformState
                )
          },
          compareOrientations: {
            ...(item.compareOrientations ?? createEmptyCompareOrientations()),
            [compareViewportKey]: hasOrientationPayload
              ? orientationInfo
              : item.compareOrientations?.[compareViewportKey] ?? orientationInfo
          },
          compareTransformStates: {
            ...(item.compareTransformStates ?? createEmptyCompareTransformStates()),
            [compareViewportKey]: compareTransformState
          },
          comparePseudocolorPresets: {
            ...(item.comparePseudocolorPresets ?? createEmptyComparePseudocolorPresets()),
            [compareViewportKey]: comparePseudocolorPreset
          },
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [compareViewportKey]: hasMeasurementsPayload
              ? preserveMeasurementScopeMetadata((payload.measurements ?? []) as MeasurementOverlay[], item.viewportMeasurements?.[compareViewportKey] ?? [])
              : item.viewportMeasurements?.[compareViewportKey] ?? []
          },
          viewportAnnotations: {
            ...(item.viewportAnnotations ?? {}),
            [compareViewportKey]: hasAnnotationsPayload
              ? preserveAnnotationScopeMetadata(payloadAnnotations, item.viewportAnnotations?.[compareViewportKey] ?? [])
              : item.viewportAnnotations?.[compareViewportKey] ?? []
          }
        })
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
        const rawFusionComposite = payload.fusionComposite ?? ((payload as { fusion_composite?: unknown }).fusion_composite ?? null)
        const fusionComposite = normalizeFusionCompositeInfoPayload(rawFusionComposite, fusionInfo)
        const acceptedRevision = item.fusionInfo?.revision ?? null
        const isStaleFusionImage = acceptedRevision != null && fusionInfo.revision < acceptedRevision
        if (isStaleFusionImage) {
          revokeIncomingImageSrcIfNeeded()
          return item
        }
        const fusionSeriesId = resolveFusionPaneSeriesId(fusionViewportKey, item.fusionSeriesIds, item.seriesId)
        const fusionSeriesCornerInfo =
          options.seriesCornerInfoMap.value[fusionSeriesId] ??
          options.seriesCornerInfoMap.value[item.seriesId] ??
          createEmptyCornerInfo()
        const currentImage = item.fusionImages?.[fusionViewportKey]
        const currentLayerImages = item.fusionLayerImages?.[fusionViewportKey] ?? null
        const layeredFusionComposite =
          fusionViewportKey === FUSION_OVERLAY_AXIAL_PANE_KEY && fusionComposite?.mode === 'ctPetLayers'
            ? fusionComposite
            : null
        const primaryImageUnchanged = layeredFusionComposite?.primaryImageUnchanged === true
        if (primaryImageUnchanged && !currentImage) {
          revokeIncomingImageSrcIfNeeded()
          return item
        }
        const shouldKeepCurrentPrimaryImage = primaryImageUnchanged && Boolean(currentImage)
        const nextPrimaryImage = shouldKeepCurrentPrimaryImage ? currentImage! : getIncomingImageSrc(currentImage)
        const nextPetLayerSrc = layeredFusionComposite && extraImageBinaries.pet
          ? imageUrlRegistry.create(extraImageBinaries.pet, 'image/png')
          : null
        const nextLayerImages: FusionLayerImages | null = layeredFusionComposite
          ? {
              ct: shouldKeepCurrentPrimaryImage
                ? currentLayerImages?.ct ?? currentImage
                : getIncomingImageSrc(currentLayerImages?.ct ?? currentImage),
              pet: nextPetLayerSrc ?? currentLayerImages?.pet,
              revision: layeredFusionComposite.revision,
              width: layeredFusionComposite.width,
              height: layeredFusionComposite.height
            }
          : null
        const fusionTransformState = hasTransformPayload
          ? transformState
          : item.fusionTransformStates?.[fusionViewportKey] ?? transformState
        const fusionCornerFallback = withRuntimeCornerInfo(
          mergeCornerInfo(fusionSeriesCornerInfo, sliceCornerInfo),
          fusionTransformState,
          null,
          null,
          true,
          payload.viewId
        )
        const mergedFusionCornerInfo = hasCornerInfoPayload
          ? fusionCornerFallback
          : mergePixelRuntimeCornerInfo(
              item.fusionCornerInfos?.[fusionViewportKey],
              pixelWindowLabel,
              fusionCornerFallback,
              fusionTransformState
            )
        const fusionCornerInfo = normalizeFusionPetCornerInfo(mergedFusionCornerInfo, fusionInfo, fusionViewportKey)
        if (shouldKeepCurrentPrimaryImage) {
          revokeIncomingImageSrcIfNeeded()
        } else if (!preserveCurrentImageSource) {
          revokeObjectUrlIfNeeded(currentImage)
        }
        if (nextPetLayerSrc) {
          revokeObjectUrlIfNeeded(currentLayerImages?.pet)
        } else if (!layeredFusionComposite) {
          revokeObjectUrlIfNeeded(currentLayerImages?.pet)
        }

        return withRenderRevision({
          ...item,
          fusionInfo,
          fusionImages: {
            ...(item.fusionImages ?? createEmptyFusionImages()),
            [fusionViewportKey]: nextPrimaryImage
          },
          fusionLayerImages: {
            ...(item.fusionLayerImages ?? createEmptyFusionLayerImages()),
            [fusionViewportKey]: nextLayerImages
          },
          fusionComposites: {
            ...(item.fusionComposites ?? createEmptyFusionComposites()),
            [fusionViewportKey]: layeredFusionComposite
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
          fusionInitialWindowInfos: {
            ...(item.fusionInitialWindowInfos ?? createEmptyFusionInitialWindowInfos()),
            [fusionViewportKey]: rememberInitialWindowInfo(item.fusionInitialWindowInfos?.[fusionViewportKey], ww, wl)
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
            [fusionViewportKey]: fusionTransformState
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
              ? preserveMeasurementScopeMetadata((payload.measurements ?? []) as MeasurementOverlay[], item.viewportMeasurements?.[fusionViewportKey] ?? [])
              : item.viewportMeasurements?.[fusionViewportKey] ?? []
          },
          viewportAnnotations: {
            ...(item.viewportAnnotations ?? {}),
            [fusionViewportKey]: hasAnnotationsPayload
              ? preserveAnnotationScopeMetadata(payloadAnnotations, item.viewportAnnotations?.[fusionViewportKey] ?? [])
              : item.viewportAnnotations?.[fusionViewportKey] ?? []
          }
        })
      }

      const currentViewportKey = Object.entries(item.viewportViewIds ?? {}).find(([, viewId]) => viewId === payload.viewId)?.[0] as
        | MprViewportKey
        | undefined
      const viewportKey = currentViewportKey ?? fourDViewportMatch?.viewportKey
      if (viewportKey && (item.viewType === 'MPR' || item.viewType === '4D')) {
        const isMprPreview = renderIntent === 'geometry-preview' || renderIntent === 'overlay-preview'
        const activeFourDPhaseKey =
          item.viewType === '4D' ? getFourDPhaseKey(clampFourDPhaseIndex(item, item.fourDPhaseIndex ?? 0)) : null
        const mprViewportUpdate: IncomingMprViewportUpdate = {
          tabKey,
          viewportKey,
          phaseKey: item.viewType === '4D' ? fourDViewportMatch?.phaseKey ?? activeFourDPhaseKey : null,
          mprRevision
        }
        const acceptedMprImageRevision =
          item.viewType === '4D' && fourDViewportMatch
            ? item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]?.viewportMprImageRevisions?.[viewportKey] ?? null
            : item.viewportMprImageRevisions?.[viewportKey] ?? null
        const acceptedMprStateRevision =
          item.viewType === '4D' && fourDViewportMatch
            ? item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]?.viewportMprStateRevisions?.[viewportKey] ?? null
            : item.viewportMprStateRevisions?.[viewportKey] ?? null
        const currentViewportImageBeforeUpdate =
          item.viewType === '4D' && fourDViewportMatch
            ? item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]?.viewportImages?.[viewportKey] ?? null
            : item.viewportImages?.[viewportKey] ?? null
        if (
          currentViewportImageBeforeUpdate &&
          shouldSuppressMprCrosshairPreviewImageUpdate({
            acceptedMprRevision: acceptedMprImageRevision,
            lock: options.activeMprCrosshairDragLock.value,
            update: mprViewportUpdate,
            imageFormat: payload.imageFormat,
            metadataMode: getImageUpdateMetadataMode(payload)
          })
        ) {
          revokeIncomingImageSrcIfNeeded()
          return item
        }
        const shouldApplyMprMetadataFromImage =
          mprRevision == null || acceptedMprStateRevision == null || mprRevision >= acceptedMprStateRevision
        const shouldCompleteSettling = shouldCompleteMprCrosshairSettling({
          lock: options.activeMprCrosshairDragLock.value,
          update: mprViewportUpdate,
          imageFormat: payload.imageFormat,
          acceptedMprRevision: maxMprRevision(acceptedMprImageRevision, acceptedMprStateRevision),
          currentCrosshair: item.viewportCrosshairs?.[viewportKey] ?? null,
          incomingCrosshair: mprCrosshair
        })
        if (shouldCompleteSettling) {
          mprCrosshairSettlingCompletionUpdate = mprViewportUpdate
        }
        const mprCrosshairPreservationLock = shouldCompleteSettling ? null : options.activeMprCrosshairDragLock.value
        const currentViewportImage = item.viewportImages?.[viewportKey]
        const currentSegmentationProgress = item.viewportLoadingProgress?.[viewportKey] ?? null
        const shouldPreserveImageForMprSegmentationUpdate =
          item.viewType === 'MPR' &&
          mprSegmentationPayload != null &&
          currentViewportKey != null &&
          currentViewportImage != null &&
          currentSegmentationProgress?.phase === 'render'
        if (shouldPreserveImageForMprSegmentationUpdate) {
          revokeIncomingImageSrcIfNeeded()
        } else if (currentViewportKey && !preserveCurrentImageSource) {
          revokeObjectUrlIfNeeded(currentViewportImage)
        }

        let nextFourDPhaseCache = item.fourDPhaseCache
        if (item.viewType === '4D' && fourDViewportMatch) {
          fourDPhaseRenderTracker.notifyRendered(tabKey, fourDViewportMatch.phaseKey, payload.viewId ?? '')
          const phase = getFourDPhaseByKey(item, fourDViewportMatch.phaseKey)
          const existingPhaseCache = item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]
          const phaseCacheSeed = createFourDPhaseCacheSeed(phase, existingPhaseCache)
          const previousCachedImage = existingPhaseCache?.viewportImages?.[viewportKey]
          if (!preserveCurrentImageSource && previousCachedImage !== currentViewportImage) {
            revokeObjectUrlIfNeeded(previousCachedImage)
          }

          const nextViewportImages = {
            ...(phaseCacheSeed.viewportImages ?? createEmptyMprImages()),
            [viewportKey]: getIncomingImageSrc(previousCachedImage ?? currentViewportImage)
          }
          const currentPhaseCrosshair = phaseCacheSeed.viewportCrosshairs?.[viewportKey] ?? null
          const nextViewportCrosshair = hasMprCrosshairUpdate && shouldApplyMprMetadataFromImage
            ? resolveMprCrosshairForImageUpdate({
                incomingCrosshair: mprCrosshair,
                currentCrosshair: currentPhaseCrosshair,
                lock: mprCrosshairPreservationLock,
                update: mprViewportUpdate
              })
            : currentPhaseCrosshair
          const phaseViewportTransformState = !hasTransformPayload
            ? phaseCacheSeed.viewportTransformStates?.[viewportKey] ?? transformState
            : transformState
          const phaseViewportCornerFallback = withRuntimeCornerInfo(
            mergeCornerInfo(seriesCornerInfo, sliceCornerInfo),
            phaseViewportTransformState,
            null,
            null,
            false,
            payload.viewId
          )
          nextFourDPhaseCache = {
            ...(item.fourDPhaseCache ?? {}),
            [fourDViewportMatch.phaseKey]: {
              ...phaseCacheSeed,
              status: hasCompleteMprViewportImages(nextViewportImages) ? 'ready' : 'loading',
              windowLabel,
              initialWindowInfo: rememberInitialWindowInfo(phaseCacheSeed.initialWindowInfo, ww, wl) ?? null,
              currentWindowInfo: resolveCurrentWindowInfo(
                phaseCacheSeed.currentWindowInfo,
                phaseCacheSeed.initialWindowInfo,
                ww,
                wl
              ),
              viewportInitialWindowInfos: {
                ...(phaseCacheSeed.viewportInitialWindowInfos ?? createEmptyMprInitialWindowInfos()),
                [viewportKey]: rememberInitialWindowInfo(phaseCacheSeed.viewportInitialWindowInfos?.[viewportKey], ww, wl)
              },
              viewportCurrentWindowInfos: {
                ...(phaseCacheSeed.viewportCurrentWindowInfos ?? createEmptyMprCurrentWindowInfos()),
                [viewportKey]: resolveCurrentWindowInfo(
                  phaseCacheSeed.viewportCurrentWindowInfos?.[viewportKey],
                  phaseCacheSeed.viewportInitialWindowInfos?.[viewportKey],
                  ww,
                  wl
                )
              },
              mprCursor: shouldApplyMprMetadataFromImage ? mprCursor ?? phaseCacheSeed.mprCursor ?? null : phaseCacheSeed.mprCursor ?? null,
              mprFrame: shouldApplyMprMetadataFromImage ? mprFrame ?? phaseCacheSeed.mprFrame ?? null : phaseCacheSeed.mprFrame ?? null,
              mprRevision: maxMprRevision(phaseCacheSeed.mprRevision, mprRevision),
              viewportMprImageRevisions: mergeViewportMprRevision(
                phaseCacheSeed.viewportMprImageRevisions,
                viewportKey,
                mprRevision
              ),
              viewportMprStateRevisions: shouldApplyMprMetadataFromImage
                ? mergeViewportMprRevision(phaseCacheSeed.viewportMprStateRevisions, viewportKey, mprRevision)
                : phaseCacheSeed.viewportMprStateRevisions,
              viewportImages: nextViewportImages,
              viewportSliceLabels: {
                ...(phaseCacheSeed.viewportSliceLabels ?? createEmptyMprSliceLabels()),
                [viewportKey]: shouldApplyMprMetadataFromImage ? sliceLabel : phaseCacheSeed.viewportSliceLabels?.[viewportKey] ?? ''
              },
              viewportPlanes: {
                ...(phaseCacheSeed.viewportPlanes ?? createEmptyMprPlanes()),
                [viewportKey]: shouldApplyMprMetadataFromImage ? mprPlane ?? phaseCacheSeed.viewportPlanes?.[viewportKey] ?? null : phaseCacheSeed.viewportPlanes?.[viewportKey] ?? null
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
                [viewportKey]: !hasMeasurementsPayload || (isMprPreview && !payload.measurements?.length)
                  ? phaseCacheSeed.viewportMeasurements?.[viewportKey] ?? []
                  : preserveMeasurementScopeMetadata(
                      (payload.measurements ?? []) as MeasurementOverlay[],
                      phaseCacheSeed.viewportMeasurements?.[viewportKey] ?? []
                    )
              },
              viewportCornerInfos: {
                ...(phaseCacheSeed.viewportCornerInfos ?? createEmptyMprCornerInfos()),
                [viewportKey]: !hasCornerInfoPayload
                  ? mergePixelRuntimeCornerInfo(
                      phaseCacheSeed.viewportCornerInfos?.[viewportKey],
                      pixelWindowLabel,
                      phaseViewportCornerFallback,
                      phaseViewportTransformState,
                      false
                    )
                  : phaseViewportCornerFallback
              },
              viewportOrientations: {
                ...(phaseCacheSeed.viewportOrientations ?? createEmptyMprOrientations()),
                [viewportKey]: !hasOrientationPayload
                  ? phaseCacheSeed.viewportOrientations?.[viewportKey] ?? orientationInfo
                  : orientationInfo
              },
              viewportTransformStates: {
                ...(phaseCacheSeed.viewportTransformStates ?? createEmptyMprTransformStates()),
                [viewportKey]: phaseViewportTransformState
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
            return withRenderRevision({
              ...nextItem,
              ...getFourDPhaseDisplayState(nextItem, activePhaseIndex, options.seriesCornerInfoMap.value)
            })
          }
          return withRenderRevision({
            ...item,
            fourDPhaseCache: nextFourDPhaseCache
          })
        }

        const currentViewportCrosshair = item.viewportCrosshairs?.[viewportKey] ?? null
        const nextViewportCrosshair = hasMprCrosshairUpdate && shouldApplyMprMetadataFromImage
          ? resolveMprCrosshairForImageUpdate({
              incomingCrosshair: mprCrosshair,
              currentCrosshair: currentViewportCrosshair,
              lock: mprCrosshairPreservationLock,
              update: mprViewportUpdate
            })
          : currentViewportCrosshair
        const viewportTransformState = !hasTransformPayload
          ? item.viewportTransformStates?.[viewportKey] ?? transformState
          : transformState
        const viewportCornerFallback = withRuntimeCornerInfo(
          mergeCornerInfo(seriesCornerInfo, sliceCornerInfo),
          viewportTransformState,
          null,
          null,
          false,
          payload.viewId
        )

        return withRenderRevision({
          ...item,
          windowLabel,
          initialWindowInfo: rememberInitialWindowInfo(item.initialWindowInfo, ww, wl) ?? null,
          currentWindowInfo: resolveCurrentWindowInfo(item.currentWindowInfo, item.initialWindowInfo, ww, wl),
          mprCursor: shouldApplyMprMetadataFromImage ? mprCursor ?? item.mprCursor ?? null : item.mprCursor ?? null,
          mprFrame: shouldApplyMprMetadataFromImage ? mprFrame ?? item.mprFrame ?? null : item.mprFrame ?? null,
          mprRevision: maxMprRevision(item.mprRevision, mprRevision),
          viewportMprImageRevisions: mergeViewportMprRevision(item.viewportMprImageRevisions, viewportKey, mprRevision),
          viewportMprStateRevisions: shouldApplyMprMetadataFromImage
            ? mergeViewportMprRevision(item.viewportMprStateRevisions, viewportKey, mprRevision)
            : item.viewportMprStateRevisions,
          viewportImages: shouldPreserveImageForMprSegmentationUpdate
            ? item.viewportImages ?? createEmptyMprImages()
            : {
                ...(item.viewportImages ?? createEmptyMprImages()),
                [viewportKey]: getIncomingImageSrc(currentViewportImage)
              },
          viewportSliceLabels: {
            ...(item.viewportSliceLabels ?? createEmptyMprSliceLabels()),
            [viewportKey]: shouldApplyMprMetadataFromImage ? sliceLabel : item.viewportSliceLabels?.[viewportKey] ?? ''
          },
          viewportPlanes: {
            ...(item.viewportPlanes ?? createEmptyMprPlanes()),
            [viewportKey]: shouldApplyMprMetadataFromImage ? mprPlane ?? item.viewportPlanes?.[viewportKey] ?? null : item.viewportPlanes?.[viewportKey] ?? null
          },
          viewportCrosshairs: {
            ...(item.viewportCrosshairs ?? createEmptyMprCrosshairs()),
            [viewportKey]: nextViewportCrosshair
          },
          viewportScaleBars: {
            ...(item.viewportScaleBars ?? createEmptyMprScaleBars()),
            [viewportKey]: scaleBar ?? item.viewportScaleBars?.[viewportKey] ?? null
          },
          viewportSegmentationOverlays: {
            ...(item.viewportSegmentationOverlays ?? createEmptyMprSegmentationOverlays()),
            [viewportKey]: hasMprSegmentationOverlayUpdate
              ? (
                  shouldAcceptMprSegmentationOverlay
                    ? mergeMprSegmentationOverlaySamples(
                        item.viewportSegmentationOverlays?.[viewportKey] ?? null,
                        mprSegmentationOverlayPayload ?? null
                      )
                    : item.viewportSegmentationOverlays?.[viewportKey] ?? null
                )
              : item.viewportSegmentationOverlays?.[viewportKey] ?? null
          },
          viewportMeasurements: {
            ...(item.viewportMeasurements ?? {}),
            [viewportKey]: !hasMeasurementsPayload || (isMprPreview && !payload.measurements?.length)
              ? item.viewportMeasurements?.[viewportKey] ?? []
              : preserveMeasurementScopeMetadata(
                  (payload.measurements ?? []) as MeasurementOverlay[],
                  item.viewportMeasurements?.[viewportKey] ?? []
                )
          },
          viewportCornerInfos: {
            ...(item.viewportCornerInfos ?? createEmptyMprCornerInfos()),
            [viewportKey]: !hasCornerInfoPayload
              ? mergePixelRuntimeCornerInfo(
                  item.viewportCornerInfos?.[viewportKey],
                  pixelWindowLabel,
                  viewportCornerFallback,
                  viewportTransformState,
                  false
                )
              : viewportCornerFallback
          },
          viewportOrientations: {
            ...(item.viewportOrientations ?? createEmptyMprOrientations()),
            [viewportKey]: !hasOrientationPayload
              ? item.viewportOrientations?.[viewportKey] ?? orientationInfo
              : orientationInfo
          },
          viewportTransformStates: {
            ...(item.viewportTransformStates ?? createEmptyMprTransformStates()),
            [viewportKey]: viewportTransformState
          },
          viewportPseudocolorPresets: {
            ...(item.viewportPseudocolorPresets ?? createEmptyMprPseudocolorPresets()),
            [viewportKey]: pseudocolorPreset
          },
          viewportInitialWindowInfos: {
            ...(item.viewportInitialWindowInfos ?? createEmptyMprInitialWindowInfos()),
            [viewportKey]: rememberInitialWindowInfo(item.viewportInitialWindowInfos?.[viewportKey], ww, wl)
          },
          viewportCurrentWindowInfos: {
            ...(item.viewportCurrentWindowInfos ?? createEmptyMprCurrentWindowInfos()),
            [viewportKey]: resolveCurrentWindowInfo(
              item.viewportCurrentWindowInfos?.[viewportKey],
              item.viewportInitialWindowInfos?.[viewportKey],
              ww,
              wl
            )
          },
          viewportLoadingProgress: {
            ...(item.viewportLoadingProgress ?? {}),
            [viewportKey]: null
          },
          mprMipConfig,
          mprSegmentationConfig,
          mprCrosshairMode: shouldApplyMprMetadataFromImage ? mprCrosshairMode : item.mprCrosshairMode,
          volumePreset,
          volumeRenderConfig,
          render3dMode,
          surfaceRenderConfig,
          volumeRenderOptions,
          fourDPhaseCache: nextFourDPhaseCache
        })
      }

      if (item.viewType === '4D') {
        revokeIncomingImageSrcIfNeeded()
        return item
      }

      const previousPetInfo = item.petInfo ?? createDefaultPetInfo(item.seriesId)
      const rawPetInfo = payload.petInfo ?? ((payload as { pet_info?: unknown }).pet_info ?? null)
      const normalizedPetInfo = item.viewType === 'PET'
        ? normalizePetInfoPayload(rawPetInfo, previousPetInfo)
        : null
      const singlePseudocolorPreset = item.viewType === 'PET'
        ? normalizeStandalonePetPseudocolorPreset()
        : pseudocolorPreset
      const petInfo = normalizedPetInfo
        ? {
            ...normalizedPetInfo,
            pseudocolorPreset: singlePseudocolorPreset
          }
        : item.petInfo ?? null
      const singleTransformState = hasTransformPayload ? transformState : item.transformState ?? transformState
      const isVolumeView = item.viewType === '3D'
      const singleCornerFallback = withRuntimeCornerInfo(
        mergeCornerInfo(seriesCornerInfo, sliceCornerInfo),
        singleTransformState,
        null,
        null,
        !isVolumeView,
        payload.viewId
      )
      const baseSingleCornerInfo = hasCornerInfoPayload
        ? singleCornerFallback
        : mergePixelRuntimeCornerInfo(
            item.cornerInfo,
            pixelWindowLabel,
            singleCornerFallback,
            singleTransformState,
            !isVolumeView
          )
      const singleCornerInfo = item.viewType === 'PET'
        ? normalizeStandalonePetCornerInfo(baseSingleCornerInfo, petInfo ?? previousPetInfo)
        : isVolumeView
          ? stripVolumeCornerInfo(baseSingleCornerInfo)
          : baseSingleCornerInfo

      if (!preserveCurrentImageSource) {
        revokeObjectUrlIfNeeded(item.imageSrc)
      }

      return withRenderRevision({
        ...item,
        viewId: payload.viewId ?? item.viewId,
        imageSrc: getIncomingImageSrc(item.imageSrc),
        sliceLabel,
        windowLabel,
        initialWindowInfo: rememberInitialWindowInfo(item.initialWindowInfo, ww, wl) ?? null,
        currentWindowInfo: resolveCurrentWindowInfo(item.currentWindowInfo, item.initialWindowInfo, ww, wl),
        measurements: hasMeasurementsPayload
          ? preserveMeasurementScopeMetadata((payload.measurements ?? []) as MeasurementOverlay[], item.measurements ?? [])
          : item.measurements ?? [],
        annotations: hasAnnotationsPayload ? preserveAnnotationScopeMetadata(payloadAnnotations, item.annotations ?? []) : item.annotations ?? [],
        scaleBar: hasScaleBarPayload ? scaleBar : item.scaleBar ?? null,
        cornerInfo: singleCornerInfo,
        orientation: hasOrientationPayload ? orientationInfo : item.orientation ?? orientationInfo,
        transformState: singleTransformState,
        pseudocolorPreset: singlePseudocolorPreset,
        petInfo,
        mprMipConfig,
        mprSegmentationConfig,
        mprCrosshairMode,
        volumePreset,
        volumeRenderConfig,
        render3dMode,
        surfaceRenderConfig,
        volumeRenderOptions,
        loadingProgress: null
      })
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
      const mprRevision = normalizeMprRevision(rawMprRevision)
      const acceptedMprStateRevision =
        item.viewType === '4D' && fourDViewportMatch
          ? item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]?.viewportMprStateRevisions?.[viewportKey] ?? null
          : item.viewportMprStateRevisions?.[viewportKey] ?? null
      if (mprRevision != null && acceptedMprStateRevision != null && mprRevision < acceptedMprStateRevision) {
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
      const windowLabel = formatWindowInfoLabel(ww, wl) ?? item.windowLabel
      const pixelWindowLabel = ww != null || wl != null ? windowLabel : null
      const metadataSeriesId =
        item.viewType === '4D' && fourDViewportMatch
          ? resolveFourDPhaseSeriesId(item, fourDViewportMatch.phaseKey)
          : item.seriesId
      const seriesCornerInfo =
        options.seriesCornerInfoMap.value[metadataSeriesId] ??
        options.seriesCornerInfoMap.value[item.seriesId] ??
        createEmptyCornerInfo()
      const hasCornerInfoPayload = payload.cornerInfo != null
      const stateCornerInfoBase = hasCornerInfoPayload
        ? mergeCornerInfo(seriesCornerInfo, options.stripHoverCornerInfo(normalizeCornerInfo(payload.cornerInfo)))
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
      const currentMprSegmentationConfig = normalizeMprSegmentationConfig(
        item.mprSegmentationConfig,
        createDefaultMprSegmentationConfig()
      )
      const mprSegmentationPayload = getMprSegmentationConfigPayload(payload)
      const incomingMprSegmentationConfig = normalizeMprSegmentationConfig(
        mprSegmentationPayload,
        currentMprSegmentationConfig
      )
      const mprSegmentationOverlayPayload = getMprSegmentationOverlayPayload(payload)
      const hasMprSegmentationOverlayUpdate = hasMprSegmentationOverlayPayload(payload)
      const isStaleMprSegmentationPreview =
        mprSegmentationPayload != null &&
        isStaleMprSegmentationPreviewConfig(currentMprSegmentationConfig, incomingMprSegmentationConfig)
      const mprSegmentationConfig = mprSegmentationPayload == null
        ? currentMprSegmentationConfig
        : isStaleMprSegmentationPreview
          ? currentMprSegmentationConfig
          : mergeMprSegmentationPreviewConfig(currentMprSegmentationConfig, incomingMprSegmentationConfig)
      const shouldAcceptMprSegmentationOverlay =
        hasMprSegmentationOverlayUpdate &&
        (
          mprSegmentationPayload == null ||
          (isStaleMprSegmentationPreview && hasMprSegmentationOverlaySamples(mprSegmentationOverlayPayload)) ||
          incomingMprSegmentationConfig.clientRevision >= currentMprSegmentationConfig.clientRevision
        )
      const mprCrosshairMode = payload.mprCrosshairMode === 'double-oblique' ? 'double-oblique' : item.mprCrosshairMode ?? 'orthogonal'

      let nextFourDPhaseCache = item.fourDPhaseCache
      if (item.viewType === '4D' && fourDViewportMatch) {
        const phase = getFourDPhaseByKey(item, fourDViewportMatch.phaseKey)
        const existingPhaseCache = item.fourDPhaseCache?.[fourDViewportMatch.phaseKey]
        const phaseCacheSeed = createFourDPhaseCacheSeed(phase, existingPhaseCache)
        const phaseViewportTransformState = transformState ?? phaseCacheSeed.viewportTransformStates?.[viewportKey] ?? createDefaultTransformInfo()
        const phaseStateCornerInfo = stateCornerInfoBase
          ? withRuntimeCornerInfo(stateCornerInfoBase, phaseViewportTransformState, null, null, false, payload.viewId)
          : null
        nextFourDPhaseCache = {
          ...(item.fourDPhaseCache ?? {}),
          [fourDViewportMatch.phaseKey]: {
            ...phaseCacheSeed,
            windowLabel,
            initialWindowInfo: rememberInitialWindowInfo(phaseCacheSeed.initialWindowInfo, ww, wl) ?? null,
            currentWindowInfo: resolveCurrentWindowInfo(
              phaseCacheSeed.currentWindowInfo,
              phaseCacheSeed.initialWindowInfo,
              ww,
              wl
            ),
            viewportInitialWindowInfos: {
              ...(phaseCacheSeed.viewportInitialWindowInfos ?? createEmptyMprInitialWindowInfos()),
              [viewportKey]: rememberInitialWindowInfo(phaseCacheSeed.viewportInitialWindowInfos?.[viewportKey], ww, wl)
            },
            viewportCurrentWindowInfos: {
              ...(phaseCacheSeed.viewportCurrentWindowInfos ?? createEmptyMprCurrentWindowInfos()),
              [viewportKey]: resolveCurrentWindowInfo(
                phaseCacheSeed.viewportCurrentWindowInfos?.[viewportKey],
                phaseCacheSeed.viewportInitialWindowInfos?.[viewportKey],
                ww,
                wl
              )
            },
            mprCursor: mprCursor ?? phaseCacheSeed.mprCursor ?? null,
            mprFrame: mprFrame ?? phaseCacheSeed.mprFrame ?? null,
            mprRevision: maxMprRevision(phaseCacheSeed.mprRevision, mprRevision),
            viewportMprStateRevisions: mergeViewportMprRevision(
              phaseCacheSeed.viewportMprStateRevisions,
              viewportKey,
              mprRevision
            ),
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
              [viewportKey]: phaseStateCornerInfo ?? mergePixelRuntimeCornerInfo(
                phaseCacheSeed.viewportCornerInfos?.[viewportKey],
                pixelWindowLabel,
                mergeTransformCornerInfoTag(createEmptyCornerInfo(), phaseViewportTransformState, false),
                phaseViewportTransformState,
                false
              )
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
              [viewportKey]: phaseViewportTransformState
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
            mprMipConfig,
            mprSegmentationConfig
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
          mprMipConfig,
          mprSegmentationConfig
        }
      }

      const viewportTransformState = transformState ?? item.viewportTransformStates?.[viewportKey] ?? createDefaultTransformInfo()
      const stateCornerInfo = stateCornerInfoBase
        ? withRuntimeCornerInfo(stateCornerInfoBase, viewportTransformState, null, null, false, payload.viewId)
        : null

      return {
        ...item,
        windowLabel,
        initialWindowInfo: rememberInitialWindowInfo(item.initialWindowInfo, ww, wl) ?? null,
        currentWindowInfo: resolveCurrentWindowInfo(item.currentWindowInfo, item.initialWindowInfo, ww, wl),
        mprCursor: mprCursor ?? item.mprCursor ?? null,
        mprFrame: mprFrame ?? item.mprFrame ?? null,
        mprRevision: maxMprRevision(item.mprRevision, mprRevision),
        viewportMprStateRevisions: mergeViewportMprRevision(item.viewportMprStateRevisions, viewportKey, mprRevision),
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
          [viewportKey]: stateCornerInfo ?? mergePixelRuntimeCornerInfo(
            item.viewportCornerInfos?.[viewportKey],
            pixelWindowLabel,
            mergeTransformCornerInfoTag(createEmptyCornerInfo(), viewportTransformState, false),
            viewportTransformState,
            false
          )
        },
        viewportScaleBars: {
          ...(item.viewportScaleBars ?? createEmptyMprScaleBars()),
          [viewportKey]: scaleBar ?? item.viewportScaleBars?.[viewportKey] ?? null
        },
        viewportSegmentationOverlays: {
          ...(item.viewportSegmentationOverlays ?? createEmptyMprSegmentationOverlays()),
          [viewportKey]: hasMprSegmentationOverlayUpdate
            ? (
                shouldAcceptMprSegmentationOverlay
                  ? mergeMprSegmentationOverlaySamples(
                      item.viewportSegmentationOverlays?.[viewportKey] ?? null,
                      mprSegmentationOverlayPayload ?? null
                    )
                  : item.viewportSegmentationOverlays?.[viewportKey] ?? null
              )
            : item.viewportSegmentationOverlays?.[viewportKey] ?? null
        },
        viewportOrientations: {
          ...(item.viewportOrientations ?? createEmptyMprOrientations()),
          [viewportKey]: orientationInfo ?? item.viewportOrientations?.[viewportKey] ?? createEmptyOrientationInfo()
        },
        viewportTransformStates: {
          ...(item.viewportTransformStates ?? createEmptyMprTransformStates()),
          [viewportKey]: viewportTransformState
        },
        viewportInitialWindowInfos: {
          ...(item.viewportInitialWindowInfos ?? createEmptyMprInitialWindowInfos()),
          [viewportKey]: rememberInitialWindowInfo(item.viewportInitialWindowInfos?.[viewportKey], ww, wl)
        },
        viewportCurrentWindowInfos: {
          ...(item.viewportCurrentWindowInfos ?? createEmptyMprCurrentWindowInfos()),
          [viewportKey]: resolveCurrentWindowInfo(
            item.viewportCurrentWindowInfos?.[viewportKey],
            item.viewportInitialWindowInfos?.[viewportKey],
            ww,
            wl
          )
        },
        mprMipConfig,
        mprSegmentationConfig,
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

  function localizeViewProgressMessage(value: unknown): string | null {
    if (typeof value !== 'string' || !value) {
      return null
    }
    const surfaceMessages: Record<string, [string, string]> = {
      '正在准备 Surface 数据...': ['正在准备 Surface 数据...', 'Preparing Surface data...'],
      '正在提取 Surface 等值面...': ['正在提取 Surface 等值面...', 'Extracting the Surface mesh...'],
      '正在复用 Surface 网格...': ['正在复用 Surface 网格...', 'Reusing the cached Surface mesh...'],
      'Surface 表面优化完成': ['Surface 表面优化完成', 'Surface optimization complete'],
      '正在更新 Surface 材质...': ['正在更新 Surface 材质...', 'Updating Surface material...']
    }
    const localized = surfaceMessages[value]
    return localized ? viewMessage(localized[0], localized[1]) : value
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
      message: localizeViewProgressMessage(record.message)
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

  function formatPetWindowLabel(info: Pick<FusionInfo, 'petWindowMin' | 'petWindowMax' | 'petUnit' | 'petUnitLabel'>): string | null {
    const minValue =
      typeof info.petWindowMin === 'number' && Number.isFinite(info.petWindowMin)
        ? info.petWindowMin
        : DEFAULT_FUSION_PET_WINDOW_MIN
    const maxValue =
      typeof info.petWindowMax === 'number' && Number.isFinite(info.petWindowMax)
        ? info.petWindowMax
        : DEFAULT_FUSION_PET_WINDOW_MAX
    const unitLabel = stripTrailingUnitDetail(info.petUnitLabel || (info.petUnit === 'SUVbw' ? 'g/ml (SUVbw)' : info.petUnit) || '')
    const unit = String(info.petUnit ?? unitLabel).toLowerCase()
    const prefix = unit.includes('suv') || unit.includes('sul') || unit.includes('g/ml') ? 'SUV' : 'PET'
    return `${prefix}:${minValue.toFixed(2)}--${maxValue.toFixed(2)}${unitLabel}`.trim()
  }

  function formatFusionPetWindowLabel(fusionInfo: FusionInfo): string | null {
    return formatPetWindowLabel(fusionInfo)
  }

  function formatStandalonePetWindowLabel(petInfo: PetInfo): string | null {
    return formatPetWindowLabel(petInfo)
  }

  function stripTrailingUnitDetail(value: string): string {
    return value.replace(/\s*\([^)]*\)\s*$/, '').trim()
  }

  function isPetWindowCornerLine(line: string): boolean {
    const value = line.trim()
    return /^(?:SUV|PET)\s*:/i.test(value) || /^W\s*:/i.test(value) || /^WW\b/i.test(value)
  }

  function stripPetWindowCornerInfo(cornerInfo: CornerInfo, options: { hideMipSourceSliceLine?: boolean } = {}): CornerInfo {
    const sliceThicknessLines = new Set(cornerInfo.tags?.sliceThickness ?? [])
    const shouldDropLine = (line: string): boolean =>
      isPetWindowCornerLine(line) || (options.hideMipSourceSliceLine === true && sliceThicknessLines.has(line))
    const nextTags = { ...(cornerInfo.tags ?? {}) }
    delete nextTags.windowLevel
    if (options.hideMipSourceSliceLine === true) {
      delete nextTags.imageIndex
      delete nextTags.sliceThickness
    }
    return {
      ...cornerInfo,
      topLeft: cornerInfo.topLeft.filter((line) => !shouldDropLine(line)),
      topRight: cornerInfo.topRight.filter((line) => !shouldDropLine(line)),
      bottomLeft: cornerInfo.bottomLeft.filter((line) => !shouldDropLine(line)),
      bottomRight: cornerInfo.bottomRight.filter((line) => !shouldDropLine(line)),
      tags: nextTags
    }
  }

  function normalizePetWindowCornerInfo(
    cornerInfo: CornerInfo,
    label: string | null,
    options: { hideMipSourceSliceLine?: boolean } = {}
  ): CornerInfo {
    if (!label) {
      return stripPetWindowCornerInfo(cornerInfo, options)
    }
    const sliceThicknessLines = new Set(cornerInfo.tags?.sliceThickness ?? [])
    const shouldHideLine = (line: string): boolean =>
      options.hideMipSourceSliceLine === true && sliceThicknessLines.has(line)
    const normalizeLines = (lines: string[], insertLabel: boolean): string[] => {
      const nextLines = lines
        .map((line) => (isPetWindowCornerLine(line) ? (insertLabel ? label : '') : line))
        .filter((line) => line && !shouldHideLine(line))
      if (insertLabel && !nextLines.includes(label)) {
        nextLines.unshift(label)
      }
      return [...new Set(nextLines)]
    }
    const nextTags: CornerInfo['tags'] = { ...(cornerInfo.tags ?? {}), windowLevel: [label] }
    if (options.hideMipSourceSliceLine === true) {
      delete nextTags.imageIndex
      delete nextTags.sliceThickness
    }
    return {
      ...cornerInfo,
      topLeft: normalizeLines(cornerInfo.topLeft, false),
      topRight: normalizeLines(cornerInfo.topRight, false),
      bottomLeft: normalizeLines(cornerInfo.bottomLeft, true),
      bottomRight: normalizeLines(cornerInfo.bottomRight, false),
      tags: nextTags
    }
  }

  function normalizeStandalonePetCornerInfo(cornerInfo: CornerInfo, petInfo: PetInfo): CornerInfo {
    return normalizePetWindowCornerInfo(cornerInfo, formatStandalonePetWindowLabel(petInfo))
  }

  function normalizeFusionPetCornerInfo(cornerInfo: CornerInfo, fusionInfo: FusionInfo, paneKey: FusionPaneKey): CornerInfo {
    const label = formatFusionPetWindowLabel(fusionInfo)
    const isPetOnlyPane = paneKey === FUSION_PET_AXIAL_PANE_KEY || paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY
    const isMipPane = paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY
    if (isPetOnlyPane) {
      return normalizePetWindowCornerInfo(cornerInfo, label, { hideMipSourceSliceLine: isMipPane })
    }
    return normalizePetWindowCornerInfo(cornerInfo, label)
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

  function normalizeFusionCompositeInfoPayload(
    value: unknown,
    fallbackInfo: FusionInfo
  ): FusionCompositeInfo | null {
    if (typeof value !== 'object' || value == null) {
      return null
    }

    const record = value as Record<string, unknown>
    const revision = record.revision
    const alpha = record.alpha
    const width = record.width
    const height = record.height
    if (
      typeof revision !== 'number' ||
      !Number.isFinite(revision) ||
      typeof alpha !== 'number' ||
      !Number.isFinite(alpha) ||
      typeof width !== 'number' ||
      !Number.isFinite(width) ||
      typeof height !== 'number' ||
      !Number.isFinite(height)
    ) {
      return null
    }

    const normalizedInfo = normalizeFusionInfoPayload(
      {
        paneRole: fallbackInfo.paneRole,
        ctSeriesId: fallbackInfo.ctSeriesId,
        petSeriesId: fallbackInfo.petSeriesId,
        petPseudocolorPreset: fallbackInfo.petPseudocolorPreset,
        petUnit: fallbackInfo.petUnit,
        petUnitLabel: fallbackInfo.petUnitLabel,
        petWindowMin: fallbackInfo.petWindowMin,
        petWindowMax: fallbackInfo.petWindowMax,
        alpha,
        revision,
        registration: record.registration
      },
      fallbackInfo
    )
    const layers = Array.isArray(record.layers)
      ? record.layers
          .filter((layer): layer is Record<string, unknown> => typeof layer === 'object' && layer != null)
          .map((layer) => ({
            key: typeof layer.key === 'string' ? layer.key : '',
            role: typeof layer.role === 'string' ? layer.role : '',
            imageFormat: typeof (layer.imageFormat ?? layer.image_format) === 'string'
              ? String(layer.imageFormat ?? layer.image_format)
              : 'png'
          }))
          .filter((layer) => layer.key && layer.role)
      : []

    return {
      mode: typeof record.mode === 'string' ? record.mode : 'ctPetLayers',
      revision: normalizedInfo.revision,
      alpha: normalizedInfo.alpha,
      registration: normalizedInfo.registration,
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height)),
      layers,
      primaryImageUnchanged: record.primaryImageUnchanged === true || record.primary_image_unchanged === true
    }
  }

  function normalizePetInfoPayload(value: unknown, fallback: PetInfo): PetInfo {
    if (typeof value !== 'object' || value == null) {
      return {
        ...fallback,
        pseudocolorPreset: normalizeStandalonePetPseudocolorPreset()
      }
    }

    const record = value as Record<string, unknown>
    const petWindowMin = record.petWindowMin ?? record.pet_window_min
    const petWindowMax = record.petWindowMax ?? record.pet_window_max
    const numberOrFallback = (candidate: unknown, fallbackValue: number | null | undefined): number | null | undefined =>
      typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallbackValue
    return {
      seriesId: typeof (record.seriesId ?? record.series_id) === 'string'
        ? String(record.seriesId ?? record.series_id)
        : fallback.seriesId,
      petUnit: typeof (record.petUnit ?? record.pet_unit) === 'string'
        ? String(record.petUnit ?? record.pet_unit)
        : fallback.petUnit,
      petUnitLabel: typeof (record.petUnitLabel ?? record.pet_unit_label) === 'string'
        ? String(record.petUnitLabel ?? record.pet_unit_label)
        : fallback.petUnitLabel,
      petWindowMin: numberOrFallback(petWindowMin, fallback.petWindowMin ?? DEFAULT_FUSION_PET_WINDOW_MIN),
      petWindowMax: numberOrFallback(petWindowMax, fallback.petWindowMax ?? DEFAULT_FUSION_PET_WINDOW_MAX),
      pseudocolorPreset: normalizeStandalonePetPseudocolorPreset()
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
        const shouldOverlayProgressOnExistingImage = item.viewType === '3D' && nextProgress?.phase === 'preprocess'
        if (nextProgress && item.imageSrc && !shouldOverlayProgressOnExistingImage) {
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

      const layoutSlot = item.viewType === 'Layout'
        ? item.layoutSlots?.find((slot) => slot.viewId === progress.viewId)
        : null
      if (layoutSlot) {
        const isVolumeLayoutSlot = layoutSlot.viewType === '3D' || layoutSlot.sourceViewType === '3D'
        const shouldOverlayProgressOnExistingImage = isVolumeLayoutSlot && nextProgress?.phase === 'preprocess'
        if (nextProgress && layoutSlot.imageSrc && !shouldOverlayProgressOnExistingImage) {
          return item
        }
        return {
          ...item,
          loadingProgress: isVolumeLayoutSlot ? nextProgress : item.loadingProgress
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
      const { postApi } = await loadTypedApi()
      if (renderOnBind) {
        await postApi('SetViewSizeApiV1ViewSetSizePost', {
          opType: VIEW_OPERATION_TYPES.setSize,
          size: update.size,
          viewId: update.viewId,
          imageFormat: VIEWER_IMAGE_TRANSPORT_FORMAT
        })
        bindView(update.viewId)
        return
      }

      await bindViewSilentlyWithAck(update.viewId)
      await postApi('SetViewSizeApiV1ViewSetSizePost', {
        opType: VIEW_OPERATION_TYPES.setSize,
        size: update.size,
        viewId: update.viewId,
        imageFormat: VIEWER_IMAGE_TRANSPORT_FORMAT
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

    const { postApi } = await loadTypedApi()
    const data = await postApi('CreateViewApiV1ViewCreatePost', {
      seriesId: tab.seriesId,
      viewType: '3D'
    })
    const volumeConfig = tab.volumeRenderConfig ?? null
    const volumePreset = tab.volumePreset
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
            surfaceRenderConfig: surfaceConfig,
            volumeRenderOptions: normalizeVolumeRenderOptions(tab.volumeRenderOptions, createDefaultVolumeRenderOptions())
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
    const isPetBackedView = viewType === 'PET' || (viewType === 'Montage' && isPetSeries(targetSeries))
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
      const petPseudocolorMigrated = viewType === 'PET'
        ? await migrateStandalonePetPseudocolorIfNeeded(existingTab)
        : false
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
      if ((viewType === 'Stack' || viewType === 'PET' || viewType === 'Montage') && (!existingTab.imageSrc || petPseudocolorMigrated)) {
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
                title: buildTabTitle(series, viewType, item.seriesId),
                seriesTitle: getSeriesDisplayName(series, item.seriesId),
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
        // Tag data is refreshed in place. Keep the current table mounted so switching
        // instances never replaces it with the workspace-wide loading screen.
        options.isViewLoading.value = false
        await loadTagTab(tabKey, initialIndex)
        return
      }

      const defaultTransformState = createDefaultTransformInfo()
      const seriesCornerInfo = withRuntimeCornerInfo(
        await options.ensureSeriesCornerInfo(options.selectedSeriesId.value),
        defaultTransformState,
        null,
        null,
        viewType !== 'MPR' && viewType !== '3D'
      )
      const initialPseudocolorPreset = isPetBackedView
        ? DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET
        : normalizePseudocolorPresetKey(selectedPseudocolorKey.value)
      let nextViewId = ''
      let nextViewportViewIds = createEmptyMprViewIds()

      if (viewType === 'MPR') {
        const { postApi } = await loadTypedApi()
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
        const { postApi } = await loadTypedApi()
        const data = await postApi('CreateViewApiV1ViewCreatePost', {
          seriesId,
          viewType: viewType === 'Montage' ? (isPetBackedView ? 'PET' : 'Stack') : viewType
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
              currentWindowInfo: null,
              mprFrame: null,
              mprCursor: null,
              viewportViewIds: nextViewportViewIds,
              viewportImages: createEmptyMprImages(),
              viewportLoadingProgress: {},
              viewportSliceLabels: createEmptyMprSliceLabels(),
              viewportCurrentWindowInfos: createEmptyMprCurrentWindowInfos(),
              viewportPlanes: createEmptyMprPlanes(),
              viewportCrosshairs: createEmptyMprCrosshairs(),
              viewportScaleBars: createEmptyMprScaleBars(),
              measurements: [],
              annotations: [],
              scaleBar: null,
              cornerInfo: viewType === '3D' ? stripVolumeCornerInfo(seriesCornerInfo) : seriesCornerInfo,
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
              transformState: defaultTransformState,
              viewportTransformStates: createEmptyMprTransformStates(),
              pseudocolorPreset: initialPseudocolorPreset,
              petInfo: isPetBackedView ? createDefaultPetInfo(seriesId) : item.petInfo ?? null,
              montageColumnCount: viewType === 'Montage' ? montageColumnCount.value : item.montageColumnCount,
              montageSelectedSliceIndex: viewType === 'Montage' ? (item.montageSelectedSliceIndex ?? 0) : item.montageSelectedSliceIndex,
              montageSliceCount: viewType === 'Montage' ? Math.max(0, Number(targetSeries?.instanceCount ?? 0)) : item.montageSliceCount,
              montageScrollTop: viewType === 'Montage' ? (item.montageScrollTop ?? 0) : item.montageScrollTop,
              montageScrollRequestRevision:
                viewType === 'Montage'
                  ? (item.montageScrollRequestRevision ?? 0)
                  : item.montageScrollRequestRevision,
              montageTransformState:
                viewType === 'Montage'
                  ? (item.montageTransformState ?? { zoom: 1, offsetX: 0, offsetY: 0 })
                  : item.montageTransformState,
              montageCommonInfoExpanded:
                viewType === 'Montage'
                  ? (item.montageCommonInfoExpanded ?? false)
                  : item.montageCommonInfoExpanded,
              viewportPseudocolorPresets:
                viewType === 'MPR'
                  ? {
                      'mpr-ax': initialPseudocolorPreset,
                      'mpr-cor': initialPseudocolorPreset,
                      'mpr-sag': initialPseudocolorPreset
                    }
                  : createEmptyMprPseudocolorPresets(),
              mprMipConfig: createDefaultMprMipConfig(),
              mprSegmentationConfig: createDefaultMprSegmentationConfig(),
              volumePreset: viewType === '3D' ? undefined : 'volumePreset:bone',
              volumeRenderConfig: viewType === '3D' ? null : createDefaultVolumeRenderConfig('bone'),
              render3dMode: 'volume',
              surfaceRenderConfig: createDefaultSurfaceRenderConfig(),
              volumeRenderOptions: createDefaultVolumeRenderOptions()
            }
          : item
      )

      if (viewType !== 'MPR' && nextViewId) {
        await bindViewSilentlyWithAck(nextViewId)
        if (isPetBackedView) {
          await emitInitialPetConfigOperation(nextViewId, initialPseudocolorPreset)
        } else {
          await emitInitialPseudocolorOperation(nextViewId, initialPseudocolorPreset)
        }
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
        fusionSeriesDescriptions: {
          ct: getSeriesDisplayName(ctSeries, ctSeriesId),
          pet: getSeriesDisplayName(petSeries, petSeriesId)
        },
        fusionViewIds: createEmptyFusionViewIds(),
        fusionImages: createEmptyFusionImages(),
        fusionLayerImages: createEmptyFusionLayerImages(),
        fusionComposites: createEmptyFusionComposites(),
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
        fusionManualRegistration: false,
        fusionRegistrationDragActive: false
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
              currentWindowInfo: null,
              fusionSeriesIds: { ctSeriesId, petSeriesId },
              fusionSeriesDescriptions: {
                ct: getSeriesDisplayName(ctSeries, ctSeriesId),
                pet: getSeriesDisplayName(petSeries, petSeriesId)
              },
              fusionViewIds: nextFusionViewIds,
              fusionImages: createEmptyFusionImages(),
              fusionLayerImages: createEmptyFusionLayerImages(),
              fusionComposites: createEmptyFusionComposites(),
              fusionSliceLabels: createEmptyFusionSliceLabels(),
              fusionWindowLabels: createEmptyFusionWindowLabels(),
              fusionScaleBars: createEmptyFusionScaleBars(),
              fusionCornerInfos: {
                [FUSION_CT_AXIAL_PANE_KEY]: withRuntimeCornerInfo(ctCornerInfo, createDefaultTransformInfo()),
                [FUSION_PET_AXIAL_PANE_KEY]: withRuntimeCornerInfo(petCornerInfo, createDefaultTransformInfo()),
                [FUSION_OVERLAY_AXIAL_PANE_KEY]: withRuntimeCornerInfo(ctCornerInfo, createDefaultTransformInfo()),
                [FUSION_PET_CORONAL_MIP_PANE_KEY]: withRuntimeCornerInfo(petCornerInfo, createDefaultTransformInfo())
              },
              fusionOrientations: createEmptyFusionOrientations(),
              fusionTransformStates: createEmptyFusionTransformStates(),
              fusionPseudocolorPresets: createEmptyFusionPseudocolorPresets(),
              fusionProjections: createEmptyFusionProjections(),
              fusionLoadingProgress: createEmptyFusionLoadingProgress(),
              fusionInfo: createDefaultFusionInfo(ctSeriesId, petSeriesId),
              fusionManualRegistration: false,
              fusionRegistrationDragActive: false,
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
        title: `${getSeriesDisplayName(sourceSeries, sourceSeriesId)} vs ${getSeriesDisplayName(targetSeries, targetSeriesId)} · ${getViewTypeDisplayLabel('CompareStack')}`,
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
              currentWindowInfo: null,
              title: `${getSeriesDisplayName(sourceSeries, sourceSeriesId)} vs ${getSeriesDisplayName(targetSeries, targetSeriesId)} · ${getViewTypeDisplayLabel('CompareStack')}`,
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
              compareCurrentWindowInfos: createEmptyCompareCurrentWindowInfos(),
              compareScaleBars: createEmptyCompareScaleBars(),
              compareCornerInfos: createComparePaneRecord((paneKey) =>
                paneKey === COMPARE_STACK_SOURCE_PANE_KEY
                  ? withRuntimeCornerInfo(sourceCornerInfo, createDefaultTransformInfo())
                  : withRuntimeCornerInfo(targetCornerInfo, createDefaultTransformInfo())
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
      options.message.value = viewMessage('2D 对比视图打开失败。', 'Failed to open the 2D compare view.')
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
    const layoutSlots = await hydrateLayoutSlots(seededLayoutSlots, activeTab?.viewType !== 'Layout')
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
              currentWindowInfo: null,
              compareViewIds: createEmptyCompareViewIds(),
              compareImages: createEmptyCompareImages(),
              compareSliceLabels: createEmptyCompareSliceLabels(),
              compareWindowLabels: createEmptyCompareWindowLabels(),
              compareCurrentWindowInfos: createEmptyCompareCurrentWindowInfos(),
              viewportViewIds: createEmptyMprViewIds(),
              viewportImages: createEmptyMprImages(),
              viewportSliceLabels: createEmptyMprSliceLabels(),
              viewportCurrentWindowInfos: createEmptyMprCurrentWindowInfos(),
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
    const nextSlot = await createLayoutSlotView(
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
        currentWindowInfo: null,
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

    const resolvedViewType = viewType === 'Stack'
      ? resolvePrimaryTwoDimensionalViewType(options.selectedSeries.value)
      : viewType
    await openSeriesView(options.selectedSeriesId.value, resolvedViewType)
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
      void loadTypedApi()
        .then(({ postApi }) => postApi('CloseViewApiV1ViewClosePost', { viewId }))
        .catch(() => {
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
    const recentFallbackTabKey = getMostRecentRemainingTabKey(nextTabs, tabKey)
    options.viewerTabs.value = nextTabs
    tabActivationHistory = tabActivationHistory.filter((key) => key !== tabKey && nextTabs.some((tab) => tab.key === key))

    const relatedTabs = nextTabs.filter((item) => item.seriesId === closingTab.seriesId)
    if (options.selectedSeriesId.value === closingTab.seriesId) {
      options.selectedSeriesId.value =
        relatedTabs[0]?.seriesId ?? nextTabs[currentIndex]?.seriesId ?? nextTabs[currentIndex - 1]?.seriesId ?? ''
    }

    if (options.activeTabKey.value === tabKey) {
      const fallbackTab =
        nextTabs.find((item) => item.key === recentFallbackTabKey) ??
        relatedTabs[0] ??
        nextTabs[currentIndex] ??
        nextTabs[currentIndex - 1] ??
        null
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
