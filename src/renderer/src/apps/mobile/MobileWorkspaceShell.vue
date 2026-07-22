<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import AppIcon from '../../components/AppIcon.vue'
import {
  FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS,
  PSEUDOCOLOR_PRESET_OPTIONS,
  getFusionPetPseudocolorGradient,
  getPseudocolorGradient,
  normalizePseudocolorPresetKey
} from '../../constants/pseudocolor'
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
import { VIEWER_LAYOUT_PRESETS } from '../../composables/workspace/layout/viewerLayoutTemplates'
import { parseSliceLabel, useKeySliceStars } from '../../composables/workspace/slices/useKeySliceStars'
import { getViewSyncEnabled, VIEW_SYNC_OPTION_CONFIGS } from '../../composables/workspace/sync/viewSyncConfig'
import { VOLUME_PRESET_OPTIONS, createDefaultVolumeRenderConfig } from '../../composables/workspace/volume/volumeRenderConfig'
import {
  DEFAULT_VOLUME_ORIENTATION_FACE,
  getVolumeOrientationIcon,
  VOLUME_ORIENTATION_FACE_NAMES,
  VOLUME_ORIENTATION_FACES,
  resolveVolumeOrientationFace,
  type VolumeOrientationFace
} from '../../composables/workspace/volume/volumeOrientation'
import { createDefaultSurfaceRenderConfig } from '../../composables/workspace/volume/surfaceRenderConfig'
import { useWorkspaceAnnotations } from '../../composables/workspace/overlays/useWorkspaceAnnotations'
import { useWorkspaceQaWaterAnalysis } from '../../composables/workspace/overlays/useWorkspaceQaWaterAnalysis'
import { isPetSeries, isSeriesViewSupported, resolveInitialSeriesViewType } from '../../composables/workspace/views/seriesViewSupport'
import {
  COMPARE_STACK_SOURCE_PANE_KEY,
  COMPARE_STACK_TARGET_PANE_KEY,
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY,
  getSeriesDisplayName,
  getViewTypeDisplayLabel
} from '../../composables/workspace/views/viewerWorkspaceTabs'
import { setApiBaseURL } from '../../services/apiBase'
import type { LoadFolderResponse } from '../../services/typedApi'
import { viewerRuntime, type DicomLoadSelection, type DicomLoadSource } from '../../platform/runtime'
import { mobileViewerCapabilityProfile, supportsViewerDataSource, supportsViewerViewType } from '../../shell/viewerCapabilityProfile'
import type { AnnotationSize, CompareStackPaneKey, CompareSyncSettingKey, ConnectionState, DicomTagItem, FolderSeriesItem, FusionPaneKey, MeasurementOverlay, MeasurementToolType, MprSegmentationConfig, MprSegmentationConfigActionType, MprThresholdRegion, MprViewportKey, ViewerLayoutTemplate, ViewerMtfItem, ViewerTabItem, ViewType, WindowLevelInfo } from '../../types/viewer'
import { DEFAULT_MPR_SEGMENTATION_COLOR, DEFAULT_MPR_VOI_COLOR, MPR_SEGMENTATION_DEPTH_LIMITS, MPR_SEGMENTATION_HU_LIMITS, createDefaultMprSegmentationConfig } from '../../types/viewer'
import {
  MOBILE_STACK_PLAYBACK_FPS_OPTIONS,
  type MobileGestureSensitivity,
  type MobileOrientationLock,
  type MobileStackPlaybackFps,
  useMobileViewerPreferences
} from './useMobileViewerPreferences'

const MtfCurveDialog = defineAsyncComponent(() => import('../../components/viewer/overlays/MtfCurveDialog.vue'))
const SurfaceRenderConfigPanel = defineAsyncComponent(() => import('../../components/workspace/SurfaceRenderConfigPanel.vue'))
const VolumeRenderConfigPanel = defineAsyncComponent(() => import('../../components/workspace/VolumeRenderConfigPanel.vue'))
const WorkspaceExportNameDialog = defineAsyncComponent(() => import('../../components/workspace/export/WorkspaceExportNameDialog.vue'))
const WorkspaceExportNotice = defineAsyncComponent(() => import('../../components/workspace/export/WorkspaceExportNotice.vue'))
const MobileCompareStackViewport = defineAsyncComponent(() => import('./MobileCompareStackViewport.vue'))
const MobileMprViewport = defineAsyncComponent(() => import('./MobileMprViewport.vue'))
const MobilePetCtFusionViewport = defineAsyncComponent(() => import('./MobilePetCtFusionViewport.vue'))
const MobileSettingsOverlay = defineAsyncComponent(() => import('./MobileSettingsOverlay.vue'))
const MobileStackViewport = defineAsyncComponent(() => import('./MobileStackViewport.vue'))
const MobileVolumeViewport = defineAsyncComponent(() => import('./MobileVolumeViewport.vue'))
const PacsBrowserDialog = defineAsyncComponent(() => import('../../components/sidebar/PacsBrowserDialog.vue'))
const MprSegmentationPanel = defineAsyncComponent(() => import('../../components/workspace/MprSegmentationPanel.vue'))

let typedApiModulePromise: Promise<typeof import('../../services/typedApi')> | null = null

function loadTypedApi() {
  typedApiModulePromise ??= import('../../services/typedApi')
  return typedApiModulePromise
}

type MobileToolKey = 'scroll' | 'crosshair' | 'window' | 'pan' | 'zoom' | 'measure' | 'annotate' | 'qa' | 'rotate3d' | 'volumeOrientation' | 'play' | 'reset' | 'color' | 'transform' | 'layout' | 'volumeRemoveBed' | 'volumeClip' | 'volumeParams' | 'export' | 'tag' | 'compare' | 'fusion' | 'segmentation'
type MobileInlineToolKey = 'fusionRegistrationToggle' | 'fusionRegistrationTranslate' | 'fusionRegistrationRotate' | 'fusionRegistrationReset' | 'fusionRegistrationSave'
type MobileToolbarKey = MobileToolKey | MobileInlineToolKey | 'more'
type FusionRegistrationExitToolKey = Extract<MobileToolKey, 'pan' | 'zoom' | 'scroll' | 'crosshair' | 'rotate3d'>
type MobileInlineToolPanel = 'measure' | 'color' | 'transform' | 'layout' | 'segmentation' | 'qa' | 'playback' | 'fusion-registration' | 'volume-render' | 'volume-orientation' | 'volume-clip' | null
type MobileSheetKind = 'history' | 'series' | 'favorites' | 'window' | 'display' | 'transform' | 'color' | 'playback' | 'compare' | 'fusion' | 'segmentation' | 'mpr' | 'measure' | 'annotate' | 'qa' | 'export' | 'volumeParams' | 'reset' | 'tag' | null
type MobileSheetTabKey = Exclude<MobileSheetKind, null>
type MobileSheetPresentation = 'menu' | 'focused'
type DisplayOverlayKey = 'cornerInfo' | 'scaleBar' | 'pseudocolorBar' | 'volumeOrientationCube'
type MobileScreenOrientationLockType = 'portrait-primary' | 'landscape-primary'
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: MobileScreenOrientationLockType) => Promise<void>
  unlock?: () => void
}

interface MobileToolbarItem {
  key: MobileToolbarKey
  icon: string
  label: string
}

interface MobileInlineActionItem {
  key: string
  icon?: string
  label: string
  orientationLabel?: {
    initial: string
    suffix: string
  }
  orientationSecondaryLabel?: string
  active?: boolean
  disabled?: boolean
  iconOnly?: boolean
  tone?: 'danger' | 'warm'
  onClick: () => void
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

interface MobileSlicePlaybackTarget {
  current: number
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

interface MobileViewHistoryRecord {
  id: string
  openedAt: number
  seriesId: string
  targetSeriesId?: string
  viewType: ViewType
}

interface MobileViewHistoryItem extends MobileViewHistoryRecord {
  detail: string
  openable: boolean
  title: string
  viewLabel: string
}

const MAX_MOBILE_VIEW_HISTORY = 20
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

const SURFACE_PRESET_OPTIONS = [
  { value: 'surfacePreset:bone', icon: 'render-surface', label: 'Bone' },
  { value: 'surfacePreset:softTissue', icon: 'volume-preset-muscle', label: 'Soft Tissue / Skin' },
  { value: 'surfacePreset:highDensity', icon: 'volume-preset-mip', label: 'High Density / Metal' }
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
  { value: 'reset:view', icon: 'reset', zh: '\u91cd\u7f6e\u89c6\u56fe', en: 'Reset View' },
  { value: 'reset:measurements', icon: 'reset', zh: '清除测量', en: 'Clear Measurements' },
  { value: 'reset:mtf', icon: 'reset', zh: '清除 MTF', en: 'Clear MTF' },
  { value: 'reset:annotations', icon: 'reset', zh: '清除标注', en: 'Clear Annotations' },
  { value: 'reset:all', icon: 'trash', zh: '\u5168\u90e8\u91cd\u7f6e', en: 'Reset All' }
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
    toolType: 'alignment-horizontal',
    icon: 'measure-angle',
    zh: '相对水平偏角',
    en: 'Deviation from Horizontal',
    hintZh: '仅用于 2D CT；沿床板或模体边缘拖动，测量相对 DICOM 物理水平的偏角',
    hintEn: '2D CT only. Drag along an edge to measure deviation from the physical DICOM horizontal axis'
  },
  {
    toolType: 'alignment-vertical',
    icon: 'measure-angle',
    zh: '相对垂直偏角',
    en: 'Deviation from Vertical',
    hintZh: '仅用于 2D CT；沿床板或模体边缘拖动，测量相对 DICOM 物理垂直的偏角',
    hintEn: '2D CT only. Drag along an edge to measure deviation from the physical DICOM vertical axis'
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
  mprSegmentationStylePreference,
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
  defaultShowPseudocolorBar,
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
  getStarredSliceIndexes,
  isSliceStarred,
  toggleSliceStar
} = useKeySliceStars()

const activeTool = ref<MobileToolKey>('scroll')
const activeSheetKind = ref<MobileSheetKind>(null)
const activeSheetPresentation = ref<MobileSheetPresentation | null>(null)
const activeInlineToolPanel = ref<MobileInlineToolPanel>(null)
const customPresetZhName = ref('')
const customPresetEnName = ref('')
const customPresetWw = ref('400')
const customPresetWl = ref('40')
const isCustomWindowDialogOpen = ref(false)
const selectedCustomPresetIds = ref<string[]>([])
const explicitWindowSelectionByTargetKey = new Map<string, string>()
const activeCompareViewportKey = ref<CompareStackPaneKey>(COMPARE_STACK_SOURCE_PANE_KEY)
const activeFusionViewportKey = ref<FusionPaneKey>(FUSION_OVERLAY_AXIAL_PANE_KEY)
const mobileViewHistory = ref<MobileViewHistoryRecord[]>([])
const mobileFusionRegistrationMode = ref<'translate' | 'rotate'>('translate')
const fusionSourceSeriesId = ref<string | null>(null)
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
const seriesActionSeriesId = ref<string | null>(null)

let playbackTimer: ReturnType<typeof window.setInterval> | null = null
let fourDPlaybackStartingTimer: ReturnType<typeof window.setTimeout> | null = null
let sliceSliderFrame: number | null = null
let activeSlicePlaybackTarget: MobileSlicePlaybackTarget | null = null

const isZh = computed(() => locale.value === 'zh-CN')
const isWebPlatform = computed(() => viewerRuntime.platform === 'web')
const activeStackTab = computed(() => (viewer.activeTab.value?.viewType === 'Stack' ? viewer.activeTab.value : null))
const activePetTab = computed(() => (viewer.activeTab.value?.viewType === 'PET' ? viewer.activeTab.value : null))
const activeStackLikeTab = computed(() => activeStackTab.value ?? activePetTab.value)
const activeCompareTab = computed(() => (viewer.activeTab.value?.viewType === 'CompareStack' ? viewer.activeTab.value : null))
const activeMprTab = computed(() => (viewer.activeTab.value?.viewType === 'MPR' ? viewer.activeTab.value : null))
const activeVolumeTab = computed(() => (viewer.activeTab.value?.viewType === '3D' ? viewer.activeTab.value : null))
const activeLayoutTab = computed(() => (viewer.activeTab.value?.viewType === 'Layout' ? viewer.activeTab.value : null))
const activeFourDTab = computed(() => (viewer.activeTab.value?.viewType === '4D' ? viewer.activeTab.value : null))
const activeFusionTab = computed(() => (viewer.activeTab.value?.viewType === 'PETCTFusion' ? viewer.activeTab.value : null))
const isFusionRegistrationEnabled = computed(() => activeFusionTab.value?.fusionManualRegistration === true)
const activeMprLikeTab = computed(() => activeMprTab.value ?? activeFourDTab.value)
const activeTagTab = computed(() => (viewer.activeTab.value?.viewType === 'Tag' ? viewer.activeTab.value : null))
const activeImageTab = computed(() => activeStackLikeTab.value ?? activeCompareTab.value ?? activeMprTab.value ?? activeVolumeTab.value ?? activeLayoutTab.value ?? activeFourDTab.value ?? activeFusionTab.value)
const activeMobilePseudocolorKey = computed(() => {
  const tab = viewer.activeTab.value
  if (!tab) {
    return normalizePseudocolorPresetKey(selectedPseudocolorKey.value)
  }
  if (tab.viewType === 'MPR' || tab.viewType === '4D') {
    return normalizePseudocolorPresetKey(
      tab.viewportPseudocolorPresets?.[activeMprViewportKey.value] ??
      tab.pseudocolorPreset ??
      selectedPseudocolorKey.value
    )
  }
  if (tab.viewType === 'CompareStack') {
    return normalizePseudocolorPresetKey(
      tab.comparePseudocolorPresets?.[activeCompareViewportKey.value] ??
      tab.pseudocolorPreset ??
      selectedPseudocolorKey.value
    )
  }
  if (tab.viewType === 'Stack' || tab.viewType === 'Layout') {
    return normalizePseudocolorPresetKey(tab.pseudocolorPreset ?? selectedPseudocolorKey.value)
  }
  return normalizePseudocolorPresetKey(selectedPseudocolorKey.value)
})
const selectedSeries = computed(() => viewer.seriesList.value.find((series) => series.seriesId === viewer.selectedSeriesId.value) ?? null)
const mobileSeriesList = computed(() => viewer.seriesList.value.filter((series) => series.isImageSeries !== false))
const hasLoadedSeries = computed(() => mobileSeriesList.value.length > 0)
const seriesActionSeries = computed(() => {
  const explicit = seriesActionSeriesId.value
    ? mobileSeriesList.value.find((series) => series.seriesId === seriesActionSeriesId.value)
    : null
  if (explicit) {
    return explicit
  }
  return mobileSeriesList.value.find((series) => series.seriesId === viewer.selectedSeriesId.value) ?? null
})
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
const isLoadingAnySource = computed(() => isLoadingDemo.value || isLoadingLocal.value)
const canOpenStack = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'Stack'))
const canOpenPet = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'PET'))
const canOpenCompare = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'CompareStack'))
const canOpenMpr = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'MPR'))
const canOpenVolume = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, '3D'))
const canOpenFourD = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, '4D'))
const canOpenFusion = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'PETCTFusion'))
const canOpenTag = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'Tag'))
const activeSeriesId = computed(() =>
  activeCompareTab.value?.compareSeriesIds?.[activeCompareViewportKey.value] ||
  (activeFusionTab.value ? resolveMobileFusionPaneSeriesId(activeFusionTab.value, activeFusionViewportKey.value) : null) ||
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
  return series?.seriesDescription || series?.seriesId || 'DicomVision'
})
const hasActiveView = computed(() => Boolean(viewer.activeTabKey.value))

