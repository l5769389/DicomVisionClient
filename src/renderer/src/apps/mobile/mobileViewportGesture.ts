import type { ViewOperationType } from '@shared/viewerConstants'

export interface MobileGesturePoint {
  x: number
  y: number
}

export type MobileTwoFingerGestureMode = 'pending' | 'scroll' | 'zoom'

export interface MobileTwoFingerGestureSample {
  initialCenter: MobileGesturePoint
  initialDistance: number
  currentCenter: MobileGesturePoint
  currentDistance: number
}

const MOBILE_PINCH_DISTANCE_THRESHOLD_PX = 6
const MOBILE_PINCH_DISTANCE_RATIO_THRESHOLD = 0.035
const MOBILE_TWO_FINGER_SCROLL_THRESHOLD_PX = 8

export function classifyMobileTwoFingerGesture(sample: MobileTwoFingerGestureSample): MobileTwoFingerGestureMode {
  const distanceDelta = Math.abs(sample.currentDistance - sample.initialDistance)
  const relativeDistanceDelta = distanceDelta / Math.max(sample.initialDistance, 1)
  if (
    distanceDelta >= MOBILE_PINCH_DISTANCE_THRESHOLD_PX ||
    relativeDistanceDelta >= MOBILE_PINCH_DISTANCE_RATIO_THRESHOLD
  ) {
    return 'zoom'
  }
  const centerDeltaX = sample.currentCenter.x - sample.initialCenter.x
  const centerDeltaY = sample.currentCenter.y - sample.initialCenter.y
  if (
    Math.abs(centerDeltaY) >= MOBILE_TWO_FINGER_SCROLL_THRESHOLD_PX &&
    Math.abs(centerDeltaY) >= Math.abs(centerDeltaX)
  ) {
    return 'scroll'
  }
  return 'pending'
}

export interface MobileViewportDragMove<ViewportKey extends string = string> {
  deltaX: number
  deltaY: number
  opType: ViewOperationType
  viewportKey: ViewportKey
  canvasX?: number
  canvasY?: number
  canvasWidth?: number
  canvasHeight?: number
  interactionId?: string
  force?: boolean
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
    const latest = new Map<string, MobileViewportDragMove<ViewportKey>>()
    for (const move of moves) {
      const key = `${move.viewportKey}:${move.opType}`
      latest.set(key, move)
    }

    latest.forEach(emitMove)
  }

  function cancel(): void {
    if (pendingFrame != null) {
      window.cancelAnimationFrame(pendingFrame)
      pendingFrame = null
    }
    pendingMoves = []
  }

  function push(move: MobileViewportDragMove<ViewportKey>): void {
    if (!move.force && !exceedsMobileDragThreshold(move.deltaX, move.deltaY)) {
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
