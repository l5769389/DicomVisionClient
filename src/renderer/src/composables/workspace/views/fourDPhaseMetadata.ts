import type { FourDPhaseItem, ViewerTabItem } from '../../../types/viewer'

export function getDistinctFourDPhaseSeriesIds(
  phaseItems: FourDPhaseItem[],
  fallbackSeriesId?: string | null
): string[] {
  const uniqueSeriesIds = new Set<string>()
  if (fallbackSeriesId) {
    uniqueSeriesIds.add(fallbackSeriesId)
  }
  phaseItems.forEach((phase) => {
    if (phase.seriesId) {
      uniqueSeriesIds.add(phase.seriesId)
    }
  })
  return Array.from(uniqueSeriesIds)
}

export function resolveFourDPhaseSeriesId(
  tab: Pick<ViewerTabItem, 'seriesId' | 'fourDPhaseItems'>,
  phaseKey: string | null | undefined
): string {
  if (!phaseKey) {
    return tab.seriesId
  }

  const phaseIndex = Number.parseInt(phaseKey, 10)
  if (!Number.isFinite(phaseIndex) || phaseIndex < 0) {
    return tab.seriesId
  }

  return tab.fourDPhaseItems?.[phaseIndex]?.seriesId ?? tab.seriesId
}
