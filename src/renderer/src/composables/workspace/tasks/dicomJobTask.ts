import { dispatchWorkspaceStatusToast } from './workspaceStatus'

export const DEFAULT_DICOM_JOB_POLL_OPTIONS = {
  intervalMs: 700,
  maxPolls: 1500,
  maxStatusErrors: 3,
  statusTimeoutMs: 8000
} as const

export interface DicomJobProgressCopy {
  packaging: string
  preparing: string
  progress: (processed: number, total: number, percent: number) => string
}

export interface DicomJobToastCopy extends DicomJobProgressCopy {
  started: string
}

export interface DicomJobProgress {
  isPackaging: boolean
  label: string
  percent: number
  processed: number
  total: number
}

export type BackgroundJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface BackgroundJob {
  jobId: string
  status: BackgroundJobStatus
  processedCount?: number | null
  progressPercent?: number | null
  totalCount?: number | null
}

export interface WaitForDicomJobOptions<TJob extends BackgroundJob = BackgroundJob> {
  intervalMs?: number
  maxPolls?: number
  maxStatusErrors?: number
  onProgress?: (job: TJob) => void
  statusTimeoutMs?: number
  timeoutMessage: string
}

function waitForDelay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function toNonNegativeCount(value: unknown, fallback = 0): number {
  const count = Number(value ?? fallback)
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : fallback
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function getDicomJobProgress(job: BackgroundJob, copy: DicomJobProgressCopy): DicomJobProgress {
  const total = toNonNegativeCount(job.totalCount)
  const processedFallback = job.status === 'succeeded' ? total : 0
  const rawProcessed = toNonNegativeCount(job.processedCount, processedFallback)
  const processed = total > 0 ? Math.min(total, rawProcessed) : rawProcessed
  const isProcessingComplete = total > 0 && processed >= total
  const percentFromJob = Number(job.progressPercent)
  const percent =
    isProcessingComplete || job.status === 'succeeded'
      ? 100
      : Number.isFinite(percentFromJob) && percentFromJob >= 0
        ? clampPercent(percentFromJob)
        : total > 0
          ? clampPercent((processed / total) * 100)
          : 0

  return {
    isPackaging: isProcessingComplete && job.status !== 'succeeded',
    label:
      total > 0
        ? isProcessingComplete && job.status !== 'succeeded'
          ? copy.packaging
          : copy.progress(processed, total, percent)
        : copy.preparing,
    percent,
    processed,
    total
  }
}

export function showDicomJobProgressToast(
  job: BackgroundJob,
  copy: DicomJobToastCopy,
  message = copy.started
): void {
  const progress = getDicomJobProgress(job, copy)
  dispatchWorkspaceStatusToast(progress.isPackaging ? copy.packaging : message, 'info', {
    busy: true,
    durationMs: 0,
    progressLabel: progress.label,
    progressPercent: progress.percent
  })
}

export async function waitForDicomJob<TJob extends BackgroundJob>(
  initialJob: TJob,
  fetchJob: (jobId: string, config: { timeout: number }) => Promise<TJob>,
  options: WaitForDicomJobOptions<TJob>
): Promise<TJob> {
  const intervalMs = options.intervalMs ?? DEFAULT_DICOM_JOB_POLL_OPTIONS.intervalMs
  const maxPolls = options.maxPolls ?? DEFAULT_DICOM_JOB_POLL_OPTIONS.maxPolls
  const maxStatusErrors = options.maxStatusErrors ?? DEFAULT_DICOM_JOB_POLL_OPTIONS.maxStatusErrors
  const statusTimeoutMs = options.statusTimeoutMs ?? DEFAULT_DICOM_JOB_POLL_OPTIONS.statusTimeoutMs
  let job = initialJob
  let failedStatusPollCount = 0

  options.onProgress?.(job)
  for (let pollIndex = 0; pollIndex < maxPolls; pollIndex += 1) {
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return job
    }

    await waitForDelay(intervalMs)
    try {
      job = await fetchJob(initialJob.jobId, { timeout: statusTimeoutMs })
      failedStatusPollCount = 0
      options.onProgress?.(job)
    } catch (error) {
      failedStatusPollCount += 1
      if (failedStatusPollCount >= maxStatusErrors) {
        throw error
      }
    }
  }

  throw new Error(options.timeoutMessage)
}
