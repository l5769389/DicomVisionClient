<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  DraftMeasurementMode,
  FusionPaneKey,
  FusionProjectionInfo,
  MeasurementDraft,
  MeasurementOverlay,
  OrientationInfo,
  Vec3,
  ViewerImageLayer,
  ViewerTabItem
} from '../../../types/viewer'
import {
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PANE_KEYS,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY
} from '../../../composables/workspace/views/viewerWorkspaceTabs'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeOperation: string
  activeViewportKey: string
  getAnnotations: (viewportKey: string) => AnnotationOverlay[]
  getCursorClass: (viewportKey: string) => string
  getDraftAnnotation: (viewportKey: string) => AnnotationDraft | null
  getDraftMeasurementMode: (viewportKey: string) => DraftMeasurementMode | null
  getDraftMeasurement: (viewportKey: string) => MeasurementDraft | null
  getMeasurements: (viewportKey: string) => MeasurementOverlay[]
}>()

const emit = defineEmits<{
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  fusionConfigChange: [payload: { manualRegistration?: boolean; pseudocolorPreset?: string; petUnit?: string; action?: 'reset' | 'save' }]
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
  imageLoaded: [viewportKey: string]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
}>()

interface FusionPaneView {
  key: FusionPaneKey
  title: string
  imageSrc: string
  sliceLabel: string
  windowLabel: string
}

interface ManualRegistrationDragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startCanvasX: number
  startCanvasY: number
  pivotCanvasX: number
  pivotCanvasY: number
  pivotClientX: number
  pivotClientY: number
  basePose: ManualRegistrationPreviewPose
  imageCenterCanvasX: number
  imageCenterCanvasY: number
  startRotationAngleRad: number | null
  lastRotationAngleRad: number | null
  unwrappedRotationDeltaRad: number
  rotationDeltaDegrees: number
  rotationActive: boolean
  subOpType: 'translate' | 'rotate'
  lastMoveSnapshot: ManualRegistrationDragSnapshot | null
}

interface FusionCalibrationDragState {
  pointerId: number
}

interface ManualRegistrationDragSnapshot {
  deltaX: number
  deltaY: number
  currentCanvasX: number
  currentCanvasY: number
  rotationDeltaDegrees: number
}

interface ManualRegistrationPreviewPose {
  translateCanvasX: number
  translateCanvasY: number
  rotationDegrees: number
  pivotCanvasX: number
  pivotCanvasY: number
  imageCenterCanvasX: number
  imageCenterCanvasY: number
}

interface ManualRegistrationLockedImages {
  images: Partial<Record<FusionPaneKey, string>>
  layerImages: Partial<Record<FusionPaneKey, string>>
}

type FusionMarkerPosition = { x: number; y: number }
type FusionMarkerPositionMap = Partial<Record<FusionPaneKey, FusionMarkerPosition>>

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const manualDragState = ref<ManualRegistrationDragState | null>(null)
const calibrationDragState = ref<FusionCalibrationDragState | null>(null)
const calibrationMarkerPosition = ref({ x: 0.5, y: 0.5 })
const calibrationMarkerWorld = ref<Vec3 | null>(null)
const manualRegistrationMarkerPositions = ref<FusionMarkerPositionMap | null>(null)
const manualRegistrationVisualPose = ref<ManualRegistrationPreviewPose | null>(null)
const manualRegistrationLockedImages = ref<ManualRegistrationLockedImages | null>(null)
const expandedFusionPaneKey = ref<FusionPaneKey | null>(null)
const markerLayoutRevision = ref(0)
const paneElements = new Map<FusionPaneKey, HTMLElement>()
let paneResizeObserver: ResizeObserver | null = null
let markerLayoutRaf: number | null = null
let manualRegistrationMoveRaf: number | null = null
let pendingManualRegistrationMoveEvent: PointerEvent | null = null
let lastManualRightClick: { at: number; clientX: number; clientY: number } | null = null

const FUSION_LIGHT_STAGE_SURFACE_CLASS = 'viewer-stage-surface--white'
const MANUAL_RIGHT_DOUBLE_CLICK_INTERVAL_MS = 420
const MANUAL_RIGHT_CLICK_MOVE_TOLERANCE_PX = 4
const MANUAL_ROTATION_MIN_RADIUS_PX = 18
const MANUAL_ROTATION_ACTIVATION_PX = 3
const hiddenFusionOrientation: OrientationInfo = {
  top: null,
  right: null,
  bottom: null,
  left: null,
  volumeQuaternion: null
}

function createDefaultManualRegistrationPreviewPose(): ManualRegistrationPreviewPose {
  return {
    translateCanvasX: 0,
    translateCanvasY: 0,
    rotationDegrees: 0,
    pivotCanvasX: 0,
    pivotCanvasY: 0,
    imageCenterCanvasX: 0,
    imageCenterCanvasY: 0
  }
}

function isManualRegistrationPreviewPoseIdentity(pose: ManualRegistrationPreviewPose | null): boolean {
  if (!pose) {
    return true
  }
  return (
    Math.abs(pose.translateCanvasX) < 0.001 &&
    Math.abs(pose.translateCanvasY) < 0.001 &&
    Math.abs(pose.rotationDegrees) < 0.001
  )
}

function captureManualRegistrationLockedImages(): void {
  manualRegistrationLockedImages.value = {
    images: {
      [FUSION_PET_AXIAL_PANE_KEY]: props.activeTab.fusionImages?.[FUSION_PET_AXIAL_PANE_KEY] ?? ''
    },
    layerImages: {
      [FUSION_OVERLAY_AXIAL_PANE_KEY]: props.activeTab.fusionLayerImages?.[FUSION_OVERLAY_AXIAL_PANE_KEY]?.pet ?? ''
    }
  }
}

function ensureManualRegistrationLockedImages(): void {
  if (manualRegistrationLockedImages.value) {
    return
  }
  captureManualRegistrationLockedImages()
}

function resetManualRegistrationPreview(): void {
  manualRegistrationVisualPose.value = null
  manualRegistrationLockedImages.value = null
}

const paneTitles = computed((): Record<FusionPaneKey, string> => ({
  'fusion-ct-ax': 'CT Axial',
  'fusion-pet-ax': 'PET Axial',
  'fusion-overlay-ax': isZh.value ? '融合 Axial' : 'Fusion Axial',
  'fusion-pet-cor-mip': 'PET Coronal MIP'
}))

const panes = computed<FusionPaneView[]>(() =>
  FUSION_PANE_KEYS.map((key) => ({
    key,
    title: paneTitles.value[key],
    imageSrc: props.activeTab.fusionImages?.[key] ?? '',
    sliceLabel: props.activeTab.fusionSliceLabels?.[key] ?? '',
    windowLabel: props.activeTab.fusionWindowLabels?.[key] ?? ''
  }))
)

