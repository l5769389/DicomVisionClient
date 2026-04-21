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
  if (thickness > 1) {
    context.strokeStyle = 'rgba(4, 8, 14, 0.72)'
    context.lineWidth = thickness + 1
    context.beginPath()
    context.moveTo(fromX, fromY)
    context.lineTo(toX, toY)
    context.stroke()
  }

  context.strokeStyle = color
  context.lineWidth = thickness
  context.beginPath()
  context.moveTo(fromX, fromY)
  context.lineTo(toX, toY)
  context.stroke()
}

function drawCrosshairLine(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  angleRad: number,
  color: string,
  thickness: number
): void {
  const dirX = Math.cos(angleRad)
  const dirY = Math.sin(angleRad)
  const lineLength = Math.hypot(props.stageWidth, props.stageHeight) + Math.max(props.stageWidth, props.stageHeight)
  const gap = gapRadius.value

  drawStroke(
    context,
    centerX - dirX * lineLength,
    centerY - dirY * lineLength,
    centerX - dirX * gap,
    centerY - dirY * gap,
    color,
    thickness
  )
  drawStroke(
    context,
    centerX + dirX * gap,
    centerY + dirY * gap,
    centerX + dirX * lineLength,
    centerY + dirY * lineLength,
    color,
    thickness
  )
}

function normalizeAngle(angleRad: number): number {
  const halfTurn = Math.PI
  let normalized = angleRad % halfTurn
  if (normalized < 0) {
    normalized += halfTurn
  }
  return normalized
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
  const centerX = props.mprCrosshair.centerX * props.stageWidth
  const centerY = props.mprCrosshair.centerY * props.stageHeight
  const horizontalAngle = normalizeAngle(props.mprCrosshair.horizontalAngleRad ?? 0)
  const verticalAngle = normalizeAngle(props.mprCrosshair.verticalAngleRad ?? horizontalAngle + Math.PI / 2)

  drawCrosshairLine(context, centerX, centerY, horizontalAngle, axes.horizontal.color, axes.horizontal.thickness)
  drawCrosshairLine(context, centerX, centerY, verticalAngle, axes.vertical.color, axes.vertical.thickness)
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
