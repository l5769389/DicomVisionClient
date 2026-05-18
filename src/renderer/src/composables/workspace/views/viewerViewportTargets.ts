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
  return viewType === 'Stack' || viewType === 'CompareStack'
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
  return tab.viewId
}

export function hasOperableView(tab: ViewerTabItem): boolean {
  if (isMprLikeViewType(tab.viewType)) {
    return Object.values(tab.viewportViewIds ?? {}).some(Boolean)
  }
  if (tab.viewType === 'CompareStack') {
    return Object.values(tab.compareViewIds ?? {}).some(Boolean)
  }
  return Boolean(tab.viewId)
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
  if (tab.viewType !== 'CompareStack') {
    const viewId = resolveViewIdForTabViewport(tab, viewportKey)
    return viewId ? [viewId] : []
  }

  return resolveCompareOperationPaneKeys(tab, viewportKey, opType)
    .map((paneKey) => tab.compareViewIds?.[paneKey] ?? '')
    .filter((viewId): viewId is string => Boolean(viewId))
}
