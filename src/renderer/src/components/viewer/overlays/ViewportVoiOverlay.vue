<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { OverlayImageFrame } from './overlayGeometry'
import type {
  MprPlaneInfo,
  MprSegmentationConfigActionType,
  MprSegmentationConfig,
  MprSegmentationOverlay,
  MprSegmentationOverlayRegion,
  MprThresholdRegion,
  MprThresholdRegionBox,
  MprVoiSphere,
  MprViewportKey,
  ViewTransformInfo,
  Vec3
} from '../../../types/viewer'
import {
  DEFAULT_MPR_SEGMENTATION_COLOR,
  DEFAULT_MPR_SEGMENTATION_THRESHOLD_HU,
  DEFAULT_MPR_VOI_COLOR,
  createDefaultMprSegmentationConfig,
  normalizeMprSegmentationConfig
} from '../../../types/viewer'
import {
  canvasNormalizedPointToSourceImage,
  canvasNormalizedPointToWorld,
  createThresholdRegionFromImageRect,
  createVoiSphereFromImageCircle,
  estimateThresholdRegionDefaultDepthMm,
  normalizeImageRectFromPoints,
  projectThresholdRegionBoxToCanvasPlane,
  projectVoiSphereToCanvasPlane,
  resizeThresholdRegionBoxInPlane,
  translateThresholdRegionBoxInPlane,
  type NormalizedImagePoint,
  type ThresholdRegionProjection,
  type ThresholdResizeHandle
} from '../../../composables/measurements/mprVoiGeometry'

const props = withDefaults(
  defineProps<{
    activeOperation?: string
    config?: MprSegmentationConfig | null
    editable?: boolean
    imageFrame: OverlayImageFrame
    isActive?: boolean
    isOblique?: boolean
    mprPlane?: MprPlaneInfo | null
    segmentationOverlay?: MprSegmentationOverlay | null
    viewportTransform?: ViewTransformInfo | null
    viewportKey: string
  }>(),
  {
    activeOperation: '',
    config: null,
    editable: false,
    isActive: false,
    isOblique: false,
    mprPlane: null,
    segmentationOverlay: null,
    viewportTransform: null
  }
)

const emit = defineEmits<{
  configChange: [config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType]
  modeChange: [mode: 'segmentation:threshold' | 'segmentation:voi']
}>()

type DragState =
  | {
      kind: 'create-threshold'
      pointerId: number
      anchor: NormalizedImagePoint
      regionId: string
      label: string
      thresholdHu: number
      thresholdMode: MprThresholdRegion['thresholdMode']
      thresholdPercentile: number
      color: string
      depthMm: number | null
    }
  | {
      kind: 'move-threshold'
      pointerId: number
      anchor: NormalizedImagePoint
      region: MprThresholdRegion
      baseBox: MprThresholdRegionBox
    }
  | {
      kind: 'resize-threshold'
      pointerId: number
      region: MprThresholdRegion
      handle: ThresholdResizeHandle
    }
  | {
      kind: 'create-voi'
      pointerId: number
      center: NormalizedImagePoint
      sphereId: string
      label: string
      color: string
    }
  | {
      kind: 'move-voi'
      pointerId: number
      anchor: NormalizedImagePoint
      sphere: MprVoiSphere
    }
  | {
      kind: 'resize-voi'
      pointerId: number
      sphere: MprVoiSphere
    }

let regionSequence = 0
let voiSequence = 0
const overlayRef = ref<HTMLDivElement | null>(null)
const highlightCanvasRef = ref<HTMLCanvasElement | null>(null)
const dragState = ref<DragState | null>(null)
const draftConfig = ref<MprSegmentationConfig | null>(null)
const sortedHuCache = new Map<string, number[]>()
const HIGHLIGHT_MAX_DRAW_SAMPLES_PER_REGION = 45_000
const MIN_THRESHOLD_REGION_SOURCE_PX = 6
const MIN_THRESHOLD_REGION_MM = 2
const MIN_VOI_RADIUS_SOURCE_PX = 4
const MIN_VOI_RADIUS_MM = 2
let highlightRenderRaf: number | null = null

const mprViewportKey = computed<MprViewportKey | null>(() => {
  const key = props.viewportKey
  return key === 'mpr-ax' || key === 'mpr-cor' || key === 'mpr-sag' ? key : null
})

const normalizedOperation = computed(() =>
  props.activeOperation?.startsWith('stack:') ? props.activeOperation.slice('stack:'.length) : (props.activeOperation ?? '')
)
const isThresholdMode = computed(() => normalizedOperation.value === 'segmentation:threshold')
const isVoiMode = computed(() => normalizedOperation.value === 'segmentation:voi')
const canEdit = computed(() => Boolean(props.editable && !props.isOblique && props.mprPlane && mprViewportKey.value))
const canEditThreshold = computed(() => canEdit.value && isThresholdMode.value)
const canCreateOrSelectVoi = computed(() => canEdit.value && props.isActive && isVoiMode.value)
const selectedVoiSphere = computed(() =>
  normalizedConfig.value.voiSpheres.find((sphere) => sphere.id === normalizedConfig.value.selectedVoiId) ?? null
)
const canEditSelectedVoi = computed(() => canCreateOrSelectVoi.value && selectedVoiSphere.value !== null)
const canInteract = computed(() => canEditThreshold.value || canCreateOrSelectVoi.value)

