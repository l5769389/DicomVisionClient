export type ViewerMode = 'stack' | 'mpr' | 'volume3d'

export interface StudySummary {
  id: string
  patientName: string
  patientId: string
  studyDate: string
  studyDescription: string
  series: SeriesSummary[]
}

export interface SeriesSummary {
  id: string
  description: string
  modality: string
  imageCount: number
}

export interface ApiConfig {
  baseURL: string
}

export interface SocketConfig {
  origin: string
}
