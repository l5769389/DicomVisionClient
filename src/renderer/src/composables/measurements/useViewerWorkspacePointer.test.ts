import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
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

function installViewport(): HTMLElement {
  const viewport = document.createElement('div')
  viewport.className = 'viewer-viewport'
  viewport.dataset.viewportKey = 'single'
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
  options: { buttons?: number; pointerId?: number; timeStamp?: number } = {}
): PointerEvent {
  const rect = createRect()
  return {
    isPrimary: true,
    button: 0,
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

function createPointerHarness() {
  const viewport = installViewport()
  const activeOperation = ref('stack:measure:freeform')
  const activeTab = ref({ viewType: 'Stack' } as ViewerTabItem)
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

  const pointer = useViewerWorkspacePointer({
    activeOperation,
    activeTab,
    emitActiveViewportChange: vi.fn(),
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
    emitMprCrosshair: vi.fn(),
    emitViewportDrag: vi.fn(),
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
    copySelectedFreeform,
    createdMeasurements,
    pointer,
    viewport
  }
}

afterEach(() => {
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
})