const manualRegistrationEnabled = computed(() => props.activeTab.fusionManualRegistration === true)
const fusionRegistrationResetRevision = computed(() => props.activeTab.fusionRegistrationResetRevision ?? 0)
const manualRegistrationHint = computed(() =>
  isZh.value
    ? '配准模式 · 左拖平移 PET · 右拖旋转 PET · Esc 退出'
    : 'Registration mode · Left drag moves PET · Right drag rotates PET · Esc exits'
)
const loadingLabel = computed(() => (isZh.value ? '正在加载融合视图...' : 'Loading fusion view...'))
const placeholderLabel = computed(() => (isZh.value ? 'PET/CT 融合预览' : 'PET/CT fusion preview'))
const progressLabels = computed<Record<string, string>>(() => ({
  queued: isZh.value ? '准备渲染' : 'Preparing render',
  waiting: isZh.value ? '等待体数据' : 'Waiting for volume',
  volume: isZh.value ? '读取切片' : 'Reading slices',
  normalize: isZh.value ? '准备体数据' : 'Preparing volume',
  initialize: isZh.value ? '初始化视图' : 'Initializing view',
  render: isZh.value ? '渲染图像' : 'Rendering image',
  encode: isZh.value ? '生成图像' : 'Encoding image',
  complete: isZh.value ? '加载完成' : 'Loaded'
}))
interface ManualRegistrationPoint {
  canvasX: number
  canvasY: number
  viewX: number
  viewY: number
}

function getManualRegistrationPoint(event: PointerEvent): ManualRegistrationPoint {
  const target = event.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : paneElements.get(FUSION_OVERLAY_AXIAL_PANE_KEY)?.querySelector<HTMLElement>('.viewer-viewport')
      ?? paneElements.get(FUSION_OVERLAY_AXIAL_PANE_KEY)
      ?? null
  const rect = target?.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return {
      canvasX: event.clientX,
      canvasY: event.clientY,
      viewX: event.clientX,
      viewY: event.clientY
    }
  }
  const viewX = event.clientX - rect.left
  const viewY = event.clientY - rect.top
  const naturalSize = getPaneNaturalSize(FUSION_OVERLAY_AXIAL_PANE_KEY)
  const naturalWidth = naturalSize.width || rect.width
  const naturalHeight = naturalSize.height || rect.height
  const imageRect = getContainedImageRectFromBox(rect, naturalWidth, naturalHeight)
  if (!imageRect || imageRect.width <= 0 || imageRect.height <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
    return {
      canvasX: viewX,
      canvasY: viewY,
      viewX,
      viewY
    }
  }
  return {
    canvasX: (event.clientX - imageRect.left) * naturalWidth / imageRect.width,
    canvasY: (event.clientY - imageRect.top) * naturalHeight / imageRect.height,
    viewX,
    viewY
  }
}

function getManualRegistrationViewportElement(): HTMLElement | null {
  return paneElements.get(FUSION_OVERLAY_AXIAL_PANE_KEY)?.querySelector<HTMLElement>('.viewer-viewport') ?? null
}

function getManualRegistrationPetCenterPoint(basePose: ManualRegistrationPreviewPose): ManualRegistrationPoint & {
  imageCenterCanvasX: number
  imageCenterCanvasY: number
} {
  const viewport = getManualRegistrationViewportElement()
  if (!viewport) {
    return {
      canvasX: basePose.translateCanvasX,
      canvasY: basePose.translateCanvasY,
      viewX: basePose.translateCanvasX,
      viewY: basePose.translateCanvasY,
      imageCenterCanvasX: 0,
      imageCenterCanvasY: 0
    }
  }
  const viewportRect = viewport.getBoundingClientRect()
  const naturalSize = getPaneNaturalSize(FUSION_OVERLAY_AXIAL_PANE_KEY)
  const naturalWidth = naturalSize.width || viewportRect.width
  const naturalHeight = naturalSize.height || viewportRect.height
  const imageRect = getContainedImageRectFromBox(viewportRect, naturalWidth, naturalHeight)
  if (!viewportRect.width || !viewportRect.height || !imageRect.width || !imageRect.height || !naturalWidth || !naturalHeight) {
    const imageCenterCanvasX = naturalWidth / 2
    const imageCenterCanvasY = naturalHeight / 2
    return {
      canvasX: imageCenterCanvasX + basePose.translateCanvasX,
      canvasY: imageCenterCanvasY + basePose.translateCanvasY,
      viewX: viewportRect.width / 2 + basePose.translateCanvasX,
      viewY: viewportRect.height / 2 + basePose.translateCanvasY,
      imageCenterCanvasX,
      imageCenterCanvasY
    }
  }
  const imageCenterCanvasX = naturalWidth / 2
  const imageCenterCanvasY = naturalHeight / 2
  const scaleX = imageRect.width / naturalWidth
  const scaleY = imageRect.height / naturalHeight
  const viewX = imageRect.left - viewportRect.left + (imageCenterCanvasX + basePose.translateCanvasX) * scaleX
  const viewY = imageRect.top - viewportRect.top + (imageCenterCanvasY + basePose.translateCanvasY) * scaleY
  return {
    canvasX: imageCenterCanvasX + basePose.translateCanvasX,
    canvasY: imageCenterCanvasY + basePose.translateCanvasY,
    viewX,
    viewY,
    imageCenterCanvasX,
    imageCenterCanvasY
  }
}

function normalizeScreenAngleDeltaRad(deltaRad: number): number {
  if (!Number.isFinite(deltaRad)) {
    return 0
  }
  return Math.atan2(Math.sin(deltaRad), Math.cos(deltaRad))
}

function getManualRegistrationRotationAngle(event: PointerEvent, state: ManualRegistrationDragState): number | null {
  const deltaX = event.clientX - state.pivotClientX
  const deltaY = event.clientY - state.pivotClientY
  if (Math.hypot(deltaX, deltaY) < MANUAL_ROTATION_MIN_RADIUS_PX) {
    return null
  }
  return Math.atan2(deltaY, deltaX)
}

function updateManualRegistrationRotationDelta(event: PointerEvent, state: ManualRegistrationDragState): void {
  if (state.subOpType !== 'rotate') {
    return
  }
  const totalMove = Math.hypot(event.clientX - state.startClientX, event.clientY - state.startClientY)
  if (!state.rotationActive) {
    if (totalMove < MANUAL_ROTATION_ACTIVATION_PX) {
      return
    }
    state.rotationActive = true
  }
  const currentAngle = getManualRegistrationRotationAngle(event, state)
  if (currentAngle == null) {
    state.lastRotationAngleRad = null
    return
  }
  if (state.startRotationAngleRad == null) {
    state.startRotationAngleRad = currentAngle
  }
  if (state.lastRotationAngleRad == null) {
    state.lastRotationAngleRad = currentAngle
    state.rotationDeltaDegrees = state.unwrappedRotationDeltaRad * 180 / Math.PI
    return
  }
  const deltaRad = normalizeScreenAngleDeltaRad(currentAngle - state.lastRotationAngleRad)
  state.unwrappedRotationDeltaRad += deltaRad
  state.lastRotationAngleRad = currentAngle
  state.rotationDeltaDegrees = state.unwrappedRotationDeltaRad * 180 / Math.PI
}