const normalizedConfig = computed(() =>
  draftConfig.value ?? normalizeMprSegmentationConfig(props.config ?? createDefaultMprSegmentationConfig())
)

watch(
  () => props.config,
  () => {
    draftConfig.value = null
  },
  { deep: true }
)

const selectedRegion = computed(() =>
  normalizedConfig.value.thresholdRegions.find((region) => region.id === normalizedConfig.value.selectedRegionId) ?? null
)

const overlayStyle = computed(() => ({
  left: `${props.imageFrame.left}px`,
  top: `${props.imageFrame.top}px`,
  width: `${props.imageFrame.width}px`,
  height: `${props.imageFrame.height}px`
}))

interface RegionProjectionItem {
  region: MprThresholdRegion
  projection: ThresholdRegionProjection
  editableGeometry: boolean
}

const regionProjections = computed<RegionProjectionItem[]>(() => {
  const plane = props.mprPlane
  const viewportKey = mprViewportKey.value
  if (!plane || !viewportKey) {
    return []
  }
  return normalizedConfig.value.thresholdRegions
    .filter((region) => region.enabled)
    .map((region): RegionProjectionItem => {
      const editableGeometry = region.box.sourceViewport === viewportKey
      return {
        region,
        editableGeometry,
        projection: projectThresholdRegionBoxToCanvasPlane(region.box, plane, props.imageFrame, props.viewportTransform)
      }
    })
    .filter((item) => item.projection.visible)
})

interface VoiProjectionItem {
  sphere: MprVoiSphere
  projection: NonNullable<ReturnType<typeof projectVoiSphereToCanvasPlane>>
  selected: boolean
}

const sphereProjections = computed<VoiProjectionItem[]>(() => {
  const plane = props.mprPlane
  if (!plane) {
    return []
  }
  return normalizedConfig.value.voiSpheres
    .filter((sphere) => sphere.enabled)
    .map((sphere): VoiProjectionItem => ({
      sphere,
      selected: sphere.id === normalizedConfig.value.selectedVoiId,
      projection: projectVoiSphereToCanvasPlane(sphere, plane, props.imageFrame, props.viewportTransform)
    }))
    .filter((item) => item.projection.visible)
})

const selectedSphereProjection = computed(() =>
  sphereProjections.value.find((item) => item.selected) ?? null
)

const selectedRegionProjection = computed(() =>
  regionProjections.value.find((item) => item.region.id === normalizedConfig.value.selectedRegionId) ?? null
)

const highlighterConfigSignature = computed(() => {
  const config = normalizedConfig.value
  return [
    config.enabled ? 1 : 0,
    ...config.thresholdRegions.map((region) => [
      region.id,
      region.enabled ? 1 : 0,
      region.thresholdMode,
      region.thresholdHu,
      region.thresholdPercentile,
      region.color
    ].join(':'))
  ].join('|')
})

const highlighterOverlaySignature = computed(() =>
  (props.segmentationOverlay?.regions ?? []).map((region) => {
    const points = region.samples?.points ?? []
    const first = points.length > 0 ? points[0] : ''
    const last = points.length > 0 ? points[points.length - 1] : ''
    return [
      region.regionId,
      region.visible ? 1 : 0,
      region.sampleRevision ?? 0,
      points.length,
      first,
      last
    ].join(':')
  }).join('|')
)

const highlighterFrameSignature = computed(() => [
  props.imageFrame.left,
  props.imageFrame.top,
  props.imageFrame.width,
  props.imageFrame.height,
  props.imageFrame.naturalWidth ?? 0,
  props.imageFrame.naturalHeight ?? 0
].join(':'))

const highlighterPlaneSignature = computed(() => {
  const plane = props.mprPlane
  if (!plane) {
    return ''
  }
  return [
    plane.centerWorld.join(','),
    plane.rowWorld.join(','),
    plane.colWorld.join(','),
    plane.normalWorld.join(','),
    plane.outputShape.join(','),
    plane.pixelSpacingRowMm,
    plane.pixelSpacingColMm
  ].join(':')
})

const highlighterTransformSignature = computed(() => {
  const transform = props.viewportTransform
  return transform ? JSON.stringify(transform) : ''
})

const selectedHandles = computed<Array<{ handle: ThresholdResizeHandle; x: number; y: number }>>(() => {
  const projection = selectedRegionProjection.value?.projection
  if (!projection || !canEditThreshold.value || !selectedRegionProjection.value?.editableGeometry) {
    return []
  }
  return projection.handles.map(({ handle, point }) => ({
    handle,
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y))
  }))
})

