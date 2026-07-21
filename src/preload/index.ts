import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'

let latestDroppedFilePaths: string[] = []
let pendingOpenFilePaths: string[] = []

function resolveDroppedFilePaths(event: DragEvent): string[] {
  return Array.from(event.dataTransfer?.files ?? []).flatMap((file) => {
    try {
      const path = webUtils.getPathForFile(file).trim()
      return path ? [path] : []
    } catch {
      return []
    }
  })
}

window.addEventListener(
  'drop',
  (event) => {
    const types = Array.from(event.dataTransfer?.types ?? [])
    if (!types.includes('Files')) {
      return
    }

    latestDroppedFilePaths = resolveDroppedFilePaths(event)
  },
  true
)

contextBridge.exposeInMainWorld('viewerApi', {
  chooseFolder: (mode?: 'files' | 'folder' | 'archive'): Promise<string[] | null> => ipcRenderer.invoke('viewer:choose-folder', mode),
  chooseExportDirectory: (): Promise<string | null> => ipcRenderer.invoke('viewer:choose-export-directory'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('viewer:close-window'),
  consumeLatestDroppedFilePaths: (): string[] => {
    const paths = latestDroppedFilePaths
    latestDroppedFilePaths = []
    return paths
  },
  consumePendingOpenFilePaths: (): string[] => {
    const paths = pendingOpenFilePaths
    pendingOpenFilePaths = []
    return paths
  },
  getBackendOrigin: (): Promise<string> => ipcRenderer.invoke('viewer:get-backend-origin'),
  getBackendStatus: (): Promise<unknown> => ipcRenderer.invoke('viewer:get-backend-status'),
  getDefaultExportDirectory: (): Promise<string> => ipcRenderer.invoke('viewer:get-default-export-directory'),
  getStartupStatusToast: (): Promise<unknown | null> => ipcRenderer.invoke('viewer:get-startup-status-toast'),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  loadUiPreferences: (): Promise<unknown | null> => ipcRenderer.invoke('viewer:load-ui-preferences'),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('viewer:minimize-window'),
  normalizeDroppedPaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('viewer:normalize-dropped-paths', paths),
  onBackendOriginChanged: (callback: (origin: string) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, origin: unknown): void => {
      if (typeof origin !== 'string') {
        return
      }
      const normalizedOrigin = origin.trim()
      if (normalizedOrigin) {
        callback(normalizedOrigin)
      }
    }
    ipcRenderer.on('viewer:backend-origin-changed', listener)
    return () => {
      ipcRenderer.off('viewer:backend-origin-changed', listener)
    }
  },
  onBackendStatusChanged: (callback: (payload: unknown) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: unknown): void => callback(payload)
    ipcRenderer.on('viewer:backend-status-changed', listener)
    return () => {
      ipcRenderer.off('viewer:backend-status-changed', listener)
    }
  },
  onOpenDicomPaths: (callback: (paths: string[]) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, paths: unknown): void => {
      if (!Array.isArray(paths)) {
        return
      }
      const normalizedPaths = paths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
      if (!normalizedPaths.length) {
        return
      }
      const delivered = new Set(normalizedPaths)
      pendingOpenFilePaths = pendingOpenFilePaths.filter((path) => !delivered.has(path))
      callback(normalizedPaths)
    }
    ipcRenderer.on('viewer:open-dicom-paths', listener)
    return () => {
      ipcRenderer.off('viewer:open-dicom-paths', listener)
    }
  },
  onStatusToast: (callback: (payload: unknown) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: unknown): void => callback(payload)
    ipcRenderer.on('viewer:status-toast', listener)
    return () => {
      ipcRenderer.off('viewer:status-toast', listener)
    }
  },
  openExportLocation: (payload: { directoryPath?: string | null; filePath?: string | null }): Promise<boolean> =>
    ipcRenderer.invoke('viewer:open-export-location', payload),
  openPathInFileManager: (payload: { path?: string | null }): Promise<boolean> =>
    ipcRenderer.invoke('viewer:open-path-in-file-manager', payload),
  saveExportFile: (payload: { fileName: string; directoryPath?: string | null; data: Uint8Array | number[] }): Promise<{ directoryPath: string; filePath: string }> =>
    ipcRenderer.invoke('viewer:save-export-file', payload),
  saveUiPreferences: (payload: unknown): Promise<void> => ipcRenderer.invoke('viewer:save-ui-preferences', payload),
  toggleWindowFullScreen: (): Promise<boolean> => ipcRenderer.invoke('viewer:toggle-window-fullscreen')
})

ipcRenderer.on('viewer:open-dicom-paths', (_event, paths: unknown) => {
  if (!Array.isArray(paths)) {
    return
  }

  const normalizedPaths = paths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
  pendingOpenFilePaths = [...pendingOpenFilePaths, ...normalizedPaths]
})
