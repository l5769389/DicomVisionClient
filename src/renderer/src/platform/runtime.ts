import { APP_BACKEND_CONFIG, DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'

type ViewerPlatform = 'desktop' | 'web'
type WebAppMode = 'demo-web' | 'web'
type FolderSourceMode = 'desktop-picker' | 'web-upload' | 'server-sample'
export type WebUploadPickMode = 'files' | 'folder'

export interface DicomUploadItem {
  file: File
  relativePath: string
}

export interface DicomDropInput {
  dataTransfer?: DataTransfer | null
  files: File[]
}

export type DicomLoadSource =
  | { kind: 'path'; path: string }
  | { kind: 'server-sample' }
  | { kind: 'files'; files: DicomUploadItem[] }
export type DicomLoadSelection = DicomLoadSource | DicomLoadSource[]

export interface BackendStatus {
  error: string | null
  origin: string
  ready: boolean
  starting: boolean
}

export interface ViewerRuntimeApi {
  canChooseFolder: boolean
  folderSourceMode: FolderSourceMode
  chooseFolder: (mode?: WebUploadPickMode) => Promise<DicomLoadSelection | null>
  getBackendOrigin: () => Promise<string>
  getBackendStatus: () => Promise<BackendStatus>
  platform: ViewerPlatform
  resolveDicomPathSources: (paths: string[]) => Promise<DicomLoadSource[]>
  webAppMode: WebAppMode | null
  resolveDroppedDicomSources: (drop: DicomDropInput) => Promise<DicomLoadSource[]>
}

const WEB_FILE_INPUT_ACCEPT = '.dcm,.dicom,application/dicom,*/*'

interface WebFileSystemEntry {
  fullPath?: string
  isDirectory: boolean
  isFile: boolean
  name: string
}

interface WebFileSystemFileEntry extends WebFileSystemEntry {
  file: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void
}

interface WebFileSystemDirectoryEntry extends WebFileSystemEntry {
  createReader: () => {
    readEntries: (
      successCallback: (entries: WebFileSystemEntry[]) => void,
      errorCallback?: (error: DOMException) => void
    ) => void
  }
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => unknown
}

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

function normalizeBackendStatus(status: ViewerBackendStatusPayload | null | undefined, fallbackOrigin: string): BackendStatus {
  const origin = typeof status?.origin === 'string' && status.origin.trim() ? normalizeOrigin(status.origin) : fallbackOrigin
  return {
    error: typeof status?.error === 'string' && status.error.trim() ? status.error.trim() : null,
    origin,
    ready: status?.ready === true,
    starting: status?.starting === true
  }
}

function resolveWebBackendOrigin(): string {
  const configuredOrigin = getTrimmedEnvValue(import.meta.env.VITE_BACKEND_ORIGIN)
  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin)
  }

  if (import.meta.env.DEV) {
    return APP_BACKEND_CONFIG.web.devOrigin
  }

  return APP_BACKEND_CONFIG.web.prodOrigin
}

function resolveWebAppMode(): WebAppMode {
  const explicitMode = getTrimmedEnvValue(import.meta.env.VITE_WEB_APP_MODE)?.toLowerCase()
  if (explicitMode === 'demo-web' || explicitMode === 'web') {
    return explicitMode
  }

  // Backward-compatible Vercel/demo switch. New deployments should prefer
  // VITE_WEB_APP_MODE=demo-web or VITE_WEB_APP_MODE=web.
  const useServerSample = getTrimmedEnvValue(import.meta.env.VITE_WEB_USE_SERVER_SAMPLE)?.toLowerCase() === 'true'
  return useServerSample ? 'demo-web' : 'web'
}

function getFileRelativePath(file: File): string {
  const browserRelativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim()
  return browserRelativePath || file.name || 'dicom-file'
}

function normalizeRelativeUploadPath(path: string | undefined): string {
  return (path ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..' && !part.endsWith(':'))
    .join('/')
}

function joinUploadPath(...parts: string[]): string {
  return normalizeRelativeUploadPath(parts.filter(Boolean).join('/'))
}

function toUploadItems(files: File[]): DicomUploadItem[] {
  return files
    .filter((file) => file && file.size > 0)
    .map((file) => ({
      file,
      relativePath: getFileRelativePath(file)
    }))
}

function readFileSystemFile(entry: WebFileSystemFileEntry, parentPath: string): Promise<DicomUploadItem | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => {
        const relativePath = normalizeRelativeUploadPath(entry.fullPath) || joinUploadPath(parentPath, entry.name || file.name)
        resolve(file.size > 0 ? { file, relativePath: relativePath || file.name || 'dicom-file' } : null)
      },
      () => resolve(null)
    )
  })
}

async function readAllDirectoryEntries(entry: WebFileSystemDirectoryEntry): Promise<WebFileSystemEntry[]> {
  const reader = entry.createReader()
  const entries: WebFileSystemEntry[] = []

  while (true) {
    const batch = await new Promise<WebFileSystemEntry[]>((resolve) => {
      reader.readEntries(resolve, () => resolve([]))
    })
    if (!batch.length) {
      break
    }
    entries.push(...batch)
  }

  return entries
}

async function readFileSystemEntry(entry: WebFileSystemEntry, parentPath = ''): Promise<DicomUploadItem[]> {
  if (entry.isFile) {
    const item = await readFileSystemFile(entry as WebFileSystemFileEntry, parentPath)
    return item ? [item] : []
  }

  if (!entry.isDirectory) {
    return []
  }

  const directoryEntry = entry as WebFileSystemDirectoryEntry
  const directoryPath = normalizeRelativeUploadPath(directoryEntry.fullPath) || joinUploadPath(parentPath, directoryEntry.name)
  const childEntries = await readAllDirectoryEntries(directoryEntry)
  const nestedItems = await Promise.all(childEntries.map((childEntry) => readFileSystemEntry(childEntry, directoryPath)))
  return nestedItems.flat()
}

