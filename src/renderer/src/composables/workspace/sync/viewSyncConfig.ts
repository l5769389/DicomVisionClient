import { VIEW_OPERATION_TYPES, type ViewOperationType } from '@shared/viewerConstants'
import type { CompareSyncSettingKey, ViewerTabItem } from '../../../types/viewer'

type SyncViewType = 'CompareStack' | 'Layout'

export interface ViewSyncOptionConfig {
  key: CompareSyncSettingKey
  value: string
  label: string
  icon: string
  description: string
}

export const VIEW_SYNC_OPTION_CONFIGS: ViewSyncOptionConfig[] = [
  { key: 'scroll', value: 'compare-sync:scroll', label: '翻页', icon: 'page', description: '同步切片滚动' },
  { key: 'window', value: 'compare-sync:window', label: '窗宽窗位', icon: 'window', description: '同步 WW / WL 调整' },
  { key: 'pseudocolor', value: 'compare-sync:pseudocolor', label: '伪彩', icon: 'pseudocolor', description: '同步伪彩方案' },
  { key: 'view', value: 'compare-sync:view', label: '缩放平移', icon: 'pan', description: '同步 zoom 和 pan' },
  { key: 'transform', value: 'compare-sync:transform', label: '旋转翻转', icon: 'rotate', description: '同步 90° 旋转和镜像翻转' },
  { key: 'reset', value: 'compare-sync:reset', label: 'Reset', icon: 'reset', description: '将 reset 应用到当前布局中的所有视图' }
]

export const COMPARE_SYNC_DEFAULTS: Record<CompareSyncSettingKey, boolean> = {
  scroll: true,
  window: true,
  pseudocolor: true,
  view: true,
  transform: false,
  reset: true
}

export const LAYOUT_SYNC_DEFAULTS: Record<CompareSyncSettingKey, boolean> = {
  scroll: false,
  window: false,
  pseudocolor: false,
  view: false,
  transform: false,
  reset: false
}

const compareSyncFields: Record<CompareSyncSettingKey, keyof ViewerTabItem> = {
  scroll: 'compareSyncScroll',
  window: 'compareSyncWindow',
  pseudocolor: 'compareSyncPseudocolor',
  view: 'compareSyncView',
  transform: 'compareSyncTransform',
  reset: 'compareSyncReset'
}

const layoutSyncFields: Record<CompareSyncSettingKey, keyof ViewerTabItem> = {
  scroll: 'layoutSyncScroll',
  window: 'layoutSyncWindow',
  pseudocolor: 'layoutSyncPseudocolor',
  view: 'layoutSyncView',
  transform: 'layoutSyncTransform',
  reset: 'layoutSyncReset'
}

function getSyncDefaults(viewType: SyncViewType): Record<CompareSyncSettingKey, boolean> {
  return viewType === 'CompareStack' ? COMPARE_SYNC_DEFAULTS : LAYOUT_SYNC_DEFAULTS
}

function getSyncFields(viewType: SyncViewType): Record<CompareSyncSettingKey, keyof ViewerTabItem> {
  return viewType === 'CompareStack' ? compareSyncFields : layoutSyncFields
}

function getSyncSettingForOperation(opType: ViewOperationType | string): CompareSyncSettingKey | null {
  if (opType === VIEW_OPERATION_TYPES.scroll) {
    return 'scroll'
  }
  if (opType === VIEW_OPERATION_TYPES.window) {
    return 'window'
  }
  if (opType === VIEW_OPERATION_TYPES.pseudocolor) {
    return 'pseudocolor'
  }
  if (opType === VIEW_OPERATION_TYPES.pan || opType === VIEW_OPERATION_TYPES.zoom) {
    return 'view'
  }
  if (opType === VIEW_OPERATION_TYPES.transform2d) {
    return 'transform'
  }
  if (opType === VIEW_OPERATION_TYPES.reset) {
    return 'reset'
  }
  return null
}

export function getViewSyncEnabled(tab: ViewerTabItem, key: CompareSyncSettingKey): boolean {
  if (tab.viewType !== 'CompareStack' && tab.viewType !== 'Layout') {
    return false
  }

  const value = tab[getSyncFields(tab.viewType)[key]]
  return typeof value === 'boolean' ? value : getSyncDefaults(tab.viewType)[key]
}

export function shouldSyncViewOperation(tab: ViewerTabItem, opType: ViewOperationType | string): boolean {
  if (tab.viewType !== 'CompareStack' && tab.viewType !== 'Layout') {
    return false
  }

  const key = getSyncSettingForOperation(opType)
  return key ? getViewSyncEnabled(tab, key) : false
}

export function withViewSyncValue(tab: ViewerTabItem, key: CompareSyncSettingKey, value: boolean): ViewerTabItem {
  if (tab.viewType !== 'CompareStack' && tab.viewType !== 'Layout') {
    return tab
  }

  return {
    ...tab,
    [getSyncFields(tab.viewType)[key]]: value
  }
}

export function createCompareSyncDefaults(): Pick<
  ViewerTabItem,
  'compareSyncScroll' | 'compareSyncWindow' | 'compareSyncPseudocolor' | 'compareSyncView' | 'compareSyncTransform' | 'compareSyncReset'
> {
  return {
    compareSyncScroll: COMPARE_SYNC_DEFAULTS.scroll,
    compareSyncWindow: COMPARE_SYNC_DEFAULTS.window,
    compareSyncPseudocolor: COMPARE_SYNC_DEFAULTS.pseudocolor,
    compareSyncView: COMPARE_SYNC_DEFAULTS.view,
    compareSyncTransform: COMPARE_SYNC_DEFAULTS.transform,
    compareSyncReset: COMPARE_SYNC_DEFAULTS.reset
  }
}

export function createLayoutSyncDefaults(): Pick<
  ViewerTabItem,
  'layoutSyncScroll' | 'layoutSyncWindow' | 'layoutSyncPseudocolor' | 'layoutSyncView' | 'layoutSyncTransform' | 'layoutSyncReset'
> {
  return {
    layoutSyncScroll: LAYOUT_SYNC_DEFAULTS.scroll,
    layoutSyncWindow: LAYOUT_SYNC_DEFAULTS.window,
    layoutSyncPseudocolor: LAYOUT_SYNC_DEFAULTS.pseudocolor,
    layoutSyncView: LAYOUT_SYNC_DEFAULTS.view,
    layoutSyncTransform: LAYOUT_SYNC_DEFAULTS.transform,
    layoutSyncReset: LAYOUT_SYNC_DEFAULTS.reset
  }
}
