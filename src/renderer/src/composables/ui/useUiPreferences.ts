import { computed, reactive, watch } from 'vue'
import { PSEUDOCOLOR_PRESET_OPTIONS } from '../../constants/pseudocolor'
import { loadUiPreferencesFromStorage, saveUiPreferencesToStorage } from '../../platform/preferencesStorage'

export type AppLocale = 'zh-CN' | 'en-US'

export interface WindowTemplatePreset {
  id: string
  source: 'system' | 'custom'
  ww: number
  wl: number
  accent: string
  labels: {
    'zh-CN': string
    'en-US': string
  }
}

export interface CrosshairViewportPreference {
  key: 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
  label: string
  color: string
  thickness: number
}

export interface ScaleBarPreference {
  enabled: boolean
  color: string
}

export interface ExportPreference {
  locationMode: 'default' | 'custom'
  desktopDirectory: string | null
  includeDicomAnnotations: boolean
  includeDicomMeasurements: boolean
  includePngAnnotations: boolean
  includePngCornerInfo: boolean
  includePngMeasurements: boolean
  useDefaultFileName: boolean
  webDirectoryName: string | null
}

export interface RoiStatPreference {
  key: string
  label: string
  enabled: boolean
}

export type QaWaterMetricKey = 'accuracy' | 'uniformity' | 'noise'

export interface QaWaterMetricPreference {
  key: QaWaterMetricKey
  label: string
  enabled: boolean
}

interface StoredCustomWindowPreset {
  id: string
  ww: number
  wl: number
  accent: string
  labels: WindowTemplatePreset['labels']
}

interface UiPreferencesState {
  version: number
  locale: AppLocale
  themeId: string
  selectedPseudocolorKey: string
  selectedWindowPresetId: string
  crosshairConfigs: CrosshairViewportPreference[]
  scaleBarPreference: ScaleBarPreference
  exportPreference: ExportPreference
  qaWaterMetrics: QaWaterMetricPreference[]
  roiStatOptions: RoiStatPreference[]
  customWindowPresets: StoredCustomWindowPreset[]
}

const CURRENT_PREFERENCES_VERSION = 4
const DEFAULT_THEME_ID = 'aurora'
const DEFAULT_PSEUDOCOLOR_KEY = 'bw'
const DEFAULT_WINDOW_PRESET_ID = 'lung'
export const MAX_CUSTOM_WINDOW_PRESETS = 5
const LEGACY_CROSSHAIR_COLORS: Record<CrosshairViewportPreference['key'], string> = {
  'mpr-ax': '#ffd166',
  'mpr-cor': '#7dd3fc',
  'mpr-sag': '#fda4af'
}

const systemWindowPresets: WindowTemplatePreset[] = [
  {
    id: 'lung',
    source: 'system',
    ww: 1500,
    wl: -600,
    accent: 'linear-gradient(135deg,#6fd3ff,#f7fbff)',
    labels: {
      'zh-CN': '肺窗',
      'en-US': 'Lung'
    }
  },
  {
    id: 'mediastinum',
    source: 'system',
    ww: 350,
    wl: 40,
    accent: 'linear-gradient(135deg,#ffd0b6,#ff8452)',
    labels: {
      'zh-CN': '纵隔',
      'en-US': 'Mediastinum'
    }
  },
  {
    id: 'bone',
    source: 'system',
    ww: 2000,
    wl: 350,
    accent: 'linear-gradient(135deg,#f7f0d0,#f1b74f)',
    labels: {
      'zh-CN': '骨窗',
      'en-US': 'Bone'
    }
  },
  {
    id: 'brain',
    source: 'system',
    ww: 80,
    wl: 40,
    accent: 'linear-gradient(135deg,#dad7ff,#7686ff)',
    labels: {
      'zh-CN': '脑窗',
      'en-US': 'Brain'
    }
  }
]

function createDefaultCrosshairConfigs(): CrosshairViewportPreference[] {
  return [
    { key: 'mpr-ax', label: 'AX', color: '#22c55e', thickness: 2 },
    { key: 'mpr-cor', label: 'COR', color: '#3b82f6', thickness: 2 },
    { key: 'mpr-sag', label: 'SAG', color: '#ef4444', thickness: 2 }
  ]
}

function createDefaultScaleBarPreference(): ScaleBarPreference {
  return {
    enabled: true,
    color: '#f8fafc'
  }
}

