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
    expect(refreshingState).toMatchObject({
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

  it('finishes the active batch and only follows with the latest pending batch', async () => {
    const pending = new Map<string, (response: Response) => void>()
    const stateChange = vi.fn()
    const loader = createMontageTileLoader({
      fetch: vi.fn((url) => new Promise<Response>((resolve) => pending.set(String(url), resolve))),
      createObjectUrl: (blob) => `blob:${blob.size}:${Math.random()}`,
      revokeObjectUrl: vi.fn(),
      onStateChange: stateChange
    })

    loader.sync([{ index: 0, url: 'http://backend.test/tile/0?ww=2' }])
    loader.sync([{ index: 0, url: 'http://backend.test/tile/0?ww=3' }])
    loader.sync([{ index: 0, url: 'http://backend.test/tile/0?ww=4' }])

    expect([...pending.keys()]).toEqual(['http://backend.test/tile/0?ww=2'])
    pending.get('http://backend.test/tile/0?ww=2')?.(imageResponse())
    await vi.waitFor(() => expect(pending.has('http://backend.test/tile/0?ww=4')).toBe(true))
    expect(pending.has('http://backend.test/tile/0?ww=3')).toBe(false)
    pending.get('http://backend.test/tile/0?ww=4')?.(imageResponse())
    await vi.waitFor(() => {
      expect(stateChange.mock.calls.some(([, state]) => state?.requestUrl?.includes('ww=4'))).toBe(true)
    })
    loader.dispose()
  })

  it('does not let a preview replace a queued final display batch', async () => {
    const pending = new Map<string, (response: Response) => void>()
    const stateChange = vi.fn()
    const fetchMock = vi.fn((url) => new Promise<Response>((resolve) => pending.set(String(url), resolve)))
    const loader = createMontageTileLoader({
      fetch: fetchMock,
      createObjectUrl: () => `blob:tile-${Math.random()}`,
      revokeObjectUrl: vi.fn(),
      onStateChange: stateChange
    })

    loader.sync([{
      index: 0,
      url: 'http://backend.test/tile/0?ww=2&renderIntent=preview',
      displayRevision: 1,
      renderIntent: 'preview'
    }])
    loader.sync([{
      index: 0,
      url: 'http://backend.test/tile/0?ww=4&renderIntent=final',
      displayRevision: 2,
      renderIntent: 'final'
    }])
    loader.sync([{
      index: 0,
      url: 'http://backend.test/tile/0?ww=3&renderIntent=preview',
      displayRevision: 1,
      renderIntent: 'preview'
    }])

    pending.get('http://backend.test/tile/0?ww=2&renderIntent=preview')?.(imageResponse())
    await vi.waitFor(() => expect(pending.has('http://backend.test/tile/0?ww=4&renderIntent=final')).toBe(true))
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('ww=3'))).toBe(false)

    pending.get('http://backend.test/tile/0?ww=4&renderIntent=final')?.(imageResponse())
    await vi.waitFor(() => {
      expect(stateChange.mock.calls.some(([, state]) => state?.displayRevision === 2 && state?.status === 'ready')).toBe(true)
    })
    loader.dispose()
  })
})