const sphereHandles = computed<Array<{ handle: string; x: number; y: number }>>(() => {
  const projection = selectedSphereProjection.value?.projection
  if (!projection || !canEditSelectedVoi.value) {
    return []
  }
  return [
    { handle: 'left', x: projection.center.x - projection.radiusX, y: projection.center.y },
    { handle: 'right', x: projection.center.x + projection.radiusX, y: projection.center.y },
    { handle: 'top', x: projection.center.x, y: projection.center.y - projection.radiusY },
    { handle: 'bottom', x: projection.center.x, y: projection.center.y + projection.radiusY }
  ].map((handle) => ({
    ...handle,
    x: Math.max(0, Math.min(1, handle.x)),
    y: Math.max(0, Math.min(1, handle.y))
  }))
})

const shouldRender = computed(() =>
  Boolean(
    mprViewportKey.value &&
    props.mprPlane &&
    props.imageFrame.width > 1 &&
    props.imageFrame.height > 1 &&
    (canInteract.value || regionProjections.value.length > 0 || sphereProjections.value.length > 0)
  )
)

function rectSvgStyle(rect: { xMin: number; xMax: number; yMin: number; yMax: number }) {
  return {
    x: `${rect.xMin * 100}%`,
    y: `${rect.yMin * 100}%`,
    width: `${Math.max(0, rect.xMax - rect.xMin) * 100}%`,
    height: `${Math.max(0, rect.yMax - rect.yMin) * 100}%`
  }
}

function normalizeOverlaySampleRevision(region: MprSegmentationOverlayRegion): number {
  const revision = Number(region.sampleRevision ?? 0)
  return Number.isFinite(revision) ? revision : 0
}

function getSortedHuValues(region: MprSegmentationOverlayRegion): number[] {
  const points = region.samples?.points ?? []
  const cacheKey = `${region.regionId}:${normalizeOverlaySampleRevision(region)}:${points.length}`
  const cached = sortedHuCache.get(cacheKey)
  if (cached) {
    return cached
  }
  const values: number[] = []
  for (let index = 2; index < points.length; index += 3) {
    const hu = Number(points[index])
    if (Number.isFinite(hu)) {
      values.push(hu)
    }
  }
  values.sort((left, right) => left - right)
  if (sortedHuCache.size > 32) {
    sortedHuCache.clear()
  }
  sortedHuCache.set(cacheKey, values)
  return values
}

function percentileFromSortedValues(values: number[], percentile: number): number | null {
  if (!values.length) {
    return null
  }
  const clampedPercentile = Math.max(0, Math.min(100, Number.isFinite(percentile) ? percentile : 80))
  const index = (clampedPercentile / 100) * (values.length - 1)
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)
  if (lowerIndex === upperIndex) {
    return values[lowerIndex] ?? null
  }
  const lowerValue = values[lowerIndex] ?? values[0]!
  const upperValue = values[upperIndex] ?? values[values.length - 1]!
  return lowerValue + (upperValue - lowerValue) * (index - lowerIndex)
}

function getPreviewThresholdHu(region: MprThresholdRegion, overlayRegion: MprSegmentationOverlayRegion): number {
  if (region.thresholdMode !== 'percentile') {
    return region.thresholdHu
  }
  return percentileFromSortedValues(getSortedHuValues(overlayRegion), region.thresholdPercentile) ?? region.stats?.effectiveThresholdHu ?? region.thresholdHu
}

