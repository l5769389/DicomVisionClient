import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canInstall,
  initializePwaInstall,
  isInstalled,
  promptInstall,
  registerPwaServiceWorker,
  resetPwaInstallStateForTests,
  type BeforeInstallPromptEvent
} from './pwaInstall'

const originalMatchMedia = window.matchMedia
const originalCaches = window.caches
const originalServiceWorker = navigator.serviceWorker

function restoreMatchMedia(): void {
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    })
    return
  }
  Reflect.deleteProperty(window, 'matchMedia')
}

function restoreBrowserInstallGlobals(): void {
  if (originalServiceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: originalServiceWorker
    })
  } else {
    Reflect.deleteProperty(navigator, 'serviceWorker')
  }

  if (originalCaches) {
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: originalCaches
    })
  } else {
    Reflect.deleteProperty(window, 'caches')
  }
}

function mockDisplayMode(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

function createBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): {
  event: BeforeInstallPromptEvent
  promptMock: ReturnType<typeof vi.fn>
} {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent
  const promptMock = vi.fn(() => Promise.resolve())
  Object.defineProperties(event, {
    platforms: { value: ['web'] },
    prompt: { value: promptMock },
    userChoice: { value: Promise.resolve({ outcome, platform: 'web' }) }
  })
  return { event, promptMock }
}

beforeEach(() => {
  resetPwaInstallStateForTests()
  mockDisplayMode(false)
})

afterEach(() => {
  resetPwaInstallStateForTests()
  restoreMatchMedia()
  restoreBrowserInstallGlobals()
  vi.restoreAllMocks()
})

describe('pwaInstall', () => {
  it('captures beforeinstallprompt and prompts the browser install flow', async () => {
    initializePwaInstall()
    const { event, promptMock } = createBeforeInstallPromptEvent('accepted')
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
    expect(canInstall.value).toBe(true)

    await expect(promptInstall()).resolves.toBe('accepted')
    expect(promptMock).toHaveBeenCalledTimes(1)
    expect(canInstall.value).toBe(false)
  })

  it('marks the app installed when the browser emits appinstalled', () => {
    initializePwaInstall()
    const { event } = createBeforeInstallPromptEvent('dismissed')

    window.dispatchEvent(event)
    expect(canInstall.value).toBe(true)

    window.dispatchEvent(new Event('appinstalled'))

    expect(isInstalled.value).toBe(true)
    expect(canInstall.value).toBe(false)
  })

  it('treats standalone display mode as already installed', () => {
    mockDisplayMode(true)

    initializePwaInstall()
    const { event } = createBeforeInstallPromptEvent('accepted')
    window.dispatchEvent(event)

    expect(isInstalled.value).toBe(true)
    expect(canInstall.value).toBe(false)
  })

  it('clears stale DicomVision service workers and caches in development mode', async () => {
    const unregister = vi.fn(() => Promise.resolve(true))
    const getRegistrations = vi.fn(() => Promise.resolve([{ unregister }]))
    const keys = vi.fn(() => Promise.resolve(['dicomvision-web-shell-v1', 'third-party-cache']))
    const deleteCache = vi.fn(() => Promise.resolve(true))

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations }
    })
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys, delete: deleteCache }
    })

    await expect(registerPwaServiceWorker()).resolves.toBeNull()

    expect(getRegistrations).toHaveBeenCalledTimes(1)
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(keys).toHaveBeenCalledTimes(1)
    expect(deleteCache).toHaveBeenCalledWith('dicomvision-web-shell-v1')
    expect(deleteCache).not.toHaveBeenCalledWith('third-party-cache')
  })
})
