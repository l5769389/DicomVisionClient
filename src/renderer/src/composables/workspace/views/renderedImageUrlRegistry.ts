import { resolveRenderedImageBlobPart } from './renderedImageObjectUrl'

interface RenderedImageUrlRegistryOptions {
  createObjectUrl?: typeof URL.createObjectURL
  fetch?: typeof fetch
  revokeObjectUrl?: typeof URL.revokeObjectURL
}

export function isRenderedImageObjectUrl(imageSrc: string | null | undefined): imageSrc is string {
  return Boolean(imageSrc?.startsWith('blob:'))
}

export function createRenderedImageUrlRegistry(options: RenderedImageUrlRegistryOptions = {}) {
  const ownedUrls = new Set<string>()
  const createObjectUrl = options.createObjectUrl ?? ((blob: Blob | MediaSource) => URL.createObjectURL(blob))
  const revokeObjectUrl = options.revokeObjectUrl ?? ((imageSrc: string) => URL.revokeObjectURL(imageSrc))
  const fetchImpl = options.fetch ?? fetch

  function markOwned(imageSrc: string | null | undefined): void {
    if (isRenderedImageObjectUrl(imageSrc)) {
      ownedUrls.add(imageSrc)
    }
  }

  function create(imageBinary: ArrayBuffer | Uint8Array, mimeType: string): string {
    const imageSrc = createObjectUrl(new Blob([resolveRenderedImageBlobPart(imageBinary)], { type: mimeType }))
    markOwned(imageSrc)
    return imageSrc
  }

  async function clone(imageSrc: string | null | undefined): Promise<{ imageSrc: string | null; ownsImageSrc: boolean }> {
    if (!imageSrc) {
      return { imageSrc: null, ownsImageSrc: false }
    }
    if (!isRenderedImageObjectUrl(imageSrc)) {
      return { imageSrc, ownsImageSrc: false }
    }

    try {
      const response = await fetchImpl(imageSrc)
      if (!response.ok) {
        return { imageSrc, ownsImageSrc: false }
      }
      const clonedImageSrc = createObjectUrl(await response.blob())
      markOwned(clonedImageSrc)
      return {
        imageSrc: clonedImageSrc,
        ownsImageSrc: true
      }
    } catch {
      return { imageSrc, ownsImageSrc: false }
    }
  }

  function revoke(imageSrc: string | null | undefined): void {
    if (!isRenderedImageObjectUrl(imageSrc)) {
      return
    }
    if (!ownedUrls.delete(imageSrc)) {
      return
    }
    revokeObjectUrl(imageSrc)
  }

  function revokeMany(imageSrcs: Iterable<string | null | undefined>): void {
    for (const imageSrc of imageSrcs) {
      revoke(imageSrc)
    }
  }

  function revokeAll(): void {
    for (const imageSrc of [...ownedUrls]) {
      revoke(imageSrc)
    }
  }

  return {
    clone,
    create,
    markOwned,
    revoke,
    revokeAll,
    revokeMany
  }
}
