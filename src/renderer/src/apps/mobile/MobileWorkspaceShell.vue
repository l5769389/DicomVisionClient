<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import AppIcon from '../../components/AppIcon.vue'
import MtfCurveDialog from '../../components/viewer/overlays/MtfCurveDialog.vue'
import VolumeRenderConfigPanel from '../../components/workspace/VolumeRenderConfigPanel.vue'
import WorkspaceExportNameDialog from '../../components/workspace/export/WorkspaceExportNameDialog.vue'
import WorkspaceExportNotice from '../../components/workspace/export/WorkspaceExportNotice.vue'
import { PSEUDOCOLOR_PRESET_OPTIONS, getPseudocolorGradient } from '../../constants/pseudocolor'
import { filterMeasurementOverlayByPreferences } from '../../composables/measurements/measurementLabelPreferences'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import {
  MAX_CUSTOM_WINDOW_PRESETS,
  useUiPreferences,
  type WindowTemplatePreset
} from '../../composables/ui/useUiPreferences'
import { useViewerWorkspace } from '../../composables/workspace/core/useViewerWorkspace'
import { useWorkspaceViewExport } from '../../composables/workspace/export/useWorkspaceViewExport'
import type { ViewerExportFormat } from '../../composables/workspace/export/viewExport'
import { parseSliceLabel, useKeySliceStars } from '../../composables/workspace/slices/useKeySliceStars'
import { getViewSyncEnabled, VIEW_SYNC_OPTION_CONFIGS } from '../../composables/workspace/sync/viewSyncConfig'
import { createDefaultVolumeRenderConfig } from '../../composables/workspace/volume/volumeRenderConfig'
import { useWorkspaceAnnotations } from '../../composables/workspace/overlays/useWorkspaceAnnotations'
import { useWorkspaceQaWaterAnalysis } from '../../composables/workspace/overlays/useWorkspaceQaWaterAnalysis'
import { isSeriesViewSupported } from '../../composables/workspace/views/seriesViewSupport'
import { COMPARE_STACK_SOURCE_PANE_KEY, COMPARE_STACK_TARGET_PANE_KEY } from '../../composables/workspace/views/viewerWorkspaceTabs'
import { setApiBaseURL } from '../../services/api'
import { postApi, postDicomUpload, type LoadFolderResponse } from '../../services/typedApi'
import { viewerRuntime, type DicomLoadSelection, type DicomLoadSource } from '../../platform/runtime'
import { mobileViewerCapabilityProfile, supportsViewerDataSource, supportsViewerViewType } from '../../shell/viewerCapabilityProfile'
import type { AnnotationSize, CompareStackPaneKey, CompareSyncSettingKey, ConnectionState, DicomTagItem, FolderSeriesItem, MeasurementOverlay, MeasurementToolType, MprViewportKey, ViewerMtfItem, ViewerTabItem, ViewType } from '../../types/viewer'
import MobileCompareStackViewport from './MobileCompareStackViewport.vue'
import MobileMprViewport from './MobileMprViewport.vue'
import MobileSettingsOverlay from './MobileSettingsOverlay.vue'
import MobileStackViewport from './MobileStackViewport.vue'
import MobileVolumeViewport from './MobileVolumeViewport.vue'
import {
  MOBILE_STACK_PLAYBACK_FPS_OPTIONS,
  type MobileGestureSensitivity,
  type MobileOrientationLock,
  type MobileStackPlaybackFps,
  useMobileViewerPreferences
} from './useMobileViewerPreferences'

const PacsBrowserDialog = defineAsyncComponent(() => import('../../components/sidebar/PacsBrowserDialog.vue'))

type MobileToolKey = 'scroll' | 'crosshair' | 'window' | 'pan' | 'zoom' | 'measure' | 'annotate' | 'qa' | 'rotate3d' | 'play' | 'reset' | 'color' | 'transform' | 'volumeParams' | 'export' | 'tag' | 'compare'
type MobileSheetKind = 'series' | 'favorites' | 'window' | 'display' | 'transform' | 'color' | 'playback' | 'compare' | 'mpr' | 'measure' | 'qa' | 'export' | 'volumeParams' | 'reset' | 'tag' | null
type MobileSheetTabKey = Exclude<MobileSheetKind, null>
type MobileSheetPresentation = 'menu' | 'focused'
type DisplayOverlayKey = 'cornerInfo' | 'scaleBar'
type MobileScreenOrientationLockType = 'portrait-primary' | 'landscape-primary'
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: MobileScreenOrientationLockType) => Promise<void>
  unlock?: () => void
}

interface MobileToolbarItem {
  key: MobileToolKey | 'more'
  icon: string
  label: string
}

interface MobileMeasurementTool {
  toolType: MeasurementToolType
  icon: string
  zh: string
  en: string
  hintZh: string
  hintEn: string
}

interface MobileSliceSliderState {
  draftSlice: number
  isDragging: boolean
  lastSentSlice: number
  pendingDeltaY: number
  total: number
  viewportKey: string
}

interface MobileFavoriteSliceItem {
  displaySlice: number
  series: FolderSeriesItem | null
  seriesId: string
  sliceIndex: number
  total: number | null
}

const DEFAULT_MOBILE_DEV_SAMPLE_DICOM_PATH = 'D:/test/sample'
type MobileSampleMode = 'local-path' | 'server-sample'
const GESTURE_SCROLL_THRESHOLDS: Record<MobileGestureSensitivity, number> = {
  high: 18,
  low: 36,
  normal: 28
}

const MPR_VIEWPORT_OPTIONS: Array<{ key: MprViewportKey; label: string; desc: string }> = [
  { key: 'mpr-ax', label: 'AX', desc: 'Axial' },
  { key: 'mpr-cor', label: 'COR', desc: 'Coronal' },
  { key: 'mpr-sag', label: 'SAG', desc: 'Sagittal' }
]

const TRANSFORM_OPTIONS = [
  { value: 'rotate:cw90', icon: 'rotate-cw90', zh: '顺时针 90°', en: 'CW 90' },
  { value: 'rotate:ccw90', icon: 'rotate-ccw90', zh: '逆时针 90°', en: 'CCW 90' },
  { value: 'rotate:mirror-h', icon: 'mirror-h', zh: '水平镜像', en: 'Mirror H' },
  { value: 'rotate:mirror-v', icon: 'mirror-v', zh: '垂直镜像', en: 'Mirror V' }
]

const VOLUME_RENDER_MODE_OPTIONS = [
  { value: 'render3dMode:volume', icon: 'render-volume', label: 'VR', detail: 'Volume rendering' },
  { value: 'render3dMode:surface', icon: 'render-surface', label: 'Surface', detail: 'Bone surface mesh' }
]

const VOLUME_PRESET_OPTIONS = [
  { value: 'volumePreset:bone', icon: 'render-surface', label: 'Bone' },
  { value: 'volumePreset:aaa', icon: 'volume-preset-aaa', label: 'AAA' },
  { value: 'volumePreset:red', icon: 'volume-preset-red', label: 'Red' },
  { value: 'volumePreset:cardiac', icon: 'volume-preset-cardiac', label: 'Cardiac' },
  { value: 'volumePreset:muscle', icon: 'volume-preset-muscle', label: 'Muscle' },
  { value: 'volumePreset:mip', icon: 'volume-preset-mip', label: 'MIP' }
]

const MOBILE_EXPORT_OPTIONS: Array<{ value: ViewerExportFormat; icon: string; zh: string; en: string; detailZh: string; detailEn: string }> = [
  { value: 'png', icon: 'export', zh: 'PNG', en: 'PNG', detailZh: '导出当前视图截图', detailEn: 'Export current view snapshot' },
  { value: 'dicom', icon: 'export', zh: 'DICOM', en: 'DICOM', detailZh: '导出当前 DICOM 图像', detailEn: 'Export current DICOM image' },
  { value: 'dicom-sr', icon: 'export', zh: 'DICOM SR', en: 'DICOM SR', detailZh: '导出结构化测量报告', detailEn: 'Export structured measurement report' },
  { value: 'dicom-gsps', icon: 'export', zh: 'DICOM GSPS', en: 'DICOM GSPS', detailZh: '导出标注和测量叠加', detailEn: 'Export annotation and measurement overlay' }
]

const MOBILE_QA_TOOLS = [
  { value: 'qa:mtf', icon: 'mtf', zh: 'MTF', en: 'MTF', detailZh: '绘制 ROI 后生成空间分辨率曲线', detailEn: 'Draw an ROI to generate a spatial resolution curve' },
  { value: 'qa:water-phantom', icon: 'qa', zh: '水模 QA', en: 'Water QA', detailZh: '自动识别水模并显示质控指标', detailEn: 'Analyze the water phantom and show QA metrics' }
]

const MOBILE_RESET_OPTIONS = [
  { value: 'reset:view', icon: 'reset', zh: '重置视图', en: 'Reset View' },
  { value: 'reset:measurements', icon: 'measure', zh: '清除测量', en: 'Clear Measurements' },
  { value: 'reset:mtf', icon: 'mtf', zh: '清除 MTF', en: 'Clear MTF' },
  { value: 'reset:annotations', icon: 'annotate', zh: '清除标注', en: 'Clear Annotations' },
  { value: 'reset:all', icon: 'trash', zh: '全部重置', en: 'Reset All' }
]

const MOBILE_MEASUREMENT_TOOLS: MobileMeasurementTool[] = [
  {
    toolType: 'line',
    icon: 'measure-line',
    zh: '线段',
    en: 'Line',
    hintZh: '拖动生成线段测量',
    hintEn: 'Drag to create a line measurement'
  },
  {
    toolType: 'rect',
    icon: 'measure-rect',
    zh: '矩形',
    en: 'Rect',
    hintZh: '拖动框选矩形 ROI',
    hintEn: 'Drag to draw a rectangular ROI'
  },
  {
    toolType: 'ellipse',
    icon: 'measure-ellipse',
    zh: '椭圆',
    en: 'Ellipse',
    hintZh: '拖动框选椭圆 ROI',
    hintEn: 'Drag to draw an elliptical ROI'
  },
  {
    toolType: 'angle',
    icon: 'measure-angle',
    zh: '角度',
    en: 'Angle',
    hintZh: '点选两段线完成角度',
    hintEn: 'Tap two segments to complete an angle'
  },
  {
    toolType: 'curve',
    icon: 'measure-curve',
    zh: '曲线',
    en: 'Curve',
    hintZh: '连续点选，双击结束',
    hintEn: 'Tap points, double-tap to finish'
  },
  {
    toolType: 'freeform',
    icon: 'measure-freeform',
    zh: '自由手绘',
    en: 'Freeform',
    hintZh: '连续点选 ROI，双击闭合',
    hintEn: 'Tap ROI points, double-tap to close'
  }
]

const viewer = useViewerWorkspace()
const { locale, workspaceExportCopy } = useUiLocale()
const mobileShellRef = useTemplateRef<HTMLElement>('mobileShellRef')
const exportNameInputRef = ref<HTMLInputElement | null>(null)
const {
  addCustomWindowPreset,
  getWindowPresetLabel,
  removeCustomWindowPresets,
  qaWaterMetrics,
  roiStatOptions,
  selectedPseudocolorKey,
  selectedWindowPresetId,
  systemWindowPresets,
  windowPresets
} = useUiPreferences()
const {
  defaultShowCornerInfo,
  defaultShowScaleBar,
  gestureSensitivity,
  mprDefaultTool,
  mprDefaultViewport,
  mprShowReferenceThumbnails,
  orientationLock,
  stackDefaultTool,
  stackPlaybackFps,
  volumeDefaultTool
} = useMobileViewerPreferences()
const {
  starredBySeries,
  isSliceStarred,
  toggleSliceStar
} = useKeySliceStars()

const activeTool = ref<MobileToolKey>('scroll')
const activeSheetKind = ref<MobileSheetKind>(null)
const activeSheetPresentation = ref<MobileSheetPresentation | null>(null)
const customPresetZhName = ref('')
const customPresetEnName = ref('')
const customPresetWw = ref('400')
const customPresetWl = ref('40')
const selectedCustomPresetIds = ref<string[]>([])
const activeCompareViewportKey = ref<CompareStackPaneKey>(COMPARE_STACK_SOURCE_PANE_KEY)
const activeMprViewportKey = ref<MprViewportKey>(mprDefaultViewport.value)
const isLoadingDemo = ref(false)
const isLoadingLocal = ref(false)
const isPacsBrowserOpen = ref(false)
const isSettingsOpen = ref(false)
const isPlayingStack = ref(false)
const isPlayingMpr = ref(false)
const fourDPlaybackStarting = ref(false)
const compareSourceSeriesId = ref<string | null>(null)
const playbackFps = ref<MobileStackPlaybackFps>(stackPlaybackFps.value)
const sliceSliderState = ref<MobileSliceSliderState | null>(null)
const tagSearchQuery = ref('')
const orientationLockNoticeShown = ref(false)

let playbackTimer: ReturnType<typeof window.setInterval> | null = null
let fourDPlaybackStartingTimer: ReturnType<typeof window.setTimeout> | null = null
let sliceSliderFrame: number | null = null

const isZh = computed(() => locale.value === 'zh-CN')
const activeStackTab = computed(() => (viewer.activeTab.value?.viewType === 'Stack' ? viewer.activeTab.value : null))
const activeCompareTab = computed(() => (viewer.activeTab.value?.viewType === 'CompareStack' ? viewer.activeTab.value : null))
const activeMprTab = computed(() => (viewer.activeTab.value?.viewType === 'MPR' ? viewer.activeTab.value : null))
const activeVolumeTab = computed(() => (viewer.activeTab.value?.viewType === '3D' ? viewer.activeTab.value : null))
const activeFourDTab = computed(() => (viewer.activeTab.value?.viewType === '4D' ? viewer.activeTab.value : null))
const activeMprLikeTab = computed(() => activeMprTab.value ?? activeFourDTab.value)
const activeTagTab = computed(() => (viewer.activeTab.value?.viewType === 'Tag' ? viewer.activeTab.value : null))
const activeImageTab = computed(() => activeStackTab.value ?? activeCompareTab.value ?? activeMprTab.value ?? activeVolumeTab.value ?? activeFourDTab.value)
const selectedSeries = computed(() => viewer.seriesList.value.find((series) => series.seriesId === viewer.selectedSeriesId.value) ?? null)
const mobileSeriesList = computed(() => viewer.seriesList.value.filter((series) => series.isImageSeries !== false))
const canLoadDemo = computed(() => supportsViewerDataSource(mobileViewerCapabilityProfile, 'server-sample'))
const canLoadLocal = computed(() => (
  viewerRuntime.canChooseFolder &&
  (
    supportsViewerDataSource(mobileViewerCapabilityProfile, 'web-upload') ||
    supportsViewerDataSource(mobileViewerCapabilityProfile, 'desktop-picker')
  )
))
const canOpenPacs = computed(() => (
  supportsViewerDataSource(mobileViewerCapabilityProfile, 'pacs')
))
const canOpenStack = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'Stack'))
const canOpenCompare = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'CompareStack'))
const canOpenMpr = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'MPR'))
const canOpenVolume = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, '3D'))
const canOpenFourD = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, '4D'))
const canOpenTag = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'Tag'))
const activeSeriesId = computed(() =>
  activeCompareTab.value?.compareSeriesIds?.[activeCompareViewportKey.value] ||
  activeImageTab.value?.seriesId ||
  activeTagTab.value?.seriesId ||
  viewer.selectedSeriesId.value
)

const activeTitle = computed(() => {
  const tab = viewer.activeTab.value
  if (tab?.title) {
    return tab.title
  }
  const series = selectedSeries.value
  return series?.seriesDescription || series?.seriesId || (isZh.value ? '移动端阅片' : 'Mobile Viewer')
})
const hasActiveView = computed(() => Boolean(viewer.activeTabKey.value))

