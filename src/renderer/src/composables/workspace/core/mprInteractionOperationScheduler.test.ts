import { describe, expect, it, vi } from 'vitest'
import { DRAG_ACTION_TYPES, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { createMprInteractionOperationScheduler } from './mprInteractionOperationScheduler'

describe('view interaction operation scheduler', () => {
  it('caps interactive moves at 16ms before backend preview feedback', () => {
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

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit.mock.calls[0]).toEqual(['mpr-ax', {
      opType: VIEW_OPERATION_TYPES.crosshair,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0.1,
      y: 0.2
    }])
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(16)

    now = 16
    timers[0].callback()
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit.mock.calls[1]).toEqual(['mpr-ax', {
      opType: VIEW_OPERATION_TYPES.crosshair,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0.3,
      y: 0.4
    }])
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

    scheduler.recordBackendPreview('mpr-cor', 1)
    now = 80
    scheduler.recordBackendPreview('mpr-cor', 2)

    scheduler.emit('mpr-cor', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.start,
      x: 0,
      y: 0
    })
    now = 100
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
    now = 112
    scheduler.emit('mpr-cor', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.end,
      x: 24,
      y: 6
    })

    expect(clearTimeout).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledTimes(4)
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
        x: 12,
        y: 3
      }
    ])
    expect(emit.mock.calls[2]).toEqual([
      'mpr-cor',
      {
        opType: VIEW_OPERATION_TYPES.window,
        actionType: DRAG_ACTION_TYPES.move,
        x: 24,
        y: 6
      }
    ])
    expect(emit.mock.calls[3]).toEqual([
      'mpr-cor',
      {
        opType: VIEW_OPERATION_TYPES.window,
        actionType: DRAG_ACTION_TYPES.end,
        x: 24,
        y: 6
      }
    ])
  })

  it('throttles fusion registration moves without waiting for backend feedback', () => {
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

    scheduler.emit('fusion-overlay', {
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: DRAG_ACTION_TYPES.move,
      subOpType: 'translate',
      x: 2,
      y: 1
    })
    now = 6
    scheduler.emit('fusion-overlay', {
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: DRAG_ACTION_TYPES.move,
      subOpType: 'translate',
      x: 12,
      y: 8
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(1)

    now = 16
    timers[0].callback()
    expect(emit.mock.calls[1]).toEqual([
      'fusion-overlay',
      {
        opType: VIEW_OPERATION_TYPES.fusionRegistration,
        actionType: DRAG_ACTION_TYPES.move,
        subOpType: 'translate',
        x: 12,
        y: 8
      }
    ])
  })

  it('keeps fusion registration at 16ms even after slow preview feedback updates the fallback cadence', () => {
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

    scheduler.recordBackendPreview('some-preview-view', null)
    now = 150
    scheduler.recordBackendPreview('some-preview-view', null)

    scheduler.emit('fusion-overlay', {
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: DRAG_ACTION_TYPES.move,
      subOpType: 'translate',
      x: 10,
      y: 0
    })
    now = 156
    scheduler.emit('fusion-overlay', {
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: DRAG_ACTION_TYPES.move,
      subOpType: 'translate',
      x: 20,
      y: 0
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(10)

    now = 166
    timers[0].callback()
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit.mock.calls[1]).toEqual([
      'fusion-overlay',
      {
        opType: VIEW_OPERATION_TYPES.fusionRegistration,
        actionType: DRAG_ACTION_TYPES.move,
        subOpType: 'translate',
        x: 20,
        y: 0
      }
    ])
  })

  it('drops pending fusion registration moves before drag end because end carries the final delta', () => {
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

    scheduler.emit('fusion-overlay', {
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: DRAG_ACTION_TYPES.move,
      subOpType: 'translate',
      x: 2,
      y: 1
    })
    now = 6
    scheduler.emit('fusion-overlay', {
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: DRAG_ACTION_TYPES.move,
      subOpType: 'translate',
      x: 12,
      y: 8
    })
    scheduler.emit('fusion-overlay', {
      opType: VIEW_OPERATION_TYPES.fusionRegistration,
      actionType: DRAG_ACTION_TYPES.end,
      subOpType: 'translate',
      x: 12,
      y: 8
    })

    expect(emit.mock.calls).toEqual([
      [
        'fusion-overlay',
        {
          opType: VIEW_OPERATION_TYPES.fusionRegistration,
          actionType: DRAG_ACTION_TYPES.move,
          subOpType: 'translate',
          x: 2,
          y: 1
        }
      ],
      [
        'fusion-overlay',
        {
          opType: VIEW_OPERATION_TYPES.fusionRegistration,
          actionType: DRAG_ACTION_TYPES.end,
          subOpType: 'translate',
          x: 12,
          y: 8
        }
      ]
    ])
  })

  it('resets move throttling at the start of each drag gesture', () => {
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
      opType: VIEW_OPERATION_TYPES.pan,
      actionType: DRAG_ACTION_TYPES.move,
      x: 5,
      y: 0
    })
    now = 10
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.pan,
      actionType: DRAG_ACTION_TYPES.start,
      x: 0,
      y: 0
    })
    now = 20
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.pan,
      actionType: DRAG_ACTION_TYPES.move,
      x: 6,
      y: 1
    })

    expect(timers).toHaveLength(0)
    expect(emit.mock.calls.at(-1)).toEqual([
      'mpr-ax',
      {
        opType: VIEW_OPERATION_TYPES.pan,
        actionType: DRAG_ACTION_TYPES.move,
        x: 6,
        y: 1
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

    scheduler.recordBackendPreview('mpr-sag', 1)
    now = 200
    scheduler.recordBackendPreview('mpr-sag', 2)
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
    expect(timers[0].delay).toBe(200)
  })

  it('throttles MPR MIP slider moves with backend preview feedback and flushes final value', () => {
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
      opType: VIEW_OPERATION_TYPES.mprMipConfig,
      actionType: DRAG_ACTION_TYPES.move,
      mprMipConfig: {
        enabled: true,
        viewports: {
          'mpr-ax': { thickness: 12 }
        }
      }
    })
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.mprMipConfig,
      actionType: DRAG_ACTION_TYPES.move,
      mprMipConfig: {
        enabled: true,
        viewports: {
          'mpr-ax': { thickness: 24 }
        }
      }
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(0)

    now = 96
    scheduler.recordBackendPreview('mpr-ax', 1)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(4)

    now = 100
    timers[0].callback()
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.mprMipConfig,
      actionType: DRAG_ACTION_TYPES.end,
      mprMipConfig: {
        enabled: true,
        viewports: {
          'mpr-ax': { thickness: 36 }
        }
      }
    })

    expect(emit).toHaveBeenCalledTimes(3)
    expect(emit.mock.calls[1][1]).toMatchObject({
      actionType: DRAG_ACTION_TYPES.move,
      mprMipConfig: {
        viewports: {
          'mpr-ax': { thickness: 24 }
        }
      }
    })
    expect(emit.mock.calls[2][1]).toMatchObject({
      actionType: DRAG_ACTION_TYPES.end,
      mprMipConfig: {
        viewports: {
          'mpr-ax': { thickness: 36 }
        }
      }
    })
  })

  it('sends the latest MPR segmentation move on a trailing timer without waiting for backend feedback', () => {
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
      opType: VIEW_OPERATION_TYPES.mprSegmentation,
      actionType: DRAG_ACTION_TYPES.move,
      mprSegmentationConfig: { enabled: true, clientRevision: 1 }
    })
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.mprSegmentation,
      actionType: DRAG_ACTION_TYPES.move,
      mprSegmentationConfig: { enabled: true, clientRevision: 2 }
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(80)

    now = 80
    timers[0].callback()
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit.mock.calls[1][1]).toMatchObject({
      actionType: DRAG_ACTION_TYPES.move,
      mprSegmentationConfig: { clientRevision: 2 }
    })
  })

  it('waits for matching same-revision MPR feedback before sending the next pan move', () => {
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

    scheduler.recordBackendPreview('mpr-ax', 7)
    now = 200
    scheduler.recordBackendPreview('mpr-ax', 7)

    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.pan,
      actionType: DRAG_ACTION_TYPES.move,
      x: 4,
      y: 2
    })
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.pan,
      actionType: DRAG_ACTION_TYPES.move,
      x: 8,
      y: 4
    })
    scheduler.emit('mpr-cor', {
      opType: VIEW_OPERATION_TYPES.zoom,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0,
      y: -12
    })

    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit.mock.calls[0]).toEqual([
      'mpr-ax',
      {
        opType: VIEW_OPERATION_TYPES.pan,
        actionType: DRAG_ACTION_TYPES.move,
        x: 4,
        y: 2
      }
    ])
    expect(emit.mock.calls[1]).toEqual([
      'mpr-cor',
      {
        opType: VIEW_OPERATION_TYPES.zoom,
        actionType: DRAG_ACTION_TYPES.move,
        x: 0,
        y: -12
      }
    ])
    expect(timers).toHaveLength(0)

    now = 230
    scheduler.recordBackendPreview('mpr-ax', 7)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(4)

    now = 234
    timers[0].callback()
    expect(emit).toHaveBeenCalledWith('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.pan,
      actionType: DRAG_ACTION_TYPES.move,
      x: 8,
      y: 4
    })
  })

  it('caps the fastest matching backend preview cadence at 16ms', () => {
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

    scheduler.emit('view-1', {
      opType: VIEW_OPERATION_TYPES.pan,
      actionType: DRAG_ACTION_TYPES.move,
      x: 1,
      y: 0
    })
    scheduler.emit('view-1', {
      opType: VIEW_OPERATION_TYPES.pan,
      actionType: DRAG_ACTION_TYPES.move,
      x: 2,
      y: 0
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(0)

    now = 5
    scheduler.recordBackendPreview('view-1', null)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(11)
  })

  it('throttles zoom at a stable cadence without waiting for matching feedback', () => {
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
      opType: VIEW_OPERATION_TYPES.zoom,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0,
      y: -4
    })
    now = 5
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.zoom,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0,
      y: -10
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(19)

    now = 24
    timers[0].callback()
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit.mock.calls[1]).toEqual([
      'mpr-ax',
      {
        opType: VIEW_OPERATION_TYPES.zoom,
        actionType: DRAG_ACTION_TYPES.move,
        x: 0,
        y: -10
      }
    ])
  })

  it('caps slow backend feedback fallback for zoom moves at 48ms', () => {
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

    scheduler.recordBackendPreview('mpr-ax', null)
    now = 120
    scheduler.recordBackendPreview('mpr-ax', null)

    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.zoom,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0,
      y: -1
    })
    now = 130
    scheduler.emit('mpr-ax', {
      opType: VIEW_OPERATION_TYPES.zoom,
      actionType: DRAG_ACTION_TYPES.move,
      x: 0,
      y: -2
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(38)
  })

  it('does not cap slow matching backend preview cadence', () => {
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

    scheduler.emit('view-1', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.move,
      x: 1,
      y: 0
    })
    scheduler.emit('view-1', {
      opType: VIEW_OPERATION_TYPES.window,
      actionType: DRAG_ACTION_TYPES.move,
      x: 2,
      y: 0
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(0)

    now = 900
    scheduler.recordBackendPreview('view-1', null)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(4)
    expect(emit).toHaveBeenCalledTimes(1)

    now = 904
    timers[0].callback()
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit.mock.calls[1]).toEqual([
      'view-1',
      {
        opType: VIEW_OPERATION_TYPES.window,
        actionType: DRAG_ACTION_TYPES.move,
        x: 2,
        y: 0
      }
    ])
  })

  it('throttles non-MPR dense view moves using backend feedback', () => {
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

    scheduler.emit('stack-view', {
      opType: VIEW_OPERATION_TYPES.rotate3d,
      actionType: DRAG_ACTION_TYPES.move,
      x: 4,
      y: 2
    })
    scheduler.emit('stack-view', {
      opType: VIEW_OPERATION_TYPES.rotate3d,
      actionType: DRAG_ACTION_TYPES.move,
      x: 8,
      y: 4
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(0)

    now = 24
    scheduler.recordBackendPreview('stack-view', null)
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBe(4)
  })
})
