<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES, type ViewOperationType } from '@shared/viewerConstants'
import ViewerCanvasStage from '../../components/viewer/views/ViewerCanvasStage.vue'
import type { CompareStackPaneKey, CornerInfo, ViewerTabItem, WorkspaceReadyPayload } from '../../types/viewer'
import {
  COMPARE_STACK_PANE_KEYS,
  COMPARE_STACK_SOURCE_PANE_KEY,
  createComparePaneRecord,
  createEmptyCornerInfo,
  createEmptyOrientationInfo,
  isCompareStackPaneKey
} from '../../composables/workspace/views/viewerWorkspaceTabs'
import {
  createMobileViewportDragMoveQueue,
  getMobileGestureCenter,
  getMobileGestureDistance,
  type MobileViewportDragMove
} from './mobileViewportGesture'

type PointerPoint = {
  viewportKey: CompareStackPaneKey
  x: number
  y: number
}

interface ComparePaneView {
  badge: string
  imageSrc: string
  key: CompareStackPaneKey
  sliceLabel: string
  title: string
}

const props = withDefaults(defineProps<{
  activeCompareViewportKey: CompareStackPaneKey
  activeOperation: string
  activeTab: ViewerTabItem | null
  isViewLoading: boolean
  scrollThreshold?: number
}>(), {
  scrollThreshold: 28
})

const emit = defineEmits<{
  activeViewportChange: [viewportKey: CompareStackPaneKey]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [payload: { viewportKey: string; deltaY: number }]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = ref<HTMLElement | null>(null)
const activePointers = new Map<number, PointerPoint>()
const emptyCornerInfo: CornerInfo = createEmptyCornerInfo()
const emptyOrientationInfo = createEmptyOrientationInfo()

let activeDragOperation: ViewOperationType | null = null
let activeDragViewportKey: CompareStackPaneKey | null = null
let lastPrimaryPoint: PointerPoint | null = null
let scrollAccumulator = 0
let lastPinchDistance = 0
let lastPinchCenter: PointerPoint | null = null
let isPinching = false

const dragMoveQueue = createMobileViewportDragMoveQueue<CompareStackPaneKey>((move: MobileViewportDragMove<CompareStackPaneKey>) => {
  emit('viewportDrag', {
    deltaX: move.deltaX,
    deltaY: move.deltaY,
    opType: move.opType,
    phase: 'move',
    viewportKey: move.viewportKey
  })
})

const compareTab = computed(() => (props.activeTab?.viewType === 'CompareStack' ? props.activeTab : null))
const panes = computed<ComparePaneView[]>(() =>
  COMPARE_STACK_PANE_KEYS.map((key, index) => ({
    badge: index === 0 ? 'A' : 'B',
    imageSrc: compareTab.value?.compareImages?.[key] ?? '',
    key,
    sliceLabel: compareTab.value?.compareSliceLabels?.[key] ?? '',
    title: compareTab.value?.compareSeriesTitles?.[key] || (index === 0 ? compareTab.value?.seriesTitle || 'Source' : 'Compare')
  }))
)
const activeViewport = computed(() =>
  isCompareStackPaneKey(props.activeCompareViewportKey) ? props.activeCompareViewportKey : COMPARE_STACK_SOURCE_PANE_KEY
)

function getViewportElement(viewportKey: CompareStackPaneKey): HTMLElement | null {
  return viewportHostRef.value?.querySelector<HTMLElement>(`[data-viewport-key="${viewportKey}"]`) ?? null
}

function emitWorkspaceReady(): void {
  const element = viewportHostRef.value
  emit('workspaceReady', {
    element,
    viewportKey: activeViewport.value,
    viewportElements: createComparePaneRecord((paneKey) => getViewportElement(paneKey))
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

function getPoint(event: PointerEvent, viewportKey: CompareStackPaneKey): PointerPoint {
  return {
    viewportKey,
    x: event.clientX,
    y: event.clientY
  }
}

function getPinchDistance(): number {
  return getMobileGestureDistance(Array.from(activePointers.values()))
}

function getPinchCenter(): PointerPoint | null {
  const center = getMobileGestureCenter(Array.from(activePointers.values()))
  if (!center) {
    return null
  }
  return {
    viewportKey: activeViewport.value,
    x: center.x,
    y: center.y
  }
}

function emitViewportDragStart(opType: ViewOperationType, viewportKey: CompareStackPaneKey): void {
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType,
    phase: 'start',
    viewportKey
  })
}

function emitViewportDragEnd(opType: ViewOperationType, viewportKey: CompareStackPaneKey): void {
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType,
    phase: 'end',
    viewportKey
  })
}

