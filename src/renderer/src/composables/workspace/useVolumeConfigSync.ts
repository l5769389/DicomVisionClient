import type { VolumeRenderConfig } from '../../types/viewer'

interface VolumeConfigSyncOptions {
  debounceMs: number
  emitVolumeConfig: (viewId: string, config: VolumeRenderConfig) => void
}

export function useVolumeConfigSync(options: VolumeConfigSyncOptions) {
  const pendingVolumeConfigByViewId = new Map<string, VolumeRenderConfig>()
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

  function scheduleVolumeConfigEmit(viewId: string, config: VolumeRenderConfig): void {
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
