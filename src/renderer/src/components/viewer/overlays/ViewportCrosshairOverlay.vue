<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiPreferences, type CrosshairViewportPreference } from '../../../composables/ui/useUiPreferences'
import type { MprCrosshairInfo } from '../../../types/viewer'
import type { MprViewportKey } from '../../../types/viewer'

interface ImageFrame {
  left: number
  top: number
  width: number
  height: number
}

const props = withDefaults(
  defineProps<{
    imageFrame: ImageFrame
    isActive?: boolean
    mprCrosshair?: MprCrosshairInfo | null
    stageHeight: number
    stageWidth: number
    viewportKey: string
  }>(),
  {
    isActive: false,
    mprCrosshair: null
  }
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { crosshairConfigs } = useUiPreferences()
const gapRadius = computed(() => (props.isActive ? 6 : 5))

function getCrosshairConfig(key: MprViewportKey): CrosshairViewportPreference {
  return crosshairConfigs.value.find((item) => item.key === key) ?? crosshairConfigs.value[0]!
}

function getViewportAxes(viewportKey: string): { vertical: CrosshairViewportPreference; horizontal: CrosshairViewportPreference } {
  const axial = getCrosshairConfig('mpr-ax')
  const coronal = getCrosshairConfig('mpr-cor')
  const sagittal = getCrosshairConfig('mpr-sag')

  if (viewportKey === 'mpr-ax') {
    return { vertical: sagittal, horizontal: coronal }
  }
  if (viewportKey === 'mpr-cor') {
    return { vertical: sagittal, horizontal: axial }
  }

  return { vertical: coronal, horizontal: axial }
}

function drawStroke(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  thickness: number
): void {
  context.lineCap = 'butt'
  context.strokeStyle = 'rgba(4, 8, 14, 0.72)'
  context.lineWidth = thickness + 2
  context.beginPath()
  context.moveTo(fromX, fromY)
  context.lineTo(toX, toY)
  context.stroke()

  context.strokeStyle = color
  context.lineWidth = thickness
  context.beginPath()
  context.moveTo(fromX, fromY)
  context.lineTo(toX, toY)
  context.stroke()
}

function drawCrosshair(): void {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(props.stageWidth * dpr))
  canvas.height = Math.max(1, Math.round(props.stageHeight * dpr))
  canvas.style.width = `${props.stageWidth}px`
  canvas.style.height = `${props.stageHeight}px`

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.scale(dpr, dpr)

  if (!props.mprCrosshair || props.imageFrame.width <= 0 || props.imageFrame.height <= 0) {
    return
  }

  const { left, top, width, height } = props.imageFrame
  const axes = getViewportAxes(props.viewportKey)
  const horizontalYNorm = props.mprCrosshair.horizontalPosition
  const verticalXNorm = props.mprCrosshair.verticalPosition
  const centerX = left + (verticalXNorm ?? props.mprCrosshair.centerX) * width
  const centerY = top + (horizontalYNorm ?? props.mprCrosshair.centerY) * height
  const horizontalY = horizontalYNorm != null ? top + horizontalYNorm * height : null
  const verticalX = verticalXNorm != null ? left + verticalXNorm * width : null

  if (horizontalY != null) {
    const gapStart = Math.max(left, centerX - gapRadius.value)
    const gapEnd = Math.min(left + width, centerX + gapRadius.value)
    if (gapStart > left) {
      drawStroke(context, left, horizontalY, gapStart, horizontalY, axes.horizontal.color, axes.horizontal.thickness)
    }
    if (gapEnd < left + width) {
      drawStroke(context, gapEnd, horizontalY, left + width, horizontalY, axes.horizontal.color, axes.horizontal.thickness)
    }
  }

  if (verticalX != null) {
    const gapStart = Math.max(top, centerY - gapRadius.value)
    const gapEnd = Math.min(top + height, centerY + gapRadius.value)
    if (gapStart > top) {
      drawStroke(context, verticalX, top, verticalX, gapStart, axes.vertical.color, axes.vertical.thickness)
    }
    if (gapEnd < top + height) {
      drawStroke(context, verticalX, gapEnd, verticalX, top + height, axes.vertical.color, axes.vertical.thickness)
    }
  }
}

watch(
  () => [props.stageWidth, props.stageHeight, props.imageFrame, props.mprCrosshair, props.isActive, props.viewportKey, crosshairConfigs.value] as const,
  () => {
    drawCrosshair()
  },
  { deep: true, immediate: true }
)
</script>

<template>
  <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-[2]" />
</template>