function emitViewportDragMove(deltaX: number, deltaY: number, opType: ViewOperationType, viewportKey: CompareStackPaneKey): void {
  dragMoveQueue.push({ deltaX, deltaY, opType, viewportKey })
}

function emitActiveViewportChange(viewportKey: string): void {
  if (isCompareStackPaneKey(viewportKey)) {
    emit('activeViewportChange', viewportKey)
  }
}

function flushPendingDragMoves(): void {
  dragMoveQueue.flush()
}

function cancelPendingDragMoves(): void {
  dragMoveQueue.cancel()
}

function beginDrag(operation: ViewOperationType | null, point: PointerPoint): void {
  activeDragOperation = operation
  activeDragViewportKey = point.viewportKey
  lastPrimaryPoint = point
  scrollAccumulator = 0
  if (operation) {
    emitViewportDragStart(operation, point.viewportKey)
  }
}

function endDrag(): void {
  flushPendingDragMoves()
  if (activeDragOperation && activeDragViewportKey) {
    emitViewportDragEnd(activeDragOperation, activeDragViewportKey)
  }
  activeDragOperation = null
  activeDragViewportKey = null
  lastPrimaryPoint = null
  scrollAccumulator = 0
}

function beginPinch(): void {
  endDrag()
  isPinching = true
  lastPinchDistance = getPinchDistance()
  lastPinchCenter = getPinchCenter()
  emitViewportDragStart(VIEW_OPERATION_TYPES.zoom, activeViewport.value)
  emitViewportDragStart(VIEW_OPERATION_TYPES.pan, activeViewport.value)
}

function endPinch(): void {
  if (!isPinching) {
    return
  }
  flushPendingDragMoves()
  emitViewportDragEnd(VIEW_OPERATION_TYPES.zoom, activeViewport.value)
  emitViewportDragEnd(VIEW_OPERATION_TYPES.pan, activeViewport.value)
  isPinching = false
  lastPinchDistance = 0
  lastPinchCenter = null
}

function handlePointerDown(event: PointerEvent, viewportKey: string): void {
  if (!isCompareStackPaneKey(viewportKey)) {
    return
  }
  event.preventDefault()
  emit('activeViewportChange', viewportKey)
  const point = getPoint(event, viewportKey)
  activePointers.set(event.pointerId, point)
  if (activePointers.size >= 2) {
    beginPinch()
    return
  }
  beginDrag(resolveDragOperation(), point)
}

function handleScrollDrag(deltaY: number, viewportKey: CompareStackPaneKey): void {
  scrollAccumulator += deltaY
  const sliceDelta = Math.trunc(scrollAccumulator / props.scrollThreshold)
  if (!sliceDelta) {
    return
  }
  scrollAccumulator -= sliceDelta * props.scrollThreshold
  emit('viewportWheel', {
    viewportKey,
    deltaY: sliceDelta
  })
}

function handlePointerMove(event: PointerEvent): void {
  const previousPoint = activePointers.get(event.pointerId)
  if (!previousPoint) {
    return
  }
  event.preventDefault()
  const nextPoint = getPoint(event, previousPoint.viewportKey)
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
      emitViewportDragMove(
        nextCenter.x - lastPinchCenter.x,
        nextCenter.y - lastPinchCenter.y,
        VIEW_OPERATION_TYPES.pan,
        activeViewport.value
      )
    }
    lastPinchCenter = nextCenter
    if (deltaDistance) {
      emitViewportDragMove(0, -deltaDistance, VIEW_OPERATION_TYPES.zoom, activeViewport.value)
    }
    return
  }

  const lastPoint = lastPrimaryPoint ?? previousPoint
  const deltaX = nextPoint.x - lastPoint.x
  const deltaY = nextPoint.y - lastPoint.y
  lastPrimaryPoint = nextPoint

  if (normalizeOperation(props.activeOperation) === VIEW_OPERATION_TYPES.scroll) {
    handleScrollDrag(deltaY, nextPoint.viewportKey)
    return
  }

  if (activeDragOperation && activeDragViewportKey && (deltaX || deltaY)) {
    emitViewportDragMove(deltaX, deltaY, activeDragOperation, activeDragViewportKey)
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
    activeDragViewportKey = null
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
  () => [compareTab.value?.key, activeViewport.value] as const,
  () => {
    void nextTick(emitWorkspaceReady)
  }
)
</script>

