import type { MprCrosshairInfo, MprFrameInfo, MprPlaneInfo, MprViewportKey, ViewerTabItem } from '../../../types/viewer'

export type CrosshairLineTarget = 'horizontal' | 'vertical'

type Vec3 = [number, number, number]

export interface MprViewportBasis {
  row: Vec3
  col: Vec3
  normal: Vec3
}

export interface MprViewportPose {
  viewportKey: MprViewportKey
  basis: MprViewportBasis
  targetNormals: Record<CrosshairLineTarget, Vec3>
}

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

function orthogonalizeBasis(rowCandidate: Vec3, colCandidate: Vec3, normal: Vec3, fallback: { row: Vec3; col: Vec3 }): { row: Vec3; col: Vec3 } {
  const projectedRow = subtractProjection(rowCandidate, normal)
  const row = normalizeVec3(projectedRow, fallback.row)
  const projectedCol = subtractProjection(colCandidate, normal)
  const orthogonalCol: Vec3 = [
    projectedCol[0] - dot(projectedCol, row) * row[0],
    projectedCol[1] - dot(projectedCol, row) * row[1],
    projectedCol[2] - dot(projectedCol, row) * row[2]
  ]
  let col = normalizeVec3(orthogonalCol, fallback.col)
  if (dot(cross(row, col), normal) < 0) {
    col = [-col[0], -col[1], -col[2]]
  }
  return { row, col }
}

export function normalizeCrosshairAngle(angleRad: number): number {
  const halfTurn = Math.PI
  let nextAngle = angleRad % halfTurn
  if (nextAngle < 0) {
    nextAngle += halfTurn
  }
  return nextAngle
}

