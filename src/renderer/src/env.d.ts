/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_ORIGIN?: string
  readonly VITE_WEB_FOLDER_PROMPT?: string
  readonly VITE_WEB_USE_SERVER_SAMPLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    viewerApi?: {
      chooseFolder: () => Promise<string | null>
      chooseExportDirectory: () => Promise<string | null>
      getBackendOrigin: () => Promise<string>
      getDefaultExportDirectory: () => Promise<string>
      loadUiPreferences: () => Promise<unknown | null>
      saveExportFile: (payload: { fileName: string; directoryPath?: string | null; data: Uint8Array | number[] }) => Promise<string>
      saveUiPreferences: (payload: unknown) => Promise<void>
    }
  }
}

export {}
