<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES, type ViewOperationType } from '@shared/viewerConstants'
import ViewerCanvasStage from '../../components/viewer/views/ViewerCanvasStage.vue'
import { useViewerWorkspacePointer } from '../../composables/measurements/useViewerWorkspacePointer'
import type {
  CornerInfo,
  MeasurementDraft,
  MeasurementDraftPoint,
  MeasurementToolType,
  MprCrosshairInteractionPayload,
  MprViewportKey,
  ViewerTabItem,
  WorkspaceReadyPayload
} from '../../types/viewer'
import {
  createMobileViewportDragMoveQueue,
  getMobileGestureCenter,
  getMobileGestureDistance,
  type MobileViewportDragMove
} from './mobileViewportGesture'

const MPR_VIEWPORTS: Array<{ key: MprViewportKey; label: string }> = [
  { key: 'mpr-ax', label: 'AX' },
  { key: 'mpr-cor', label: 'COR' },
  { key: 'mpr-sag', label: 'SAG' }
]

type PointerPoint = {
  viewportKey: MprViewportKey
  x: number
  y: number
}

const props = withDefaults(defineProps<{
  activeMprViewportKey: MprViewportKey
  activeOperation: string
  activeTab: ViewerTabItem | null
  isViewLoading: boolean
  scrollThreshold?: number
  showReferenceThumbnails?: boolean
}>(), {
  scrollThreshold: 28,
  showReferenceThumbnails: true
})

