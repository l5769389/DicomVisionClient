export const SERIES_DRAG_TYPE = 'application/x-dicomvision-series-id'
export const SERIES_DRAG_PAYLOAD_TYPE = 'application/x-dicomvision-series+json'

export interface SeriesDragPayload {
  seriesId: string
  folderPath?: string
  seriesInstanceUid?: string | null
}