const activeSliceLabelSource = computed(() => {
  if (activeStackTab.value) {
    return activeStackTab.value.sliceLabel
  }
  if (activeCompareTab.value) {
    return activeCompareTab.value.compareSliceLabels?.[activeCompareViewportKey.value] ?? ''
  }
  if (activeMprLikeTab.value) {
    return activeMprLikeTab.value.viewportSliceLabels?.[activeMprViewportKey.value] ?? ''
  }
  return ''
})
const activeSliceViewportKey = computed(() =>
  activeCompareTab.value ? activeCompareViewportKey.value : activeMprLikeTab.value ? activeMprViewportKey.value : 'single'
)
const activeWorkspaceViewportKey = computed(() => (activeVolumeTab.value ? 'volume' : activeSliceViewportKey.value))
const activeSlice = computed(() => parseSliceLabel(activeSliceLabelSource.value))
const displayedSlice = computed(() => {
  const slice = activeSlice.value
  const sliderState = sliceSliderState.value
  if (
    slice &&
    sliderState &&
    sliderState.viewportKey === activeSliceViewportKey.value &&
    sliderState.total === slice.total &&
    (sliderState.isDragging || sliderState.lastSentSlice !== slice.current)
  ) {
    return {
      ...slice,
      current: sliderState.draftSlice
    }
  }
  return slice
})
const activeSliceLabel = computed(() => {
  const slice = displayedSlice.value
  return slice ? `${slice.current} / ${slice.total}` : (activeSliceLabelSource.value || '--')
})
const sliceSliderValue = computed(() => displayedSlice.value?.current ?? 1)
const activeStackSlice = computed(() => (activeStackTab.value ? parseSliceLabel(activeStackTab.value.sliceLabel) : null))
const activeMprSlice = computed(() => (
  activeMprTab.value ? parseSliceLabel(activeMprTab.value.viewportSliceLabels?.[activeMprViewportKey.value] ?? '') : null
))
const isCurrentStackSliceStarred = computed(() =>
  Boolean(activeStackTab.value && activeStackSlice.value && isSliceStarred(activeStackTab.value.seriesId, activeStackSlice.value.index))
)
const canPlayStack = computed(() => Boolean(activeStackSlice.value && activeStackSlice.value.total > 1 && activeStackTab.value))
const canPlayMpr = computed(() => Boolean(activeMprSlice.value && activeMprSlice.value.total > 1 && activeMprTab.value))
const showSlicePanel = computed(() => Boolean(activeStackTab.value || activeCompareTab.value || activeMprLikeTab.value))
const fourDPhaseCount = computed(() => Math.max(1, activeFourDTab.value?.fourDPhaseItems?.length ?? activeFourDTab.value?.fourDPhaseCount ?? 1))
const fourDPhaseIndex = computed(() =>
  Math.max(0, Math.min(fourDPhaseCount.value - 1, Math.trunc(activeFourDTab.value?.fourDPhaseIndex ?? 0)))
)
const fourDPhaseSliderValue = computed(() => fourDPhaseIndex.value + 1)
const fourDPhaseLabel = computed(() => `${fourDPhaseSliderValue.value} / ${fourDPhaseCount.value}`)
const canPlayFourD = computed(() => Boolean(activeFourDTab.value && fourDPhaseCount.value > 1))
const isPlayingFourD = computed(() => Boolean(activeFourDTab.value?.fourDIsPlaying))
const activePlaybackFps = computed(() => (activeFourDTab.value ? activeFourDTab.value.fourDPlaybackFps ?? 2 : playbackFps.value))
const activePlaybackFpsIndex = computed(() => {
  const index = MOBILE_STACK_PLAYBACK_FPS_OPTIONS.indexOf(activePlaybackFps.value as MobileStackPlaybackFps)
  return index >= 0 ? index : 0
})
const activePlaybackFpsLabel = computed(() => `${activePlaybackFps.value} FPS`)
const canPlayActive = computed(() => {
  if (activeFourDTab.value) {
    return canPlayFourD.value
  }
  if (activeMprTab.value) {
    return canPlayMpr.value
  }
  return canPlayStack.value
})
const showSlicePlayButton = computed(() => Boolean(activeStackTab.value || activeMprTab.value || activeFourDTab.value))
const isPlayingActiveSlicePlayback = computed(() => (activeMprTab.value ? isPlayingMpr.value : isPlayingStack.value))
const activePlayLabel = computed(() => {
  if (activeFourDTab.value && fourDPlaybackStarting.value) {
    return isZh.value ? '加载' : 'Loading'
  }
  const isPlaying = activeFourDTab.value ? isPlayingFourD.value : isPlayingActiveSlicePlayback.value
  return isPlaying ? (isZh.value ? '暂停' : 'Pause') : (isZh.value ? '播放' : 'Play')
})
const activePlayIcon = computed(() => {
  if (activeFourDTab.value && fourDPlaybackStarting.value) {
    return 'connecting'
  }
  return (activeFourDTab.value ? isPlayingFourD.value : isPlayingActiveSlicePlayback.value) ? 'pause' : 'play'
})
const scrollDragThreshold = computed(() => GESTURE_SCROLL_THRESHOLDS[gestureSensitivity.value] ?? GESTURE_SCROLL_THRESHOLDS.normal)
const filteredTagItems = computed(() => {
  const items = activeTagTab.value?.tagItems ?? []
  const query = tagSearchQuery.value.trim().toLocaleLowerCase()
  if (!query) {
    return items
  }
  return items.filter((item) => matchesTagSearch(item, query))
})
const mobileShellClasses = computed(() => ({
  'mobile-shell--orientation-landscape': orientationLock.value === 'landscape',
  'mobile-shell--orientation-portrait': orientationLock.value === 'portrait'
}))
const favoriteSliceItems = computed<MobileFavoriteSliceItem[]>(() => {
  const seriesById = new Map(viewer.seriesList.value.map((series) => [series.seriesId, series]))
  return Object.entries(starredBySeries.value)
    .flatMap(([seriesId, sliceIndexes]) => {
      const series = seriesById.get(seriesId) ?? null
      const total = typeof series?.instanceCount === 'number' && series.instanceCount > 0 ? series.instanceCount : null
      return sliceIndexes.map((sliceIndex) => ({
        displaySlice: sliceIndex + 1,
        series,
        seriesId,
        sliceIndex,
        total
      }))
    })
    .sort((left, right) => {
      const leftSeriesIndex = viewer.seriesList.value.findIndex((series) => series.seriesId === left.seriesId)
      const rightSeriesIndex = viewer.seriesList.value.findIndex((series) => series.seriesId === right.seriesId)
      const normalizedLeftSeriesIndex = leftSeriesIndex >= 0 ? leftSeriesIndex : Number.MAX_SAFE_INTEGER
      const normalizedRightSeriesIndex = rightSeriesIndex >= 0 ? rightSeriesIndex : Number.MAX_SAFE_INTEGER
      if (normalizedLeftSeriesIndex !== normalizedRightSeriesIndex) {
        return normalizedLeftSeriesIndex - normalizedRightSeriesIndex
      }
      if (left.seriesId !== right.seriesId) {
        return left.seriesId.localeCompare(right.seriesId)
      }
      return left.sliceIndex - right.sliceIndex
    })
})
const favoriteSliceCount = computed(() => favoriteSliceItems.value.length)

const primaryMobileTools = computed<MobileToolbarItem[]>(() => {
  if (activeVolumeTab.value) {
    return [
      { key: 'window', icon: 'window', label: isZh.value ? '调窗' : 'Window' },
      { key: 'pan', icon: 'pan', label: isZh.value ? '平移' : 'Pan' },
      { key: 'rotate3d', icon: 'rotate3d', label: isZh.value ? '旋转' : 'Rotate' },
      { key: 'reset', icon: 'reset', label: isZh.value ? '重置' : 'Reset' }
    ]
  }

  const scrollTool: MobileToolbarItem = activeMprLikeTab.value
    ? { key: 'crosshair', icon: 'crosshair', label: isZh.value ? '十字线' : 'Cross' }
    : { key: 'scroll', icon: 'page', label: isZh.value ? '翻页' : 'Scroll' }

  return [
    { key: 'window', icon: 'window', label: isZh.value ? '调窗' : 'Window' },
    { key: 'pan', icon: 'pan', label: isZh.value ? '平移' : 'Pan' },
    scrollTool,
    { key: 'measure', icon: 'measure', label: isZh.value ? '测量' : 'Measure' },
    { key: 'annotate', icon: 'annotate', label: isZh.value ? '标注' : 'Annotate' }
  ]
})

