import type {
  VolumeBlendMode,
  VolumeInterpolationMode,
  VolumeLayerConfig,
  VolumeLightingConfig,
  VolumeRenderConfig
} from '../../types/viewer'

type LayerDefaults = Omit<VolumeLayerConfig, 'enabled'>

type PresetDefinition = {
  blendMode: VolumeBlendMode
  enabledKeys: string[]
  overrides?: Partial<Record<string, Partial<VolumeLayerConfig>>>
  lighting?: Partial<VolumeLightingConfig>
}

const LAYER_LIBRARY: Record<string, LayerDefaults> = {
  bone: {
    key: 'bone',
    label: '骨骼',
    ww: 500,
    wl: 400,
    opacity: 1.0,
    colorStart: '#ffffff',
    colorEnd: '#ffffff'
  },
  blood: {
    key: 'blood',
    label: '血液',
    ww: 200,
    wl: 220,
    opacity: 0.2,
    colorStart: '#d31b1b',
    colorEnd: '#ffd54a'
  },
  muscle: {
    key: 'muscle',
    label: '肌肉',
    ww: 320,
    wl: 45,
    opacity: 0.55,
    colorStart: '#f2c7b8',
    colorEnd: '#8a3426'
  },
  softTissue: {
    key: 'softTissue',
    label: '软组织',
    ww: 380,
    wl: 55,
    opacity: 0.32,
    colorStart: '#f1d8c8',
    colorEnd: '#b06b56'
  },
  lung: {
    key: 'lung',
    label: '肺',
    ww: 1500,
    wl: -550,
    opacity: 0.22,
    colorStart: '#9fd8ff',
    colorEnd: '#e5f6ff'
  },
  custom: {
    key: 'custom',
    label: '自定义',
    ww: 400,
    wl: 40,
    opacity: 0.3,
    colorStart: '#7dd3fc',
    colorEnd: '#f8fafc'
  }
}

const DEFAULT_LIGHTING: VolumeLightingConfig = {
  shading: true,
  interpolation: 'linear',
  ambient: 0.16,
  diffuse: 0.86,
  specular: 0.18,
  roughness: 0.78
}

const PRESET_DEFINITIONS: Record<string, PresetDefinition> = {
  aaa: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'blood'],
    overrides: {
      bone: {
        ww: 500,
        wl: 400,
        opacity: 1.0,
        colorStart: '#ffffff',
        colorEnd: '#ffffff'
      },
      blood: {
        ww: 200,
        wl: 220,
        opacity: 0.2,
        colorStart: '#d31b1b',
        colorEnd: '#ffd54a'
      }
    },
    lighting: {
      shading: true,
      interpolation: 'linear',
      ambient: 0.12,
      diffuse: 0.9,
      specular: 0.2,
      roughness: 0.74
    }
  },
  red: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: {
        ww: 360,
        wl: 140,
        opacity: 1.0,
        colorStart: '#b30f0f',
        colorEnd: '#ff5b5b'
      },
      softTissue: {
        ww: 320,
        wl: 55,
        opacity: 0.22,
        colorStart: '#6b0f14',
        colorEnd: '#ff6b57'
      }
    },
    lighting: {
      shading: true,
      interpolation: 'linear',
      ambient: 0.1,
      diffuse: 0.92,
      specular: 0.12,
      roughness: 0.84
    }
  },
  cardiac: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'blood'],
    overrides: {
      bone: {
        ww: 170,
        wl: 176,
        opacity: 0.9,
        colorStart: '#fff9f2',
        colorEnd: '#7f1720'
      },
      blood: {
        ww: 170,
        wl: 7,
        opacity: 0.3,
        colorStart: '#ffe082',
        colorEnd: '#ffb300'
      }
    },
    lighting: {
      shading: true,
      interpolation: 'linear',
      ambient: 0.1,
      diffuse: 0.88,
      specular: 0.22,
      roughness: 0.72
    }
  },
  muscle: {
    blendMode: 'composite',
    enabledKeys: ['muscle', 'softTissue'],
    overrides: {
      muscle: {
        ww: 280,
        wl: 40,
        opacity: 0.58,
        colorStart: '#f4cfbf',
        colorEnd: '#8c3d2e'
      },
      softTissue: {
        ww: 360,
        wl: 50,
        opacity: 0.28,
        colorStart: '#f3ddd1',
        colorEnd: '#9e6a5a'
      }
    },
    lighting: {
      shading: true,
      interpolation: 'linear',
      ambient: 0.18,
      diffuse: 0.82,
      specular: 0.08,
      roughness: 0.9
    }
  },
  mip: {
    blendMode: 'mip',
    enabledKeys: ['bone', 'blood'],
    overrides: {
      bone: {
        ww: 900,
        wl: 350,
        opacity: 0.35,
        colorStart: '#9a9a9a',
        colorEnd: '#ffffff'
      },
      blood: {
        ww: 260,
        wl: 200,
        opacity: 0.85,
        colorStart: '#f7f1b6',
        colorEnd: '#ffffff'
      }
    },
    lighting: {
      shading: false,
      interpolation: 'linear',
      ambient: 1,
      diffuse: 0,
      specular: 0,
      roughness: 1
    }
  }
}

