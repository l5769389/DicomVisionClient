<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import AppIcon from '../../components/AppIcon.vue'
import { PSEUDOCOLOR_PRESET_OPTIONS, getPseudocolorGradient } from '../../constants/pseudocolor'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { useUiPreferences, type WindowTemplatePreset } from '../../composables/ui/useUiPreferences'
import { useViewerWorkspace } from '../../composables/workspace/core/useViewerWorkspace'
import { parseSliceLabel, useKeySliceStars } from '../../composables/workspace/slices/useKeySliceStars'
import { setApiBaseURL } from '../../services/api'
import { postApi } from '../../services/typedApi'
import { viewerRuntime } from '../../platform/runtime'
import { mobileViewerCapabilityProfile, supportsViewerDataSource, supportsViewerViewType } from '../../shell/viewerCapabilityProfile'
import type { DicomTagItem, FolderSeriesItem, MprViewportKey, ViewerTabItem, ViewType } from '../../types/viewer'
import MobileMprViewport from './MobileMprViewport.vue'
import MobileSettingsOverlay from './MobileSettingsOverlay.vue'
import MobileStackViewport from './MobileStackViewport.vue'
import {
  MOBILE_STACK_PLAYBACK_FPS_OPTIONS,
  type MobileGestureSensitivity,
  type MobileOrientationLock,
  type MobileStackPlaybackFps,
  useMobileViewerPreferences
} from './useMobileViewerPreferences'

type MobileViewportKind = 'Stack' | 'MPR' | 'Tag'
type MobileToolKey = 'scroll' | 'crosshair' | 'window' | 'pan' | 'zoom' | 'play'
type MobileSheetKind = 'series' | 'window' | 'display' | 'transform' | 'color' | 'playback' | 'mpr' | 'tag' | null
type MobileSheetTabKey = Exclude<MobileSheetKind, null>
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

interface MobileSliceSliderState {
  draftSlice: number
  isDragging: boolean
  lastSentSlice: number
  total: number
  viewportKey: string
}

const SAMPLE_PATH_NOT_CONFIGURED_DETAIL = 'WEB_SAMPLE_DICOM_PATH is not configured'
const DEFAULT_MOBILE_DEV_SAMPLE_DICOM_PATH = 'D:/testDicom/sample'
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

const viewer = useViewerWorkspace()
const { locale } = useUiLocale()
const {
  getWindowPresetLabel,
  selectedPseudocolorKey,
  selectedWindowPresetId,
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
  stackPlaybackFps
} = useMobileViewerPreferences()
const {
  getStarredSliceCount,
  isSliceStarred,
  toggleSliceStar
} = useKeySliceStars()

const activeTool = ref<MobileToolKey>('scroll')
const activeSheetKind = ref<MobileSheetKind>(null)
const activeMprViewportKey = ref<MprViewportKey>(mprDefaultViewport.value)
const isLoadingDemo = ref(false)
const isSettingsOpen = ref(false)
const isPlayingStack = ref(false)
const playbackFps = ref<MobileStackPlaybackFps>(stackPlaybackFps.value)
const sliceSliderState = ref<MobileSliceSliderState | null>(null)
const tagSearchQuery = ref('')
const orientationLockNoticeShown = ref(false)

let playbackTimer: ReturnType<typeof window.setInterval> | null = null

