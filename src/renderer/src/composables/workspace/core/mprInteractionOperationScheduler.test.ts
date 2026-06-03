import { describe, expect, it, vi } from 'vitest'
import { DRAG_ACTION_TYPES, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { createMprInteractionOperationScheduler } from './mprInteractionOperationScheduler'

describe('mpr interaction operation scheduler', () => {
  it('throttles MPR drag moves and emits only the latest payload', () => {
    let now = 0
    const timers: Array<{ callback: () => void; delay: number }> = []
    const emit = vi.fn()
    const scheduler = createMprInteractionOperationScheduler({
      clearTimeout: vi.fn(),
      emit,
      now: () => now,
      setTimeout: (callback, delay) => {
        timers.push({ callback, delay })
        return timers.length as unknown as ReturnType<typeof window.setTimeout>
      }
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
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(80)

    now = 80
    timers[0].callback()
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.crosshair,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0.3,
      y: 0.4
    })
  })

  it('keeps start immediate and flushes the latest move before end', () => {
    let now = 0
    const timers: Array<{ callback: () => void; delay: number }> = []
    const clearTimeout = vi.fn()
    const emit = vi.fn()
    const scheduler = createMprInteractionOperationScheduler({
      clearTimeout,
      emit,
      now: () => now,
      setTimeout: (callback, delay) => {
        timers.push({ callback, delay })
        return timers.length as unknown as ReturnType<typeof window.setTimeout>
      }
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
    now = 12
    scheduler.emit('mpr-cor', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.end,
      x: 24,
      y: 6
    })

    expect(clearTimeout).toHaveBeenCalledWith(1)
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

  it('adapts the throttle interval to backend preview cadence', () => {
    let now = 0
    const timers: Array<{ callback: () => void; delay: number }> = []
    const emit = vi.fn()
    const scheduler = createMprInteractionOperationScheduler({
      clearTimeout: vi.fn(),
      emit,
      now: () => now,
      setTimeout: (callback, delay) => {
        timers.push({ callback, delay })
        return timers.length as unknown as ReturnType<typeof window.setTimeout>
      }
    })

    scheduler.recordBackendPreview(1)
    now = 200
    scheduler.recordBackendPreview(2)
    scheduler.emit('mpr-sag', {
      opType: VIEW_OPERATION_TYPES.mprOblique,
      actionType: DRAG_ACTION_TYPES.move,
      line: 'horizontal',
      x: 0.4,
      y: 0.5
    })
    scheduler.emit('mpr-sag', {
      opType: VIEW_OPERATION_TYPES.mprOblique,
      actionType: DRAG_ACTION_TYPES.move,
      line: 'horizontal',
      x: 0.6,
      y: 0.7
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(110)
  })
})