function getPaneLoadingProgressPercent(paneKey: FusionPaneKey): number | null {
  const progressPercent = props.activeTab.fusionLoadingProgress?.[paneKey]?.progressPercent
  return typeof progressPercent === 'number' ? progressPercent : null
}

function getPaneLoadingLabel(paneKey: FusionPaneKey): string {
  const progress = props.activeTab.fusionLoadingProgress?.[paneKey] ?? null
  if (!progress) {
    return loadingLabel.value
  }
  const label = progress.message || progressLabels.value[progress.phase] || loadingLabel.value
  const hasCounts = typeof progress.loadedCount === 'number' && typeof progress.totalCount === 'number' && progress.totalCount > 0
  return hasCounts ? `${label} ${progress.loadedCount}/${progress.totalCount}` : label
}

function emitManualRegistrationDrag(
  phase: 'start' | 'move' | 'end',
  event: PointerEvent,
  snapshotOverride?: ManualRegistrationDragSnapshot
): void {
  const state = manualDragState.value
  if (!state) {
    return
  }
  const snapshot = snapshotOverride ?? createManualRegistrationDragSnapshot(state, event)
  if (phase === 'move') {
    state.lastMoveSnapshot = snapshot
    setManualRegistrationPreviewPoseFromSnapshot(state, snapshot)
  }
  if (phase === 'end') {
    setManualRegistrationPreviewPoseFromSnapshot(state, snapshot)
  }
  const payload = {
    viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
    phase,
    subOpType: state.subOpType,
    deltaX: snapshot.deltaX,
    deltaY: snapshot.deltaY,
    anchorX: state.startCanvasX,
    anchorY: state.startCanvasY,
    currentX: snapshot.currentCanvasX,
    currentY: snapshot.currentCanvasY,
    pivotX: state.pivotCanvasX,
    pivotY: state.pivotCanvasY
  }
  emit('fusionRegistrationDrag', state.subOpType === 'rotate'
    ? { ...payload, rotationDeltaDegrees: snapshot.rotationDeltaDegrees }
    : payload)
}

function createManualRegistrationDragSnapshot(
  state: ManualRegistrationDragState,
  event: PointerEvent,
  deltaOverride?: { deltaX: number; deltaY: number }
): ManualRegistrationDragSnapshot {
  const currentPoint = getManualRegistrationPoint(event)
  return {
    deltaX: deltaOverride?.deltaX ?? currentPoint.canvasX - state.startCanvasX,
    deltaY: deltaOverride?.deltaY ?? currentPoint.canvasY - state.startCanvasY,
    currentCanvasX: currentPoint.canvasX,
    currentCanvasY: currentPoint.canvasY,
    rotationDeltaDegrees: state.rotationDeltaDegrees
  }
}

function setManualRegistrationPreviewPoseFromSnapshot(state: ManualRegistrationDragState, snapshot: ManualRegistrationDragSnapshot): void {
  ensureManualRegistrationLockedImages()
  const nextTranslateCanvasX = state.subOpType === 'translate'
    ? state.basePose.translateCanvasX + snapshot.deltaX
    : state.basePose.translateCanvasX
  const nextTranslateCanvasY = state.subOpType === 'translate'
    ? state.basePose.translateCanvasY + snapshot.deltaY
    : state.basePose.translateCanvasY
  manualRegistrationVisualPose.value = {
    translateCanvasX: nextTranslateCanvasX,
    translateCanvasY: nextTranslateCanvasY,
    rotationDegrees: state.subOpType === 'rotate'
      ? state.basePose.rotationDegrees + snapshot.rotationDeltaDegrees
      : state.basePose.rotationDegrees,
    pivotCanvasX: state.imageCenterCanvasX + nextTranslateCanvasX,
    pivotCanvasY: state.imageCenterCanvasY + nextTranslateCanvasY,
    imageCenterCanvasX: state.imageCenterCanvasX,
    imageCenterCanvasY: state.imageCenterCanvasY
  }
}

function createManualRegistrationRightClickTapSnapshot(
  state: ManualRegistrationDragState,
  event: PointerEvent
): ManualRegistrationDragSnapshot {
  const currentPoint = getManualRegistrationPoint(event)
  return {
    deltaX: 0,
    deltaY: 0,
    currentCanvasX: currentPoint.canvasX,
    currentCanvasY: currentPoint.canvasY,
    rotationDeltaDegrees: 0
  }
}

function cancelPendingManualRegistrationMove(): void {
  pendingManualRegistrationMoveEvent = null
  if (manualRegistrationMoveRaf == null || typeof window === 'undefined') {
    manualRegistrationMoveRaf = null
    return
  }
  window.cancelAnimationFrame(manualRegistrationMoveRaf)
  manualRegistrationMoveRaf = null
}

function flushPendingManualRegistrationMove(): void {
  manualRegistrationMoveRaf = null
  const event = pendingManualRegistrationMoveEvent
  pendingManualRegistrationMoveEvent = null
  if (!event || !manualDragState.value) {
    return
  }
  emitManualRegistrationDrag('move', event)
}

function flushPendingManualRegistrationMoveNow(): void {
  if (manualRegistrationMoveRaf != null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(manualRegistrationMoveRaf)
  }
  flushPendingManualRegistrationMove()
}

function scheduleManualRegistrationMove(event: PointerEvent): void {
  pendingManualRegistrationMoveEvent = event
  if (manualRegistrationMoveRaf != null) {
    return
  }
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    flushPendingManualRegistrationMove()
    return
  }
  manualRegistrationMoveRaf = window.requestAnimationFrame(flushPendingManualRegistrationMove)
}

