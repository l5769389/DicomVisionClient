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
const COORDINATE_CORNER_PATTERN = /^(?:Cursor\s+)?X:\s*(?:-?\d+|--)\s+Y:\s*(?:-?\d+|--)(?:\s+.+)?$/i
const EMPTY_HOVER_CORNER_LINE = `X:${' '.repeat(4)} Y:${' '.repeat(4)} ${' '.repeat(6)} ${' '.repeat(2)}`

export interface HoverCornerSample {
  displayText: string
}

interface ViewerWorkspaceHoverOptions {
  activeTab: ComputedRef<ViewerTabItem | null>
  activeViewportKey: { value: string }
  updateHoverCornerInfoByViewId: (viewId: string, sample: HoverCornerSample) => void
}

export function useViewerWorkspaceHover(options: ViewerWorkspaceHoverOptions) {
  const hoveredViewIds = new Set<string>()
  const lastHoverSamplesByViewId = new Map<string, HoverCornerSample>()

  const emitThrottledViewHover = throttle(
    (payload: { viewId: string; x: number; y: number }) => {
      emitViewHover(payload)
    },
    HOVER_EMIT_THROTTLE_MS,
    { leading: true, trailing: true }
  )

  function stripHoverCornerInfo(cornerInfo: CornerInfo): CornerInfo {
    const tags = { ...(cornerInfo.tags ?? {}) }
    delete tags.coordinates
    return {
      ...cornerInfo,
      bottomRight: cornerInfo.bottomRight.filter((line) => !COORDINATE_CORNER_PATTERN.test(line.trim())),
      tags
    }
  }

  function formatHoverCornerLine(sample: HoverCornerSample | null | undefined): string {
    return sample?.displayText || EMPTY_HOVER_CORNER_LINE
  }

  function withHoverCornerInfo(cornerInfo: CornerInfo, sample: HoverCornerSample | null = null): CornerInfo {
    const bottomRight = cornerInfo.bottomRight.filter((line) => !COORDINATE_CORNER_PATTERN.test(line.trim()))
    const nextCoordinateLine = formatHoverCornerLine(sample)
    bottomRight.push(nextCoordinateLine)
    return {
      ...cornerInfo,
      bottomRight,
      tags: {
        ...(cornerInfo.tags ?? {}),
        coordinates: [nextCoordinateLine]
      }
    }
  }

  function normalizeHoverSample(payload: ViewHoverResponse): HoverCornerSample | null {
    const displayText = String(payload.displayText || '').trim()
    if (!displayText) {
      return null
    }
    return { displayText }
  }

  function handleHoverInfo(payload: ViewHoverResponse | undefined): void {
    if (!payload?.viewId || !hoveredViewIds.has(payload.viewId)) {
      return
    }
    const sample = normalizeHoverSample(payload)
    if (!sample) {
      return
    }
    lastHoverSamplesByViewId.set(payload.viewId, sample)
    options.updateHoverCornerInfoByViewId(payload.viewId, sample)
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
    lastHoverSamplesByViewId.clear()
  }

  function getLastHoverSample(viewId: string | null | undefined): HoverCornerSample | null {
    return viewId ? lastHoverSamplesByViewId.get(viewId) ?? null : null
  }

  function clearHoverSample(viewId: string): void {
    hoveredViewIds.delete(viewId)
    lastHoverSamplesByViewId.delete(viewId)
  }

  return {
    cleanupHover,
    clearHoverSample,
    getLastHoverSample,
    handleHoverInfo,
    handleHoverViewportChange,
    stripHoverCornerInfo,
    withHoverCornerInfo
  }
}
