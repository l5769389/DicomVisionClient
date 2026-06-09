import { computed, reactive } from 'vue'
import type { MprViewportKey } from '../../types/viewer'

export type MobileStackDefaultTool = 'scroll' | 'window' | 'pan' | 'zoom'
export type MobileMprDefaultTool = 'crosshair' | MobileStackDefaultTool
export type MobileGestureSensitivity = 'low' | 'normal' | 'high'
export type MobileStackPlaybackFps = 1 | 2 | 5 | 10 | 15 | 30
export type MobileOrientationLock = 'unlocked' | 'portrait' | 'landscape'

export interface MobileViewerPreferences {
  defaultShowCornerInfo: boolean
  defaultShowScaleBar: boolean
  gestureSensitivity: MobileGestureSensitivity
  mprDefaultTool: MobileMprDefaultTool
  mprDefaultViewport: MprViewportKey
  mprShowReferenceThumbnails: boolean
  orientationLock: MobileOrientationLock
  stackDefaultTool: MobileStackDefaultTool
  stackPlaybackFps: MobileStackPlaybackFps
}

export const MOBILE_STACK_PLAYBACK_FPS_OPTIONS = [1, 2, 5, 10, 15, 30] as const
export const MOBILE_GESTURE_SENSITIVITY_OPTIONS: MobileGestureSensitivity[] = ['low', 'normal', 'high']
export const MOBILE_ORIENTATION_LOCK_OPTIONS: MobileOrientationLock[] = ['unlocked', 'portrait', 'landscape']

const STORAGE_KEY = 'dicomvision-mobile-preferences'
const DEFAULT_PREFERENCES: MobileViewerPreferences = {
  defaultShowCornerInfo: true,
  defaultShowScaleBar: true,
  gestureSensitivity: 'normal',
  mprDefaultTool: 'crosshair',
  mprDefaultViewport: 'mpr-ax',
  mprShowReferenceThumbnails: true,
  orientationLock: 'unlocked',
  stackDefaultTool: 'scroll',
  stackPlaybackFps: 5
}

function isMprViewportKey(value: unknown): value is MprViewportKey {
  return value === 'mpr-ax' || value === 'mpr-cor' || value === 'mpr-sag'
}

function isStackDefaultTool(value: unknown): value is MobileStackDefaultTool {
  return value === 'scroll' || value === 'window' || value === 'pan' || value === 'zoom'
}

function isMprDefaultTool(value: unknown): value is MobileMprDefaultTool {
  return value === 'crosshair' || isStackDefaultTool(value)
}

function isGestureSensitivity(value: unknown): value is MobileGestureSensitivity {
  return value === 'low' || value === 'normal' || value === 'high'
}

function isStackPlaybackFps(value: unknown): value is MobileStackPlaybackFps {
  return MOBILE_STACK_PLAYBACK_FPS_OPTIONS.includes(value as MobileStackPlaybackFps)
}

function isOrientationLock(value: unknown): value is MobileOrientationLock {
  return value === 'unlocked' || value === 'portrait' || value === 'landscape'
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizePreferences(value: unknown): MobileViewerPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_PREFERENCES }
  }

  const raw = value as Partial<MobileViewerPreferences>
  return {
    defaultShowCornerInfo: normalizeBoolean(raw.defaultShowCornerInfo, DEFAULT_PREFERENCES.defaultShowCornerInfo),
    defaultShowScaleBar: normalizeBoolean(raw.defaultShowScaleBar, DEFAULT_PREFERENCES.defaultShowScaleBar),
    gestureSensitivity: isGestureSensitivity(raw.gestureSensitivity)
      ? raw.gestureSensitivity
      : DEFAULT_PREFERENCES.gestureSensitivity,
    mprDefaultTool: isMprDefaultTool(raw.mprDefaultTool) ? raw.mprDefaultTool : DEFAULT_PREFERENCES.mprDefaultTool,
    mprDefaultViewport: isMprViewportKey(raw.mprDefaultViewport)
      ? raw.mprDefaultViewport
      : DEFAULT_PREFERENCES.mprDefaultViewport,
    mprShowReferenceThumbnails: normalizeBoolean(
      raw.mprShowReferenceThumbnails,
      DEFAULT_PREFERENCES.mprShowReferenceThumbnails
    ),
    orientationLock: isOrientationLock(raw.orientationLock)
      ? raw.orientationLock
      : DEFAULT_PREFERENCES.orientationLock,
    stackDefaultTool: isStackDefaultTool(raw.stackDefaultTool)
      ? raw.stackDefaultTool
      : DEFAULT_PREFERENCES.stackDefaultTool,
    stackPlaybackFps: isStackPlaybackFps(raw.stackPlaybackFps)
      ? raw.stackPlaybackFps
      : DEFAULT_PREFERENCES.stackPlaybackFps
  }
}