const secondaryMobileTools = computed<MobileToolbarItem[]>(() => {
  if (activeVolumeTab.value) {
    return [
      { key: 'color', icon: 'render-volume', label: '3D' },
      { key: 'volumeParams', icon: 'settings', label: isZh.value ? '参数' : 'Params' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'more', icon: 'menu', label: isZh.value ? '更多' : 'More' }
    ]
  }

  return [
    { key: 'color', icon: 'pseudocolor', label: isZh.value ? '伪彩' : 'Color' },
    { key: 'transform', icon: 'rotate', label: isZh.value ? '变换' : 'Transform' },
    { key: 'reset', icon: 'reset', label: isZh.value ? '重置' : 'Reset' },
    { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
    { key: 'more', icon: 'menu', label: isZh.value ? '更多' : 'More' }
  ]
})

const mobileSheetTabs = computed<Array<{ key: MobileSheetTabKey; icon: string; label: string }>>(() => {
  const tabs: Array<{ key: MobileSheetTabKey; icon: string; label: string }> = [
    { key: 'series', icon: 'series', label: isZh.value ? '序列' : 'Series' },
    { key: 'favorites', icon: 'star', label: isZh.value ? '收藏' : 'Favorites' }
  ]

  if (!activeImageTab.value) {
    return tabs
  }

  if (activeCompareTab.value) {
    tabs.push(
      { key: 'window', icon: 'window', label: isZh.value ? '窗模板' : 'Window' },
      { key: 'display', icon: 'display', label: isZh.value ? '显示' : 'Display' },
      { key: 'color', icon: 'pseudocolor', label: isZh.value ? '伪彩' : 'Color' },
      { key: 'transform', icon: 'rotate', label: isZh.value ? '变换' : 'Transform' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
    return tabs
  }

  if (activeVolumeTab.value) {
    tabs.push(
      { key: 'display', icon: 'display', label: isZh.value ? '显示' : 'Display' },
      { key: 'color', icon: 'render-volume', label: '3D' },
      { key: 'volumeParams', icon: 'settings', label: isZh.value ? '参数' : 'Params' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'reset', icon: 'reset', label: isZh.value ? '重置' : 'Reset' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
    return tabs
  }

  tabs.push(
    { key: 'window', icon: 'window', label: isZh.value ? '窗模板' : 'Window' },
    { key: 'display', icon: 'display', label: isZh.value ? '显示' : 'Display' },
    { key: 'color', icon: 'pseudocolor', label: isZh.value ? '伪彩' : 'Color' }
  )

  if (activeStackTab.value) {
    tabs.push(
      { key: 'transform', icon: 'rotate', label: isZh.value ? '变换' : 'Transform' },
      { key: 'playback', icon: 'play', label: isZh.value ? '播放' : 'Playback' },
      { key: 'qa', icon: 'qa', label: 'QA' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
  }

  if (activeFourDTab.value) {
    tabs.push(
      { key: 'playback', icon: 'play', label: isZh.value ? '播放' : 'Playback' },
      { key: 'mpr', icon: 'crosshair', label: '4D MPR' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
  } else if (activeMprTab.value) {
    tabs.push(
      { key: 'playback', icon: 'play', label: isZh.value ? '播放' : 'Playback' },
      { key: 'mpr', icon: 'crosshair', label: 'MPR' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
  }

  return tabs
})

const sheetTitle = computed(() => {
  const titleMap: Record<MobileSheetTabKey, string> = {
    color: activeVolumeTab.value ? '3D' : (isZh.value ? '伪彩' : 'Pseudocolor'),
    display: isZh.value ? '显示' : 'Display',
    favorites: isZh.value ? '收藏 DICOM' : 'Favorite DICOM',
    export: isZh.value ? '导出' : 'Export',
    mpr: 'MPR',
    measure: isZh.value ? '测量' : 'Measure',
    qa: 'QA',
    playback: isZh.value ? '播放' : 'Playback',
    compare: activeCompareTab.value ? (isZh.value ? '对比同步' : 'Compare Sync') : (isZh.value ? '选择对比序列' : 'Compare Target'),
    reset: isZh.value ? '重置' : 'Reset',
    series: isZh.value ? '序列' : 'Series',
    tag: 'DICOM Tag',
    transform: activeVolumeTab.value ? (isZh.value ? '3D 参数' : '3D Tools') : (isZh.value ? '变换' : 'Transform'),
    volumeParams: isZh.value ? '3D 参数' : '3D Parameters',
    window: isZh.value ? '窗模板' : 'Window Presets'
  }
  return activeSheetKind.value ? titleMap[activeSheetKind.value] : ''
})

const showSheetTabBar = computed(() => activeSheetPresentation.value === 'menu')

const displayOverlayOptions = computed<Array<{ key: DisplayOverlayKey; icon: string; label: string; enabled: boolean }>>(() => [
  { key: 'cornerInfo', icon: 'info', label: isZh.value ? '四角信息' : 'Corner Info', enabled: activeImageTab.value?.showCornerInfo !== false },
  { key: 'scaleBar', icon: 'measure', label: isZh.value ? '比例尺' : 'Scale Bar', enabled: activeImageTab.value?.showScaleBar !== false }
])
const displayCustomWindowPresets = computed(() => windowPresets.value.filter((preset) => preset.source === 'custom'))
const selectedCustomPresetIdSet = computed(() => new Set(selectedCustomPresetIds.value))
const hasSelectedCustomPresets = computed(() => selectedCustomPresetIds.value.length > 0)
const areAllCustomPresetsSelected = computed(() =>
  displayCustomWindowPresets.value.length > 0 &&
  displayCustomWindowPresets.value.every((preset) => selectedCustomPresetIdSet.value.has(preset.id))
)
const canAddCustomWindowPreset = computed(() => displayCustomWindowPresets.value.length < MAX_CUSTOM_WINDOW_PRESETS)
const customPresetLimitLabel = computed(() => `${displayCustomWindowPresets.value.length}/${MAX_CUSTOM_WINDOW_PRESETS}`)

const compareSyncOptions = computed(() =>
  VIEW_SYNC_OPTION_CONFIGS.map((option) => ({
    ...option,
    enabled: activeCompareTab.value ? getViewSyncEnabled(activeCompareTab.value, option.key) : false
  }))
)
const compareSourceSeries = computed(() =>
  compareSourceSeriesId.value ? viewer.seriesList.value.find((series) => series.seriesId === compareSourceSeriesId.value) ?? null : null
)
const compareCandidateSeries = computed(() => {
  const source = compareSourceSeries.value
  if (!source) {
    return []
  }
  const sourceStudyUid = getSeriesStudyInstanceUid(source)
  const candidates = mobileSeriesList.value.filter((series) =>
    series.seriesId !== source.seriesId &&
    isSeriesActionSupported(series, 'CompareStack')
  )
  if (!sourceStudyUid) {
    return candidates
  }
  const sameStudy = candidates.filter((series) => getSeriesStudyInstanceUid(series) === sourceStudyUid)
  return sameStudy.length ? sameStudy : candidates
})
const currentConnectionState = computed<ConnectionState>(() => viewer.connectionState?.value ?? 'idle')
const connectionIcon = computed(() => getConnectionIcon(currentConnectionState.value))
const connectionToneClass = computed(() => `mobile-shell__connection mobile-shell__connection--${getConnectionTone(currentConnectionState.value)}`)
const activeVolumeRenderModeValue = computed(() => `render3dMode:${activeVolumeTab.value?.render3dMode ?? 'volume'}`)
const activeVolumePresetValue = computed(() => activeVolumeTab.value?.volumePreset ?? 'volumePreset:bone')
const activeVolumeRenderConfig = computed(() => (
  activeVolumeTab.value?.volumeRenderConfig ?? createDefaultVolumeRenderConfig(activeVolumeTab.value?.volumePreset ?? 'bone')
))
const mobileExportOptions = computed(() =>
  MOBILE_EXPORT_OPTIONS.filter((option) =>
    !(option.value === 'dicom-sr' || option.value === 'dicom-gsps') ||
    (activeImageTab.value?.viewType !== '3D' && activeImageTab.value?.viewType !== 'MPR')
  )
)
const mobileResetOptions = computed(() =>
  MOBILE_RESET_OPTIONS.filter((option) => {
    if (activeVolumeTab.value) {
      return option.value === 'reset:view' || option.value === 'reset:all'
    }
    if (!activeStackTab.value && !activeMprLikeTab.value) {
      return option.value !== 'reset:mtf'
    }
    return true
  })
)
const qaMtfItems = computed<ViewerMtfItem[]>(() => viewer.activeTab.value?.mtfState?.items ?? [])
const selectedMtfId = computed(() => viewer.activeTab.value?.mtfState?.selectedMtfId ?? null)
const selectedMtfItem = computed(() => {
  const id = selectedMtfId.value
  return id ? qaMtfItems.value.find((item) => item.mtfId === id) ?? null : null
})
const isMtfCurveDialogOpen = ref(false)

const {
  clearAllAnnotationsForActiveTab,
  copySelectedAnnotation,
  deleteSelectedAnnotation,
  getAnnotations,
  getDraftAnnotation,
  handleAnnotationColorUpdate,
  handleAnnotationCopy,
  handleAnnotationDelete,
  handleAnnotationPointerCancel,
  handleAnnotationPointerDown,
  handleAnnotationPointerLeave,
  handleAnnotationPointerMove,
  handleAnnotationPointerUp,
  handleAnnotationSizeUpdate,
  handleAnnotationTextUpdate,
  isAnnotationOperationEnabled
} = useWorkspaceAnnotations({
  activeOperation: viewer.activeOperation,
  activeTab: viewer.activeTab,
  activeViewportKey: activeWorkspaceViewportKey,
  emitAnnotationOperation: viewer.handleAnnotationOperation,
  setActiveViewport: viewer.setActiveViewportKey
})

const { qaWaterAnalysis } = useWorkspaceQaWaterAnalysis({
  activeOperation: viewer.activeOperation,
  activeTab: viewer.activeTab,
  qaWaterMetrics
})

function getCommittedMeasurements(viewportKey: string): MeasurementOverlay[] {
  const tab = viewer.activeTab.value
  if (!tab) {
    return []
  }
  if (tab.viewType === 'CompareStack' || tab.viewType === 'MPR' || tab.viewType === '4D') {
    return tab.viewportMeasurements?.[viewportKey] ?? []
  }
  return tab.measurements ?? []
}

function getExportMeasurements(viewportKey: string): MeasurementOverlay[] {
  return getCommittedMeasurements(viewportKey).map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
}

function getCornerInfoForExport(tab: ViewerTabItem, viewportKey: string) {
  if (tab.viewType === 'CompareStack') {
    return tab.compareCornerInfos?.[viewportKey as CompareStackPaneKey] ?? tab.cornerInfo
  }
  if (tab.viewType === 'MPR' || tab.viewType === '4D') {
    return tab.viewportCornerInfos?.[viewportKey as MprViewportKey] ?? tab.cornerInfo
  }
  return tab.cornerInfo
}

const {
  cancelExportNameDialog,
  cleanupExportUi,
  confirmExportNameDialog,
  exportNameDialogFormat,
  exportNameError,
  exportNameExtension,
  exportNameInput,
  exportNotice,
  handleExportCurrentView,
  handleOpenExportLocation,
  isExportNameDialogOpen
} = useWorkspaceViewExport({
  activeTab: viewer.activeTab,
  activeViewportKey: activeWorkspaceViewportKey,
  exportNameInputRef,
  getAnnotations,
  getCornerInfoForExport,
  getExportMeasurements,
  viewportHostRef: mobileShellRef,
  workspaceExportCopy
})

function handleToolbarViewAction(payload: Parameters<typeof viewer.triggerViewAction>[0]): void {
  if (payload.action === 'clearAnnotations' || payload.action === 'resetAll') {
    clearAllAnnotationsForActiveTab()
  }
  viewer.triggerViewAction(payload)
}

function getConnectionTone(state: ConnectionState): 'connected' | 'connecting' | 'disconnected' {
  if (state === 'connected') {
    return 'connected'
  }
  if (state === 'starting' || state === 'connecting' || state === 'reconnecting') {
    return 'connecting'
  }
  return 'disconnected'
}

function getConnectionIcon(state: ConnectionState): string {
  const tone = getConnectionTone(state)
  if (tone === 'connected') {
    return 'connected'
  }
  if (tone === 'connecting') {
    return 'connecting'
  }
  return 'disconnected'
}

function normalizeToolOperation(tool: MobileToolKey): string {
  if (tool === 'measure') {
    return 'measure:line'
  }
  if (tool === 'annotate') {
    return `${STACK_OPERATION_PREFIX}annotate:arrow`
  }
  if (tool === 'qa') {
    return `${STACK_OPERATION_PREFIX}qa:mtf`
  }
  const operation = tool === 'scroll' ? VIEW_OPERATION_TYPES.scroll : tool
  return `${STACK_OPERATION_PREFIX}${operation}`
}

function setActiveMobileTool(tool: MobileToolKey, options: { closeSheet?: boolean } = {}): void {
  if (tool === 'play') {
    toggleActivePlayback()
    return
  }

  activeTool.value = tool
  viewer.setActiveOperation(normalizeToolOperation(tool))
  if (options.closeSheet !== false) {
    dismissSheet()
  }
}

function setActiveMeasurementTool(toolType: MeasurementToolType, options: { closeSheet?: boolean } = {}): void {
  activeTool.value = 'measure'
  viewer.setActiveOperation(`measure:${toolType}`)
  if (options.closeSheet !== false) {
    dismissSheet()
  }
}

function applyDefaultToolForView(viewType: ViewType): void {
  if (viewType === 'Stack' || viewType === 'CompareStack') {
    setActiveMobileTool(stackDefaultTool.value, { closeSheet: false })
    return
  }
  if (viewType === 'MPR' || viewType === '4D') {
    setActiveMobileTool(mprDefaultTool.value, { closeSheet: false })
    return
  }
  if (viewType === '3D') {
    setActiveMobileTool(volumeDefaultTool.value, { closeSheet: false })
  }
}

function applyDisplayOverlayDefaults(): void {
  if (!activeImageTab.value) {
    return
  }

  viewer.triggerViewAction({
    action: 'displayOverlay',
    overlay: 'cornerInfo',
    enabled: defaultShowCornerInfo.value
  })
  viewer.triggerViewAction({
    action: 'displayOverlay',
    overlay: 'scaleBar',
    enabled: defaultShowScaleBar.value
  })
}

function applyMobileViewDefaults(viewType: ViewType): void {
  if (viewType === 'Stack' || viewType === 'CompareStack') {
    playbackFps.value = stackPlaybackFps.value
  }
  applyDefaultToolForView(viewType)
  applyDisplayOverlayDefaults()
}

function formatSeriesMeta(series: FolderSeriesItem): string {
  const parts = [
    series.modality,
    series.instanceCount ? `${series.instanceCount}` : ''
  ].filter(Boolean)
  return parts.join(' / ')
}

function isMobileViewTypeEnabled(viewType: ViewType): boolean {
  switch (viewType) {
    case 'Stack':
      return canOpenStack.value
    case 'CompareStack':
      return canOpenCompare.value
    case 'MPR':
      return canOpenMpr.value
    case '3D':
      return canOpenVolume.value
    case '4D':
      return canOpenFourD.value
    case 'Tag':
      return canOpenTag.value
    default:
      return false
  }
}

function isSeriesActionSupported(series: FolderSeriesItem | null | undefined, viewType: ViewType): boolean {
  return isMobileViewTypeEnabled(viewType) && isSeriesViewSupported(series, viewType)
}

function getSeriesStudyInstanceUid(series: FolderSeriesItem | null | undefined): string {
  const value = (series as { studyInstanceUid?: unknown } | null | undefined)?.studyInstanceUid
  return typeof value === 'string' ? value : ''
}

async function openSeriesView(seriesId: string, viewType: ViewType): Promise<void> {
  const series = viewer.seriesList.value.find((item) => item.seriesId === seriesId) ?? null
  if (!isSeriesActionSupported(series, viewType)) {
    return
  }

  stopSlicePlayback()
  viewer.selectSeries(seriesId)
  if (viewType === 'MPR' || viewType === '4D') {
    activeMprViewportKey.value = mprDefaultViewport.value
  }
  await viewer.openSeriesView(seriesId, viewType, { useHangingProtocol: false })
  if (viewType === 'MPR' || viewType === '4D') {
    viewer.setActiveViewportKey(activeMprViewportKey.value)
  }
  if (viewType === '3D') {
    viewer.setActiveViewportKey('volume')
  }
  if (viewType === 'Stack' || viewType === 'MPR' || viewType === '3D' || viewType === '4D') {
    applyMobileViewDefaults(viewType)
  }
  dismissSheet()
}

async function openSeriesStack(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, 'Stack')
}

function getCompareSourceSeriesId(): string | null {
  const tab = viewer.activeTab.value
  if (tab?.viewType === 'CompareStack') {
    return tab.compareSeriesIds?.[activeCompareViewportKey.value] || tab.seriesId || null
  }
  return activeImageTab.value?.seriesId || viewer.selectedSeriesId.value || null
}

function canStartCompareFromSeries(series: FolderSeriesItem): boolean {
  return canOpenCompare.value && isSeriesActionSupported(series, 'CompareStack')
}

function openComparePicker(sourceSeriesId = getCompareSourceSeriesId()): void {
  if (!sourceSeriesId || !canOpenCompare.value) {
    return
  }
  const source = viewer.seriesList.value.find((series) => series.seriesId === sourceSeriesId) ?? null
  if (!isSeriesActionSupported(source, 'CompareStack')) {
    return
  }
  compareSourceSeriesId.value = sourceSeriesId
  viewer.selectSeries(sourceSeriesId)
  openFocusedSheet('compare')
}

async function openSeriesCompareTo(targetSeriesId: string): Promise<void> {
  const sourceSeriesId = compareSourceSeriesId.value || getCompareSourceSeriesId()
  if (!sourceSeriesId || sourceSeriesId === targetSeriesId) {
    return
  }

  stopSlicePlayback()
  activeCompareViewportKey.value = COMPARE_STACK_SOURCE_PANE_KEY
  await viewer.openSeriesCompare(sourceSeriesId, targetSeriesId)
  viewer.setActiveViewportKey(COMPARE_STACK_SOURCE_PANE_KEY)
  applyMobileViewDefaults('CompareStack')
  compareSourceSeriesId.value = null
  dismissSheet()
}

async function openSeriesMpr(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, 'MPR')
}

async function openSeriesVolume(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, '3D')
}

async function openSeriesFourD(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, '4D')
}

async function openSeriesTag(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, 'Tag')
}

function getMobileDevSampleDicomPath(): string | null {
  if (!import.meta.env.DEV) {
    return null
  }

  const configuredPath = import.meta.env.VITE_MOBILE_DEV_SAMPLE_DICOM_PATH?.trim()
  return configuredPath || DEFAULT_MOBILE_DEV_SAMPLE_DICOM_PATH
}

function resolveMobileSampleMode(): MobileSampleMode {
  const explicitMode = import.meta.env.VITE_MOBILE_SAMPLE_MODE?.trim().toLowerCase()
  if (explicitMode === 'local-path' || explicitMode === 'server-sample') {
    return explicitMode
  }
  return import.meta.env.DEV ? 'local-path' : 'server-sample'
}

async function loadMobileDemoResponse() {
  if (resolveMobileSampleMode() === 'local-path') {
    const devSamplePath = getMobileDevSampleDicomPath()
    if (!devSamplePath) {
      throw new Error('VITE_MOBILE_DEV_SAMPLE_DICOM_PATH is required when VITE_MOBILE_SAMPLE_MODE=local-path')
    }
    return postApi('LoadFolderApiV1DicomLoadFolderPost', { folderPath: devSamplePath })
  }

  return postApi('LoadSampleFolderApiV1DicomLoadSamplePost', undefined)
}

function normalizeMobileLoadSelection(selection: DicomLoadSelection): DicomLoadSource[] {
  return Array.isArray(selection) ? selection : [selection]
}

async function openFirstMobileLoadedSeries(loadedSeries: FolderSeriesItem[]): Promise<void> {
  const firstStackSeries = loadedSeries.find((series) => series.isImageSeries !== false) ?? loadedSeries[0] ?? null
  if (firstStackSeries) {
    await openSeriesStack(firstStackSeries.seriesId)
  }
}

async function applyMobileLoadResponse(response: LoadFolderResponse): Promise<void> {
  const loadedSeries = await viewer.applyLoadedDicomSeries(response, {
    openFirstSeriesView: false,
    selectLoadedSeries: true
  })
  await openFirstMobileLoadedSeries(loadedSeries)
}

async function loadMobileLocalSource(source: DicomLoadSource): Promise<LoadFolderResponse | null> {
  if (source.kind === 'files') {
    return postDicomUpload(source.files)
  }
  if (source.kind === 'path') {
    return postApi('LoadFolderApiV1DicomLoadFolderPost', { folderPath: source.path })
  }
  if (source.kind === 'server-sample') {
    return loadMobileDemoResponse()
  }
  return null
}

async function loadDemoSeries(): Promise<void> {
  if (!canLoadDemo.value || isLoadingDemo.value) {
    return
  }

  isLoadingDemo.value = true
  try {
    const backendStatus = await viewerRuntime.getBackendStatus()
    setApiBaseURL(`${backendStatus.origin}/api/v1`)
    const response = await loadMobileDemoResponse()
    await applyMobileLoadResponse(response)
  } catch (error) {
    console.error(error)
    viewer.showStatusToast(isZh.value ? '示例影像加载失败，请检查后端服务。' : 'Failed to load demo images. Check the backend service.', 'error')
  } finally {
    isLoadingDemo.value = false
  }
}

async function loadLocalFolder(): Promise<void> {
  if (!canLoadLocal.value || isLoadingLocal.value) {
    return
  }

  isLoadingLocal.value = true
  try {
    const backendStatus = await viewerRuntime.getBackendStatus()
    setApiBaseURL(`${backendStatus.origin}/api/v1`)
    const selection = await viewerRuntime.chooseFolder('folder')
    if (!selection) {
      return
    }
    for (const source of normalizeMobileLoadSelection(selection)) {
      const response = await loadMobileLocalSource(source)
      if (response) {
        await applyMobileLoadResponse(response)
      }
    }
  } catch (error) {
    console.error(error)
    viewer.showStatusToast(isZh.value ? '本地文件夹加载失败，请确认文件格式和后端服务。' : 'Failed to load the local folder. Check the files and backend service.', 'error')
  } finally {
    isLoadingLocal.value = false
  }
}

async function handlePacsSeriesLoaded(response: LoadFolderResponse): Promise<void> {
  try {
    await applyMobileLoadResponse(response)
  } catch (error) {
    console.error(error)
    viewer.showStatusToast(isZh.value ? 'PACS 序列打开失败。' : 'Failed to open PACS series.', 'error')
  }
}

function dismissSheet(): void {
  activeSheetKind.value = null
  activeSheetPresentation.value = null
}

function openFocusedSheet(kind: MobileSheetTabKey): void {
  activeSheetPresentation.value = 'focused'
  activeSheetKind.value = kind
}

function openMenuSheet(kind: MobileSheetTabKey): void {
  activeSheetPresentation.value = 'menu'
  activeSheetKind.value = kind
}

function openSheet(kind: MobileSheetTabKey): void {
  openMenuSheet(kind)
}

function openMoreSheet(): void {
  if (activeCompareTab.value) {
    openFocusedSheet('compare')
    return
  }
  if (activeMprLikeTab.value) {
    openMenuSheet('mpr')
    return
  }
  if (activeVolumeTab.value) {
    openMenuSheet('color')
    return
  }
  openMenuSheet('window')
}

function closeSheet(): void {
  if (activeSheetKind.value === 'compare') {
    compareSourceSeriesId.value = null
  }
  dismissSheet()
}

function isSeriesSelected(seriesId: string): boolean {
  return viewer.selectedSeriesId.value === seriesId
}

function selectSeriesForActions(seriesId: string): void {
  viewer.selectSeries(seriesId)
}

function closeActiveView(): void {
  const tabKey = viewer.activeTabKey.value
  if (!tabKey) {
    openSheet('series')
    return
  }
  stopSlicePlayback()
  viewer.closeTab(tabKey)
  void nextTick(() => {
    openSheet('series')
  })
}

function clampSliceValue(value: number, total: number): number {
  return Math.max(1, Math.min(total, Math.trunc(value)))
}

function cancelScheduledSliceSliderFlush(): void {
  if (sliceSliderFrame != null) {
    window.cancelAnimationFrame(sliceSliderFrame)
    sliceSliderFrame = null
  }
}

function flushSliceSliderDelta(state = sliceSliderState.value): void {
  cancelScheduledSliceSliderFlush()
  if (!state || !state.pendingDeltaY) {
    return
  }
  const deltaY = state.pendingDeltaY
  state.pendingDeltaY = 0
  viewer.handleViewportWheel({
    viewportKey: state.viewportKey,
    deltaY
  })
}

function scheduleSliceSliderFlush(): void {
  if (sliceSliderFrame != null) {
    return
  }
  sliceSliderFrame = window.requestAnimationFrame(() => {
    sliceSliderFrame = null
    flushSliceSliderDelta()
  })
}

function getSliceSliderState(slice: NonNullable<ReturnType<typeof parseSliceLabel>>, viewportKey: string): MobileSliceSliderState {
  const currentState = sliceSliderState.value
  if (!currentState || currentState.viewportKey !== viewportKey || currentState.total !== slice.total) {
    flushSliceSliderDelta(currentState)
    const nextState = {
      draftSlice: slice.current,
      isDragging: false,
      lastSentSlice: slice.current,
      pendingDeltaY: 0,
      total: slice.total,
      viewportKey
    }
    sliceSliderState.value = nextState
    return nextState
  }
  return currentState
}

function syncSliceSliderDraftFromEvent(event: Event): boolean {
  const slice = activeSlice.value
  if (!slice) {
    return false
  }

  const target = Number((event.target as HTMLInputElement | null)?.value)
  if (!Number.isFinite(target)) {
    return false
  }

  const viewportKey = activeSliceViewportKey.value
  const sliderState = getSliceSliderState(slice, viewportKey)
  sliderState.isDragging = true
  sliderState.draftSlice = clampSliceValue(target, sliderState.total)
  const deltaY = sliderState.draftSlice - sliderState.lastSentSlice
  if (!deltaY) {
    return true
  }

  sliderState.pendingDeltaY += deltaY
  sliderState.lastSentSlice = sliderState.draftSlice
  scheduleSliceSliderFlush()
  return true
}

function handleSliceSliderInput(event: Event): void {
  syncSliceSliderDraftFromEvent(event)
}

function handleSliceSliderCommit(event: Event): void {
  if (syncSliceSliderDraftFromEvent(event)) {
    finishSliceSliderInteraction()
  }
}

function beginSliceSliderInteraction(): void {
  const slice = activeSlice.value
  if (!slice) {
    return
  }
  getSliceSliderState(slice, activeSliceViewportKey.value).isDragging = true
}

function finishSliceSliderInteraction(): void {
  flushSliceSliderDelta()
  if (sliceSliderState.value) {
    sliceSliderState.value.isDragging = false
  }
}

function formatWindowPresetValue(preset: WindowTemplatePreset): string {
  return `${preset.ww}|${preset.wl}`
}

function formatWindowPresetDetail(preset: WindowTemplatePreset): string {
  return `WW ${Math.round(preset.ww)} / WL ${Math.round(preset.wl)}`
}

function applyWindowPreset(preset: WindowTemplatePreset): void {
  selectedWindowPresetId.value = preset.id
  viewer.triggerViewAction({ action: 'windowPreset', value: formatWindowPresetValue(preset) })
  dismissSheet()
}

function syncSelectedCustomPresetIds(): void {
  const availableIds = new Set(displayCustomWindowPresets.value.map((preset) => preset.id))
  selectedCustomPresetIds.value = selectedCustomPresetIds.value.filter((id) => availableIds.has(id))
}

function toggleCustomPresetSelection(id: string): void {
  if (selectedCustomPresetIdSet.value.has(id)) {
    selectedCustomPresetIds.value = selectedCustomPresetIds.value.filter((item) => item !== id)
    return
  }
  selectedCustomPresetIds.value = [...selectedCustomPresetIds.value, id]
}

function toggleAllCustomPresetSelection(): void {
  if (areAllCustomPresetsSelected.value) {
    selectedCustomPresetIds.value = []
    return
  }
  selectedCustomPresetIds.value = displayCustomWindowPresets.value.map((preset) => preset.id)
}

function handleRemoveSelectedCustomWindowPresets(): void {
  syncSelectedCustomPresetIds()
  if (!selectedCustomPresetIds.value.length) {
    return
  }
  removeCustomWindowPresets(selectedCustomPresetIds.value)
  selectedCustomPresetIds.value = []
}

function handleAddCustomWindowPreset(): void {
  if (!canAddCustomWindowPreset.value) {
    return
  }
  const nextId = addCustomWindowPreset({
    zhName: customPresetZhName.value,
    enName: customPresetEnName.value,
    ww: Number.parseFloat(customPresetWw.value),
    wl: Number.parseFloat(customPresetWl.value)
  })
  selectedWindowPresetId.value = nextId
  const createdPreset = windowPresets.value.find((preset) => preset.id === nextId)
  if (createdPreset) {
    viewer.triggerViewAction({ action: 'windowPreset', value: formatWindowPresetValue(createdPreset) })
  }
  customPresetZhName.value = ''
  customPresetEnName.value = ''
  customPresetWw.value = '400'
  customPresetWl.value = '40'
}

watch(displayCustomWindowPresets, () => {
  syncSelectedCustomPresetIds()
})

function toggleDisplayOverlay(key: DisplayOverlayKey): void {
  const option = displayOverlayOptions.value.find((item) => item.key === key)
  viewer.triggerViewAction({
    action: 'displayOverlay',
    overlay: key,
    enabled: !(option?.enabled ?? true)
  })
}

function applyPseudocolor(value: string): void {
  selectedPseudocolorKey.value = value.replace(/^pseudocolor:/, '')
  handleToolbarViewAction({ action: 'pseudocolor', value })
  dismissSheet()
}

function applyVolumeRenderMode(value: string): void {
  handleToolbarViewAction({ action: 'render3dMode', value })
  dismissSheet()
}

function applyVolumePreset(value: string): void {
  handleToolbarViewAction({ action: 'volumePreset', value })
  dismissSheet()
}

function applyTransform(value: string): void {
  handleToolbarViewAction({ action: 'rotate', value })
  dismissSheet()
}

function handleResetView(): void {
  handleToolbarViewAction({ action: 'reset' })
  dismissSheet()
}

function applyResetOption(value: string): void {
  if (value === 'reset:annotations') {
    handleToolbarViewAction({ action: 'clearAnnotations' })
  } else if (value === 'reset:mtf') {
    viewer.handleMtfClear()
  } else if (value === 'reset:all') {
    handleToolbarViewAction({ action: 'resetAll' })
  } else if (value === 'reset:measurements') {
    handleToolbarViewAction({ action: 'clearMeasurements' })
  } else {
    handleToolbarViewAction({ action: 'reset' })
  }
  dismissSheet()
}

function applyQaTool(value: string): void {
  viewer.setActiveOperation(`${STACK_OPERATION_PREFIX}${value}`)
  dismissSheet()
}

function exportActiveView(format: ViewerExportFormat): void {
  void handleExportCurrentView(format, activeWorkspaceViewportKey.value)
  dismissSheet()
}

function getViewportMtfItems(viewportKey: string): ViewerMtfItem[] {
  const draft = viewer.activeTab.value?.mtfState?.items ?? []
  return draft.filter((item) => item.viewportKey === viewportKey)
}

function handleSelectMtf(payload: { mtfId: string | null }): void {
  viewer.handleMtfSelect(payload)
}

function handleOpenMtfCurve(): void {
  if (selectedMtfItem.value?.status === 'ready') {
    isMtfCurveDialogOpen.value = true
  }
}

function handleCloseMtfCurve(): void {
  isMtfCurveDialogOpen.value = false
}

function handleCopySelectedMtf(): void {
  if (selectedMtfId.value) {
    void viewer.handleMtfCopy({ mtfId: selectedMtfId.value })
  }
}

function handleDeleteSelectedMtf(): void {
  if (selectedMtfId.value) {
    viewer.handleMtfClear({ mtfId: selectedMtfId.value })
  }
}

function handleCopySelectedAnnotation(): void {
  copySelectedAnnotation(activeWorkspaceViewportKey.value)
}

function handleDeleteSelectedAnnotation(): void {
  deleteSelectedAnnotation(activeWorkspaceViewportKey.value)
}

function selectMprViewport(viewportKey: MprViewportKey): void {
  activeMprViewportKey.value = viewportKey
  viewer.setActiveViewportKey(viewportKey)
}

function isMprViewportKey(viewportKey: string): viewportKey is MprViewportKey {
  return viewportKey === 'mpr-ax' || viewportKey === 'mpr-cor' || viewportKey === 'mpr-sag'
}

function handleMprActiveViewportChange(viewportKey: string): void {
  if (isMprViewportKey(viewportKey)) {
    selectMprViewport(viewportKey)
  }
}

function handleCompareActiveViewportChange(viewportKey: CompareStackPaneKey): void {
  activeCompareViewportKey.value = viewportKey
  viewer.setActiveViewportKey(viewportKey)
}

function toggleCompareSync(key: CompareSyncSettingKey): void {
  const tab = activeCompareTab.value
  if (!tab) {
    return
  }
  viewer.handleCompareSyncChange({
    tabKey: tab.key,
    key,
    value: !getViewSyncEnabled(tab, key)
  })
}

function toggleStackStarForCurrentSlice(): void {
  const tab = activeStackTab.value
  const slice = activeStackSlice.value
  if (!tab || !slice) {
    return
  }
  toggleSliceStar(tab.seriesId, slice.index)
}

function getFavoriteSliceTitle(item: MobileFavoriteSliceItem): string {
  return item.series?.seriesDescription || item.series?.seriesId || item.seriesId
}

function getFavoriteSliceMeta(item: MobileFavoriteSliceItem): string {
  const parts = [
    item.series?.modality,
    item.total ? `${isZh.value ? '第' : 'Slice'} ${item.displaySlice} / ${item.total}` : `${isZh.value ? '第' : 'Slice'} ${item.displaySlice}`
  ].filter(Boolean)
  return parts.join(' / ')
}

function canOpenFavoriteSlice(item: MobileFavoriteSliceItem): boolean {
  return isSeriesActionSupported(item.series, 'Stack')
}

async function openFavoriteSlice(item: MobileFavoriteSliceItem): Promise<void> {
  if (!canOpenFavoriteSlice(item)) {
    return
  }

  await openSeriesStack(item.seriesId)
  await nextTick()
  const openedSlice = activeStackTab.value?.seriesId === item.seriesId ? parseSliceLabel(activeStackTab.value.sliceLabel) : null
  const currentIndex = openedSlice?.index ?? 0
  const deltaY = item.sliceIndex - currentIndex
  if (deltaY) {
    viewer.handleViewportWheel({ viewportKey: 'single', deltaY })
  }
}

function removeFavoriteSlice(item: MobileFavoriteSliceItem): void {
  if (isSliceStarred(item.seriesId, item.sliceIndex)) {
    toggleSliceStar(item.seriesId, item.sliceIndex)
  }
}

function getCurrentStackSliceInfo(): { current: number; total: number } | null {
  const slice = activeStackSlice.value
  return slice && slice.total > 1 ? { current: slice.current, total: slice.total } : null
}

function getCurrentMprSliceInfo(): { current: number; total: number; viewportKey: MprViewportKey } | null {
  const slice = activeMprSlice.value
  return slice && slice.total > 1 ? { current: slice.current, total: slice.total, viewportKey: activeMprViewportKey.value } : null
}

function tickStackPlayback(): void {
  const sliceInfo = getCurrentStackSliceInfo()
  if (!sliceInfo || sliceInfo.current >= sliceInfo.total) {
    stopStackPlayback()
    return
  }

  viewer.handleViewportWheel({ viewportKey: 'single', deltaY: 1 })
}

function startStackPlayback(): void {
  if (!canPlayStack.value) {
    return
  }
  stopSlicePlayback()
  isPlayingStack.value = true
  playbackTimer = window.setInterval(tickStackPlayback, Math.max(34, Math.round(1000 / playbackFps.value)))
}

function clearSlicePlaybackTimer(): void {
  if (playbackTimer != null) {
    window.clearInterval(playbackTimer)
    playbackTimer = null
  }
}

function stopStackPlayback(): void {
  clearSlicePlaybackTimer()
  isPlayingStack.value = false
}

function tickMprPlayback(): void {
  const sliceInfo = getCurrentMprSliceInfo()
  if (!sliceInfo || sliceInfo.current >= sliceInfo.total) {
    stopMprPlayback()
    return
  }

  viewer.handleViewportWheel({ viewportKey: sliceInfo.viewportKey, deltaY: 1 })
}

function startMprPlayback(): void {
  if (!canPlayMpr.value) {
    return
  }
  stopSlicePlayback()
  isPlayingMpr.value = true
  playbackTimer = window.setInterval(tickMprPlayback, Math.max(34, Math.round(1000 / playbackFps.value)))
}

function stopMprPlayback(): void {
  clearSlicePlaybackTimer()
  isPlayingMpr.value = false
}

function stopSlicePlayback(): void {
  clearSlicePlaybackTimer()
  isPlayingStack.value = false
  isPlayingMpr.value = false
}

function clearFourDPlaybackStarting(): void {
  if (fourDPlaybackStartingTimer != null) {
    window.clearTimeout(fourDPlaybackStartingTimer)
    fourDPlaybackStartingTimer = null
  }
  fourDPlaybackStarting.value = false
}

function markFourDPlaybackStarting(): void {
  clearFourDPlaybackStarting()
  fourDPlaybackStarting.value = true
  fourDPlaybackStartingTimer = window.setTimeout(() => {
    fourDPlaybackStartingTimer = null
    fourDPlaybackStarting.value = false
  }, 12000)
}

function toggleStackPlayback(): void {
  if (isPlayingStack.value) {
    stopStackPlayback()
    return
  }
  startStackPlayback()
}

function toggleMprPlayback(): void {
  if (isPlayingMpr.value) {
    stopMprPlayback()
    return
  }
  startMprPlayback()
}

function toggleFourDPlayback(): void {
  const tab = activeFourDTab.value
  if (!tab || !canPlayFourD.value || fourDPlaybackStarting.value) {
    return
  }
  if (!tab.fourDIsPlaying) {
    markFourDPlaybackStarting()
  } else {
    clearFourDPlaybackStarting()
  }
  viewer.handleFourDPlaybackChange({
    tabKey: tab.key,
    isPlaying: !tab.fourDIsPlaying
  })
}

function toggleActivePlayback(): void {
  if (activeFourDTab.value) {
    toggleFourDPlayback()
    return
  }
  if (activeMprTab.value) {
    toggleMprPlayback()
    return
  }
  toggleStackPlayback()
}

function setPlaybackFps(value: MobileStackPlaybackFps): void {
  if (activeFourDTab.value) {
    viewer.handleFourDFpsChange({
      tabKey: activeFourDTab.value.key,
      fps: value
    })
    return
  }
  playbackFps.value = value
  if (isPlayingStack.value) {
    startStackPlayback()
    return
  }
  if (isPlayingMpr.value) {
    startMprPlayback()
  }
}

function handlePlaybackFpsSliderInput(event: Event): void {
  const rawIndex = Number((event.target as HTMLInputElement | null)?.value)
  const clampedIndex = Math.max(
    0,
    Math.min(MOBILE_STACK_PLAYBACK_FPS_OPTIONS.length - 1, Number.isFinite(rawIndex) ? Math.trunc(rawIndex) : activePlaybackFpsIndex.value)
  )
  setPlaybackFps(MOBILE_STACK_PLAYBACK_FPS_OPTIONS[clampedIndex])
}

function handleFourDPhaseSliderInput(event: Event): void {
  const tab = activeFourDTab.value
  if (!tab || tab.fourDIsPlaying || fourDPlaybackStarting.value) {
    return
  }
  const value = Number((event.target as HTMLInputElement | null)?.value)
  if (!Number.isFinite(value)) {
    return
  }
  const nextIndex = Math.max(0, Math.min(fourDPhaseCount.value - 1, Math.trunc(value) - 1))
  viewer.handleFourDPhaseChange({
    tabKey: tab.key,
    phaseIndex: nextIndex
  })
}

function openActiveSeriesTag(): void {
  const seriesId = activeSeriesId.value
  if (seriesId) {
    void openSeriesTag(seriesId)
  }
}

function matchesTagSearch(item: DicomTagItem, query: string): boolean {
  return [item.tag, item.keyword, item.name, item.vr, item.value]
    .some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
}

function moveTagIndex(delta: number): void {
  const tab = activeTagTab.value
  if (!tab) {
    return
  }
  const total = Math.max(1, tab.tagTotal ?? 1)
  const current = Math.max(0, tab.tagIndex ?? 0)
  const nextIndex = Math.max(0, Math.min(total - 1, current + delta))
  if (nextIndex !== current) {
    void viewer.handleTagIndexChange({ tabKey: tab.key, index: nextIndex })
  }
}

function closeActiveTagView(): void {
  const tab = activeTagTab.value
  if (!tab) {
    return
  }
  tagSearchQuery.value = ''
  viewer.closeTab(tab.key)
}

function isSeriesViewActive(seriesId: string, viewType: ViewType): boolean {
  const tab = viewer.activeTab.value
  return tab?.seriesId === seriesId && tab.viewType === viewType
}

function isSeriesCompareActive(seriesId: string): boolean {
  const tab = activeCompareTab.value
  return Boolean(tab?.compareSeriesIds && Object.values(tab.compareSeriesIds).includes(seriesId))
}

function isToolbarItemActive(tool: MobileToolbarItem): boolean {
  if (tool.key === 'more') {
    return activeSheetPresentation.value === 'menu' && Boolean(activeSheetKind.value)
  }
  if (tool.key === 'measure') {
    return (activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'measure') ||
      viewer.activeOperation.value.startsWith('measure:')
  }
  if (tool.key === 'annotate') {
    return viewer.activeOperation.value.startsWith(`${STACK_OPERATION_PREFIX}annotate`)
  }
  if (tool.key === 'qa') {
    return (activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'qa') ||
      viewer.activeOperation.value.includes('qa:')
  }
  if (tool.key === 'reset') {
    return false
  }
  if (tool.key === 'color') {
    return activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'color'
  }
  if (tool.key === 'transform') {
    return activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'transform'
  }
  if (tool.key === 'export') {
    return activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'export'
  }
  if (tool.key === 'volumeParams') {
    return activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'volumeParams'
  }
  if (tool.key === 'play') {
    return activeFourDTab.value ? (isPlayingFourD.value || fourDPlaybackStarting.value) : isPlayingActiveSlicePlayback.value
  }
  return activeTool.value === tool.key
}

function isToolbarItemDisabled(tool: MobileToolbarItem): boolean {
  if (tool.key === 'play') {
    return !canPlayActive.value || fourDPlaybackStarting.value
  }
  if (tool.key === 'measure') {
    return !activeImageTab.value || Boolean(activeVolumeTab.value)
  }
  if (tool.key === 'annotate') {
    return !activeImageTab.value || Boolean(activeVolumeTab.value)
  }
  if (tool.key === 'qa') {
    return !activeStackTab.value
  }
  if (tool.key === 'color') {
    return !activeImageTab.value
  }
  if (tool.key === 'transform') {
    return !activeImageTab.value || Boolean(activeVolumeTab.value)
  }
  if (tool.key === 'volumeParams') {
    return !activeVolumeTab.value
  }
  if (tool.key === 'export') {
    return !activeImageTab.value
  }
  return !activeImageTab.value
}

function handleToolbarItem(tool: MobileToolbarItem): void {
  if (tool.key === 'more') {
    openMoreSheet()
    return
  }
  if (tool.key === 'measure') {
    openFocusedSheet('measure')
    return
  }
  if (tool.key === 'qa') {
    openFocusedSheet('qa')
    return
  }
  if (tool.key === 'reset') {
    handleResetView()
    return
  }
  if (tool.key === 'color') {
    openFocusedSheet('color')
    return
  }
  if (tool.key === 'transform') {
    openFocusedSheet('transform')
    return
  }
  if (tool.key === 'volumeParams') {
    openFocusedSheet('volumeParams')
    return
  }
  if (tool.key === 'export') {
    openFocusedSheet('export')
    return
  }
  if (tool.key === 'tag') {
    openActiveSeriesTag()
    return
  }
  if (tool.key === 'compare') {
    openComparePicker()
    return
  }
  setActiveMobileTool(tool.key)
}

function getScreenOrientation(): LockableScreenOrientation | null {
  if (typeof window === 'undefined') {
    return null
  }
  return (window.screen.orientation as LockableScreenOrientation | undefined) ?? null
}

function getOrientationLockType(lock: MobileOrientationLock): MobileScreenOrientationLockType | null {
  if (lock === 'portrait') {
    return 'portrait-primary'
  }
  if (lock === 'landscape') {
    return 'landscape-primary'
  }
  return null
}

async function applyOrientationLock(lock: MobileOrientationLock): Promise<void> {
  const screenOrientation = getScreenOrientation()
  if (lock === 'unlocked') {
    orientationLockNoticeShown.value = false
    screenOrientation?.unlock?.()
    return
  }

  const lockType = getOrientationLockType(lock)
  if (!screenOrientation?.lock || !lockType) {
    showOrientationLockFallbackNotice()
    return
  }

  try {
    await screenOrientation.lock(lockType)
  } catch {
    showOrientationLockFallbackNotice()
  }
}

function showOrientationLockFallbackNotice(): void {
  if (orientationLockNoticeShown.value) {
    return
  }
  orientationLockNoticeShown.value = true
  viewer.showStatusToast(
    isZh.value
      ? '\u5f53\u524d\u6d4f\u89c8\u5668\u6216\u7cfb\u7edf\u672a\u5141\u8bb8\u9501\u5b9a\u5c4f\u5e55\u65b9\u5411\uff0c\u5df2\u4fdd\u6301\u79fb\u52a8\u7aef\u5e03\u5c40\u9002\u914d\u3002'
      : 'This browser or OS did not allow screen orientation lock. Mobile layout adaptation remains active.',
    'info'
  )
}

watch(
  () => viewer.activeTab.value?.viewType,
  (viewType) => {
    closeSheet()
    stopSlicePlayback()
    if (viewType === 'MPR' || viewType === '4D') {
      viewer.setActiveViewportKey(activeMprViewportKey.value)
      applyMobileViewDefaults(viewType)
      return
    }
    if (viewType === '3D') {
      viewer.setActiveViewportKey('volume')
      applyMobileViewDefaults('3D')
      return
    }
    if (viewType === 'CompareStack') {
      activeCompareViewportKey.value = COMPARE_STACK_SOURCE_PANE_KEY
      viewer.setActiveViewportKey(COMPARE_STACK_SOURCE_PANE_KEY)
      applyMobileViewDefaults('CompareStack')
      return
    }
    if (viewType === 'Stack') {
      applyMobileViewDefaults('Stack')
    }
  },
  { immediate: true }
)

watch(
  activeTool,
  (tool) => {
    if (tool !== 'play') {
      viewer.setActiveOperation(normalizeToolOperation(tool))
    }
  },
  { immediate: true }
)

watch(
  () => viewer.activeTabKey.value,
  () => {
    stopSlicePlayback()
    clearFourDPlaybackStarting()
    flushSliceSliderDelta()
    sliceSliderState.value = null
    tagSearchQuery.value = ''
    isMtfCurveDialogOpen.value = false
  }
)

watch(
  selectedMtfItem,
  (item) => {
    if (!item) {
      isMtfCurveDialogOpen.value = false
    }
  }
)

watch(
  [activeSlice, activeSliceViewportKey],
  ([slice, viewportKey]) => {
    const sliderState = sliceSliderState.value
    if (!slice || !sliderState || sliderState.viewportKey !== viewportKey) {
      flushSliceSliderDelta(sliderState)
      sliceSliderState.value = null
      return
    }
    if (!sliderState.isDragging && !sliderState.pendingDeltaY && sliderState.lastSentSlice === slice.current) {
      sliceSliderState.value = null
    }
  }
)

watch(
  stackDefaultTool,
  () => {
    if (activeStackTab.value || activeCompareTab.value) {
      applyDefaultToolForView(activeCompareTab.value ? 'CompareStack' : 'Stack')
    }
  }
)

watch(
  mprDefaultTool,
  () => {
    if (activeMprLikeTab.value) {
      applyDefaultToolForView(activeFourDTab.value ? '4D' : 'MPR')
    }
  }
)

watch(
  volumeDefaultTool,
  () => {
    if (activeVolumeTab.value) {
      applyDefaultToolForView('3D')
    }
  }
)

watch(
  stackPlaybackFps,
  (value) => {
    playbackFps.value = value
    if (isPlayingStack.value) {
      startStackPlayback()
      return
    }
    if (isPlayingMpr.value) {
      startMprPlayback()
    }
  }
)

watch(
  [isPlayingFourD, activeFourDTab],
  ([isPlaying, tab]) => {
    if (isPlaying || !tab) {
      clearFourDPlaybackStarting()
    }
  }
)

watch(
  [defaultShowCornerInfo, defaultShowScaleBar],
  () => {
    applyDisplayOverlayDefaults()
  }
)

watch(
  orientationLock,
  (lock) => {
    void applyOrientationLock(lock)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopSlicePlayback()
  clearFourDPlaybackStarting()
  flushSliceSliderDelta()
  cleanupExportUi()
  void applyOrientationLock('unlocked')
})
</script>

<template>
  <div ref="mobileShellRef" class="mobile-shell" :class="mobileShellClasses">
    <header class="mobile-shell__header">
      <button type="button" class="mobile-shell__title-group" data-testid="mobile-title-series-button" @click="openSheet('series')">
        <div class="mobile-shell__eyebrow">{{ isZh ? 'DicomVision 移动端' : 'DicomVision Mobile' }}</div>
        <div class="mobile-shell__title">{{ activeTitle }}</div>
      </button>
      <div class="mobile-shell__header-actions">
        <button
          type="button"
          class="mobile-shell__icon-button"
          :class="connectionToneClass"
          data-testid="mobile-connection-status"
          :aria-label="currentConnectionState"
        >
          <AppIcon :name="connectionIcon" :size="18" />
        </button>
        <button
          v-if="hasActiveView"
          type="button"
          class="mobile-shell__icon-button"
          data-testid="mobile-close-view-button"
          :aria-label="isZh ? '关闭当前视图' : 'Close current view'"
          @click="closeActiveView"
        >
          <AppIcon name="close" :size="18" />
        </button>
        <button
          type="button"
          class="mobile-shell__icon-button"
          data-testid="mobile-settings-button"
          @click="isSettingsOpen = true"
        >
          <AppIcon name="settings" :size="18" />
        </button>
      </div>
    </header>

    <main class="mobile-shell__viewer">
      <MobileStackViewport
        v-if="activeStackTab"
        :active-operation="viewer.activeOperation.value"
        :active-tab="viewer.activeTab.value"
        :annotation-pointer-cancel="handleAnnotationPointerCancel"
        :annotation-pointer-down="handleAnnotationPointerDown"
        :annotation-pointer-leave="handleAnnotationPointerLeave"
        :annotation-pointer-move="handleAnnotationPointerMove"
        :annotation-pointer-up="handleAnnotationPointerUp"
        :annotations="getAnnotations('single')"
        :draft-annotation="getDraftAnnotation('single')"
        :is-view-loading="viewer.isViewLoading.value"
        :mtf-items="getViewportMtfItems('single')"
        :qa-water-analysis="qaWaterAnalysis"
        :scroll-threshold="scrollDragThreshold"
        :selected-mtf-id="selectedMtfId"
        @active-viewport-change="viewer.setActiveViewportKey"
        @copy-annotation="handleAnnotationCopy"
        @copy-selected-mtf="handleCopySelectedMtf"
        @delete-annotation="handleAnnotationDelete"
        @clear-mtf="handleDeleteSelectedMtf"
        @hover-viewport-change="viewer.handleHoverViewportChange"
        @measurement-create="viewer.handleMeasurementCreate"
        @measurement-delete="viewer.handleMeasurementDelete"
        @mtf-commit="viewer.handleMtfCommit"
        @open-mtf-curve="handleOpenMtfCurve"
        @select-mtf="handleSelectMtf"
        @update-annotation-color="handleAnnotationColorUpdate"
        @update-annotation-size="handleAnnotationSizeUpdate"
        @update-annotation-text="handleAnnotationTextUpdate"
        @viewport-drag="viewer.handleViewportDrag"
        @viewport-wheel="viewer.handleViewportWheel"
        @workspace-ready="viewer.setViewerStage"
      />

      <MobileCompareStackViewport
        v-else-if="activeCompareTab"
        :active-compare-viewport-key="activeCompareViewportKey"
        :active-operation="viewer.activeOperation.value"
        :active-tab="viewer.activeTab.value"
        :annotation-pointer-cancel="handleAnnotationPointerCancel"
        :annotation-pointer-down="handleAnnotationPointerDown"
        :annotation-pointer-leave="handleAnnotationPointerLeave"
        :annotation-pointer-move="handleAnnotationPointerMove"
        :annotation-pointer-up="handleAnnotationPointerUp"
        :get-annotations="getAnnotations"
        :get-draft-annotation="getDraftAnnotation"
        :is-view-loading="viewer.isViewLoading.value"
        :scroll-threshold="scrollDragThreshold"
        @active-viewport-change="handleCompareActiveViewportChange"
        @copy-annotation="handleAnnotationCopy"
        @delete-annotation="handleAnnotationDelete"
        @hover-viewport-change="viewer.handleHoverViewportChange"
        @measurement-create="viewer.handleMeasurementCreate"
        @update-annotation-color="handleAnnotationColorUpdate"
        @update-annotation-size="handleAnnotationSizeUpdate"
        @update-annotation-text="handleAnnotationTextUpdate"
        @viewport-drag="viewer.handleViewportDrag"
        @viewport-wheel="viewer.handleViewportWheel"
        @workspace-ready="viewer.setViewerStage"
      />

      <MobileVolumeViewport
        v-else-if="activeVolumeTab"
        :active-operation="viewer.activeOperation.value"
        :active-tab="viewer.activeTab.value"
        @active-viewport-change="viewer.setActiveViewportKey"
        @viewport-drag="viewer.handleViewportDrag"
        @workspace-ready="viewer.setViewerStage"
      />

      <MobileMprViewport
        v-else-if="activeMprLikeTab"
        :active-mpr-viewport-key="activeMprViewportKey"
        :active-operation="viewer.activeOperation.value"
        :active-tab="viewer.activeTab.value"
        :annotation-pointer-cancel="handleAnnotationPointerCancel"
        :annotation-pointer-down="handleAnnotationPointerDown"
        :annotation-pointer-leave="handleAnnotationPointerLeave"
        :annotation-pointer-move="handleAnnotationPointerMove"
        :annotation-pointer-up="handleAnnotationPointerUp"
        :get-annotations="getAnnotations"
        :get-draft-annotation="getDraftAnnotation"
        :get-mtf-items="getViewportMtfItems"
        :is-view-loading="viewer.isViewLoading.value"
        :scroll-threshold="scrollDragThreshold"
        :selected-mtf-id="selectedMtfId"
        :show-reference-thumbnails="mprShowReferenceThumbnails"
        @active-viewport-change="handleMprActiveViewportChange"
        @copy-annotation="handleAnnotationCopy"
        @copy-selected-mtf="handleCopySelectedMtf"
        @delete-annotation="handleAnnotationDelete"
        @clear-mtf="handleDeleteSelectedMtf"
        @hover-viewport-change="viewer.handleHoverViewportChange"
        @measurement-create="viewer.handleMeasurementCreate"
        @mtf-commit="viewer.handleMtfCommit"
        @mpr-crosshair="viewer.handleMprCrosshair"
        @open-mtf-curve="handleOpenMtfCurve"
        @select-mtf="handleSelectMtf"
        @update-annotation-color="handleAnnotationColorUpdate"
        @update-annotation-size="handleAnnotationSizeUpdate"
        @update-annotation-text="handleAnnotationTextUpdate"
        @viewport-drag="viewer.handleViewportDrag"
        @viewport-wheel="viewer.handleViewportWheel"
        @workspace-ready="viewer.setViewerStage"
      />

      <section v-else-if="activeTagTab" class="mobile-shell__tag-view" data-testid="mobile-tag-view">
        <div class="mobile-shell__tag-header">
          <div>
            <strong>DICOM Tag</strong>
            <span>{{ (activeTagTab.tagIndex ?? 0) + 1 }} / {{ Math.max(1, activeTagTab.tagTotal ?? 1) }}</span>
          </div>
          <div class="mobile-shell__tag-pager">
            <button type="button" :disabled="(activeTagTab.tagIndex ?? 0) <= 0" @click="moveTagIndex(-1)">
              <AppIcon name="chevron-left" :size="17" />
            </button>
            <button type="button" :disabled="(activeTagTab.tagIndex ?? 0) >= Math.max(1, activeTagTab.tagTotal ?? 1) - 1" @click="moveTagIndex(1)">
              <AppIcon name="chevron-right" :size="17" />
            </button>
            <button type="button" data-testid="mobile-close-tag" @click="closeActiveTagView">
              <AppIcon name="close" :size="17" />
            </button>
          </div>
        </div>
        <div class="mobile-shell__tag-search">
          <AppIcon name="search" :size="16" />
          <input
            v-model="tagSearchQuery"
            data-testid="mobile-tag-search"
            type="search"
            :placeholder="isZh ? '搜索 Tag、名称、VR 或值' : 'Search tag, name, VR, or value'"
          />
          <button v-if="tagSearchQuery" type="button" data-testid="mobile-tag-search-clear" @click="tagSearchQuery = ''">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
        <div v-if="activeTagTab.tagIsLoading" class="mobile-shell__tag-empty">{{ isZh ? '正在加载标签...' : 'Loading tags...' }}</div>
        <div v-else-if="activeTagTab.tagLoadError" class="mobile-shell__tag-empty">{{ activeTagTab.tagLoadError }}</div>
        <div v-else-if="!filteredTagItems.length" class="mobile-shell__tag-empty">
          {{ tagSearchQuery ? (isZh ? '没有匹配的 Tag' : 'No matching tags') : (isZh ? '暂无 Tag' : 'No tags') }}
        </div>
        <div v-else class="mobile-shell__tag-list">
          <div v-for="item in filteredTagItems" :key="`${item.tag}-${item.keyword}-${item.name}`" class="mobile-shell__tag-row">
            <span>{{ item.tag }}</span>
            <strong>{{ item.keyword || item.name || '--' }}</strong>
            <small>{{ item.vr || '--' }}</small>
            <p>{{ item.value || '--' }}</p>
          </div>
        </div>
      </section>

      <div v-if="!activeImageTab && !activeTagTab" class="mobile-shell__empty">
        <div class="mobile-shell__empty-panel">
          <div class="mobile-shell__empty-mark" :class="connectionToneClass">
            <AppIcon :name="connectionIcon" :size="28" />
          </div>
          <div class="mobile-shell__empty-title">{{ isZh ? '加载影像' : 'Load Images' }}</div>
          <div class="mobile-shell__source-actions">
            <button
              type="button"
              class="mobile-shell__source-action mobile-shell__source-action--primary"
              data-testid="mobile-load-demo"
              :disabled="!canLoadDemo || isLoadingDemo"
              @click="loadDemoSeries"
            >
              <AppIcon :name="isLoadingDemo ? 'connecting' : 'play'" :size="18" />
              <span>{{ isLoadingDemo ? (isZh ? '正在加载...' : 'Loading...') : (isZh ? 'Demo 影像' : 'Demo') }}</span>
            </button>
            <button
              type="button"
              class="mobile-shell__source-action"
              data-testid="mobile-load-local"
              :disabled="!canLoadLocal || isLoadingLocal"
              @click="loadLocalFolder"
            >
              <AppIcon :name="isLoadingLocal ? 'connecting' : 'folder-upload'" :size="18" />
              <span>{{ isLoadingLocal ? (isZh ? '正在加载...' : 'Loading...') : (isZh ? '本地文件夹' : 'Local Folder') }}</span>
            </button>
            <button
              type="button"
              class="mobile-shell__source-action"
              data-testid="mobile-open-pacs"
              :disabled="!canOpenPacs"
              @click="isPacsBrowserOpen = true"
            >
              <AppIcon name="pacs" :size="18" />
              <span>PACS</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="fourDPlaybackStarting" class="mobile-shell__playback-loading" role="status" data-testid="mobile-four-d-loading">
        <AppIcon name="connecting" :size="18" />
        <span>{{ isZh ? '正在准备 4D 播放...' : 'Preparing 4D playback...' }}</span>
      </div>
    </main>

    <section
      v-if="showSlicePanel"
      class="mobile-shell__slice-panel"
      :class="{
        'mobile-shell__slice-panel--mpr': activeMprLikeTab,
        'mobile-shell__slice-panel--stack': activeStackTab
      }"
      aria-label="Slice navigation"
    >
      <div v-if="activeMprLikeTab" class="mobile-shell__plane-tabs" data-testid="mobile-mpr-plane-tabs">
        <button
          v-for="viewport in MPR_VIEWPORT_OPTIONS"
          :key="viewport.key"
          type="button"
          :class="{ active: activeMprViewportKey === viewport.key }"
          :data-testid="`mobile-mpr-plane-${viewport.key}`"
          @click="selectMprViewport(viewport.key)"
        >
          {{ viewport.label }}
        </button>
      </div>
      <div v-if="activeFourDTab" class="mobile-shell__four-d-phase" data-testid="mobile-four-d-phase-panel">
        <div class="mobile-shell__four-d-copy">
          <span>4D Phase</span>
          <strong>{{ fourDPhaseLabel }}</strong>
        </div>
        <input
          class="mobile-shell__phase-range"
          data-testid="mobile-four-d-phase-range"
          type="range"
          min="1"
          :max="fourDPhaseCount"
          step="1"
          :value="fourDPhaseSliderValue"
          :disabled="fourDPhaseCount <= 1 || isPlayingFourD || fourDPlaybackStarting"
          @change="handleFourDPhaseSliderInput"
          @input="handleFourDPhaseSliderInput"
        />
      </div>
      <div class="mobile-shell__slice-copy">
        <span>{{ isZh ? '切片' : 'Slice' }}</span>
        <strong>{{ activeSliceLabel }}</strong>
      </div>
      <input
        class="mobile-shell__slice-range"
        data-testid="mobile-slice-range"
        type="range"
        min="1"
        :max="activeSlice?.total ?? 1"
        step="1"
        :value="sliceSliderValue"
        :disabled="!activeSlice"
        @change="handleSliceSliderCommit"
        @input="handleSliceSliderInput"
        @pointercancel="finishSliceSliderInteraction"
        @pointerdown="beginSliceSliderInteraction"
        @pointerup="finishSliceSliderInteraction"
      />
      <span v-if="showSlicePlayButton || activeStackTab" class="mobile-shell__slice-actions">
        <button
          v-if="activeStackTab"
          type="button"
          class="mobile-shell__slice-icon-button mobile-shell__slice-star"
          :class="{ 'mobile-shell__slice-star--active': isCurrentStackSliceStarred }"
          data-testid="mobile-toggle-star"
          :aria-label="isCurrentStackSliceStarred ? (isZh ? '取消收藏当前切片' : 'Unstar current slice') : (isZh ? '收藏当前切片' : 'Star current slice')"
          :aria-pressed="isCurrentStackSliceStarred"
          :disabled="!activeStackSlice"
          @click="toggleStackStarForCurrentSlice"
        >
          <AppIcon :name="isCurrentStackSliceStarred ? 'star' : 'star-outline'" :size="20" />
        </button>
        <button
          v-if="showSlicePlayButton"
          type="button"
          class="mobile-shell__slice-icon-button mobile-shell__slice-play"
          :class="{ 'mobile-shell__slice-play--active': activeFourDTab ? (isPlayingFourD || fourDPlaybackStarting) : isPlayingActiveSlicePlayback }"
          data-testid="mobile-slice-play"
          :aria-label="activePlayLabel"
          :disabled="!canPlayActive || fourDPlaybackStarting"
          @click="toggleActivePlayback"
        >
          <AppIcon :name="activePlayIcon" :size="20" />
        </button>
      </span>
    </section>

    <nav v-if="activeImageTab" class="mobile-shell__toolbar" aria-label="Mobile viewer tools">
      <div class="mobile-shell__toolbar-row" :style="{ gridTemplateColumns: `repeat(${primaryMobileTools.length}, minmax(0, 1fr))` }">
        <button
          v-for="tool in primaryMobileTools"
          :key="`primary-${tool.key}`"
          type="button"
          class="mobile-shell__tool"
          :class="{ 'mobile-shell__tool--active': isToolbarItemActive(tool) }"
          :disabled="isToolbarItemDisabled(tool)"
          :data-testid="`mobile-tool-${tool.key}`"
          @click="handleToolbarItem(tool)"
        >
          <AppIcon :name="tool.icon" :size="18" />
          <span>{{ tool.label }}</span>
        </button>
      </div>
      <div class="mobile-shell__toolbar-row" :style="{ gridTemplateColumns: `repeat(${secondaryMobileTools.length}, minmax(0, 1fr))` }">
        <button
          v-for="tool in secondaryMobileTools"
          :key="`secondary-${tool.key}`"
          type="button"
          class="mobile-shell__tool"
          :class="{ 'mobile-shell__tool--active': isToolbarItemActive(tool) }"
          :disabled="isToolbarItemDisabled(tool)"
          :data-testid="tool.key === 'more' ? 'mobile-more-button' : `mobile-tool-${tool.key}`"
          @click="handleToolbarItem(tool)"
        >
          <AppIcon :name="tool.icon" :size="18" />
          <span>{{ tool.label }}</span>
        </button>
      </div>
    </nav>

    <div v-if="activeSheetKind" class="mobile-shell__sheet-backdrop" @click.self="closeSheet">
      <section class="mobile-shell__sheet" aria-label="Mobile tools">
        <div class="mobile-shell__sheet-handle" aria-hidden="true"></div>
        <div class="mobile-shell__sheet-header">
          <div>
            <div class="mobile-shell__sheet-title">{{ sheetTitle }}</div>
          </div>
          <button type="button" class="mobile-shell__sheet-close" @click="closeSheet">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
        <div v-if="showSheetTabBar" class="mobile-shell__sheet-tabs" role="tablist" aria-label="Mobile quick tools">
          <button
            v-for="tab in mobileSheetTabs"
            :key="tab.key"
            type="button"
            class="mobile-shell__sheet-tab"
            :class="{ 'mobile-shell__sheet-tab--active': activeSheetKind === tab.key }"
            :data-testid="`mobile-sheet-tab-${tab.key}`"
            @click="openMenuSheet(tab.key)"
          >
            <AppIcon :name="tab.icon" :size="15" />
            <span>{{ tab.label }}</span>
          </button>
        </div>
        <div class="mobile-shell__sheet-content">
          <div v-if="activeSheetKind === 'series'" class="mobile-shell__series-list">
            <div
              v-for="series in mobileSeriesList"
              :key="series.seriesId"
              class="mobile-shell__series-row"
              :class="{ 'mobile-shell__series-row--active': viewer.selectedSeriesId.value === series.seriesId }"
              @click="selectSeriesForActions(series.seriesId)"
            >
              <span class="mobile-shell__series-modality">{{ series.modality || 'DICOM' }}</span>
              <span class="mobile-shell__series-body">
                <span class="mobile-shell__series-title">{{ series.seriesDescription || series.seriesId }}</span>
                <span class="mobile-shell__series-meta">{{ formatSeriesMeta(series) }}</span>
              </span>
              <span v-if="isSeriesSelected(series.seriesId)" class="mobile-shell__series-actions" @click.stop>
                <button
                  v-if="isSeriesActionSupported(series, 'Stack')"
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isSeriesViewActive(series.seriesId, 'Stack') }"
                  data-testid="mobile-open-stack"
                  :data-active="isSeriesViewActive(series.seriesId, 'Stack')"
                  @click="openSeriesStack(series.seriesId)"
                >
                  Stack
                </button>
                <button
                  v-if="canStartCompareFromSeries(series)"
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isSeriesCompareActive(series.seriesId) }"
                  data-testid="mobile-open-compare"
                  :data-active="isSeriesCompareActive(series.seriesId)"
                  @click="openComparePicker(series.seriesId)"
                >
                  Compare
                </button>
                <button
                  v-if="isSeriesActionSupported(series, 'MPR')"
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isSeriesViewActive(series.seriesId, 'MPR') }"
                  data-testid="mobile-open-mpr"
                  :data-active="isSeriesViewActive(series.seriesId, 'MPR')"
                  @click="openSeriesMpr(series.seriesId)"
                >
                  MPR
                </button>
                <button
                  v-if="isSeriesActionSupported(series, '3D')"
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isSeriesViewActive(series.seriesId, '3D') }"
                  data-testid="mobile-open-3d"
                  :data-active="isSeriesViewActive(series.seriesId, '3D')"
                  @click="openSeriesVolume(series.seriesId)"
                >
                  3D
                </button>
                <button
                  v-if="isSeriesActionSupported(series, '4D')"
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isSeriesViewActive(series.seriesId, '4D') }"
                  data-testid="mobile-open-4d"
                  :data-active="isSeriesViewActive(series.seriesId, '4D')"
                  @click="openSeriesFourD(series.seriesId)"
                >
                  4D
                </button>
              </span>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'favorites'" class="mobile-shell__favorite-panel">
            <div class="mobile-shell__favorite-summary" data-testid="mobile-favorites-summary">
              <span>{{ isZh ? '已收藏' : 'Saved' }}</span>
              <strong>{{ favoriteSliceCount }}</strong>
            </div>
            <div v-if="!favoriteSliceItems.length" class="mobile-shell__empty-inline" data-testid="mobile-favorites-empty">
              {{ isZh ? '还没有收藏的 DICOM 切片' : 'No favorite DICOM slices yet' }}
            </div>
            <div v-else class="mobile-shell__action-list">
              <div
                v-for="item in favoriteSliceItems"
                :key="`${item.seriesId}-${item.sliceIndex}`"
                class="mobile-shell__favorite-row"
                data-testid="mobile-favorite-slice"
              >
                <button
                  type="button"
                  class="mobile-shell__favorite-open"
                  :disabled="!canOpenFavoriteSlice(item)"
                  data-testid="mobile-open-favorite-slice"
                  @click="openFavoriteSlice(item)"
                >
                  <AppIcon name="star" :size="18" />
                  <span>
                    <strong>{{ getFavoriteSliceTitle(item) }}</strong>
                    <small>{{ getFavoriteSliceMeta(item) }}</small>
                  </span>
                </button>
                <button
                  type="button"
                  class="mobile-shell__favorite-remove"
                  :aria-label="isZh ? '取消收藏' : 'Remove favorite'"
                  data-testid="mobile-remove-favorite-slice"
                  @click="removeFavoriteSlice(item)"
                >
                  <AppIcon name="trash" :size="16" />
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'window'" class="mobile-shell__window-panel">
            <section class="mobile-shell__window-section">
              <div class="mobile-shell__window-subhead">{{ isZh ? '系统预设' : 'System Presets' }}</div>
              <div class="mobile-shell__action-list mobile-shell__window-system-list">
                <button
                  v-for="preset in systemWindowPresets"
                  :key="preset.id"
                  type="button"
                  class="mobile-shell__action-row"
                  :class="{ 'mobile-shell__action-row--active': selectedWindowPresetId === preset.id }"
                  data-testid="mobile-window-preset"
                  @click="applyWindowPreset(preset)"
                >
                  <span class="mobile-shell__swatch" :style="{ background: preset.accent }" aria-hidden="true"></span>
                  <span>
                    <strong>{{ getWindowPresetLabel(preset) }}</strong>
                    <small>{{ formatWindowPresetDetail(preset) }}</small>
                  </span>
                </button>
              </div>
            </section>

            <section class="mobile-shell__window-section">
              <div class="mobile-shell__window-subhead-row">
                <span class="mobile-shell__window-subhead">{{ isZh ? '我的预设' : 'My Presets' }}</span>
                <span class="mobile-shell__window-limit">{{ customPresetLimitLabel }}</span>
              </div>
              <div class="mobile-shell__window-actions">
                <button
                  type="button"
                  class="mobile-shell__window-action"
                  :disabled="!displayCustomWindowPresets.length"
                  data-testid="mobile-window-select-all"
                  @click="toggleAllCustomPresetSelection"
                >
                  {{ areAllCustomPresetsSelected ? (isZh ? '取消全选' : 'Clear') : (isZh ? '全选' : 'Select All') }}
                </button>
                <button
                  type="button"
                  class="mobile-shell__window-action"
                  :disabled="!hasSelectedCustomPresets"
                  data-testid="mobile-window-remove-selected"
                  @click="handleRemoveSelectedCustomWindowPresets"
                >
                  {{ isZh ? '删除选中' : 'Remove Selected' }}
                </button>
              </div>
              <div v-if="displayCustomWindowPresets.length" class="mobile-shell__action-list">
                <div
                  v-for="preset in displayCustomWindowPresets"
                  :key="preset.id"
                  class="mobile-shell__custom-preset-row"
                  :class="{
                    'mobile-shell__custom-preset-row--active': selectedWindowPresetId === preset.id,
                    'mobile-shell__custom-preset-row--selected': selectedCustomPresetIdSet.has(preset.id)
                  }"
                >
                  <button
                    type="button"
                    class="mobile-shell__custom-preset-check"
                    :aria-pressed="selectedCustomPresetIdSet.has(preset.id)"
                    data-testid="mobile-window-custom-select"
                    @click.stop="toggleCustomPresetSelection(preset.id)"
                  >
                    <AppIcon v-if="selectedCustomPresetIdSet.has(preset.id)" name="check" :size="14" />
                  </button>
                  <button
                    type="button"
                    class="mobile-shell__custom-preset-main"
                    data-testid="mobile-window-custom-preset"
                    @click="applyWindowPreset(preset)"
                  >
                    <span class="mobile-shell__swatch" :style="{ background: preset.accent }" aria-hidden="true"></span>
                    <span>
                      <strong>{{ getWindowPresetLabel(preset) }}</strong>
                      <small>{{ formatWindowPresetDetail(preset) }}</small>
                    </span>
                  </button>
                </div>
              </div>
              <div v-else class="mobile-shell__empty-inline" data-testid="mobile-window-custom-empty">
                {{ isZh ? '还没有自定义窗模板' : 'No custom window templates yet' }}
              </div>
            </section>

            <section class="mobile-shell__window-section">
              <div class="mobile-shell__window-subhead-row">
                <span class="mobile-shell__window-subhead">{{ isZh ? '新增自定义窗模板' : 'Add Custom Template' }}</span>
                <span class="mobile-shell__window-limit">{{ customPresetLimitLabel }}</span>
              </div>
              <div class="mobile-shell__window-form">
                <label class="mobile-shell__window-field">
                  <span>{{ isZh ? '中文名称' : 'Chinese Name' }}</span>
                  <input v-model="customPresetZhName" type="text" :disabled="!canAddCustomWindowPreset" data-testid="mobile-window-custom-zh" />
                </label>
                <label class="mobile-shell__window-field">
                  <span>{{ isZh ? '英文名称' : 'English Name' }}</span>
                  <input v-model="customPresetEnName" type="text" :disabled="!canAddCustomWindowPreset" data-testid="mobile-window-custom-en" />
                </label>
                <label class="mobile-shell__window-field">
                  <span>{{ isZh ? '窗宽 WW' : 'Window Width' }}</span>
                  <input v-model="customPresetWw" type="number" :disabled="!canAddCustomWindowPreset" data-testid="mobile-window-custom-ww" />
                </label>
                <label class="mobile-shell__window-field">
                  <span>{{ isZh ? '窗位 WL' : 'Window Level' }}</span>
                  <input v-model="customPresetWl" type="number" :disabled="!canAddCustomWindowPreset" data-testid="mobile-window-custom-wl" />
                </label>
              </div>
              <p v-if="!canAddCustomWindowPreset" class="mobile-shell__window-hint">
                {{ isZh ? `最多只能保留 ${MAX_CUSTOM_WINDOW_PRESETS} 个自定义模板。` : `Up to ${MAX_CUSTOM_WINDOW_PRESETS} custom templates can be saved.` }}
              </p>
              <button
                type="button"
                class="mobile-shell__window-submit"
                :disabled="!canAddCustomWindowPreset"
                data-testid="mobile-window-add-custom"
                @click="handleAddCustomWindowPreset"
              >
                {{ isZh ? '添加模板' : 'Add Template' }}
              </button>
            </section>
          </div>

          <div v-else-if="activeSheetKind === 'display'" class="mobile-shell__action-list">
            <button
              v-for="option in displayOverlayOptions"
              :key="option.key"
              type="button"
              class="mobile-shell__display-row"
              :data-testid="`mobile-display-${option.key}`"
              @click="toggleDisplayOverlay(option.key)"
            >
              <span class="mobile-shell__display-leading">
                <AppIcon :name="option.icon" :size="18" />
                <span>{{ option.label }}</span>
              </span>
              <span class="mobile-shell__switch" :class="{ 'mobile-shell__switch--on': option.enabled }" aria-hidden="true">
                <span></span>
              </span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'color'" class="mobile-shell__action-list">
            <template v-if="activeVolumeTab">
              <button
                v-for="option in VOLUME_RENDER_MODE_OPTIONS"
                :key="option.value"
                type="button"
                class="mobile-shell__action-row"
                :class="{ 'mobile-shell__action-row--active': activeVolumeRenderModeValue === option.value }"
                data-testid="mobile-volume-render-mode"
                @click="applyVolumeRenderMode(option.value)"
              >
                <AppIcon :name="option.icon" :size="18" />
                <span>
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.detail }}</small>
                </span>
              </button>
              <button
                v-for="option in VOLUME_PRESET_OPTIONS"
                :key="option.value"
                type="button"
                class="mobile-shell__action-row"
                :class="{ 'mobile-shell__action-row--active': activeVolumePresetValue === option.value }"
                data-testid="mobile-volume-preset"
                @click="applyVolumePreset(option.value)"
              >
                <AppIcon :name="option.icon" :size="18" />
                <span><strong>{{ option.label }}</strong></span>
              </button>
            </template>
            <template v-else>
              <button
                v-for="preset in PSEUDOCOLOR_PRESET_OPTIONS"
                :key="preset.key"
                type="button"
                class="mobile-shell__action-row"
                :class="{ 'mobile-shell__action-row--active': selectedPseudocolorKey === preset.key }"
                data-testid="mobile-pseudocolor"
                @click="applyPseudocolor(`pseudocolor:${preset.key}`)"
              >
                <span class="mobile-shell__swatch" :style="{ background: getPseudocolorGradient(preset.key) }" aria-hidden="true"></span>
                <span>
                  <strong>{{ preset.label }}</strong>
                  <small>{{ preset.key }}</small>
                </span>
              </button>
            </template>
          </div>

          <div v-else-if="activeSheetKind === 'transform'" class="mobile-shell__action-list">
            <button
              v-for="option in TRANSFORM_OPTIONS"
              :key="option.value"
              type="button"
              class="mobile-shell__action-row"
              data-testid="mobile-transform"
              @click="applyTransform(option.value)"
            >
              <AppIcon :name="option.icon" :size="18" />
              <span><strong>{{ isZh ? option.zh : option.en }}</strong></span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'playback'" class="mobile-shell__action-list">
            <button type="button" class="mobile-shell__action-row" data-testid="mobile-playback-toggle" :disabled="!canPlayActive" @click="toggleActivePlayback">
              <AppIcon :name="activeFourDTab ? (isPlayingFourD ? 'pause' : 'play') : (isPlayingActiveSlicePlayback ? 'pause' : 'play')" :size="18" />
              <span><strong>{{ isPlayingActiveSlicePlayback || isPlayingFourD ? (isZh ? '暂停播放' : 'Pause') : (isZh ? '开始播放' : 'Play') }}</strong></span>
            </button>
            <div class="mobile-shell__fps-control" data-testid="mobile-playback-fps-control">
              <div class="mobile-shell__fps-copy">
                <span>{{ isZh ? '播放速度' : 'Speed' }}</span>
                <strong>{{ activePlaybackFpsLabel }}</strong>
              </div>
              <input
                class="mobile-shell__fps-range"
                data-testid="mobile-playback-fps-slider"
                type="range"
                min="0"
                :max="MOBILE_STACK_PLAYBACK_FPS_OPTIONS.length - 1"
                step="1"
                :value="activePlaybackFpsIndex"
                :disabled="!canPlayActive"
                @change="handlePlaybackFpsSliderInput"
                @input="handlePlaybackFpsSliderInput"
              />
              <div class="mobile-shell__fps-ticks" aria-hidden="true">
                <span v-for="fps in MOBILE_STACK_PLAYBACK_FPS_OPTIONS" :key="fps">{{ fps }}</span>
              </div>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'compare'" class="mobile-shell__action-list">
            <template v-if="activeCompareTab">
              <button
                v-for="option in compareSyncOptions"
                :key="option.key"
                type="button"
                class="mobile-shell__display-row"
                data-testid="mobile-compare-sync"
                @click="toggleCompareSync(option.key)"
              >
                <span class="mobile-shell__display-leading">
                  <AppIcon :name="option.icon" :size="18" />
                  <span>
                    <strong>{{ option.label }}</strong>
                    <small>{{ option.description }}</small>
                  </span>
                </span>
                <span class="mobile-shell__switch" :class="{ 'mobile-shell__switch--on': option.enabled }" aria-hidden="true">
                  <span></span>
                </span>
              </button>
            </template>
            <template v-else>
              <div v-if="compareSourceSeries" class="mobile-shell__compare-source">
                <span>{{ isZh ? '源序列' : 'Source' }}</span>
                <strong>{{ compareSourceSeries.seriesDescription || compareSourceSeries.seriesId }}</strong>
              </div>
              <button
                v-for="series in compareCandidateSeries"
                :key="series.seriesId"
                type="button"
                class="mobile-shell__action-row"
                data-testid="mobile-compare-target"
                @click="openSeriesCompareTo(series.seriesId)"
              >
                <span class="mobile-shell__series-modality">{{ series.modality || 'DICOM' }}</span>
                <span>
                  <strong>{{ series.seriesDescription || series.seriesId }}</strong>
                  <small>{{ formatSeriesMeta(series) }}</small>
                </span>
              </button>
              <div v-if="!compareCandidateSeries.length" class="mobile-shell__empty-inline" data-testid="mobile-compare-empty">
                {{ isZh ? '没有可用于对比的其它影像序列' : 'No other image series can be compared.' }}
              </div>
            </template>
          </div>

          <div v-else-if="activeSheetKind === 'mpr'" class="mobile-shell__action-list">
            <div class="mobile-shell__plane-grid">
              <button
                v-for="viewport in MPR_VIEWPORT_OPTIONS"
                :key="viewport.key"
                type="button"
                :class="{ active: activeMprViewportKey === viewport.key }"
                data-testid="mobile-mpr-sheet-plane"
                @click="selectMprViewport(viewport.key)"
              >
                <strong>{{ viewport.label }}</strong>
                <small>{{ viewport.desc }}</small>
              </button>
            </div>
            <button type="button" class="mobile-shell__action-row" data-testid="mobile-mpr-reset" @click="handleResetView">
              <AppIcon name="reset" :size="18" />
              <span><strong>{{ isZh ? '重置当前平面' : 'Reset Plane' }}</strong></span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'measure'" class="mobile-shell__action-list">
            <button
              v-for="tool in MOBILE_MEASUREMENT_TOOLS"
              :key="tool.toolType"
              type="button"
              class="mobile-shell__action-row"
              :class="{ 'mobile-shell__action-row--active': viewer.activeOperation.value === `measure:${tool.toolType}` }"
              :data-testid="`mobile-measure-${tool.toolType}`"
              @click="setActiveMeasurementTool(tool.toolType)"
            >
              <AppIcon :name="tool.icon" :size="18" />
              <span>
                <strong>{{ isZh ? tool.zh : tool.en }}</strong>
                <small>{{ isZh ? tool.hintZh : tool.hintEn }}</small>
              </span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'qa'" class="mobile-shell__action-list">
            <button
              v-for="tool in MOBILE_QA_TOOLS"
              :key="tool.value"
              type="button"
              class="mobile-shell__action-row"
              :class="{ 'mobile-shell__action-row--active': viewer.activeOperation.value === `${STACK_OPERATION_PREFIX}${tool.value}` }"
              data-testid="mobile-qa-tool"
              :disabled="!activeStackTab"
              @click="applyQaTool(tool.value)"
            >
              <AppIcon :name="tool.icon" :size="18" />
              <span>
                <strong>{{ isZh ? tool.zh : tool.en }}</strong>
                <small>{{ isZh ? tool.detailZh : tool.detailEn }}</small>
              </span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'export'" class="mobile-shell__action-list">
            <button
              v-for="option in mobileExportOptions"
              :key="option.value"
              type="button"
              class="mobile-shell__action-row"
              data-testid="mobile-export-format"
              @click="exportActiveView(option.value)"
            >
              <AppIcon :name="option.icon" :size="18" />
              <span>
                <strong>{{ isZh ? option.zh : option.en }}</strong>
                <small>{{ isZh ? option.detailZh : option.detailEn }}</small>
              </span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'volumeParams'" class="mobile-shell__volume-params" data-testid="mobile-volume-params">
            <VolumeRenderConfigPanel
              :config="activeVolumeRenderConfig"
              @close="closeSheet"
              @config-change="viewer.handleVolumeConfigChange"
            />
          </div>

          <div v-else-if="activeSheetKind === 'reset'" class="mobile-shell__action-list">
            <button
              v-for="option in mobileResetOptions"
              :key="option.value"
              type="button"
              class="mobile-shell__action-row"
              data-testid="mobile-reset-option"
              @click="applyResetOption(option.value)"
            >
              <AppIcon :name="option.icon" :size="18" />
              <span><strong>{{ isZh ? option.zh : option.en }}</strong></span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'tag'" class="mobile-shell__action-list">
            <button type="button" class="mobile-shell__action-row" data-testid="mobile-open-tag" :disabled="!canOpenTag || !activeSeriesId" @click="openActiveSeriesTag">
              <AppIcon name="tag" :size="18" />
              <span>
                <strong>{{ isZh ? '查看 DICOM Tag' : 'View DICOM Tags' }}</strong>
                <small>{{ isZh ? '只读查看当前序列实例标签' : 'Read-only tags for the active series' }}</small>
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <div
      v-if="viewer.statusToast.value"
      class="mobile-shell__toast"
      :data-tone="viewer.statusToast.value.tone"
      role="status"
      aria-live="polite"
    >
      <span class="mobile-shell__toast-message">{{ viewer.statusToast.value.message }}</span>
      <button type="button" class="mobile-shell__toast-close" @click="viewer.dismissStatusToast">
        <AppIcon name="close" :size="14" />
      </button>
    </div>

    <MtfCurveDialog
      :is-open="isMtfCurveDialogOpen"
      :mtf-item="selectedMtfItem"
      @close="handleCloseMtfCurve"
    />

    <WorkspaceExportNameDialog
      v-if="isExportNameDialogOpen"
      v-model="exportNameInput"
      v-model:input-ref="exportNameInputRef"
      :copy="workspaceExportCopy"
      :error="exportNameError"
      :extension="exportNameExtension"
      :format="exportNameDialogFormat"
      @cancel="cancelExportNameDialog"
      @confirm="confirmExportNameDialog"
    />

    <WorkspaceExportNotice
      v-if="exportNotice"
      :copy="workspaceExportCopy"
      :notice="exportNotice"
      @close="exportNotice = null"
      @open-location="handleOpenExportLocation"
    />

    <MobileSettingsOverlay :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
    <PacsBrowserDialog
      :is-open="isPacsBrowserOpen"
      :loaded-series-list="viewer.seriesList.value"
      @close="isPacsBrowserOpen = false"
      @series-loaded="handlePacsSeriesLoaded"
    />
  </div>