const isZh = computed(() => locale.value === 'zh-CN')
const activeStackTab = computed(() => (viewer.activeTab.value?.viewType === 'Stack' ? viewer.activeTab.value : null))
const activeMprTab = computed(() => (viewer.activeTab.value?.viewType === 'MPR' ? viewer.activeTab.value : null))
const activeTagTab = computed(() => (viewer.activeTab.value?.viewType === 'Tag' ? viewer.activeTab.value : null))
const activeImageTab = computed(() => activeStackTab.value ?? activeMprTab.value)
const activeViewportKind = computed<MobileViewportKind | null>(() => {
  if (activeStackTab.value) {
    return 'Stack'
  }
  if (activeMprTab.value) {
    return 'MPR'
  }
  if (activeTagTab.value) {
    return 'Tag'
  }
  return null
})
const selectedSeries = computed(() => viewer.seriesList.value.find((series) => series.seriesId === viewer.selectedSeriesId.value) ?? null)
const mobileSeriesList = computed(() => viewer.seriesList.value.filter((series) => series.isImageSeries !== false))
const canLoadDemo = computed(() => supportsViewerDataSource(mobileViewerCapabilityProfile, 'server-sample'))
const canOpenStack = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'Stack'))
const canOpenMpr = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'MPR'))
const canOpenTag = computed(() => supportsViewerViewType(mobileViewerCapabilityProfile, 'Tag'))
const seriesCountLabel = computed(() => `${mobileSeriesList.value.length}`)
const activeSeriesId = computed(() => activeImageTab.value?.seriesId || activeTagTab.value?.seriesId || viewer.selectedSeriesId.value)

const activeTitle = computed(() => {
  const tab = viewer.activeTab.value
  if (tab?.title) {
    return tab.title
  }
  const series = selectedSeries.value
  return series?.seriesDescription || series?.seriesId || (isZh.value ? '移动端阅片' : 'Mobile Viewer')
})

const activeSliceLabelSource = computed(() => {
  if (activeStackTab.value) {
    return activeStackTab.value.sliceLabel
  }
  if (activeMprTab.value) {
    return activeMprTab.value.viewportSliceLabels?.[activeMprViewportKey.value] ?? ''
  }
  return ''
})
const activeSliceViewportKey = computed(() => (activeMprTab.value ? activeMprViewportKey.value : 'single'))
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
const isCurrentStackSliceStarred = computed(() =>
  Boolean(activeStackTab.value && activeStackSlice.value && isSliceStarred(activeStackTab.value.seriesId, activeStackSlice.value.index))
)
const activeStackStarCount = computed(() => getStarredSliceCount(activeStackTab.value?.seriesId))
const canPlayStack = computed(() => Boolean(activeStackSlice.value && activeStackSlice.value.total > 1 && activeStackTab.value))
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

const mobileTools = computed<MobileToolbarItem[]>(() => {
  if (activeMprTab.value) {
    return [
      { key: 'crosshair', icon: 'crosshair', label: isZh.value ? '十字线' : 'Cross' },
      { key: 'scroll', icon: 'page', label: isZh.value ? '滚片' : 'Scroll' },
      { key: 'window', icon: 'window', label: isZh.value ? '调窗' : 'Window' },
      { key: 'pan', icon: 'pan', label: isZh.value ? '平移' : 'Pan' },
      { key: 'zoom', icon: 'zoom', label: isZh.value ? '缩放' : 'Zoom' },
      { key: 'more', icon: 'menu', label: isZh.value ? '更多' : 'More' }
    ]
  }

  return [
    { key: 'scroll', icon: 'page', label: isZh.value ? '滚片' : 'Scroll' },
    { key: 'window', icon: 'window', label: isZh.value ? '调窗' : 'Window' },
    { key: 'pan', icon: 'pan', label: isZh.value ? '平移' : 'Pan' },
    { key: 'zoom', icon: 'zoom', label: isZh.value ? '缩放' : 'Zoom' },
    { key: 'play', icon: isPlayingStack.value ? 'pause' : 'play', label: isPlayingStack.value ? (isZh.value ? '暂停' : 'Pause') : (isZh.value ? '播放' : 'Play') },
    { key: 'more', icon: 'menu', label: isZh.value ? '更多' : 'More' }
  ]
})

