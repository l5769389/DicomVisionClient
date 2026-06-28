<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  STACK_OPERATION_PREFIX,
  type ViewOperationType,
  VIEW_OPERATION_TYPES
} from '@shared/viewerConstants'
import ViewerCanvasStage from '../../components/viewer/views/ViewerCanvasStage.vue'
import { isMeasurementToolType } from '../../composables/measurements/measurementToolRules'
import { useViewerWorkspacePointer } from '../../composables/measurements/useViewerWorkspacePointer'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  AnnotationSize,
  CornerInfo,
  MeasurementDraftPoint,
  MeasurementToolType,
  OrientationInfo,
  QaWaterAnalysis,
  ViewerMtfItem,
  ViewerTabItem,
  WorkspaceReadyPayload
} from '../../types/viewer'
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
  annotationPointerCancel?: (event: PointerEvent) => boolean
  annotationPointerDown?: (event: PointerEvent, viewportKey: string) => boolean
  annotationPointerLeave?: (viewportKey: string) => void
  annotationPointerMove?: (event: PointerEvent) => boolean
  annotationPointerUp?: (event: PointerEvent) => boolean
  annotations?: AnnotationOverlay[]
  draftAnnotation?: AnnotationDraft | null
  isViewLoading: boolean
  mtfItems?: ViewerMtfItem[]
  qaWaterAnalysis?: QaWaterAnalysis | null
  scrollThreshold?: number
  selectedMtfId?: string | null
}>(), {
  annotations: () => [],
  draftAnnotation: null,
  mtfItems: () => [],
  qaWaterAnalysis: null,
  scrollThreshold: 28
})

const emit = defineEmits<{
  activeViewportChange: [viewportKey: string]
  clearMtf: [payload?: { mtfId?: string | null }]
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedAnnotation: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteSelectedAnnotation: [viewportKey: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  measurementCreate: [payload: { viewportKey: string; toolType: MeasurementToolType; points: MeasurementDraftPoint[]; measurementId?: string; labelLines?: string[] }]
  measurementDelete: [payload: { viewportKey: string; measurementId: string }]
  mtfCommit: [payload: { viewportKey: string; points: MeasurementDraftPoint[]; mtfId?: string }]
  openMtfCurve: []
  selectMtf: [payload: { mtfId: string | null }]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: AnnotationSize }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = ref<HTMLElement | null>(null)
const activeTabRef = computed(() => props.activeTab)
const activeOperationRef = computed(() => props.activeOperation)
const activePointers = new Map<number, PointerPoint>()
const workspacePointerIds = new Set<number>()
const emptyCornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}
const emptyOrientationInfo: OrientationInfo = {
  top: null,
  right: null,
  bottom: null,
  left: null,
  volumeQuaternion: null
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

const dragMoveQueue = createMobileViewportDragMoveQueue<'single'>((move: MobileViewportDragMove<'single'>) => {
  emit('viewportDrag', {
    deltaX: move.deltaX,
    deltaY: move.deltaY,
    opType: move.opType,
    phase: 'move',
    viewportKey: move.viewportKey
  })
})

const stackTab = computed(() => (
  props.activeTab?.viewType === 'Stack' || props.activeTab?.viewType === 'PET' ? props.activeTab : null
))
const viewportPlaceholder = computed(() => (stackTab.value ? '移动端单视口预览' : '选择序列后打开 2D 视图'))

function createMeasurementId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
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
  copySelectedMeasurement,
  deleteSelectedMeasurement,
  draftMeasurements,
  getDraftMeasurementMode,
  getMtfDraft,
  getMtfDraftMode,
  handleViewportPointerCancel,
  handleViewportPointerDown,
  handleViewportPointerLeave,
  handleViewportPointerMove,
  handleViewportPointerUp,
  viewportCursorClasses
} = useViewerWorkspacePointer({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitActiveViewportChange: (viewportKey) => emit('activeViewportChange', viewportKey),
  emitOperationChange: () => {},
  emitMeasurementDraft: () => {},
  emitMeasurementCreate,
  emitMeasurementDelete: (payload) => emit('measurementDelete', payload),
  emitMtfCommit: (payload) => emit('mtfCommit', payload),
  emitMtfDelete: (payload) => emit('clearMtf', payload),
  emitMtfSelect: (payload) => emit('selectMtf', payload),
  emitMprCrosshair: () => {},
  emitViewportDrag: (payload) => emit('viewportDrag', payload),
  getCommittedMeasurements: () => stackTab.value?.measurements ?? [],
  getMtfItems: () => props.mtfItems ?? []
})

function getDraftMeasurement() {
  return draftMeasurements.value.single ?? null
}

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

