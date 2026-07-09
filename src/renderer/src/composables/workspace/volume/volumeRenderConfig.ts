import type {
  VolumeBlendMode,
  VolumeInterpolationMode,
  VolumeLayerConfig,
  VolumeLightingConfig,
  VolumeRenderConfig
} from '../../../types/viewer'

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

export interface VolumePresetOption {
  value: string
  label: string
  icon: string
  group: 'General' | 'CT' | 'CTA' | 'MR' | 'CBCT'
}

export const VOLUME_PRESET_OPTIONS: VolumePresetOption[] = [
  { value: 'volumePreset:aaa', label: 'AAA', icon: 'volume-preset-aaa', group: 'General' },
  { value: 'volumePreset:red', label: 'Red', icon: 'volume-preset-red', group: 'General' },
  { value: 'volumePreset:cardiac', label: 'Cardiac', icon: 'volume-preset-cardiac', group: 'General' },
  { value: 'volumePreset:muscle', label: 'Muscle', icon: 'volume-preset-muscle', group: 'General' },
  { value: 'volumePreset:mip', label: 'MIP', icon: 'volume-preset-mip', group: 'General' },
  { value: 'volumePreset:xray', label: 'XRay', icon: 'volume-preset-mip', group: 'General' },
  { value: 'volumePreset:carotid', label: 'Carotid', icon: 'volume-preset-cardiac', group: 'CT' },
  { value: 'volumePreset:bonePlusPlate', label: 'Bone Plus Plate', icon: 'render-surface', group: 'CT' },
  { value: 'volumePreset:fracture', label: 'Fracture', icon: 'render-surface', group: 'CT' },
  { value: 'volumePreset:lumbar', label: 'Lumbar', icon: 'render-surface', group: 'CT' },
  { value: 'volumePreset:hardware', label: 'HardWare', icon: 'render-surface', group: 'CT' },
  { value: 'volumePreset:lung', label: 'Lung', icon: 'volume-preset-muscle', group: 'CT' },
  { value: 'volumePreset:lung2', label: 'Lung2', icon: 'volume-preset-muscle', group: 'CT' },
  { value: 'volumePreset:lung3', label: 'Lung3', icon: 'volume-preset-muscle', group: 'CT' },
  { value: 'volumePreset:renalsStomach', label: 'Renals-Stomach', icon: 'volume-preset-muscle', group: 'CT' },
  { value: 'volumePreset:vesselOutline', label: 'Vessel Outline', icon: 'volume-preset-cardiac', group: 'CT' },
  { value: 'volumePreset:bone', label: 'Bone', icon: 'render-surface', group: 'CT' },
  { value: 'volumePreset:bones', label: 'Bones', icon: 'render-surface', group: 'CT' },
  { value: 'volumePreset:coronaryCta', label: 'Coronary CTA', icon: 'volume-preset-cardiac', group: 'CTA' },
  { value: 'volumePreset:bodyCta', label: 'Body CTA', icon: 'volume-preset-cardiac', group: 'CTA' },
  { value: 'volumePreset:neckCta', label: 'Neck CTA', icon: 'volume-preset-cardiac', group: 'CTA' },
  { value: 'volumePreset:mrDefault', label: 'MR-Default', icon: 'volume-preset-muscle', group: 'MR' },
  { value: 'volumePreset:mrMip', label: 'MR-MIP', icon: 'volume-preset-mip', group: 'MR' },
  { value: 'volumePreset:mrAngio', label: 'MR-Angio', icon: 'volume-preset-cardiac', group: 'MR' },
  { value: 'volumePreset:cbctRealist', label: 'CBCT-Realist', icon: 'render-surface', group: 'CBCT' },
  { value: 'volumePreset:cbctBone', label: 'CBCT-Bone', icon: 'render-surface', group: 'CBCT' },
  { value: 'volumePreset:cbctBone2', label: 'CBCT-Bone2', icon: 'render-surface', group: 'CBCT' }
]

