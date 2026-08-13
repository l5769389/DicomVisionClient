import { normalizePseudocolorPresetKey } from '../../../constants/pseudocolor'
import type { ViewerTabItem, WindowLevelInfo } from '../../../types/viewer'

const CT_MONTAGE_WINDOW_WIDTH_MIN = 1
const PET_MONTAGE_WINDOW_WIDTH_MIN = 0.000001

export function normalizeMontageWindowInfo(
  windowInfo: WindowLevelInfo | null | undefined,
  isPet = false
): WindowLevelInfo | null {
  const ww = Number(windowInfo?.ww)
  const wl = Number(windowInfo?.wl)
  return Number.isFinite(ww) && Number.isFinite(wl)
    ? { ww: Math.max(isPet ? PET_MONTAGE_WINDOW_WIDTH_MIN : CT_MONTAGE_WINDOW_WIDTH_MIN, ww), wl }
    : null
}

export function advanceMontageDisplayRevision(tab: ViewerTabItem): ViewerTabItem {
  return {
    ...tab,
    montageDisplayRevision: Math.max(0, Math.trunc(tab.montageDisplayRevision ?? 0)) + 1
  }
}

export function applyMontageWindowInfoToTab(
  tab: ViewerTabItem,
  windowInfo: WindowLevelInfo,
  options: { seedInitial?: boolean } = {}
): ViewerTabItem {
  const isPet = Boolean(tab.petInfo)
  const normalized = normalizeMontageWindowInfo(windowInfo, isPet)
  if (!normalized) {
    return tab
  }
  const { ww, wl } = normalized
  const initialWindowInfo = options.seedInitial === false
    ? tab.initialWindowInfo
    : normalizeMontageWindowInfo(tab.initialWindowInfo, isPet) ?? normalized
  const petWindowMin = wl - ww / 2
  const petWindowMax = wl + ww / 2
  const petUnitLabel = tab.petInfo?.petUnitLabel ?? tab.petInfo?.petUnit ?? 'PET'
  return {
    ...tab,
    initialWindowInfo,
    currentWindowInfo: normalized,
    windowLabel: isPet
      ? `${petUnitLabel} ${petWindowMin.toFixed(2)}-${petWindowMax.toFixed(2)}`
      : `WW ${Math.round(ww)} / WL ${Math.round(wl)}`,
    ...(tab.petInfo
      ? {
          petInfo: {
            ...tab.petInfo,
            petWindowMin,
            petWindowMax
          }
        }
      : {}),
    cornerInfo: {
      ...tab.cornerInfo,
      tags: {
        ...(tab.cornerInfo.tags ?? {}),
        windowLevel: isPet ? [] : [`W: ${Math.round(ww)} L: ${Math.round(wl)}`]
      }
    }
  }
}

export function commitMontageWindowInfo(
  tab: ViewerTabItem,
  windowInfo: WindowLevelInfo,
  options: { seedInitial?: boolean } = {}
): ViewerTabItem {
  return advanceMontageDisplayRevision(applyMontageWindowInfoToTab(tab, windowInfo, options))
}

export function commitMontagePseudocolor(tab: ViewerTabItem, preset: string): ViewerTabItem {
  const pseudocolorPreset = normalizePseudocolorPresetKey(preset)
  return advanceMontageDisplayRevision({
    ...tab,
    pseudocolorPreset,
    ...(tab.petInfo
      ? {
          petInfo: {
            ...tab.petInfo,
            pseudocolorPreset
          }
        }
      : {})
  })
}