const activeSliceLabelSource = computed(() => {
  if (activeStackLikeTab.value) {
    return activeStackLikeTab.value.sliceLabel
  }
  if (activeCompareTab.value) {
    return activeCompareTab.value.compareSliceLabels?.[activeCompareViewportKey.value] ?? ''
  }
  if (activeFusionTab.value) {
    return activeFusionTab.value.fusionSliceLabels?.[activeFusionViewportKey.value] ?? ''
  }
  if (activeMprLikeTab.value) {
    return activeMprLikeTab.value.viewportSliceLabels?.[activeMprViewportKey.value] ?? ''
  }
  return ''
})
const activeSliceViewportKey = computed(() =>
  activeCompareTab.value ? activeCompareViewportKey.value : activeFusionTab.value ? activeFusionViewportKey.value : activeMprLikeTab.value ? activeMprViewportKey.value : 'single'
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
const activeStackSlice = computed(() => (activeStackLikeTab.value ? parseSliceLabel(activeStackLikeTab.value.sliceLabel) : null))
const activeMprSlice = computed(() => (
  activeMprLikeTab.value ? parseSliceLabel(activeMprLikeTab.value.viewportSliceLabels?.[activeMprViewportKey.value] ?? '') : null
))
const isCurrentStackSliceStarred = computed(() =>
  Boolean(activeStackLikeTab.value && activeStackSlice.value && isSliceStarred(activeStackLikeTab.value.seriesId, activeStackSlice.value.index))
)
const canPlayStack = computed(() => Boolean(activeStackSlice.value && activeStackSlice.value.total > 1 && activeStackLikeTab.value))
const canPlayMpr = computed(() => Boolean(activeMprSlice.value && activeMprSlice.value.total > 1 && activeMprLikeTab.value))
const showSlicePanel = computed(() => Boolean(activeStackLikeTab.value || activeCompareTab.value || activeFusionTab.value || activeMprLikeTab.value))
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
const isPlayingActiveSlicePlayback = computed(() => (activeMprLikeTab.value ? isPlayingMpr.value : isPlayingStack.value))
const isAnyPlaybackActive = computed(() => isPlayingFourD.value || fourDPlaybackStarting.value || isPlayingActiveSlicePlayback.value)
const canPlayActive = computed(() => {
  if (activeFourDTab.value) {
    return canPlayFourD.value && !isPlayingActiveSlicePlayback.value
  }
  if (activeMprLikeTab.value) {
    return canPlayMpr.value
  }
  return canPlayStack.value
})
const canPlaySlicePlayback = computed(() => {
  if (activeMprLikeTab.value) {
    return canPlayMpr.value && !isPlayingFourD.value && !fourDPlaybackStarting.value
  }
  return canPlayStack.value
})
const showSlicePlayButton = computed(() => Boolean(activeStackLikeTab.value || activeMprLikeTab.value))
const activePlayLabel = computed(() => {
  if (activeFourDTab.value && fourDPlaybackStarting.value) {
    return isZh.value ? '加载' : 'Loading'
  }
  const isPlaying = activeFourDTab.value ? isPlayingFourD.value : isPlayingActiveSlicePlayback.value
  return isPlaying ? (isZh.value ? '暂停' : 'Pause') : (isZh.value ? '播放' : 'Play')
})
const activePlayIcon = computed(() => {
  if (activeFourDTab.value && fourDPlaybackStarting.value) {
    return 'play'
  }
  return (activeFourDTab.value ? isPlayingFourD.value : isPlayingActiveSlicePlayback.value) ? 'pause' : 'play'
})
const activeSlicePlayLabel = computed(() =>
  isPlayingActiveSlicePlayback.value
    ? (isZh.value ? '暂停切片播放' : 'Pause slice playback')
    : (isZh.value ? '播放切片' : 'Play slices')
)
const activeSlicePlayIcon = computed(() => (isPlayingActiveSlicePlayback.value ? 'pause' : 'play'))
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
  'mobile-shell--active-view': Boolean(activeImageTab.value),
  'mobile-shell--orientation-landscape': orientationLock.value === 'landscape',
  'mobile-shell--orientation-portrait': orientationLock.value === 'portrait'
}))
const favoriteSliceItems = computed<MobileFavoriteSliceItem[]>(() => {
  return viewer.seriesList.value
    .flatMap((series) => {
      const seriesId = series.seriesId
      const sliceIndexes = getStarredSliceIndexes(seriesId)
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
const mobileViewHistoryItems = computed<MobileViewHistoryItem[]>(() =>
  mobileViewHistory.value.map(resolveMobileViewHistoryItem)
)
const mobileViewHistoryCount = computed(() => mobileViewHistoryItems.value.length)

function createMobileResetTool(): MobileToolbarItem {
  return { key: 'reset', icon: 'reset', label: isZh.value ? '\u91cd\u7f6e' : 'Reset' }
}

function withResetAfterMore(tools: MobileToolbarItem[]): MobileToolbarItem[] {
  const normalizedTools = tools.filter((tool) => tool.key !== 'reset')
  const moreIndex = normalizedTools.findIndex((tool) => tool.key === 'more')
  const resetTool = createMobileResetTool()
  if (moreIndex < 0) {
    return [...normalizedTools, resetTool]
  }
  return [
    ...normalizedTools.slice(0, moreIndex + 1),
    resetTool,
    ...normalizedTools.slice(moreIndex + 1)
  ]
}

function createMoreTool(): MobileToolbarItem {
  return { key: 'more', icon: 'dots-horizontal', label: isZh.value ? '更多' : 'More' }
}

const windowTool = computed<MobileToolbarItem>(() => ({ key: 'window', icon: 'window', label: isZh.value ? '调窗' : 'Window' }))
const panTool = computed<MobileToolbarItem>(() => ({ key: 'pan', icon: 'pan', label: isZh.value ? '平移' : 'Pan' }))
const zoomTool = computed<MobileToolbarItem>(() => ({ key: 'zoom', icon: 'zoom', label: isZh.value ? '缩放' : 'Zoom' }))
const scrollTool = computed<MobileToolbarItem>(() => ({ key: 'scroll', icon: 'page', label: isZh.value ? '翻页' : 'Scroll' }))
const crosshairTool = computed<MobileToolbarItem>(() => ({ key: 'crosshair', icon: 'crosshair', label: isZh.value ? '十字线' : 'Cross' }))
const measureTool = computed<MobileToolbarItem>(() => ({ key: 'measure', icon: 'measure', label: isZh.value ? '测量' : 'Measure' }))
const annotateTool = computed<MobileToolbarItem>(() => ({ key: 'annotate', icon: 'annotate', label: isZh.value ? '标注' : 'Annotate' }))
const activeVolumeRenderModeIcon = computed(() =>
  activeVolumeTab.value?.render3dMode === 'surface' ? 'render-surface' : 'render-volume'
)
const colorTool = computed<MobileToolbarItem>(() => ({
  key: 'color',
  icon: activeVolumeTab.value ? activeVolumeRenderModeIcon.value : 'pseudocolor',
  label: activeVolumeTab.value ? '3D' : (isZh.value ? '伪彩' : 'Color')
}))
const transformTool = computed<MobileToolbarItem>(() => ({ key: 'transform', icon: 'rotate', label: isZh.value ? '变换' : 'Transform' }))
const volumeOrientationTool = computed<MobileToolbarItem>(() => ({
  key: 'volumeOrientation',
  icon: getVolumeOrientationIcon(activeVolumeOrientationFace.value),
  label: activeVolumeOrientationFace.value ?? (isZh.value ? '自由' : 'Free')
}))

const primaryMobileTools = computed<MobileToolbarItem[]>(() => {
  if (activeVolumeTab.value) {
    return [
      panTool.value,
      zoomTool.value,
      { key: 'rotate3d', icon: 'rotate3d', label: isZh.value ? '旋转' : 'Rotate' },
      volumeOrientationTool.value,
      colorTool.value
    ]
  }

  if (activeFusionTab.value) {
    return [
      windowTool.value,
      panTool.value,
      zoomTool.value,
      scrollTool.value,
      { key: 'fusion', icon: 'crosshair', label: isZh.value ? '配准' : 'Register' }
    ]
  }

  if (activeFourDTab.value) {
    return [
      windowTool.value,
      panTool.value,
      zoomTool.value,
      crosshairTool.value,
      { key: 'play', icon: activePlayIcon.value, label: isZh.value ? '播放' : 'Play' }
    ]
  }

  const primaryTools = [
    windowTool.value,
    panTool.value,
    zoomTool.value,
    activeMprLikeTab.value ? crosshairTool.value : scrollTool.value
  ]
  if (activeStackTab.value || activeMprTab.value) {
    primaryTools.push(measureTool.value)
  }
  return primaryTools
})

const secondaryMobileTools = computed<MobileToolbarItem[]>(() => {
  if (activeVolumeTab.value) {
    return withResetAfterMore([
      {
        key: 'volumeRemoveBed',
        icon: activeVolumeTab.value?.volumeRenderOptions?.removeBed ? 'bed-hidden' : 'bed-visible',
        label: activeVolumeTab.value?.volumeRenderOptions?.removeBed
          ? (isZh.value ? '已去床板' : 'Bed Hidden')
          : (isZh.value ? '去床板' : 'Remove Bed')
      },
      { key: 'volumeClip', icon: 'volume-clip', label: isZh.value ? '裁剪' : 'Clip' },
      { key: 'volumeParams', icon: 'settings', label: isZh.value ? '参数' : 'Params' },
      createMoreTool()
    ])
  }

  if (activeFusionTab.value) {
    return withResetAfterMore([
      measureTool.value,
      annotateTool.value,
      createMoreTool()
    ])
  }

  if (activeMprLikeTab.value) {
    if (activeMprTab.value) {
      return withResetAfterMore([
        { key: 'play', icon: activePlayIcon.value, label: isZh.value ? '播放' : 'Play' },
        annotateTool.value,
        colorTool.value,
        { key: 'segmentation', icon: 'segmentation', label: isZh.value ? '分割' : 'Seg' },
        createMoreTool()
      ])
    }
    return withResetAfterMore([
      measureTool.value,
      annotateTool.value,
      colorTool.value,
      createMoreTool()
    ])
  }

  return withResetAfterMore([
    ...(activeStackTab.value ? [{ key: 'play' as const, icon: activePlayIcon.value, label: isZh.value ? '播放' : 'Play' }] : []),
    ...(!activeStackTab.value ? [measureTool.value] : []),
    annotateTool.value,
    colorTool.value,
    transformTool.value,
    createMoreTool()
  ])
})

const visibleSecondaryMobileTools = computed<MobileToolbarItem[]>(() => secondaryMobileTools.value)

function getMobileInlineActionKey(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]+/g, '-')}`
}

function getInlinePanelParentToolKey(panel: MobileInlineToolPanel): MobileToolbarKey | null {
  if (panel === 'measure') {
    return 'measure'
  }
  if (panel === 'color' || panel === 'volume-render') {
    return 'color'
  }
  if (panel === 'volume-orientation') {
    return 'volumeOrientation'
  }
  if (panel === 'transform') {
    return 'transform'
  }
  if (panel === 'segmentation') {
    return 'segmentation'
  }
  if (panel === 'volume-clip') {
    return 'volumeClip'
  }
  if (panel === 'qa') {
    return 'qa'
  }
  if (panel === 'playback') {
    return 'play'
  }
  if (panel === 'fusion-registration') {
    return 'fusion'
  }
  return null
}

const activeMobileVolumePresetOptions = computed<Array<{ value: string; icon: string; label: string; group?: string }>>(() =>
  activeVolumeTab.value?.render3dMode === 'surface' ? SURFACE_PRESET_OPTIONS : VOLUME_PRESET_OPTIONS
)

const activeMobileMeasurementTools = computed(() => {
  const viewType = viewer.activeTab.value?.viewType
  const supportsAlignment = viewType === 'Stack' || viewType === 'CompareStack' || viewType === 'Layout'
  return supportsAlignment
    ? MOBILE_MEASUREMENT_TOOLS
    : MOBILE_MEASUREMENT_TOOLS.filter(
        (tool) => tool.toolType !== 'alignment-horizontal' && tool.toolType !== 'alignment-vertical'
      )
})

function createVolumeOrientationInlineLabel(face: VolumeOrientationFace): { initial: string; suffix: string } {
  const label = VOLUME_ORIENTATION_FACE_NAMES[face].en
  return {
    initial: label.slice(0, 1).toUpperCase(),
    suffix: label.slice(1).toLowerCase()
  }
}

function shouldShowMobileVolumePresetGroupLabel(option: { group?: string }, optionIndex: number): boolean {
  const group = option.group
  if (!group) {
    return false
  }
  const previous = activeMobileVolumePresetOptions.value[optionIndex - 1] as { group?: string } | undefined
  return group !== previous?.group
}

const activeInlineTools = computed<MobileInlineActionItem[]>(() => {
  if (activeInlineToolPanel.value === 'measure') {
    return activeMobileMeasurementTools.value.map((tool) => ({
      key: getMobileInlineActionKey('measure', tool.toolType),
      icon: tool.icon,
      label: isZh.value ? tool.zh : tool.en,
      active: viewer.activeOperation.value === `measure:${tool.toolType}`,
      onClick: () => setActiveMeasurementTool(tool.toolType, { closeSheet: false })
    }))
  }

  if (activeInlineToolPanel.value === 'color') {
    if (activeFusionTab.value) {
      return [
        ...FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS.map((preset) => ({
          key: getMobileInlineActionKey('fusion-color', preset.key),
          icon: 'pseudocolor',
          label: preset.label,
          active: activeFusionPseudocolorKey.value === preset.key,
          onClick: () => applyFusionPseudocolor(`fusionPseudocolor:${preset.key}`)
        })),
        {
          key: 'fusion-color-reset',
          icon: 'reset',
          label: isZh.value ? '\u91cd\u7f6e PET' : 'Reset PET',
          onClick: resetFusionPetDisplay
        }
      ]
    }

    return PSEUDOCOLOR_PRESET_OPTIONS.map((preset) => ({
      key: getMobileInlineActionKey('pseudocolor', preset.key),
      icon: 'pseudocolor',
      label: preset.label,
      active: activeMobilePseudocolorKey.value === preset.key,
      onClick: () => applyPseudocolor(`pseudocolor:${preset.key}`)
    }))
  }

  if (activeInlineToolPanel.value === 'volume-render') {
    const presetOptions = activeMobileVolumePresetOptions.value
    return [
      ...VOLUME_RENDER_MODE_OPTIONS.map((option) => ({
        key: getMobileInlineActionKey('volume-render', option.value),
        icon: option.icon,
        label: option.label,
        active: activeVolumeRenderModeValue.value === option.value,
        onClick: () => applyVolumeRenderMode(option.value)
      })),
      ...presetOptions.map((preset) => ({
        key: getMobileInlineActionKey('volume-preset', preset.value),
        icon: preset.icon,
        label: preset.label,
        active: preset.value.startsWith('surfacePreset:')
          ? activeSurfacePresetValue.value === preset.value
          : activeVolumePresetValue.value === preset.value,
        onClick: () => {
          if (preset.value.startsWith('surfacePreset:')) {
            applySurfacePreset(preset.value)
            return
          }
          applyVolumePreset(preset.value)
        }
      })),
      {
        key: 'volume-render-details',
        icon: 'settings',
        label: isZh.value ? '参数' : 'Params',
        onClick: () => openFocusedSheet('volumeParams')
      }
    ]
  }

  if (activeInlineToolPanel.value === 'volume-orientation') {
    return VOLUME_ORIENTATION_FACES.map((face) => ({
      key: getMobileInlineActionKey('volume-orientation', face),
      label: isZh.value
        ? `${VOLUME_ORIENTATION_FACE_NAMES[face].en} ${VOLUME_ORIENTATION_FACE_NAMES[face].zh}`
        : VOLUME_ORIENTATION_FACE_NAMES[face].en,
      orientationLabel: createVolumeOrientationInlineLabel(face),
      orientationSecondaryLabel: isZh.value ? VOLUME_ORIENTATION_FACE_NAMES[face].zh : undefined,
      active: activeVolumeOrientationFace.value === face,
      onClick: () => applyVolumeOrientation(face)
    }))
  }

  if (activeInlineToolPanel.value === 'layout') {
    return VIEWER_LAYOUT_PRESETS.map((template) => ({
      key: getMobileInlineActionKey('layout', template.key),
      icon: 'layout',
      label: template.label,
      active: activeLayoutTab.value?.layoutTemplate?.rows === template.rows && activeLayoutTab.value?.layoutTemplate?.columns === template.columns,
      onClick: () => applyMobileLayoutTemplate(template)
    }))
  }

  if (activeInlineToolPanel.value === 'volume-clip') {
    const operation = getNormalizedMobileOperation(viewer.activeOperation.value)
    return [
      {
        key: 'volume-clip-inside',
        icon: 'volume-clip',
        label: isZh.value ? '裁剪内部' : 'Inside',
        active: operation === 'volumeClip:inside',
        onClick: () => setMobileVolumeClipMode('inside')
      },
      {
        key: 'volume-clip-outside',
        icon: 'volume-clip',
        label: isZh.value ? '裁剪外部' : 'Outside',
        active: operation === 'volumeClip:outside',
        onClick: () => setMobileVolumeClipMode('outside')
      }
    ]
  }

  if (activeInlineToolPanel.value === 'transform') {
    return TRANSFORM_OPTIONS.map((option) => ({
      key: getMobileInlineActionKey('transform', option.value),
      icon: option.icon,
      label: isZh.value ? option.zh : option.en,
      onClick: () => applyTransform(option.value)
    }))
  }

  if (activeInlineToolPanel.value === 'segmentation') {
    return [
      {
        key: 'segmentation-threshold',
        label: isZh.value ? '阈值分割' : 'Threshold',
        active: getNormalizedMobileOperation(viewer.activeOperation.value) === 'segmentation:threshold',
        onClick: () => handleMprSegmentationModeChange('segmentation:threshold', activeMprViewportKey.value)
      },
      {
        key: 'segmentation-voi',
        label: 'VOI',
        active: getNormalizedMobileOperation(viewer.activeOperation.value) === 'segmentation:voi',
        onClick: () => handleMprSegmentationModeChange('segmentation:voi', activeMprViewportKey.value)
      },
      {
        key: 'segmentation-details',
        icon: 'dots-vertical',
        label: isZh.value ? '详情' : 'Details',
        iconOnly: true,
        onClick: () => openFocusedSheet('segmentation')
      }
    ]
  }

  if (activeInlineToolPanel.value === 'qa') {
    return MOBILE_QA_TOOLS.map((tool) => ({
      key: getMobileInlineActionKey('qa', tool.value),
      icon: tool.icon,
      label: isZh.value ? tool.zh : tool.en,
      active: viewer.activeOperation.value === `${STACK_OPERATION_PREFIX}${tool.value}`,
      disabled: !activeStackTab.value,
      onClick: () => applyQaTool(tool.value)
    }))
  }

  if (activeInlineToolPanel.value === 'playback') {
    return [
      {
        key: 'playback-toggle',
        icon: activePlayIcon.value,
        label: activePlayLabel.value,
        disabled: !canPlayActive.value || fourDPlaybackStarting.value,
        onClick: toggleActivePlayback
      },
      ...MOBILE_STACK_PLAYBACK_FPS_OPTIONS.map((fps) => ({
        key: getMobileInlineActionKey('playback-fps', `${fps}`),
        icon: 'four-d',
        label: `${fps} FPS`,
        active: activePlaybackFps.value === fps,
        disabled: !canPlayActive.value,
        onClick: () => setPlaybackFps(fps)
      }))
    ]
  }

  if (activeInlineToolPanel.value === 'fusion-registration') {
    const registrationEnabled = isFusionRegistrationEnabled.value
    return [
      {
        key: 'fusionRegistrationToggle',
        icon: 'crosshair',
        label: isZh.value ? '启用' : 'Enable',
        disabled: !activeFusionTab.value,
        tone: registrationEnabled ? 'warm' : undefined,
        onClick: toggleFusionManualRegistration
      },
      {
        key: 'fusionRegistrationTranslate',
        icon: 'pan',
        label: isZh.value ? '平移' : 'Move',
        active: registrationEnabled && mobileFusionRegistrationMode.value === 'translate',
        disabled: !registrationEnabled,
        onClick: () => setFusionRegistrationMode('translate')
      },
      {
        key: 'fusionRegistrationRotate',
        icon: 'rotate',
        label: isZh.value ? '旋转' : 'Rotate',
        active: registrationEnabled && mobileFusionRegistrationMode.value === 'rotate',
        disabled: !registrationEnabled,
        onClick: () => setFusionRegistrationMode('rotate')
      },
      {
        key: 'fusionRegistrationReset',
        icon: 'reset',
        label: isZh.value ? '\u91cd\u7f6e' : 'Reset',
        disabled: !registrationEnabled,
        onClick: resetFusionRegistration
      },
      {
        key: 'fusionRegistrationSave',
        icon: 'save',
        label: isZh.value ? '保存' : 'Save',
        disabled: !registrationEnabled,
        onClick: saveFusionRegistration
      }
    ]
  }

  return []
})

const ICON_ONLY_INLINE_TOOL_PANELS = new Set<Exclude<MobileInlineToolPanel, null>>([
  'measure',
  'transform',
  'qa',
  'playback'
])

const isIconOnlyInlineToolPanel = computed(() => {
  const panel = activeInlineToolPanel.value
  return panel !== null && ICON_ONLY_INLINE_TOOL_PANELS.has(panel)
})

const mobileSheetTabs = computed<Array<{ key: MobileSheetTabKey; icon: string; label: string }>>(() => {
  const tabs: Array<{ key: MobileSheetTabKey; icon: string; label: string }> = [
    { key: 'history', icon: 'history', label: isZh.value ? '历史' : 'History' },
    { key: 'series', icon: 'series', label: isZh.value ? '序列' : 'Series' },
    { key: 'favorites', icon: 'star', label: isZh.value ? '关键切片' : 'Key Slices' }
  ]

  if (!activeImageTab.value) {
    return tabs
  }

  if (activeFusionTab.value) {
    tabs.push(
      { key: 'window', icon: 'window', label: isZh.value ? '窗宽窗位' : 'Window' },
      { key: 'display', icon: 'display', label: isZh.value ? '显示' : 'Display' },
      { key: 'fusion', icon: 'crosshair', label: isZh.value ? '配准' : 'Register' },
      { key: 'measure', icon: 'measure', label: isZh.value ? '测量' : 'Measure' },
      { key: 'annotate', icon: 'annotate', label: isZh.value ? '标注' : 'Annotate' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'reset', icon: 'reset', label: isZh.value ? '\u91cd\u7f6e' : 'Reset' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
    return tabs
  }

  if (activeCompareTab.value) {
    tabs.push(
      { key: 'window', icon: 'window', label: isZh.value ? '窗宽窗位' : 'Window' },
      { key: 'display', icon: 'display', label: isZh.value ? '显示' : 'Display' },
      { key: 'compare', icon: 'compare', label: isZh.value ? '对比同步' : 'Compare' },
      { key: 'measure', icon: 'measure', label: isZh.value ? '测量' : 'Measure' },
      { key: 'annotate', icon: 'annotate', label: isZh.value ? '标注' : 'Annotate' },
      { key: 'color', icon: 'pseudocolor', label: isZh.value ? '伪彩' : 'Color' },
      { key: 'transform', icon: 'rotate', label: isZh.value ? '变换' : 'Transform' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'reset', icon: 'reset', label: isZh.value ? '\u91cd\u7f6e' : 'Reset' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
    return tabs
  }

  if (activeVolumeTab.value) {
    tabs.push(
      { key: 'display', icon: 'display', label: isZh.value ? '显示' : 'Display' },
      { key: 'color', icon: activeVolumeRenderModeIcon.value, label: '3D' },
      { key: 'volumeParams', icon: 'settings', label: isZh.value ? '参数' : 'Params' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'reset', icon: 'reset', label: isZh.value ? '\u91cd\u7f6e' : 'Reset' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
    return tabs
  }

  tabs.push(
    { key: 'window', icon: 'window', label: isZh.value ? '窗宽窗位' : 'Window' },
    { key: 'display', icon: 'display', label: isZh.value ? '显示' : 'Display' },
    { key: 'measure', icon: 'measure', label: isZh.value ? '测量' : 'Measure' },
    { key: 'annotate', icon: 'annotate', label: isZh.value ? '标注' : 'Annotate' },
    { key: 'color', icon: 'pseudocolor', label: isZh.value ? '伪彩' : 'Color' }
  )

  tabs.push({ key: 'reset', icon: 'reset', label: isZh.value ? '\u91cd\u7f6e' : 'Reset' })

  if (activeStackLikeTab.value) {
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
      { key: 'segmentation', icon: 'segmentation', label: isZh.value ? '分割' : 'Seg' },
      { key: 'export', icon: 'export', label: isZh.value ? '导出' : 'Export' },
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
  }

  return tabs
})

const sheetTitle = computed(() => {
  const titleMap: Record<MobileSheetTabKey, string> = {
    annotate: isZh.value ? '标注' : 'Annotate',
    color: activeVolumeTab.value ? '3D' : (isZh.value ? '伪彩' : 'Pseudocolor'),
    display: isZh.value ? '显示' : 'Display',
    favorites: isZh.value ? '关键切片' : 'Key Slices',
    export: isZh.value ? '导出' : 'Export',
    fusion: isZh.value ? 'PET/CT 融合' : 'PET/CT Fusion',
    history: isZh.value ? '浏览记录' : 'Recent Views',
    mpr: 'MPR',
    measure: isZh.value ? '测量' : 'Measure',
    qa: 'QA',
    playback: isZh.value ? '播放' : 'Playback',
    compare: activeCompareTab.value ? (isZh.value ? '对比同步' : 'Compare Sync') : (isZh.value ? '选择对比序列' : 'Compare Target'),
    reset: isZh.value ? '\u91cd\u7f6e' : 'Reset',
    series: isZh.value ? '序列' : 'Series',
    segmentation: isZh.value ? '分割' : 'Segmentation',
    tag: 'DICOM Tag',
    transform: activeVolumeTab.value ? (isZh.value ? '3D 参数' : '3D Tools') : (isZh.value ? '变换' : 'Transform'),
    volumeParams: isZh.value ? '3D 参数' : '3D Parameters',
    window: isZh.value ? '窗宽窗位' : 'Window Presets'
  }
  return activeSheetKind.value ? titleMap[activeSheetKind.value] : ''
})

const showSheetTabBar = computed(() => activeSheetPresentation.value === 'menu')

const displayOverlayOptions = computed<Array<{ key: DisplayOverlayKey; icon: string; label: string; enabled: boolean }>>(() => {
  const tab = activeImageTab.value
  const options: Array<{ key: DisplayOverlayKey; icon: string; label: string; enabled: boolean }> = [
    { key: 'cornerInfo', icon: 'info', label: isZh.value ? '四角信息' : 'Corner Info', enabled: activeImageTab.value?.showCornerInfo !== false }
  ]
  if (!activeVolumeTab.value) {
    options.push({
      key: 'scaleBar',
      icon: 'measure',
      label: isZh.value ? '比例尺' : 'Scale Bar',
      enabled: activeImageTab.value?.showScaleBar !== false
    })
  }
  if (tab?.viewType !== '3D' && tab?.viewType !== 'PETCTFusion') {
    options.push({
      key: 'pseudocolorBar',
      icon: 'pseudocolor',
      label: isZh.value ? '伪彩条' : 'Pseudocolor Bar',
      enabled: tab?.showPseudocolorBar !== false
    })
  }
  if (activeVolumeTab.value) {
    options.push({
      key: 'volumeOrientationCube',
      icon: 'render-mode',
      label: isZh.value ? '方向立方体' : 'Orientation Cube',
      enabled: activeVolumeTab.value.showVolumeOrientationCube !== false
    })
  }
  return options
})
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
const fusionSourceSeries = computed(() =>
  fusionSourceSeriesId.value ? viewer.seriesList.value.find((series) => series.seriesId === fusionSourceSeriesId.value) ?? null : null
)
const fusionCandidateSeries = computed(() => getFusionCandidatesForSeries(fusionSourceSeries.value))
const activeFusionPseudocolorKey = computed(() => (
  activeFusionTab.value?.fusionInfo?.petPseudocolorPreset ??
  activeFusionTab.value?.fusionPseudocolorPresets?.[FUSION_OVERLAY_AXIAL_PANE_KEY] ??
  'petct-rainbow'
))
const activeMprSegmentationConfig = computed<MprSegmentationConfig>(() =>
  activeMprTab.value?.mprSegmentationConfig ?? createDefaultMprSegmentationConfig()
)
const selectedMobileThresholdRegion = computed<MprThresholdRegion | null>(() => {
  const config = activeMprSegmentationConfig.value
  if (!config.thresholdRegions.length) {
    return null
  }
  return config.thresholdRegions.find((region) => region.id === config.selectedRegionId) ?? config.thresholdRegions[0] ?? null
})
const showMobileSegmentationInlineControl = computed(() =>
  activeInlineToolPanel.value === 'segmentation' &&
  getNormalizedMobileOperation(viewer.activeOperation.value) === 'segmentation:threshold'
)
const mprSegmentationDefaultThresholdColor = computed(() => mprSegmentationStylePreference?.value?.thresholdColor ?? DEFAULT_MPR_SEGMENTATION_COLOR)
const mprSegmentationDefaultVoiColor = computed(() => mprSegmentationStylePreference?.value?.voiColor ?? DEFAULT_MPR_VOI_COLOR)
const currentConnectionState = computed<ConnectionState>(() => viewer.connectionState?.value ?? 'idle')
const connectionIcon = computed(() => getConnectionIcon(currentConnectionState.value))
const connectionToneClass = computed(() => `mobile-shell__connection mobile-shell__connection--${getConnectionTone(currentConnectionState.value)}`)
const activeVolumeRenderModeValue = computed(() => `render3dMode:${activeVolumeTab.value?.render3dMode ?? 'volume'}`)
const activeVolumePresetValue = computed(() => activeVolumeTab.value?.volumePreset ?? 'volumePreset:aaa')
const activeSurfacePresetValue = computed(() => `surfacePreset:${activeVolumeTab.value?.surfaceRenderConfig?.preset ?? 'bone'}`)
const activeVolumeOrientationFace = computed<VolumeOrientationFace | null>(() => {
  const quaternion = activeVolumeTab.value?.orientation?.volumeQuaternion
  if (!quaternion) {
    return DEFAULT_VOLUME_ORIENTATION_FACE
  }
  return resolveVolumeOrientationFace(quaternion)
})
const activeVolumeRenderConfig = computed(() => {
  if (activeVolumeTab.value?.render3dMode === 'surface') {
    return null
  }
  return activeVolumeTab.value?.volumeRenderConfig ?? createDefaultVolumeRenderConfig(activeVolumeTab.value?.volumePreset ?? 'aaa')
})
const activeSurfaceRenderConfig = computed(() => {
  if (activeVolumeTab.value?.render3dMode !== 'surface') {
    return null
  }
  return activeVolumeTab.value?.surfaceRenderConfig ?? createDefaultSurfaceRenderConfig()
})
const mobileExportOptions = computed(() =>
  MOBILE_EXPORT_OPTIONS.filter((option) =>
    !(option.value === 'dicom-sr' || option.value === 'dicom-gsps') ||
    (activeImageTab.value?.viewType !== '3D' && activeImageTab.value?.viewType !== 'MPR')
  )
)
const mobileExportSharedIcon = computed(() => {
  const icons = new Set(mobileExportOptions.value.map((option) => option.icon).filter(Boolean))
  return icons.size === 1 ? Array.from(icons)[0] : null
})
const shouldHideMobileExportRowIcons = computed(() => Boolean(mobileExportSharedIcon.value))
const sheetTitleIcon = computed(() => (
  activeSheetKind.value === 'export' ? mobileExportSharedIcon.value : null
))
const mobileResetOptions = computed(() =>
  MOBILE_RESET_OPTIONS.filter((option) => {
    if (activeVolumeTab.value) {
      return option.value === 'reset:view' || option.value === 'reset:all'
    }
    if (!activeStackLikeTab.value && !activeMprLikeTab.value) {
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
  if (tool === 'fusion') {
    return viewer.activeOperation.value
  }
  if (tool === 'segmentation') {
    const currentSegmentationMode = getActiveMobileSegmentationMode()
    return `${STACK_OPERATION_PREFIX}${currentSegmentationMode ?? 'segmentation:threshold'}`
  }
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

function getNormalizedMobileOperation(operation: string): string {
  return operation.startsWith(STACK_OPERATION_PREFIX) ? operation.slice(STACK_OPERATION_PREFIX.length) : operation
}

function getActiveMobileSegmentationMode(): 'segmentation:threshold' | 'segmentation:voi' | null {
  const operation = getNormalizedMobileOperation(viewer.activeOperation.value)
  if (operation === 'segmentation:threshold' || operation === 'segmentation:voi') {
    return operation
  }
  return null
}

function setActiveMobileTool(tool: MobileToolKey, options: { closeInlinePanel?: boolean; closeSheet?: boolean } = {}): void {
  if (tool === 'play') {
    toggleActivePlayback()
    return
  }

  activeTool.value = tool
  viewer.setActiveOperation(normalizeToolOperation(tool))
  if (options.closeInlinePanel !== false) {
    closeInlineToolPanel()
  }
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
  if (viewType === 'Stack' || viewType === 'PET' || viewType === 'CompareStack' || viewType === 'PETCTFusion') {
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
  viewer.triggerViewAction({
    action: 'displayOverlay',
    overlay: 'pseudocolorBar',
    enabled: defaultShowPseudocolorBar.value
  })
}

function applyMobileViewDefaults(viewType: ViewType): void {
  if (viewType === 'Stack' || viewType === 'PET' || viewType === 'CompareStack') {
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
    case 'PET':
      return canOpenPet.value
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
    case 'PETCTFusion':
      return canOpenFusion.value
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

function normalizeSeriesModality(series: FolderSeriesItem | null | undefined): string {
  return String(series?.modality ?? '').trim().toUpperCase()
}

function isCtSeries(series: FolderSeriesItem | null | undefined): boolean {
  return normalizeSeriesModality(series) === 'CT'
}

function hasSameStudy(a: FolderSeriesItem | null | undefined, b: FolderSeriesItem | null | undefined): boolean {
  const left = getSeriesStudyInstanceUid(a).trim()
  const right = getSeriesStudyInstanceUid(b).trim()
  return Boolean(left && right && left === right)
}

function hasDifferentKnownStudies(a: FolderSeriesItem | null | undefined, b: FolderSeriesItem | null | undefined): boolean {
  const left = getSeriesStudyInstanceUid(a).trim()
  const right = getSeriesStudyInstanceUid(b).trim()
  return Boolean(left && right && left !== right)
}

function hasSameTextField(
  a: FolderSeriesItem | null | undefined,
  b: FolderSeriesItem | null | undefined,
  field: 'patientId' | 'accessionNumber' | 'studyDate'
): boolean {
  const left = String(a?.[field] ?? '').trim()
  const right = String(b?.[field] ?? '').trim()
  return Boolean(left && right && left === right)
}

function hasCompatibleFusionContext(source: FolderSeriesItem, candidate: FolderSeriesItem): boolean {
  if (hasSameStudy(source, candidate)) {
    return true
  }
  if (hasDifferentKnownStudies(source, candidate)) {
    return false
  }
  if (hasSameTextField(source, candidate, 'accessionNumber')) {
    return true
  }
  return hasSameTextField(source, candidate, 'patientId') && hasSameTextField(source, candidate, 'studyDate')
}

function getFusionCandidatesForSeries(source: FolderSeriesItem | null | undefined): FolderSeriesItem[] {
  if (!source || source.isImageSeries === false || !canOpenFusion.value) {
    return []
  }
  const wantsPet = isCtSeries(source)
  const wantsCt = isPetSeries(source)
  if (!wantsPet && !wantsCt) {
    return []
  }
  return mobileSeriesList.value.filter((series) =>
    series.seriesId !== source.seriesId &&
    series.isImageSeries !== false &&
    hasCompatibleFusionContext(source, series) &&
    (wantsPet ? isPetSeries(series) : isCtSeries(series))
  )
}

function getFusionCandidateScore(source: FolderSeriesItem, candidate: FolderSeriesItem): number {
  let score = 0
  if (hasSameStudy(source, candidate)) {
    score += 100
  }
  if (hasSameTextField(source, candidate, 'accessionNumber')) {
    score += 24
  }
  if (hasSameTextField(source, candidate, 'patientId')) {
    score += 12
  }
  if (hasSameTextField(source, candidate, 'studyDate')) {
    score += 8
  }
  return score
}

function getAutoFusionCandidateForSeries(source: FolderSeriesItem, candidates: FolderSeriesItem[]): FolderSeriesItem | null {
  if (candidates.length === 1) {
    return candidates[0]
  }
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: getFusionCandidateScore(source, candidate)
    }))
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  const second = ranked[1]
  return best && (!second || best.score > second.score) ? best.candidate : null
}

function resolveFusionPair(source: FolderSeriesItem, target: FolderSeriesItem): { ctSeriesId: string; petSeriesId: string } | null {
  if (isCtSeries(source) && isPetSeries(target)) {
    return { ctSeriesId: source.seriesId, petSeriesId: target.seriesId }
  }
  if (isPetSeries(source) && isCtSeries(target)) {
    return { ctSeriesId: target.seriesId, petSeriesId: source.seriesId }
  }
  return null
}

function resolveMobileFusionPaneSeriesId(tab: ViewerTabItem, paneKey: FusionPaneKey): string | null {
  const ids = tab.fusionSeriesIds
  if (paneKey === FUSION_PET_AXIAL_PANE_KEY || paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY) {
    return ids?.petSeriesId ?? null
  }
  if (paneKey === FUSION_CT_AXIAL_PANE_KEY || paneKey === FUSION_OVERLAY_AXIAL_PANE_KEY) {
    return ids?.ctSeriesId ?? tab.seriesId ?? null
  }
  return tab.seriesId ?? null
}

function getHistoryRecordId(viewType: ViewType, seriesId: string, targetSeriesId?: string): string {
  return [viewType, seriesId, targetSeriesId ?? ''].join('::')
}

function shouldRememberMobileViewHistory(viewType: ViewType): boolean {
  return viewType !== 'Tag' && viewType !== 'Layout'
}

function rememberMobileViewHistory(viewType: ViewType, seriesId: string, targetSeriesId?: string): void {
  if (!shouldRememberMobileViewHistory(viewType)) {
    return
  }
  const id = getHistoryRecordId(viewType, seriesId, targetSeriesId)
  const record: MobileViewHistoryRecord = {
    id,
    openedAt: Date.now(),
    seriesId,
    targetSeriesId,
    viewType
  }
  mobileViewHistory.value = [
    record,
    ...mobileViewHistory.value.filter((item) => item.id !== id)
  ].slice(0, MAX_MOBILE_VIEW_HISTORY)
}

function getHistoryViewLabel(viewType: ViewType): string {
  return getViewTypeDisplayLabel(viewType, isZh.value ? 'zh-CN' : 'en-US')
}

function getSeriesForHistory(seriesId: string): FolderSeriesItem | null {
  return viewer.seriesList.value.find((series) => series.seriesId === seriesId) ?? null
}

function isMobileViewHistoryRecordOpenable(record: MobileViewHistoryRecord): boolean {
  const source = getSeriesForHistory(record.seriesId)
  if (!source) {
    return false
  }
  if (record.viewType === 'CompareStack') {
    const target = record.targetSeriesId ? getSeriesForHistory(record.targetSeriesId) : null
    return Boolean(target && canOpenCompare.value && isSeriesActionSupported(source, 'CompareStack') && isSeriesActionSupported(target, 'CompareStack'))
  }
  if (record.viewType === 'PETCTFusion') {
    const target = record.targetSeriesId ? getSeriesForHistory(record.targetSeriesId) : null
    return Boolean(target && canOpenFusion.value && resolveFusionPair(source, target))
  }
  return isSeriesActionSupported(source, record.viewType)
}

function resolveMobileViewHistoryItem(record: MobileViewHistoryRecord): MobileViewHistoryItem {
  const source = getSeriesForHistory(record.seriesId)
  const target = record.targetSeriesId ? getSeriesForHistory(record.targetSeriesId) : null
  const viewLabel = getHistoryViewLabel(record.viewType)
  const sourceName = getSeriesDisplayName(source, record.seriesId)
  const targetName = record.targetSeriesId ? getSeriesDisplayName(target, record.targetSeriesId) : ''
  const title = record.viewType === 'CompareStack'
    ? `${sourceName} vs ${targetName}`
    : record.viewType === 'PETCTFusion'
      ? `${sourceName} + ${targetName}`
      : sourceName
  const detailParts = [
    viewLabel,
    source ? formatSeriesMeta(source) : record.seriesId,
    target ? formatSeriesMeta(target) : ''
  ].filter(Boolean)
  return {
    ...record,
    detail: detailParts.join(' · '),
    openable: isMobileViewHistoryRecordOpenable(record),
    title,
    viewLabel
  }
}

function removeMobileViewHistoryRecord(recordId: string): void {
  mobileViewHistory.value = mobileViewHistory.value.filter((item) => item.id !== recordId)
}

async function openMobileViewHistoryRecord(record: MobileViewHistoryRecord): Promise<void> {
  if (!isMobileViewHistoryRecordOpenable(record)) {
    return
  }
  if (record.viewType === 'CompareStack' && record.targetSeriesId) {
    stopSlicePlayback()
    viewer.selectSeries(record.seriesId)
    activeCompareViewportKey.value = COMPARE_STACK_SOURCE_PANE_KEY
    await viewer.openSeriesCompare(record.seriesId, record.targetSeriesId)
    viewer.setActiveViewportKey(COMPARE_STACK_SOURCE_PANE_KEY)
    applyMobileViewDefaults('CompareStack')
    rememberMobileViewHistory('CompareStack', record.seriesId, record.targetSeriesId)
    dismissSheet()
    return
  }
  if (record.viewType === 'PETCTFusion' && record.targetSeriesId) {
    await openMobilePetCtFusion(record.seriesId, record.targetSeriesId)
    return
  }
  await openSeriesView(record.seriesId, record.viewType)
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
  if (viewType === 'Stack' || viewType === 'PET' || viewType === 'MPR' || viewType === '3D' || viewType === '4D') {
    applyMobileViewDefaults(viewType)
  }
  rememberMobileViewHistory(viewType, seriesId)
  dismissSheet()
}

async function openSeriesStack(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, 'Stack')
}

async function openSeriesPet(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, 'PET')
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
  rememberMobileViewHistory('CompareStack', sourceSeriesId, targetSeriesId)
  compareSourceSeriesId.value = null
  dismissSheet()
}

function canOpenFusionFromSeries(series: FolderSeriesItem): boolean {
  return canOpenFusion.value && getFusionCandidatesForSeries(series).length > 0
}

function isFusionSeriesActive(seriesId: string): boolean {
  const ids = activeFusionTab.value?.fusionSeriesIds
  return Boolean(ids?.ctSeriesId === seriesId || ids?.petSeriesId === seriesId)
}

async function openMobilePetCtFusion(sourceSeriesId: string, targetSeriesId: string): Promise<void> {
  const source = viewer.seriesList.value.find((series) => series.seriesId === sourceSeriesId) ?? null
  const target = viewer.seriesList.value.find((series) => series.seriesId === targetSeriesId) ?? null
  if (!source || !target) {
    return
  }
  const pair = resolveFusionPair(source, target)
  if (!pair) {
    viewer.showStatusToast(isZh.value ? '请选择一组 CT 和 PET 序列。' : 'Choose one CT series and one PET series.', 'error')
    return
  }

  stopSlicePlayback()
  activeFusionViewportKey.value = FUSION_OVERLAY_AXIAL_PANE_KEY
  await viewer.openPetCtFusion(pair.ctSeriesId, pair.petSeriesId)
  viewer.setActiveViewportKey(FUSION_OVERLAY_AXIAL_PANE_KEY)
  applyMobileViewDefaults('PETCTFusion')
  rememberMobileViewHistory('PETCTFusion', pair.ctSeriesId, pair.petSeriesId)
  fusionSourceSeriesId.value = null
  dismissSheet()
}

async function openFusionForSeries(seriesId: string): Promise<void> {
  if (!canOpenFusion.value) {
    return
  }
  const source = viewer.seriesList.value.find((series) => series.seriesId === seriesId) ?? null
  if (!source) {
    return
  }
  const candidates = getFusionCandidatesForSeries(source)
  const autoCandidate = getAutoFusionCandidateForSeries(source, candidates)
  if (autoCandidate) {
    await openMobilePetCtFusion(source.seriesId, autoCandidate.seriesId)
    return
  }
  if (candidates.length) {
    fusionSourceSeriesId.value = source.seriesId
    viewer.selectSeries(source.seriesId)
    openFocusedSheet('fusion')
    return
  }
  viewer.showStatusToast(isZh.value ? '未找到可融合的 CT/PET 配对序列。' : 'No CT/PET fusion pair was found.', 'error')
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
  return configuredPath || null
}

function resolveMobileSampleMode(): MobileSampleMode {
  const explicitMode = import.meta.env.VITE_MOBILE_SAMPLE_MODE?.trim().toLowerCase()
  if (explicitMode === 'local-path' || explicitMode === 'server-sample') {
    return explicitMode
  }
  return 'server-sample'
}

async function loadMobileDemoResponse() {
  const { postApi } = await loadTypedApi()
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
  const firstStackSeries = (
    loadedSeries.find((series) => series.isImageSeries !== false && isSeriesActionSupported(series, 'Stack')) ??
    loadedSeries.find((series) => series.isImageSeries !== false) ??
    loadedSeries[0] ??
    null
  )
  if (firstStackSeries) {
    const viewType = isSeriesActionSupported(firstStackSeries, 'Stack')
      ? 'Stack'
      : resolveInitialSeriesViewType(firstStackSeries)
    await openSeriesView(firstStackSeries.seriesId, viewType)
  }
}

async function applyMobileLoadResponse(response: LoadFolderResponse): Promise<void> {
  const loadedSeries = await viewer.applyLoadedDicomSeries(response, {
    openFirstSeriesView: false,
    selectLoadedSeries: true
  })
  await openFirstMobileLoadedSeries(loadedSeries)
  await nextTick()
  if (mobileSeriesList.value.length) {
    openSheet('series')
  }
}

async function loadMobileLocalSource(source: DicomLoadSource): Promise<LoadFolderResponse | null> {
  const { postApi, postDicomUpload } = await loadTypedApi()
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
  if (!canLoadDemo.value || isLoadingAnySource.value) {
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
  if (!canLoadLocal.value || isLoadingAnySource.value) {
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
  if (isCustomWindowDialogOpen.value) {
    closeCustomWindowPresetDialog()
  }
}

function closeInlineToolPanel(): void {
  activeInlineToolPanel.value = null
}

function openInlineToolPanel(panel: Exclude<MobileInlineToolPanel, null>): void {
  dismissSheet()
  activeInlineToolPanel.value = panel
  if (panel === 'measure') {
    setActiveMeasurementTool('line', { closeSheet: false })
  }
  if (panel === 'segmentation') {
    handleMprSegmentationModeChange(getActiveMobileSegmentationMode() ?? 'segmentation:threshold', activeMprViewportKey.value)
  }
  if (panel === 'fusion-registration') {
    mobileFusionRegistrationMode.value = 'translate'
  }
}

function toggleInlineToolPanel(panel: Exclude<MobileInlineToolPanel, null>): void {
  if (activeInlineToolPanel.value === panel) {
    closeInlineToolPanel()
    return
  }
  openInlineToolPanel(panel)
}

function openFocusedSheet(kind: MobileSheetTabKey): void {
  closeInlineToolPanel()
  activeSheetPresentation.value = 'focused'
  activeSheetKind.value = kind
}

function openMenuSheet(kind: MobileSheetTabKey): void {
  closeInlineToolPanel()
  activeSheetPresentation.value = 'menu'
  activeSheetKind.value = kind
}

function openSheet(kind: MobileSheetTabKey): void {
  openMenuSheet(kind)
}

function openMoreSheet(): void {
  if (activeCompareTab.value) {
    openMenuSheet('compare')
    return
  }
  if (activeFusionTab.value) {
    openMenuSheet('fusion')
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
  if (activeSheetKind.value === 'fusion') {
    fusionSourceSeriesId.value = null
  }
  if (activeSheetKind.value === 'series') {
    seriesActionSeriesId.value = null
  }
  dismissSheet()
}

function isSeriesSelected(seriesId: string): boolean {
  return seriesActionSeries.value?.seriesId === seriesId
}

function selectSeriesForActions(seriesId: string): void {
  seriesActionSeriesId.value = seriesId
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
    deltaY,
    exact: true
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

function formatWindowValue(ww: number, wl: number): string {
  return `${ww}|${wl}`
}

function formatWindowPresetValue(preset: WindowTemplatePreset): string {
  return formatWindowValue(preset.ww, preset.wl)
}

function formatWindowPresetDetail(preset: WindowTemplatePreset): string {
  return `WW ${Math.round(preset.ww)} / WL ${Math.round(preset.wl)}`
}

function applyWindowPreset(preset: WindowTemplatePreset): void {
  selectedWindowPresetId.value = preset.id
  const value = formatWindowPresetValue(preset)
  const activeTab = viewer.activeTab.value
  if (activeTab) {
    explicitWindowSelectionByTargetKey.set(getMobileWindowSelectionTargetKey(activeTab), value)
  }
  viewer.triggerViewAction({ action: 'windowPreset', value })
  dismissSheet()
}

function formatWindowInfoValue(info: WindowLevelInfo | null | undefined): string | null {
  if (!info || !Number.isFinite(info.ww) || !Number.isFinite(info.wl)) {
    return null
  }
  return formatWindowValue(info.ww, info.wl)
}

function getMobileWindowSelectionTargetKey(tab: ViewerTabItem): string {
  if (tab.viewType === 'Layout') {
    return `${tab.key}:${activeWorkspaceViewportKey.value}`
  }
  if (tab.viewType === 'CompareStack') {
    return `${tab.key}:${activeCompareViewportKey.value}`
  }
  if (tab.viewType === 'PETCTFusion') {
    return `${tab.key}:${activeFusionViewportKey.value}`
  }
  if (tab.viewType === 'MPR' || tab.viewType === '4D') {
    return `${tab.key}:${activeMprViewportKey.value}`
  }
  return `${tab.key}:single`
}

function getMobileInitialWindowSelectionValue(tab: ViewerTabItem): string | null {
  if (tab.viewType === 'Layout') {
    const slot = tab.layoutSlots?.find((item) => item.viewportKey === activeWorkspaceViewportKey.value || item.id === activeWorkspaceViewportKey.value) ?? tab.layoutSlots?.[0]
    return formatWindowInfoValue(slot?.initialWindowInfo)
  }
  if (tab.viewType === 'CompareStack') {
    return formatWindowInfoValue(tab.compareInitialWindowInfos?.[activeCompareViewportKey.value])
  }
  if (tab.viewType === 'PETCTFusion') {
    return formatWindowInfoValue(tab.fusionInitialWindowInfos?.[activeFusionViewportKey.value])
  }
  if (tab.viewType === 'MPR' || tab.viewType === '4D') {
    return formatWindowInfoValue(tab.viewportInitialWindowInfos?.[activeMprViewportKey.value] ?? tab.initialWindowInfo)
  }
  return formatWindowInfoValue(tab.initialWindowInfo)
}

function resetMobileWindowValue(): void {
  const activeTab = viewer.activeTab.value
  if (!activeTab) {
    return
  }
  const targetKey = getMobileWindowSelectionTargetKey(activeTab)
  const value = explicitWindowSelectionByTargetKey.get(targetKey) ?? getMobileInitialWindowSelectionValue(activeTab)
  if (!value) {
    return
  }
  const matchingPreset = windowPresets.value.find((preset) => formatWindowPresetValue(preset) === value)
  selectedWindowPresetId.value = matchingPreset?.id ?? ''
  viewer.triggerViewAction({ action: 'windowPreset', value })
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

function resetCustomWindowPresetForm(): void {
  customPresetZhName.value = ''
  customPresetEnName.value = ''
  customPresetWw.value = '400'
  customPresetWl.value = '40'
}

function openCustomWindowPresetDialog(): void {
  if (!canAddCustomWindowPreset.value) {
    return
  }
  isCustomWindowDialogOpen.value = true
}

function closeCustomWindowPresetDialog(): void {
  isCustomWindowDialogOpen.value = false
  resetCustomWindowPresetForm()
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
  isCustomWindowDialogOpen.value = false
  resetCustomWindowPresetForm()
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
  const presetKey = normalizePseudocolorPresetKey(value)
  handleToolbarViewAction({ action: 'pseudocolor', value: `pseudocolor:${presetKey}` })
  dismissSheet()
}

function resetPseudocolorToDefault(): void {
  const presetKey = normalizePseudocolorPresetKey(selectedPseudocolorKey.value)
  handleToolbarViewAction({ action: 'pseudocolor', value: `pseudocolor:${presetKey}` })
}

function applyFusionPseudocolor(value: string): void {
  handleToolbarViewAction({ action: 'fusionPseudocolor', value })
  dismissSheet()
}

function setFusionRegistrationMode(mode: 'translate' | 'rotate'): void {
  mobileFusionRegistrationMode.value = mode
  if (activeFusionTab.value?.fusionManualRegistration !== true) {
    viewer.triggerViewAction({ action: 'fusionManualRegistration', enabled: true })
  }
}

function toggleFusionRegistrationInlinePanel(): void {
  if (!activeFusionTab.value) {
    closeInlineToolPanel()
    return
  }
  toggleInlineToolPanel('fusion-registration')
}

function toggleFusionManualRegistration(): void {
  viewer.triggerViewAction({
    action: 'fusionManualRegistration',
    enabled: !(activeFusionTab.value?.fusionManualRegistration === true)
  })
}

function resetFusionRegistration(): void {
  viewer.triggerViewAction({ action: 'fusionRegistrationReset' })
}

function saveFusionRegistration(): void {
  viewer.triggerViewAction({ action: 'fusionRegistrationSave' })
}

function stopFusionManualRegistrationIfNeeded(): void {
  if (isFusionRegistrationEnabled.value) {
    viewer.triggerViewAction({ action: 'fusionManualRegistration', enabled: false })
  }
}

function closeFusionRegistrationInlinePanel(): void {
  closeInlineToolPanel()
  mobileFusionRegistrationMode.value = 'translate'
}

function resetFusionPetDisplay(): void {
  viewer.triggerViewAction({ action: 'fusionPetDisplayReset' })
}

function applyVolumeRenderMode(value: string): void {
  handleToolbarViewAction({ action: 'render3dMode', value })
  dismissSheet()
}

function applyVolumeOrientation(face: VolumeOrientationFace): void {
  handleToolbarViewAction({
    action: 'volumeOrientation',
    value: face,
    viewportKey: 'volume'
  })
  closeInlineToolPanel()
}

function applyVolumePreset(value: string): void {
  handleToolbarViewAction({ action: 'volumePreset', value })
  dismissSheet()
}

function applySurfacePreset(value: string): void {
  handleToolbarViewAction({ action: 'surfacePreset', value })
  dismissSheet()
}

function applyMobileLayoutTemplate(template: ViewerLayoutTemplate): void {
  void viewer.openLayoutView(template)
  closeInlineToolPanel()
}

function setMobileVolumeClipMode(mode: 'inside' | 'outside'): void {
  viewer.setActiveOperation(`${STACK_OPERATION_PREFIX}volumeClip:${mode}`)
}

function resetMobileVolumeClip(): void {
  viewer.triggerViewAction({ action: 'volumeClipReset' })
  viewer.setActiveOperation(`${STACK_OPERATION_PREFIX}rotate3d`)
  closeInlineToolPanel()
}

function applyTransform(value: string): void {
  handleToolbarViewAction({ action: 'rotate', value })
  dismissSheet()
}

function handleResetView(options: { keepSheetOpen?: boolean } = {}): void {
  handleToolbarViewAction({ action: 'reset' })
  if (!options.keepSheetOpen) {
    dismissSheet()
  }
}

function applyResetOption(value: string, options: { keepSheetOpen?: boolean } = {}): void {
  if (value === 'reset:annotations') {
    handleToolbarViewAction({ action: 'clearAnnotations' })
  } else if (value === 'reset:mtf') {
    viewer.handleMtfClear()
  } else if (value === 'reset:all') {
    handleToolbarViewAction({ action: 'resetAll' })
  } else if (value === 'reset:measurements') {
    handleToolbarViewAction({ action: 'clearMeasurements' })
  } else if (value === 'transform:reset') {
    handleToolbarViewAction({ action: 'transformReset' })
  } else if (value === 'window:reset') {
    resetMobileWindowValue()
  } else {
    handleToolbarViewAction({ action: 'reset' })
  }
  if (!options.keepSheetOpen) {
    dismissSheet()
  }
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

function handleMprSegmentationConfigChange(config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType): void {
  viewer.triggerViewAction({
    action: 'mprSegmentation',
    actionType,
    segmentationConfig: config
  })
}

function clampMobileNumber(value: string | number, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, parsed))
}

function handleMobileNumberInputKeydown(event: KeyboardEvent, allowNegative = false): void {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return
  }
  if (event.key === 'e' || event.key === 'E' || event.key === '+' || (!allowNegative && event.key === '-')) {
    event.preventDefault()
  }
}

function patchMobileThresholdRegion(region: MprThresholdRegion, patch: Partial<MprThresholdRegion>, actionType: MprSegmentationConfigActionType): void {
  const currentConfig = activeMprSegmentationConfig.value
  handleMprSegmentationConfigChange({
    ...currentConfig,
    selectedRegionId: region.id,
    selectedVoi: false,
    selectedVoiId: null,
    thresholdRegions: currentConfig.thresholdRegions.map((item) => (
      item.id === region.id
        ? {
            ...item,
            ...patch,
            stats: patch.stats === undefined ? item.stats : patch.stats
          }
        : item
    ))
  }, actionType)
}

function updateMobileThresholdHu(region: MprThresholdRegion, rawValue: string | number, actionType: MprSegmentationConfigActionType): void {
  const value = Math.round(clampMobileNumber(rawValue, MPR_SEGMENTATION_HU_LIMITS.min, MPR_SEGMENTATION_HU_LIMITS.max, region.thresholdHu))
  patchMobileThresholdRegion(region, { thresholdHu: value, stats: null }, actionType)
}

function updateMobileThresholdPercentile(region: MprThresholdRegion, rawValue: string | number, actionType: MprSegmentationConfigActionType): void {
  const value = clampMobileNumber(rawValue, 0, 100, region.thresholdPercentile)
  patchMobileThresholdRegion(region, { thresholdPercentile: value, stats: null }, actionType)
}

function updateMobileThresholdDepth(region: MprThresholdRegion, rawValue: string | number, actionType: MprSegmentationConfigActionType): void {
  const depthMm = clampMobileNumber(
    rawValue,
    MPR_SEGMENTATION_DEPTH_LIMITS.min,
    MPR_SEGMENTATION_DEPTH_LIMITS.max,
    region.box.depthMm
  )
  patchMobileThresholdRegion(region, { box: { ...region.box, depthMm }, stats: null }, actionType)
}

function ensureMprSegmentationEnabled(): void {
  if (!activeMprTab.value) {
    return
  }
  const currentConfig = activeMprSegmentationConfig.value
  if (currentConfig.enabled) {
    return
  }
  viewer.triggerViewAction({
    action: 'mprSegmentation',
    actionType: 'end',
    segmentationConfig: {
      ...currentConfig,
      enabled: true
    }
  })
}

function handleMprSegmentationModeChange(mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null): void {
  ensureMprSegmentationEnabled()
  viewer.setActiveOperation(`${STACK_OPERATION_PREFIX}${mode}`)
  if (viewportKey && isMprViewportKey(viewportKey)) {
    selectMprViewport(viewportKey)
  }
  activeTool.value = 'segmentation'
}

function handleCompareActiveViewportChange(viewportKey: CompareStackPaneKey): void {
  activeCompareViewportKey.value = viewportKey
  viewer.setActiveViewportKey(viewportKey)
}

function handleFusionActiveViewportChange(viewportKey: string): void {
  if (viewportKey === FUSION_CT_AXIAL_PANE_KEY || viewportKey === FUSION_PET_AXIAL_PANE_KEY || viewportKey === FUSION_OVERLAY_AXIAL_PANE_KEY || viewportKey === FUSION_PET_CORONAL_MIP_PANE_KEY) {
    activeFusionViewportKey.value = viewportKey
    viewer.setActiveViewportKey(viewportKey)
  }
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
  const tab = activeStackLikeTab.value
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
  return item.series ? isSeriesActionSupported(item.series, resolveInitialSeriesViewType(item.series)) : false
}

async function openFavoriteSlice(item: MobileFavoriteSliceItem): Promise<void> {
  if (!canOpenFavoriteSlice(item)) {
    return
  }

  const viewType = item.series ? resolveInitialSeriesViewType(item.series) : 'Stack'
  await openSeriesView(item.seriesId, viewType)
  await nextTick()
  const openedSlice = activeStackLikeTab.value?.seriesId === item.seriesId ? parseSliceLabel(activeStackLikeTab.value.sliceLabel) : null
  const currentIndex = openedSlice?.index ?? 0
  const deltaY = item.sliceIndex - currentIndex
  if (deltaY) {
    viewer.handleViewportWheel({ viewportKey: 'single', deltaY, exact: true })
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

function getSlicePlaybackIntervalMs(fps = activePlaybackFps.value): number {
  return Math.max(34, Math.round(1000 / fps))
}

function startSlicePlaybackTimer(tick: () => void, fps = activePlaybackFps.value): void {
  clearSlicePlaybackTimer()
  playbackTimer = window.setInterval(tick, getSlicePlaybackIntervalMs(fps))
}

function resetSlicePlaybackTarget(sliceInfo: { current: number; total: number; viewportKey: string }): MobileSlicePlaybackTarget {
  return {
    current: sliceInfo.current,
    total: sliceInfo.total,
    viewportKey: sliceInfo.viewportKey
  }
}

function tickStackPlayback(): void {
  if (!activeSlicePlaybackTarget || activeSlicePlaybackTarget.current >= activeSlicePlaybackTarget.total) {
    stopStackPlayback()
    return
  }

  activeSlicePlaybackTarget.current += 1
  viewer.handleViewportWheel({ viewportKey: activeSlicePlaybackTarget.viewportKey, deltaY: 1 })
}

function startStackPlayback(): void {
  if (!canPlayStack.value) {
    return
  }
  const sliceInfo = getCurrentStackSliceInfo()
  if (!sliceInfo) {
    return
  }
  stopSlicePlayback()
  activeSlicePlaybackTarget = resetSlicePlaybackTarget({ ...sliceInfo, viewportKey: 'single' })
  isPlayingStack.value = true
  startSlicePlaybackTimer(tickStackPlayback, playbackFps.value)
}

function clearSlicePlaybackTimer(): void {
  if (playbackTimer != null) {
    window.clearInterval(playbackTimer)
    playbackTimer = null
  }
}

function stopStackPlayback(): void {
  clearSlicePlaybackTimer()
  activeSlicePlaybackTarget = null
  isPlayingStack.value = false
}

function tickMprPlayback(): void {
  if (!activeSlicePlaybackTarget || activeSlicePlaybackTarget.current >= activeSlicePlaybackTarget.total) {
    stopMprPlayback()
    return
  }

  activeSlicePlaybackTarget.current += 1
  viewer.handleViewportWheel({ viewportKey: activeSlicePlaybackTarget.viewportKey, deltaY: 1 })
}

function startMprPlayback(): void {
  if (!canPlayMpr.value || isPlayingFourD.value || fourDPlaybackStarting.value) {
    return
  }
  const sliceInfo = getCurrentMprSliceInfo()
  if (!sliceInfo) {
    return
  }
  stopSlicePlayback()
  activeSlicePlaybackTarget = resetSlicePlaybackTarget(sliceInfo)
  isPlayingMpr.value = true
  startSlicePlaybackTimer(tickMprPlayback)
}

function stopMprPlayback(): void {
  clearSlicePlaybackTimer()
  activeSlicePlaybackTarget = null
  isPlayingMpr.value = false
}

function stopSlicePlayback(): void {
  clearSlicePlaybackTimer()
  activeSlicePlaybackTarget = null
  isPlayingStack.value = false
  isPlayingMpr.value = false
}

function restartActiveSlicePlaybackTimer(fps = activePlaybackFps.value): void {
  if (isPlayingStack.value) {
    startSlicePlaybackTimer(tickStackPlayback, fps)
    return
  }
  if (isPlayingMpr.value) {
    startSlicePlaybackTimer(tickMprPlayback, fps)
  }
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
  if (!tab || !canPlayFourD.value || fourDPlaybackStarting.value || isPlayingActiveSlicePlayback.value) {
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

function toggleFourDPhasePlayback(): void {
  if (!activeFourDTab.value) {
    return
  }
  dismissSheet()
  activeTool.value = 'play'
  activeInlineToolPanel.value = 'playback'
  toggleFourDPlayback()
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

function toggleSlicePlayback(): void {
  if (activeMprLikeTab.value) {
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
    restartActiveSlicePlaybackTimer(value)
    return
  }
  playbackFps.value = value
  restartActiveSlicePlaybackTimer(value)
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
  if (!tab || tab.fourDIsPlaying || fourDPlaybackStarting.value || isPlayingActiveSlicePlayback.value) {
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
  if (activeInlineToolPanel.value === 'fusion-registration' && activeTool.value === 'window') {
    return tool.key === 'window'
  }
  const inlineParentKey = getInlinePanelParentToolKey(activeInlineToolPanel.value)
  if (inlineParentKey) {
    return tool.key === inlineParentKey
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
    return false
  }
  if (tool.key === 'transform') {
    return activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'transform'
  }
  if (tool.key === 'layout') {
    return activeInlineToolPanel.value === 'layout'
  }
  if (tool.key === 'export') {
    return activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'export'
  }
  if (tool.key === 'volumeParams') {
    return activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'volumeParams'
  }
  if (tool.key === 'volumeRemoveBed') {
    return false
  }
  if (tool.key === 'volumeClip') {
    return getNormalizedMobileOperation(viewer.activeOperation.value).startsWith('volumeClip:')
  }
  if (tool.key === 'fusion') {
    return (activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'fusion') ||
      activeFusionTab.value?.fusionManualRegistration === true
  }
  if (tool.key === 'segmentation') {
    return (activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'segmentation') ||
      getActiveMobileSegmentationMode() != null
  }
  if (tool.key === 'play') {
    return activeFourDTab.value ? (isPlayingFourD.value || fourDPlaybackStarting.value) : isPlayingActiveSlicePlayback.value
  }
  return activeTool.value === tool.key
}

function isToolbarItemPanelOpen(tool: MobileToolbarItem): boolean {
  return tool.key === 'color' && activeSheetPresentation.value === 'focused' && activeSheetKind.value === 'color'
}

function isToolbarItemStateOn(tool: MobileToolbarItem): boolean {
  return tool.key === 'volumeRemoveBed' && activeVolumeTab.value?.volumeRenderOptions?.removeBed === true
}

function isToolbarItemDisabled(tool: MobileToolbarItem): boolean {
  if (isAnyPlaybackActive.value && tool.key !== 'play') {
    return true
  }
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
  if (tool.key === 'volumeRemoveBed' || tool.key === 'volumeClip') {
    return !activeVolumeTab.value
  }
  if (tool.key === 'fusion') {
    return !activeFusionTab.value
  }
  if (tool.key === 'segmentation') {
    return !activeMprTab.value
  }
  if (tool.key === 'export') {
    return !activeImageTab.value
  }
  return !activeImageTab.value
}

function isFusionRegistrationExitToolKey(key: MobileToolbarKey): key is FusionRegistrationExitToolKey {
  return key === 'pan' || key === 'zoom' || key === 'scroll' || key === 'crosshair' || key === 'rotate3d'
}

function handleFusionRegistrationPrimaryTool(tool: MobileToolbarItem): boolean {
  if (activeInlineToolPanel.value !== 'fusion-registration') {
    return false
  }

  if (tool.key === 'fusion') {
    return false
  }

  if (tool.key === 'window') {
    setActiveMobileTool('window', { closeInlinePanel: false })
    return true
  }

  if (isFusionRegistrationExitToolKey(tool.key)) {
    closeFusionRegistrationInlinePanel()
    stopFusionManualRegistrationIfNeeded()
    setActiveMobileTool(tool.key)
    return true
  }

  if (tool.key === 'measure') {
    closeFusionRegistrationInlinePanel()
    stopFusionManualRegistrationIfNeeded()
    openInlineToolPanel('measure')
    return true
  }

  if (tool.key === 'annotate') {
    closeFusionRegistrationInlinePanel()
    stopFusionManualRegistrationIfNeeded()
    setActiveMobileTool('annotate')
    return true
  }

  if (tool.key === 'reset') {
    closeFusionRegistrationInlinePanel()
    stopFusionManualRegistrationIfNeeded()
    handleResetView()
    return true
  }

  return false
}

function handleToolbarItem(tool: MobileToolbarItem): void {
  if (handleFusionRegistrationPrimaryTool(tool)) {
    return
  }

  if (tool.key === 'more') {
    openMoreSheet()
    return
  }
  if (tool.key === 'measure') {
    if (activeFusionTab.value) {
      stopFusionManualRegistrationIfNeeded()
    }
    toggleInlineToolPanel('measure')
    return
  }
  if (tool.key === 'annotate') {
    if (activeFusionTab.value) {
      stopFusionManualRegistrationIfNeeded()
    }
    setActiveMobileTool('annotate')
    return
  }
  if (tool.key === 'qa') {
    toggleInlineToolPanel('qa')
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
    toggleInlineToolPanel('transform')
    return
  }
  if (tool.key === 'volumeOrientation') {
    toggleInlineToolPanel('volume-orientation')
    return
  }
  if (tool.key === 'layout') {
    toggleInlineToolPanel('layout')
    return
  }
  if (tool.key === 'play') {
    toggleInlineToolPanel('playback')
    return
  }
  if (tool.key === 'volumeParams') {
    openFocusedSheet('volumeParams')
    return
  }
  if (tool.key === 'volumeRemoveBed') {
    viewer.triggerViewAction({
      action: 'volumeRenderOptions',
      enabled: !(activeVolumeTab.value?.volumeRenderOptions?.removeBed === true)
    })
    return
  }
  if (tool.key === 'volumeClip') {
    setMobileVolumeClipMode('inside')
    toggleInlineToolPanel('volume-clip')
    return
  }
  if (tool.key === 'fusion') {
    toggleFusionRegistrationInlinePanel()
    return
  }
  if (tool.key === 'fusionRegistrationToggle') {
    toggleFusionManualRegistration()
    return
  }
  if (tool.key === 'fusionRegistrationTranslate') {
    setFusionRegistrationMode('translate')
    return
  }
  if (tool.key === 'fusionRegistrationRotate') {
    setFusionRegistrationMode('rotate')
    return
  }
  if (tool.key === 'fusionRegistrationReset') {
    resetFusionRegistration()
    return
  }
  if (tool.key === 'fusionRegistrationSave') {
    saveFusionRegistration()
    return
  }
  if (tool.key === 'segmentation') {
    toggleInlineToolPanel('segmentation')
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
    closeInlineToolPanel()
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
    if (viewType === 'PETCTFusion') {
      activeFusionViewportKey.value = FUSION_OVERLAY_AXIAL_PANE_KEY
      viewer.setActiveViewportKey(FUSION_OVERLAY_AXIAL_PANE_KEY)
      applyMobileViewDefaults('PETCTFusion')
      return
    }
    if (viewType === 'Stack' || viewType === 'PET') {
      applyMobileViewDefaults(viewType)
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
    closeInlineToolPanel()
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
    if (activeStackLikeTab.value || activeCompareTab.value || activeFusionTab.value) {
      applyDefaultToolForView(activeCompareTab.value ? 'CompareStack' : activeFusionTab.value ? 'PETCTFusion' : activePetTab.value ? 'PET' : 'Stack')
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
    restartActiveSlicePlaybackTimer(value)
  }
)

watch(
  [isPlayingFourD, activeFourDTab],
  ([isPlaying, tab]) => {
    if (isPlaying) {
      stopSlicePlayback()
    }
    if (isPlaying || !tab) {
      clearFourDPlaybackStarting()
    }
  }
)

watch(
  [defaultShowCornerInfo, defaultShowPseudocolorBar, defaultShowScaleBar],
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
      <div v-if="!hasLoadedSeries" class="mobile-shell__brand-title" data-testid="mobile-brand-title">
        <div class="mobile-shell__brand-mark" aria-hidden="true">
          <span class="mobile-shell__brand-mark-frame"></span>
          <span class="mobile-shell__brand-mark-slice mobile-shell__brand-mark-slice--top"></span>
          <span class="mobile-shell__brand-mark-slice mobile-shell__brand-mark-slice--bottom"></span>
          <span class="mobile-shell__brand-mark-letters">DV</span>
        </div>
        <div class="mobile-shell__brand-copy">DicomVision</div>
      </div>
      <button v-else type="button" class="mobile-shell__title-group" data-testid="mobile-title-series-button" @click="openSheet('series')">
        <div class="mobile-shell__title">{{ activeTitle }}</div>
        <span class="mobile-shell__title-action" aria-hidden="true">
          <AppIcon name="chevron-down" :size="15" />
        </span>
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
        v-if="activeStackLikeTab"
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

      <MobilePetCtFusionViewport
        v-else-if="activeFusionTab"
        :active-operation="viewer.activeOperation.value"
        :active-tab="viewer.activeTab.value"
        :active-viewport-key="activeFusionViewportKey"
        :annotation-pointer-cancel="handleAnnotationPointerCancel"
        :annotation-pointer-down="handleAnnotationPointerDown"
        :annotation-pointer-leave="handleAnnotationPointerLeave"
        :annotation-pointer-move="handleAnnotationPointerMove"
        :annotation-pointer-up="handleAnnotationPointerUp"
        :get-annotations="getAnnotations"
        :get-draft-annotation="getDraftAnnotation"
        :get-measurements="getCommittedMeasurements"
        :is-view-loading="viewer.isViewLoading.value"
        :registration-mode="activeFusionTab.fusionManualRegistration ? mobileFusionRegistrationMode : 'none'"
        :scroll-threshold="scrollDragThreshold"
        @active-viewport-change="handleFusionActiveViewportChange"
        @copy-annotation="handleAnnotationCopy"
        @delete-annotation="handleAnnotationDelete"
        @fusion-registration-drag="viewer.handleFusionRegistrationDrag"
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
        @volume-clip="viewer.handleVolumeClip"
        @volume-orientation-select="applyVolumeOrientation"
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
        :mpr-segmentation-config="activeMprTab ? activeMprSegmentationConfig : null"
        :mpr-segmentation-default-threshold-color="mprSegmentationDefaultThresholdColor"
        :mpr-segmentation-default-voi-color="mprSegmentationDefaultVoiColor"
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
        @mpr-segmentation-config-change="handleMprSegmentationConfigChange"
        @mpr-segmentation-mode-change="handleMprSegmentationModeChange"
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
          <div class="mobile-shell__empty-title">DicomVision</div>
          <div class="mobile-shell__source-actions">
            <button
              type="button"
              class="mobile-shell__source-action mobile-shell__source-action--primary"
              data-testid="mobile-load-demo"
              :disabled="!canLoadDemo || isLoadingAnySource"
              @click="loadDemoSeries"
            >
              <AppIcon :name="isLoadingDemo ? 'loading' : 'play'" :size="18" :class="{ 'mobile-shell__loading-icon': isLoadingDemo }" />
              <span>{{ isLoadingDemo ? (isZh ? '正在加载...' : 'Loading...') : (isZh ? 'Demo 影像' : 'Demo') }}</span>
            </button>
            <button
              type="button"
              class="mobile-shell__source-action"
              data-testid="mobile-load-local"
              :disabled="!canLoadLocal || isLoadingAnySource"
              @click="loadLocalFolder"
            >
              <AppIcon :name="isLoadingLocal ? 'loading' : 'folder-upload'" :size="18" :class="{ 'mobile-shell__loading-icon': isLoadingLocal }" />
              <span>{{ isLoadingLocal ? (isZh ? '正在加载...' : 'Loading...') : (isZh ? '本地文件夹' : 'Local Folder') }}</span>
            </button>
            <button
              type="button"
              class="mobile-shell__source-action"
              data-testid="mobile-open-pacs"
              :disabled="!canOpenPacs || isLoadingAnySource"
              @click="isPacsBrowserOpen = true"
            >
              <AppIcon name="pacs" :size="18" />
              <span>PACS</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="fourDPlaybackStarting" class="mobile-shell__playback-loading" role="status" data-testid="mobile-four-d-loading">
        <AppIcon name="loading" :size="18" class="mobile-shell__loading-icon" />
        <span>{{ isZh ? '正在准备 4D 播放...' : 'Preparing 4D playback...' }}</span>
      </div>
      <div
        v-if="showMobileSegmentationInlineControl"
        class="mobile-shell__segmentation-floating-control"
        data-testid="mobile-segmentation-threshold-control"
      >
        <template v-if="selectedMobileThresholdRegion">
          <label class="mobile-shell__segmentation-floating-field">
            <span>{{ selectedMobileThresholdRegion.thresholdMode === 'percentile' ? '%' : 'HU' }}</span>
            <input
              v-if="selectedMobileThresholdRegion.thresholdMode === 'percentile'"
              class="mobile-shell__segmentation-floating-slider"
              data-testid="mobile-segmentation-threshold-slider"
              type="range"
              min="0"
              max="100"
              step="0.5"
              :value="selectedMobileThresholdRegion.thresholdPercentile"
              @input.stop="updateMobileThresholdPercentile(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'local')"
              @change.stop="updateMobileThresholdPercentile(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              v-else
              class="mobile-shell__segmentation-floating-slider"
              data-testid="mobile-segmentation-threshold-slider"
              type="range"
              :min="MPR_SEGMENTATION_HU_LIMITS.min"
              :max="MPR_SEGMENTATION_HU_LIMITS.max"
              step="1"
              :value="selectedMobileThresholdRegion.thresholdHu"
              @input.stop="updateMobileThresholdHu(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'local')"
              @change.stop="updateMobileThresholdHu(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              v-if="selectedMobileThresholdRegion.thresholdMode === 'percentile'"
              class="mobile-shell__segmentation-floating-value"
              data-testid="mobile-segmentation-threshold-input"
              type="number"
              inputmode="decimal"
              autocomplete="off"
              min="0"
              max="100"
              step="0.5"
              :value="selectedMobileThresholdRegion.thresholdPercentile"
              @keydown="handleMobileNumberInputKeydown($event)"
              @input.stop="updateMobileThresholdPercentile(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'local')"
              @change.stop="updateMobileThresholdPercentile(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              v-else
              class="mobile-shell__segmentation-floating-value"
              data-testid="mobile-segmentation-threshold-input"
              type="number"
              inputmode="decimal"
              autocomplete="off"
              :min="MPR_SEGMENTATION_HU_LIMITS.min"
              :max="MPR_SEGMENTATION_HU_LIMITS.max"
              step="1"
              :value="selectedMobileThresholdRegion.thresholdHu"
              @keydown="handleMobileNumberInputKeydown($event, true)"
              @input.stop="updateMobileThresholdHu(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'local')"
              @change.stop="updateMobileThresholdHu(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'end')"
            />
          </label>
          <label class="mobile-shell__segmentation-floating-field">
            <span>{{ isZh ? '深度' : 'Depth' }}</span>
            <input
              class="mobile-shell__segmentation-floating-slider"
              data-testid="mobile-segmentation-depth-slider"
              type="range"
              :min="MPR_SEGMENTATION_DEPTH_LIMITS.min"
              :max="MPR_SEGMENTATION_DEPTH_LIMITS.max"
              step="0.5"
              :value="selectedMobileThresholdRegion.box.depthMm"
              @input.stop="updateMobileThresholdDepth(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'local')"
              @change.stop="updateMobileThresholdDepth(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              class="mobile-shell__segmentation-floating-value"
              data-testid="mobile-segmentation-depth-input"
              type="number"
              inputmode="decimal"
              autocomplete="off"
              :min="MPR_SEGMENTATION_DEPTH_LIMITS.min"
              :max="MPR_SEGMENTATION_DEPTH_LIMITS.max"
              step="0.5"
              :value="selectedMobileThresholdRegion.box.depthMm"
              @keydown="handleMobileNumberInputKeydown($event)"
              @input.stop="updateMobileThresholdDepth(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'local')"
              @change.stop="updateMobileThresholdDepth(selectedMobileThresholdRegion, ($event.target as HTMLInputElement).value, 'end')"
            />
          </label>
        </template>
        <div v-else class="mobile-shell__segmentation-floating-empty" data-testid="mobile-segmentation-threshold-empty">
          {{ isZh ? '绘制矩形区域后可调整阈值和深度' : 'Draw a region to adjust threshold and depth.' }}
        </div>
      </div>
    </main>

    <section
      v-if="showSlicePanel"
      class="mobile-shell__slice-panel"
      :class="{
        'mobile-shell__slice-panel--mpr': activeMprLikeTab,
        'mobile-shell__slice-panel--stack': activeStackLikeTab
      }"
      aria-label="Slice navigation"
    >
      <div v-if="activeMprTab" class="mobile-shell__plane-tabs" data-testid="mobile-mpr-plane-tabs">
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
      <div v-if="activeFourDTab" class="mobile-shell__slice-control-row mobile-shell__four-d-phase" data-testid="mobile-four-d-phase-panel">
        <div class="mobile-shell__four-d-copy">
          <span>{{ isZh ? '时相' : 'Phase' }}</span>
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
          :disabled="fourDPhaseCount <= 1 || isPlayingFourD || fourDPlaybackStarting || isPlayingActiveSlicePlayback"
          @change="handleFourDPhaseSliderInput"
          @input="handleFourDPhaseSliderInput"
        />
        <button
          type="button"
          class="mobile-shell__slice-icon-button mobile-shell__phase-play"
          :class="{ 'mobile-shell__slice-play--active': isPlayingFourD || fourDPlaybackStarting }"
          data-testid="mobile-four-d-phase-play"
          :aria-label="activePlayLabel"
          :disabled="!canPlayActive || fourDPlaybackStarting"
          @click="toggleFourDPhasePlayback"
        >
          <AppIcon :name="activePlayIcon" :size="20" />
        </button>
      </div>
      <div class="mobile-shell__slice-control-row">
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
          :disabled="!activeSlice || isPlayingFourD || fourDPlaybackStarting || isPlayingActiveSlicePlayback"
          @change="handleSliceSliderCommit"
          @input="handleSliceSliderInput"
          @pointercancel="finishSliceSliderInteraction"
          @pointerdown="beginSliceSliderInteraction"
          @pointerup="finishSliceSliderInteraction"
        />
        <span v-if="showSlicePlayButton || activeStackLikeTab" class="mobile-shell__slice-actions">
          <button
            v-if="activeStackLikeTab"
            type="button"
            class="mobile-shell__slice-icon-button mobile-shell__slice-star"
            :class="{ 'mobile-shell__slice-star--active': isCurrentStackSliceStarred }"
            data-testid="mobile-toggle-star"
            :aria-label="isCurrentStackSliceStarred ? (isZh ? '移除当前关键切片' : 'Remove current key slice') : (isZh ? '标记当前关键切片' : 'Mark current key slice')"
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
            :class="{ 'mobile-shell__slice-play--active': isPlayingActiveSlicePlayback }"
            data-testid="mobile-slice-play"
            :aria-label="activeSlicePlayLabel"
            :disabled="!canPlaySlicePlayback && !isPlayingActiveSlicePlayback"
            @click="toggleSlicePlayback"
          >
            <AppIcon :name="activeSlicePlayIcon" :size="20" />
          </button>
        </span>
      </div>
    </section>

    <nav
      v-if="activeImageTab"
      class="mobile-shell__toolbar"
      aria-label="Viewer tools"
    >
      <div class="mobile-shell__toolbar-row" :style="{ gridTemplateColumns: `repeat(${primaryMobileTools.length}, minmax(0, 1fr))` }">
        <button
          v-for="tool in primaryMobileTools"
          :key="`primary-${tool.key}`"
          type="button"
          class="mobile-shell__tool"
          :class="{
            'mobile-shell__tool--active': isToolbarItemActive(tool),
            'mobile-shell__tool--panel-open': isToolbarItemPanelOpen(tool),
            'mobile-shell__tool--state-on': isToolbarItemStateOn(tool)
          }"
          :aria-pressed="tool.key === 'volumeRemoveBed' ? isToolbarItemStateOn(tool) : undefined"
          :disabled="isToolbarItemDisabled(tool)"
          :data-testid="`mobile-tool-${tool.key}`"
          @click="handleToolbarItem(tool)"
        >
          <AppIcon :name="tool.icon" :size="22" />
          <span>{{ tool.label }}</span>
        </button>
      </div>
      <div
        v-if="activeInlineToolPanel"
        class="mobile-shell__inline-tool-panel"
        :class="{ 'mobile-shell__inline-tool-panel--icon-only': isIconOnlyInlineToolPanel }"
        data-testid="mobile-inline-tool-panel"
      >
        <button
          type="button"
          class="mobile-shell__submenu-back"
          :aria-label="isZh ? '返回一级菜单' : 'Back to tools'"
          data-testid="mobile-inline-tool-back"
          @click="closeInlineToolPanel"
        >
          <AppIcon name="chevron-left" :size="22" />
        </button>
        <div class="mobile-shell__inline-tool-header" aria-hidden="true">
          <strong>{{ isZh ? '配准' : 'REG' }}</strong>
          <span>{{ isZh ? 'PET 层' : 'PET layer' }}</span>
        </div>
        <div v-if="activeInlineToolPanel === 'playback'" class="mobile-shell__inline-playback" data-testid="mobile-inline-playback-panel">
          <button
            type="button"
            class="mobile-shell__inline-playback-toggle"
            data-testid="mobile-inline-playback-toggle"
            :disabled="!canPlayActive || fourDPlaybackStarting"
            :aria-label="activePlayLabel"
            @click="toggleActivePlayback"
          >
            <AppIcon :name="activePlayIcon" :size="16" />
            <span>{{ activePlayLabel }}</span>
          </button>
          <div class="mobile-shell__inline-fps-control" data-testid="mobile-inline-playback-fps-control">
            <div class="mobile-shell__inline-fps-label">
              <span>FPS</span>
              <strong>{{ activePlaybackFps }}</strong>
            </div>
            <input
              class="mobile-shell__inline-fps-slider"
              data-testid="mobile-inline-playback-fps-slider"
              type="range"
              min="0"
              :max="MOBILE_STACK_PLAYBACK_FPS_OPTIONS.length - 1"
              step="1"
              :value="activePlaybackFpsIndex"
              :disabled="!canPlayActive"
              @change="handlePlaybackFpsSliderInput"
              @input="handlePlaybackFpsSliderInput"
            />
          </div>
        </div>
        <div v-else class="mobile-shell__inline-tool-track">
          <button
            v-for="tool in activeInlineTools"
            :key="`inline-${tool.key}`"
            type="button"
            class="mobile-shell__inline-tool"
            :class="{
              'mobile-shell__inline-tool--active': tool.active,
              'mobile-shell__inline-tool--danger': tool.tone === 'danger',
              'mobile-shell__inline-tool--warm': tool.tone === 'warm',
              'mobile-shell__inline-tool--text-only': !tool.icon,
              'mobile-shell__inline-tool--icon-action': tool.iconOnly
            }"
            :disabled="tool.disabled"
            :aria-label="tool.label"
            :title="tool.label"
            :data-testid="`mobile-tool-${tool.key}`"
            @click="tool.onClick"
          >
            <span v-if="tool.icon" class="mobile-shell__inline-tool-icon" aria-hidden="true">
              <AppIcon :name="tool.icon" :size="22" />
            </span>
            <span v-if="!tool.iconOnly" class="mobile-shell__inline-tool-label">
              <span v-if="tool.orientationLabel" class="mobile-shell__orientation-option-label">
                <span class="mobile-shell__orientation-option-initial">{{ tool.orientationLabel.initial }}</span>
                <span class="mobile-shell__orientation-option-suffix">{{ tool.orientationLabel.suffix }}</span>
                <span v-if="tool.orientationSecondaryLabel" class="mobile-shell__orientation-option-secondary">{{ tool.orientationSecondaryLabel }}</span>
              </span>
              <template v-else>{{ tool.label }}</template>
            </span>
          </button>
        </div>
        <div v-if="activeInlineToolPanel === 'volume-clip'" class="mobile-shell__inline-tool-footer" data-testid="mobile-volume-clip-footer">
          <button
            type="button"
            class="mobile-shell__inline-footer-action"
            data-testid="mobile-tool-volume-clip-reset"
            @click="resetMobileVolumeClip"
          >
            <AppIcon name="reset" :size="15" />
            <span>{{ isZh ? '重置裁剪' : 'Reset Clip' }}</span>
          </button>
        </div>
        <div v-if="activeInlineToolPanel === 'volume-orientation'" class="mobile-shell__inline-tool-footer" data-testid="mobile-volume-orientation-footer">
          <button
            type="button"
            class="mobile-shell__inline-footer-action"
            data-testid="mobile-tool-volume-orientation-reset"
            @click="applyVolumeOrientation(DEFAULT_VOLUME_ORIENTATION_FACE)"
          >
            <AppIcon name="reset" :size="15" />
            <span>{{ isZh ? '重置朝向' : 'Reset Orientation' }}</span>
          </button>
        </div>
        <div
          v-if="false && showMobileSegmentationInlineControl"
          class="mobile-shell__inline-segmentation-control"
          data-testid="mobile-segmentation-threshold-control"
        >
          <template v-if="false"></template>
          <div v-else class="mobile-shell__inline-segmentation-empty" data-testid="mobile-segmentation-threshold-empty">
            {{ isZh ? '绘制矩形区域后可调整阈值' : 'Draw a region to adjust the threshold.' }}
          </div>
        </div>
      </div>
      <div v-else class="mobile-shell__toolbar-row" :style="{ gridTemplateColumns: `repeat(${visibleSecondaryMobileTools.length}, minmax(0, 1fr))` }">
        <button
          v-for="tool in visibleSecondaryMobileTools"
          :key="`secondary-${tool.key}`"
          type="button"
          class="mobile-shell__tool"
          :class="{
            'mobile-shell__tool--active': isToolbarItemActive(tool),
            'mobile-shell__tool--panel-open': isToolbarItemPanelOpen(tool),
            'mobile-shell__tool--state-on': isToolbarItemStateOn(tool)
          }"
          :aria-pressed="tool.key === 'volumeRemoveBed' ? isToolbarItemStateOn(tool) : undefined"
          :disabled="isToolbarItemDisabled(tool)"
          :data-testid="tool.key === 'more' ? 'mobile-more-button' : `mobile-tool-${tool.key}`"
          @click="handleToolbarItem(tool)"
        >
          <AppIcon :name="tool.icon" :size="22" />
          <span>{{ tool.label }}</span>
        </button>
      </div>
    </nav>
    <footer v-if="isWebPlatform && !activeImageTab" class="mobile-shell__icp-footer">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">ICP 026017376</a>
    </footer>

    <div v-if="activeSheetKind" class="mobile-shell__sheet-backdrop" @click.self="closeSheet">
      <section
        class="mobile-shell__sheet"
        :class="[
          `mobile-shell__sheet--${activeSheetKind}`,
          activeSheetPresentation ? `mobile-shell__sheet--presentation-${activeSheetPresentation}` : ''
        ]"
        aria-label="Tools"
      >
        <div class="mobile-shell__sheet-handle" aria-hidden="true"></div>
        <div class="mobile-shell__sheet-header">
          <div>
            <div class="mobile-shell__sheet-title">
              <AppIcon
                v-if="sheetTitleIcon"
                :name="sheetTitleIcon"
                :size="18"
                data-testid="mobile-sheet-title-icon"
              />
              <span>{{ sheetTitle }}</span>
            </div>
          </div>
          <button type="button" class="mobile-shell__sheet-close" @click="closeSheet">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
        <div v-if="showSheetTabBar" class="mobile-shell__sheet-tabs" role="tablist" aria-label="Quick tools">
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
        <div
          class="mobile-shell__sheet-content"
          :class="{
            'mobile-shell__sheet-content--panel':
              activeSheetKind === 'window' ||
              activeSheetKind === 'color' ||
              activeSheetKind === 'transform' ||
              activeSheetKind === 'measure' ||
              activeSheetKind === 'annotate' ||
              activeSheetKind === 'segmentation' ||
              activeSheetKind === 'mpr'
          }"
        >
          <div v-if="activeSheetKind === 'history'" class="mobile-shell__history-panel">
            <div class="mobile-shell__favorite-summary" data-testid="mobile-history-summary">
              <span>{{ isZh ? '最近打开' : 'Recently Opened' }}</span>
              <strong>{{ mobileViewHistoryCount }}</strong>
            </div>
            <div v-if="!mobileViewHistoryItems.length" class="mobile-shell__empty-inline" data-testid="mobile-history-empty">
              {{ isZh ? '还没有打开过的视图' : 'No recently opened views yet' }}
            </div>
            <div v-else class="mobile-shell__action-list">
              <div
                v-for="item in mobileViewHistoryItems"
                :key="item.id"
                class="mobile-shell__history-row"
                data-testid="mobile-history-record"
              >
                <button
                  type="button"
                  class="mobile-shell__history-open"
                  :disabled="!item.openable"
                  data-testid="mobile-open-history-record"
                  @click="openMobileViewHistoryRecord(item)"
                >
                  <span class="mobile-shell__history-view">{{ item.viewLabel }}</span>
                  <span>
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.detail }}</small>
                  </span>
                </button>
                <button
                  type="button"
                  class="mobile-shell__history-remove"
                  :aria-label="isZh ? '删除记录' : 'Remove history record'"
                  data-testid="mobile-remove-history-record"
                  @click="removeMobileViewHistoryRecord(item.id)"
                >
                  <AppIcon name="trash" :size="16" />
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'series'" class="mobile-shell__series-list">
            <div
              v-for="series in mobileSeriesList"
              :key="series.seriesId"
              class="mobile-shell__series-row"
              :class="{ 'mobile-shell__series-row--active': isSeriesSelected(series.seriesId) }"
              @click="selectSeriesForActions(series.seriesId)"
            >
              <span class="mobile-shell__series-modality">{{ series.modality || 'DICOM' }}</span>
              <span class="mobile-shell__series-body">
                <span class="mobile-shell__series-title">{{ series.seriesDescription || series.seriesId }}</span>
                <span class="mobile-shell__series-meta">{{ formatSeriesMeta(series) }}</span>
              </span>
              <span v-if="isSeriesSelected(series.seriesId)" class="mobile-shell__series-actions" @click.stop>
                <button
                  v-if="!isPetSeries(series) && isSeriesActionSupported(series, 'Stack')"
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isSeriesViewActive(series.seriesId, 'Stack') }"
                  data-testid="mobile-open-stack"
                  :data-active="isSeriesViewActive(series.seriesId, 'Stack')"
                  @click="openSeriesStack(series.seriesId)"
                >
                  2D
                </button>
                <button
                  v-if="isSeriesActionSupported(series, 'PET')"
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isSeriesViewActive(series.seriesId, 'PET') }"
                  data-testid="mobile-open-pet"
                  :data-active="isSeriesViewActive(series.seriesId, 'PET')"
                  @click="openSeriesPet(series.seriesId)"
                >
                  2D
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
                  v-if="canOpenFusionFromSeries(series)"
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isFusionSeriesActive(series.seriesId) }"
                  data-testid="mobile-open-petct-fusion"
                  :data-active="isFusionSeriesActive(series.seriesId)"
                  @click="openFusionForSeries(series.seriesId)"
                >
                  PET/CT
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
              <span>{{ isZh ? '关键切片' : 'Key Slices' }}</span>
              <strong>{{ favoriteSliceCount }}</strong>
            </div>
            <div v-if="!favoriteSliceItems.length" class="mobile-shell__empty-inline" data-testid="mobile-favorites-empty">
              {{ isZh ? '还没有关键切片' : 'No key slices yet' }}
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
                  :aria-label="isZh ? '移除关键切片' : 'Remove key slice'"
                  data-testid="mobile-remove-favorite-slice"
                  @click="removeFavoriteSlice(item)"
                >
                  <AppIcon name="trash" :size="16" />
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'window'" class="mobile-shell__sheet-panel mobile-shell__window-panel">
            <div class="mobile-shell__sheet-scroll">
              <section class="mobile-shell__window-section">
              <div class="mobile-shell__window-subhead">{{ isZh ? '系统预设' : 'System Presets' }}</div>
              <div class="mobile-shell__action-list mobile-shell__window-system-list">
                <button
                  v-for="preset in systemWindowPresets"
                  :key="preset.id"
                  type="button"
                  class="mobile-shell__action-row"
                  :class="{ 'mobile-shell__action-row--active': selectedWindowPresetId === preset.id }"
                  role="radio"
                  :aria-checked="selectedWindowPresetId === preset.id"
                  data-testid="mobile-window-preset"
                  @click="applyWindowPreset(preset)"
                >
                  <span class="mobile-shell__swatch" :style="{ background: preset.accent }" aria-hidden="true"></span>
                  <span>
                    <strong>{{ getWindowPresetLabel(preset) }}</strong>
                    <small>{{ formatWindowPresetDetail(preset) }}</small>
                  </span>
                  <AppIcon v-if="selectedWindowPresetId === preset.id" name="check" :size="16" class="mobile-shell__choice-check" />
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
                    role="checkbox"
                    :aria-checked="selectedCustomPresetIdSet.has(preset.id)"
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
                {{ isZh ? '还没有自定义窗模版' : 'No custom window templates yet' }}
              </div>
              </section>
            </div>
            <div class="mobile-shell__sheet-footer-actions" data-testid="mobile-sheet-footer-actions">
              <button
                type="button"
                class="mobile-shell__footer-action mobile-shell__footer-action--primary"
                :disabled="!canAddCustomWindowPreset"
                data-testid="mobile-window-add-custom"
                @click="openCustomWindowPresetDialog"
              >
                <AppIcon name="plus" :size="20" />
                <span>
                  <strong>{{ isZh ? '添加窗模板' : 'Add Template' }}</strong>
                  <small>{{ customPresetLimitLabel }}</small>
                </span>
              </button>
              <button
                type="button"
                class="mobile-shell__footer-action"
                data-testid="mobile-window-reset"
                @click="applyResetOption('window:reset', { keepSheetOpen: true })"
              >
                <AppIcon name="reset" :size="20" />
                <span>
                  <strong>{{ isZh ? '\u91cd\u7f6e\u7a97\u503c' : 'Reset Window' }}</strong>
                </span>
              </button>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'display'" class="mobile-shell__action-list">
            <button
              v-for="option in displayOverlayOptions"
              :key="option.key"
              type="button"
              role="switch"
              :aria-checked="option.enabled"
              class="mobile-shell__display-row"
              :data-testid="`mobile-display-${option.key}`"
              @click="toggleDisplayOverlay(option.key)"
            >
              <span class="mobile-shell__display-leading">
                <AppIcon :name="option.icon" :size="20" />
                <span>{{ option.label }}</span>
              </span>
              <span class="mobile-shell__switch" :class="{ 'mobile-shell__switch--on': option.enabled }" aria-hidden="true">
                <span></span>
              </span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'color'" class="mobile-shell__sheet-panel">
            <div class="mobile-shell__sheet-scroll mobile-shell__action-list">
              <template v-if="activeFusionTab">
                <button
                  v-for="preset in FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS"
                  :key="preset.key"
                  type="button"
                  class="mobile-shell__action-row mobile-shell__action-row--pseudocolor"
                  :class="{ 'mobile-shell__action-row--active': activeFusionPseudocolorKey === preset.key }"
                  role="radio"
                  :aria-checked="activeFusionPseudocolorKey === preset.key"
                  data-testid="mobile-fusion-pseudocolor"
                  @click="applyFusionPseudocolor(`fusionPseudocolor:${preset.key}`)"
                >
                  <span
                    class="mobile-shell__swatch"
                    :style="{ '--mobile-pseudocolor-gradient': getFusionPetPseudocolorGradient(preset.key) }"
                    aria-hidden="true"
                  ></span>
                  <span><strong>{{ preset.label }}</strong></span>
                  <AppIcon v-if="activeFusionPseudocolorKey === preset.key" name="check" :size="16" class="mobile-shell__choice-check" />
                </button>
                <button
                  type="button"
                  class="mobile-shell__action-row"
                  data-testid="mobile-fusion-pet-display-reset"
                  @click="resetFusionPetDisplay"
                >
                  <AppIcon name="reset" :size="20" />
                  <span><strong>{{ isZh ? '\u91cd\u7f6e PET \u663e\u793a' : 'Reset PET display' }}</strong></span>
                </button>
              </template>
              <template v-else-if="activeVolumeTab">
                <button
                  v-for="option in VOLUME_RENDER_MODE_OPTIONS"
                  :key="option.value"
                  type="button"
                  class="mobile-shell__action-row"
                  :class="{ 'mobile-shell__action-row--active': activeVolumeRenderModeValue === option.value }"
                  role="radio"
                  :aria-checked="activeVolumeRenderModeValue === option.value"
                  data-testid="mobile-volume-render-mode"
                  @click="applyVolumeRenderMode(option.value)"
                >
                  <AppIcon :name="option.icon" :size="20" />
                  <span>
                    <strong>{{ option.label }}</strong>
                    <small>{{ option.detail }}</small>
                  </span>
                  <AppIcon v-if="activeVolumeRenderModeValue === option.value" name="check" :size="16" class="mobile-shell__choice-check" />
                </button>
                <template
                  v-for="(option, optionIndex) in activeMobileVolumePresetOptions"
                  :key="option.value"
                >
                  <div
                    v-if="shouldShowMobileVolumePresetGroupLabel(option, optionIndex)"
                    class="mobile-shell__action-group-label"
                    data-testid="mobile-volume-preset-group"
                  >
                    {{ option.group }}
                  </div>
                  <button
                    type="button"
                    class="mobile-shell__action-row"
                    :class="{ 'mobile-shell__action-row--active': (option.value.startsWith('surfacePreset:') ? activeSurfacePresetValue : activeVolumePresetValue) === option.value }"
                    role="radio"
                    :aria-checked="(option.value.startsWith('surfacePreset:') ? activeSurfacePresetValue : activeVolumePresetValue) === option.value"
                    data-testid="mobile-volume-preset"
                    @click="option.value.startsWith('surfacePreset:') ? applySurfacePreset(option.value) : applyVolumePreset(option.value)"
                  >
                    <AppIcon :name="option.icon" :size="20" />
                    <span><strong>{{ option.label }}</strong></span>
                    <AppIcon
                      v-if="(option.value.startsWith('surfacePreset:') ? activeSurfacePresetValue : activeVolumePresetValue) === option.value"
                      name="check"
                      :size="16"
                      class="mobile-shell__choice-check"
                    />
                  </button>
                </template>
              </template>
              <template v-else>
                <button
                  v-for="preset in PSEUDOCOLOR_PRESET_OPTIONS"
                  :key="preset.key"
                  type="button"
                  class="mobile-shell__action-row mobile-shell__action-row--pseudocolor"
                  :class="{ 'mobile-shell__action-row--active': activeMobilePseudocolorKey === preset.key }"
                  role="radio"
                  :aria-checked="activeMobilePseudocolorKey === preset.key"
                  data-testid="mobile-pseudocolor"
                  @click="applyPseudocolor(`pseudocolor:${preset.key}`)"
                >
                  <span
                    class="mobile-shell__swatch"
                    :style="{ '--mobile-pseudocolor-gradient': getPseudocolorGradient(preset.key) }"
                    aria-hidden="true"
                  ></span>
                  <span><strong>{{ preset.label }}</strong></span>
                  <AppIcon v-if="activeMobilePseudocolorKey === preset.key" name="check" :size="16" class="mobile-shell__choice-check" />
                </button>
              </template>
            </div>
            <div v-if="!activeVolumeTab && !activeFusionTab" class="mobile-shell__sheet-footer-actions" data-testid="mobile-sheet-footer-actions">
              <button
                type="button"
                class="mobile-shell__footer-action"
                data-testid="mobile-pseudocolor-reset"
                @click="resetPseudocolorToDefault"
              >
                <AppIcon name="reset" :size="20" />
                <span>
                  <strong>{{ isZh ? '\u91cd\u7f6e\u4f2a\u5f69' : 'Reset Pseudocolor' }}</strong>
                  <small>{{ isZh ? '\u6062\u590d\u5230\u8bbe\u7f6e\u4e2d\u7684\u9ed8\u8ba4\u4f2a\u5f69' : 'Restore the default pseudocolor from settings.' }}</small>
                </span>
              </button>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'transform'" class="mobile-shell__sheet-panel">
            <div class="mobile-shell__sheet-scroll mobile-shell__action-list">
              <button
                v-for="option in TRANSFORM_OPTIONS"
                :key="option.value"
                type="button"
                class="mobile-shell__action-row"
                data-testid="mobile-transform"
                @click="applyTransform(option.value)"
              >
                <AppIcon :name="option.icon" :size="20" />
                <span><strong>{{ isZh ? option.zh : option.en }}</strong></span>
              </button>
            </div>
            <div class="mobile-shell__sheet-footer-actions" data-testid="mobile-sheet-footer-actions">
              <button
                type="button"
                class="mobile-shell__footer-action"
                data-testid="mobile-transform-reset"
                @click="applyResetOption('transform:reset', { keepSheetOpen: true })"
              >
                <AppIcon name="reset" :size="20" />
                <span>
                  <strong>{{ isZh ? '\u91cd\u7f6e\u53d8\u6362' : 'Reset Transform' }}</strong>
                  <small>{{ isZh ? '\u6062\u590d\u5f53\u524d\u89c6\u56fe\u5e73\u79fb\u3001\u7f29\u653e\u3001\u65cb\u8f6c\u548c\u955c\u50cf' : 'Restore pan, zoom, rotation, and flips.' }}</small>
                </span>
              </button>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'playback'" class="mobile-shell__action-list">
            <button type="button" class="mobile-shell__action-row" data-testid="mobile-playback-toggle" :disabled="!canPlayActive" @click="toggleActivePlayback">
              <AppIcon :name="activeFourDTab ? (isPlayingFourD ? 'pause' : 'play') : (isPlayingActiveSlicePlayback ? 'pause' : 'play')" :size="20" />
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
                  <AppIcon :name="option.icon" :size="20" />
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

          <div v-else-if="activeSheetKind === 'fusion'" class="mobile-shell__action-list">
            <template v-if="fusionSourceSeries">
              <div class="mobile-shell__compare-source">
                <span>{{ isZh ? '融合源序列' : 'Fusion source' }}</span>
                <strong>{{ fusionSourceSeries.seriesDescription || fusionSourceSeries.seriesId }}</strong>
              </div>
              <button
                v-for="series in fusionCandidateSeries"
                :key="series.seriesId"
                type="button"
                class="mobile-shell__action-row"
                data-testid="mobile-fusion-target"
                @click="openMobilePetCtFusion(fusionSourceSeries.seriesId, series.seriesId)"
              >
                <span class="mobile-shell__series-modality">{{ series.modality || 'DICOM' }}</span>
                <span>
                  <strong>{{ series.seriesDescription || series.seriesId }}</strong>
                  <small>{{ formatSeriesMeta(series) }}</small>
                </span>
              </button>
              <div v-if="!fusionCandidateSeries.length" class="mobile-shell__empty-inline" data-testid="mobile-fusion-empty">
                {{ isZh ? '没有可融合的 CT/PET 配对序列' : 'No CT/PET fusion pair is available.' }}
              </div>
            </template>
            <template v-else>
              <button
                type="button"
                class="mobile-shell__display-row"
                data-testid="mobile-fusion-registration-toggle"
                :disabled="!activeFusionTab"
                @click="toggleFusionManualRegistration"
              >
                <span class="mobile-shell__display-leading">
                  <AppIcon name="crosshair" :size="20" />
                  <span>
                    <strong>{{ isZh ? '手动配准' : 'Manual registration' }}</strong>
                    <small>{{ isZh ? '开启后在融合窗格中拖动 PET 层' : 'Drag the PET layer in the fusion pane' }}</small>
                  </span>
                </span>
                <span class="mobile-shell__switch" :class="{ 'mobile-shell__switch--on': activeFusionTab?.fusionManualRegistration === true }" aria-hidden="true">
                  <span></span>
                </span>
              </button>
              <div class="mobile-shell__plane-grid">
                <button
                  type="button"
                  :class="{ active: mobileFusionRegistrationMode === 'translate' }"
                  data-testid="mobile-fusion-registration-translate"
                  :disabled="!activeFusionTab"
                  @click="setFusionRegistrationMode('translate')"
                >
                  <strong>{{ isZh ? '平移 PET' : 'Translate PET' }}</strong>
                  <small>{{ isZh ? '单指拖动' : 'One-finger drag' }}</small>
                </button>
                <button
                  type="button"
                  :class="{ active: mobileFusionRegistrationMode === 'rotate' }"
                  data-testid="mobile-fusion-registration-rotate"
                  :disabled="!activeFusionTab"
                  @click="setFusionRegistrationMode('rotate')"
                >
                  <strong>{{ isZh ? '旋转 PET' : 'Rotate PET' }}</strong>
                  <small>{{ isZh ? '围绕窗格中心旋转' : 'Rotate around pane center' }}</small>
                </button>
              </div>
              <button type="button" class="mobile-shell__action-row" data-testid="mobile-fusion-registration-reset" :disabled="!activeFusionTab" @click="resetFusionRegistration">
                <AppIcon name="reset" :size="20" />
                <span><strong>{{ isZh ? '\u91cd\u7f6e\u914d\u51c6' : 'Reset registration' }}</strong></span>
              </button>
              <button type="button" class="mobile-shell__action-row" data-testid="mobile-fusion-registration-save" :disabled="!activeFusionTab" @click="saveFusionRegistration">
                <AppIcon name="save" :size="20" />
                <span><strong>{{ isZh ? '保存配准' : 'Save registration' }}</strong></span>
              </button>
            </template>
          </div>

          <div v-else-if="activeSheetKind === 'mpr'" class="mobile-shell__sheet-panel">
            <div class="mobile-shell__sheet-scroll mobile-shell__action-list">
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
            </div>
            <div class="mobile-shell__sheet-footer-actions" data-testid="mobile-sheet-footer-actions">
              <button
                type="button"
                class="mobile-shell__footer-action"
                data-testid="mobile-mpr-reset"
                @click="handleResetView({ keepSheetOpen: true })"
              >
                <AppIcon name="reset" :size="20" />
                <span><strong>{{ isZh ? '\u91cd\u7f6e\u5f53\u524d\u5e73\u9762' : 'Reset Plane' }}</strong></span>
              </button>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'segmentation'" class="mobile-shell__segmentation-panel">
            <MprSegmentationPanel
              v-if="activeMprTab"
              embedded
              mobile
              :config="activeMprSegmentationConfig"
              :series-id="activeMprTab.seriesId"
              :series-label="activeMprTab.title"
              @close="closeSheet"
              @config-change="handleMprSegmentationConfigChange"
              @mode-change="handleMprSegmentationModeChange"
            />
            <div v-else class="mobile-shell__empty-inline">
              {{ isZh ? '请先打开 MPR 视图。' : 'Open an MPR view first.' }}
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'measure'" class="mobile-shell__sheet-panel">
            <div class="mobile-shell__sheet-scroll mobile-shell__action-list">
              <button
                v-for="tool in activeMobileMeasurementTools"
                :key="tool.toolType"
                type="button"
                class="mobile-shell__action-row"
                :class="{ 'mobile-shell__action-row--active': viewer.activeOperation.value === `measure:${tool.toolType}` }"
                :data-testid="`mobile-measure-${tool.toolType}`"
                @click="setActiveMeasurementTool(tool.toolType)"
              >
                <AppIcon :name="tool.icon" :size="20" />
                <span>
                  <strong>{{ isZh ? tool.zh : tool.en }}</strong>
                  <small>{{ isZh ? tool.hintZh : tool.hintEn }}</small>
                </span>
              </button>
            </div>
            <div class="mobile-shell__sheet-footer-actions" data-testid="mobile-sheet-footer-actions">
              <button
                type="button"
                class="mobile-shell__footer-action mobile-shell__footer-action--danger"
                data-testid="mobile-measure-clear"
                @click="applyResetOption('reset:measurements', { keepSheetOpen: true })"
              >
                <AppIcon name="reset" :size="20" />
                <span>
                  <strong>{{ isZh ? '\u6e05\u9664\u6d4b\u91cf' : 'Clear Measurements' }}</strong>
                  <small>{{ isZh ? '\u79fb\u9664\u5f53\u524d\u89c6\u56fe\u4e2d\u7684\u5168\u90e8\u6d4b\u91cf' : 'Remove all measurements in the current view.' }}</small>
                </span>
              </button>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'annotate'" class="mobile-shell__sheet-panel">
            <div class="mobile-shell__sheet-scroll mobile-shell__action-list">
            <button
              type="button"
              class="mobile-shell__action-row"
              :class="{ 'mobile-shell__action-row--active': viewer.activeOperation.value === `${STACK_OPERATION_PREFIX}annotate:arrow` }"
              data-testid="mobile-annotate-arrow"
              @click="setActiveMobileTool('annotate')"
            >
              <AppIcon name="annotate" :size="20" />
              <span>
                <strong>{{ isZh ? '箭头标注' : 'Arrow Annotation' }}</strong>
                <small>{{ isZh ? '在当前视图中添加文字标注' : 'Add an annotation in the current viewport' }}</small>
              </span>
            </button>
            </div>
            <div class="mobile-shell__sheet-footer-actions" data-testid="mobile-sheet-footer-actions">
              <button
              type="button"
              class="mobile-shell__footer-action mobile-shell__footer-action--danger"
              data-testid="mobile-annotate-clear"
              @click="applyResetOption('reset:annotations', { keepSheetOpen: true })"
            >
              <AppIcon name="reset" :size="20" />
              <span>
                <strong>{{ isZh ? '清除标注' : 'Clear Annotations' }}</strong>
                <small>{{ isZh ? '移除当前视图中的全部标注' : 'Remove all annotations in the current view' }}</small>
              </span>
              </button>
            </div>
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
              <AppIcon :name="tool.icon" :size="20" />
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
              :class="{ 'mobile-shell__action-row--no-leading': shouldHideMobileExportRowIcons }"
              data-testid="mobile-export-format"
              @click="exportActiveView(option.value)"
            >
              <AppIcon
                v-if="!shouldHideMobileExportRowIcons"
                :name="option.icon"
                :size="18"
                data-testid="mobile-export-row-icon"
              />
              <span>
                <strong>{{ isZh ? option.zh : option.en }}</strong>
                <small>{{ isZh ? option.detailZh : option.detailEn }}</small>
              </span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'volumeParams'" class="mobile-shell__volume-params" data-testid="mobile-volume-params">
            <VolumeRenderConfigPanel
              v-if="activeVolumeRenderConfig"
              :config="activeVolumeRenderConfig"
              @close="closeSheet"
              @config-change="viewer.handleVolumeConfigChange"
            />
            <SurfaceRenderConfigPanel
              v-else-if="activeSurfaceRenderConfig"
              :config="activeSurfaceRenderConfig"
              @close="closeSheet"
              @config-change="viewer.handleSurfaceConfigChange"
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
              <AppIcon :name="option.icon" :size="20" />
              <span><strong>{{ isZh ? option.zh : option.en }}</strong></span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'tag'" class="mobile-shell__action-list">
            <button type="button" class="mobile-shell__action-row" data-testid="mobile-open-tag" :disabled="!canOpenTag || !activeSeriesId" @click="openActiveSeriesTag">
              <AppIcon name="tag" :size="20" />
              <span>
                <strong>{{ isZh ? '查看 DICOM Tag' : 'View DICOM Tags' }}</strong>
                <small>{{ isZh ? '只读查看当前序列实例标签' : 'Read-only tags for the active series' }}</small>
              </span>
            </button>
          </div>
        </div>
        <div v-if="activeSheetKind === 'series'" class="mobile-shell__series-footer">
          <button
            type="button"
            class="mobile-shell__series-load-button"
            data-testid="mobile-series-load-local"
            :disabled="!canLoadLocal || isLoadingAnySource"
            @click="loadLocalFolder"
          >
            <AppIcon :name="isLoadingLocal ? 'loading' : 'folder-upload'" :size="17" :class="{ 'mobile-shell__loading-icon': isLoadingLocal }" />
            <span>{{ isLoadingLocal ? (isZh ? '正在加载...' : 'Loading...') : (isZh ? '加载文件夹' : 'Load Folder') }}</span>
          </button>
          <button
            type="button"
            class="mobile-shell__series-load-button"
            data-testid="mobile-series-open-pacs"
            :disabled="!canOpenPacs || isLoadingAnySource"
            @click="isPacsBrowserOpen = true"
          >
            <AppIcon name="pacs" :size="17" />
            <span>{{ isZh ? '加载 PACS' : 'Load PACS' }}</span>
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="isCustomWindowDialogOpen"
      class="mobile-shell__dialog-backdrop"
      data-testid="mobile-window-custom-dialog"
      @click.self="closeCustomWindowPresetDialog"
    >
      <section class="mobile-shell__dialog" role="dialog" aria-modal="true">
        <div class="mobile-shell__dialog-header">
          <div>
            <strong>{{ isZh ? '添加窗模板' : 'Add Window Template' }}</strong>
            <small>{{ customPresetLimitLabel }}</small>
          </div>
          <button type="button" class="mobile-shell__dialog-close" :aria-label="isZh ? '取消' : 'Cancel'" @click="closeCustomWindowPresetDialog">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
        <div class="mobile-shell__window-form mobile-shell__dialog-form">
          <label class="mobile-shell__window-field">
            <span>{{ isZh ? '中文名称' : 'Chinese Name' }}</span>
            <input v-model="customPresetZhName" type="text" data-testid="mobile-window-custom-zh" />
          </label>
          <label class="mobile-shell__window-field">
            <span>{{ isZh ? '英文名称' : 'English Name' }}</span>
            <input v-model="customPresetEnName" type="text" data-testid="mobile-window-custom-en" />
          </label>
          <label class="mobile-shell__window-field">
            <span>{{ isZh ? '窗宽 WW' : 'Window Width' }}</span>
            <input v-model="customPresetWw" type="number" data-testid="mobile-window-custom-ww" />
          </label>
          <label class="mobile-shell__window-field">
            <span>{{ isZh ? '窗位 WL' : 'Window Level' }}</span>
            <input v-model="customPresetWl" type="number" data-testid="mobile-window-custom-wl" />
          </label>
        </div>
        <p v-if="!canAddCustomWindowPreset" class="mobile-shell__window-hint">
          {{ isZh ? `最多只能保留 ${MAX_CUSTOM_WINDOW_PRESETS} 个自定义模板。` : `Up to ${MAX_CUSTOM_WINDOW_PRESETS} custom templates can be saved.` }}
        </p>
        <div class="mobile-shell__dialog-actions">
          <button type="button" class="mobile-shell__dialog-button" data-testid="mobile-window-custom-cancel" @click="closeCustomWindowPresetDialog">
            {{ isZh ? '取消' : 'Cancel' }}
          </button>
          <button
            type="button"
            class="mobile-shell__dialog-button mobile-shell__dialog-button--primary"
            :disabled="!canAddCustomWindowPreset"
            data-testid="mobile-window-custom-confirm"
            @click="handleAddCustomWindowPreset"
          >
            {{ isZh ? '完成' : 'Done' }}
          </button>
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

    <MobileSettingsOverlay
      :is-open="isSettingsOpen"
      @close="isSettingsOpen = false"
      @orientation-lock-request="applyOrientationLock"
    />
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
  grid-template-rows: auto minmax(0, 1fr) auto auto auto;
  width: 100%;
  max-width: 100vw;
  min-width: 0;
  height: 100dvh;
  overflow: hidden;
  background: var(--theme-app-background);
  color: var(--theme-text-primary);
  touch-action: none;
  box-sizing: border-box;
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

.mobile-shell__brand-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
  min-height: 46px;
  color: var(--theme-text-primary);
}

.mobile-shell__brand-mark {
  position: relative;
  display: grid;
  overflow: hidden;
  width: 42px;
  height: 42px;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-soft));
  border-radius: 13px 8px 13px 8px;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-panel-strong)),
      color-mix(in srgb, var(--theme-accent-strong) 8%, var(--theme-surface-card-soft))
    );
  color: color-mix(in srgb, var(--theme-accent) 86%, var(--theme-text-primary));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 12%, transparent),
    inset 0 -8px 14px color-mix(in srgb, black 14%, transparent);
}

.mobile-shell__brand-mark::before,
.mobile-shell__brand-mark::after {
  position: absolute;
  content: '';
  pointer-events: none;
}

.mobile-shell__brand-mark::before {
  inset: 7px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 26%, transparent);
  border-radius: 8px 5px 8px 5px;
  opacity: 0.7;
}

.mobile-shell__brand-mark::after {
  width: 24px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);
  border-radius: 50%;
  opacity: 0.22;
}

.mobile-shell__brand-mark-frame {
  position: absolute;
  inset: 4px;
  border-radius: 10px 6px 10px 6px;
  background:
    linear-gradient(currentColor, currentColor) left 7px top 7px / 9px 1.5px no-repeat,
    linear-gradient(currentColor, currentColor) left 7px top 7px / 1.5px 9px no-repeat,
    linear-gradient(currentColor, currentColor) right 7px top 7px / 9px 1.5px no-repeat,
    linear-gradient(currentColor, currentColor) right 7px top 7px / 1.5px 9px no-repeat,
    linear-gradient(currentColor, currentColor) left 7px bottom 7px / 9px 1.5px no-repeat,
    linear-gradient(currentColor, currentColor) left 7px bottom 7px / 1.5px 9px no-repeat,
    linear-gradient(currentColor, currentColor) right 7px bottom 7px / 9px 1.5px no-repeat,
    linear-gradient(currentColor, currentColor) right 7px bottom 7px / 1.5px 9px no-repeat;
  opacity: 0.54;
}

.mobile-shell__brand-mark-slice {
  position: absolute;
  left: 10px;
  right: 10px;
  height: 1px;
  background: color-mix(in srgb, var(--theme-text-primary) 26%, transparent);
}

.mobile-shell__brand-mark-slice--top {
  top: 16px;
}

.mobile-shell__brand-mark-slice--bottom {
  bottom: 16px;
}

.mobile-shell__brand-mark-letters {
  position: relative;
  z-index: 1;
  display: grid;
  width: 25px;
  height: 19px;
  place-items: center;
  border-radius: 6px 3px 6px 3px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 58%, transparent);
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  text-shadow: 0 1px 8px color-mix(in srgb, black 24%, transparent);
}

.mobile-shell__brand-copy {
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(:root[data-theme="clinical-light"]) .mobile-shell__brand-mark {
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--theme-accent) 18%, white),
      color-mix(in srgb, var(--theme-accent-strong) 8%, var(--theme-surface-card-soft))
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 16px color-mix(in srgb, var(--theme-accent-strong) 10%, transparent);
}

:global(:root[data-theme="clinical-light"]) .mobile-shell__brand-mark-letters {
  background: color-mix(in srgb, white 62%, transparent);
}

.mobile-shell__title-group {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  min-height: 36px;
  padding: 4px 6px 4px 8px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 64%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 58%, transparent);
  color: inherit;
  text-align: left;
}

.mobile-shell__title {
  grid-column: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text-primary);
  display: block;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__title-action {
  grid-column: 2;
  grid-row: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 72%, transparent);
  color: var(--theme-text-secondary);
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
  width: 100%;
  min-width: 0;
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

.mobile-shell__segmentation-floating-control {
  position: absolute;
  right: 10px;
  bottom: 10px;
  left: 10px;
  z-index: 16;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-strong));
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 88%, transparent);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(14px);
  padding: 8px;
  pointer-events: auto;
}

.mobile-shell__segmentation-floating-field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 46px;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mobile-shell__segmentation-floating-field span {
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.mobile-shell__segmentation-floating-slider {
  width: 100%;
  min-width: 0;
  accent-color: var(--theme-accent);
}

.mobile-shell__segmentation-floating-value {
  width: 100%;
  min-width: 0;
  height: 30px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 88%, transparent);
  color: var(--theme-text-primary);
  padding: 0 4px;
  appearance: textfield;
  text-align: right;
  font-size: 12px;
  font-weight: 850;
}

.mobile-shell__segmentation-floating-value::-webkit-outer-spin-button,
.mobile-shell__segmentation-floating-value::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
}

.mobile-shell__segmentation-floating-empty {
  grid-column: 1 / -1;
  overflow: hidden;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 850;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.mobile-shell__loading-icon {
  animation: mobile-shell-spin 840ms linear infinite;
  transform-origin: center;
}

@keyframes mobile-shell-spin {
  to {
    transform: rotate(360deg);
  }
}

.mobile-shell__slice-panel {
  display: grid;
  grid-template-columns: max-content minmax(52px, 1fr) max-content;
  align-items: center;
  column-gap: 10px;
  row-gap: 8px;
  padding: 8px 12px;
  padding-right: calc(12px + env(safe-area-inset-right, 0px));
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 64%, transparent);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 90%, transparent);
  backdrop-filter: blur(18px);
}

.mobile-shell__slice-panel--stack {
  grid-template-columns: max-content minmax(52px, 1fr) max-content;
}

.mobile-shell__slice-control-row {
  grid-column: 1 / -1;
  display: contents;
}

.mobile-shell__plane-tabs {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.mobile-shell__four-d-phase {
  grid-column: 1 / -1;
  display: contents;
}

.mobile-shell__four-d-copy {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: max-content;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
  white-space: nowrap;
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
  align-items: baseline;
  gap: 6px;
  min-width: max-content;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
  white-space: nowrap;
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
  --mobile-toolbar-row-height: var(--viewer-tool-button-size);
  --mobile-inline-tool-height: calc(var(--mobile-toolbar-row-height) - 12px);
  display: grid;
  grid-auto-rows: var(--mobile-toolbar-row-height);
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
  min-height: var(--mobile-toolbar-row-height);
}

.mobile-shell__tool {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  height: 100%;
  min-height: 0;
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  border-radius: var(--viewer-tool-radius);
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

.mobile-shell__tool--panel-open:not(.mobile-shell__tool--active) {
  border-color: color-mix(in srgb, var(--theme-border-strong) 72%, var(--theme-border-soft));
  background: var(--theme-surface-card-elevated-soft);
  color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-text-primary));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 7%, transparent),
    0 4px 10px rgba(0, 0, 0, 0.12);
}

.mobile-shell__tool--panel-open:not(.mobile-shell__tool--active)::after {
  position: absolute;
  right: 50%;
  bottom: 3px;
  width: 14px;
  height: 2px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--theme-accent) 78%, white 4%);
  content: '';
  transform: translateX(50%);
  pointer-events: none;
}

.mobile-shell__tool--state-on:not(.mobile-shell__tool--active) {
  border-color: color-mix(in srgb, var(--theme-status-success) 68%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-status-success) 18%, var(--theme-surface-card));
  color: var(--theme-status-success-text);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-status-success) 34%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 0 0 1px color-mix(in srgb, var(--theme-status-success) 18%, transparent),
    0 8px 18px color-mix(in srgb, var(--theme-status-success) 10%, transparent);
}

.mobile-shell__inline-tool-panel {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: var(--mobile-toolbar-row-height);
  height: var(--mobile-toolbar-row-height);
  box-sizing: border-box;
  padding: 4px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 58%, transparent);
  border-radius: var(--viewer-tool-radius);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 82%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.mobile-shell__submenu-back {
  display: inline-grid;
  min-width: 0;
  width: 100%;
  height: var(--mobile-inline-tool-height);
  min-height: 0;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 52%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  color: var(--theme-text-primary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  appearance: none;
}

.mobile-shell__inline-tool-panel:has(.mobile-shell__inline-tool-footer) {
  grid-template-columns: 34px minmax(0, 1fr) minmax(90px, auto);
}

.mobile-shell__inline-tool-header {
  display: none;
}

.mobile-shell__inline-tool-header strong {
  color: var(--theme-text-primary);
  font-size: 10px;
  font-weight: 900;
}

.mobile-shell__inline-tool-header span {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 8px;
  font-weight: 800;
  white-space: nowrap;
}

.mobile-shell__inline-tool-track {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 100%;
  gap: 5px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  scrollbar-width: none;
}

.mobile-shell__inline-tool-track::-webkit-scrollbar {
  display: none;
}

.mobile-shell__inline-playback {
  display: grid;
  grid-template-columns: minmax(86px, auto) minmax(0, 1fr);
  align-items: center;
  min-width: 0;
  height: 100%;
  gap: 8px;
}

.mobile-shell__inline-playback-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: var(--mobile-inline-tool-height);
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 58%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  font-size: 10px;
  font-weight: 900;
}

.mobile-shell__inline-playback-toggle:disabled,
.mobile-shell__inline-fps-tick:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.mobile-shell__inline-fps-control {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.mobile-shell__inline-fps-label {
  display: grid;
  gap: 0;
  color: var(--theme-text-muted);
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
}

.mobile-shell__inline-fps-label strong {
  color: var(--theme-text-primary);
  font-size: 12px;
}

.mobile-shell__inline-fps-slider {
  width: 100%;
  min-width: 0;
  accent-color: var(--theme-accent);
}

.mobile-shell__inline-fps-ticks {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.mobile-shell__inline-fps-tick {
  min-width: 24px;
  height: 26px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 44%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--theme-surface-card) 50%, transparent);
  color: var(--theme-text-secondary);
  font-size: 9px;
  font-weight: 900;
}

.mobile-shell__inline-fps-tick--active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-shell__inline-tool {
  display: inline-grid;
  flex: 0 0 auto;
  min-width: var(--viewer-tool-button-compact-size);
  height: var(--mobile-inline-tool-height);
  min-height: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  justify-content: start;
  gap: 4px;
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 42%, transparent);
  border-radius: var(--viewer-tool-radius);
  background: color-mix(in srgb, var(--theme-surface-card) 46%, transparent);
  color: var(--theme-text-secondary);
  appearance: none;
}

.mobile-shell__inline-tool--text-only {
  min-width: 86px;
  grid-template-columns: minmax(0, 1fr);
  justify-content: center;
}

.mobile-shell__inline-tool--text-only .mobile-shell__inline-tool-label {
  text-align: center;
}

.mobile-shell__inline-tool--icon-action {
  width: var(--mobile-inline-tool-height);
  min-width: var(--mobile-inline-tool-height);
  grid-template-columns: minmax(0, 1fr);
  justify-content: center;
  margin-left: auto;
  padding: 4px;
}

.mobile-shell__inline-tool--icon-action .mobile-shell__inline-tool-icon {
  justify-self: center;
}

.mobile-shell__inline-tool-panel--icon-only .mobile-shell__inline-tool {
  flex: 1 1 0;
  width: auto;
  min-width: var(--mobile-inline-tool-height);
  grid-template-columns: minmax(0, 1fr);
  justify-content: center;
  padding: 4px;
}

.mobile-shell__inline-tool-icon {
  display: grid;
  width: var(--viewer-tool-icon-size);
  height: var(--viewer-tool-icon-size);
  place-items: center;
  justify-self: start;
}

.mobile-shell__inline-tool-panel--icon-only .mobile-shell__inline-tool-icon {
  justify-self: center;
  width: var(--viewer-tool-icon-size);
  height: var(--viewer-tool-icon-size);
}

.mobile-shell__inline-tool-label {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  font-weight: 850;
  line-height: 1.1;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__orientation-option-label {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  letter-spacing: 0;
}

.mobile-shell__orientation-option-initial {
  color: var(--theme-text-primary);
  font-weight: 900;
}

.mobile-shell__orientation-option-suffix {
  color: var(--theme-text-muted);
  font-weight: 750;
  text-transform: lowercase;
}

.mobile-shell__orientation-option-secondary {
  margin-left: 0.45rem;
  color: var(--theme-text-secondary);
  font-size: 0.82rem;
  font-weight: 750;
}

.mobile-shell__inline-tool-panel--icon-only .mobile-shell__inline-tool-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.mobile-shell__inline-tool--active {
  border-color: color-mix(in srgb, var(--theme-accent) 70%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 18%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

.mobile-shell__inline-tool--active .mobile-shell__inline-tool-icon {
  color: color-mix(in srgb, var(--theme-accent) 84%, #ffffff);
}

.mobile-shell__inline-tool--danger .mobile-shell__inline-tool-icon {
  border-color: color-mix(in srgb, var(--theme-accent-warm) 58%, transparent);
  color: var(--theme-accent-warm);
}

.mobile-shell__inline-tool--warm {
  color: var(--theme-accent-warm);
}

.mobile-shell__inline-tool:disabled {
  cursor: not-allowed;
  border-color: color-mix(in srgb, var(--theme-border-soft) 28%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 34%, transparent);
  color: color-mix(in srgb, var(--theme-text-muted) 72%, transparent);
  opacity: 1;
  box-shadow: none;
}

.mobile-shell__inline-tool:disabled .mobile-shell__inline-tool-icon {
  color: color-mix(in srgb, var(--theme-text-muted) 68%, transparent);
}

.mobile-shell__inline-tool-footer {
  display: inline-flex;
  min-width: 0;
  height: var(--mobile-inline-tool-height);
}

.mobile-shell__inline-footer-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  height: 100%;
  padding: 4px 8px;
  border: 1px solid color-mix(in srgb, var(--theme-accent-warm) 48%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent-warm) 14%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
  appearance: none;
}

.mobile-shell--active-view .mobile-shell__header {
  min-height: 40px;
  gap: 6px;
  padding: calc(env(safe-area-inset-top, 0px) + 4px) 8px 4px;
}

.mobile-shell--active-view .mobile-shell__title {
  font-size: 14px;
  line-height: 1.15;
}

.mobile-shell--active-view .mobile-shell__title-group {
  min-height: 30px;
  padding: 3px 5px 3px 7px;
}

.mobile-shell--active-view .mobile-shell__title-action {
  grid-row: 1;
  width: 20px;
  height: 20px;
}

.mobile-shell--active-view .mobile-shell__header-actions {
  gap: 4px;
}

.mobile-shell--active-view .mobile-shell__icon-button {
  min-width: 32px;
  height: 32px;
}

.mobile-shell--active-view .mobile-shell__slice-panel {
  gap: 8px;
  padding: 6px 10px;
  padding-right: calc(10px + env(safe-area-inset-right, 0px));
}

.mobile-shell--active-view .mobile-shell__slice-icon-button {
  width: 34px;
  height: 34px;
}

.mobile-shell--active-view .mobile-shell__toolbar {
  --mobile-toolbar-row-height: var(--viewer-tool-button-size);
  gap: 5px;
  padding: 6px 8px calc(env(safe-area-inset-bottom, 0px) + 8px);
}

.mobile-shell--active-view .mobile-shell__toolbar-row {
  gap: 5px;
}

.mobile-shell--active-view .mobile-shell__tool {
  gap: 1px;
  font-size: 10px;
}

.mobile-shell--active-view .mobile-shell__inline-tool-panel {
  gap: 5px;
  grid-template-columns: 34px minmax(0, 1fr);
}

.mobile-shell--active-view .mobile-shell__submenu-back {
  border-radius: var(--viewer-tool-radius);
}

.mobile-shell--active-view .mobile-shell__inline-tool-track {
  gap: 3px;
  padding: 0;
}

.mobile-shell--active-view .mobile-shell__inline-tool {
  padding-right: 4px;
}

.mobile-shell--active-view .mobile-shell__inline-tool-icon {
  width: var(--viewer-tool-icon-size);
  height: var(--viewer-tool-icon-size);
}

.mobile-shell--active-view .mobile-shell__inline-tool-label {
  font-size: 9px;
}

@media (max-width: 390px) {
  .mobile-shell__inline-tool-panel {
    grid-template-columns: 32px minmax(0, 1fr);
  }

  .mobile-shell__inline-tool {
    min-width: 54px;
    padding-inline: 6px;
  }
}

.mobile-shell__icp-footer {
  display: flex;
  min-height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0 12px calc(env(safe-area-inset-bottom, 0px) + 2px);
  border-top: 0;
  background: transparent;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1;
}

.mobile-shell__icp-footer a {
  color: inherit;
  text-decoration: none;
}

.mobile-shell__icp-footer a:active,
.mobile-shell__icp-footer a:focus-visible {
  color: var(--theme-text-secondary);
  text-decoration: underline;
  text-underline-offset: 3px;
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
  height: auto;
  max-height: min(68dvh, 560px);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 80%, transparent);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 96%, transparent);
  box-shadow: 0 -24px 60px rgba(0, 0, 0, 0.45);
  padding-right: env(safe-area-inset-right, 0px);
  isolation: isolate;
}

.mobile-shell__sheet--presentation-menu {
  height: min(56dvh, 460px);
  min-height: min(56dvh, 460px);
  max-height: min(56dvh, 460px);
}

.mobile-shell__sheet--presentation-menu.mobile-shell__sheet--color {
  height: min(56dvh, 460px);
  min-height: min(56dvh, 460px);
  max-height: min(56dvh, 460px);
}

.mobile-shell__sheet--presentation-menu .mobile-shell__sheet-content {
  flex: 1 1 0;
  height: 0;
}

.mobile-shell__sheet--presentation-menu .mobile-shell__sheet-handle {
  flex: 0 0 4px;
}

.mobile-shell__sheet--presentation-menu .mobile-shell__sheet-header {
  flex: 0 0 48px;
}

.mobile-shell__sheet--presentation-menu .mobile-shell__sheet-tabs {
  flex: 0 0 48px;
}

.mobile-shell__sheet-handle {
  width: 44px;
  height: 4px;
  margin: 6px auto 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-muted) 56%, transparent);
}

.mobile-shell__sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 12px 7px;
}

.mobile-shell__sheet-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.15;
}

.mobile-shell__sheet-close {
  min-width: 38px;
  height: 38px;
  border-radius: 10px;
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
  flex: 0 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0 8px 10px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-shell__sheet-content--panel {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  height: 0;
  overflow: hidden;
}

.mobile-shell__sheet-content::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.mobile-shell__sheet-panel {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.mobile-shell__sheet-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-shell__sheet-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.mobile-shell__sheet-footer-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 8px;
  flex: 0 0 auto;
  margin-top: auto;
  padding: 8px 0 0;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 64%, transparent);
}

.mobile-shell__series-list,
.mobile-shell__action-list {
  display: grid;
  align-content: start;
  gap: 6px;
}

.mobile-shell__action-group-label {
  margin: 10px 2px 2px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.mobile-shell__action-group-label:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.mobile-shell__series-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  flex: 0 0 auto;
  padding: 8px calc(8px + env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 8px) 8px;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 64%, transparent);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 98%, transparent);
}

.mobile-shell__series-load-button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 42px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  padding: 6px 9px;
  font-size: 12px;
  font-weight: 900;
}

.mobile-shell__series-load-button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__series-load-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.mobile-shell__window-panel {
  gap: 14px;
}

.mobile-shell__window-panel .mobile-shell__sheet-scroll {
  display: grid;
  align-content: start;
  gap: 14px;
}

.mobile-shell__window-section {
  display: grid;
  gap: 8px;
}

.mobile-shell__window-system-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-right: 2px;
}

.mobile-shell__window-system-list .mobile-shell__action-row {
  grid-template-columns: 32px minmax(0, 1fr);
  min-height: 58px;
  padding: 7px 8px;
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

.mobile-shell__segmentation-panel {
  display: flex;
  flex: 1 1 0;
  justify-content: center;
  min-height: 0;
  padding: 4px 0 0;
}

.mobile-shell__segmentation-panel :deep(.mpr-segmentation-panel) {
  height: 100%;
  width: 100%;
  max-width: min(100%, 460px);
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

.mobile-shell__favorite-panel,
.mobile-shell__history-panel {
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

.mobile-shell__favorite-row,
.mobile-shell__history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  gap: 7px;
  align-items: stretch;
}

.mobile-shell__favorite-open,
.mobile-shell__favorite-remove,
.mobile-shell__history-open,
.mobile-shell__history-remove {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
}

.mobile-shell__favorite-open,
.mobile-shell__history-open {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-height: 56px;
  padding: 8px 10px;
  text-align: left;
}

.mobile-shell__favorite-open > .app-icon,
.mobile-shell__favorite-open > :first-child,
.mobile-shell__history-open > :first-child {
  justify-self: center;
  color: var(--theme-accent-warm);
}

.mobile-shell__favorite-open strong,
.mobile-shell__favorite-open small,
.mobile-shell__history-open strong,
.mobile-shell__history-open small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__favorite-open small,
.mobile-shell__history-open small {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.mobile-shell__favorite-open:disabled,
.mobile-shell__history-open:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.mobile-shell__history-view {
  display: grid;
  width: 36px;
  min-width: 36px;
  min-height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 13%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 900;
}

.mobile-shell__favorite-remove,
.mobile-shell__history-remove {
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
  gap: 8px;
  width: 100%;
  min-height: 50px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  padding: 7px 9px;
  text-align: left;
}

.mobile-shell__footer-action {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 52px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  padding: 7px 9px;
  text-align: left;
}

.mobile-shell__footer-action--warning {
  border-color: color-mix(in srgb, var(--theme-accent-warm) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent-warm) 13%, var(--theme-surface-card));
}

.mobile-shell__footer-action--primary {
  border-color: color-mix(in srgb, var(--theme-accent) 54%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-card));
}

.mobile-shell__footer-action--danger {
  border-color: color-mix(in srgb, var(--theme-status-danger-border) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-status-danger-surface) 72%, var(--theme-surface-card));
}

.mobile-shell__footer-action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.mobile-shell__action-row {
  grid-template-columns: 38px minmax(0, 1fr) auto;
}

.mobile-shell__action-row--no-leading {
  grid-template-columns: minmax(0, 1fr);
}

.mobile-shell__action-row--pseudocolor {
  min-height: 44px;
  grid-template-columns: minmax(0, 1fr) minmax(132px, 34%) auto;
  padding-block: 6px;
}

.mobile-shell__action-row--pseudocolor > span:not(.mobile-shell__swatch) {
  grid-column: 1;
  grid-row: 1;
}

.mobile-shell__action-row--pseudocolor .mobile-shell__swatch {
  position: relative;
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  width: 100%;
  height: 16px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
  isolation: isolate;
}

.mobile-shell__choice-check {
  grid-column: -2 / -1;
  color: var(--theme-accent);
}

.mobile-shell__action-row--pseudocolor .mobile-shell__swatch::before {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: var(--mobile-pseudocolor-gradient);
  content: "";
  transform: translateZ(0);
}

.mobile-shell__action-row--active {
  border-color: var(--theme-selection-border);
  background: var(--theme-selection-surface);
  box-shadow: var(--theme-selection-shadow);
}

.mobile-shell__action-row strong,
.mobile-shell__action-row small,
.mobile-shell__footer-action strong,
.mobile-shell__footer-action small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-shell__action-row strong,
.mobile-shell__footer-action strong {
  font-size: 14px;
  line-height: 1.18;
}

.mobile-shell__action-row small,
.mobile-shell__footer-action small {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.mobile-shell__sheet--presentation-focused.mobile-shell__sheet--color .mobile-shell__sheet-content,
.mobile-shell__sheet--presentation-focused.mobile-shell__sheet--segmentation .mobile-shell__sheet-content {
  padding-bottom: 8px;
}

.mobile-shell__sheet--presentation-focused.mobile-shell__sheet--color .mobile-shell__action-list {
  gap: 5px;
}

.mobile-shell__sheet--presentation-focused.mobile-shell__sheet--color,
.mobile-shell__sheet--presentation-focused.mobile-shell__sheet--segmentation {
  height: min(64dvh, 500px);
  min-height: min(54dvh, 420px);
  max-height: min(64dvh, 500px);
}

.mobile-shell__swatch {
  display: block;
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  border-radius: 8px;
}

.mobile-shell__action-row--pseudocolor .mobile-shell__swatch {
  width: 100%;
  height: 16px;
  border-radius: 999px;
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

.mobile-shell__dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 72;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.42);
  padding: 18px;
}

.mobile-shell__dialog {
  display: grid;
  width: min(100%, 420px);
  gap: 14px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 97%, transparent);
  color: var(--theme-text-primary);
  padding: 14px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
}

.mobile-shell__dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mobile-shell__dialog-header strong,
.mobile-shell__dialog-header small {
  display: block;
}

.mobile-shell__dialog-header strong {
  font-size: 17px;
  font-weight: 900;
}

.mobile-shell__dialog-header small {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 800;
}

.mobile-shell__dialog-close {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
}

.mobile-shell__dialog-form {
  gap: 10px;
}

.mobile-shell__dialog-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mobile-shell__dialog-button {
  min-height: 42px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 84%, transparent);
  color: var(--theme-text-primary);
  font-size: 14px;
  font-weight: 900;
}

.mobile-shell__dialog-button--primary {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-surface-card));
}

.mobile-shell__dialog-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
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
    --mobile-toolbar-row-height: var(--viewer-tool-button-compact-size);
    padding: 5px 8px calc(env(safe-area-inset-bottom, 0px) + 6px);
  }

  .mobile-shell__tool {
    gap: 2px;
    font-size: 10px;
  }

  .mobile-shell__sheet {
    height: auto;
    max-height: min(64dvh, 360px);
  }

  .mobile-shell__sheet--presentation-menu {
    height: min(64dvh, 360px);
    min-height: min(64dvh, 360px);
    max-height: min(64dvh, 360px);
  }

  .mobile-shell__sheet--presentation-menu.mobile-shell__sheet--color {
    height: min(64dvh, 360px);
    min-height: min(64dvh, 360px);
    max-height: min(64dvh, 360px);
  }

  .mobile-shell__toast {
    bottom: calc(env(safe-area-inset-bottom, 0px) + 54px);
  }
}
</style>
