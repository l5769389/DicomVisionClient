import type { FolderSeriesItem, FourDPhaseItem, FourDPhasesResponse } from '../../../types/viewer'
import { createDefaultFourDPhaseItems } from './viewerWorkspaceTabs'
import { getDistinctFourDPhaseSeriesIds } from './fourDPhaseMetadata'
import { countDistinctFourDPhaseSeriesIds, normalizeFourDPhaseItems } from './fourDPhaseState'

export interface FourDPhasePlan {
  phaseCount: number
  phaseItems: FourDPhaseItem[]
  hasBackendManifest: boolean
}

export function normalizeFourDManifestResponse(
  value: Partial<FourDPhasesResponse> | null | undefined,
  fallbackSeriesId: string
): FourDPhasesResponse | null {
  if (!value) {
    return null
  }

  const normalizedPhases = normalizeFourDPhaseItems(value.fourDPhases)
  return {
    seriesId: value.seriesId || fallbackSeriesId,
    isFourDSeries: Boolean(value.isFourDSeries),
    fourDPhaseCount: Math.max(0, Number(value.fourDPhaseCount ?? normalizedPhases.length)),
    fourDPhases: normalizedPhases
  }
}

export function mergeFourDManifestIntoSeriesList(
  seriesList: FolderSeriesItem[],
  openedSeriesId: string,
  manifest: FourDPhasesResponse
): FolderSeriesItem[] {
  const normalizedPhases = normalizeFourDPhaseItems(manifest.fourDPhases)
  const relatedSeriesIds = new Set(getDistinctFourDPhaseSeriesIds(normalizedPhases, openedSeriesId))

  return seriesList.map((item) => {
    if (!relatedSeriesIds.has(item.seriesId)) {
      return item
    }

    const existingPhases = normalizeFourDPhaseItems(item.fourDPhases)
    const manifestPhaseSeriesCount = countDistinctFourDPhaseSeriesIds(normalizedPhases)
    const existingPhaseSeriesCount = countDistinctFourDPhaseSeriesIds(existingPhases)
    const shouldUseManifestPhases =
      normalizedPhases.length > 0 &&
      (manifestPhaseSeriesCount > 1 || existingPhaseSeriesCount <= manifestPhaseSeriesCount)

    if (manifest.isFourDSeries || normalizedPhases.length) {
      const nextPhases = shouldUseManifestPhases ? normalizedPhases : item.fourDPhases
      return {
        ...item,
        isFourDSeries: manifest.isFourDSeries || Boolean(nextPhases?.length),
        fourDPhaseCount:
          manifest.fourDPhaseCount ||
          normalizedPhases.length ||
          item.fourDPhaseCount ||
          (nextPhases?.length ?? null),
        fourDPhases: nextPhases
      }
    }

    if (existingPhases.length) {
      return item
    }

    return {
      ...item,
      isFourDSeries: false,
      fourDPhaseCount: null,
      fourDPhases: null
    }
  })
}

export function mergeFourDSeriesMetadataIntoSeriesList(
  seriesList: FolderSeriesItem[],
  sourceSeriesList: FolderSeriesItem[]
): FolderSeriesItem[] {
  return sourceSeriesList.reduce((nextSeriesList, sourceSeries) => {
    const normalizedPhases = normalizeFourDPhaseItems(sourceSeries.fourDPhases)
    if (!sourceSeries.isFourDSeries && !normalizedPhases.length) {
      return nextSeriesList
    }

    return mergeFourDManifestIntoSeriesList(nextSeriesList, sourceSeries.seriesId, {
      seriesId: sourceSeries.seriesId,
      isFourDSeries: Boolean(sourceSeries.isFourDSeries || normalizedPhases.length),
      fourDPhaseCount: sourceSeries.fourDPhaseCount ?? normalizedPhases.length,
      fourDPhases: normalizedPhases
    })
  }, seriesList)
}

export function resolveFourDPhasePlan(
  series: FolderSeriesItem | undefined,
  manifest: FourDPhasesResponse | null,
  fallbackPhaseCount = 10
): FourDPhasePlan {
  const backendPhaseItems = normalizeFourDPhaseItems(manifest?.fourDPhases)
  const seriesPhaseItems = normalizeFourDPhaseItems(series?.fourDPhases)
  const backendPhaseSeriesCount = countDistinctFourDPhaseSeriesIds(backendPhaseItems)
  const seriesPhaseSeriesCount = countDistinctFourDPhaseSeriesIds(seriesPhaseItems)
  if (
    manifest?.isFourDSeries &&
    backendPhaseItems.length &&
    (backendPhaseSeriesCount > 1 || seriesPhaseSeriesCount <= backendPhaseSeriesCount)
  ) {
    return {
      phaseCount: Math.max(1, manifest.fourDPhaseCount || backendPhaseItems.length),
      phaseItems: backendPhaseItems,
      hasBackendManifest: true
    }
  }

  if (seriesPhaseItems.length) {
    return {
      phaseCount: Math.max(1, series?.fourDPhaseCount ?? seriesPhaseItems.length),
      phaseItems: seriesPhaseItems,
      hasBackendManifest: false
    }
  }

  const fallbackCount = Math.max(1, series?.fourDPhaseCount ?? fallbackPhaseCount)
  return {
    phaseCount: fallbackCount,
    phaseItems: createDefaultFourDPhaseItems(fallbackCount),
    hasBackendManifest: false
  }
}
