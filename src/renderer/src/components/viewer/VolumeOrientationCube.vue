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
  const inverseX = -x
  const inverseY = -y
  const inverseZ = -z
  const inverseW = w
  const sinHalfAngle = Math.sqrt(Math.max(0, 1 - inverseW * inverseW))

  if (sinHalfAngle < 1e-6) {
    return 'rotate3d(0, 0, 1, 0deg)'
  }

  const axisX = inverseX / sinHalfAngle
  const axisY = inverseY / sinHalfAngle
  const axisZ = inverseZ / sinHalfAngle
  const angleDegrees = (2 * Math.acos(Math.max(-1, Math.min(1, inverseW))) * 180) / Math.PI

  return `rotate3d(${axisX}, ${axisY}, ${axisZ}, ${angleDegrees}deg)`
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
