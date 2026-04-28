import type { FolderSeriesItem } from '../../types/viewer'

export function getSeriesThumbnailSrc(series: FolderSeriesItem): string {
  const phasePreview = series.fourDPhases?.find((phase) => phase.imageSrc || phase.viewportImages?.['mpr-ax'])
  return series.thumbnailSrc || phasePreview?.imageSrc || phasePreview?.viewportImages?.['mpr-ax'] || ''
}

export function getSeriesFallbackLabel(series: FolderSeriesItem, fallback = 'DCM'): string {
  const modality = String(series.modality || '').trim()
  if (modality) {
    return modality.slice(0, 3).toUpperCase()
  }
  return fallback
}
