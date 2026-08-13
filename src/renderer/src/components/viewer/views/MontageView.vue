<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { CornerInfo, MontageTransformInfo, ViewerTabItem, WindowLevelInfo } from '../../../types/viewer'
import { onApiBaseURLChange, resolveBackendAssetUrl } from '../../../services/apiBase'
import { getWorkspaceId, WORKSPACE_HEADER } from '../../../services/workspaceIdentity'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import {
  getViewportCornerInfoItemLabel,
  resolveViewportCornerInfoLineMap,
  VIEWPORT_CORNER_INFO_CATALOG,
  VIEWPORT_CORNER_POSITIONS,
  type ViewportCornerInfoItemKey
} from '../../../composables/ui/viewportCornerInfo'
import { normalizeCornerInfo } from '../../../composables/workspace/views/viewerWorkspaceTabs'
import {
  PSEUDOCOLOR_PRESET_OPTIONS,
  normalizePseudocolorPresetKey
} from '../../../constants/pseudocolor'
import {
  createMontageTileLoader,
  type MontageTileRequest,
  type MontageTileState
} from './montageTileLoader'
import {
  applyMontagePanDrag,
  applyMontageZoomDrag,
  normalizeMontageTransform
} from '../../../composables/workspace/views/montageTransform'
import {
  createRenderedImageUrlRegistry,
  releaseRenderedImageObjectUrl,
  retainRenderedImageObjectUrl
} from '../../../composables/workspace/views/renderedImageUrlRegistry'

const props = withDefaults(defineProps<{
  activeTab: ViewerTabItem
  activeOperation: string
  starredSliceIndexes?: number[]
}>(), {
  starredSliceIndexes: () => []
})

const emit = defineEmits<{
  openSlice: [payload: { seriesId: string; sliceIndex: number }]
  stateChange: [payload: {
    tabKey: string
    columnCount?: number
    selectedSliceIndex?: number
    scrollTop?: number
    transform?: MontageTransformInfo
    windowInfo?: WindowLevelInfo
    commonInfoExpanded?: boolean
  }]
  toggleSliceStar: [payload: { sliceIndex: number }]
  retryDisplayConfig: [tabKey: string]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  pointerCancel: [event: PointerEvent]
}>()

const { locale } = useUiLocale()
const { montageColumnCount, viewportCornerInfoPreference } = useUiPreferences()
const isZh = computed(() => locale.value === 'zh-CN')
const scroller = ref<HTMLElement | null>(null)
const columnCount = ref(Math.max(2, Math.min(6, props.activeTab.montageColumnCount ?? montageColumnCount.value)))
const selectedSliceIndex = ref(Math.max(0, props.activeTab.montageSelectedSliceIndex ?? 0))
const montageTransform = ref(normalizeMontageTransform(props.activeTab.montageTransformState))
const localWindowInfo = ref<WindowLevelInfo | null>(resolveTabWindowInfo(props.activeTab))
const windowPreviewOrigin = ref<WindowLevelInfo | null>(null)
const headerCornerInfo = ref<CornerInfo | null>(null)
const commonInfoRegion = ref<HTMLElement | null>(null)
const tileStates = ref<Record<number, MontageTileState>>({})
const presentedTileStates = ref<Record<number, MontageTileState>>({})
const presentedWindowInfo = ref<WindowLevelInfo | null>(localWindowInfo.value)
const presentedPseudocolorPreset = ref(props.activeTab.pseudocolorPreset)
const backendRevision = ref(0)
const scrollerWidth = ref(0)
const scrollerHeight = ref(0)
const scrollerScrollTop = ref(0)
let resizeObserver: ResizeObserver | null = null
let scrollFrame: number | null = null
let displayRefreshTimer: ReturnType<typeof setTimeout> | null = null
let queuedVisibleTileRefresh = false
let requestedRenderIntent: 'preview' | 'final' = 'final'
let requestedPresentationKey = ''
let stopWatchingApiBaseUrl: (() => void) | null = null
let headerCornerInfoController: AbortController | null = null
let isPreparingInitialTileSync = false
let pointerSession: {
  pointerId: number
  operation: 'window' | 'pan' | 'zoom'
  startX: number
  startY: number
  startEvent: PointerEvent
  originTransform: MontageTransformInfo
  originWindowInfo: WindowLevelInfo
  startTileIndex: number | null
  dragged: boolean
  captureStarted: boolean
} | null = null
let suppressTileActivation = false
let lastPointerTileActivation: { sliceIndex: number; timestamp: number } | null = null

const MONTAGE_GRID_GAP = 8
const MONTAGE_GRID_PADDING = 8
const MONTAGE_OVERSCAN_ROWS = 1
const FALLBACK_RENDER_ROWS = 4
const POINTER_DRAG_THRESHOLD = 4
const WINDOW_DRAG_REFERENCE_WIDTH = 400
const WINDOW_DRAG_MAX_SENSITIVITY = 2
const WINDOW_DRAG_MIN_SENSITIVITY = 0.01
const CT_WINDOW_WIDTH_MIN = 1
const PET_WINDOW_WIDTH_MIN = 0.000001
const SLICE_CORNER_KEYS = new Set<ViewportCornerInfoItemKey>([
  'viewportLocation',
  'imageIndex',
  'sliceLocation',
  'instanceNumber',
  'sopInstanceUid',
  'imagePositionPatient',
  'imageOrientationPatient'
])
const RUNTIME_CORNER_KEYS = new Set<ViewportCornerInfoItemKey>([
  'windowLevel',
  'zoom',
  'coordinates',
  'transform2dState'
])

interface CommonCornerInfoItem {
  id: string
  key: ViewportCornerInfoItemKey
  line: string
  label: string
}

const COMMON_INFO_PRIORITY: ViewportCornerInfoItemKey[] = [
  'patientName',
  'patientSummary',
  'examDescription',
  'seriesDescription',
  'modality',
  'seriesNumber',
  'acquisitionDateTime',
  'technique',
  'sliceThickness'
]
const COMMON_INFO_PRIORITY_INDEX = new Map(
  COMMON_INFO_PRIORITY.map((key, index) => [key, index])
)
const COMPACT_COMMON_INFO_SLOTS: ViewportCornerInfoItemKey[][] = [
  ['patientName'],
  ['patientSummary'],
  ['examDescription', 'seriesDescription'],
  ['technique'],
  ['acquisitionDateTime'],
  ['sliceThickness']
]

const montageImageUrlRegistry = createRenderedImageUrlRegistry()
const tileLoader = createMontageTileLoader({
  createObjectUrl(blob) {
    const imageSrc = URL.createObjectURL(blob)
    montageImageUrlRegistry.markOwned(imageSrc)
    return imageSrc
  },
  revokeObjectUrl(imageSrc) {
    montageImageUrlRegistry.revoke(imageSrc)
  },
  onStateChange(index, state) {
    const nextStates = { ...tileStates.value }
    if (state) {
      nextStates[index] = state
    } else {
      delete nextStates[index]
    }
    tileStates.value = nextStates
  }
})

