import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'

let latestDroppedFilePaths: string[] = []

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
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke('viewer:choose-folder'),
  chooseExportDirectory: (): Promise<string | null> => ipcRenderer.invoke('viewer:choose-export-directory'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('viewer:close-window'),
  consumeLatestDroppedFilePaths: (): string[] => {
    const paths = latestDroppedFilePaths
    latestDroppedFilePaths = []
    return paths
  },
  getBackendOrigin: (): Promise<string> => ipcRenderer.invoke('viewer:get-backend-origin'),
  getDefaultExportDirectory: (): Promise<string> => ipcRenderer.invoke('viewer:get-default-export-directory'),
  getStartupStatusToast: (): Promise<unknown | null> => ipcRenderer.invoke('viewer:get-startup-status-toast'),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  loadUiPreferences: (): Promise<unknown | null> => ipcRenderer.invoke('viewer:load-ui-preferences'),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('viewer:minimize-window'),
  normalizeDroppedPaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('viewer:normalize-dropped-paths', paths),
  onStatusToast: (callback: (payload: unknown) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: unknown): void => callback(payload)
    ipcRenderer.on('viewer:status-toast', listener)
    return () => {
      ipcRenderer.off('viewer:status-toast', listener)
    }
  },
  openExportLocation: (payload: { directoryPath?: string | null; filePath?: string | null }): Promise<boolean> =>
    ipcRenderer.invoke('viewer:open-export-location', payload),
  saveExportFile: (payload: { fileName: string; directoryPath?: string | null; data: Uint8Array | number[] }): Promise<{ directoryPath: string; filePath: string }> =>
    ipcRenderer.invoke('viewer:save-export-file', payload),
  saveUiPreferences: (payload: unknown): Promise<void> => ipcRenderer.invoke('viewer:save-ui-preferences', payload),
  toggleWindowFullScreen: (): Promise<boolean> => ipcRenderer.invoke('viewer:toggle-window-fullscreen')
})
