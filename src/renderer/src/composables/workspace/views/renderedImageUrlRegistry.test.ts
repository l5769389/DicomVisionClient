import { describe, expect, it, vi } from 'vitest'
import { createRenderedImageUrlRegistry } from './renderedImageUrlRegistry'

describe('rendered image URL registry', () => {
  it('releases only URLs created or marked as owned by the registry', () => {
    const revokeObjectUrl = vi.fn()
    const registry = createRenderedImageUrlRegistry({
      createObjectUrl: vi.fn(() => 'blob:created'),
      revokeObjectUrl
    })

    const imageSrc = registry.create(new Uint8Array([1, 2, 3]), 'image/png')
    registry.revoke('blob:foreign')
    registry.revoke(imageSrc)
    registry.revoke(imageSrc)

    expect(revokeObjectUrl).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:created')
  })

  it('clones an owned blob URL through fetch and tracks the clone', async () => {
    const revokeObjectUrl = vi.fn()
    const registry = createRenderedImageUrlRegistry({
      createObjectUrl: vi.fn(() => 'blob:clone'),
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['data'], { type: 'image/png' }))
      }),
      revokeObjectUrl
    })

    const clone = await registry.clone('blob:source')

    expect(clone).toEqual({ imageSrc: 'blob:clone', ownsImageSrc: true })
    registry.revoke(clone.imageSrc)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:clone')
  })
})
