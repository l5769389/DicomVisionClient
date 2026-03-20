import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://127.0.0.1:8787/api',
  timeout: 15000
})

export function setApiBaseURL(baseURL: string): void {
  api.defaults.baseURL = baseURL
}