const mobileSheetTabs = computed<Array<{ key: MobileSheetTabKey; icon: string; label: string }>>(() => {
  const tabs: Array<{ key: MobileSheetTabKey; icon: string; label: string }> = [
    { key: 'series', icon: 'layout', label: isZh.value ? '序列' : 'Series' }
  ]

  if (!activeImageTab.value) {
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
      { key: 'tag', icon: 'tag', label: 'Tag' }
    )
  }

  if (activeMprTab.value) {
    tabs.push({ key: 'mpr', icon: 'crosshair', label: 'MPR' })
  }

  return tabs
})

const sheetTitle = computed(() => {
  const titleMap: Record<MobileSheetTabKey, string> = {
    color: isZh.value ? '伪彩' : 'Pseudocolor',
    display: isZh.value ? '显示叠加' : 'Display',
    mpr: 'MPR',
    playback: isZh.value ? '播放' : 'Playback',
    series: isZh.value ? '序列' : 'Series',
    tag: 'DICOM Tag',
    transform: isZh.value ? '变换' : 'Transform',
    window: isZh.value ? '窗模板' : 'Window Presets'
  }
  return activeSheetKind.value ? titleMap[activeSheetKind.value] : ''
})

const displayOverlayOptions = computed<Array<{ key: DisplayOverlayKey; icon: string; label: string; enabled: boolean }>>(() => [
  { key: 'cornerInfo', icon: 'info', label: isZh.value ? '四角信息' : 'Corner Info', enabled: activeImageTab.value?.showCornerInfo !== false },
  { key: 'scaleBar', icon: 'measure', label: isZh.value ? '比例尺' : 'Scale Bar', enabled: activeImageTab.value?.showScaleBar !== false }
])

function normalizeToolOperation(tool: MobileToolKey): string {
  const operation = tool === 'scroll' ? VIEW_OPERATION_TYPES.scroll : tool
  return `${STACK_OPERATION_PREFIX}${operation}`
}

function setActiveMobileTool(tool: MobileToolKey, options: { closeSheet?: boolean } = {}): void {
  if (tool === 'play') {
    toggleStackPlayback()
    return
  }

  activeTool.value = tool
  viewer.setActiveOperation(normalizeToolOperation(tool))
  if (options.closeSheet !== false) {
    activeSheetKind.value = null
  }
}

function applyDefaultToolForView(viewType: ViewType): void {
  if (viewType === 'Stack') {
    setActiveMobileTool(stackDefaultTool.value, { closeSheet: false })
    return
  }
  if (viewType === 'MPR') {
    setActiveMobileTool(mprDefaultTool.value, { closeSheet: false })
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
  if (viewType === 'Stack') {
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

async function openSeriesView(seriesId: string, viewType: ViewType): Promise<void> {
  const supported =
    viewType === 'Stack' ? canOpenStack.value : viewType === 'MPR' ? canOpenMpr.value : viewType === 'Tag' ? canOpenTag.value : false
  if (!supported) {
    return
  }

  stopStackPlayback()
  viewer.selectSeries(seriesId)
  if (viewType === 'MPR') {
    activeMprViewportKey.value = mprDefaultViewport.value
  }
  await viewer.openSeriesView(seriesId, viewType, { useHangingProtocol: false })
  if (viewType === 'MPR') {
    viewer.setActiveViewportKey(activeMprViewportKey.value)
  }
  if (viewType === 'Stack' || viewType === 'MPR') {
    applyMobileViewDefaults(viewType)
  }
  activeSheetKind.value = null
}

async function openSeriesStack(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, 'Stack')
}

async function openSeriesMpr(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, 'MPR')
}

async function openSeriesTag(seriesId: string): Promise<void> {
  await openSeriesView(seriesId, 'Tag')
}

function getBackendErrorDetail(error: unknown): string {
  const responseData = (error as { response?: { data?: unknown } } | null)?.response?.data
  if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
    const detail = (responseData as { detail?: unknown }).detail
    return typeof detail === 'string' ? detail.trim() : ''
  }
  return ''
}

