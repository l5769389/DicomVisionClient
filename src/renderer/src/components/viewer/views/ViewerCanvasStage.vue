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
  ViewerMtfItem,
  WindowLevelInfo
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
import ViewportPseudocolorBarOverlay from '../overlays/ViewportPseudocolorBarOverlay.vue'
import ViewportQaWaterOverlay from '../overlays/ViewportQaWaterOverlay.vue'
import ViewportScaleBarOverlay from '../overlays/ViewportScaleBarOverlay.vue'
import ViewportVoiOverlay from '../overlays/ViewportVoiOverlay.vue'
import type { OverlayImageFrame } from '../overlays/overlayGeometry'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import {
  acknowledgeThreeDVideoFrame,
  acquireThreeDWebRtcTransport,
  getPendingThreeDVideoFrameGeneration,
  getThreeDWebRtcState,
  getThreeDWebRtcStream,
  hasPresentedThreeDVideoFrame,
  releaseThreeDWebRtcTransport,
  shouldShowThreeDStillFrame,
  threeDTransportMode
} from '../../../services/threeDWebRtcTransport'
import { bindView } from '../../../services/socket'
import type { VolumeOrientationFace } from '../../../composables/workspace/volume/volumeOrientation'

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
    mediaViewId?: string | null
    hideDraftHandles?: boolean
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
    pseudocolorPreset?: string | null
    pseudocolorWindowInfo?: WindowLevelInfo | null
    renderSurfaceActive?: boolean
    scaleBar?: ScaleBarInfo | null
    showCornerInfo?: boolean
    showCrosshair?: boolean
    showPseudocolorBar?: boolean
    showScaleBar?: boolean
    showVolumeOrientationCube?: boolean
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
    mediaViewId: null,
    hideDraftHandles: false,
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
    pseudocolorPreset: null,
    pseudocolorWindowInfo: null,
    renderSurfaceActive: false,
    scaleBar: null,
    showCornerInfo: true,
    showCrosshair: true,
    showPseudocolorBar: true,
    showScaleBar: true,
    showVolumeOrientationCube: true,
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
const LIGHT_SURFACE_CLASS_PATTERN = /(?:^|\s)viewer-stage-surface--white(?:\s|$)/

