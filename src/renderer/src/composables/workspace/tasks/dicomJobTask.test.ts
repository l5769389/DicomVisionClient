import { describe, expect, it } from 'vitest'
import type { DicomTagModifyJob } from '../../../services/typedApi'
import { getDicomJobProgress } from './dicomJobTask'

const copy = {
  packaging: 'Packaging',
  preparing: 'Preparing',
  progress: (processed: number, total: number, percent: number) => `${processed}/${total} ${percent}%`
}

function createJob(overrides: Partial<DicomTagModifyJob>): DicomTagModifyJob {
  return {
    completedAt: null,
    createdAt: '2026-05-18T00:00:00Z',
    jobId: 'job-1',
    status: 'running',
    statusUrl: '/status',
    ...overrides
  }
}

describe('dicom job progress', () => {
  it('uses backend progress percent when available', () => {
    const progress = getDicomJobProgress(
      createJob({
        processedCount: 2,
        progressPercent: 48.6,
        totalCount: 10
      }),
      copy
    )

    expect(progress.percent).toBe(49)
    expect(progress.label).toBe('2/10 49%')
  })

  it('marks processed but not succeeded jobs as packaging', () => {
    const progress = getDicomJobProgress(
      createJob({
        processedCount: 10,
        totalCount: 10
      }),
      copy
    )

    expect(progress.isPackaging).toBe(true)
    expect(progress.percent).toBe(100)
    expect(progress.label).toBe('Packaging')
  })

  it('keeps succeeded jobs at a completed progress state', () => {
    const progress = getDicomJobProgress(
      createJob({
        status: 'succeeded',
        totalCount: 10
      }),
      copy
    )

    expect(progress.isPackaging).toBe(false)
    expect(progress.percent).toBe(100)
    expect(progress.processed).toBe(10)
  })

  it('clamps processed count to the reported total', () => {
    const progress = getDicomJobProgress(
      createJob({
        processedCount: 12,
        totalCount: 10
      }),
      copy
    )

    expect(progress.processed).toBe(10)
    expect(progress.percent).toBe(100)
    expect(progress.label).toBe('Packaging')
  })

  it('falls back to calculated percent when backend percent is not finite', () => {
    const progress = getDicomJobProgress(
      createJob({
        processedCount: 3,
        progressPercent: Number.NaN,
        totalCount: 10
      }),
      copy
    )

    expect(progress.percent).toBe(30)
    expect(progress.label).toBe('3/10 30%')
  })
})