function loadPreferences(): MobileViewerPreferences {
  const storage = readStorage()
  if (!storage) {
    return { ...DEFAULT_PREFERENCES }
  }

  try {
    return normalizePreferences(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}'))
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

const state = reactive<MobileViewerPreferences>(loadPreferences())

function persist(): void {
  const storage = readStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizePreferences(state)))
  } catch {
    // Keep the in-memory preference usable when localStorage is unavailable.
  }
}

export function useMobileViewerPreferences() {
  const defaultShowCornerInfo = computed({
    get: () => state.defaultShowCornerInfo,
    set: (value: boolean) => {
      state.defaultShowCornerInfo = Boolean(value)
      persist()
    }
  })
  const defaultShowScaleBar = computed({
    get: () => state.defaultShowScaleBar,
    set: (value: boolean) => {
      state.defaultShowScaleBar = Boolean(value)
      persist()
    }
  })
  const gestureSensitivity = computed({
    get: () => state.gestureSensitivity,
    set: (value: MobileGestureSensitivity) => {
      state.gestureSensitivity = isGestureSensitivity(value) ? value : DEFAULT_PREFERENCES.gestureSensitivity
      persist()
    }
  })
  const mprDefaultTool = computed({
    get: () => state.mprDefaultTool,
    set: (value: MobileMprDefaultTool) => {
      state.mprDefaultTool = isMprDefaultTool(value) ? value : DEFAULT_PREFERENCES.mprDefaultTool
      persist()
    }
  })
  const mprDefaultViewport = computed({
    get: () => state.mprDefaultViewport,
    set: (value: MprViewportKey) => {
      state.mprDefaultViewport = isMprViewportKey(value) ? value : DEFAULT_PREFERENCES.mprDefaultViewport
      persist()
    }
  })
  const mprShowReferenceThumbnails = computed({
    get: () => state.mprShowReferenceThumbnails,
    set: (value: boolean) => {
      state.mprShowReferenceThumbnails = Boolean(value)
      persist()
    }
  })
  const orientationLock = computed({
    get: () => state.orientationLock,
    set: (value: MobileOrientationLock) => {
      state.orientationLock = isOrientationLock(value) ? value : DEFAULT_PREFERENCES.orientationLock
      persist()
    }
  })
  const stackDefaultTool = computed({
    get: () => state.stackDefaultTool,
    set: (value: MobileStackDefaultTool) => {
      state.stackDefaultTool = isStackDefaultTool(value) ? value : DEFAULT_PREFERENCES.stackDefaultTool
      persist()
    }
  })
  const stackPlaybackFps = computed({
    get: () => state.stackPlaybackFps,
    set: (value: MobileStackPlaybackFps) => {
      state.stackPlaybackFps = isStackPlaybackFps(value) ? value : DEFAULT_PREFERENCES.stackPlaybackFps
      persist()
    }
  })

  function setDefaultShowCornerInfo(value: boolean): void {
    defaultShowCornerInfo.value = value
  }

  function setDefaultShowScaleBar(value: boolean): void {
    defaultShowScaleBar.value = value
  }

  function setGestureSensitivity(value: MobileGestureSensitivity): void {
    gestureSensitivity.value = value
  }

  function setMprDefaultTool(value: MobileMprDefaultTool): void {
    mprDefaultTool.value = value
  }

  function setMprDefaultViewport(value: MprViewportKey): void {
    mprDefaultViewport.value = value
  }

  function setMprShowReferenceThumbnails(value: boolean): void {
    mprShowReferenceThumbnails.value = value
  }

  function setOrientationLock(value: MobileOrientationLock): void {
    orientationLock.value = value
  }

  function setStackDefaultTool(value: MobileStackDefaultTool): void {
    stackDefaultTool.value = value
  }

  function setStackPlaybackFps(value: MobileStackPlaybackFps): void {
    stackPlaybackFps.value = value
  }

  return {
    defaultShowCornerInfo,
    defaultShowScaleBar,
    gestureSensitivity,
    mprDefaultTool,
    mprDefaultViewport,
    mprShowReferenceThumbnails,
    orientationLock,
    stackDefaultTool,
    stackPlaybackFps,
    setDefaultShowCornerInfo,
    setDefaultShowScaleBar,
    setGestureSensitivity,
    setMprDefaultTool,
    setMprDefaultViewport,
    setMprShowReferenceThumbnails,
    setOrientationLock,
    setStackDefaultTool,
    setStackPlaybackFps
  }
}
