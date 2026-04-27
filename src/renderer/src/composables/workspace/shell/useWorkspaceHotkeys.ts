import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import type { ViewerTabItem } from '../../../types/viewer'
import type { ViewerExportFormat } from '../export/viewExport'

export interface WorkspaceHotkeyOptions {
  activeOperation: Ref<string>
  activeTab: Ref<ViewerTabItem | null>
  activeTabKey: Ref<string>
  activeViewportKey: Ref<string>
  closeActiveTab: () => void
  copySelectedAnnotation: () => boolean
  copySelectedMeasurement: () => boolean
  copySelectedMtf: () => boolean
  deleteSelectedAnnotation: () => boolean
  deleteSelectedMeasurement: () => boolean
  deleteSelectedMtf: () => boolean
  exportCurrentView: (format: ViewerExportFormat) => void
  quickPreviewSelectedSeries: () => void
  selectedSeriesId: Ref<string>
  tagIndexChange: (payload: { tabKey: string; index: number }) => void
  toggleSidebar: () => void
  viewportWheel: (payload: { viewportKey: string; deltaY: number; exact: true }) => void
}

function getActiveSliceInfo(tab: ViewerTabItem | null, activeViewportKey: string): { current: number; total: number } | null {
  if (!tab) {
    return null
  }

  const isMprLikeView = tab.viewType === 'MPR' || tab.viewType === '4D'
  const raw =
    isMprLikeView
      ? tab.viewportSliceLabels?.[activeViewportKey as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'] ?? tab.sliceLabel
      : tab.sliceLabel
  const match = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return null
  }

  const current = Number(match[1])
  const total = Number(match[2])
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return null
  }

  return { current, total }
}

export function useWorkspaceHotkeys(options: WorkspaceHotkeyOptions) {
  function normalizeOperation(operation: string): string {
    return operation.startsWith('stack:') ? operation.slice('stack:'.length) : operation
  }

  function runFirstAvailableAction(actions: Array<() => boolean>): boolean {
    for (const action of actions) {
      if (action()) {
        return true
      }
    }

    return false
  }

  function isMtfOperation(operation: string): boolean {
    const normalized = normalizeOperation(operation)
    return normalized === 'mtf' || normalized === 'qa:mtf'
  }

  function handleNavigationShortcut(event: KeyboardEvent): void {
    const tab = options.activeTab.value
    if (!tab) {
      return
    }

    if (tab.viewType === 'Tag') {
      const currentIndex = tab.tagIndex ?? 0
      const total = Math.max(1, tab.tagTotal ?? 1)
      let nextIndex: number | null = null

      if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = total - 1
      } else if (event.key === 'ArrowLeft') {
        nextIndex = Math.max(0, currentIndex - (event.shiftKey ? 10 : 1))
      } else if (event.key === 'ArrowRight') {
        nextIndex = Math.min(total - 1, currentIndex + (event.shiftKey ? 10 : 1))
      }

      if (nextIndex != null && nextIndex !== currentIndex) {
        event.preventDefault()
        options.tagIndexChange({ tabKey: tab.key, index: nextIndex })
      }
      return
    }

    if (tab.viewType !== 'Stack' && tab.viewType !== 'MPR' && tab.viewType !== '4D') {
      return
    }

    const sliceInfo = getActiveSliceInfo(tab, options.activeViewportKey.value)
    if (!sliceInfo) {
      return
    }

    let delta: number | null = null
    if (event.key === 'Home') {
      delta = 1 - sliceInfo.current
    } else if (event.key === 'End') {
      delta = sliceInfo.total - sliceInfo.current
    } else if (event.key === 'ArrowLeft') {
      delta = event.shiftKey ? -10 : -1
    } else if (event.key === 'ArrowRight') {
      delta = event.shiftKey ? 10 : 1
    }

    if (!delta) {
      return
    }

    event.preventDefault()
    options.viewportWheel({
      viewportKey: options.activeViewportKey.value,
      deltaY: delta,
      exact: true
    })
  }

  function handleWorkspaceKeydown(event: KeyboardEvent): void {
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return
    }

    const preferMtf = isMtfOperation(options.activeOperation.value)
    const preferAnnotation = options.activeOperation.value.startsWith('stack:annotate')

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      const handled = runFirstAvailableAction([
        ...(preferAnnotation ? [options.copySelectedAnnotation] : []),
        ...(preferMtf ? [options.copySelectedMtf] : []),
        options.copySelectedMeasurement,
        options.copySelectedMtf,
        options.copySelectedAnnotation
      ])
      if (handled) {
        event.preventDefault()
      }
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const handled = runFirstAvailableAction([
        ...(preferAnnotation ? [options.deleteSelectedAnnotation] : []),
        ...(preferMtf ? [options.deleteSelectedMtf] : []),
        options.deleteSelectedMeasurement,
        options.deleteSelectedMtf,
        options.deleteSelectedAnnotation
      ])
      if (handled) {
        event.preventDefault()
      }
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
      event.preventDefault()
      options.closeActiveTab()
      return
    }

    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      options.toggleSidebar()
      return
    }

    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && options.selectedSeriesId.value) {
      event.preventDefault()
      options.quickPreviewSelectedSeries()
      return
    }

    if (event.key === 'F10' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      options.exportCurrentView('png')
      return
    }

    if (event.key === 'F11' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      options.exportCurrentView('dicom')
      return
    }

    handleNavigationShortcut(event)
  }

  onMounted(() => {
    window.addEventListener('keydown', handleWorkspaceKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleWorkspaceKeydown)
  })

  return {
    handleWorkspaceKeydown
  }
}
