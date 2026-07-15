<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES, type ViewOperationType } from '@shared/viewerConstants'
import ViewerCanvasStage from '../../components/viewer/views/ViewerCanvasStage.vue'
import { useViewerWorkspacePointer } from '../../composables/measurements/useViewerWorkspacePointer'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  AnnotationSize,
  CompareStackPaneKey,
  CornerInfo,
  MeasurementDraft,
  MeasurementDraftPoint,
  MeasurementToolType,
  ViewerTabItem,
  WorkspaceReadyPayload
} from '../../types/viewer'
import {
  COMPARE_STACK_PANE_KEYS,
  COMPARE_STACK_SOURCE_PANE_KEY,
  createComparePaneRecord,
  createEmptyCornerInfo,
  createEmptyOrientationInfo,
  isCompareStackPaneKey
} from '../../composables/workspace/views/viewerWorkspaceTabs'
import {
  classifyMobileTwoFingerGesture,
  createMobileViewportDragMoveQueue,
  getMobileGestureCenter,
  getMobileGestureDistance,
  type MobileTwoFingerGestureMode,
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
  annotationPointerCancel?: (event: PointerEvent) => boolean
  annotationPointerDown?: (event: PointerEvent, viewportKey: string) => boolean
  annotationPointerLeave?: (viewportKey: string) => void
  annotationPointerMove?: (event: PointerEvent) => boolean
  annotationPointerUp?: (event: PointerEvent) => boolean
  getAnnotations?: (viewportKey: string) => AnnotationOverlay[]
  getDraftAnnotation?: (viewportKey: string) => AnnotationDraft | null
  isViewLoading: boolean
  scrollThreshold?: number
}>(), {
  getAnnotations: () => [],
  getDraftAnnotation: () => null,
  scrollThreshold: 28
})

const emit = defineEmits<{
  activeViewportChange: [viewportKey: CompareStackPaneKey]
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null; row?: number | null; col?: number | null }]
  measurementCreate: [payload: { viewportKey: string; toolType: MeasurementToolType; points: MeasurementDraftPoint[]; measurementId?: string; labelLines?: string[] }]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: AnnotationSize }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const activeTabRef = computed(() => props.activeTab)
const activeOperationRef = computed(() => props.activeOperation)
const viewportHostRef = ref<HTMLElement | null>(null)
const activePointers = new Map<number, PointerPoint>()
const workspacePointerIds = new Set<number>()
const emptyCornerInfo: CornerInfo = createEmptyCornerInfo()
const emptyOrientationInfo = createEmptyOrientationInfo()

let activeDragOperation: ViewOperationType | null = null
let activeDragViewportKey: CompareStackPaneKey | null = null
let lastPrimaryPoint: PointerPoint | null = null
let scrollAccumulator = 0
let lastPinchDistance = 0
let lastPinchCenter: PointerPoint | null = null
let initialPinchDistance = 0
let initialPinchCenter: PointerPoint | null = null
let pinchGestureMode: MobileTwoFingerGestureMode = 'pending'
const pinchPointerMoveCounts = new Map<number, number>()
let isPinching = false
let totalDragDeltaX = 0
let totalDragDeltaY = 0
let totalPinchZoomDeltaY = 0

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

function createMeasurementId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mobile-measure-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
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
  getDraftMeasurementMode,
  handleViewportPointerCancel,
  handleViewportPointerDown,
  handleViewportPointerLeave,
  handleViewportPointerMove,
  handleViewportPointerUp,
  viewportCursorClasses
} = useViewerWorkspacePointer({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitActiveViewportChange: emitActiveViewportChange,
  emitOperationChange: () => {},
  emitMeasurementDraft: () => {},
  emitMeasurementCreate,
  emitMeasurementDelete: () => {},
  emitMtfCommit: () => {},
  emitMtfDelete: () => {},
  emitMtfSelect: () => {},
  emitMprCrosshair: () => {},
  emitViewportDrag: (payload) => emit('viewportDrag', payload),
  getCommittedMeasurements: (viewportKey) => compareTab.value?.viewportMeasurements?.[viewportKey] ?? [],
  getMtfItems: () => []
})

function getDraftMeasurement(viewportKey: CompareStackPaneKey): MeasurementDraft | null {
  return draftMeasurements.value[viewportKey] ?? null
}

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

function isMeasureOperation(): boolean {
  return normalizeOperation(props.activeOperation).startsWith('measure:')
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
  totalDragDeltaX = 0
  totalDragDeltaY = 0
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
  totalDragDeltaX = 0
  totalDragDeltaY = 0
}

function beginPinch(): void {
  cleanupPointerInteractions()
  workspacePointerIds.clear()
  endDrag()
  isPinching = true
  lastPinchDistance = getPinchDistance()
  lastPinchCenter = getPinchCenter()
  initialPinchDistance = lastPinchDistance
  initialPinchCenter = lastPinchCenter
  pinchGestureMode = 'pending'
  pinchPointerMoveCounts.clear()
  totalPinchZoomDeltaY = 0
}

function endPinch(): void {
  if (!isPinching) {
    return
  }
  flushPendingDragMoves()
  if (pinchGestureMode === 'zoom') {
    emitViewportDragEnd(VIEW_OPERATION_TYPES.zoom, activeViewport.value)
  }
  isPinching = false
  lastPinchDistance = 0
  lastPinchCenter = null
  initialPinchDistance = 0
  initialPinchCenter = null
  pinchGestureMode = 'pending'
  pinchPointerMoveCounts.clear()
  totalPinchZoomDeltaY = 0
}

