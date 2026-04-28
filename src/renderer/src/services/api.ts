import axios from 'axios'
import { DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'

export const api = axios.create({
  baseURL: `${DESKTOP_DEV_BACKEND_ORIGIN}/api/v1`,
  timeout: 15000
})

export function setApiBaseURL(baseURL: string): void {
  api.defaults.baseURL = baseURL
}

export function getApiBaseURL(): string {
  return String(api.defaults.baseURL || '')
}

export function getBackendOrigin(): string {
  return getApiBaseURL().replace(/\/api\/v1\/?$/i, '')
}

export function resolveBackendAssetUrl(value?: string | null): string {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return ''
  }
  if (/^(?:data:|blob:|https?:\/\/)/i.test(rawValue)) {
    return rawValue
  }
  if (!rawValue.startsWith('/') && !rawValue.startsWith('api/')) {
    return rawValue
  }

  const origin = getBackendOrigin().replace(/\/$/, '')
  const path = rawValue.startsWith('/') ? rawValue : `/${rawValue}`
  return `${origin}${path}`
}
