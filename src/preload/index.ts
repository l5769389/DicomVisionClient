import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('viewerApi', {
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke('viewer:choose-folder'),
  getBackendOrigin: (): Promise<string> => ipcRenderer.invoke('viewer:get-backend-origin'),
  loadUiPreferences: (): Promise<unknown | null> => ipcRenderer.invoke('viewer:load-ui-preferences'),
  saveUiPreferences: (payload: unknown): Promise<void> => ipcRenderer.invoke('viewer:save-ui-preferences', payload)
})
