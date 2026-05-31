import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { DRAG_ACTION_TYPES, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { MeasurementDraftPoint, MeasurementOverlay, MeasurementToolType, ViewerTabItem } from '../../types/viewer'
import { useViewerWorkspacePointer } from './useViewerWorkspacePointer'

function createRect(left = 0, top = 0, width = 200, height = 200): DOMRect {
  return {
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect
}

function installViewport(viewportKey = 'single'): HTMLElement {
  const viewport = document.createElement('div')
  viewport.className = 'viewer-viewport'
  viewport.dataset.viewportKey = viewportKey
  Object.defineProperty(viewport, 'getBoundingClientRect', {
    configurable: true,
    value: () => createRect()
  })
  viewport.setPointerCapture = vi.fn()
  viewport.releasePointerCapture = vi.fn()
  viewport.hasPointerCapture = vi.fn(() => true)

  const image = document.createElement('img')
  image.className = 'viewer-image'
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 200 })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 200 })
  Object.defineProperty(image, 'getBoundingClientRect', {
    configurable: true,
    value: () => createRect()
  })

  viewport.appendChild(image)
  document.body.appendChild(viewport)
  return viewport
}

function createPointerEvent(
  target: HTMLElement,
  point: MeasurementDraftPoint,
  options: { button?: number; buttons?: number; pointerId?: number; timeStamp?: number } = {}
): PointerEvent {
  const rect = createRect()
  return {
    isPrimary: true,
    button: options.button ?? 0,
    buttons: options.buttons ?? 1,
    clientX: rect.left + point.x * rect.width,
    clientY: rect.top + point.y * rect.height,
    currentTarget: target,
    pointerId: options.pointerId ?? 1,
    preventDefault: vi.fn(),
    target,
    timeStamp: options.timeStamp ?? 0
  } as unknown as PointerEvent
}

function upsertMeasurement(
  measurements: MeasurementOverlay[],
  payload: {
    measurementId?: string
    points: MeasurementDraftPoint[]
    toolType: MeasurementToolType
    labelLines?: string[]
  }
): MeasurementOverlay[] {
  if (!payload.measurementId) {
    return measurements
  }

  const nextMeasurement: MeasurementOverlay = {
    measurementId: payload.measurementId,
    toolType: payload.toolType,
    points: payload.points,
    labelLines: payload.labelLines ?? []
  }
  const existingIndex = measurements.findIndex((measurement) => measurement.measurementId === payload.measurementId)
  if (existingIndex === -1) {
    return [...measurements, nextMeasurement]
  }

  return measurements.map((measurement, index) => (index === existingIndex ? nextMeasurement : measurement))
}

function createMprCrosshairTab(): ViewerTabItem {
  return {
    viewType: 'MPR',
    viewportCrosshairs: {
      'mpr-ax': {
        centerX: 0.5,
        centerY: 0.5,
        hitRadius: 0.03,
        horizontalPosition: 0.5,
        verticalPosition: 0.5
      }
    }
  } as ViewerTabItem
}

function getViewportDragPayloads(emitViewportDrag: ReturnType<typeof vi.fn>) {
  return emitViewportDrag.mock.calls.map(([payload]) => payload as { opType: string; phase: string })
}

function hasViewportDragPhase(payloads: Array<{ opType: string; phase: string }>, opType: string, phase: string): boolean {
  return payloads.some((payload) => payload.opType === opType && payload.phase === phase)
}