function handlePointerDown(event: PointerEvent, viewportKey: string): void {
  if (manualRegistrationEnabled.value && viewportKey === FUSION_OVERLAY_AXIAL_PANE_KEY && (event.button === 0 || event.button === 2)) {
    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget
    if (target instanceof HTMLElement) {
      target.setPointerCapture(event.pointerId)
    }
    const startPoint = getManualRegistrationPoint(event)
    ensureManualRegistrationLockedImages()
    const basePose = manualRegistrationVisualPose.value ?? createDefaultManualRegistrationPreviewPose()
    const petCenterPoint = getManualRegistrationPetCenterPoint(basePose)
    const viewportRect = getManualRegistrationViewportElement()?.getBoundingClientRect()
    const pivotClientX = viewportRect ? viewportRect.left + petCenterPoint.viewX : event.clientX
    const pivotClientY = viewportRect ? viewportRect.top + petCenterPoint.viewY : event.clientY
    const startRotationDeltaX = event.clientX - pivotClientX
    const startRotationDeltaY = event.clientY - pivotClientY
    const startRotationAngleRad =
      event.button === 2 && Math.hypot(startRotationDeltaX, startRotationDeltaY) >= MANUAL_ROTATION_MIN_RADIUS_PX
        ? Math.atan2(startRotationDeltaY, startRotationDeltaX)
        : null
    manualDragState.value = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCanvasX: startPoint.canvasX,
      startCanvasY: startPoint.canvasY,
      pivotCanvasX: petCenterPoint.canvasX,
      pivotCanvasY: petCenterPoint.canvasY,
      pivotClientX,
      pivotClientY,
      basePose,
      imageCenterCanvasX: petCenterPoint.imageCenterCanvasX,
      imageCenterCanvasY: petCenterPoint.imageCenterCanvasY,
      startRotationAngleRad,
      lastRotationAngleRad: startRotationAngleRad,
      unwrappedRotationDeltaRad: 0,
      rotationDeltaDegrees: 0,
      rotationActive: false,
      subOpType: event.button === 2 ? 'rotate' : 'translate',
      lastMoveSnapshot: null
    }
    emitManualRegistrationDrag('start', event)
    return
  }

  emit('pointerDown', event, viewportKey)
}

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))
}

function exitManualRegistrationMode(): void {
  if (!manualRegistrationEnabled.value) {
    return
  }
  cancelPendingManualRegistrationMove()
  manualDragState.value = null
  lastManualRightClick = null
  emit('fusionConfigChange', { manualRegistration: false })
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !manualRegistrationEnabled.value || isEditableKeyTarget(event.target)) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  exitManualRegistrationMode()
}

function getPointerEventTime(event: PointerEvent): number {
  return Number.isFinite(event.timeStamp) && event.timeStamp > 0
    ? event.timeStamp
    : (typeof performance !== 'undefined' ? performance.now() : Date.now())
}

function isManualRegistrationRightClickTap(state: ManualRegistrationDragState, event: PointerEvent): boolean {
  if (state.subOpType !== 'rotate') {
    return false
  }
  if (state.rotationActive || state.lastMoveSnapshot) {
    return false
  }
  return (
    Math.abs(event.clientX - state.startClientX) <= MANUAL_RIGHT_CLICK_MOVE_TOLERANCE_PX &&
    Math.abs(event.clientY - state.startClientY) <= MANUAL_RIGHT_CLICK_MOVE_TOLERANCE_PX
  )
}

function consumeManualRegistrationRightDoubleClick(state: ManualRegistrationDragState, event: PointerEvent): boolean {
  if (!isManualRegistrationRightClickTap(state, event)) {
    lastManualRightClick = null
    return false
  }

  const now = getPointerEventTime(event)
  const previous = lastManualRightClick
  lastManualRightClick = {
    at: now,
    clientX: event.clientX,
    clientY: event.clientY
  }

  if (!previous || now - previous.at > MANUAL_RIGHT_DOUBLE_CLICK_INTERVAL_MS) {
    return false
  }

  const distanceX = Math.abs(event.clientX - previous.clientX)
  const distanceY = Math.abs(event.clientY - previous.clientY)
  return distanceX <= MANUAL_RIGHT_CLICK_MOVE_TOLERANCE_PX && distanceY <= MANUAL_RIGHT_CLICK_MOVE_TOLERANCE_PX
}

function getFusionImageLayers(paneKey: FusionPaneKey): ViewerImageLayer[] {
  if (paneKey !== FUSION_OVERLAY_AXIAL_PANE_KEY) {
    return []
  }
  const petLayerSrc =
    manualRegistrationEnabled.value && !isManualRegistrationPreviewPoseIdentity(manualRegistrationVisualPose.value)
      ? manualRegistrationLockedImages.value?.layerImages[paneKey] || props.activeTab.fusionLayerImages?.[paneKey]?.pet
      : props.activeTab.fusionLayerImages?.[paneKey]?.pet
  if (!petLayerSrc) {
    return []
  }
  return [
    {
      key: 'pet-registration-layer',
      src: petLayerSrc,
      alt: 'PET overlay',
      class: 'pet-ct-fusion-view__pet-layer',
      style: getManualRegistrationPreviewStyle(paneKey)
    }
  ]
}

function getFusionPaneImageSrc(pane: FusionPaneView): string {
  if (
    manualRegistrationEnabled.value &&
    pane.key === FUSION_PET_AXIAL_PANE_KEY &&
    !isManualRegistrationPreviewPoseIdentity(manualRegistrationVisualPose.value)
  ) {
    return manualRegistrationLockedImages.value?.images[pane.key] || pane.imageSrc
  }
  return pane.imageSrc
}

function getFusionPaneImageStyle(paneKey: FusionPaneKey): Record<string, string> {
  if (paneKey !== FUSION_PET_AXIAL_PANE_KEY) {
    return {}
  }
  return getManualRegistrationPreviewStyle(paneKey)
}

function isFusionPetStandalonePane(paneKey: FusionPaneKey): boolean {
  return paneKey === FUSION_PET_AXIAL_PANE_KEY || paneKey === FUSION_PET_CORONAL_MIP_PANE_KEY
}

function getFusionPaneStageSurfaceClass(paneKey: FusionPaneKey): string {
  return isFusionPetStandalonePane(paneKey) ? FUSION_LIGHT_STAGE_SURFACE_CLASS : ''
}

function getFusionPaneSurfaceStyle(paneKey: FusionPaneKey): Record<string, string> {
  return isFusionPetStandalonePane(paneKey)
    ? {
        background: '#fff',
        backgroundImage: 'none'
      }
    : {}
}

function hasFusionPaneVisualContent(pane: FusionPaneView): boolean {
  return Boolean(getFusionPaneImageSrc(pane)) || getFusionImageLayers(pane.key).some((layer) => Boolean(layer.src))
}

function getFusionPaneOrientation(pane: FusionPaneView): OrientationInfo {
  return hasFusionPaneVisualContent(pane)
    ? props.activeTab.fusionOrientations?.[pane.key] ?? props.activeTab.orientation
    : hiddenFusionOrientation
}

function shouldShowFusionPaneCornerInfo(pane: FusionPaneView): boolean {
  return props.activeTab.showCornerInfo !== false && hasFusionPaneVisualContent(pane)
}

function shouldShowFusionPaneScaleBar(pane: FusionPaneView): boolean {
  return props.activeTab.showScaleBar !== false && hasFusionPaneVisualContent(pane)
}