function getDroppedFileSystemEntries(dataTransfer: DataTransfer | null | undefined): WebFileSystemEntry[] {
  const entries: WebFileSystemEntry[] = []
  for (const item of Array.from(dataTransfer?.items ?? [])) {
    const entry = (item as DataTransferItemWithEntry).webkitGetAsEntry?.()
    if (entry) {
      entries.push(entry as WebFileSystemEntry)
    }
  }
  return entries
}

async function resolveWebDroppedUploadItems(drop: DicomDropInput): Promise<DicomUploadItem[]> {
  const entries = getDroppedFileSystemEntries(drop.dataTransfer)
  if (entries.length) {
    const uploadItems = (await Promise.all(entries.map((entry) => readFileSystemEntry(entry)))).flat()
    if (uploadItems.length) {
      return uploadItems
    }
  }

  return toUploadItems(drop.files)
}

function pickFilesFromBrowser(options: { directory: boolean }): Promise<DicomUploadItem[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = WEB_FILE_INPUT_ACCEPT
    input.multiple = true
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.style.opacity = '0'
    if (options.directory) {
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
    }

    const cleanup = (): void => {
      input.remove()
    }

    input.addEventListener(
      'change',
      () => {
        const items = toUploadItems(Array.from(input.files ?? []))
        cleanup()
        resolve(items.length ? items : null)
      },
      { once: true }
    )

    document.body.appendChild(input)
    input.click()
  })
}

async function chooseWebUploadFiles(mode: WebUploadPickMode = 'files'): Promise<DicomLoadSource | null> {
  if (!mode) {
    return null
  }

  const files = await pickFilesFromBrowser({ directory: mode === 'folder' })
  return files?.length ? { kind: 'files', files } : null
}

function normalizeDesktopPickerPaths(paths: string | string[] | null | undefined): string[] {
  if (Array.isArray(paths)) {
    return paths.map((path) => path.trim()).filter(Boolean)
  }
  const path = paths?.trim()
  return path ? [path] : []
}

function createDesktopRuntime(): ViewerRuntimeApi {
  return {
    platform: 'desktop',
    webAppMode: null,
    canChooseFolder: true,
    folderSourceMode: 'desktop-picker',
    chooseFolder: async (mode) => {
      const api = window.viewerApi
      if (!api) {
        return null
      }

      const selectedPaths = normalizeDesktopPickerPaths(await api.chooseFolder(mode))
      if (!selectedPaths.length) {
        return null
      }

      const scanPaths = await api.normalizeDroppedPaths(selectedPaths)
      return scanPaths.length ? scanPaths.map((path) => ({ kind: 'path' as const, path })) : null
    },
    getBackendOrigin: () =>
      window.viewerApi?.getBackendOrigin?.().then(normalizeOrigin) ?? Promise.resolve(DESKTOP_DEV_BACKEND_ORIGIN),
    getBackendStatus: async () => {
      const fallbackOrigin = normalizeOrigin(await (window.viewerApi?.getBackendOrigin?.() ?? Promise.resolve(DESKTOP_DEV_BACKEND_ORIGIN)))
      if (!window.viewerApi?.getBackendStatus) {
        return {
          error: null,
          origin: fallbackOrigin,
          ready: true,
          starting: false
        }
      }

      return normalizeBackendStatus(await window.viewerApi.getBackendStatus(), fallbackOrigin)
    },
    resolveDicomPathSources: async (paths) => {
      const scanPaths = await (window.viewerApi?.normalizeDroppedPaths?.(paths) ?? Promise.resolve([]))
      return scanPaths.map((path) => ({ kind: 'path', path }))
    },
    resolveDroppedDicomSources: async (drop) => {
      const api = window.viewerApi
      if (!api) {
        return []
      }

      const preloadCapturedPaths = api.consumeLatestDroppedFilePaths()
      const fallbackFilePaths = drop.files.flatMap((file) => {
        try {
          const path = api.getPathForFile(file).trim()
          return path ? [path] : []
        } catch {
          return []
        }
      })
      const scanPaths = await api.normalizeDroppedPaths(preloadCapturedPaths.length ? preloadCapturedPaths : fallbackFilePaths)
      return scanPaths.map((path) => ({ kind: 'path', path }))
    }
  }
}

function createWebRuntime(): ViewerRuntimeApi {
  const webAppMode = resolveWebAppMode()
  const useServerSample = webAppMode === 'demo-web'

  return {
    platform: 'web',
    webAppMode,
    canChooseFolder: true,
    folderSourceMode: useServerSample ? 'server-sample' : 'web-upload',
    chooseFolder: async (mode) => {
      if (useServerSample && !mode) {
        return { kind: 'server-sample' }
      }

      return chooseWebUploadFiles(mode)
    },
    getBackendOrigin: async () => resolveWebBackendOrigin(),
    getBackendStatus: async () => ({
      error: null,
      origin: resolveWebBackendOrigin(),
      ready: true,
      starting: false
    }),
    resolveDicomPathSources: async () => [],
    resolveDroppedDicomSources: async (drop) => {
      const uploadItems = await resolveWebDroppedUploadItems(drop)
      return uploadItems.length ? [{ kind: 'files', files: uploadItems }] : []
    }
  }
}

export const viewerRuntime: ViewerRuntimeApi =
  typeof window !== 'undefined' && window.viewerApi ? createDesktopRuntime() : createWebRuntime()
