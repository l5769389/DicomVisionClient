import { DEFAULT_PSEUDOCOLOR_PRESET } from '../../../constants/pseudocolor'
import type { FusionPaneKey, MprViewportKey, ViewTransformInfo, ViewerTabItem } from '../../../types/viewer'
import {
  createEmptyComparePseudocolorPresets,
  createEmptyCompareTransformStates,
  createEmptyFusionPseudocolorPresets,
  createEmptyFusionTransformStates,
  createEmptyMprPseudocolorPresets,
  createEmptyMprTransformStates,
  isCompareStackPaneKey,
  isFusionPaneKey,
  isMprViewportKey
} from '../views/viewerWorkspaceTabs'
import type { ViewportOperationTarget } from '../views/viewerViewportTargets'

function targetViewportKeys(targets: ViewportOperationTarget[]): Set<string> {
  return new Set(targets.map((target) => target.viewportKey))
}

export function applyTransformToTabTargets(
  tab: ViewerTabItem,
  targets: ViewportOperationTarget[],
  transform: ViewTransformInfo
): ViewerTabItem {
  if (!targets.length) {
    return tab
  }

  const viewportKeys = targetViewportKeys(targets)

  if (tab.viewType === 'CompareStack') {
    const nextStates = {
      ...(tab.compareTransformStates ?? createEmptyCompareTransformStates())
    }
    viewportKeys.forEach((viewportKey) => {
      if (isCompareStackPaneKey(viewportKey)) {
        nextStates[viewportKey] = transform
      }
    })
    return {
      ...tab,
      compareTransformStates: nextStates
    }
  }

  if (tab.viewType === 'Layout') {
    return {
      ...tab,
      layoutSlots: (tab.layoutSlots ?? []).map((slot) =>
        viewportKeys.has(slot.id)
          ? {
              ...slot,
              transformState: transform
            }
          : slot
      )
    }
  }

  if (tab.viewType === 'PETCTFusion') {
    const nextStates = {
      ...(tab.fusionTransformStates ?? createEmptyFusionTransformStates())
    }
    viewportKeys.forEach((viewportKey) => {
      if (isFusionPaneKey(viewportKey)) {
        nextStates[viewportKey as FusionPaneKey] = transform
      }
    })
    return {
      ...tab,
      fusionTransformStates: nextStates
    }
  }

  if (tab.viewType === 'MPR' || tab.viewType === '4D') {
    const nextStates = {
      ...(tab.viewportTransformStates ?? createEmptyMprTransformStates())
    }
    viewportKeys.forEach((viewportKey) => {
      if (isMprViewportKey(viewportKey)) {
        nextStates[viewportKey] = transform
      }
    })
    return {
      ...tab,
      viewportTransformStates: nextStates
    }
  }

  return {
    ...tab,
    transformState: transform
  }
}

export function applyPseudocolorToTabTargets(
  tab: ViewerTabItem,
  targets: ViewportOperationTarget[],
  presetKey: string
): ViewerTabItem {
  if (!targets.length) {
    return tab
  }

  const viewportKeys = targetViewportKeys(targets)
  const viewIds = new Set(targets.map((target) => target.viewId))

  if (tab.viewType === 'CompareStack') {
    const nextPresets = {
      ...(tab.comparePseudocolorPresets ?? createEmptyComparePseudocolorPresets())
    }
    viewportKeys.forEach((viewportKey) => {
      if (isCompareStackPaneKey(viewportKey)) {
        nextPresets[viewportKey] = presetKey
      }
    })
    return {
      ...tab,
      comparePseudocolorPresets: nextPresets,
      pseudocolorPreset: presetKey
    }
  }

  if (tab.viewType === 'Layout') {
    return {
      ...tab,
      pseudocolorPreset: presetKey,
      layoutSlots: (tab.layoutSlots ?? []).map((slot) =>
        slot.viewId && viewIds.has(slot.viewId)
          ? {
              ...slot,
              pseudocolorPreset: presetKey
            }
          : slot
      )
    }
  }

  if (tab.viewType === 'PETCTFusion') {
    const nextPresets = {
      ...(tab.fusionPseudocolorPresets ?? createEmptyFusionPseudocolorPresets())
    }
    viewportKeys.forEach((viewportKey) => {
      if (isFusionPaneKey(viewportKey)) {
        nextPresets[viewportKey as FusionPaneKey] = presetKey
      }
    })
    return {
      ...tab,
      fusionPseudocolorPresets: nextPresets,
      pseudocolorPreset: presetKey
    }
  }

  if (tab.viewType === 'MPR' || tab.viewType === '4D') {
    const nextPresets = {
      ...(tab.viewportPseudocolorPresets ?? createEmptyMprPseudocolorPresets())
    }
    viewportKeys.forEach((viewportKey) => {
      if (isMprViewportKey(viewportKey)) {
        nextPresets[viewportKey] = presetKey
      }
    })
    return {
      ...tab,
      viewportPseudocolorPresets: nextPresets,
      pseudocolorPreset: presetKey
    }
  }

  return {
    ...tab,
    pseudocolorPreset: presetKey
  }
}

export function resetTabViewStateTargets(
  tab: ViewerTabItem,
  targets: ViewportOperationTarget[],
  defaultTransform: ViewTransformInfo
): ViewerTabItem {
  return applyPseudocolorToTabTargets(
    applyTransformToTabTargets(tab, targets, defaultTransform),
    targets,
    DEFAULT_PSEUDOCOLOR_PRESET
  )
}

export function resetMprViewportState(
  viewportKeys: MprViewportKey[],
  defaultTransform: ViewTransformInfo
): Pick<ViewerTabItem, 'viewportTransformStates' | 'viewportPseudocolorPresets'> {
  const viewportTransformStates = createEmptyMprTransformStates()
  const viewportPseudocolorPresets = createEmptyMprPseudocolorPresets()

  viewportKeys.forEach((viewportKey) => {
    viewportTransformStates[viewportKey] = defaultTransform
    viewportPseudocolorPresets[viewportKey] = DEFAULT_PSEUDOCOLOR_PRESET
  })

  return {
    viewportTransformStates,
    viewportPseudocolorPresets
  }
}
