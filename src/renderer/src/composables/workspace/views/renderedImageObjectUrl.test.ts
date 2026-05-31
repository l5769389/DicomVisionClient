import { describe, expect, it } from 'vitest'
import { resolveRenderedImageBlobPart } from './renderedImageObjectUrl'

describe('rendered image object URL helpers', () => {
  it('uses a complete ArrayBuffer without copying', () => {
    const buffer = new ArrayBuffer(4)

    expect(resolveRenderedImageBlobPart(buffer)).toBe(buffer)
  })

  it('uses a complete Uint8Array backing buffer without copying', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])

    expect(resolveRenderedImageBlobPart(bytes)).toBe(bytes.buffer)
  })

  it('slices an offset Uint8Array view to avoid leaking unrelated bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4])
    const view = bytes.subarray(1, 4)
    const blobPart = resolveRenderedImageBlobPart(view)

    expect(blobPart).toBeInstanceOf(ArrayBuffer)
    expect(blobPart).not.toBe(bytes.buffer)
    expect(Array.from(new Uint8Array(blobPart as ArrayBuffer))).toEqual([1, 2, 3])
  })
})
