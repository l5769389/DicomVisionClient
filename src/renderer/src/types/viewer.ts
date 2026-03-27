export interface FolderSeriesItem {
  seriesId: string
  seriesInstanceUid?: string | null
  studyInstanceUid?: string | null
  patientId?: string | null
  modality?: string | null
  seriesDescription?: string | null
  instanceCount: number
  width?: number | null
  height?: number | null
  folderPath: string
}

export interface LoadFolderResponse {
  seriesId?: string | null
  seriesList?: FolderSeriesItem[]
}

export interface ViewCreateResponse {
  viewId: string
}

export type BackendCreateViewType = ViewType | 'AX' | 'COR' | 'SAG'
export type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

export interface CornerInfo {
  topLeft: string[]
  topRight: string[]
  bottomLeft: string[]
  bottomRight: string[]
}

export interface CornerInfoResponse {
  cornerInfo?: unknown
}

export interface OperationAcceptedResponse {
  success: boolean
  message: string
  viewId: string
}

export interface WorkspaceReadyPayload {
  element: HTMLElement | null
  viewportKey: string
  viewportElements?: Partial<Record<MprViewportKey, HTMLElement | null>>
}

export type MprViewportKey = 'mpr-ax' | 'mpr-cor' | 'mpr-sag'

export interface MprCrosshairInfo {
  centerX: number
  centerY: number
  hitRadius: number
}

export interface OrientationInfo {
  top: string | null
  right: string | null
  bottom: string | null
  left: string | null
}

export interface ViewImageResponse {
  imageFormat?: 'png' | 'jpeg'
  viewId: string
  slice_info?: {
    current: number
    total: number
  }
  window_info?: {
    ww?: number | null
    wl?: number | null
  }
  mpr_crosshair?: MprCrosshairInfo | null
  cornerInfo?: unknown
  orientation?: unknown
}

export interface ViewerTabItem {
  key: string
  seriesId: string
  seriesTitle: string
  title: string
  viewType: ViewType
  viewId: string
  imageSrc: string
  sliceLabel: string
  windowLabel: string
  viewportViewIds?: Partial<Record<MprViewportKey, string>>
  viewportImages?: Partial<Record<MprViewportKey, string>>
  viewportSliceLabels?: Partial<Record<MprViewportKey, string>>
  viewportCrosshairs?: Partial<Record<MprViewportKey, MprCrosshairInfo | null>>
  cornerInfo: CornerInfo
  viewportCornerInfos?: Partial<Record<MprViewportKey, CornerInfo>>
  orientation: OrientationInfo
  viewportOrientations?: Partial<Record<MprViewportKey, OrientationInfo>>
}

export interface ViewerOperationItem {
  value: string
  icon: string
  label: string
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
export type ViewType = 'Stack' | 'MPR' | '3D'
