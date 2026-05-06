import type { MprCrosshairInfo, MprViewportKey } from '../../../types/viewer'

export interface ActiveMprCrosshairDragLock {
  tabKey: string
  viewportKey: MprViewportKey
  phaseKey: string | null
  mode: 'move' | 'rotate'
  pointerOffsetX?: number
  pointerOffsetY?: number
}

interface IncomingMprViewportUpdate {
  tabKey: string
  viewportKey: MprViewportKey | null | undefined
  phaseKey: string | null | undefined
}

export function shouldPreserveLocalMprCrosshair(
  lock: ActiveMprCrosshairDragLock | null | undefined,
  update: IncomingMprViewportUpdate
): boolean {
  if (!lock || lock.mode !== 'move' || !update.viewportKey) {
    return false
  }

  return (
    lock.tabKey === update.tabKey &&
    lock.viewportKey === update.viewportKey &&
    (lock.phaseKey ?? null) === (update.phaseKey ?? null)
  )
}

export function resolveMprCrosshairForImageUpdate(params: {
  incomingCrosshair: MprCrosshairInfo | null
  currentCrosshair: MprCrosshairInfo | null
  lock: ActiveMprCrosshairDragLock | null | undefined
  update: IncomingMprViewportUpdate
}): MprCrosshairInfo | null {
  if (shouldPreserveLocalMprCrosshair(params.lock, params.update)) {
    return params.currentCrosshair ?? params.incomingCrosshair
  }

  return params.incomingCrosshair
}

function clampNormalized(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function resolveOptimisticMprCrosshairCenter(params: {
  lock: ActiveMprCrosshairDragLock | null | undefined
  pointerX: number
  pointerY: number
  update: IncomingMprViewportUpdate
}): { x: number; y: number } {
  const pointerX = clampNormalized(params.pointerX)
  const pointerY = clampNormalized(params.pointerY)
  if (!shouldPreserveLocalMprCrosshair(params.lock, params.update)) {
    return {
      x: pointerX,
      y: pointerY
    }
  }

  return {
    x: clampNormalized(pointerX + (params.lock?.pointerOffsetX ?? 0)),
    y: clampNormalized(pointerY + (params.lock?.pointerOffsetY ?? 0))
  }
}