function clampNormalized(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function bumpMarkerLayoutRevision(): void {
  markerLayoutRevision.value += 1
}

function scheduleMarkerLayoutUpdate(): void {
  if (markerLayoutRaf != null || typeof window === 'undefined') {
    return
  }
  markerLayoutRaf = window.requestAnimationFrame(() => {
    markerLayoutRaf = null
    bumpMarkerLayoutRevision()
  })
}

function getContainedImageRectFromBox(rect: DOMRect, naturalWidth: number, naturalHeight: number): DOMRect {
  if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) {
    return rect
  }

  const elementAspectRatio = rect.width / rect.height
  const imageAspectRatio = naturalWidth / naturalHeight
  if (elementAspectRatio > imageAspectRatio) {
    const renderedWidth = rect.height * imageAspectRatio
    const offsetX = (rect.width - renderedWidth) / 2
    return new DOMRect(rect.left + offsetX, rect.top, renderedWidth, rect.height)
  }

  const renderedHeight = rect.width / imageAspectRatio
  const offsetY = (rect.height - renderedHeight) / 2
  return new DOMRect(rect.left, rect.top + offsetY, rect.width, renderedHeight)
}

function getPaneImageRect(pane: HTMLElement): DOMRect {
  const image = pane.querySelector<HTMLImageElement>('.viewer-image')
  const viewport = pane.querySelector<HTMLElement>('.viewer-viewport') ?? pane
  const viewportRectCandidate = viewport.getBoundingClientRect()
  const viewportRect =
    viewportRectCandidate.width > 0 && viewportRectCandidate.height > 0
      ? viewportRectCandidate
      : image?.getBoundingClientRect() ?? pane.getBoundingClientRect()
  if (!image || !viewportRect.width || !viewportRect.height) {
    return pane.getBoundingClientRect()
  }
  const naturalWidth = image.naturalWidth || viewportRect.width
  const naturalHeight = image.naturalHeight || viewportRect.height
  const imageRect = getContainedImageRectFromBox(viewportRect, naturalWidth, naturalHeight)
  return imageRect.width && imageRect.height ? imageRect : pane.getBoundingClientRect()
}

function getPaneViewportRect(paneKey: FusionPaneKey): DOMRect | null {
  const pane = paneElements.get(paneKey)
  const viewport = pane?.querySelector<HTMLElement>('.viewer-viewport') ?? pane
  const rect = viewport?.getBoundingClientRect()
  return rect && rect.width > 0 && rect.height > 0 ? rect : null
}

function getPaneNaturalSize(paneKey: FusionPaneKey): { width: number; height: number } {
  const pane = paneElements.get(paneKey)
  const image = pane?.querySelector<HTMLImageElement>('.viewer-image') ?? null
  const layerSize = paneKey === FUSION_OVERLAY_AXIAL_PANE_KEY
    ? props.activeTab.fusionLayerImages?.[FUSION_OVERLAY_AXIAL_PANE_KEY]
    : null
  const width = image?.naturalWidth || layerSize?.width || getPaneViewportRect(paneKey)?.width || 0
  const height = image?.naturalHeight || layerSize?.height || getPaneViewportRect(paneKey)?.height || 0
  return { width, height }
}

function getManualRegistrationPreviewStyle(paneKey: FusionPaneKey): Record<string, string> {
  void markerLayoutRevision.value
  const pose = manualRegistrationVisualPose.value
  if (!manualRegistrationEnabled.value || !pose || isManualRegistrationPreviewPoseIdentity(pose)) {
    return {}
  }
  const viewportRect = getPaneViewportRect(paneKey)
  if (!viewportRect) {
    return {}
  }
  const naturalSize = getPaneNaturalSize(paneKey)
  const imageRect = getContainedImageRectFromBox(viewportRect, naturalSize.width, naturalSize.height)
  if (!naturalSize.width || !naturalSize.height || !imageRect.width || !imageRect.height) {
    return {}
  }

  const scaleX = imageRect.width / naturalSize.width
  const scaleY = imageRect.height / naturalSize.height
  const translateX = pose.translateCanvasX * scaleX
  const translateY = pose.translateCanvasY * scaleY
  const imageCenterX = imageRect.left - viewportRect.left + pose.imageCenterCanvasX * scaleX
  const imageCenterY = imageRect.top - viewportRect.top + pose.imageCenterCanvasY * scaleY
  const rotationCenterX = imageCenterX + translateX
  const rotationCenterY = imageCenterY + translateY
  const round = (value: number): number => Math.round(value * 1000) / 1000
  if (Math.abs(pose.rotationDegrees) < 0.001) {
    return {
      transform: `translate(${round(translateX)}px, ${round(translateY)}px)`,
      transformOrigin: `${round(rotationCenterX)}px ${round(rotationCenterY)}px`,
      willChange: 'transform'
    }
  }
  const rotationRad = pose.rotationDegrees * Math.PI / 180
  const cos = Math.cos(rotationRad)
  const sin = Math.sin(rotationRad)
  const matrixA = cos
  const matrixB = sin
  const matrixC = -sin
  const matrixD = cos
  const matrixE = rotationCenterX - cos * imageCenterX + sin * imageCenterY
  const matrixF = rotationCenterY - sin * imageCenterX - cos * imageCenterY
  return {
    transform: `matrix(${round(matrixA)}, ${round(matrixB)}, ${round(matrixC)}, ${round(matrixD)}, ${round(matrixE)}, ${round(matrixF)})`,
    transformOrigin: '0px 0px',
    willChange: 'transform'
  }
}

function setPaneRef(paneKey: FusionPaneKey, element: Element | ComponentPublicInstance | null): void {
  const nextElement = element instanceof HTMLElement ? element : null
  const previousElement = paneElements.get(paneKey)
  if (previousElement && previousElement !== nextElement) {
    paneResizeObserver?.unobserve(previousElement)
    paneElements.delete(paneKey)
  }
  if (!nextElement) {
    return
  }
  paneElements.set(paneKey, nextElement)
  paneResizeObserver?.observe(nextElement)
  scheduleMarkerLayoutUpdate()
}

function isFiniteVec3(value: Vec3 | null | undefined): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item))
}

function getFusionProjection(paneKey: FusionPaneKey): FusionProjectionInfo | null {
  return props.activeTab.fusionProjections?.[paneKey] ?? null
}

function getFirstFusionProjection(): FusionProjectionInfo | null {
  return FUSION_PANE_KEYS.map((paneKey) => getFusionProjection(paneKey)).find((projection): projection is FusionProjectionInfo => projection != null) ?? null
}

function dotWorld(coefficients: readonly [number, number, number, number], world: Vec3): number {
  return coefficients[0] * world[0] + coefficients[1] * world[1] + coefficients[2] * world[2] + coefficients[3]
}

function normalizedToWorld(projection: FusionProjectionInfo, x: number, y: number): Vec3 {
  return [
    projection.normalizedToWorldOrigin[0] + projection.normalizedToWorldX[0] * x + projection.normalizedToWorldY[0] * y,
    projection.normalizedToWorldOrigin[1] + projection.normalizedToWorldX[1] * x + projection.normalizedToWorldY[1] * y,
    projection.normalizedToWorldOrigin[2] + projection.normalizedToWorldX[2] * x + projection.normalizedToWorldY[2] * y
  ]
}