const emit = defineEmits<{
  activeViewportChange: [viewportKey: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  measurementCreate: [payload: { viewportKey: string; toolType: MeasurementToolType; points: MeasurementDraftPoint[]; measurementId?: string; labelLines?: string[] }]
  mprCrosshair: [payload: MprCrosshairInteractionPayload]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [payload: { viewportKey: string; deltaY: number }]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = ref<HTMLElement | null>(null)
const activeTabRef = computed(() => props.activeTab)
const activeOperationRef = computed(() => props.activeOperation)
const activeScrollPointer = ref<{ pointerId: number; viewportKey: MprViewportKey; y: number; accumulator: number } | null>(null)
const activePointers = new Map<number, PointerPoint>()
const workspacePointerIds = new Set<number>()
const emptyCornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

let activeDragOperation: ViewOperationType | null = null
let activeDragViewportKey: MprViewportKey | null = null
let lastPrimaryPoint: PointerPoint | null = null
let totalDragDeltaX = 0
let totalDragDeltaY = 0
let totalPinchPanDeltaX = 0
let totalPinchPanDeltaY = 0
let totalPinchZoomDeltaY = 0
let lastPinchDistance = 0
let lastPinchCenter: PointerPoint | null = null
let isPinching = false
const dragMoveQueue = createMobileViewportDragMoveQueue<MprViewportKey>((move: MobileViewportDragMove<MprViewportKey>) => {
  emit('viewportDrag', {
    deltaX: move.deltaX,
    deltaY: move.deltaY,
    opType: move.opType,
    phase: 'move',
    viewportKey: move.viewportKey
  })
})

const mprTab = computed(() => (props.activeTab?.viewType === 'MPR' || props.activeTab?.viewType === '4D' ? props.activeTab : null))
const activeViewport = computed(() =>
  MPR_VIEWPORTS.some((viewport) => viewport.key === props.activeMprViewportKey) ? props.activeMprViewportKey : 'mpr-ax'
)
const referenceViewportKeys = computed(() =>
  MPR_VIEWPORTS.map((viewport) => viewport.key).filter((viewportKey) => viewportKey !== activeViewport.value)
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
  emitActiveViewportChange: emitActiveViewportChange,
  emitOperationChange: () => {},
  emitMeasurementDraft: () => {},
  emitMeasurementCreate,
  emitMeasurementDelete: () => {},
  emitMtfCommit: () => {},
  emitMtfDelete: () => {},
  emitMtfSelect: () => {},
  emitMprCrosshair: (payload) => emit('mprCrosshair', payload),
  emitViewportDrag: (payload) => emit('viewportDrag', payload),
  getCommittedMeasurements: (viewportKey) => mprTab.value?.viewportMeasurements?.[viewportKey] ?? [],
  getMtfItems: () => []
})

function emitActiveViewportChange(viewportKey: string): void {
  emit('activeViewportChange', viewportKey)
}

function getViewportElement(viewportKey: MprViewportKey): HTMLElement | null {
  return viewportHostRef.value?.querySelector<HTMLElement>(`[data-viewport-key="${viewportKey}"]`) ?? null
}

function emitWorkspaceReady(): void {
  const element = viewportHostRef.value
  emit('workspaceReady', {
    element,
    viewportKey: props.activeMprViewportKey,
    viewportElements: {
      'mpr-ax': getViewportElement('mpr-ax'),
      'mpr-cor': getViewportElement('mpr-cor'),
      'mpr-sag': getViewportElement('mpr-sag')
    }
  })
}

function getImage(viewportKey: MprViewportKey): string {
  return mprTab.value?.viewportImages?.[viewportKey] ?? ''
}

function getCornerInfo(viewportKey: MprViewportKey): CornerInfo {
  return mprTab.value?.viewportCornerInfos?.[viewportKey] ?? mprTab.value?.cornerInfo ?? emptyCornerInfo
}

function getSliceLabel(viewportKey: MprViewportKey): string {
  return mprTab.value?.viewportSliceLabels?.[viewportKey] ?? ''
}

function getDraftMeasurement(viewportKey: MprViewportKey): MeasurementDraft | null {
  return draftMeasurements.value[viewportKey] ?? null
}

function isViewportLoading(viewportKey: MprViewportKey): boolean {
  return Boolean(mprTab.value?.viewportViewIds?.[viewportKey]) && !getImage(viewportKey)
}

function handleViewportClick(viewportKey: string): void {
  emitActiveViewportChange(viewportKey)
}

function handleReferenceSwitch(event: Event, viewportKey: MprViewportKey): void {
  event.preventDefault()
  event.stopPropagation()
  emitActiveViewportChange(viewportKey)
}

function isReferenceViewport(viewportKey: MprViewportKey): boolean {
  return viewportKey !== activeViewport.value
}

function getReferenceIndex(viewportKey: MprViewportKey): number {
  return referenceViewportKeys.value.indexOf(viewportKey)
}

function normalizeOperation(operation: string): string {
  return operation.startsWith(STACK_OPERATION_PREFIX) ? operation.slice(STACK_OPERATION_PREFIX.length) : operation
}

function isScrollOperation(): boolean {
  return normalizeOperation(props.activeOperation) === VIEW_OPERATION_TYPES.scroll
}

function isMprViewportKey(viewportKey: string): viewportKey is MprViewportKey {
  return viewportKey === 'mpr-ax' || viewportKey === 'mpr-cor' || viewportKey === 'mpr-sag'
}

function getPoint(event: PointerEvent, viewportKey: MprViewportKey): PointerPoint {
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

function resolveDragOperation(): ViewOperationType | null {
  const operation = normalizeOperation(props.activeOperation)
  if (operation === VIEW_OPERATION_TYPES.pan || operation === VIEW_OPERATION_TYPES.window || operation === VIEW_OPERATION_TYPES.zoom) {
    return operation
  }
  return null
}

function emitViewportDragStart(opType: ViewOperationType, viewportKey: MprViewportKey): void {
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType,
    phase: 'start',
    viewportKey
  })
}

function emitViewportDragEnd(opType: ViewOperationType, viewportKey: MprViewportKey): void {
  emit('viewportDrag', {
    deltaX: 0,
    deltaY: 0,
    opType,
    phase: 'end',
    viewportKey
  })
}

function emitViewportDragMove(deltaX: number, deltaY: number, opType: ViewOperationType, viewportKey: MprViewportKey): void {
  dragMoveQueue.push({ deltaX, deltaY, opType, viewportKey })
}

function flushPendingDragMoves(): void {
  dragMoveQueue.flush()
}

function cancelPendingDragMoves(): void {
  dragMoveQueue.cancel()
}

function beginMobileDrag(operation: ViewOperationType, point: PointerPoint): void {
  activeDragOperation = operation
  activeDragViewportKey = point.viewportKey
  lastPrimaryPoint = point
  totalDragDeltaX = 0
  totalDragDeltaY = 0
  emitViewportDragStart(operation, point.viewportKey)
}