</template>

<style scoped>
.mobile-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  height: 100dvh;
  overflow: hidden;
  background: var(--theme-app-background);
  color: var(--theme-text-primary);
  touch-action: none;
}

.mobile-shell--orientation-landscape {
  --mobile-orientation-lock: landscape;
}

.mobile-shell--orientation-portrait {
  --mobile-orientation-lock: portrait;
}

.mobile-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 62px;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 90%, transparent);
  backdrop-filter: blur(18px);
}

.mobile-shell__title-group {
  display: block;
  min-width: 0;
  flex: 1 1 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.mobile-shell__eyebrow {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
}

.mobile-shell__title {
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.mobile-shell__icon-button,
.mobile-shell__sheet-close,
.mobile-shell__toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 42px;
  height: 40px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 86%, transparent);
  color: var(--theme-text-primary);
}

.mobile-shell__icon-button:disabled,
.mobile-shell__tool:disabled,
.mobile-shell__primary-action:disabled,
.mobile-shell__source-action:disabled,
.mobile-shell__action-row:disabled {
  opacity: 0.48;
}

.mobile-shell__icon-button--active {
  border-color: color-mix(in srgb, var(--theme-accent) 62%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-surface-card));
  color: var(--theme-accent);
}

.mobile-shell__connection--connected {
  border-color: color-mix(in srgb, #36d982 62%, var(--theme-border-strong));
  color: #36d982;
}

.mobile-shell__connection--connecting {
  border-color: color-mix(in srgb, #f4b84a 62%, var(--theme-border-strong));
  color: #f4b84a;
}

.mobile-shell__connection--disconnected {
  border-color: color-mix(in srgb, #f87171 62%, var(--theme-border-strong));
  color: #f87171;
}

.mobile-shell__viewer {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.mobile-shell__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  pointer-events: none;
}

.mobile-shell__empty-panel {
  width: min(100%, 320px);
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 94%, transparent);
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.34);
  padding: 20px;
  text-align: center;
  pointer-events: auto;
}

.mobile-shell__empty-mark {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin: 0 auto 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-accent);
}