function getCalibrationMarkerWorld(): Vec3 | null {
  if (isFiniteVec3(calibrationMarkerWorld.value)) {
    return calibrationMarkerWorld.value
  }
  const projection = getFirstFusionProjection()
  return isFiniteVec3(projection?.referenceWorld) ? projection.referenceWorld : null
}

function resolveCalibrationMarkerPositionForPane(paneKey: FusionPaneKey): FusionMarkerPosition {
  const projection = getFusionProjection(paneKey)
  const world = getCalibrationMarkerWorld()
  if (!projection || !world) {
    return calibrationMarkerPosition.value
  }

  const x = dotWorld(projection.worldToNormalizedX, world)
  const y = dotWorld(projection.worldToNormalizedY, world)
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return calibrationMarkerPosition.value
  }
  return { x, y }
}

function captureManualRegistrationMarkerPositions(): void {
  const nextPositions: FusionMarkerPositionMap = {}
  FUSION_PANE_KEYS.forEach((paneKey) => {
    nextPositions[paneKey] = resolveCalibrationMarkerPositionForPane(paneKey)
  })
  manualRegistrationMarkerPositions.value = nextPositions
  scheduleMarkerLayoutUpdate()
}

function getCalibrationMarkerPositionForPane(paneKey: FusionPaneKey): FusionMarkerPosition {
  const lockedPosition = manualRegistrationEnabled.value
    ? manualRegistrationMarkerPositions.value?.[paneKey]
    : null
  if (lockedPosition) {
    return lockedPosition
  }
  return resolveCalibrationMarkerPositionForPane(paneKey)
}

function getCalibrationMarkerStyle(paneKey: FusionPaneKey): Record<string, string> {
  void markerLayoutRevision.value
  const markerPosition = getCalibrationMarkerPositionForPane(paneKey)
  const pane = paneElements.get(paneKey)
  if (!pane) {
    return {
      left: `${markerPosition.x * 100}%`,
      top: `${markerPosition.y * 100}%`
    }
  }

  const paneRect = pane.getBoundingClientRect()
  const imageRect = getPaneImageRect(pane)
  if (!paneRect.width || !paneRect.height || !imageRect.width || !imageRect.height) {
    return {
      left: `${markerPosition.x * 100}%`,
      top: `${markerPosition.y * 100}%`
    }
  }

  const left = imageRect.left - paneRect.left + markerPosition.x * imageRect.width
  const top = imageRect.top - paneRect.top + markerPosition.y * imageRect.height
  return {
    left: `${left}px`,
    top: `${top}px`
  }
}

function updateCalibrationMarkerFromPointer(event: PointerEvent): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) {
    return
  }
  const pane = target.closest<HTMLElement>('.pet-ct-fusion-view__pane')
  if (!pane) {
    return
  }
  const rect = getPaneImageRect(pane)
  if (rect.width <= 0 || rect.height <= 0) {
    return
  }
  const normalizedPosition = {
    x: clampNormalized((event.clientX - rect.left) / rect.width),
    y: clampNormalized((event.clientY - rect.top) / rect.height)
  }
  calibrationMarkerPosition.value = normalizedPosition
  const paneKey = pane.dataset.fusionPaneKey as FusionPaneKey | undefined
  const projection = paneKey ? getFusionProjection(paneKey) : null
  if (projection) {
    calibrationMarkerWorld.value = normalizedToWorld(projection, normalizedPosition.x, normalizedPosition.y)
  }
  if (manualRegistrationEnabled.value) {
    captureManualRegistrationMarkerPositions()
  }
}

function handleCalibrationPointerDown(event: PointerEvent): void {
  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget
  if (target instanceof HTMLElement && typeof target.setPointerCapture === 'function') {
    target.setPointerCapture(event.pointerId)
  }
  calibrationDragState.value = { pointerId: event.pointerId }
  updateCalibrationMarkerFromPointer(event)
}

function handleCalibrationPointerMove(event: PointerEvent): void {
  if (!calibrationDragState.value || calibrationDragState.value.pointerId !== event.pointerId) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateCalibrationMarkerFromPointer(event)
}

