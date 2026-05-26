import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, extname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { APP_BACKEND_CONFIG, DESKTOP_DEV_BACKEND_ORIGIN, buildHttpOrigin } from '../shared/appConfig'

const DEFAULT_BACKEND_HOST = APP_BACKEND_CONFIG.desktop.devHost
const DEFAULT_BACKEND_PORT = APP_BACKEND_CONFIG.desktop.devPort
const DEFAULT_BACKEND_ORIGIN = DESKTOP_DEV_BACKEND_ORIGIN
const BACKEND_READY_TIMEOUT_MS = 20000
const BACKEND_READY_POLL_INTERVAL_MS = 400

type RendererStatusToastTone = 'info' | 'success' | 'warning' | 'error'

interface RendererStatusToastPayload {
  id: string
  message: string
  tone: RendererStatusToastTone
  detail?: string | null
  durationMs?: number
}

let backendOrigin = process.env.DICOM_VISION_SERVER_ORIGIN?.trim() || DEFAULT_BACKEND_ORIGIN
let backendProcess: ChildProcessWithoutNullStreams | null = null
let pendingStartupStatusToast: RendererStatusToastPayload | null = null
let pendingOpenFilePaths: string[] = []
let backendReady = false

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

function buildBackendOrigin(host: string, port: number): string {
  return buildHttpOrigin(host, port)
}

function resolvePreloadPath(): string {
  const mjsPath = join(__dirname, '../preload/index.mjs')
  if (existsSync(mjsPath)) {
    return mjsPath
  }

  return join(__dirname, '../preload/index.js')
}

function resolveAppIconPath(): string | undefined {
  const iconFileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const candidates = [
    join(process.cwd(), 'build', iconFileName),
    join(app.getAppPath(), 'build', iconFileName),
    join(process.resourcesPath, 'build', iconFileName),
    join(process.resourcesPath, iconFileName)
  ]

  return candidates.find((candidate) => existsSync(candidate))
}

function resolveServerLaunchConfig():
  | {
      command: string
      args: string[]
      cwd: string
    }
  | null {
  if (!app.isPackaged) {
    return null
  }

  const serverResourcePath = join(process.resourcesPath, 'server')
  const executableNames =
    process.platform === 'win32'
      ? ['DicomVisionServer.exe']
      : ['DicomVisionServer', 'DicomVisionServer.exe']
  const executablePath = executableNames
    .map((fileName) => join(serverResourcePath, fileName))
    .find((candidate) => existsSync(candidate))

  if (!executablePath) {
    return null
  }

  return {
    command: executablePath,
    args: [],
    cwd: serverResourcePath
  }
}

function resolveBackendLogPath(): string {
  const logDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logDir, { recursive: true })
  return join(logDir, 'backend.log')
}

function resolveUiPreferencesPath(): string {
  const userDataPath = app.getPath('userData')
  const preferredDir = join(userDataPath, 'preferences')

  if (existsSync(preferredDir)) {
    if (statSync(preferredDir).isDirectory()) {
      return join(preferredDir, 'ui-preferences.json')
    }

    const fallbackDir = join(userDataPath, 'preferences-store')
    mkdirSync(fallbackDir, { recursive: true })
    return join(fallbackDir, 'ui-preferences.json')
  }

  mkdirSync(preferredDir, { recursive: true })
  return join(preferredDir, 'ui-preferences.json')
}

function resolveDefaultExportDirectory(): string {
  try {
    return app.getPath('downloads')
  } catch {
    return app.getPath('documents')
  }
}

function resolveUniqueExportPath(directoryPath: string, fileName: string): string {
  const extension = extname(fileName)
  const stem = extension ? fileName.slice(0, -extension.length) : fileName
  let candidatePath = join(directoryPath, fileName)
  let suffix = 1

  while (existsSync(candidatePath)) {
    candidatePath = join(directoryPath, `${stem}-${suffix}${extension}`)
    suffix += 1
  }

  return candidatePath
}

function resolveBackendStartupFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return app.isPackaged
    ? 'Failed to start embedded backend service.'
    : 'Desktop dev mode requires a separately running backend service.'
}

function publishRendererStatusToast(payload: RendererStatusToastPayload): void {
  pendingStartupStatusToast = payload
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('viewer:status-toast', payload)
    }
  })
}

function publishBackendOriginChanged(): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('viewer:backend-origin-changed', backendOrigin)
    }
  })
}

function markBackendReady(): void {
  backendReady = true
  publishBackendOriginChanged()
  flushPendingOpenFilePaths()
}

function getOpenFileArgStartIndex(): number {
  return app.isPackaged ? 1 : 2
}

function collectOpenFileArgs(argv: string[]): string[] {
  return normalizeDroppedDicomPaths(
    argv
      .slice(getOpenFileArgStartIndex())
      .map((argument) => argument.trim())
      .filter((argument) => argument && !argument.startsWith('-'))
  )
}

