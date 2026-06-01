import { describe, expect, it, vi } from 'vitest'
import { createRenderTabScheduler } from './renderTabScheduler'

describe('render tab scheduler', () => {
  it('coalesces duplicate tab renders in one frame and keeps the latest force flag', async () => {
    const callbacks: FrameRequestCallback[] = []
    const renderNow = vi.fn().mockResolvedValue(undefined)
    const scheduler = createRenderTabScheduler({
      renderNow,
      requestAnimationFrame: (callback) => {
        callbacks.push(callback)
        return callbacks.length
      },
      cancelAnimationFrame: vi.fn()
    })

    const first = scheduler.schedule('tab-1', false)
    const second = scheduler.schedule('tab-1', true)

    expect(callbacks).toHaveLength(1)
    callbacks[0]?.(16)
    await Promise.all([first, second])

    expect(renderNow).toHaveBeenCalledTimes(1)
    expect(renderNow).toHaveBeenCalledWith('tab-1', true)
  })

  it('keeps independent tab keys as separate render jobs', async () => {
    const callbacks: FrameRequestCallback[] = []
    const renderNow = vi.fn().mockResolvedValue(undefined)
    const scheduler = createRenderTabScheduler({
      renderNow,
      requestAnimationFrame: (callback) => {
        callbacks.push(callback)
        return callbacks.length
      },
      cancelAnimationFrame: vi.fn()
    })

    const first = scheduler.schedule('tab-1')
    const second = scheduler.schedule('tab-2')
    callbacks[0]?.(16)
    await Promise.all([first, second])

    expect(renderNow).toHaveBeenCalledTimes(2)
    expect(renderNow).toHaveBeenNthCalledWith(1, 'tab-1', false)
    expect(renderNow).toHaveBeenNthCalledWith(2, 'tab-2', false)
  })

  it('cancels pending render jobs without invoking renderNow', async () => {
    const cancelAnimationFrame = vi.fn()
    const renderNow = vi.fn().mockResolvedValue(undefined)
    const scheduler = createRenderTabScheduler({
      renderNow,
      requestAnimationFrame: () => 42,
      cancelAnimationFrame
    })

    await Promise.all([
      scheduler.schedule('tab-1'),
      scheduler.schedule('tab-1'),
      Promise.resolve().then(() => scheduler.cancel())
    ])

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42)
    expect(renderNow).not.toHaveBeenCalled()
  })
})
