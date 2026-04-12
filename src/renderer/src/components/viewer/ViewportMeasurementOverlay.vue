<script setup lang="ts">
import { computed } from 'vue'
import type { MeasurementDraft, MeasurementDraftPoint, MeasurementOverlay, MeasurementToolType } from '../../types/viewer'

interface ScreenPoint {
  x: number
  y: number
}

interface RenderedMeasurement {
  key: string
  toolType: MeasurementToolType
  screenPoints: ScreenPoint[]
  handlePoints: ScreenPoint[]
  labelLines: string[]
  labelStyle: { left: string; top: string } | null
  rectBounds: { left: number; top: number; width: number; height: number } | null
  mode: 'committed' | 'selected' | 'moving' | 'draft'
}

const committedStrokeOuter = 'rgba(3,15,24,0.92)'
const committedStrokeInner = 'rgba(85,231,255,0.98)'
const draftStrokeOuter = 'rgba(56,22,4,0.92)'
const draftStrokeInner = 'rgba(255,184,77,0.98)'

const props = withDefaults(
  defineProps<{
    draftMeasurement?: MeasurementDraft | null
    measurements?: MeasurementOverlay[]
    imageFrame: {
      left: number
      top: number
      width: number
      height: number
    }
  }>(),
  {
    draftMeasurement: null,
    measurements: () => []
  }
)

function toScreenPoint(point: MeasurementDraftPoint): ScreenPoint {
  return {
    x: props.imageFrame.left + point.x * props.imageFrame.width,
    y: props.imageFrame.top + point.y * props.imageFrame.height
  }
}

