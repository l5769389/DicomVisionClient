import { ref, watch, type ComputedRef, type Ref } from 'vue'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  AnnotationSize,
  MeasurementDraftPoint,
  ViewerTabItem
} from '../../../types/viewer'
import {
  findArrowAnnotationAtPoint,
  isValidArrowAnnotation,
  translateAnnotationPoints,
  updateEditedArrowPoints
} from '../../annotations/annotationGeometry'
import { isMprLikeViewType } from '../views/viewerViewportTargets'

const DEFAULT_ANNOTATION_TEXT = ''
const DEFAULT_ANNOTATION_COLOR = '#ffd166'
const DEFAULT_ANNOTATION_SIZE: AnnotationSize = 'md'
const ANNOTATION_DRAG_START_THRESHOLD = 3
const ANNOTATION_POINT_CLOSE_EPSILON = 0.0005

type AnnotationInteractionState =
  | { kind: 'idle' }
  | { kind: 'creating'; viewportKey: string }
  | {
      kind: 'move_pending'
      viewportKey: string
      annotationId: string
      startPoint: MeasurementDraftPoint
      originalPoints: MeasurementDraftPoint[]
    }
  | {
      kind: 'moving'
      viewportKey: string
      annotationId: string
      startPoint: MeasurementDraftPoint
      originalPoints: MeasurementDraftPoint[]
    }
  | { kind: 'editing_handle'; viewportKey: string; annotationId: string; handleIndex: number }

function isCompareStackViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'CompareStack'
}

function isLayoutViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'Layout'
}

function createAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function resolvePointerContainer(event: PointerEvent): HTMLElement | null {
  const target = event.target
  if (!(target instanceof Element)) {
    return null
  }

  return target.closest('.viewer-viewport')
}

function resolveViewportImageElement(event: PointerEvent): HTMLImageElement | null {
  const container = resolvePointerContainer(event)
  if (!container) {
    return null
  }

  const image = container.querySelector<HTMLImageElement>('.viewer-image')
  return image instanceof HTMLImageElement ? image : null
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

function getNormalizedViewportPoint(event: PointerEvent): MeasurementDraftPoint | null {
  const imageElement = resolveViewportImageElement(event)
  if (!imageElement) {
    return null
  }

  const rect = getRenderedImageRect(imageElement)
  if (!rect.width || !rect.height) {
    return null
  }

  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  }
}

function offsetAnnotationPoints(points: MeasurementDraftPoint[], delta: number): MeasurementDraftPoint[] {
  const shiftedPoints = points.map((point) => ({
    x: Math.max(0, Math.min(1, point.x + delta)),
    y: Math.max(0, Math.min(1, point.y + delta))
  }))

  const changed = shiftedPoints.some((point, index) => point.x !== points[index]?.x || point.y !== points[index]?.y)
  if (changed) {
    return shiftedPoints
  }

  return points.map((point) => ({
    x: Math.max(0, Math.min(1, point.x - delta)),
    y: Math.max(0, Math.min(1, point.y - delta))
  }))
}

