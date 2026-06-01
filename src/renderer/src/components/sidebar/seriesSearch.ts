import type { FolderSeriesItem } from '../../types/viewer'

interface CachedSeriesTerms {
  signature: string
  terms: string
}

export function normalizeSeriesSearch(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
}

function buildSeriesSearchSignature(series: FolderSeriesItem): string {
  return [
    series.seriesDescription,
    series.modality,
    series.seriesId,
    series.seriesInstanceUid,
    series.studyInstanceUid,
    series.patientName,
    series.patientId,
    series.studyDate,
    series.studyDescription,
    series.accessionNumber,
    series.folderPath,
    series.width,
    series.height,
    series.instanceCount
  ]
    .map((value) => String(value ?? ''))
    .join('\u0000')
}

export function buildSeriesSearchTerms(series: FolderSeriesItem): string {
  return [
    series.seriesDescription,
    series.modality,
    series.seriesId,
    series.seriesInstanceUid,
    series.studyInstanceUid,
    series.patientName,
    series.patientId,
    series.studyDate,
    series.studyDescription,
    series.accessionNumber,
    series.folderPath,
    series.width,
    series.height,
    series.instanceCount
  ]
    .map((value) => normalizeSeriesSearch(value))
    .filter(Boolean)
    .join(' ')
}

export function createSeriesSearchTermCache() {
  const cache = new Map<string, CachedSeriesTerms>()

  function get(series: FolderSeriesItem): string {
    const key = series.seriesId || series.seriesInstanceUid || buildSeriesSearchSignature(series)
    const signature = buildSeriesSearchSignature(series)
    const cached = cache.get(key)
    if (cached?.signature === signature) {
      return cached.terms
    }

    const terms = buildSeriesSearchTerms(series)
    cache.set(key, { signature, terms })
    return terms
  }

  function clear(): void {
    cache.clear()
  }

  return {
    clear,
    get
  }
}

export type SeriesSearchTermCache = ReturnType<typeof createSeriesSearchTermCache>

export function doesSeriesMatchSearch(
  series: FolderSeriesItem,
  query: string,
  termCache?: SeriesSearchTermCache
): boolean {
  const normalizedQuery = normalizeSeriesSearch(query)
  if (!normalizedQuery) {
    return true
  }
  const terms = termCache?.get(series) ?? buildSeriesSearchTerms(series)
  return normalizedQuery.split(' ').every((token) => terms.includes(token))
}
