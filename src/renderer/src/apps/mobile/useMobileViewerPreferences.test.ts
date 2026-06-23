import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'dicomvision-mobile-preferences'

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size
      },
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, String(value))
    }
  })
}

async function loadPreferencesModule() {
  vi.resetModules()
  return import('./useMobileViewerPreferences')
}

beforeEach(() => {
  installLocalStorageMock()
  window.localStorage.clear()
})

describe('useMobileViewerPreferences', () => {
  it('normalizes legacy mobile preference storage with new defaults', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mprDefaultViewport: 'mpr-cor' }))

    const { useMobileViewerPreferences } = await loadPreferencesModule()
    const preferences = useMobileViewerPreferences()

    expect(preferences.mprDefaultViewport.value).toBe('mpr-cor')
    expect(preferences.stackDefaultTool.value).toBe('scroll')
    expect(preferences.mprDefaultTool.value).toBe('crosshair')
    expect(preferences.mprShowReferenceThumbnails.value).toBe(true)
    expect(preferences.gestureSensitivity.value).toBe('normal')
    expect(preferences.stackPlaybackFps.value).toBe(5)
    expect(preferences.defaultShowCornerInfo.value).toBe(true)
    expect(preferences.defaultShowScaleBar.value).toBe(true)
    expect(preferences.orientationLock.value).toBe('unlocked')
    expect(preferences.volumeDefaultTool.value).toBe('rotate3d')
  })

  it('persists updated mobile viewer preferences', async () => {
    const { useMobileViewerPreferences } = await loadPreferencesModule()
    const preferences = useMobileViewerPreferences()

    preferences.setStackDefaultTool('window')
    preferences.setMprDefaultTool('pan')
    preferences.setMprDefaultViewport('mpr-sag')
    preferences.setMprShowReferenceThumbnails(false)
    preferences.setGestureSensitivity('high')
    preferences.setStackPlaybackFps(15)
    preferences.setDefaultShowCornerInfo(false)
    preferences.setDefaultShowScaleBar(false)
    preferences.setOrientationLock('landscape')
    preferences.setVolumeDefaultTool('pan')

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      defaultShowCornerInfo: false,
      defaultShowScaleBar: false,
      gestureSensitivity: 'high',
      mprDefaultTool: 'pan',
      mprDefaultViewport: 'mpr-sag',
      mprShowReferenceThumbnails: false,
      orientationLock: 'landscape',
      stackDefaultTool: 'window',
      stackPlaybackFps: 15,
      volumeDefaultTool: 'pan'
    })
  })

  it('falls back when stored mobile preference values are invalid', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        defaultShowCornerInfo: 'yes',
        defaultShowScaleBar: 0,
        gestureSensitivity: 'fast',
        mprDefaultTool: 'measure',
        mprDefaultViewport: 'mpr-unknown',
        mprShowReferenceThumbnails: 'no',
        orientationLock: 'upside-down',
        stackDefaultTool: 'play',
        stackPlaybackFps: 7,
        volumeDefaultTool: 'orbit'
      })
    )

    const { useMobileViewerPreferences } = await loadPreferencesModule()
    const preferences = useMobileViewerPreferences()

    expect(preferences.defaultShowCornerInfo.value).toBe(true)
    expect(preferences.defaultShowScaleBar.value).toBe(true)
    expect(preferences.gestureSensitivity.value).toBe('normal')
    expect(preferences.mprDefaultTool.value).toBe('crosshair')
    expect(preferences.mprDefaultViewport.value).toBe('mpr-ax')
    expect(preferences.mprShowReferenceThumbnails.value).toBe(true)
    expect(preferences.orientationLock.value).toBe('unlocked')
    expect(preferences.stackDefaultTool.value).toBe('scroll')
    expect(preferences.stackPlaybackFps.value).toBe(5)
    expect(preferences.volumeDefaultTool.value).toBe('rotate3d')
  })
})
