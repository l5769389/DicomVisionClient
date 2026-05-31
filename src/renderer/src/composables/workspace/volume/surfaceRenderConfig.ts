import type { Render3DMode, SurfaceRenderConfig } from '../../../types/viewer'

export function normalizeRender3DMode(value: unknown): Render3DMode {
  return value === 'surface' ? 'surface' : 'volume'
}

export function createDefaultSurfaceRenderConfig(): SurfaceRenderConfig {
  return {
    preset: 'bone',
    isoValue: 240,
    smoothing: 0.28,
    decimation: 0.18,
    color: '#f3eadb',
    ambient: 0.2,
    diffuse: 0.76,
    specular: 0.36,
    roughness: 0.34
  }
}

export function normalizeSurfaceRenderConfig(value: unknown): SurfaceRenderConfig {
  const fallback = createDefaultSurfaceRenderConfig()
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const record = value as Record<string, unknown>
  return {
    preset: typeof record.preset === 'string' && record.preset.trim() ? record.preset.trim() : fallback.preset,
    isoValue: normalizeNumber(record.isoValue, fallback.isoValue, -2000, 4000),
    smoothing: normalizeNumber(record.smoothing, fallback.smoothing, 0, 1),
    decimation: normalizeNumber(record.decimation, fallback.decimation, 0, 0.9),
    color: normalizeColor(typeof record.color === 'string' ? record.color : undefined, fallback.color),
    ambient: normalizeNumber(record.ambient, fallback.ambient, 0, 1),
    diffuse: normalizeNumber(record.diffuse, fallback.diffuse, 0, 1),
    specular: normalizeNumber(record.specular, fallback.specular, 0, 1),
    roughness: normalizeNumber(record.roughness, fallback.roughness, 0, 1)
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
