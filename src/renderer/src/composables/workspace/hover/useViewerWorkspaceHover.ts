import type { ComputedRef } from 'vue'
import throttle from 'lodash/throttle'
import type { CornerInfo, ViewHoverResponse, ViewerTabItem } from '../../../types/viewer'
import { emitViewHover } from '../../../services/socket'
import {
  isMprLikeViewType,
  isStackLikeViewType,
  resolveViewIdForTabViewport
} from '../views/viewerViewportTargets'

const HOVER_EMIT_THROTTLE_MS = 30
const HOVER_CORNER_PATTERN = /^Cursor\s+X:\s*-?\d+\s+Y:\s*-?\d+$/i

interface ViewerWorkspaceHoverOptions {
  activeTab: ComputedRef<ViewerTabItem | null>
  activeViewportKey: { value: string }
  updateHoverCornerInfoByViewId: (viewId: string, row?: number | null, col?: number | null) => void
}

export function useViewerWorkspaceHover(options: ViewerWorkspaceHoverOptions) {
  const hoveredViewIds = new Set<string>()
  const lastHoverPixelsByViewId = new Map<string, { row: number; col: number }>()

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
      bottomRight: cornerInfo.bottomRight.filter((line) => !HOVER_CORNER_PATTERN.test(line.trim()))
    }
  }

  function withHoverCornerInfo(cornerInfo: CornerInfo, row: number | null = null, col: number | null = null): CornerInfo {
    const hoverLine = cornerInfo.bottomRight.find((line) => HOVER_CORNER_PATTERN.test(line.trim())) ?? null
    const bottomRight = cornerInfo.bottomRight.filter((line) => !HOVER_CORNER_PATTERN.test(line.trim()))
    if (row != null && col != null) {
      bottomRight.push(`Cursor X:${col} Y:${row}`)
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
    if (payload.row != null && payload.col != null) {
      lastHoverPixelsByViewId.set(payload.viewId, {
        row: payload.row,
        col: payload.col
      })
    }
    options.updateHoverCornerInfoByViewId(payload.viewId, payload.row, payload.col)
  }

  function resolveHoverViewId(tab: ViewerTabItem, viewportKey: string): string {
    return resolveViewIdForTabViewport(tab, viewportKey)
  }

  function handleHoverViewportChange(payload: { viewportKey: string; x: number | null; y: number | null }): void {
    const tab = options.activeTab.value
    if (!tab || (!isStackLikeViewType(tab.viewType) && !isMprLikeViewType(tab.viewType))) {
      return
    }

    const resolvedViewportKey = payload.viewportKey || options.activeViewportKey.value
    const viewId = resolveHoverViewId(tab, resolvedViewportKey)
    if (!viewId) {
      return
    }

    if (payload.x == null || payload.y == null) {
      emitThrottledViewHover.cancel()
      hoveredViewIds.delete(viewId)
      const lastHover = lastHoverPixelsByViewId.get(viewId)
      options.updateHoverCornerInfoByViewId(viewId, lastHover?.row ?? null, lastHover?.col ?? null)
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
    lastHoverPixelsByViewId.clear()
  }

  return {
    cleanupHover,
    handleHoverInfo,
    handleHoverViewportChange,
    stripHoverCornerInfo,
    withHoverCornerInfo
  }
}
