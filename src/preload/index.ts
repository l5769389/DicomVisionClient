import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('viewerApi', {
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke('viewer:choose-folder'),
  chooseExportDirectory: (): Promise<string | null> => ipcRenderer.invoke('viewer:choose-export-directory'),
  getBackendOrigin: (): Promise<string> => ipcRenderer.invoke('viewer:get-backend-origin'),
  getDefaultExportDirectory: (): Promise<string> => ipcRenderer.invoke('viewer:get-default-export-directory'),
  loadUiPreferences: (): Promise<unknown | null> => ipcRenderer.invoke('viewer:load-ui-preferences'),
  saveExportFile: (payload: { fileName: string; directoryPath?: string | null; data: Uint8Array | number[] }): Promise<string> =>
    ipcRenderer.invoke('viewer:save-export-file', payload),
  saveUiPreferences: (payload: unknown): Promise<void> => ipcRenderer.invoke('viewer:save-ui-preferences', payload)
})