function getDefaultViewportBasis(viewportKey: MprViewportKey): MprViewportBasis {
  if (viewportKey === 'mpr-cor') {
    return {
      row: [1, 0, 0],
      col: [0, 0, -1],
      normal: [0, 1, 0]
    }
  }
  if (viewportKey === 'mpr-sag') {
    return {
      row: [1, 0, 0],
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

export function projectMprFrameToViewportBasis(frame: MprFrameInfo, viewportKey: MprViewportKey): MprViewportBasis {
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

export function getMprViewportDisplayBasis(frame: MprFrameInfo, viewportKey: MprViewportKey): MprViewportBasis {
  const projected = projectMprFrameToViewportBasis(frame, viewportKey)
  const canonical = getDefaultViewportBasis(viewportKey)
  const normalizedNormal = normalizeVec3(projected.normal, canonical.normal)
  let projectedCol = subtractProjection(normalizeVec3(canonical.col, canonical.col), normalizedNormal)
  if (Math.hypot(projectedCol[0], projectedCol[1], projectedCol[2]) <= 1e-6) {
    projectedCol = subtractProjection(normalizeVec3(canonical.row, canonical.row), normalizedNormal)
  }
  const col = normalizeVec3(projectedCol, canonical.col)
  const row = normalizeVec3(cross(col, normalizedNormal), canonical.row)
  return { row, col, normal: normalizedNormal }
}

function getMprViewportPlaneBasis(plane: MprPlaneInfo, viewportKey: MprViewportKey): MprViewportBasis {
  const canonical = getDefaultViewportBasis(viewportKey)
  const normalizedNormal = normalizeVec3(plane.normalWorld ?? plane.normal, canonical.normal)
  const { row, col } = orthogonalizeBasis(
    normalizeVec3(plane.rowWorld ?? plane.row, canonical.row),
    normalizeVec3(plane.colWorld ?? plane.col, canonical.col),
    normalizedNormal,
    canonical
  )
  return { row, col, normal: normalizedNormal }
}

function getExplicitCrosshairAngles(crosshairInfo: MprCrosshairInfo): {
  horizontalAngleRad: number
  verticalAngleRad: number
} | null {
  const explicitHorizontalAngle = Number.isFinite(crosshairInfo.horizontalAngleRad)
    ? normalizeCrosshairAngle(crosshairInfo.horizontalAngleRad ?? 0)
    : null
  const explicitVerticalAngle = Number.isFinite(crosshairInfo.verticalAngleRad)
    ? normalizeCrosshairAngle(crosshairInfo.verticalAngleRad ?? 0)
    : null

  if (explicitHorizontalAngle == null && explicitVerticalAngle == null) {
    return null
  }

  const horizontalAngleRad = explicitHorizontalAngle ?? normalizeCrosshairAngle((explicitVerticalAngle ?? 0) - Math.PI / 2)
  return {
    horizontalAngleRad,
    verticalAngleRad: explicitVerticalAngle ?? normalizeCrosshairAngle(horizontalAngleRad + Math.PI / 2)
  }
}

function angleFromLineDirection(lineDir: Vec3, displayBasis: Pick<MprViewportBasis, 'row' | 'col'>): number {
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

function getTargetViewportNormals(frame: MprFrameInfo, viewportKey: MprViewportKey): Record<CrosshairLineTarget, Vec3> {
  return {
    horizontal: projectMprFrameToViewportBasis(frame, resolveTargetViewport(viewportKey, 'horizontal')).normal,
    vertical: projectMprFrameToViewportBasis(frame, resolveTargetViewport(viewportKey, 'vertical')).normal
  }
}

export function resolveMprViewportPose(
  frame: MprFrameInfo,
  viewportKey: MprViewportKey,
  plane: MprPlaneInfo | null | undefined = null
): MprViewportPose {
  return {
    viewportKey,
    basis: plane ? getMprViewportPlaneBasis(plane, viewportKey) : getMprViewportDisplayBasis(frame, viewportKey),
    targetNormals: getTargetViewportNormals(frame, viewportKey)
  }
}

export function getMprViewportCrosshairLineDirection(pose: MprViewportPose, line: CrosshairLineTarget): Vec3 {
  const basis = pose.basis
  const targetNormal = pose.targetNormals[line]
  return normalizeVec3(cross(basis.normal, targetNormal), line === 'horizontal' ? basis.col : basis.row)
}

export function getMprViewportCrosshairAngles(pose: MprViewportPose): {
  horizontalAngleRad: number
  verticalAngleRad: number
} {
  return {
    horizontalAngleRad: angleFromLineDirection(getMprViewportCrosshairLineDirection(pose, 'horizontal'), pose.basis),
    verticalAngleRad: angleFromLineDirection(getMprViewportCrosshairLineDirection(pose, 'vertical'), pose.basis)
  }
}

export function getMprViewportDerivedCrosshairGeometry(
  frame: MprFrameInfo | null | undefined,
  viewportKey: MprViewportKey,
  crosshairInfo: MprCrosshairInfo | null | undefined,
  plane: MprPlaneInfo | null | undefined = null
): MprViewportCrosshairGeometry | null {
  if (!crosshairInfo) {
    return null
  }

  const center = {
    x: crosshairInfo.verticalPosition ?? crosshairInfo.centerX,
    y: crosshairInfo.horizontalPosition ?? crosshairInfo.centerY
  }

  const explicitAngles = getExplicitCrosshairAngles(crosshairInfo)
  if (explicitAngles) {
    return {
      center,
      ...explicitAngles
    }
  }

  if (frame) {
    const pose = resolveMprViewportPose(frame, viewportKey, plane)
    const { horizontalAngleRad, verticalAngleRad } = getMprViewportCrosshairAngles(pose)
    return {
      center,
      horizontalAngleRad,
      verticalAngleRad
    }
  }

  return {
    center,
    horizontalAngleRad: 0,
    verticalAngleRad: Math.PI / 2
  }
}

export function getTabViewportCrosshairGeometry(
  tab: ViewerTabItem | null | undefined,
  viewportKey: MprViewportKey
): MprViewportCrosshairGeometry | null {
  if (!tab) {
    return null
  }
  return getMprViewportDerivedCrosshairGeometry(
    null,
    viewportKey,
    tab.viewportCrosshairs?.[viewportKey] ?? null,
    tab.viewportPlanes?.[viewportKey] ?? null
  )
}