function hashCanvasPoint(x: number, y: number, seed: number): number {
  let hash = ((x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2246822519) | 0
  hash = (hash ^ (hash >>> 13)) | 0
  hash = Math.imul(hash, 1274126177)
  return (hash ^ (hash >>> 16)) >>> 0
}

function createSourcePixelProjector(
  plane: MprPlaneInfo,
  frame: OverlayImageFrame,
  transform?: ViewTransformInfo | null
): (sourceX: number, sourceY: number) => NormalizedImagePoint {
  const sourceWidth = Math.max(1, Number(plane.outputShape?.[1] ?? 1))
  const sourceHeight = Math.max(1, Number(plane.outputShape?.[0] ?? 1))
  const targetWidth = Math.max(1, Number(frame.naturalWidth || frame.width || 1))
  const targetHeight = Math.max(1, Number(frame.naturalHeight || frame.height || 1))
  const matrix = plane.imageToCanvasMatrix
  if (
    Array.isArray(matrix) &&
    matrix.length === 3 &&
    matrix.every((row) => Array.isArray(row) && row.length === 3 && row.every((entry) => Number.isFinite(Number(entry))))
  ) {
    const normalizedMatrix = matrix.map((row) => row.map((entry) => Number(entry))) as [[number, number, number], [number, number, number], [number, number, number]]
    return (sourceX: number, sourceY: number) => {
      const w = normalizedMatrix[2][0] * sourceX + normalizedMatrix[2][1] * sourceY + normalizedMatrix[2][2]
      const denominator = Math.abs(w) > 1e-9 ? w : 1
      return {
        x: (normalizedMatrix[0][0] * sourceX + normalizedMatrix[0][1] * sourceY + normalizedMatrix[0][2]) / denominator / targetWidth,
        y: (normalizedMatrix[1][0] * sourceX + normalizedMatrix[1][1] * sourceY + normalizedMatrix[1][2]) / denominator / targetHeight
      }
    }
  }

  const rotationDegrees = Number(transform?.rotationDegrees ?? 0)
  const normalizedRotation = ((Math.round(rotationDegrees / 90) * 90) % 360 + 360) % 360
  const radians = normalizedRotation * Math.PI / 180
  const zoom = Number.isFinite(Number(transform?.zoom)) && Number(transform?.zoom) > 0 ? Number(transform?.zoom) : 1
  const scaleX = (transform?.horFlip ? -zoom : zoom) * Math.max(1e-6, plane.pixelSpacingColMm)
  const scaleY = (transform?.verFlip ? -zoom : zoom) * Math.max(1e-6, plane.pixelSpacingRowMm)
  const cosTheta = Math.cos(radians)
  const sinTheta = Math.sin(radians)
  const offsetX = Number.isFinite(Number(transform?.offsetX)) ? Number(transform?.offsetX) : 0
  const offsetY = Number.isFinite(Number(transform?.offsetY)) ? Number(transform?.offsetY) : 0

  return (sourceX: number, sourceY: number) => {
    const centeredX = sourceX - sourceWidth / 2
    const centeredY = sourceY - sourceHeight / 2
    const scaledX = centeredX * scaleX
    const scaledY = centeredY * scaleY
    const canvasX = cosTheta * scaledX - sinTheta * scaledY + targetWidth / 2 + offsetX
    const canvasY = sinTheta * scaledX + cosTheta * scaledY + targetHeight / 2 + offsetY
    return {
      x: canvasX / targetWidth,
      y: canvasY / targetHeight
    }
  }
}

function drawHighlightCanvas(): void {
  const canvas = highlightCanvasRef.value
  const plane = props.mprPlane
  const overlay = props.segmentationOverlay
  const frame = props.imageFrame
  if (!canvas || !plane || !overlay || frame.width <= 1 || frame.height <= 1) {
    if (canvas) {
      const context = canvas.getContext('2d')
      context?.clearRect(0, 0, canvas.width, canvas.height)
    }
    return
  }

  const devicePixelRatio = typeof window === 'undefined' ? 1 : Math.max(1, window.devicePixelRatio || 1)
  const targetWidth = Math.max(1, Math.round(frame.width * devicePixelRatio))
  const targetHeight = Math.max(1, Math.round(frame.height * devicePixelRatio))
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth
    canvas.height = targetHeight
  }
  canvas.style.width = `${frame.width}px`
  canvas.style.height = `${frame.height}px`

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  context.clearRect(0, 0, frame.width, frame.height)

  if (!normalizedConfig.value.enabled) {
    return
  }

  const regionsById = new Map(normalizedConfig.value.thresholdRegions.map((region) => [region.id, region]))
  const projectSourcePixel = createSourcePixelProjector(plane, frame, props.viewportTransform)

  for (const overlayRegion of overlay.regions) {
    const region = regionsById.get(overlayRegion.regionId)
    const points = overlayRegion.samples?.points ?? []
    if (!region?.enabled || points.length < 3) {
      continue
    }
    const thresholdHu = getPreviewThresholdHu(region, overlayRegion)
    const seed = normalizeOverlaySampleRevision(overlayRegion)
    const sampleCount = Math.floor(points.length / 3)
    const sampleStep = Math.max(1, Math.ceil(sampleCount / HIGHLIGHT_MAX_DRAW_SAMPLES_PER_REGION))
    const sampleOffset = sampleStep > 1 ? seed % sampleStep : 0
    context.fillStyle = region.color
    context.globalAlpha = 0.92

    for (let sampleIndex = sampleOffset; sampleIndex < sampleCount; sampleIndex += sampleStep) {
      const index = sampleIndex * 3
      const sourceX = Number(points[index])
      const sourceY = Number(points[index + 1])
      const hu = Number(points[index + 2])
      if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY) || !Number.isFinite(hu) || hu <= thresholdHu) {
        continue
      }
      const canvasPoint = projectSourcePixel(sourceX, sourceY)
      if (canvasPoint.x < 0 || canvasPoint.x > 1 || canvasPoint.y < 0 || canvasPoint.y > 1) {
        continue
      }
      const x = canvasPoint.x * frame.width
      const y = canvasPoint.y * frame.height
      if ((hashCanvasPoint(Math.round(x), Math.round(y), seed) % 100) >= 54) {
        continue
      }
      context.fillRect(Math.round(x), Math.round(y), 1.5, 1.5)
    }
  }
  context.globalAlpha = 1
}