const PRESET_DEFINITIONS: Record<string, PresetDefinition> = {
  bone: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: {
        ww: 820,
        wl: 360,
        opacity: 0.96,
        colorStart: '#e8dcc8',
        colorEnd: '#ffffff'
      },
      softTissue: {
        ww: 430,
        wl: 55,
        opacity: 0.075,
        colorStart: '#d6a18a',
        colorEnd: '#f0d8c9'
      }
    },
    lighting: {
      shading: true,
      interpolation: 'linear',
      ambient: 0.08,
      diffuse: 0.9,
      specular: 0.32,
      roughness: 0.52
    }
  },
  aaa: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'blood', 'muscle', 'softTissue'],
    overrides: {
      bone: {
        ww: 560,
        wl: 330,
        opacity: 0.58,
        colorStart: '#f2f2f2',
        colorEnd: '#ffffff'
      },
      blood: {
        ww: 150,
        wl: 160,
        opacity: 0.52,
        colorStart: '#9d0b0b',
        colorEnd: '#ff3b1f'
      },
      muscle: {
        ww: 260,
        wl: 125,
        opacity: 0.38,
        colorStart: '#d7784a',
        colorEnd: '#ffc090'
      },
      softTissue: {
        ww: 300,
        wl: 130,
        opacity: 0.44,
        colorStart: '#8f2d18',
        colorEnd: '#e89b64'
      }
    },
    lighting: {
      shading: true,
      interpolation: 'linear',
      ambient: 0.38,
      diffuse: 0.62,
      specular: 0.08,
      roughness: 0.92
    }
  },
  red: {
    blendMode: 'composite',
    enabledKeys: ['bone'],
    overrides: {
      bone: {
        ww: 442,
        wl: 115,
        opacity: 1.0,
        colorStart: '#c31616',
        colorEnd: '#ff6666'
      }
    },
    lighting: {
      shading: true,
      interpolation: 'linear',
      ambient: 0.14,
      diffuse: 0.88,
      specular: 0.16,
      roughness: 0.8
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
  },
  xray: {
    blendMode: 'mip',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 1200, wl: 460, opacity: 0.78, colorStart: '#5b6470', colorEnd: '#ffffff' },
      softTissue: { ww: 650, wl: 80, opacity: 0.1, colorStart: '#2d333a', colorEnd: '#b8c0cc' }
    },
    lighting: { shading: false, interpolation: 'linear', ambient: 1, diffuse: 0, specular: 0, roughness: 1 }
  },
  carotid: {
    blendMode: 'composite',
    enabledKeys: ['blood', 'bone', 'softTissue'],
    overrides: {
      blood: { ww: 260, wl: 240, opacity: 0.72, colorStart: '#f6c45b', colorEnd: '#fff6d2' },
      bone: { ww: 900, wl: 500, opacity: 0.42, colorStart: '#e8e8e8', colorEnd: '#ffffff' },
      softTissue: { ww: 420, wl: 80, opacity: 0.12, colorStart: '#4a1c14', colorEnd: '#a86745' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.18, diffuse: 0.78, specular: 0.28, roughness: 0.64 }
  },
  coronaryCta: {
    blendMode: 'composite',
    enabledKeys: ['blood', 'bone', 'softTissue'],
    overrides: {
      blood: { ww: 260, wl: 240, opacity: 0.72, colorStart: '#f6c45b', colorEnd: '#fff6d2' },
      bone: { ww: 900, wl: 500, opacity: 0.42, colorStart: '#e8e8e8', colorEnd: '#ffffff' },
      softTissue: { ww: 420, wl: 80, opacity: 0.12, colorStart: '#4a1c14', colorEnd: '#a86745' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.18, diffuse: 0.78, specular: 0.28, roughness: 0.64 }
  },
  bodyCta: {
    blendMode: 'composite',
    enabledKeys: ['blood', 'bone', 'softTissue'],
    overrides: {
      blood: { ww: 260, wl: 240, opacity: 0.72, colorStart: '#f6c45b', colorEnd: '#fff6d2' },
      bone: { ww: 900, wl: 500, opacity: 0.42, colorStart: '#e8e8e8', colorEnd: '#ffffff' },
      softTissue: { ww: 420, wl: 80, opacity: 0.12, colorStart: '#4a1c14', colorEnd: '#a86745' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.18, diffuse: 0.78, specular: 0.28, roughness: 0.64 }
  },
  neckCta: {
    blendMode: 'composite',
    enabledKeys: ['blood', 'bone', 'softTissue'],
    overrides: {
      blood: { ww: 260, wl: 240, opacity: 0.72, colorStart: '#f6c45b', colorEnd: '#fff6d2' },
      bone: { ww: 900, wl: 500, opacity: 0.42, colorStart: '#e8e8e8', colorEnd: '#ffffff' },
      softTissue: { ww: 420, wl: 80, opacity: 0.12, colorStart: '#4a1c14', colorEnd: '#a86745' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.18, diffuse: 0.78, specular: 0.28, roughness: 0.64 }
  },
  vesselOutline: {
    blendMode: 'composite',
    enabledKeys: ['blood'],
    overrides: {
      blood: { ww: 220, wl: 210, opacity: 0.86, colorStart: '#ffe9a8', colorEnd: '#ffffff' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.22, diffuse: 0.62, specular: 0.36, roughness: 0.58 }
  },
  bonePlusPlate: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 980, wl: 470, opacity: 0.92, colorStart: '#d6c4a6', colorEnd: '#ffffff' },
      softTissue: { ww: 460, wl: 70, opacity: 0.06, colorStart: '#b78872', colorEnd: '#efd6c5' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.08, diffuse: 0.9, specular: 0.34, roughness: 0.5 }
  },
  fracture: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 980, wl: 470, opacity: 0.92, colorStart: '#d6c4a6', colorEnd: '#ffffff' },
      softTissue: { ww: 460, wl: 70, opacity: 0.06, colorStart: '#b78872', colorEnd: '#efd6c5' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.08, diffuse: 0.9, specular: 0.34, roughness: 0.5 }
  },
  lumbar: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 980, wl: 470, opacity: 0.9, colorStart: '#d6c4a6', colorEnd: '#ffffff' },
      softTissue: { ww: 460, wl: 70, opacity: 0.06, colorStart: '#b78872', colorEnd: '#efd6c5' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.08, diffuse: 0.9, specular: 0.34, roughness: 0.5 }
  },
  hardware: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 980, wl: 470, opacity: 0.78, colorStart: '#d6c4a6', colorEnd: '#ffffff' },
      softTissue: { ww: 460, wl: 70, opacity: 0.06, colorStart: '#b78872', colorEnd: '#efd6c5' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.08, diffuse: 0.9, specular: 0.46, roughness: 0.38 }
  },
  bones: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 980, wl: 470, opacity: 0.92, colorStart: '#d6c4a6', colorEnd: '#ffffff' },
      softTissue: { ww: 460, wl: 70, opacity: 0.06, colorStart: '#b78872', colorEnd: '#efd6c5' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.08, diffuse: 0.9, specular: 0.34, roughness: 0.5 }
  },
  lung: {
    blendMode: 'composite',
    enabledKeys: ['lung', 'bone'],
    overrides: {
      lung: { ww: 1550, wl: -610, opacity: 0.32, colorStart: '#28435a', colorEnd: '#d9f1ff' },
      bone: { ww: 1000, wl: 430, opacity: 0.28, colorStart: '#d9d9d9', colorEnd: '#ffffff' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.26, diffuse: 0.68, specular: 0.08, roughness: 0.9 }
  },
  lung2: {
    blendMode: 'composite',
    enabledKeys: ['lung', 'bone', 'softTissue'],
    overrides: {
      lung: { ww: 1550, wl: -610, opacity: 0.32, colorStart: '#28435a', colorEnd: '#d9f1ff' },
      bone: { ww: 1000, wl: 430, opacity: 0.28, colorStart: '#d9d9d9', colorEnd: '#ffffff' },
      softTissue: { ww: 420, wl: 45, opacity: 0.08, colorStart: '#5d3024', colorEnd: '#d5a58b' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.26, diffuse: 0.68, specular: 0.08, roughness: 0.9 }
  },
  lung3: {
    blendMode: 'composite',
    enabledKeys: ['lung'],
    overrides: {
      lung: { ww: 1550, wl: -610, opacity: 0.32, colorStart: '#28435a', colorEnd: '#d9f1ff' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.26, diffuse: 0.68, specular: 0.08, roughness: 0.9 }
  },
  renalsStomach: {
    blendMode: 'composite',
    enabledKeys: ['muscle', 'softTissue'],
    overrides: {
      muscle: { ww: 320, wl: 55, opacity: 0.46, colorStart: '#d7b09e', colorEnd: '#8d4b3b' },
      softTissue: { ww: 420, wl: 70, opacity: 0.26, colorStart: '#f0d0bd', colorEnd: '#aa6a55' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.18, diffuse: 0.78, specular: 0.1, roughness: 0.88 }
  },
  mrDefault: {
    blendMode: 'composite',
    enabledKeys: ['muscle', 'softTissue'],
    overrides: {
      muscle: { ww: 1, wl: 0.55, opacity: 0.46, colorStart: '#d7b09e', colorEnd: '#8d4b3b' },
      softTissue: { ww: 1, wl: 0.62, opacity: 0.26, colorStart: '#f0d0bd', colorEnd: '#aa6a55' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.18, diffuse: 0.78, specular: 0.1, roughness: 0.88 }
  },
  mrMip: {
    blendMode: 'mip',
    enabledKeys: ['custom'],
    overrides: {
      custom: { ww: 1, wl: 0.82, opacity: 0.72, colorStart: '#b9c8ff', colorEnd: '#ffffff' }
    },
    lighting: { shading: false, interpolation: 'linear', ambient: 1, diffuse: 0, specular: 0, roughness: 1 }
  },
  mrAngio: {
    blendMode: 'mip',
    enabledKeys: ['custom', 'blood'],
    overrides: {
      custom: { ww: 1, wl: 0.82, opacity: 0.72, colorStart: '#b9c8ff', colorEnd: '#ffffff' },
      blood: { ww: 1, wl: 0.72, opacity: 0.76, colorStart: '#dce9ff', colorEnd: '#ffffff' }
    },
    lighting: { shading: false, interpolation: 'linear', ambient: 1, diffuse: 0, specular: 0, roughness: 1 }
  },
  cbctRealist: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 850, wl: 360, opacity: 0.86, colorStart: '#d9c2a4', colorEnd: '#fff8ec' },
      softTissue: { ww: 380, wl: 70, opacity: 0.12, colorStart: '#b18472', colorEnd: '#e5c7b3' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.16, diffuse: 0.82, specular: 0.24, roughness: 0.64 }
  },
  cbctBone: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 980, wl: 470, opacity: 0.92, colorStart: '#d6c4a6', colorEnd: '#ffffff' },
      softTissue: { ww: 460, wl: 70, opacity: 0.06, colorStart: '#b78872', colorEnd: '#efd6c5' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.08, diffuse: 0.9, specular: 0.34, roughness: 0.5 }
  },
  cbctBone2: {
    blendMode: 'composite',
    enabledKeys: ['bone', 'softTissue'],
    overrides: {
      bone: { ww: 980, wl: 470, opacity: 0.98, colorStart: '#d6c4a6', colorEnd: '#ffffff' },
      softTissue: { ww: 460, wl: 70, opacity: 0.06, colorStart: '#b78872', colorEnd: '#efd6c5' }
    },
    lighting: { shading: true, interpolation: 'linear', ambient: 0.08, diffuse: 0.9, specular: 0.34, roughness: 0.5 }
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
  const preset = (value ?? 'bone').trim().toLowerCase()
  if (preset.includes(':')) {
    return normalizeVolumePresetKey(preset.split(':', 2)[1])
  }
  const alias = preset.replace(/[_\s]+/g, '-')
  const aliases: Record<string, string> = {
    volume: 'bone',
    'ct-bone': 'bone',
    'cardiac-muscle': 'cardiac',
    xray: 'xray',
    'x-ray': 'xray',
    boneplusplate: 'bonePlusPlate',
    'bone-plus-plate': 'bonePlusPlate',
    boneplate: 'bonePlusPlate',
    spine: 'lumbar',
    metal: 'hardware',
    implant: 'hardware',
    'lung-2': 'lung2',
    'lung-3': 'lung3',
    'renals-stomach': 'renalsStomach',
    'renal-stomach': 'renalsStomach',
    renalsstomach: 'renalsStomach',
    'vessel-outline': 'vesselOutline',
    vesseloutline: 'vesselOutline',
    coronarycta: 'coronaryCta',
    'coronary-cta': 'coronaryCta',
    bodycta: 'bodyCta',
    'body-cta': 'bodyCta',
    neckcta: 'neckCta',
    'neck-cta': 'neckCta',
    mrdefault: 'mrDefault',
    'mr-default': 'mrDefault',
    mrmip: 'mrMip',
    'mr-mip': 'mrMip',
    mrangio: 'mrAngio',
    'mr-angio': 'mrAngio',
    mra: 'mrAngio',
    cbctrealist: 'cbctRealist',
    'cbct-realist': 'cbctRealist',
    cbctbone: 'cbctBone',
    'cbct-bone': 'cbctBone',
    cbctbone2: 'cbctBone2',
    'cbct-bone2': 'cbctBone2',
    'cbct-bone-2': 'cbctBone2'
  }
  const normalized = aliases[alias] ?? alias
  return PRESET_DEFINITIONS[normalized] ? normalized : 'bone'
}

export function createDefaultVolumeRenderConfig(presetValue: string | null | undefined = 'bone'): VolumeRenderConfig {
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
  fallbackPreset: string | null | undefined = 'bone'
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
      ww: Number.isFinite(Number(source.ww)) ? Number(source.ww) : fallbackLayer.ww,
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
