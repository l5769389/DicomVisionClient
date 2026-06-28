import { DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'

const API_V1_SUFFIX_PATTERN = /\/api\/v1(?:\/+)?$/i
const ABSOLUTE_ASSET_URL_PATTERN = /^(?:data:|blob:|https?:\/\/|\/\/)/i

let apiBaseURL = normalizeApiBaseURL(`${DESKTOP_DEV_BACKEND_ORIGIN}/api/v1`)
const apiBaseURLListeners = new Set<(baseURL: string) => void>()

function normalizeApiBaseURL(baseURL: string): string {
  return baseURL.trim().replace(/\/+$/, '')
}

function isAbsoluteAssetUrl(value: string): boolean {
  return ABSOLUTE_ASSET_URL_PATTERN.test(value)
}

export function setApiBaseURL(baseURL: string): void {
  const normalizedBaseURL = normalizeApiBaseURL(baseURL)
  if (apiBaseURL === normalizedBaseURL) {
    return
  }

  apiBaseURL = normalizedBaseURL
  apiBaseURLListeners.forEach((listener) => listener(apiBaseURL))
}

export function getApiBaseURL(): string {
  return apiBaseURL
}

export function getBackendOrigin(): string {
  return getApiBaseURL().replace(API_V1_SUFFIX_PATTERN, '')
}

export function onApiBaseURLChange(listener: (baseURL: string) => void): () => void {
  apiBaseURLListeners.add(listener)
  return () => {
    apiBaseURLListeners.delete(listener)
  }
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
