export type MontageTileStatus = 'loading' | 'ready' | 'error'

export interface MontageTileState {
  status: MontageTileStatus
  imageSrc?: string
  isRefreshing?: boolean
  errorCode?: 'backend-incompatible' | 'request-failed' | 'invalid-image'
  errorMessage?: string
  httpStatus?: number
}

export interface MontageTileRequest {
  index: number
  url: string
  headers?: Record<string, string>
}

interface MontageTileLoaderOptions {
  createObjectUrl?: (blob: Blob) => string
  fetch?: typeof fetch
  maxConcurrent?: number
  maxRetained?: number
  onStateChange: (index: number, state: MontageTileState | null) => void
  revokeObjectUrl?: (url: string) => void
}

interface QueuedRequest extends MontageTileRequest {
  revision: number
}

interface ActiveRequest {
  controller: AbortController
  revision: number
}

interface ParsedRequestError {
  code: NonNullable<MontageTileState['errorCode']>
  message: string
  status: number
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
    // Keep the status-based fallback when a proxy returns an unreadable body.
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

  const activeRequests = new Map<number, ActiveRequest>()
  const imageUrls = new Map<number, string>()
  const requestKeys = new Map<number, string>()
  const revisions = new Map<number, number>()
  const retainedOrder: number[] = []
  const visibleIndexes = new Set<number>()
  let queue: QueuedRequest[] = []
  let disposed = false

  function requestKey(request: MontageTileRequest): string {
    const headers = Object.entries(request.headers ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}`)
      .join('|')
    return `${request.url}|${headers}`
  }

  function nextRevision(index: number): number {
    const revision = (revisions.get(index) ?? 0) + 1
    revisions.set(index, revision)
    return revision
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
    const existingIndex = retainedOrder.indexOf(index)
    if (existingIndex >= 0) {
      retainedOrder.splice(existingIndex, 1)
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
      requestKeys.delete(candidate)
      options.onStateChange(candidate, null)
    }
  }

  function cancelActive(index: number): void {
    activeRequests.get(index)?.controller.abort()
    activeRequests.delete(index)
  }

  function enqueue(request: MontageTileRequest, force = false): void {
    const key = requestKey(request)
    const currentKey = requestKeys.get(request.index)
    if (!force && currentKey === key && (imageUrls.has(request.index) || activeRequests.has(request.index))) {
      return
    }

    cancelActive(request.index)
    queue = queue.filter((item) => item.index !== request.index)
    const existingImageSrc = imageUrls.get(request.index)
    if (currentKey !== key && !existingImageSrc) {
      revokeImage(request.index)
    }
    requestKeys.set(request.index, key)
    const revision = nextRevision(request.index)
    queue.push({ ...request, revision })
    options.onStateChange(
      request.index,
      existingImageSrc
        ? { status: 'ready', imageSrc: existingImageSrc, isRefreshing: true }
        : { status: 'loading' }
    )
  }

  function pump(): void {
    if (disposed) {
      return
    }
    while (activeRequests.size < maxConcurrent && queue.length > 0) {
      const request = queue.shift()
      if (!request || !visibleIndexes.has(request.index) || revisions.get(request.index) !== request.revision) {
        continue
      }

      const controller = new AbortController()
      activeRequests.set(request.index, { controller, revision: request.revision })
      void fetchImpl(request.url, {
        cache: 'no-store',
        headers: {
          Accept: 'image/webp,image/*',
          ...(request.headers ?? {})
        },
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok) {
            const parsed = await parseRequestError(response)
            const error = new Error(parsed.message)
            Object.assign(error, parsed)
            throw error
          }
          const blob = await response.blob()
          if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) {
            const error = new Error('The server response is not a valid image')
            Object.assign(error, {
              code: 'invalid-image',
              status: response.status
            } satisfies Pick<ParsedRequestError, 'code' | 'status'>)
            throw error
          }
          return blob
        })
        .then((blob) => {
          if (
            disposed ||
            controller.signal.aborted ||
            revisions.get(request.index) !== request.revision ||
            requestKeys.get(request.index) !== requestKey(request)
          ) {
            return
          }
          revokeImage(request.index)
          const imageSrc = createObjectUrl(blob)
          imageUrls.set(request.index, imageSrc)
          touchRetained(request.index)
          options.onStateChange(request.index, {
            status: 'ready',
            imageSrc
          })
        })
        .catch((error: unknown) => {
          if (disposed || controller.signal.aborted || isAbortError(error) || revisions.get(request.index) !== request.revision) {
            return
          }
          const existingImageSrc = imageUrls.get(request.index)
          if (existingImageSrc) {
            options.onStateChange(request.index, {
              status: 'ready',
              imageSrc: existingImageSrc,
              isRefreshing: false
            })
            return
          }
          const structured = error as Error & Partial<ParsedRequestError>
          options.onStateChange(request.index, {
            status: 'error',
            errorCode: structured.code ?? 'request-failed',
            errorMessage: structured.message || 'Montage tile request failed',
            httpStatus: structured.status
          })
        })
        .finally(() => {
          const active = activeRequests.get(request.index)
          if (active?.revision === request.revision) {
            activeRequests.delete(request.index)
          }
          pump()
        })
    }
  }

  function sync(requests: MontageTileRequest[]): void {
    if (disposed) {
      return
    }
    const nextVisibleIndexes = new Set(requests.map((request) => request.index))
    visibleIndexes.clear()
    nextVisibleIndexes.forEach((index) => visibleIndexes.add(index))

    queue = queue.filter((request) => nextVisibleIndexes.has(request.index))
    activeRequests.forEach((_request, index) => {
      if (!nextVisibleIndexes.has(index)) {
        cancelActive(index)
      }
    })
    requests.forEach((request) => enqueue(request))
    pump()
  }

  function retry(request: MontageTileRequest): void {
    if (disposed) {
      return
    }
    visibleIndexes.add(request.index)
    enqueue(request, true)
    pump()
  }

  function clear(): void {
    queue = []
    activeRequests.forEach((_request, index) => cancelActive(index))
    ;[...imageUrls.keys()].forEach(revokeImage)
    requestKeys.clear()
    revisions.clear()
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

  return {
    clear,
    dispose,
    retry,
    sync
  }
}
