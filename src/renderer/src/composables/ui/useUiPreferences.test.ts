import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'dicomvision-ui-preferences'

function installLocalStorageMock(): void {
  if (window.localStorage) {
    return
  }

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

async function flushPreferences(): Promise<void> {
  await Promise.resolve()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

async function loadPreferences(storedValue?: unknown) {
  vi.resetModules()
  installLocalStorageMock()
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
    installLocalStorageMock()
    window.localStorage.clear()
  })

  it('hydrates persisted layout, tag, de-identify, and hanging protocol settings', async () => {
    const preferences = await loadPreferences({
      version: 11,
      locale: 'en-US',
      themeId: 'clinical-light',
      viewerToolbarPlacement: 'right',
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
      ],
      pacsPreference: {
        localSourceEnabled: false,
        enabled: true,
        activeProfileId: 'pacs-1',
        profiles: [
          {
            id: 'pacs-1',
            name: ' Hospital PACS ',
            enabled: true,
            preset: 'orthanc',
            baseUrl: 'http://localhost:8042/',
            qidoPath: 'dicom-web',
            wadoPath: '/dicom-web',
            authType: 'basic',
            username: 'user',
            password: 'secret',
            bearerToken: '',
            timeoutSeconds: 90
          }
        ]
      }
    })

    expect(preferences.locale.value).toBe('en-US')
    expect(preferences.themeId.value).toBe('clinical-light')
    expect(document.documentElement.dataset.theme).toBe('clinical-light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(preferences.viewerToolbarPlacement.value).toBe('right')
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
    expect(preferences.viewportCornerInfoPreference.value).toEqual({
      topLeft: [
        'manufacturerModel',
        'stationName',
        'examDescription',
        'seriesNumber',
        'viewportLocation',
        'imageIndex'
      ],
      topRight: ['patientName', 'patientSummary'],
      bottomLeft: ['technique', 'sliceThickness', 'acquisitionDateTime', 'windowLevel'],
      bottomRight: ['zoom', 'coordinates', 'transform2dState'],
      typographyPreset: 'comfortable',
      colorMode: 'auto',
      customDarkColor: '#f8fafc',
      customLightColor: '#182334'
    })
    expect(preferences.drawingScopePreference.value).toEqual({
      measurement: 'image',
      annotation: 'image',
      qaWater: 'image',
      mtf: 'image'
    })
    expect(preferences.workspaceDockPreference.value).toEqual({
      leftWidth: 320,
      leftCollapsed: false,
      rightToolbarWidth: 224,
      rightToolbarCollapsed: false,
      rightResultWidth: 344,
      rightResultCollapsed: false
    })
    expect(preferences.pacsPreference.value.enabled).toBe(true)
    expect(preferences.pacsPreference.value.localSourceEnabled).toBe(false)
    expect(preferences.pacsPreference.value.activeProfileId).toBe('pacs-1')
    expect(preferences.pacsPreference.value.profiles[0]).toMatchObject({
      name: 'Hospital PACS',
      baseUrl: 'http://localhost:8042',
      qidoPath: '/dicom-web',
      authType: 'basic',
      timeoutSeconds: 60
    })
  })

  it('persists user changes after hydration', async () => {
    const preferences = await loadPreferences()

    preferences.viewerToolbarPlacement.value = 'right'
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
    preferences.setViewportCornerInfoPreference({
      topLeft: ['patientName', 'windowLevel'],
      topRight: ['seriesNumber'],
      bottomLeft: [],
      bottomRight: ['zoom'],
      typographyPreset: 'standard',
      colorMode: 'custom',
      customDarkColor: '#22d3ee',
      customLightColor: '#182334'
    })
    preferences.setDrawingScopePreference({
      measurement: 'series',
      annotation: 'series',
      qaWater: 'image',
      mtf: 'series'
    })
    preferences.setWorkspaceDockPreference({
      leftWidth: 420,
      leftCollapsed: false,
      rightToolbarWidth: 360,
      rightToolbarCollapsed: true,
      rightResultWidth: 480,
      rightResultCollapsed: false
    })
    preferences.setPacsPreference({
      localSourceEnabled: true,
      enabled: true,
      activeProfileId: 'pacs-2',
      profiles: [
        {
          id: 'pacs-2',
          name: 'Remote PACS',
          enabled: true,
          protocol: 'dicomweb',
          preset: 'custom',
          baseUrl: 'https://pacs.example.com',
          qidoPath: '/dicom-web',
          wadoPath: '/dicom-web',
          authType: 'bearer',
          username: '',
          password: '',
          bearerToken: 'token',
          host: '127.0.0.1',
          port: 104,
          calledAeTitle: 'ORTHANC',
          clientAeTitle: 'DICOMVISION',
          queryModel: 'study-root',
          timeoutSeconds: 12
        }
      ]
    })
    await flushPreferences()

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    expect(saved.viewerToolbarPlacement).toBe('right')
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
    expect(saved.viewportCornerInfoPreference).toEqual({
      topLeft: ['patientName', 'windowLevel'],
      topRight: ['seriesNumber'],
      bottomLeft: [],
      bottomRight: ['zoom'],
      typographyPreset: 'standard',
      colorMode: 'custom',
      customDarkColor: '#22d3ee',
      customLightColor: '#182334'
    })
    expect(saved.drawingScopePreference).toEqual({
      measurement: 'series',
      annotation: 'series',
      qaWater: 'image',
      mtf: 'series'
    })
    expect(saved.workspaceDockPreference).toEqual({
      leftWidth: 420,
      leftCollapsed: false,
      rightToolbarWidth: 360,
      rightToolbarCollapsed: true,
      rightResultWidth: 480,
      rightResultCollapsed: false
    })
    expect(saved.pacsPreference).toMatchObject({
      localSourceEnabled: true,
      enabled: true,
      activeProfileId: 'pacs-2'
    })
  })

  it('normalizes and persists MPR segmentation display colors', async () => {
    const preferences = await loadPreferences({
      mprSegmentationStylePreference: {
        thresholdColor: 'not-a-color',
        voiColor: '#ABCDEF'
      }
    })

    expect(preferences.mprSegmentationStylePreference.value).toEqual({
      thresholdColor: '#ff4df8',
      voiColor: '#ABCDEF'
    })

    preferences.setMprSegmentationStylePreference({
      thresholdColor: '#112233',
      voiColor: 'bad'
    })
    await flushPreferences()

    expect(preferences.mprSegmentationStylePreference.value).toEqual({
      thresholdColor: '#112233',
      voiColor: '#22d3ee'
    })

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    expect(saved.mprSegmentationStylePreference).toEqual({
      thresholdColor: '#112233',
      voiColor: '#22d3ee'
    })
  })

  it('migrates the previous default corner layout to include Im without changing custom layouts', async () => {
    const preferences = await loadPreferences({
      version: 14,
      viewportCornerInfoPreference: {
        topLeft: ['manufacturerModel', 'stationName', 'institutionName', 'examDescription', 'seriesNumber', 'viewportLocation'],
        topRight: ['patientName', 'patientSummary'],
        bottomLeft: ['technique', 'sliceThickness', 'acquisitionDateTime', 'windowLevel'],
        bottomRight: ['zoom', 'coordinates']
      }
    })

    expect(preferences.viewportCornerInfoPreference.value.topLeft).toEqual([
      'manufacturerModel',
      'stationName',
      'examDescription',
      'seriesNumber',
      'viewportLocation',
      'imageIndex'
    ])

    const customPreferences = await loadPreferences({
      version: 14,
      viewportCornerInfoPreference: {
        topLeft: ['patientName', 'windowLevel'],
        topRight: ['seriesNumber'],
        bottomLeft: [],
        bottomRight: ['zoom']
      }
    })

    expect(customPreferences.viewportCornerInfoPreference.value).toEqual({
      topLeft: ['patientName', 'windowLevel'],
      topRight: ['seriesNumber'],
      bottomLeft: [],
      bottomRight: ['zoom'],
      typographyPreset: 'comfortable',
      colorMode: 'auto',
      customDarkColor: '#f8fafc',
      customLightColor: '#182334'
    })
  })

  it('defaults to the right toolbar and falls back to it for unknown placement values', async () => {
    const defaultPreferences = await loadPreferences()
    expect(defaultPreferences.viewerToolbarPlacement.value).toBe('right')

    const preferences = await loadPreferences({
      viewerToolbarPlacement: 'floating'
    })

    expect(preferences.viewerToolbarPlacement.value).toBe('right')
  })

  it('creates PACS profiles with preset-specific DIMSE ports', async () => {
    const { createPacsProfile } = await import('../pacs/pacsProfileUtils')

    expect(createPacsProfile('orthanc').port).toBe(4242)
    expect(createPacsProfile('dcm4chee').port).toBe(11112)
    expect(createPacsProfile('custom').port).toBe(104)
  })

  it('provides common CT window presets with localized labels', async () => {
    const preferences = await loadPreferences()

    expect(preferences.systemWindowPresets.map((preset) => preset.id)).toEqual([
      'lung',
      'mediastinum',
      'bone',
      'brain',
      'abdomen',
      'stroke',
      'soft-tissue',
      'liver',
      'cta',
      'subdural'
    ])
    expect(preferences.getWindowPresetLabel(preferences.systemWindowPresets[0])).toBe('肺窗')
    expect(preferences.getWindowPresetLabel(preferences.systemWindowPresets[4])).toBe('腹部窗')

    preferences.setLocale('en-US')

    expect(preferences.getWindowPresetLabel(preferences.systemWindowPresets[4])).toBe('Abdomen')
  })
})