function enqueueOpenFilePaths(paths: string[]): void {
  const normalizedPaths = normalizeDroppedDicomPaths(paths)
  if (!normalizedPaths.length) {
    return
  }

  const seen = new Set(pendingOpenFilePaths.map((path) => (process.platform === 'win32' ? path.toLowerCase() : path)))
  for (const path of normalizedPaths) {
    const dedupeKey = process.platform === 'win32' ? path.toLowerCase() : path
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)
    pendingOpenFilePaths.push(path)
  }

  flushPendingOpenFilePaths()
}

function flushPendingOpenFilePaths(): void {
  if (!backendReady || !pendingOpenFilePaths.length) {
    return
  }

  const targetWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed() && !window.webContents.isLoading())
  if (!targetWindow) {
    return
  }

  const paths = pendingOpenFilePaths
  pendingOpenFilePaths = []
  targetWindow.webContents.send('viewer:open-dicom-paths', paths)
}

function focusExistingWindow(): void {
  const targetWindow = BrowserWindow.getAllWindows()[0]
  if (!targetWindow || targetWindow.isDestroyed()) {
    createWindow()
    return
  }

  if (targetWindow.isMinimized()) {
    targetWindow.restore()
  }
  targetWindow.show()
  targetWindow.focus()
}

async function loadUiPreferences(): Promise<unknown | null> {
  try {
    const fileContent = await readFile(resolveUiPreferencesPath(), 'utf-8')
    return JSON.parse(fileContent) as unknown
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

async function saveUiPreferences(payload: unknown): Promise<void> {
  await writeFile(resolveUiPreferencesPath(), JSON.stringify(payload, null, 2), 'utf-8')
}

function getWindowFromIpcEvent(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined
}

function normalizeDroppedDicomPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) {
    return []
  }

  const normalizedPaths: string[] = []
  const seen = new Set<string>()
  for (const rawPath of paths) {
    if (typeof rawPath !== 'string') {
      continue
    }

    const candidatePath = rawPath.trim()
    if (!candidatePath) {
      continue
    }

    try {
      const candidateStats = statSync(candidatePath)
      if (!candidateStats.isDirectory() && !candidateStats.isFile()) {
        continue
      }

      const dedupeKey = process.platform === 'win32' ? candidatePath.toLowerCase() : candidatePath
      if (seen.has(dedupeKey)) {
        continue
      }
      seen.add(dedupeKey)
      normalizedPaths.push(candidatePath)
    } catch {
      continue
    }
  }

  return normalizedPaths
}

function pipeBackendLogs(processHandle: ChildProcessWithoutNullStreams): void {
  const logStream = createWriteStream(resolveBackendLogPath(), { flags: 'a' })
  processHandle.stdout.pipe(logStream)
  processHandle.stderr.pipe(logStream)
}

async function findAvailablePort(host: string): Promise<number> {
  const port = await new Promise<number>((resolve, reject) => {
    const probe = createServer()

    probe.once('error', reject)
    probe.listen(0, host, () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Failed to resolve an available backend port.')))
        return
      }

      const resolvedPort = address.port
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }

        resolve(resolvedPort)
      })
    })
  })

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Failed to allocate an available backend port.')
  }

  return port
}

async function resolveEmbeddedBackendPort(): Promise<number> {
  if (!app.isPackaged) {
    return DEFAULT_BACKEND_PORT
  }

  return findAvailablePort(DEFAULT_BACKEND_HOST)
}

