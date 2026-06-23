<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES, type ViewOperationType } from '@shared/viewerConstants'
import AppIcon from '../../components/AppIcon.vue'
import ViewerCanvasStage from '../../components/viewer/views/ViewerCanvasStage.vue'
import { useViewerWorkspacePointer } from '../../composables/measurements/useViewerWorkspacePointer'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import {
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PANE_KEYS,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY
} from '../../composables/workspace/views/viewerWorkspaceTabs'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  AnnotationSize,
  CornerInfo,
  DraftMeasurementMode,
  FusionPaneKey,
  MeasurementDraft,
  MeasurementDraftPoint,
  MeasurementOverlay,
  MeasurementToolType,
  OrientationInfo,
  ViewerImageLayer,
  ViewerTabItem,
  WorkspaceReadyPayload
} from '../../types/viewer'
import {
  createMobileViewportDragMoveQueue,
  type MobileViewportDragMove
} from './mobileViewportGesture'

type RegistrationMode = 'none' | 'translate' | 'rotate'

type PointerPoint = {
  x: number
  y: number
}

type FloatingTogglePosition = {
  left: number
  top: number
}

type FloatingToggleDragState = {
  pointerId: number
  startX: number
  startY: number
  baseLeft: number
  baseTop: number
  moved: boolean
}

const REFERENCE_TOGGLE_DRAG_THRESHOLD = 4
const REFERENCE_TOGGLE_MARGIN = 6
const REFERENCE_TOGGLE_SIZE = 36

interface FusionPaneView {
  key: FusionPaneKey
  title: string
}

interface CanvasPoint {
  canvasX: number
  canvasY: number
  clientX: number
  clientY: number
}

interface RegistrationDragState {
  pointerId: number
  subOpType: 'translate' | 'rotate'
  startCanvasX: number
  startCanvasY: number
  pivotCanvasX: number
  pivotCanvasY: number
  pivotClientX: number
  pivotClientY: number
  lastAngleRad: number | null
  rotationDeltaDegrees: number
  deltaX: number
  deltaY: number
}

const props = withDefaults(defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
  activeViewportKey: string
  annotationPointerCancel?: (event: PointerEvent) => boolean
  annotationPointerDown?: (event: PointerEvent, viewportKey: string) => boolean
  annotationPointerLeave?: (viewportKey: string) => void
  annotationPointerMove?: (event: PointerEvent) => boolean
  annotationPointerUp?: (event: PointerEvent) => boolean
  getAnnotations?: (viewportKey: string) => AnnotationOverlay[]
  getDraftAnnotation?: (viewportKey: string) => AnnotationDraft | null
  getDraftMeasurement?: (viewportKey: string) => MeasurementDraft | null
  getDraftMeasurementMode?: (viewportKey: string) => DraftMeasurementMode | null
  getMeasurements?: (viewportKey: string) => MeasurementOverlay[]
  isViewLoading: boolean
  registrationMode?: RegistrationMode
  scrollThreshold?: number
}>(), {
  getAnnotations: () => [],
  getDraftAnnotation: () => null,
  getDraftMeasurement: () => null,
  getDraftMeasurementMode: () => null,
  getMeasurements: () => [],
  registrationMode: 'none',
  scrollThreshold: 28
})

const emit = defineEmits<{
  activeViewportChange: [viewportKey: string]
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  fusionRegistrationDrag: [payload: {
    viewportKey: string
    phase: 'start' | 'move' | 'end'
    subOpType: 'translate' | 'rotate'
    deltaX: number
    deltaY: number
    anchorX?: number
    anchorY?: number
    currentX?: number
    currentY?: number
    pivotX?: number
    pivotY?: number
    rotationDeltaDegrees?: number
  }]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  measurementCreate: [payload: { viewportKey: string; toolType: MeasurementToolType; points: MeasurementDraftPoint[]; measurementId?: string; labelLines?: string[] }]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: AnnotationSize }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const viewportHostRef = ref<HTMLElement | null>(null)
const paneElements = new Map<FusionPaneKey, HTMLElement>()
const activePointers = new Map<number, PointerPoint>()
const workspacePointerIds = new Set<number>()
const registrationDrag = ref<RegistrationDragState | null>(null)

let activeDragOperation: ViewOperationType | null = null
let activeDragViewportKey: FusionPaneKey | null = null
let lastPrimaryPoint: PointerPoint | null = null
let scrollAccumulator = 0
let totalDragDeltaX = 0
let totalDragDeltaY = 0

const emptyCornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

const hiddenOrientation: OrientationInfo = {
  top: null,
  right: null,
  bottom: null,
  left: null,
  volumeQuaternion: null
}

const activeTabRef = computed(() => props.activeTab)
const activeOperationRef = computed(() => props.activeOperation)

