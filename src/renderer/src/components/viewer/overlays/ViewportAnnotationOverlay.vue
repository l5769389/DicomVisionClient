<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { AnnotationDraft, AnnotationOverlay, AnnotationSize } from '../../../types/viewer'
import { toOverlayScreenPoint, type OverlayScreenPoint } from './overlayGeometry'

const SIZE_CONFIG: Record<AnnotationSize, { fontSize: number; lineWidth: number; handleRadius: number }> = {
  sm: { fontSize: 12, lineWidth: 2, handleRadius: 3.5 },
  md: { fontSize: 14, lineWidth: 2.5, handleRadius: 4 },
  lg: { fontSize: 16, lineWidth: 3, handleRadius: 4.5 }
}

const COLOR_OPTIONS = ['#ffd166', '#7dd3fc', '#86efac', '#fda4af', '#f59e0b', '#ffffff']
const SIZE_OPTIONS: AnnotationSize[] = ['sm', 'md', 'lg']

interface RenderedAnnotation {
  annotationId: string
  screenPoints: OverlayScreenPoint[]
  color: string
  text: string
  size: AnnotationSize
  lineWidth: number
  fontSize: number
  handleRadius: number
  labelStyle: { left: string; top: string } | null
  editorStyle: { left: string; top: string } | null
  arrowHead: string
  isDraft: boolean
}

const props = withDefaults(
  defineProps<{
    annotations?: AnnotationOverlay[]
    selectedAnnotationId?: string | null
    draftAnnotation?: AnnotationDraft | null
    imageFrame: {
      left: number
      top: number
      width: number
      height: number
    }
  }>(),
  {
    annotations: () => [],
    selectedAnnotationId: null,
    draftAnnotation: null
  }
)

const emit = defineEmits<{
  copyAnnotation: [annotationId: string]
  deleteAnnotation: [annotationId: string]
  updateAnnotationColor: [payload: { annotationId: string; color: string }]
  updateAnnotationSize: [payload: { annotationId: string; size: AnnotationSize }]
  updateAnnotationText: [payload: { annotationId: string; text: string }]
}>()

const openStyleMenuAnnotationId = ref<string | null>(null)

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function buildArrowHead(start: OverlayScreenPoint, end: OverlayScreenPoint, size: number): string {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return ''
  }

  const ux = dx / length
  const uy = dy / length
  const backX = end.x - ux * (size * 2.8)
  const backY = end.y - uy * (size * 2.8)
  const perpX = -uy * size
  const perpY = ux * size

  return `${end.x},${end.y} ${backX + perpX},${backY + perpY} ${backX - perpX},${backY - perpY}`
}

function buildLabelStyle(points: OverlayScreenPoint[], fontSize: number): { left: string; top: string } | null {
  if (!points.length) {
    return null
  }

  const anchor = points[0]
  const minX = props.imageFrame.left + 8
  const maxX = Math.max(props.imageFrame.left + props.imageFrame.width - 180, minX)
  const minY = props.imageFrame.top + 8
  const maxY = Math.max(props.imageFrame.top + props.imageFrame.height - 44, minY)

  return {
    left: `${Math.round(clamp(anchor.x + 12, minX, maxX))}px`,
    top: `${Math.round(clamp(anchor.y - (fontSize + 10), minY, maxY))}px`
  }
}

function buildEditorStyle(points: OverlayScreenPoint[]): { left: string; top: string } | null {
  if (!points.length) {
    return null
  }

  const anchor = points[0]
  const minX = props.imageFrame.left + 8
  const maxX = Math.max(props.imageFrame.left + props.imageFrame.width - 320, minX)
  const minY = props.imageFrame.top + 8
  const maxY = Math.max(props.imageFrame.top + props.imageFrame.height - 48, minY)

  return {
    left: `${Math.round(clamp(anchor.x + 12, minX, maxX))}px`,
    top: `${Math.round(clamp(anchor.y - 28, minY, maxY))}px`
  }
}

