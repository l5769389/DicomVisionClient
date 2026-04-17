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
      getBackendOrigin: () => Promise<string>
      loadUiPreferences: () => Promise<unknown | null>
      saveUiPreferences: (payload: unknown) => Promise<void>
    }
  }
}

export {}
