import { computed } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileSettingsOverlay from './MobileSettingsOverlay.vue'

const settingsState = vi.hoisted(() => ({
  defaultShowCornerInfo: true,
  defaultShowScaleBar: true,
  gestureSensitivity: 'normal',
  locale: 'zh-CN',
  mprDefaultTool: 'crosshair',
  mprDefaultViewport: 'mpr-ax',
  mprShowReferenceThumbnails: true,
  orientationLock: 'unlocked',
  selectedPseudocolorKey: 'bw',
  selectedWindowPresetId: 'lung',
  setDefaultShowCornerInfoMock: vi.fn(),
  setDefaultShowScaleBarMock: vi.fn(),
  setGestureSensitivityMock: vi.fn(),
  setLocaleMock: vi.fn(),
  setMprDefaultToolMock: vi.fn(),
  setMprDefaultViewportMock: vi.fn(),
  setMprShowReferenceThumbnailsMock: vi.fn(),
  setOrientationLockMock: vi.fn(),
  setStackDefaultToolMock: vi.fn(),
  setStackPlaybackFpsMock: vi.fn(),
  stackDefaultTool: 'scroll',
  stackPlaybackFps: 5,
  themeId: 'industrial-utility'
}))

vi.mock('../../composables/ui/useUiPreferences', () => ({
  useUiPreferences: () => ({
    getWindowPresetLabel: (preset: { labels: Record<string, string> }) => preset.labels['zh-CN'],
    locale: computed({
      get: () => settingsState.locale,
      set: (value: string) => {
        settingsState.locale = value
      }
    }),
    selectedPseudocolorKey: computed({
      get: () => settingsState.selectedPseudocolorKey,
      set: (value: string) => {
        settingsState.selectedPseudocolorKey = value
      }
    }),
    selectedWindowPresetId: computed({
      get: () => settingsState.selectedWindowPresetId,
      set: (value: string) => {
        settingsState.selectedWindowPresetId = value
      }
    }),
    setLocale: (value: string) => {
      settingsState.locale = value
      settingsState.setLocaleMock(value)
    },
    themeId: computed({
      get: () => settingsState.themeId,
      set: (value: string) => {
        settingsState.themeId = value
      }
    }),
    windowPresets: computed(() => [
      {
        accent: 'linear-gradient(90deg,#111,#fff)',
        id: 'lung',
        labels: { 'en-US': 'Lung', 'zh-CN': 'Lung CN' },
        source: 'system',
        wl: -600,
        ww: 1500
      },
      {
        accent: 'linear-gradient(90deg,#222,#eee)',
        id: 'soft',
        labels: { 'en-US': 'Soft', 'zh-CN': 'Soft CN' },
        source: 'system',
        wl: 40,
        ww: 400
      }
    ])
  })
}))

vi.mock('./useMobileViewerPreferences', () => ({
  MOBILE_GESTURE_SENSITIVITY_OPTIONS: ['low', 'normal', 'high'],
  MOBILE_ORIENTATION_LOCK_OPTIONS: ['unlocked', 'portrait', 'landscape'],
  MOBILE_STACK_PLAYBACK_FPS_OPTIONS: [1, 2, 5, 10, 15, 30],
  useMobileViewerPreferences: () => ({
    defaultShowCornerInfo: computed(() => settingsState.defaultShowCornerInfo),
    defaultShowScaleBar: computed(() => settingsState.defaultShowScaleBar),
    gestureSensitivity: computed(() => settingsState.gestureSensitivity),
    mprDefaultTool: computed(() => settingsState.mprDefaultTool),
    mprDefaultViewport: computed(() => settingsState.mprDefaultViewport),
    mprShowReferenceThumbnails: computed(() => settingsState.mprShowReferenceThumbnails),
    orientationLock: computed(() => settingsState.orientationLock),
    stackDefaultTool: computed(() => settingsState.stackDefaultTool),
    stackPlaybackFps: computed(() => settingsState.stackPlaybackFps),
    setDefaultShowCornerInfo: (value: boolean) => {
      settingsState.defaultShowCornerInfo = value
      settingsState.setDefaultShowCornerInfoMock(value)
    },
    setDefaultShowScaleBar: (value: boolean) => {
      settingsState.defaultShowScaleBar = value
      settingsState.setDefaultShowScaleBarMock(value)
    },
    setGestureSensitivity: (value: string) => {
      settingsState.gestureSensitivity = value
      settingsState.setGestureSensitivityMock(value)
    },
    setMprDefaultTool: (value: string) => {
      settingsState.mprDefaultTool = value
      settingsState.setMprDefaultToolMock(value)
    },
    setMprDefaultViewport: (value: string) => {
      settingsState.mprDefaultViewport = value
      settingsState.setMprDefaultViewportMock(value)
    },
    setMprShowReferenceThumbnails: (value: boolean) => {
      settingsState.mprShowReferenceThumbnails = value
      settingsState.setMprShowReferenceThumbnailsMock(value)
    },
    setOrientationLock: (value: string) => {
      settingsState.orientationLock = value
      settingsState.setOrientationLockMock(value)
    },
    setStackDefaultTool: (value: string) => {
      settingsState.stackDefaultTool = value
      settingsState.setStackDefaultToolMock(value)
    },
    setStackPlaybackFps: (value: number) => {
      settingsState.stackPlaybackFps = value
      settingsState.setStackPlaybackFpsMock(value)
    }
  })
}))

