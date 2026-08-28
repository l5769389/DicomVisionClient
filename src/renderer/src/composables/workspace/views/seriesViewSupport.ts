import { isFourDSeriesItem, type FolderSeriesItem, type ViewType } from '../../../types/viewer'

const NON_VOLUME_STANDARD_OBJECT_TOKENS = ['DICOM_SR', 'DICOM_GSPS', 'GSPS', 'SR', 'REPORT']
const NON_VOLUME_MODALITIES = new Set([
  'DOC',
  'KO',
  'OT',
  'PR',
  'REG',
  'RTDOSE',
  'RTPLAN',
  'RTRECORD',
  'RTSTRUCT',
  'SC',
  'SEG',
  'SR'
])
const REPORT_LIKE_DESCRIPTION_PATTERNS = [
  /\bdose\s+report\b/i,
  /\breport\b/i,
  /\bscreen\s*(capture|save|shot)\b/i,
  /\bsecondary\s+capture\b/i
]

function normalizePositiveInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
  }
  return 0
}

function getSeriesExtendedFrameCount(series: FolderSeriesItem): number {
  const record = series as FolderSeriesItem & Record<string, unknown>
  return Math.max(
    normalizePositiveInteger(series.instanceCount),
    normalizePositiveInteger(record.numberOfFrames),
    normalizePositiveInteger(record.maxNumberOfFrames),
    normalizePositiveInteger(record.frameCount),
    normalizePositiveInteger(record.volumeFrameCount)
  )
}

function hasRenderablePixelGrid(series: FolderSeriesItem): boolean {
  return (
    series.isImageSeries !== false &&
    normalizePositiveInteger(series.width) > 0 &&
    normalizePositiveInteger(series.height) > 0 &&
    getSeriesExtendedFrameCount(series) > 0
  )
}

function hasNonVolumeStandardObjectType(series: FolderSeriesItem): boolean {
  const normalized = String(series.standardObjectType ?? '').trim().toUpperCase()
  return Boolean(normalized && NON_VOLUME_STANDARD_OBJECT_TOKENS.some((token) => normalized.includes(token)))
}

function hasNonVolumeModality(series: FolderSeriesItem): boolean {
  const modality = String(series.modality ?? '').trim().toUpperCase()
  return NON_VOLUME_MODALITIES.has(modality)
}

function hasReportLikeDescription(series: FolderSeriesItem): boolean {
  const text = [series.seriesDescription, series.studyDescription].filter(Boolean).join(' ')
  return REPORT_LIKE_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text))
}

type SeriesCapabilityKey = 'stack' | 'montage' | 'mpr' | '3d' | '4d' | 'fusion'

export interface SeriesViewAvailability {
  supported: boolean
  blockedCode?: string | null
  blockedReason?: string | null
}

function isBackendCapabilitySupported(
  series: FolderSeriesItem | null | undefined,
  capability: SeriesCapabilityKey
): boolean {
  const value = series?.viewCapabilities?.[capability]
  return value?.supported !== false
}

export function getSeriesViewBlockedReason(
  series: FolderSeriesItem | null | undefined,
  viewType: ViewType
): string | null {
  const capability: SeriesCapabilityKey | null =
    viewType === '3D'
      ? '3d'
      : viewType === 'MPR'
        ? 'mpr'
      : viewType === '4D'
          ? '4d'
          : viewType === 'Montage'
            ? 'montage'
            : viewType === 'PET' || viewType === 'Stack' || viewType === 'CompareStack' || viewType === 'Layout'
              ? 'stack'
              : null
  return capability ? series?.viewCapabilities?.[capability]?.blockedReason ?? null : null
}

function blockedAvailability(blockedCode: string, blockedReason: string): SeriesViewAvailability {
  return { supported: false, blockedCode, blockedReason }
}

