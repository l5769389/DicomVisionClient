<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  STACK_OPERATION_PREFIX,
  type ViewOperationType,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import ViewerCanvasStage from '../../components/viewer/views/ViewerCanvasStage.vue'
import { createMeasurementDraft, isValidMeasurement } from '../../composables/measurements/measurementGeometry'
import {
  getFinalizedPointSequencePoints,
  isMeasurementToolType,
  isPointSequenceMeasurement
} from '../../composables/measurements/measurementToolRules'
import { buildRectRoiDraftPoints } from '../../composables/measurements/rectRoiPointerController'
import type { CornerInfo, MeasurementDraft, MeasurementDraftPoint, MeasurementToolType, ViewerTabItem, WorkspaceReadyPayload } from '../../types/viewer'
import {
  createMobileViewportDragMoveQueue,
  getMobileGestureCenter,
  getMobileGestureDistance,
  type MobileViewportDragMove
} from './mobileViewportGesture'

type PointerPoint = {
  x: number
  y: number
}

type MeasureSessionKind = 'create' | 'extend'

const POINT_SEQUENCE_DOUBLE_TAP_MS = 420
const POINT_SEQUENCE_DOUBLE_TAP_DISTANCE = 0.025
const DISTINCT_POINT_EPSILON = 0.01

const props = withDefaults(defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
  isViewLoading: boolean
  scrollThreshold?: number
}>(), {
  scrollThreshold: 28
})

const emit = defineEmits<{
  activeViewportChange: [viewportKey: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  measurementCreate: [payload: { viewportKey: string; toolType: MeasurementDraft['toolType']; points: MeasurementDraftPoint[]; measurementId?: string }]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [payload: { viewportKey: string; deltaY: number }]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = ref<HTMLElement | null>(null)
const activePointers = new Map<number, PointerPoint>()
const emptyCornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

let lastPrimaryPoint: PointerPoint | null = null
let activeDragOperation: ViewOperationType | null = null
let scrollAccumulator = 0
let lastPinchDistance = 0
let lastPinchCenter: PointerPoint | null = null
let isPinching = false
let totalDragDeltaX = 0
let totalDragDeltaY = 0
let totalPinchPanDeltaX = 0
let totalPinchPanDeltaY = 0
let totalPinchZoomDeltaY = 0
const draftMeasurement = ref<MeasurementDraft | null>(null)
let measurePointerId: number | null = null
let measureToolType: MeasurementToolType | null = null
let measureSessionKind: MeasureSessionKind | null = null
let lastPointSequenceTap: { toolType: MeasurementToolType; point: MeasurementDraftPoint; timeStamp: number } | null = null
const dragMoveQueue = createMobileViewportDragMoveQueue<'single'>((move: MobileViewportDragMove<'single'>) => {
  emit('viewportDrag', {
    deltaX: move.deltaX,
    deltaY: move.deltaY,
    opType: move.opType,
    phase: 'move',
    viewportKey: move.viewportKey
  })
})

const stackTab = computed(() => (props.activeTab?.viewType === 'Stack' ? props.activeTab : null))
const viewportPlaceholder = computed(() => (stackTab.value ? '移动端单视口预览' : '选择序列后打开 Stack 视图'))

function emitWorkspaceReady(): void {
  const element = viewportHostRef.value
  emit('workspaceReady', {
    element,
    viewportKey: 'single',
    viewportElements: {
      single: element
    }
  })
}

function normalizeOperation(operation: string): string {
  return operation.startsWith(STACK_OPERATION_PREFIX) ? operation.slice(STACK_OPERATION_PREFIX.length) : operation
}

function getMeasurementToolType(): MeasurementToolType | null {
  const operation = normalizeOperation(props.activeOperation)
  const [toolKey, toolType] = operation.split(':')
  if (toolKey === 'measure' && isMeasurementToolType(toolType)) {
    return toolType
  }
  return null
}

function isMeasureOperation(): boolean {
  return getMeasurementToolType() != null
}

function resolveDragOperation(): ViewOperationType | null {
  const operation = normalizeOperation(props.activeOperation)
  if (operation === VIEW_OPERATION_TYPES.pan || operation === VIEW_OPERATION_TYPES.window || operation === VIEW_OPERATION_TYPES.zoom) {
    return operation
  }
  return null
}

function getPoint(event: PointerEvent): PointerPoint {
  return {
    x: event.clientX,
    y: event.clientY
  }
}

function getNormalizedPoint(event: PointerEvent): MeasurementDraftPoint | null {
  const element = viewportHostRef.value
  if (!element) {
    return null
  }
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) {
    return null
  }
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
  }
}

