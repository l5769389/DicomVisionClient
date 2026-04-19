import { viewerRuntime } from './runtime'
import type { ExportPreference } from '../composables/ui/useUiPreferences'

const WEB_EXPORT_DB_NAME = 'dicomvision-export-storage'
const WEB_EXPORT_STORE = 'handles'
const WEB_EXPORT_DIRECTORY_KEY = 'export-directory'

type WebDirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }

function supportsWebDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && typeof (window as WebDirectoryPickerWindow).showDirectoryPicker === 'function'
}

function openExportDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(WEB_EXPORT_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(WEB_EXPORT_STORE)) {
        database.createObjectStore(WEB_EXPORT_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open export storage.'))
  })
}

async function readStoredWebExportDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window === 'undefined' || !window.indexedDB || !supportsWebDirectoryPicker()) {
    return null
  }

  const database = await openExportDatabase()
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(WEB_EXPORT_STORE, 'readonly')
    const store = transaction.objectStore(WEB_EXPORT_STORE)
    const request = store.get(WEB_EXPORT_DIRECTORY_KEY)
    request.onsuccess = () => {
      resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null)
      database.close()
    }
    request.onerror = () => {
      reject(request.error ?? new Error('Failed to read export directory handle.'))
      database.close()
    }
  })
}

async function writeStoredWebExportDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  const database = await openExportDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WEB_EXPORT_STORE, 'readwrite')
    transaction.objectStore(WEB_EXPORT_STORE).put(handle, WEB_EXPORT_DIRECTORY_KEY)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Failed to store export directory handle.'))
    }
  })
}

export async function clearStoredWebExportDirectory(): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return
  }

  const database = await openExportDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WEB_EXPORT_STORE, 'readwrite')
    transaction.objectStore(WEB_EXPORT_STORE).delete(WEB_EXPORT_DIRECTORY_KEY)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Failed to clear export directory handle.'))
    }
  })
}

export function canChooseCustomExportDirectory(): boolean {
  return viewerRuntime.platform === 'desktop' || supportsWebDirectoryPicker()
}

export async function getDefaultExportLocationLabel(): Promise<string> {
  if (viewerRuntime.platform === 'desktop') {
    return window.viewerApi?.getDefaultExportDirectory?.() ?? 'Downloads'
  }

  return 'Browser default downloads'
}

export async function chooseCustomExportDirectory(): Promise<{ desktopDirectory?: string | null; webDirectoryName?: string | null } | null> {
  if (viewerRuntime.platform === 'desktop') {
    const directory = await window.viewerApi?.chooseExportDirectory?.()
    return directory ? { desktopDirectory: directory } : null
  }

  if (!supportsWebDirectoryPicker()) {
    return null
  }

  const handle = await (window as WebDirectoryPickerWindow).showDirectoryPicker?.({ mode: 'readwrite' })
  if (!handle) {
    return null
  }
  await writeStoredWebExportDirectory(handle)
  return { webDirectoryName: handle.name }
}

function triggerBrowserDownload(fileName: string, data: Uint8Array, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

async function ensureWebExportDirectoryPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const currentPermission = await handle.queryPermission({ mode: 'readwrite' })
  if (currentPermission === 'granted') {
    return true
  }

  const requestedPermission = await handle.requestPermission({ mode: 'readwrite' })
  return requestedPermission === 'granted'
}

export async function saveExportedFile(params: {
  data: Uint8Array
  exportPreference: ExportPreference
  fileName: string
  mimeType: string
}): Promise<{ locationDescription: string | null; mode: 'filesystem' | 'download' }> {
  if (viewerRuntime.platform === 'desktop') {
    const savedPath =
      (await window.viewerApi?.saveExportFile?.({
        fileName: params.fileName,
        directoryPath: params.exportPreference.locationMode === 'custom' ? params.exportPreference.desktopDirectory : null,
        data: params.data
      })) ?? null
    return {
      locationDescription: savedPath,
      mode: 'filesystem'
    }
  }

  if (params.exportPreference.locationMode === 'custom') {
    const directoryHandle = await readStoredWebExportDirectory()
    if (directoryHandle && (await ensureWebExportDirectoryPermission(directoryHandle))) {
      const fileHandle = await directoryHandle.getFileHandle(params.fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(params.data)
      await writable.close()
      return {
        locationDescription: `${directoryHandle.name}/${params.fileName}`,
        mode: 'filesystem'
      }
    }
  }

  triggerBrowserDownload(params.fileName, params.data, params.mimeType)
  return {
    locationDescription: null,
    mode: 'download'
  }
}