function finishCalibrationDrag(event: PointerEvent): boolean {
  if (!calibrationDragState.value || calibrationDragState.value.pointerId !== event.pointerId) {
    return false
  }
  updateCalibrationMarkerFromPointer(event)
  const target = event.currentTarget
  if (target instanceof HTMLElement && typeof target.hasPointerCapture === 'function' && target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  calibrationDragState.value = null
  return true
}

function handleCalibrationPointerUp(event: PointerEvent): void {
  if (finishCalibrationDrag(event)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function handlePaneImageLoaded(viewportKey: string): void {
  scheduleMarkerLayoutUpdate()
  emit('imageLoaded', viewportKey)
}

function handlePointerMove(event: PointerEvent): void {
  const state = manualDragState.value
  if (state) {
    event.preventDefault()
    if (state.subOpType === 'rotate') {
      updateManualRegistrationRotationDelta(event, state)
      if (!state.rotationActive) {
        return
      }
    }
    scheduleManualRegistrationMove(event)
    return
  }
  emit('pointerMove', event)
}

function finishManualDrag(event: PointerEvent): boolean {
  const state = manualDragState.value
  if (!state || state.pointerId !== event.pointerId) {
    return false
  }
  if (pendingManualRegistrationMoveEvent) {
    flushPendingManualRegistrationMoveNow()
  }
  if (state.subOpType === 'rotate' && !state.lastMoveSnapshot) {
    updateManualRegistrationRotationDelta(event, state)
  }
  const isRightClickTap = isManualRegistrationRightClickTap(state, event)
  const shouldExitRegistration = consumeManualRegistrationRightDoubleClick(state, event)
  const finalSnapshot = isRightClickTap
    ? createManualRegistrationRightClickTapSnapshot(state, event)
    : state.lastMoveSnapshot ?? createManualRegistrationDragSnapshot(state, event)
  cancelPendingManualRegistrationMove()
  emitManualRegistrationDrag('end', event, finalSnapshot)
  const target = event.currentTarget
  if (target instanceof HTMLElement && target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  manualDragState.value = null
  if (shouldExitRegistration) {
    exitManualRegistrationMode()
  }
  return true
}

function handlePointerUp(event: PointerEvent): void {
  if (finishManualDrag(event)) {
    return
  }
  emit('pointerUp', event)
}

function handlePointerCancel(event: PointerEvent): void {
  if (finishManualDrag(event)) {
    return
  }
  emit('pointerCancel', event)
}

function handlePaneDoubleClick(paneKey: FusionPaneKey): void {
  expandedFusionPaneKey.value = expandedFusionPaneKey.value === paneKey ? null : paneKey
  emit('viewportClick', paneKey)
  void nextTick(() => {
    scheduleMarkerLayoutUpdate()
  })
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    paneResizeObserver = new ResizeObserver(() => {
      scheduleMarkerLayoutUpdate()
    })
    paneElements.forEach((element) => paneResizeObserver?.observe(element))
  }
  window.addEventListener('resize', scheduleMarkerLayoutUpdate)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  cancelPendingManualRegistrationMove()
  if (markerLayoutRaf != null) {
    window.cancelAnimationFrame(markerLayoutRaf)
    markerLayoutRaf = null
  }
  paneResizeObserver?.disconnect()
  paneResizeObserver = null
  paneElements.clear()
  window.removeEventListener('resize', scheduleMarkerLayoutUpdate)
  window.removeEventListener('keydown', handleKeydown)
})

watch(
  () => props.activeTab.fusionImages,
  async () => {
    await nextTick()
    scheduleMarkerLayoutUpdate()
  },
  { deep: true }
)

watch(
  () => props.activeTab.key,
  () => {
    cancelPendingManualRegistrationMove()
    calibrationMarkerWorld.value = null
    calibrationMarkerPosition.value = { x: 0.5, y: 0.5 }
    manualRegistrationMarkerPositions.value = null
    manualDragState.value = null
    expandedFusionPaneKey.value = null
    resetManualRegistrationPreview()
    scheduleMarkerLayoutUpdate()
  }
)

watch(
  manualRegistrationEnabled,
  (enabled) => {
    if (enabled) {
      void nextTick(() => {
        captureManualRegistrationMarkerPositions()
      })
      return
    }
    cancelPendingManualRegistrationMove()
    manualDragState.value = null
    lastManualRightClick = null
    manualRegistrationMarkerPositions.value = null
    resetManualRegistrationPreview()
  },
  { immediate: true }
)

watch(
  fusionRegistrationResetRevision,
  () => {
    cancelPendingManualRegistrationMove()
    manualDragState.value = null
    lastManualRightClick = null
    resetManualRegistrationPreview()
  }
)

</script>

<template>
  <div
    class="pet-ct-fusion-view relative h-full min-h-0 w-full overflow-hidden bg-black"
    :class="{ 'pet-ct-fusion-view--manual-registration': manualRegistrationEnabled }"
  >
    <div
      v-if="manualRegistrationEnabled"
      class="pet-ct-fusion-view__registration-banner"
      data-testid="fusion-registration-mode-banner"
    >
      {{ manualRegistrationHint }}
    </div>
    <div
      class="pet-ct-fusion-view__grid grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-[3px]"
      :class="{ 'pet-ct-fusion-view__grid--expanded': expandedFusionPaneKey != null }"
    >
      <section
        v-for="pane in panes"
        :key="pane.key"
        :ref="(element) => setPaneRef(pane.key, element)"
        :data-fusion-pane-key="pane.key"
        class="pet-ct-fusion-view__pane relative min-h-0 overflow-hidden rounded-md border border-white/12 bg-black"
        :class="{
          'pet-ct-fusion-view__pane--active': activeViewportKey === pane.key,
          'pet-ct-fusion-view__pane--manual-registration-target': manualRegistrationEnabled && pane.key === FUSION_OVERLAY_AXIAL_PANE_KEY,
          'pet-ct-fusion-view__pane--pet-standalone': isFusionPetStandalonePane(pane.key),
          'pet-ct-fusion-view__pane--expanded': expandedFusionPaneKey === pane.key,
          'pet-ct-fusion-view__pane--hidden-by-expanded': expandedFusionPaneKey != null && expandedFusionPaneKey !== pane.key
        }"
        :style="getFusionPaneSurfaceStyle(pane.key)"
      >
        <div v-if="!hasFusionPaneVisualContent(pane)" class="pointer-events-none absolute left-3 top-2 z-10 rounded-md bg-black/35 px-2 py-1 text-[11px] font-semibold text-white/85">
          {{ pane.title }}
        </div>
        <ViewerCanvasStage
          class="pet-ct-fusion-view__stage"
          :active-operation="activeOperation"
          :alt="pane.title"
          :annotations="getAnnotations(pane.key)"
          :corner-info="activeTab.fusionCornerInfos?.[pane.key] ?? activeTab.cornerInfo"
          :cursor-class="manualRegistrationEnabled && pane.key === FUSION_OVERLAY_AXIAL_PANE_KEY ? 'cursor-move' : getCursorClass(pane.key)"
          :draft-annotation="getDraftAnnotation(pane.key)"
          :draft-measurement="getDraftMeasurement(pane.key)"
          :draft-measurement-mode="getDraftMeasurementMode(pane.key)"
          :image-layers="getFusionImageLayers(pane.key)"
          :image-src="getFusionPaneImageSrc(pane)"
          :image-style="getFusionPaneImageStyle(pane.key)"
          :is-active="activeViewportKey === pane.key"
          :is-loading="!hasFusionPaneVisualContent(pane)"
          :light-surface="isFusionPetStandalonePane(pane.key)"
          :loading-label="getPaneLoadingLabel(pane.key)"
          :loading-progress-percent="getPaneLoadingProgressPercent(pane.key)"
          :measurements="getMeasurements(pane.key)"
          :orientation="getFusionPaneOrientation(pane)"
          :placeholder="placeholderLabel"
          :render-surface-active="true"
          :scale-bar="activeTab.fusionScaleBars?.[pane.key] ?? null"
          :show-corner-info="shouldShowFusionPaneCornerInfo(pane)"
          :show-scale-bar="shouldShowFusionPaneScaleBar(pane)"
          :stage-surface-class="getFusionPaneStageSurfaceClass(pane.key)"
          :viewport-transform="activeTab.fusionTransformStates?.[pane.key] ?? activeTab.transformState ?? null"
          :viewport-key="pane.key"
          @click-viewport="emit('viewportClick', $event)"
          @copy-annotation="emit('copyAnnotation', $event)"
          @copy-selected-measurement="emit('copySelectedMeasurement', $event)"
          @delete-annotation="emit('deleteAnnotation', $event)"
          @delete-selected-measurement="emit('deleteSelectedMeasurement', $event)"
          @double-click-viewport="handlePaneDoubleClick(pane.key)"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @image-loaded="handlePaneImageLoaded"
          @pointer-cancel="handlePointerCancel"
          @pointer-down="handlePointerDown"
          @pointer-leave="emit('pointerLeave', $event)"
          @pointer-move="handlePointerMove"
          @pointer-up="handlePointerUp"
          @update-annotation-color="emit('updateAnnotationColor', $event)"
          @update-annotation-size="emit('updateAnnotationSize', $event)"
          @update-annotation-text="emit('updateAnnotationText', $event)"
          @wheel-viewport="emit('viewportWheel', $event)"
          @contextmenu.prevent
        />
        <button
          v-if="getFusionPaneImageSrc(pane)"
          type="button"
          class="pet-ct-fusion-view__marker"
          :aria-label="isZh ? '辅助标定' : 'Calibration marker'"
          :style="getCalibrationMarkerStyle(pane.key)"
          @pointerdown="handleCalibrationPointerDown"
          @pointermove="handleCalibrationPointerMove"
          @pointerup="handleCalibrationPointerUp"
          @pointercancel="handleCalibrationPointerUp"
          @click.stop
        >
          <span class="pet-ct-fusion-view__marker-segment pet-ct-fusion-view__marker-segment--top" />
          <span class="pet-ct-fusion-view__marker-segment pet-ct-fusion-view__marker-segment--bottom" />
          <span class="pet-ct-fusion-view__marker-segment pet-ct-fusion-view__marker-segment--left" />
          <span class="pet-ct-fusion-view__marker-segment pet-ct-fusion-view__marker-segment--right" />
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pet-ct-fusion-view__pane {
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.86);
}

