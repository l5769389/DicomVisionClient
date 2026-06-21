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
    imageStyle?: Record<string, string>
    imageLayers?: ViewerImageLayer[]
    imageSrc: string
    compactLoading?: boolean
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
    stageSurfaceClass?: string
    lightSurface?: boolean
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
    imageStyle: () => ({}),
    compactLoading: false,
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
    stageSurfaceClass: '',
    lightSurface: false,
    viewportTransform: null,
    voiEditable: false,
    voiOblique: false,
    viewportClass: ''
  }
)

type OverlayFocusState = 'focus' | 'context' | 'neutral'
const LIGHT_SURFACE_SCALE_BAR_COLOR = '#132033'

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
function createEmptyImageFrame(): OverlayImageFrame {
  return {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0
  }
}

const imageFrame = ref<OverlayImageFrame>(createEmptyImageFrame())
let lastValidImageFrame: OverlayImageFrame | null = null

function isValidImageFrame(frame: OverlayImageFrame | null): frame is OverlayImageFrame {
  return Boolean(
    frame &&
    frame.width > 0 &&
    frame.height > 0 &&
    (frame.naturalWidth ?? 0) > 0 &&
    (frame.naturalHeight ?? 0) > 0
  )
}

function getContainedImageRect(containerRect: DOMRect, naturalWidth: number, naturalHeight: number): DOMRect {
  if (!naturalWidth || !naturalHeight || !containerRect.width || !containerRect.height) {
    return containerRect
  }

  const elementAspectRatio = containerRect.width / containerRect.height
  const imageAspectRatio = naturalWidth / naturalHeight
  if (elementAspectRatio > imageAspectRatio) {
    const renderedWidth = containerRect.height * imageAspectRatio
    const offsetX = (containerRect.width - renderedWidth) / 2
    return new DOMRect(containerRect.left + offsetX, containerRect.top, renderedWidth, containerRect.height)
  }

  const renderedHeight = containerRect.width / imageAspectRatio
  const offsetY = (containerRect.height - renderedHeight) / 2
  return new DOMRect(containerRect.left, containerRect.top + offsetY, containerRect.width, renderedHeight)
}

function buildImageFrame(stageRect: DOMRect, imageRect: DOMRect, naturalWidth: number, naturalHeight: number): OverlayImageFrame {
  return {
    left: toStablePixel(imageRect.left - stageRect.left),
    top: toStablePixel(imageRect.top - stageRect.top),
    width: toStablePixel(imageRect.width),
    height: toStablePixel(imageRect.height),
    naturalWidth,
    naturalHeight
  }
}

function getFallbackImageFrame(stageRect: DOMRect): OverlayImageFrame | null {
  if (!isValidImageFrame(lastValidImageFrame) || !stageRect.width || !stageRect.height) {
    return lastValidImageFrame
  }
  const imageRect = getContainedImageRect(stageRect, lastValidImageFrame.naturalWidth ?? 0, lastValidImageFrame.naturalHeight ?? 0)
  return buildImageFrame(stageRect, imageRect, lastValidImageFrame.naturalWidth ?? 0, lastValidImageFrame.naturalHeight ?? 0)
}

const normalizedLoadingProgressPercent = computed(() => {
  if (typeof props.loadingProgressPercent !== 'number' || !Number.isFinite(props.loadingProgressPercent)) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round(props.loadingProgressPercent)))
})

const resolvedLoadingLabel = computed(() => props.loadingLabel || viewerCopy.value.loadingView)

const hasImageContent = computed(() =>
  Boolean(props.imageSrc) || props.imageLayers.some((layer) => Boolean(layer.src))
)

