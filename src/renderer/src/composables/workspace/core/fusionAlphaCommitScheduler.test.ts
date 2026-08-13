import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFusionAlphaCommitScheduler } from './fusionAlphaCommitScheduler'

describe('fusionAlphaCommitScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('trails rapid alpha changes and emits only the latest value', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const scheduler = createFusionAlphaCommitScheduler({ debounceMs: 80, emit })

    scheduler.schedule({ viewId: 'fusion-view', alpha: 0.8 })
    scheduler.schedule({ viewId: 'fusion-view', alpha: 0.45 })
    vi.advanceTimersByTime(79)
    expect(emit).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith({ viewId: 'fusion-view', alpha: 0.45 })
  })

  it('flushes explicitly and does not mix commits from different views', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const scheduler = createFusionAlphaCommitScheduler({ debounceMs: 80, emit })

    scheduler.schedule({ viewId: 'first-view', alpha: 0.2 })
    scheduler.schedule({ viewId: 'second-view', alpha: 0.7 })
    expect(emit).toHaveBeenNthCalledWith(1, { viewId: 'first-view', alpha: 0.2 })

    scheduler.flush()
    expect(emit).toHaveBeenNthCalledWith(2, { viewId: 'second-view', alpha: 0.7 })
    vi.runAllTimers()
    expect(emit).toHaveBeenCalledTimes(2)
  })
})
