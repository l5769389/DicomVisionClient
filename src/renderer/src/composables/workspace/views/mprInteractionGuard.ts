import type { MprCrosshairInfo, MprCrosshairLineTarget, MprViewportKey } from '../../../types/viewer'
import { normalizeCrosshairAngle } from './mprFrameGeometry'

export type MprCrosshairDragLockStatus = 'dragging' | 'settling'

export interface ActiveMprCrosshairDragLock {
  tabKey: string
  viewportKey: MprViewportKey
  phaseKey: string | null
  mode: 'move' | 'rotate'
  status?: MprCrosshairDragLockStatus
  pointerOffsetX?: number
  pointerOffsetY?: number
  line?: MprCrosshairLineTarget | null
  centerX?: number
  centerY?: number
  lastPointerX?: number
  lastPointerY?: number
  endedAt?: number
  startPointerAngleRad?: number
  startHorizontalAngleRad?: number
  startVerticalAngleRad?: number
  isDoubleOblique?: boolean
}

export interface IncomingMprViewportUpdate {
  tabKey: string
  viewportKey: MprViewportKey | null | undefined
  phaseKey: string | null | undefined
}

export function shouldPreserveLocalMprCrosshair(
  lock: ActiveMprCrosshairDragLock | null | undefined,
  update: IncomingMprViewportUpdate
): boolean {
  if (!lock || !update.viewportKey) {
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

function normalizeImageFormat(value: string | null | undefined): string {
  return String(value ?? '').toLowerCase()
}

export function shouldSuppressMprCrosshairPreviewImageUpdate(params: {
  lock: ActiveMprCrosshairDragLock | null | undefined
  update: IncomingMprViewportUpdate
  imageFormat: string | null | undefined
}): boolean {
  return normalizeImageFormat(params.imageFormat) === 'jpeg' && shouldPreserveLocalMprCrosshair(params.lock, params.update)
}

export function shouldCompleteMprCrosshairSettling(params: {
  lock: ActiveMprCrosshairDragLock | null | undefined
  update: IncomingMprViewportUpdate
  imageFormat: string | null | undefined
}): boolean {
  return (
    params.lock?.status === 'settling' &&
    normalizeImageFormat(params.imageFormat) === 'png' &&
    shouldPreserveLocalMprCrosshair(params.lock, params.update)
  )
}

function clampNormalized(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function resolvePointerAngleRad(centerX: number, centerY: number, pointerX: number, pointerY: number): number {
  return Math.atan2(clampNormalized(pointerY) - centerY, clampNormalized(pointerX) - centerX)
}

function normalizeFullTurnDelta(angleRad: number): number {
  const fullTurn = Math.PI * 2
  let delta = angleRad % fullTurn
  if (delta <= -Math.PI) {
    delta += fullTurn
  }
  if (delta > Math.PI) {
    delta -= fullTurn
  }
  return delta
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

export function resolveOptimisticMprCrosshairRotation(params: {
  lock: ActiveMprCrosshairDragLock | null | undefined
  pointerX: number
  pointerY: number
  line?: MprCrosshairLineTarget | null
  update: IncomingMprViewportUpdate
  currentHorizontalAngleRad?: number | null
  currentVerticalAngleRad?: number | null
}): { horizontalAngleRad: number; verticalAngleRad: number } | null {
  const lock = params.lock
  if (!shouldPreserveLocalMprCrosshair(lock, params.update) || lock?.mode !== 'rotate') {
    return null
  }

  const line = params.line ?? lock.line ?? null
  if (line !== 'horizontal' && line !== 'vertical') {
    return null
  }

  const centerX = finiteNumberOrNull(lock.centerX)
  const centerY = finiteNumberOrNull(lock.centerY)
  if (centerX == null || centerY == null) {
    return null
  }

  const pointerAngleRad = resolvePointerAngleRad(centerX, centerY, params.pointerX, params.pointerY)
  const startPointerAngleRad = finiteNumberOrNull(lock.startPointerAngleRad) ?? pointerAngleRad
  const startHorizontalAngleRad = normalizeCrosshairAngle(
    finiteNumberOrNull(lock.startHorizontalAngleRad) ??
      finiteNumberOrNull(params.currentHorizontalAngleRad) ??
      0
  )
  const startVerticalAngleRad = normalizeCrosshairAngle(
    finiteNumberOrNull(lock.startVerticalAngleRad) ??
      finiteNumberOrNull(params.currentVerticalAngleRad) ??
      Math.PI / 2
  )
  const delta = normalizeFullTurnDelta(pointerAngleRad - startPointerAngleRad)

  if (line === 'horizontal') {
    const horizontalAngleRad = normalizeCrosshairAngle(startHorizontalAngleRad + delta)
    return {
      horizontalAngleRad,
      verticalAngleRad: lock.isDoubleOblique
        ? startVerticalAngleRad
        : normalizeCrosshairAngle(horizontalAngleRad + Math.PI / 2)
    }
  }

  const verticalAngleRad = normalizeCrosshairAngle(startVerticalAngleRad + delta)
  return {
    horizontalAngleRad: lock.isDoubleOblique
      ? startHorizontalAngleRad
      : normalizeCrosshairAngle(verticalAngleRad - Math.PI / 2),
    verticalAngleRad
  }
}