function isMtfOperation(): boolean {
  const operation = normalizeOperation(props.activeOperation)
  return operation === 'mtf' || operation.startsWith('mtf:') || operation === 'qa:mtf' || operation.startsWith('qa:mtf')
}

function isWorkspacePointerOperation(): boolean {
  return isMeasureOperation() || isMtfOperation()
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
  cleanupPointerInteractions()
  workspacePointerIds.clear()
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
  if (props.annotationPointerDown?.(event, 'single')) {
    return
  }
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  emit('activeViewportChange', 'single')
  activePointers.set(event.pointerId, getPoint(event))
  if (activePointers.size >= 2) {
    beginPinch()
    return
  }
  if (isWorkspacePointerOperation() && event.isPrimary && event.button === 0) {
    workspacePointerIds.add(event.pointerId)
    handleViewportPointerDown(event, 'single')
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
    deltaY: sliceDelta,
    exact: true
  })
}

function handlePointerMove(event: PointerEvent): void {
  if (props.annotationPointerMove?.(event)) {
    return
  }
  const previousPoint = activePointers.get(event.pointerId)
  if (previousPoint) {
    activePointers.set(event.pointerId, getPoint(event))
  }

  if (activePointers.size >= 2) {
    event.preventDefault()
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

  if (workspacePointerIds.has(event.pointerId)) {
    handleViewportPointerMove(event)
    return
  }

  if (!previousPoint) {
    return
  }
  event.preventDefault()
  const nextPoint = getPoint(event)
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
  if (props.annotationPointerUp?.(event)) {
    return
  }
  activePointers.delete(event.pointerId)
  if (workspacePointerIds.delete(event.pointerId)) {
    handleViewportPointerUp(event)
    return
  }
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
  totalPinchPanDeltaX = 0
  totalPinchPanDeltaY = 0
  totalPinchZoomDeltaY = 0
  cancelPendingDragMoves()
  endPinch()
  endDrag()
  cleanupPointerInteractions()
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
    const draftMeasurement = getDraftMeasurement()
    if (draftMeasurement && draftMeasurement.toolType !== nextToolType) {
      cleanupPointerInteractions()
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
      compact-loading
      :render-surface-active="Boolean(stackTab)"
      :image-src="stackTab?.imageSrc ?? ''"
      :is-loading="Boolean(stackTab?.viewId) && (!stackTab?.imageSrc || isViewLoading)"
      :light-surface="stackTab?.viewType === 'PET'"
      :stage-surface-class="stackTab?.viewType === 'PET' ? 'viewer-stage-surface--white viewer-stage-surface--pet-standalone' : ''"
      loading-label="正在加载影像..."
      alt="2D"
      :active-operation="activeOperation"
      :placeholder="viewportPlaceholder"
      :cursor-class="viewportCursorClasses.single ?? ''"
      :annotations="annotations"
      :corner-info="stackTab?.cornerInfo ?? emptyCornerInfo"
      :draft-annotation="draftAnnotation"
      :draft-measurement-mode="getDraftMeasurementMode('single')"
      :draft-measurement="getDraftMeasurement()"
      :measurements="stackTab?.measurements ?? []"
      :mtf-draft-mode="getMtfDraftMode('single')"
      :mtf-draft="getMtfDraft('single')"
      :mtf-items="mtfItems"
      :qa-water-analysis="qaWaterAnalysis"
      :selected-mtf-id="selectedMtfId ?? null"
      :scale-bar="stackTab?.scaleBar ?? null"
      :pseudocolor-preset="stackTab?.pseudocolorPreset ?? null"
      :pseudocolor-window-info="stackTab?.currentWindowInfo ?? stackTab?.initialWindowInfo ?? null"
      :show-corner-info="stackTab?.showCornerInfo !== false"
      :show-scale-bar="stackTab?.showScaleBar !== false"
      :show-pseudocolor-bar="stackTab?.showPseudocolorBar !== false"
      :viewport-transform="stackTab?.transformState ?? null"
      :orientation="stackTab?.orientation ?? emptyOrientationInfo"
      @copy-annotation="emit('copyAnnotation', $event)"
      @copy-selected-mtf="emit('copySelectedMtf', $event)"
      @copy-selected-measurement="copySelectedMeasurement"
      @delete-annotation="emit('deleteAnnotation', $event)"
      @delete-selected-measurement="deleteSelectedMeasurement"
      @clear-mtf="emit('clearMtf')"
      @hover-viewport-change="emit('hoverViewportChange', $event)"
      @open-mtf-curve="emit('openMtfCurve')"
      @select-mtf="emit('selectMtf', $event)"
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
