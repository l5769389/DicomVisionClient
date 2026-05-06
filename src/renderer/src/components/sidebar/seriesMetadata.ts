import type { FolderSeriesItem } from '../../types/viewer'

type SeriesMetaSource = Pick<FolderSeriesItem, 'modality' | 'instanceCount' | 'width' | 'height'>

export function getSeriesDimensionLabel(series: Pick<FolderSeriesItem, 'width' | 'height'>): string {
  return typeof series.width === 'number' && typeof series.height === 'number' ? `${series.width}x${series.height}` : ''
}

export function getSeriesValueMetaLabel(series: SeriesMetaSource): string {
  const parts: string[] = []
  const dimensionLabel = getSeriesDimensionLabel(series)

  if (dimensionLabel) {
    parts.push(dimensionLabel)
  }

  parts.push(String(Math.max(0, Math.trunc(series.instanceCount))))
  return parts.join(' | ')
}

export function getSeriesMetaLabel(series: SeriesMetaSource): string {
  const parts = [series.modality || 'N/A', getSeriesValueMetaLabel(series)]
  return parts.join(' | ')
}
