/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_ORIGIN?: string
  readonly VITE_MOBILE_DEV_SAMPLE_DICOM_PATH?: string
  readonly VITE_MOBILE_SAMPLE_MODE?: 'local-path' | 'server-sample'
  readonly VITE_WEB_APP_MODE?: 'demo-web' | 'web'
  readonly VITE_WEB_FOLDER_PROMPT?: string
  readonly VITE_WEB_USE_SERVER_SAMPLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  const __APP_VERSION__: string

  type ViewerStatusToastPayload = {
    id?: string
    message?: string
    tone?: 'info' | 'success' | 'warning' | 'error'
    detail?: string | null
    directoryPath?: string | null
    filePath?: string | null
    canOpenLocation?: boolean
    busy?: boolean
    progressLabel?: string | null
    progressPercent?: number | null
    durationMs?: number
  }

  type ViewerBackendStatusPayload = {
    error: string | null
    origin: string
    ready: boolean
    starting: boolean
  }

  interface Window {
    viewerApi?: {
      chooseFolder: (mode?: 'files' | 'folder') => Promise<string | string[] | null>
      chooseExportDirectory: () => Promise<string | null>
      closeWindow: () => Promise<void>
      consumeLatestDroppedFilePaths: () => string[]
      consumePendingOpenFilePaths: () => string[]
      getBackendOrigin: () => Promise<string>
      getBackendStatus: () => Promise<ViewerBackendStatusPayload>
      getDefaultExportDirectory: () => Promise<string>
      getStartupStatusToast: () => Promise<ViewerStatusToastPayload | null>
      getPathForFile: (file: File) => string
      loadUiPreferences: () => Promise<unknown | null>
      minimizeWindow: () => Promise<void>
      normalizeDroppedPaths: (paths: string[]) => Promise<string[]>
      onBackendOriginChanged: (callback: (origin: string) => void) => () => void
      onBackendStatusChanged: (callback: (payload: ViewerBackendStatusPayload) => void) => () => void
      onOpenDicomPaths: (callback: (paths: string[]) => void) => () => void
      onStatusToast: (callback: (payload: ViewerStatusToastPayload) => void) => () => void
      openExportLocation: (payload: { directoryPath?: string | null; filePath?: string | null }) => Promise<boolean>
      openPathInFileManager: (payload: { path?: string | null }) => Promise<boolean>
      saveExportFile: (payload: { fileName: string; directoryPath?: string | null; data: Uint8Array | number[] }) => Promise<{ directoryPath: string; filePath: string }>
      saveUiPreferences: (payload: unknown) => Promise<void>
      toggleWindowFullScreen: () => Promise<boolean>
    }
  }
}

export {}
