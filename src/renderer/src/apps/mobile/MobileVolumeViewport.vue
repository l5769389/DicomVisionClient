<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES, type ViewOperationType } from '@shared/viewerConstants'
import VolumeView from '../../components/viewer/views/VolumeView.vue'
import type { MeasurementDraft, MeasurementDraftPoint, ViewerTabItem, VolumeClipMode, WorkspaceReadyPayload } from '../../types/viewer'
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

type ViewportCanvasPoint = {
  x: number
  y: number
  canvasX: number
  canvasY: number
  canvasWidth: number
  canvasHeight: number
}

const props = defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
}>()

const emit = defineEmits<{
  activeViewportChange: [viewportKey: string]
  viewportDrag: [payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'start' | 'move' | 'end'
    viewportKey: string
    canvasX?: number
    canvasY?: number
    canvasWidth?: number
    canvasHeight?: number
    interactionId?: string
  }]
  volumeClip: [payload: { viewportKey: string; mode: VolumeClipMode; points: MeasurementDraftPoint[] }]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = ref<HTMLElement | null>(null)
const volumeTab = computed(() => (props.activeTab?.viewType === '3D' ? props.activeTab : null))
const clipDraft = ref<MeasurementDraft | null>(null)
const activePointers = new Map<number, PointerPoint>()

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
let activeRotate3dInteractionId: string | null = null
let activeClipMode: VolumeClipMode | null = null

const VOLUME_CLIP_MIN_POLYGON_AREA = 0.0008
const VOLUME_CLIP_MAX_POINTS = 240
const VOLUME_CLIP_SIMPLIFY_EPSILON = 0.0025

function getPolygonArea(points: MeasurementDraftPoint[]): number {
  if (points.length < 3) {
    return 0
  }
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!
    const nextPoint = points[(index + 1) % points.length]!
    area += point.x * nextPoint.y - nextPoint.x * point.y
  }
  return Math.abs(area) / 2
}

function areClipPointsClose(first: MeasurementDraftPoint, second: MeasurementDraftPoint): boolean {
  return Math.hypot(first.x - second.x, first.y - second.y) < 0.006
}

function getPointSegmentDistance(point: MeasurementDraftPoint, start: MeasurementDraftPoint, end: MeasurementDraftPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

function simplifyClipPolyline(points: MeasurementDraftPoint[], epsilon: number): MeasurementDraftPoint[] {
  if (points.length <= 2) {
    return points
  }

  let farthestIndex = -1
  let farthestDistance = 0
  const start = points[0]!
  const end = points[points.length - 1]!
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = getPointSegmentDistance(points[index]!, start, end)
    if (distance > farthestDistance) {
      farthestDistance = distance
      farthestIndex = index
    }
  }

  if (farthestDistance <= epsilon || farthestIndex < 0) {
    return [start, end]
  }

  const left = simplifyClipPolyline(points.slice(0, farthestIndex + 1), epsilon)
  const right = simplifyClipPolyline(points.slice(farthestIndex), epsilon)
  return [...left.slice(0, -1), ...right]
}

function capClipPoints(points: MeasurementDraftPoint[], maxPoints: number): MeasurementDraftPoint[] {
  if (points.length <= maxPoints) {
    return points
  }
  const capped: MeasurementDraftPoint[] = []
  const lastIndex = points.length - 1
  for (let index = 0; index < maxPoints; index += 1) {
    capped.push(points[Math.round((index * lastIndex) / (maxPoints - 1))]!)
  }
  return capped
}

function simplifyClipPoints(points: MeasurementDraftPoint[]): MeasurementDraftPoint[] {
  if (points.length <= 3) {
    return points
  }
  const firstPoint = points[0]!
  const lastPoint = points[points.length - 1]!
  const openPoints = areClipPointsClose(firstPoint, lastPoint) ? points.slice(0, -1) : points
  const simplifiedPoints = simplifyClipPolyline(openPoints, VOLUME_CLIP_SIMPLIFY_EPSILON)
  const safePoints = simplifiedPoints.length >= 3 ? simplifiedPoints : openPoints.slice(0, 3)
  return capClipPoints(safePoints, VOLUME_CLIP_MAX_POINTS)
}