function endMobileDrag(): void {
  flushPendingDragMoves()
  if (activeDragOperation && activeDragViewportKey) {
    emitViewportDragEnd(activeDragOperation, activeDragViewportKey)
  }
  activeDragOperation = null
  activeDragViewportKey = null
  lastPrimaryPoint = null
  totalDragDeltaX = 0
  totalDragDeltaY = 0
}

function beginPinch(): void {
  activeScrollPointer.value = null
  cleanupPointerInteractions()
  workspacePointerIds.clear()
  endMobileDrag()
  isPinching = true
  lastPinchDistance = getPinchDistance()
  lastPinchCenter = getPinchCenter()
  totalPinchPanDeltaX = 0
  totalPinchPanDeltaY = 0
  totalPinchZoomDeltaY = 0
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
  totalPinchPanDeltaX = 0
  totalPinchPanDeltaY = 0
  totalPinchZoomDeltaY = 0
}

function handlePointerDown(event: PointerEvent, viewportKey: string): void {
  if (!isMprViewportKey(viewportKey)) {
    return
  }

  emitActiveViewportChange(viewportKey)
  const point = getPoint(event, viewportKey)
  activePointers.set(event.pointerId, point)

  if (activePointers.size >= 2) {
    event.preventDefault()
    beginPinch()
    return
  }

  if (isScrollOperation() && event.isPrimary && event.button === 0) {
    event.preventDefault()
    activeScrollPointer.value = {
      pointerId: event.pointerId,
      viewportKey,
      y: event.clientY,
      accumulator: 0
    }
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    return
  }

  const dragOperation = resolveDragOperation()
  if (dragOperation && event.isPrimary && event.button === 0) {
    event.preventDefault()
    beginMobileDrag(dragOperation, point)
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    return
  }

  workspacePointerIds.add(event.pointerId)
  handleViewportPointerDown(event, viewportKey)
}

function handlePointerMove(event: PointerEvent): void {
  const trackedPoint = activePointers.get(event.pointerId)
  if (trackedPoint) {
    activePointers.set(event.pointerId, getPoint(event, trackedPoint.viewportKey))
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
      emitViewportDragMove(
        totalPinchPanDeltaX,
        totalPinchPanDeltaY,
        VIEW_OPERATION_TYPES.pan,
        activeViewport.value
      )
    }
    lastPinchCenter = nextCenter
    if (deltaDistance) {
      totalPinchZoomDeltaY += -deltaDistance
      emitViewportDragMove(0, totalPinchZoomDeltaY, VIEW_OPERATION_TYPES.zoom, activeViewport.value)
    }
    return
  }

  const activeScroll = activeScrollPointer.value
  if (activeScroll?.pointerId === event.pointerId) {
    event.preventDefault()
    const deltaY = event.clientY - activeScroll.y
    activeScroll.y = event.clientY
    activeScroll.accumulator += deltaY
    const sliceDelta = Math.trunc(activeScroll.accumulator / props.scrollThreshold)
    if (sliceDelta) {
      activeScroll.accumulator -= sliceDelta * props.scrollThreshold
      emit('viewportWheel', {
        viewportKey: activeScroll.viewportKey,
        deltaY: sliceDelta
      })
    }
    return
  }

  if (activeDragOperation && activeDragViewportKey && trackedPoint) {
    event.preventDefault()
    const lastPoint = lastPrimaryPoint ?? trackedPoint
    const nextPoint = getPoint(event, activeDragViewportKey)
    lastPrimaryPoint = nextPoint
    totalDragDeltaX += nextPoint.x - lastPoint.x
    totalDragDeltaY += nextPoint.y - lastPoint.y
    emitViewportDragMove(
      totalDragDeltaX,
      totalDragDeltaY,
      activeDragOperation,
      activeDragViewportKey
    )
    return
  }

  if (workspacePointerIds.has(event.pointerId)) {
    handleViewportPointerMove(event)
  }
}