function mountSettings() {
  return mount(MobileSettingsOverlay, {
    props: { isOpen: true },
    global: {
      stubs: {
        AppIcon: { props: ['name'], template: '<span class="app-icon-stub">{{ name }}</span>' },
        Teleport: true
      }
    }
  })
}

beforeEach(() => {
  settingsState.defaultShowCornerInfo = true
  settingsState.defaultShowScaleBar = true
  settingsState.gestureSensitivity = 'normal'
  settingsState.locale = 'zh-CN'
  settingsState.mprDefaultTool = 'crosshair'
  settingsState.mprDefaultViewport = 'mpr-ax'
  settingsState.mprShowReferenceThumbnails = true
  settingsState.orientationLock = 'unlocked'
  settingsState.selectedPseudocolorKey = 'bw'
  settingsState.selectedWindowPresetId = 'lung'
  settingsState.stackDefaultTool = 'scroll'
  settingsState.stackPlaybackFps = 5
  settingsState.themeId = 'industrial-utility'
  settingsState.setDefaultShowCornerInfoMock.mockClear()
  settingsState.setDefaultShowScaleBarMock.mockClear()
  settingsState.setGestureSensitivityMock.mockClear()
  settingsState.setLocaleMock.mockClear()
  settingsState.setMprDefaultToolMock.mockClear()
  settingsState.setMprDefaultViewportMock.mockClear()
  settingsState.setMprShowReferenceThumbnailsMock.mockClear()
  settingsState.setOrientationLockMock.mockClear()
  settingsState.setStackDefaultToolMock.mockClear()
  settingsState.setStackPlaybackFpsMock.mockClear()
})

describe('MobileSettingsOverlay', () => {
  it('updates mobile language, theme, default presets, and MPR default plane', async () => {
    const wrapper = mountSettings()

    expect(wrapper.findAll('.mobile-settings__theme-card')).toHaveLength(3)
    expect(wrapper.findAll('.mobile-settings__theme-preview-accent')).toHaveLength(3)
    expect(wrapper.find('.mobile-settings__list--window').exists()).toBe(true)

    await wrapper.findAll('[data-testid="mobile-settings-locale"] button')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-theme"]')[2].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-window"]')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-pseudocolor"]')[0].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-stack-tool"]')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-mpr-tool"]')[3].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-mpr-plane"]')[2].trigger('click')
    await wrapper.get('[data-testid="mobile-settings-mpr-references"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-corner-info"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-scale-bar"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-playback-fps"]')[4].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-gesture-sensitivity"]')[2].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-orientation-lock"]')[2].trigger('click')

    expect(settingsState.setLocaleMock).toHaveBeenCalledWith('en-US')
    expect(settingsState.locale).toBe('en-US')
    expect(settingsState.themeId).toBe('clinical-light')
    expect(settingsState.selectedWindowPresetId).toBe('soft')
    expect(settingsState.selectedPseudocolorKey).toBe('blackbody')
    expect(settingsState.setStackDefaultToolMock).toHaveBeenCalledWith('window')
    expect(settingsState.setMprDefaultToolMock).toHaveBeenCalledWith('pan')
    expect(settingsState.setMprDefaultViewportMock).toHaveBeenCalledWith('mpr-sag')
    expect(settingsState.mprDefaultViewport).toBe('mpr-sag')
    expect(settingsState.setMprShowReferenceThumbnailsMock).toHaveBeenCalledWith(false)
    expect(settingsState.setDefaultShowCornerInfoMock).toHaveBeenCalledWith(false)
    expect(settingsState.setDefaultShowScaleBarMock).toHaveBeenCalledWith(false)
    expect(settingsState.setStackPlaybackFpsMock).toHaveBeenCalledWith(15)
    expect(settingsState.setGestureSensitivityMock).toHaveBeenCalledWith('high')
    expect(settingsState.setOrientationLockMock).toHaveBeenCalledWith('landscape')
  })
})