function cloneLayer(layer: VolumeLayerConfig): VolumeLayerConfig {
  return { ...layer }
}

function cloneLighting(lighting: VolumeLightingConfig): VolumeLightingConfig {
  return { ...lighting }
}

function normalizeUnitNumber(value: unknown, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(0, Math.min(1, numeric))
}

function normalizeInterpolation(value: unknown, fallback: VolumeInterpolationMode): VolumeInterpolationMode {
  return value === 'nearest' || value === 'linear' || value === 'cubic' ? value : fallback
}

function normalizeColor(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }
  const text = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback
}

export function normalizeVolumePresetKey(value: string | null | undefined): string {
  const preset = (value ?? 'aaa').trim().toLowerCase()
  if (preset.includes(':')) {
    return normalizeVolumePresetKey(preset.split(':', 2)[1])
  }
  if (preset === 'cardiac-muscle') {
    return 'cardiac'
  }
  return PRESET_DEFINITIONS[preset] ? preset : 'aaa'
}

export function createDefaultVolumeRenderConfig(presetValue: string | null | undefined = 'aaa'): VolumeRenderConfig {
  const preset = normalizeVolumePresetKey(presetValue)
  const definition = PRESET_DEFINITIONS[preset]

  const layers = Object.values(LAYER_LIBRARY).map((layer) => {
    const override = definition.overrides?.[layer.key] ?? {}
    return {
      ...layer,
      ...override,
      enabled: definition.enabledKeys.includes(layer.key)
    }
  })

  return {
    preset,
    blendMode: definition.blendMode,
    layers,
    lighting: {
      ...DEFAULT_LIGHTING,
      ...(definition.lighting ?? {})
    }
  }
}

export function normalizeVolumeRenderConfig(
  value: unknown,
  fallbackPreset: string | null | undefined = 'aaa'
): VolumeRenderConfig {
  const fallback = createDefaultVolumeRenderConfig(fallbackPreset)
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const record = value as Record<string, unknown>
  const preset = normalizeVolumePresetKey(typeof record.preset === 'string' ? record.preset : fallback.preset)
  const presetFallback = createDefaultVolumeRenderConfig(preset)
  const blendMode = record.blendMode === 'mip' ? 'mip' : presetFallback.blendMode
  const incomingLayers = Array.isArray(record.layers) ? record.layers : []
  const lightingRecord =
    record.lighting && typeof record.lighting === 'object' ? (record.lighting as Record<string, unknown>) : null

  const layers = presetFallback.layers.map((fallbackLayer) => {
    const source = incomingLayers.find(
      (item) => typeof item === 'object' && item && (item as Record<string, unknown>).key === fallbackLayer.key
    ) as Record<string, unknown> | undefined

    if (!source) {
      return cloneLayer(fallbackLayer)
    }

    return {
      key: fallbackLayer.key,
      label: typeof source.label === 'string' && source.label.trim() ? source.label.trim() : fallbackLayer.label,
      enabled: typeof source.enabled === 'boolean' ? source.enabled : fallbackLayer.enabled,
      ww: Number.isFinite(Number(source.ww)) ? Math.max(1, Number(source.ww)) : fallbackLayer.ww,
      wl: Number.isFinite(Number(source.wl)) ? Number(source.wl) : fallbackLayer.wl,
      opacity: Number.isFinite(Number(source.opacity))
        ? Math.max(0, Math.min(1, Number(source.opacity)))
        : fallbackLayer.opacity,
      colorStart: normalizeColor(
        typeof source.colorStart === 'string' ? source.colorStart : undefined,
        fallbackLayer.colorStart
      ),
      colorEnd: normalizeColor(
        typeof source.colorEnd === 'string' ? source.colorEnd : undefined,
        fallbackLayer.colorEnd
      )
    }
  })

  const lightingFallback = cloneLighting(presetFallback.lighting)
  const lighting: VolumeLightingConfig = {
    shading: typeof lightingRecord?.shading === 'boolean' ? lightingRecord.shading : lightingFallback.shading,
    interpolation: normalizeInterpolation(lightingRecord?.interpolation, lightingFallback.interpolation),
    ambient: normalizeUnitNumber(lightingRecord?.ambient, lightingFallback.ambient),
    diffuse: normalizeUnitNumber(lightingRecord?.diffuse, lightingFallback.diffuse),
    specular: normalizeUnitNumber(lightingRecord?.specular, lightingFallback.specular),
    roughness: normalizeUnitNumber(lightingRecord?.roughness, lightingFallback.roughness)
  }

  return {
    preset,
    blendMode,
    layers,
    lighting
  }
}
