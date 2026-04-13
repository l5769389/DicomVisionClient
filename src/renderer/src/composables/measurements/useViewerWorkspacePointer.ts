import { ref, type Ref } from 'vue'
import throttle from 'lodash/throttle'
import { DRAG_ACTION_TYPES, STACK_DRAG_OPERATIONS, type ViewOperationType, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type {
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementDraftPoint,
  MeasurementOverlay,
  MeasurementToolType,
  MprCrosshairInfo,
  MprViewportKey,
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
import {
  createMeasurementInteractionController,
  resolveDraftMeasurementMode,
  type MeasurementInteractionState
} from './measurementInteractionMachine'

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
  emitMeasurementCreate: (payload: { viewportKey: string; toolType: MeasurementToolType; points: MeasurementDraftPoint[]; measurementId?: string }) => void
  emitMeasurementDelete: (payload: { viewportKey: string; measurementId: string }) => void
  emitMprCrosshair: (payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }) => void
  emitViewportDrag: (payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'start' | 'move' | 'end'
    viewportKey: string
  }) => void
  getCommittedMeasurements: (viewportKey: string) => MeasurementOverlay[]
}

interface PointerComposableState {
  activeViewportKey: Ref<MprViewportKey | 'single' | 'volume'>
  cleanupPointerInteractions: () => void
  copySelectedMeasurement: (viewportKey?: string) => boolean
  deleteSelectedMeasurement: (viewportKey?: string) => boolean
  draftMeasurements: Ref<Partial<Record<string, MeasurementDraft | null>>>
  getDraftMeasurementMode: (viewportKey: string) => DraftMeasurementMode | null
  handleViewportPointerCancel: (event: PointerEvent) => void
  handleViewportPointerLeave: (viewportKey: string) => void
  handleViewportPointerDown: (event: PointerEvent, viewportKey: string) => void
  handleViewportPointerMove: (event: PointerEvent) => void
  handleViewportPointerUp: (event: PointerEvent) => void
  setActiveViewport: (viewportKey: MprViewportKey | 'single' | 'volume') => void
  stopViewportDrag: (pointerTarget?: EventTarget | null) => void
  updateDraftMeasurementLabelLines: (viewportKey: string, labelLines: string[]) => void
  viewportCursorClasses: Ref<Partial<Record<string, string>>>
}

interface BasicPointerContext {
  pointerTarget: HTMLElement
  viewportKey: string
}

interface MeasurementPointerContext extends BasicPointerContext {
  imageElement: HTMLImageElement
  imageRect: DOMRect
  point: MeasurementDraftPoint
}

const DRAG_START_THRESHOLD = 3

function getCrosshairCenter(crosshairInfo: MprCrosshairInfo): { x: number; y: number } {
  return {
    x: crosshairInfo.verticalPosition ?? crosshairInfo.centerX,
    y: crosshairInfo.horizontalPosition ?? crosshairInfo.centerY
  }
}

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

function offsetMeasurementPoints(points: MeasurementDraftPoint[], delta: number): MeasurementDraftPoint[] {
  const shiftedPoints = points.map((point) =>
    clampNormalizedPoint({
      x: point.x + delta,
      y: point.y + delta
    })
  )

  const changed = shiftedPoints.some((point, index) => point.x !== points[index]?.x || point.y !== points[index]?.y)
  if (changed) {
    return shiftedPoints
  }

  return points.map((point) =>
    clampNormalizedPoint({
      x: point.x - delta,
      y: point.y - delta
    })
  )
}

