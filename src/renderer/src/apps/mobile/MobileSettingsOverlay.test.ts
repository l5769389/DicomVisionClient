import { computed } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileSettingsOverlay from './MobileSettingsOverlay.vue'

const settingsState = vi.hoisted(() => ({
  crosshairConfigs: [
    { key: 'mpr-ax', label: 'AX', color: '#ef4444', thickness: 2 },
    { key: 'mpr-cor', label: 'COR', color: '#22c55e', thickness: 2 },
    { key: 'mpr-sag', label: 'SAG', color: '#3b82f6', thickness: 2 }
  ],
  defaultShowCornerInfo: true,
  defaultShowScaleBar: true,
  dicomTagDisplayMode: 'tree',
  exportPreference: {
    desktopDirectory: null,
    includeDicomAnnotations: true,
    includeDicomMeasurements: true,
    includePngAnnotations: true,
    includePngCornerInfo: true,
    includePngMeasurements: true,
    locationMode: 'default',
    useDefaultFileName: true,
    webDirectoryName: null
  },
  gestureSensitivity: 'normal',
  locale: 'zh-CN',
  measurementStylePreference: {
    completedColor: '#55e7ff',
    completedLineStyle: 'solid',
    editingColor: '#ffb84d',
    editingLineStyle: 'dash',
    lineWidth: 2.5
  },
  mprDefaultTool: 'crosshair',
  mprDefaultViewport: 'mpr-ax',
  mprShowReferenceThumbnails: true,
  orientationLock: 'unlocked',
  roiStatOptions: [
    { key: 'mean', label: 'Mean', enabled: true },
    { key: 'max', label: 'Max', enabled: true },
    { key: 'min', label: 'Min', enabled: true },
    { key: 'area', label: 'Area', enabled: true },
    { key: 'stddev', label: 'StdDev', enabled: true },
    { key: 'width', label: 'Width', enabled: true },
    { key: 'height', label: 'Height', enabled: true }
  ],
  scaleBarPreference: {
    color: '#f8fafc',
    enabled: true
  },
  selectedPseudocolorKey: 'bw',
  selectedWindowPresetId: 'lung',
  setCrosshairConfigsMock: vi.fn(),
  setDefaultShowCornerInfoMock: vi.fn(),
  setDefaultShowScaleBarMock: vi.fn(),
  setExportPreferenceMock: vi.fn(),
  setGestureSensitivityMock: vi.fn(),
  setLocaleMock: vi.fn(),
  setMeasurementStylePreferenceMock: vi.fn(),
  setMprDefaultToolMock: vi.fn(),
  setMprDefaultViewportMock: vi.fn(),
  setMprShowReferenceThumbnailsMock: vi.fn(),
  setOrientationLockMock: vi.fn(),
  setRoiStatOptionsMock: vi.fn(),
  setScaleBarPreferenceMock: vi.fn(),
  setStackDefaultToolMock: vi.fn(),
  setStackPlaybackFpsMock: vi.fn(),
  stackDefaultTool: 'scroll',
  stackPlaybackFps: 5,
  themeId: 'industrial-utility'
}))

