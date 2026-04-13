import { describe, expect, it } from 'vitest'
import { createMeasurementInteractionController, resolveDraftMeasurementMode } from './measurementInteractionMachine'

describe('measurementInteractionMachine', () => {
  it('tracks selection and reset explicitly', () => {
    const controller = createMeasurementInteractionController()

    controller.select('single', 'm1')
    expect(controller.getState()).toEqual({
      kind: 'selected',
      viewportKey: 'single',
      measurementId: 'm1'
    })

    controller.reset()
    expect(controller.getState()).toEqual({ kind: 'idle' })
  })

  it('transitions pending move into moving with updated context', () => {
    const controller = createMeasurementInteractionController()

    controller.startMovePending('single', 'm1', { x: 0.1, y: 0.2 })
    expect(controller.getState()).toEqual({
      kind: 'move_pending',
      viewportKey: 'single',
      measurementId: 'm1',
      startPoint: { x: 0.1, y: 0.2 }
    })

    controller.startMoving({ x: 0.1, y: 0.2 })
    controller.markChanged()
    controller.updateLastPoint({ x: 0.3, y: 0.4 })

    expect(controller.getState()).toEqual({
      kind: 'moving',
      viewportKey: 'single',
      measurementId: 'm1',
      lastPoint: { x: 0.3, y: 0.4 },
      hasChanged: true
    })
  })

  it('tracks handle editing separately from moving', () => {
    const controller = createMeasurementInteractionController()

    controller.startEditingHandle('mpr-ax', 'm2', 1)
    controller.markChanged()

    expect(controller.getState()).toEqual({
      kind: 'editing_handle',
      viewportKey: 'mpr-ax',
      measurementId: 'm2',
      handleIndex: 1,
      hasChanged: true
    })
  })

  it('maps interaction states to draft render modes', () => {
    expect(resolveDraftMeasurementMode({ kind: 'idle' }, 'single', false)).toBe('draft')
    expect(
      resolveDraftMeasurementMode(
        { kind: 'selected', viewportKey: 'single', measurementId: 'm1' },
        'single',
        true
      )
    ).toBe('selected')
    expect(
      resolveDraftMeasurementMode(
        { kind: 'move_pending', viewportKey: 'single', measurementId: 'm1', startPoint: { x: 0.1, y: 0.1 } },
        'single',
        true
      )
    ).toBe('selected')
    expect(
      resolveDraftMeasurementMode(
        { kind: 'moving', viewportKey: 'single', measurementId: 'm1', lastPoint: { x: 0.2, y: 0.2 }, hasChanged: true },
        'single',
        true
      )
    ).toBe('moving')
    expect(
      resolveDraftMeasurementMode(
        { kind: 'editing_handle', viewportKey: 'single', measurementId: 'm1', handleIndex: 0, hasChanged: false },
        'single',
        true
      )
    ).toBe('draft')
  })
})