function handlePointerUp(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  if (activeScrollPointer.value?.pointerId === event.pointerId) {
    activeScrollPointer.value = null
    return
  }

  if (isPinching) {
    endPinch()
    if (activePointers.size === 1) {
      lastPrimaryPoint = Array.from(activePointers.values())[0] ?? null
    }
    return
  }

  if (activeDragOperation) {
    endMobileDrag()
    return
  }

  if (workspacePointerIds.delete(event.pointerId)) {
    handleViewportPointerUp(event)
  }
}

function handlePointerCancel(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  if (activeScrollPointer.value?.pointerId === event.pointerId) {
    activeScrollPointer.value = null
    return
  }

  if (isPinching) {
    endPinch()
    return
  }

  if (activeDragOperation) {
    endMobileDrag()
    return
  }

  if (workspacePointerIds.delete(event.pointerId)) {
    handleViewportPointerCancel(event)
  }
}

onMounted(() => {
  void nextTick(emitWorkspaceReady)
})

onBeforeUnmount(() => {
  activeScrollPointer.value = null
  activePointers.clear()
  workspacePointerIds.clear()
  totalDragDeltaX = 0
  totalDragDeltaY = 0
  totalPinchPanDeltaX = 0
  totalPinchPanDeltaY = 0
  totalPinchZoomDeltaY = 0
  cancelPendingDragMoves()
  endPinch()
  endMobileDrag()
  cleanupPointerInteractions()
})

watch(
  () => [mprTab.value?.key, props.activeMprViewportKey] as const,
  () => {
    void nextTick(emitWorkspaceReady)
  }
)
</script>

<template>
  <section ref="viewportHostRef" class="mobile-mpr-viewport" data-testid="mobile-mpr-viewport">
    <div
      v-for="viewport in MPR_VIEWPORTS"
      :key="viewport.key"
      class="mobile-mpr-viewport__pane"
      :class="{
        'mobile-mpr-viewport__pane--primary': !isReferenceViewport(viewport.key),
        'mobile-mpr-viewport__pane--reference': isReferenceViewport(viewport.key),
        'mobile-mpr-viewport__pane--reference-0': getReferenceIndex(viewport.key) === 0,
        'mobile-mpr-viewport__pane--reference-1': getReferenceIndex(viewport.key) === 1,
        'mobile-mpr-viewport__pane--hidden': isReferenceViewport(viewport.key) && !showReferenceThumbnails
      }"
      :data-testid="isReferenceViewport(viewport.key) ? 'mobile-mpr-reference' : 'mobile-mpr-primary'"
      :data-viewport-role="isReferenceViewport(viewport.key) ? 'reference' : 'primary'"
    >
      <ViewerCanvasStage
        :viewport-key="viewport.key"
        viewport-class="mobile-mpr-viewport__stage"
        image-class="mobile-mpr-viewport__image"
        :is-active="activeViewport === viewport.key"
        :render-surface-active="true"
        :image-src="getImage(viewport.key)"
        :is-loading="Boolean(mprTab?.viewportViewIds?.[viewport.key]) && (isViewportLoading(viewport.key) || isViewLoading)"
        :loading-label="`Loading ${viewport.label}...`"
        :alt="viewport.label"
        :active-operation="activeOperation"
        :annotations="[]"
        :corner-info="isReferenceViewport(viewport.key) ? emptyCornerInfo : getCornerInfo(viewport.key)"
        :cursor-class="viewportCursorClasses[viewport.key] ?? 'cursor-crosshair'"
        :draft-measurement-mode="getDraftMeasurementMode(viewport.key)"
        :draft-measurement="getDraftMeasurement(viewport.key)"
        :measurements="mprTab?.viewportMeasurements?.[viewport.key] ?? []"
        :mtf-draft-mode="getMtfDraftMode(viewport.key)"
        :mtf-draft="getMtfDraft(viewport.key)"
        :mtf-items="[]"
        :selected-mtf-id="null"
        :mpr-crosshair="mprTab?.viewportCrosshairs?.[viewport.key] ?? null"
        :mpr-frame="mprTab?.mprFrame ?? null"
        :mpr-plane="mprTab?.viewportPlanes?.[viewport.key] ?? null"
        :scale-bar="isReferenceViewport(viewport.key) ? null : mprTab?.viewportScaleBars?.[viewport.key] ?? null"
        :show-corner-info="!isReferenceViewport(viewport.key) && mprTab?.showCornerInfo !== false"
        :show-scale-bar="!isReferenceViewport(viewport.key) && mprTab?.showScaleBar !== false"
        :orientation="mprTab?.viewportOrientations?.[viewport.key] ?? mprTab?.orientation ?? { top: null, right: null, bottom: null, left: null, volumeQuaternion: null }"
        :placeholder="`${viewport.label} preview`"
        @click-viewport="handleViewportClick"
        @hover-viewport-change="emit('hoverViewportChange', $event)"
        @wheel-viewport="emit('viewportWheel', $event)"
        @pointer-down="handlePointerDown"
        @pointer-move="handlePointerMove"
        @pointer-up="handlePointerUp"
        @pointer-cancel="handlePointerCancel"
        @pointer-leave="handleViewportPointerLeave"
      />
      <button
        v-if="isReferenceViewport(viewport.key)"
        type="button"
        class="mobile-mpr-viewport__reference-switch"
        :aria-label="`Switch to ${viewport.label}`"
        :data-viewport-key="viewport.key"
        data-testid="mobile-mpr-reference-switch"
        @click="handleReferenceSwitch($event, viewport.key)"
        @mousedown="handleReferenceSwitch($event, viewport.key)"
        @pointerdown="handleReferenceSwitch($event, viewport.key)"
        @touchstart="handleReferenceSwitch($event, viewport.key)"
      >
        <span class="mobile-mpr-viewport__reference-label" aria-hidden="true">
          <strong>{{ viewport.label }}</strong>
          <span>{{ getSliceLabel(viewport.key) || '--' }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.mobile-mpr-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #02050a;
  touch-action: none;
  --mobile-mpr-reference-width: min(34vw, 154px);
  --mobile-mpr-reference-height: min(22dvh, 132px);
  --mobile-mpr-reference-gap: 8px;
  --mobile-mpr-reference-offset: 10px;
}

