import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { ApiOperations } from '@shared/generated/backendApi'
import { api } from './api'

type ApiOperationKey = keyof ApiOperations
type SupportedOperationPaths = Partial<{ [K in ApiOperationKey]: ApiOperations[K]['path'] }>

const API_V1_PREFIX_PATTERN = /^\/api\/v1(?=\/)/

// Keep this map as the small, explicit REST surface that the viewer UI calls.
// The keys come from generated OpenAPI types, while the values are the backend
// paths. Adding an endpoint here makes the request and response types available
// through postApi without hand-writing Axios generics at call sites.
const operationPaths = {
  AnalyzeMtfApiV1ViewMtfAnalyzePost: '/api/v1/view/mtf/analyze',
  AnalyzeQaWaterApiV1ViewQaWaterAnalyzePost: '/api/v1/view/qa/water/analyze',
  CloseViewApiV1ViewClosePost: '/api/v1/view/close',
  CreateViewApiV1ViewCreatePost: '/api/v1/view/create',
  DeidentifyDicomSeriesApiV1DicomDeidentifyPost: '/api/v1/dicom/deidentify',
  GetCornerInfoApiV1DicomCornerInfoPost: '/api/v1/dicom/cornerInfo',
  GetDicomTagsApiV1DicomTagsPost: '/api/v1/dicom/tags',
  GetFourDPhasesApiV1DicomFourDPhasesPost: '/api/v1/dicom/fourD/phases',
  LoadFolderApiV1DicomLoadFolderPost: '/api/v1/dicom/loadFolder',
  LoadSampleFolderApiV1DicomLoadSamplePost: '/api/v1/dicom/loadSample',
  ModifyDicomTagApiV1DicomModifyTagPost: '/api/v1/dicom/modifyTag',
  CreateDicomwebSeriesDownloadJobApiV1PacsDicomwebDownloadSeriesJobsPost:
    '/api/v1/pacs/dicomweb/downloadSeries/jobs',
  QueryDicomwebSeriesApiV1PacsDicomwebSeriesPost: '/api/v1/pacs/dicomweb/series',
  PreviewDicomwebSeriesApiV1PacsDicomwebSeriesPreviewPost: '/api/v1/pacs/dicomweb/seriesPreview',
  QueryDicomwebStudiesApiV1PacsDicomwebStudiesPost: '/api/v1/pacs/dicomweb/studies',
  TestDicomwebConnectionApiV1PacsDicomwebTestPost: '/api/v1/pacs/dicomweb/test',
  SetViewSizeApiV1ViewSetSizePost: '/api/v1/view/setSize'
} satisfies SupportedOperationPaths

type SupportedOperationKey = keyof typeof operationPaths & ApiOperationKey
type OperationRequest<K extends SupportedOperationKey> = ApiOperations[K]['request']
type OperationResponse<K extends SupportedOperationKey> = ApiOperations[K]['response']
type DicomDeidentifyRequest = ApiOperations['DeidentifyDicomSeriesApiV1DicomDeidentifyPost']['request']
type DicomTagModifyRequest = ApiOperations['ModifyDicomTagApiV1DicomModifyTagPost']['request']
export type LoadFolderResponse = ApiOperations['LoadFolderApiV1DicomLoadFolderPost']['response']
export type PacsWadoSeriesDownloadRequest =
  ApiOperations['CreateDicomwebSeriesDownloadJobApiV1PacsDicomwebDownloadSeriesJobsPost']['request']
export type PacsSeriesPreviewRequest =
  ApiOperations['PreviewDicomwebSeriesApiV1PacsDicomwebSeriesPreviewPost']['request']
export type PacsSeriesPreviewResponse =
  ApiOperations['PreviewDicomwebSeriesApiV1PacsDicomwebSeriesPreviewPost']['response']
type DicomTagModifyJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface DicomUploadItem {
  file: File
  relativePath: string
}

export interface DicomUploadProgress {
  lengthComputable: boolean
  loaded: number
  total: number | null
}

export interface DicomTagModifyArtifact {
  artifactKind: 'dicom' | 'zip'
  data: Uint8Array
  fileName: string
  mediaType: string
  modifiedCount: number
  seriesFolder: string
}

export type DicomDeidentifyArtifact = DicomTagModifyArtifact

export interface DicomTagModifyJob {
  jobId: string
  status: DicomTagModifyJobStatus
  statusUrl: string
  artifactUrl?: string | null
  error?: string | null
  artifactKind?: 'dicom' | 'zip' | null
  fileName?: string | null
  mediaType?: string | null
  modifiedCount?: number | null
  processedCount?: number | null
  progressPercent?: number | null
  seriesFolder?: string | null
  totalCount?: number | null
  createdAt: string
  completedAt?: string | null
}

