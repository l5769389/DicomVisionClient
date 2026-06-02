import { describe, expect, it, vi } from 'vitest'
import { DRAG_ACTION_TYPES, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { createMprInteractionOperationScheduler } from './mprInteractionOperationScheduler'

describe('mpr interaction operation scheduler', () => {
  it('coalesces MPR drag moves to the latest payload in one animation frame', () => {
    const callbacks: FrameRequestCallback[] = []
    const emit = vi.fn()
    const scheduler = createMprInteractionOperationScheduler({
      emit,
      requestAnimationFrame: (callback) => {
        callbacks.push(callback)
        return callbacks.length
      },
      cancelAnimationFrame: vi.fn()
    })

    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.crosshair,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0.1,
      y: 0.2
    })
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.crosshair,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0.3,
      y: 0.4
    })

    expect(emit).not.toHaveBeenCalled()
    callbacks[0]?.(16)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.crosshair,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0.3,
      y: 0.4
    })
  })

  it('keeps start immediate and flushes the latest move before end', () => {
    const cancelAnimationFrame = vi.fn()
    const emit = vi.fn()
    const scheduler = createMprInteractionOperationScheduler({
      emit,
      requestAnimationFrame: () => 9,
      cancelAnimationFrame
    })

    scheduler.emit('mpr-cor', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.start,
      x: 0,
      y: 0
    })
    scheduler.emit('mpr-cor', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.move,
      x: 12,
      y: 3
    })
    scheduler.emit('mpr-cor', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.move,
      x: 24,
      y: 6
    })
    scheduler.emit('mpr-cor', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.end,
      x: 24,
      y: 6
    })

    expect(cancelAnimationFrame).toHaveBeenCalledWith(9)
    expect(emit).toHaveBeenCalledTimes(3)
    expect(emit.mock.calls[0]).toEqual([
      'mpr-cor',
      {
        opType: VIEW_OPERATION_TYPES.window,
        actionType: DRAG_ACTION_TYPES.start,
        x: 0,
        y: 0
      }
    ])
    expect(emit.mock.calls[1]).toEqual([
      'mpr-cor',
      {
        opType: VIEW_OPERATION_TYPES.window,
        actionType: DRAG_ACTION_TYPES.move,
        x: 24,
        y: 6
      }
    ])
    expect(emit.mock.calls[2]).toEqual([
      'mpr-cor',
      {
        opType: VIEW_OPERATION_TYPES.window,
        actionType: DRAG_ACTION_TYPES.end,
        x: 24,
        y: 6
      }
    ])
  })
})
