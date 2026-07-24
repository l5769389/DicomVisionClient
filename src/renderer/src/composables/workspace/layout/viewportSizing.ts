import type { MprLayoutKey, ViewerTabItem } from '../../../types/viewer'

export function resolveMprLayoutAspectRatio(layoutKey: MprLayoutKey): number {
  if (layoutKey === 'three-columns') {
    return 3
  }
  if (layoutKey === 'three-rows') {
    return 1 / 3
  }
  return 1
}

export function resolveViewportFrameAspectRatio(
  tab: ViewerTabItem | null | undefined,
  mprLayoutKey: MprLayoutKey
): number | null {
  if (!tab || tab.viewType === 'Tag') {
    return null
  }
  if (tab.viewType === 'CompareStack') {
    return 2
  }
  if (tab.viewType === 'MPR' || tab.viewType === '4D') {
    return resolveMprLayoutAspectRatio(mprLayoutKey)
  }
  if (tab.viewType === 'Layout') {
    const rows = Math.max(1, Number(tab.layoutTemplate?.rows ?? 1))
    const columns = Math.max(1, Number(tab.layoutTemplate?.columns ?? 1))
    return columns / rows
  }
  return 1
}

export function buildViewportFrameStyle(
  autoFitEnabled: boolean,
  aspectRatio: number | null
): Record<string, string> {
  if (autoFitEnabled || aspectRatio == null || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return {
      width: '100%',
      height: '100%'
    }
  }
  return {
    '--viewer-fixed-aspect-ratio': String(aspectRatio),
    aspectRatio: String(aspectRatio),
    maxWidth: '100%',
    maxHeight: '100%'
  }
}