.pet-ct-fusion-view__grid--expanded {
  grid-template-columns: minmax(0, 1fr) !important;
  grid-template-rows: minmax(0, 1fr) !important;
}

.pet-ct-fusion-view__pane--expanded {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
}

.pet-ct-fusion-view__pane--hidden-by-expanded {
  display: none;
}

.pet-ct-fusion-view__pane--pet-standalone {
  background: #fff !important;
  background-image: none !important;
}

.pet-ct-fusion-view__pane--pet-standalone :deep(.viewer-viewport),
.pet-ct-fusion-view__pane--pet-standalone :deep(.viewer-stage-surface--white),
.pet-ct-fusion-view__pane--pet-standalone :deep(.viewer-stage-surface--light),
.pet-ct-fusion-view__pane--pet-standalone .pet-ct-fusion-view__stage {
  background: #fff !important;
  background-image: none !important;
}

.pet-ct-fusion-view__registration-banner {
  position: absolute;
  left: 50%;
  top: 10px;
  z-index: 34;
  transform: translateX(-50%);
  max-width: min(92%, 720px);
  border: 1px solid rgba(245, 158, 11, 0.58);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(69, 44, 8, 0.88), rgba(27, 20, 9, 0.9));
  color: #ffe8b3;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.72);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.32),
    0 0 0 1px rgba(0, 0, 0, 0.3),
    0 0 22px rgba(245, 158, 11, 0.18);
  pointer-events: none;
}

.pet-ct-fusion-view__pane--active {
  border-color: #1e9cff;
  box-shadow:
    inset 0 0 0 1px rgba(30, 156, 255, 0.9),
    0 0 0 1px rgba(30, 156, 255, 0.36);
}

.pet-ct-fusion-view--manual-registration .pet-ct-fusion-view__pane--manual-registration-target {
  border-color: rgba(245, 158, 11, 0.96);
  box-shadow:
    inset 0 0 0 1px rgba(245, 158, 11, 0.94),
    inset 0 0 28px rgba(245, 158, 11, 0.08),
    0 0 0 1px rgba(245, 158, 11, 0.34),
    0 0 24px rgba(245, 158, 11, 0.28);
}

.pet-ct-fusion-view--manual-registration .pet-ct-fusion-view__pane--manual-registration-target::after {
  content: 'REG';
  position: absolute;
  right: 10px;
  top: 8px;
  z-index: 28;
  border: 1px solid rgba(245, 158, 11, 0.58);
  border-radius: 999px;
  background: rgba(27, 20, 9, 0.68);
  color: #ffe8b3;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.2;
  pointer-events: none;
}

.pet-ct-fusion-view__stage {
  border: 0;
  border-radius: 4px;
  background: #000;
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label) {
  color: #ff8f8f;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.95),
    0 0 5px rgba(0, 0, 0, 0.68);
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label--top) {
  top: 6px;
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label--right) {
  right: 6px;
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label--bottom) {
  bottom: 6px;
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label--left) {
  left: 6px;
}

.pet-ct-fusion-view__stage :deep(.viewer-corner-block) {
  max-width: min(44%, 310px);
  padding: 9px 10px;
  color: #ff9a9a;
  font-size: var(--viewer-corner-pet-font-size);
  line-height: var(--viewer-corner-pet-line-height);
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.92),
    0 0 5px rgba(0, 0, 0, 0.62);
}

.pet-ct-fusion-view__pane--pet-standalone :deep(.viewer-corner-block) {
  color: #182334;
  font-weight: 750;
  text-shadow:
    0 1px 1px rgba(255, 255, 255, 0.86),
    0 0 3px rgba(15, 23, 42, 0.22);
}

.pet-ct-fusion-view__stage :deep(.viewer-corner-overlay--custom-color .viewer-corner-block) {
  color: var(--viewer-corner-custom-dark-color);
}

.pet-ct-fusion-view__pane--pet-standalone :deep(.viewer-corner-overlay--custom-color .viewer-corner-block) {
  color: var(--viewer-corner-custom-light-color);
}

.pet-ct-fusion-view__pane--pet-standalone :deep(.viewer-orientation-label) {
  color: #b91c1c;
  text-shadow:
    0 1px 1px rgba(255, 255, 255, 0.86),
    0 0 3px rgba(15, 23, 42, 0.28);
}

.pet-ct-fusion-view__marker {
  position: absolute;
  z-index: 24;
  width: 54px;
  height: 54px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0;
  transform: translate(-50%, -50%);
  cursor: move;
  touch-action: none;
}

.pet-ct-fusion-view__marker::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  opacity: 0;
  transition: opacity 120ms ease;
}

.pet-ct-fusion-view__marker:hover::before,
.pet-ct-fusion-view__marker:focus-visible::before {
  opacity: 1;
}

.pet-ct-fusion-view__marker:focus-visible {
  outline: 1px solid rgba(255, 255, 255, 0.72);
  outline-offset: 2px;
}

.pet-ct-fusion-view__marker-segment {
  position: absolute;
  display: block;
  border-radius: 999px;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.62);
  pointer-events: none;
}

.pet-ct-fusion-view__marker-segment--top,
.pet-ct-fusion-view__marker-segment--bottom {
  left: 25px;
  width: 4px;
  height: 14px;
  background: #285dff;
}

.pet-ct-fusion-view__marker-segment--top {
  top: 5px;
}

.pet-ct-fusion-view__marker-segment--bottom {
  bottom: 5px;
}

.pet-ct-fusion-view__marker-segment--left,
.pet-ct-fusion-view__marker-segment--right {
  top: 25px;
  width: 14px;
  height: 4px;
  background: #5ab929;
}

.pet-ct-fusion-view__marker-segment--left {
  left: 5px;
}

.pet-ct-fusion-view__marker-segment--right {
  right: 5px;
}

</style>
