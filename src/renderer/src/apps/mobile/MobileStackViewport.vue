<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  STACK_OPERATION_PREFIX,
  type ViewOperationType,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import ViewerCanvasStage from '../../components/viewer/views/ViewerCanvasStage.vue'
import type { CornerInfo, MeasurementDraft, MeasurementDraftPoint, ViewerTabItem, WorkspaceReadyPayload } from '../../types/viewer'
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

function isMeasureOperation(): boolean {
  return props.activeOperation.startsWith('measure:')
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

function beginMeasure(event: PointerEvent): boolean {
  const point = getNormalizedPoint(event)
  if (!point) {
    return false
  }
  measurePointerId = event.pointerId
  draftMeasurement.value = {
    toolType: 'line',
    points: [point, point],
    labelLines: []
  }
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  return true
}

function moveMeasure(event: PointerEvent): boolean {
  if (measurePointerId !== event.pointerId || !draftMeasurement.value) {
    return false
  }
  const point = getNormalizedPoint(event)
  if (!point) {
    return true
  }
  const start = draftMeasurement.value.points[0] ?? point
  draftMeasurement.value = {
    ...draftMeasurement.value,
    points: [start, point]
  }
  return true
}

function endMeasure(event: PointerEvent): boolean {
  if (measurePointerId !== event.pointerId || !draftMeasurement.value) {
    return false
  }
  moveMeasure(event)
  const points = draftMeasurement.value.points
  const [start, end] = points
  if (start && end && Math.hypot(end.x - start.x, end.y - start.y) > 0.01) {
    emit('measurementCreate', {
      viewportKey: 'single',
      toolType: 'line',
      points,
      measurementId: createMeasurementId()
    })
  }
  draftMeasurement.value = null
  measurePointerId = null
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
    draftMeasurement.value = null
    measurePointerId = null
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
  draftMeasurement.value = null
  measurePointerId = null
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