function createDefaultExportPreference(): ExportPreference {
  return {
    locationMode: 'default',
    desktopDirectory: null,
    includeDicomAnnotations: true,
    includeDicomMeasurements: true,
    includePngAnnotations: true,
    includePngCornerInfo: true,
    includePngMeasurements: true,
    useDefaultFileName: true,
    webDirectoryName: null
  }
}

function createDefaultRoiStatOptions(): RoiStatPreference[] {
  return [
    { key: 'mean', label: 'Mean', enabled: true },
    { key: 'max', label: 'Max', enabled: true },
    { key: 'min', label: 'Min', enabled: true },
    { key: 'area', label: 'Area', enabled: true },
    { key: 'stddev', label: 'StdDev', enabled: true },
    { key: 'width', label: 'Width', enabled: true },
    { key: 'height', label: 'Height', enabled: true }
  ]
}

function createDefaultQaWaterMetrics(): QaWaterMetricPreference[] {
  return [
    { key: 'accuracy', label: 'Accuracy', enabled: true },
    { key: 'uniformity', label: 'Uniformity', enabled: true },
    { key: 'noise', label: 'Noise', enabled: true }
  ]
}

function createDefaultState(): UiPreferencesState {
  return {
    version: CURRENT_PREFERENCES_VERSION,
    locale: 'zh-CN',
    themeId: DEFAULT_THEME_ID,
    selectedPseudocolorKey: DEFAULT_PSEUDOCOLOR_KEY,
    selectedWindowPresetId: DEFAULT_WINDOW_PRESET_ID,
    crosshairConfigs: createDefaultCrosshairConfigs(),
    scaleBarPreference: createDefaultScaleBarPreference(),
    exportPreference: createDefaultExportPreference(),
    qaWaterMetrics: createDefaultQaWaterMetrics(),
    roiStatOptions: createDefaultRoiStatOptions(),
    customWindowPresets: []
  }
}

const state = reactive<UiPreferencesState>(createDefaultState())

let hasHydrated = false
let hydrationPromise: Promise<void> | null = null

function syncDocumentTheme(themeId: string): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = themeId
  document.documentElement.style.colorScheme = themeId === 'clinical-light' ? 'light' : 'dark'
}

function createCustomPresetId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeLocale(value: unknown): AppLocale {
  return value === 'en-US' ? 'en-US' : 'zh-CN'
}

function normalizeNumber(value: unknown, fallback: number): number {
  const nextValue =
    typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(nextValue) ? nextValue : fallback
}

function normalizeAccent(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : 'linear-gradient(135deg,#7dd3fc,#f8fafc)'
}

function normalizeLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeThemeId(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : DEFAULT_THEME_ID
}

function normalizePseudocolorKey(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_PSEUDOCOLOR_KEY
  }

  return PSEUDOCOLOR_PRESET_OPTIONS.some((option) => option.key === value) ? value : DEFAULT_PSEUDOCOLOR_KEY
}

function normalizeCrosshairConfigs(value: unknown): CrosshairViewportPreference[] {
  const defaults = createDefaultCrosshairConfigs()
  const parsed = Array.isArray(value) ? value : []

  return defaults.map((defaultItem) => {
    const matched = parsed.find((item) => item && typeof item === 'object' && (item as { key?: unknown }).key === defaultItem.key) as
      | Partial<CrosshairViewportPreference>
      | undefined

    return {
      key: defaultItem.key,
      label: defaultItem.label,
      color: typeof matched?.color === 'string' && matched.color.trim() ? matched.color : defaultItem.color,
      thickness: Math.min(4, Math.max(1, normalizeNumber(matched?.thickness, defaultItem.thickness)))
    }
  })
}

function normalizeScaleBarPreference(value: unknown): ScaleBarPreference {
  const defaults = createDefaultScaleBarPreference()
  const record = value && typeof value === 'object' ? (value as Partial<ScaleBarPreference>) : null

  return {
    enabled: typeof record?.enabled === 'boolean' ? record.enabled : defaults.enabled,
    color: typeof record?.color === 'string' && record.color.trim() ? record.color : defaults.color
  }
}