async function isBackendReady(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/health`)
    return response.ok
  } catch {
    return false
  }
}

async function waitForBackendReady(origin: string, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendReady(origin)) {
      return true
    }
    await delay(BACKEND_READY_POLL_INTERVAL_MS)
  }

  return false
}

async function ensureBackendRunning(): Promise<void> {
  if (!app.isPackaged) {
    if (await isBackendReady(backendOrigin)) {
      markBackendReady()
      return
    }

    throw new Error(
      `Desktop dev mode requires an external backend service. Start the backend separately and ensure ${backendOrigin} is reachable.`
    )
  }

  if (await isBackendReady(backendOrigin)) {
    markBackendReady()
    return
  }

  const launchConfig = resolveServerLaunchConfig()
  if (!launchConfig) {
    return
  }

  const startupAttempts = app.isPackaged ? 3 : 1
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= startupAttempts; attempt += 1) {
    const backendPort = await resolveEmbeddedBackendPort()
    const nextBackendOrigin = buildBackendOrigin(DEFAULT_BACKEND_HOST, backendPort)
    backendOrigin = nextBackendOrigin

    backendProcess = spawn(launchConfig.command, launchConfig.args, {
      cwd: launchConfig.cwd,
      env: {
        ...process.env,
        APP_ENV: 'production',
        APP_HOST: DEFAULT_BACKEND_HOST,
        APP_PORT: String(backendPort)
      },
      stdio: 'pipe',
      windowsHide: true
    })
    pipeBackendLogs(backendProcess)

    const ready = await waitForBackendReady(nextBackendOrigin, BACKEND_READY_TIMEOUT_MS)
    if (ready) {
      markBackendReady()
      return
    }

    const exitCode = backendProcess.exitCode
    backendProcess.kill()
    backendProcess = null
    lastError =
      exitCode == null
        ? new Error(`Timed out waiting for backend at ${nextBackendOrigin}`)
        : new Error(`Backend exited before becoming ready. Exit code: ${exitCode}`)
  }

  throw lastError ?? new Error('Failed to start embedded backend service.')
}

function stopBackendProcess(): void {
  if (!backendProcess || backendProcess.killed) {
    backendProcess = null
    return
  }

  backendProcess.kill()
  backendProcess = null
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1280,
    minHeight: 800,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#07111b',
    icon: resolveAppIconPath(),
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.on('did-finish-load', () => {
    flushPendingOpenFilePaths()
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.on('second-instance', (_event, argv) => {
  if (!hasSingleInstanceLock) {
    return
  }

  focusExistingWindow()
  enqueueOpenFilePaths(collectOpenFileArgs(argv))
})

app.on('open-file', (event, path) => {
  event.preventDefault()
  enqueueOpenFilePaths([path])
})

if (hasSingleInstanceLock) {
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.dicomvision.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('viewer:minimize-window', (event) => {
    getWindowFromIpcEvent(event)?.minimize()
  })

  ipcMain.handle('viewer:toggle-window-fullscreen', (event) => {
    const currentWindow = getWindowFromIpcEvent(event)
    if (!currentWindow) {
      return false
    }

    currentWindow.setFullScreen(!currentWindow.isFullScreen())
    return currentWindow.isFullScreen()
  })

  ipcMain.handle('viewer:close-window', (event) => {
    getWindowFromIpcEvent(event)?.close()
  })

  ipcMain.handle('viewer:normalize-dropped-paths', (_event, paths: unknown) => normalizeDroppedDicomPaths(paths))

  ipcMain.handle('viewer:choose-folder', async (event) => {
    const currentWindow = getWindowFromIpcEvent(event)
    const result = currentWindow
      ? await dialog.showOpenDialog(currentWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('viewer:choose-export-directory', async (event) => {
    const currentWindow = getWindowFromIpcEvent(event)
    const result = currentWindow
      ? await dialog.showOpenDialog(currentWindow, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('viewer:get-backend-origin', () => backendOrigin)
  ipcMain.handle('viewer:get-default-export-directory', () => resolveDefaultExportDirectory())
  ipcMain.handle('viewer:get-startup-status-toast', () => pendingStartupStatusToast)
  ipcMain.handle(
    'viewer:save-export-file',
    async (
      _,
      payload: {
        data: Uint8Array | number[]
        directoryPath?: string | null
        fileName: string
      }
    ) => {
      const targetDirectory = payload.directoryPath?.trim() || resolveDefaultExportDirectory()
      const safeFileName = (payload.fileName || 'dicomvision-export')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .trim()
      mkdirSync(targetDirectory, { recursive: true })
      const targetPath = resolveUniqueExportPath(targetDirectory, safeFileName || 'dicomvision-export')
      await writeFile(targetPath, Buffer.from(payload.data))
      return {
        directoryPath: dirname(targetPath),
        filePath: targetPath
      }
    }
  )
  ipcMain.handle(
    'viewer:open-export-location',
    async (
      _,
      payload: {
        directoryPath?: string | null
        filePath?: string | null
      }
    ) => {
      const filePath = payload.filePath?.trim()
      if (filePath) {
        shell.showItemInFolder(filePath)
        return true
      }

      const directoryPath = payload.directoryPath?.trim()
      if (!directoryPath) {
        return false
      }

      const result = await shell.openPath(directoryPath)
      return result === ''
    }
  )
  ipcMain.handle('viewer:load-ui-preferences', () => loadUiPreferences())
  ipcMain.handle('viewer:save-ui-preferences', (_, payload: unknown) => saveUiPreferences(payload))

  createWindow()
  enqueueOpenFilePaths(collectOpenFileArgs(process.argv))

  void ensureBackendRunning()
    .catch((error: unknown) => {
      const message = resolveBackendStartupFailureMessage(error)
      const detail = app.isPackaged
        ? `${message} Log: ${resolveBackendLogPath()}`
        : `${message} Backend: ${backendOrigin}`
      publishRendererStatusToast({
        id: 'backend-startup-failed',
        message: app.isPackaged ? 'Backend service failed to start' : 'Backend service is not connected',
        tone: 'warning',
        detail,
        durationMs: 0
      })
    })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})
}

app.on('window-all-closed', () => {
  stopBackendProcess()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackendProcess()
})