function createMeasurementId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `mobile-measure-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function emitActiveViewportChange(viewportKey: string): void {
  if (FUSION_PANE_KEYS.includes(viewportKey as FusionPaneKey)) {
    emit('activeViewportChange', viewportKey as FusionPaneKey)
  }
}

function emitMeasurementCreate(payload: {
  viewportKey: string
  toolType: MeasurementToolType
  points: MeasurementDraftPoint[]
  measurementId?: string
  labelLines?: string[]
}): void {
  emit('measurementCreate', {
    ...payload,
    measurementId: payload.measurementId?.trim() || createMeasurementId()
  })
}

const {
  cleanupPointerInteractions,
  draftMeasurements,
  getDraftMeasurementMode: getPointerDraftMeasurementMode,
  handleViewportPointerCancel,
  handleViewportPointerDown,
  handleViewportPointerLeave,
  handleViewportPointerMove,
  handleViewportPointerUp,
  viewportCursorClasses
} = useViewerWorkspacePointer({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitActiveViewportChange,
  emitOperationChange: () => {},
  emitMeasurementDraft: () => {},
  emitMeasurementCreate,
  emitMeasurementDelete: () => {},
  emitMtfCommit: () => {},
  emitMtfDelete: () => {},
  emitMtfSelect: () => {},
  emitMprCrosshair: () => {},
  emitViewportDrag: (payload) => emit('viewportDrag', payload),
  getCommittedMeasurements: (viewportKey) => props.getMeasurements(viewportKey),
  getMtfItems: () => []
})

const panes = computed<FusionPaneView[]>(() => [
  { key: FUSION_CT_AXIAL_PANE_KEY, title: 'CT Axial' },
  { key: FUSION_PET_AXIAL_PANE_KEY, title: 'PET Axial' },
  { key: FUSION_OVERLAY_AXIAL_PANE_KEY, title: 'Fusion Axial' },
  { key: FUSION_PET_CORONAL_MIP_PANE_KEY, title: 'PET Coronal MIP' }
])

const fusionTab = computed(() => (props.activeTab?.viewType === 'PETCTFusion' ? props.activeTab : null))
const manualRegistrationEnabled = computed(() => fusionTab.value?.fusionManualRegistration === true)
const activePaneKey = computed<FusionPaneKey>(() => (
  FUSION_PANE_KEYS.includes(props.activeViewportKey as FusionPaneKey)
    ? props.activeViewportKey as FusionPaneKey
    : FUSION_OVERLAY_AXIAL_PANE_KEY
))
const referenceThumbnailsVisible = ref(true)
const referenceTogglePosition = ref<FloatingTogglePosition | null>(null)
const referenceToggleDrag = ref<FloatingToggleDragState | null>(null)
const suppressReferenceToggleClick = ref(false)
let referenceToggleClickResetTimer: number | null = null

const referenceToggleStyle = computed(() => {
  if (referenceThumbnailsVisible.value || !referenceTogglePosition.value) {
    return undefined
  }
  return {
    left: `${referenceTogglePosition.value.left}px`,
    top: `${referenceTogglePosition.value.top}px`,
    right: 'auto',
    bottom: 'auto'
  }
})

function toggleReferenceThumbnails(): void {
  referenceThumbnailsVisible.value = !referenceThumbnailsVisible.value
  if (referenceThumbnailsVisible.value) {
    referenceTogglePosition.value = null
  }
}

function getHostRect(): DOMRect | null {
  return viewportHostRef.value?.getBoundingClientRect() ?? null
}

function clampReferenceTogglePosition(left: number, top: number): FloatingTogglePosition {
  const rect = getHostRect()
  if (!rect) {
    return { left, top }
  }
  const maxLeft = Math.max(REFERENCE_TOGGLE_MARGIN, rect.width - REFERENCE_TOGGLE_SIZE - REFERENCE_TOGGLE_MARGIN)
  const maxTop = Math.max(REFERENCE_TOGGLE_MARGIN, rect.height - REFERENCE_TOGGLE_SIZE - REFERENCE_TOGGLE_MARGIN)
  return {
    left: Math.min(maxLeft, Math.max(REFERENCE_TOGGLE_MARGIN, left)),
    top: Math.min(maxTop, Math.max(REFERENCE_TOGGLE_MARGIN, top))
  }
}

function getReferenceTogglePositionFromElement(element: HTMLElement): FloatingTogglePosition | null {
  const hostRect = getHostRect()
  if (!hostRect) {
    return null
  }
  const buttonRect = element.getBoundingClientRect()
  return clampReferenceTogglePosition(buttonRect.left - hostRect.left, buttonRect.top - hostRect.top)
}

function scheduleReferenceToggleClickReset(): void {
  if (referenceToggleClickResetTimer !== null) {
    window.clearTimeout(referenceToggleClickResetTimer)
  }
  referenceToggleClickResetTimer = window.setTimeout(() => {
    suppressReferenceToggleClick.value = false
    referenceToggleClickResetTimer = null
  }, 0)
}

function handleReferenceTogglePointerDown(event: PointerEvent): void {
  if (referenceThumbnailsVisible.value || event.button !== 0) {
    return
  }
  const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const position = element ? getReferenceTogglePositionFromElement(element) : null
  if (!position) {
    return
  }
  referenceToggleDrag.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    baseLeft: position.left,
    baseTop: position.top,
    moved: false
  }
  element?.setPointerCapture?.(event.pointerId)
}

function handleReferenceTogglePointerMove(event: PointerEvent): void {
  const drag = referenceToggleDrag.value
  if (!drag || drag.pointerId !== event.pointerId) {
    return
  }
  const deltaX = event.clientX - drag.startX
  const deltaY = event.clientY - drag.startY
  if (!drag.moved && Math.hypot(deltaX, deltaY) < REFERENCE_TOGGLE_DRAG_THRESHOLD) {
    return
  }
  drag.moved = true
  referenceTogglePosition.value = clampReferenceTogglePosition(drag.baseLeft + deltaX, drag.baseTop + deltaY)
  event.preventDefault()
}

function finishReferenceToggleDrag(event: PointerEvent): void {
  const drag = referenceToggleDrag.value
  if (!drag || drag.pointerId !== event.pointerId) {
    return
  }
  const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  element?.releasePointerCapture?.(event.pointerId)
  referenceToggleDrag.value = null
  if (drag.moved) {
    suppressReferenceToggleClick.value = true
    scheduleReferenceToggleClickReset()
    event.preventDefault()
  }
}

function handleReferenceToggleClick(event: MouseEvent): void {
  if (suppressReferenceToggleClick.value) {
    suppressReferenceToggleClick.value = false
    if (referenceToggleClickResetTimer !== null) {
      window.clearTimeout(referenceToggleClickResetTimer)
      referenceToggleClickResetTimer = null
    }
    event.preventDefault()
    event.stopPropagation()
    return
  }
  toggleReferenceThumbnails()
}

const dragMoveQueue = createMobileViewportDragMoveQueue<FusionPaneKey>((move: MobileViewportDragMove<FusionPaneKey>) => {
  emit('viewportDrag', {
    deltaX: move.deltaX,
    deltaY: move.deltaY,
    opType: move.opType,
    phase: 'move',
    viewportKey: move.viewportKey
  })
})

function normalizeOperation(operation: string): string {
  return operation.startsWith(STACK_OPERATION_PREFIX) ? operation.slice(STACK_OPERATION_PREFIX.length) : operation
}

function resolveDragOperation(): ViewOperationType | null {
  const operation = normalizeOperation(props.activeOperation)
  if (operation === VIEW_OPERATION_TYPES.pan || operation === VIEW_OPERATION_TYPES.window || operation === VIEW_OPERATION_TYPES.zoom) {
    return operation
  }
  return null
}

function isScrollOperation(): boolean {
  return normalizeOperation(props.activeOperation) === VIEW_OPERATION_TYPES.scroll
}

function isMeasureOperation(): boolean {
  return normalizeOperation(props.activeOperation).startsWith('measure:')
}

function getDraftMeasurement(viewportKey: string): MeasurementDraft | null {
  return draftMeasurements.value[viewportKey] ?? props.getDraftMeasurement(viewportKey)
}

function getDraftMeasurementMode(viewportKey: string): DraftMeasurementMode | null {
  return getPointerDraftMeasurementMode(viewportKey) ?? props.getDraftMeasurementMode(viewportKey)
}

function getPoint(event: PointerEvent): PointerPoint {
  return {
    x: event.clientX,
    y: event.clientY
  }
}

function getPaneElement(paneKey: FusionPaneKey): HTMLElement | null {
  return paneElements.get(paneKey) ?? null
}

function setPaneRef(paneKey: FusionPaneKey, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) {
    paneElements.set(paneKey, element)
    return
  }
  paneElements.delete(paneKey)
}

function getPaneImageElement(paneKey: FusionPaneKey): HTMLImageElement | null {
  return getPaneElement(paneKey)?.querySelector<HTMLImageElement>('.viewer-image') ?? null
}

function getPaneImageRect(paneKey: FusionPaneKey): DOMRect | null {
  const image = getPaneImageElement(paneKey)
  if (image) {
    const rect = image.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      return rect
    }
  }
  const paneRect = getPaneElement(paneKey)?.getBoundingClientRect()
  return paneRect && paneRect.width > 0 && paneRect.height > 0 ? paneRect : null
}

function getPaneNaturalSize(paneKey: FusionPaneKey): { width: number; height: number } {
  const image = getPaneImageElement(paneKey)
  const layer = paneKey === FUSION_OVERLAY_AXIAL_PANE_KEY
    ? fusionTab.value?.fusionLayerImages?.[FUSION_OVERLAY_AXIAL_PANE_KEY]
    : null
  const rect = getPaneImageRect(paneKey)
  return {
    width: image?.naturalWidth || layer?.width || rect?.width || 1,
    height: image?.naturalHeight || layer?.height || rect?.height || 1
  }
}

function eventToCanvasPoint(event: PointerEvent, paneKey: FusionPaneKey): CanvasPoint | null {
  const rect = getPaneImageRect(paneKey)
  if (!rect) {
    return null
  }
  const naturalSize = getPaneNaturalSize(paneKey)
  return {
    canvasX: (event.clientX - rect.left) / rect.width * naturalSize.width,
    canvasY: (event.clientY - rect.top) / rect.height * naturalSize.height,
    clientX: event.clientX,
    clientY: event.clientY
  }
}

function getCanvasPivot(paneKey: FusionPaneKey): CanvasPoint | null {
  const rect = getPaneImageRect(paneKey)
  if (!rect) {
    return null
  }
  const naturalSize = getPaneNaturalSize(paneKey)
  return {
    canvasX: naturalSize.width / 2,
    canvasY: naturalSize.height / 2,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  }
}

function getFusionPaneImageSrc(paneKey: FusionPaneKey): string {
  return fusionTab.value?.fusionImages?.[paneKey] ?? ''
}

function getFusionImageLayers(paneKey: FusionPaneKey): ViewerImageLayer[] {
  if (paneKey !== FUSION_OVERLAY_AXIAL_PANE_KEY) {
    return []
  }
  const petLayerSrc = fusionTab.value?.fusionLayerImages?.[paneKey]?.pet ?? ''
  if (!petLayerSrc) {
    return []
  }
  return [
    {
      key: 'pet-layer',
      src: petLayerSrc,
      alt: 'PET overlay',
      class: 'mobile-petct-fusion-viewport__pet-layer'
    }
  ]
}

function hasFusionPaneContent(paneKey: FusionPaneKey): boolean {
  return Boolean(getFusionPaneImageSrc(paneKey)) || getFusionImageLayers(paneKey).some((layer) => Boolean(layer.src))
}

function isPetStandalonePane(paneKey: FusionPaneKey): boolean {
  return paneKey === FUSION_PET_AXIAL_PANE_KEY || paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY
}

function isPrimaryPane(paneKey: FusionPaneKey): boolean {
  return activePaneKey.value === paneKey
}

function shouldUseLightSurface(paneKey: FusionPaneKey): boolean {
  return isPetStandalonePane(paneKey) && isPrimaryPane(paneKey)
}

function getPaneCursorClass(paneKey: FusionPaneKey): string {
  if (manualRegistrationEnabled.value && paneKey === FUSION_OVERLAY_AXIAL_PANE_KEY) {
    return 'cursor-move'
  }
  return viewportCursorClasses.value[paneKey] ?? ''
}

function shouldShowActiveStyle(paneKey: FusionPaneKey): boolean {
  return !isPrimaryPane(paneKey) && activePaneKey.value === paneKey
}

function getReferenceIndex(paneKey: FusionPaneKey): number {
  return panes.value.filter((pane) => pane.key !== activePaneKey.value).findIndex((pane) => pane.key === paneKey)
}

function getPaneSliceLabel(paneKey: FusionPaneKey): string {
  return fusionTab.value?.fusionSliceLabels?.[paneKey] ?? ''
}

function getReferenceSliceLabel(paneKey: FusionPaneKey): string {
  const label = getPaneSliceLabel(paneKey).trim()
  return label || '--'
}

function getPaneLoadingLabel(pane: FusionPaneView): string {
  if (!isPrimaryPane(pane.key)) {
    return isZh.value ? '加载中...' : 'Loading...'
  }
  return isZh.value ? `正在加载 ${pane.title}...` : `Loading ${pane.title}...`
}

function getReferenceSwitchLabel(pane: FusionPaneView): string {
  return isZh.value ? `切换到 ${pane.title}` : `Switch to ${pane.title}`
}

function isCompactReferenceTitle(title: string): boolean {
  return title.length > 10
}

function getCornerInfo(paneKey: FusionPaneKey): CornerInfo {
  return fusionTab.value?.fusionCornerInfos?.[paneKey] ?? fusionTab.value?.cornerInfo ?? emptyCornerInfo
}

function getOrientation(paneKey: FusionPaneKey): OrientationInfo {
  return hasFusionPaneContent(paneKey)
    ? fusionTab.value?.fusionOrientations?.[paneKey] ?? fusionTab.value?.orientation ?? hiddenOrientation
    : hiddenOrientation
}

function isPaneLoading(paneKey: FusionPaneKey): boolean {
  return Boolean(fusionTab.value?.fusionViewIds?.[paneKey]) && (!hasFusionPaneContent(paneKey) || props.isViewLoading)
}

function emitWorkspaceReady(): void {
  const element = viewportHostRef.value
  emit('workspaceReady', {
    element,
    viewportKey: props.activeViewportKey,
    viewportElements: FUSION_PANE_KEYS.reduce<Record<string, HTMLElement | null>>((record, paneKey) => {
      record[paneKey] = getPaneElement(paneKey)
      return record
    }, {})
  })
}

function emitViewportDragMove(deltaX: number, deltaY: number, opType: ViewOperationType, viewportKey: FusionPaneKey): void {
  dragMoveQueue.push({ deltaX, deltaY, opType, viewportKey })
}

function flushPendingDragMoves(): void {
  dragMoveQueue.flush()
}

function cancelPendingDragMoves(): void {
  dragMoveQueue.cancel()
}

function beginDrag(operation: ViewOperationType | null, point: PointerPoint, viewportKey: FusionPaneKey): void {
  activeDragOperation = operation
  activeDragViewportKey = viewportKey
  lastPrimaryPoint = point
  scrollAccumulator = 0
  totalDragDeltaX = 0
  totalDragDeltaY = 0
  if (operation) {
    emit('viewportDrag', {
      deltaX: 0,
      deltaY: 0,
      opType: operation,
      phase: 'start',
      viewportKey
    })
  }
}

function endDrag(): void {
  flushPendingDragMoves()
  if (activeDragOperation && activeDragViewportKey) {
    emit('viewportDrag', {
      deltaX: 0,
      deltaY: 0,
      opType: activeDragOperation,
      phase: 'end',
      viewportKey: activeDragViewportKey
    })
  }
  activeDragOperation = null
  activeDragViewportKey = null
  lastPrimaryPoint = null
  scrollAccumulator = 0
  totalDragDeltaX = 0
  totalDragDeltaY = 0
}

function normalizeAngleDelta(delta: number): number {
  let next = delta
  while (next > Math.PI) {
    next -= Math.PI * 2
  }
  while (next < -Math.PI) {
    next += Math.PI * 2
  }
  return next
}

function getAngleFromPivot(event: PointerEvent, state: RegistrationDragState): number | null {
  const dx = event.clientX - state.pivotClientX
  const dy = event.clientY - state.pivotClientY
  if (Math.hypot(dx, dy) < 18) {
    return null
  }
  return Math.atan2(dy, dx)
}

function emitRegistrationDrag(phase: 'start' | 'move' | 'end', state: RegistrationDragState, current?: CanvasPoint): void {
  emit('fusionRegistrationDrag', {
    viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
    phase,
    subOpType: state.subOpType,
    deltaX: state.deltaX,
    deltaY: state.deltaY,
    anchorX: state.startCanvasX,
    anchorY: state.startCanvasY,
    currentX: current?.canvasX ?? state.startCanvasX + state.deltaX,
    currentY: current?.canvasY ?? state.startCanvasY + state.deltaY,
    pivotX: state.pivotCanvasX,
    pivotY: state.pivotCanvasY,
    rotationDeltaDegrees: state.rotationDeltaDegrees
  })
}

function beginRegistrationDrag(event: PointerEvent): boolean {
  if (!manualRegistrationEnabled.value || props.registrationMode === 'none') {
    return false
  }
  const current = eventToCanvasPoint(event, FUSION_OVERLAY_AXIAL_PANE_KEY)
  const pivot = getCanvasPivot(FUSION_OVERLAY_AXIAL_PANE_KEY)
  if (!current || !pivot) {
    return false
  }
  const state: RegistrationDragState = {
    pointerId: event.pointerId,
    subOpType: props.registrationMode === 'rotate' ? 'rotate' : 'translate',
    startCanvasX: current.canvasX,
    startCanvasY: current.canvasY,
    pivotCanvasX: pivot.canvasX,
    pivotCanvasY: pivot.canvasY,
    pivotClientX: pivot.clientX,
    pivotClientY: pivot.clientY,
    lastAngleRad: null,
    rotationDeltaDegrees: 0,
    deltaX: 0,
    deltaY: 0
  }
  if (state.subOpType === 'rotate') {
    state.lastAngleRad = getAngleFromPivot(event, state)
  }
  registrationDrag.value = state
  emitRegistrationDrag('start', state, current)
  return true
}

function updateRegistrationDrag(event: PointerEvent): boolean {
  const state = registrationDrag.value
  if (!state || state.pointerId !== event.pointerId) {
    return false
  }
  const current = eventToCanvasPoint(event, FUSION_OVERLAY_AXIAL_PANE_KEY)
  if (!current) {
    return true
  }
  if (state.subOpType === 'rotate') {
    const angle = getAngleFromPivot(event, state)
    if (angle != null) {
      if (state.lastAngleRad != null) {
        state.rotationDeltaDegrees += normalizeAngleDelta(angle - state.lastAngleRad) * 180 / Math.PI
      }
      state.lastAngleRad = angle
    }
  } else {
    state.deltaX = current.canvasX - state.startCanvasX
    state.deltaY = current.canvasY - state.startCanvasY
  }
  emitRegistrationDrag('move', state, current)
  return true
}

function endRegistrationDrag(event: PointerEvent): boolean {
  const state = registrationDrag.value
  if (!state || state.pointerId !== event.pointerId) {
    return false
  }
  const current = eventToCanvasPoint(event, FUSION_OVERLAY_AXIAL_PANE_KEY) ?? undefined
  emitRegistrationDrag('end', state, current)
  registrationDrag.value = null
  return true
}

function handleScrollDrag(deltaY: number, viewportKey: FusionPaneKey): void {
  scrollAccumulator += deltaY
  const sliceDelta = Math.trunc(scrollAccumulator / props.scrollThreshold)
  if (!sliceDelta) {
    return
  }
  scrollAccumulator -= sliceDelta * props.scrollThreshold
  emit('viewportWheel', {
    viewportKey,
    deltaY: sliceDelta,
    exact: true
  })
}

function handlePointerDown(event: PointerEvent, viewportKey: string): void {
  if (!FUSION_PANE_KEYS.includes(viewportKey as FusionPaneKey)) {
    return
  }
  const paneKey = viewportKey as FusionPaneKey
  event.preventDefault()
  emitActiveViewportChange(paneKey)
  if (props.annotationPointerDown?.(event, paneKey)) {
    return
  }
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  if (isMeasureOperation() && event.isPrimary && event.button === 0) {
    workspacePointerIds.add(event.pointerId)
    handleViewportPointerDown(event, paneKey)
    return
  }
  activePointers.set(event.pointerId, getPoint(event))
  if (paneKey === FUSION_OVERLAY_AXIAL_PANE_KEY && beginRegistrationDrag(event)) {
    return
  }
  beginDrag(resolveDragOperation(), getPoint(event), paneKey)
}

function handlePointerMove(event: PointerEvent): void {
  if (props.annotationPointerMove?.(event)) {
    return
  }
  if (workspacePointerIds.has(event.pointerId)) {
    handleViewportPointerMove(event)
    return
  }
  const previousPoint = activePointers.get(event.pointerId)
  if (previousPoint) {
    activePointers.set(event.pointerId, getPoint(event))
  }
  if (updateRegistrationDrag(event)) {
    event.preventDefault()
    return
  }
  if (!previousPoint || !activeDragViewportKey) {
    return
  }
  event.preventDefault()
  const nextPoint = getPoint(event)
  const lastPoint = lastPrimaryPoint ?? previousPoint
  const deltaX = nextPoint.x - lastPoint.x
  const deltaY = nextPoint.y - lastPoint.y
  lastPrimaryPoint = nextPoint
  if (isScrollOperation()) {
    handleScrollDrag(deltaY, activeDragViewportKey)
    return
  }
  if (activeDragOperation && (deltaX || deltaY)) {
    totalDragDeltaX += deltaX
    totalDragDeltaY += deltaY
    emitViewportDragMove(totalDragDeltaX, totalDragDeltaY, activeDragOperation, activeDragViewportKey)
  }
}

function handlePointerUp(event: PointerEvent): void {
  event.preventDefault()
  if (props.annotationPointerUp?.(event)) {
    return
  }
  if (workspacePointerIds.delete(event.pointerId)) {
    handleViewportPointerUp(event)
    return
  }
  activePointers.delete(event.pointerId)
  if (endRegistrationDrag(event)) {
    return
  }
  endDrag()
}

function handlePointerCancel(event: PointerEvent): void {
  event.preventDefault()
  if (props.annotationPointerCancel?.(event)) {
    return
  }
  if (workspacePointerIds.delete(event.pointerId)) {
    handleViewportPointerCancel(event)
    return
  }
  activePointers.delete(event.pointerId)
  if (endRegistrationDrag(event)) {
    return
  }
  endDrag()
}

function handlePointerLeave(viewportKey: string): void {
  props.annotationPointerLeave?.(viewportKey)
  handleViewportPointerLeave(viewportKey)
}

function handleReferenceSwitch(event: Event, paneKey: FusionPaneKey): void {
  event.preventDefault()
  event.stopPropagation()
  emit('activeViewportChange', paneKey)
}

onMounted(() => {
  void nextTick(emitWorkspaceReady)
})

onBeforeUnmount(() => {
  activePointers.clear()
  workspacePointerIds.clear()
  paneElements.clear()
  registrationDrag.value = null
  if (referenceToggleClickResetTimer !== null) {
    window.clearTimeout(referenceToggleClickResetTimer)
  }
  cancelPendingDragMoves()
  endDrag()
  cleanupPointerInteractions()
})

watch(
  () => [fusionTab.value?.key, props.activeViewportKey] as const,
  () => {
    void nextTick(emitWorkspaceReady)
  }
)
</script>

<template>
  <section
    ref="viewportHostRef"
    class="mobile-petct-fusion-viewport"
    :class="{ 'mobile-petct-fusion-viewport--references-collapsed': !referenceThumbnailsVisible }"
    data-testid="mobile-petct-fusion-viewport"
  >
    <div
      v-for="pane in panes"
      :key="pane.key"
      :ref="(element) => setPaneRef(pane.key, element)"
      class="mobile-petct-fusion-viewport__pane"
      :class="{
        'mobile-petct-fusion-viewport__pane--primary': isPrimaryPane(pane.key),
        'mobile-petct-fusion-viewport__pane--reference': !isPrimaryPane(pane.key),
        [`mobile-petct-fusion-viewport__pane--reference-${getReferenceIndex(pane.key)}`]: !isPrimaryPane(pane.key),
        'mobile-petct-fusion-viewport__pane--active': shouldShowActiveStyle(pane.key),
        'mobile-petct-fusion-viewport__pane--pet': isPetStandalonePane(pane.key),
        'mobile-petct-fusion-viewport__pane--hidden': !isPrimaryPane(pane.key) && !referenceThumbnailsVisible,
        'mobile-petct-fusion-viewport__pane--registration': manualRegistrationEnabled && pane.key === FUSION_OVERLAY_AXIAL_PANE_KEY
      }"
      :data-fusion-pane-key="pane.key"
      :data-testid="isPrimaryPane(pane.key) ? 'mobile-petct-fusion-primary' : 'mobile-petct-fusion-reference'"
      :data-viewport-role="isPrimaryPane(pane.key) ? 'primary' : 'reference'"
    >
      <ViewerCanvasStage
        class="mobile-petct-fusion-viewport__stage"
        :viewport-key="pane.key"
        viewport-class="mobile-petct-fusion-viewport__canvas"
        image-class="mobile-petct-fusion-viewport__image"
        :active-operation="activeOperation"
        :alt="pane.title"
        :annotations="getAnnotations(pane.key)"
        :corner-info="isPrimaryPane(pane.key) ? getCornerInfo(pane.key) : emptyCornerInfo"
        :cursor-class="getPaneCursorClass(pane.key)"
        :draft-annotation="getDraftAnnotation(pane.key)"
        :draft-measurement="getDraftMeasurement(pane.key)"
        :draft-measurement-mode="getDraftMeasurementMode(pane.key)"
        :image-layers="getFusionImageLayers(pane.key)"
        :image-src="getFusionPaneImageSrc(pane.key)"
        :is-active="shouldShowActiveStyle(pane.key)"
        compact-loading
        :is-loading="isPaneLoading(pane.key)"
        :light-surface="shouldUseLightSurface(pane.key)"
        :loading-label="getPaneLoadingLabel(pane)"
        :measurements="getMeasurements(pane.key)"
        :orientation="getOrientation(pane.key)"
        :placeholder="pane.title"
        :render-surface-active="true"
        :scale-bar="isPrimaryPane(pane.key) ? fusionTab?.fusionScaleBars?.[pane.key] ?? null : null"
        :show-corner-info="isPrimaryPane(pane.key) && fusionTab?.showCornerInfo !== false && hasFusionPaneContent(pane.key)"
        :show-scale-bar="isPrimaryPane(pane.key) && fusionTab?.showScaleBar !== false && hasFusionPaneContent(pane.key)"
        :stage-surface-class="shouldUseLightSurface(pane.key) ? 'viewer-stage-surface--white' : ''"
        :viewport-transform="fusionTab?.fusionTransformStates?.[pane.key] ?? fusionTab?.transformState ?? null"
        @click-viewport="emit('activeViewportChange', $event)"
        @copy-annotation="emit('copyAnnotation', $event)"
        @delete-annotation="emit('deleteAnnotation', $event)"
        @hover-viewport-change="emit('hoverViewportChange', $event)"
        @measurement-create="emit('measurementCreate', $event)"
        @pointer-down="handlePointerDown"
        @pointer-move="handlePointerMove"
        @pointer-up="handlePointerUp"
        @pointer-cancel="handlePointerCancel"
        @pointer-leave="handlePointerLeave"
        @update-annotation-color="emit('updateAnnotationColor', $event)"
        @update-annotation-size="emit('updateAnnotationSize', $event)"
        @update-annotation-text="emit('updateAnnotationText', $event)"
        @wheel-viewport="emit('viewportWheel', $event)"
        @contextmenu.prevent
      />
      <button
        v-if="!isPrimaryPane(pane.key) && referenceThumbnailsVisible"
        type="button"
        class="mobile-petct-fusion-viewport__reference-switch"
        :aria-label="getReferenceSwitchLabel(pane)"
        :data-viewport-key="pane.key"
        data-testid="mobile-petct-fusion-reference-switch"
        @click="handleReferenceSwitch($event, pane.key)"
        @mousedown="handleReferenceSwitch($event, pane.key)"
        @pointerdown="handleReferenceSwitch($event, pane.key)"
        @touchstart="handleReferenceSwitch($event, pane.key)"
      >
        <span class="mobile-petct-fusion-viewport__reference-slice" aria-hidden="true">
          {{ getReferenceSliceLabel(pane.key) }}
        </span>
        <span class="mobile-petct-fusion-viewport__reference-label" aria-hidden="true">
          <strong
            class="mobile-petct-fusion-viewport__reference-title"
            :class="{ 'mobile-petct-fusion-viewport__reference-title--compact': isCompactReferenceTitle(pane.title) }"
          >
            {{ pane.title }}
          </strong>
        </span>
      </button>
    </div>
    <button
      type="button"
      class="mobile-petct-fusion-viewport__reference-toggle"
      :class="{
        'mobile-petct-fusion-viewport__reference-toggle--collapsed': !referenceThumbnailsVisible,
        'mobile-petct-fusion-viewport__reference-toggle--dragging': referenceToggleDrag?.moved
      }"
      :style="referenceToggleStyle"
      :aria-label="referenceThumbnailsVisible ? 'Hide reference images' : 'Show reference images'"
      :aria-pressed="referenceThumbnailsVisible"
      data-testid="mobile-petct-reference-toggle"
      @click="handleReferenceToggleClick"
      @pointerdown="handleReferenceTogglePointerDown"
      @pointermove="handleReferenceTogglePointerMove"
      @pointerup="finishReferenceToggleDrag"
      @pointercancel="finishReferenceToggleDrag"
    >
      <AppIcon :name="referenceThumbnailsVisible ? 'chevron-right' : 'layout'" :size="16" />
    </button>
  </section>
</template>

<style scoped>
.mobile-petct-fusion-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #03060b;
  touch-action: none;
  box-sizing: border-box;
  contain: layout paint;
  isolation: isolate;
  --mobile-fusion-reference-width: clamp(96px, 28%, 132px);
  --mobile-fusion-reference-height: clamp(74px, 17%, 104px);
  --mobile-fusion-reference-gap: 8px;
  --mobile-fusion-reference-offset: 10px;
}

.mobile-petct-fusion-viewport::after {
  position: absolute;
  top: calc(var(--mobile-fusion-reference-offset) - 5px);
  right: calc(var(--mobile-fusion-reference-offset) - 5px);
  z-index: 2;
  width: calc(var(--mobile-fusion-reference-width) + 10px);
  max-width: calc(100% - var(--mobile-fusion-reference-offset));
  height: calc(var(--mobile-fusion-reference-height) + var(--mobile-fusion-reference-height) + var(--mobile-fusion-reference-height) + var(--mobile-fusion-reference-gap) + var(--mobile-fusion-reference-gap) + 10px);
  max-height: calc(100% - var(--mobile-fusion-reference-offset));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background:
    linear-gradient(90deg, rgba(3, 6, 11, 0), rgba(3, 6, 11, 0.78) 18%, rgba(3, 6, 11, 0.9)),
    rgba(8, 13, 22, 0.72);
  box-shadow:
    -18px 0 34px rgba(0, 0, 0, 0.28),
    0 16px 34px rgba(0, 0, 0, 0.42);
  content: "";
  pointer-events: none;
  transition:
    opacity 140ms ease,
    visibility 140ms ease;
}

.mobile-petct-fusion-viewport--references-collapsed::after {
  opacity: 0;
  visibility: hidden;
}

.mobile-petct-fusion-viewport__pane {
  position: absolute;
  overflow: hidden;
  background: #000;
  color: inherit;
  font: inherit;
  text-align: initial;
  box-sizing: border-box;
}

.mobile-petct-fusion-viewport__pane--pet {
  background: #000;
}

.mobile-petct-fusion-viewport__pane--primary {
  inset: 0;
  z-index: 1;
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}

.mobile-petct-fusion-viewport__pane--reference {
  right: var(--mobile-fusion-reference-offset);
  z-index: 4;
  width: var(--mobile-fusion-reference-width);
  height: var(--mobile-fusion-reference-height);
  max-width: calc(100% - var(--mobile-fusion-reference-offset) - var(--mobile-fusion-reference-offset));
  max-height: calc(100% - var(--mobile-fusion-reference-offset) - var(--mobile-fusion-reference-offset));
  border: 1px solid rgba(126, 142, 154, 0.34);
  border-radius: 8px;
  box-shadow:
    0 0 0 1px rgba(2, 6, 12, 0.86),
    0 12px 28px rgba(0, 0, 0, 0.58);
  opacity: 1;
  pointer-events: auto;
  transform: translateZ(0);
  transition:
    opacity 140ms ease,
    transform 140ms ease,
    visibility 140ms ease;
  visibility: visible;
}

.mobile-petct-fusion-viewport__pane--hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateX(18px);
  visibility: hidden;
}

.mobile-petct-fusion-viewport__pane--reference::after {
  position: absolute;
  inset: 0;
  z-index: 5;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.14), transparent 36%, rgba(0, 0, 0, 0.78)),
    linear-gradient(90deg, rgba(0, 0, 0, 0.32), transparent 24%, rgba(0, 0, 0, 0.18));
  content: "";
  pointer-events: none;
}

.mobile-petct-fusion-viewport__pane--reference-0 {
  top: var(--mobile-fusion-reference-offset);
}

.mobile-petct-fusion-viewport__pane--reference-1 {
  top: calc(var(--mobile-fusion-reference-offset) + var(--mobile-fusion-reference-height) + var(--mobile-fusion-reference-gap));
}

.mobile-petct-fusion-viewport__pane--reference-2 {
  top: calc(var(--mobile-fusion-reference-offset) + var(--mobile-fusion-reference-height) + var(--mobile-fusion-reference-gap) + var(--mobile-fusion-reference-height) + var(--mobile-fusion-reference-gap));
}

.mobile-petct-fusion-viewport__pane--active {
  border-color: color-mix(in srgb, var(--theme-accent) 82%, #ffffff);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 68%, transparent);
}

.mobile-petct-fusion-viewport__pane--registration {
  border-color: color-mix(in srgb, var(--theme-accent-warm) 72%, #ffffff);
}

.mobile-petct-fusion-viewport :deep(.mobile-petct-fusion-viewport__canvas) {
  border: 0 !important;
  border-radius: 0 !important;
}

.mobile-petct-fusion-viewport :deep(.viewer-viewport--active) {
  border-color: transparent !important;
  box-shadow: none !important;
  outline: 0 !important;
}

.mobile-petct-fusion-viewport :deep(.viewer-orientation-label) {
  color: #ff8f96;
  font-size: clamp(10px, 2vw, 13px);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.72);
}

.mobile-petct-fusion-viewport__pane--reference :deep(.viewer-orientation-label) {
  font-size: 11px;
  text-shadow:
    0 1px 1px rgba(255, 255, 255, 0.52),
    0 0 5px rgba(0, 0, 0, 0.64);
}

.mobile-petct-fusion-viewport__pane--pet :deep(.viewer-corner-block) {
  color: #182334;
  text-shadow:
    0 1px 1px rgba(255, 255, 255, 0.86),
    0 0 3px rgba(15, 23, 42, 0.22);
}

.mobile-petct-fusion-viewport__pane--pet :deep(.viewer-orientation-label) {
  color: #b91c1c;
  text-shadow:
    0 1px 1px rgba(255, 255, 255, 0.82),
    0 0 3px rgba(15, 23, 42, 0.28);
}

.mobile-petct-fusion-viewport__pane--reference.mobile-petct-fusion-viewport__pane--pet :deep(.viewer-orientation-label) {
  color: #ff8f96;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.95),
    0 0 5px rgba(0, 0, 0, 0.68);
}

.mobile-petct-fusion-viewport :deep(.mobile-petct-fusion-viewport__image) {
  user-select: none;
  -webkit-user-drag: none;
}

.mobile-petct-fusion-viewport__reference-switch {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  appearance: none;
  cursor: pointer;
}

.mobile-petct-fusion-viewport__reference-toggle {
  position: absolute;
  top: calc(var(--mobile-fusion-reference-offset) + var(--mobile-fusion-reference-height) + var(--mobile-fusion-reference-gap) + var(--mobile-fusion-reference-height) + var(--mobile-fusion-reference-gap) + var(--mobile-fusion-reference-height) + 8px);
  right: var(--mobile-fusion-reference-offset);
  bottom: auto;
  z-index: 9;
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(18, 27, 40, 0.96), rgba(8, 13, 22, 0.96));
  color: #f7fbff;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.46);
  appearance: none;
  cursor: pointer;
  touch-action: none;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    box-shadow 140ms ease,
    transform 140ms ease;
}

.mobile-petct-fusion-viewport__reference-toggle--collapsed {
  border-color: color-mix(in srgb, var(--theme-accent) 76%, rgba(255, 255, 255, 0.2));
  background:
    radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.18), transparent 34%),
    color-mix(in srgb, var(--theme-accent) 24%, rgba(8, 13, 22, 0.96));
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 16px 34px rgba(0, 0, 0, 0.56);
  cursor: grab;
}

.mobile-petct-fusion-viewport__reference-toggle--dragging {
  cursor: grabbing;
  transform: scale(1.04);
}

.mobile-petct-fusion-viewport__reference-label {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 6px;
  display: block;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  color: #f7fbff;
  font-size: 10px;
  line-height: 1;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.96);
}

.mobile-petct-fusion-viewport__reference-title {
  display: block;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.05;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.mobile-petct-fusion-viewport__reference-title--compact {
  font-size: 9px;
}

.mobile-petct-fusion-viewport__reference-slice {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 7;
  max-width: calc(100% - 12px);
  overflow: hidden;
  color: rgba(247, 251, 255, 0.84);
  font-size: 9px;
  font-weight: 850;
  line-height: 1;
  pointer-events: none;
  text-overflow: ellipsis;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.96);
  white-space: nowrap;
}

@media (orientation: landscape) and (max-height: 520px) {
  .mobile-petct-fusion-viewport {
    --mobile-fusion-reference-width: clamp(88px, 22%, 124px);
    --mobile-fusion-reference-height: clamp(58px, 27%, 88px);
    --mobile-fusion-reference-offset: 8px;
  }
}

@media (max-width: 430px) {
  .mobile-petct-fusion-viewport {
    --mobile-fusion-reference-width: clamp(86px, 31%, 112px);
    --mobile-fusion-reference-height: clamp(64px, 16%, 92px);
    --mobile-fusion-reference-gap: 6px;
    --mobile-fusion-reference-offset: 6px;
  }

  .mobile-petct-fusion-viewport__reference-label {
    left: 5px;
    right: 5px;
    bottom: 5px;
    font-size: 9px;
  }

  .mobile-petct-fusion-viewport__reference-title {
    font-size: 10px;
  }

  .mobile-petct-fusion-viewport__reference-title--compact {
    font-size: 8px;
  }

  .mobile-petct-fusion-viewport__reference-slice {
    top: 5px;
    left: 5px;
    max-width: calc(100% - 10px);
    font-size: 8px;
  }
}
</style>
