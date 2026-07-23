import type { ViewOperationType } from '@shared/viewerConstants'
import type { CompareStackPaneKey, FusionPaneKey, MprViewportKey, ViewerTabItem } from '../../../types/viewer'
import {
  COMPARE_STACK_SOURCE_PANE_KEY,
  COMPARE_STACK_TARGET_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  isCompareStackPaneKey,
  isFusionPaneKey,
  isMprViewportKey
} from './viewerWorkspaceTabs'
import { shouldSyncViewOperation } from '../sync/viewSyncConfig'

export { COMPARE_STACK_SOURCE_PANE_KEY, COMPARE_STACK_TARGET_PANE_KEY } from './viewerWorkspaceTabs'

export const MPR_PRIMARY_VIEWPORT_KEY: MprViewportKey = 'mpr-ax'

export type ViewportOperationTargetKind = 'single' | 'compare' | 'layout' | 'mpr' | 'mpr-volume' | 'fusion'

export interface ViewportOperationTarget {
  viewId: string
  viewportKey: string
  kind: ViewportOperationTargetKind
}

export function isMprLikeViewType(viewType: ViewerTabItem['viewType'] | undefined): boolean {
  return viewType === 'MPR' || viewType === '4D'
}

export function isStackLikeViewType(viewType: ViewerTabItem['viewType'] | undefined): boolean {
  return viewType === 'Stack' || viewType === 'PET' || viewType === 'CompareStack' || viewType === 'Layout' || viewType === 'PETCTFusion'
}

export function usesContinuousDragPreview(tab: ViewerTabItem, viewportKey: string): boolean {
  if (tab.viewType === '3D' || isMprLikeViewType(tab.viewType)) {
    return true
  }
  if (tab.viewType !== 'Layout') {
    return false
  }
  const slot = tab.layoutSlots?.find((item) => item.id === viewportKey)
  return Boolean(slot?.viewId && (slot.viewType === '3D' || slot.sourceViewType === '3D'))
}

export function resolveMprViewportKey(viewportKey: string): MprViewportKey {
  return isMprViewportKey(viewportKey) ? viewportKey : MPR_PRIMARY_VIEWPORT_KEY
}

export function resolveComparePaneKey(viewportKey: string): CompareStackPaneKey {
  return isCompareStackPaneKey(viewportKey) ? viewportKey : COMPARE_STACK_SOURCE_PANE_KEY
}

export function resolveFusionPaneKey(viewportKey: string): FusionPaneKey {
  return isFusionPaneKey(viewportKey) ? viewportKey : FUSION_OVERLAY_AXIAL_PANE_KEY
}

export function resolveViewIdForTabViewport(tab: ViewerTabItem, viewportKey: string): string {
  if (isMprLikeViewType(tab.viewType)) {
    if (tab.viewType === 'MPR' && viewportKey === 'volume') {
      return tab.viewId
    }
    return tab.viewportViewIds?.[resolveMprViewportKey(viewportKey)] ?? ''
  }
  if (tab.viewType === 'CompareStack') {
    return tab.compareViewIds?.[resolveComparePaneKey(viewportKey)] ?? ''
  }
  if (tab.viewType === 'PETCTFusion') {
    return tab.fusionViewIds?.[resolveFusionPaneKey(viewportKey)] ?? ''
  }
  if (tab.viewType === 'Layout') {
    return resolveLayoutSlotForViewport(tab, viewportKey)?.viewId ?? ''
  }
  return tab.viewId
}

export function hasOperableView(tab: ViewerTabItem): boolean {
  if (isMprLikeViewType(tab.viewType)) {
    return Object.values(tab.viewportViewIds ?? {}).some(Boolean) || Boolean(tab.viewType === 'MPR' && tab.viewId)
  }
  if (tab.viewType === 'CompareStack') {
    return Object.values(tab.compareViewIds ?? {}).some(Boolean)
  }
  if (tab.viewType === 'PETCTFusion') {
    return Object.values(tab.fusionViewIds ?? {}).some(Boolean)
  }
  if (tab.viewType === 'Layout') {
    return (tab.layoutSlots ?? []).some((slot) => Boolean(slot.viewId))
  }
  return Boolean(tab.viewId)
}

export function resolveLayoutSlotForViewport(tab: ViewerTabItem, viewportKey: string) {
  const slots = tab.layoutSlots ?? []
  return slots.find((slot) => slot.id === viewportKey) ?? slots.find((slot) => Boolean(slot.viewId)) ?? null
}

export function resolveCompareOperationPaneKeys(
  tab: ViewerTabItem,
  viewportKey: string,
  opType: ViewOperationType | string
): CompareStackPaneKey[] {
  const paneKey = resolveComparePaneKey(viewportKey)
  if (tab.viewType !== 'CompareStack' || !shouldSyncViewOperation(tab, opType)) {
    return [paneKey]
  }

  return paneKey === COMPARE_STACK_SOURCE_PANE_KEY
    ? [COMPARE_STACK_SOURCE_PANE_KEY, COMPARE_STACK_TARGET_PANE_KEY]
    : [COMPARE_STACK_TARGET_PANE_KEY, COMPARE_STACK_SOURCE_PANE_KEY]
}

export function resolveCompareOperationViewIds(
  tab: ViewerTabItem,
  viewportKey: string,
  opType: ViewOperationType | string
): string[] {
  return resolveOperationTargets(tab, viewportKey, opType).map((target) => target.viewId)
}

export function resolveOperationTargets(
  tab: ViewerTabItem,
  viewportKey: string,
  opType: ViewOperationType | string
): ViewportOperationTarget[] {
  if (tab.viewType === 'Layout') {
    const activeSlot = resolveLayoutSlotForViewport(tab, viewportKey)
    if (!activeSlot?.viewId) {
      return []
    }

    const slots = shouldSyncViewOperation(tab, opType)
      ? [
          activeSlot,
          ...(tab.layoutSlots ?? []).filter((slot) => slot.id !== activeSlot.id && Boolean(slot.viewId))
        ]
      : [activeSlot]

    return slots.flatMap((slot): ViewportOperationTarget[] =>
      slot.viewId
        ? [
            {
              viewId: slot.viewId,
              viewportKey: slot.id,
              kind: 'layout'
            }
          ]
        : []
    )
  }

  if (tab.viewType !== 'CompareStack') {
    const viewId = resolveViewIdForTabViewport(tab, viewportKey)
    if (!viewId) {
      return []
    }

    return [
      {
        viewId,
        viewportKey: tab.viewType === 'PETCTFusion'
          ? resolveFusionPaneKey(viewportKey)
          : isMprLikeViewType(tab.viewType)
          ? tab.viewType === 'MPR' && viewportKey === 'volume'
            ? 'volume'
            : resolveMprViewportKey(viewportKey)
          : viewportKey || 'single',
        kind: tab.viewType === 'PETCTFusion'
          ? 'fusion'
          : isMprLikeViewType(tab.viewType)
          ? tab.viewType === 'MPR' && viewportKey === 'volume'
            ? 'mpr-volume'
            : 'mpr'
          : 'single'
      }
    ]
  }

  return resolveCompareOperationPaneKeys(tab, viewportKey, opType)
    .flatMap((paneKey): ViewportOperationTarget[] => {
      const viewId = tab.compareViewIds?.[paneKey] ?? ''
      return viewId
        ? [
            {
              viewId,
              viewportKey: paneKey,
              kind: 'compare'
            }
          ]
        : []
    })
}
