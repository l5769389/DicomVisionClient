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
  const incomingSeriesByKey = indexSeriesByDedupKey(incomingSeriesList)
  const mergedSeriesKeys = new Set<string>()
  const mergedExistingSeries = existingSeriesList.map((item) => {
    const seriesKey = getFolderSeriesDedupKey(item)
    const incoming = incomingSeriesByKey.get(seriesKey)
    if (!incoming) {
      return item
    }
    mergedSeriesKeys.add(seriesKey)
    return mergeLoadedSeriesItem(item, incoming)
  })

  const appendedSeries = incomingSeriesList.filter((item) => {
    const seriesKey = getFolderSeriesDedupKey(item)
    if (mergedSeriesKeys.has(seriesKey)) {
      return false
    }
    mergedSeriesKeys.add(seriesKey)
    return true
  })

  const seriesList = mergeFourDSeriesMetadataIntoSeriesList(
    [...mergedExistingSeries, ...appendedSeries],
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
