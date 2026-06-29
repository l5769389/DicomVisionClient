import type { CornerInfo, FourDPhaseCacheItem, FourDPhaseItem, MprViewportKey, ViewerTabItem } from '../../../types/viewer'
import { resolveBackendAssetUrl } from '../../../services/apiBase'
import {
  createDefaultFourDPhaseItems,
  createEmptyCornerInfo,
  createEmptyMprCornerInfos,
  createEmptyMprCrosshairs,
  createEmptyMprImages,
  createEmptyMprOrientations,
  createEmptyMprPlanes,
  createEmptyMprInitialWindowInfos,
  createEmptyMprPseudocolorPresets,
  createEmptyMprScaleBars,
  createEmptyMprSliceLabels,
  createEmptyMprTransformStates
} from './viewerWorkspaceTabs'
import { resolveFourDPhaseSeriesId } from './fourDPhaseMetadata'

export const MPR_VIEWPORT_KEYS: MprViewportKey[] = ['mpr-ax', 'mpr-cor', 'mpr-sag']
const FOUR_D_PHASE_RENDER_WAIT_TIMEOUT_MS = 2500

export interface FourDPhaseViewportMatch {
  phaseKey: string
  viewportKey: MprViewportKey
}

interface FourDPhaseRenderWaiter {
  viewIds: Set<string>
  resolve: () => void
  timeoutId: ReturnType<typeof globalThis.setTimeout>
}

export class FourDPhaseRenderTracker {
  private readonly waiters = new Map<string, FourDPhaseRenderWaiter[]>()

  waitForRender(
    tabKey: string,
    phaseKey: string,
    viewIds: Partial<Record<MprViewportKey, string>>,
    timeoutMs = FOUR_D_PHASE_RENDER_WAIT_TIMEOUT_MS
  ): Promise<void> {
    const expectedViewIds = Object.values(viewIds).filter((viewId): viewId is string => Boolean(viewId))
    if (!expectedViewIds.length) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const waiterKey = this.getWaiterKey(tabKey, phaseKey)
      const waiters = this.waiters.get(waiterKey) ?? []
      // 4D preloading should continue even if one viewport render event is lost;
      // a timeout avoids leaving playback stuck behind an unresolved waiter.
      const timeoutId = globalThis.setTimeout(() => {
        this.removeWaiter(waiterKey, timeoutId)
        resolve()
      }, timeoutMs)

      waiters.push({
        viewIds: new Set(expectedViewIds),
        resolve: () => {
          globalThis.clearTimeout(timeoutId)
          resolve()
        },
        timeoutId
      })
      this.waiters.set(waiterKey, waiters)
    })
  }

  notifyRendered(tabKey: string, phaseKey: string, viewId: string): void {
    if (!viewId) {
      return
    }

    const waiterKey = this.getWaiterKey(tabKey, phaseKey)
    const waiters = this.waiters.get(waiterKey)
    if (!waiters?.length) {
      return
    }

    const remainingWaiters: FourDPhaseRenderWaiter[] = []
    waiters.forEach((waiter) => {
      if (!waiter.viewIds.has(viewId)) {
        remainingWaiters.push(waiter)
        return
      }
      waiter.viewIds.delete(viewId)
      if (waiter.viewIds.size > 0) {
        remainingWaiters.push(waiter)
        return
      }
      waiter.resolve()
    })

    if (remainingWaiters.length) {
      this.waiters.set(waiterKey, remainingWaiters)
      return
    }
    this.waiters.delete(waiterKey)
  }

  clearTab(tabKey: string): void {
    const waiterPrefix = `${tabKey}:`
    Array.from(this.waiters.entries()).forEach(([key, waiters]) => {
      if (!key.startsWith(waiterPrefix)) {
        return
      }
      waiters.forEach((waiter) => {
        globalThis.clearTimeout(waiter.timeoutId)
        waiter.resolve()
      })
      this.waiters.delete(key)
    })
  }

  private getWaiterKey(tabKey: string, phaseKey: string): string {
    return `${tabKey}:${phaseKey}`
  }

  private removeWaiter(waiterKey: string, timeoutId: ReturnType<typeof globalThis.setTimeout>): void {
    const currentWaiters = this.waiters.get(waiterKey) ?? []
    const nextWaiters = currentWaiters.filter((item) => item.timeoutId !== timeoutId)
    if (nextWaiters.length) {
      this.waiters.set(waiterKey, nextWaiters)
    } else {
      this.waiters.delete(waiterKey)
    }
  }
}

