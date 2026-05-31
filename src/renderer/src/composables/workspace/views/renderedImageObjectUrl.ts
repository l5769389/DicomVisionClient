export function resolveRenderedImageBlobPart(imageBinary: ArrayBuffer | Uint8Array): BlobPart {
  if (imageBinary instanceof ArrayBuffer) {
    return imageBinary
  }

  const { buffer, byteLength, byteOffset } = imageBinary
  if (buffer instanceof ArrayBuffer) {
    if (byteOffset === 0 && byteLength === buffer.byteLength) {
      return buffer
    }
    return buffer.slice(byteOffset, byteOffset + byteLength)
  }

  return imageBinary.slice()
}

export function createRenderedImageObjectUrl(imageBinary: ArrayBuffer | Uint8Array, mimeType: string): string {
  return URL.createObjectURL(new Blob([resolveRenderedImageBlobPart(imageBinary)], { type: mimeType }))
}
