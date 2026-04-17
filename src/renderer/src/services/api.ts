import axios from 'axios'
import { DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'

export const api = axios.create({
  baseURL: `${DESKTOP_DEV_BACKEND_ORIGIN}/api/v1`,
  timeout: 15000
})

export function setApiBaseURL(baseURL: string): void {
  api.defaults.baseURL = baseURL
}
