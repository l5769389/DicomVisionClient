import type { AxiosRequestConfig } from 'axios'
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
  GetCornerInfoApiV1DicomCornerInfoPost: '/api/v1/dicom/cornerInfo',
  GetDicomTagsApiV1DicomTagsPost: '/api/v1/dicom/tags',
  GetFourDPhasesApiV1DicomFourDPhasesPost: '/api/v1/dicom/fourD/phases',
  LoadFolderApiV1DicomLoadFolderPost: '/api/v1/dicom/loadFolder',
  LoadSampleFolderApiV1DicomLoadSamplePost: '/api/v1/dicom/loadSample',
  SetViewSizeApiV1ViewSetSizePost: '/api/v1/view/setSize'
} satisfies SupportedOperationPaths

type SupportedOperationKey = keyof typeof operationPaths & ApiOperationKey
type OperationRequest<K extends SupportedOperationKey> = ApiOperations[K]['request']
type OperationResponse<K extends SupportedOperationKey> = ApiOperations[K]['response']

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
