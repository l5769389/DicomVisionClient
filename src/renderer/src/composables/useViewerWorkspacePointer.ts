import { ref, type Ref } from 'vue'
import throttle from 'lodash/throttle'
import { DRAG_ACTION_TYPES, STACK_DRAG_OPERATIONS, type ViewOperationType, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { MprCrosshairInfo, MprViewportKey, ViewerTabItem, ViewType } from '../types/viewer'

interface PointerComposableOptions {
  activeOperation: Ref<string>
  activeTab: Ref<ViewerTabItem | null>
  emitActiveViewportChange: (viewportKey: string) => void
  emitMprCrosshair: (payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }) => void
  emitViewportDrag: (payload: {
    deltaX: number
    deltaY: number
    opType: ViewOperationType
    phase: 'start' | 'move' | 'end'
    viewportKey: string
  }) => void
}

interface PointerComposableState {
  activeViewportKey: Ref<MprViewportKey | 'single' | 'volume'>
  cleanupPointerInteractions: () => void
  handleViewportPointerCancel: (event: PointerEvent) => void
  handleViewportPointerDown: (event: PointerEvent, viewportKey: string) => void
  handleViewportPointerMove: (event: PointerEvent) => void
  handleViewportPointerUp: (event: PointerEvent) => void
  setActiveViewport: (viewportKey: MprViewportKey | 'single' | 'volume') => void
  stopViewportDrag: (pointerTarget?: EventTarget | null) => void
}

const DRAG_START_THRESHOLD = 3

function getCrosshairCenter(crosshairInfo: MprCrosshairInfo): { x: number; y: number } {
  return {
    x: crosshairInfo.verticalPosition ?? crosshairInfo.centerX,
    y: crosshairInfo.horizontalPosition ?? crosshairInfo.centerY
  }
}

export function useViewerWorkspacePointer(options: PointerComposableOptions): PointerComposableState {
  const activeViewportKey = ref<MprViewportKey | 'single' | 'volume'>('mpr-ax')
  const crosshairPointerViewportKey = ref('')
  const dragViewportKey = ref('')
  const dragOperationType = ref<ViewOperationType | null>(null)
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

  function setActiveViewport(viewportKey: MprViewportKey | 'single' | 'volume'): void {
    activeViewportKey.value = viewportKey
    options.emitActiveViewportChange(viewportKey)
  }

  function getNormalizedOperation(): ViewOperationType | string {
    return options.activeOperation.value.startsWith('stack:')
      ? options.activeOperation.value.slice('stack:'.length).split(':')[0]
      : options.activeOperation.value.split(':')[0]
  }

  function isCrosshairOperationEnabled(): boolean {
    return options.activeTab.value?.viewType === 'MPR' && getNormalizedOperation() === VIEW_OPERATION_TYPES.crosshair
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

  function isVolumeTrackballRotation(): boolean {
    return options.activeTab.value?.viewType === '3D' && getNormalizedOperation() === VIEW_OPERATION_TYPES.rotate3d
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

  function stopViewportDrag(pointerTarget?: EventTarget | null): void {
    if (isCrosshairDragging.value) {
      emitThrottledCrosshairMove.cancel()
      if (pointerTarget instanceof HTMLElement && activePointerId.value != null && pointerTarget.hasPointerCapture(activePointerId.value)) {
        pointerTarget.releasePointerCapture(activePointerId.value)
      }
      isCrosshairDragging.value = false
      crosshairPointerViewportKey.value = ''
      activePointerId.value = null
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
    if (pointerTarget instanceof HTMLElement && activePointerId.value != null && pointerTarget.hasPointerCapture(activePointerId.value)) {
      pointerTarget.releasePointerCapture(activePointerId.value)
    }
    activePointerId.value = null
  }

  function handleViewportPointerMove(event: PointerEvent): void {
    if (isCrosshairDragging.value && activePointerId.value === event.pointerId) {
      const point = getNormalizedViewportPoint(event)
      if (!point) {
        return
      }
      emitThrottledCrosshairMove({
        viewportKey: crosshairPointerViewportKey.value,
        x: point.x,
        y: point.y
      })
      return
    }

    if (!isViewportDragging.value || activePointerId.value !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - lastPointerX
    const deltaY = event.clientY - lastPointerY
    lastPointerX = event.clientX
    lastPointerY = event.clientY

    if (!deltaX && !deltaY) {
      return
    }

    totalDeltaX += deltaX
    totalDeltaY += deltaY

    if (!hasSentDragStart) {
      const dragDistance = Math.max(Math.abs(totalDeltaX), Math.abs(totalDeltaY))
      if (dragDistance < DRAG_START_THRESHOLD) {
        return
      }

      hasSentDragStart = true
      if (dragOperationType.value === VIEW_OPERATION_TYPES.rotate3d && dragViewportKey.value === 'volume' && dragStartNormalizedPoint) {
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
        return
      }
      lastDragNormalizedPoint = point
      emitThrottledViewportDrag({
        deltaX: point.x,
        deltaY: point.y,
        opType: dragOperationType.value,
        phase: DRAG_ACTION_TYPES.move,
        viewportKey: dragViewportKey.value
      })
      return
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
  }

  function handleViewportPointerUp(event: PointerEvent): void {
    if (activePointerId.value !== event.pointerId) {
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

    stopViewportDrag(event.currentTarget)
  }

  function handleViewportPointerDown(event: PointerEvent, viewportKey: string): void {
    if (!event.isPrimary || event.button !== 0) {
      return
    }
    const pointerTarget = resolvePointerContainer(event)
    if (!(pointerTarget instanceof HTMLElement)) {
      return
    }
    if (isCrosshairOperationEnabled()) {
      setActiveViewport(viewportKey as MprViewportKey | 'single' | 'volume')
      const point = getNormalizedViewportPoint(event)
      if (!point || !isPointNearCrosshairCenter(event, viewportKey, point)) {
        return
      }
      event.preventDefault()
      pointerTarget.setPointerCapture(event.pointerId)
      isCrosshairDragging.value = true
      crosshairPointerViewportKey.value = viewportKey
      activePointerId.value = event.pointerId
      emitCrosshairEvent(viewportKey, DRAG_ACTION_TYPES.start, event)
      return
    }

    if (!isMouseDragOperationEnabled()) {
      return
    }

    event.preventDefault()
    pointerTarget.setPointerCapture(event.pointerId)
    setActiveViewport(viewportKey as MprViewportKey | 'single' | 'volume')
    dragViewportKey.value = viewportKey
    dragOperationType.value = getNormalizedOperation() as ViewOperationType
    isViewportDragging.value = true
    activePointerId.value = event.pointerId
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    totalDeltaX = 0
    totalDeltaY = 0
    hasSentDragStart = false
    dragStartNormalizedPoint =
      viewportKey === 'volume' && dragOperationType.value === VIEW_OPERATION_TYPES.rotate3d ? getNormalizedContainerPoint(event) : null
    lastDragNormalizedPoint = dragStartNormalizedPoint
  }

  function cleanupPointerInteractions(): void {
    emitThrottledViewportDrag.cancel()
    emitThrottledCrosshairMove.cancel()
    stopViewportDrag()
  }

  return {
    activeViewportKey,
    cleanupPointerInteractions,
    handleViewportPointerCancel,
    handleViewportPointerDown,
    handleViewportPointerMove,
    handleViewportPointerUp,
    setActiveViewport,
    stopViewportDrag
  }
}