function finalizeClipPoints(points: MeasurementDraftPoint[]): MeasurementDraftPoint[] {
  if (points.length < 3) {
    return []
  }
  const finalizedPoints = simplifyClipPoints(points.map((point) => ({
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y))
  })))
  if (finalizedPoints.length < 3) {
    return []
  }
  const firstPoint = finalizedPoints[0]!
  const lastPoint = finalizedPoints[finalizedPoints.length - 1]!
  if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
    finalizedPoints.push({ ...firstPoint })
  }
  if (getPolygonArea(finalizedPoints) < VOLUME_CLIP_MIN_POLYGON_AREA) {
    return []
  }
  return finalizedPoints
}

const dragMoveQueue = createMobileViewportDragMoveQueue<'volume'>((move: MobileViewportDragMove<'volume'>) => {
  const payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'move'
    viewportKey: 'volume'
    canvasX?: number
    canvasY?: number
    canvasWidth?: number
    canvasHeight?: number
    interactionId?: string
  } = {
    deltaX: move.deltaX,
    deltaY: move.deltaY,
    opType: move.opType,
    phase: 'move',
    viewportKey: move.viewportKey
  }
  if (
    move.canvasX != null &&
    move.canvasY != null &&
    move.canvasWidth != null &&
    move.canvasHeight != null
  ) {
    payload.canvasX = move.canvasX
    payload.canvasY = move.canvasY
    payload.canvasWidth = move.canvasWidth
    payload.canvasHeight = move.canvasHeight
  }
  if (move.interactionId) {
    payload.interactionId = move.interactionId
  }
  emit('viewportDrag', payload)
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

function getVolumeClipMode(): VolumeClipMode | null {
  const operation = normalizeOperation(props.activeOperation)
  if (operation === 'volumeClip:inside') {
    return 'inside'
  }
  if (operation === 'volumeClip:outside') {
    return 'outside'
  }
  return null
}

function getPoint(event: PointerEvent): PointerPoint {
  return {
    x: event.clientX,
    y: event.clientY
  }
}

function getVolumeViewportElement(): HTMLElement | null {
  const host = viewportHostRef.value
  return host?.querySelector<HTMLElement>('[data-viewport-key="volume"]') ?? host
}

function getCanvasPoint(point: PointerPoint): ViewportCanvasPoint | null {
  const element = getVolumeViewportElement()
  const rect = element?.getBoundingClientRect()
  if (!rect?.width || !rect.height) {
    return null
  }

  const canvasX = point.x - rect.left
  const canvasY = point.y - rect.top
  return {
    x: Math.max(0, Math.min(1, canvasX / rect.width)),
    y: Math.max(0, Math.min(1, canvasY / rect.height)),
    canvasX,
    canvasY,
    canvasWidth: rect.width,
    canvasHeight: rect.height
  }
}

function getNormalizedClipPoint(point: PointerPoint): MeasurementDraftPoint | null {
  const canvasPoint = getCanvasPoint(point)
  if (!canvasPoint) {
    return null
  }
  return {
    x: canvasPoint.x,
    y: canvasPoint.y
  }
}

function clearClipDraft(): void {
  clipDraft.value = null
  activeClipMode = null
}

function appendClipPoint(point: PointerPoint): MeasurementDraftPoint[] {
  const normalizedPoint = getNormalizedClipPoint(point)
  if (!normalizedPoint) {
    return clipDraft.value?.points ?? []
  }
  const currentPoints = clipDraft.value?.points ?? []
  const lastPoint = currentPoints[currentPoints.length - 1]
  if (lastPoint && Math.hypot(normalizedPoint.x - lastPoint.x, normalizedPoint.y - lastPoint.y) < 0.003) {
    return currentPoints
  }
  const points = [...currentPoints, normalizedPoint]
  clipDraft.value = {
    toolType: 'freeform',
    points
  }
  return points
}

function beginClip(point: PointerPoint): boolean {
  const mode = getVolumeClipMode()
  if (!mode) {
    return false
  }
  activeClipMode = mode
  const normalizedPoint = getNormalizedClipPoint(point)
  clipDraft.value = normalizedPoint
    ? {
        toolType: 'freeform',
        points: [normalizedPoint]
      }
    : null
  return true
}

function finishClip(point: PointerPoint): boolean {
  if (!activeClipMode) {
    return false
  }
  const mode = activeClipMode
  const points = appendClipPoint(point)
  const finalizedPoints = finalizeClipPoints(points)
  if (finalizedPoints.length >= 3) {
    emit('volumeClip', {
      viewportKey: 'volume',
      mode,
      points: finalizedPoints
    })
  }
  clearClipDraft()
  return true
}

function createRotate3dInteractionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `rotate3d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getPinchDistance(): number {
  return getMobileGestureDistance(Array.from(activePointers.values()))
}

function getPinchCenter(): PointerPoint | null {
  return getMobileGestureCenter(Array.from(activePointers.values()))
}

function refreshPinchBaseline(): void {
  lastPinchDistance = getPinchDistance()
  lastPinchCenter = getPinchCenter()
}

function getSingleActivePointerPoint(): PointerPoint | null {
  if (activePointers.size !== 1) {
    return null
  }
  return Array.from(activePointers.values())[0] ?? null
}

function resumeSinglePointerDrag(): boolean {
  const point = getSingleActivePointerPoint()
  if (!point) {
    return false
  }
  beginDrag(resolveDragOperation(), point)
  return true
}

function emitViewportDragStart(opType: ViewOperationType, point?: PointerPoint | null): void {
  const canvasPoint = opType === VIEW_OPERATION_TYPES.rotate3d && point ? getCanvasPoint(point) : null
  const payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'start'
    viewportKey: 'volume'
    canvasX?: number
    canvasY?: number
    canvasWidth?: number
    canvasHeight?: number
    interactionId?: string
  } = {
    deltaX: canvasPoint?.x ?? 0,
    deltaY: canvasPoint?.y ?? 0,
    opType,
    phase: 'start',
    viewportKey: 'volume'
  }
  if (canvasPoint) {
    payload.canvasX = canvasPoint.canvasX
    payload.canvasY = canvasPoint.canvasY
    payload.canvasWidth = canvasPoint.canvasWidth
    payload.canvasHeight = canvasPoint.canvasHeight
  }
  if (opType === VIEW_OPERATION_TYPES.rotate3d && activeRotate3dInteractionId) {
    payload.interactionId = activeRotate3dInteractionId
  }
  emit('viewportDrag', payload)
}

function emitViewportDragEnd(opType: ViewOperationType, point?: PointerPoint | null): void {
  const canvasPoint = opType === VIEW_OPERATION_TYPES.rotate3d && point ? getCanvasPoint(point) : null
  const payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'end'
    viewportKey: 'volume'
    canvasX?: number
    canvasY?: number
    canvasWidth?: number
    canvasHeight?: number
    interactionId?: string
  } = {
    deltaX: canvasPoint?.x ?? 0,
    deltaY: canvasPoint?.y ?? 0,
    opType,
    phase: 'end',
    viewportKey: 'volume'
  }
  if (canvasPoint) {
    payload.canvasX = canvasPoint.canvasX
    payload.canvasY = canvasPoint.canvasY
    payload.canvasWidth = canvasPoint.canvasWidth
    payload.canvasHeight = canvasPoint.canvasHeight
  }
  if (opType === VIEW_OPERATION_TYPES.rotate3d && activeRotate3dInteractionId) {
    payload.interactionId = activeRotate3dInteractionId
  }
  emit('viewportDrag', payload)
}

function emitViewportDragMove(deltaX: number, deltaY: number, opType: ViewOperationType, point?: PointerPoint | null): void {
  if (opType === VIEW_OPERATION_TYPES.rotate3d && point) {
    const canvasPoint = getCanvasPoint(point)
    if (canvasPoint) {
      dragMoveQueue.push({
        deltaX: canvasPoint.x,
        deltaY: canvasPoint.y,
        opType,
        viewportKey: 'volume',
        canvasX: canvasPoint.canvasX,
        canvasY: canvasPoint.canvasY,
        canvasWidth: canvasPoint.canvasWidth,
        canvasHeight: canvasPoint.canvasHeight,
        interactionId: activeRotate3dInteractionId ?? undefined,
        force: true
      })
      return
    }
  }

  dragMoveQueue.push({ deltaX, deltaY, opType, viewportKey: 'volume' })
}

function flushPendingDragMoves(): void {
  dragMoveQueue.flush()
}

function cancelPendingDragMoves(): void {
  dragMoveQueue.cancel()
}

function beginDrag(operation: ViewOperationType, point: PointerPoint): void {
  activeDragOperation = operation
  activeRotate3dInteractionId = operation === VIEW_OPERATION_TYPES.rotate3d ? createRotate3dInteractionId() : null
  lastPrimaryPoint = point
  totalDragDeltaX = 0
  totalDragDeltaY = 0
  emitViewportDragStart(operation, point)
}

function endDrag(): void {
  flushPendingDragMoves()
  if (activeDragOperation) {
    emitViewportDragEnd(activeDragOperation, lastPrimaryPoint)
  }
  activeDragOperation = null
  activeRotate3dInteractionId = null
  lastPrimaryPoint = null
  totalDragDeltaX = 0
  totalDragDeltaY = 0
}

function beginPinch(): void {
  endDrag()
  isPinching = true
  refreshPinchBaseline()
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
  const point = getPoint(event)
  activePointers.set(event.pointerId, point)
  if (activeClipMode) {
    if (activePointers.size >= 2) {
      clearClipDraft()
    }
    return
  }
  if (activePointers.size === 1 && beginClip(point)) {
    return
  }
  if (activePointers.size >= 2) {
    if (!isPinching) {
      beginPinch()
    } else {
      refreshPinchBaseline()
    }
    return
  }
  beginDrag(resolveDragOperation(), point)
}

function handlePointerMove(event: PointerEvent): void {
  const previousPoint = activePointers.get(event.pointerId)
  if (!previousPoint) {
    return
  }
  event.preventDefault()
  const nextPoint = getPoint(event)
  activePointers.set(event.pointerId, nextPoint)

  if (activeClipMode) {
    if (activePointers.size >= 2) {
      clearClipDraft()
      return
    }
    appendClipPoint(nextPoint)
    return
  }

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
    emitViewportDragMove(totalDragDeltaX, totalDragDeltaY, activeDragOperation, nextPoint)
  }
}

function handlePointerUp(event: PointerEvent): void {
  event.preventDefault()
  const releasePoint = getPoint(event)
  activePointers.delete(event.pointerId)
  if (activeClipMode) {
    if (activePointers.size === 0) {
      finishClip(releasePoint)
    }
    return
  }
  if (activePointers.size >= 2) {
    refreshPinchBaseline()
    return
  }
  if (isPinching) {
    endPinch()
    if (resumeSinglePointerDrag()) {
      return
    }
  }
  if (activePointers.size === 1) {
    const point = getSingleActivePointerPoint()
    if (point && !activeDragOperation) {
      beginDrag(resolveDragOperation(), point)
    } else {
      lastPrimaryPoint = point
    }
    return
  }
  if (activeDragOperation) {
    lastPrimaryPoint = releasePoint
    if (activeDragOperation === VIEW_OPERATION_TYPES.rotate3d) {
      emitViewportDragMove(0, 0, activeDragOperation, releasePoint)
    }
  }
  endDrag()
}

function handlePointerCancel(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  if (activeClipMode) {
    clearClipDraft()
    return
  }
  if (activePointers.size >= 2) {
    refreshPinchBaseline()
    return
  }
  if (isPinching) {
    endPinch()
    if (resumeSinglePointerDrag()) {
      return
    }
  }
  if (activePointers.size === 1) {
    const point = getSingleActivePointerPoint()
    if (point && !activeDragOperation) {
      beginDrag(resolveDragOperation(), point)
    } else {
      lastPrimaryPoint = point
    }
    return
  }
  if (activePointers.size === 0) {
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
  clearClipDraft()
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
      :draft-measurement="clipDraft"
      :draft-measurement-mode="clipDraft ? 'draft' : null"
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