function getMobileDevSampleDicomPath(): string | null {
  if (!import.meta.env.DEV) {
    return null
  }

  const configuredPath = import.meta.env.VITE_MOBILE_DEV_SAMPLE_DICOM_PATH?.trim()
  return configuredPath || DEFAULT_MOBILE_DEV_SAMPLE_DICOM_PATH
}

async function loadMobileDemoResponse() {
  try {
    return await postApi('LoadSampleFolderApiV1DicomLoadSamplePost', undefined)
  } catch (error) {
    const devSamplePath = getMobileDevSampleDicomPath()
    if (devSamplePath && getBackendErrorDetail(error) === SAMPLE_PATH_NOT_CONFIGURED_DETAIL) {
      return postApi('LoadFolderApiV1DicomLoadFolderPost', { folderPath: devSamplePath })
    }
    throw error
  }
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
    const loadedSeries = await viewer.applyLoadedDicomSeries(response, {
      openFirstSeriesView: false,
      selectLoadedSeries: true
    })
    const firstStackSeries = loadedSeries.find((series) => series.isImageSeries !== false) ?? loadedSeries[0] ?? null
    if (firstStackSeries) {
      await openSeriesStack(firstStackSeries.seriesId)
    }
  } catch (error) {
    console.error(error)
    viewer.showStatusToast(isZh.value ? '示例影像加载失败，请检查后端服务。' : 'Failed to load demo images. Check the backend service.', 'error')
  } finally {
    isLoadingDemo.value = false
  }
}

function openSheet(kind: MobileSheetTabKey): void {
  activeSheetKind.value = kind
}

function openMoreSheet(): void {
  activeSheetKind.value = activeMprTab.value ? 'mpr' : 'window'
}

function closeSheet(): void {
  activeSheetKind.value = null
}

function clampSliceValue(value: number, total: number): number {
  return Math.max(1, Math.min(total, Math.trunc(value)))
}

