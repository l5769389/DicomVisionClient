<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  CornerInfo,
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementOverlay,
  MprCrosshairInfo,
  MprFrameInfo,
  OrientationInfo,
  ScaleBarInfo,
  QaWaterAnalysis,
  ViewerMtfItem
} from '../../../types/viewer'
import VolumeOrientationCube from '../volume/VolumeOrientationCube.vue'
import ViewportAnnotationOverlay from '../overlays/ViewportAnnotationOverlay.vue'
import ViewportCornerOverlay from '../overlays/ViewportCornerOverlay.vue'
import ViewportCrosshairOverlay from '../overlays/ViewportCrosshairOverlay.vue'
import ViewportMtfOverlay from '../overlays/ViewportMtfOverlay.vue'
import ViewportMeasurementOverlay from '../overlays/ViewportMeasurementOverlay.vue'
import ViewportOrientationOverlay from '../overlays/ViewportOrientationOverlay.vue'
import ViewportQaWaterOverlay from '../overlays/ViewportQaWaterOverlay.vue'
import ViewportScaleBarOverlay from '../overlays/ViewportScaleBarOverlay.vue'

const props = withDefaults(
  defineProps<{
    alt: string
    annotations?: AnnotationOverlay[]
    cornerInfo: CornerInfo
    cursorClass?: string
    draftAnnotation?: AnnotationDraft | null
    draftMeasurementMode?: DraftMeasurementMode | null
    draftMeasurement?: MeasurementDraft | null
    mtfDraftMode?: DraftMeasurementMode | null
    mtfDraft?: { mtfId?: string; points: { x: number; y: number }[] } | null
    mtfItems?: ViewerMtfItem[]
    qaWaterAnalysis?: QaWaterAnalysis | null
    selectedMtfId?: string | null
    measurements?: MeasurementOverlay[]
    imageClass?: string
    imageSrc: string
    isActive?: boolean
    isLoading?: boolean
    loadingLabel?: string
    mprCrosshair?: MprCrosshairInfo | null
    mprFrame?: MprFrameInfo | null
    orientation: OrientationInfo
    placeholder: string
    renderSurfaceActive?: boolean
    scaleBar?: ScaleBarInfo | null
    softImage?: boolean
    viewportClass?: string
    viewportKey: string
  }>(),
  {
    annotations: () => [],
    draftAnnotation: null,
    draftMeasurement: null,
    measurements: () => [],
    cursorClass: '',
    draftMeasurementMode: null,
    imageClass: '',
    isActive: false,
    isLoading: false,
    loadingLabel: '正在加载视图...',
    mprCrosshair: null,
    mprFrame: null,
    qaWaterAnalysis: null,
    renderSurfaceActive: false,
    scaleBar: null,
    softImage: false,
    viewportClass: ''
  }
)

const emit = defineEmits<{
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string]
  clearMtf: []
  clickViewport: [viewportKey: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  imageLoaded: [viewportKey: string]
  openMtfCurve: []
  selectMtf: [payload: { mtfId: string | null }]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  wheelViewport: [payload: { viewportKey: string; deltaY: number }]
}>()

const stageRef = ref<HTMLDivElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const stageSize = ref({
  width: 0,
  height: 0
})
const imageFrame = ref({
  left: 0,
  top: 0,
  width: 0,
  height: 0
})

function toStablePixel(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0
}

let resizeObserver: ResizeObserver | null = null

function emitHoverViewportPoint(event: PointerEvent | MouseEvent | null): void {
  const image = imageRef.value
  if (!image || !event || !props.imageSrc) {
    emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
    return
  }

  const rect = getRenderedImageRect(image)
  if (!rect.width || !rect.height) {
    emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
    return
  }

  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
    emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
    return
  }

  const normalizedX = (event.clientX - rect.left) / rect.width
  const normalizedY = (event.clientY - rect.top) / rect.height
  emit('hoverViewportChange', {
    viewportKey: props.viewportKey,
    x: Math.max(0, Math.min(1, normalizedX)),
    y: Math.max(0, Math.min(1, normalizedY))
  })
}