function createMeasurementId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mobile-measure-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getPointerEventTimestamp(event?: PointerEvent): number {
  return typeof event?.timeStamp === 'number' && Number.isFinite(event.timeStamp)
    ? event.timeStamp
    : window.performance.now()
}

function replaceLastMeasurementPoint(points: MeasurementDraftPoint[], point: MeasurementDraftPoint): MeasurementDraftPoint[] {
  if (!points.length) {
    return [point]
  }
  return points.map((currentPoint, index) => (index === points.length - 1 ? point : currentPoint))
}

function areDistinctPoints(a: MeasurementDraftPoint | undefined, b: MeasurementDraftPoint | undefined): boolean {
  return Boolean(a && b && Math.hypot(a.x - b.x, a.y - b.y) > DISTINCT_POINT_EPSILON)
}

function rememberPointSequenceTap(toolType: MeasurementToolType, point: MeasurementDraftPoint | undefined, event?: PointerEvent): void {
  if (!point) {
    lastPointSequenceTap = null
    return
  }
  lastPointSequenceTap = {
    toolType,
    point,
    timeStamp: getPointerEventTimestamp(event)
  }
}

function isPointSequenceDoubleTap(toolType: MeasurementToolType, point: MeasurementDraftPoint | undefined, event?: PointerEvent): boolean {
  if (!point || !lastPointSequenceTap || lastPointSequenceTap.toolType !== toolType) {
    return false
  }
  const elapsed = getPointerEventTimestamp(event) - lastPointSequenceTap.timeStamp
  if (elapsed < 0 || elapsed > POINT_SEQUENCE_DOUBLE_TAP_MS) {
    return false
  }
  return Math.hypot(point.x - lastPointSequenceTap.point.x, point.y - lastPointSequenceTap.point.y) <= POINT_SEQUENCE_DOUBLE_TAP_DISTANCE
}

function buildTwoPointDraftPoints(
  toolType: MeasurementToolType,
  anchorPoint: MeasurementDraftPoint,
  currentPoint: MeasurementDraftPoint
): MeasurementDraftPoint[] {
  return toolType === 'rect' || toolType === 'ellipse'
    ? buildRectRoiDraftPoints(anchorPoint, currentPoint)
    : [anchorPoint, currentPoint]
}

function commitMeasurement(toolType: MeasurementToolType, points: MeasurementDraftPoint[]): boolean {
  if (!isValidMeasurement(toolType, points)) {
    return false
  }
  emit('measurementCreate', {
    viewportKey: 'single',
    toolType,
    points,
    measurementId: createMeasurementId()
  })
  return true
}

function beginMeasure(event: PointerEvent): boolean {
  const toolType = getMeasurementToolType()
  const point = getNormalizedPoint(event)
  if (!toolType || !point) {
    return false
  }
  measurePointerId = event.pointerId
  measureToolType = toolType

  const existingDraft = draftMeasurement.value
  if (existingDraft && !existingDraft.measurementId && existingDraft.toolType === toolType && existingDraft.points.length) {
    measureSessionKind = 'extend'
    if (toolType === 'angle') {
      const [anchorPoint, vertexPoint] = existingDraft.points
      draftMeasurement.value = createMeasurementDraft(
        toolType,
        anchorPoint && vertexPoint ? [anchorPoint, vertexPoint, point] : buildTwoPointDraftPoints(toolType, anchorPoint ?? point, point)
      )
    } else if (isPointSequenceMeasurement(toolType)) {
      draftMeasurement.value = createMeasurementDraft(toolType, replaceLastMeasurementPoint(existingDraft.points, point))
    } else {
      const anchorPoint = existingDraft.points[0] ?? point
      draftMeasurement.value = createMeasurementDraft(toolType, buildTwoPointDraftPoints(toolType, anchorPoint, point))
    }
  } else {
    measureSessionKind = 'create'
    draftMeasurement.value = createMeasurementDraft(toolType, buildTwoPointDraftPoints(toolType, point, point))
  }

  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  return true
}

