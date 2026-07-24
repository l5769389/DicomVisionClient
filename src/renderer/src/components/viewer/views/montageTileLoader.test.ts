import { describe, expect, it, vi } from 'vitest'
import { createMontageTileLoader, type MontageTileState } from './montageTileLoader'

function imageResponse(): Response {
  return new Response(new Blob(['tile'], { type: 'image/webp' }), {
    status: 200,
    headers: { 'Content-Type': 'image/webp' }
  })
}

describe('createMontageTileLoader', () => {
  it('limits concurrent requests and drains the visible queue', async () => {
    const pending: Array<() => void> = []
    let active = 0
    let peakActive = 0
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          active += 1
          peakActive = Math.max(peakActive, active)
          pending.push(() => {
            active -= 1
            resolve(imageResponse())
          })
        })
    )
    const states = new Map<number, MontageTileState>()
    const loader = createMontageTileLoader({
      fetch: fetchMock,
      maxConcurrent: 3,
      createObjectUrl: (_blob) => `blob:tile-${states.size}`,
      revokeObjectUrl: vi.fn(),
      onStateChange(index, state) {
        if (state) {
          states.set(index, state)
        }
      }
    })

    loader.sync(
      Array.from({ length: 8 }, (_, index) => ({
        index,
        url: `http://backend.test/tile/${index}`
      }))
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(peakActive).toBe(3)

    while (pending.length) {
      pending.shift()?.()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    }
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(8)
      expect([...states.values()].filter((state) => state.status === 'ready')).toHaveLength(8)
    })
    expect(peakActive).toBe(3)
    loader.dispose()
  })

  it('cancels an in-flight tile after it leaves the virtualized region', async () => {
    let aborted = false
    const fetchMock = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
    )
    const stateChange = vi.fn()
    const loader = createMontageTileLoader({
      fetch: fetchMock,
      onStateChange: stateChange
    })

    loader.sync([{ index: 4, url: 'http://backend.test/tile/4' }])
    loader.sync([])
    await vi.waitFor(() => expect(aborted).toBe(true))
    expect(stateChange.mock.calls.some(([, state]) => state?.status === 'error')).toBe(false)
    loader.dispose()
  })

  it('revokes the previous image when display parameters change', async () => {
    const revokeObjectUrl = vi.fn()
    const stateChange = vi.fn()
    let objectUrlIndex = 0
    const loader = createMontageTileLoader({
      fetch: vi.fn(async () => imageResponse()),
      createObjectUrl: () => `blob:tile-${++objectUrlIndex}`,
      revokeObjectUrl,
      onStateChange: stateChange
    })

    loader.sync([{ index: 0, url: 'http://backend.test/tile/0?ww=400' }])
    await vi.waitFor(() => {
      expect(stateChange.mock.calls.some(([, state]) => state?.imageSrc === 'blob:tile-1')).toBe(true)
    })
    loader.sync([{ index: 0, url: 'http://backend.test/tile/0?ww=800' }])
    await vi.waitFor(() => {
      expect(stateChange.mock.calls.some(([, state]) => state?.imageSrc === 'blob:tile-2')).toBe(true)
    })

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:tile-1')
    loader.dispose()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:tile-2')
  })

  it('keeps the previous image visible while refreshing display parameters', async () => {
    const pending: Array<() => void> = []
    let objectUrlIndex = 0
    const stateChange = vi.fn()
    const loader = createMontageTileLoader({
      fetch: vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            pending.push(() => resolve(imageResponse()))
          })
      ),
      createObjectUrl: () => `blob:tile-${++objectUrlIndex}`,
      revokeObjectUrl: vi.fn(),
      onStateChange: stateChange
    })

    loader.sync([{ index: 0, url: 'http://backend.test/tile/0?ww=400' }])
    pending.shift()?.()
    await vi.waitFor(() => {
      expect(stateChange.mock.calls.some(([, state]) => state?.imageSrc === 'blob:tile-1')).toBe(true)
    })

    loader.sync([{ index: 0, url: 'http://backend.test/tile/0?ww=800' }])
    const refreshingState = stateChange.mock.calls.at(-1)?.[1]
    expect(refreshingState).toEqual({
      status: 'ready',
      imageSrc: 'blob:tile-1',
      isRefreshing: true
    })

    pending.shift()?.()
    await vi.waitFor(() => {
      expect(stateChange.mock.calls.some(([, state]) => state?.imageSrc === 'blob:tile-2')).toBe(true)
    })
    loader.dispose()
  })
})
