import type { MontageTransformInfo } from '../../../types/viewer'

export const MONTAGE_ZOOM_MIN = 0.25
export const MONTAGE_ZOOM_MAX = 10

export const DEFAULT_MONTAGE_TRANSFORM: MontageTransformInfo = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0
}

function finiteOrFallback(value: unknown, fallback: number): number {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

export function clampMontageZoom(value: unknown): number {
  return Math.max(MONTAGE_ZOOM_MIN, Math.min(MONTAGE_ZOOM_MAX, finiteOrFallback(value, 1)))
}

export function normalizeMontageTransform(
  value: Partial<MontageTransformInfo> | null | undefined
): MontageTransformInfo {
  const zoom = clampMontageZoom(value?.zoom)
  const maxOffset = Math.max(0.5, (zoom - 1) / 2)
  return {
    zoom,
    offsetX: Math.max(-maxOffset, Math.min(maxOffset, finiteOrFallback(value?.offsetX, 0))),
    offsetY: Math.max(-maxOffset, Math.min(maxOffset, finiteOrFallback(value?.offsetY, 0)))
  }
}

export function resetMontageTransform(
  value: Partial<MontageTransformInfo> | null | undefined,
  scope: 'all' | 'pan' | 'zoom'
): MontageTransformInfo {
  const current = normalizeMontageTransform(value)
  if (scope === 'pan') {
    return {
      ...current,
      offsetX: 0,
      offsetY: 0
    }
  }
  if (scope === 'zoom') {
    return DEFAULT_MONTAGE_TRANSFORM
  }
  return DEFAULT_MONTAGE_TRANSFORM
}

export function applyMontagePanDrag(
  origin: Partial<MontageTransformInfo> | null | undefined,
  deltaX: number,
  deltaY: number,
  tileSize: number
): MontageTransformInfo {
  const current = normalizeMontageTransform(origin)
  const normalizedTileSize = Math.max(1, finiteOrFallback(tileSize, 1))
  return normalizeMontageTransform({
    ...current,
    offsetX: current.offsetX + finiteOrFallback(deltaX, 0) / normalizedTileSize,
    offsetY: current.offsetY + finiteOrFallback(deltaY, 0) / normalizedTileSize
  })
}

export function applyMontageZoomDrag(
  origin: Partial<MontageTransformInfo> | null | undefined,
  deltaY: number
): MontageTransformInfo {
  const current = normalizeMontageTransform(origin)
  return normalizeMontageTransform({
    ...current,
    zoom: current.zoom * Math.exp(-finiteOrFallback(deltaY, 0) / 180)
  })
}