.mobile-shell__empty-title {
  font-size: 19px;
  font-weight: 900;
}

.mobile-shell__playback-loading {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
  border: 1px solid color-mix(in srgb, var(--theme-accent) 50%, var(--theme-border-strong));
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 92%, transparent);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.32);
  color: var(--theme-text-primary);
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 900;
  pointer-events: none;
}

.mobile-shell__primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  margin-top: 18px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 54%, var(--theme-border-strong));
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 78%, #101620);
  color: var(--theme-accent-contrast);
  font-weight: 900;
}

.mobile-shell__source-actions {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}

.mobile-shell__source-action {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 46px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  padding: 6px 12px 6px 8px;
  text-align: left;
  font-weight: 900;
}

.mobile-shell__source-action > .app-icon,
.mobile-shell__source-action > :first-child {
  justify-self: center;
}

.mobile-shell__source-action span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__source-action--primary {
  border-color: color-mix(in srgb, var(--theme-accent) 54%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-shell__slice-panel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  padding-right: calc(12px + env(safe-area-inset-right, 0px));
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 64%, transparent);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 90%, transparent);
  backdrop-filter: blur(18px);
}

.mobile-shell__slice-panel--stack {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.mobile-shell__plane-tabs {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.mobile-shell__four-d-phase {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.mobile-shell__four-d-copy {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  min-width: 72px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
}

.mobile-shell__four-d-copy strong {
  color: var(--theme-text-primary);
  font-size: 13px;
}

.mobile-shell__phase-range {
  width: 100%;
  min-width: 0;
  accent-color: var(--theme-accent);
  touch-action: pan-x;
}

.mobile-shell__plane-tabs button,
.mobile-shell__plane-grid button {
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 80%, transparent);
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.mobile-shell__plane-tabs button.active,
.mobile-shell__plane-grid button.active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-shell__slice-copy {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  min-width: 58px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
}

.mobile-shell__slice-copy strong {
  color: var(--theme-text-primary);
  font-size: 13px;
}

.mobile-shell__slice-range {
  width: 100%;
  min-width: 0;
  accent-color: var(--theme-accent);
  touch-action: pan-x;
}

.mobile-shell__slice-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: max-content;
}

.mobile-shell__slice-icon-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-muted);
}

