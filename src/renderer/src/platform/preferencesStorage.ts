import { viewerRuntime } from './runtime'

const WEB_STORAGE_KEY = 'dicomvision-ui-preferences'

export async function loadUiPreferencesFromStorage(): Promise<unknown | null> {
  if (viewerRuntime.platform === 'desktop') {
    return window.viewerApi?.loadUiPreferences?.() ?? null
  }

  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(WEB_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch (error) {
    console.error('Failed to load UI preferences from web storage.', error)
    return null
  }
}

export async function saveUiPreferencesToStorage(payload: unknown): Promise<void> {
  if (viewerRuntime.platform === 'desktop') {
    await window.viewerApi?.saveUiPreferences?.(payload)
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(payload))
}
