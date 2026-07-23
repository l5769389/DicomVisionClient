import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { DRAG_ACTION_TYPES, STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
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

function installViewport(
  viewportKey = 'single',
  options: {
    imageNaturalHeight?: number
    imageNaturalWidth?: number
  } = {}
): HTMLElement {
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
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: options.imageNaturalWidth ?? 200 })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: options.imageNaturalHeight ?? 200 })
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
  overrides: {
    activeOperation?: string
    activeTab?: ViewerTabItem
    imageNaturalHeight?: number
    imageNaturalWidth?: number
    viewportKey?: string
  } = {}
) {
  const viewport = installViewport(overrides.viewportKey, {
    imageNaturalHeight: overrides.imageNaturalHeight,
    imageNaturalWidth: overrides.imageNaturalWidth
  })
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
  const emitMeasurementDraft = vi.fn()
  const emitMprCrosshair = vi.fn()
  const emitVolumeClip = vi.fn()
  const emitViewportDrag = vi.fn()

  const pointer = useViewerWorkspacePointer({
    activeOperation,
    activeTab,
    emitActiveViewportChange,
    emitOperationChange: (value) => {
      activeOperation.value = value
    },
    emitMeasurementDraft,
    emitMeasurementCreate: (payload) => {
      createdMeasurements.push(payload)
      committedMeasurements = upsertMeasurement(committedMeasurements, payload)
    },
    emitMeasurementDelete: vi.fn(),
    emitMtfCommit: vi.fn(),
    emitMtfDelete: vi.fn(),
    emitMtfSelect: vi.fn(),
    emitMprCrosshair,
    emitVolumeClip,
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
    emitMeasurementDraft,
    emitMprCrosshair,
    emitVolumeClip,
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
  it('updates a measurement draft and emits a move before pointer release', () => {
    const { emitMeasurementDraft, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:measure:line'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.05, y: 0.85 }, { pointerId: 30 }), 'single')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.25, y: 0.7 }, { pointerId: 30 }))

    expect(pointer.draftMeasurements.value.single?.points).toEqual([
      { x: 0.05, y: 0.85 },
      { x: 0.25, y: 0.7 }
    ])
    expect(emitMeasurementDraft).toHaveBeenCalledWith(expect.objectContaining({
      phase: DRAG_ACTION_TYPES.move,
      toolType: 'line',
      viewportKey: 'single'
    }))
  })

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

  it('uses explicit scroll for left-button viewport drag when page is active', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({ activeOperation: 'stack:scroll' })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 10 }), 'single')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.27, y: 0.24 }, { pointerId: 10 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.27, y: 0.24 }, { buttons: 0, pointerId: 10 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.scroll, DRAG_ACTION_TYPES.start)).toBe(true)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.scroll, DRAG_ACTION_TYPES.move)).toBe(true)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.scroll, DRAG_ACTION_TYPES.end)).toBe(true)
    expect(payloads.some((payload) => payload.opType === VIEW_OPERATION_TYPES.window)).toBe(false)
  })

  it.each([
    `${STACK_OPERATION_PREFIX}segmentation:threshold`,
    `${STACK_OPERATION_PREFIX}segmentation:voi`
  ])('does not let %s fall back to left-button window drag', (activeOperation) => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation,
      activeTab: { viewType: 'MPR' } as ViewerTabItem
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 101 }), 'single')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.27, y: 0.24 }, { pointerId: 101 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.27, y: 0.24 }, { buttons: 0, pointerId: 101 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(payloads.some((payload) => payload.opType === VIEW_OPERATION_TYPES.window)).toBe(false)
    expect(payloads).toHaveLength(0)
  })

  it('keeps explicit drag tools ahead of the default window drag', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({ activeOperation: 'stack:pan' })

    expect(pointer.getViewportIdleCursorClass('single')).toBe('cursor-pan')

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 11 }), 'single')
    expect(pointer.viewportCursorClasses.value.single).toBe('cursor-pan-drag')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.28, y: 0.21 }, { pointerId: 11 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.28, y: 0.21 }, { buttons: 0, pointerId: 11 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(payloads.some((payload) => payload.opType === VIEW_OPERATION_TYPES.pan)).toBe(true)
    expect(payloads.some((payload) => payload.opType === VIEW_OPERATION_TYPES.window)).toBe(false)
    expect(pointer.viewportCursorClasses.value.single).toBeUndefined()
  })

  it('keeps explicit zoom ahead of the default left-button window drag', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({ activeOperation: 'stack:zoom' })

    expect(pointer.getViewportIdleCursorClass('single')).toBe('cursor-zoom-drag')

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 12 }), 'single')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.2, y: 0.28 }, { pointerId: 12 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.2, y: 0.28 }, { buttons: 0, pointerId: 12 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(payloads.some((payload) => payload.opType === VIEW_OPERATION_TYPES.zoom)).toBe(true)
    expect(payloads.some((payload) => payload.opType === VIEW_OPERATION_TYPES.window)).toBe(false)
  })

  it('uses a window cursor while window-level drag is active', () => {
    const { pointer, viewport } = createPointerHarness({ activeOperation: 'stack:window' })

    expect(pointer.getViewportIdleCursorClass('single')).toBe('cursor-window-level')

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 15 }), 'single')
    expect(pointer.viewportCursorClasses.value.single).toBe('cursor-window-level')

    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { buttons: 0, pointerId: 15 }))

    expect(pointer.viewportCursorClasses.value.single).toBeUndefined()
    expect(pointer.getViewportIdleCursorClass('single')).toBe('cursor-window-level')
  })

  it('defaults right-button viewport drag to zoom and uses a zoom cursor', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({ activeOperation: 'stack:scroll' })

    expect(pointer.getViewportIdleCursorClass('single')).toBe('cursor-auto')

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
    expect(pointer.viewportCursorClasses.value.single).toBeUndefined()
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

  it('draws and submits a closed freeform 3D volume clip polygon', () => {
    const { emitVolumeClip, emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: `${STACK_OPERATION_PREFIX}volumeClip:inside`,
      activeTab: { viewType: '3D' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 31 }), 'volume')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.7, y: 0.25 }, { pointerId: 31 }))
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.6, y: 0.65 }, { pointerId: 31 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.25, y: 0.55 }, { buttons: 0, pointerId: 31 }))

    expect(emitViewportDrag).not.toHaveBeenCalled()
    expect(emitVolumeClip).toHaveBeenCalledTimes(1)
    const payload = emitVolumeClip.mock.calls[0]?.[0] as {
      mode: string
      points: MeasurementDraftPoint[]
      viewportKey: string
    }
    expect(payload).toMatchObject({ mode: 'inside', viewportKey: 'volume' })
    expect(payload.points.length).toBeGreaterThanOrEqual(5)
    expect(payload.points.at(-1)).toEqual(payload.points[0])
    expect(pointer.draftMeasurements.value.volume).toBeNull()
  })

  it('starts the default inside crop immediately from a live 3D layout slot', () => {
    const { emitVolumeClip, emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: `${STACK_OPERATION_PREFIX}volumeClip:inside`,
      activeTab: {
        viewType: 'Layout',
        layoutSlots: [
          {
            id: 'slot-volume',
            viewId: 'layout-volume',
            viewType: '3D',
            sourceViewType: '3D'
          }
        ]
      } as ViewerTabItem,
      viewportKey: 'slot-volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 34 }), 'slot-volume')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.75, y: 0.25 }, { pointerId: 34 }))
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.6, y: 0.7 }, { pointerId: 34 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.25, y: 0.6 }, { buttons: 0, pointerId: 34 }))

    expect(emitViewportDrag).not.toHaveBeenCalled()
    expect(emitVolumeClip).toHaveBeenCalledTimes(1)
    expect(emitVolumeClip.mock.calls[0]?.[0]).toMatchObject({ mode: 'inside', viewportKey: 'slot-volume' })
  })

  it('simplifies dense desktop 3D volume clip polygons before submitting', () => {
    const { emitVolumeClip, pointer, viewport } = createPointerHarness({
      activeOperation: `${STACK_OPERATION_PREFIX}volumeClip:inside`,
      activeTab: { viewType: '3D' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.8, y: 0.5 }, { pointerId: 33 }), 'volume')
    for (let index = 1; index <= 360; index += 1) {
      const radians = (index / 360) * Math.PI * 2
      pointer.handleViewportPointerMove(createPointerEvent(viewport, {
        x: 0.5 + Math.cos(radians) * 0.3,
        y: 0.5 + Math.sin(radians) * 0.3
      }, { pointerId: 33 }))
    }
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.8, y: 0.5 }, { buttons: 0, pointerId: 33 }))

    const payload = emitVolumeClip.mock.calls[0]?.[0] as {
      points: MeasurementDraftPoint[]
    }
    expect(payload.points.length).toBeLessThanOrEqual(241)
    expect(payload.points.length).toBeGreaterThan(8)
    expect(payload.points.at(-1)).toEqual(payload.points[0])
  })

  it('does not submit tiny accidental 3D volume clip strokes', () => {
    const { emitVolumeClip, pointer, viewport } = createPointerHarness({
      activeOperation: `${STACK_OPERATION_PREFIX}volumeClip:outside`,
      activeTab: { viewType: '3D' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 32 }), 'volume')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.205, y: 0.2 }, { pointerId: 32 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.205, y: 0.205 }, { buttons: 0, pointerId: 32 }))

    expect(emitVolumeClip).not.toHaveBeenCalled()
    expect(pointer.draftMeasurements.value.volume).toBeNull()
  })

  it('emits raw canvas coordinates for 3D rotate without clamping edge drags', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.rotate3d}`,
      activeTab: { viewType: '3D' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 23 }), 'volume')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.3, y: 0.25 }, { pointerId: 23 }))
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: -0.1, y: 0.25 }, { pointerId: 23 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: -0.1, y: 0.25 }, { buttons: 0, pointerId: 23 }))

    const payloads = emitViewportDrag.mock.calls.map(([payload]) => payload as {
      phase: string
      deltaX: number
      deltaY: number
      canvasX?: number
      canvasY?: number
      canvasWidth?: number
      canvasHeight?: number
      interactionId?: string
    })
    const interactionIds = payloads.map((payload) => payload.interactionId)
    expect(interactionIds.every((interactionId) => typeof interactionId === 'string' && interactionId.length > 0)).toBe(true)
    expect(new Set(interactionIds).size).toBe(1)
    expect(payloads.find((payload) => payload.phase === DRAG_ACTION_TYPES.start)).toMatchObject({
      deltaX: 0.2,
      deltaY: 0.2,
      canvasX: 40,
      canvasY: 40,
      canvasWidth: 200,
      canvasHeight: 200
    })
    expect(payloads.find((payload) => payload.phase === DRAG_ACTION_TYPES.move)).toMatchObject({
      deltaX: 0,
      deltaY: 0.25,
      canvasX: -20,
      canvasY: 50,
      canvasWidth: 200,
      canvasHeight: 200
    })
    expect(payloads.find((payload) => payload.phase === DRAG_ACTION_TYPES.end)).toMatchObject({
      deltaX: 0,
      deltaY: 0.25,
      canvasX: -20,
      canvasY: 50,
      canvasWidth: 200,
      canvasHeight: 200
    })
  })

  it('sends the pointerup 3D rotate position only in the final end payload', () => {
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.rotate3d}`,
      activeTab: { viewType: '3D' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 25 }), 'volume')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.3, y: 0.25 }, { pointerId: 25 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.45, y: 0.4 }, { buttons: 0, pointerId: 25 }))

    const payloads = emitViewportDrag.mock.calls.map(([payload]) => payload as {
      phase: string
      canvasX?: number
      canvasY?: number
      interactionId?: string
    })
    const lastMove = payloads.filter((payload) => payload.phase === DRAG_ACTION_TYPES.move).at(-1)
    const end = payloads.find((payload) => payload.phase === DRAG_ACTION_TYPES.end)
    expect(lastMove).toMatchObject({
      canvasX: 60,
      canvasY: 50
    })
    expect(end).toMatchObject({
      canvasX: 90,
      canvasY: 80,
      interactionId: lastMove?.interactionId
    })
  })

  it.each([VIEW_OPERATION_TYPES.pan, VIEW_OPERATION_TYPES.zoom, VIEW_OPERATION_TYPES.window])(
    'keeps %s start, move, and release in one canvas-space interaction',
    (opType) => {
      const { emitViewportDrag, pointer, viewport } = createPointerHarness({
        activeOperation: `${STACK_OPERATION_PREFIX}${opType}`,
        activeTab: { viewType: 'Stack' } as ViewerTabItem,
        viewportKey: 'single'
      })

      pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 26 }), 'single')
      pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.3, y: 0.25 }, { pointerId: 26 }))
      pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.45, y: 0.4 }, { buttons: 0, pointerId: 26 }))

      const payloads = emitViewportDrag.mock.calls.map(([payload]) => payload as {
        phase: string
        deltaX: number
        deltaY: number
        canvasX?: number
        canvasY?: number
        canvasWidth?: number
        canvasHeight?: number
        interactionId?: string
      })
      const interactionIds = payloads.map((payload) => payload.interactionId)
      expect(new Set(interactionIds).size).toBe(1)
      expect(interactionIds[0]).toEqual(expect.any(String))
      expect(payloads.find((payload) => payload.phase === DRAG_ACTION_TYPES.start)).toMatchObject({
        canvasX: 40,
        canvasY: 40,
        canvasWidth: 200,
        canvasHeight: 200
      })
      expect(payloads.at(-1)).toMatchObject({
        phase: DRAG_ACTION_TYPES.end,
        deltaX: 50,
        deltaY: 40,
        canvasX: 90,
        canvasY: 80,
        canvasWidth: 200,
        canvasHeight: 200
      })
    }
  )

  it('coalesces repeated viewport drag moves to the latest animation frame payload', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(vi.fn())
    const { emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:zoom',
      activeTab: { viewType: '3D', render3dMode: 'surface' } as ViewerTabItem,
      viewportKey: 'volume'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.2, y: 0.2 }, { pointerId: 18 }), 'volume')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.24, y: 0.2 }, { pointerId: 18 }))
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.3, y: 0.2 }, { pointerId: 18 }))

    const movePayloads = () =>
      emitViewportDrag.mock.calls
        .map(([payload]) => payload as { deltaX: number; deltaY: number; phase: string })
        .filter((payload) => payload.phase === DRAG_ACTION_TYPES.move)

    expect(movePayloads()).toHaveLength(0)
    expect(callbacks).toHaveLength(1)
    callbacks[0]?.(16)
    expect(movePayloads()).toHaveLength(1)
    expect(movePayloads()[0]).toMatchObject({ deltaX: 20, deltaY: 0 })
  })

  it('emits MPR pan and zoom moves during pointer movement before pointerup', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(vi.fn())

    const panHarness = createPointerHarness({
      activeOperation: 'stack:pan',
      activeTab: { viewType: 'MPR' } as ViewerTabItem,
      viewportKey: 'mpr-ax'
    })

    panHarness.pointer.handleViewportPointerDown(
      createPointerEvent(panHarness.viewport, { x: 0.2, y: 0.2 }, { pointerId: 19 }),
      'mpr-ax'
    )
    panHarness.pointer.handleViewportPointerMove(createPointerEvent(panHarness.viewport, { x: 0.28, y: 0.23 }, { pointerId: 19 }))
    callbacks[0]?.(16)

    expect(hasViewportDragPhase(getViewportDragPayloads(panHarness.emitViewportDrag), VIEW_OPERATION_TYPES.pan, DRAG_ACTION_TYPES.move)).toBe(true)
    expect(hasViewportDragPhase(getViewportDragPayloads(panHarness.emitViewportDrag), VIEW_OPERATION_TYPES.pan, DRAG_ACTION_TYPES.end)).toBe(false)

    const zoomHarness = createPointerHarness({
      activeOperation: 'stack:scroll',
      activeTab: { viewType: 'MPR' } as ViewerTabItem,
      viewportKey: 'mpr-cor'
    })

    zoomHarness.pointer.handleViewportPointerDown(
      createPointerEvent(zoomHarness.viewport, { x: 0.3, y: 0.3 }, { button: 2, buttons: 2, pointerId: 22 }),
      'mpr-cor'
    )
    zoomHarness.pointer.handleViewportPointerMove(
      createPointerEvent(zoomHarness.viewport, { x: 0.3, y: 0.38 }, { button: 2, buttons: 2, pointerId: 22 })
    )
    callbacks[1]?.(32)

    expect(hasViewportDragPhase(getViewportDragPayloads(zoomHarness.emitViewportDrag), VIEW_OPERATION_TYPES.zoom, DRAG_ACTION_TYPES.move)).toBe(true)
    expect(hasViewportDragPhase(getViewportDragPayloads(zoomHarness.emitViewportDrag), VIEW_OPERATION_TYPES.zoom, DRAG_ACTION_TYPES.end)).toBe(false)
  })

  it('keeps MPR crosshair center drag ahead of the default window drag', () => {
    const { emitMprCrosshair, emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:crosshair',
      activeTab: createMprCrosshairTab(),
      viewportKey: 'mpr-ax'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.5, y: 0.5 }, { pointerId: 12 }), 'mpr-ax')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.62, y: 0.58 }, { pointerId: 12 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.62, y: 0.58 }, { buttons: 0, pointerId: 12 }))

    expect(emitMprCrosshair).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'move',
        phase: DRAG_ACTION_TYPES.start,
        viewportKey: 'mpr-ax'
      })
    )
    expect(emitViewportDrag).not.toHaveBeenCalled()
  })

  it('keeps explicit window drag ahead of MPR crosshair hit targets', () => {
    const { emitMprCrosshair, emitViewportDrag, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:window',
      activeTab: createMprCrosshairTab(),
      viewportKey: 'mpr-ax'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.5, y: 0.5 }, { pointerId: 21 }), 'mpr-ax')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.58, y: 0.54 }, { pointerId: 21 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.58, y: 0.54 }, { buttons: 0, pointerId: 21 }))

    const payloads = getViewportDragPayloads(emitViewportDrag)
    expect(emitMprCrosshair).not.toHaveBeenCalled()
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.window, DRAG_ACTION_TYPES.start)).toBe(true)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.window, DRAG_ACTION_TYPES.move)).toBe(true)
    expect(hasViewportDragPhase(payloads, VIEW_OPERATION_TYPES.window, DRAG_ACTION_TYPES.end)).toBe(true)
  })

  it('sends the pointerup crosshair position only in the final end payload', () => {
    const { emitMprCrosshair, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:crosshair',
      activeTab: createMprCrosshairTab(),
      viewportKey: 'mpr-ax'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.5, y: 0.5 }, { pointerId: 20 }), 'mpr-ax')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.56, y: 0.58 }, { pointerId: 20 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.68, y: 0.72 }, { buttons: 0, pointerId: 20 }))

    const payloads = emitMprCrosshair.mock.calls.map(([payload]) => payload)
    const releaseMoves = payloads.filter(
      (payload) => payload.phase === DRAG_ACTION_TYPES.move && payload.x === 0.68 && payload.y === 0.72
    )
    expect(releaseMoves).toHaveLength(0)
    expect(payloads.at(-1)).toMatchObject({
      phase: DRAG_ACTION_TYPES.end,
      viewportKey: 'mpr-ax',
      x: 0.68,
      y: 0.72
    })
  })

  it('sends canvas-space coordinates for MPR crosshair drags', () => {
    const { emitMprCrosshair, pointer, viewport } = createPointerHarness({
      activeOperation: 'stack:crosshair',
      activeTab: createMprCrosshairTab(),
      imageNaturalWidth: 100,
      imageNaturalHeight: 200,
      viewportKey: 'mpr-ax'
    })

    pointer.handleViewportPointerDown(createPointerEvent(viewport, { x: 0.5, y: 0.5 }, { pointerId: 24 }), 'mpr-ax')
    pointer.handleViewportPointerMove(createPointerEvent(viewport, { x: 0.6, y: 0.5 }, { pointerId: 24 }))
    pointer.handleViewportPointerUp(createPointerEvent(viewport, { x: 0.6, y: 0.5 }, { buttons: 0, pointerId: 24 }))

    const payloads = emitMprCrosshair.mock.calls.map(([payload]) => payload)
    expect(payloads.at(-1)).toMatchObject({
      phase: DRAG_ACTION_TYPES.end,
      viewportKey: 'mpr-ax',
      x: 0.6,
      y: 0.5,
      canvasX: 0.6,
      canvasY: 0.5,
      canvasWidth: 200,
      canvasHeight: 200
    })
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
