import { VIEW_OPERATION_TYPES, type ViewOperationType } from '@shared/viewerConstants'
import type { CompareStackPaneKey, MprViewportKey, ViewerTabItem } from '../../../types/viewer'
import {
  COMPARE_STACK_SOURCE_PANE_KEY,
  COMPARE_STACK_TARGET_PANE_KEY,
  isCompareStackPaneKey,
  isMprViewportKey
} from './viewerWorkspaceTabs'

export { COMPARE_STACK_SOURCE_PANE_KEY, COMPARE_STACK_TARGET_PANE_KEY } from './viewerWorkspaceTabs'

export const MPR_PRIMARY_VIEWPORT_KEY: MprViewportKey = 'mpr-ax'

export function isMprLikeViewType(viewType: ViewerTabItem['viewType'] | undefined): boolean {
  return viewType === 'MPR' || viewType === '4D'
}

export function isStackLikeViewType(viewType: ViewerTabItem['viewType'] | undefined): boolean {
  return viewType === 'Stack' || viewType === 'CompareStack' || viewType === 'Layout'
}

export function resolveMprViewportKey(viewportKey: string): MprViewportKey {
  return isMprViewportKey(viewportKey) ? viewportKey : MPR_PRIMARY_VIEWPORT_KEY
}

export function resolveComparePaneKey(viewportKey: string): CompareStackPaneKey {
  return isCompareStackPaneKey(viewportKey) ? viewportKey : COMPARE_STACK_SOURCE_PANE_KEY
}

export function resolveViewIdForTabViewport(tab: ViewerTabItem, viewportKey: string): string {
  if (isMprLikeViewType(tab.viewType)) {
    return tab.viewportViewIds?.[resolveMprViewportKey(viewportKey)] ?? ''
  }
  if (tab.viewType === 'CompareStack') {
    return tab.compareViewIds?.[resolveComparePaneKey(viewportKey)] ?? ''
  }
  if (tab.viewType === 'Layout') {
    return resolveLayoutSlot(tab, viewportKey)?.viewId ?? ''
  }
  return tab.viewId
}

export function hasOperableView(tab: ViewerTabItem): boolean {
  if (isMprLikeViewType(tab.viewType)) {
    return Object.values(tab.viewportViewIds ?? {}).some(Boolean)
  }
  if (tab.viewType === 'CompareStack') {
    return Object.values(tab.compareViewIds ?? {}).some(Boolean)
  }
  if (tab.viewType === 'Layout') {
    return (tab.layoutSlots ?? []).some((slot) => Boolean(slot.viewId))
  }
  return Boolean(tab.viewId)
}

function resolveLayoutSlot(tab: ViewerTabItem, viewportKey: string) {
  const slots = tab.layoutSlots ?? []
  return slots.find((slot) => slot.id === viewportKey) ?? slots.find((slot) => Boolean(slot.viewId)) ?? null
}

function shouldSyncLayoutOperation(tab: ViewerTabItem, opType: ViewOperationType | string): boolean {
  if (opType === VIEW_OPERATION_TYPES.scroll) {
    return tab.layoutSyncScroll === true
  }
  if (opType === VIEW_OPERATION_TYPES.window) {
    return tab.layoutSyncWindow === true
  }
  if (opType === VIEW_OPERATION_TYPES.pseudocolor) {
    return tab.layoutSyncPseudocolor === true
  }
  if (opType === VIEW_OPERATION_TYPES.pan || opType === VIEW_OPERATION_TYPES.zoom) {
    return tab.layoutSyncView === true
  }
  if (opType === VIEW_OPERATION_TYPES.transform2d) {
    return tab.layoutSyncTransform === true
  }
  if (opType === VIEW_OPERATION_TYPES.reset) {
    return tab.layoutSyncReset === true
  }
  return false
}

function resolveLayoutOperationViewIds(
  tab: ViewerTabItem,
  viewportKey: string,
  opType: ViewOperationType | string
): string[] {
  const activeSlot = resolveLayoutSlot(tab, viewportKey)
  if (!activeSlot?.viewId) {
    return []
  }
  if (!shouldSyncLayoutOperation(tab, opType)) {
    return [activeSlot.viewId]
  }

  return [
    activeSlot.viewId,
    ...(tab.layoutSlots ?? [])
      .filter((slot) => slot.id !== activeSlot.id)
      .map((slot) => slot.viewId ?? '')
      .filter((viewId): viewId is string => Boolean(viewId))
  ]
}

export function shouldSyncCompareOperation(tab: ViewerTabItem, opType: ViewOperationType | string): boolean {
  if (opType === VIEW_OPERATION_TYPES.scroll) {
    return tab.compareSyncScroll !== false
  }
  if (opType === VIEW_OPERATION_TYPES.window) {
    return tab.compareSyncWindow !== false
  }
  if (opType === VIEW_OPERATION_TYPES.pseudocolor) {
    return tab.compareSyncPseudocolor !== false
  }
  if (opType === VIEW_OPERATION_TYPES.pan || opType === VIEW_OPERATION_TYPES.zoom) {
    return tab.compareSyncView !== false
  }
  if (opType === VIEW_OPERATION_TYPES.transform2d) {
    return tab.compareSyncTransform === true
  }
  if (opType === VIEW_OPERATION_TYPES.reset) {
    return tab.compareSyncReset !== false
  }
  return false
}

export function resolveCompareOperationPaneKeys(
  tab: ViewerTabItem,
  viewportKey: string,
  opType: ViewOperationType | string
): CompareStackPaneKey[] {
  const paneKey = resolveComparePaneKey(viewportKey)
  if (tab.viewType !== 'CompareStack' || !shouldSyncCompareOperation(tab, opType)) {
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
  if (tab.viewType === 'Layout') {
    return resolveLayoutOperationViewIds(tab, viewportKey, opType)
  }

  if (tab.viewType !== 'CompareStack') {
    const viewId = resolveViewIdForTabViewport(tab, viewportKey)
    return viewId ? [viewId] : []
  }

  return resolveCompareOperationPaneKeys(tab, viewportKey, opType)
    .map((paneKey) => tab.compareViewIds?.[paneKey] ?? '')
    .filter((viewId): viewId is string => Boolean(viewId))
}
