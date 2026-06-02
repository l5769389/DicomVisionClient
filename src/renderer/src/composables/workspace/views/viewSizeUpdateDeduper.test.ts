import { describe, expect, it, vi } from 'vitest'
import { createViewSizeUpdateDeduper } from './viewSizeUpdateDeduper'

describe('view size update deduper', () => {
  it('joins concurrent requests for the same view size and bind mode', async () => {
    const deduper = createViewSizeUpdateDeduper()
    let resolveSend: () => void = () => undefined
    const send = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve
        })
    )
    const update = {
      viewId: 'view-1',
      size: { width: 512, height: 384 }
    }

    const first = deduper.run(update, true, send)
    const second = deduper.run(update, true, send)

    expect(send).toHaveBeenCalledTimes(1)
    resolveSend()
    await Promise.all([first, second])
  })

  it('keeps different sizes and bind modes independent', async () => {
    const deduper = createViewSizeUpdateDeduper()
    const send = vi.fn().mockResolvedValue(undefined)

    await Promise.all([
      deduper.run({ viewId: 'view-1', size: { width: 512, height: 384 } }, true, send),
      deduper.run({ viewId: 'view-1', size: { width: 513, height: 384 } }, true, send),
      deduper.run({ viewId: 'view-1', size: { width: 512, height: 384 } }, false, send)
    ])

    expect(send).toHaveBeenCalledTimes(3)
  })
})
