<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
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
import ViewerPresentedImage from './ViewerPresentedImage.vue'
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
import { getPseudocolorBackgroundColor, isPseudocolorBackgroundLight } from '../../../constants/pseudocolor'
import { isViewerPerfDebugEnabled } from '../../../composables/workspace/core/viewerPerfDebug'

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
    imageSrc: string
    mediaViewId?: string | null
    hideDraftHandles?: boolean
    compactLoading?: boolean
    isActive?: boolean
    isLoading?: boolean
    loadingLabel?: string
    loadingProgressPercent?: number | null
    mprCrosshair?: MprCrosshairInfo | null
    mprCrosshairPreview?: MprCrosshairInfo | null
    mprFrame?: MprFrameInfo | null
    mprPlane?: MprPlaneInfo | null
    mprSegmentationDefaultThresholdColor?: string
    mprSegmentationDefaultVoiColor?: string
    mprSegmentationConfig?: MprSegmentationConfig | null
    mprSegmentationOverlay?: MprSegmentationOverlay | null
    mprSegmentationPet?: boolean
    petCornerInfo?: boolean
    orientation: OrientationInfo
    placeholder: string
    pseudocolorPreset?: string | null
    pseudocolorWindowInfo?: WindowLevelInfo | null
    pseudocolorValueDecimalPlaces?: number | null
    renderRevision?: number | null
    renderSurfaceActive?: boolean
    scaleBar?: ScaleBarInfo | null
    showCornerInfo?: boolean
    showCrosshair?: boolean
    showPseudocolorBar?: boolean
    showScaleBar?: boolean
    showVolumeOrientationCube?: boolean
    stageSurfaceClass?: string
    lightSurface?: boolean
    viewportTransform?: ViewTransformInfo | null
    voiEditable?: boolean
    voiOblique?: boolean
    viewportClass?: string
    viewportKey: string
    sourceSliceIndex?: number | null
  }>(),
  {
    annotations: () => [],
    draftAnnotation: null,
    draftMeasurement: null,
    measurements: () => [],
    cursorClass: '',
    draftMeasurementMode: null,
    imageClass: '',
    mediaViewId: null,
    hideDraftHandles: false,
    compactLoading: false,
    isActive: false,
    isLoading: false,
    loadingLabel: '',
    loadingProgressPercent: null,
    mprCrosshair: null,
    mprCrosshairPreview: null,
    mprFrame: null,
    mprPlane: null,
    mprSegmentationDefaultThresholdColor: DEFAULT_MPR_SEGMENTATION_COLOR,
    mprSegmentationDefaultVoiColor: DEFAULT_MPR_VOI_COLOR,
    mprSegmentationConfig: null,
    mprSegmentationOverlay: null,
    mprSegmentationPet: false,
    petCornerInfo: false,
    qaWaterAnalysis: null,
    pseudocolorPreset: null,
    pseudocolorWindowInfo: null,
    pseudocolorValueDecimalPlaces: null,
    renderRevision: null,
    renderSurfaceActive: false,
    scaleBar: null,
    sourceSliceIndex: null,
    showCornerInfo: true,
    showCrosshair: true,
    showPseudocolorBar: true,
    showScaleBar: true,
    showVolumeOrientationCube: true,
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
  framePresented: [payload: { viewportKey: string; sourceSliceIndex: number | null }]
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

interface RenderedFrameState {
  source: string
  receivedAtMs: number
  renderRevision: number | null
  annotations: AnnotationOverlay[]
  cornerInfo: CornerInfo
  measurements: MeasurementOverlay[]
  mprCrosshair: MprCrosshairInfo | null
  mprFrame: MprFrameInfo | null
  mprPlane: MprPlaneInfo | null
  mprSegmentationConfig: MprSegmentationConfig | null
  mprSegmentationOverlay: MprSegmentationOverlay | null
  orientation: OrientationInfo
  pseudocolorPreset: string | null
  pseudocolorWindowInfo: WindowLevelInfo | null
  scaleBar: ScaleBarInfo | null
  sourceSliceIndex: number | null
  viewportTransform: ViewTransformInfo | null
}

function captureRenderedFrame(): RenderedFrameState {
  return {
    source: props.imageSrc,
    receivedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
    renderRevision: props.renderRevision,
    annotations: props.annotations,
    cornerInfo: props.cornerInfo,
    measurements: props.measurements,
    mprCrosshair: props.mprCrosshair,
    mprFrame: props.mprFrame,
    mprPlane: props.mprPlane,
    mprSegmentationConfig: props.mprSegmentationConfig,
    mprSegmentationOverlay: props.mprSegmentationOverlay,
    orientation: props.orientation,
    pseudocolorPreset: props.pseudocolorPreset,
    pseudocolorWindowInfo: props.pseudocolorWindowInfo,
    scaleBar: props.scaleBar,
    sourceSliceIndex: props.sourceSliceIndex,
    viewportTransform: props.viewportTransform
  }
}

const pendingRenderedFrames = new Map<string, RenderedFrameState>()
const presentedSource = ref(props.imageSrc)
const presentedFrame = shallowRef<RenderedFrameState>(captureRenderedFrame())

watch(
  captureRenderedFrame,
  (frame) => {
    if (frame.source) {
      pendingRenderedFrames.set(frame.source, frame)
    }
    if (!frame.source || frame.source === presentedSource.value) {
      presentedFrame.value = frame
    }
  },
  { immediate: true, flush: 'pre' }
)
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

function imageFramesEqual(left: OverlayImageFrame, right: OverlayImageFrame): boolean {
  return (
    left.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.height === right.height &&
    left.naturalWidth === right.naturalWidth &&
    left.naturalHeight === right.naturalHeight
  )
}

function commitImageFrame(nextFrame: OverlayImageFrame): void {
  if (!imageFramesEqual(imageFrame.value, nextFrame)) {
    imageFrame.value = nextFrame
  }
  if (isValidImageFrame(nextFrame)) {
    lastValidImageFrame = nextFrame
  }
}

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
  Boolean(webRtcStream.value && presentedFrame.value.source && shouldShowThreeDStillFrame(props.mediaViewId))
)
const showWebRtcVideoPixels = computed(() =>
  Boolean(webRtcStream.value && hasPresentedWebRtcFrame.value && !showWebRtcStillFrame.value)
)