function normalizeExportPreference(value: unknown): ExportPreference {
  const defaults = createDefaultExportPreference()
  const record = value && typeof value === 'object'
    ? (value as Partial<ExportPreference> & { includeDicomOverlays?: unknown; includePngOverlays?: unknown })
    : null
  const legacyDicomOverlays = typeof record?.includeDicomOverlays === 'boolean' ? record.includeDicomOverlays : defaults.includeDicomMeasurements
  const legacyPngOverlays = typeof record?.includePngOverlays === 'boolean' ? record.includePngOverlays : defaults.includePngMeasurements

  return {
    locationMode: record?.locationMode === 'custom' ? 'custom' : defaults.locationMode,
    desktopDirectory:
      typeof record?.desktopDirectory === 'string' && record.desktopDirectory.trim() ? record.desktopDirectory.trim() : null,
    includeDicomAnnotations:
      typeof record?.includeDicomAnnotations === 'boolean' ? record.includeDicomAnnotations : legacyDicomOverlays,
    includeDicomMeasurements:
      typeof record?.includeDicomMeasurements === 'boolean' ? record.includeDicomMeasurements : legacyDicomOverlays,
    includePngAnnotations:
      typeof record?.includePngAnnotations === 'boolean' ? record.includePngAnnotations : legacyPngOverlays,
    includePngCornerInfo:
      typeof record?.includePngCornerInfo === 'boolean' ? record.includePngCornerInfo : defaults.includePngCornerInfo,
    includePngMeasurements:
      typeof record?.includePngMeasurements === 'boolean' ? record.includePngMeasurements : legacyPngOverlays,
    useDefaultFileName:
      typeof record?.useDefaultFileName === 'boolean' ? record.useDefaultFileName : defaults.useDefaultFileName,
    webDirectoryName:
      typeof record?.webDirectoryName === 'string' && record.webDirectoryName.trim() ? record.webDirectoryName.trim() : null
  }
}

function migrateCrosshairConfigs(version: number, value: CrosshairViewportPreference[]): CrosshairViewportPreference[] {
  if (version >= 3) {
    return value
  }

  const defaults = createDefaultCrosshairConfigs()
  return value.map((item) => {
    const defaultItem = defaults.find((candidate) => candidate.key === item.key) ?? item
    const legacyColor = LEGACY_CROSSHAIR_COLORS[item.key]
    return {
      ...item,
      color: item.color.toLowerCase() === legacyColor.toLowerCase() ? defaultItem.color : item.color
    }
  })
}

function normalizeRoiStatOptions(value: unknown): RoiStatPreference[] {
  const defaults = createDefaultRoiStatOptions()
  const parsed = Array.isArray(value) ? value : []

  return defaults.map((defaultItem) => {
    const matched = parsed.find((item) => item && typeof item === 'object' && (item as { key?: unknown }).key === defaultItem.key) as
      | Partial<RoiStatPreference>
      | undefined

    return {
      key: defaultItem.key,
      label: defaultItem.label,
      enabled: typeof matched?.enabled === 'boolean' ? matched.enabled : defaultItem.enabled
    }
  })
}

function normalizeQaWaterMetrics(value: unknown): QaWaterMetricPreference[] {
  const defaults = createDefaultQaWaterMetrics()
  const parsed = Array.isArray(value) ? value : []

  return defaults.map((defaultItem) => {
    const matched = parsed.find((item) => item && typeof item === 'object' && (item as { key?: unknown }).key === defaultItem.key) as
      | Partial<QaWaterMetricPreference>
      | undefined

    return {
      key: defaultItem.key,
      label: defaultItem.label,
      enabled: typeof matched?.enabled === 'boolean' ? matched.enabled : defaultItem.enabled
    }
  })
}

function normalizeCustomWindowPresets(value: unknown): StoredCustomWindowPreset[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.slice(0, MAX_CUSTOM_WINDOW_PRESETS).map((item, index) => ({
    id: typeof item?.id === 'string' && item.id.trim() ? item.id : `custom-loaded-${index}`,
    ww: normalizeNumber(item?.ww, 400),
    wl: normalizeNumber(item?.wl, 40),
    accent: normalizeAccent(item?.accent),
    labels: {
      'zh-CN': normalizeLabel(item?.labels?.['zh-CN'], '自定义窗模板'),
      'en-US': normalizeLabel(item?.labels?.['en-US'], 'Custom Window')
    }
  }))
}

function normalizeWindowPresetId(value: unknown, customWindowPresets: StoredCustomWindowPreset[]): string {
  if (typeof value !== 'string' || !value.trim()) {
    return DEFAULT_WINDOW_PRESET_ID
  }

  const isKnownSystemPreset = systemWindowPresets.some((preset) => preset.id === value)
  const isKnownCustomPreset = customWindowPresets.some((preset) => preset.id === value)
  return isKnownSystemPreset || isKnownCustomPreset ? value : DEFAULT_WINDOW_PRESET_ID
}

