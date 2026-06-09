<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  STACK_OPERATION_PREFIX,
  type ViewOperationType,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import ViewerCanvasStage from '../../components/viewer/views/ViewerCanvasStage.vue'
import type { CornerInfo, ViewerTabItem, WorkspaceReadyPayload } from '../../types/viewer'

type PointerPoint = {
  x: number
  y: number
}

type PendingDragMove = {
  deltaX: number
  deltaY: number
  opType: ViewOperationType
}

const DRAG_MOVE_THRESHOLD = 1.25

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
let pendingDragMoves: PendingDragMove[] = []
let pendingDragFrame: number | null = null

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

function getPinchDistance(): number {
  const points = Array.from(activePointers.values())
  if (points.length < 2) {
    return 0
  }
  const [a, b] = points
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function getPinchCenter(): PointerPoint | null {
  const points = Array.from(activePointers.values())
  if (points.length < 2) {
    return null
  }
  const [a, b] = points
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  }
}

function exceedsDragThreshold(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) >= DRAG_MOVE_THRESHOLD || Math.abs(deltaY) >= DRAG_MOVE_THRESHOLD
}

function emitViewportDragMove(deltaX: number, deltaY: number, opType: ViewOperationType): void {
  if (!exceedsDragThreshold(deltaX, deltaY)) {
    return
  }
  pendingDragMoves.push({ deltaX, deltaY, opType })
  if (pendingDragFrame != null) {
    return
  }
  pendingDragFrame = window.requestAnimationFrame(flushPendingDragMoves)
}

function flushPendingDragMoves(): void {
  if (pendingDragFrame != null) {
    window.cancelAnimationFrame(pendingDragFrame)
    pendingDragFrame = null
  }
  const moves = pendingDragMoves
  pendingDragMoves = []
  const totals = new Map<ViewOperationType, { deltaX: number; deltaY: number }>()
  for (const move of moves) {
    const total = totals.get(move.opType) ?? { deltaX: 0, deltaY: 0 }
    total.deltaX += move.deltaX
    total.deltaY += move.deltaY
    totals.set(move.opType, total)
  }
  totals.forEach((total, opType) => {
    emit('viewportDrag', {
      deltaX: total.deltaX,
      deltaY: total.deltaY,
      opType,
      phase: 'move',
      viewportKey: 'single'
    })
  })
}

function cancelPendingDragMoves(): void {
  if (pendingDragFrame != null) {
    window.cancelAnimationFrame(pendingDragFrame)
    pendingDragFrame = null
  }
  pendingDragMoves = []
}

function beginDrag(operation: ViewOperationType | null, point: PointerPoint): void {
  activeDragOperation = operation
  lastPrimaryPoint = point
  scrollAccumulator = 0
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
}

function beginPinch(): void {
  endDrag()
  isPinching = true
  lastPinchDistance = getPinchDistance()
  lastPinchCenter = getPinchCenter()
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
}

function handlePointerDown(event: PointerEvent): void {
  event.preventDefault()
  emit('activeViewportChange', 'single')
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
      emitViewportDragMove(nextCenter.x - lastPinchCenter.x, nextCenter.y - lastPinchCenter.y, VIEW_OPERATION_TYPES.pan)
    }
    lastPinchCenter = nextCenter
    if (deltaDistance) {
      emitViewportDragMove(0, -deltaDistance, VIEW_OPERATION_TYPES.zoom)
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
    emitViewportDragMove(deltaX, deltaY, activeDragOperation)
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
    const nextPoint = Array.from(activePointers.values())[0]
    activeDragOperation = null
    lastPrimaryPoint = nextPoint
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
      :measurements="[]"
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
