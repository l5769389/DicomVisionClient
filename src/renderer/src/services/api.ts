import axios, { AxiosHeaders } from 'axios'
import { getWorkspaceId, WORKSPACE_HEADER } from './workspaceIdentity'
import {
  getApiBaseURL,
  getBackendOrigin,
  onApiBaseURLChange,
  resolveBackendAssetUrl,
  setApiBaseURL as setApiBaseURLState
} from './apiBase'

const DEFAULT_API_TIMEOUT_MS = 15000

export const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: DEFAULT_API_TIMEOUT_MS
})

onApiBaseURLChange((baseURL) => {
  api.defaults.baseURL = baseURL
})

api.interceptors.request.use((config) => {
  const workspaceId = getWorkspaceId()
  config.headers = AxiosHeaders.from(config.headers)
  config.headers.set(WORKSPACE_HEADER, workspaceId)
  return config
})

export function setApiBaseURL(baseURL: string): void {
  setApiBaseURLState(baseURL)
}

export { getApiBaseURL, getBackendOrigin, resolveBackendAssetUrl }
