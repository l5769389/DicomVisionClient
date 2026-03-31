<script setup lang="ts">
import { computed } from 'vue'
import type { OrientationInfo } from '../../types/viewer'

const DEFAULT_FACE_LABELS = {
  front: 'A',
  back: 'P',
  right: 'L',
  left: 'R',
  top: 'S',
  bottom: 'I'
} as const

const props = defineProps<{
  orientation: OrientationInfo
}>()

const cubeTransform = computed(() => {
  const quaternion = props.orientation.volumeQuaternion
  if (!quaternion) {
    return ''
  }

  const [x, y, z, w] = quaternion
  const xx = x * x
  const yy = y * y
  const zz = z * z
  const xy = x * y
  const xz = x * z
  const yz = y * z
  const wx = w * x
  const wy = w * y
  const wz = w * z

  // Camera quaternion -> visible model rotation = inverse(camera rotation).
  const patientRotation = [
    [1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy)],
    [2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx)],
    [2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy)]
  ]

  // Patient axes to CSS cube axes:
  // +L -> +X, +P -> -Z, +S -> -Y
  const basis = [
    [1, 0, 0],
    [0, 0, -1],
    [0, -1, 0]
  ]

  const multiply3x3 = (left: number[][], right: number[][]): number[][] =>
    left.map((row) =>
      right[0].map((_, columnIndex) => row.reduce((sum, value, rowIndex) => sum + value * right[rowIndex][columnIndex], 0))
    )

  const cubeRotation = multiply3x3(multiply3x3(basis, patientRotation), basis)
  const cssMatrix = [
    cubeRotation[0][0],
    cubeRotation[1][0],
    cubeRotation[2][0],
    0,
    cubeRotation[0][1],
    cubeRotation[1][1],
    cubeRotation[2][1],
    0,
    cubeRotation[0][2],
    cubeRotation[1][2],
    cubeRotation[2][2],
    0,
    0,
    0,
    0,
    1
  ]

  return `matrix3d(${cssMatrix.join(',')})`
})

const faces = [
  { key: 'front', label: DEFAULT_FACE_LABELS.front, transform: 'translateZ(22px)' },
  { key: 'back', label: DEFAULT_FACE_LABELS.back, transform: 'rotateY(180deg) translateZ(22px)' },
  { key: 'right', label: DEFAULT_FACE_LABELS.right, transform: 'rotateY(90deg) translateZ(22px)' },
  { key: 'left', label: DEFAULT_FACE_LABELS.left, transform: 'rotateY(-90deg) translateZ(22px)' },
  { key: 'top', label: DEFAULT_FACE_LABELS.top, transform: 'rotateX(90deg) translateZ(22px)' },
  { key: 'bottom', label: DEFAULT_FACE_LABELS.bottom, transform: 'rotateX(-90deg) translateZ(22px)' }
] as const
</script>

<template>
  <div class="viewer-orientation-cube">
    <div class="viewer-orientation-cube__viewport">
      <div class="viewer-orientation-cube__body" :style="{ transform: cubeTransform }">
        <span
          v-for="face in faces"
          :key="face.key"
          class="viewer-orientation-cube__face"
          :class="`viewer-orientation-cube__face--${face.key}`"
          :style="{ transform: face.transform }"
        >
          {{ face.label }}
        </span>
      </div>
    </div>
  </div>
</template>