function createPointerHarness(
  overrides: { activeOperation?: string; activeTab?: ViewerTabItem; viewportKey?: string } = {}
) {
  const viewport = installViewport(overrides.viewportKey)
  const activeOperation = ref(overrides.activeOperation ?? 'stack:measure:freeform')
  const activeTab = ref(overrides.activeTab ?? ({ viewType: 'Stack' } as ViewerTabItem))
  let committedMeasurements: MeasurementOverlay[] = [
    {
      measurementId: 'freeform-original',
      toolType: 'freeform',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.65, y: 0.2 },
        { x: 0.45, y: 0.65 }
      ],
      labelLines: ['Area 1200.0 px2']
    }
  ]

  const createdMeasurements: Array<{
    measurementId?: string
    points: MeasurementDraftPoint[]
    toolType: MeasurementToolType
  }> = []

  const emitActiveViewportChange = vi.fn()
  const emitMprCrosshair = vi.fn()
  const emitViewportDrag = vi.fn()

  const pointer = useViewerWorkspacePointer({
    activeOperation,
    activeTab,
    emitActiveViewportChange,
    emitOperationChange: (value) => {
      activeOperation.value = value
    },
    emitMeasurementDraft: vi.fn(),
    emitMeasurementCreate: (payload) => {
      createdMeasurements.push(payload)
      committedMeasurements = upsertMeasurement(committedMeasurements, payload)
    },
    emitMeasurementDelete: vi.fn(),
    emitMtfCommit: vi.fn(),
    emitMtfDelete: vi.fn(),
    emitMtfSelect: vi.fn(),
    emitMprCrosshair,
    emitViewportDrag,
    getCommittedMeasurements: () => committedMeasurements,
    getMtfItems: () => []
  })

  function copySelectedFreeform(): string {
    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.42, y: 0.34 }, { pointerId: 1 }), 'single')
    expect(pointer.copySelectedMeasurement('single')).toBe(true)
    const copiedId = pointer.draftMeasurements.value.single?.measurementId
    expect(copiedId).toBeTruthy()
    expect(copiedId).not.toBe('freeform-original')
    return copiedId!
  }

  return {
    activeOperation,
    activeTab,
    copySelectedFreeform,
    createdMeasurements,
    emitActiveViewportChange,
    emitMprCrosshair,
    emitViewportDrag,
    pointer,
    viewport
  }
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useViewerWorkspacePointer', () => {
  it('finishes a copied point-sequence draft with Escape after moving it', () => {
    const { copySelectedFreeform, pointer, viewport } = createPointerHarness()
    const copiedId = copySelectedFreeform()

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.43, y: 0.34 }, { pointerId: 2 }), 'single')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.48, y: 0.39 }, { pointerId: 2 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.48, y: 0.39 }, { buttons: 0, pointerId: 2 }))

    expect(pointer.draftMeasurements.value.single?.measurementId).toBe(copiedId)
    expect(pointer.finishPointSequenceMeasurement('single')).toBe(true)
    expect(pointer.draftMeasurements.value.single).toBeNull()
  })

  it('finishes a copied point-sequence draft with Escape after editing a handle', () => {
    const { copySelectedFreeform, pointer, viewport } = createPointerHarness()
    const copiedId = copySelectedFreeform()
    const firstHandle = pointer.draftMeasurements.value.single!.points[0]!

    pointer.handleViewportPointerDown(createPointerEvent(viewport, firstHandle, { pointerId: 2 }), 'single')
    pointer.handleViewportPointerMove(
      createPointerEvent(viewport, { x: firstHandle.x + 0.05, y: firstHandle.y + 0.03 }, { pointerId: 2 })
    )
    pointer.handleViewportPointerUp(
      createPointerEvent(viewport, { x: firstHandle.x + 0.05, y: firstHandle.y + 0.03 }, { buttons: 0, pointerId: 2 })
    )

    expect(pointer.draftMeasurements.value.single?.measurementId).toBe(copiedId)
    expect(pointer.finishPointSequenceMeasurement('single')).toBe(true)
    expect(pointer.draftMeasurements.value.single).toBeNull()
  })

  it('finishes a copied point-sequence draft on double click after moving it', () => {
    const { copySelectedFreeform, pointer, viewport } = createPointerHarness()
    copySelectedFreeform()

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.43, y: 0.34 }, { pointerId: 2 }), 'single')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.48, y: 0.39 }, { pointerId: 2 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.48, y: 0.39 }, { buttons: 0, pointerId: 2 }))

    pointer.handleViewportPointerDown(
      createPointerEvent(viewport, { x: 0.48, y: 0.39 }, { pointerId: 3, timeStamp: 100 }),
      'single'
    )
    pointer.handleViewportPointerUp(
      createPointerEvent(viewport, { x: 0.48, y: 0.39 }, { buttons: 0, pointerId: 3, timeStamp: 120 })
    )
    pointer.handleViewportPointerDown(
      createPointerEvent(viewport, { x: 0.48, y: 0.39 }, { pointerId: 4, timeStamp: 180 }),
      'single'
    )

    expect(pointer.draftMeasurements.value.single).toBeNull()
  })

  it('defaults left-button viewport drag to window when no specific interaction handles it', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({ activeOperation: 'stack:scroll' })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 10 }), 'single')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.27, y: 0.24 }, { pointerId: 10 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.27, y: 0.24 }, { buttons: 0, pointerId: 10 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.window, DRAG_ACTION_TYPES.start)).toBe(true)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.window, DRAG_ACTION_TYPES.move)).toBe(true)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.window, DRAG_ACTION_TYPES.end)).toBe(true)
  })

  it('keeps explicit drag tools ahead of the default window drag', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({ activeOperation: 'stack:pan' })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 11 }), 'single')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.28, y: 0.21 }, { pointerId: 11 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.28, y: 0.21 }, { buttons: 0, pointerId: 11 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(payloads.some((payload) => payload.opType === VIEW_OPERATION_TYPES.pan)).toBe(true)
    expect(payloads.some((payload) => payload.opType === VIEW_OPERATION_TYPES.window)).toBe(false)
  })

  it('uses a window cursor while window-level drag is active', () => {
    const { pointer, viewport } = createPointerHarness({ activeOperation: 'stack:window' })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 15 }), 'single')
    expect(pointer.viewportCursorClasses.value.single).toBe('cursor-window-level')

    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { buttons: 0, pointerId: 15 }))

    expect(pointer.viewportCursorClasses.value.single).toBe('cursor-auto')
  })

  it('defaults right-button viewport drag to zoom and uses a zoom cursor', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({ activeOperation: 'stack:scroll' })

    pointer.handleViewportPointerDown(
      createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { button: 2, buttons: 2, pointerId: 16 }),
      'single'
    )
    expect(pointer.viewportCursorClasses.value.single).toBe('cursor-zoom-drag')

    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.2, y: 0.28 }, { button: 2, buttons: 2, pointerId: 16 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.2, y: 0.28 }, { button: 2, buttons: 0, pointerId: 16 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.zoom, DRAG_ACTION_TYPES.start)).toBe(true)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.zoom, DRAG_ACTION_TYPES.move)).toBe(true)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.zoom, DRAG_ACTION_TYPES.end)).toBe(true)
    expect(pointer.viewportCursorClasses.value.single).toBe('cursor-auto')
  })

  it('does not apply default window drag to volume-only viewports', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:scroll',
      activeTab: { viewType: '3D' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 14 }), 'volume')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.28, y: 0.21 }, { pointerId: 14 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.28, y: 0.21 }, { buttons: 0, pointerId: 14 }))

    expect(emitViewportDrag).not.toHaveBeenCalled()
  })

  it('allows right-button zoom on volume-only viewports', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:scroll',
      activeTab: { viewType: '3D' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(
      createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { button: 2, buttons: 2, pointerId: 17 }),
      'volume'
    )
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.2, y: 0.3 }, { button: 2, buttons: 2, pointerId: 17 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.2, y: 0.3 }, { button: 2, buttons: 0, pointerId: 17 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.zoom, DRAG_ACTION_TYPES.start)).toBe(true)
  })

  it('uses a slower move cadence for surface volume drags', () => {
    vi.useFakeTimers()
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:zoom',
      activeTab: { viewType: '3D', render3dMode: 'surface' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 18 }), 'volume')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.24, y: 0.2 }, { pointerId: 18 }))
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.3, y: 0.2 }, { pointerId: 18 }))

    const countMovePayloads = () =>
      emitViewportDrag.mock.calls.filter(([payload]) => payload.phase === DRAG_ACTION_TYPES.move).length

    expect(countMovePayloads()).toBe(1)
    vi.advanceTimersByTime(84)
    expect(countMovePayloads()).toBe(1)
    vi.advanceTimersByTime(1)
    expect(countMovePayloads()).toBe(2)
  })

  it('keeps MPR crosshair center drag ahead of the default window drag', () => {
    const { emitMprCrosshair, emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:crosshair',
      activeTab: createMprCrosshairTab(),
      viewportKey: 'mpr-ax'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.5, y: 0.5 }, { pointerId: 12 }), 'mpr-ax')
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.5, y: 0.5 }, { buttons: 0, pointerId: 12 }))

    expect(emitMprCrosshair).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'move',
        phase: DRAG_ACTION_TYPES.start,
        viewportKey: 'mpr-ax'
      })
    )
    expect(emitViewportDrag).not.toHaveBeenCalled()
  })

  it('falls back to window drag in MPR crosshair mode when no crosshair part is hit', () => {
    const { emitMprCrosshair, emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:crosshair',
      activeTab: createMprCrosshairTab(),
      viewportKey: 'mpr-ax'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.1, y: 0.1 }, { pointerId: 13 }), 'mpr-ax')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.18, y: 0.12 }, { pointerId: 13 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.18, y: 0.12 }, { buttons: 0, pointerId: 13 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(emitMprCrosshair).not.toHaveBeenCalled()
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.window, DRAG_ACTION_TYPES.start)).toBe(true)
  })
})