export function getFourDPhaseKey(phaseIndex: number): string {
  const normalizedIndex = Number.isFinite(phaseIndex) ? Math.trunc(phaseIndex) : 0
  return String(Math.max(0, normalizedIndex))
}

export function getFourDPhaseItems(tab: ViewerTabItem): FourDPhaseItem[] {
  return tab.fourDPhaseItems?.length
    ? tab.fourDPhaseItems
    : createDefaultFourDPhaseItems(Math.max(1, tab.fourDPhaseCount ?? 1))
}

export function clampFourDPhaseIndex(tab: ViewerTabItem, phaseIndex: number): number {
  const maxIndex = Math.max(0, getFourDPhaseItems(tab).length - 1)
  const normalizedIndex = Number.isFinite(phaseIndex) ? Math.trunc(phaseIndex) : 0
  return Math.max(0, Math.min(normalizedIndex, maxIndex))
}

export function getFourDPhaseSeriesId(tab: ViewerTabItem, phaseIndex: number): string {
  const phase = getFourDPhaseItems(tab)[phaseIndex]
  return phase?.seriesId || tab.seriesId
}

export function resolveFourDInitialPhaseIndex(
  openedSeriesId: string,
  phaseItems: FourDPhaseItem[],
  fallbackPhaseIndex = 0
): number {
  const matchedIndex = phaseItems.findIndex((phase) => phase.seriesId === openedSeriesId)
  if (matchedIndex >= 0) {
    return matchedIndex
  }

  const maxIndex = Math.max(0, phaseItems.length - 1)
  const normalizedFallback = Number.isFinite(fallbackPhaseIndex) ? Math.trunc(fallbackPhaseIndex) : 0
  return Math.max(0, Math.min(normalizedFallback, maxIndex))
}

export function hasCompleteMprViewportViewIds(
  value: Partial<Record<MprViewportKey, string>> | null | undefined
): value is Record<MprViewportKey, string> {
  return MPR_VIEWPORT_KEYS.every((viewportKey) => Boolean(value?.[viewportKey]))
}

export function createFourDPhasePreviewImages(phase: FourDPhaseItem | undefined): Record<MprViewportKey, string> {
  const viewportImages = phase?.viewportImages ?? {}
  return {
    'mpr-ax': resolveBackendAssetUrl(viewportImages['mpr-ax'] || phase?.imageSrc || ''),
    'mpr-cor': resolveBackendAssetUrl(viewportImages['mpr-cor'] || ''),
    'mpr-sag': resolveBackendAssetUrl(viewportImages['mpr-sag'] || '')
  }
}

export function hasAnyMprViewportImage(images: Partial<Record<MprViewportKey, string>> | undefined | null): boolean {
  return MPR_VIEWPORT_KEYS.some((viewportKey) => Boolean(images?.[viewportKey]))
}

export function hasCompleteMprViewportImages(
  images: Partial<Record<MprViewportKey, string>> | undefined | null
): images is Record<MprViewportKey, string> {
  return MPR_VIEWPORT_KEYS.every((viewportKey) => Boolean(images?.[viewportKey]))
}

export function hasReadyFourDPhaseCache(cache: FourDPhaseCacheItem | undefined): boolean {
  return cache?.status === 'ready' && hasCompleteMprViewportImages(cache.viewportImages)
}

export function mergeFourDPhaseImages(
  phase: FourDPhaseItem | undefined,
  cachedImages: Partial<Record<MprViewportKey, string>> | undefined
): Record<MprViewportKey, string> {
  const previewImages = createFourDPhasePreviewImages(phase)
  return {
    'mpr-ax': cachedImages?.['mpr-ax'] || previewImages['mpr-ax'],
    'mpr-cor': cachedImages?.['mpr-cor'] || previewImages['mpr-cor'],
    'mpr-sag': cachedImages?.['mpr-sag'] || previewImages['mpr-sag']
  }
}

