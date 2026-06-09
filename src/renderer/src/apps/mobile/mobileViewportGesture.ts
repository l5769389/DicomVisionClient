import type { ViewOperationType } from '@shared/viewerConstants'

export interface MobileGesturePoint {
  x: number
  y: number
}

export interface MobileViewportDragMove<ViewportKey extends string = string> {
  deltaX: number
  deltaY: number
  opType: ViewOperationType
  viewportKey: ViewportKey
}

export const MOBILE_VIEWPORT_DRAG_MOVE_THRESHOLD = 1.25

export function getMobileGestureDistance(points: readonly MobileGesturePoint[]): number {
  if (points.length < 2) {
    return 0
  }
  const [a, b] = points
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function getMobileGestureCenter(points: readonly MobileGesturePoint[]): MobileGesturePoint | null {
  if (points.length < 2) {
    return null
  }
  const [a, b] = points
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  }
}

export function exceedsMobileDragThreshold(
  deltaX: number,
  deltaY: number,
  threshold = MOBILE_VIEWPORT_DRAG_MOVE_THRESHOLD
): boolean {
  return Math.abs(deltaX) >= threshold || Math.abs(deltaY) >= threshold
}

export function createMobileViewportDragMoveQueue<ViewportKey extends string>(
  emitMove: (move: MobileViewportDragMove<ViewportKey>) => void
) {
  let pendingFrame: number | null = null
  let pendingMoves: Array<MobileViewportDragMove<ViewportKey>> = []

  function flush(): void {
    if (pendingFrame != null) {
      window.cancelAnimationFrame(pendingFrame)
      pendingFrame = null
    }

    const moves = pendingMoves
    pendingMoves = []
    const totals = new Map<string, MobileViewportDragMove<ViewportKey>>()
    for (const move of moves) {
      const key = `${move.viewportKey}:${move.opType}`
      const total = totals.get(key) ?? {
        deltaX: 0,
        deltaY: 0,
        opType: move.opType,
        viewportKey: move.viewportKey
      }
      total.deltaX += move.deltaX
      total.deltaY += move.deltaY
      totals.set(key, total)
    }

    totals.forEach(emitMove)
  }

  function cancel(): void {
    if (pendingFrame != null) {
      window.cancelAnimationFrame(pendingFrame)
      pendingFrame = null
    }
    pendingMoves = []
  }

  function push(move: MobileViewportDragMove<ViewportKey>): void {
    if (!exceedsMobileDragThreshold(move.deltaX, move.deltaY)) {
      return
    }
    pendingMoves.push(move)
    if (pendingFrame != null) {
      return
    }
    pendingFrame = window.requestAnimationFrame(() => {
      pendingFrame = null
      flush()
    })
  }

  return {
    cancel,
    flush,
    push
  }
}
