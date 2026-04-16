import { computed, reactive, watch } from 'vue'

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

interface StoredCustomWindowPreset {
  id: string
  ww: number
  wl: number
  accent: string
  labels: WindowTemplatePreset['labels']
}

interface UiPreferencesState {
  locale: AppLocale
  customWindowPresets: StoredCustomWindowPreset[]
}

const STORAGE_KEY = 'dicomvision-ui-preferences'

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

const state = reactive<UiPreferencesState>({
  locale: 'zh-CN',
  customWindowPresets: []
})

let initialized = false

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

function hydrateState(): void {
  if (initialized || typeof window === 'undefined') {
    initialized = true
    return
  }

  initialized = true

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return
    }

    const parsed = JSON.parse(raw) as Partial<UiPreferencesState> | null
    if (!parsed || typeof parsed !== 'object') {
      return
    }

    state.locale = normalizeLocale(parsed.locale)
    state.customWindowPresets = Array.isArray(parsed.customWindowPresets)
      ? parsed.customWindowPresets.map((item, index) => ({
          id: typeof item?.id === 'string' && item.id.trim() ? item.id : `custom-loaded-${index}`,
          ww: normalizeNumber(item?.ww, 400),
          wl: normalizeNumber(item?.wl, 40),
          accent: normalizeAccent(item?.accent),
          labels: {
            'zh-CN': normalizeLabel(item?.labels?.['zh-CN'], '自定义窗模板'),
            'en-US': normalizeLabel(item?.labels?.['en-US'], 'Custom Window')
          }
        }))
      : []
  } catch (error) {
    console.error('Failed to load UI preferences.', error)
  }
}

function persistState(): void {
  if (typeof window === 'undefined') {
    return
  }

  const payload: UiPreferencesState = {
    locale: state.locale,
    customWindowPresets: state.customWindowPresets.map((item) => ({
      id: item.id,
      ww: item.ww,
      wl: item.wl,
      accent: item.accent,
      labels: item.labels
    }))
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

hydrateState()

watch(
  () => [state.locale, state.customWindowPresets] as const,
  () => {
    persistState()
  },
  { deep: true }
)

export function useUiPreferences() {
  const windowPresets = computed<WindowTemplatePreset[]>(() => [
    ...systemWindowPresets,
    ...state.customWindowPresets.map((item) => ({
      ...item,
      source: 'custom' as const
    }))
  ])

  function setLocale(locale: AppLocale): void {
    state.locale = locale
  }

  function addCustomWindowPreset(input: {
    zhName: string
    enName: string
    ww: number
    wl: number
    accent?: string
  }): string {
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
    return presetId
  }

  function removeCustomWindowPreset(id: string): void {
    state.customWindowPresets = state.customWindowPresets.filter((item) => item.id !== id)
  }

  function getWindowPresetLabel(preset: WindowTemplatePreset): string {
    return preset.labels[state.locale]
  }

  return {
    customWindowPresets: computed(() => state.customWindowPresets),
    getWindowPresetLabel,
    locale: computed(() => state.locale),
    setLocale,
    addCustomWindowPreset,
    removeCustomWindowPreset,
    systemWindowPresets,
    windowPresets
  }
}