function moveMeasure(event: PointerEvent): boolean {
  if (measurePointerId !== event.pointerId || !draftMeasurement.value || !measureToolType) {
    return false
  }
  const point = getNormalizedPoint(event)
  if (!point) {
    return true
  }
  const currentDraft = draftMeasurement.value
  const anchorPoint = currentDraft.points[0] ?? point
  let points: MeasurementDraftPoint[]
  if (measureToolType === 'angle' && currentDraft.points.length >= 3) {
    points = [currentDraft.points[0], currentDraft.points[1], point]
  } else if (isPointSequenceMeasurement(measureToolType)) {
    points = replaceLastMeasurementPoint(currentDraft.points, point)
  } else {
    points = buildTwoPointDraftPoints(measureToolType, anchorPoint, point)
  }
  draftMeasurement.value = createMeasurementDraft(measureToolType, points)
  return true
}

function endMeasure(event: PointerEvent): boolean {
  if (measurePointerId !== event.pointerId || !draftMeasurement.value || !measureToolType) {
    return false
  }
  moveMeasure(event)
  const toolType = measureToolType
  const points = draftMeasurement.value.points
  const releaseSession = (): void => {
    measurePointerId = null
    measureToolType = null
    measureSessionKind = null
  }

  if (toolType === 'line' || toolType === 'rect' || toolType === 'ellipse') {
    commitMeasurement(toolType, points)
    draftMeasurement.value = null
    releaseSession()
    return true
  }

  if (toolType === 'angle') {
    if (points.length >= 3 && commitMeasurement(toolType, points)) {
      draftMeasurement.value = null
    } else if (points.length >= 2 && isValidMeasurement('line', points.slice(0, 2))) {
      draftMeasurement.value = createMeasurementDraft(toolType, points.slice(0, 2))
    } else {
      draftMeasurement.value = null
    }
    releaseSession()
    return true
  }

  if (isPointSequenceMeasurement(toolType)) {
    const pointerPoint = getNormalizedPoint(event) ?? points.at(-1)
    const nextConfirmedPoints = pointerPoint ? replaceLastMeasurementPoint(points, pointerPoint) : points
    const finalizedPoints = getFinalizedPointSequencePoints(nextConfirmedPoints)
    if (
      measureSessionKind === 'extend' &&
      isPointSequenceDoubleTap(toolType, pointerPoint, event) &&
      isValidMeasurement(toolType, finalizedPoints)
    ) {
      commitMeasurement(toolType, finalizedPoints)
      draftMeasurement.value = null
      lastPointSequenceTap = null
      releaseSession()
      return true
    }

    rememberPointSequenceTap(toolType, pointerPoint, event)
    if (measureSessionKind === 'create' && !areDistinctPoints(nextConfirmedPoints[0], nextConfirmedPoints[1])) {
      draftMeasurement.value = createMeasurementDraft(toolType, nextConfirmedPoints.slice(0, 2))
    } else if (pointerPoint) {
      draftMeasurement.value = createMeasurementDraft(toolType, [...nextConfirmedPoints, pointerPoint])
    } else {
      draftMeasurement.value = createMeasurementDraft(toolType, nextConfirmedPoints)
    }
    releaseSession()
    return true
  }

  draftMeasurement.value = null
  releaseSession()
  return true
}

function getPinchDistance(): number {
  return getMobileGestureDistance(Array.from(activePointers.values()))
}

function getPinchCenter(): PointerPoint | null {
  return getMobileGestureCenter(Array.from(activePointers.values()))
}

function emitViewportDragMove(deltaX: number, deltaY: number, opType: ViewOperationType): void {
  dragMoveQueue.push({ deltaX, deltaY, opType, viewportKey: 'single' })
}

function flushPendingDragMoves(): void {
  dragMoveQueue.flush()
}

function cancelPendingDragMoves(): void {
  dragMoveQueue.cancel()
}

function clearMeasureSession(options: { clearDraft?: boolean; clearPointSequence?: boolean } = {}): void {
  measurePointerId = null
  measureToolType = null
  measureSessionKind = null
  if (options.clearDraft) {
    draftMeasurement.value = null
  }
  if (options.clearPointSequence) {
    lastPointSequenceTap = null
  }
}