export function createFourDPhaseCacheSeed(
  phase: FourDPhaseItem | undefined,
  existingCache?: FourDPhaseCacheItem
): FourDPhaseCacheItem {
  const viewportImages = mergeFourDPhaseImages(phase, existingCache?.viewportImages)
  const status = existingCache?.status
    ? existingCache.status
    : phase?.status === 'error'
      ? 'error'
      : hasAnyMprViewportImage(viewportImages)
        ? 'preview'
        : 'pending'

  return {
    ...existingCache,
    status,
    viewportImages
  }
}

export function createFourDPhaseCache(
  phaseItems: FourDPhaseItem[],
  existingCache: Record<string, FourDPhaseCacheItem> | undefined
): Record<string, FourDPhaseCacheItem> {
  return phaseItems.reduce<Record<string, FourDPhaseCacheItem>>((accumulator, phase, index) => {
    const phaseKey = getFourDPhaseKey(phase.phaseIndex ?? index)
    accumulator[phaseKey] = createFourDPhaseCacheSeed(phase, existingCache?.[phaseKey])
    return accumulator
  }, {})
}

export function findFourDPhaseViewportByViewId(
  tab: ViewerTabItem,
  viewId: string | undefined | null
): FourDPhaseViewportMatch | null {
  if (!viewId || tab.viewType !== '4D') {
    return null
  }

  for (const [phaseKey, viewIds] of Object.entries(tab.fourDPhaseViewIds ?? {})) {
    const viewportKey = MPR_VIEWPORT_KEYS.find((candidate) => viewIds?.[candidate] === viewId)
    if (viewportKey) {
      return { phaseKey, viewportKey }
    }
  }

  return null
}

export function getFourDPhaseByKey(tab: ViewerTabItem, phaseKey: string): FourDPhaseItem | undefined {
  const phaseIndex = Number.parseInt(phaseKey, 10)
  if (!Number.isFinite(phaseIndex)) {
    return undefined
  }
  return getFourDPhaseItems(tab)[phaseIndex]
}

export function isFourDPhaseDisplayed(tab: ViewerTabItem, phaseKey: string): boolean {
  const viewIds = tab.fourDPhaseViewIds?.[phaseKey]
  return (
    hasCompleteMprViewportViewIds(viewIds) &&
    MPR_VIEWPORT_KEYS.every((viewportKey) => tab.viewportViewIds?.[viewportKey] === viewIds[viewportKey])
  )
}

