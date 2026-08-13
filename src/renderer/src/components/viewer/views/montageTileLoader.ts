export type MontageTileStatus = 'loading' | 'ready' | 'error'

export interface MontageTileState {
  status: MontageTileStatus
  imageSrc?: string
  isRefreshing?: boolean
  batchRevision?: number
  displayRevision?: number
  requestUrl?: string
  errorCode?: 'backend-incompatible' | 'request-failed' | 'invalid-image'
  errorMessage?: string
  httpStatus?: number
}

export interface MontageTileRequest {
  index: number
  url: string
  headers?: Record<string, string>
  displayRevision?: number
  renderIntent?: 'preview' | 'final'
}

interface MontageTileLoaderOptions {
  createObjectUrl?: (blob: Blob) => string
  fetch?: typeof fetch
  maxConcurrent?: number
  maxRetained?: number
  onStateChange: (index: number, state: MontageTileState | null) => void
  revokeObjectUrl?: (url: string) => void
}

interface ParsedRequestError {
  code: NonNullable<MontageTileState['errorCode']>
  message: string
  status: number
}

interface Batch {
  revision: number
  requests: MontageTileRequest[]
  controllers: AbortController[]
  cancelled: boolean
}

const DEFAULT_MAX_CONCURRENT = 6
const DEFAULT_MAX_RETAINED = 96

