import axios, { AxiosHeaders } from 'axios'
import { DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'
import { getWorkspaceId, WORKSPACE_HEADER } from './workspaceIdentity'

const DEFAULT_API_TIMEOUT_MS = 15000
const API_V1_SUFFIX_PATTERN = /\/api\/v1(?:\/+)?$/i
const ABSOLUTE_ASSET_URL_PATTERN = /^(?:data:|blob:|https?:\/\/|\/\/)/i

function normalizeApiBaseURL(baseURL: string): string {
  return baseURL.trim().replace(/\/+$/, '')
}

function isAbsoluteAssetUrl(value: string): boolean {
  return ABSOLUTE_ASSET_URL_PATTERN.test(value)
}

export const api = axios.create({
  baseURL: normalizeApiBaseURL(`${DESKTOP_DEV_BACKEND_ORIGIN}/api/v1`),
  timeout: DEFAULT_API_TIMEOUT_MS
})

api.interceptors.request.use((config) => {
  const workspaceId = getWorkspaceId()
  config.headers = AxiosHeaders.from(config.headers)
  config.headers.set(WORKSPACE_HEADER, workspaceId)
  return config
})

export function setApiBaseURL(baseURL: string): void {
  api.defaults.baseURL = normalizeApiBaseURL(baseURL)
}

export function getApiBaseURL(): string {
  return String(api.defaults.baseURL || '')
}

export function getBackendOrigin(): string {
  return getApiBaseURL().replace(API_V1_SUFFIX_PATTERN, '')
}

export function resolveBackendAssetUrl(value?: string | null): string {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return ''
  }
  if (isAbsoluteAssetUrl(rawValue)) {
    return rawValue
  }
  if (!rawValue.startsWith('/') && !rawValue.startsWith('api/')) {
    return rawValue
  }

  // Backend summaries may return API-relative asset paths. Normalize those to
  // the current backend origin so web and Electron modes use the same data shape.
  const origin = getBackendOrigin().replace(/\/$/, '')
  const path = rawValue.startsWith('/') ? rawValue : `/${rawValue}`
  return `${origin}${path}`
}
