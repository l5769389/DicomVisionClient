export interface FusionAlphaCommit {
  viewId: string
  alpha: number
}

export interface FusionAlphaCommitScheduler {
  flush: () => void
  schedule: (commit: FusionAlphaCommit) => void
}

export function createFusionAlphaCommitScheduler(options: {
  debounceMs: number
  emit: (commit: FusionAlphaCommit) => void
}): FusionAlphaCommitScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: FusionAlphaCommit | null = null

  const flush = (): void => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    const commit = pending
    pending = null
    if (commit) {
      options.emit(commit)
    }
  }

  const schedule = (commit: FusionAlphaCommit): void => {
    if (pending && pending.viewId !== commit.viewId) {
      flush()
    }
    pending = commit
    if (timer != null) {
      clearTimeout(timer)
    }
    timer = setTimeout(flush, options.debounceMs)
  }

  return { flush, schedule }
}
