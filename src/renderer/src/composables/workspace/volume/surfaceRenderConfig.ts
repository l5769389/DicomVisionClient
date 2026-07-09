import type { Render3DMode, SurfaceRenderConfig } from '../../../types/viewer'

const SURFACE_PRESET_DEFINITIONS: Record<string, SurfaceRenderConfig> = {
  bone: {
    preset: 'bone',
    isoValue: 240,
    smoothing: 0.28,
    decimation: 0.18,
    color: '#f3eadb',
    ambient: 0.2,
    diffuse: 0.76,
    specular: 0.36,
    roughness: 0.34
  },
  softTissue: {
    preset: 'softTissue',
    isoValue: 85,
    smoothing: 0.18,
    decimation: 0.08,
    color: '#b86642',
    ambient: 0.28,
    diffuse: 0.72,
    specular: 0.08,
    roughness: 0.86
  },
  highDensity: {
    preset: 'highDensity',
    isoValue: 420,
    smoothing: 0.22,
    decimation: 0.12,
    color: '#f8fafc',
    ambient: 0.16,
    diffuse: 0.82,
    specular: 0.46,
    roughness: 0.26
  }
}

export function normalizeRender3DMode(value: unknown): Render3DMode {
  return value === 'surface' ? 'surface' : 'volume'
}

export function createDefaultSurfaceRenderConfig(): SurfaceRenderConfig {
  return createSurfaceRenderPresetConfig('bone')
}

export function normalizeSurfacePresetKey(value: string | null | undefined): string {
  const preset = (value ?? 'bone').trim()
  const normalized = preset.includes(':') ? preset.split(':', 2)[1] ?? 'bone' : preset
  const key = normalized.trim().toLowerCase()
  if (key === 'softtissue' || key === 'soft-tissue' || key === 'soft_tissue' || key === 'soft tissue' || key === 'tissue') {
    return 'softTissue'
  }
  if (key === 'highdensity' || key === 'high-density' || key === 'high_density' || key === 'high density' || key === 'dense' || key === 'metal') {
    return 'highDensity'
  }
  return key === 'bone' || key === 'bones' || key === 'skull' || key === 'surface' ? 'bone' : 'bone'
}

export function createSurfaceRenderPresetConfig(presetValue: string | null | undefined): SurfaceRenderConfig {
  const preset = normalizeSurfacePresetKey(presetValue)
  return { ...SURFACE_PRESET_DEFINITIONS[preset] }
}

export function normalizeSurfaceRenderConfig(value: unknown, fallbackPreset: string | null | undefined = 'bone'): SurfaceRenderConfig {
  const fallback = createSurfaceRenderPresetConfig(fallbackPreset)
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const record = value as Record<string, unknown>
  const preset = normalizeSurfacePresetKey(typeof record.preset === 'string' ? record.preset : fallback.preset)
  const presetFallback = createSurfaceRenderPresetConfig(preset)
  return {
    preset,
    isoValue: normalizeNumber(record.isoValue, presetFallback.isoValue, -2000, 4000),
    smoothing: normalizeNumber(record.smoothing, presetFallback.smoothing, 0, 1),
    decimation: normalizeNumber(record.decimation, presetFallback.decimation, 0, 0.9),
    color: normalizeColor(typeof record.color === 'string' ? record.color : undefined, presetFallback.color),
    ambient: normalizeNumber(record.ambient, presetFallback.ambient, 0, 1),
    diffuse: normalizeNumber(record.diffuse, presetFallback.diffuse, 0, 1),
    specular: normalizeNumber(record.specular, presetFallback.specular, 0, 1),
    roughness: normalizeNumber(record.roughness, presetFallback.roughness, 0, 1)
  }
}

function normalizeNumber(value: unknown, fallback: number, lower: number, upper: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(lower, Math.min(upper, numeric))
}

function normalizeColor(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }
  const text = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback
}