function beginDrag(operation: ViewOperationType | null, point: PointerPoint): void {
  activeDragOperation = operation
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
      viewportKey: 'single'
    })
  }
}

function endDrag(): void {
  flushPendingDragMoves()
  if (activeDragOperation) {
    emit('viewportDrag', {
      deltaX: 0,
      deltaY: 0,
      opType: activeDragOperation,
      phase: 'end',
      viewportKey: 'single'
    })
  }
  activeDragOperation = null
  lastPrimaryPoint = null
  scrollAccumulator = 0
  totalDragDeltaX = 0
  totalDragDeltaY = 0
}

function beginPinch(): void {
  endDrag()
  isPinching = true
  lastPinchDistance = getPinchDistance()
  lastPinchCenter = getPinchCenter()
  totalPinchPanDeltaX = 0
  totalPinchPanDeltaY = 0
  totalPinchZoomDeltaY = 0
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType: VIEW_OPERATION_TYPES.zoom,
    phase: 'start',
    viewportKey: 'single'
  })
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType: VIEW_OPERATION_TYPES.pan,
    phase: 'start',
    viewportKey: 'single'
  })
}

function endPinch(): void {
  if (!isPinching) {
    return
  }
  flushPendingDragMoves()
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType: VIEW_OPERATION_TYPES.zoom,
    phase: 'end',
    viewportKey: 'single'
  })
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType: VIEW_OPERATION_TYPES.pan,
    phase: 'end',
    viewportKey: 'single'
  })
  isPinching = false
  lastPinchDistance = 0
  lastPinchCenter = null
  totalPinchPanDeltaX = 0
  totalPinchPanDeltaY = 0
  totalPinchZoomDeltaY = 0
}

function handlePointerDown(event: PointerEvent): void {
  event.preventDefault()
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  emit('activeViewportChange', 'single')
  if (isMeasureOperation() && event.isPrimary && event.button === 0 && beginMeasure(event)) {
    return
  }
  activePointers.set(event.pointerId, getPoint(event))
  if (activePointers.size >= 2) {
    beginPinch()
    return
  }
  beginDrag(resolveDragOperation(), getPoint(event))
}

function handleScrollDrag(deltaY: number): void {
  scrollAccumulator += deltaY
  const sliceDelta = Math.trunc(scrollAccumulator / props.scrollThreshold)
  if (!sliceDelta) {
    return
  }
  scrollAccumulator -= sliceDelta * props.scrollThreshold
  emit('viewportWheel', {
    viewportKey: 'single',
    deltaY: sliceDelta
  })
}

function handlePointerMove(event: PointerEvent): void {
  if (moveMeasure(event)) {
    event.preventDefault()
    return
  }
  const previousPoint = activePointers.get(event.pointerId)
  if (!previousPoint) {
    return
  }
  event.preventDefault()
  const nextPoint = getPoint(event)
  activePointers.set(event.pointerId, nextPoint)

  if (activePointers.size >= 2) {
    if (!isPinching) {
      beginPinch()
      return
    }
    const nextDistance = getPinchDistance()
    const deltaDistance = nextDistance - lastPinchDistance
    lastPinchDistance = nextDistance
    const nextCenter = getPinchCenter()
    if (nextCenter && lastPinchCenter) {
      totalPinchPanDeltaX += nextCenter.x - lastPinchCenter.x
      totalPinchPanDeltaY += nextCenter.y - lastPinchCenter.y
      emitViewportDragMove(totalPinchPanDeltaX, totalPinchPanDeltaY, VIEW_OPERATION_TYPES.pan)
    }
    lastPinchCenter = nextCenter
    if (deltaDistance) {
      totalPinchZoomDeltaY += -deltaDistance
      emitViewportDragMove(0, totalPinchZoomDeltaY, VIEW_OPERATION_TYPES.zoom)
    }
    return
  }

  const lastPoint = lastPrimaryPoint ?? previousPoint
  const deltaX = nextPoint.x - lastPoint.x
  const deltaY = nextPoint.y - lastPoint.y
  lastPrimaryPoint = nextPoint

  if (normalizeOperation(props.activeOperation) === VIEW_OPERATION_TYPES.scroll) {
    handleScrollDrag(deltaY)
    return
  }

  if (activeDragOperation && (deltaX || deltaY)) {
    totalDragDeltaX += deltaX
    totalDragDeltaY += deltaY
    emitViewportDragMove(totalDragDeltaX, totalDragDeltaY, activeDragOperation)
  }
}