const emit = defineEmits<{
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  clearMtf: []
  clickViewport: [viewportKey: string]
  doubleClickViewport: [viewportKey: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null; row?: number | null; col?: number | null }]
  imageLoaded: [viewportKey: string]
  openMtfCurve: []
  selectMtf: [payload: { mtfId: string | null }]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  volumeOrientationSelect: [face: VolumeOrientationFace]
  mprSegmentationConfigChange: [config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType]
  mprSegmentationModeChange: [mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  wheelViewport: [payload: {
    viewportKey: string
    deltaX: number
    deltaY: number
    deltaMode: number
    ctrlKey: boolean
    canvasX: number
    canvasY: number
    canvasWidth: number
    canvasHeight: number
  }]
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

const videoRef = ref<HTMLVideoElement | null>(null)
const webRtcStream = computed(() =>
  threeDTransportMode.value === 'webrtc' ? getThreeDWebRtcStream(props.mediaViewId) : null
)
const webRtcState = computed(() => getThreeDWebRtcState(props.mediaViewId))
const pendingVideoFrameGeneration = computed(() =>
  getPendingThreeDVideoFrameGeneration(props.mediaViewId)
)
const hasPresentedWebRtcFrame = computed(() =>
  hasPresentedThreeDVideoFrame(props.mediaViewId)
)
const showWebRtcStillFrame = computed(() =>
  Boolean(webRtcStream.value && props.imageSrc && shouldShowThreeDStillFrame(props.mediaViewId))
)
const showWebRtcVideoPixels = computed(() =>
  Boolean(webRtcStream.value && hasPresentedWebRtcFrame.value && !showWebRtcStillFrame.value)
)

const hasImageContent = computed(() =>
  Boolean(props.imageSrc || (webRtcStream.value && hasPresentedWebRtcFrame.value)) ||
  props.imageLayers.some((layer) => Boolean(layer.src))
)
const isConnectingVolumeStream = computed(() =>
  Boolean(
    props.mediaViewId &&
    threeDTransportMode.value === 'webrtc' &&
    (webRtcState.value === 'connecting' || webRtcState.value === 'connected') &&
    !hasImageContent.value
  )
)
const shouldShowLoading = computed(() => props.isLoading || isConnectingVolumeStream.value)
const resolvedLoadingLabel = computed(() => {
  if (props.loadingLabel) {
    return props.loadingLabel
  }
  return isConnectingVolumeStream.value
    ? viewerCopy.value.connectingVolumeStream
    : viewerCopy.value.loadingView
})

const shouldShowImageOverlays = computed(() => hasImageContent.value)
const shouldShowCornerInfo = computed(() => props.showCornerInfo && hasImageContent.value)
const shouldShowCrosshair = computed(() => props.showCrosshair && hasImageContent.value)
const shouldShowScaleBar = computed(() => props.showScaleBar && hasImageContent.value)
const shouldShowPseudocolorBar = computed(() =>
  props.showPseudocolorBar && hasImageContent.value && props.viewportKey !== 'volume' && Boolean(props.pseudocolorPreset)
)
const isLightSurface = computed(() =>
  props.lightSurface || LIGHT_SURFACE_CLASS_PATTERN.test(props.stageSurfaceClass)
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
let observedImage: Element | null = null
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

function getHoverImageRect(): DOMRect | null {
  const video = videoRef.value
  if (video && webRtcStream.value) {
    return getContainedImageRect(video.getBoundingClientRect(), video.videoWidth, video.videoHeight)
  }
  const image = imageRef.value
  if (image && props.imageSrc) {
    return getRenderedImageRect(image)
  }

  const stage = stageRef.value
  if (!stage) {
    return null
  }

  const stageRect = stage.getBoundingClientRect()
  if (isValidImageFrame(imageFrame.value)) {
    return new DOMRect(
      stageRect.left + imageFrame.value.left,
      stageRect.top + imageFrame.value.top,
      imageFrame.value.width,
      imageFrame.value.height
    )
  }

  return hasImageContent.value ? stageRect : null
}

function emitHoverViewportPoint(event: PointerEvent | MouseEvent | null): void {
  if (event && 'buttons' in event && event.buttons !== 0) {
    return
  }

  if (!event || !hasImageContent.value) {
    emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
    return
  }

  const imageRect = getHoverImageRect()
  const stage = stageRef.value
  if (!imageRect || !imageRect.width || !imageRect.height || !stage) {
    emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
    return
  }

  if (event.clientX < imageRect.left || event.clientX > imageRect.right || event.clientY < imageRect.top || event.clientY > imageRect.bottom) {
    emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
    return
  }

  const stageRect = stage.getBoundingClientRect()
  if (!stageRect.width || !stageRect.height) {
    emit('hoverViewportChange', { viewportKey: props.viewportKey, x: null, y: null })
    return
  }

  const canvasNormalizedX = Math.max(0, Math.min(1, (event.clientX - stageRect.left) / stageRect.width))
  const canvasNormalizedY = Math.max(0, Math.min(1, (event.clientY - stageRect.top) / stageRect.height))
  emit('hoverViewportChange', {
    viewportKey: props.viewportKey,
    x: canvasNormalizedX,
    y: canvasNormalizedY
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

function handleWheel(event: WheelEvent): void {
  const target = event.currentTarget
  const rect = target instanceof HTMLElement ? target.getBoundingClientRect() : null
  emit('wheelViewport', {
    viewportKey: props.viewportKey,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaMode: event.deltaMode,
    ctrlKey: event.ctrlKey,
    canvasX: rect ? event.clientX - rect.left : 0,
    canvasY: rect ? event.clientY - rect.top : 0,
    canvasWidth: rect?.width ?? 0,
    canvasHeight: rect?.height ?? 0
  })
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
  const video = videoRef.value

  if (!stage) {
    return
  }

  const stageRect = stage.getBoundingClientRect()
  stageSize.value = {
    width: stageRect.width,
    height: stageRect.height
  }

  if (video && webRtcStream.value && video.videoWidth > 0 && video.videoHeight > 0) {
    const videoRect = getContainedImageRect(video.getBoundingClientRect(), video.videoWidth, video.videoHeight)
    const nextFrame = buildImageFrame(stageRect, videoRect, video.videoWidth, video.videoHeight)
    imageFrame.value = nextFrame
    if (isValidImageFrame(nextFrame)) {
      lastValidImageFrame = nextFrame
    }
    return
  }

  if (!image || !props.imageSrc) {
    const fallbackFrame = getFallbackImageFrame(stageRect)
    if (hasImageContent.value && isValidImageFrame(fallbackFrame)) {
      imageFrame.value = fallbackFrame
      lastValidImageFrame = fallbackFrame
      return
    }
    if (hasImageContent.value && stageRect.width > 0 && stageRect.height > 0) {
      const nextFrame = {
        left: 0,
        top: 0,
        width: toStablePixel(stageRect.width),
        height: toStablePixel(stageRect.height),
        naturalWidth: toStablePixel(stageRect.width),
        naturalHeight: toStablePixel(stageRect.height)
      }
      imageFrame.value = nextFrame
      lastValidImageFrame = nextFrame
      return
    }
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
  const nextImage = videoRef.value ?? imageRef.value
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

let acquiredWebRtcViewId: string | null = null
type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}
let videoFrameCallbackHandle: number | null = null
let videoFrameFallbackTimer: number | null = null

function cancelPendingVideoFrameCallback(): void {
  const video = videoRef.value as FrameCallbackVideo | null
  if (videoFrameCallbackHandle != null) {
    video?.cancelVideoFrameCallback?.(videoFrameCallbackHandle)
    videoFrameCallbackHandle = null
  }
  if (videoFrameFallbackTimer != null) {
    window.clearTimeout(videoFrameFallbackTimer)
    videoFrameFallbackTimer = null
  }
}

async function waitForAnnouncedVideoFrame(
  viewId: string | null | undefined,
  frameGeneration: number | null
): Promise<void> {
  cancelPendingVideoFrameCallback()
  if (!viewId || frameGeneration == null) {
    return
  }
  await nextTick()
  const video = videoRef.value as FrameCallbackVideo | null
  if (!video) {
    return
  }
  const acknowledge = (): void => {
    videoFrameCallbackHandle = null
    if (acknowledgeThreeDVideoFrame(viewId, frameGeneration)) {
      scheduleStageMetricsUpdate()
      return
    }
    if (getPendingThreeDVideoFrameGeneration(viewId) === frameGeneration) {
      requestNextVideoFrame()
    }
  }
  const requestNextVideoFrame = (): void => {
    if (video.requestVideoFrameCallback) {
      videoFrameCallbackHandle = video.requestVideoFrameCallback(acknowledge)
      return
    }
    // Chromium exposes frame callbacks. Older WebKit clients receive a
    // conservative delay, then complete both confirmations at once.
    videoFrameFallbackTimer = window.setTimeout(() => {
      videoFrameFallbackTimer = null
      acknowledgeThreeDVideoFrame(viewId, frameGeneration)
      if (acknowledgeThreeDVideoFrame(viewId, frameGeneration)) {
        scheduleStageMetricsUpdate()
      }
    }, 120)
  }
  requestNextVideoFrame()
}

watch(
  () => [props.mediaViewId, threeDTransportMode.value] as const,
  ([viewId, transport]) => {
    const nextViewId = transport === 'webrtc' ? viewId || null : null
    if (acquiredWebRtcViewId === nextViewId) {
      return
    }
    if (acquiredWebRtcViewId) {
      releaseThreeDWebRtcTransport(acquiredWebRtcViewId)
    }
    acquiredWebRtcViewId = nextViewId
    if (nextViewId) {
      acquireThreeDWebRtcTransport(nextViewId)
    } else if (transport === 'webp' && viewId) {
      // The WebRTC metadata path does not carry encoded pixels. Request a
      // fresh WebP frame immediately when the user switches back.
      bindView(viewId)
    }
  },
  { immediate: true }
)

watch(
  webRtcStream,
  async (stream) => {
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      void videoRef.value.play().catch(() => undefined)
    }
    observeLayout()
    scheduleStageMetricsUpdate()
  },
  { immediate: true }
)

watch(
  () => [props.mediaViewId, pendingVideoFrameGeneration.value, webRtcStream.value] as const,
  ([viewId, frameGeneration]) => {
    void waitForAnnouncedVideoFrame(viewId, frameGeneration)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  cancelPendingVideoFrameCallback()
  if (acquiredWebRtcViewId) {
    releaseThreeDWebRtcTransport(acquiredWebRtcViewId)
    acquiredWebRtcViewId = null
  }
})

watch(
  () => [props.imageSrc, webRtcStream.value, props.imageLayers.map((layer) => layer.src).join('|'), props.isActive, props.viewportKey] as const,
  async () => {
    await nextTick()
    observeLayout()
    scheduleStageMetricsUpdate()
  }
)
</script>

<template>
  <div
    class="viewer-viewport relative h-full w-full overflow-hidden rounded-2xl border border-[color:var(--theme-border-soft)] bg-black text-[var(--theme-overlay-text)]"
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
    @wheel.prevent="handleWheel"
    @pointerdown="handlePointerDown"
    @pointermove.capture="handlePointerMove"
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
        v-if="!webRtcStream && imageSrc"
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
      <video
        v-if="webRtcStream"
        ref="videoRef"
        class="viewer-image block h-full w-full select-none object-contain object-center pointer-events-none"
        :class="[
          imageClass,
          {
            'opacity-[0.88] saturate-[0.9]': softImage,
            'viewer-image--transport-hidden': !showWebRtcVideoPixels
          }
        ]"
        :style="imageStyle"
        autoplay
        muted
        playsinline
        @loadedmetadata="() => { scheduleStageMetricsUpdate(); emit('imageLoaded', viewportKey) }"
        @resize="scheduleStageMetricsUpdate"
      />
      <img
        v-if="showWebRtcStillFrame"
        ref="imageRef"
        class="viewer-image pointer-events-none absolute inset-0 z-[1] block h-full w-full select-none object-contain object-center"
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
        v-if="shouldShowCrosshair"
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
      <ViewportPseudocolorBarOverlay
        v-if="shouldShowPseudocolorBar"
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :pseudocolor-preset="pseudocolorPreset"
        :window-info="pseudocolorWindowInfo"
        :light-surface="isLightSurface"
      />
      <ViewportMeasurementOverlay
        v-if="shouldShowImageOverlays"
        :focus-state="getOverlayFocusState('measurement')"
        :draft-measurement-mode="draftMeasurementMode"
        :draft-measurement="draftMeasurement"
        :measurements="measurements"
        :image-frame="measurementFrame"
        :hide-draft-handles="hideDraftHandles"
        @copy-selected-measurement="emit('copySelectedMeasurement', props.viewportKey)"
        @delete-selected-measurement="emit('deleteSelectedMeasurement', props.viewportKey, $event)"
      />
      <ViewportAnnotationOverlay
        v-if="shouldShowImageOverlays"
        :focus-state="getOverlayFocusState('annotation')"
        :annotations="annotations"
        :selected-annotation-id="draftAnnotation?.annotationId ?? null"
        :draft-annotation="draftAnnotation"
        :image-frame="measurementFrame"
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
      <VolumeOrientationCube
        v-if="shouldShowImageOverlays && showVolumeOrientationCube && orientation.volumeQuaternion"
        :orientation="orientation"
        @select-face="emit('volumeOrientationSelect', $event)"
      />
      <div
        v-if="shouldShowLoading"
        class="absolute inset-0 z-[5] grid place-items-center bg-[linear-gradient(180deg,rgba(2,5,10,0.92),rgba(2,5,10,0.98))] backdrop-blur-[2px]"
      >
        <div
          v-if="compactLoading"
          class="viewer-loading-spinner"
          role="status"
          :aria-label="resolvedLoadingLabel"
        ></div>
        <div v-else class="viewer-loading-card w-[min(18rem,calc(100%-2rem))] rounded-2xl border px-4 py-3 text-sm shadow-[0_14px_28px_rgba(0,0,0,0.28)]">
          <div class="flex items-center gap-3">
            <span class="viewer-loading-dot h-2.5 w-2.5 shrink-0 animate-pulse rounded-full"></span>
            <span class="min-w-0 flex-1 truncate">{{ resolvedLoadingLabel }}</span>
            <span v-if="normalizedLoadingProgressPercent !== null" class="w-10 shrink-0 text-right text-xs font-semibold text-sky-200">
              {{ normalizedLoadingProgressPercent }}%
            </span>
          </div>
          <div v-if="normalizedLoadingProgressPercent !== null" class="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--theme-border-soft)]">
            <div
              class="h-full rounded-full bg-[var(--theme-accent)] transition-[width] duration-200 ease-out"
              :style="{ width: `${normalizedLoadingProgressPercent}%` }"
            ></div>
          </div>
        </div>
      </div>
      <span
        v-if="!hasImageContent && !shouldShowLoading"
        class="absolute left-3 top-3 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-solid)] px-3 py-1 text-xs text-[var(--theme-text-muted)]"
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
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.viewer-viewport--active {
  border-color: color-mix(in srgb, var(--theme-accent, #7dd3fc) 92%, #ffffff 8%) !important;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--theme-accent, #7dd3fc) 72%, transparent),
    0 0 0 6px color-mix(in srgb, var(--theme-accent, #7dd3fc) 18%, transparent),
    inset 0 0 0 2px color-mix(in srgb, var(--theme-accent, #7dd3fc) 42%, transparent),
    0 18px 36px rgba(0, 0, 0, 0.3);
}

.viewer-viewport--light-surface.viewer-viewport--active {
  border-color: color-mix(in srgb, var(--theme-accent, #4b9ac6) 90%, #0f172a 10%) !important;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--theme-accent, #4b9ac6) 70%, transparent),
    0 0 0 6px color-mix(in srgb, var(--theme-accent, #4b9ac6) 18%, transparent),
    inset 0 0 0 2px color-mix(in srgb, var(--theme-accent, #4b9ac6) 40%, transparent),
    inset 4px 0 0 color-mix(in srgb, var(--theme-accent, #4b9ac6) 86%, transparent),
    0 16px 32px rgba(15, 23, 42, 0.2);
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

.viewer-loading-card {
  border-color: color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 88%, transparent);
  color: var(--theme-text-primary);
}

.viewer-image--transport-hidden {
  opacity: 0 !important;
}

.viewer-loading-dot {
  background: var(--theme-accent);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

@keyframes viewer-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
