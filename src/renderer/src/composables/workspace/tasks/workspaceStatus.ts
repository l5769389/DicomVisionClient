export type WorkspaceStatusToastTone = 'info' | 'success' | 'warning' | 'error'

export interface WorkspaceStatusToastOptions {
  busy?: boolean
  canOpenLocation?: boolean
  detail?: string | null
  directoryPath?: string | null
  durationMs?: number
  filePath?: string | null
  progressLabel?: string | null
  progressPercent?: number | null
}

export function clampProgressPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.max(0, Math.min(100, value))
}

export function dispatchWorkspaceStatusToast(
  message: string,
  tone: WorkspaceStatusToastTone = 'info',
  options: WorkspaceStatusToastOptions = {}
): void {
  window.dispatchEvent(
    new CustomEvent('dicomvision:status-toast', {
      detail: {
        message,
        tone,
        ...options,
        progressPercent: clampProgressPercent(options.progressPercent)
      }
    })
  )
}

export function resolveBackendErrorDetail(error: unknown): string {
  const responseData = (error as { response?: { data?: unknown } } | null)?.response?.data
  if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
    const detail = (responseData as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim()
    }
  }

  return error instanceof Error && error.message.trim() ? error.message.trim() : ''
}