function handlePointerDown(event: PointerEvent, viewportKey: string): void {
  if (!isCompareStackPaneKey(viewportKey)) {
    return
  }
  event.preventDefault()
  if (props.annotationPointerDown?.(event, viewportKey)) {
    return
  }
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  emit('activeViewportChange', viewportKey)
  if (isMeasureOperation() && event.isPrimary && event.button === 0) {
    workspacePointerIds.add(event.pointerId)
    handleViewportPointerDown(event, viewportKey)
    return
  }
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
    deltaY: sliceDelta,
    exact: true
  })
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
    const nextCenter = getPinchCenter()
    if (!nextCenter || !initialPinchCenter) {
      return
    }
    if (pinchGestureMode === 'pending') {
      const pointerMoveCount = (pinchPointerMoveCounts.get(event.pointerId) ?? 0) + 1
      pinchPointerMoveCounts.set(event.pointerId, pointerMoveCount)
      if (pinchPointerMoveCounts.size < 2 && pointerMoveCount < 2) {
        return
      }
      pinchGestureMode = classifyMobileTwoFingerGesture({
        initialCenter: initialPinchCenter,
        initialDistance: initialPinchDistance,
        currentCenter: nextCenter,
        currentDistance: nextDistance
      })
      if (pinchGestureMode === 'zoom') {
        emitViewportDragStart(VIEW_OPERATION_TYPES.zoom, activeViewport.value)
      }
    }
    if (pinchGestureMode === 'zoom') {
      totalPinchZoomDeltaY = -(nextDistance - initialPinchDistance)
      emitViewportDragMove(0, totalPinchZoomDeltaY, VIEW_OPERATION_TYPES.zoom, activeViewport.value)
    } else if (pinchGestureMode === 'scroll' && lastPinchCenter) {
      handleScrollDrag(nextCenter.y - lastPinchCenter.y, activeViewport.value)
    }
    lastPinchDistance = nextDistance
    lastPinchCenter = nextCenter
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
  event.preventDefault()
  if (props.annotationPointerCancel?.(event)) {
    return
  }
  if (workspacePointerIds.delete(event.pointerId)) {
    handleViewportPointerCancel(event)
    return
  }
  activePointers.delete(event.pointerId)
  if (activePointers.size === 0) {
    endPinch()
    endDrag()
  }
}

function handlePointerLeave(viewportKey: string): void {
  props.annotationPointerLeave?.(viewportKey)
  handleViewportPointerLeave(viewportKey)
}

onMounted(() => {
  void nextTick(emitWorkspaceReady)
})

onBeforeUnmount(() => {
  activePointers.clear()
  workspacePointerIds.clear()
  totalDragDeltaX = 0
  totalDragDeltaY = 0
  initialPinchDistance = 0
  initialPinchCenter = null
  pinchGestureMode = 'pending'
  totalPinchZoomDeltaY = 0
  cancelPendingDragMoves()
  endPinch()
  endDrag()
  cleanupPointerInteractions()
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
        compact-loading
        :render-surface-active="true"
        :image-src="pane.imageSrc"
        :is-loading="Boolean(compareTab?.compareViewIds?.[pane.key]) && (!pane.imageSrc || isViewLoading)"
        loading-label="Loading compare view..."
        :alt="pane.title"
        :active-operation="activeOperation"
        :cursor-class="viewportCursorClasses[pane.key] ?? ''"
        placeholder="Compare preview"
        :annotations="getAnnotations(pane.key)"
        :corner-info="compareTab?.compareCornerInfos?.[pane.key] ?? compareTab?.cornerInfo ?? emptyCornerInfo"
        :draft-annotation="getDraftAnnotation(pane.key)"
        :draft-measurement-mode="getDraftMeasurementMode(pane.key)"
        :draft-measurement="getDraftMeasurement(pane.key)"
        :measurements="compareTab?.viewportMeasurements?.[pane.key] ?? []"
        :scale-bar="compareTab?.compareScaleBars?.[pane.key] ?? null"
        :pseudocolor-preset="compareTab?.comparePseudocolorPresets?.[pane.key] ?? compareTab?.pseudocolorPreset ?? null"
        :pseudocolor-window-info="compareTab?.compareCurrentWindowInfos?.[pane.key] ?? compareTab?.compareInitialWindowInfos?.[pane.key] ?? null"
        :show-corner-info="compareTab?.showCornerInfo !== false"
        :show-scale-bar="compareTab?.showScaleBar !== false"
        :show-pseudocolor-bar="compareTab?.showPseudocolorBar !== false"
        :orientation="compareTab?.compareOrientations?.[pane.key] ?? compareTab?.orientation ?? emptyOrientationInfo"
        :viewport-transform="compareTab?.compareTransformStates?.[pane.key] ?? compareTab?.transformState ?? null"
        @click-viewport="emitActiveViewportChange"
        @copy-annotation="emit('copyAnnotation', $event)"
        @delete-annotation="emit('deleteAnnotation', $event)"
        @hover-viewport-change="emit('hoverViewportChange', $event)"
        @wheel-viewport="emit('viewportWheel', $event)"
        @pointer-down="handlePointerDown"
        @pointer-move="handlePointerMove"
        @pointer-up="handlePointerUp"
        @pointer-cancel="handlePointerCancel"
        @pointer-leave="handlePointerLeave"
        @update-annotation-color="emit('updateAnnotationColor', $event)"
        @update-annotation-size="emit('updateAnnotationSize', $event)"
        @update-annotation-text="emit('updateAnnotationText', $event)"
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
