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

  if (!props.mprCrosshair || props.stageWidth <= 0 || props.stageHeight <= 0) {
    return
  }

  const axes = getViewportAxes(props.viewportKey)
  const horizontalYNorm = props.mprCrosshair.horizontalPosition
  const verticalXNorm = props.mprCrosshair.verticalPosition
  const centerX = props.mprCrosshair.centerX * props.stageWidth
  const centerY = props.mprCrosshair.centerY * props.stageHeight
  const horizontalY = (horizontalYNorm ?? props.mprCrosshair.centerY) * props.stageHeight
  const verticalX = (verticalXNorm ?? props.mprCrosshair.centerX) * props.stageWidth

  const gapStartX = Math.max(0, centerX - gapRadius.value)
  const gapEndX = Math.min(props.stageWidth, centerX + gapRadius.value)
  if (gapStartX > 0) {
    drawStroke(context, 0, horizontalY, gapStartX, horizontalY, axes.horizontal.color, axes.horizontal.thickness)
  }
  if (gapEndX < props.stageWidth) {
    drawStroke(context, gapEndX, horizontalY, props.stageWidth, horizontalY, axes.horizontal.color, axes.horizontal.thickness)
  }

  const gapStartY = Math.max(0, centerY - gapRadius.value)
  const gapEndY = Math.min(props.stageHeight, centerY + gapRadius.value)
  if (gapStartY > 0) {
    drawStroke(context, verticalX, 0, verticalX, gapStartY, axes.vertical.color, axes.vertical.thickness)
  }
  if (gapEndY < props.stageHeight) {
    drawStroke(context, verticalX, gapEndY, verticalX, props.stageHeight, axes.vertical.color, axes.vertical.thickness)
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
