<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MprCrosshairInfo } from '../../../types/viewer'

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

const lineThickness = computed(() => (Math.min(props.imageFrame.width, props.imageFrame.height) >= 700 ? 2 : 1))
const gapRadius = computed(() => (props.isActive ? 6 : 5))

function getHorizontalColor(): string {
  if (props.viewportKey === 'mpr-cor' || props.viewportKey === 'mpr-sag') {
    return 'rgba(255, 64, 64, 1)'
  }
  return 'rgba(39, 214, 112, 1)'
}

function getVerticalColor(): string {
  if (props.viewportKey === 'mpr-sag') {
    return 'rgba(39, 214, 112, 1)'
  }
  return 'rgba(46, 132, 255, 1)'
}

function drawStroke(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string
): void {
  context.lineCap = 'butt'
  context.strokeStyle = 'rgba(4, 8, 14, 0.72)'
  context.lineWidth = lineThickness.value + 2
  context.beginPath()
  context.moveTo(fromX, fromY)
  context.lineTo(toX, toY)
  context.stroke()

  context.strokeStyle = color
  context.lineWidth = lineThickness.value
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
      drawStroke(context, left, horizontalY, gapStart, horizontalY, getHorizontalColor())
    }
    if (gapEnd < left + width) {
      drawStroke(context, gapEnd, horizontalY, left + width, horizontalY, getHorizontalColor())
    }
  }

  if (verticalX != null) {
    const gapStart = Math.max(top, centerY - gapRadius.value)
    const gapEnd = Math.min(top + height, centerY + gapRadius.value)
    if (gapStart > top) {
      drawStroke(context, verticalX, top, verticalX, gapStart, getVerticalColor())
    }
    if (gapEnd < top + height) {
      drawStroke(context, verticalX, gapEnd, verticalX, top + height, getVerticalColor())
    }
  }
}

watch(
  () => [props.stageWidth, props.stageHeight, props.imageFrame, props.mprCrosshair, props.isActive, props.viewportKey] as const,
  () => {
    drawCrosshair()
  },
  { deep: true, immediate: true }
)
</script>

<template>
  <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 z-[2]" />
</template>
