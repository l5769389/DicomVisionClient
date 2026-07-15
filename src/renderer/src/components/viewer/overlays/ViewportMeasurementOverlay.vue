<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { DraftMeasurementMode, MeasurementDraft, MeasurementDraftPoint, MeasurementOverlay, MeasurementToolType } from '../../../types/viewer'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import { getSmoothCurveSegments, isValidMeasurement } from '../../../composables/measurements/measurementGeometry'
import {
  getFinalizedPointSequencePoints,
  isPointSequenceMeasurement
} from '../../../composables/measurements/measurementToolRules'
import {
  getOverlayHandlePointsFromRectBounds,
  getOverlayRectBoundsFromScreenPoints,
  toOverlayScreenPoint,
  type OverlayScreenPoint
} from './overlayGeometry'

interface RenderedMeasurement {
  key: string
  measurementId: string | null
  toolType: MeasurementToolType
  points: MeasurementDraftPoint[]
  screenPoints: OverlayScreenPoint[]
  handlePoints: OverlayScreenPoint[]
  labelLines: string[]
  labelStyle: { left: string; top: string } | null
  rectBounds: { left: number; top: number; width: number; height: number } | null
  smoothPathD: string
  closesSmoothPath: boolean
  mode: 'committed' | 'selected' | 'moving' | 'draft'
}

interface ParsedLabelLine {
  key: string | null
  value: string
}

const committedStrokeOuter = 'rgba(3,15,24,0.92)'
const draftStrokeOuter = 'rgba(56,22,4,0.92)'
const POINT_CLOSE_EPSILON = 0.0005

const { measurementStylePreference } = useUiPreferences()
const { overlayCopy } = useUiLocale()

const props = withDefaults(
  defineProps<{
    draftMeasurementMode?: DraftMeasurementMode | null
    draftMeasurement?: MeasurementDraft | null
    focusState?: 'focus' | 'context' | 'neutral'
    hideDraftHandles?: boolean
    measurements?: MeasurementOverlay[]
    imageFrame: {
      left: number
      top: number
      width: number
      height: number
    }
  }>(),
  {
    draftMeasurementMode: null,
    draftMeasurement: null,
    focusState: 'neutral',
    hideDraftHandles: false,
    measurements: () => []
  }
)

const emit = defineEmits<{
  copySelectedMeasurement: []
  deleteSelectedMeasurement: [measurementId?: string]
}>()

function getHandlePoints(
  toolType: MeasurementToolType,
  screenPoints: OverlayScreenPoint[],
  rectBounds: { left: number; top: number; width: number; height: number } | null
): OverlayScreenPoint[] {
  if ((toolType === 'rect' || toolType === 'ellipse') && rectBounds) {
    return getOverlayHandlePointsFromRectBounds(rectBounds)
  }
  return screenPoints
}

