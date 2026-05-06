import type { FolderSeriesItem } from '../../types/viewer'
import { resolveBackendAssetUrl } from '../../services/api'

export function getSeriesThumbnailSrc(series: FolderSeriesItem): string {
  const phasePreview = series.fourDPhases?.find((phase) => phase.imageSrc || phase.viewportImages?.['mpr-ax'])
  return resolveBackendAssetUrl(
    series.thumbnailSrc ||
      series.thumbnailUrl ||
      phasePreview?.imageSrc ||
      phasePreview?.viewportImages?.['mpr-ax'] ||
      ''
  )
}

export function getSeriesFallbackLabel(series: FolderSeriesItem, fallback = 'DCM'): string {
  const modality = String(series.modality || '').trim()
  if (modality) {
    return modality.slice(0, 3).toUpperCase()
  }
  return fallback
}