vi.mock('../../composables/ui/useUiPreferences', () => ({
  useUiPreferences: () => ({
    crosshairConfigs: computed(() => settingsState.crosshairConfigs),
    dicomTagDisplayMode: computed({
      get: () => settingsState.dicomTagDisplayMode,
      set: (value: string) => {
        settingsState.dicomTagDisplayMode = value
      }
    }),
    exportPreference: computed(() => settingsState.exportPreference),
    getWindowPresetLabel: (preset: { labels: Record<string, string> }) => preset.labels['zh-CN'],
    locale: computed({
      get: () => settingsState.locale,
      set: (value: string) => {
        settingsState.locale = value
      }
    }),
    measurementStylePreference: computed(() => settingsState.measurementStylePreference),
    roiStatOptions: computed(() => settingsState.roiStatOptions),
    scaleBarPreference: computed(() => settingsState.scaleBarPreference),
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
    setCrosshairConfigs: (value: typeof settingsState.crosshairConfigs) => {
      settingsState.crosshairConfigs.splice(0, settingsState.crosshairConfigs.length, ...value)
      settingsState.setCrosshairConfigsMock(value)
    },
    setExportPreference: (value: typeof settingsState.exportPreference) => {
      Object.assign(settingsState.exportPreference, value)
      settingsState.setExportPreferenceMock(value)
    },
    setLocale: (value: string) => {
      settingsState.locale = value
      settingsState.setLocaleMock(value)
    },
    setMeasurementStylePreference: (value: typeof settingsState.measurementStylePreference) => {
      Object.assign(settingsState.measurementStylePreference, value)
      settingsState.setMeasurementStylePreferenceMock(value)
    },
    setRoiStatOptions: (value: typeof settingsState.roiStatOptions) => {
      settingsState.roiStatOptions.splice(0, settingsState.roiStatOptions.length, ...value)
      settingsState.setRoiStatOptionsMock(value)
    },
    setScaleBarPreference: (value: typeof settingsState.scaleBarPreference) => {
      Object.assign(settingsState.scaleBarPreference, value)
      settingsState.setScaleBarPreferenceMock(value)
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
  settingsState.crosshairConfigs = [
    { key: 'mpr-ax', label: 'AX', color: '#ef4444', thickness: 2 },
    { key: 'mpr-cor', label: 'COR', color: '#22c55e', thickness: 2 },
    { key: 'mpr-sag', label: 'SAG', color: '#3b82f6', thickness: 2 }
  ]
  settingsState.defaultShowCornerInfo = true
  settingsState.defaultShowScaleBar = true
  settingsState.dicomTagDisplayMode = 'tree'
  settingsState.exportPreference = {
    desktopDirectory: null,
    includeDicomAnnotations: true,
    includeDicomMeasurements: true,
    includePngAnnotations: true,
    includePngCornerInfo: true,
    includePngMeasurements: true,
    locationMode: 'default',
    useDefaultFileName: true,
    webDirectoryName: null
  }
  settingsState.gestureSensitivity = 'normal'
  settingsState.locale = 'zh-CN'
  settingsState.measurementStylePreference = {
    completedColor: '#55e7ff',
    completedLineStyle: 'solid',
    editingColor: '#ffb84d',
    editingLineStyle: 'dash',
    lineWidth: 2.5
  }
  settingsState.mprDefaultTool = 'crosshair'
  settingsState.mprDefaultViewport = 'mpr-ax'
  settingsState.mprShowReferenceThumbnails = true
  settingsState.orientationLock = 'unlocked'
  settingsState.roiStatOptions = [
    { key: 'mean', label: 'Mean', enabled: true },
    { key: 'max', label: 'Max', enabled: true },
    { key: 'min', label: 'Min', enabled: true },
    { key: 'area', label: 'Area', enabled: true },
    { key: 'stddev', label: 'StdDev', enabled: true },
    { key: 'width', label: 'Width', enabled: true },
    { key: 'height', label: 'Height', enabled: true }
  ]
  settingsState.scaleBarPreference = { color: '#f8fafc', enabled: true }
  settingsState.selectedPseudocolorKey = 'bw'
  settingsState.selectedWindowPresetId = 'lung'
  settingsState.stackDefaultTool = 'scroll'
  settingsState.stackPlaybackFps = 5
  settingsState.themeId = 'industrial-utility'
  settingsState.setCrosshairConfigsMock.mockClear()
  settingsState.setDefaultShowCornerInfoMock.mockClear()
  settingsState.setDefaultShowScaleBarMock.mockClear()
  settingsState.setExportPreferenceMock.mockClear()
  settingsState.setGestureSensitivityMock.mockClear()
  settingsState.setLocaleMock.mockClear()
  settingsState.setMeasurementStylePreferenceMock.mockClear()
  settingsState.setMprDefaultToolMock.mockClear()
  settingsState.setMprDefaultViewportMock.mockClear()
  settingsState.setMprShowReferenceThumbnailsMock.mockClear()
  settingsState.setOrientationLockMock.mockClear()
  settingsState.setRoiStatOptionsMock.mockClear()
  settingsState.setScaleBarPreferenceMock.mockClear()
  settingsState.setStackDefaultToolMock.mockClear()
  settingsState.setStackPlaybackFpsMock.mockClear()
})

describe('MobileSettingsOverlay', () => {
  it('updates mobile settings and selected web viewer preferences', async () => {
    const wrapper = mountSettings()

    expect(wrapper.findAll('[data-testid^="mobile-settings-nav-"]')).toHaveLength(9)

    await wrapper.get('[data-testid="mobile-settings-nav-interface"]').trigger('click')
    expect(wrapper.findAll('.mobile-settings__theme-card')).toHaveLength(3)
    expect(wrapper.findAll('.mobile-settings__theme-preview-accent')).toHaveLength(3)
    await wrapper.findAll('[data-testid="mobile-settings-locale"] button')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-theme"]')[2].trigger('click')

    await wrapper.get('[data-testid="mobile-settings-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-nav-window-color"]').trigger('click')
    expect(wrapper.find('.mobile-settings__list--window').exists()).toBe(true)
    await wrapper.findAll('[data-testid="mobile-settings-window"]')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-pseudocolor"]')[0].trigger('click')

    await wrapper.get('[data-testid="mobile-settings-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-nav-reading"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-stack-tool"]')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-mpr-tool"]')[3].trigger('click')

    await wrapper.get('[data-testid="mobile-settings-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-nav-mpr"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-mpr-plane"]')[2].trigger('click')
    await wrapper.get('[data-testid="mobile-settings-mpr-references"]').trigger('click')

    await wrapper.get('[data-testid="mobile-settings-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-nav-display"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-corner-info"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-scale-bar"]').trigger('click')

    await wrapper.get('[data-testid="mobile-settings-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-nav-overlays"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-overlay-scale-enabled"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-scale-color"]')[2].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-crosshair-color"]')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-crosshair-thickness"]')[2].trigger('click')

    await wrapper.get('[data-testid="mobile-settings-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-nav-measurements"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-measure-editing-color"]')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-measure-completed-color"]')[4].trigger('click')
    await wrapper.get('[data-testid="mobile-settings-measure-line-width"]').setValue('4')
    await wrapper.findAll('[data-testid="mobile-settings-measure-editing-line"]')[0].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-measure-completed-line"]')[1].trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-roi-stat"]')[0].trigger('click')

    await wrapper.get('[data-testid="mobile-settings-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-nav-dicom-export"]').trigger('click')
    await wrapper.findAll('[data-testid="mobile-settings-dicom-tag-mode"]')[1].trigger('click')
    await wrapper.get('[data-testid="mobile-settings-export-default-name"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-export-png-measurements"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-export-dicom-annotations"]').trigger('click')

    await wrapper.get('[data-testid="mobile-settings-back"]').trigger('click')
    await wrapper.get('[data-testid="mobile-settings-nav-playback"]').trigger('click')
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
    expect(settingsState.setMprShowReferenceThumbnailsMock).toHaveBeenCalledWith(false)
    expect(settingsState.setDefaultShowCornerInfoMock).toHaveBeenCalledWith(false)
    expect(settingsState.setDefaultShowScaleBarMock).toHaveBeenCalledWith(false)
    expect(settingsState.scaleBarPreference).toEqual({ color: '#3b82f6', enabled: false })
    expect(settingsState.crosshairConfigs[0]).toEqual({ key: 'mpr-ax', label: 'AX', color: '#22c55e', thickness: 3 })
    expect(settingsState.measurementStylePreference).toEqual({
      completedColor: '#ef4444',
      completedLineStyle: 'dash',
      editingColor: '#55e7ff',
      editingLineStyle: 'solid',
      lineWidth: 4
    })
    expect(settingsState.roiStatOptions[0]).toEqual({ key: 'mean', label: 'Mean', enabled: false })
    expect(settingsState.dicomTagDisplayMode).toBe('flat')
    expect(settingsState.exportPreference).toEqual({
      desktopDirectory: null,
      includeDicomAnnotations: false,
      includeDicomMeasurements: true,
      includePngAnnotations: true,
      includePngCornerInfo: true,
      includePngMeasurements: false,
      locationMode: 'default',
      useDefaultFileName: false,
      webDirectoryName: null
    })
    expect(settingsState.setScaleBarPreferenceMock).toHaveBeenCalled()
    expect(settingsState.setCrosshairConfigsMock).toHaveBeenCalled()
    expect(settingsState.setMeasurementStylePreferenceMock).toHaveBeenCalled()
    expect(settingsState.setRoiStatOptionsMock).toHaveBeenCalled()
    expect(settingsState.setExportPreferenceMock).toHaveBeenCalled()
    expect(settingsState.setStackPlaybackFpsMock).toHaveBeenCalledWith(15)
    expect(settingsState.setGestureSensitivityMock).toHaveBeenCalledWith('high')
    expect(settingsState.setOrientationLockMock).toHaveBeenCalledWith('landscape')
  })
})