.mobile-shell__slice-star--active {
  border-color: color-mix(in srgb, var(--theme-accent-warm) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent-warm) 18%, var(--theme-surface-card));
  color: var(--theme-accent-warm);
}

.mobile-shell__slice-play--active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-accent);
}

.mobile-shell__slice-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.mobile-shell__toolbar {
  display: grid;
  gap: 7px;
  padding: 8px 10px calc(env(safe-area-inset-bottom, 0px) + 10px);
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 92%, transparent);
  backdrop-filter: blur(18px);
}

.mobile-shell__toolbar-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.mobile-shell__tool {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  min-height: 48px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 800;
}

.mobile-shell__tool--active {
  border-color: color-mix(in srgb, var(--theme-accent) 62%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-shell__sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.48);
  overscroll-behavior: contain;
}

.mobile-shell__sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: min(74dvh, 640px);
  max-height: min(74dvh, 640px);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 80%, transparent);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 96%, transparent);
  box-shadow: 0 -24px 60px rgba(0, 0, 0, 0.45);
  padding-right: env(safe-area-inset-right, 0px);
  isolation: isolate;
}

.mobile-shell__sheet-handle {
  width: 44px;
  height: 4px;
  margin: 7px auto 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-muted) 56%, transparent);
}

.mobile-shell__sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 12px 8px;
}