const shouldShowImageOverlays = computed(() => hasImageContent.value)
const shouldShowCornerInfo = computed(() => props.showCornerInfo && hasImageContent.value)
const shouldShowScaleBar = computed(() => props.showScaleBar && hasImageContent.value)
const isLightSurface = computed(() =>
  props.lightSurface || props.stageSurfaceClass.split(/\s+/).includes('viewer-stage-surface--white')
)
const scaleBarColorOverride = computed(() => (isLightSurface.value ? LIGHT_SURFACE_SCALE_BAR_COLOR : null))
const lightSurfaceStyle = computed(() =>
  isLightSurface.value
    ? {
        background: '#fff',
        backgroundImage: 'none'
      }
    : undefined
)

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

  // The <img> uses object-contain, so the DOM box can include letterboxing.
  // Hover and image-space overlays need the actual rendered image rectangle.
  return getContainedImageRect(rect, naturalWidth, naturalHeight)
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
    lastValidImageFrame = null
    imageFrame.value = createEmptyImageFrame()
    return
  }

  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
    const imageRect = getRenderedImageRect(image)
    const nextFrame = buildImageFrame(stageRect, imageRect, image.naturalWidth, image.naturalHeight)
    imageFrame.value = nextFrame
    if (isValidImageFrame(nextFrame)) {
      lastValidImageFrame = nextFrame
    }
    return
  }

  imageFrame.value = getFallbackImageFrame(stageRect) ?? createEmptyImageFrame()
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
      stageSurfaceClass,
      isLightSurface ? 'viewer-viewport--light-surface' : '',
      isLightSurface ? 'viewer-viewport--light-overlay' : '',
      cursorClass,
      isActive ? 'viewer-viewport--active' : ''
    ]"
    :style="lightSurfaceStyle"
    :data-light-surface="isLightSurface ? 'true' : 'false'"
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
      :class="[stageSurfaceClass, isLightSurface ? 'viewer-stage-surface--light' : '']"
      :style="lightSurfaceStyle"
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
        :style="imageStyle"
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
        v-if="shouldShowImageOverlays"
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
        v-if="shouldShowImageOverlays"
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
        v-if="shouldShowScaleBar"
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :scale-bar="scaleBar"
        :color-override="scaleBarColorOverride"
      />
      <ViewportMeasurementOverlay
        v-if="shouldShowImageOverlays"
        :focus-state="getOverlayFocusState('measurement')"
        :draft-measurement-mode="draftMeasurementMode"
        :draft-measurement="draftMeasurement"
        :measurements="measurements"
        :image-frame="measurementFrame"
        @copy-selected-measurement="emit('copySelectedMeasurement', props.viewportKey)"
        @delete-selected-measurement="emit('deleteSelectedMeasurement', props.viewportKey, $event)"
      />
      <ViewportAnnotationOverlay
        v-if="shouldShowImageOverlays"
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
        v-if="shouldShowImageOverlays"
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
        v-if="shouldShowImageOverlays"
        :analysis="qaWaterAnalysis ?? null"
        :image-frame="imageFrame"
      />
      <ViewportCornerOverlay v-if="shouldShowCornerInfo" :corner-info="cornerInfo" :viewport-key="viewportKey" />
      <ViewportOrientationOverlay v-if="shouldShowImageOverlays" :orientation="orientation" />
      <VolumeOrientationCube v-if="shouldShowImageOverlays && viewportKey === 'volume' && orientation.volumeQuaternion" :orientation="orientation" />
      <div
        v-if="isLoading"
        class="absolute inset-0 z-[5] grid place-items-center bg-[linear-gradient(180deg,rgba(2,5,10,0.92),rgba(2,5,10,0.98))] backdrop-blur-[2px]"
      >
        <div
          v-if="compactLoading"
          class="viewer-loading-spinner"
          role="status"
          :aria-label="resolvedLoadingLabel"
        ></div>
        <div v-else class="w-[min(18rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-slate-200 shadow-[0_14px_28px_rgba(0,0,0,0.28)]">
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
.viewer-viewport--light-surface,
.viewer-stage-surface--light,
.viewer-stage-surface--white {
  background: #fff !important;
  background-image: none !important;
}
</style>

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

.viewer-loading-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid rgba(226, 244, 255, 0.22);
  border-top-color: color-mix(in srgb, var(--theme-accent, #7dd3fc) 82%, #ffffff);
  border-radius: 999px;
  box-shadow: 0 0 0 8px rgba(2, 8, 16, 0.24);
  animation: viewer-loading-spin 780ms linear infinite;
}

@keyframes viewer-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
