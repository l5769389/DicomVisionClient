import { nextTick, type ComputedRef, type Ref } from 'vue'
import { VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { api } from '../../../services/api'
import { bindView, emitViewOperation } from '../../../services/socket'
import {
  buildTabTitle,
  createEmptyCornerInfo,
  createEmptyMprCornerInfos,
  createEmptyMprCrosshairs,
  createEmptyMprImages,
  createEmptyMprOrientations,
  createEmptyMprPseudocolorPresets,
  createEmptyMprScaleBars,
  createEmptyMprSliceLabels,
  createEmptyMprTransformStates,
  createEmptyMprViewIds,
  createEmptyOrientationInfo,
  createDefaultTransformInfo,
  createTab,
  mergeCornerInfo,
  normalizeCornerInfo,
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

export function useViewerWorkspaceViews(options: ViewerWorkspaceViewsOptions) {
  const viewSizeCache = new Map<string, string>()
  const { selectedPseudocolorKey } = useUiPreferences()

  function findTab(seriesId: string, viewType?: ViewType): ViewerTabItem | undefined {
    return options.viewerTabs.value.find((item) =>
      viewType ? item.seriesId === seriesId && item.viewType === viewType : item.seriesId === seriesId
    )
  }

  function findTabByViewId(viewId: string): ViewerTabItem | undefined {
    return options.viewerTabs.value.find(
      (item) => item.viewId === viewId || Object.values(item.viewportViewIds ?? {}).includes(viewId)
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
    })
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
      const mprCrosshair = payload.mpr_crosshair ?? ((payload as { mprCrosshair?: ViewImageResponse['mpr_crosshair'] }).mprCrosshair ?? null)
      const scaleBar = normalizeScaleBarInfo(payload.scaleBar ?? ((payload as { scale_bar?: unknown }).scale_bar ?? null))
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

  async function renderTab(tabKey: string): Promise<void> {
    const tab = options.viewerTabs.value.find((item) => item.key === tabKey)
    if (!tab) {
      return
    }

    if (tab.viewType === 'Tag') {
      return
    }

    if (tab.viewType === 'MPR') {
      const entries = Object.entries(tab.viewportViewIds ?? {}) as [MprViewportKey, string][]
      const tasks = entries
        .filter(([, viewId]) => Boolean(viewId))
        .map(async ([viewportKey, viewId]) => {
          const size = getViewportSize(options.viewportElements.value[viewportKey] ?? null)
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

    options.selectedSeriesId.value = seriesId

    const existingTab = findTab(seriesId, viewType)
    const hasExistingView =
      viewType === 'Tag'
        ? Boolean(existingTab)
        :
      viewType === 'MPR'
        ? Object.values(existingTab?.viewportViewIds ?? {}).some(Boolean)
        : Boolean(existingTab?.viewId)
    if (hasExistingView && existingTab) {
      options.activeTabKey.value = existingTab.key
      if (viewType === 'Tag' && !(existingTab.tagItems?.length) && !existingTab.tagIsLoading) {
        await loadTagTab(existingTab.key, existingTab.tagIndex ?? resolveInitialTagIndex(seriesId))
      }
      return
    }

    const tabKey = existingTab?.key ?? ensureTab(seriesId, viewType)
    if (!tabKey) {
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
              viewportViewIds: nextViewportViewIds,
              viewportImages: createEmptyMprImages(),
              viewportSliceLabels: createEmptyMprSliceLabels(),
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
      options.activeViewportKey.value = tab.viewType === 'MPR' ? 'mpr-ax' : tab.viewType === '3D' ? 'volume' : 'single'
    }
  }

  function closeTab(tabKey: string): void {
    const currentIndex = options.viewerTabs.value.findIndex((item) => item.key === tabKey)
    if (currentIndex < 0) {
      return
    }

    const closingTab = options.viewerTabs.value[currentIndex]
    if (closingTab.viewId) {
      options.clearPendingVolumeConfig(closingTab.viewId)
      viewSizeCache.delete(closingTab.viewId)
    }
    Object.values(closingTab.viewportViewIds ?? {}).forEach((viewId) => {
      if (viewId) {
        viewSizeCache.delete(viewId)
      }
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
    rebindOpenViews,
    removeSeries,
    renderTab,
    setTagTabIndex,
    selectSeries,
    updateTabImage
  }
}