export type PacsWadoSeriesDownloadJob =
  ApiOperations['CreateDicomwebSeriesDownloadJobApiV1PacsDicomwebDownloadSeriesJobsPost']['response'] &
  DicomTagModifyJob

function toApiBaseRelativePath(path: string): string {
  return path.replace(API_V1_PREFIX_PATTERN, '')
}

/**
 * Typed POST helper for backend REST APIs.
 *
 * Use Socket.IO for high-frequency viewer interaction; use this helper for
 * request/response operations such as loading folders, creating views, analysis,
 * and size/export calls.
 */
export async function postApi<K extends SupportedOperationKey>(
  operation: K,
  data?: OperationRequest<K>,
  config?: AxiosRequestConfig
): Promise<OperationResponse<K>> {
  const response = await api.post<OperationResponse<K>>(toApiBaseRelativePath(operationPaths[operation]), data, config)
  return response.data
}

function getResponseHeader(headers: unknown, key: string): string {
  const normalizedKey = key.toLowerCase()
  const headerRecord = headers as Record<string, unknown> & { get?: (name: string) => unknown }
  const value = headerRecord[normalizedKey] ?? headerRecord[key] ?? headerRecord.get?.(key)

  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

function getFileNameFromContentDisposition(value: string): string {
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(value)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim())
    } catch {
      return encodedMatch[1].trim()
    }
  }

  const quotedMatch = /filename="([^"]+)"/i.exec(value)
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim()
  }

  const plainMatch = /filename=([^;]+)/i.exec(value)
  return plainMatch?.[1]?.trim() ?? ''
}

function decodeHeaderFileName(value: string): string {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  try {
    return decodeURIComponent(trimmedValue)
  } catch {
    return trimmedValue
  }
}

function buildDicomBinaryArtifact(
  response: AxiosResponse<ArrayBuffer>,
  fallbackFileNames: { dicomFileName: string; zipFileName: string }
): DicomTagModifyArtifact {
  const contentDisposition = getResponseHeader(response.headers, 'content-disposition')
  const mediaType = getResponseHeader(response.headers, 'content-type') || 'application/octet-stream'
  const artifactKindHeader = getResponseHeader(response.headers, 'x-dicomvision-artifact-kind')
  const artifactKind = artifactKindHeader === 'zip' ? 'zip' : 'dicom'
  const fileName =
    decodeHeaderFileName(getResponseHeader(response.headers, 'x-dicomvision-file-name')) ||
    getFileNameFromContentDisposition(contentDisposition) ||
    (artifactKind === 'zip' ? fallbackFileNames.zipFileName : fallbackFileNames.dicomFileName)
  const modifiedCount = Number.parseInt(getResponseHeader(response.headers, 'x-dicomvision-modified-count'), 10)

  return {
    artifactKind,
    data: new Uint8Array(response.data),
    fileName,
    mediaType,
    modifiedCount: Number.isFinite(modifiedCount) ? modifiedCount : 1,
    seriesFolder: getResponseHeader(response.headers, 'x-dicomvision-series-folder')
  }
}

export async function postDicomTagModifyArtifact(
  data: DicomTagModifyRequest,
  config?: AxiosRequestConfig
): Promise<DicomTagModifyArtifact> {
  const response = await api.post<ArrayBuffer>(
    toApiBaseRelativePath(operationPaths.ModifyDicomTagApiV1DicomModifyTagPost),
    data,
    {
      ...config,
      responseType: 'arraybuffer'
    }
  )
  return buildDicomBinaryArtifact(response, {
    dicomFileName: 'dicom-tag-edit.dcm',
    zipFileName: 'dicom-tag-edits.zip'
  })
}

export async function postDicomDeidentifyArtifact(
  data: DicomDeidentifyRequest,
  config?: AxiosRequestConfig
): Promise<DicomDeidentifyArtifact> {
  const response = await api.post<ArrayBuffer>(
    toApiBaseRelativePath(operationPaths.DeidentifyDicomSeriesApiV1DicomDeidentifyPost),
    data,
    {
      ...config,
      responseType: 'arraybuffer'
    }
  )
  return buildDicomBinaryArtifact(response, {
    dicomFileName: 'dicom-deidentified.dcm',
    zipFileName: 'dicom-deidentified.zip'
  })
}

export async function postDicomUpload(
  files: DicomUploadItem[],
  config?: AxiosRequestConfig,
  onProgress?: (progress: DicomUploadProgress) => void
): Promise<LoadFolderResponse> {
  const formData = new FormData()
  for (const item of files) {
    formData.append('files', item.file, item.relativePath || item.file.name || 'dicom-file')
    formData.append('relativePaths', item.relativePath || item.file.name || 'dicom-file')
  }

  const response = await api.post<LoadFolderResponse>(toApiBaseRelativePath('/api/v1/dicom/upload'), formData, {
    timeout: 0,
    ...config,
    onUploadProgress: (event) => {
      onProgress?.({
        lengthComputable: event.lengthComputable,
        loaded: event.loaded,
        total: typeof event.total === 'number' && Number.isFinite(event.total) ? event.total : null
      })
      config?.onUploadProgress?.(event)
    }
  })
  return response.data
}

