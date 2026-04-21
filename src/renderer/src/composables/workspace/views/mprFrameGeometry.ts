import type { MprCrosshairInfo, MprFrameInfo, MprViewportKey, ViewerTabItem } from '../../../types/viewer'

export type CrosshairLineTarget = 'horizontal' | 'vertical'

type Vec3 = [number, number, number]

export interface MprViewportCrosshairGeometry {
  center: { x: number; y: number }
  horizontalAngleRad: number
  verticalAngleRad: number
}

function normalizeVec3(vector: readonly number[], fallback: Vec3): Vec3 {
  if (vector.length !== 3) {
    return fallback
  }
  const x = Number(vector[0])
  const y = Number(vector[1])
  const z = Number(vector[2])
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return fallback
  }
  const magnitude = Math.hypot(x, y, z)
  if (magnitude <= 1e-6) {
    return fallback
  }
  return [x / magnitude, y / magnitude, z / magnitude]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function subtractProjection(vector: Vec3, normal: Vec3): Vec3 {
  const scale = dot(vector, normal)
  return [vector[0] - scale * normal[0], vector[1] - scale * normal[1], vector[2] - scale * normal[2]]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]
}

export function normalizeCrosshairAngle(angleRad: number): number {
  const halfTurn = Math.PI
  let nextAngle = angleRad % halfTurn
  if (nextAngle < 0) {
    nextAngle += halfTurn
  }
  return nextAngle
}

function getDefaultViewportBasis(viewportKey: MprViewportKey): { row: Vec3; col: Vec3; normal: Vec3 } {
  if (viewportKey === 'mpr-cor') {
    return {
      row: [-1, 0, 0],
      col: [0, 0, 1],
      normal: [0, 1, 0]
    }
  }
  if (viewportKey === 'mpr-sag') {
    return {
      row: [-1, 0, 0],
      col: [0, 1, 0],
      normal: [0, 0, 1]
    }
  }
  return {
    row: [0, 1, 0],
    col: [0, 0, 1],
    normal: [1, 0, 0]
  }
}

export function projectMprFrameToViewportBasis(frame: MprFrameInfo, viewportKey: MprViewportKey): { row: Vec3; col: Vec3; normal: Vec3 } {
  const axisSlice = normalizeVec3(frame.axisSlice, [1, 0, 0])
  const axisRow = normalizeVec3(frame.axisRow, [0, 1, 0])
  const axisCol = normalizeVec3(frame.axisCol, [0, 0, 1])

  if (viewportKey === 'mpr-cor') {
    return { row: [-axisSlice[0], -axisSlice[1], -axisSlice[2]], col: axisCol, normal: axisRow }
  }
  if (viewportKey === 'mpr-sag') {
    return { row: [-axisSlice[0], -axisSlice[1], -axisSlice[2]], col: axisRow, normal: axisCol }
  }
  return { row: axisRow, col: axisCol, normal: axisSlice }
}

export function getMprViewportDisplayBasis(frame: MprFrameInfo, viewportKey: MprViewportKey): { row: Vec3; col: Vec3; normal: Vec3 } {
  const projected = projectMprFrameToViewportBasis(frame, viewportKey)
  const canonical = getDefaultViewportBasis(viewportKey)
  const normalizedNormal = normalizeVec3(projected.normal, canonical.normal)
  let projectedCol = subtractProjection(normalizeVec3(canonical.col, canonical.col), normalizedNormal)
  if (Math.hypot(projectedCol[0], projectedCol[1], projectedCol[2]) <= 1e-6) {
    projectedCol = subtractProjection(normalizeVec3(canonical.row, canonical.row), normalizedNormal)
  }
  let col = normalizeVec3(projectedCol, canonical.col)
  let row = normalizeVec3(cross(col, normalizedNormal), canonical.row)
  const projectedRow = normalizeVec3(subtractProjection(normalizeVec3(canonical.row, canonical.row), normalizedNormal), canonical.row)
  if (dot(row, projectedRow) < 0) {
    row = [-row[0], -row[1], -row[2]]
    col = [-col[0], -col[1], -col[2]]
  }
  return { row, col, normal: normalizedNormal }
}

function angleFromLineDirection(lineDir: Vec3, displayBasis: { row: Vec3; col: Vec3 }): number {
  const colComponent = dot(lineDir, displayBasis.col)
  const rowComponent = dot(lineDir, displayBasis.row)
  const magnitude = Math.hypot(colComponent, rowComponent)
  if (magnitude <= 1e-6) {
    return 0
  }
  return normalizeCrosshairAngle(Math.atan2(rowComponent, colComponent))
}

function resolveTargetViewport(viewportKey: MprViewportKey, line: CrosshairLineTarget): MprViewportKey {
  if (viewportKey === 'mpr-cor') {
    return line === 'horizontal' ? 'mpr-ax' : 'mpr-sag'
  }
  if (viewportKey === 'mpr-sag') {
    return line === 'horizontal' ? 'mpr-ax' : 'mpr-cor'
  }
  return line === 'horizontal' ? 'mpr-cor' : 'mpr-sag'
}

function getFrameCrosshairLineDirection(frame: MprFrameInfo, viewportKey: MprViewportKey, line: CrosshairLineTarget): Vec3 {
  const currentPlane = projectMprFrameToViewportBasis(frame, viewportKey)
  const targetPlane = projectMprFrameToViewportBasis(frame, resolveTargetViewport(viewportKey, line))
  return normalizeVec3(cross(currentPlane.normal, targetPlane.normal), line === 'horizontal' ? currentPlane.col : currentPlane.row)
}

export function getMprViewportDerivedCrosshairGeometry(
  frame: MprFrameInfo | null | undefined,
  viewportKey: MprViewportKey,
  crosshairInfo: MprCrosshairInfo | null | undefined
): MprViewportCrosshairGeometry | null {
  if (!crosshairInfo) {
    return null
  }

  const center = {
    x: crosshairInfo.verticalPosition ?? crosshairInfo.centerX,
    y: crosshairInfo.horizontalPosition ?? crosshairInfo.centerY
  }

  if (!frame) {
    const horizontalAngleRad = normalizeCrosshairAngle(crosshairInfo.horizontalAngleRad ?? 0)
    return {
      center,
      horizontalAngleRad,
      verticalAngleRad: normalizeCrosshairAngle(crosshairInfo.verticalAngleRad ?? horizontalAngleRad + Math.PI / 2)
    }
  }

  const displayBasis = getMprViewportDisplayBasis(frame, viewportKey)
  const horizontalAngleRad = angleFromLineDirection(getFrameCrosshairLineDirection(frame, viewportKey, 'horizontal'), displayBasis)
  const verticalAngleRad = angleFromLineDirection(getFrameCrosshairLineDirection(frame, viewportKey, 'vertical'), displayBasis)
  return {
    center,
    horizontalAngleRad,
    verticalAngleRad
  }
}

export function getTabViewportCrosshairGeometry(
  tab: ViewerTabItem | null | undefined,
  viewportKey: MprViewportKey
): MprViewportCrosshairGeometry | null {
  if (!tab) {
    return null
  }
  return getMprViewportDerivedCrosshairGeometry(tab.mprFrame, viewportKey, tab.viewportCrosshairs?.[viewportKey] ?? null)
}