function buildRenderedAnnotation(
  annotation: AnnotationOverlay | AnnotationDraft,
  annotationId: string,
  isDraft: boolean
): RenderedAnnotation | null {
  if (!annotation.points.length || props.imageFrame.width <= 0 || props.imageFrame.height <= 0) {
    return null
  }

  const config = SIZE_CONFIG[annotation.size]
  const screenPoints = annotation.points.map((point) => toOverlayScreenPoint(props.imageFrame, point))
  const arrowHead =
    screenPoints.length >= 2 ? buildArrowHead(screenPoints[0], screenPoints[1], config.lineWidth * 2.8) : ''

  return {
    annotationId,
    screenPoints,
    color: annotation.color,
    text: annotation.text,
    size: annotation.size,
    lineWidth: config.lineWidth,
    fontSize: config.fontSize,
    handleRadius: config.handleRadius,
    labelStyle: buildLabelStyle(screenPoints, config.fontSize),
    editorStyle: buildEditorStyle(screenPoints),
    arrowHead,
    isDraft
  }
}

const renderedAnnotations = computed(() =>
  props.annotations
    .map((annotation) => buildRenderedAnnotation(annotation, annotation.annotationId, false))
    .filter((annotation): annotation is RenderedAnnotation => annotation != null)
)

const renderedDraftAnnotation = computed(() =>
  props.draftAnnotation
    ? buildRenderedAnnotation(props.draftAnnotation, props.draftAnnotation.annotationId ?? 'draft', true)
    : null
)

const selectedAnnotation = computed(
  () => renderedAnnotations.value.find((annotation) => annotation.annotationId === props.selectedAnnotationId) ?? null
)

