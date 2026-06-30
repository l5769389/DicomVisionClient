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
const COORDINATE_CORNER_PATTERN = /^(?:Cursor\s+)?X:\s*(-?\d+)\s+Y:\s*(-?\d+)$/i

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

  function normalizeCoordinateCornerLine(line: string | null): string | null {
    if (!line) {
      return null
    }
    const match = COORDINATE_CORNER_PATTERN.exec(line.trim())
    return match ? `X:${match[1]} Y:${match[2]}` : null
  }

  function withHoverCornerInfo(cornerInfo: CornerInfo, row: number | null = null, col: number | null = null): CornerInfo {
    const coordinateLine =
      cornerInfo.bottomRight.find((line) => COORDINATE_CORNER_PATTERN.test(line.trim())) ??
      cornerInfo.tags?.coordinates?.find((line) => COORDINATE_CORNER_PATTERN.test(line.trim())) ??
      null
    const bottomRight = cornerInfo.bottomRight.filter((line) => !COORDINATE_CORNER_PATTERN.test(line.trim()))
    let nextCoordinateLine: string | null = null
    if (row != null && col != null) {
      nextCoordinateLine = `X:${col} Y:${row}`
    } else {
      nextCoordinateLine = normalizeCoordinateCornerLine(coordinateLine)
    }
    if (nextCoordinateLine) {
      bottomRight.push(nextCoordinateLine)
    }
    return {
      ...cornerInfo,
      bottomRight,
      tags: {
        ...(cornerInfo.tags ?? {}),
        coordinates: nextCoordinateLine ? [nextCoordinateLine] : []
      }
    }
  }

  function normalizeHoverPixel(row: number | null | undefined, col: number | null | undefined): { row: number; col: number } | null {
    if (!Number.isFinite(row) || !Number.isFinite(col) || Number(row) < 1 || Number(col) < 1) {
      return null
    }
    return { row: Number(row), col: Number(col) }
  }

  function handleHoverInfo(payload: ViewHoverResponse | undefined): void {
    if (!payload?.viewId || !hoveredViewIds.has(payload.viewId)) {
      return
    }
    const pixel = normalizeHoverPixel(payload.row, payload.col)
    if (pixel) {
      lastHoverPixelsByViewId.set(payload.viewId, {
        row: pixel.row,
        col: pixel.col
      })
      options.updateHoverCornerInfoByViewId(payload.viewId, pixel.row, pixel.col)
      return
    }
    const lastHover = lastHoverPixelsByViewId.get(payload.viewId)
    options.updateHoverCornerInfoByViewId(payload.viewId, lastHover?.row ?? null, lastHover?.col ?? null)
  }

  function resolveHoverViewId(tab: ViewerTabItem, viewportKey: string): string {
    return resolveViewIdForTabViewport(tab, viewportKey)
  }

  function handleHoverViewportChange(payload: { viewportKey: string; x: number | null; y: number | null; row?: number | null; col?: number | null }): void {
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
