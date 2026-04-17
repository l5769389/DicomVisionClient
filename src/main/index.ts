import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { APP_BACKEND_CONFIG, DESKTOP_DEV_BACKEND_ORIGIN, buildHttpOrigin } from '../shared/appConfig'

const DEFAULT_BACKEND_HOST = APP_BACKEND_CONFIG.desktop.devHost
const DEFAULT_BACKEND_PORT = APP_BACKEND_CONFIG.desktop.devPort
const DEFAULT_BACKEND_ORIGIN = DESKTOP_DEV_BACKEND_ORIGIN
const BACKEND_READY_TIMEOUT_MS = 20000
const BACKEND_READY_POLL_INTERVAL_MS = 400

let backendOrigin = process.env.DICOM_VISION_SERVER_ORIGIN?.trim() || DEFAULT_BACKEND_ORIGIN
let backendProcess: ChildProcessWithoutNullStreams | null = null

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
  if (app.isPackaged) {
    const executablePath = join(process.resourcesPath, 'server', 'DicomVisionServer.exe')
    if (existsSync(executablePath)) {
      return {
        command: executablePath,
        args: [],
        cwd: join(process.resourcesPath, 'server')
      }
    }
    return null
  }

  const serverRoot = join(process.cwd(), '..', 'DicomVisionServer')
  const pythonPath = join(serverRoot, '.venv', 'Scripts', 'python.exe')
  const runPath = join(serverRoot, 'run.py')
  if (!existsSync(serverRoot) || !existsSync(pythonPath) || !existsSync(runPath)) {
    return null
  }

  return {
    command: pythonPath,
    args: [runPath],
    cwd: serverRoot
  }
}

function resolveBackendLogPath(): string {
  const logDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logDir, { recursive: true })
  return join(logDir, 'backend.log')
}

function resolveUiPreferencesPath(): string {
  const preferencesDir = join(app.getPath('userData'), 'preferences')
  mkdirSync(preferencesDir, { recursive: true })
  return join(preferencesDir, 'ui-preferences.json')
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
  if (await isBackendReady(backendOrigin)) {
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
    icon: resolveAppIconPath(),
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.dicomvision.client')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('viewer:choose-folder', async () => {
    const currentWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined
    const result = currentWindow
      ? await dialog.showOpenDialog(currentWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('viewer:get-backend-origin', () => backendOrigin)
  ipcMain.handle('viewer:load-ui-preferences', () => loadUiPreferences())
  ipcMain.handle('viewer:save-ui-preferences', (_, payload: unknown) => saveUiPreferences(payload))

  void ensureBackendRunning()
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to start embedded backend service.'
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Backend Startup Failed',
        message
      })
    })
    .finally(() => {
      createWindow()
    })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopBackendProcess()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackendProcess()
})
