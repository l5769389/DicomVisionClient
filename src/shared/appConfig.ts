export const APP_BACKEND_CONFIG = {
  desktop: {
    devHost: '127.0.0.1',
    // The viewport/montage worktree owns a separate backend so it can run
    // alongside main (8000) and pre-release (8100).
    devPort: 8200
  },
  web: {
    devOrigin: 'http://127.0.0.1:8200',
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