function arePointSetsClose(a: MeasurementDraftPoint[], b: MeasurementDraftPoint[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((point, index) => {
    const otherPoint = b[index]
    return (
      otherPoint != null &&
      Math.abs(point.x - otherPoint.x) < 0.0005 &&
      Math.abs(point.y - otherPoint.y) < 0.0005
    )
  })
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

type ActiveMeasurementEditState = Extract<
  MeasurementInteractionState,
  { kind: 'creating' } | { kind: 'moving' } | { kind: 'editing_handle' }
>

export function useViewerWorkspacePointer(options: PointerComposableOptions): PointerComposableState {
  const measurementInteractionController = createMeasurementInteractionController()
  const activeViewportKey = ref<MprViewportKey | 'single' | 'volume'>('mpr-ax')
  const crosshairPointerViewportKey = ref('')
  const dragViewportKey = ref('')
  const dragOperationType = ref<ViewOperationType | null>(null)
  const draftMeasurements = ref<Partial<Record<string, MeasurementDraft | null>>>({})
  const viewportCursorClasses = ref<Partial<Record<string, string>>>({})
  const measurementInteraction = ref<MeasurementInteractionState>(measurementInteractionController.getState())
  const isCrosshairDragging = ref(false)
  const isViewportDragging = ref(false)
  const activePointerId = ref<number | null>(null)

  let lastPointerX = 0
  let lastPointerY = 0
  let totalDeltaX = 0
  let totalDeltaY = 0
  let hasSentDragStart = false
  let dragStartNormalizedPoint: { x: number; y: number } | null = null
  let lastDragNormalizedPoint: { x: number; y: number } | null = null

  const emitThrottledViewportDrag = throttle(
    (payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'move'; viewportKey: string }) => {
      options.emitViewportDrag(payload)
    },
    30,
    { leading: true, trailing: true }
  )

  const emitThrottledCrosshairMove = throttle(
    (payload: { viewportKey: string; x: number; y: number }) => {
      options.emitMprCrosshair({
        viewportKey: payload.viewportKey,
        phase: DRAG_ACTION_TYPES.move,
        x: payload.x,
        y: payload.y
      })
    },
    30,
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
    30,
    { leading: true, trailing: true }
  )

  // 把当前这根 “手指 / 鼠标” 强行锁定在当前元素上，无论你滑到哪里，事件都只发给这个元素。
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

  function setActiveViewport(viewportKey: MprViewportKey | 'single' | 'volume'): void {
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
    setViewportCursor(viewportKey, 'cursor-auto')
  }

  function getNormalizedOperation(): ViewOperationType | string {
    return options.activeOperation.value.startsWith('stack:')
      ? options.activeOperation.value.slice('stack:'.length).split(':')[0]
      : options.activeOperation.value.split(':')[0]
  }

  function getMeasurementToolType(): MeasurementToolType | null {
    const normalized = options.activeOperation.value.startsWith('stack:')
      ? options.activeOperation.value.slice('stack:'.length)
      : options.activeOperation.value
    const [toolKey, toolType] = normalized.split(':')
    if (toolKey !== 'measure') {
      return null
    }
    if (toolType === 'line' || toolType === 'rect' || toolType === 'ellipse' || toolType === 'angle') {
      return toolType
    }
    return null
  }

  function isCrosshairOperationEnabled(): boolean {
    return options.activeTab.value?.viewType === 'MPR' && getNormalizedOperation() === VIEW_OPERATION_TYPES.crosshair
  }

  function isMeasurementOperationEnabled(): boolean {
    return (options.activeTab.value?.viewType === 'Stack' || options.activeTab.value?.viewType === 'MPR') && getMeasurementToolType() != null
  }

  function isMouseDragOperationEnabled(): boolean {
    return STACK_DRAG_OPERATIONS.includes(getNormalizedOperation() as (typeof STACK_DRAG_OPERATIONS)[number])
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

  function resolveMeasurementPointerContext(
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

  function emitCrosshairEvent(viewportKey: string, phase: 'start' | 'move' | 'end', event: PointerEvent): void {
    const point = getNormalizedViewportPoint(event)
    if (!point) {
      return
    }

    options.emitMprCrosshair({
      viewportKey,
      phase,
      x: point.x,
      y: point.y
    })
  }

  function isPointNearCrosshairCenter(
    event: PointerEvent,
    viewportKey: string,
    point: { x: number; y: number }
  ): boolean {
    const crosshairInfo =
      viewportKey === 'single' || viewportKey === 'volume'
        ? null
        : options.activeTab.value?.viewportCrosshairs?.[viewportKey as MprViewportKey] ?? null

    if (!crosshairInfo) {
      return false
    }

    const renderedImage = resolveViewportImageElement(event)
    if (!renderedImage) {
      return false
    }

    const rect = getRenderedImageRect(renderedImage)
    const center = getCrosshairCenter(crosshairInfo)
    const hitRadius = crosshairInfo.hitRadius * Math.min(rect.width, rect.height)
    const deltaX = (point.x - center.x) * rect.width
    const deltaY = (point.y - center.y) * rect.height
    return deltaX * deltaX + deltaY * deltaY <= hitRadius * hitRadius
  }

  function getDraftMeasurement(viewportKey: string): MeasurementDraft | null {
    return draftMeasurements.value[viewportKey] ?? null
  }

  function clearDraftMeasurement(viewportKey?: string): void {
    if (!viewportKey) {
      draftMeasurements.value = {}
      return
    }
    draftMeasurements.value = {
      ...draftMeasurements.value,
      [viewportKey]: null
    }
  }

  function updateDraftMeasurement(viewportKey: string, draft: MeasurementDraft): void {
    draftMeasurements.value = {
      ...draftMeasurements.value,
      [viewportKey]: draft
    }
  }

  function syncMeasurementInteractionState(): MeasurementInteractionState {
    const nextState = measurementInteractionController.getState()
    measurementInteraction.value = nextState
    return nextState
  }

  function getDraftMeasurementMode(viewportKey: string): DraftMeasurementMode | null {
    const draft = draftMeasurements.value[viewportKey]
    if (!draft) {
      return null
    }
    return resolveDraftMeasurementMode(measurementInteraction.value, viewportKey, Boolean(draft.measurementId))
  }

  function updateDraftMeasurementLabelLines(viewportKey: string, labelLines: string[]): void {
    const draft = draftMeasurements.value[viewportKey]
    if (!draft) {
      return
    }
    updateDraftMeasurement(viewportKey, {
      ...draft,
      labelLines
    })
  }

  function setSelectedMeasurementState(viewportKey: string, measurementId: string): void {
    measurementInteractionController.select(viewportKey, measurementId)
    syncMeasurementInteractionState()
  }

  function resetMeasurementInteraction(): void {
    measurementInteractionController.reset()
    syncMeasurementInteractionState()
  }

  function resolveSelectedMeasurementDraft(viewportKey?: string): { viewportKey: string; draft: MeasurementDraft } | null {
    const interactionState = measurementInteraction.value
    if (interactionState.kind !== 'selected') {
      return null
    }

    const targetViewportKey = viewportKey ?? interactionState.viewportKey
    if (interactionState.viewportKey !== targetViewportKey) {
      return null
    }

    const draft = getDraftMeasurement(targetViewportKey)
    if (!draft?.measurementId) {
      return null
    }

    return {
      viewportKey: targetViewportKey,
      draft
    }
  }

  function copySelectedMeasurement(viewportKey?: string): boolean {
    const selected = resolveSelectedMeasurementDraft(viewportKey)
    if (!selected) {
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
      measurementId: copiedMeasurementId
    })
    return true
  }

  function deleteSelectedMeasurement(viewportKey?: string): boolean {
    const selected = resolveSelectedMeasurementDraft(viewportKey)
    if (!selected?.draft.measurementId) {
      return false
    }

    options.emitMeasurementDelete({
      viewportKey: selected.viewportKey,
      measurementId: selected.draft.measurementId
    })
    clearDraftMeasurement(selected.viewportKey)
    resetMeasurementInteraction()
    clearViewportCursor(selected.viewportKey)
    return true
  }

  function stopViewportDrag(pointerTarget?: EventTarget | null): void {
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
      crosshairPointerViewportKey.value = ''
      releasePointerCapture(pointerTarget)
    }

    if (!isViewportDragging.value) {
      return
    }

    emitThrottledViewportDrag.flush()

    if (hasSentDragStart) {
      if (dragOperationType.value && dragViewportKey.value === 'volume' && dragOperationType.value === VIEW_OPERATION_TYPES.rotate3d && lastDragNormalizedPoint) {
        options.emitViewportDrag({
          deltaX: lastDragNormalizedPoint.x,
          deltaY: lastDragNormalizedPoint.y,
          opType: dragOperationType.value,
          phase: DRAG_ACTION_TYPES.end,
          viewportKey: dragViewportKey.value
        })
      } else if (dragOperationType.value) {
        options.emitViewportDrag({
          deltaX: 0,
          deltaY: 0,
          opType: dragOperationType.value,
          phase: DRAG_ACTION_TYPES.end,
          viewportKey: dragViewportKey.value
        })
      }
    }

    isViewportDragging.value = false
    dragViewportKey.value = ''
    totalDeltaX = 0
    totalDeltaY = 0
    hasSentDragStart = false
    dragStartNormalizedPoint = null
    lastDragNormalizedPoint = null
    dragOperationType.value = null
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

    const point = getNormalizedViewportPoint(event)
    const imageElement = resolveViewportImageElement(event)
    if (!point || !imageElement) {
      clearViewportCursor(viewportKey)
      return
    }

    const imageRect = getRenderedImageRect(imageElement)
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
    syncMeasurementInteractionState()
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
    syncMeasurementInteractionState()
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
    setPointerCapture(pointerTarget, pointerId)
    measurementInteractionController.startCreate(viewportKey, toolType)
    syncMeasurementInteractionState()

    if (toolType === 'angle' && existingDraft?.toolType === 'angle' && existingDraft.points.length === 2) {
      const nextDraft = createMeasurementDraft(toolType, [existingDraft.points[0], existingDraft.points[1], point])
      updateDraftMeasurement(viewportKey, nextDraft)
      emitMeasurementDraftPhase(viewportKey, toolType, DRAG_ACTION_TYPES.start, nextDraft.points)
      return
    }

    const nextDraft = createMeasurementDraft(toolType, [point, point])
    updateDraftMeasurement(viewportKey, nextDraft)
    emitMeasurementDraftPhase(viewportKey, toolType, DRAG_ACTION_TYPES.start, nextDraft.points)
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
    options.emitMeasurementCreate({
      viewportKey,
      toolType,
      points: draft.points,
      measurementId: draft.measurementId
    })

    if (draft.measurementId) {
      setSelectedMeasurementState(viewportKey, draft.measurementId)
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
      const nextPoints = translateMeasurementPoints(
        currentDraft.points,
        point.x - state.lastPoint.x,
        point.y - state.lastPoint.y
      )
      measurementInteractionController.markChanged()
      measurementInteractionController.updateLastPoint(point)
      syncMeasurementInteractionState()
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
      const nextPoints = updateEditedMeasurementPoints(
        toolType,
        currentDraft.points,
        state.handleIndex,
        point
      )
      measurementInteractionController.markChanged()
      syncMeasurementInteractionState()
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

    const nextDraft = createMeasurementDraft(toolType, [currentDraft.points[0], point])
    updateDraftMeasurement(state.viewportKey, nextDraft)
    emitThrottledMeasurementDraft({
      viewportKey: state.viewportKey,
      toolType,
      points: nextDraft.points
    })
    return true
  }

  function handleMeasurementInteractionPointerUp(
    state: ActiveMeasurementEditState,
    pointerTarget?: EventTarget | null
  ): boolean {
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

      commitOrClearMeasurementDraft(viewportKey, toolType, draft)
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

      const movementX = (context.point.x - interactionState.startPoint.x) * context.imageRect.width
      const movementY = (context.point.y - interactionState.startPoint.y) * context.imageRect.height
      if (Math.max(Math.abs(movementX), Math.abs(movementY)) < DRAG_START_THRESHOLD) {
        return true
      }

      measurementInteractionController.startMoving(interactionState.startPoint)
      syncMeasurementInteractionState()
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

  function handleCrosshairPointerMove(event: PointerEvent): boolean {
    if (!isCrosshairDragging.value) {
      return false
    }

    const point = getNormalizedViewportPoint(event)
    if (!point) {
      return true
    }

    emitThrottledCrosshairMove({
      viewportKey: crosshairPointerViewportKey.value,
      x: point.x,
      y: point.y
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
        dragOperationType.value === VIEW_OPERATION_TYPES.rotate3d &&
        dragViewportKey.value === 'volume' &&
        dragStartNormalizedPoint
      ) {
        options.emitViewportDrag({
          deltaX: dragStartNormalizedPoint.x,
          deltaY: dragStartNormalizedPoint.y,
          opType: dragOperationType.value,
          phase: DRAG_ACTION_TYPES.start,
          viewportKey: dragViewportKey.value
        })
      } else if (dragOperationType.value) {
        options.emitViewportDrag({
          deltaX: 0,
          deltaY: 0,
          opType: dragOperationType.value,
          phase: DRAG_ACTION_TYPES.start,
          viewportKey: dragViewportKey.value
        })
      }
    }

    if (dragOperationType.value === VIEW_OPERATION_TYPES.rotate3d && dragViewportKey.value === 'volume') {
      const point = getNormalizedContainerPoint(event)
      if (!point) {
        return true
      }
      lastDragNormalizedPoint = point
      emitThrottledViewportDrag({
        deltaX: point.x,
        deltaY: point.y,
        opType: dragOperationType.value,
        phase: DRAG_ACTION_TYPES.move,
        viewportKey: dragViewportKey.value
      })
      return true
    }

    if (dragOperationType.value) {
      emitThrottledViewportDrag({
        deltaX: totalDeltaX,
        deltaY: totalDeltaY,
        opType: dragOperationType.value,
        phase: DRAG_ACTION_TYPES.move,
        viewportKey: dragViewportKey.value
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
    setActiveViewport(viewportKey as MprViewportKey | 'single' | 'volume')

    const existingDraft = getDraftMeasurement(viewportKey)
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

  function handleCrosshairPointerDown(event: PointerEvent, viewportKey: string, pointerTarget: HTMLElement): boolean {
    if (!isCrosshairOperationEnabled()) {
      return false
    }

    setActiveViewport(viewportKey as MprViewportKey | 'single' | 'volume')
    const point = getNormalizedViewportPoint(event)
    if (!point || !isPointNearCrosshairCenter(event, viewportKey, point)) {
      return true
    }

    event.preventDefault()
    setPointerCapture(pointerTarget, event.pointerId)
    isCrosshairDragging.value = true
    crosshairPointerViewportKey.value = viewportKey
    emitCrosshairEvent(viewportKey, DRAG_ACTION_TYPES.start, event)
    return true
  }

  function handleViewportDragPointerDown(event: PointerEvent, viewportKey: string, pointerTarget: HTMLElement): boolean {
    if (!isMouseDragOperationEnabled()) {
      return false
    }

    event.preventDefault()
    setPointerCapture(pointerTarget, event.pointerId)
    setActiveViewport(viewportKey as MprViewportKey | 'single' | 'volume')
    dragViewportKey.value = viewportKey
    dragOperationType.value = getNormalizedOperation() as ViewOperationType
    isViewportDragging.value = true
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    totalDeltaX = 0
    totalDeltaY = 0
    hasSentDragStart = false
    dragStartNormalizedPoint =
      viewportKey === 'volume' && dragOperationType.value === VIEW_OPERATION_TYPES.rotate3d
        ? getNormalizedContainerPoint(event)
        : null
    lastDragNormalizedPoint = dragStartNormalizedPoint
    return true
  }

  function handleViewportPointerMove(event: PointerEvent): void {
    if (activePointerId.value !== event.pointerId) {
      if (event.buttons === 0) {
        updateMeasurementHoverCursor(event)
      }
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
        updateMeasurementHoverCursor(event)
      }
    }
  }

  function handleViewportPointerUp(event: PointerEvent): void {
    if (activePointerId.value !== event.pointerId) {
      return
    }

    const interactionState = measurementInteraction.value
    if (interactionState.kind === 'move_pending') {
      setSelectedMeasurementState(interactionState.viewportKey, interactionState.measurementId)
      stopViewportDrag(event.currentTarget)
      return
    }

    if (interactionState.kind === 'editing_handle' || interactionState.kind === 'moving' || interactionState.kind === 'creating') {
      handleMeasurementInteractionPointerUp(interactionState, event.currentTarget)
      return
    }

    if (isCrosshairDragging.value) {
      emitThrottledCrosshairMove.flush()
      emitCrosshairEvent(crosshairPointerViewportKey.value, DRAG_ACTION_TYPES.end, event)
    }
    stopViewportDrag(event.currentTarget)
  }

  function handleViewportPointerCancel(event: PointerEvent): void {
    if (activePointerId.value !== event.pointerId) {
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
    if (!event.isPrimary || event.button !== 0) {
      return
    }
    const context = resolveBasicPointerContext(event, viewportKey)
    if (!context) {
      return
    }

    if (isMeasurementOperationEnabled() && handleMeasurementPointerDown(event, viewportKey, context.pointerTarget)) {
      return
    }

    if (handleCrosshairPointerDown(event, viewportKey, context.pointerTarget)) {
      return
    }

    handleViewportDragPointerDown(event, viewportKey, context.pointerTarget)
  }

  function cleanupPointerInteractions(): void {
    emitThrottledViewportDrag.cancel()
    emitThrottledCrosshairMove.cancel()
    emitThrottledMeasurementDraft.cancel()
    viewportCursorClasses.value = {}
    stopViewportDrag()
    clearDraftMeasurement()
    resetMeasurementInteraction()
  }

  return {
    activeViewportKey,
    cleanupPointerInteractions,
    copySelectedMeasurement,
    deleteSelectedMeasurement,
    draftMeasurements,
    getDraftMeasurementMode,
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