async function parseRequestError(response: Response): Promise<ParsedRequestError> {
  let detail = ''
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { detail?: unknown }
      detail = typeof payload?.detail === 'string' ? payload.detail : ''
    } else {
      detail = (await response.text()).trim()
    }
  } catch {
    // Keep the status fallback when a proxy returns an unreadable body.
  }
  const normalizedDetail = detail.trim().toLowerCase()
  const backendIncompatible = response.status === 404 && (!normalizedDetail || normalizedDetail === 'not found')
  return {
    code: backendIncompatible ? 'backend-incompatible' : 'request-failed',
    message: detail || `HTTP ${response.status}`,
    status: response.status
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

export function createMontageTileLoader(options: MontageTileLoaderOptions) {
  const fetchImpl = options.fetch ?? fetch
  const createObjectUrl = options.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob))
  const revokeObjectUrl = options.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url))
  const maxConcurrent = Math.max(1, Math.trunc(options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT))
  const maxRetained = Math.max(maxConcurrent, Math.trunc(options.maxRetained ?? DEFAULT_MAX_RETAINED))
  const imageUrls = new Map<number, string>()
  const committedKeys = new Map<number, string>()
  const retainedOrder: number[] = []
  let activeBatch: Batch | null = null
  let pendingRequests: MontageTileRequest[] | null = null
  let visibleIndexes = new Set<number>()
  let revision = 0
  let disposed = false

  function requestKey(request: MontageTileRequest): string {
    const headers = Object.entries(request.headers ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}`)
      .join('|')
    return `${request.url}|${headers}|display:${request.displayRevision ?? 0}`
  }

  function requestsMatchCommitted(requests: MontageTileRequest[]): boolean {
    return requests.length > 0 && requests.every((request) => committedKeys.get(request.index) === requestKey(request))
  }

  function revokeImage(index: number): void {
    const imageSrc = imageUrls.get(index)
    if (!imageSrc) {
      return
    }
    imageUrls.delete(index)
    revokeObjectUrl(imageSrc)
  }

  function touchRetained(index: number): void {
    const previous = retainedOrder.indexOf(index)
    if (previous >= 0) {
      retainedOrder.splice(previous, 1)
    }
    retainedOrder.push(index)
    let safety = retainedOrder.length + 1
    while (retainedOrder.length > maxRetained && safety > 0) {
      safety -= 1
      const candidate = retainedOrder.shift()
      if (candidate == null) {
        break
      }
      if (visibleIndexes.has(candidate)) {
        retainedOrder.push(candidate)
        continue
      }
      revokeImage(candidate)
      committedKeys.delete(candidate)
      options.onStateChange(candidate, null)
    }
  }

  function cancelBatch(batch: Batch | null): void {
    if (!batch) {
      return
    }
    batch.cancelled = true
    batch.controllers.forEach((controller) => controller.abort())
  }

  async function fetchTile(request: MontageTileRequest, batch: Batch): Promise<Blob> {
    const controller = new AbortController()
    batch.controllers.push(controller)
    const response = await fetchImpl(request.url, {
      cache: 'no-store',
      headers: {
        Accept: 'image/webp,image/*',
        ...(request.headers ?? {})
      },
      signal: controller.signal
    })
    if (!response.ok) {
      const parsed = await parseRequestError(response)
      const error = new Error(parsed.message)
      Object.assign(error, parsed)
      throw error
    }
    const blob = await response.blob()
    if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) {
      const error = new Error('The server response is not a valid image')
      Object.assign(error, { code: 'invalid-image', status: response.status })
      throw error
    }
    return blob
  }

  async function runBatch(batch: Batch): Promise<void> {
    batch.requests.forEach((request) => {
      const currentImage = imageUrls.get(request.index)
      options.onStateChange(request.index, currentImage
        ? { status: 'ready', imageSrc: currentImage, isRefreshing: true, batchRevision: batch.revision, displayRevision: request.displayRevision, requestUrl: request.url }
        : { status: 'loading', batchRevision: batch.revision, displayRevision: request.displayRevision, requestUrl: request.url })
    })

    const blobs = new Map<number, Blob>()
    let cursor = 0
    let failure: unknown = null
    const workers = Array.from({ length: Math.min(maxConcurrent, batch.requests.length) }, async () => {
      while (!batch.cancelled && failure == null) {
        const request = batch.requests[cursor]
        cursor += 1
        if (!request) {
          return
        }
        try {
          blobs.set(request.index, await fetchTile(request, batch))
        } catch (error) {
          if (!batch.cancelled && !isAbortError(error)) {
            failure = error
          }
          return
        }
      }
    })
    await Promise.all(workers)

    if (disposed || batch.cancelled || activeBatch !== batch) {
      return
    }
    if (failure != null || blobs.size !== batch.requests.length) {
      const structured = failure as Error & Partial<ParsedRequestError>
      batch.requests.forEach((request) => {
        const currentImage = imageUrls.get(request.index)
        options.onStateChange(request.index, {
          status: 'error',
          ...(currentImage ? { imageSrc: currentImage } : {}),
          isRefreshing: false,
          batchRevision: batch.revision,
          displayRevision: request.displayRevision,
          requestUrl: request.url,
          errorCode: structured?.code ?? 'request-failed',
          errorMessage: structured?.message || 'Montage tile batch failed',
          httpStatus: structured?.status
        })
      })
      return
    }

    const nextUrls = new Map<number, string>()
    try {
      batch.requests.forEach((request) => {
        const blob = blobs.get(request.index)
        if (!blob) {
          throw new Error('Montage tile batch is incomplete')
        }
        nextUrls.set(request.index, createObjectUrl(blob))
      })
    } catch (error) {
      nextUrls.forEach((url) => revokeObjectUrl(url))
      throw error
    }

    batch.requests.forEach((request) => {
      revokeImage(request.index)
      const imageSrc = nextUrls.get(request.index)!
      imageUrls.set(request.index, imageSrc)
      committedKeys.set(request.index, requestKey(request))
      touchRetained(request.index)
      options.onStateChange(request.index, {
        status: 'ready',
        imageSrc,
        batchRevision: batch.revision,
        displayRevision: request.displayRevision,
        requestUrl: request.url
      })
    })
  }

  function startBatch(requests: MontageTileRequest[]): void {
    if (disposed || !requests.length) {
      return
    }
    const batch: Batch = {
      revision: ++revision,
      requests,
      controllers: [],
      cancelled: false
    }
    activeBatch = batch
    void runBatch(batch)
      .catch((error) => {
        if (!batch.cancelled && !disposed) {
          console.warn('Montage tile batch failed.', error)
        }
      })
      .finally(() => {
        if (activeBatch === batch) {
          activeBatch = null
        }
        const next = pendingRequests
        pendingRequests = null
        if (next && !requestsMatchCommitted(next)) {
          startBatch(next)
        }
      })
  }

  function sync(requests: MontageTileRequest[]): boolean {
    if (disposed) {
      return false
    }
    visibleIndexes = new Set(requests.map((request) => request.index))
    if (!requests.length) {
      pendingRequests = null
      cancelBatch(activeBatch)
      activeBatch = null
      return true
    }
    if (requestsMatchCommitted(requests) && !activeBatch) {
      return false
    }
    if (activeBatch) {
      if (
        (
          activeBatch.requests.some((request) => request.renderIntent === 'final') ||
          pendingRequests?.some((request) => request.renderIntent === 'final')
        ) &&
        requests.every((request) => request.renderIntent === 'preview')
      ) {
        return false
      }
      pendingRequests = requests
      return true
    }
    startBatch(requests)
    return true
  }

  function retry(request: MontageTileRequest): void {
    if (disposed) {
      return
    }
    committedKeys.delete(request.index)
    sync([request])
  }

  function retryBatch(requests: MontageTileRequest[]): void {
    requests.forEach((request) => committedKeys.delete(request.index))
    sync(requests)
  }

  function clear(): void {
    pendingRequests = null
    cancelBatch(activeBatch)
    activeBatch = null
    ;[...imageUrls.keys()].forEach(revokeImage)
    committedKeys.clear()
    retainedOrder.splice(0)
    visibleIndexes.clear()
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    clear()
    disposed = true
  }

  return { clear, dispose, retry, retryBatch, sync }
}