function getRectBounds(screenPoints: ScreenPoint[]) {
  if (screenPoints.length < 2) {
    return null
  }
  const [start, end] = screenPoints
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

function getHandlePoints(
  toolType: MeasurementToolType,
  screenPoints: ScreenPoint[],
  rectBounds: { left: number; top: number; width: number; height: number } | null
): ScreenPoint[] {
  if ((toolType === 'rect' || toolType === 'ellipse') && rectBounds) {
    return [
      { x: rectBounds.left, y: rectBounds.top },
      { x: rectBounds.left + rectBounds.width, y: rectBounds.top },
      { x: rectBounds.left + rectBounds.width, y: rectBounds.top + rectBounds.height },
      { x: rectBounds.left, y: rectBounds.top + rectBounds.height }
    ]
  }
  return screenPoints
}

function getLabelPosition(
  toolType: MeasurementToolType,
  screenPoints: ScreenPoint[],
  rectBounds: { left: number; top: number; width: number; height: number } | null
) {
  if (!screenPoints.length) {
    return null
  }

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  const minX = props.imageFrame.left + 8
  const maxX = Math.max(props.imageFrame.left + props.imageFrame.width - 16, minX)
  const minY = props.imageFrame.top + 8
  const maxY = Math.max(props.imageFrame.top + props.imageFrame.height - 16, minY)

  if (toolType === 'line' && screenPoints.length >= 2) {
    return {
      x: clamp(screenPoints[1].x + 12, minX, maxX),
      y: clamp(screenPoints[1].y - 28, minY, maxY)
    }
  }

  if ((toolType === 'rect' || toolType === 'ellipse') && rectBounds) {
    return {
      x: clamp(rectBounds.left + rectBounds.width + 12, minX, maxX),
      y: clamp(rectBounds.top - 24, minY, maxY)
    }
  }

  if (toolType === 'angle') {
    const anchor = screenPoints.length >= 2 ? screenPoints[1] : screenPoints[0]
    return {
      x: clamp(anchor.x + 12, minX, maxX),
      y: clamp(anchor.y - 28, minY, maxY)
    }
  }

  return {
    x: clamp(screenPoints[0].x + 12, minX, maxX),
    y: clamp(screenPoints[0].y - 28, minY, maxY)
  }
}

function buildRenderedMeasurement(
  key: string,
  toolType: MeasurementToolType,
  points: MeasurementDraftPoint[],
  labelLines: string[],
  mode: 'committed' | 'selected' | 'moving' | 'draft'
): RenderedMeasurement | null {
  if (!points.length || props.imageFrame.width <= 0 || props.imageFrame.height <= 0) {
    return null
  }

  const screenPoints = points.map((point) => toScreenPoint(point))
  const rectBounds = getRectBounds(screenPoints)
  const handlePoints = getHandlePoints(toolType, screenPoints, rectBounds)
  const labelPosition = getLabelPosition(toolType, screenPoints, rectBounds)

  return {
    key,
    toolType,
    screenPoints,
    handlePoints,
    labelLines,
    mode,
    rectBounds,
    labelStyle: labelLines.length && labelPosition
      ? {
          left: `${Math.round(labelPosition.x)}px`,
          top: `${Math.round(labelPosition.y)}px`
        }
      : null
  }
}

const renderedMeasurements = computed(() =>
  props.measurements
    .map((measurement) =>
      buildRenderedMeasurement(
        measurement.measurementId,
        measurement.toolType,
        measurement.points,
        measurement.labelLines ?? [],
        'committed'
      )
    )
    .filter((measurement): measurement is RenderedMeasurement => measurement != null)
)

const renderedDraftMeasurement = computed(() =>
  props.draftMeasurement
    ? buildRenderedMeasurement(
        'draft',
        props.draftMeasurement.toolType,
        props.draftMeasurement.points,
        props.draftMeasurement.labelLines ?? [],
        props.draftMeasurement.measurementId
          ? props.draftMeasurement.selectedHandleIndex === -1 && props.draftMeasurement.isMoving
            ? 'moving'
            : props.draftMeasurement.selectedHandleIndex == null || props.draftMeasurement.selectedHandleIndex === -1
              ? 'selected'
              : 'draft'
          : 'draft'
      )
    : null
)

const allRenderedMeasurements = computed(() =>
  renderedDraftMeasurement.value ? [...renderedMeasurements.value, renderedDraftMeasurement.value] : renderedMeasurements.value
)

function getOuterStroke(measurement: RenderedMeasurement): string {
  return measurement.mode === 'committed' ? committedStrokeOuter : draftStrokeOuter
}

function getInnerStroke(measurement: RenderedMeasurement): string {
  if (measurement.mode === 'moving') {
    return 'rgba(255,224,130,1)'
  }
  if (measurement.mode === 'selected') {
    return 'rgba(255,202,111,0.98)'
  }
  return measurement.mode === 'committed' ? committedStrokeInner : draftStrokeInner
}

function getLabelClass(measurement: RenderedMeasurement): string {
  return measurement.mode !== 'committed'
    ? 'border-amber-300/60 bg-[rgba(40,20,6,0.94)] text-amber-50'
    : 'border-sky-300/50 bg-[rgba(7,16,28,0.92)] text-slate-50'
}

function getOuterStrokeDasharray(measurement: RenderedMeasurement): string | undefined {
  return measurement.mode === 'draft' ? '10 7' : undefined
}

function getInnerStrokeDasharray(measurement: RenderedMeasurement): string | undefined {
  return measurement.mode === 'draft' ? '10 7' : undefined
}

function getHandleRadius(measurement: RenderedMeasurement): number {
  return measurement.mode === 'committed' ? 3.5 : 4
}

function getHandleFill(measurement: RenderedMeasurement): string {
  return measurement.mode === 'committed' ? 'white' : 'rgba(255,244,214,0.98)'
}

function shouldRenderHandles(measurement: RenderedMeasurement): boolean {
  return measurement.mode !== 'committed'
}

function getShapeFill(measurement: RenderedMeasurement): string {
  if (measurement.mode === 'moving') {
    return 'rgba(255,184,77,0.18)'
  }
  if (measurement.mode === 'selected') {
    return 'rgba(255,184,77,0.1)'
  }
  return 'none'
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[4]">
    <svg
      class="absolute inset-0"
      aria-hidden="true"
      shape-rendering="geometricPrecision"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <template v-for="measurement in allRenderedMeasurements" :key="measurement.key">
        <g v-if="measurement.toolType === 'line' && measurement.screenPoints.length >= 2">
          <line
            :x1="measurement.screenPoints[0].x"
            :y1="measurement.screenPoints[0].y"
            :x2="measurement.screenPoints[1].x"
            :y2="measurement.screenPoints[1].y"
            :stroke="getOuterStroke(measurement)"
            stroke-width="5"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getOuterStrokeDasharray(measurement)"
          />
          <line
            :x1="measurement.screenPoints[0].x"
            :y1="measurement.screenPoints[0].y"
            :x2="measurement.screenPoints[1].x"
            :y2="measurement.screenPoints[1].y"
            :stroke="getInnerStroke(measurement)"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getInnerStrokeDasharray(measurement)"
          />
        </g>

        <g v-else-if="measurement.toolType === 'rect' && measurement.rectBounds">
          <rect
            :x="measurement.rectBounds.left"
            :y="measurement.rectBounds.top"
            :width="measurement.rectBounds.width"
            :height="measurement.rectBounds.height"
            :fill="getShapeFill(measurement)"
            :stroke="getOuterStroke(measurement)"
            stroke-width="5"
            stroke-linejoin="round"
            :stroke-dasharray="getOuterStrokeDasharray(measurement)"
          />
          <rect
            :x="measurement.rectBounds.left"
            :y="measurement.rectBounds.top"
            :width="measurement.rectBounds.width"
            :height="measurement.rectBounds.height"
            :fill="getShapeFill(measurement)"
            :stroke="getInnerStroke(measurement)"
            stroke-width="2.5"
            stroke-linejoin="round"
            :stroke-dasharray="getInnerStrokeDasharray(measurement)"
          />
        </g>

        <g v-else-if="measurement.toolType === 'ellipse' && measurement.rectBounds">
          <ellipse
            :cx="measurement.rectBounds.left + measurement.rectBounds.width / 2"
            :cy="measurement.rectBounds.top + measurement.rectBounds.height / 2"
            :rx="measurement.rectBounds.width / 2"
            :ry="measurement.rectBounds.height / 2"
            :fill="getShapeFill(measurement)"
            :stroke="getOuterStroke(measurement)"
            stroke-width="5"
            :stroke-dasharray="getOuterStrokeDasharray(measurement)"
          />
          <ellipse
            :cx="measurement.rectBounds.left + measurement.rectBounds.width / 2"
            :cy="measurement.rectBounds.top + measurement.rectBounds.height / 2"
            :rx="measurement.rectBounds.width / 2"
            :ry="measurement.rectBounds.height / 2"
            :fill="getShapeFill(measurement)"
            :stroke="getInnerStroke(measurement)"
            stroke-width="2.5"
            :stroke-dasharray="getInnerStrokeDasharray(measurement)"
          />
        </g>

        <g v-else-if="measurement.toolType === 'angle'">
          <line
            v-if="measurement.screenPoints.length >= 2"
            :x1="measurement.screenPoints[0].x"
            :y1="measurement.screenPoints[0].y"
            :x2="measurement.screenPoints[1].x"
            :y2="measurement.screenPoints[1].y"
            :stroke="getOuterStroke(measurement)"
            stroke-width="5"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getOuterStrokeDasharray(measurement)"
          />
          <line
            v-if="measurement.screenPoints.length >= 2"
            :x1="measurement.screenPoints[0].x"
            :y1="measurement.screenPoints[0].y"
            :x2="measurement.screenPoints[1].x"
            :y2="measurement.screenPoints[1].y"
            :stroke="getInnerStroke(measurement)"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getInnerStrokeDasharray(measurement)"
          />
          <line
            v-if="measurement.screenPoints.length >= 3"
            :x1="measurement.screenPoints[1].x"
            :y1="measurement.screenPoints[1].y"
            :x2="measurement.screenPoints[2].x"
            :y2="measurement.screenPoints[2].y"
            :stroke="getOuterStroke(measurement)"
            stroke-width="5"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getOuterStrokeDasharray(measurement)"
          />
          <line
            v-if="measurement.screenPoints.length >= 3"
            :x1="measurement.screenPoints[1].x"
            :y1="measurement.screenPoints[1].y"
            :x2="measurement.screenPoints[2].x"
            :y2="measurement.screenPoints[2].y"
            :stroke="getInnerStroke(measurement)"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getInnerStrokeDasharray(measurement)"
          />
        </g>

        <template v-if="shouldRenderHandles(measurement)">
          <circle
            v-for="(point, index) in measurement.handlePoints"
            :key="`${measurement.key}-point-${index}`"
            :cx="point.x"
            :cy="point.y"
            :r="getHandleRadius(measurement)"
            :fill="getHandleFill(measurement)"
            :stroke="getOuterStroke(measurement)"
            stroke-width="1.25"
          />
        </template>
      </template>
    </svg>

    <div
      v-for="measurement in allRenderedMeasurements"
      :key="`${measurement.key}-label`"
      v-show="measurement.labelLines.length && measurement.labelStyle"
      class="absolute rounded-lg border px-2 py-1 text-[12px] leading-4 shadow-[0_10px_24px_rgba(0,0,0,0.28)] [text-rendering:geometricPrecision] [transform:translateZ(0)]"
      :class="getLabelClass(measurement)"
      :style="measurement.labelStyle ?? undefined"
    >
      <div
        v-for="(line, index) in measurement.labelLines"
        :key="`${measurement.key}-label-${index}`"
        class="font-mono whitespace-nowrap"
      >
        {{ line }}
      </div>
    </div>
  </div>
</template>