.mobile-shell__sheet-title {
  font-size: 17px;
  font-weight: 900;
  line-height: 1.15;
}

.mobile-shell__sheet-tabs {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 0 calc(10px + env(safe-area-inset-right, 0px)) 10px 10px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-shell__sheet-tabs::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.mobile-shell__sheet-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 78px;
  min-height: 38px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 80%, transparent);
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.mobile-shell__sheet-tab--active {
  border-color: color-mix(in srgb, var(--theme-accent) 62%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-shell__sheet-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0 10px 14px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-shell__sheet-content::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.mobile-shell__series-list,
.mobile-shell__action-list {
  display: grid;
  gap: 7px;
}

.mobile-shell__window-panel {
  display: grid;
  gap: 14px;
}

.mobile-shell__window-section {
  display: grid;
  gap: 8px;
}

.mobile-shell__window-system-list {
  max-height: min(32dvh, 260px);
  overflow: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.mobile-shell__window-subhead,
.mobile-shell__window-subhead-row {
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mobile-shell__window-subhead-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mobile-shell__window-limit {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 999px;
  padding: 2px 8px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.mobile-shell__window-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mobile-shell__window-action {
  min-height: 32px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 800;
  padding: 0 10px;
}

.mobile-shell__window-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.mobile-shell__custom-preset-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
}

.mobile-shell__custom-preset-row--active .mobile-shell__custom-preset-main {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 17%, var(--theme-surface-card));
}

.mobile-shell__custom-preset-row--selected .mobile-shell__custom-preset-check {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-accent);
}

.mobile-shell__custom-preset-check {
  display: grid;
  place-items: center;
  width: 38px;
  min-height: 54px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: transparent;
}

.mobile-shell__custom-preset-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 54px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  padding: 9px 10px;
  text-align: left;
}

.mobile-shell__window-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mobile-shell__window-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.mobile-shell__window-field span {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
}

.mobile-shell__window-field input {
  width: 100%;
  min-height: 40px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 88%, transparent);
  color: var(--theme-text-primary);
  font-size: 14px;
  padding: 0 10px;
}