export function getSeriesViewAvailability(
  series: FolderSeriesItem | null | undefined,
  viewType: 'MPR' | '3D' | '4D'
): SeriesViewAvailability {
  if (!series) {
    return blockedAvailability('series-not-selected', 'No DICOM series is selected.')
  }

  const backendCapability = series.viewCapabilities?.[viewType === 'MPR' ? 'mpr' : viewType === '3D' ? '3d' : '4d']
  if (backendCapability?.supported === false) {
    return {
      supported: false,
      blockedCode: backendCapability.blockedCode,
      blockedReason: backendCapability.blockedReason
    }
  }

  if (viewType === '4D') {
    if (isPetSeries(series)) {
      return blockedAvailability('dynamic-pet-unsupported', 'Dynamic PET analysis is not supported yet.')
    }
    if (!isFourDSeriesItem(series)) {
      return blockedAvailability('not-four-d-series', 'The series does not contain at least two detectable 4D phases.')
    }
    return { supported: true }
  }

  if (!hasRenderablePixelGrid(series)) {
    return blockedAvailability('image-pixels-unavailable', 'The series does not contain a renderable image pixel grid.')
  }
  if (isTagPreferredSeries(series) || hasNonVolumeStandardObjectType(series) || hasNonVolumeModality(series)) {
    return blockedAvailability('non-volume-dicom-object', 'This DICOM object type cannot be used for volume display.')
  }
  if (hasReportLikeDescription(series)) {
    return blockedAvailability('report-like-series', 'Report and secondary-capture series cannot be used for volume display.')
  }
  if (getSeriesExtendedFrameCount(series) < 2) {
    return blockedAvailability('insufficient-slices', 'MPR and 3D require at least two image slices.')
  }
  return { supported: true }
}

export function isTagPreferredSeries(series: FolderSeriesItem | null | undefined): boolean {
  return String(series?.preferredViewType ?? '').trim().toLowerCase() === 'tag'
}

export function isPetSeries(series: FolderSeriesItem | null | undefined): boolean {
  const modality = String(series?.modality ?? '').trim().toUpperCase()
  return modality === 'PT' || modality === 'PET'
}

export function resolveInitialSeriesViewType(series: FolderSeriesItem | null | undefined): ViewType {
  if (isTagPreferredSeries(series) || series?.isImageSeries === false || !isBackendCapabilitySupported(series, 'stack')) {
    return 'Tag'
  }
  return series && hasRenderablePixelGrid(series) && isPetSeries(series) ? 'PET' : 'Stack'
}

export function resolvePrimaryTwoDimensionalViewType(series: FolderSeriesItem | null | undefined): 'Stack' | 'PET' {
  return series && hasRenderablePixelGrid(series) && !isTagPreferredSeries(series) && isPetSeries(series) ? 'PET' : 'Stack'
}

export function isSeriesVolumeViewSupported(series: FolderSeriesItem | null | undefined): boolean {
  if (!series || !hasRenderablePixelGrid(series)) {
    return false
  }
  if (isTagPreferredSeries(series) || hasNonVolumeStandardObjectType(series) || hasNonVolumeModality(series)) {
    return false
  }
  if (hasReportLikeDescription(series)) {
    return false
  }
  return (
    getSeriesExtendedFrameCount(series) >= 2 &&
    isBackendCapabilitySupported(series, 'mpr') &&
    isBackendCapabilitySupported(series, '3d')
  )
}

export function isSeriesViewSupported(series: FolderSeriesItem | null | undefined, viewType: ViewType): boolean {
  if (viewType === 'Tag') {
    return Boolean(series)
  }
  if (viewType === '4D') {
    return !isPetSeries(series) && isFourDSeriesItem(series) && isBackendCapabilitySupported(series, '4d')
  }
  if (viewType === '3D' || viewType === 'MPR') {
    return (
      isSeriesVolumeViewSupported(series) &&
      isBackendCapabilitySupported(series, viewType === '3D' ? '3d' : 'mpr')
    )
  }
  if (viewType === 'PET') {
    return Boolean(
      series &&
      hasRenderablePixelGrid(series) &&
      !isTagPreferredSeries(series) &&
      isPetSeries(series) &&
      isBackendCapabilitySupported(series, 'stack')
    )
  }
  if (viewType === 'Montage') {
    return Boolean(
      series &&
      hasRenderablePixelGrid(series) &&
      !isTagPreferredSeries(series) &&
      isBackendCapabilitySupported(series, 'montage')
    )
  }
  if (viewType === 'Stack' || viewType === 'CompareStack' || viewType === 'Layout') {
    return Boolean(
      series &&
      hasRenderablePixelGrid(series) &&
      !isTagPreferredSeries(series) &&
      isBackendCapabilitySupported(series, 'stack')
    )
  }
  return false
}

export function isPrimaryTwoDimensionalViewSupported(series: FolderSeriesItem | null | undefined): boolean {
  return isSeriesViewSupported(series, resolvePrimaryTwoDimensionalViewType(series))
}