export function getFourDPhaseDisplayState(
  tab: ViewerTabItem,
  phaseIndex: number,
  seriesCornerInfoMap: Record<string, CornerInfo>
) {
  const phaseKey = getFourDPhaseKey(phaseIndex)
  const phase = getFourDPhaseItems(tab)[phaseIndex]
  const cache = tab.fourDPhaseCache?.[phaseKey]
  const fallbackCornerInfo = seriesCornerInfoMap[resolveFourDPhaseSeriesId(tab, phaseKey)] ?? createEmptyCornerInfo()

  return {
    viewportImages: mergeFourDPhaseImages(phase, cache?.viewportImages),
    viewportSliceLabels: {
      ...createEmptyMprSliceLabels(),
      ...(cache?.viewportSliceLabels ?? {})
    },
    viewportPlanes: {
      ...createEmptyMprPlanes(),
      ...(cache?.viewportPlanes ?? {})
    },
    viewportCrosshairs: {
      ...createEmptyMprCrosshairs(),
      ...(cache?.viewportCrosshairs ?? {})
    },
    viewportScaleBars: {
      ...createEmptyMprScaleBars(),
      ...(cache?.viewportScaleBars ?? {})
    },
    viewportMeasurements: cache?.viewportMeasurements ?? {},
    viewportCornerInfos: {
      ...createEmptyMprCornerInfos(),
      ...(cache?.viewportCornerInfos ?? {})
    },
    cornerInfo:
      cache?.viewportCornerInfos?.['mpr-ax'] ??
      cache?.viewportCornerInfos?.['mpr-cor'] ??
      cache?.viewportCornerInfos?.['mpr-sag'] ??
      fallbackCornerInfo,
    viewportOrientations: {
      ...createEmptyMprOrientations(),
      ...(cache?.viewportOrientations ?? {})
    },
    viewportTransformStates: {
      ...createEmptyMprTransformStates(),
      ...(cache?.viewportTransformStates ?? {})
    },
    viewportPseudocolorPresets: {
      ...createEmptyMprPseudocolorPresets(),
      ...(cache?.viewportPseudocolorPresets ?? {})
    },
    viewportInitialWindowInfos: {
      ...createEmptyMprInitialWindowInfos(),
      ...(cache?.viewportInitialWindowInfos ?? {})
    },
    viewportCurrentWindowInfos: {
      ...createEmptyMprInitialWindowInfos(),
      ...(cache?.viewportCurrentWindowInfos ?? {})
    },
    mprCursor: cache?.mprCursor ?? null,
    mprFrame: cache?.mprFrame ?? null,
    mprRevision: cache?.mprRevision ?? null,
    viewportMprStateRevisions: cache?.viewportMprStateRevisions ?? {},
    viewportMprImageRevisions: cache?.viewportMprImageRevisions ?? {},
    windowLabel: cache?.windowLabel ?? '',
    initialWindowInfo: cache?.initialWindowInfo ?? null,
    currentWindowInfo: cache?.currentWindowInfo ?? cache?.initialWindowInfo ?? null
  }
}

export function hasFourDPhaseImage(phase: FourDPhaseItem): boolean {
  return Boolean(
    phase.imageSrc ||
      phase.viewportImages?.['mpr-ax'] ||
      phase.viewportImages?.['mpr-cor'] ||
      phase.viewportImages?.['mpr-sag']
  )
}

export function normalizeFourDPhaseItems(phases: FourDPhaseItem[] | undefined | null): FourDPhaseItem[] {
  return (phases ?? [])
    .map((phase, sourceIndex) => ({ phase, sourceIndex }))
    .sort((left, right) => {
      const leftIndex = Number(left.phase.phaseIndex)
      const rightIndex = Number(right.phase.phaseIndex)
      const leftSort = Number.isFinite(leftIndex) ? leftIndex : left.sourceIndex
      const rightSort = Number.isFinite(rightIndex) ? rightIndex : right.sourceIndex
      return leftSort - rightSort
    })
    .map(({ phase }, index) => {
      const viewportImages = Object.fromEntries(
        Object.entries(phase.viewportImages ?? {}).map(([viewportKey, imageSrc]) => [
          viewportKey,
          resolveBackendAssetUrl(imageSrc)
        ])
      ) as Partial<Record<MprViewportKey, string>>
      const imageSrc =
        resolveBackendAssetUrl(phase.imageSrc) ||
        viewportImages['mpr-ax'] ||
        viewportImages['mpr-cor'] ||
        viewportImages['mpr-sag'] ||
        ''
      const hasImage = Boolean(imageSrc || Object.values(viewportImages).some(Boolean))
      const status = phase.status === 'error' ? 'error' : hasImage || phase.status === 'ready' ? 'ready' : 'pending'
      const normalizedPhase: FourDPhaseItem = {
        phaseIndex: index,
        label: phase.label || `Phase ${String(index + 1).padStart(2, '0')}`,
        seriesId: phase.seriesId ?? null,
        imageSrc,
        viewportImages,
        status
      }
      return normalizedPhase
    })
}

export function countDistinctFourDPhaseSeriesIds(phases: FourDPhaseItem[]): number {
  return new Set(phases.map((phase) => phase.seriesId).filter((seriesId): seriesId is string => Boolean(seriesId))).size
}

export function getFourDPhaseBackendViewIds(tab: ViewerTabItem): string[] {
  return Object.values(tab.fourDPhaseViewIds ?? {})
    .flatMap((phaseViewIds) => Object.values(phaseViewIds ?? {}))
    .filter((viewId): viewId is string => Boolean(viewId))
}
