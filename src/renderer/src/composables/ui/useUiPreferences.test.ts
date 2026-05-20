import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'dicomvision-ui-preferences'

async function flushPreferences(): Promise<void> {
  await Promise.resolve()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

async function loadPreferences(storedValue?: unknown) {
  vi.resetModules()
  window.localStorage.clear()
  delete (window as Window & { viewerApi?: unknown }).viewerApi
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.colorScheme = ''

  if (storedValue) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedValue))
  }

  const module = await import('./useUiPreferences')
  await flushPreferences()
  return module.useUiPreferences()
}

describe('useUiPreferences', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('hydrates persisted layout, tag, de-identify, and hanging protocol settings', async () => {
    const preferences = await loadPreferences({
      version: 11,
      locale: 'en-US',
      themeId: 'clinical-light',
      selectedPseudocolorKey: 'rainbow',
      mprDefaultLayoutKey: 'quad',
      dicomTagDisplayMode: 'flat',
      dicomDeidentifyPreference: {
        selectedFieldKeys: ['patientIdentity', 'privateTags', 'not-a-field'],
        replacementPrefix: '  hospital-demo-prefix-that-is-longer-than-limit  '
      },
      hangingProtocolRules: [
        {
          id: 'rule-1',
          name: '  Chest CT  ',
          enabled: true,
          modality: '*',
          seriesDescriptionKeyword: ' lung ',
          rows: 99,
          columns: 0
        }
      ]
    })

    expect(preferences.locale.value).toBe('en-US')
    expect(preferences.themeId.value).toBe('clinical-light')
    expect(document.documentElement.dataset.theme).toBe('clinical-light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(preferences.selectedPseudocolorKey.value).toBe('rainbow')
    expect(preferences.mprDefaultLayoutKey.value).toBe('quad')
    expect(preferences.dicomTagDisplayMode.value).toBe('flat')
    expect(preferences.dicomDeidentifyPreference.value.selectedFieldKeys).toEqual(['patientIdentity', 'privateTags'])
    expect(preferences.dicomDeidentifyPreference.value.replacementPrefix).toBe('hospital-demo-prefix-tha')
    expect(preferences.hangingProtocolRules.value).toEqual([
      {
        id: 'rule-1',
        name: 'Chest CT',
        enabled: true,
        modality: 'ALL',
        seriesDescriptionKeyword: 'lung',
        rows: 6,
        columns: 1
      }
    ])
  })

  it('persists user changes after hydration', async () => {
    const preferences = await loadPreferences()

    preferences.setMprDefaultLayoutKey('mpr-3d')
    preferences.dicomTagDisplayMode.value = 'flat'
    preferences.setHangingProtocolRules([
      {
        id: 'rule-2',
        name: 'MR Head',
        enabled: false,
        modality: 'mr',
        seriesDescriptionKeyword: 't1',
        rows: 2,
        columns: 2
      }
    ])
    await flushPreferences()

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    expect(saved.mprDefaultLayoutKey).toBe('mpr-3d')
    expect(saved.dicomTagDisplayMode).toBe('flat')
    expect(saved.hangingProtocolRules).toEqual([
      {
        id: 'rule-2',
        name: 'MR Head',
        enabled: false,
        modality: 'MR',
        seriesDescriptionKeyword: 't1',
        rows: 2,
        columns: 2
      }
    ])
  })
})