<template>
  <section ref="viewportHostRef" class="mobile-compare-viewport" data-testid="mobile-compare-viewport">
    <div
      v-for="pane in panes"
      :key="pane.key"
      class="mobile-compare-viewport__pane"
      :class="{ 'mobile-compare-viewport__pane--active': activeViewport === pane.key }"
      :data-testid="`mobile-compare-pane-${pane.key}`"
    >
      <div class="mobile-compare-viewport__pane-header">
        <span class="mobile-compare-viewport__badge">{{ pane.badge }}</span>
        <span class="mobile-compare-viewport__title">{{ pane.title }}</span>
        <span class="mobile-compare-viewport__slice">{{ pane.sliceLabel || '--' }}</span>
      </div>
      <ViewerCanvasStage
        class="min-h-0"
        :viewport-key="pane.key"
        viewport-class="mobile-compare-viewport__stage"
        image-class="mobile-compare-viewport__image"
        :is-active="activeViewport === pane.key"
        :render-surface-active="true"
        :image-src="pane.imageSrc"
        :is-loading="Boolean(compareTab?.compareViewIds?.[pane.key]) && (!pane.imageSrc || isViewLoading)"
        loading-label="Loading compare view..."
        :alt="pane.title"
        :active-operation="activeOperation"
        placeholder="Compare preview"
        :annotations="[]"
        :corner-info="compareTab?.compareCornerInfos?.[pane.key] ?? compareTab?.cornerInfo ?? emptyCornerInfo"
        :measurements="[]"
        :scale-bar="compareTab?.compareScaleBars?.[pane.key] ?? null"
        :show-corner-info="compareTab?.showCornerInfo !== false"
        :show-scale-bar="compareTab?.showScaleBar !== false"
        :orientation="compareTab?.compareOrientations?.[pane.key] ?? compareTab?.orientation ?? emptyOrientationInfo"
        @click-viewport="emitActiveViewportChange"
        @hover-viewport-change="emit('hoverViewportChange', $event)"
        @wheel-viewport="emit('viewportWheel', $event)"
        @pointer-down="handlePointerDown"
        @pointer-move="handlePointerMove"
        @pointer-up="handlePointerUp"
        @pointer-cancel="handlePointerCancel"
        @pointer-leave="() => {}"
      />
    </div>
  </section>
</template>

<style scoped>
.mobile-compare-viewport {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #02050a;
  padding: 6px;
  touch-action: none;
}

.mobile-compare-viewport__pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: #02050a;
}

.mobile-compare-viewport__pane--active {
  border-color: color-mix(in srgb, var(--theme-accent) 76%, white);
}

.mobile-compare-viewport__pane-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 5px 7px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 60%, transparent);
  background: rgba(7, 12, 19, 0.84);
}

.mobile-compare-viewport__badge {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 900;
}

.mobile-compare-viewport__title,
.mobile-compare-viewport__slice {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-compare-viewport__title {
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 900;
}

.mobile-compare-viewport__slice {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
}

.mobile-compare-viewport :deep(.mobile-compare-viewport__stage) {
  border: 0 !important;
  border-radius: 0 !important;
  background: #02050a !important;
}

.mobile-compare-viewport :deep(.viewer-viewport--active) {
  border-color: transparent !important;
  box-shadow: none !important;
  outline: 0 !important;
}

.mobile-compare-viewport :deep(.mobile-compare-viewport__image) {
  user-select: none;
  -webkit-user-drag: none;
}

@media (orientation: landscape) {
  .mobile-compare-viewport {
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