function scheduleHighlightCanvasDraw(): void {
  if (highlightRenderRaf != null || typeof window === 'undefined') {
    return
  }
  highlightRenderRaf = window.requestAnimationFrame(() => {
    highlightRenderRaf = null
    drawHighlightCanvas()
  })
}

watch(
  [
    highlighterConfigSignature,
    highlighterOverlaySignature,
    highlighterFrameSignature,
    highlighterPlaneSignature,
    highlighterTransformSignature
  ],
  () => {
    void nextTick(scheduleHighlightCanvasDraw)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (highlightRenderRaf != null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(highlightRenderRaf)
  }
  highlightRenderRaf = null
})

function getPoint(event: PointerEvent): NormalizedImagePoint | null {
  const overlay = overlayRef.value
  if (!overlay) {
    return null
  }
  const bounds = overlay.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null
  }
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
  }
}

function getSourcePoint(point: NormalizedImagePoint): NormalizedImagePoint | null {
  const plane = props.mprPlane
  if (!plane) {
    return null
  }
  return canvasNormalizedPointToSourceImage(plane, point, props.imageFrame, props.viewportTransform)
}

function isSourcePointInsideImage(point: NormalizedImagePoint | null): point is NormalizedImagePoint {
  if (!point) {
    return false
  }
  const epsilon = 1e-6
  return point.x >= -epsilon && point.x <= 1 + epsilon && point.y >= -epsilon && point.y <= 1 + epsilon
}

function getSourceImageWidth(plane: MprPlaneInfo): number {
  return Math.max(1, Number(plane.outputShape?.[1] ?? 1))
}

function getSourceImageHeight(plane: MprPlaneInfo): number {
  return Math.max(1, Number(plane.outputShape?.[0] ?? 1))
}

function isThresholdRegionBelowMinimum(
  plane: MprPlaneInfo,
  rect: ReturnType<typeof normalizeImageRectFromPoints>,
  region: MprThresholdRegion
): boolean {
  const widthPx = Math.abs(rect.xMax - rect.xMin) * getSourceImageWidth(plane)
  const heightPx = Math.abs(rect.yMax - rect.yMin) * getSourceImageHeight(plane)
  return (
    widthPx < MIN_THRESHOLD_REGION_SOURCE_PX ||
    heightPx < MIN_THRESHOLD_REGION_SOURCE_PX ||
    region.box.widthMm < MIN_THRESHOLD_REGION_MM ||
    region.box.heightMm < MIN_THRESHOLD_REGION_MM
  )
}

function isVoiSphereBelowMinimum(
  plane: MprPlaneInfo,
  center: NormalizedImagePoint,
  edge: NormalizedImagePoint,
  sphere: MprVoiSphere
): boolean {
  const radiusPx = Math.hypot(
    (edge.x - center.x) * getSourceImageWidth(plane),
    (edge.y - center.y) * getSourceImageHeight(plane)
  )
  return radiusPx < MIN_VOI_RADIUS_SOURCE_PX || sphere.radiusMm < MIN_VOI_RADIUS_MM
}

function clampThresholdRegionMinimumSize(region: MprThresholdRegion): MprThresholdRegion {
  if (region.box.widthMm >= MIN_THRESHOLD_REGION_MM && region.box.heightMm >= MIN_THRESHOLD_REGION_MM) {
    return region
  }
  return {
    ...region,
    box: {
      ...region.box,
      widthMm: Math.max(MIN_THRESHOLD_REGION_MM, region.box.widthMm),
      heightMm: Math.max(MIN_THRESHOLD_REGION_MM, region.box.heightMm)
    }
  }
}

function nextRegionIdentity(): { id: string; label: string } {
  regionSequence += 1
  const nextIndex = normalizedConfig.value.thresholdRegions.length + 1
  return {
    id: `threshold-${Date.now()}-${regionSequence}`,
    label: String(nextIndex)
  }
}

function nextVoiIdentity(): { id: string; label: string } {
  voiSequence += 1
  const nextIndex = normalizedConfig.value.voiSpheres.length + 1
  return {
    id: `voi-${Date.now()}-${voiSequence}`,
    label: String(nextIndex)
  }
}

function emitConfig(config: MprSegmentationConfig, actionType: MprSegmentationConfigActionType = 'end'): void {
  const normalized = normalizeMprSegmentationConfig(config)
  draftConfig.value = normalized
  emit('configChange', normalized, actionType)
}

function upsertRegion(region: MprThresholdRegion, actionType: 'move' | 'end'): void {
  const current = normalizedConfig.value
  const replaced = current.thresholdRegions.some((candidate) => candidate.id === region.id)
  emitConfig(
    {
      ...current,
      enabled: true,
      selectedRegionId: region.id,
      selectedVoi: false,
      selectedVoiId: null,
      thresholdRegions: replaced
        ? current.thresholdRegions.map((candidate) => (candidate.id === region.id ? region : candidate))
        : [...current.thresholdRegions, region]
    },
    actionType
  )
}

