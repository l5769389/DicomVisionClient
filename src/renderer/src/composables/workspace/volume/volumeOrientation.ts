export const VOLUME_ORIENTATION_FACES = ['A', 'P', 'L', 'R', 'S', 'I'] as const
export type VolumeOrientationFace = (typeof VOLUME_ORIENTATION_FACES)[number]

export const DEFAULT_VOLUME_ORIENTATION_FACE: VolumeOrientationFace = 'A'
export const VOLUME_ORIENTATION_SNAP_DEGREES = 22.5
export const VOLUME_ORIENTATION_OBLIQUE_ICON = 'orientation-face-oblique'

export const VOLUME_ORIENTATION_FACE_NAMES: Record<VolumeOrientationFace, { en: string; zh: string }> = {
  A: { en: 'Anterior', zh: '前方' },
  P: { en: 'Posterior', zh: '后方' },
  L: { en: 'Left', zh: '左侧' },
  R: { en: 'Right', zh: '右侧' },
  S: { en: 'Superior', zh: '头侧' },
  I: { en: 'Inferior', zh: '足侧' }
}

const FACE_NORMALS: Record<VolumeOrientationFace, [number, number, number]> = {
  A: [0, -1, 0],
  P: [0, 1, 0],
  L: [1, 0, 0],
  R: [-1, 0, 0],
  S: [0, 0, 1],
  I: [0, 0, -1]
}

const FACE_UP: Record<VolumeOrientationFace, [number, number, number]> = {
  A: [0, 0, 1],
  P: [0, 0, 1],
  L: [0, 0, 1],
  R: [0, 0, 1],
  S: [0, -1, 0],
  I: [0, -1, 0]
}

const CAMERA_FACING: [number, number, number] = [0, -1, 0]
const SCREEN_UP: [number, number, number] = [0, 0, 1]

function normalize(vector: number[]): [number, number, number] {
  const length = Math.hypot(vector[0] ?? 0, vector[1] ?? 0, vector[2] ?? 0)
  if (length <= 1e-12) {
    return [0, 0, 1]
  }
  return [vector[0]! / length, vector[1]! / length, vector[2]! / length]
}

function cross(left: number[], right: number[]): [number, number, number] {
  return [
    left[1]! * right[2]! - left[2]! * right[1]!,
    left[2]! * right[0]! - left[0]! * right[2]!,
    left[0]! * right[1]! - left[1]! * right[0]!
  ]
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): [number, number, number] {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index]!, 0)) as [number, number, number]
}

function quaternionToMatrix(quaternion: [number, number, number, number]): number[][] {
  const [x, y, z, w] = normalizeQuaternion(quaternion)
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]
  ]
}

function matrixToQuaternion(matrix: number[][]): [number, number, number, number] {
  const trace = matrix[0]![0]! + matrix[1]![1]! + matrix[2]![2]!
  let quaternion: [number, number, number, number]
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2
    quaternion = [(matrix[2]![1]! - matrix[1]![2]!) / scale, (matrix[0]![2]! - matrix[2]![0]!) / scale, (matrix[1]![0]! - matrix[0]![1]!) / scale, scale / 4]
  } else if (matrix[0]![0]! > matrix[1]![1]! && matrix[0]![0]! > matrix[2]![2]!) {
    const scale = Math.sqrt(1 + matrix[0]![0]! - matrix[1]![1]! - matrix[2]![2]!) * 2
    quaternion = [scale / 4, (matrix[0]![1]! + matrix[1]![0]!) / scale, (matrix[0]![2]! + matrix[2]![0]!) / scale, (matrix[2]![1]! - matrix[1]![2]!) / scale]
  } else if (matrix[1]![1]! > matrix[2]![2]!) {
    const scale = Math.sqrt(1 + matrix[1]![1]! - matrix[0]![0]! - matrix[2]![2]!) * 2
    quaternion = [(matrix[0]![1]! + matrix[1]![0]!) / scale, scale / 4, (matrix[1]![2]! + matrix[2]![1]!) / scale, (matrix[0]![2]! - matrix[2]![0]!) / scale]
  } else {
    const scale = Math.sqrt(1 + matrix[2]![2]! - matrix[0]![0]! - matrix[1]![1]!) * 2
    quaternion = [(matrix[0]![2]! + matrix[2]![0]!) / scale, (matrix[1]![2]! + matrix[2]![1]!) / scale, scale / 4, (matrix[1]![0]! - matrix[0]![1]!) / scale]
  }
  return normalizeQuaternion(quaternion)
}

function normalizeQuaternion(quaternion: [number, number, number, number]): [number, number, number, number] {
  const length = Math.hypot(...quaternion)
  if (length <= 1e-12) {
    return [0, 0, 0, 1]
  }
  return quaternion.map((value) => value / length) as [number, number, number, number]
}

export function isVolumeOrientationFace(value: unknown): value is VolumeOrientationFace {
  return typeof value === 'string' && VOLUME_ORIENTATION_FACES.includes(value.toUpperCase() as VolumeOrientationFace)
}

export function getVolumeOrientationIcon(face: VolumeOrientationFace | null | undefined): string {
  return face ? `orientation-face-${face}` : VOLUME_ORIENTATION_OBLIQUE_ICON
}

export function createVolumeOrientationQuaternion(face: VolumeOrientationFace): [number, number, number, number] {
  const normal = FACE_NORMALS[face]
  const up = FACE_UP[face]
  const sourceRight = normalize(cross(normal, up))
  const targetRight = normalize(cross(CAMERA_FACING, SCREEN_UP))
  const sourceBasis = [sourceRight, normal, up]
  const targetBasis = [targetRight, CAMERA_FACING, SCREEN_UP]
  const rotation = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, column) =>
      targetBasis.reduce(
        (sum, targetColumn, basisIndex) => sum + targetColumn[row]! * sourceBasis[basisIndex]![column]!,
        0
      )
    )
  )
  return matrixToQuaternion(rotation)
}

export function resolveVolumeOrientationFace(
  quaternion: [number, number, number, number] | null | undefined,
  maxAngleDegrees = VOLUME_ORIENTATION_SNAP_DEGREES
): VolumeOrientationFace | null {
  if (!quaternion) {
    return null
  }
  const rotation = quaternionToMatrix(quaternion)
  let bestFace: VolumeOrientationFace | null = null
  let bestDot = -1
  for (const face of VOLUME_ORIENTATION_FACES) {
    const transformed = normalize(multiplyMatrixVector(rotation, FACE_NORMALS[face]))
    const dot = transformed.reduce((sum, value, index) => sum + value * CAMERA_FACING[index]!, 0)
    if (dot > bestDot) {
      bestDot = dot
      bestFace = face
    }
  }
  const angle = Math.acos(Math.max(-1, Math.min(1, bestDot))) * 180 / Math.PI
  return angle <= Math.max(0, maxAngleDegrees) ? bestFace : null
}
