<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES, type ViewOperationType } from '@shared/viewerConstants'
import VolumeView from '../../components/viewer/views/VolumeView.vue'
import type { ViewerTabItem, WorkspaceReadyPayload } from '../../types/viewer'
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

const props = defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
}>()

const emit = defineEmits<{
  activeViewportChange: [viewportKey: string]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = ref<HTMLElement | null>(null)
const volumeTab = computed(() => (props.activeTab?.viewType === '3D' ? props.activeTab : null))
const activePointers = new Map<number, PointerPoint>()
const MOBILE_VOLUME_ROTATE_SENSITIVITY = 0.25

let lastPrimaryPoint: PointerPoint | null = null
let activeDragOperation: ViewOperationType | null = null
let lastPinchDistance = 0
let lastPinchCenter: PointerPoint | null = null
let isPinching = false
let totalDragDeltaX = 0
let totalDragDeltaY = 0
let totalPinchPanDeltaX = 0
let totalPinchPanDeltaY = 0
let totalPinchZoomDeltaY = 0

const dragMoveQueue = createMobileViewportDragMoveQueue<'volume'>((move: MobileViewportDragMove<'volume'>) => {
  emit('viewportDrag', {
    deltaX: move.deltaX,
    deltaY: move.deltaY,
    opType: move.opType,
    phase: 'move',
    viewportKey: move.viewportKey
  })
})

function emitWorkspaceReady(): void {
  const element = viewportHostRef.value
  const volumeElement = element?.querySelector<HTMLElement>('[data-viewport-key="volume"]') ?? element
  emit('workspaceReady', {
    element,
    viewportKey: 'volume',
    viewportElements: {
      volume: volumeElement
    }
  })
}

function normalizeOperation(operation: string): string {
  return operation.startsWith(STACK_OPERATION_PREFIX) ? operation.slice(STACK_OPERATION_PREFIX.length) : operation
}

function resolveDragOperation(): ViewOperationType {
  const operation = normalizeOperation(props.activeOperation)
  if (
    operation === VIEW_OPERATION_TYPES.pan ||
    operation === VIEW_OPERATION_TYPES.zoom ||
    operation === VIEW_OPERATION_TYPES.window ||
    operation === VIEW_OPERATION_TYPES.rotate3d
  ) {
    return operation
  }
  return VIEW_OPERATION_TYPES.rotate3d
}

function getPoint(event: PointerEvent): PointerPoint {
  return {
    x: event.clientX,
    y: event.clientY
  }
}

function getPinchDistance(): number {
  return getMobileGestureDistance(Array.from(activePointers.values()))
}

function getPinchCenter(): PointerPoint | null {
  return getMobileGestureCenter(Array.from(activePointers.values()))
}

function emitViewportDragStart(opType: ViewOperationType): void {
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType,
    phase: 'start',
    viewportKey: 'volume'
  })
}

function emitViewportDragEnd(opType: ViewOperationType): void {
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType,
    phase: 'end',
    viewportKey: 'volume'
  })
}

function emitViewportDragMove(deltaX: number, deltaY: number, opType: ViewOperationType): void {
  const sensitivity = opType === VIEW_OPERATION_TYPES.rotate3d ? MOBILE_VOLUME_ROTATE_SENSITIVITY : 1
  dragMoveQueue.push({ deltaX: deltaX * sensitivity, deltaY: deltaY * sensitivity, opType, viewportKey: 'volume' })
}

function flushPendingDragMoves(): void {
  dragMoveQueue.flush()
}

function cancelPendingDragMoves(): void {
  dragMoveQueue.cancel()
}

function beginDrag(operation: ViewOperationType, point: PointerPoint): void {
  activeDragOperation = operation
  lastPrimaryPoint = point
  totalDragDeltaX = 0
  totalDragDeltaY = 0
  emitViewportDragStart(operation)
}

function endDrag(): void {
  flushPendingDragMoves()
  if (activeDragOperation) {
    emitViewportDragEnd(activeDragOperation)
  }
  activeDragOperation = null
  lastPrimaryPoint = null
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
  emitViewportDragStart(VIEW_OPERATION_TYPES.zoom)
  emitViewportDragStart(VIEW_OPERATION_TYPES.pan)
}

function endPinch(): void {
  if (!isPinching) {
    return
  }
  flushPendingDragMoves()
  emitViewportDragEnd(VIEW_OPERATION_TYPES.zoom)
  emitViewportDragEnd(VIEW_OPERATION_TYPES.pan)
  isPinching = false
  lastPinchDistance = 0
  lastPinchCenter = null
  totalPinchPanDeltaX = 0
  totalPinchPanDeltaY = 0
  totalPinchZoomDeltaY = 0
}

function handleViewportClick(viewportKey: string): void {
  emit('activeViewportChange', viewportKey)
}

function handlePointerDown(event: PointerEvent): void {
  event.preventDefault()
  emit('activeViewportChange', 'volume')
  activePointers.set(event.pointerId, getPoint(event))
  if (activePointers.size >= 2) {
    beginPinch()
    return
  }
  beginDrag(resolveDragOperation(), getPoint(event))
}

function handlePointerMove(event: PointerEvent): void {
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
  if (activeDragOperation && (deltaX || deltaY)) {
    totalDragDeltaX += deltaX
    totalDragDeltaY += deltaY
    emitViewportDragMove(totalDragDeltaX, totalDragDeltaY, activeDragOperation)
  }
}

function handlePointerUp(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  if (activePointers.size >= 2) {
    lastPinchDistance = getPinchDistance()
    return
  }
  if (isPinching) {
    endPinch()
  }
  if (activePointers.size === 1) {
    lastPrimaryPoint = Array.from(activePointers.values())[0] ?? null
    activeDragOperation = null
    return
  }
  endDrag()
}

function handlePointerCancel(event: PointerEvent): void {
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
  () => volumeTab.value?.key,
  () => {
    void nextTick(emitWorkspaceReady)
  }
)
</script>

<template>
  <section ref="viewportHostRef" class="mobile-volume-viewport" data-testid="mobile-volume-viewport">
    <VolumeView
      v-if="volumeTab"
      :active-tab="volumeTab"
      :active-operation="activeOperation"
      @pointer-cancel="handlePointerCancel"
      @pointer-down="handlePointerDown"
      @pointer-move="handlePointerMove"
      @pointer-up="handlePointerUp"
      @viewport-click="handleViewportClick"
    />
  </section>
</template>

<style scoped>
.mobile-volume-viewport {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #02050a;
  touch-action: none;
}

.mobile-volume-viewport :deep(.viewer-viewport--active) {
  border-color: transparent !important;
  box-shadow: none !important;
  outline: 0 !important;
}

.mobile-volume-viewport :deep(img) {
  user-select: none;
  -webkit-user-drag: none;
}
</style>