.mobile-mpr-viewport__pane {
  position: absolute;
  overflow: hidden;
  background: #02050a;
  margin: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: initial;
  appearance: none;
}

.mobile-mpr-viewport__pane--primary {
  inset: 0;
  z-index: 1;
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}

.mobile-mpr-viewport__pane--reference {
  right: var(--mobile-mpr-reference-offset);
  z-index: 3;
  width: var(--mobile-mpr-reference-width);
  height: var(--mobile-mpr-reference-height);
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 82%, transparent);
  border-radius: 8px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.44);
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}

.mobile-mpr-viewport__pane--reference-0 {
  top: var(--mobile-mpr-reference-offset);
}

.mobile-mpr-viewport__pane--reference-1 {
  top: calc(var(--mobile-mpr-reference-offset) + var(--mobile-mpr-reference-height) + var(--mobile-mpr-reference-gap));
}

.mobile-mpr-viewport__pane--hidden {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}

.mobile-mpr-viewport :deep(.mobile-mpr-viewport__stage) {
  border: 0 !important;
  border-radius: 0 !important;
  background: #02050a !important;
}

.mobile-mpr-viewport :deep(.viewer-viewport--active) {
  border-color: transparent !important;
  box-shadow: none !important;
  outline: 0 !important;
}

.mobile-mpr-viewport :deep(.mobile-mpr-viewport__image) {
  user-select: none;
  -webkit-user-drag: none;
}

.mobile-mpr-viewport__reference-switch {
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

.mobile-mpr-viewport__reference-label {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  pointer-events: none;
  color: #f7fbff;
  font-size: 10px;
  line-height: 1;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.9);
}

.mobile-mpr-viewport__reference-label strong,
.mobile-mpr-viewport__reference-label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-mpr-viewport__reference-label strong {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 900;
}

.mobile-mpr-viewport__reference-label span {
  min-width: 0;
  color: rgba(247, 251, 255, 0.82);
  font-weight: 800;
}

@media (orientation: landscape) and (max-height: 520px) {
  .mobile-mpr-viewport {
    --mobile-mpr-reference-width: min(20vw, 132px);
    --mobile-mpr-reference-height: min(38dvh, 112px);
    --mobile-mpr-reference-offset: 8px;
  }
}
</style>