export async function postDicomDeidentifyJob(
  data: DicomDeidentifyRequest,
  config?: AxiosRequestConfig
): Promise<DicomTagModifyJob> {
  const response = await api.post<DicomTagModifyJob>(
    toApiBaseRelativePath('/api/v1/dicom/deidentify/jobs'),
    data,
    config
  )
  return response.data
}

export async function getDicomDeidentifyJob(jobId: string, config?: AxiosRequestConfig): Promise<DicomTagModifyJob> {
  const response = await api.get<DicomTagModifyJob>(
    toApiBaseRelativePath(`/api/v1/dicom/deidentify/jobs/${encodeURIComponent(jobId)}`),
    config
  )
  return response.data
}

export async function getDicomDeidentifyJobArtifact(
  jobId: string,
  config?: AxiosRequestConfig
): Promise<DicomDeidentifyArtifact> {
  const response = await api.get<ArrayBuffer>(
    toApiBaseRelativePath(`/api/v1/dicom/deidentify/jobs/${encodeURIComponent(jobId)}/artifact`),
    {
      timeout: 0,
      ...config,
      responseType: 'arraybuffer'
    }
  )
  return buildDicomBinaryArtifact(response, {
    dicomFileName: 'dicom-deidentified.dcm',
    zipFileName: 'dicom-deidentified.zip'
  })
}

export async function postDicomTagModifyJob(
  data: DicomTagModifyRequest,
  config?: AxiosRequestConfig
): Promise<DicomTagModifyJob> {
  const response = await api.post<DicomTagModifyJob>(
    toApiBaseRelativePath('/api/v1/dicom/modifyTag/jobs'),
    data,
    config
  )
  return response.data
}

export async function getDicomTagModifyJob(jobId: string, config?: AxiosRequestConfig): Promise<DicomTagModifyJob> {
  const response = await api.get<DicomTagModifyJob>(
    toApiBaseRelativePath(`/api/v1/dicom/modifyTag/jobs/${encodeURIComponent(jobId)}`),
    config
  )
  return response.data
}

export async function getDicomTagModifyJobArtifact(
  jobId: string,
  config?: AxiosRequestConfig
): Promise<DicomTagModifyArtifact> {
  const response = await api.get<ArrayBuffer>(
    toApiBaseRelativePath(`/api/v1/dicom/modifyTag/jobs/${encodeURIComponent(jobId)}/artifact`),
    {
      timeout: 0,
      ...config,
      responseType: 'arraybuffer'
    }
  )
  return buildDicomBinaryArtifact(response, {
    dicomFileName: 'dicom-tag-edit.dcm',
    zipFileName: 'dicom-tag-edits.zip'
  })
}

export async function postPacsWadoSeriesDownloadJob(
  data: PacsWadoSeriesDownloadRequest,
  config?: AxiosRequestConfig
): Promise<PacsWadoSeriesDownloadJob> {
  const response = await api.post<PacsWadoSeriesDownloadJob>(
    toApiBaseRelativePath(operationPaths.CreateDicomwebSeriesDownloadJobApiV1PacsDicomwebDownloadSeriesJobsPost),
    data,
    config
  )
  return response.data
}

export async function postPacsSeriesPreview(
  data: PacsSeriesPreviewRequest,
  config?: AxiosRequestConfig
): Promise<PacsSeriesPreviewResponse> {
  return postApi('PreviewDicomwebSeriesApiV1PacsDicomwebSeriesPreviewPost', data, config)
}

export async function getPacsWadoSeriesDownloadJob(
  jobId: string,
  config?: AxiosRequestConfig
): Promise<PacsWadoSeriesDownloadJob> {
  const response = await api.get<PacsWadoSeriesDownloadJob>(
    toApiBaseRelativePath(`/api/v1/pacs/dicomweb/downloadSeries/jobs/${encodeURIComponent(jobId)}`),
    config
  )
  return response.data
}

export async function cancelPacsWadoSeriesDownloadJob(
  jobId: string,
  config?: AxiosRequestConfig
): Promise<PacsWadoSeriesDownloadJob> {
  const response = await api.post<PacsWadoSeriesDownloadJob>(
    toApiBaseRelativePath(`/api/v1/pacs/dicomweb/downloadSeries/jobs/${encodeURIComponent(jobId)}/cancel`),
    undefined,
    config
  )
  return response.data
}
