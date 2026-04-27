import { nextTick, type ComputedRef, type Ref } from 'vue'
import { VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { api } from '../../../services/api'
import { bindView, emitViewOperation } from '../../../services/socket'
import {
  buildTabTitle,
  createDefaultFourDPhaseItems,
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
import { normalizePseudocolorPresetKey } from '../../../constants/pseudocolor'
import { createDefaultMprMipConfig, normalizeMprMipConfig } from '../../../types/viewer'
import {
  createDefaultVolumeRenderConfig,
  normalizeVolumePresetKey,
  normalizeVolumeRenderConfig
} from '../volume/volumeRenderConfig'
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
  isViewLoading: Ref<boolean>
  message: Ref<string>
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

export function useViewerWorkspaceViews(options: ViewerWorkspaceViewsOptions) {
  const viewSizeCache = new Map<string, string>()
  const fourDPhaseSwitchRequestIds = new Map<string, number>()
  const queuedFourDPreloadTabKeys = new Set<string>()
  const { selectedPseudocolorKey } = useUiPreferences()
  const MPR_VIEWPORT_KEYS: MprViewportKey[] = ['mpr-ax', 'mpr-cor', 'mpr-sag']

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

  function hasCompleteMprViewportViewIds(value: Partial<Record<MprViewportKey, string>> | null | undefined): value is Record<MprViewportKey, string> {
    return MPR_VIEWPORT_KEYS.every((viewportKey) => Boolean(value?.[viewportKey]))
  }

  function getFourDPhaseKey(phaseIndex: number): string {
    return String(Math.max(0, Math.trunc(phaseIndex)))
  }

  function getFourDPhaseItems(tab: ViewerTabItem): FourDPhaseItem[] {
    return tab.fourDPhaseItems?.length
      ? tab.fourDPhaseItems
      : createDefaultFourDPhaseItems(Math.max(1, tab.fourDPhaseCount ?? 1))
  }

  function clampFourDPhaseIndex(tab: ViewerTabItem, phaseIndex: number): number {
    const maxIndex = Math.max(0, getFourDPhaseItems(tab).length - 1)
    const normalizedIndex = Number.isFinite(phaseIndex) ? Math.trunc(phaseIndex) : 0
    return Math.max(0, Math.min(normalizedIndex, maxIndex))
  }

  function getFourDPhaseSeriesId(tab: ViewerTabItem, phaseIndex: number): string {
    const phase = getFourDPhaseItems(tab)[phaseIndex]
    return phase?.seriesId || tab.seriesId
  }

  function createFourDPhasePreviewImages(phase: FourDPhaseItem | undefined): Record<MprViewportKey, string> {
    const viewportImages = phase?.viewportImages ?? {}
    return {
      'mpr-ax': viewportImages['mpr-ax'] || phase?.imageSrc || '',
      'mpr-cor': viewportImages['mpr-cor'] || '',
      'mpr-sag': viewportImages['mpr-sag'] || ''
    }
  }

  function hasAnyMprViewportImage(images: Partial<Record<MprViewportKey, string>> | undefined | null): boolean {
    return MPR_VIEWPORT_KEYS.some((viewportKey) => Boolean(images?.[viewportKey]))
  }

  function hasCompleteMprViewportImages(
    images: Partial<Record<MprViewportKey, string>> | undefined | null
  ): images is Record<MprViewportKey, string> {
    return MPR_VIEWPORT_KEYS.every((viewportKey) => Boolean(images?.[viewportKey]))
  }

  function mergeFourDPhaseImages(
    phase: FourDPhaseItem | undefined,
    cachedImages: Partial<Record<MprViewportKey, string>> | undefined
  ): Record<MprViewportKey, string> {
    const previewImages = createFourDPhasePreviewImages(phase)
    return {
      'mpr-ax': cachedImages?.['mpr-ax'] || previewImages['mpr-ax'],
      'mpr-cor': cachedImages?.['mpr-cor'] || previewImages['mpr-cor'],
      'mpr-sag': cachedImages?.['mpr-sag'] || previewImages['mpr-sag']
    }
  }

  function createFourDPhaseCacheSeed(
    phase: FourDPhaseItem | undefined,
    existingCache?: FourDPhaseCacheItem
  ): FourDPhaseCacheItem {
    const viewportImages = mergeFourDPhaseImages(phase, existingCache?.viewportImages)
    const status = existingCache?.status
      ? existingCache.status
      : phase?.status === 'error'
        ? 'error'
        : hasAnyMprViewportImage(viewportImages)
          ? 'preview'
          : 'pending'

    return {
      ...existingCache,
      status,
      viewportImages
    }
  }

  function createFourDPhaseCache(
    phaseItems: FourDPhaseItem[],
    existingCache: Record<string, FourDPhaseCacheItem> | undefined
  ): Record<string, FourDPhaseCacheItem> {
    return phaseItems.reduce<Record<string, FourDPhaseCacheItem>>((accumulator, phase, index) => {
      const phaseKey = getFourDPhaseKey(phase.phaseIndex ?? index)
      accumulator[phaseKey] = createFourDPhaseCacheSeed(phase, existingCache?.[phaseKey])
      return accumulator
    }, {})
  }

  function createFourDViewGroupKey(tab: ViewerTabItem, phaseIndex: number): string {
    return `4d:${tab.key}:${getFourDPhaseKey(phaseIndex)}`
  }

  function findFourDPhaseViewportByViewId(
    tab: ViewerTabItem,
    viewId: string | undefined | null
  ): { phaseKey: string; viewportKey: MprViewportKey } | null {
    if (!viewId || tab.viewType !== '4D') {
      return null
    }

    for (const [phaseKey, viewIds] of Object.entries(tab.fourDPhaseViewIds ?? {})) {
      const viewportKey = MPR_VIEWPORT_KEYS.find((candidate) => viewIds?.[candidate] === viewId)
      if (viewportKey) {
        return { phaseKey, viewportKey }
      }
    }

    return null
  }

  function getFourDPhaseByKey(tab: ViewerTabItem, phaseKey: string): FourDPhaseItem | undefined {
    const phaseIndex = Number.parseInt(phaseKey, 10)
    if (!Number.isFinite(phaseIndex)) {
      return undefined
    }
    return getFourDPhaseItems(tab)[phaseIndex]
  }

  function getFourDMprStateSourceViewId(tab: ViewerTabItem): string {
    const activeViewport = isMprViewportKey(options.activeViewportKey.value) ? options.activeViewportKey.value : 'mpr-ax'
    return tab.viewportViewIds?.[activeViewport] || MPR_VIEWPORT_KEYS.map((viewportKey) => tab.viewportViewIds?.[viewportKey] ?? '').find(Boolean) || ''
  }

  function emitFourDMprStateSync(viewIds: Partial<Record<MprViewportKey, string>>, sourceViewId: string): void {
    const targetViewId = viewIds['mpr-ax'] || MPR_VIEWPORT_KEYS.map((viewportKey) => viewIds[viewportKey] ?? '').find(Boolean) || ''
    if (!targetViewId || !sourceViewId || Object.values(viewIds).includes(sourceViewId)) {
      return
    }
    emitViewOperation({
      viewId: targetViewId,
      opType: VIEW_OPERATION_TYPES.mprStateSync,
      sourceViewId
    })
  }

  function bindMprViewIds(viewIds: Partial<Record<MprViewportKey, string>>): void {
    Object.values(viewIds).forEach((viewId) => {
      if (viewId) {
        bindView(viewId)
      }
    })
  }

  function getTabViewportPseudocolorPreset(tab: ViewerTabItem, viewportKey: MprViewportKey): string {
    return normalizePseudocolorPresetKey(tab.viewportPseudocolorPresets?.[viewportKey] ?? tab.pseudocolorPreset)
  }

  function emitMprPseudocolorOperations(
    viewIds: Partial<Record<MprViewportKey, string>>,
    tab: ViewerTabItem
  ): void {
    const entries = Object.entries(viewIds) as [MprViewportKey, string][]
    entries.forEach(([viewportKey, viewId]) => {
      if (!viewId) {
        return
      }
      bindView(viewId)
      emitViewOperation({
        viewId,
        opType: VIEW_OPERATION_TYPES.pseudocolor,
        pseudocolorPreset: getTabViewportPseudocolorPreset(tab, viewportKey)
      })
    })
  }

  function getFourDPhaseDisplayState(tab: ViewerTabItem, phaseIndex: number) {
    const phaseKey = getFourDPhaseKey(phaseIndex)
    const phase = getFourDPhaseItems(tab)[phaseIndex]
    const cache = tab.fourDPhaseCache?.[phaseKey]

    return {
      viewportImages: mergeFourDPhaseImages(phase, cache?.viewportImages),
      viewportSliceLabels: {
        ...createEmptyMprSliceLabels(),
        ...(cache?.viewportSliceLabels ?? {})
      },
      viewportPlanes: {
        ...createEmptyMprPlanes(),
        ...(cache?.viewportPlanes ?? {})
      },
      viewportCrosshairs: {
        ...createEmptyMprCrosshairs(),
        ...(cache?.viewportCrosshairs ?? {})
      },
      viewportScaleBars: {
        ...createEmptyMprScaleBars(),
        ...(cache?.viewportScaleBars ?? {})
      },
      viewportMeasurements: cache?.viewportMeasurements ?? {},
      viewportCornerInfos: {
        ...createEmptyMprCornerInfos(),
        ...(cache?.viewportCornerInfos ?? {})
      },
      viewportOrientations: {
        ...createEmptyMprOrientations(),
        ...(cache?.viewportOrientations ?? {})
      },
      viewportTransformStates: {
        ...createEmptyMprTransformStates(),
        ...(cache?.viewportTransformStates ?? {})
      },
      viewportPseudocolorPresets: {
        ...createEmptyMprPseudocolorPresets(),
        ...(cache?.viewportPseudocolorPresets ?? {})
      },
      mprCursor: cache?.mprCursor ?? null,
      mprFrame: cache?.mprFrame ?? null,
      windowLabel: cache?.windowLabel ?? ''
    }
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

  function hasFourDPhaseImage(phase: FourDPhaseItem): boolean {
    return Boolean(
      phase.imageSrc ||
        phase.viewportImages?.['mpr-ax'] ||
        phase.viewportImages?.['mpr-cor'] ||
        phase.viewportImages?.['mpr-sag']
    )
  }

  function normalizeFourDPhaseItems(phases: FourDPhaseItem[] | undefined | null): FourDPhaseItem[] {
    return (phases ?? [])
      .map((phase, sourceIndex) => ({ phase, sourceIndex }))
      .sort((left, right) => {
        const leftIndex = Number(left.phase.phaseIndex)
        const rightIndex = Number(right.phase.phaseIndex)
        const leftSort = Number.isFinite(leftIndex) ? leftIndex : left.sourceIndex
        const rightSort = Number.isFinite(rightIndex) ? rightIndex : right.sourceIndex
        return leftSort - rightSort
      })
      .map(({ phase }, index) => {
        const viewportImages = phase.viewportImages ?? {}
        const imageSrc =
          phase.imageSrc ||
          viewportImages['mpr-ax'] ||
          viewportImages['mpr-cor'] ||
          viewportImages['mpr-sag'] ||
          ''
        const hasImage = Boolean(imageSrc || Object.values(viewportImages).some(Boolean))
        const status = phase.status === 'error'
          ? 'error'
          : hasImage || phase.status === 'ready'
            ? 'ready'
            : 'pending'
        const normalizedPhase: FourDPhaseItem = {
          phaseIndex: index,
          label: phase.label || `Phase ${String(index + 1).padStart(2, '0')}`,
          seriesId: phase.seriesId ?? null,
          imageSrc,
          viewportImages,
          status
        }
        return normalizedPhase
      })
  }

  function applyFourDManifestToSeriesList(seriesId: string, manifest: FourDPhasesResponse): void {
    const normalizedPhases = normalizeFourDPhaseItems(manifest.fourDPhases)
    const phaseSeriesIds = new Set<string>([seriesId])
    normalizedPhases.forEach((phase) => {
      if (phase.seriesId) {
        phaseSeriesIds.add(phase.seriesId)
      }
    })

    options.seriesList.value = options.seriesList.value.map((item) =>
      phaseSeriesIds.has(item.seriesId)
        ? manifest.isFourDSeries || normalizedPhases.length
          ? {
              ...item,
              isFourDSeries: manifest.isFourDSeries,
              fourDPhaseCount: manifest.fourDPhaseCount || normalizedPhases.length || (item.fourDPhaseCount ?? null),
              fourDPhases: normalizedPhases.length ? normalizedPhases : item.fourDPhases
            }
          : {
              ...item,
              isFourDSeries: false,
              fourDPhaseCount: null,
              fourDPhases: null
            }
        : item
    )
  }

  async function loadFourDManifest(seriesId: string): Promise<FourDPhasesResponse | null> {
    try {
      const { data } = await api.post<FourDPhasesResponse>('/dicom/fourD/phases', { seriesId })
      const manifest: FourDPhasesResponse = {
        seriesId: data.seriesId || seriesId,
        isFourDSeries: Boolean(data.isFourDSeries),
        fourDPhaseCount: Math.max(0, Number(data.fourDPhaseCount ?? data.fourDPhases?.length ?? 0)),
        fourDPhases: normalizeFourDPhaseItems(data.fourDPhases)
      }
      applyFourDManifestToSeriesList(seriesId, manifest)
      return manifest
    } catch (error) {
      console.error(error)
      return null
    }
  }

  async function resolveFourDPhaseItems(seriesId: string): Promise<{
    phaseCount: number
    phaseItems: FourDPhaseItem[]
    hasBackendManifest: boolean
  }> {
    const series = options.seriesList.value.find((item) => item.seriesId === seriesId)
    const manifest = await loadFourDManifest(seriesId)
    const backendPhaseItems = normalizeFourDPhaseItems(manifest?.fourDPhases)
    if (manifest?.isFourDSeries && backendPhaseItems.length) {
      return {
        phaseCount: Math.max(1, manifest.fourDPhaseCount || backendPhaseItems.length),
        phaseItems: backendPhaseItems,
        hasBackendManifest: true
      }
    }

    const seriesPhaseItems = normalizeFourDPhaseItems(series?.fourDPhases)
    if (seriesPhaseItems.length) {
      return {
        phaseCount: Math.max(1, series?.fourDPhaseCount ?? seriesPhaseItems.length),
        phaseItems: seriesPhaseItems,
        hasBackendManifest: false
      }
    }

    const fallbackCount = Math.max(1, series?.fourDPhaseCount ?? 10)
    return {
      phaseCount: fallbackCount,
      phaseItems: createDefaultFourDPhaseItems(fallbackCount),
      hasBackendManifest: false
    }
  }

  function updateFourDTab(
    tabKey: string,
    series: FolderSeriesItem,
    phaseCount: number,
    phaseItems: FourDPhaseItem[]
  ): void {
    const hasPreviewImage = phaseItems.some(hasFourDPhaseImage)
    options.viewerTabs.value = options.viewerTabs.value.map((item) => {
      if (item.key !== tabKey) {
        return item
      }

      const maxPhaseIndex = Math.max(0, phaseItems.length - 1)
      const currentPhaseIndex = Number.isFinite(item.fourDPhaseIndex)
        ? Math.trunc(item.fourDPhaseIndex ?? 0)
        : 0

      return {
        ...item,
        viewType: '4D',
        title: buildTabTitle(series, '4D', item.seriesId),
        seriesTitle: series.seriesDescription || series.seriesInstanceUid || series.seriesId,
        viewId: '',
        imageSrc: '',
        sliceLabel: '',
        windowLabel: '',
        cornerInfo: options.seriesCornerInfoMap.value[series.seriesId] ?? createEmptyCornerInfo(),
        orientation: createEmptyOrientationInfo(),
        fourDPhaseIndex: Math.max(0, Math.min(currentPhaseIndex, maxPhaseIndex)),
        fourDPhaseCount: phaseCount,
        fourDPhaseItems: phaseItems,
        fourDPlaybackFps: item.fourDPlaybackFps ?? 2,
        fourDPhaseViewIds: item.fourDPhaseViewIds ?? {},
        fourDPhaseCache: createFourDPhaseCache(phaseItems, item.fourDPhaseCache),
        fourDIsPlaying: item.fourDIsPlaying ?? false,
        fourDIsPreloading: item.fourDIsPreloading ?? false
      }
    })
    options.message.value = hasPreviewImage ? '' : '4D phase preview is not available for this series.'
  }

  async function ensureFourDPhaseViewIds(tabKey: string, phaseIndex: number): Promise<Record<MprViewportKey, string> | null> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== '4D') {
      return null
    }

    const normalizedPhaseIndex = clampFourDPhaseIndex(tab, phaseIndex)
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

  async function setFourDPhase(tabKey: string, phaseIndex: number, phaseOptions: SetFourDPhaseOptions = {}): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== '4D') {
      return
    }

    const interactive = phaseOptions.interactive ?? true
    const normalizedPhaseIndex = clampFourDPhaseIndex(tab, phaseIndex)
    const nextRequestId = (fourDPhaseSwitchRequestIds.get(tabKey) ?? 0) + 1
    fourDPhaseSwitchRequestIds.set(tabKey, nextRequestId)
    const sourceViewId = getFourDMprStateSourceViewId(tab)
    const phaseKey = getFourDPhaseKey(normalizedPhaseIndex)
    const existingViewIds = tab.fourDPhaseViewIds?.[phaseKey]
    const displayViewIds = hasCompleteMprViewportViewIds(existingViewIds)
      ? existingViewIds
      : createEmptyMprViewIds()
    const displayState = getFourDPhaseDisplayState(tab, normalizedPhaseIndex)

    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tabKey && item.viewType === '4D'
        ? {
            ...item,
            fourDPhaseIndex: normalizedPhaseIndex,
            viewportViewIds: displayViewIds,
            ...displayState
          }
        : item
    )

    if (!interactive) {
      bindMprViewIds(displayViewIds)
      return
    }

    const viewIds = await ensureFourDPhaseViewIds(tabKey, normalizedPhaseIndex)
    if (!viewIds || fourDPhaseSwitchRequestIds.get(tabKey) !== nextRequestId) {
      return
    }

    const refreshedTab = options.viewerTabs.value.find((item) => item.key === tabKey)
    const refreshedDisplayState =
      refreshedTab?.viewType === '4D'
        ? getFourDPhaseDisplayState(refreshedTab, normalizedPhaseIndex)
        : displayState
    const pseudocolorSourceTab =
      refreshedTab?.viewType === '4D'
        ? ({ ...refreshedTab, ...refreshedDisplayState } as ViewerTabItem)
        : tab

    options.viewerTabs.value = options.viewerTabs.value.map((item) =>
      item.key === tabKey && item.viewType === '4D'
        ? {
            ...item,
            fourDPhaseIndex: normalizedPhaseIndex,
            viewportViewIds: viewIds,
            ...refreshedDisplayState
          }
        : item
    )

    emitMprPseudocolorOperations(viewIds, pseudocolorSourceTab)

    if (!isMprViewportKey(options.activeViewportKey.value)) {
      options.activeViewportKey.value = 'mpr-ax'
    }

    await nextTick()
    await renderTab(tabKey, true)
    emitFourDMprStateSync(viewIds, sourceViewId)
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

  async function preloadFourDPhases(tabKey: string): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab || tab.viewType !== '4D') {
      return
    }
    if (tab.fourDIsPreloading) {
      queuedFourDPreloadTabKeys.add(tabKey)
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
      for (let phaseIndex = 0; phaseIndex < phaseItems.length; phaseIndex += 1) {
        const currentTab = options.viewerTabs.value.find((item) => item.key === tabKey)
        if (!currentTab || currentTab.viewType !== '4D') {
          return
        }

        const sourceViewId = getFourDMprStateSourceViewId(currentTab) || preloadSourceViewId
        const phaseKey = getFourDPhaseKey(phaseIndex)
        const currentCache = currentTab.fourDPhaseCache?.[phaseKey]
        if (currentCache?.status !== 'ready' || !hasCompleteMprViewportImages(currentCache.viewportImages)) {
          markFourDPhaseLoading(tabKey, phaseIndex)
        }

        const viewIds = await ensureFourDPhaseViewIds(tabKey, phaseIndex)
        if (!viewIds) {
          continue
        }

        emitMprPseudocolorOperations(viewIds, currentTab)
        await renderMprViewIds(viewIds)
        emitFourDMprStateSync(viewIds, sourceViewId)
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
      if (queuedFourDPreloadTabKeys.delete(tabKey)) {
        void preloadFourDPhases(tabKey)
      }
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
      const seriesCornerInfo = options.seriesCornerInfoMap.value[item.seriesId] ?? createEmptyCornerInfo()
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
      const fourDViewportMatch = item.viewType === '4D' ? findFourDPhaseViewportByViewId(item, payload.viewId) : null
      const viewportKey = currentViewportKey ?? fourDViewportMatch?.viewportKey
      if (viewportKey && (item.viewType === 'MPR' || item.viewType === '4D')) {
        const currentViewportImage = item.viewportImages?.[viewportKey]
        if (currentViewportKey && currentViewportImage?.startsWith('blob:')) {
          URL.revokeObjectURL(currentViewportImage)
        }

        let nextFourDPhaseCache = item.fourDPhaseCache
        if (item.viewType === '4D' && fourDViewportMatch) {
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
                [viewportKey]: mprCrosshair
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
          if (fourDViewportMatch?.phaseKey === getFourDPhaseKey(activePhaseIndex)) {
            const nextItem = {
              ...item,
              fourDPhaseCache: nextFourDPhaseCache
            }
            return {
              ...nextItem,
              ...getFourDPhaseDisplayState(nextItem, activePhaseIndex)
            }
          }
          return {
            ...item,
            fourDPhaseCache: nextFourDPhaseCache
          }
        }

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
            [viewportKey]: mprCrosshair
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

  async function renderMprViewIds(
    viewportViewIds: Partial<Record<MprViewportKey, string>> | undefined,
    force = false
  ): Promise<void> {
    const entries = Object.entries(viewportViewIds ?? {}) as [MprViewportKey, string][]
    const tasks = entries
      .filter(([, viewId]) => Boolean(viewId))
      .map(async ([viewportKey, viewId]) => {
        const size = getViewportSize(resolveMprViewportElement(viewportKey))
        if (!size) {
          return
        }
        bindView(viewId)
        const sizeChanged = hasViewSizeChanged(viewId, size)
        if (!force && !sizeChanged) {
          return
        }
        await api.post<OperationAcceptedResponse>('/view/setSize', {
          opType: VIEW_OPERATION_TYPES.setSize,
          size,
          viewId
        })
      })
    await Promise.all(tasks)
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
            updateFourDTab(existingTab.key, series, phaseCount, phaseItems)
          }
        } finally {
          options.isViewLoading.value = false
        }
        await nextTick()
        await setFourDPhase(existingTab.key, existingTab.fourDPhaseIndex ?? 0)
        void preloadFourDPhases(existingTab.key)
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
      const series = options.seriesList.value.find((item) => item.seriesId === seriesId)
      if (!series) {
        return
      }

      options.isViewLoading.value = true
      try {
        const { phaseCount, phaseItems } = await resolveFourDPhaseItems(seriesId)
        const updatedSeries = options.seriesList.value.find((item) => item.seriesId === seriesId) ?? series
        updateFourDTab(tabKey, updatedSeries, phaseCount, phaseItems)
        options.activeViewportKey.value = 'mpr-ax'
        options.activeTabKey.value = tabKey
      } finally {
        options.isViewLoading.value = false
      }
      await nextTick()
      await setFourDPhase(tabKey, 0)
      void preloadFourDPhases(tabKey)
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

  function getFourDPhaseBackendViewIds(tab: ViewerTabItem): string[] {
    return Object.values(tab.fourDPhaseViewIds ?? {})
      .flatMap((phaseViewIds) => Object.values(phaseViewIds ?? {}))
      .filter((viewId): viewId is string => Boolean(viewId))
  }

  function closeTab(tabKey: string): void {
    const currentIndex = options.viewerTabs.value.findIndex((item) => item.key === tabKey)
    if (currentIndex < 0) {
      return
    }

    const closingTab = options.viewerTabs.value[currentIndex]
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