const hasImageContent = computed(() =>
  Boolean(presentedFrame.value.source || (webRtcStream.value && hasPresentedWebRtcFrame.value))
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
  props.showPseudocolorBar && hasImageContent.value && props.viewportKey !== 'volume' && Boolean(presentedFrame.value.pseudocolorPreset)
)
const isLightSurface = computed(() =>
  props.lightSurface ||
  LIGHT_SURFACE_CLASS_PATTERN.test(props.stageSurfaceClass) ||
  (Boolean(presentedFrame.value.pseudocolorPreset) && isPseudocolorBackgroundLight(presentedFrame.value.pseudocolorPreset))
)
const scaleBarColorOverride = computed(() => (isLightSurface.value ? LIGHT_SURFACE_SCALE_BAR_COLOR : null))
const lightSurfaceStyle = computed(() =>
  presentedFrame.value.pseudocolorPreset
    ? {
        background: getPseudocolorBackgroundColor(presentedFrame.value.pseudocolorPreset),
        backgroundImage: 'none'
      }
    : isLightSurface.value
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
  if (image && presentedFrame.value.source) {
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
    commitImageFrame(nextFrame)
    return
  }

  if (!image || !presentedFrame.value.source) {
    const fallbackFrame = getFallbackImageFrame(stageRect)
    if (hasImageContent.value && isValidImageFrame(fallbackFrame)) {
      commitImageFrame(fallbackFrame)
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
      commitImageFrame(nextFrame)
      return
    }
    lastValidImageFrame = null
    commitImageFrame(createEmptyImageFrame())
    return
  }

  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
    const imageRect = getRenderedImageRect(image)
    const nextFrame = buildImageFrame(stageRect, imageRect, image.naturalWidth, image.naturalHeight)
    commitImageFrame(nextFrame)
    return
  }

  commitImageFrame(getFallbackImageFrame(stageRect) ?? createEmptyImageFrame())
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

function handlePresentedImage(image: HTMLImageElement, source: string): void {
  presentedSource.value = source
  const frame = pendingRenderedFrames.get(source)
  if (frame) {
    presentedFrame.value = frame
    if (isViewerPerfDebugEnabled()) {
      const now = typeof performance === 'undefined' ? Date.now() : performance.now()
      console.debug('[viewer perf] frame presented', {
        viewportKey: props.viewportKey,
        mediaViewId: props.mediaViewId,
        renderRevision: frame.renderRevision,
        presentationMs: Math.round((now - frame.receivedAtMs) * 10) / 10,
        source
      })
    }
  }
  for (const pendingSource of pendingRenderedFrames.keys()) {
    if (pendingSource !== source && pendingSource !== props.imageSrc) {
      pendingRenderedFrames.delete(pendingSource)
    }
  }
  imageRef.value = image
  scheduleStageMetricsUpdate()
  emit('imageLoaded', props.viewportKey)
  emit('framePresented', {
    viewportKey: props.viewportKey,
    sourceSliceIndex: frame?.sourceSliceIndex ?? null
  })
}

function handlePresentedImageError(source: string): void {
  pendingRenderedFrames.delete(source)
}