watch(
  () => props.selectedAnnotationId,
  (value) => {
    if (!value || openStyleMenuAnnotationId.value !== value) {
      openStyleMenuAnnotationId.value = null
    }
  }
)
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[4]">
    <svg class="absolute inset-0" aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none">
      <template v-for="annotation in renderedAnnotations" :key="annotation.annotationId">
        <line
          v-if="annotation.screenPoints.length >= 2"
          :x1="annotation.screenPoints[0].x"
          :y1="annotation.screenPoints[0].y"
          :x2="annotation.screenPoints[1].x"
          :y2="annotation.screenPoints[1].y"
          :stroke="annotation.color"
          :stroke-width="annotation.lineWidth"
          stroke-linecap="round"
        />
        <polygon
          v-if="annotation.arrowHead"
          :points="annotation.arrowHead"
          :fill="annotation.color"
        />
        <template v-if="props.selectedAnnotationId === annotation.annotationId && annotation.screenPoints.length >= 2">
          <circle
            v-for="(point, index) in annotation.screenPoints.slice(0, 2)"
            :key="`${annotation.annotationId}-handle-${index}`"
            :cx="point.x"
            :cy="point.y"
            :r="annotation.handleRadius"
            fill="white"
            :stroke="annotation.color"
            stroke-width="1.5"
          />
        </template>
      </template>

      <template v-if="renderedDraftAnnotation">
        <line
          v-if="renderedDraftAnnotation.screenPoints.length >= 2"
          :x1="renderedDraftAnnotation.screenPoints[0].x"
          :y1="renderedDraftAnnotation.screenPoints[0].y"
          :x2="renderedDraftAnnotation.screenPoints[1].x"
          :y2="renderedDraftAnnotation.screenPoints[1].y"
          :stroke="renderedDraftAnnotation.color"
          :stroke-width="renderedDraftAnnotation.lineWidth"
          stroke-linecap="round"
          stroke-dasharray="8 6"
        />
        <polygon
          v-if="renderedDraftAnnotation.arrowHead"
          :points="renderedDraftAnnotation.arrowHead"
          :fill="renderedDraftAnnotation.color"
        />
      </template>
    </svg>

    <div
      v-for="annotation in renderedAnnotations"
      :key="`${annotation.annotationId}-label`"
      v-show="annotation.labelStyle && (props.selectedAnnotationId === annotation.annotationId || annotation.text.trim())"
      class="absolute max-w-[240px]"
      :style="(props.selectedAnnotationId === annotation.annotationId ? annotation.editorStyle : annotation.labelStyle) ?? undefined"
    >
      <div
        v-if="props.selectedAnnotationId === annotation.annotationId"
        data-annotation-ui-root
        class="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-[rgba(7,14,24,0.96)] px-2 py-2 shadow-[0_14px_28px_rgba(0,0,0,0.34)] backdrop-blur"
        @pointerdown.stop
      >
        <input
          class="min-w-[140px] rounded-lg border border-white/10 bg-white/6 px-2 py-1.5 text-sm text-slate-50 outline-none placeholder:text-slate-400"
          type="text"
          :value="annotation.text"
          placeholder="Annotation"
          @input="emit('updateAnnotationText', { annotationId: annotation.annotationId, text: ($event.target as HTMLInputElement).value })"
        />
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-slate-100 transition hover:bg-white/12"
          @click.stop="openStyleMenuAnnotationId = openStyleMenuAnnotationId === annotation.annotationId ? null : annotation.annotationId"
        >
          <AppIcon name="chevron-down" :size="14" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-slate-100 transition hover:bg-white/12"
          @click.stop="emit('copyAnnotation', annotation.annotationId)"
        >
          <AppIcon name="copy" :size="14" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/18 bg-red-400/10 text-red-100 transition hover:bg-red-400/18"
          @click.stop="emit('deleteAnnotation', annotation.annotationId)"
        >
          <AppIcon name="trash" :size="14" />
        </button>

        <div
          v-if="openStyleMenuAnnotationId === annotation.annotationId"
          class="absolute right-0 top-[calc(100%+8px)] z-[6] w-[220px] rounded-xl border border-white/10 bg-[rgba(7,14,24,0.98)] p-3 shadow-[0_18px_36px_rgba(0,0,0,0.38)]"
        >
          <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Color</div>
          <div class="mb-3 flex flex-wrap gap-2">
            <button
              v-for="color in COLOR_OPTIONS"
              :key="color"
              type="button"
              class="h-7 w-7 rounded-full border-2 transition"
              :class="annotation.color === color ? 'border-white' : 'border-white/10'"
              :style="{ backgroundColor: color }"
              @click.stop="emit('updateAnnotationColor', { annotationId: annotation.annotationId, color })"
            />
          </div>
          <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Size</div>
          <div class="flex gap-2">
            <button
              v-for="size in SIZE_OPTIONS"
              :key="size"
              type="button"
              class="flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium uppercase tracking-[0.08em] transition"
              :class="annotation.size === size ? 'border-sky-300/50 bg-sky-300/12 text-slate-50' : 'border-white/10 bg-white/6 text-slate-300 hover:bg-white/12'"
              @click.stop="emit('updateAnnotationSize', { annotationId: annotation.annotationId, size })"
            >
              {{ size }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-else
        class="rounded-lg border border-white/10 bg-[rgba(7,14,24,0.92)] px-2 py-1 text-slate-50 shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
        :style="{ color: annotation.color, fontSize: `${annotation.fontSize}px` }"
      >
        {{ annotation.text }}
      </div>
    </div>

    <div
      v-if="renderedDraftAnnotation?.labelStyle && renderedDraftAnnotation.text.trim()"
      class="absolute rounded-lg border border-white/10 bg-[rgba(7,14,24,0.82)] px-2 py-1 text-slate-400 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
      :style="{
        ...(renderedDraftAnnotation.labelStyle ?? {}),
        fontSize: `${renderedDraftAnnotation.fontSize}px`
      }"
    >
      {{ renderedDraftAnnotation.text }}
    </div>
  </div>
</template>