function getSliceSliderState(slice: NonNullable<ReturnType<typeof parseSliceLabel>>, viewportKey: string): MobileSliceSliderState {
  const currentState = sliceSliderState.value
  if (!currentState || currentState.viewportKey !== viewportKey || currentState.total !== slice.total) {
    const nextState = {
      draftSlice: slice.current,
      isDragging: false,
      lastSentSlice: slice.current,
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

  viewer.handleViewportWheel({
    viewportKey,
    deltaY
  })
  sliderState.lastSentSlice = sliderState.draftSlice
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
  activeSheetKind.value = null
}

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
  viewer.triggerViewAction({ action: 'pseudocolor', value })
  activeSheetKind.value = null
}

function applyTransform(value: string): void {
  viewer.triggerViewAction({ action: 'rotate', value })
  activeSheetKind.value = null
}

function handleResetView(): void {
  viewer.triggerViewAction({ action: 'reset' })
  activeSheetKind.value = null
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

function toggleStackStarForCurrentSlice(): void {
  const tab = activeStackTab.value
  const slice = activeStackSlice.value
  if (!tab || !slice) {
    return
  }
  toggleSliceStar(tab.seriesId, slice.index)
}

function getCurrentStackSliceInfo(): { current: number; total: number } | null {
  const slice = activeStackSlice.value
  return slice && slice.total > 1 ? { current: slice.current, total: slice.total } : null
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
  stopStackPlayback()
  isPlayingStack.value = true
  playbackTimer = window.setInterval(tickStackPlayback, Math.max(34, Math.round(1000 / playbackFps.value)))
}

function stopStackPlayback(): void {
  if (playbackTimer != null) {
    window.clearInterval(playbackTimer)
    playbackTimer = null
  }
  isPlayingStack.value = false
}

function toggleStackPlayback(): void {
  if (isPlayingStack.value) {
    stopStackPlayback()
    return
  }
  startStackPlayback()
}

function setPlaybackFps(value: MobileStackPlaybackFps): void {
  playbackFps.value = value
  if (isPlayingStack.value) {
    startStackPlayback()
  }
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

function isToolbarItemActive(tool: MobileToolbarItem): boolean {
  if (tool.key === 'more') {
    return activeSheetKind.value !== null
  }
  if (tool.key === 'play') {
    return isPlayingStack.value
  }
  return activeTool.value === tool.key
}

function isToolbarItemDisabled(tool: MobileToolbarItem): boolean {
  if (tool.key === 'play') {
    return !canPlayStack.value
  }
  return !activeImageTab.value
}

function handleToolbarItem(tool: MobileToolbarItem): void {
  if (tool.key === 'more') {
    openMoreSheet()
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
    stopStackPlayback()
    if (viewType === 'MPR') {
      viewer.setActiveViewportKey(activeMprViewportKey.value)
      applyMobileViewDefaults('MPR')
      return
    }
    if (viewType === 'Stack') {
      applyMobileViewDefaults('Stack')
    }
  }
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
    stopStackPlayback()
    sliceSliderState.value = null
    tagSearchQuery.value = ''
  }
)

watch(
  [activeSlice, activeSliceViewportKey],
  ([slice, viewportKey]) => {
    const sliderState = sliceSliderState.value
    if (!slice || !sliderState || sliderState.viewportKey !== viewportKey) {
      sliceSliderState.value = null
      return
    }
    if (!sliderState.isDragging && sliderState.lastSentSlice === slice.current) {
      sliceSliderState.value = null
    }
  }
)

watch(
  stackDefaultTool,
  () => {
    if (activeStackTab.value) {
      applyDefaultToolForView('Stack')
    }
  }
)

watch(
  mprDefaultTool,
  () => {
    if (activeMprTab.value) {
      applyDefaultToolForView('MPR')
    }
  }
)

watch(
  stackPlaybackFps,
  (value) => {
    playbackFps.value = value
    if (isPlayingStack.value) {
      startStackPlayback()
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
  stopStackPlayback()
  void applyOrientationLock('unlocked')
})
</script>

<template>
  <div class="mobile-shell" :class="mobileShellClasses">
    <header class="mobile-shell__header">
      <div class="mobile-shell__title-group">
        <div class="mobile-shell__eyebrow">{{ isZh ? 'DicomVision 移动端' : 'DicomVision Mobile' }}</div>
        <div class="mobile-shell__title">{{ activeTitle }}</div>
      </div>
      <div class="mobile-shell__header-actions">
        <button
          type="button"
          class="mobile-shell__icon-button"
          :disabled="mobileSeriesList.length === 0"
          data-testid="mobile-series-button"
          @click="openSheet('series')"
        >
          <AppIcon name="layout" :size="18" />
          <span>{{ seriesCountLabel }}</span>
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
        v-if="activeViewportKind !== 'MPR' && activeViewportKind !== 'Tag'"
        :active-operation="viewer.activeOperation.value"
        :active-tab="viewer.activeTab.value"
        :is-view-loading="viewer.isViewLoading.value"
        :scroll-threshold="scrollDragThreshold"
        @active-viewport-change="viewer.setActiveViewportKey"
        @hover-viewport-change="viewer.handleHoverViewportChange"
        @viewport-drag="viewer.handleViewportDrag"
        @viewport-wheel="viewer.handleViewportWheel"
        @workspace-ready="viewer.setViewerStage"
      />

      <MobileMprViewport
        v-else-if="activeMprTab"
        :active-mpr-viewport-key="activeMprViewportKey"
        :active-operation="viewer.activeOperation.value"
        :active-tab="viewer.activeTab.value"
        :is-view-loading="viewer.isViewLoading.value"
        :scroll-threshold="scrollDragThreshold"
        :show-reference-thumbnails="mprShowReferenceThumbnails"
        @active-viewport-change="handleMprActiveViewportChange"
        @hover-viewport-change="viewer.handleHoverViewportChange"
        @mpr-crosshair="viewer.handleMprCrosshair"
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
          <div class="mobile-shell__empty-mark">
            <AppIcon name="play" :size="28" />
          </div>
          <div class="mobile-shell__empty-title">{{ isZh ? '加载示例影像' : 'Load Demo Images' }}</div>
          <button
            type="button"
            class="mobile-shell__primary-action"
            :disabled="!canLoadDemo || isLoadingDemo"
            @click="loadDemoSeries"
          >
            <AppIcon :name="isLoadingDemo ? 'connecting' : 'play'" :size="18" />
            <span>{{ isLoadingDemo ? (isZh ? '正在加载...' : 'Loading...') : (isZh ? '加载示例影像' : 'Load Demo') }}</span>
          </button>
        </div>
      </div>
    </main>

    <section
      v-if="activeImageTab"
      class="mobile-shell__slice-panel"
      :class="{ 'mobile-shell__slice-panel--mpr': activeMprTab }"
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
    </section>

    <nav v-if="activeImageTab" class="mobile-shell__toolbar" aria-label="Mobile viewer tools">
      <button
        v-for="tool in mobileTools"
        :key="tool.key"
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
    </nav>

    <div v-if="activeSheetKind" class="mobile-shell__sheet-backdrop" @click.self="closeSheet">
      <section class="mobile-shell__sheet" aria-label="Mobile tools">
        <div class="mobile-shell__sheet-handle" aria-hidden="true"></div>
        <div class="mobile-shell__sheet-header">
          <div>
            <div class="mobile-shell__sheet-title">{{ sheetTitle }}</div>
            <div class="mobile-shell__sheet-subtitle">{{ activeViewportKind || 'Mobile' }}</div>
          </div>
          <button type="button" class="mobile-shell__sheet-close" @click="closeSheet">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
        <div class="mobile-shell__sheet-tabs" role="tablist" aria-label="Mobile quick tools">
          <button
            v-for="tab in mobileSheetTabs"
            :key="tab.key"
            type="button"
            class="mobile-shell__sheet-tab"
            :class="{ 'mobile-shell__sheet-tab--active': activeSheetKind === tab.key }"
            :data-testid="`mobile-sheet-tab-${tab.key}`"
            @click="activeSheetKind = tab.key"
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
            >
              <span class="mobile-shell__series-modality">{{ series.modality || 'DICOM' }}</span>
              <span class="mobile-shell__series-body">
                <span class="mobile-shell__series-title">{{ series.seriesDescription || series.seriesId }}</span>
                <span class="mobile-shell__series-meta">{{ formatSeriesMeta(series) }}</span>
              </span>
              <span class="mobile-shell__series-actions">
                <button
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
                  type="button"
                  class="mobile-shell__series-view-button"
                  :class="{ 'mobile-shell__series-view-button--active': isSeriesViewActive(series.seriesId, 'MPR') }"
                  data-testid="mobile-open-mpr"
                  :data-active="isSeriesViewActive(series.seriesId, 'MPR')"
                  :disabled="!canOpenMpr"
                  @click="openSeriesMpr(series.seriesId)"
                >
                  MPR
                </button>
              </span>
            </div>
          </div>

          <div v-else-if="activeSheetKind === 'window'" class="mobile-shell__action-list">
            <button
              v-for="preset in windowPresets"
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
            <button type="button" class="mobile-shell__action-row" data-testid="mobile-reset-view" @click="handleResetView">
              <AppIcon name="reset" :size="18" />
              <span>
                <strong>{{ isZh ? '重置当前视图' : 'Reset View' }}</strong>
                <small>{{ isZh ? '恢复当前视口显示状态' : 'Restore the active viewport state' }}</small>
              </span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'color'" class="mobile-shell__action-list">
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
            <button type="button" class="mobile-shell__action-row" data-testid="mobile-toggle-star" @click="toggleStackStarForCurrentSlice">
              <AppIcon :name="isCurrentStackSliceStarred ? 'star' : 'star-outline'" :size="18" />
              <span>
                <strong>{{ isCurrentStackSliceStarred ? (isZh ? '取消关键帧' : 'Unstar Slice') : (isZh ? '收藏关键帧' : 'Star Slice') }}</strong>
                <small>{{ activeStackStarCount }} {{ isZh ? '张已收藏' : 'starred' }}</small>
              </span>
            </button>
          </div>

          <div v-else-if="activeSheetKind === 'playback'" class="mobile-shell__action-list">
            <button type="button" class="mobile-shell__action-row" data-testid="mobile-playback-toggle" :disabled="!canPlayStack" @click="toggleStackPlayback">
              <AppIcon :name="isPlayingStack ? 'pause' : 'play'" :size="18" />
              <span><strong>{{ isPlayingStack ? (isZh ? '暂停播放' : 'Pause') : (isZh ? '开始播放' : 'Play') }}</strong></span>
            </button>
            <div class="mobile-shell__fps-grid">
              <button
                v-for="fps in MOBILE_STACK_PLAYBACK_FPS_OPTIONS"
                :key="fps"
                type="button"
                :class="{ active: playbackFps === fps }"
                data-testid="mobile-playback-fps"
                @click="setPlaybackFps(fps)"
              >
                {{ fps }} FPS
              </button>
            </div>
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

    <MobileSettingsOverlay :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
  </div>
</template>

<style scoped>
.mobile-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  height: 100dvh;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(10, 16, 24, 0.96), rgba(3, 7, 12, 0.99));
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
  background: rgba(7, 12, 19, 0.84);
  backdrop-filter: blur(18px);
}

.mobile-shell__title-group {
  min-width: 0;
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
.mobile-shell__action-row:disabled {
  opacity: 0.48;
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
  background: rgba(9, 16, 26, 0.92);
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

.mobile-shell__slice-panel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 64%, transparent);
  background: rgba(7, 12, 19, 0.86);
  backdrop-filter: blur(18px);
}

.mobile-shell__plane-tabs {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.mobile-shell__plane-tabs button,
.mobile-shell__fps-grid button,
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
.mobile-shell__fps-grid button.active,
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

.mobile-shell__toolbar {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  padding: 8px 10px calc(env(safe-area-inset-bottom, 0px) + 10px);
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  background: rgba(7, 12, 19, 0.9);
  backdrop-filter: blur(18px);
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
  z-index: 40;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.48);
}

.mobile-shell__sheet {
  width: 100%;
  max-height: min(74dvh, 640px);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 80%, transparent);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 96%, black);
  box-shadow: 0 -24px 60px rgba(0, 0, 0, 0.45);
}

.mobile-shell__sheet-handle {
  width: 44px;
  height: 4px;
  margin: 10px auto 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-muted) 56%, transparent);
}

.mobile-shell__sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px 12px;
}

.mobile-shell__sheet-title {
  font-size: 18px;
  font-weight: 900;
}

.mobile-shell__sheet-subtitle {
  color: var(--theme-text-muted);
  font-size: 12px;
}

.mobile-shell__sheet-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 0 10px 10px;
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
  max-height: calc(min(74dvh, 640px) - 136px);
  overflow: auto;
  padding: 0 10px 14px;
}

.mobile-shell__series-list,
.mobile-shell__action-list {
  display: grid;
  gap: 7px;
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
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 88%, black);
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

.mobile-shell__fps-grid,
.mobile-shell__plane-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
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
  background: #05080d;
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
  background: rgba(8, 14, 22, 0.94);
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
    grid-template-columns: minmax(138px, 160px) auto minmax(160px, 1fr);
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
    max-height: min(64dvh, 360px);
  }

  .mobile-shell__sheet-content {
    max-height: calc(min(64dvh, 360px) - 128px);
  }

  .mobile-shell__toast {
    bottom: calc(env(safe-area-inset-bottom, 0px) + 54px);
  }
}
</style>