function handlePresentedImageElement(image: HTMLImageElement): void {
  imageRef.value = image
  scheduleStageMetricsUpdate()
}

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
  () => [props.imageSrc, webRtcStream.value, props.isActive, props.viewportKey] as const,
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
      <ViewerPresentedImage
        v-if="!webRtcStream"
        :alt="alt"
        :display-class="[
          'viewer-image block h-full w-full select-none object-contain object-center pointer-events-none',
          imageClass
        ]"
        :source="imageSrc"
        @element-ready="handlePresentedImageElement"
        @error="handlePresentedImageError"
        @presented="handlePresentedImage"
      />
      <video
        v-if="webRtcStream"
        ref="videoRef"
        class="viewer-image block h-full w-full select-none object-contain object-center pointer-events-none"
        :class="[
          imageClass,
          { 'viewer-image--transport-hidden': !showWebRtcVideoPixels }
        ]"
        autoplay
        muted
        playsinline
        @loadedmetadata="() => { scheduleStageMetricsUpdate(); emit('imageLoaded', viewportKey) }"
        @resize="scheduleStageMetricsUpdate"
      />
      <ViewerPresentedImage
        v-if="showWebRtcStillFrame"
        :alt="alt"
        :display-class="[
          'viewer-image pointer-events-none absolute inset-0 z-[1] block h-full w-full select-none object-contain object-center',
          imageClass
        ]"
        :source="imageSrc"
        @element-ready="handlePresentedImageElement"
        @error="handlePresentedImageError"
        @presented="handlePresentedImage"
      />
      <ViewportCrosshairOverlay
        v-if="shouldShowCrosshair"
        :corner-info="presentedFrame.cornerInfo"
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :image-frame="imageFrame"
        :mpr-crosshair="mprCrosshairPreview ?? presentedFrame.mprCrosshair"
        :mpr-frame="presentedFrame.mprFrame"
        :mpr-plane="presentedFrame.mprPlane"
        :viewport-key="viewportKey"
        :is-active="isActive"
      />
      <ViewportVoiOverlay
        v-if="shouldShowImageOverlays"
        :active-operation="props.activeOperation"
        :config="presentedFrame.mprSegmentationConfig"
        :editable="voiEditable"
        :image-frame="imageFrame"
        :is-active="isActive"
        :is-oblique="voiOblique"
        :mpr-plane="presentedFrame.mprPlane"
        :default-threshold-color="mprSegmentationDefaultThresholdColor"
        :default-voi-color="mprSegmentationDefaultVoiColor"
        :pet-segmentation="mprSegmentationPet"
        :segmentation-overlay="presentedFrame.mprSegmentationOverlay"
        :viewport-transform="presentedFrame.viewportTransform"
        :viewport-key="viewportKey"
        @config-change="handleMprSegmentationConfigChange"
        @mode-change="handleMprSegmentationModeChange"
      />
      <ViewportScaleBarOverlay
        v-if="shouldShowScaleBar"
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :scale-bar="presentedFrame.scaleBar"
        :color-override="scaleBarColorOverride"
      />
      <ViewportPseudocolorBarOverlay
        v-if="shouldShowPseudocolorBar"
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :pseudocolor-preset="presentedFrame.pseudocolorPreset"
        :window-info="presentedFrame.pseudocolorWindowInfo"
        :value-decimal-places="pseudocolorValueDecimalPlaces"
        :light-surface="isLightSurface"
      />
      <ViewportMeasurementOverlay
        v-if="shouldShowImageOverlays"
        :focus-state="getOverlayFocusState('measurement')"
        :draft-measurement-mode="draftMeasurementMode"
        :draft-measurement="draftMeasurement"
        :measurements="presentedFrame.measurements"
        :image-frame="measurementFrame"
        :viewport-transform="presentedFrame.viewportTransform"
        :hide-draft-handles="hideDraftHandles"
        @copy-selected-measurement="emit('copySelectedMeasurement', props.viewportKey)"
        @delete-selected-measurement="emit('deleteSelectedMeasurement', props.viewportKey, $event)"
      />
      <ViewportAnnotationOverlay
        v-if="shouldShowImageOverlays"
        :focus-state="getOverlayFocusState('annotation')"
        :annotations="presentedFrame.annotations"
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
      <ViewportCornerOverlay
        v-if="shouldShowCornerInfo"
        :corner-info="presentedFrame.cornerInfo"
        :pet="petCornerInfo"
        :pseudocolor-preset="presentedFrame.pseudocolorPreset"
        :viewport-key="viewportKey"
      />
      <ViewportOrientationOverlay v-if="shouldShowImageOverlays" :orientation="presentedFrame.orientation" />
      <VolumeOrientationCube
        v-if="shouldShowImageOverlays && showVolumeOrientationCube && presentedFrame.orientation.volumeQuaternion"
        :orientation="presentedFrame.orientation"
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
