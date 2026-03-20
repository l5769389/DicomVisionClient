import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('viewerApi', {
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke('viewer:choose-folder')
})
