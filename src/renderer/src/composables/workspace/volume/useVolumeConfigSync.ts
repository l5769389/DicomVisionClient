interface VolumeConfigSyncOptions<TConfig> {
  debounceMs: number
  emitVolumeConfig: (viewId: string, config: TConfig) => void
}

export function useVolumeConfigSync<TConfig>(options: VolumeConfigSyncOptions<TConfig>) {
  // Volume render controls can emit many small changes while the user drags a
  // slider. Keep one pending payload per view so separate 3D tabs do not block
  // each other and only the latest config is sent.
  const pendingVolumeConfigByViewId = new Map<string, TConfig>()
  const volumeConfigTimers = new Map<string, ReturnType<typeof window.setTimeout>>()

  function flushVolumeConfig(viewId: string): void {
    const pendingConfig = pendingVolumeConfigByViewId.get(viewId)
    if (!pendingConfig) {
      return
    }

    const timer = volumeConfigTimers.get(viewId)
    if (timer) {
      window.clearTimeout(timer)
      volumeConfigTimers.delete(viewId)
    }

    pendingVolumeConfigByViewId.delete(viewId)
    options.emitVolumeConfig(viewId, pendingConfig)
  }

  function clearPendingVolumeConfig(viewId: string): void {
    const timer = volumeConfigTimers.get(viewId)
    if (timer) {
      window.clearTimeout(timer)
      volumeConfigTimers.delete(viewId)
    }
    pendingVolumeConfigByViewId.delete(viewId)
  }

  function scheduleVolumeConfigEmit(viewId: string, config: TConfig): void {
    pendingVolumeConfigByViewId.set(viewId, config)
    const existingTimer = volumeConfigTimers.get(viewId)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }
    volumeConfigTimers.set(
      viewId,
      window.setTimeout(() => {
        volumeConfigTimers.delete(viewId)
        flushVolumeConfig(viewId)
      }, options.debounceMs)
    )
  }

  function flushAllPendingVolumeConfig(): void {
    for (const viewId of Array.from(pendingVolumeConfigByViewId.keys())) {
      flushVolumeConfig(viewId)
    }
  }

  return {
    clearPendingVolumeConfig,
    flushAllPendingVolumeConfig,
    flushVolumeConfig,
    scheduleVolumeConfigEmit
  }
}