function handlePointerDown(event: PointerEvent): void {
  emit('pointerDown', event, props.viewportKey)
}

function handlePointerMove(event: PointerEvent): void {
  if (event.buttons === 0) {
    emitHoverViewportPoint(event)
  }
  emit('pointerMove', event)
}

function handlePointerLeave(): void {
  emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
  emit('pointerLeave', props.viewportKey)
}

function getRenderedImageRect(image: HTMLImageElement): DOMRect {
  const rect = image.getBoundingClientRect()
  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) {
    return rect
  }

  const elementAspectRatio = rect.width / rect.height
  const imageAspectRatio = naturalWidth / naturalHeight

  if (elementAspectRatio > imageAspectRatio) {
    const renderedWidth = rect.height * imageAspectRatio
    const offsetX = (rect.width - renderedWidth) / 2
    return new DOMRect(rect.left + offsetX, rect.top, renderedWidth, rect.height)
  }

  const renderedHeight = rect.width / imageAspectRatio
  const offsetY = (rect.height - renderedHeight) / 2
  return new DOMRect(rect.left, rect.top + offsetY, rect.width, renderedHeight)
}

function updateStageMetrics(): void {
  const stage = stageRef.value
  const image = imageRef.value

  if (!stage) {
    return
  }

  const stageRect = stage.getBoundingClientRect()
  stageSize.value = {
    width: stageRect.width,
    height: stageRect.height
  }

  if (!image || !props.imageSrc) {
    imageFrame.value = {
      left: 0,
      top: 0,
      width: 0,
      height: 0
    }
    return
  }

  const imageRect = getRenderedImageRect(image)
  imageFrame.value = {
    left: toStablePixel(imageRect.left - stageRect.left),
    top: toStablePixel(imageRect.top - stageRect.top),
    width: toStablePixel(imageRect.width),
    height: toStablePixel(imageRect.height)
  }
}

function observeLayout(): void {
  resizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver = new ResizeObserver(() => {
    updateStageMetrics()
  })

  if (stageRef.value) {
    resizeObserver.observe(stageRef.value)
  }
  if (imageRef.value) {
    resizeObserver.observe(imageRef.value)
  }
}

onMounted(() => {
  observeLayout()
  updateStageMetrics()
  window.addEventListener('resize', updateStageMetrics)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', updateStageMetrics)
})

watch(
  () => [props.imageSrc, props.isActive, props.viewportKey] as const,
  async () => {
    await nextTick()
    observeLayout()
    updateStageMetrics()
  }
)
</script>