.mobile-shell__window-field input:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.mobile-shell__window-hint {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.mobile-shell__window-submit {
  width: 100%;
  min-height: 42px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong));
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 22%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  font-size: 14px;
  font-weight: 900;
}

.mobile-shell__window-submit:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.mobile-shell__volume-params {
  display: flex;
  justify-content: center;
  padding: 4px 0 10px;
}

.mobile-shell__volume-params :deep(.theme-shell-panel) {
  width: 100%;
  max-width: min(100%, 420px);
  border-radius: 8px;
}

.mobile-shell__series-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  padding: 9px 10px;
}

.mobile-shell__series-row--active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 17%, var(--theme-surface-card));
}

.mobile-shell__series-modality {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 82%, transparent);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 900;
}

.mobile-shell__series-body {
  min-width: 0;
}

.mobile-shell__series-title,
.mobile-shell__series-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__series-title {
  font-size: 15px;
  font-weight: 900;
}

.mobile-shell__series-meta {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.mobile-shell__series-actions {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.mobile-shell__series-actions button {
  min-height: 36px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 86%, transparent);
  color: var(--theme-text-primary);
  font-weight: 900;
}

.mobile-shell__series-view-button--active {
  border-color: color-mix(in srgb, var(--theme-accent) 70%, var(--theme-border-strong)) !important;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 30%, transparent), transparent),
    color-mix(in srgb, var(--theme-accent) 24%, var(--theme-surface-card)) !important;
  color: var(--theme-text-primary) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 24%, transparent);
}

.mobile-shell__compare-source,
.mobile-shell__empty-inline {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
  color: var(--theme-text-secondary);
  padding: 10px 12px;
}

.mobile-shell__compare-source span,
.mobile-shell__compare-source strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__compare-source span {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
}

.mobile-shell__compare-source strong {
  margin-top: 2px;
  color: var(--theme-text-primary);
  font-size: 14px;
}

.mobile-shell__favorite-panel {
  display: grid;
  gap: 8px;
}

.mobile-shell__favorite-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: 44px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
  color: var(--theme-text-secondary);
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 900;
}

.mobile-shell__favorite-summary strong {
  color: var(--theme-accent-warm);
  font-size: 18px;
}

.mobile-shell__favorite-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  gap: 7px;
  align-items: stretch;
}

.mobile-shell__favorite-open,
.mobile-shell__favorite-remove {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
}

.mobile-shell__favorite-open {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-height: 56px;
  padding: 8px 10px;
  text-align: left;
}

.mobile-shell__favorite-open > .app-icon,
.mobile-shell__favorite-open > :first-child {
  justify-self: center;
  color: var(--theme-accent-warm);
}

.mobile-shell__favorite-open strong,
.mobile-shell__favorite-open small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__favorite-open small {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.mobile-shell__favorite-open:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.mobile-shell__favorite-remove {
  display: grid;
  place-items: center;
  color: var(--theme-text-muted);
}

.mobile-shell__empty-inline {
  text-align: center;
  font-size: 13px;
  font-weight: 800;
}

.mobile-shell__action-row,
.mobile-shell__display-row {
  display: grid;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  padding: 8px 10px;
  text-align: left;
}

.mobile-shell__action-row {
  grid-template-columns: 38px minmax(0, 1fr);
}

.mobile-shell__action-row--active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 17%, var(--theme-surface-card));
}

.mobile-shell__action-row strong,
.mobile-shell__action-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__action-row small {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.mobile-shell__swatch {
  display: block;
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  border-radius: 8px;
}

.mobile-shell__display-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.mobile-shell__display-leading {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 15px;
  font-weight: 900;
}

.mobile-shell__switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 42px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 88%, transparent);
}

.mobile-shell__switch span {
  width: 18px;
  height: 18px;
  margin-left: 3px;
  border-radius: 999px;
  background: var(--theme-text-muted);
  transition: transform 160ms ease, background 160ms ease;
}

.mobile-shell__switch--on {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 30%, var(--theme-surface-panel-solid));
}

.mobile-shell__switch--on span {
  transform: translateX(17px);
  background: var(--theme-accent);
}

.mobile-shell__plane-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.mobile-shell__fps-control {
  display: grid;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
  padding: 10px 11px 9px;
}

.mobile-shell__fps-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 900;
}

.mobile-shell__fps-copy strong {
  color: var(--theme-text-primary);
  font-size: 14px;
}

.mobile-shell__fps-range {
  width: 100%;
  min-width: 0;
  accent-color: var(--theme-accent);
  touch-action: pan-x;
}

.mobile-shell__fps-ticks {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  text-align: center;
}

.mobile-shell__plane-grid button {
  display: grid;
  gap: 2px;
  padding: 7px;
}

.mobile-shell__plane-grid small {
  color: var(--theme-text-muted);
  font-size: 10px;
}

.mobile-shell__tag-view {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: var(--theme-surface-panel-solid);
}

.mobile-shell__tag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 68%, transparent);
}

.mobile-shell__tag-header strong,
.mobile-shell__tag-header span {
  display: block;
}

.mobile-shell__tag-header span {
  color: var(--theme-text-muted);
  font-size: 12px;
}

.mobile-shell__tag-pager {
  display: inline-flex;
  gap: 6px;
}

.mobile-shell__tag-pager button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
}

.mobile-shell__tag-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin: 10px 10px 0;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-muted);
  padding: 0 9px;
}

.mobile-shell__tag-search input {
  min-width: 0;
  height: 38px;
  border: 0;
  background: transparent;
  color: var(--theme-text-primary);
  font-size: 14px;
  outline: none;
}

.mobile-shell__tag-search input::placeholder {
  color: color-mix(in srgb, var(--theme-text-muted) 82%, transparent);
}

.mobile-shell__tag-search button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 72%, transparent);
  color: var(--theme-text-secondary);
}

.mobile-shell__tag-list {
  min-height: 0;
  overflow: auto;
  padding: 10px;
}

.mobile-shell__tag-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 7px;
  margin-bottom: 7px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
  padding: 9px;
}

.mobile-shell__tag-row strong,
.mobile-shell__tag-row p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__tag-row span,
.mobile-shell__tag-row small {
  color: var(--theme-text-muted);
  font-size: 12px;
}

.mobile-shell__tag-row p {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.mobile-shell__tag-empty {
  display: grid;
  place-items: center;
  color: var(--theme-text-muted);
}

.mobile-shell__toast {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 74px);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 82%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 94%, transparent);
  color: var(--theme-text-primary);
  padding: 10px 12px;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
}

.mobile-shell__toast[data-tone="error"] {
  border-color: rgba(248, 113, 113, 0.55);
}

.mobile-shell__toast-message {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  line-height: 1.35;
}

@media (orientation: landscape) and (max-height: 520px) {
  .mobile-shell__header {
    min-height: 48px;
    padding: calc(env(safe-area-inset-top, 0px) + 6px) 10px 6px;
  }

  .mobile-shell__eyebrow {
    display: none;
  }

  .mobile-shell__title {
    font-size: 14px;
  }

  .mobile-shell__slice-panel {
    padding: 5px 10px;
  }

  .mobile-shell__slice-panel--mpr {
    grid-template-columns: minmax(138px, 160px) auto minmax(160px, 1fr) auto;
  }

  .mobile-shell__plane-tabs {
    grid-column: auto;
    min-width: 0;
  }

  .mobile-shell__plane-tabs button {
    min-height: 30px;
  }

  .mobile-shell__slice-copy {
    min-width: 48px;
  }

  .mobile-shell__slice-range {
    grid-column: auto;
  }

  .mobile-shell__toolbar {
    padding: 5px 8px calc(env(safe-area-inset-bottom, 0px) + 6px);
  }

  .mobile-shell__tool {
    min-height: 38px;
    gap: 2px;
    font-size: 10px;
  }

  .mobile-shell__sheet {
    height: min(64dvh, 360px);
    max-height: min(64dvh, 360px);
  }

  .mobile-shell__toast {
    bottom: calc(env(safe-area-inset-bottom, 0px) + 54px);
  }
}
</style>
