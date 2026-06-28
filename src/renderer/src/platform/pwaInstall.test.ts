import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canInstall,
  initializePwaInstall,
  isInstalled,
  promptInstall,
  resetPwaInstallStateForTests,
  type BeforeInstallPromptEvent
} from './pwaInstall'

const originalMatchMedia = window.matchMedia

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
})