function getLabelPosition(
  toolType: MeasurementToolType,
  screenPoints: OverlayScreenPoint[],
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

  if ((toolType === 'line' || toolType === 'curve') && screenPoints.length >= 2) {
    const anchor = screenPoints[screenPoints.length - 1]
    return {
      x: clamp(anchor.x + 12, minX, maxX),
      y: clamp(anchor.y - 28, minY, maxY)
    }
  }

  if ((toolType === 'rect' || toolType === 'ellipse' || toolType === 'freeform') && rectBounds) {
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

function getScreenBounds(screenPoints: OverlayScreenPoint[]): { left: number; top: number; width: number; height: number } | null {
  if (!screenPoints.length) {
    return null
  }
  const xs = screenPoints.map((point) => point.x)
  const ys = screenPoints.map((point) => point.y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  }
}

function getSmoothPathD(screenPoints: OverlayScreenPoint[], closePath = false): string {
  if (screenPoints.length < 2) {
    return ''
  }

  const [start] = screenPoints
  const segments = getSmoothCurveSegments(screenPoints, closePath)
  const commands = segments
    .map((segment) => `C ${segment.controlPoint1.x},${segment.controlPoint1.y} ${segment.controlPoint2.x},${segment.controlPoint2.y} ${segment.end.x},${segment.end.y}`)
    .join(' ')
  return `M ${start.x},${start.y} ${commands}${closePath ? ' Z' : ''}`
}

function shouldCloseSmoothPath(params: {
  measurementId: string | null
  mode: RenderedMeasurement['mode']
  points: MeasurementDraftPoint[]
  screenPoints: OverlayScreenPoint[]
  toolType: MeasurementToolType
}): boolean {
  if (params.toolType !== 'freeform' || params.screenPoints.length <= 2) {
    return false
  }
  if (!isUnfinishedPointSequence(params)) {
    return true
  }

  return (
    isValidMeasurement('freeform', getFinalizedPointSequencePoints(params.points)) ||
    isValidMeasurement('freeform', params.points)
  )
}

function arePointsClose(a: MeasurementDraftPoint, b: MeasurementDraftPoint): boolean {
  return Math.abs(a.x - b.x) < POINT_CLOSE_EPSILON && Math.abs(a.y - b.y) < POINT_CLOSE_EPSILON
}

function arePointSequencesClose(a: MeasurementDraftPoint[], b: MeasurementDraftPoint[]): boolean {
  return a.length === b.length && a.every((point, index) => {
    const otherPoint = b[index]
    return otherPoint != null && arePointsClose(point, otherPoint)
  })
}

function isUnfinishedPointSequence(measurement: Pick<RenderedMeasurement, 'measurementId' | 'mode' | 'toolType'>): boolean {
  return measurement.mode === 'draft' && measurement.measurementId == null && isPointSequenceMeasurement(measurement.toolType)
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

  const screenPoints = points.map((point) => toOverlayScreenPoint(props.imageFrame, point))
  const rectBounds = toolType === 'freeform' ? getScreenBounds(screenPoints) : getOverlayRectBoundsFromScreenPoints(screenPoints)
  const handlePoints = getHandlePoints(toolType, screenPoints, rectBounds)
  const labelPosition = getLabelPosition(toolType, screenPoints, rectBounds)
  const measurementId = key === 'draft' ? props.draftMeasurement?.measurementId ?? null : key
  const closesSmoothPath = shouldCloseSmoothPath({
    measurementId,
    mode,
    points,
    screenPoints,
    toolType
  })

  return {
    key,
    measurementId,
    toolType,
    points,
    screenPoints,
    handlePoints,
    labelLines,
    mode,
    rectBounds,
    smoothPathD:
      (toolType === 'curve' || toolType === 'freeform') && screenPoints.length >= 2
        ? getSmoothPathD(screenPoints, closesSmoothPath)
        : '',
    closesSmoothPath,
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
    .filter((measurement) => {
      const draft = props.draftMeasurement
      if (!draft || draft.measurementId || !isPointSequenceMeasurement(draft.toolType) || measurement.toolType !== draft.toolType) {
        return true
      }

      const confirmedDraftPoints = getFinalizedPointSequencePoints(draft.points)
      return !arePointSequencesClose(measurement.points, confirmedDraftPoints)
    })
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
        props.draftMeasurementMode ?? 'draft'
      )
    : null
)

const allRenderedMeasurements = computed(() => {
  const draftMeasurement = renderedDraftMeasurement.value
  if (!draftMeasurement) {
    return renderedMeasurements.value
  }

  const committedMeasurements = draftMeasurement.measurementId
    ? renderedMeasurements.value.filter((measurement) => measurement.measurementId !== draftMeasurement.measurementId)
    : renderedMeasurements.value

  return [...committedMeasurements, draftMeasurement]
})

const selectedDraftActionStyle = computed(() => {
  const measurement = renderedDraftMeasurement.value
  if (!measurement || measurement.mode !== 'selected' || !measurement.measurementId) {
    return null
  }

  const anchorX = measurement.labelStyle
    ? Number.parseFloat(measurement.labelStyle.left)
    : measurement.handlePoints[0]?.x ?? measurement.screenPoints[0]?.x ?? props.imageFrame.left + 12
  const anchorY = measurement.labelStyle
    ? Number.parseFloat(measurement.labelStyle.top) - 42
    : (measurement.handlePoints[0]?.y ?? measurement.screenPoints[0]?.y ?? props.imageFrame.top + 12) - 42

  const minLeft = props.imageFrame.left + 8
  const maxLeft = Math.max(props.imageFrame.left + props.imageFrame.width - 128, minLeft)
  const minTop = props.imageFrame.top + 8
  const maxTop = Math.max(props.imageFrame.top + props.imageFrame.height - 36, minTop)

  return {
    left: `${Math.round(Math.max(minLeft, Math.min(maxLeft, anchorX)))}px`,
    top: `${Math.round(Math.max(minTop, Math.min(maxTop, anchorY)))}px`
  }
})

function getOuterStroke(measurement: RenderedMeasurement): string {
  return measurement.mode === 'committed' ? committedStrokeOuter : draftStrokeOuter
}

function getInnerStroke(measurement: RenderedMeasurement): string {
  return measurement.mode === 'committed'
    ? measurementStylePreference.value.completedColor
    : measurementStylePreference.value.editingColor
}

function getLabelClass(measurement: RenderedMeasurement): string {
  const focusClass =
    props.focusState === 'focus'
      ? 'ring-1 ring-cyan-200/22 shadow-[0_18px_34px_rgba(0,0,0,0.4)]'
      : props.focusState === 'context'
        ? 'border-slate-600/35 bg-[rgba(7,12,18,0.72)] text-slate-300 shadow-[0_8px_18px_rgba(0,0,0,0.18)]'
        : ''
  if (measurement.mode === 'selected' || measurement.mode === 'moving') {
    return `z-[12] border-amber-300/60 bg-[rgba(40,20,6,0.97)] text-amber-50 shadow-[0_16px_32px_rgba(0,0,0,0.4)] ${focusClass}`
  }
  return measurement.mode !== 'committed'
    ? `border-amber-300/60 bg-[rgba(40,20,6,0.94)] text-amber-50 ${focusClass}`
    : `border-sky-300/50 bg-[rgba(7,16,28,0.92)] text-slate-50 ${focusClass}`
}

function getOuterStrokeDasharray(measurement: RenderedMeasurement): string | undefined {
  return getMeasurementLineStyle(measurement) === 'dash' ? getMeasurementDasharray(measurement) : undefined
}

function getInnerStrokeDasharray(measurement: RenderedMeasurement): string | undefined {
  return getMeasurementLineStyle(measurement) === 'dash' ? getMeasurementDasharray(measurement) : undefined
}

function getMeasurementLineStyle(measurement: RenderedMeasurement): 'solid' | 'dash' {
  return measurement.mode === 'committed'
    ? measurementStylePreference.value.completedLineStyle
    : measurementStylePreference.value.editingLineStyle
}

function getInnerStrokeWidth(): number {
  return measurementStylePreference.value.lineWidth
}

function getOuterStrokeWidth(): number {
  return measurementStylePreference.value.lineWidth + 2.5
}

function getMeasurementDasharray(measurement: RenderedMeasurement): string {
  const width = measurementStylePreference.value.lineWidth
  const dash = measurement.mode === 'committed' ? Math.max(8, width * 4) : Math.max(10, width * 4)
  const gap = Math.max(6, width * 2.8)
  return `${dash} ${gap}`
}

function getHandleRadius(measurement: RenderedMeasurement): number {
  return measurement.mode === 'committed' ? 3.5 : 4
}

function getHandleFill(measurement: RenderedMeasurement): string {
  return measurement.mode === 'committed' ? 'white' : measurementStylePreference.value.editingColor
}

function shouldRenderHandles(measurement: RenderedMeasurement): boolean {
  if (props.hideDraftHandles && measurement.mode === 'draft' && measurement.toolType === 'freeform') {
    return false
  }
  return measurement.mode !== 'committed'
}

function getShapeFill(measurement: RenderedMeasurement): string {
  if (isUnfinishedPointSequence(measurement)) {
    return 'none'
  }
  if (measurement.mode === 'moving') {
    return hexToRgba(measurementStylePreference.value.editingColor, 0.18)
  }
  if (measurement.mode === 'selected') {
    return hexToRgba(measurementStylePreference.value.editingColor, 0.1)
  }
  return 'none'
}

function hexToRgba(color: string, opacity: number): string {
  const normalized = /^#[\da-f]{6}$/i.test(color) ? color.slice(1) : 'ffb84d'
  const red = parseInt(normalized.slice(0, 2), 16)
  const green = parseInt(normalized.slice(2, 4), 16)
  const blue = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red},${green},${blue},${opacity})`
}

function parseLabelLine(line: string): ParsedLabelLine {
  const normalized = line.trim()
  const match = normalized.match(/^([A-Za-z][A-Za-z/-]*)\s+(.+)$/)
  if (!match) {
    return {
      key: null,
      value: normalized
    }
  }

  return {
    key: match[1],
    value: match[2]
  }
}

function isKeyValueLabelLine(line: string): boolean {
  return parseLabelLine(line).key != null
}
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 transition-opacity duration-150"
    :class="props.focusState === 'focus' ? 'z-[11] opacity-100' : props.focusState === 'context' ? 'z-[4] opacity-[0.48]' : 'z-[4] opacity-100'"
  >
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
            :stroke-width="getOuterStrokeWidth()"
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
            :stroke-width="getInnerStrokeWidth()"
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
            :stroke-width="getOuterStrokeWidth()"
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
            :stroke-width="getInnerStrokeWidth()"
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
            :stroke-width="getOuterStrokeWidth()"
            :stroke-dasharray="getOuterStrokeDasharray(measurement)"
          />
          <ellipse
            :cx="measurement.rectBounds.left + measurement.rectBounds.width / 2"
            :cy="measurement.rectBounds.top + measurement.rectBounds.height / 2"
            :rx="measurement.rectBounds.width / 2"
            :ry="measurement.rectBounds.height / 2"
            :fill="getShapeFill(measurement)"
            :stroke="getInnerStroke(measurement)"
            :stroke-width="getInnerStrokeWidth()"
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
            :stroke-width="getOuterStrokeWidth()"
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
            :stroke-width="getInnerStrokeWidth()"
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
            :stroke-width="getOuterStrokeWidth()"
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
            :stroke-width="getInnerStrokeWidth()"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getInnerStrokeDasharray(measurement)"
          />
        </g>

        <g v-else-if="measurement.toolType === 'curve' && measurement.screenPoints.length >= 2">
          <path
            :d="measurement.smoothPathD"
            fill="none"
            :stroke="getOuterStroke(measurement)"
            :stroke-width="getOuterStrokeWidth()"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getOuterStrokeDasharray(measurement)"
          />
          <path
            :d="measurement.smoothPathD"
            fill="none"
            :stroke="getInnerStroke(measurement)"
            :stroke-width="getInnerStrokeWidth()"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getInnerStrokeDasharray(measurement)"
          />
        </g>

        <g v-else-if="measurement.toolType === 'freeform' && measurement.screenPoints.length >= 2">
          <path
            :d="measurement.smoothPathD"
            :fill="measurement.closesSmoothPath ? getShapeFill(measurement) : 'none'"
            :stroke="getOuterStroke(measurement)"
            :stroke-width="getOuterStrokeWidth()"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="getOuterStrokeDasharray(measurement)"
          />
          <path
            :d="measurement.smoothPathD"
            :fill="measurement.closesSmoothPath ? getShapeFill(measurement) : 'none'"
            :stroke="getInnerStroke(measurement)"
            :stroke-width="getInnerStrokeWidth()"
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
      class="absolute z-[5] rounded-lg border px-2 py-1 text-[12px] leading-4 shadow-[0_10px_24px_rgba(0,0,0,0.28)] [text-rendering:geometricPrecision] [transform:translateZ(0)]"
      :class="getLabelClass(measurement)"
      :style="measurement.labelStyle ?? undefined"
    >
      <div
        v-for="(line, index) in measurement.labelLines"
        :key="`${measurement.key}-label-${index}`"
        class="font-mono whitespace-nowrap"
        :class="
          isKeyValueLabelLine(line)
            ? 'grid min-w-[11.5rem] grid-cols-[2.8rem_minmax(0,1fr)] items-baseline gap-x-0.5'
            : 'block w-fit'
        "
      >
        <template v-if="parseLabelLine(line).key">
          <span class="text-slate-300/78">{{ parseLabelLine(line).key }}</span>
          <span class="text-right">{{ parseLabelLine(line).value }}</span>
        </template>
        <span v-else class="col-span-2">{{ parseLabelLine(line).value }}</span>
      </div>
    </div>

    <div
      v-if="selectedDraftActionStyle"
      class="pointer-events-auto absolute z-[13] inline-flex items-center gap-1 rounded-xl border border-amber-300/45 bg-[rgba(23,14,7,0.97)] px-1.5 py-1 shadow-[0_18px_34px_rgba(0,0,0,0.42)] backdrop-blur"
      :class="props.focusState === 'focus' ? 'ring-1 ring-amber-200/24' : ''"
      :style="selectedDraftActionStyle"
      @pointerdown.stop.prevent
    >
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-amber-50 transition hover:bg-amber-300/14"
        :title="overlayCopy.copy"
        :aria-label="overlayCopy.copyMeasurement"
        @click.stop="emit('copySelectedMeasurement')"
      >
        <AppIcon name="copy" :size="16" />
      </button>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/18 bg-red-400/10 text-red-100 transition hover:bg-red-400/18"
        :title="overlayCopy.delete"
        :aria-label="overlayCopy.deleteMeasurement"
        @pointerdown.stop.prevent="emit('deleteSelectedMeasurement', renderedDraftMeasurement?.measurementId ?? undefined)"
        @click.stop.prevent
      >
        <AppIcon name="trash" :size="16" />
      </button>
    </div>
  </div>
</template>
