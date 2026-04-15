type ViewerPlatform = 'desktop' | 'web'
type FolderSourceMode = 'desktop-picker' | 'web-prompt' | 'server-sample'

export interface ViewerRuntimeApi {
  canChooseFolder: boolean
  folderSourceMode: FolderSourceMode
  chooseFolder: () => Promise<string | null>
  getBackendOrigin: () => Promise<string>
  platform: ViewerPlatform
}

const WEB_SAMPLE_FOLDER_SENTINEL = '__server_sample__'

function getTrimmedEnvValue(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

function resolveWebBackendOrigin(): string {
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000'
  }

  const configuredOrigin = getTrimmedEnvValue(import.meta.env.VITE_BACKEND_ORIGIN)
  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin)
  }

  throw new Error('VITE_BACKEND_ORIGIN is required for web production builds')
}

function resolveWebFolderPrompt(): string {
  return getTrimmedEnvValue(import.meta.env.VITE_WEB_FOLDER_PROMPT) ?? '请输入服务端可访问的 DICOM 文件夹路径'
}

function shouldUseServerSample(): boolean {
  return getTrimmedEnvValue(import.meta.env.VITE_WEB_USE_SERVER_SAMPLE)?.toLowerCase() === 'true'
}

function createDesktopRuntime(): ViewerRuntimeApi {
  return {
    platform: 'desktop',
    canChooseFolder: true,
    folderSourceMode: 'desktop-picker',
    chooseFolder: () => window.viewerApi?.chooseFolder?.() ?? Promise.resolve(null),
    getBackendOrigin: () =>
      window.viewerApi?.getBackendOrigin?.().then(normalizeOrigin) ?? Promise.resolve('http://127.0.0.1:8000')
  }
}

function createWebRuntime(): ViewerRuntimeApi {
  const useServerSample = shouldUseServerSample()

  return {
    platform: 'web',
    canChooseFolder: true,
    folderSourceMode: useServerSample ? 'server-sample' : 'web-prompt',
    chooseFolder: async () => {
      if (useServerSample) {
        return WEB_SAMPLE_FOLDER_SENTINEL
      }

      const enteredPath = window.prompt(resolveWebFolderPrompt(), '')
      const trimmedPath = enteredPath?.trim() ?? ''
      return trimmedPath.length ? trimmedPath : null
    },
    getBackendOrigin: async () => resolveWebBackendOrigin()
  }
}

export const viewerRuntime: ViewerRuntimeApi =
  typeof window !== 'undefined' && window.viewerApi ? createDesktopRuntime() : createWebRuntime()

export { WEB_SAMPLE_FOLDER_SENTINEL }
