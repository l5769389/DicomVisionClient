import { describe, expect, it, vi } from 'vitest'
import { createLatestFrameEmitter } from './viewportDragMoveScheduler'

describe('viewport drag move scheduler', () => {
  it('emits only the latest move payload within one animation frame', () => {
    const callbacks: FrameRequestCallback[] = []
    const emit = vi.fn()
    const scheduler = createLatestFrameEmitter<{ deltaX: number }>({
      emit,
      requestAnimationFrame: (callback) => {
        callbacks.push(callback)
        return callbacks.length
      },
      cancelAnimationFrame: vi.fn()
    })

    scheduler.schedule({ deltaX: 1 })
    scheduler.schedule({ deltaX: 2 })

    expect(emit).not.toHaveBeenCalled()
    callbacks[0]?.(16)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith({ deltaX: 2 })
  })

  it('flushes a pending payload immediately and cancels the frame', () => {
    const cancelAnimationFrame = vi.fn()
    const emit = vi.fn()
    const scheduler = createLatestFrameEmitter<{ deltaX: number }>({
      emit,
      requestAnimationFrame: () => 9,
      cancelAnimationFrame
    })

    scheduler.schedule({ deltaX: 4 })
    scheduler.flush()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(9)
    expect(emit).toHaveBeenCalledWith({ deltaX: 4 })
  })
})