function applyState(nextState: UiPreferencesState): void {
  state.version = nextState.version
  state.locale = nextState.locale
  state.themeId = nextState.themeId
  state.selectedPseudocolorKey = nextState.selectedPseudocolorKey
  state.selectedWindowPresetId = nextState.selectedWindowPresetId
  state.crosshairConfigs = nextState.crosshairConfigs
  state.scaleBarPreference = nextState.scaleBarPreference
  state.exportPreference = nextState.exportPreference
  state.qaWaterMetrics = nextState.qaWaterMetrics
  state.roiStatOptions = nextState.roiStatOptions
  state.customWindowPresets = nextState.customWindowPresets
  syncDocumentTheme(nextState.themeId)
}

function serializeState(): UiPreferencesState {
  return {
    version: CURRENT_PREFERENCES_VERSION,
    locale: state.locale,
    themeId: state.themeId,
    selectedPseudocolorKey: state.selectedPseudocolorKey,
    selectedWindowPresetId: state.selectedWindowPresetId,
    crosshairConfigs: state.crosshairConfigs.map((item) => ({ ...item })),
    scaleBarPreference: {
      enabled: state.scaleBarPreference.enabled,
      color: state.scaleBarPreference.color
    },
    exportPreference: {
      locationMode: state.exportPreference.locationMode,
      desktopDirectory: state.exportPreference.desktopDirectory,
      includeDicomAnnotations: state.exportPreference.includeDicomAnnotations,
      includeDicomMeasurements: state.exportPreference.includeDicomMeasurements,
      includePngAnnotations: state.exportPreference.includePngAnnotations,
      includePngCornerInfo: state.exportPreference.includePngCornerInfo,
      includePngMeasurements: state.exportPreference.includePngMeasurements,
      useDefaultFileName: state.exportPreference.useDefaultFileName,
      webDirectoryName: state.exportPreference.webDirectoryName
    },
    qaWaterMetrics: state.qaWaterMetrics.map((item) => ({ ...item })),
    roiStatOptions: state.roiStatOptions.map((item) => ({ ...item })),
    customWindowPresets: state.customWindowPresets.map((item) => ({
      id: item.id,
      ww: item.ww,
      wl: item.wl,
      accent: item.accent,
      labels: {
        'zh-CN': item.labels['zh-CN'],
        'en-US': item.labels['en-US']
      }
    }))
  }
}

async function persistState(): Promise<void> {
  if (!hasHydrated) {
    return
  }

  try {
    await saveUiPreferencesToStorage(serializeState())
  } catch (error) {
    console.error('Failed to save UI preferences.', error)
  }
}

async function hydrateState(): Promise<void> {
  if (hasHydrated) {
    return
  }
  if (hydrationPromise) {
    return hydrationPromise
  }

  hydrationPromise = (async () => {
    try {
      const raw = await loadUiPreferencesFromStorage()
      if (!raw || typeof raw !== 'object') {
        return
      }

      const parsed = raw as Partial<UiPreferencesState> | null
      if (!parsed) {
        return
      }

      const storedVersion = Math.floor(normalizeNumber(parsed.version, 0))
      const customWindowPresets = normalizeCustomWindowPresets(parsed.customWindowPresets)
      applyState({
        version: CURRENT_PREFERENCES_VERSION,
        locale: normalizeLocale(parsed.locale),
        themeId: normalizeThemeId(parsed.themeId),
        selectedPseudocolorKey: normalizePseudocolorKey(parsed.selectedPseudocolorKey),
        selectedWindowPresetId: normalizeWindowPresetId(parsed.selectedWindowPresetId, customWindowPresets),
        crosshairConfigs: migrateCrosshairConfigs(storedVersion, normalizeCrosshairConfigs(parsed.crosshairConfigs)),
        scaleBarPreference: normalizeScaleBarPreference(parsed.scaleBarPreference),
        exportPreference: normalizeExportPreference(parsed.exportPreference),
        qaWaterMetrics: normalizeQaWaterMetrics(parsed.qaWaterMetrics),
        roiStatOptions: normalizeRoiStatOptions(parsed.roiStatOptions),
        customWindowPresets
      })
    } catch (error) {
      console.error('Failed to load UI preferences.', error)
    } finally {
      hasHydrated = true
    }
  })()

  return hydrationPromise
}

void hydrateState()

syncDocumentTheme(state.themeId)

watch(
  () => serializeState(),
  () => {
    void persistState()
  },
  { deep: true }
)

watch(
  () => state.themeId,
  (value) => {
    syncDocumentTheme(value)
  },
  { immediate: true }
)

