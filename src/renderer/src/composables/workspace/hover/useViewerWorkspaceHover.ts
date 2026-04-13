import type { ComputedRef } from 'vue'
import throttle from 'lodash/throttle'
import type { CornerInfo, MprViewportKey, ViewHoverResponse, ViewerTabItem } from '../../../types/viewer'
import { emitViewHover } from '../../../services/socket'

interface ViewerWorkspaceHoverOptions {
  activeTab: ComputedRef<ViewerTabItem | null>
  activeViewportKey: { value: string }
  updateHoverCornerInfoByViewId: (viewId: string, row?: number | null, col?: number | null) => void
}

export function useViewerWorkspaceHover(options: ViewerWorkspaceHoverOptions) {
  const HOVER_EMIT_THROTTLE_MS = 30
  const hoveredViewIds = new Set<string>()
  const hoverCornerPattern = /^X:\s*-?\d+\s+Y:\s*-?\d+$/i

  const emitThrottledViewHover = throttle(
    (payload: { viewId: string; x: number; y: number }) => {
      emitViewHover(payload)
    },
    HOVER_EMIT_THROTTLE_MS,
    { leading: true, trailing: true }
  )

  function stripHoverCornerInfo(cornerInfo: CornerInfo): CornerInfo {
    return {
      ...cornerInfo,
      bottomRight: cornerInfo.bottomRight.filter((line) => !hoverCornerPattern.test(line.trim()))
    }
  }

  function withHoverCornerInfo(cornerInfo: CornerInfo, row: number | null = null, col: number | null = null): CornerInfo {
    const hoverLine = cornerInfo.bottomRight.find((line) => hoverCornerPattern.test(line.trim())) ?? null
    const bottomRight = cornerInfo.bottomRight.filter((line) => !hoverCornerPattern.test(line.trim()))
    if (row != null && col != null) {
      bottomRight.push(`X:${col} Y:${row}`)
    } else if (hoverLine) {
      bottomRight.push(hoverLine)
    }
    return {
      ...cornerInfo,
      bottomRight
    }
  }

  function handleHoverInfo(payload: ViewHoverResponse | undefined): void {
    if (!payload?.viewId || !hoveredViewIds.has(payload.viewId)) {
      return
    }
    options.updateHoverCornerInfoByViewId(payload.viewId, payload.row, payload.col)
  }

  function handleHoverViewportChange(payload: { viewportKey: string; x: number | null; y: number | null }): void {
    const tab = options.activeTab.value
    if (!tab || (tab.viewType !== 'Stack' && tab.viewType !== 'MPR')) {
      return
    }

    const resolvedViewportKey = payload.viewportKey || options.activeViewportKey.value
    const viewId =
      tab.viewType === 'MPR' ? tab.viewportViewIds?.[resolvedViewportKey as MprViewportKey] ?? '' : tab.viewId
    if (!viewId) {
      return
    }

    if (payload.x == null || payload.y == null) {
      emitThrottledViewHover.cancel()
      hoveredViewIds.delete(viewId)
      options.updateHoverCornerInfoByViewId(viewId)
      return
    }

    hoveredViewIds.add(viewId)
    emitThrottledViewHover({
      viewId,
      x: payload.x,
      y: payload.y
    })
  }

  function cleanupHover(): void {
    emitThrottledViewHover.cancel()
    hoveredViewIds.clear()
  }

  return {
    cleanupHover,
    handleHoverInfo,
    handleHoverViewportChange,
    stripHoverCornerInfo,
    withHoverCornerInfo
  }
}
