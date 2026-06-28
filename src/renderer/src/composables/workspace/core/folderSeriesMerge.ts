import type { FolderSeriesItem } from '../../../types/viewer'
import { mergeFourDSeriesMetadataIntoSeriesList } from '../views/fourDPhaseManifest'

export interface LoadedFolderSeriesMergeResult {
  seriesList: FolderSeriesItem[]
  loadedSeries: FolderSeriesItem[]
  appendedSeries: FolderSeriesItem[]
}

export function getFolderSeriesDedupKey(series: FolderSeriesItem): string {
  return series.seriesId || `${series.folderPath}::${series.seriesInstanceUid || ''}`
}

function mergeLoadedSeriesItem(existing: FolderSeriesItem, incoming: FolderSeriesItem): FolderSeriesItem {
  return {
    ...existing,
    ...incoming,
    thumbnailSrc: incoming.thumbnailSrc || existing.thumbnailSrc,
    thumbnailUrl: incoming.thumbnailUrl || existing.thumbnailUrl
  }
}

function indexSeriesByDedupKey(seriesList: FolderSeriesItem[]): Map<string, FolderSeriesItem> {
  const seriesByKey = new Map<string, FolderSeriesItem>()
  seriesList.forEach((series) => {
    const seriesKey = getFolderSeriesDedupKey(series)
    if (!seriesByKey.has(seriesKey)) {
      seriesByKey.set(seriesKey, series)
    }
  })
  return seriesByKey
}

export function mergeLoadedFolderSeries(
  existingSeriesList: FolderSeriesItem[],
  incomingSeriesList: FolderSeriesItem[]
): LoadedFolderSeriesMergeResult {
  const existingSeriesByKey = indexSeriesByDedupKey(existingSeriesList)
  const frontSeriesKeys = new Set<string>()
  const loadedFrontSeries: FolderSeriesItem[] = []
  const appendedSeries: FolderSeriesItem[] = []

  for (const item of incomingSeriesList) {
    const seriesKey = getFolderSeriesDedupKey(item)
    if (frontSeriesKeys.has(seriesKey)) {
      continue
    }
    frontSeriesKeys.add(seriesKey)
    const existing = existingSeriesByKey.get(seriesKey)
    const merged = existing ? mergeLoadedSeriesItem(existing, item) : item
    loadedFrontSeries.push(merged)
    if (!existing) {
      appendedSeries.push(merged)
    }
  }

  const remainingExistingSeries = existingSeriesList.filter((item) => !frontSeriesKeys.has(getFolderSeriesDedupKey(item)))

  const seriesList = mergeFourDSeriesMetadataIntoSeriesList(
    [...loadedFrontSeries, ...remainingExistingSeries],
    incomingSeriesList
  )
  const seriesByKey = indexSeriesByDedupKey(seriesList)
  const loadedSeries = incomingSeriesList.map((item) => seriesByKey.get(getFolderSeriesDedupKey(item)) ?? item)

  return {
    seriesList,
    loadedSeries,
    appendedSeries
  }
}
