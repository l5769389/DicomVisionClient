export const APP_BACKEND_CONFIG = {
  desktop: {
    devHost: '127.0.0.1',
    devPort: 8000
  },
  web: {
    devOrigin: 'http://127.0.0.1:8000',
    prodOrigin: 'https://dicomvisionserver.onrender.com'
  }
} as const

export function buildHttpOrigin(host: string, port: number): string {
  return `http://${host}:${port}`
}

export const DESKTOP_DEV_BACKEND_ORIGIN = buildHttpOrigin(
  APP_BACKEND_CONFIG.desktop.devHost,
  APP_BACKEND_CONFIG.desktop.devPort
)
