import { ref, type Ref } from 'vue'
import throttle from 'lodash/throttle'
import { DRAG_ACTION_TYPES, STACK_DRAG_OPERATIONS, type ViewOperationType, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type {
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementDraftPoint,
  MeasurementOverlay,
  MeasurementToolType,
  MprCrosshairInteractionPayload,
  MprViewportKey,
  VolumeClipMode,
  ViewerMtfItem,
  ViewerTabItem
} from '../../types/viewer'
import {
  createMeasurementDraft,
  findHandleIndexAtPoint,
  isMeasurementHit,
  isValidMeasurement,
  resolveMeasurementPointerDownIntent,
  translateMeasurementPoints,
  updateEditedMeasurementPoints
} from './measurementGeometry'
import { createMtfInteractionController, type MtfInteractionState } from './mtfInteractionMachine'
import {
  findMtfHandleIndexAtPoint,
  resolveMtfPointerDownIntent
} from './mtfRoiGeometry'
import {
  buildRectRoiDraftPoints,
  editRectRoiDraftPoints,
  hasRectRoiDragExceededThreshold,
  moveRectRoiDraftPoints
} from './rectRoiPointerController'
import {
  createMeasurementInteractionController,
  resolveDraftMeasurementMode,
  type MeasurementInteractionState
} from './measurementInteractionMachine'
import {
  getFinalizedPointSequencePoints,
  isMeasurementToolType,
  isPointSequenceMeasurement
} from './measurementToolRules'
import { resolveMtfDraftMode } from './mtfInteractionMachine'
import {
  getTabViewportCrosshairGeometry,
  type CrosshairLineTarget
} from '../workspace/views/mprFrameGeometry'
import {
  resolveCrosshairHitTarget as resolveCrosshairHitTargetFromGeometry,
  type CrosshairHitTarget
} from './mprCrosshairPointerController'
import { createLatestFrameEmitter } from './viewportDragMoveScheduler'

interface PointerComposableOptions {
  activeOperation: Ref<string>
  activeTab: Ref<ViewerTabItem | null>
  emitActiveViewportChange: (viewportKey: string) => void
  emitOperationChange: (value: string) => void
  emitMeasurementDraft: (payload: {
    viewportKey: string
    toolType: MeasurementToolType
    phase: 'start' | 'move' | 'end'
    points: MeasurementDraftPoint[]
  }) => void
  emitMeasurementCreate: (payload: {
    viewportKey: string
    toolType: MeasurementToolType
    points: MeasurementDraftPoint[]
    measurementId?: string
    labelLines?: string[]
  }) => void
  emitMeasurementDelete: (payload: { viewportKey: string; measurementId: string }) => void
  emitMtfCommit: (payload: { viewportKey: string; points: MeasurementDraftPoint[]; mtfId?: string }) => void
  emitMtfDelete: (payload: { mtfId: string }) => void
  emitMtfSelect: (payload: { mtfId: string | null }) => void
  emitMprCrosshair: (payload: MprCrosshairInteractionPayload) => void
  emitVolumeClip?: (payload: {
    viewportKey: string
    mode: VolumeClipMode
    points: MeasurementDraftPoint[]
  }) => void
  emitViewportDrag: (payload: {
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
  }) => void
  getCommittedMeasurements: (viewportKey: string) => MeasurementOverlay[]
  getMtfItems: (viewportKey: string) => ViewerMtfItem[]
}

interface PointerComposableState {
  activeViewportKey: Ref<string>
  clearDrawingDrafts: () => void
  cleanupPointerInteractions: () => void
  copySelectedMeasurement: (viewportKey?: string) => boolean
  deleteSelectedMeasurement: (viewportKey?: string, measurementId?: string) => boolean
  copySelectedMtf: (viewportKey?: string) => boolean
  deleteSelectedMtf: (viewportKey?: string) => boolean
  draftMeasurements: Ref<Partial<Record<string, MeasurementDraft | null>>>
  finishPointSequenceMeasurement: (viewportKey?: string) => boolean
  getMtfDraft: (viewportKey: string) => { mtfId?: string; points: MeasurementDraftPoint[] } | null
  getMtfDraftMode: (viewportKey: string) => DraftMeasurementMode | null
  getDraftMeasurementMode: (viewportKey: string) => DraftMeasurementMode | null
  getViewportIdleCursorClass: (viewportKey: string) => string
  handleViewportPointerCancel: (event: PointerEvent) => void
  handleViewportPointerLeave: (viewportKey: string) => void
  handleViewportPointerDown: (event: PointerEvent, viewportKey: string) => void
  handleViewportPointerMove: (event: PointerEvent) => void
  handleViewportPointerUp: (event: PointerEvent) => void
  setActiveViewport: (viewportKey: string) => void
  stopViewportDrag: (pointerTarget?: EventTarget | null) => void
  updateDraftMeasurementLabelLines: (viewportKey: string, labelLines: string[]) => void
  viewportCursorClasses: Ref<Partial<Record<string, string>>>
}

interface BasicPointerContext {
  pointerTarget: HTMLElement
  viewportKey: string
}

interface ViewportCanvasPoint {
  x: number
  y: number
  canvasX: number
  canvasY: number
  canvasWidth: number
  canvasHeight: number
}

interface MeasurementPointerContext extends BasicPointerContext {
  imageElement: HTMLImageElement
  imageRect: DOMRect
  point: MeasurementDraftPoint
}

const DRAG_START_THRESHOLD = 3
const MPR_CROSSHAIR_THROTTLE_MS = 16
const MEASUREMENT_DRAFT_THROTTLE_MS = 30
const POINTER_BUTTON_LEFT = 0
const POINTER_BUTTON_RIGHT = 2
const POINT_SEQUENCE_DOUBLE_CLICK_MS = 420
const POINT_SEQUENCE_DOUBLE_CLICK_DISTANCE = 0.025
const POINT_SET_CLOSE_EPSILON = 0.0005
const VOLUME_CLIP_MIN_POLYGON_AREA = 0.0008
const VOLUME_CLIP_MAX_POINTS = 240
const VOLUME_CLIP_SIMPLIFY_EPSILON = 0.0025

function generateMeasurementId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `measurement-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function clampNormalizedPoint(point: MeasurementDraftPoint): MeasurementDraftPoint {
  return {
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y))
  }
}

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

function getPointSegmentDistance(
  point: MeasurementDraftPoint,
  start: MeasurementDraftPoint,
  end: MeasurementDraftPoint
): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

function simplifyVolumeClipPolyline(points: MeasurementDraftPoint[], epsilon: number): MeasurementDraftPoint[] {
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

  const left = simplifyVolumeClipPolyline(points.slice(0, farthestIndex + 1), epsilon)
  const right = simplifyVolumeClipPolyline(points.slice(farthestIndex), epsilon)
  return [...left.slice(0, -1), ...right]
}

function capVolumeClipPoints(points: MeasurementDraftPoint[], maxPoints: number): MeasurementDraftPoint[] {
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

function simplifyVolumeClipPoints(points: MeasurementDraftPoint[]): MeasurementDraftPoint[] {
  if (points.length <= 3) {
    return points
  }
  const firstPoint = points[0]!
  const lastPoint = points[points.length - 1]!
  const openPoints = areVolumeClipPointsClose(firstPoint, lastPoint) ? points.slice(0, -1) : points
  const simplifiedPoints = simplifyVolumeClipPolyline(openPoints, VOLUME_CLIP_SIMPLIFY_EPSILON)
  const safePoints = simplifiedPoints.length >= 3 ? simplifiedPoints : openPoints.slice(0, 3)
  return capVolumeClipPoints(safePoints, VOLUME_CLIP_MAX_POINTS)
}

function areVolumeClipPointsClose(first: MeasurementDraftPoint, second: MeasurementDraftPoint): boolean {
  return Math.hypot(first.x - second.x, first.y - second.y) < 0.006
}

function getFinalizedVolumeClipPoints(points: MeasurementDraftPoint[]): MeasurementDraftPoint[] {
  if (points.length < 3) {
    return []
  }
  const finalizedPoints = simplifyVolumeClipPoints(points.map(clampNormalizedPoint))
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

function offsetMeasurementPoints(points: MeasurementDraftPoint[], delta: number): MeasurementDraftPoint[] {
  const shiftedPoints = translateMeasurementPoints(points, delta, delta)

  const changed = shiftedPoints.some((point, index) => point.x !== points[index]?.x || point.y !== points[index]?.y)
  if (changed) {
    return shiftedPoints
  }

  return translateMeasurementPoints(points, -delta, -delta)
}

function arePointSetsClose(a: MeasurementDraftPoint[], b: MeasurementDraftPoint[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((point, index) => {
    const otherPoint = b[index]
    return (
      otherPoint != null &&
      Math.abs(point.x - otherPoint.x) < POINT_SET_CLOSE_EPSILON &&
      Math.abs(point.y - otherPoint.y) < POINT_SET_CLOSE_EPSILON
    )
  })
}

function replaceLastMeasurementPoint(points: MeasurementDraftPoint[], point: MeasurementDraftPoint): MeasurementDraftPoint[] {
  if (!points.length) {
    return [point]
  }
  return points.map((currentPoint, index) => (index === points.length - 1 ? point : currentPoint))
}

function isCapturedMeasurementInteraction(
  state: MeasurementInteractionState
): state is Exclude<MeasurementInteractionState, { kind: 'idle' } | { kind: 'selected'; viewportKey: string; measurementId: string }> {
  return (
    state.kind === 'creating' ||
    state.kind === 'move_pending' ||
    state.kind === 'moving' ||
    state.kind === 'editing_handle'
  )
}

function isCapturedMtfInteraction(
  state: MtfInteractionState
): state is Exclude<MtfInteractionState, { kind: 'idle' } | { kind: 'selected'; viewportKey: string; mtfId: string }> {
  return state.kind === 'creating' || state.kind === 'move_pending' || state.kind === 'moving' || state.kind === 'editing_handle'
}

type ActiveMeasurementEditState = Extract<
  MeasurementInteractionState,
  { kind: 'creating' } | { kind: 'moving' } | { kind: 'editing_handle' }
>

interface MtfDraft {
  mtfId?: string
  points: MeasurementDraftPoint[]
}

interface PointSequenceDraftResolution {
  draft: MeasurementDraft
  points: MeasurementDraftPoint[]
  viewportKey: string
}

export function useViewerWorkspacePointer(options: PointerComposableOptions): PointerComposableState {
  const measurementInteractionController = createMeasurementInteractionController()
  const mtfInteractionController = createMtfInteractionController()
  const activeViewportKey = ref<string>('mpr-ax')
  const crosshairPointerViewportKey = ref('')
  const dragViewportKey = ref('')
  const dragOperationType = ref<ViewOperationType | null>(null)
  const draftMeasurements = ref<Partial<Record<string, MeasurementDraft | null>>>({})
  const mtfDrafts = ref<Partial<Record<string, MtfDraft | null>>>({})
  const viewportCursorClasses = ref<Partial<Record<string, string>>>({})
  const measurementInteraction = ref<MeasurementInteractionState>(measurementInteractionController.getState())
  const mtfInteraction = ref<MtfInteractionState>(mtfInteractionController.getState())
  const isCrosshairDragging = ref(false)
  const crosshairDragMode = ref<'move' | 'rotate'>('move')
  const crosshairRotationLine = ref<CrosshairLineTarget | null>(null)
  const isViewportDragging = ref(false)
  const volumeClipViewportKey = ref('')
  const volumeClipMode = ref<VolumeClipMode | null>(null)
  const activePointerId = ref<number | null>(null)

  let lastPointerX = 0
  let lastPointerY = 0
  let totalDeltaX = 0
  let totalDeltaY = 0
  let hasSentDragStart = false
  let dragStartNormalizedPoint: ViewportCanvasPoint | null = null
  let lastDragNormalizedPoint: ViewportCanvasPoint | null = null
  let activeDragInteractionId: string | null = null
  let lastPointSequenceClick: { viewportKey: string; toolType: MeasurementToolType; point: MeasurementDraftPoint; timeStamp: number } | null = null
  measurementInteractionController.subscribe((state) => {
    measurementInteraction.value = state
  })
  mtfInteractionController.subscribe((state) => {
    mtfInteraction.value = state
  })

  const emitViewportDragMoves = createLatestFrameEmitter<{
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'move'
    viewportKey: string
    canvasX?: number
    canvasY?: number
    canvasWidth?: number
    canvasHeight?: number
    interactionId?: string
  }>({
    emit: (payload) => {
      options.emitViewportDrag(payload)
    }
  })

  const emitThrottledCrosshairMove = throttle(
    (payload: {
      viewportKey: string
      x: number
      y: number
      canvasX?: number
      canvasY?: number
      canvasWidth?: number
      canvasHeight?: number
      mode?: 'move' | 'rotate'
      line?: CrosshairLineTarget
    }) => {
      options.emitMprCrosshair({
        viewportKey: payload.viewportKey,
        phase: DRAG_ACTION_TYPES.move,
        x: payload.x,
        y: payload.y,
        canvasX: payload.canvasX,
        canvasY: payload.canvasY,
        canvasWidth: payload.canvasWidth,
        canvasHeight: payload.canvasHeight,
        mode: payload.mode,
        line: payload.line
      })
    },
    MPR_CROSSHAIR_THROTTLE_MS,
    { leading: true, trailing: true }
  )

  const emitThrottledMeasurementDraft = throttle(
    (payload: { viewportKey: string; toolType: MeasurementToolType; points: MeasurementDraftPoint[] }) => {
      options.emitMeasurementDraft({
        viewportKey: payload.viewportKey,
        toolType: payload.toolType,
        phase: DRAG_ACTION_TYPES.move,
        points: payload.points
      })
    },
    MEASUREMENT_DRAFT_THROTTLE_MS,
    { leading: true, trailing: true }
  )

  // Pointer capture keeps drag/measurement lifecycle consistent even when the
  // cursor briefly leaves the image during a high-frequency interaction.
  function setPointerCapture(pointerTarget: HTMLElement, pointerId: number): void {
    pointerTarget.setPointerCapture(pointerId)
    activePointerId.value = pointerId
  }

  function releasePointerCapture(pointerTarget?: EventTarget | null): void {
    if (!(pointerTarget instanceof HTMLElement) || activePointerId.value == null) {
      activePointerId.value = null
      return
    }
    if (pointerTarget.hasPointerCapture(activePointerId.value)) {
      pointerTarget.releasePointerCapture(activePointerId.value)
    }
    activePointerId.value = null
  }

  function emitMeasurementDraftPhase(
    viewportKey: string,
    toolType: MeasurementToolType,
    phase: 'start' | 'move' | 'end',
    points: MeasurementDraftPoint[]
  ): void {
    options.emitMeasurementDraft({
      viewportKey,
      toolType,
      phase,
      points
    })
  }

  function setActiveViewport(viewportKey: string): void {
    activeViewportKey.value = viewportKey
    options.emitActiveViewportChange(viewportKey)
  }

  function setViewportCursor(viewportKey: string, cursorClass: string): void {
    viewportCursorClasses.value = {
      ...viewportCursorClasses.value,
      [viewportKey]: cursorClass
    }
  }

  function clearViewportCursor(viewportKey: string): void {
    const nextCursorClasses = { ...viewportCursorClasses.value }
    delete nextCursorClasses[viewportKey]
    viewportCursorClasses.value = nextCursorClasses
  }

  function getNormalizedOperation(): ViewOperationType | string {
    return options.activeOperation.value.startsWith('stack:')
      ? options.activeOperation.value.slice('stack:'.length).split(':')[0]
      : options.activeOperation.value.split(':')[0]
  }

  function getNormalizedOperationPath(): string {
    return options.activeOperation.value.startsWith('stack:')
      ? options.activeOperation.value.slice('stack:'.length)
      : options.activeOperation.value
  }

  function getMeasurementToolType(): MeasurementToolType | null {
    const normalized = getNormalizedOperationPath()
    const [toolKey, toolType] = normalized.split(':')
    if (toolKey !== 'measure') {
      return null
    }
    if (isMeasurementToolType(toolType)) {
      return toolType
    }
    return null
  }

  function getQaToolType(): string | null {
    const normalized = getNormalizedOperationPath()
    const [toolKey, toolType] = normalized.split(':')
    if (toolKey !== 'qa') {
      return null
    }
    return toolType || null
  }

  function isMprLikeViewType(viewType: ViewerTabItem['viewType'] | undefined): boolean {
    return viewType === 'MPR' || viewType === '4D'
  }

  function isStackLikeViewType(viewType: ViewerTabItem['viewType'] | undefined): boolean {
    return viewType === 'Stack' || viewType === 'PET' || viewType === 'CompareStack' || viewType === 'Layout' || viewType === 'PETCTFusion'
  }

  function isCrosshairOperationEnabled(): boolean {
    return isMprLikeViewType(options.activeTab.value?.viewType) && getNormalizedOperation() === VIEW_OPERATION_TYPES.crosshair
  }

  function isFourDDirectCrosshairEnabled(): boolean {
    return options.activeTab.value?.viewType === '4D'
  }

  function isMeasurementOperationEnabled(): boolean {
    const viewType = options.activeTab.value?.viewType
    return (isStackLikeViewType(viewType) || isMprLikeViewType(viewType)) && getMeasurementToolType() != null
  }

  function isSegmentationOperationEnabled(): boolean {
    const operation = getNormalizedOperationPath()
    return operation === 'segmentation:threshold' || operation === 'segmentation:voi'
  }

  function getVolumeClipMode(): VolumeClipMode | null {
    const operation = getNormalizedOperationPath()
    if (operation === 'volumeClip:inside') {
      return 'inside'
    }
    if (operation === 'volumeClip:outside') {
      return 'outside'
    }
    return null
  }

  function isVolumeClipOperationEnabled(viewportKey: string): boolean {
    const activeTab = options.activeTab.value
    const viewType = activeTab?.viewType
    const isLayoutVolumeSlot = viewType === 'Layout' && Boolean(
      activeTab?.layoutSlots?.some(
        (slot) => slot.id === viewportKey && Boolean(slot.viewId) && (slot.viewType === '3D' || slot.sourceViewType === '3D')
      )
    )
    return getVolumeClipMode() != null && (viewType === '3D' || (viewType === 'MPR' && viewportKey === 'volume') || isLayoutVolumeSlot)
  }

  function isAnnotationOperationActive(): boolean {
    return getNormalizedOperationPath().startsWith('annotate')
  }

  function isMtfOperationEnabled(): boolean {
    const viewType = options.activeTab.value?.viewType
    return (
      (viewType === 'Stack' || isMprLikeViewType(viewType)) &&
      (getNormalizedOperation() === 'mtf' || getQaToolType() === 'mtf')
    )
  }

  function isExplicitViewportDragOperation(operation: string): operation is (typeof STACK_DRAG_OPERATIONS)[number] {
    return STACK_DRAG_OPERATIONS.includes(operation as (typeof STACK_DRAG_OPERATIONS)[number])
  }

  function canUseDefaultWindowDrag(viewportKey: string): boolean {
    const viewType = options.activeTab.value?.viewType
    if (viewportKey === 'volume' || viewType === '3D') {
      return false
    }
    return isStackLikeViewType(viewType) || isMprLikeViewType(viewType)
  }

  function canUseDefaultZoomDrag(viewportKey: string): boolean {
    const viewType = options.activeTab.value?.viewType
    return viewportKey === 'volume' || viewType === '3D' || isStackLikeViewType(viewType) || isMprLikeViewType(viewType)
  }

  function resolveViewportDragOperation(viewportKey: string, button: number): ViewOperationType | null {
    if (button === POINTER_BUTTON_RIGHT) {
      return canUseDefaultZoomDrag(viewportKey) ? VIEW_OPERATION_TYPES.zoom : null
    }

    if (button !== POINTER_BUTTON_LEFT) {
      return null
    }

    if (isSegmentationOperationEnabled()) {
      return null
    }
    if (isVolumeClipOperationEnabled(viewportKey)) {
      return null
    }

    const operation = getNormalizedOperation()
    if (operation === VIEW_OPERATION_TYPES.scroll) {
      return canUseDefaultWindowDrag(viewportKey) ? VIEW_OPERATION_TYPES.scroll : null
    }
    if (isAnnotationOperationActive()) {
      return null
    }
    if (isExplicitViewportDragOperation(operation)) {
      return operation
    }

    return canUseDefaultWindowDrag(viewportKey) ? VIEW_OPERATION_TYPES.window : null
  }

  function getViewportDragCursorClass(operationType: ViewOperationType): string | null {
    if (operationType === VIEW_OPERATION_TYPES.window) {
      return 'cursor-window-level'
    }
    if (operationType === VIEW_OPERATION_TYPES.pan) {
      return 'cursor-pan-drag'
    }
    if (operationType === VIEW_OPERATION_TYPES.zoom) {
      return 'cursor-zoom-drag'
    }
    return null
  }

  function getViewportIdleCursorClass(viewportKey: string): string {
    const operationType = getNormalizedOperation()
    if (isVolumeClipOperationEnabled(viewportKey)) {
      return 'cursor-crosshair'
    }
    if (operationType === VIEW_OPERATION_TYPES.window) {
      return canUseDefaultWindowDrag(viewportKey) ? 'cursor-window-level' : 'cursor-auto'
    }
    if (operationType === VIEW_OPERATION_TYPES.pan) {
      return 'cursor-pan'
    }
    if (operationType === VIEW_OPERATION_TYPES.zoom) {
      return canUseDefaultZoomDrag(viewportKey) ? 'cursor-zoom-drag' : 'cursor-auto'
    }
    return 'cursor-auto'
  }

  function isRotate3dDragOperation(): boolean {
    return dragOperationType.value === VIEW_OPERATION_TYPES.rotate3d
  }

  function emitViewportDragMove(payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'move'
    viewportKey: string
    canvasX?: number
    canvasY?: number
    canvasWidth?: number
    canvasHeight?: number
    interactionId?: string
  }): void {
    emitViewportDragMoves.schedule(payload)
  }

  function createDragInteractionId(operationType: ViewOperationType): string {
    return globalThis.crypto?.randomUUID?.() ?? `${operationType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }

  function flushViewportDragMoves(): void {
    emitViewportDragMoves.flush()
  }

  function cancelViewportDragMoves(): void {
    emitViewportDragMoves.cancel()
  }

  function resolvePointerContainer(event: PointerEvent): HTMLElement | null {
    const target = event.target
    if (!(target instanceof Element)) {
      return null
    }

    return target.closest('.viewer-viewport')
  }

  function resolveViewportKeyFromEvent(event: PointerEvent): string {
    return resolvePointerContainer(event)?.dataset.viewportKey ?? ''
  }

  function resolveBasicPointerContext(event: PointerEvent, viewportKey?: string): BasicPointerContext | null {
    const pointerTarget = resolvePointerContainer(event)
    if (!(pointerTarget instanceof HTMLElement)) {
      return null
    }

    const resolvedViewportKey = viewportKey || pointerTarget.dataset.viewportKey || ''
    if (!resolvedViewportKey) {
      return null
    }

    return {
      pointerTarget,
      viewportKey: resolvedViewportKey
    }
  }

  function resolveViewportImageElement(event: PointerEvent): HTMLImageElement | null {
    const container = resolvePointerContainer(event)
    if (!container) {
      return null
    }

    const image = container.querySelector<HTMLImageElement>('.viewer-image')
    return image instanceof HTMLImageElement ? image : null
  }

  function getNormalizedContainerPoint(event: PointerEvent): { x: number; y: number } | null {
    const container = resolvePointerContainer(event)
    if (!container) {
      return null
    }

    const rect = container.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      return null
    }

    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    }
  }

  function getViewportCanvasPoint(event: PointerEvent): ViewportCanvasPoint | null {
    const container = resolvePointerContainer(event)
    if (!container) {
      return null
    }

    const rect = container.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      return null
    }

    const canvasX = event.clientX - rect.left
    const canvasY = event.clientY - rect.top
    return {
      x: Math.max(0, Math.min(1, canvasX / rect.width)),
      y: Math.max(0, Math.min(1, canvasY / rect.height)),
      canvasX,
      canvasY,
      canvasWidth: rect.width,
      canvasHeight: rect.height
    }
  }

  function getRenderedImageRect(imageElement: HTMLImageElement): DOMRect {
    const rect = imageElement.getBoundingClientRect()
    const naturalWidth = imageElement.naturalWidth
    const naturalHeight = imageElement.naturalHeight
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

  function getNormalizedViewportPoint(event: PointerEvent): { x: number; y: number } | null {
    const imageElement = resolveViewportImageElement(event)
    if (!imageElement) {
      return null
    }

    const rect = getRenderedImageRect(imageElement)
    if (!rect.width || !rect.height) {
      return null
    }

    const normalizedX = (event.clientX - rect.left) / rect.width
    const normalizedY = (event.clientY - rect.top) / rect.height

    return {
      x: Math.max(0, Math.min(1, normalizedX)),
      y: Math.max(0, Math.min(1, normalizedY))
    }
  }

  function getNormalizedCrosshairPointerPoint(
    event: PointerEvent
  ): { x: number; y: number; canvasX: number; canvasY: number; canvasWidth?: number; canvasHeight?: number } | null {
    const imageElement = resolveViewportImageElement(event)
    const stageElement = imageElement?.parentElement instanceof HTMLElement ? imageElement.parentElement : resolvePointerContainer(event)
    const stageRect = stageElement?.getBoundingClientRect()
    if (!stageRect?.width || !stageRect.height) {
      const imagePoint = getNormalizedViewportPoint(event)
      return imagePoint ? { ...imagePoint, canvasX: imagePoint.x, canvasY: imagePoint.y } : null
    }

    const canvasX = Math.max(0, Math.min(1, (event.clientX - stageRect.left) / stageRect.width))
    const canvasY = Math.max(0, Math.min(1, (event.clientY - stageRect.top) / stageRect.height))
    return {
      x: canvasX,
      y: canvasY,
      canvasX,
      canvasY,
      canvasWidth: stageRect.width,
      canvasHeight: stageRect.height
    }
  }

  function resolveMeasurementPointerContext(
    event: PointerEvent,
    viewportKey?: string
  ): MeasurementPointerContext | null {
    const basicContext = resolveBasicPointerContext(event, viewportKey)
    if (!basicContext) {
      return null
    }

    const imageElement = resolveViewportImageElement(event)
    const point = getNormalizedContainerPoint(event)
    if (!imageElement || !point) {
      return null
    }

    return {
      ...basicContext,
      imageElement,
      imageRect: basicContext.pointerTarget.getBoundingClientRect(),
      point
    }
  }

  function resolveImageMeasurementPointerContext(
    event: PointerEvent,
    viewportKey?: string
  ): MeasurementPointerContext | null {
    const basicContext = resolveBasicPointerContext(event, viewportKey)
    if (!basicContext) {
      return null
    }

    const imageElement = resolveViewportImageElement(event)
    const point = getNormalizedViewportPoint(event)
    if (!imageElement || !point) {
      return null
    }

    return {
      ...basicContext,
      imageElement,
      imageRect: getRenderedImageRect(imageElement),
      point
    }
  }

  function emitCrosshairEvent(
    viewportKey: string,
    phase: 'start' | 'move' | 'end',
    event: PointerEvent,
    mode: 'move' | 'rotate' = 'move',
    line: CrosshairLineTarget | null = null
  ): void {
    const point = getNormalizedCrosshairPointerPoint(event)
    if (!point) {
      return
    }

    options.emitMprCrosshair({
      viewportKey,
      phase,
      x: point.x,
      y: point.y,
      canvasX: point.canvasX,
      canvasY: point.canvasY,
      canvasWidth: point.canvasWidth,
      canvasHeight: point.canvasHeight,
      mode,
      line: line ?? undefined
    })
  }

  function resolveCrosshairHitTarget(
    event: PointerEvent,
    viewportKey: string,
    point: { x: number; y: number }
  ): CrosshairHitTarget {
    if (viewportKey === 'single' || viewportKey === 'volume') {
      return 'none'
    }
    const crosshairInfo = options.activeTab.value?.viewportCrosshairs?.[viewportKey as MprViewportKey] ?? null
    const geometry = getTabViewportCrosshairGeometry(options.activeTab.value, viewportKey as MprViewportKey)
    if (!crosshairInfo || !geometry) {
      return 'none'
    }

    const container = resolvePointerContainer(event)
    if (!container) {
      return 'none'
    }

    const imageElement = resolveViewportImageElement(event)
    if (!imageElement) {
      return 'none'
    }
    const rect = container.getBoundingClientRect()
    const imageRect = getRenderedImageRect(imageElement)
    if (!rect.width || !rect.height || !imageRect.width || !imageRect.height) {
      return 'none'
    }

    return resolveCrosshairHitTargetFromGeometry({
      containerPoint: point,
      crosshairInfo,
      containerRect: rect,
      imageRect,
      geometry
    })
  }

  function getDraftMeasurement(viewportKey: string): MeasurementDraft | null {
    return draftMeasurements.value[viewportKey] ?? null
  }

  function getMtfDraft(viewportKey: string): MtfDraft | null {
    return mtfDrafts.value[viewportKey] ?? null
  }

  function getSelectedMtf(viewportKey?: string): ViewerMtfItem | null {
    const tab = options.activeTab.value
    const selectedMtfId = tab?.mtfState?.selectedMtfId
    if (!selectedMtfId) {
      return null
    }

    const selectedMtf = (tab?.mtfState?.items ?? []).find((item) => item.mtfId === selectedMtfId) ?? null
    if (!selectedMtf) {
      return null
    }

    if (viewportKey && selectedMtf.viewportKey !== viewportKey) {
      return null
    }

    return selectedMtf
  }

  function resolveSelectedMtfDraft(viewportKey?: string): { viewportKey: string; draft: MtfDraft } | null {
    const selectedMtf = getSelectedMtf(viewportKey)
    if (!selectedMtf) {
      return null
    }

    return {
      viewportKey: selectedMtf.viewportKey,
      draft: {
        mtfId: selectedMtf.mtfId,
        points: selectedMtf.points
      }
    }
  }

  function clearDraftMeasurement(viewportKey?: string): void {
    if (!viewportKey) {
      draftMeasurements.value = {}
      lastPointSequenceClick = null
      return
    }
    draftMeasurements.value = {
      ...draftMeasurements.value,
      [viewportKey]: null
    }
    if (lastPointSequenceClick?.viewportKey === viewportKey) {
      lastPointSequenceClick = null
    }
  }

  function clearMtfDraft(viewportKey?: string): void {
    if (!viewportKey) {
      mtfDrafts.value = {}
      return
    }
    mtfDrafts.value = {
      ...mtfDrafts.value,
      [viewportKey]: null
    }
  }

  function updateDraftMeasurement(viewportKey: string, draft: MeasurementDraft): void {
    const existingDraft = draftMeasurements.value[viewportKey]
    draftMeasurements.value = {
      ...draftMeasurements.value,
      [viewportKey]: {
        ...draft,
        labelLines: draft.labelLines ?? existingDraft?.labelLines ?? []
      }
    }
  }

  function clearVolumeClipDraft(): void {
    if (volumeClipViewportKey.value) {
      clearDraftMeasurement(volumeClipViewportKey.value)
    }
    volumeClipViewportKey.value = ''
    volumeClipMode.value = null
  }

  function appendVolumeClipPoint(viewportKey: string, point: MeasurementDraftPoint): MeasurementDraftPoint[] {
    const currentDraft = draftMeasurements.value[viewportKey]
    const currentPoints = currentDraft?.points ?? []
    const lastPoint = currentPoints[currentPoints.length - 1]
    if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 0.003) {
      return currentPoints
    }
    const nextPoints = [...currentPoints, point]
    updateDraftMeasurement(viewportKey, createMeasurementDraft('freeform', nextPoints))
    return nextPoints
  }

  function handleVolumeClipPointerDown(event: PointerEvent, viewportKey: string, pointerTarget: HTMLElement): boolean {
    const mode = getVolumeClipMode()
    if (event.button !== POINTER_BUTTON_LEFT || !mode || !isVolumeClipOperationEnabled(viewportKey)) {
      return false
    }
    const point = getNormalizedContainerPoint(event)
    if (!point) {
      return false
    }

    event.preventDefault()
    setActiveViewport(viewportKey)
    clearVolumeClipDraft()
    volumeClipViewportKey.value = viewportKey
    volumeClipMode.value = mode
    updateDraftMeasurement(viewportKey, createMeasurementDraft('freeform', [point]))
    setViewportCursor(viewportKey, 'cursor-crosshair')
    setPointerCapture(pointerTarget, event.pointerId)
    return true
  }

  function handleVolumeClipPointerMove(event: PointerEvent): boolean {
    const viewportKey = volumeClipViewportKey.value
    if (!viewportKey || !volumeClipMode.value) {
      return false
    }
    const point = getNormalizedContainerPoint(event)
    if (!point) {
      return true
    }
    appendVolumeClipPoint(viewportKey, point)
    return true
  }

  function handleVolumeClipPointerUp(event: PointerEvent, pointerTarget?: EventTarget | null): boolean {
    const viewportKey = volumeClipViewportKey.value
    const mode = volumeClipMode.value
    if (!viewportKey || !mode) {
      return false
    }
    const point = getNormalizedContainerPoint(event)
    const points = point ? appendVolumeClipPoint(viewportKey, point) : (draftMeasurements.value[viewportKey]?.points ?? [])
    const finalizedPoints = getFinalizedVolumeClipPoints(points)
    if (finalizedPoints.length >= 3) {
      options.emitVolumeClip?.({
        viewportKey,
        mode,
        points: finalizedPoints
      })
    }
    clearVolumeClipDraft()
    clearViewportCursor(viewportKey)
    releasePointerCapture(pointerTarget)
    return true
  }

  function cancelVolumeClipPointerInteraction(pointerTarget?: EventTarget | null): boolean {
    const viewportKey = volumeClipViewportKey.value
    if (!viewportKey || !volumeClipMode.value) {
      return false
    }
    clearVolumeClipDraft()
    clearViewportCursor(viewportKey)
    releasePointerCapture(pointerTarget)
    return true
  }

  function updateMtfDraft(viewportKey: string, draft: MtfDraft): void {
    mtfDrafts.value = {
      ...mtfDrafts.value,
      [viewportKey]: draft
    }
  }

  function isValidMtfDraft(points: MeasurementDraftPoint[]): boolean {
    if (points.length < 2) {
      return false
    }
    const [start, end] = points
    return Math.abs(end.x - start.x) >= 0.005 && Math.abs(end.y - start.y) >= 0.005
  }

  function getDraftMeasurementMode(viewportKey: string): DraftMeasurementMode | null {
    const draft = draftMeasurements.value[viewportKey]
    if (!draft) {
      return null
    }
    return resolveDraftMeasurementMode(measurementInteraction.value, viewportKey, Boolean(draft.measurementId))
  }

  function getMtfDraftMode(viewportKey: string): DraftMeasurementMode | null {
    const draft = mtfDrafts.value[viewportKey]
    if (!draft) {
      return null
    }

    return resolveMtfDraftMode(mtfInteraction.value, viewportKey, Boolean(draft.mtfId))
  }

  function updateDraftMeasurementLabelLines(viewportKey: string, labelLines: string[]): void {
    const draft = draftMeasurements.value[viewportKey]
    if (!draft) {
      return
    }

    const isActiveMeasurementInteractionForViewport =
      (measurementInteraction.value.kind === 'creating' ||
        measurementInteraction.value.kind === 'move_pending' ||
        measurementInteraction.value.kind === 'moving' ||
        measurementInteraction.value.kind === 'editing_handle') &&
      measurementInteraction.value.viewportKey === viewportKey

    // Keep the last visible metrics while the ROI is actively being dragged or edited.
    if (isActiveMeasurementInteractionForViewport && labelLines.length === 0 && (draft.labelLines?.length ?? 0) > 0) {
      return
    }

    updateDraftMeasurement(viewportKey, {
      ...draft,
      labelLines
    })
  }

  function setSelectedMeasurementState(viewportKey: string, measurementId: string): void {
    measurementInteractionController.select(viewportKey, measurementId)
  }

  function resetMeasurementInteraction(): void {
    measurementInteractionController.reset()
  }

  function resolveSelectedMeasurementDraft(viewportKey?: string): { viewportKey: string; draft: MeasurementDraft } | null {
    const interactionState = measurementInteraction.value
    if (interactionState.kind === 'idle' || interactionState.kind === 'creating') {
      return null
    }

    const targetViewportKey = viewportKey ?? interactionState.viewportKey
    const draft = getDraftMeasurement(targetViewportKey)
    if (draft?.measurementId) {
      return {
        viewportKey: targetViewportKey,
        draft
      }
    }

    if (interactionState.viewportKey !== targetViewportKey) {
      return null
    }

    const committedMeasurement = options
      .getCommittedMeasurements(targetViewportKey)
      .find((measurement) => measurement.measurementId === interactionState.measurementId)
    if (!committedMeasurement) {
      return null
    }

    return {
      viewportKey: targetViewportKey,
      draft: {
        ...createMeasurementDraft(
          committedMeasurement.toolType,
          committedMeasurement.points,
          committedMeasurement.measurementId
        ),
        labelLines: committedMeasurement.labelLines
      }
    }
  }

  function copySelectedMeasurement(viewportKey?: string): boolean {
    const selected = resolveSelectedMeasurementDraft(viewportKey)
    if (!selected) {
      return false
    }
    if (!measurementInteractionController.copySelected()) {
      return false
    }

    const copiedMeasurementId = generateMeasurementId()
    const occupiedPointSets = [
      ...options.getCommittedMeasurements(selected.viewportKey).map((measurement) => measurement.points),
      ...Object.values(draftMeasurements.value)
        .filter((draft): draft is MeasurementDraft => Boolean(draft))
        .map((draft) => draft.points)
    ]

    let copiedPoints = selected.draft.points
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const candidate = offsetMeasurementPoints(selected.draft.points, 0.01 * attempt)
      if (!occupiedPointSets.some((points) => arePointSetsClose(points, candidate))) {
        copiedPoints = candidate
        break
      }
      copiedPoints = candidate
    }
    const nextDraft: MeasurementDraft = {
      ...selected.draft,
      measurementId: copiedMeasurementId,
      points: copiedPoints
    }

    updateDraftMeasurement(selected.viewportKey, nextDraft)
    setSelectedMeasurementState(selected.viewportKey, copiedMeasurementId)
    options.emitMeasurementCreate({
      viewportKey: selected.viewportKey,
      toolType: nextDraft.toolType,
      points: nextDraft.points,
      measurementId: copiedMeasurementId,
      labelLines: nextDraft.labelLines ?? []
    })
    return true
  }

  function deleteSelectedMeasurement(viewportKey?: string, measurementId?: string): boolean {
    const selected = resolveSelectedMeasurementDraft(viewportKey)
    const targetViewportKey = viewportKey ?? selected?.viewportKey
    const targetMeasurementId = measurementId?.trim() || selected?.draft.measurementId
    if (!targetViewportKey || !targetMeasurementId) {
      return false
    }

    resetMeasurementInteraction()
    options.emitMeasurementDelete({
      viewportKey: targetViewportKey,
      measurementId: targetMeasurementId
    })
    clearDraftMeasurement(targetViewportKey)
    clearViewportCursor(targetViewportKey)
    return true
  }

  function copySelectedMtf(viewportKey?: string): boolean {
    const selected = resolveSelectedMtfDraft(viewportKey)
    if (!selected) {
      return false
    }

    options.emitMtfCommit({
      viewportKey: selected.viewportKey,
      points: offsetMeasurementPoints(selected.draft.points, 0.01)
    })
    return true
  }

  function deleteSelectedMtf(viewportKey?: string): boolean {
    const selected = resolveSelectedMtfDraft(viewportKey)
    if (!selected?.draft.mtfId) {
      return false
    }

    mtfInteractionController.reset()
    clearMtfDraft(selected.viewportKey)
    clearViewportCursor(selected.viewportKey)
    options.emitMtfDelete({ mtfId: selected.draft.mtfId })
    options.emitMtfSelect({ mtfId: null })
    return true
  }

  function resolvePointSequenceDraft(viewportKey?: string): PointSequenceDraftResolution | null {
    const orderedViewportKeys = [
      viewportKey,
      activeViewportKey.value,
      ...Object.keys(draftMeasurements.value)
    ].filter((key): key is string => Boolean(key))
    const uniqueViewportKeys = Array.from(new Set(orderedViewportKeys))

    for (const currentViewportKey of uniqueViewportKeys) {
      const draft = draftMeasurements.value[currentViewportKey]
      if (!draft || !isPointSequenceMeasurement(draft.toolType)) {
        continue
      }

      if (!draft.measurementId) {
        return {
          viewportKey: currentViewportKey,
          draft,
          points: getFinalizedPointSequencePoints(draft.points)
        }
      }

      const interactionState = measurementInteraction.value
      if (
        interactionState.kind !== 'idle' &&
        interactionState.kind !== 'creating' &&
        interactionState.viewportKey === currentViewportKey &&
        interactionState.measurementId === draft.measurementId
      ) {
        return {
          viewportKey: currentViewportKey,
          draft,
          points: draft.points
        }
      }
    }

    return null
  }

  function finishPointSequenceMeasurement(viewportKey?: string): boolean {
    const resolved = resolvePointSequenceDraft(viewportKey)
    if (!resolved) {
      return false
    }

    lastPointSequenceClick = null
    if (!isValidMeasurement(resolved.draft.toolType, resolved.points)) {
      clearDraftMeasurement(resolved.viewportKey)
      resetMeasurementInteraction()
      clearViewportCursor(resolved.viewportKey)
      releasePointerCapture()
      return true
    }

    if (resolved.draft.measurementId) {
      emitThrottledMeasurementDraft.flush()
      options.emitMeasurementCreate({
        viewportKey: resolved.viewportKey,
        toolType: resolved.draft.toolType,
        points: resolved.points,
        measurementId: resolved.draft.measurementId,
        labelLines: resolved.draft.labelLines ?? []
      })
      clearDraftMeasurement(resolved.viewportKey)
      resetMeasurementInteraction()
      clearViewportCursor(resolved.viewportKey)
      releasePointerCapture()
      return true
    }

    commitMeasurementDraftFromClick(resolved.viewportKey, resolved.draft.toolType, {
      ...resolved.draft,
      points: resolved.points
    })
    return true
  }

  function stopViewportDrag(pointerTarget?: EventTarget | null): void {
    const mtfState = mtfInteraction.value
    if (isCapturedMtfInteraction(mtfState)) {
      const stoppedViewportKey = mtfState.viewportKey
      mtfInteractionController.reset()
      clearMtfDraft(stoppedViewportKey)
      clearViewportCursor(stoppedViewportKey)
      releasePointerCapture(pointerTarget)
    }

    const interactionState = measurementInteraction.value
    if (
      isCapturedMeasurementInteraction(interactionState) ||
      (interactionState.kind === 'selected' && activePointerId.value != null)
    ) {
      const stoppedViewportKey = interactionState.viewportKey
      emitThrottledMeasurementDraft.cancel()
      if (isCapturedMeasurementInteraction(interactionState)) {
        resetMeasurementInteraction()
      }
      if (stoppedViewportKey) {
        clearViewportCursor(stoppedViewportKey)
      }
      releasePointerCapture(pointerTarget)
    }

    if (isCrosshairDragging.value) {
      emitThrottledCrosshairMove.cancel()
      isCrosshairDragging.value = false
      crosshairDragMode.value = 'move'
      crosshairRotationLine.value = null
      crosshairPointerViewportKey.value = ''
      releasePointerCapture(pointerTarget)
    }

    if (!isViewportDragging.value) {
      return
    }

    flushViewportDragMoves()

    if (hasSentDragStart) {
      if (dragOperationType.value && isRotate3dDragOperation() && lastDragNormalizedPoint) {
        options.emitViewportDrag({
          deltaX: lastDragNormalizedPoint.x,
          deltaY: lastDragNormalizedPoint.y,
          opType: VIEW_OPERATION_TYPES.rotate3d,
          phase: DRAG_ACTION_TYPES.end,
          viewportKey: dragViewportKey.value,
          canvasX: lastDragNormalizedPoint.canvasX,
          canvasY: lastDragNormalizedPoint.canvasY,
          canvasWidth: lastDragNormalizedPoint.canvasWidth,
          canvasHeight: lastDragNormalizedPoint.canvasHeight,
          interactionId: activeDragInteractionId ?? undefined
        })
      } else if (dragOperationType.value) {
        const point = lastDragNormalizedPoint
        options.emitViewportDrag({
          deltaX: totalDeltaX,
          deltaY: totalDeltaY,
          opType: dragOperationType.value,
          phase: DRAG_ACTION_TYPES.end,
          viewportKey: dragViewportKey.value,
          canvasX: point?.canvasX,
          canvasY: point?.canvasY,
          canvasWidth: point?.canvasWidth,
          canvasHeight: point?.canvasHeight,
          interactionId: activeDragInteractionId ?? undefined
        })
      }
    }

    const stoppedViewportKey = dragViewportKey.value
    isViewportDragging.value = false
    dragViewportKey.value = ''
    totalDeltaX = 0
    totalDeltaY = 0
    hasSentDragStart = false
    dragStartNormalizedPoint = null
    lastDragNormalizedPoint = null
    activeDragInteractionId = null
    dragOperationType.value = null
    if (stoppedViewportKey) {
      clearViewportCursor(stoppedViewportKey)
    }
    releasePointerCapture(pointerTarget)
  }

  function updateMeasurementHoverCursor(event: PointerEvent): void {
    const viewportKey = resolveViewportKeyFromEvent(event)
    if (!viewportKey || !isMeasurementOperationEnabled()) {
      return
    }

    const interactionState = measurementInteraction.value
    if (isCapturedMeasurementInteraction(interactionState)) {
      if (interactionState.viewportKey !== viewportKey) {
        return
      }
      const draft = draftMeasurements.value[viewportKey]
      if (draft?.measurementId) {
        setViewportCursor(viewportKey, interactionState.kind === 'editing_handle' ? 'cursor-pointer' : 'cursor-move')
      }
      return
    }

    const point = getNormalizedContainerPoint(event)
    const pointerTarget = resolvePointerContainer(event)
    if (!point || !pointerTarget) {
      clearViewportCursor(viewportKey)
      return
    }

    const imageRect = pointerTarget.getBoundingClientRect()
    const existingDraft = draftMeasurements.value[viewportKey]
    if (existingDraft?.measurementId) {
      const handleIndex = findHandleIndexAtPoint(existingDraft.toolType, existingDraft.points, point, imageRect)
      if (handleIndex != null) {
        setViewportCursor(viewportKey, 'cursor-pointer')
        return
      }
      const currentDraftHit = isMeasurementHit(
        {
          measurementId: existingDraft.measurementId,
          toolType: existingDraft.toolType,
          points: existingDraft.points,
          labelLines: existingDraft.labelLines ?? []
        },
        point,
        imageRect
      )
      if (currentDraftHit.hit) {
        setViewportCursor(viewportKey, 'cursor-move')
        return
      }
    }

    clearViewportCursor(viewportKey)
  }

  function updateMtfHoverCursor(event: PointerEvent): void {
    const viewportKey = resolveViewportKeyFromEvent(event)
    if (!viewportKey || !isMtfOperationEnabled()) {
      return
    }

    const interactionState = mtfInteraction.value
    if (isCapturedMtfInteraction(interactionState)) {
      if (interactionState.viewportKey !== viewportKey) {
        return
      }
      setViewportCursor(viewportKey, interactionState.kind === 'editing_handle' ? 'cursor-pointer' : 'cursor-move')
      return
    }

    const point = getNormalizedViewportPoint(event)
    const imageElement = resolveViewportImageElement(event)
    if (!point || !imageElement) {
      clearViewportCursor(viewportKey)
      return
    }

    const imageRect = getRenderedImageRect(imageElement)
    const selectedMtf = getSelectedMtf(viewportKey)
    if (selectedMtf) {
      const handleIndex = findMtfHandleIndexAtPoint(selectedMtf.points, point, imageRect)
      if (handleIndex != null) {
        setViewportCursor(viewportKey, 'cursor-pointer')
        return
      }
    }

    const hitItem = resolveMtfPointerDownIntent({
      items: options.getMtfItems(viewportKey),
      selectedItem: selectedMtf,
      point,
      rect: imageRect
    })
    if (hitItem.kind === 'move_selected' || hitItem.kind === 'select_item') {
      setViewportCursor(viewportKey, 'cursor-move')
      return
    }

    clearViewportCursor(viewportKey)
  }

  function updateCrosshairHoverCursor(event: PointerEvent): void {
    const viewportKey = resolveViewportKeyFromEvent(event)
    if (!viewportKey || !isCrosshairOperationEnabled()) {
      return
    }

    const point = getNormalizedContainerPoint(event)
    if (!point) {
      clearViewportCursor(viewportKey)
      return
    }

    const hitTarget = resolveCrosshairHitTarget(event, viewportKey, point)
    if (hitTarget === 'center') {
      setViewportCursor(viewportKey, 'cursor-crosshair-move')
      return
    }
    if (hitTarget === 'horizontal' || hitTarget === 'vertical') {
      setViewportCursor(viewportKey, 'cursor-crosshair-rotate')
      return
    }

    clearViewportCursor(viewportKey)
  }

  function startEditingExistingHandle(
    pointerTarget: HTMLElement,
    pointerId: number,
    viewportKey: string,
    toolType: MeasurementToolType,
    draft: MeasurementDraft,
    handleIndex: number
  ): void {
    setPointerCapture(pointerTarget, pointerId)
    measurementInteractionController.startEditingHandle(viewportKey, draft.measurementId!, handleIndex)
    setViewportCursor(viewportKey, 'cursor-pointer')
    emitMeasurementDraftPhase(viewportKey, toolType, DRAG_ACTION_TYPES.start, draft.points)
  }

  function selectCommittedMeasurement(viewportKey: string, measurement: MeasurementOverlay): void {
    options.emitOperationChange(`stack:measure:${measurement.toolType}`)
    const nextDraft = createMeasurementDraft(
      measurement.toolType,
      measurement.points,
      measurement.measurementId
    )
    updateDraftMeasurement(viewportKey, {
      ...nextDraft,
      labelLines: measurement.labelLines
    })
    setSelectedMeasurementState(viewportKey, measurement.measurementId)
  }

  function startPendingMeasurementMove(
    pointerTarget: HTMLElement,
    pointerId: number,
    viewportKey: string,
    measurementId: string,
    startPoint: MeasurementDraftPoint
  ): void {
    setPointerCapture(pointerTarget, pointerId)
    measurementInteractionController.startMovePending(viewportKey, measurementId, startPoint)
    setViewportCursor(viewportKey, 'cursor-move')
  }

  function startNewMeasurement(
    pointerTarget: HTMLElement,
    pointerId: number,
    viewportKey: string,
    toolType: MeasurementToolType,
    point: MeasurementDraftPoint,
    existingDraft: MeasurementDraft | null
  ): void {
    void pointerTarget
    void pointerId
    void existingDraft
    measurementInteractionController.startCreate(viewportKey, toolType)

    const nextDraft = createMeasurementDraft(toolType, [point, point])
    updateDraftMeasurement(viewportKey, nextDraft)
    emitMeasurementDraftPhase(viewportKey, toolType, DRAG_ACTION_TYPES.start, nextDraft.points)

    if (isPointSequenceMeasurement(toolType)) {
      rememberPointSequenceClick(viewportKey, toolType, point)
    } else {
      lastPointSequenceClick = null
    }
  }

  function commitOrClearMeasurementDraft(viewportKey: string, toolType: MeasurementToolType, draft: MeasurementDraft): void {
    if (toolType === 'angle' && draft.points.length === 2) {
      if (isValidMeasurement('line', draft.points)) {
        updateDraftMeasurement(viewportKey, createMeasurementDraft(toolType, [draft.points[0], draft.points[1]]))
        emitMeasurementDraftPhase(viewportKey, toolType, DRAG_ACTION_TYPES.end, draft.points)
      } else {
        clearDraftMeasurement(viewportKey)
      }
      return
    }

    if (!isValidMeasurement(toolType, draft.points)) {
      clearDraftMeasurement(viewportKey)
      return
    }

    emitThrottledMeasurementDraft.flush()
    const measurementId = draft.measurementId ?? generateMeasurementId()
    options.emitMeasurementCreate({
      viewportKey,
      toolType,
      points: draft.points,
      measurementId,
      labelLines: draft.labelLines ?? []
    })

    setSelectedMeasurementState(viewportKey, measurementId)
    if (draft.measurementId) {
      return
    }

    clearDraftMeasurement(viewportKey)
  }

  function handleActiveMeasurementEditMove(
    state: ActiveMeasurementEditState,
    toolType: MeasurementToolType,
    point: MeasurementDraftPoint
  ): boolean {
    const currentDraft = draftMeasurements.value[state.viewportKey]
    if (!currentDraft) {
      return false
    }

    if (state.kind === 'moving') {
      lastPointSequenceClick = null
      const nextPoints =
        toolType === 'rect' || toolType === 'ellipse'
          ? moveRectRoiDraftPoints(currentDraft.points, state.lastPoint, point)
          : translateMeasurementPoints(
              currentDraft.points,
              point.x - state.lastPoint.x,
              point.y - state.lastPoint.y
            )
      measurementInteractionController.markChanged()
      measurementInteractionController.updateLastPoint(point)
      updateDraftMeasurement(state.viewportKey, {
        ...currentDraft,
        points: nextPoints
      })
      emitThrottledMeasurementDraft({
        viewportKey: state.viewportKey,
        toolType,
        points: nextPoints
      })
      return true
    }

    if (state.kind === 'editing_handle') {
      lastPointSequenceClick = null
      const nextPoints =
        toolType === 'rect' || toolType === 'ellipse'
          ? editRectRoiDraftPoints(currentDraft.points, state.handleIndex, point)
          : updateEditedMeasurementPoints(toolType, currentDraft.points, state.handleIndex, point)
      measurementInteractionController.markChanged()
      updateDraftMeasurement(state.viewportKey, {
        ...currentDraft,
        points: nextPoints
      })
      emitThrottledMeasurementDraft({
        viewportKey: state.viewportKey,
        toolType,
        points: nextPoints
      })
      return true
    }

    if (toolType === 'rect' || toolType === 'ellipse') {
      const nextDraft = createMeasurementDraft(toolType, buildRectRoiDraftPoints(currentDraft.points[0], point))
      updateDraftMeasurement(state.viewportKey, nextDraft)
      emitThrottledMeasurementDraft({
        viewportKey: state.viewportKey,
        toolType,
        points: nextDraft.points
      })
      return true
    }

    if (toolType === 'angle') {
      if (currentDraft.points.length === 2) {
        updateDraftMeasurement(state.viewportKey, createMeasurementDraft(toolType, [currentDraft.points[0], point]))
      } else if (currentDraft.points.length === 3) {
        const nextDraft = createMeasurementDraft(toolType, [currentDraft.points[0], currentDraft.points[1], point])
        updateDraftMeasurement(state.viewportKey, nextDraft)
        emitThrottledMeasurementDraft({
          viewportKey: state.viewportKey,
          toolType,
          points: nextDraft.points
        })
      }
      return true
    }

    if (isPointSequenceMeasurement(toolType)) {
      const nextDraft = createMeasurementDraft(toolType, replaceLastMeasurementPoint(currentDraft.points, point), currentDraft.measurementId)
      updateDraftMeasurement(state.viewportKey, {
        ...nextDraft,
        labelLines: currentDraft.labelLines
      })
      emitThrottledMeasurementDraft({
        viewportKey: state.viewportKey,
        toolType,
        points: nextDraft.points
      })
      return true
    }

    const nextDraft = createMeasurementDraft(toolType, [currentDraft.points[0], point])
    updateDraftMeasurement(state.viewportKey, nextDraft)
    emitThrottledMeasurementDraft({
      viewportKey: state.viewportKey,
      toolType,
      points: nextDraft.points
    })
    return true
  }

  function getPointerEventTimestamp(event?: PointerEvent): number {
    return typeof event?.timeStamp === 'number' && Number.isFinite(event.timeStamp)
      ? event.timeStamp
      : window.performance.now()
  }

  function isPointSequenceDoubleClick(
    viewportKey: string,
    toolType: MeasurementToolType,
    point: MeasurementDraftPoint | undefined,
    event?: PointerEvent
  ): boolean {
    if (!point || !lastPointSequenceClick) {
      return false
    }
    if (lastPointSequenceClick.viewportKey !== viewportKey || lastPointSequenceClick.toolType !== toolType) {
      return false
    }

    const elapsed = getPointerEventTimestamp(event) - lastPointSequenceClick.timeStamp
    if (elapsed < 0 || elapsed > POINT_SEQUENCE_DOUBLE_CLICK_MS) {
      return false
    }

    return Math.hypot(point.x - lastPointSequenceClick.point.x, point.y - lastPointSequenceClick.point.y) <= POINT_SEQUENCE_DOUBLE_CLICK_DISTANCE
  }

  function rememberPointSequenceClick(
    viewportKey: string,
    toolType: MeasurementToolType,
    point: MeasurementDraftPoint | undefined,
    event?: PointerEvent
  ): void {
    if (!point) {
      lastPointSequenceClick = null
      return
    }
    lastPointSequenceClick = {
      viewportKey,
      toolType,
      point,
      timeStamp: getPointerEventTimestamp(event)
    }
  }

  function commitMeasurementDraftFromClick(viewportKey: string, toolType: MeasurementToolType, draft: MeasurementDraft): void {
    emitThrottledMeasurementDraft.flush()
    commitOrClearMeasurementDraft(viewportKey, toolType, draft)
    resetMeasurementInteraction()
    clearViewportCursor(viewportKey)
    releasePointerCapture()
  }

  function finishSelectedPointSequenceDraftOnDoubleClick(
    viewportKey: string,
    toolType: MeasurementToolType,
    point: MeasurementDraftPoint,
    existingDraft: MeasurementDraft | null,
    event?: PointerEvent
  ): boolean {
    if (
      !existingDraft?.measurementId ||
      existingDraft.toolType !== toolType ||
      !isPointSequenceMeasurement(toolType)
    ) {
      return false
    }

    if (!isPointSequenceDoubleClick(viewportKey, toolType, point, event)) {
      rememberPointSequenceClick(viewportKey, toolType, point, event)
      return false
    }

    return finishPointSequenceMeasurement(viewportKey)
  }

  function confirmExistingMeasurementDraftPoint(
    viewportKey: string,
    toolType: MeasurementToolType,
    point: MeasurementDraftPoint,
    existingDraft: MeasurementDraft | null,
    event?: PointerEvent
  ): boolean {
    if (!existingDraft || existingDraft.measurementId || existingDraft.toolType !== toolType || !existingDraft.points.length) {
      return false
    }

    measurementInteractionController.startCreate(viewportKey, toolType)

    const anchorPoint = existingDraft.points[0]
    if (!anchorPoint) {
      return false
    }

    if (toolType === 'line') {
      commitMeasurementDraftFromClick(viewportKey, toolType, {
        ...createMeasurementDraft(toolType, [anchorPoint, point]),
        labelLines: existingDraft.labelLines
      })
      return true
    }

    if (toolType === 'rect' || toolType === 'ellipse') {
      commitMeasurementDraftFromClick(
        viewportKey,
        toolType,
        {
          ...createMeasurementDraft(toolType, buildRectRoiDraftPoints(anchorPoint, point)),
          labelLines: existingDraft.labelLines
        }
      )
      return true
    }

    if (toolType === 'angle') {
      const vertexPoint = existingDraft.points[1]
      if (existingDraft.points.length < 3) {
        if (vertexPoint && !isValidMeasurement('line', [anchorPoint, vertexPoint])) {
          clearDraftMeasurement(viewportKey)
          resetMeasurementInteraction()
          return true
        }

        const nextDraft = {
          ...createMeasurementDraft(toolType, [anchorPoint, point, point]),
          labelLines: existingDraft.labelLines
        }
        updateDraftMeasurement(viewportKey, nextDraft)
        emitMeasurementDraftPhase(viewportKey, toolType, DRAG_ACTION_TYPES.end, [anchorPoint, point])
        return true
      }

      if (!vertexPoint) {
        return false
      }
      commitMeasurementDraftFromClick(viewportKey, toolType, {
        ...createMeasurementDraft(toolType, [anchorPoint, vertexPoint, point]),
        labelLines: existingDraft.labelLines
      })
      return true
    }

    if (isPointSequenceMeasurement(toolType)) {
      const nextConfirmedPoints = replaceLastMeasurementPoint(existingDraft.points, point)
      const finalizedPoints = getFinalizedPointSequencePoints(nextConfirmedPoints)
      if (isPointSequenceDoubleClick(viewportKey, toolType, point, event)) {
        if (isValidMeasurement(toolType, finalizedPoints)) {
          lastPointSequenceClick = null
          commitMeasurementDraftFromClick(viewportKey, toolType, {
            ...createMeasurementDraft(toolType, finalizedPoints),
            labelLines: existingDraft.labelLines
          })
        }
        return true
      }

      rememberPointSequenceClick(viewportKey, toolType, point, event)
      updateDraftMeasurement(viewportKey, {
        ...createMeasurementDraft(toolType, [...nextConfirmedPoints, point]),
        labelLines: existingDraft.labelLines
      })
      emitMeasurementDraftPhase(viewportKey, toolType, DRAG_ACTION_TYPES.move, nextConfirmedPoints)
      return true
    }

    return false
  }

  function handleMeasurementInteractionPointerUp(
    state: ActiveMeasurementEditState,
    event?: PointerEvent,
    pointerTarget?: EventTarget | null
  ): boolean {
    void event
    const toolType = getMeasurementToolType()
    const viewportKey = state.viewportKey
    const draft = getDraftMeasurement(viewportKey)
    if (toolType && draft) {
      if ((state.kind === 'editing_handle' || state.kind === 'moving') && !state.hasChanged) {
        if (draft.measurementId) {
          setSelectedMeasurementState(viewportKey, draft.measurementId)
        } else {
          resetMeasurementInteraction()
        }
        stopViewportDrag(pointerTarget)
        return true
      }

      if (state.kind === 'creating') {
        releasePointerCapture(pointerTarget)
        return true
      }

      commitOrClearMeasurementDraft(viewportKey, toolType, draft)
    }

    stopViewportDrag(pointerTarget)
    return true
  }

  function startEditingExistingMtfHandle(
    pointerTarget: HTMLElement,
    pointerId: number,
    viewportKey: string,
    mtfItem: ViewerMtfItem,
    handleIndex: number
  ): void {
    setPointerCapture(pointerTarget, pointerId)
    mtfInteractionController.startEditingHandle(viewportKey, mtfItem.mtfId, handleIndex)
    updateMtfDraft(viewportKey, {
      mtfId: mtfItem.mtfId,
      points: mtfItem.points
    })
    setViewportCursor(viewportKey, 'cursor-pointer')
  }

  function startPendingMtfMove(
    pointerTarget: HTMLElement,
    pointerId: number,
    viewportKey: string,
    mtfItem: ViewerMtfItem,
    startPoint: MeasurementDraftPoint
  ): void {
    setPointerCapture(pointerTarget, pointerId)
    mtfInteractionController.startMovePending(viewportKey, mtfItem.mtfId, startPoint)
    updateMtfDraft(viewportKey, {
      mtfId: mtfItem.mtfId,
      points: mtfItem.points
    })
    setViewportCursor(viewportKey, 'cursor-move')
  }

  function startNewMtf(
    pointerTarget: HTMLElement,
    pointerId: number,
    viewportKey: string,
    point: MeasurementDraftPoint
  ): void {
    setPointerCapture(pointerTarget, pointerId)
    mtfInteractionController.startCreate(viewportKey)
    options.emitMtfSelect({ mtfId: null })
    clearMtfDraft(viewportKey)
    updateMtfDraft(viewportKey, {
      points: buildRectRoiDraftPoints(point, point)
    })
  }

  function handleMtfInteractionPointerUp(pointerTarget?: EventTarget | null): boolean {
    const interactionState = mtfInteraction.value
    if (
      interactionState.kind !== 'creating' &&
      interactionState.kind !== 'moving' &&
      interactionState.kind !== 'editing_handle'
    ) {
      return false
    }

    const viewportKey = interactionState.viewportKey
    const draft = getMtfDraft(viewportKey)
    if (draft) {
      if ((interactionState.kind === 'editing_handle' || interactionState.kind === 'moving') && !interactionState.hasChanged) {
        if (draft.mtfId) {
          mtfInteractionController.select(viewportKey, draft.mtfId)
          options.emitMtfSelect({ mtfId: draft.mtfId })
        } else {
          mtfInteractionController.reset()
        }
        stopViewportDrag(pointerTarget)
        return true
      }

      if (isValidMtfDraft(draft.points)) {
        options.emitMtfCommit({
          viewportKey,
          points: draft.points,
          mtfId: draft.mtfId
        })
        if (draft.mtfId) {
          clearMtfDraft(viewportKey)
          mtfInteractionController.select(viewportKey, draft.mtfId)
          options.emitMtfSelect({ mtfId: draft.mtfId })
        }
      } else if (draft.mtfId) {
        clearMtfDraft(viewportKey)
        mtfInteractionController.select(viewportKey, draft.mtfId)
        options.emitMtfSelect({ mtfId: draft.mtfId })
      } else {
        options.emitMtfSelect({ mtfId: null })
      }
    }

    stopViewportDrag(pointerTarget)
    return true
  }

  function handleMeasurementPointerMove(event: PointerEvent): boolean {
    const interactionState = measurementInteraction.value
    if (interactionState.kind === 'move_pending') {
      const context = resolveMeasurementPointerContext(event, interactionState.viewportKey)
      const currentDraft = draftMeasurements.value[interactionState.viewportKey]
      if (!context || !currentDraft) {
        return false
      }

      if (!hasRectRoiDragExceededThreshold(interactionState.startPoint, context.point, context.imageRect, DRAG_START_THRESHOLD)) {
        return true
      }

      measurementInteractionController.startMoving(interactionState.startPoint)
    }

    const currentMeasurementState = measurementInteraction.value
    if (
      currentMeasurementState.kind !== 'moving' &&
      currentMeasurementState.kind !== 'editing_handle' &&
      currentMeasurementState.kind !== 'creating'
    ) {
      return false
    }

    const toolType = getMeasurementToolType()
    const context = resolveMeasurementPointerContext(event, currentMeasurementState.viewportKey)
    if (!toolType || !context) {
      return true
    }

    handleActiveMeasurementEditMove(currentMeasurementState, toolType, context.point)
    return true
  }

  function isUncommittedMeasurementCreationActive(): boolean {
    const interactionState = measurementInteraction.value
    if (interactionState.kind !== 'creating') {
      return false
    }

    const draft = draftMeasurements.value[interactionState.viewportKey]
    return Boolean(draft && !draft.measurementId)
  }

  function handleMtfPointerMove(event: PointerEvent): boolean {
    const interactionState = mtfInteraction.value
    if (interactionState.kind === 'move_pending') {
      const context = resolveImageMeasurementPointerContext(event, interactionState.viewportKey)
      const currentDraft = getMtfDraft(interactionState.viewportKey)
      if (!context || !currentDraft) {
        return false
      }

      if (!hasRectRoiDragExceededThreshold(interactionState.startPoint, context.point, context.imageRect, DRAG_START_THRESHOLD)) {
        return true
      }

      mtfInteractionController.startMoving(interactionState.startPoint)
    }

    const currentState = mtfInteraction.value
    if (currentState.kind !== 'creating' && currentState.kind !== 'moving' && currentState.kind !== 'editing_handle') {
      return false
    }

    const context = resolveImageMeasurementPointerContext(event, currentState.viewportKey)
    const currentDraft = getMtfDraft(currentState.viewportKey)
    if (!context || !currentDraft) {
      return true
    }

    if (currentState.kind === 'moving') {
      const nextPoints = moveRectRoiDraftPoints(currentDraft.points, currentState.lastPoint, context.point)
      mtfInteractionController.markChanged()
      mtfInteractionController.updateLastPoint(context.point)
      updateMtfDraft(currentState.viewportKey, {
        ...currentDraft,
        points: nextPoints
      })
      return true
    }

    if (currentState.kind === 'editing_handle') {
      const nextPoints = editRectRoiDraftPoints(currentDraft.points, currentState.handleIndex, context.point)
      mtfInteractionController.markChanged()
      updateMtfDraft(currentState.viewportKey, {
        ...currentDraft,
        points: nextPoints
      })
      return true
    }

    updateMtfDraft(currentState.viewportKey, {
      ...currentDraft,
      points: buildRectRoiDraftPoints(currentDraft.points[0], context.point)
    })
    return true
  }

  function handleCrosshairPointerMove(event: PointerEvent): boolean {
    if (!isCrosshairDragging.value) {
      return false
    }

    if (crosshairDragMode.value === 'rotate') {
      const point = getNormalizedCrosshairPointerPoint(event)
      if (!point) {
        return true
      }
      emitThrottledCrosshairMove({
        viewportKey: crosshairPointerViewportKey.value,
        x: point.x,
        y: point.y,
        canvasX: point.canvasX,
        canvasY: point.canvasY,
        canvasWidth: point.canvasWidth,
        canvasHeight: point.canvasHeight,
        mode: 'rotate',
        line: crosshairRotationLine.value ?? undefined
      })
      return true
    }

    const point = getNormalizedCrosshairPointerPoint(event)
    if (!point) {
      return true
    }

    emitThrottledCrosshairMove({
      viewportKey: crosshairPointerViewportKey.value,
      x: point.x,
      y: point.y,
      canvasX: point.canvasX,
      canvasY: point.canvasY,
      canvasWidth: point.canvasWidth,
      canvasHeight: point.canvasHeight,
      mode: 'move'
    })
    return true
  }

  function handleViewportDragPointerMove(event: PointerEvent): boolean {
    if (!isViewportDragging.value) {
      return false
    }

    const deltaX = event.clientX - lastPointerX
    const deltaY = event.clientY - lastPointerY
    lastPointerX = event.clientX
    lastPointerY = event.clientY

    if (!deltaX && !deltaY) {
      return true
    }

    totalDeltaX += deltaX
    totalDeltaY += deltaY

    if (!hasSentDragStart) {
      const dragDistance = Math.max(Math.abs(totalDeltaX), Math.abs(totalDeltaY))
      if (dragDistance < DRAG_START_THRESHOLD) {
        return true
      }

      hasSentDragStart = true
      if (
        isRotate3dDragOperation() &&
        dragStartNormalizedPoint
      ) {
        options.emitViewportDrag({
          deltaX: dragStartNormalizedPoint.x,
          deltaY: dragStartNormalizedPoint.y,
          opType: VIEW_OPERATION_TYPES.rotate3d,
          phase: DRAG_ACTION_TYPES.start,
          viewportKey: dragViewportKey.value,
          canvasX: dragStartNormalizedPoint.canvasX,
          canvasY: dragStartNormalizedPoint.canvasY,
          canvasWidth: dragStartNormalizedPoint.canvasWidth,
          canvasHeight: dragStartNormalizedPoint.canvasHeight,
          interactionId: activeDragInteractionId ?? undefined
        })
      } else if (dragOperationType.value) {
        const point = dragStartNormalizedPoint
        options.emitViewportDrag({
          deltaX: 0,
          deltaY: 0,
          opType: dragOperationType.value,
          phase: DRAG_ACTION_TYPES.start,
          viewportKey: dragViewportKey.value,
          canvasX: point?.canvasX,
          canvasY: point?.canvasY,
          canvasWidth: point?.canvasWidth,
          canvasHeight: point?.canvasHeight,
          interactionId: activeDragInteractionId ?? undefined
        })
      }
    }

    if (isRotate3dDragOperation()) {
      const point = getViewportCanvasPoint(event)
      if (!point) {
        return true
      }
      lastDragNormalizedPoint = point
      emitViewportDragMove({
        deltaX: point.x,
        deltaY: point.y,
        opType: VIEW_OPERATION_TYPES.rotate3d,
        phase: DRAG_ACTION_TYPES.move,
        viewportKey: dragViewportKey.value,
        canvasX: point.canvasX,
        canvasY: point.canvasY,
        canvasWidth: point.canvasWidth,
        canvasHeight: point.canvasHeight,
        interactionId: activeDragInteractionId ?? undefined
      })
      return true
    }

    if (dragOperationType.value) {
      const point = getViewportCanvasPoint(event)
      if (point) {
        lastDragNormalizedPoint = point
      }
      emitViewportDragMove({
        deltaX: dragOperationType.value === VIEW_OPERATION_TYPES.scroll ? deltaX : totalDeltaX,
        deltaY: dragOperationType.value === VIEW_OPERATION_TYPES.scroll ? deltaY : totalDeltaY,
        opType: dragOperationType.value,
        phase: DRAG_ACTION_TYPES.move,
        viewportKey: dragViewportKey.value,
        canvasX: point?.canvasX,
        canvasY: point?.canvasY,
        canvasWidth: point?.canvasWidth,
        canvasHeight: point?.canvasHeight,
        interactionId: activeDragInteractionId ?? undefined
      })
    }

    return true
  }

  function handleMeasurementPointerDown(event: PointerEvent, viewportKey: string, pointerTarget: HTMLElement): boolean {
    const toolType = getMeasurementToolType()
    const context = resolveMeasurementPointerContext(event, viewportKey)
    if (!toolType || !context) {
      return false
    }

    event.preventDefault()
    setActiveViewport(viewportKey)

    const existingDraft = getDraftMeasurement(viewportKey)
    if (
      toolType === 'angle' &&
      existingDraft &&
      !existingDraft.measurementId &&
      existingDraft.toolType === toolType &&
      existingDraft.points.length
    ) {
      const anchorPoint = existingDraft.points[0]
      const vertexPoint = existingDraft.points[1]
      measurementInteractionController.startCreate(viewportKey, toolType)

      if (anchorPoint && existingDraft.points.length < 3) {
        if (vertexPoint && !isValidMeasurement('line', [anchorPoint, vertexPoint])) {
          clearDraftMeasurement(viewportKey)
          resetMeasurementInteraction()
          return true
        }

        const nextDraft = {
          ...createMeasurementDraft(toolType, [anchorPoint, context.point, context.point]),
          labelLines: existingDraft.labelLines
        }
        updateDraftMeasurement(viewportKey, nextDraft)
        emitMeasurementDraftPhase(viewportKey, toolType, DRAG_ACTION_TYPES.end, [anchorPoint, context.point])
        return true
      }

      if (anchorPoint && vertexPoint) {
        commitMeasurementDraftFromClick(viewportKey, toolType, {
          ...createMeasurementDraft(toolType, [anchorPoint, vertexPoint, context.point]),
          labelLines: existingDraft.labelLines
        })
        return true
      }
    }

    if (finishSelectedPointSequenceDraftOnDoubleClick(viewportKey, toolType, context.point, existingDraft, event)) {
      return true
    }

    if (confirmExistingMeasurementDraftPoint(viewportKey, toolType, context.point, existingDraft, event)) {
      return true
    }

    const intent = resolveMeasurementPointerDownIntent({
      committedMeasurements: options.getCommittedMeasurements(viewportKey),
      existingDraft,
      point: context.point,
      rect: context.imageRect
    })

    if (intent.kind === 'edit_handle' && existingDraft?.measurementId) {
      startEditingExistingHandle(pointerTarget, event.pointerId, viewportKey, toolType, existingDraft, intent.handleIndex)
      return true
    }

    if (intent.kind === 'select_committed') {
      selectCommittedMeasurement(viewportKey, intent.measurement)
      return true
    }

    if (intent.kind === 'move_draft' && existingDraft?.measurementId) {
      startPendingMeasurementMove(pointerTarget, event.pointerId, viewportKey, existingDraft.measurementId, context.point)
      return true
    }

    if (intent.kind === 'clear_draft') {
      clearDraftMeasurement(viewportKey)
      resetMeasurementInteraction()
      return true
    }

    startNewMeasurement(pointerTarget, event.pointerId, viewportKey, toolType, context.point, existingDraft)
    return true
  }

  function handleMtfPointerDown(event: PointerEvent, viewportKey: string, pointerTarget: HTMLElement): boolean {
    if (!isMtfOperationEnabled()) {
      return false
    }

    const context = resolveImageMeasurementPointerContext(event, viewportKey)
    if (!context) {
      return false
    }

    event.preventDefault()
    setActiveViewport(viewportKey)
    const selectedMtf = getSelectedMtf(viewportKey)
    const intent = resolveMtfPointerDownIntent({
      items: options.getMtfItems(viewportKey),
      selectedItem: selectedMtf,
      point: context.point,
      rect: context.imageRect
    })

    if (intent.kind === 'edit_handle' && selectedMtf) {
      startEditingExistingMtfHandle(pointerTarget, event.pointerId, viewportKey, selectedMtf, intent.handleIndex)
      return true
    }

    if (intent.kind === 'select_item') {
      mtfInteractionController.select(viewportKey, intent.item.mtfId)
      options.emitMtfSelect({ mtfId: intent.item.mtfId })
      clearMtfDraft(viewportKey)
      setViewportCursor(viewportKey, 'cursor-move')
      return true
    }

    if (intent.kind === 'move_selected' && selectedMtf) {
      startPendingMtfMove(pointerTarget, event.pointerId, viewportKey, selectedMtf, context.point)
      return true
    }

    startNewMtf(pointerTarget, event.pointerId, viewportKey, context.point)
    return true
  }

  function handleCrosshairPointerDown(event: PointerEvent, viewportKey: string, pointerTarget: HTMLElement): boolean {
    const isCrosshairToolActive = isCrosshairOperationEnabled()
    const isDirectFourDHitEnabled = isFourDDirectCrosshairEnabled()
    if (!isCrosshairToolActive && !isDirectFourDHitEnabled) {
      return false
    }

    setActiveViewport(viewportKey)
    const point = getNormalizedContainerPoint(event)
    if (!point) {
      return true
    }
    const hitTarget = resolveCrosshairHitTarget(event, viewportKey, point)
    if (hitTarget === 'none') {
      return false
    }
    event.preventDefault()
    setPointerCapture(pointerTarget, event.pointerId)
    isCrosshairDragging.value = true
    crosshairPointerViewportKey.value = viewportKey
    if (hitTarget === 'horizontal' || hitTarget === 'vertical') {
      crosshairDragMode.value = 'rotate'
      crosshairRotationLine.value = hitTarget
      emitCrosshairEvent(viewportKey, DRAG_ACTION_TYPES.start, event, 'rotate', hitTarget)
      return true
    }

    crosshairDragMode.value = 'move'
    crosshairRotationLine.value = null
    emitCrosshairEvent(viewportKey, DRAG_ACTION_TYPES.start, event)
    return true
  }

  function handleViewportDragPointerDown(event: PointerEvent, viewportKey: string, pointerTarget: HTMLElement): boolean {
    const operationType = resolveViewportDragOperation(viewportKey, event.button)
    if (!operationType) {
      return false
    }

    event.preventDefault()
    setPointerCapture(pointerTarget, event.pointerId)
    setActiveViewport(viewportKey)
    dragViewportKey.value = viewportKey
    dragOperationType.value = operationType
    isViewportDragging.value = true
    const dragCursorClass = getViewportDragCursorClass(operationType)
    if (dragCursorClass) {
      setViewportCursor(viewportKey, dragCursorClass)
    }
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    totalDeltaX = 0
    totalDeltaY = 0
    hasSentDragStart = false
    dragStartNormalizedPoint = getViewportCanvasPoint(event)
    lastDragNormalizedPoint = dragStartNormalizedPoint
    activeDragInteractionId = createDragInteractionId(operationType)
    return true
  }

  function captureViewportReleasePoint(event: PointerEvent): void {
    if (!isViewportDragging.value || !hasSentDragStart || !dragOperationType.value) {
      return
    }
    const point = getViewportCanvasPoint(event)
    if (!point) {
      return
    }
    lastDragNormalizedPoint = point
    if (!isRotate3dDragOperation()) {
      totalDeltaX += event.clientX - lastPointerX
      totalDeltaY += event.clientY - lastPointerY
      lastPointerX = event.clientX
      lastPointerY = event.clientY
    }
  }

  function handleViewportPointerMove(event: PointerEvent): void {
    if (activePointerId.value !== event.pointerId) {
      if (isUncommittedMeasurementCreationActive() && handleMeasurementPointerMove(event)) {
        return
      }
      if (event.buttons === 0) {
        const viewportKey = resolveViewportKeyFromEvent(event)
        if (viewportKey && isVolumeClipOperationEnabled(viewportKey)) {
          setViewportCursor(viewportKey, 'cursor-crosshair')
        } else if (isCrosshairOperationEnabled()) {
          updateCrosshairHoverCursor(event)
        } else if (isMtfOperationEnabled()) {
          updateMtfHoverCursor(event)
        } else {
          updateMeasurementHoverCursor(event)
        }
      }
      return
    }

    event.preventDefault()

    if (handleVolumeClipPointerMove(event)) {
      return
    }

    if (handleMtfPointerMove(event)) {
      return
    }

    if (handleMeasurementPointerMove(event)) {
      return
    }

    if (handleCrosshairPointerMove(event)) {
      return
    }

    if (!handleViewportDragPointerMove(event)) {
      if (event.buttons === 0) {
        const viewportKey = resolveViewportKeyFromEvent(event)
        if (viewportKey && isVolumeClipOperationEnabled(viewportKey)) {
          setViewportCursor(viewportKey, 'cursor-crosshair')
        } else if (isCrosshairOperationEnabled()) {
          updateCrosshairHoverCursor(event)
        } else if (isMtfOperationEnabled()) {
          updateMtfHoverCursor(event)
        } else {
          updateMeasurementHoverCursor(event)
        }
      }
    }
  }

  function handleUncapturedMeasurementCreationPointerUp(event: PointerEvent): boolean {
    const interactionState = measurementInteraction.value
    if (interactionState.kind !== 'creating') {
      return false
    }

    const toolType = getMeasurementToolType()
    const draft = getDraftMeasurement(interactionState.viewportKey)
    if (!toolType || !draft || toolType === 'angle' || isPointSequenceMeasurement(toolType)) {
      return false
    }

    if (toolType === 'line' && !isValidMeasurement(toolType, draft.points)) {
      return false
    }

    event.preventDefault()
    commitOrClearMeasurementDraft(interactionState.viewportKey, toolType, draft)
    stopViewportDrag(event.currentTarget)
    return true
  }

  function handleViewportPointerUp(event: PointerEvent): void {
    if (activePointerId.value !== event.pointerId) {
      if (handleUncapturedMeasurementCreationPointerUp(event)) {
        return
      }
      return
    }

    event.preventDefault()

    if (handleVolumeClipPointerUp(event, event.currentTarget)) {
      return
    }

    if (handleMtfInteractionPointerUp(event.currentTarget)) {
      return
    }

    const interactionState = measurementInteraction.value
    if (interactionState.kind === 'move_pending') {
      setSelectedMeasurementState(interactionState.viewportKey, interactionState.measurementId)
      stopViewportDrag(event.currentTarget)
      return
    }

    if (interactionState.kind === 'editing_handle' || interactionState.kind === 'moving' || interactionState.kind === 'creating') {
      handleMeasurementInteractionPointerUp(interactionState, event, event.currentTarget)
      return
    }

    if (isCrosshairDragging.value) {
      emitThrottledCrosshairMove.cancel()
      emitCrosshairEvent(
        crosshairPointerViewportKey.value,
        DRAG_ACTION_TYPES.end,
        event,
        crosshairDragMode.value,
        crosshairRotationLine.value
      )
    }
    captureViewportReleasePoint(event)
    stopViewportDrag(event.currentTarget)
  }

  function handleViewportPointerCancel(event: PointerEvent): void {
    if (activePointerId.value !== event.pointerId) {
      return
    }

    if (isCrosshairDragging.value) {
      emitThrottledCrosshairMove.cancel()
      emitCrosshairEvent(
        crosshairPointerViewportKey.value,
        DRAG_ACTION_TYPES.end,
        event,
        crosshairDragMode.value,
        crosshairRotationLine.value
      )
    }

    if (cancelVolumeClipPointerInteraction(event.currentTarget)) {
      return
    }

    if (isCapturedMtfInteraction(mtfInteraction.value)) {
      stopViewportDrag(event.currentTarget)
      return
    }

    const interactionState = measurementInteraction.value
    if (isCapturedMeasurementInteraction(interactionState)) {
      clearDraftMeasurement(interactionState.viewportKey)
      stopViewportDrag(event.currentTarget)
      return
    }
    stopViewportDrag(event.currentTarget)
  }

  function handleViewportPointerLeave(viewportKey: string): void {
    clearViewportCursor(viewportKey)
  }

  function handleViewportPointerDown(event: PointerEvent, viewportKey: string): void {
    if (!event.isPrimary || (event.button !== POINTER_BUTTON_LEFT && event.button !== POINTER_BUTTON_RIGHT)) {
      return
    }
    const context = resolveBasicPointerContext(event, viewportKey)
    if (!context) {
      return
    }

    if (event.button === POINTER_BUTTON_RIGHT) {
      handleViewportDragPointerDown(event, viewportKey, context.pointerTarget)
      return
    }

    if (isMeasurementOperationEnabled() && handleMeasurementPointerDown(event, viewportKey, context.pointerTarget)) {
      return
    }

    if (handleVolumeClipPointerDown(event, viewportKey, context.pointerTarget)) {
      return
    }

    if (handleMtfPointerDown(event, viewportKey, context.pointerTarget)) {
      return
    }

    if (handleCrosshairPointerDown(event, viewportKey, context.pointerTarget)) {
      return
    }

    handleViewportDragPointerDown(event, viewportKey, context.pointerTarget)
  }

  function cleanupPointerInteractions(): void {
    cancelViewportDragMoves()
    emitThrottledCrosshairMove.cancel()
    emitThrottledMeasurementDraft.cancel()
    viewportCursorClasses.value = {}
    lastPointSequenceClick = null
    cancelVolumeClipPointerInteraction()
    stopViewportDrag()
    clearDraftMeasurement()
    clearMtfDraft()
    resetMeasurementInteraction()
    mtfInteractionController.reset()
  }

  return {
    activeViewportKey,
    clearDrawingDrafts: cleanupPointerInteractions,
    cleanupPointerInteractions,
    copySelectedMtf,
    copySelectedMeasurement,
    deleteSelectedMtf,
    deleteSelectedMeasurement,
    finishPointSequenceMeasurement,
    draftMeasurements,
    getMtfDraft,
    getMtfDraftMode,
    getDraftMeasurementMode,
    getViewportIdleCursorClass,
    handleViewportPointerCancel,
    handleViewportPointerLeave,
    handleViewportPointerDown,
    handleViewportPointerMove,
    handleViewportPointerUp,
    setActiveViewport,
    stopViewportDrag,
    updateDraftMeasurementLabelLines,
    viewportCursorClasses
  }
}