function handlePointerUp(event: PointerEvent): void {
  event.preventDefault()
  if (endMeasure(event)) {
    return
  }
  activePointers.delete(event.pointerId)
  if (activePointers.size >= 2) {
    lastPinchDistance = getPinchDistance()
    return
  }
  if (isPinching) {
    endPinch()
  }
  if (activePointers.size === 1) {
    const nextPoint = Array.from(activePointers.values())[0]
    activeDragOperation = null
    lastPrimaryPoint = nextPoint
    return
  }
  endDrag()
}

function handlePointerCancel(event: PointerEvent): void {
  event.preventDefault()
  if (measurePointerId === event.pointerId) {
    clearMeasureSession({ clearDraft: true, clearPointSequence: true })
  }
  activePointers.delete(event.pointerId)
  if (activePointers.size === 0) {
    endPinch()
    endDrag()
  }
}

onMounted(() => {
  void nextTick(emitWorkspaceReady)
})

onBeforeUnmount(() => {
  activePointers.clear()
  clearMeasureSession({ clearDraft: true, clearPointSequence: true })
  totalDragDeltaX = 0
  totalDragDeltaY = 0
  totalPinchPanDeltaX = 0
  totalPinchPanDeltaY = 0
  totalPinchZoomDeltaY = 0
  cancelPendingDragMoves()
  endPinch()
  endDrag()
})

watch(
  () => stackTab.value?.key,
  () => {
    void nextTick(emitWorkspaceReady)
  }
)

watch(
  () => props.activeOperation,
  () => {
    const nextToolType = getMeasurementToolType()
    if (draftMeasurement.value && draftMeasurement.value.toolType !== nextToolType) {
      clearMeasureSession({ clearDraft: true, clearPointSequence: true })
    }
  }
)
</script>

<template>
  <section ref="viewportHostRef" class="mobile-stack-viewport">
    <ViewerCanvasStage
      class="min-h-0"
      viewport-key="single"
      viewport-class="mobile-stack-viewport__stage"
      image-class="mobile-stack-viewport__image"
      :is-active="true"
      :render-surface-active="Boolean(stackTab)"
      :image-src="stackTab?.imageSrc ?? ''"
      :is-loading="Boolean(stackTab?.viewId) && (!stackTab?.imageSrc || isViewLoading)"
      loading-label="正在加载影像..."
      :alt="stackTab?.viewType ?? 'Stack'"
      :active-operation="activeOperation"
      :placeholder="viewportPlaceholder"
      :annotations="[]"
      :corner-info="stackTab?.cornerInfo ?? emptyCornerInfo"
      :draft-measurement-mode="draftMeasurement ? 'draft' : null"
      :draft-measurement="draftMeasurement"
      :measurements="stackTab?.measurements ?? []"
      :scale-bar="stackTab?.scaleBar ?? null"
      :show-corner-info="stackTab?.showCornerInfo !== false"
      :show-scale-bar="stackTab?.showScaleBar !== false"
      :orientation="stackTab?.orientation ?? { top: null, right: null, bottom: null, left: null, volumeQuaternion: null }"
      @hover-viewport-change="emit('hoverViewportChange', $event)"
      @wheel-viewport="emit('viewportWheel', $event)"
      @pointer-down="handlePointerDown"
      @pointer-move="handlePointerMove"
      @pointer-up="handlePointerUp"
      @pointer-cancel="handlePointerCancel"
      @pointer-leave="() => {}"
    />
  </section>
</template>

<style scoped>
.mobile-stack-viewport {
  min-height: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  touch-action: none;
}

.mobile-stack-viewport :deep(.mobile-stack-viewport__stage) {
  border-radius: 0 !important;
  border: 0 !important;
  background: #02050a !important;
}

.mobile-stack-viewport :deep(.mobile-stack-viewport__image) {
  user-select: none;
  -webkit-user-drag: none;
}
</style>
