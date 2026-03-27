import { ref, type Ref } from 'vue'
import throttle from 'lodash/throttle'
import { DRAG_ACTION_TYPES, STACK_DRAG_OPERATIONS, type ViewOperationType, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { MprViewportKey, ViewerTabItem, ViewType } from '../types/viewer'

interface PointerComposableOptions {
  activeOperation: Ref<string>
  activeTab: Ref<ViewerTabItem | null>
  emitActiveViewportChange: (viewportKey: string) => void
  emitMprCrosshair: (payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }) => void
  emitViewportDrag: (payload: { deltaX: number; deltaY: number; phase: 'start' | 'move' | 'end'; viewportKey: string }) => void
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

export function useViewerWorkspacePointer(options: PointerComposableOptions): PointerComposableState {
  const activeViewportKey = ref<MprViewportKey | 'single' | 'volume'>('mpr-ax')
  const crosshairPointerViewportKey = ref('')
  const dragViewportKey = ref('')
  const isCrosshairDragging = ref(false)
  const isViewportDragging = ref(false)
  const activePointerId = ref<number | null>(null)

  let lastPointerX = 0
  let lastPointerY = 0
  let totalDeltaX = 0
  let totalDeltaY = 0
  let hasSentDragStart = false

  const emitThrottledViewportDrag = throttle(
    (payload: { deltaX: number; deltaY: number; phase: 'move'; viewportKey: string }) => {
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

  function getViewportPoint(event: PointerEvent): { x: number; y: number } | null {
    const pointerTarget = event.currentTarget
    if (!(pointerTarget instanceof HTMLElement)) {
      return null
    }

    const rect = pointerTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  function emitCrosshairEvent(viewportKey: string, phase: 'start' | 'move' | 'end', event: PointerEvent): void {
    const point = getViewportPoint(event)
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
      options.emitViewportDrag({
        deltaX: 0,
        deltaY: 0,
        phase: DRAG_ACTION_TYPES.end,
        viewportKey: dragViewportKey.value
      })
    }

    isViewportDragging.value = false
    dragViewportKey.value = ''
    totalDeltaX = 0
    totalDeltaY = 0
    hasSentDragStart = false
    if (pointerTarget instanceof HTMLElement && activePointerId.value != null && pointerTarget.hasPointerCapture(activePointerId.value)) {
      pointerTarget.releasePointerCapture(activePointerId.value)
    }
    activePointerId.value = null
  }

  function handleViewportPointerMove(event: PointerEvent): void {
    if (isCrosshairDragging.value && activePointerId.value === event.pointerId) {
      const point = getViewportPoint(event)
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
      options.emitViewportDrag({
        deltaX: 0,
        deltaY: 0,
        phase: DRAG_ACTION_TYPES.start,
        viewportKey: dragViewportKey.value
      })
    }

    emitThrottledViewportDrag({
      deltaX: totalDeltaX,
      deltaY: totalDeltaY,
      phase: DRAG_ACTION_TYPES.move,
      viewportKey: dragViewportKey.value
    })
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
    const pointerTarget = event.currentTarget
    if (!(pointerTarget instanceof HTMLElement)) {
      return
    }

    if (isCrosshairOperationEnabled()) {
      setActiveViewport(viewportKey as MprViewportKey | 'single' | 'volume')
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
    isViewportDragging.value = true
    activePointerId.value = event.pointerId
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    totalDeltaX = 0
    totalDeltaY = 0
    hasSentDragStart = false
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
