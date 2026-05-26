/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_ORIGIN?: string
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

  interface Window {
    viewerApi?: {
      chooseFolder: () => Promise<string | null>
      chooseExportDirectory: () => Promise<string | null>
      closeWindow: () => Promise<void>
      consumeLatestDroppedFilePaths: () => string[]
      consumePendingOpenFilePaths: () => string[]
      getBackendOrigin: () => Promise<string>
      getDefaultExportDirectory: () => Promise<string>
      getStartupStatusToast: () => Promise<ViewerStatusToastPayload | null>
      getPathForFile: (file: File) => string
      loadUiPreferences: () => Promise<unknown | null>
      minimizeWindow: () => Promise<void>
      normalizeDroppedPaths: (paths: string[]) => Promise<string[]>
      onBackendOriginChanged: (callback: (origin: string) => void) => () => void
      onOpenDicomPaths: (callback: (paths: string[]) => void) => () => void
      onStatusToast: (callback: (payload: ViewerStatusToastPayload) => void) => () => void
      openExportLocation: (payload: { directoryPath?: string | null; filePath?: string | null }) => Promise<boolean>
      saveExportFile: (payload: { fileName: string; directoryPath?: string | null; data: Uint8Array | number[] }) => Promise<{ directoryPath: string; filePath: string }>
      saveUiPreferences: (payload: unknown) => Promise<void>
      toggleWindowFullScreen: () => Promise<boolean>
    }
  }
}

export {}