export function useUiPreferences() {
  const windowPresets = computed<WindowTemplatePreset[]>(() => [
    ...systemWindowPresets,
    ...state.customWindowPresets.map((item) => ({
      ...item,
      source: 'custom' as const
    }))
  ])

  const locale = computed(() => state.locale)
  const themeId = computed({
    get: () => state.themeId,
    set: (value: string) => {
      state.themeId = normalizeThemeId(value)
      void persistState()
    }
  })
  const selectedPseudocolorKey = computed({
    get: () => state.selectedPseudocolorKey,
    set: (value: string) => {
      state.selectedPseudocolorKey = normalizePseudocolorKey(value)
      void persistState()
    }
  })
  const selectedWindowPresetId = computed({
    get: () => state.selectedWindowPresetId,
    set: (value: string) => {
      state.selectedWindowPresetId = normalizeWindowPresetId(value, state.customWindowPresets)
      void persistState()
    }
  })

  function setLocale(locale: AppLocale): void {
    state.locale = locale
    void persistState()
  }

  function addCustomWindowPreset(input: {
    zhName: string
    enName: string
    ww: number
    wl: number
    accent?: string
  }): string {
    if (state.customWindowPresets.length >= MAX_CUSTOM_WINDOW_PRESETS) {
      return state.customWindowPresets[state.customWindowPresets.length - 1]?.id ?? DEFAULT_WINDOW_PRESET_ID
    }

    const presetId = createCustomPresetId()
    state.customWindowPresets = [
      ...state.customWindowPresets,
      {
        id: presetId,
        ww: normalizeNumber(input.ww, 400),
        wl: normalizeNumber(input.wl, 40),
        accent: normalizeAccent(input.accent),
        labels: {
          'zh-CN': normalizeLabel(input.zhName, '自定义窗模板'),
          'en-US': normalizeLabel(input.enName, 'Custom Window')
        }
      }
    ]
    state.selectedWindowPresetId = presetId
    void persistState()
    return presetId
  }

  function removeCustomWindowPreset(id: string): void {
    state.customWindowPresets = state.customWindowPresets.filter((item) => item.id !== id)
    if (state.selectedWindowPresetId === id) {
      state.selectedWindowPresetId = DEFAULT_WINDOW_PRESET_ID
    }
    void persistState()
  }

  function setCrosshairConfigs(nextValue: CrosshairViewportPreference[]): void {
    state.crosshairConfigs = normalizeCrosshairConfigs(nextValue)
    void persistState()
  }

  function setScaleBarPreference(nextValue: ScaleBarPreference): void {
    state.scaleBarPreference = normalizeScaleBarPreference(nextValue)
    void persistState()
  }

  function setExportPreference(nextValue: ExportPreference): void {
    state.exportPreference = normalizeExportPreference(nextValue)
    void persistState()
  }

  function setRoiStatOptions(nextValue: RoiStatPreference[]): void {
    state.roiStatOptions = normalizeRoiStatOptions(nextValue)
    void persistState()
  }

  function removeCustomWindowPresets(ids: string[]): void {
    const idSet = new Set(ids)
    if (!idSet.size) {
      return
    }

    state.customWindowPresets = state.customWindowPresets.filter((item) => !idSet.has(item.id))
    if (idSet.has(state.selectedWindowPresetId)) {
      state.selectedWindowPresetId = DEFAULT_WINDOW_PRESET_ID
    }
    void persistState()
  }

  function setQaWaterMetrics(nextValue: QaWaterMetricPreference[]): void {
    state.qaWaterMetrics = normalizeQaWaterMetrics(nextValue)
    void persistState()
  }

  function getWindowPresetLabel(preset: WindowTemplatePreset): string {
    return preset.labels[state.locale]
  }

  return {
    customWindowPresets: computed(() => state.customWindowPresets),
    crosshairConfigs: computed(() => state.crosshairConfigs),
    getWindowPresetLabel,
    locale,
    exportPreference: computed(() => state.exportPreference),
    qaWaterMetrics: computed(() => state.qaWaterMetrics),
    roiStatOptions: computed(() => state.roiStatOptions),
    scaleBarPreference: computed(() => state.scaleBarPreference),
    selectedPseudocolorKey,
    selectedWindowPresetId,
    setCrosshairConfigs,
    setExportPreference,
    setLocale,
    setQaWaterMetrics,
    setScaleBarPreference,
    setRoiStatOptions,
    addCustomWindowPreset,
    removeCustomWindowPreset,
    removeCustomWindowPresets,
    systemWindowPresets,
    themeId,
    windowPresets
  }
}
