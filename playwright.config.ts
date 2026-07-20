import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const clientRoot = dirname(fileURLToPath(import.meta.url))
const serverRoot = resolve(clientRoot, '../DicomVisionServer')
const sampleDicomPath = resolve(clientRoot, 'test-results/e2e-dicom-series')
const prepareDicomFixtureScript = resolve(clientRoot, 'e2e/prepare-dicom-fixture.mjs')
const e2eBackendPort = 18080
const e2eWebPort = 14173
const e2eBackendOrigin = `http://127.0.0.1:${e2eBackendPort}`
const e2eWebOrigin = `http://127.0.0.1:${e2eWebPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: e2eWebOrigin,
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off'
  },
  projects: [
    {
      name: 'web-chrome',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] }
    }
  ],
  webServer: [
    {
      command: `"${process.execPath}" "${prepareDicomFixtureScript}" && "${resolve(serverRoot, '.venv/bin/python')}" -m uvicorn app.main:app --host 127.0.0.1 --port ${e2eBackendPort} --lifespan off`,
      cwd: serverRoot,
      env: {
        ...process.env,
        LOG_LEVEL: 'WARNING',
        VTK_RENDER_PROCESS_ENABLED: 'false',
        WEB_SAMPLE_DICOM_PATH: sampleDicomPath
      },
      url: `${e2eBackendOrigin}/health`,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: `npm run dev:web -- --host 127.0.0.1 --port ${e2eWebPort}`,
      cwd: clientRoot,
      env: {
        ...process.env,
        VITE_BACKEND_ORIGIN: e2eBackendOrigin,
        VITE_MOBILE_SAMPLE_MODE: 'server-sample',
        VITE_WEB_APP_MODE: 'demo-web',
        VITE_WEB_USE_SERVER_SAMPLE: 'true'
      },
      url: e2eWebOrigin,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})