function removeThresholdRegion(regionId: string, actionType: 'move' | 'end' = 'end'): void {
  const current = normalizedConfig.value
  if (!current.thresholdRegions.some((candidate) => candidate.id === regionId)) {
    return
  }
  const nextRegions = current.thresholdRegions.filter((candidate) => candidate.id !== regionId)
  emitConfig(
    {
      ...current,
      selectedRegionId: current.selectedRegionId === regionId ? null : current.selectedRegionId,
      thresholdRegions: nextRegions
    },
    actionType
  )
}

function selectRegion(regionId: string, actionType: MprSegmentationConfigActionType = 'end'): void {
  emit('modeChange', 'segmentation:threshold')
  emitConfig(
    {
      ...normalizedConfig.value,
      selectedRegionId: regionId,
      selectedVoi: false,
      selectedVoiId: null
    },
    actionType
  )
}

function selectVoi(sphereId: string, actionType: MprSegmentationConfigActionType = 'end'): void {
  if (!normalizedConfig.value.voiSpheres.some((sphere) => sphere.id === sphereId)) {
    return
  }
  emit('modeChange', 'segmentation:voi')
  emitConfig(
    {
      ...normalizedConfig.value,
      selectedRegionId: null,
      selectedVoi: true,
      selectedVoiId: sphereId
    },
    actionType
  )
}

function removeVoiSphere(sphereId: string, actionType: 'move' | 'end' = 'end'): void {
  const current = normalizedConfig.value
  if (!current.voiSpheres.some((candidate) => candidate.id === sphereId)) {
    return
  }
  const nextSpheres = current.voiSpheres.filter((candidate) => candidate.id !== sphereId)
  const selectedVoiId = current.selectedVoiId === sphereId ? null : current.selectedVoiId
  const selectedSphere = selectedVoiId ? nextSpheres.find((sphere) => sphere.id === selectedVoiId) ?? null : null
  emitConfig(
    {
      ...current,
      selectedVoi: selectedSphere !== null,
      selectedVoiId: selectedSphere?.id ?? null,
      voiSpheres: nextSpheres,
      voiSphere: selectedSphere ?? nextSpheres[0] ?? null
    },
    actionType
  )
}

function upsertVoiSphere(sphere: MprVoiSphere, actionType: 'move' | 'end', selected: boolean): void {
  const current = normalizedConfig.value
  const replaced = current.voiSpheres.some((candidate) => candidate.id === sphere.id)
  const nextSpheres = replaced
    ? current.voiSpheres.map((candidate) => (candidate.id === sphere.id ? sphere : candidate))
    : [...current.voiSpheres, sphere]
  emitConfig(
    {
      ...current,
      selectedRegionId: null,
      selectedVoi: selected,
      selectedVoiId: selected ? sphere.id : null,
      voiSpheres: nextSpheres,
      voiSphere: selected ? sphere : nextSpheres[0] ?? null
    },
    actionType
  )
}

function beginDrag(event: PointerEvent, state: DragState): void {
  event.preventDefault()
  event.stopPropagation()
  dragState.value = state
  overlayRef.value?.setPointerCapture(event.pointerId)
}

function beginCreate(event: PointerEvent): void {
  const point = getPoint(event)
  const plane = props.mprPlane
  const viewportKey = mprViewportKey.value
  if (!point || !plane || !viewportKey || !canInteract.value) {
    return
  }
  const sourcePoint = getSourcePoint(point)
  if (!isSourcePointInsideImage(sourcePoint)) {
    return
  }
  if (canEditThreshold.value) {
    const identity = nextRegionIdentity()
    beginDrag(event, {
      kind: 'create-threshold',
      pointerId: event.pointerId,
      anchor: point,
      regionId: identity.id,
      label: identity.label,
      thresholdHu: selectedRegion.value?.thresholdHu ?? DEFAULT_MPR_SEGMENTATION_THRESHOLD_HU,
      thresholdMode: selectedRegion.value?.thresholdMode ?? 'hu',
      thresholdPercentile: selectedRegion.value?.thresholdPercentile ?? 80,
      color: selectedRegion.value?.color ?? DEFAULT_MPR_SEGMENTATION_COLOR,
      depthMm: null
    })
    return
  }
  if (canCreateOrSelectVoi.value) {
    const identity = nextVoiIdentity()
    beginDrag(event, {
      kind: 'create-voi',
      pointerId: event.pointerId,
      center: point,
      sphereId: identity.id,
      label: identity.label,
      color: DEFAULT_MPR_VOI_COLOR
    })
  }
}

function beginMoveThreshold(event: PointerEvent, region: MprThresholdRegion): void {
  const point = getPoint(event)
  if (!point || !canEditThreshold.value || region.box.sourceViewport !== mprViewportKey.value) {
    return
  }
  selectRegion(region.id, 'move')
  beginDrag(event, {
    kind: 'move-threshold',
    pointerId: event.pointerId,
    anchor: point,
    region,
    baseBox: region.box
  })
}