<template>
  <div
    class="viewer-viewport relative h-full w-full overflow-hidden rounded-2xl border border-slate-600/20 bg-[linear-gradient(180deg,rgba(4,8,14,0.98),rgba(2,5,10,1)),radial-gradient(circle_at_top_right,rgba(35,130,210,0.08),transparent_28%)] text-slate-200"
    :class="[
      viewportClass,
      cursorClass,
      isActive
        ? 'border-[var(--theme-accent)] shadow-[inset_0_0_0_2px_var(--theme-accent),inset_0_0_28px_color-mix(in_srgb,var(--theme-accent)_18%,transparent),0_0_0_2px_color-mix(in_srgb,var(--theme-accent)_44%,transparent),0_0_28px_color-mix(in_srgb,var(--theme-accent)_32%,transparent)]'
        : ''
    ]"
    :data-active-viewport="isActive ? 'true' : 'false'"
    :data-viewport-key="viewportKey"
    @click="emit('clickViewport', viewportKey)"
    @wheel.prevent="emit('wheelViewport', { viewportKey, deltaY: $event.deltaY })"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="emit('pointerUp', $event)"
    @pointercancel="emit('pointerCancel', $event)"
    @pointerleave="handlePointerLeave"
  >
    <div
      ref="stageRef"
      class="relative grid h-full w-full place-items-center overflow-hidden bg-black"
      :data-active-render-surface="renderSurfaceActive ? 'true' : 'false'"
      :data-viewport-key="viewportKey"
    >
      <img
        v-if="imageSrc"
        ref="imageRef"
        class="viewer-image block h-full w-full select-none object-contain object-center pointer-events-none"
        :class="[imageClass, { 'opacity-[0.88] saturate-[0.9]': softImage }]"
        :src="imageSrc"
        :alt="alt"
        draggable="false"
        @dragstart.prevent
        @load="() => { updateStageMetrics(); emit('imageLoaded', viewportKey) }"
      />
      <ViewportCrosshairOverlay
        :corner-info="cornerInfo"
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :image-frame="imageFrame"
        :mpr-crosshair="mprCrosshair"
        :mpr-frame="mprFrame"
        :viewport-key="viewportKey"
        :is-active="isActive"
      />
      <ViewportScaleBarOverlay
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :image-frame="imageFrame"
        :scale-bar="scaleBar"
      />
      <ViewportMeasurementOverlay
        :draft-measurement-mode="draftMeasurementMode"
        :draft-measurement="draftMeasurement"
        :measurements="measurements"
        :image-frame="imageFrame"
        @copy-selected-measurement="emit('copySelectedMeasurement', props.viewportKey)"
        @delete-selected-measurement="emit('deleteSelectedMeasurement', props.viewportKey)"
      />
      <ViewportAnnotationOverlay
        :annotations="annotations"
        :selected-annotation-id="draftAnnotation?.annotationId ?? null"
        :draft-annotation="draftAnnotation && !draftAnnotation.annotationId ? draftAnnotation : null"
        :image-frame="imageFrame"
        @copy-annotation="emit('copyAnnotation', { viewportKey: props.viewportKey, annotationId: $event })"
        @delete-annotation="emit('deleteAnnotation', { viewportKey: props.viewportKey, annotationId: $event })"
        @update-annotation-color="emit('updateAnnotationColor', { viewportKey: props.viewportKey, ...$event })"
        @update-annotation-size="emit('updateAnnotationSize', { viewportKey: props.viewportKey, ...$event })"
        @update-annotation-text="emit('updateAnnotationText', { viewportKey: props.viewportKey, ...$event })"
      />
      <ViewportMtfOverlay
        :image-frame="imageFrame"
        :mtf-draft-mode="mtfDraftMode ?? null"
        :mtf-draft="mtfDraft ?? null"
        :mtf-items="mtfItems ?? []"
        :selected-mtf-id="selectedMtfId ?? null"
        @clear="emit('clearMtf')"
        @copy="emit('copySelectedMtf', props.viewportKey)"
        @open-curve="emit('openMtfCurve')"
      />
      <ViewportQaWaterOverlay
        :analysis="qaWaterAnalysis ?? null"
        :image-frame="imageFrame"
      />
      <ViewportCornerOverlay :corner-info="cornerInfo" :viewport-key="viewportKey" />
      <ViewportOrientationOverlay :orientation="orientation" />
      <VolumeOrientationCube v-if="viewportKey === 'volume' && orientation.volumeQuaternion" :orientation="orientation" />
      <div
        v-if="isLoading"
        class="absolute inset-0 z-[5] grid place-items-center bg-[linear-gradient(180deg,rgba(2,5,10,0.92),rgba(2,5,10,0.98))] backdrop-blur-[2px]"
      >
        <div class="flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-200 shadow-[0_14px_28px_rgba(0,0,0,0.28)]">
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.14)]"></span>
          <span>{{ loadingLabel }}</span>
        </div>
      </div>
      <span
        v-if="!imageSrc && !isLoading"
        class="absolute left-3 top-3 rounded-full bg-slate-900/80 px-3 py-1 text-xs tracking-[0.14em] text-slate-400"
      >
        {{ placeholder }}
      </span>
      <span
        v-if="isActive"
        class="pointer-events-none absolute right-3 top-3 z-[6] rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent)_55%,white_10%)] bg-[color:color-mix(in_srgb,var(--theme-accent)_22%,rgba(4,8,14,0.88))] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-overlay-text)] shadow-[0_10px_24px_rgba(0,0,0,0.32)]"
      >
        Active
      </span>
    </div>
  </div>
</template>