const sliceCount = computed(() => Math.max(0, Math.trunc(props.activeTab.montageSliceCount ?? 0)))
const isPetMontage = computed(() => Boolean(props.activeTab.petInfo))
const hasAuthoritativePetDisplay = computed(() =>
  !isPetMontage.value || Boolean(props.activeTab.petInfo?.unitOptions?.length)
)
const canLoadMontageTiles = computed(
  () =>
    !props.activeTab.montageDisplayConfigLoading &&
    !props.activeTab.montageDisplayConfigError &&
    hasAuthoritativePetDisplay.value
)
const minimumWindowWidth = computed(resolveMinimumWindowWidth)
const showCornerInfo = computed(() => props.activeTab.showCornerInfo !== false)
const starredSliceIndexSet = computed(() => new Set(props.starredSliceIndexes))
const displayCornerInfo = computed(() => mergeCornerInfo(props.activeTab.cornerInfo, headerCornerInfo.value))
const cornerInfoLineMap = computed(() => resolveViewportCornerInfoLineMap(displayCornerInfo.value))
const activeWindowInfo = computed(() =>
  localWindowInfo.value ??
  resolveDisplayedWindowInfo(props.activeTab) ??
  null
)
const windowStatusLabel = computed(() => {
  if (isPetMontage.value) {
    const windowInfo = presentedWindowInfo.value
    const minimum = windowInfo ? windowInfo.wl - windowInfo.ww / 2 : props.activeTab.petInfo?.petWindowMin
    const maximum = windowInfo ? windowInfo.wl + windowInfo.ww / 2 : props.activeTab.petInfo?.petWindowMax
    const unit = props.activeTab.petInfo?.petUnitLabel ?? props.activeTab.petInfo?.petUnit ?? 'PET'
    return `${formatPetValue(minimum)}–${formatPetValue(maximum)} ${unit}`
  }
  const ww = presentedWindowInfo.value?.ww
  const wl = presentedWindowInfo.value?.wl
  if (ww != null || wl != null) {
    return formatWindowStatus(ww, wl)
  }
  const cornerWindowInfo = resolveWindowInfoFromCornerInfo(displayCornerInfo.value)
  if (cornerWindowInfo) {
    return formatWindowStatus(cornerWindowInfo.ww, cornerWindowInfo.wl)
  }
  return formatWindowLine(props.activeTab.windowLabel) ?? formatWindowStatus(null, null)
})
const pseudocolorStatusLabel = computed(() => {
  const key = normalizePseudocolorPresetKey(presentedPseudocolorPreset.value)
  return PSEUDOCOLOR_PRESET_OPTIONS.find((option) => option.key === key)?.label ?? key
})
const configuredCornerKeys = computed(() =>
  VIEWPORT_CORNER_POSITIONS.flatMap((position) => viewportCornerInfoPreference.value[position])
)
const commonInfoExpanded = computed(() => props.activeTab.montageCommonInfoExpanded === true)
const commonCornerItems = computed<CommonCornerInfoItem[]>(() => {
  if (!showCornerInfo.value) {
    return []
  }
  return configuredCornerKeys.value
    .map((key, configuredIndex) => ({ key, configuredIndex }))
    .filter(({ key }) => !SLICE_CORNER_KEYS.has(key) && !RUNTIME_CORNER_KEYS.has(key))
    .sort((left, right) => {
      const leftPriority = COMMON_INFO_PRIORITY_INDEX.get(left.key) ?? Number.MAX_SAFE_INTEGER
      const rightPriority = COMMON_INFO_PRIORITY_INDEX.get(right.key) ?? Number.MAX_SAFE_INTEGER
      return leftPriority - rightPriority || left.configuredIndex - right.configuredIndex
    })
    .flatMap(({ key }) =>
      (cornerInfoLineMap.value[key] ?? []).map((line) => ({
        id: `${key}:${line}`,
        key,
        line,
        label: getCornerInfoItemLabel(key)
      }))
    )
})
const compactCommonCornerItems = computed<CommonCornerInfoItem[]>(() => {
  const remainingItems = [...commonCornerItems.value]
  const selectedItems: CommonCornerInfoItem[] = []

  for (const slotKeys of COMPACT_COMMON_INFO_SLOTS) {
    const itemIndex = remainingItems.findIndex((item) => slotKeys.includes(item.key))
    if (itemIndex >= 0) {
      selectedItems.push(remainingItems.splice(itemIndex, 1)[0]!)
    }
  }

  selectedItems.push(...remainingItems.slice(0, Math.max(0, 6 - selectedItems.length)))
  return selectedItems.slice(0, 6)
})
const hasExpandableCommonInfo = computed(() => commonCornerItems.value.length > 0)
const rowCount = computed(() => Math.ceil(sliceCount.value / columnCount.value))
const activePointerOperation = computed<'window' | 'pan' | 'zoom' | null>(() => {
  const operation = props.activeOperation.replace(/^stack:/, '').split(':')[0]
  return operation === 'window' || operation === 'pan' || operation === 'zoom'
    ? operation
    : null
})
const scrollerCursorClass = computed(() => {
  if (activePointerOperation.value === 'window') {
    return 'montage-view__scroller--window'
  }
  if (activePointerOperation.value === 'pan') {
    return 'montage-view__scroller--pan'
  }
  if (activePointerOperation.value === 'zoom') {
    return 'montage-view__scroller--zoom'
  }
  return ''
})
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columnCount.value}, minmax(0, 1fr))`
}))
const tileWidth = computed(() => {
  if (scrollerWidth.value <= MONTAGE_GRID_PADDING * 2) {
    return 0
  }
  const availableWidth =
    scrollerWidth.value -
    MONTAGE_GRID_PADDING * 2 -
    MONTAGE_GRID_GAP * Math.max(0, columnCount.value - 1)
  return Math.max(1, availableWidth / columnCount.value)
})
const rowStride = computed(() => tileWidth.value + MONTAGE_GRID_GAP)
const renderedRowRange = computed(() => {
  if (rowCount.value <= 0) {
    return { start: 0, end: -1 }
  }
  if (tileWidth.value <= 0 || scrollerHeight.value <= 0) {
    return {
      start: 0,
      end: Math.min(rowCount.value - 1, FALLBACK_RENDER_ROWS - 1)
    }
  }

  const contentScrollTop = Math.max(0, scrollerScrollTop.value - MONTAGE_GRID_PADDING)
  const firstVisibleRow = Math.min(
    rowCount.value - 1,
    Math.max(0, Math.floor(contentScrollTop / rowStride.value))
  )
  const lastVisibleRow = Math.min(
    rowCount.value - 1,
    Math.max(firstVisibleRow, Math.floor((contentScrollTop + scrollerHeight.value) / rowStride.value))
  )
  return {
    start: Math.max(0, firstVisibleRow - MONTAGE_OVERSCAN_ROWS),
    end: Math.min(rowCount.value - 1, lastVisibleRow + MONTAGE_OVERSCAN_ROWS)
  }
})
const renderedIndexes = computed(() => {
  if (renderedRowRange.value.end < renderedRowRange.value.start) {
    return []
  }
  const firstIndex = renderedRowRange.value.start * columnCount.value
  const endIndex = Math.min(sliceCount.value, (renderedRowRange.value.end + 1) * columnCount.value)
  return Array.from({ length: Math.max(0, endIndex - firstIndex) }, (_, offset) => firstIndex + offset)
})
const virtualizerStyle = computed(() => {
  const rowsBefore = renderedRowRange.value.start
  const rowsAfter = Math.max(0, rowCount.value - renderedRowRange.value.end - 1)
  return {
    paddingTop: `${MONTAGE_GRID_PADDING + rowsBefore * rowStride.value}px`,
    paddingBottom: `${MONTAGE_GRID_PADDING + rowsAfter * rowStride.value}px`
  }
})
const montageImageStyle = computed(() => ({
  transform: `translate3d(${montageTransform.value.offsetX * 100}%, ${montageTransform.value.offsetY * 100}%, 0) scale(${montageTransform.value.zoom})`
}))

function buildTileRequest(index: number, renderIntent: 'preview' | 'final' = requestedRenderIntent): MontageTileRequest {
  const workspaceId = getWorkspaceId()
  const params = new URLSearchParams({
    seriesId: props.activeTab.seriesId,
    sliceIndex: String(index),
    size: '256',
    workspaceId,
    renderIntent
  })
  const windowInfo = activeWindowInfo.value
  if (windowInfo?.ww != null && Number.isFinite(windowInfo.ww) && windowInfo.ww > 0) {
    params.set('ww', String(windowInfo.ww))
  }
  if (windowInfo?.wl != null && Number.isFinite(windowInfo.wl)) {
    params.set('wl', String(windowInfo.wl))
  }
  if (props.activeTab.pseudocolorPreset) {
    params.set('pseudocolorPreset', props.activeTab.pseudocolorPreset)
  }
  if (props.activeTab.petInfo?.petUnit) {
    params.set('petUnit', props.activeTab.petInfo.petUnit)
  }
  return {
    index,
    url: resolveBackendAssetUrl(`/api/v1/dicom/montage/tile?${params.toString()}`),
    displayRevision: props.activeTab.montageDisplayRevision ?? 0,
    renderIntent,
    headers: {
      [WORKSPACE_HEADER]: workspaceId
    }
  }
}

function resolveTilePresentationKey(requestUrl: string | null | undefined): string {
  if (!requestUrl) {
    return ''
  }
  const url = new URL(requestUrl)
  url.searchParams.delete('sliceIndex')
  url.searchParams.delete('renderIntent')
  return url.toString()
}

function buildHeaderCornerInfoRequestUrl(): string {
  const params = new URLSearchParams({
    seriesId: props.activeTab.seriesId,
    sliceIndex: '0',
    workspaceId: getWorkspaceId()
  })
  return resolveBackendAssetUrl(`/api/v1/dicom/montage/corner-info?${params.toString()}`)
}

async function loadHeaderCornerInfo(): Promise<void> {
  if (sliceCount.value <= 0 || !props.activeTab.seriesId) {
    headerCornerInfo.value = null
    return
  }
  headerCornerInfoController?.abort()
  const controller = new AbortController()
  headerCornerInfoController = controller
  try {
    const response = await fetch(buildHeaderCornerInfoRequestUrl(), {
      headers: {
        [WORKSPACE_HEADER]: getWorkspaceId()
      },
      signal: controller.signal
    })
    if (!response.ok || controller.signal.aborted) {
      return
    }
    const data = await response.json() as { cornerInfo?: unknown }
    if (controller.signal.aborted) {
      return
    }
    const normalized = normalizeCornerInfo(data.cornerInfo)
    headerCornerInfo.value = normalized
    if (!normalizeWindowInfo(props.activeTab.currentWindowInfo) && !normalizeWindowInfo(props.activeTab.initialWindowInfo)) {
      const nextWindowInfo = resolveWindowInfoFromCornerInfo(normalized)
      if (nextWindowInfo) {
        updateLocalWindowInfo(nextWindowInfo, 'none')
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.warn('Failed to load montage header corner information.', error)
    }
  } finally {
    if (headerCornerInfoController === controller) {
      headerCornerInfoController = null
    }
  }
}

function syncVisibleTiles(renderIntent: 'preview' | 'final' = requestedRenderIntent): void {
  if (!canLoadMontageTiles.value || (isPreparingInitialTileSync && !activeWindowInfo.value)) {
    return
  }
  requestedRenderIntent = renderIntent
  const requests = renderedIndexes.value.map((index) => buildTileRequest(index, renderIntent))
  if (tileLoader.sync(requests)) {
    requestedPresentationKey = resolveTilePresentationKey(requests[0]?.url)
  }
}

function syncVisibleContent(): void {
  syncVisibleTiles()
}

async function prepareInitialVisibleContent(): Promise<void> {
  if (!canLoadMontageTiles.value) {
    return
  }
  if (!activeWindowInfo.value && sliceCount.value > 0) {
    isPreparingInitialTileSync = true
    try {
      await loadHeaderCornerInfo()
    } finally {
      isPreparingInitialTileSync = false
    }
    syncVisibleContent()
    return
  }
  syncVisibleContent()
  void loadHeaderCornerInfo()
}

function measureScroller(): void {
  const element = scroller.value
  if (!element) {
    return
  }
  scrollerWidth.value = element.clientWidth
  scrollerHeight.value = element.clientHeight
  scrollerScrollTop.value = element.scrollTop
}

function handleScrollerScroll(): void {
  if (scrollFrame != null) {
    return
  }
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null
    measureScroller()
    emit('stateChange', {
      tabKey: props.activeTab.key,
      scrollTop: scrollerScrollTop.value
    })
  })
}

function retryTile(index: number): void {
  void index
  tileLoader.retryBatch(renderedIndexes.value.map((tileIndex) => buildTileRequest(tileIndex, 'final')))
}

function tileErrorText(state: MontageTileState | undefined): string {
  if (!state || state.status !== 'error') {
    return ''
  }
  if (state.errorCode === 'backend-incompatible') {
    return isZh.value ? '平铺接口不可用，请重启配套后端' : 'Montage API unavailable; restart the paired backend'
  }
  if (state.httpStatus === 404) {
    return isZh.value ? '切片或序列不存在' : 'Slice or series was not found'
  }
  if (state.httpStatus === 422) {
    return isZh.value ? '此切片无法解码' : 'This slice could not be decoded'
  }
  return isZh.value ? '影像加载失败' : 'Image failed to load'
}

function selectSlice(index: number): void {
  selectedSliceIndex.value = index
  emit('stateChange', {
    tabKey: props.activeTab.key,
    selectedSliceIndex: index
  })
}

function openSlice(index: number): void {
  selectedSliceIndex.value = index
  emit('openSlice', {
    seriesId: props.activeTab.seriesId,
    sliceIndex: index
  })
}

function resolvePointerOperation(event: PointerEvent): 'window' | 'pan' | 'zoom' | null {
  if (event.button === 2) {
    return 'zoom'
  }
  if (event.button !== 0) {
    return null
  }
  return activePointerOperation.value
}

function resolveTileIndexFromTarget(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) {
    return null
  }
  const tile = target.closest<HTMLElement>('[data-slice-index]')
  const sliceIndex = Number(tile?.dataset.sliceIndex)
  return Number.isFinite(sliceIndex)
    ? Math.max(0, Math.min(sliceCount.value - 1, Math.trunc(sliceIndex)))
    : null
}

function handleScrollerPointerDown(event: PointerEvent): void {
  if (!event.isPrimary) {
    return
  }
  const target = event.target
  if (
    !(target instanceof Element) ||
    !target.closest('.montage-view__scroller') ||
    target.closest('button')
  ) {
    return
  }
  const operation = resolvePointerOperation(event)
  if (!operation) {
    return
  }
  pointerSession = {
    pointerId: event.pointerId,
    operation,
    startX: event.clientX,
    startY: event.clientY,
    startEvent: event,
    originTransform: normalizeMontageTransform(montageTransform.value),
    originWindowInfo: resolveWindowInfo(activeWindowInfo.value, props.activeTab),
    startTileIndex: resolveTileIndexFromTarget(event.target),
    dragged: false,
    captureStarted: false
  }
  if (operation === 'window') {
    windowPreviewOrigin.value = pointerSession.originWindowInfo
  }
  const surface = getInteractionSurface()
  if (surface) {
    try {
      surface.setPointerCapture(event.pointerId)
      pointerSession.captureStarted = true
    } catch {
      pointerSession.captureStarted = false
    }
  }
}

function getInteractionSurface(): HTMLElement | null {
  return scroller.value
}

function updateLocalTransform(nextTransform: MontageTransformInfo): void {
  montageTransform.value = normalizeMontageTransform(nextTransform)
  emit('stateChange', {
    tabKey: props.activeTab.key,
    transform: montageTransform.value
  })
}

function isDefaultMontageTransform(value: MontageTransformInfo): boolean {
  return value.zoom === 1 && value.offsetX === 0 && value.offsetY === 0
}

function clearVisibleTileRefreshTimer(): void {
  if (displayRefreshTimer) {
    clearTimeout(displayRefreshTimer)
    displayRefreshTimer = null
  }
  queuedVisibleTileRefresh = false
}

function requestDebouncedVisibleTileRefresh(renderIntent: 'preview' | 'final' = 'final'): void {
  clearVisibleTileRefreshTimer()
  displayRefreshTimer = setTimeout(() => {
    displayRefreshTimer = null
    queuedVisibleTileRefresh = false
    syncVisibleTiles(renderIntent)
  }, 90)
}

function requestThrottledVisibleTileRefresh(renderIntent: 'preview' | 'final' = 'preview'): void {
  if (displayRefreshTimer) {
    queuedVisibleTileRefresh = true
    return
  }
  syncVisibleTiles(renderIntent)
  displayRefreshTimer = setTimeout(() => {
    displayRefreshTimer = null
    if (!queuedVisibleTileRefresh) {
      return
    }
    queuedVisibleTileRefresh = false
    requestThrottledVisibleTileRefresh(renderIntent)
  }, 50)
}

function requestVisibleTileRefresh(mode: 'debounce' | 'throttle' = 'debounce'): void {
  if (mode === 'throttle') {
    requestThrottledVisibleTileRefresh('preview')
    return
  }
  requestDebouncedVisibleTileRefresh('final')
}

function flushVisibleTileRefresh(): void {
  clearVisibleTileRefreshTimer()
  syncVisibleTiles('final')
}

function getWindowDragSensitivity(windowWidth: number): number {
  const width = Math.abs(Number(windowWidth))
  if (!Number.isFinite(width) || width <= 0) {
    return 1
  }
  const scaled = width / WINDOW_DRAG_REFERENCE_WIDTH
  return Math.max(WINDOW_DRAG_MIN_SENSITIVITY, Math.min(WINDOW_DRAG_MAX_SENSITIVITY, scaled))
}

function hasRefreshingVisibleTiles(): boolean {
  return renderedIndexes.value.some((index) => tileStates.value[index]?.isRefreshing === true)
}

function clearWindowPreviewWhenReady(): void {
  if (pointerSession?.operation === 'window') {
    return
  }
  if (!windowPreviewOrigin.value || hasRefreshingVisibleTiles()) {
    return
  }
  windowPreviewOrigin.value = null
}

function releasePresentedTiles(): void {
  Object.values(presentedTileStates.value).forEach((state) => {
    releaseRenderedImageObjectUrl(state.imageSrc)
  })
  presentedTileStates.value = {}
}

function commitVisibleTileBatchWhenReady(): void {
  const indexes = renderedIndexes.value
  if (!indexes.length) {
    return
  }
  const nextStates = indexes.map((index) => tileStates.value[index])
  if (nextStates.some((state) => state?.status !== 'ready' || state.isRefreshing || !state.imageSrc)) {
    return
  }
  if (new Set(nextStates.map((state) => state?.batchRevision)).size !== 1) {
    return
  }
  if (nextStates.some((state) => (state?.displayRevision ?? 0) !== (props.activeTab.montageDisplayRevision ?? 0))) {
    return
  }
  const completedPresentationKeys = new Set(
    nextStates.map((state) => resolveTilePresentationKey(state?.requestUrl))
  )
  if (completedPresentationKeys.size !== 1 || !completedPresentationKeys.has(requestedPresentationKey)) {
    return
  }

  const previous = presentedTileStates.value
  const next: Record<number, MontageTileState> = {}
  Object.entries(previous).forEach(([index, state]) => {
    if (!indexes.includes(Number(index))) {
      releaseRenderedImageObjectUrl(state.imageSrc)
    }
  })
  nextStates.forEach((state, offset) => {
    const index = indexes[offset]
    const previousSource = previous[index]?.imageSrc
    if (state.imageSrc !== previousSource) {
      retainRenderedImageObjectUrl(state.imageSrc)
      releaseRenderedImageObjectUrl(previousSource)
    }
    next[index] = state
  })
  presentedTileStates.value = next
  const presentedRequestUrl = nextStates[0]?.requestUrl
  if (presentedRequestUrl) {
    const params = new URL(presentedRequestUrl).searchParams
    const ww = Number(params.get('ww'))
    const wl = Number(params.get('wl'))
    presentedWindowInfo.value = Number.isFinite(ww) && Number.isFinite(wl) ? { ww, wl } : null
    presentedPseudocolorPreset.value = params.get('pseudocolorPreset') ?? props.activeTab.pseudocolorPreset
  } else {
    presentedWindowInfo.value = activeWindowInfo.value ? { ...activeWindowInfo.value } : null
    presentedPseudocolorPreset.value = props.activeTab.pseudocolorPreset
  }
}

function getDisplayedTileState(index: number): MontageTileState | undefined {
  return presentedTileStates.value[index] ?? tileStates.value[index]
}

function applyWindowDrag(
  origin: WindowLevelInfo,
  deltaX: number,
  deltaY: number
): WindowLevelInfo {
  const sensitivity = getWindowDragSensitivity(origin.ww)
  if (isPetMontage.value) {
    const minimum = origin.wl - origin.ww / 2
    const maximum = origin.wl + origin.ww / 2
    const rangeSensitivity = Math.max(
      PET_WINDOW_WIDTH_MIN,
      Math.abs(origin.ww) / WINDOW_DRAG_REFERENCE_WIDTH
    )
    const nextMaximum = Math.max(
      minimum + PET_WINDOW_WIDTH_MIN,
      maximum + (deltaX - deltaY) * rangeSensitivity
    )
    return {
      ww: nextMaximum - minimum,
      wl: (nextMaximum + minimum) / 2
    }
  }
  return {
    ww: Math.max(CT_WINDOW_WIDTH_MIN, origin.ww + deltaX * sensitivity),
    wl: origin.wl - deltaY * sensitivity
  }
}

function updateLocalWindowInfo(
  nextWindowInfo: WindowLevelInfo,
  refreshMode: 'debounce' | 'throttle' | 'none' = 'debounce'
): void {
  localWindowInfo.value = nextWindowInfo
  emit('stateChange', {
    tabKey: props.activeTab.key,
    windowInfo: nextWindowInfo
  })
  if (refreshMode !== 'none') {
    requestVisibleTileRefresh(refreshMode)
  }
}

function handleScrollerPointerMove(event: PointerEvent): void {
  const session = pointerSession
  if (!session || session.pointerId !== event.pointerId) {
    return
  }
  const deltaX = event.clientX - session.startX
  const deltaY = event.clientY - session.startY
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= POINTER_DRAG_THRESHOLD) {
    session.dragged = true
  }
  if (!session.dragged) {
    return
  }
  if (!session.captureStarted) {
    session.captureStarted = true
    getInteractionSurface()?.setPointerCapture(event.pointerId)
  }
  if (session.operation === 'window') {
    event.preventDefault()
    updateLocalWindowInfo(applyWindowDrag(session.originWindowInfo, deltaX, deltaY), 'throttle')
    return
  }
  event.preventDefault()
  updateLocalTransform(
    session.operation === 'pan'
      ? applyMontagePanDrag(session.originTransform, deltaX, deltaY, tileWidth.value)
      : applyMontageZoomDrag(session.originTransform, deltaY)
  )
}

function finishPointerSession(event: PointerEvent, cancelled: boolean): void {
  const session = pointerSession
  if (!session || session.pointerId !== event.pointerId) {
    return
  }
  if (session.operation === 'window') {
    if (session.dragged) {
      event.preventDefault()
      flushVisibleTileRefresh()
    } else {
      windowPreviewOrigin.value = null
    }
  } else {
    if (session.dragged) {
      event.preventDefault()
    }
  }
  const surface = getInteractionSurface()
  if (surface?.hasPointerCapture(event.pointerId)) {
    surface.releasePointerCapture(event.pointerId)
  }
  if (session.dragged) {
    suppressTileActivation = true
    window.setTimeout(() => {
      suppressTileActivation = false
    }, 0)
  } else if (!cancelled && session.startTileIndex != null) {
    const now = performance.now()
    const isDoubleActivation =
      lastPointerTileActivation?.sliceIndex === session.startTileIndex &&
      now - lastPointerTileActivation.timestamp < 350
    if (isDoubleActivation) {
      suppressTileActivation = true
      lastPointerTileActivation = null
      openSlice(session.startTileIndex)
      window.setTimeout(() => {
        suppressTileActivation = false
      }, 0)
    } else {
      selectSlice(session.startTileIndex)
      lastPointerTileActivation = {
        sliceIndex: session.startTileIndex,
        timestamp: now
      }
    }
  }
  pointerSession = null
  clearWindowPreviewWhenReady()
}

function handleScrollerPointerUp(event: PointerEvent): void {
  finishPointerSession(event, false)
}

function handleScrollerPointerCancel(event: PointerEvent): void {
  finishPointerSession(event, true)
}

function handleTileClick(index: number): void {
  if (suppressTileActivation) {
    return
  }
  selectSlice(index)
}

function handleTileDoubleClick(event: MouseEvent, index: number): void {
  if (suppressTileActivation) {
    event.preventDefault()
    return
  }
  openSlice(index)
}

function formatWindowStatus(ww: number | null | undefined, wl: number | null | undefined): string {
  const formatValue = (value: number | null | undefined) =>
    value != null && Number.isFinite(value) ? String(Math.round(value)) : '—'
  return `WW ${formatValue(ww)} / WL ${formatValue(wl)}`
}

function formatPetValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  if (Math.abs(value) < 10) {
    return value.toFixed(2)
  }
  return Number(value.toFixed(2)).toString()
}

function formatWindowLine(line: string | null | undefined): string | null {
  const normalized = line?.trim()
  if (!normalized) {
    return null
  }
  const match = normalized.match(
    /(?:WW|W|窗宽)\s*:?\s*(-?\d+(?:\.\d+)?)\s*(?:\/|\s+|，|,)*\s*(?:WL|L|窗位)\s*:?\s*(-?\d+(?:\.\d+)?)/i
  )
  if (!match) {
    return normalized
  }
  return formatWindowStatus(Number(match[1]), Number(match[2]))
}

function getCornerInfoItemLabel(key: ViewportCornerInfoItemKey): string {
  const item = VIEWPORT_CORNER_INFO_CATALOG.find((catalogItem) => catalogItem.key === key)
  return item ? getViewportCornerInfoItemLabel(item, isZh.value ? 'zh-CN' : 'en-US') : key
}

function closeCommonInfoExpanded(): void {
  if (!commonInfoExpanded.value) {
    return
  }
  emit('stateChange', {
    tabKey: props.activeTab.key,
    commonInfoExpanded: false
  })
}

function handleDocumentPointerDown(event: PointerEvent): void {
  const target = event.target
  if (target instanceof Node && commonInfoRegion.value?.contains(target)) {
    return
  }
  closeCommonInfoExpanded()
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeCommonInfoExpanded()
  }
}

function parseWindowInfoFromLine(line: string | null | undefined): WindowLevelInfo | null {
  const normalized = line?.trim()
  if (!normalized) {
    return null
  }
  const match = normalized.match(
    /(?:WW|W|窗宽)\s*:?\s*(-?\d+(?:\.\d+)?)\s*(?:\/|\s+|，|,)*\s*(?:WL|L|窗位)\s*:?\s*(-?\d+(?:\.\d+)?)/i
  )
  if (!match) {
    return null
  }
  const ww = Number(match[1])
  const wl = Number(match[2])
  return Number.isFinite(ww) && Number.isFinite(wl)
    ? { ww: Math.max(resolveMinimumWindowWidth(), ww), wl }
    : null
}

function normalizeWindowInfo(value: WindowLevelInfo | null | undefined): WindowLevelInfo | null {
  const ww = Number(value?.ww)
  const wl = Number(value?.wl)
  return Number.isFinite(ww) && Number.isFinite(wl)
    ? { ww: Math.max(resolveMinimumWindowWidth(), ww), wl }
    : null
}

function resolveMinimumWindowWidth(): number {
  return props.activeTab.petInfo ? PET_WINDOW_WIDTH_MIN : CT_WINDOW_WIDTH_MIN
}

function mergeCornerInfo(base: CornerInfo, extra: CornerInfo | null): CornerInfo {
  if (!extra) {
    return base
  }
  const uniqueLines = (lines: string[]) => lines.filter((line, index) => lines.indexOf(line) === index)
  return {
    topLeft: uniqueLines([...(base.topLeft ?? []), ...(extra.topLeft ?? [])]),
    topRight: uniqueLines([...(base.topRight ?? []), ...(extra.topRight ?? [])]),
    bottomLeft: uniqueLines([...(base.bottomLeft ?? []), ...(extra.bottomLeft ?? [])]),
    bottomRight: uniqueLines([...(base.bottomRight ?? []), ...(extra.bottomRight ?? [])]),
    tags: {
      ...(base.tags ?? {}),
      ...(extra.tags ?? {})
    }
  }
}

function resolveWindowInfoFromCornerInfo(cornerInfo: CornerInfo): WindowLevelInfo | null {
  const lineMap = resolveViewportCornerInfoLineMap(cornerInfo)
  const candidateLines = [
    ...lineMap.windowLevel,
    ...(cornerInfo.tags?.windowLevel ?? []),
    ...(cornerInfo.tags?.window_level ?? []),
    ...cornerInfo.topLeft,
    ...cornerInfo.topRight,
    ...cornerInfo.bottomLeft,
    ...cornerInfo.bottomRight
  ]
  for (const line of candidateLines) {
    const windowInfo = parseWindowInfoFromLine(line)
    if (windowInfo) {
      return windowInfo
    }
  }
  return null
}

function resolveTabWindowInfo(tab: ViewerTabItem): WindowLevelInfo | null {
  const petWindowMin = Number(tab.petInfo?.petWindowMin)
  const petWindowMax = Number(tab.petInfo?.petWindowMax)
  const petWindowInfo =
    Number.isFinite(petWindowMin) && Number.isFinite(petWindowMax) && petWindowMax > petWindowMin
      ? {
          ww: petWindowMax - petWindowMin,
          wl: (petWindowMax + petWindowMin) / 2
        }
      : null
  if (tab.petInfo && petWindowInfo) {
    return petWindowInfo
  }
  return (
    normalizeWindowInfo(tab.currentWindowInfo) ??
    normalizeWindowInfo(tab.initialWindowInfo) ??
    parseWindowInfoFromLine(resolveViewportCornerInfoLineMap(tab.cornerInfo).windowLevel[0]) ??
    parseWindowInfoFromLine(tab.windowLabel)
  )
}

function resolveDisplayedWindowInfo(tab: ViewerTabItem): WindowLevelInfo | null {
  return (
    resolveTabWindowInfo(tab) ??
    (headerCornerInfo.value ? resolveWindowInfoFromCornerInfo(headerCornerInfo.value) : null)
  )
}

function resolveWindowInfo(value: WindowLevelInfo | null | undefined, tab: ViewerTabItem): WindowLevelInfo {
  return normalizeWindowInfo(value) ?? resolveTabWindowInfo(tab) ?? { ww: 400, wl: 40 }
}

function setColumnCount(count: number): void {
  const normalized = Math.max(2, Math.min(6, Math.trunc(count)))
  if (normalized === columnCount.value) {
    return
  }
  columnCount.value = normalized
  montageColumnCount.value = normalized
  emit('stateChange', {
    tabKey: props.activeTab.key,
    columnCount: normalized
  })
  void nextTick(() => {
    measureScroller()
    scrollSliceIntoView(selectedSliceIndex.value)
  })
}

function toggleCommonInfoExpanded(): void {
  emit('stateChange', {
    tabKey: props.activeTab.key,
    commonInfoExpanded: !commonInfoExpanded.value
  })
}

function scrollSliceIntoView(index: number): void {
  const element = scroller.value
  if (!element || tileWidth.value <= 0 || rowStride.value <= 0) {
    return
  }
  const row = Math.floor(Math.max(0, index) / columnCount.value)
  const rowTop = MONTAGE_GRID_PADDING + row * rowStride.value
  element.scrollTop = Math.max(0, rowTop - Math.max(0, (element.clientHeight - tileWidth.value) / 2))
  measureScroller()
  emit('stateChange', {
    tabKey: props.activeTab.key,
    scrollTop: element.scrollTop
  })
}

function moveSelection(index: number): void {
  const normalized = Math.max(0, Math.min(sliceCount.value - 1, index))
  selectSlice(normalized)
  void nextTick(() => scrollSliceIntoView(normalized))
}

function handleTileKeydown(event: KeyboardEvent, index: number): void {
  let targetIndex: number | null = null
  if (event.key === 'ArrowLeft') {
    targetIndex = index - 1
  } else if (event.key === 'ArrowRight') {
    targetIndex = index + 1
  } else if (event.key === 'ArrowUp') {
    targetIndex = index - columnCount.value
  } else if (event.key === 'ArrowDown') {
    targetIndex = index + columnCount.value
  } else if (event.key === 'Home') {
    targetIndex = 0
  } else if (event.key === 'End') {
    targetIndex = sliceCount.value - 1
  } else if (event.key === 'Enter') {
    event.preventDefault()
    openSlice(index)
    return
  }
  if (targetIndex == null) {
    return
  }
  event.preventDefault()
  moveSelection(targetIndex)
}

function toggleSliceStar(index: number): void {
  emit('toggleSliceStar', { sliceIndex: index })
}

watch(
  () => props.activeTab.key,
  () => {
    if (displayRefreshTimer) {
      clearVisibleTileRefreshTimer()
    }
    headerCornerInfoController?.abort()
    headerCornerInfoController = null
    headerCornerInfo.value = null
    closeCommonInfoExpanded()
    windowPreviewOrigin.value = null
    lastPointerTileActivation = null
    tileLoader.clear()
    tileStates.value = {}
    releasePresentedTiles()
    columnCount.value = Math.max(2, Math.min(6, props.activeTab.montageColumnCount ?? montageColumnCount.value))
    selectedSliceIndex.value = Math.max(0, props.activeTab.montageSelectedSliceIndex ?? 0)
    montageTransform.value = normalizeMontageTransform(props.activeTab.montageTransformState)
    localWindowInfo.value = resolveTabWindowInfo(props.activeTab)
    presentedWindowInfo.value = localWindowInfo.value ? { ...localWindowInfo.value } : null
    presentedPseudocolorPreset.value = props.activeTab.pseudocolorPreset
    void nextTick(() => {
      if (scroller.value) {
        scroller.value.scrollTop = Math.max(0, props.activeTab.montageScrollTop ?? 0)
      }
      measureScroller()
      void prepareInitialVisibleContent()
    })
  }
)

watch(renderedIndexes, syncVisibleContent)

watch([tileStates, renderedIndexes], () => {
  commitVisibleTileBatchWhenReady()
  clearWindowPreviewWhenReady()
}, { deep: true })

watch(
  () => props.activeTab.montageSelectedSliceIndex,
  (value) => {
    if (!Number.isFinite(value)) {
      return
    }
    selectedSliceIndex.value = Math.max(0, Math.min(sliceCount.value - 1, Math.trunc(Number(value))))
  }
)

watch(
  () => props.activeTab.montageTransformState,
  (value) => {
    const nextTransform = normalizeMontageTransform(value)
    if (
      pointerSession &&
      pointerSession.operation !== 'window' &&
      !isDefaultMontageTransform(nextTransform)
    ) {
      return
    }
    montageTransform.value = nextTransform
  },
  { deep: true }
)

watch(
  () => props.activeTab.montageDisplayRevision,
  (value, previousValue) => {
    if (value == null || value === previousValue) {
      return
    }
    clearVisibleTileRefreshTimer()
    windowPreviewOrigin.value = null
    localWindowInfo.value = resolveDisplayedWindowInfo(props.activeTab)
    syncVisibleTiles('final')
  },
  { flush: 'sync' }
)

watch(
  () => [
    props.activeTab.currentWindowInfo?.ww,
    props.activeTab.currentWindowInfo?.wl,
    props.activeTab.initialWindowInfo?.ww,
    props.activeTab.initialWindowInfo?.wl,
    props.activeTab.windowLabel,
    props.activeTab.petInfo?.petUnit,
    props.activeTab.petInfo?.petWindowMin,
    props.activeTab.petInfo?.petWindowMax
  ],
  () => {
    if (pointerSession?.operation === 'window') {
      return
    }
    localWindowInfo.value = resolveDisplayedWindowInfo(props.activeTab)
  }
)

watch(
  () => [props.activeTab.seriesId, sliceCount.value, backendRevision.value],
  () => {
    headerCornerInfo.value = null
    void loadHeaderCornerInfo()
  }
)

watch(
  () => props.activeTab.montageScrollRequestRevision,
  (_value, previousValue) => {
    if (previousValue == null) {
      return
    }
    void nextTick(() => scrollSliceIntoView(selectedSliceIndex.value))
  }
)

watch(showCornerInfo, (enabled) => {
  if (!enabled) {
    closeCommonInfoExpanded()
  }
})

watch(
  () => [
    props.activeTab.seriesId,
    localWindowInfo.value?.ww ?? props.activeTab.currentWindowInfo?.ww ?? props.activeTab.initialWindowInfo?.ww,
    localWindowInfo.value?.wl ?? props.activeTab.currentWindowInfo?.wl ?? props.activeTab.initialWindowInfo?.wl,
    props.activeTab.pseudocolorPreset,
    props.activeTab.petInfo?.petUnit,
    props.activeTab.petInfo?.petWindowMin,
    props.activeTab.petInfo?.petWindowMax,
    canLoadMontageTiles.value,
    backendRevision.value
  ],
  () => {
    if (pointerSession?.operation === 'window') {
      return
    }
    requestVisibleTileRefresh()
  }
)

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  stopWatchingApiBaseUrl = onApiBaseURLChange(() => {
    backendRevision.value += 1
  })
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => {
      measureScroller()
    })
    if (scroller.value) {
      resizeObserver.observe(scroller.value)
    }
  } else {
    window.addEventListener('resize', measureScroller)
  }
  if (scroller.value) {
    scroller.value.scrollTop = Math.max(0, props.activeTab.montageScrollTop ?? 0)
  }
  measureScroller()
  void prepareInitialVisibleContent()
  if ((props.activeTab.montageScrollRequestRevision ?? 0) > 0) {
    void nextTick(() => scrollSliceIntoView(selectedSliceIndex.value))
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  if (displayRefreshTimer) {
    clearVisibleTileRefreshTimer()
  }
  headerCornerInfoController?.abort()
  headerCornerInfoController = null
  stopWatchingApiBaseUrl?.()
  stopWatchingApiBaseUrl = null
  tileLoader.dispose()
  releasePresentedTiles()
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', measureScroller)
  if (scrollFrame != null) {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = null
  }
})
</script>

<template>
  <section
    class="montage-view viewer-viewport h-full min-h-0 w-full"
    data-viewport-key="single"
    @pointercancel="handleScrollerPointerCancel"
    @pointerdown="handleScrollerPointerDown"
    @pointermove="handleScrollerPointerMove"
    @pointerup="handleScrollerPointerUp"
  >
    <header class="montage-view__header">
      <div class="montage-view__header-top">
        <div class="min-w-0">
          <div class="montage-view__title">{{ isZh ? '序列平铺' : 'Series Montage' }}</div>
          <div class="montage-view__subtitle">
            <span>{{ sliceCount }} {{ isZh ? '张切片' : 'slices' }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ windowStatusLabel }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ isZh ? '伪彩' : 'Color' }} {{ pseudocolorStatusLabel }}</span>
          </div>
        </div>
        <div class="montage-view__columns" role="group" :aria-label="isZh ? '平铺列数' : 'Montage columns'">
          <button
            v-for="count in [2, 3, 4, 5, 6]"
            :key="count"
            type="button"
            :class="{ 'montage-view__column-button--active': columnCount === count }"
            class="montage-view__column-button"
            @pointerdown.stop
            @click="setColumnCount(count)"
          >
            {{ count }}
          </button>
        </div>
      </div>
      <div
        v-if="showCornerInfo && commonCornerItems.length"
        ref="commonInfoRegion"
        class="montage-view__common-info"
        @pointerdown.stop
      >
        <div class="montage-view__common-info-heading">
          {{ isZh ? '影像信息' : 'Image info' }}
        </div>
        <div class="montage-view__common-info-content">
          <div
            v-for="item in compactCommonCornerItems"
            :key="item.id"
            class="montage-view__common-info-line"
            :aria-label="`${item.label}: ${item.line}`"
          >
            <span class="montage-view__common-info-key">{{ item.label }}</span>
            <span class="montage-view__common-info-value">{{ item.line }}</span>
          </div>
        </div>
        <button
          v-if="hasExpandableCommonInfo"
          type="button"
          class="montage-view__common-info-toggle"
          :aria-controls="`${activeTab.key}-montage-common-info-panel`"
          :aria-expanded="commonInfoExpanded"
          :aria-label="commonInfoExpanded ? (isZh ? '收起影像信息' : 'Collapse image info') : (isZh ? '展开影像信息' : 'Expand image info')"
          :title="commonInfoExpanded ? (isZh ? '收起影像信息' : 'Collapse image info') : (isZh ? '展开影像信息' : 'Expand image info')"
          @pointerdown.stop
          @click="toggleCommonInfoExpanded"
        >
          <AppIcon :name="commonInfoExpanded ? 'chevron-up' : 'chevron-down'" :size="15" />
        </button>
        <div
          v-if="commonInfoExpanded"
          :id="`${activeTab.key}-montage-common-info-panel`"
          class="montage-view__common-info-panel"
          role="region"
          :aria-label="isZh ? '全部影像信息' : 'All image information'"
        >
          <div class="montage-view__common-info-panel-grid">
            <div
              v-for="item in commonCornerItems"
              :key="`expanded-${item.id}`"
              class="montage-view__common-info-panel-line"
            >
              <span class="montage-view__common-info-key">{{ item.label }}</span>
              <span class="montage-view__common-info-panel-value">{{ item.line }}</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div
      ref="scroller"
      class="montage-view__scroller"
      :class="scrollerCursorClass"
      :data-rendered-row-end="renderedRowRange.end"
      :data-rendered-row-start="renderedRowRange.start"
      :data-total-slices="sliceCount"
      @contextmenu.prevent
      @scroll.passive="handleScrollerScroll"
    >
      <div v-if="activeTab.montageDisplayConfigError" class="montage-view__config-error">
        <AppIcon name="alert" :size="22" />
        <span>{{ activeTab.montageDisplayConfigError }}</span>
        <button type="button" class="montage-view__retry" @click="emit('retryDisplayConfig', activeTab.key)">
          <AppIcon name="reset" :size="16" />
          <span>{{ isZh ? '重试' : 'Retry' }}</span>
        </button>
      </div>
      <div class="montage-view__virtualizer" :style="virtualizerStyle">
        <div class="montage-view__grid" :style="gridStyle">
          <article
            v-for="index in renderedIndexes"
            :key="index"
            :data-slice-index="index"
            class="montage-view__tile"
            :class="{ 'montage-view__tile--selected': selectedSliceIndex === index }"
            tabindex="0"
            @click="handleTileClick(index)"
            @dblclick="handleTileDoubleClick($event, index)"
            @keydown="handleTileKeydown($event, index)"
          >
            <img
              v-if="getDisplayedTileState(index)?.status === 'ready' && getDisplayedTileState(index)?.imageSrc"
              :src="getDisplayedTileState(index)?.imageSrc"
              :alt="`${index + 1} / ${sliceCount}`"
              class="montage-view__image"
              :style="montageImageStyle"
              draggable="false"
            />
            <div v-else-if="getDisplayedTileState(index)?.status === 'error'" class="montage-view__placeholder">
              <span class="montage-view__error">{{ tileErrorText(getDisplayedTileState(index)) }}</span>
              <button
                type="button"
                class="montage-view__retry"
                @pointerdown.stop
                @click.stop="retryTile(index)"
              >
                <AppIcon name="reset" :size="16" />
                <span>{{ isZh ? '重试' : 'Retry' }}</span>
              </button>
            </div>
            <div v-else class="montage-view__placeholder">
              <span class="montage-view__pulse"></span>
            </div>
            <div class="montage-view__badges">
              <button
                type="button"
                class="montage-view__star"
                :class="{ 'montage-view__star--active': starredSliceIndexSet.has(index) }"
                :aria-label="starredSliceIndexSet.has(index)
                  ? (isZh ? '取消关键切片' : 'Remove key slice')
                  : (isZh ? '标记关键切片' : 'Mark key slice')"
                @pointerdown.stop
                @click.stop="toggleSliceStar(index)"
              >
                <AppIcon :name="starredSliceIndexSet.has(index) ? 'star' : 'star-outline'" :size="14" />
              </button>
              <span class="montage-view__index">{{ index + 1 }} / {{ sliceCount }}</span>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.montage-view {
  --montage-image-surface: #020609;
  --montage-image-surface-soft: #050a0e;
  --montage-tile-border: rgba(126, 156, 184, 0.22);
  --montage-overlay-text: #eaf7ff;
  --montage-overlay-muted: rgba(203, 218, 232, 0.72);
  --montage-overlay-secondary: rgba(217, 234, 248, 0.86);

  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  background: var(--montage-image-surface);
}

.montage-view__header {
  position: relative;
  z-index: 10;
  min-height: 54px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--theme-border-soft);
  background: var(--theme-surface-panel);
}

.montage-view__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.montage-view__title {
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.montage-view__subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 5px;
  margin-top: 2px;
  color: var(--theme-text-muted);
  font-size: 11px;
}

.montage-view__columns {
  display: flex;
  flex: none;
  gap: 4px;
}

.montage-view__column-button {
  width: 30px;
  height: 30px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 8px;
  color: var(--theme-text-secondary);
  background: var(--theme-surface-card);
  font-size: 12px;
  font-weight: 700;
}

.montage-view__column-button--active {
  border-color: var(--theme-accent);
  color: var(--theme-text-primary);
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
}

.montage-view__common-info {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px 10px;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  color: var(--theme-text-secondary);
}

.montage-view__common-info-heading {
  align-self: center;
  color: var(--theme-text-muted);
  font-size: 9px;
  font-weight: 700;
  line-height: 16px;
  white-space: nowrap;
}

.montage-view__common-info-content {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-width: 0;
  gap: 4px 16px;
  overflow: hidden;
}

.montage-view__common-info-line {
  display: grid;
  grid-template-rows: auto auto;
  align-content: center;
  gap: 1px;
  min-height: 32px;
  min-width: 0;
}

.montage-view__common-info-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.montage-view__common-info-key {
  color: var(--theme-text-muted);
  font-size: 9px;
  font-weight: 600;
  line-height: 12px;
  white-space: nowrap;
}

.montage-view__common-info-value {
  color: var(--theme-text-secondary);
  font: 500 10px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
}

.montage-view__common-info-toggle {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--theme-border-soft);
  border-radius: 6px;
  color: var(--theme-text-secondary);
  background: var(--theme-surface-card);
}

.montage-view__common-info-toggle:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-soft));
  color: var(--theme-text-primary);
}

.montage-view__common-info-panel {
  position: absolute;
  z-index: 24;
  top: calc(100% + 8px);
  right: -12px;
  left: -12px;
  max-height: min(50vh, 360px);
  overflow: auto;
  border-top: 1px solid var(--theme-border-strong);
  border-bottom: 1px solid var(--theme-border-strong);
  padding: 12px 16px 14px;
  background: var(--theme-surface-panel-solid);
  box-shadow: 0 16px 32px rgb(0 0 0 / 38%);
}

.montage-view__common-info-panel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 18px;
}

.montage-view__common-info-panel-line {
  display: grid;
  align-content: start;
  gap: 3px;
  min-width: 0;
}

.montage-view__common-info-panel-value {
  min-width: 0;
  color: var(--theme-text-primary);
  font: 500 10px/15px ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: anywhere;
  white-space: normal;
}

@media (max-width: 1280px) {
  .montage-view__common-info-panel-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .montage-view__header-top {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .montage-view__common-info-content {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .montage-view__common-info-panel-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.montage-view__scroller {
  position: relative;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: var(--montage-image-surface);
}

.montage-view__config-error {
  position: absolute;
  z-index: 5;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  padding: 24px;
  color: var(--montage-overlay-muted);
  background: var(--montage-image-surface);
  text-align: center;
}

.montage-view__scroller--window {
  cursor: ew-resize;
  touch-action: none;
}

.montage-view__scroller--pan {
  cursor: grab;
  touch-action: none;
}

.montage-view__scroller--pan:active {
  cursor: grabbing;
}

.montage-view__scroller--zoom {
  cursor: ns-resize;
  touch-action: none;
}

.montage-view__grid {
  display: grid;
  gap: 8px;
}

.montage-view__virtualizer {
  box-sizing: border-box;
  min-height: 100%;
  padding-right: 8px;
  padding-left: 8px;
}

.montage-view__tile {
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--montage-tile-border);
  border-radius: 5px;
  background: #000;
  outline: none;
}

.montage-view__tile--selected,
.montage-view__tile:focus-visible {
  border-color: var(--theme-accent);
  box-shadow: inset 0 0 0 1px var(--theme-accent);
}

.montage-view__image,
.montage-view__placeholder {
  width: 100%;
  height: 100%;
}

.montage-view__image {
  display: block;
  object-fit: contain;
  transform-origin: center;
  will-change: transform;
  user-select: none;
}

.montage-view__placeholder {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  background: var(--montage-image-surface-soft);
}

.montage-view__pulse {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 55%, transparent);
  animation: montage-pulse 1.1s ease-in-out infinite;
}

.montage-view__retry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--montage-overlay-secondary);
  font-size: 11px;
}

.montage-view__error {
  max-width: calc(100% - 16px);
  color: var(--montage-overlay-muted);
  font-size: 10px;
  line-height: 1.35;
  text-align: center;
}

.montage-view__badges {
  position: absolute;
  right: 6px;
  bottom: 5px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.montage-view__index,
.montage-view__star {
  border-radius: 5px;
  padding: 2px 5px;
  color: var(--montage-overlay-text);
  background: rgb(1 7 11 / 78%);
  font: 600 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.montage-view__star {
  display: inline-grid;
  width: 20px;
  height: 20px;
  place-items: center;
  padding: 0;
  color: var(--montage-overlay-muted);
  opacity: 0;
  transition: color 120ms ease, opacity 120ms ease;
}

.montage-view__tile:hover .montage-view__star,
.montage-view__tile--selected .montage-view__star,
.montage-view__star--active {
  opacity: 1;
}

.montage-view__star--active {
  color: #ffd166;
}

@keyframes montage-pulse {
  50% {
    opacity: 0.35;
    transform: scale(0.72);
  }
}
</style>
