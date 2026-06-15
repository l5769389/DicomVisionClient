<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  CornerInfo,
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementOverlay,
  MprCrosshairInfo,
  MprFrameInfo,
  MprPlaneInfo,
  MprSegmentationConfigActionType,
  MprSegmentationConfig,
  MprSegmentationOverlay,
  OrientationInfo,
  ScaleBarInfo,
  QaWaterAnalysis,
  ViewerImageLayer,
  ViewTransformInfo,
  ViewerMtfItem
} from '../../../types/viewer'
import {
  DEFAULT_MPR_SEGMENTATION_COLOR,
  DEFAULT_MPR_VOI_COLOR
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
import ViewportVoiOverlay from '../overlays/ViewportVoiOverlay.vue'
import type { OverlayImageFrame } from '../overlays/overlayGeometry'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const props = withDefaults(
  defineProps<{
    alt: string
    activeOperation?: string
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
    imageLayers?: ViewerImageLayer[]
    imageSrc: string
    isActive?: boolean
    isLoading?: boolean
    loadingLabel?: string
    loadingProgressPercent?: number | null
    mprCrosshair?: MprCrosshairInfo | null
    mprFrame?: MprFrameInfo | null
    mprPlane?: MprPlaneInfo | null
    mprSegmentationDefaultThresholdColor?: string
    mprSegmentationDefaultVoiColor?: string
    mprSegmentationConfig?: MprSegmentationConfig | null
    mprSegmentationOverlay?: MprSegmentationOverlay | null
    orientation: OrientationInfo
    placeholder: string
    renderSurfaceActive?: boolean
    scaleBar?: ScaleBarInfo | null
    showCornerInfo?: boolean
    showScaleBar?: boolean
    softImage?: boolean
    viewportTransform?: ViewTransformInfo | null
    voiEditable?: boolean
    voiOblique?: boolean
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
    imageLayers: () => [],
    imageClass: '',
    isActive: false,
    isLoading: false,
    loadingLabel: '',
    loadingProgressPercent: null,
    mprCrosshair: null,
    mprFrame: null,
    mprPlane: null,
    mprSegmentationDefaultThresholdColor: DEFAULT_MPR_SEGMENTATION_COLOR,
    mprSegmentationDefaultVoiColor: DEFAULT_MPR_VOI_COLOR,
    mprSegmentationConfig: null,
    mprSegmentationOverlay: null,
    qaWaterAnalysis: null,
    renderSurfaceActive: false,
    scaleBar: null,
    showCornerInfo: true,
    showScaleBar: true,
    softImage: false,
    viewportTransform: null,
    voiEditable: false,
    voiOblique: false,
    viewportClass: ''
  }
)

type OverlayFocusState = 'focus' | 'context' | 'neutral'

const emit = defineEmits<{
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  clearMtf: []
  clickViewport: [viewportKey: string]
  doubleClickViewport: [viewportKey: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  imageLoaded: [viewportKey: string]
  openMtfCurve: []
  selectMtf: [payload: { mtfId: string | null }]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  mprSegmentationConfigChange: [config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType]
  mprSegmentationModeChange: [mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  wheelViewport: [payload: { viewportKey: string; deltaY: number }]
}>()

const stageRef = ref<HTMLDivElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const { viewerCopy } = useUiLocale()
const stageSize = ref({
  width: 0,
  height: 0
})
const imageFrame = ref<OverlayImageFrame>({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  naturalWidth: 0,
  naturalHeight: 0
})

const normalizedLoadingProgressPercent = computed(() => {
  if (typeof props.loadingProgressPercent !== 'number' || !Number.isFinite(props.loadingProgressPercent)) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round(props.loadingProgressPercent)))
})

const resolvedLoadingLabel = computed(() => props.loadingLabel || viewerCopy.value.loadingView)

const measurementFrame = computed(() => ({
  left: 0,
  top: 0,
  width: toStablePixel(stageSize.value.width),
  height: toStablePixel(stageSize.value.height)
}))

function toStablePixel(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0
}

let resizeObserver: ResizeObserver | null = null
let observedStage: HTMLElement | null = null
let observedImage: HTMLImageElement | null = null
let stageMetricsRaf: number | null = null

const normalizedActiveOperation = computed(() =>
  props.activeOperation?.startsWith('stack:') ? props.activeOperation.slice('stack:'.length) : (props.activeOperation ?? '')
)

const activeOverlayKind = computed<'measurement' | 'annotation' | 'mtf' | null>(() => {
  const operation = normalizedActiveOperation.value
  if (operation.startsWith('measure:')) {
    return 'measurement'
  }
  if (operation.startsWith('annotate:')) {
    return 'annotation'
  }
  if (operation === 'qa:mtf' || operation.startsWith('qa:mtf') || operation === 'mtf' || operation.startsWith('mtf:')) {
    return 'mtf'
  }
  return null
})

function getOverlayFocusState(kind: 'measurement' | 'annotation' | 'mtf'): OverlayFocusState {
  if (activeOverlayKind.value == null) {
    return 'neutral'
  }
  return activeOverlayKind.value === kind ? 'focus' : 'context'
}

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
  emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
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

function handleMprSegmentationConfigChange(config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType): void {
  emit('mprSegmentationConfigChange', config, actionType)
}

function handleMprSegmentationModeChange(mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null): void {
  emit('mprSegmentationModeChange', mode, viewportKey)
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

  // The <img> uses object-contain, so the DOM box can include letterboxing.
  // Hover and image-space overlays need the actual rendered image rectangle.
  if (elementAspectRatio > imageAspectRatio) {
    const renderedWidth = rect.height * imageAspectRatio
    const offsetX = (rect.width - renderedWidth) / 2
    return new DOMRect(rect.left + offsetX, rect.top, renderedWidth, rect.height)
  }

  const renderedHeight = rect.width / imageAspectRatio
  const offsetY = (rect.height - renderedHeight) / 2
  return new DOMRect(rect.left, rect.top + offsetY, rect.width, renderedHeight)
}

function updateStageMetricsNow(): void {
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
      height: 0,
      naturalWidth: 0,
      naturalHeight: 0
    }
    return
  }

  const imageRect = getRenderedImageRect(image)
  imageFrame.value = {
    left: toStablePixel(imageRect.left - stageRect.left),
    top: toStablePixel(imageRect.top - stageRect.top),
    width: toStablePixel(imageRect.width),
    height: toStablePixel(imageRect.height),
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight
  }
}

