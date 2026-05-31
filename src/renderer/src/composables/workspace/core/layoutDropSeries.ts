import type { FolderSeriesItem } from '../../../types/viewer'
import { isSeriesViewSupported } from '../views/seriesViewSupport'

export function isLayoutStackDropSeriesSupported(series: FolderSeriesItem | null | undefined): boolean {
  return isSeriesViewSupported(series, 'Stack')
}

export function resolveLayoutStackDropSeries(seriesList: readonly FolderSeriesItem[]): FolderSeriesItem | null {
  return seriesList.find((series) => isLayoutStackDropSeriesSupported(series)) ?? null
}