function beginResizeThreshold(event: PointerEvent, handle: ThresholdResizeHandle): void {
  const region = selectedRegion.value
  if (!region || !canEditThreshold.value || region.box.sourceViewport !== mprViewportKey.value) {
    return
  }
  beginDrag(event, {
    kind: 'resize-threshold',
    pointerId: event.pointerId,
    region,
    handle
  })
}

function beginMoveVoi(event: PointerEvent): void {
  const point = getPoint(event)
  const target = (event.currentTarget as SVGElement | null)?.dataset.voiId
  const sphere = normalizedConfig.value.voiSpheres.find((candidate) => candidate.id === target)
  if (!point || !sphere || !canCreateOrSelectVoi.value) {
    return
  }
  if (sphere.id !== normalizedConfig.value.selectedVoiId) {
    event.preventDefault()
    event.stopPropagation()
    selectVoi(sphere.id, 'end')
    return
  }
  beginDrag(event, {
    kind: 'move-voi',
    pointerId: event.pointerId,
    anchor: point,
    sphere
  })
}

function beginResizeVoi(event: PointerEvent): void {
  const sphere = selectedVoiSphere.value
  if (!sphere || !canEditSelectedVoi.value) {
    return
  }
  beginDrag(event, {
    kind: 'resize-voi',
    pointerId: event.pointerId,
    sphere
  })
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function subVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function vec3Length(value: Vec3): number {
  return Math.sqrt(value[0] * value[0] + value[1] * value[1] + value[2] * value[2])
}

function updateDrag(event: PointerEvent, actionType: 'move' | 'end'): void {
  const state = dragState.value
  const point = getPoint(event)
  const plane = props.mprPlane
  const viewportKey = mprViewportKey.value
  if (!state || state.pointerId !== event.pointerId || !point || !plane || !viewportKey) {
    return
  }

  if (state.kind === 'create-threshold') {
    const sourceAnchor = getSourcePoint(state.anchor)
    const sourcePoint = getSourcePoint(point)
    if (!sourceAnchor || !sourcePoint) {
      return
    }
    const rect = normalizeImageRectFromPoints(sourceAnchor, sourcePoint)
    const region = createThresholdRegionFromImageRect(
      plane,
      viewportKey,
      rect,
      {
        id: state.regionId,
        label: state.label,
        thresholdHu: state.thresholdHu,
        thresholdMode: state.thresholdMode,
        thresholdPercentile: state.thresholdPercentile,
        color: state.color,
        depthMm: state.depthMm ?? estimateThresholdRegionDefaultDepthMm(plane, rect)
      }
    )
    if (actionType === 'end' && isThresholdRegionBelowMinimum(plane, rect, region)) {
      removeThresholdRegion(state.regionId, 'end')
      return
    }
    upsertRegion(region, actionType)
    return
  }

  if (state.kind === 'move-threshold') {
    const sourceAnchor = getSourcePoint(state.anchor)
    const sourcePoint = getSourcePoint(point)
    if (!sourceAnchor || !sourcePoint) {
      return
    }
    upsertRegion(
      {
        ...state.region,
        box: translateThresholdRegionBoxInPlane(state.baseBox, plane, {
          x: sourcePoint.x - sourceAnchor.x,
          y: sourcePoint.y - sourceAnchor.y
        }),
        stats: null
      },
      actionType
    )
    return
  }

  if (state.kind === 'resize-threshold') {
    const sourcePoint = getSourcePoint(point)
    if (!sourcePoint) {
      return
    }
    upsertRegion(
      clampThresholdRegionMinimumSize(
        resizeThresholdRegionBoxInPlane(state.region, plane, viewportKey, state.handle, sourcePoint)
      ),
      actionType
    )
    return
  }

  if (state.kind === 'create-voi') {
    const sourceCenter = getSourcePoint(state.center)
    const sourcePoint = getSourcePoint(point)
    if (!sourceCenter || !sourcePoint) {
      return
    }
    const createdSphere = createVoiSphereFromImageCircle(plane, sourceCenter, sourcePoint, state.color)
    const nextSphere = {
      ...createdSphere,
      id: state.sphereId,
      label: state.label,
      stats: null
    }
    if (actionType === 'end' && isVoiSphereBelowMinimum(plane, sourceCenter, sourcePoint, nextSphere)) {
      removeVoiSphere(state.sphereId, 'end')
      return
    }
    upsertVoiSphere(
      nextSphere,
      actionType,
      actionType === 'move'
    )
    return
  }

  if (state.kind === 'resize-voi') {
    const currentWorld = canvasNormalizedPointToWorld(plane, point, props.imageFrame, props.viewportTransform)
    upsertVoiSphere(
      {
        ...state.sphere,
        radiusMm: Math.max(MIN_VOI_RADIUS_MM, vec3Length(subVec3(currentWorld, state.sphere.centerWorld))),
        stats: null
      },
      actionType,
      true
    )
    return
  }

  const anchorWorld = canvasNormalizedPointToWorld(plane, state.anchor, props.imageFrame, props.viewportTransform)
  const currentWorld = canvasNormalizedPointToWorld(plane, point, props.imageFrame, props.viewportTransform)
  upsertVoiSphere(
    {
      ...state.sphere,
      centerWorld: addVec3(state.sphere.centerWorld, subVec3(currentWorld, anchorWorld)),
      stats: null
    },
    actionType,
    true
  )
}

function handlePointerMove(event: PointerEvent): void {
  if (!dragState.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateDrag(event, 'move')
}

function endDrag(event: PointerEvent): void {
  const state = dragState.value
  if (!state || state.pointerId !== event.pointerId) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateDrag(event, 'end')
  overlayRef.value?.releasePointerCapture(event.pointerId)
  dragState.value = null
}

function handleThresholdRegionPointerDown(event: PointerEvent, item: RegionProjectionItem): void {
  event.preventDefault()
  event.stopPropagation()
  if (item.region.id !== normalizedConfig.value.selectedRegionId) {
    selectRegion(item.region.id, 'end')
    return
  }
  if (item.editableGeometry) {
    beginMoveThreshold(event, item.region)
    return
  }
  selectRegion(item.region.id, 'end')
}
</script>

<template>
  <div
    v-if="shouldRender"
    ref="overlayRef"
    class="absolute z-[3]"
    :class="canInteract ? 'cursor-crosshair' : 'pointer-events-none'"
    :style="overlayStyle"
    data-testid="viewport-segmentation-overlay"
    @pointermove="handlePointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <canvas
      ref="highlightCanvasRef"
      class="pointer-events-none absolute inset-0 h-full w-full"
      data-testid="viewport-segmentation-highlight"
    ></canvas>
    <svg class="relative z-[1] h-full w-full overflow-visible">
      <rect
        class="fill-transparent"
        x="0"
        y="0"
        width="100%"
        height="100%"
        :pointer-events="canInteract ? 'all' : 'none'"
        @pointerdown="beginCreate"
      />

      <g
        v-for="item in regionProjections"
        :key="item.region.id"
      >
        <rect
          class="stroke-fuchsia-300"
          :class="item.region.id === normalizedConfig.selectedRegionId ? 'fill-fuchsia-400/10' : 'fill-transparent'"
          v-bind="rectSvgStyle(item.projection.clippedRect)"
          :data-region-id="item.region.id"
          :stroke="item.region.color"
          :stroke-width="item.region.id === normalizedConfig.selectedRegionId ? 2.25 : 1.5"
          :stroke-dasharray="item.projection.intersectsPlane ? undefined : '4 4'"
          vector-effect="non-scaling-stroke"
          :pointer-events="canEditThreshold ? 'all' : 'none'"
          @pointerdown="handleThresholdRegionPointerDown($event, item)"
        />
      </g>

      <circle
        v-for="point in selectedHandles"
        :key="point.handle"
        class="fill-lime-300 stroke-slate-950"
        :class="canEditThreshold ? 'cursor-nwse-resize' : ''"
        :cx="`${point.x * 100}%`"
        :cy="`${point.y * 100}%`"
        r="4.5"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        :pointer-events="canEditThreshold ? 'all' : 'none'"
        @pointerdown="beginResizeThreshold($event, point.handle)"
      />

      <ellipse
        v-for="item in sphereProjections"
        :key="item.sphere.id"
        class="transition-colors"
        :class="[
          item.selected ? 'fill-cyan-300/10 stroke-cyan-200' : 'fill-transparent stroke-emerald-300/90',
          canCreateOrSelectVoi ? (item.selected ? 'cursor-move' : 'cursor-pointer') : ''
        ]"
        :data-voi-id="item.sphere.id"
        :cx="`${item.projection.center.x * 100}%`"
        :cy="`${item.projection.center.y * 100}%`"
        :rx="`${item.projection.radiusX * 100}%`"
        :ry="`${item.projection.radiusY * 100}%`"
        :stroke-width="item.selected ? 2.25 : (item.projection.intersectsPlane ? 1.75 : 1.5)"
        :stroke-dasharray="item.projection.intersectsPlane ? undefined : '5 5'"
        vector-effect="non-scaling-stroke"
        :pointer-events="canCreateOrSelectVoi ? 'all' : 'none'"
        @pointerdown="beginMoveVoi"
      />
      <circle
        v-for="point in sphereHandles"
        :key="`sphere-${point.handle}`"
        class="fill-cyan-200 stroke-slate-950"
        :class="canEditSelectedVoi ? 'cursor-nwse-resize' : ''"
        :cx="`${point.x * 100}%`"
        :cy="`${point.y * 100}%`"
        r="4.5"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        :pointer-events="canEditSelectedVoi ? 'all' : 'none'"
        @pointerdown="beginResizeVoi"
      />
    </svg>
  </div>
</template>
