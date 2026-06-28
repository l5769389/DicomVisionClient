import { computed, readonly, ref, shallowRef } from 'vue'

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

type StandaloneNavigator = Navigator & {
  standalone?: boolean
}

const deferredPrompt = shallowRef<BeforeInstallPromptEvent | null>(null)
const installedState = ref(false)

let isInitialized = false
let displayModeQuery: MediaQueryList | null = null
let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

export const isInstalled = readonly(installedState)
export const canInstall = computed(() => Boolean(deferredPrompt.value) && !installedState.value)

function hasDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.viewerApi)
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const standaloneNavigator = window.navigator as StandaloneNavigator
  return Boolean(
    standaloneNavigator.standalone ||
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches
  )
}

function updateInstalledState(): void {
  installedState.value = isStandaloneDisplayMode()
  if (installedState.value) {
    deferredPrompt.value = null
  }
}

function handleBeforeInstallPrompt(event: Event): void {
  if (hasDesktopRuntime() || installedState.value) {
    return
  }

  const promptEvent = event as BeforeInstallPromptEvent
  if (typeof promptEvent.prompt !== 'function' || !promptEvent.userChoice) {
    return
  }

  event.preventDefault()
  deferredPrompt.value = promptEvent
}

function handleAppInstalled(): void {
  deferredPrompt.value = null
  installedState.value = true
}

function handleDisplayModeChange(): void {
  updateInstalledState()
}

function addDisplayModeListener(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  displayModeQuery = window.matchMedia('(display-mode: standalone)')
  if (typeof displayModeQuery.addEventListener === 'function') {
    displayModeQuery.addEventListener('change', handleDisplayModeChange)
  } else {
    displayModeQuery.addListener(handleDisplayModeChange)
  }
}

function removeDisplayModeListener(): void {
  if (!displayModeQuery) {
    return
  }

  if (typeof displayModeQuery.removeEventListener === 'function') {
    displayModeQuery.removeEventListener('change', handleDisplayModeChange)
  } else {
    displayModeQuery.removeListener(handleDisplayModeChange)
  }
  displayModeQuery = null
}

export function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (
    typeof window === 'undefined' ||
    hasDesktopRuntime() ||
    !import.meta.env.PROD ||
    !('serviceWorker' in navigator)
  ) {
    return Promise.resolve(null)
  }

  serviceWorkerRegistrationPromise ??= navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.warn('Failed to register DicomVision service worker.', error)
    return null
  })
  return serviceWorkerRegistrationPromise
}

export function initializePwaInstall(): void {
  if (typeof window === 'undefined' || isInitialized) {
    return
  }

  isInitialized = true
  updateInstalledState()

  if (hasDesktopRuntime()) {
    return
  }

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
  addDisplayModeListener()
  void registerPwaServiceWorker()
}

export async function promptInstall(): Promise<PwaInstallOutcome> {
  const promptEvent = deferredPrompt.value
  if (!promptEvent || installedState.value) {
    return 'unavailable'
  }

  deferredPrompt.value = null
  await promptEvent.prompt()
  const choice = await promptEvent.userChoice.catch(() => null)
  return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'
}

export function resetPwaInstallStateForTests(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.removeEventListener('appinstalled', handleAppInstalled)
  }
  removeDisplayModeListener()
  deferredPrompt.value = null
  installedState.value = false
  isInitialized = false
  serviceWorkerRegistrationPromise = null
}