function scheduleStageMetricsUpdate(): void {
  if (stageMetricsRaf != null) {
    return
  }

  stageMetricsRaf = window.requestAnimationFrame(() => {
    stageMetricsRaf = null
    updateStageMetricsNow()
  })
}

function observeLayout(): void {
  if (typeof ResizeObserver === 'undefined') {
    return
  }

  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      scheduleStageMetricsUpdate()
    })
  }

  const nextStage = stageRef.value
  const nextImage = imageRef.value
  if (observedStage === nextStage && observedImage === nextImage) {
    return
  }

  if (observedStage) {
    resizeObserver.unobserve(observedStage)
  }
  if (observedImage) {
    resizeObserver.unobserve(observedImage)
  }

  observedStage = nextStage
  observedImage = nextImage

  if (observedStage) {
    resizeObserver.observe(observedStage)
  }
  if (observedImage) {
    resizeObserver.observe(observedImage)
  }
}

onMounted(() => {
  observeLayout()
  scheduleStageMetricsUpdate()
  window.addEventListener('resize', scheduleStageMetricsUpdate)
})

onBeforeUnmount(() => {
  if (stageMetricsRaf != null) {
    window.cancelAnimationFrame(stageMetricsRaf)
    stageMetricsRaf = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  observedStage = null
  observedImage = null
  window.removeEventListener('resize', scheduleStageMetricsUpdate)
})

watch(
  () => [props.imageSrc, props.isActive, props.viewportKey] as const,
  async () => {
    await nextTick()
    observeLayout()
    scheduleStageMetricsUpdate()
  }
)
</script>

<template>
  <div
    class="viewer-viewport relative h-full w-full overflow-hidden rounded-2xl border border-slate-600/20 bg-[linear-gradient(180deg,rgba(4,8,14,0.98),rgba(2,5,10,1)),radial-gradient(circle_at_top_right,rgba(35,130,210,0.08),transparent_28%)] text-slate-200"
    :class="[
      viewportClass,
      cursorClass,
      isActive ? 'viewer-viewport--active' : ''
    ]"
    :data-active-viewport="isActive ? 'true' : 'false'"
    :data-viewport-key="viewportKey"
    @click="emit('clickViewport', viewportKey)"
    @contextmenu.prevent
    @dblclick.stop="emit('doubleClickViewport', viewportKey)"
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
        @load="() => { scheduleStageMetricsUpdate(); emit('imageLoaded', viewportKey) }"
      />
      <img
        v-for="layer in imageLayers"
        :key="layer.key"
        class="viewer-image viewer-image-layer pointer-events-none absolute inset-0 block h-full w-full select-none object-contain object-center"
        :class="layer.class"
        :src="layer.src"
        :alt="layer.alt ?? ''"
        :style="layer.style"
        draggable="false"
        aria-hidden="true"
        @dragstart.prevent
      />
      <ViewportCrosshairOverlay
        :corner-info="cornerInfo"
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :image-frame="imageFrame"
        :mpr-crosshair="mprCrosshair"
        :mpr-frame="mprFrame"
        :mpr-plane="mprPlane"
        :viewport-key="viewportKey"
        :is-active="isActive"
      />
      <ViewportVoiOverlay
        :active-operation="props.activeOperation"
        :config="mprSegmentationConfig"
        :editable="voiEditable"
        :image-frame="imageFrame"
        :is-active="isActive"
        :is-oblique="voiOblique"
        :mpr-plane="mprPlane"
        :default-threshold-color="mprSegmentationDefaultThresholdColor"
        :default-voi-color="mprSegmentationDefaultVoiColor"
        :segmentation-overlay="mprSegmentationOverlay"
        :viewport-transform="viewportTransform"
        :viewport-key="viewportKey"
        @config-change="handleMprSegmentationConfigChange"
        @mode-change="handleMprSegmentationModeChange"
      />
      <ViewportScaleBarOverlay
        v-if="showScaleBar"
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :scale-bar="scaleBar"
      />
      <ViewportMeasurementOverlay
        :focus-state="getOverlayFocusState('measurement')"
        :draft-measurement-mode="draftMeasurementMode"
        :draft-measurement="draftMeasurement"
        :measurements="measurements"
        :image-frame="measurementFrame"
        @copy-selected-measurement="emit('copySelectedMeasurement', props.viewportKey)"
        @delete-selected-measurement="emit('deleteSelectedMeasurement', props.viewportKey, $event)"
      />
      <ViewportAnnotationOverlay
        :focus-state="getOverlayFocusState('annotation')"
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
        :focus-state="getOverlayFocusState('mtf')"
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
      <ViewportCornerOverlay v-if="showCornerInfo" :corner-info="cornerInfo" :viewport-key="viewportKey" />
      <ViewportOrientationOverlay :orientation="orientation" />
      <VolumeOrientationCube v-if="viewportKey === 'volume' && orientation.volumeQuaternion" :orientation="orientation" />
      <div
        v-if="isLoading"
        class="absolute inset-0 z-[5] grid place-items-center bg-[linear-gradient(180deg,rgba(2,5,10,0.92),rgba(2,5,10,0.98))] backdrop-blur-[2px]"
      >
        <div class="w-[min(18rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-slate-200 shadow-[0_14px_28px_rgba(0,0,0,0.28)]">
          <div class="flex items-center gap-3">
            <span class="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.14)]"></span>
            <span class="min-w-0 flex-1 truncate">{{ resolvedLoadingLabel }}</span>
            <span v-if="normalizedLoadingProgressPercent !== null" class="w-10 shrink-0 text-right text-xs font-semibold text-sky-200">
              {{ normalizedLoadingProgressPercent }}%
            </span>
          </div>
          <div v-if="normalizedLoadingProgressPercent !== null" class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-sky-300 transition-[width] duration-200 ease-out"
              :style="{ width: `${normalizedLoadingProgressPercent}%` }"
            ></div>
          </div>
        </div>
      </div>
      <span
        v-if="!imageSrc && !isLoading"
        class="absolute left-3 top-3 rounded-full bg-slate-900/80 px-3 py-1 text-xs tracking-[0.14em] text-slate-400"
      >
        {{ placeholder }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.viewer-viewport,
.viewer-viewport * {
  touch-action: none;
}

.viewer-viewport {
  overscroll-behavior: contain;
}

.viewer-image {
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
}
</style>