function areAnnotationPointSetsClose(a: MeasurementDraftPoint[], b: MeasurementDraftPoint[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((point, index) => {
    const other = b[index]
    return (
      other != null &&
      Math.abs(point.x - other.x) < ANNOTATION_POINT_CLOSE_EPSILON &&
      Math.abs(point.y - other.y) < ANNOTATION_POINT_CLOSE_EPSILON
    )
  })
}

export interface WorkspaceAnnotationsOptions {
  activeOperation: ComputedRef<string> | Ref<string>
  activeTab: ComputedRef<ViewerTabItem | null> | Ref<ViewerTabItem | null>
  activeViewportKey: ComputedRef<string> | Ref<string>
  setActiveViewport: (viewportKey: string) => void
}

export function useWorkspaceAnnotations(options: WorkspaceAnnotationsOptions) {
  const annotationStore = ref<Record<string, Partial<Record<string, AnnotationOverlay[]>>>>({})
  const draftAnnotations = ref<Partial<Record<string, AnnotationDraft | null>>>({})
  const annotationInteraction = ref<AnnotationInteractionState>({ kind: 'idle' })
  const annotationActivePointerId = ref<number | null>(null)

  function isAnnotationOperationEnabled(): boolean {
    const viewType = options.activeTab.value?.viewType
    return (
      (viewType === 'Stack' ||
        isCompareStackViewType(viewType) ||
        isLayoutViewType(viewType) ||
        isMprLikeViewType(viewType)) &&
      options.activeOperation.value.startsWith('stack:annotate')
    )
  }

  function getDraftAnnotation(viewportKey: string): AnnotationDraft | null {
    return draftAnnotations.value[viewportKey] ?? null
  }

  function getAnnotations(viewportKey: string): AnnotationOverlay[] {
    const tabKey = options.activeTab.value?.key
    const activeTab = options.activeTab.value
    if (!tabKey || !activeTab) {
      return []
    }

    const importedAnnotations =
      activeTab.viewType === 'Stack'
        ? (activeTab.annotations ?? [])
        : (activeTab.viewportAnnotations?.[viewportKey] ?? [])
    const localAnnotations = annotationStore.value[tabKey]?.[viewportKey] ?? []
    if (!localAnnotations.length) {
      return importedAnnotations
    }

    const localAnnotationIds = new Set(localAnnotations.map((annotation) => annotation.annotationId))
    return [
      ...importedAnnotations.filter((annotation) => !localAnnotationIds.has(annotation.annotationId)),
      ...localAnnotations
    ]
  }

  function setViewportAnnotations(viewportKey: string, annotations: AnnotationOverlay[]): void {
    const tabKey = options.activeTab.value?.key
    if (!tabKey) {
      return
    }

    annotationStore.value = {
      ...annotationStore.value,
      [tabKey]: {
        ...(annotationStore.value[tabKey] ?? {}),
        [viewportKey]: annotations
      }
    }
  }

  function clearDraftAnnotations(): void {
    draftAnnotations.value = {}
  }

  function resetAnnotationInteraction(): void {
    annotationInteraction.value = { kind: 'idle' }
  }

  function clearAllAnnotationsForActiveTab(): void {
    const tabKey = options.activeTab.value?.key
    if (!tabKey) {
      return
    }

    annotationStore.value = {
      ...annotationStore.value,
      [tabKey]: {}
    }
    clearDraftAnnotations()
    resetAnnotationInteraction()
  }

  function upsertAnnotation(viewportKey: string, annotation: AnnotationOverlay): void {
    const current = getAnnotations(viewportKey)
    const index = current.findIndex((item) => item.annotationId === annotation.annotationId)
    setViewportAnnotations(
      viewportKey,
      index === -1 ? [...current, annotation] : current.map((item, currentIndex) => (currentIndex === index ? annotation : item))
    )
  }

  function removeAnnotation(viewportKey: string, annotationId: string): void {
    setViewportAnnotations(
      viewportKey,
      getAnnotations(viewportKey).filter((item) => item.annotationId !== annotationId)
    )
  }

  function setDraftAnnotation(viewportKey: string, annotation: AnnotationDraft | null): void {
    draftAnnotations.value = {
      ...draftAnnotations.value,
      [viewportKey]: annotation
    }
  }

  function findAnnotation(viewportKey: string, annotationId: string): AnnotationOverlay | null {
    return getAnnotations(viewportKey).find((item) => item.annotationId === annotationId) ?? null
  }

  function selectAnnotation(viewportKey: string, annotation: AnnotationOverlay): void {
    setDraftAnnotation(viewportKey, {
      annotationId: annotation.annotationId,
      toolType: annotation.toolType,
      points: annotation.points,
      text: annotation.text,
      color: annotation.color,
      size: annotation.size
    })
  }

  function clearSelectedAnnotation(viewportKey?: string): void {
    if (!viewportKey) {
      clearDraftAnnotations()
      resetAnnotationInteraction()
      return
    }

    setDraftAnnotation(viewportKey, null)
    resetAnnotationInteraction()
  }

  function setAnnotationPointerCapture(pointerTarget: HTMLElement, pointerId: number): void {
    pointerTarget.setPointerCapture(pointerId)
    annotationActivePointerId.value = pointerId
  }

  function releaseAnnotationPointerCapture(pointerTarget?: EventTarget | null): void {
    if (!(pointerTarget instanceof HTMLElement) || annotationActivePointerId.value == null) {
      annotationActivePointerId.value = null
      return
    }

    if (pointerTarget.hasPointerCapture(annotationActivePointerId.value)) {
      pointerTarget.releasePointerCapture(annotationActivePointerId.value)
    }
    annotationActivePointerId.value = null
  }

  function stopAnnotationInteraction(pointerTarget?: EventTarget | null): void {
    releaseAnnotationPointerCapture(pointerTarget)
    resetAnnotationInteraction()
  }

  function updateSelectedAnnotation(viewportKey: string, annotationId: string, updater: (current: AnnotationOverlay) => AnnotationOverlay): void {
    const current = findAnnotation(viewportKey, annotationId)
    if (!current) {
      return
    }

    const nextAnnotation = updater(current)
    upsertAnnotation(viewportKey, nextAnnotation)
    selectAnnotation(viewportKey, nextAnnotation)
  }

  function handleAnnotationTextUpdate(payload: { viewportKey: string; annotationId: string; text: string }): void {
    updateSelectedAnnotation(payload.viewportKey, payload.annotationId, (current) => ({
      ...current,
      text: payload.text
    }))
  }

  function handleAnnotationColorUpdate(payload: { viewportKey: string; annotationId: string; color: string }): void {
    updateSelectedAnnotation(payload.viewportKey, payload.annotationId, (current) => ({
      ...current,
      color: payload.color
    }))
  }

  function handleAnnotationSizeUpdate(payload: { viewportKey: string; annotationId: string; size: AnnotationSize }): void {
    updateSelectedAnnotation(payload.viewportKey, payload.annotationId, (current) => ({
      ...current,
      size: payload.size
    }))
  }

  function copySelectedAnnotation(viewportKey?: string): boolean {
    const resolvedViewportKey = viewportKey ?? options.activeViewportKey.value
    const draft = getDraftAnnotation(resolvedViewportKey)
    if (!draft?.annotationId) {
      return false
    }

    const source = findAnnotation(resolvedViewportKey, draft.annotationId)
    if (!source) {
      return false
    }

    const occupiedPointSets = getAnnotations(resolvedViewportKey).map((annotation) => annotation.points)
    let copiedPoints = source.points
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const candidate = offsetAnnotationPoints(source.points, 0.01 * attempt)
      if (!occupiedPointSets.some((points) => areAnnotationPointSetsClose(points, candidate))) {
        copiedPoints = candidate
        break
      }
      copiedPoints = candidate
    }

    const copiedAnnotation: AnnotationOverlay = {
      ...source,
      annotationId: createAnnotationId(),
      points: copiedPoints
    }

    upsertAnnotation(resolvedViewportKey, copiedAnnotation)
    selectAnnotation(resolvedViewportKey, copiedAnnotation)
    resetAnnotationInteraction()
    return true
  }

  function deleteSelectedAnnotation(viewportKey?: string): boolean {
    const resolvedViewportKey = viewportKey ?? options.activeViewportKey.value
    const draft = getDraftAnnotation(resolvedViewportKey)
    if (!draft?.annotationId) {
      return false
    }

    removeAnnotation(resolvedViewportKey, draft.annotationId)
    setDraftAnnotation(resolvedViewportKey, null)
    resetAnnotationInteraction()
    return true
  }

  function handleAnnotationDelete(payload: { viewportKey: string; annotationId: string }): void {
    removeAnnotation(payload.viewportKey, payload.annotationId)
    const draft = getDraftAnnotation(payload.viewportKey)
    if (draft?.annotationId === payload.annotationId) {
      setDraftAnnotation(payload.viewportKey, null)
    }
    resetAnnotationInteraction()
  }

  function handleAnnotationCopy(payload: { viewportKey: string; annotationId: string }): void {
    const annotation = findAnnotation(payload.viewportKey, payload.annotationId)
    if (!annotation) {
      return
    }

    selectAnnotation(payload.viewportKey, annotation)
    void copySelectedAnnotation(payload.viewportKey)
  }

  function handleAnnotationPointerDown(event: PointerEvent, viewportKey: string): boolean {
    if (!event.isPrimary || event.button !== 0) {
      return false
    }

    if (!isAnnotationOperationEnabled()) {
      return false
    }

    const pointerTarget = resolvePointerContainer(event)
    const point = getNormalizedViewportPoint(event)
    const imageElement = resolveViewportImageElement(event)
    if (!(pointerTarget instanceof HTMLElement) || !point || !imageElement) {
      return false
    }

    event.preventDefault()
    options.setActiveViewport(viewportKey)
    const rect = getRenderedImageRect(imageElement)
    const annotations = getAnnotations(viewportKey)
    const hit = findArrowAnnotationAtPoint(annotations, point, rect)

    if (hit?.handleIndex != null) {
      selectAnnotation(viewportKey, hit.annotation)
      setAnnotationPointerCapture(pointerTarget, event.pointerId)
      annotationInteraction.value = {
        kind: 'editing_handle',
        viewportKey,
        annotationId: hit.annotation.annotationId,
        handleIndex: hit.handleIndex
      }
      return true
    }

    if (hit) {
      selectAnnotation(viewportKey, hit.annotation)
      setAnnotationPointerCapture(pointerTarget, event.pointerId)
      annotationInteraction.value = {
        kind: 'move_pending',
        viewportKey,
        annotationId: hit.annotation.annotationId,
        startPoint: point,
        originalPoints: hit.annotation.points
      }
      return true
    }

    const nextDraft: AnnotationDraft = {
      toolType: 'arrow',
      points: [point, point],
      text: DEFAULT_ANNOTATION_TEXT,
      color: DEFAULT_ANNOTATION_COLOR,
      size: DEFAULT_ANNOTATION_SIZE
    }
    setDraftAnnotation(viewportKey, nextDraft)
    setAnnotationPointerCapture(pointerTarget, event.pointerId)
    annotationInteraction.value = {
      kind: 'creating',
      viewportKey
    }
    return true
  }

  function handleAnnotationPointerMove(event: PointerEvent): boolean {
    if (annotationActivePointerId.value !== event.pointerId) {
      return false
    }

    const interaction = annotationInteraction.value
    const point = getNormalizedViewportPoint(event)
    if (!point) {
      return true
    }

    if (interaction.kind === 'creating') {
      const draft = getDraftAnnotation(interaction.viewportKey)
      if (!draft) {
        return true
      }

      setDraftAnnotation(interaction.viewportKey, {
        ...draft,
        points: [draft.points[0], point]
      })
      return true
    }

    if (interaction.kind === 'move_pending') {
      const imageElement = resolveViewportImageElement(event)
      if (!imageElement) {
        return true
      }

      const rect = getRenderedImageRect(imageElement)
      const deltaX = (point.x - interaction.startPoint.x) * rect.width
      const deltaY = (point.y - interaction.startPoint.y) * rect.height
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < ANNOTATION_DRAG_START_THRESHOLD) {
        return true
      }

      annotationInteraction.value = {
        ...interaction,
        kind: 'moving'
      }
    }

    const movingInteraction = annotationInteraction.value
    if (movingInteraction.kind === 'moving') {
      updateSelectedAnnotation(
        movingInteraction.viewportKey,
        movingInteraction.annotationId,
        (current) => ({
          ...current,
          points: translateAnnotationPoints(
            movingInteraction.originalPoints,
            point.x - movingInteraction.startPoint.x,
            point.y - movingInteraction.startPoint.y
          )
        })
      )
      return true
    }

    if (interaction.kind === 'editing_handle') {
      updateSelectedAnnotation(interaction.viewportKey, interaction.annotationId, (current) => ({
        ...current,
        points: updateEditedArrowPoints(current.points, interaction.handleIndex, point)
      }))
      return true
    }

    return false
  }

  function handleAnnotationPointerUp(event: PointerEvent): boolean {
    if (annotationActivePointerId.value !== event.pointerId) {
      return false
    }

    const interaction = annotationInteraction.value
    if (interaction.kind === 'creating') {
      const draft = getDraftAnnotation(interaction.viewportKey)
      if (draft && isValidArrowAnnotation(draft.points)) {
        const annotation: AnnotationOverlay = {
          annotationId: createAnnotationId(),
          toolType: 'arrow',
          points: draft.points,
          text: draft.text,
          color: draft.color,
          size: draft.size
        }
        upsertAnnotation(interaction.viewportKey, annotation)
        selectAnnotation(interaction.viewportKey, annotation)
      } else {
        setDraftAnnotation(interaction.viewportKey, null)
      }

      stopAnnotationInteraction(event.currentTarget)
      return true
    }

    if (interaction.kind === 'move_pending' || interaction.kind === 'moving' || interaction.kind === 'editing_handle') {
      stopAnnotationInteraction(event.currentTarget)
      return true
    }

    return false
  }

  function handleAnnotationPointerCancel(event: PointerEvent): boolean {
    if (annotationActivePointerId.value !== event.pointerId) {
      return false
    }

    if (annotationInteraction.value.kind === 'creating') {
      setDraftAnnotation(annotationInteraction.value.viewportKey, null)
    }

    stopAnnotationInteraction(event.currentTarget)
    return true
  }

  function handleAnnotationPointerLeave(_viewportKey: string): void {
    // Pointer capture owns in-progress annotation gestures, so leave does not need cleanup.
  }

  watch(
    () => options.activeOperation.value,
    (value) => {
      if (!value.startsWith('stack:annotate')) {
        clearDraftAnnotations()
        resetAnnotationInteraction()
      }
    }
  )

  watch(
    () => options.activeTab.value?.key,
    () => {
      clearDraftAnnotations()
      resetAnnotationInteraction()
    }
  )

  return {
    annotationInteraction,
    clearAllAnnotationsForActiveTab,
    clearDraftAnnotations,
    clearSelectedAnnotation,
    copySelectedAnnotation,
    deleteSelectedAnnotation,
    getAnnotations,
    getDraftAnnotation,
    handleAnnotationColorUpdate,
    handleAnnotationCopy,
    handleAnnotationDelete,
    handleAnnotationPointerCancel,
    handleAnnotationPointerDown,
    handleAnnotationPointerLeave,
    handleAnnotationPointerMove,
    handleAnnotationPointerUp,
    handleAnnotationSizeUpdate,
    handleAnnotationTextUpdate,
    isAnnotationOperationEnabled,
    resetAnnotationInteraction
  }
}
