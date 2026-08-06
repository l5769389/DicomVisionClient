<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { OverlayImageFrame } from './overlayGeometry'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import { dispatchWorkspaceStatusToast } from '../../../composables/workspace/tasks/workspaceStatus'
import type {
  MprPlaneInfo,
  MprSegmentationConfigActionType,
  MprSegmentationConfig,
  MprSegmentationOverlay,
  MprSegmentationOverlayRegion,
  MprSegmentationOverlayWorldPoint,
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
  MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS,
  MPR_SEGMENTATION_MAX_VOI_SPHERES,
  createDefaultMprSegmentationConfig,
  normalizeMprSegmentationConfig,
  normalizeMprThresholdRegionBox,
  resolveMprLegacyVoiSphere
} from '../../../types/viewer'
import {
  canvasNormalizedPointToSourceImage,
  canvasNormalizedPointToWorld,
  clipPolygonToUnitRect,
  createThresholdRegionFromImageRect,
  createVoiSphereFromImageCircle,
  estimateThresholdRegionDefaultDepthMm,
  getThresholdRegionBoxPlaneIntersectionPoints,
  normalizeImageRectFromPoints,
  projectThresholdRegionBoxToCanvasPlane,
  projectVoiSphereToCanvasPlane,
  projectWorldPointsToCanvasPlane,
  worldPointToCanvasNormalized,
  type NormalizedImagePoint,
  type ThresholdRegionProjection,
  type ThresholdResizeHandle
} from '../../../composables/measurements/mprVoiGeometry'

const props = withDefaults(
  defineProps<{
    activeOperation?: string
    config?: MprSegmentationConfig | null
    defaultThresholdColor?: string
    defaultVoiColor?: string
    editable?: boolean
    imageFrame: OverlayImageFrame
    isActive?: boolean
    isOblique?: boolean
    mprPlane?: MprPlaneInfo | null
    segmentationOverlay?: MprSegmentationOverlay | null
    petSegmentation?: boolean
    viewportTransform?: ViewTransformInfo | null
    viewportKey: string
  }>(),
  {
    activeOperation: '',
    config: null,
    defaultThresholdColor: DEFAULT_MPR_SEGMENTATION_COLOR,
    defaultVoiColor: DEFAULT_MPR_VOI_COLOR,
    editable: false,
    isActive: false,
    isOblique: false,
    mprPlane: null,
    petSegmentation: false,
    segmentationOverlay: null,
    viewportTransform: null
  }
)

const emit = defineEmits<{
  configChange: [config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType]
  modeChange: [mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null]
}>()

type DragState =
  | {
      kind: 'create-threshold'
      pointerId: number
      anchor: NormalizedImagePoint
      regionId: string
      label: string
      thresholdHu: number
      thresholdValue: number
      thresholdMode: MprThresholdRegion['thresholdMode']
      thresholdPercentMax: number
      thresholdPercentile: number
      color: string
      depthMm: number | null
    }
  | {
      kind: 'move-threshold'
      pointerId: number
      anchorWorld: Vec3
      region: MprThresholdRegion
      baseBox: MprThresholdRegionBox
      previewProjection: ThresholdRegionProjection
      changed: boolean
    }
  | {
      kind: 'resize-threshold'
      pointerId: number
      anchorWorld: Vec3
      region: MprThresholdRegion
      handle: ThresholdResizeHandle
      baseBox: MprThresholdRegionBox
      previewProjection: ThresholdRegionProjection
      changed: boolean
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

interface ThresholdCreationDefaults {
  thresholdHu: number
  thresholdValue: number
  thresholdMode: MprThresholdRegion['thresholdMode']
  thresholdPercentMax: number
  thresholdPercentile: number
}

let regionSequence = 0
let voiSequence = 0
const overlayRef = ref<HTMLDivElement | null>(null)
const stableHighlightCanvasRef = ref<HTMLCanvasElement | null>(null)
const activeHighlightCanvasRef = ref<HTMLCanvasElement | null>(null)
const dragState = ref<DragState | null>(null)
const consumedPointerId = ref<number | null>(null)
const draftConfig = ref<MprSegmentationConfig | null>(null)
const pendingThresholdDisplayBoxes = ref(new Map<string, MprThresholdRegionBox>())
const sortedHuCache = new Map<string, number[]>()
const MIN_THRESHOLD_REGION_SOURCE_PX = 6
const MIN_THRESHOLD_REGION_MM = 2
const MIN_VOI_RADIUS_SOURCE_PX = 4
const MIN_VOI_RADIUS_MM = 2
const SEGMENTATION_DRAG_EPSILON = 1e-6
let stableHighlightRenderRaf: number | null = null
let activeHighlightRenderRaf: number | null = null
const { locale } = useUiPreferences()

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
const canSelectExistingSegmentation = computed(() => canEdit.value && normalizedConfig.value.enabled)
const selectedVoiSphere = computed(() =>
  normalizedConfig.value.voiSpheres.find((sphere) => sphere.id === normalizedConfig.value.selectedVoiId) ?? null
)
const canEditSelectedVoi = computed(() => canCreateOrSelectVoi.value && selectedVoiSphere.value !== null)
const canInteract = computed(() => normalizedConfig.value.enabled && (canEditThreshold.value || canCreateOrSelectVoi.value))
const canReceivePointerEvents = computed(() => canInteract.value || canSelectExistingSegmentation.value)
const isZh = computed(() => locale.value === 'zh-CN')

const normalizedConfig = computed(() =>
  draftConfig.value ?? normalizeMprSegmentationConfig(props.config ?? createDefaultMprSegmentationConfig())
)
const isPetSegmentation = computed(() =>
  props.petSegmentation ||
  ['PT', 'PET'].includes(String(normalizedConfig.value.intensityContext?.modality ?? '').trim().toUpperCase())
)
const THRESHOLD_HANDLE_ORDER: ThresholdResizeHandle[] = ['nw', 'ne', 'se', 'sw']

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
  interactionRegion: MprThresholdRegion
  projection: ThresholdRegionProjection
  editableGeometry: boolean
  authoritativeGuide: boolean
}

function overlayWorldPointToVec3(point: MprSegmentationOverlayWorldPoint): Vec3 | null {
  const x = Number(point.x)
  const y = Number(point.y)
  const z = Number(point.z)
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? [x, y, z] : null
}

function overlayWorldPointsToVec3(points: MprSegmentationOverlayWorldPoint[] | undefined): Vec3[] {
  return (points ?? [])
    .map(overlayWorldPointToVec3)
    .filter((point): point is Vec3 => point !== null)
}

function buildProjectionGuideHandles(
  projection: ThresholdRegionProjection,
  box: MprThresholdRegionBox,
  plane: MprPlaneInfo
): Array<{ handle: ThresholdResizeHandle; point: NormalizedImagePoint }> | null {
  const contour = clipPolygonToUnitRect(projection.contour)
  if (contour.length !== 4) {
    return null
  }
  const candidates = getThresholdRegionBoxPlaneIntersectionPoints(box, plane).map((worldPoint) => ({
    handle: thresholdResizeHandleForWorldPoint(box, worldPoint),
    point: worldPointToCanvasNormalized(plane, worldPoint, props.imageFrame, props.viewportTransform)
  }))
  const uniqueHandles = new Set(candidates.map((candidate) => candidate.handle))
  if (candidates.length !== 4 || uniqueHandles.size !== 4) {
    return null
  }
  const unused = [...candidates]
  return contour.map((point, index) => {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const [candidateIndex, candidate] of unused.entries()) {
      const distance = squaredPointDistance(point, candidate.point)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = candidateIndex
      }
    }
    const [candidate] = unused.splice(nearestIndex, 1)
    return {
      handle: candidate?.handle ?? THRESHOLD_HANDLE_ORDER[index]!,
      point
    }
  })
}

function thresholdResizeHandleForWorldPoint(
  box: MprThresholdRegionBox,
  worldPoint: Vec3
): ThresholdResizeHandle {
  const delta = subVec3(worldPoint, box.centerWorld)
  const colSign = dotVec3(delta, box.colWorld) >= 0 ? 1 : -1
  const rowSign = dotVec3(delta, box.rowWorld) >= 0 ? 1 : -1
  if (rowSign < 0) {
    return colSign < 0 ? 'nw' : 'ne'
  }
  return colSign < 0 ? 'sw' : 'se'
}

function squaredPointDistance(a: NormalizedImagePoint, b: NormalizedImagePoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function cloneThresholdRegionBox(box: MprThresholdRegionBox): MprThresholdRegionBox {
  return {
    centerWorld: [...box.centerWorld],
    rowWorld: [...box.rowWorld],
    colWorld: [...box.colWorld],
    normalWorld: [...box.normalWorld],
    widthMm: box.widthMm,
    heightMm: box.heightMm,
    depthMm: box.depthMm,
    sourceViewport: box.sourceViewport
  }
}

function vec3ApproximatelyEqual(a: Vec3, b: Vec3, tolerance = 1e-4): boolean {
  return a.every((value, index) => Math.abs(value - b[index]!) <= tolerance)
}

function thresholdRegionBoxesApproximatelyEqual(
  first: MprThresholdRegionBox,
  second: MprThresholdRegionBox,
  tolerance = 1e-4
): boolean {
  return (
    vec3ApproximatelyEqual(first.centerWorld, second.centerWorld, tolerance) &&
    vec3ApproximatelyEqual(first.rowWorld, second.rowWorld, tolerance) &&
    vec3ApproximatelyEqual(first.colWorld, second.colWorld, tolerance) &&
    vec3ApproximatelyEqual(first.normalWorld, second.normalWorld, tolerance) &&
    Math.abs(first.widthMm - second.widthMm) <= tolerance &&
    Math.abs(first.heightMm - second.heightMm) <= tolerance &&
    Math.abs(first.depthMm - second.depthMm) <= tolerance &&
    first.sourceViewport === second.sourceViewport
  )
}

function setPendingThresholdDisplayBox(regionId: string, box: MprThresholdRegionBox): void {
  const next = new Map(pendingThresholdDisplayBoxes.value)
  next.set(regionId, cloneThresholdRegionBox(box))
  pendingThresholdDisplayBoxes.value = next
}

function clearMatchedPendingThresholdDisplayBoxes(): void {
  const current = pendingThresholdDisplayBoxes.value
  if (current.size === 0) {
    return
  }
  const overlayByRegionId = new Map(
    (props.segmentationOverlay?.regions ?? []).map((region) => [region.regionId, region])
  )
  let next: Map<string, MprThresholdRegionBox> | null = null
  for (const [regionId, pendingBox] of current) {
    const displayBox = normalizeMprThresholdRegionBox(overlayByRegionId.get(regionId)?.displayBox)
    if (displayBox && thresholdRegionBoxesApproximatelyEqual(displayBox, pendingBox)) {
      next ??= new Map(current)
      next.delete(regionId)
    }
  }
  if (next) {
    pendingThresholdDisplayBoxes.value = next
  }
}

watch(
  () => props.segmentationOverlay,
  () => {
    clearMatchedPendingThresholdDisplayBoxes()
  },
  { deep: true }
)

function getActiveThresholdDragState(regionId: string): Extract<DragState, { kind: 'move-threshold' | 'resize-threshold' }> | null {
  const state = dragState.value
  if (
    (state?.kind === 'move-threshold' || state?.kind === 'resize-threshold') &&
    state.region.id === regionId &&
    state.changed
  ) {
    return state
  }
  return null
}

function getDraggedThresholdRegionId(): string | null {
  const state = dragState.value
  if (!state) {
    return null
  }
  if (state.kind === 'create-threshold') {
    return state.regionId
  }
  if (state.kind === 'move-threshold' || state.kind === 'resize-threshold') {
    return state.changed ? state.region.id : null
  }
  return null
}

const regionProjections = computed<RegionProjectionItem[]>(() => {
  const plane = props.mprPlane
  const viewportKey = mprViewportKey.value
  if (!normalizedConfig.value.enabled || !plane || !viewportKey) {
    return []
  }
  const overlayByRegionId = new Map(
    (props.segmentationOverlay?.regions ?? []).map((region) => [region.regionId, region])
  )
  return normalizedConfig.value.thresholdRegions
    .filter((region) => region.enabled)
    .flatMap((region): RegionProjectionItem[] => {
      const overlayRegion = overlayByRegionId.get(region.id)
      const hasAuthoritativeGuide = Boolean(overlayRegion?.guideAuthoritative)
      const backendDisplayBox = normalizeMprThresholdRegionBox(overlayRegion?.displayBox)
      const activeThresholdDrag = getActiveThresholdDragState(region.id)
      const pendingDisplayBox = pendingThresholdDisplayBoxes.value.get(region.id) ?? null
      const pendingDisplayBoxMatched = Boolean(
        pendingDisplayBox &&
        backendDisplayBox &&
        thresholdRegionBoxesApproximatelyEqual(pendingDisplayBox, backendDisplayBox)
      )
      const pendingProjection = pendingDisplayBox && !pendingDisplayBoxMatched
        ? projectThresholdRegionBoxToCanvasPlane(
            pendingDisplayBox,
            plane,
            props.imageFrame,
            props.viewportTransform
          )
        : null
      const interactionRegion = {
        ...region,
        box: activeThresholdDrag
          ? region.box
          : pendingDisplayBox && !pendingDisplayBoxMatched
            ? pendingDisplayBox
            : backendDisplayBox ?? region.box
      }
      const backendWorldPoints = overlayWorldPointsToVec3(overlayRegion?.guideWorldPoints)
      const backendProjection = projectWorldPointsToCanvasPlane(
        backendWorldPoints,
        plane,
        props.imageFrame,
        props.viewportTransform,
        overlayRegion?.guideIntersectsPlane ?? true
      )
      const projection = activeThresholdDrag
        ? activeThresholdDrag.previewProjection
        : pendingProjection
          ? pendingProjection
          : overlayRegion
          ? backendProjection
          : projectThresholdRegionBoxToCanvasPlane(
              region.box,
              plane,
              props.imageFrame,
              props.viewportTransform
            )
      if (!projection?.visible) {
        return []
      }
      const editableGeometry = interactionRegion.box.sourceViewport === viewportKey && Boolean(
        !overlayRegion || backendDisplayBox || pendingDisplayBox
      )
      const guideHandles = editableGeometry
        ? buildProjectionGuideHandles(projection, interactionRegion.box, plane)
        : null
      const fallbackHandles = projection.handles.length > 0
        ? projection.handles
        : [
            { handle: 'nw' as const, point: { x: projection.clippedRect.xMin, y: projection.clippedRect.yMin } },
            { handle: 'ne' as const, point: { x: projection.clippedRect.xMax, y: projection.clippedRect.yMin } },
            { handle: 'se' as const, point: { x: projection.clippedRect.xMax, y: projection.clippedRect.yMax } },
            { handle: 'sw' as const, point: { x: projection.clippedRect.xMin, y: projection.clippedRect.yMax } }
          ]
      const resolvedProjection = editableGeometry
        ? {
            ...projection,
            handles: guideHandles ?? fallbackHandles
          }
        : projection
      return [
        {
          region,
          interactionRegion,
          editableGeometry,
          authoritativeGuide: hasAuthoritativeGuide || backendWorldPoints.length >= 3,
          projection: resolvedProjection
        }
      ]
    })
})

interface VoiProjectionItem {
  sphere: MprVoiSphere
  projection: NonNullable<ReturnType<typeof projectVoiSphereToCanvasPlane>>
  selected: boolean
}

const sphereProjections = computed<VoiProjectionItem[]>(() => {
  const plane = props.mprPlane
  if (!normalizedConfig.value.enabled || !plane) {
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

const backgroundRegionProjections = computed(() =>
  regionProjections.value.filter((item) => item.region.id !== normalizedConfig.value.selectedRegionId)
)

const backgroundSphereProjections = computed(() =>
  sphereProjections.value.filter((item) => !item.selected)
)

const activeThresholdRegionId = computed(() => {
  return getDraggedThresholdRegionId()
})

function thresholdRegionSignature(region: MprThresholdRegion): string {
  return [
    region.id,
    region.enabled ? 1 : 0,
    region.thresholdMode,
    region.thresholdHu,
    region.thresholdValue,
    region.thresholdPercentMax,
    region.thresholdPercentile,
    region.color,
    region.box.sourceViewport,
    region.box.centerWorld.join(','),
    region.box.rowWorld.join(','),
    region.box.colWorld.join(','),
    region.box.normalWorld.join(','),
    region.box.widthMm,
    region.box.heightMm,
    region.box.depthMm
  ].join(':')
}

const stableHighlighterConfigSignature = computed(() => {
  const config = normalizedConfig.value
  return [
    config.enabled ? 1 : 0,
    ...config.thresholdRegions.map(thresholdRegionSignature)
  ].join('|')
})

const activeHighlighterConfigSignature = computed(() => {
  const activeRegionId = activeThresholdRegionId.value
  const region = activeRegionId
    ? normalizedConfig.value.thresholdRegions.find((candidate) => candidate.id === activeRegionId) ?? null
    : null
  return region ? thresholdRegionSignature(region) : ''
})

function samplePointsSignature(points: number[]): string {
  let hash = 2166136261
  for (let index = 0; index < points.length; index += 1) {
    const scaled = Math.round(Number(points[index]) * 1000)
    hash ^= Number.isFinite(scaled) ? scaled : 0
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash.toString(36)
}

function worldPointsSignature(points: MprSegmentationOverlayWorldPoint[]): string {
  return points
    .map((point) => `${Number(point.x).toFixed(4)},${Number(point.y).toFixed(4)},${Number(point.z).toFixed(4)}`)
    .join(';')
}

function overlayRegionsSignature(regions: MprSegmentationOverlayRegion[]): string {
  return regions.map((region) => {
    const points = region.samples?.points ?? []
    const guidePoints = region.guidePoints ?? []
    const guideWorldPoints = region.guideWorldPoints ?? []
    const contourWorldPoints = region.contourWorldPoints ?? []
    return [
      region.regionId,
      region.visible ? 1 : 0,
      region.sampleRevision ?? 0,
      region.guideAuthoritative ? 1 : 0,
      region.guideIntersectsPlane === false ? 0 : 1,
      guidePoints
        .map((point) => `${Number(point.x).toFixed(6)},${Number(point.y).toFixed(6)}`)
        .join(';'),
      worldPointsSignature(guideWorldPoints),
      contourWorldPoints.map(worldPointsSignature).join('/'),
      points.length,
      samplePointsSignature(points)
    ].join(':')
  }).join('|')
}

const stableHighlighterOverlaySignature = computed(() =>
  overlayRegionsSignature(props.segmentationOverlay?.regions ?? [])
)

const activeHighlighterOverlaySignature = computed(() => {
  const activeRegionId = activeThresholdRegionId.value
  return activeRegionId
    ? overlayRegionsSignature((props.segmentationOverlay?.regions ?? []).filter((region) => region.regionId === activeRegionId))
    : ''
})

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

function projectionUsesPolygon(projection: ThresholdRegionProjection): boolean {
  if (projection.contour.length < 3) {
    return false
  }
  const { rect } = projection
  return projection.contour.some((point) => {
    const onHorizontalEdge = Math.abs(point.y - rect.yMin) < 1e-5 || Math.abs(point.y - rect.yMax) < 1e-5
    const onVerticalEdge = Math.abs(point.x - rect.xMin) < 1e-5 || Math.abs(point.x - rect.xMax) < 1e-5
    return !(onHorizontalEdge && onVerticalEdge)
  })
}

function regionProjectionUsesPolygon(item: RegionProjectionItem): boolean {
  return item.authoritativeGuide || projectionUsesPolygon(item.projection)
}

function projectionSvgPoints(projection: ThresholdRegionProjection): string {
  const width = Math.max(1, props.imageFrame.width)
  const height = Math.max(1, props.imageFrame.height)
  return clipPolygonToUnitRect(projection.contour)
    .map((point) => `${point.x * width},${point.y * height}`)
    .join(' ')
}

function thresholdGuideDasharray(projection: ThresholdRegionProjection): string | undefined {
  return projection.intersectsPlane ? undefined : '4 4'
}

function hexToRgba(color: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(color)
  if (!match) {
    return color
  }
  const value = match[1]
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`
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
  const sortedValues = getSortedHuValues(overlayRegion)
  if (region.thresholdMode === 'percentMax') {
    const maximum = sortedValues.at(-1)
    const percent = Math.max(0, Math.min(100, Number(region.thresholdPercentMax ?? 40)))
    return maximum != null
      ? maximum * percent / 100
      : region.stats?.effectiveThresholdValue ?? region.stats?.effectiveThresholdHu ?? region.thresholdValue ?? region.thresholdHu
  }
  if (region.thresholdMode !== 'percentile') {
    return region.thresholdValue ?? region.thresholdHu
  }
  return percentileFromSortedValues(sortedValues, region.thresholdPercentile) ?? region.stats?.effectiveThresholdHu ?? region.thresholdHu
}

interface SourceBoundaryPoint {
  x: number
  y: number
}

interface SourceBoundaryEdge {
  start: SourceBoundaryPoint
  end: SourceBoundaryPoint
}

function sourceBoundaryPointKey(point: SourceBoundaryPoint): string {
  return `${point.x}:${point.y}`
}

function traceQualifiedSampleContours(
  qualifiedSamples: Map<string, { sourceCol: number; sourceRow: number }>
): SourceBoundaryPoint[][] {
  const edges: SourceBoundaryEdge[] = []
  const appendEdge = (
    neighborCol: number,
    neighborRow: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): void => {
    if (qualifiedSamples.has(`${neighborCol}:${neighborRow}`)) {
      return
    }
    edges.push({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY }
    })
  }

  for (const { sourceCol, sourceRow } of qualifiedSamples.values()) {
    appendEdge(sourceCol, sourceRow - 1, sourceCol, sourceRow, sourceCol + 1, sourceRow)
    appendEdge(sourceCol + 1, sourceRow, sourceCol + 1, sourceRow, sourceCol + 1, sourceRow + 1)
    appendEdge(sourceCol, sourceRow + 1, sourceCol + 1, sourceRow + 1, sourceCol, sourceRow + 1)
    appendEdge(sourceCol - 1, sourceRow, sourceCol, sourceRow + 1, sourceCol, sourceRow)
  }

  const edgesByStart = new Map<string, number[]>()
  edges.forEach((edge, index) => {
    const key = sourceBoundaryPointKey(edge.start)
    const indices = edgesByStart.get(key) ?? []
    indices.push(index)
    edgesByStart.set(key, indices)
  })

  const used = new Set<number>()
  const contours: SourceBoundaryPoint[][] = []
  for (let startEdgeIndex = 0; startEdgeIndex < edges.length; startEdgeIndex += 1) {
    if (used.has(startEdgeIndex)) {
      continue
    }
    const startEdge = edges[startEdgeIndex]!
    const contour: SourceBoundaryPoint[] = [startEdge.start]
    let edgeIndex = startEdgeIndex
    for (let guard = 0; guard <= edges.length; guard += 1) {
      if (used.has(edgeIndex)) {
        break
      }
      used.add(edgeIndex)
      const edge = edges[edgeIndex]!
      contour.push(edge.end)
      if (sourceBoundaryPointKey(edge.end) === sourceBoundaryPointKey(startEdge.start)) {
        break
      }
      const nextEdgeIndex = (edgesByStart.get(sourceBoundaryPointKey(edge.end)) ?? [])
        .find((candidate) => !used.has(candidate))
      if (nextEdgeIndex == null) {
        break
      }
      edgeIndex = nextEdgeIndex
    }
    if (contour.length >= 4) {
      if (
        sourceBoundaryPointKey(contour[0]!) ===
        sourceBoundaryPointKey(contour[contour.length - 1]!)
      ) {
        contour.pop()
      }
      contours.push(contour)
    }
  }
  return contours
}

function drawSmoothClosedContour(
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>
): void {
  if (points.length < 3) {
    return
  }
  const midpoint = (left: { x: number; y: number }, right: { x: number; y: number }) => ({
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2
  })
  const first = points[0]!
  const last = points[points.length - 1]!
  const start = midpoint(last, first)
  context.moveTo(start.x, start.y)
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    const nextMidpoint = midpoint(current, next)
    context.quadraticCurveTo(current.x, current.y, nextMidpoint.x, nextMidpoint.y)
  }
  context.closePath()
}

function clipHighlightToProjection(
  context: CanvasRenderingContext2D,
  projection: ThresholdRegionProjection,
  frame: OverlayImageFrame
): void {
  context.beginPath()
  if (projectionUsesPolygon(projection) && projection.contour.length >= 3) {
    projection.contour.forEach((point, index) => {
      const x = point.x * frame.width
      const y = point.y * frame.height
      if (index === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
    })
    context.closePath()
  } else {
    const rect = projection.clippedRect
    const x = rect.xMin * frame.width
    const y = rect.yMin * frame.height
    const width = Math.max(0, rect.xMax - rect.xMin) * frame.width
    const height = Math.max(0, rect.yMax - rect.yMin) * frame.height
    context.rect(x, y, width, height)
  }
  context.clip()
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

function projectOverlayWorldContoursToCanvas(
  overlayRegion: MprSegmentationOverlayRegion,
  plane: MprPlaneInfo,
  frame: OverlayImageFrame,
  transform?: ViewTransformInfo | null
): Array<Array<{ x: number; y: number }>> {
  return (overlayRegion.contourWorldPoints ?? [])
    .map((contour) =>
      overlayWorldPointsToVec3(contour)
        .map((worldPoint) => {
          const projected = worldPointToCanvasNormalized(plane, worldPoint, frame, transform)
          return {
            x: projected.x * frame.width,
            y: projected.y * frame.height
          }
        })
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    )
    .filter((contour) => contour.length >= 3)
}

function drawHighlightContours(
  context: CanvasRenderingContext2D,
  thresholdRegion: MprThresholdRegion,
  contours: Array<Array<{ x: number; y: number }>>
): void {
  if (!contours.length) {
    return
  }
  context.beginPath()
  for (const contour of contours) {
    drawSmoothClosedContour(context, contour)
  }
  context.fillStyle = thresholdRegion.color
  context.globalAlpha = 0.18
  context.fill('evenodd')
  context.globalAlpha = 0.96
  context.strokeStyle = thresholdRegion.color
  context.lineWidth = 1.8
  context.lineJoin = 'round'
  context.lineCap = 'round'
  context.stroke()
}

function prepareHighlightCanvas(canvas: HTMLCanvasElement, frame: OverlayImageFrame): CanvasRenderingContext2D | null {
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
    return null
  }
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  context.clearRect(0, 0, frame.width, frame.height)
  return context
}

function clearHighlightCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) {
    return
  }
  const context = canvas.getContext('2d')
  context?.clearRect(0, 0, canvas.width, canvas.height)
}

function drawHighlightCanvasLayer(canvas: HTMLCanvasElement | null, includeRegion: (regionId: string) => boolean): void {
  const plane = props.mprPlane
  const overlay = props.segmentationOverlay
  const frame = props.imageFrame
  if (!canvas || !plane || frame.width <= 1 || frame.height <= 1) {
    clearHighlightCanvas(canvas)
    return
  }

  const context = prepareHighlightCanvas(canvas, frame)
  if (!context) {
    return
  }

  if (!normalizedConfig.value.enabled) {
    return
  }

  const regionsById = new Map(normalizedConfig.value.thresholdRegions.map((region) => [region.id, region]))
  const projectionsByRegionId = new Map(regionProjections.value.map((item) => [item.region.id, item.projection]))
  const projectSourcePixel = createSourcePixelProjector(plane, frame, props.viewportTransform)

  for (const overlayRegion of overlay?.regions ?? []) {
    if (!includeRegion(overlayRegion.regionId)) {
      continue
    }
    const region = regionsById.get(overlayRegion.regionId)
    if (!region?.enabled) {
      continue
    }
    const currentProjection = projectionsByRegionId.get(region.id)
    if (!currentProjection?.visible || !currentProjection.intersectsPlane) {
      continue
    }
    const worldContours = projectOverlayWorldContoursToCanvas(
      overlayRegion,
      plane,
      frame,
      props.viewportTransform
    )
    if (worldContours.length) {
      context.save()
      clipHighlightToProjection(context, currentProjection, frame)
      drawHighlightContours(context, region, worldContours)
      context.restore()
      continue
    }
    const points = overlayRegion.samples?.points ?? []
    if (points.length < 3) {
      continue
    }
    const thresholdHu = getPreviewThresholdHu(region, overlayRegion)
    const sampleCount = Math.floor(points.length / 3)
    const sampledCount = Number(overlayRegion.samples?.sampledCount ?? sampleCount)
    const totalCount = Number(overlayRegion.samples?.totalCount ?? sampleCount)
    const hasCompleteMask = Number.isFinite(sampledCount) && Number.isFinite(totalCount) && sampledCount >= totalCount
    if (!hasCompleteMask) {
      continue
    }
    const { clippedRect } = currentProjection
    const qualifiedSamples = new Map<string, { sourceCol: number; sourceRow: number }>()
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
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
      if (
        canvasPoint.x < clippedRect.xMin ||
        canvasPoint.x > clippedRect.xMax ||
        canvasPoint.y < clippedRect.yMin ||
        canvasPoint.y > clippedRect.yMax
      ) {
        continue
      }
      const sourceCol = Math.floor(sourceX)
      const sourceRow = Math.floor(sourceY)
      qualifiedSamples.set(`${sourceCol}:${sourceRow}`, { sourceCol, sourceRow })
    }
    if (!qualifiedSamples.size) {
      continue
    }

    const contours = traceQualifiedSampleContours(qualifiedSamples)
    if (contours.length) {
      context.save()
      clipHighlightToProjection(context, currentProjection, frame)
      drawHighlightContours(
        context,
        region,
        contours.map((contour) =>
          contour.map((point) => {
            const projected = projectSourcePixel(point.x, point.y)
            return {
              x: projected.x * frame.width,
              y: projected.y * frame.height
            }
          })
        )
      )
      context.restore()
    }
  }
  context.globalAlpha = 1
}

function drawStableHighlightCanvas(): void {
  const activeRegionId = activeThresholdRegionId.value
  drawHighlightCanvasLayer(stableHighlightCanvasRef.value, (regionId) => regionId !== activeRegionId)
}

function drawActiveHighlightCanvas(): void {
  const activeRegionId = activeThresholdRegionId.value
  if (!activeRegionId) {
    clearHighlightCanvas(activeHighlightCanvasRef.value)
    return
  }
  drawHighlightCanvasLayer(activeHighlightCanvasRef.value, (regionId) => regionId === activeRegionId)
}

function scheduleStableHighlightCanvasDraw(): void {
  if (stableHighlightRenderRaf != null || typeof window === 'undefined') {
    return
  }
  stableHighlightRenderRaf = window.requestAnimationFrame(() => {
    stableHighlightRenderRaf = null
    drawStableHighlightCanvas()
  })
}

function scheduleActiveHighlightCanvasDraw(): void {
  if (activeHighlightRenderRaf != null || typeof window === 'undefined') {
    return
  }
  activeHighlightRenderRaf = window.requestAnimationFrame(() => {
    activeHighlightRenderRaf = null
    drawActiveHighlightCanvas()
  })
}

watch(
  [
    activeThresholdRegionId,
    stableHighlighterConfigSignature,
    stableHighlighterOverlaySignature,
    highlighterFrameSignature,
    highlighterPlaneSignature,
    highlighterTransformSignature
  ],
  (_currentValues, previousValues) => {
    const activeRegionId = activeThresholdRegionId.value
    const previousActiveRegionId = Array.isArray(previousValues) ? previousValues[0] : null
    if (activeRegionId && previousActiveRegionId === activeRegionId) {
      return
    }
    void nextTick(scheduleStableHighlightCanvasDraw)
  },
  { immediate: true }
)

watch(
  [
    activeThresholdRegionId,
    activeHighlighterConfigSignature,
    activeHighlighterOverlaySignature,
    highlighterFrameSignature,
    highlighterPlaneSignature,
    highlighterTransformSignature
  ],
  () => {
    void nextTick(scheduleActiveHighlightCanvasDraw)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (stableHighlightRenderRaf != null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(stableHighlightRenderRaf)
  }
  if (activeHighlightRenderRaf != null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(activeHighlightRenderRaf)
  }
  stableHighlightRenderRaf = null
  activeHighlightRenderRaf = null
  consumedPointerId.value = null
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
  return {
    id: `threshold-${Date.now()}-${regionSequence}`,
    label: ''
  }
}

function getThresholdCreationDefaults(): ThresholdCreationDefaults {
  const selected = selectedRegion.value
  if (isPetSegmentation.value) {
    const selectedIsPetMode = selected?.thresholdMode === 'absolute' || selected?.thresholdMode === 'percentMax'
    const selectedThresholdValue = Number(selected?.thresholdValue)
    const selectedPercentMax = Number(selected?.thresholdPercentMax)
    return {
      thresholdHu: 0,
      thresholdValue: selectedIsPetMode && Number.isFinite(selectedThresholdValue)
        ? Math.max(0, selectedThresholdValue)
        : 0,
      thresholdMode: selectedIsPetMode ? selected.thresholdMode : 'percentMax',
      thresholdPercentMax: Number.isFinite(selectedPercentMax)
        ? Math.max(0, Math.min(100, selectedPercentMax))
        : 40,
      thresholdPercentile: 80
    }
  }
  return {
    thresholdHu: selected?.thresholdHu ?? DEFAULT_MPR_SEGMENTATION_THRESHOLD_HU,
    thresholdValue: selected?.thresholdValue ?? selected?.thresholdHu ?? DEFAULT_MPR_SEGMENTATION_THRESHOLD_HU,
    thresholdMode: selected?.thresholdMode ?? 'hu',
    thresholdPercentMax: selected?.thresholdPercentMax ?? 40,
    thresholdPercentile: selected?.thresholdPercentile ?? 80
  }
}

function nextVoiIdentity(): { id: string; label: string } {
  voiSequence += 1
  return {
    id: `voi-${Date.now()}-${voiSequence}`,
    label: ''
  }
}

function resolveDragConfigActionType(actionType: 'move' | 'end'): MprSegmentationConfigActionType {
  return actionType === 'move' ? 'local' : 'end'
}

function emitConfig(config: MprSegmentationConfig, actionType: MprSegmentationConfigActionType = 'end'): void {
  const normalized = normalizeMprSegmentationConfig(config)
  draftConfig.value = normalized
  emit('configChange', normalized, actionType)
}

function completeSegmentationEdit(actionType: MprSegmentationConfigActionType = 'select'): void {
  const current = normalizedConfig.value
  if (current.selectedRegionId == null && !current.selectedVoi && current.selectedVoiId == null) {
    return
  }
  emitConfig(
    {
      ...current,
      selectedRegionId: null,
      selectedVoi: false,
      selectedVoiId: null,
      voiSphere: resolveMprLegacyVoiSphere(current.voiSpheres, null)
    },
    actionType
  )
}

function upsertRegion(region: MprThresholdRegion, actionType: MprSegmentationConfigActionType): void {
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

function removeThresholdRegion(regionId: string, actionType: MprSegmentationConfigActionType = 'end'): void {
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
  const region = normalizedConfig.value.thresholdRegions.find((candidate) => candidate.id === regionId)
  emit('modeChange', 'segmentation:threshold', region?.box.sourceViewport ?? null)
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

function removeVoiSphere(sphereId: string, actionType: MprSegmentationConfigActionType = 'end'): void {
  const current = normalizedConfig.value
  if (!current.voiSpheres.some((candidate) => candidate.id === sphereId)) {
    return
  }
  const nextSpheres = current.voiSpheres.filter((candidate) => candidate.id !== sphereId)
  const isDeletingSelectedVoi = current.selectedVoiId === sphereId
  const selectedSphere = resolveMprLegacyVoiSphere(
    nextSpheres,
    isDeletingSelectedVoi ? nextSpheres[0]?.id ?? null : current.selectedVoiId
  )
  emitConfig(
    {
      ...current,
      selectedRegionId: isDeletingSelectedVoi ? null : current.selectedRegionId,
      selectedVoi: selectedSphere !== null,
      selectedVoiId: selectedSphere?.id ?? null,
      voiSpheres: nextSpheres,
      voiSphere: selectedSphere
    },
    actionType
  )
}

function upsertVoiSphere(
  sphere: MprVoiSphere,
  actionType: MprSegmentationConfigActionType,
  selected: boolean
): void {
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
      voiSphere: resolveMprLegacyVoiSphere(nextSpheres, selected ? sphere.id : null)
    },
    actionType
  )
}

function beginDrag(event: PointerEvent, state: DragState): void {
  event.preventDefault()
  event.stopPropagation()
  consumedPointerId.value = null
  dragState.value = state
  overlayRef.value?.setPointerCapture(event.pointerId)
}

function beginConsumedPointer(event: PointerEvent): void {
  event.preventDefault()
  event.stopPropagation()
  consumedPointerId.value = event.pointerId
  overlayRef.value?.setPointerCapture(event.pointerId)
}

function endConsumedPointer(event: PointerEvent): boolean {
  if (consumedPointerId.value !== event.pointerId) {
    return false
  }
  event.preventDefault()
  event.stopPropagation()
  overlayRef.value?.releasePointerCapture(event.pointerId)
  consumedPointerId.value = null
  return true
}

function notifySegmentationLimitReached(kind: 'threshold' | 'voi'): void {
  const message = kind === 'threshold'
    ? (isZh.value
        ? `最多支持 ${MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS} 个阈值分割。`
        : `Up to ${MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS} threshold regions are supported.`)
    : (isZh.value
        ? `最多支持 ${MPR_SEGMENTATION_MAX_VOI_SPHERES} 个 VOI。`
        : `Up to ${MPR_SEGMENTATION_MAX_VOI_SPHERES} VOI spheres are supported.`)
  dispatchWorkspaceStatusToast(message, 'warning')
}

function beginCreate(event: PointerEvent): void {
  event.preventDefault()
  event.stopPropagation()
  const point = getPoint(event)
  const plane = props.mprPlane
  const viewportKey = mprViewportKey.value
  if (!point || !plane || !viewportKey || !canInteract.value) {
    beginConsumedPointer(event)
    completeSegmentationEdit('select')
    return
  }
  const sourcePoint = getSourcePoint(point)
  if (!isSourcePointInsideImage(sourcePoint)) {
    beginConsumedPointer(event)
    completeSegmentationEdit('select')
    return
  }
  if (canEditThreshold.value) {
    if (normalizedConfig.value.thresholdRegions.length >= MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS) {
      notifySegmentationLimitReached('threshold')
      beginConsumedPointer(event)
      completeSegmentationEdit('select')
      return
    }
    const identity = nextRegionIdentity()
    const thresholdDefaults = getThresholdCreationDefaults()
    beginDrag(event, {
      kind: 'create-threshold',
      pointerId: event.pointerId,
      anchor: point,
      regionId: identity.id,
      label: identity.label,
      ...thresholdDefaults,
      color: selectedRegion.value?.color ?? props.defaultThresholdColor,
      depthMm: null
    })
    return
  }
  if (canCreateOrSelectVoi.value) {
    if (normalizedConfig.value.voiSpheres.length >= MPR_SEGMENTATION_MAX_VOI_SPHERES) {
      notifySegmentationLimitReached('voi')
      beginConsumedPointer(event)
      completeSegmentationEdit('select')
      return
    }
    const identity = nextVoiIdentity()
    beginDrag(event, {
      kind: 'create-voi',
      pointerId: event.pointerId,
      center: point,
      sphereId: identity.id,
      label: identity.label,
      color: props.defaultVoiColor
    })
  }
}

function beginMoveThreshold(event: PointerEvent, item: RegionProjectionItem): void {
  const point = getPoint(event)
  const region = item.interactionRegion
  const plane = props.mprPlane
  if (!point || !plane || !canSelectExistingSegmentation.value || region.box.sourceViewport !== mprViewportKey.value) {
    return
  }
  if (region.id !== normalizedConfig.value.selectedRegionId || !isThresholdMode.value) {
    event.preventDefault()
    event.stopPropagation()
    selectRegion(region.id, 'select')
    return
  }
  if (!canEditThreshold.value) {
    return
  }
  selectRegion(region.id, 'select')
  beginDrag(event, {
    kind: 'move-threshold',
    pointerId: event.pointerId,
    anchorWorld: canvasNormalizedPointToWorld(plane, point, props.imageFrame, props.viewportTransform),
    region,
    baseBox: region.box,
    previewProjection: item.projection,
    changed: false
  })
}

function beginResizeThreshold(event: PointerEvent, handle: ThresholdResizeHandle): void {
  const point = getPoint(event)
  const plane = props.mprPlane
  const selectedProjection = selectedRegionProjection.value
  if (!point || !plane || !selectedProjection || !canEditThreshold.value) {
    return
  }
  const region = selectedProjection.interactionRegion
  if (region.box.sourceViewport !== mprViewportKey.value) {
    return
  }
  beginDrag(event, {
    kind: 'resize-threshold',
    pointerId: event.pointerId,
    anchorWorld: canvasNormalizedPointToWorld(plane, point, props.imageFrame, props.viewportTransform),
    region,
    handle,
    baseBox: region.box,
    previewProjection: selectedProjection.projection,
    changed: false
  })
}

function beginMoveVoi(event: PointerEvent): void {
  const point = getPoint(event)
  const target = (event.currentTarget as SVGElement | null)?.dataset.voiId
  const sphere = normalizedConfig.value.voiSpheres.find((candidate) => candidate.id === target)
  if (!point || !sphere || !canSelectExistingSegmentation.value) {
    return
  }
  if (sphere.id !== normalizedConfig.value.selectedVoiId || !isVoiMode.value || !canCreateOrSelectVoi.value) {
    event.preventDefault()
    event.stopPropagation()
    selectVoi(sphere.id, 'select')
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

function scaleVec3(vector: Vec3, scalar: number): Vec3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
}

function dotVec3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function vec3Length(value: Vec3): number {
  return Math.sqrt(value[0] * value[0] + value[1] * value[1] + value[2] * value[2])
}

function translateThresholdRegionBoxByWorldDelta(
  box: MprThresholdRegionBox,
  deltaWorld: Vec3
): MprThresholdRegionBox {
  return {
    ...box,
    centerWorld: addVec3(box.centerWorld, deltaWorld)
  }
}

function getThresholdResizeHandleSigns(handle: ThresholdResizeHandle): { col: number; row: number } {
  if (handle === 'nw') {
    return { col: -1, row: -1 }
  }
  if (handle === 'ne') {
    return { col: 1, row: -1 }
  }
  if (handle === 'se') {
    return { col: 1, row: 1 }
  }
  return { col: -1, row: 1 }
}

function resizeThresholdRegionBoxByWorldPoint(
  box: MprThresholdRegionBox,
  handle: ThresholdResizeHandle,
  draggedWorld: Vec3
): MprThresholdRegionBox {
  const handleSigns = getThresholdResizeHandleSigns(handle)
  const fixedWorld = addVec3(
    addVec3(
      box.centerWorld,
      scaleVec3(box.colWorld, -handleSigns.col * box.widthMm / 2)
    ),
    scaleVec3(box.rowWorld, -handleSigns.row * box.heightMm / 2)
  )
  const fixedToDragged = subVec3(draggedWorld, fixedWorld)
  const widthMm = Math.max(MIN_THRESHOLD_REGION_MM, Math.abs(dotVec3(fixedToDragged, box.colWorld)))
  const heightMm = Math.max(MIN_THRESHOLD_REGION_MM, Math.abs(dotVec3(fixedToDragged, box.rowWorld)))
  return {
    ...box,
    centerWorld: addVec3(
      addVec3(
        fixedWorld,
        scaleVec3(box.colWorld, handleSigns.col * widthMm / 2)
      ),
      scaleVec3(box.rowWorld, handleSigns.row * heightMm / 2)
    ),
    widthMm,
    heightMm
  }
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
        thresholdValue: state.thresholdValue,
        thresholdMode: state.thresholdMode,
        thresholdPercentMax: state.thresholdPercentMax,
        thresholdPercentile: state.thresholdPercentile,
        color: state.color,
        depthMm: state.depthMm ?? estimateThresholdRegionDefaultDepthMm(plane, rect)
      }
    )
    if (actionType === 'end' && isThresholdRegionBelowMinimum(plane, rect, region)) {
      if (normalizedConfig.value.thresholdRegions.some((candidate) => candidate.id === state.regionId)) {
        removeThresholdRegion(state.regionId, 'end')
      } else {
        completeSegmentationEdit('select')
      }
      return
    }
    upsertRegion(region, resolveDragConfigActionType(actionType))
    return
  }

  if (state.kind === 'move-threshold') {
    const currentWorld = canvasNormalizedPointToWorld(plane, point, props.imageFrame, props.viewportTransform)
    const deltaWorld = subVec3(currentWorld, state.anchorWorld)
    if (!state.changed && vec3Length(deltaWorld) <= SEGMENTATION_DRAG_EPSILON) {
      return
    }
    const nextBox = translateThresholdRegionBoxByWorldDelta(state.baseBox, deltaWorld)
    const nextProjection = projectThresholdRegionBoxToCanvasPlane(
      nextBox,
      plane,
      props.imageFrame,
      props.viewportTransform
    )
    state.changed = true
    state.previewProjection = nextProjection
    setPendingThresholdDisplayBox(state.region.id, nextBox)
    upsertRegion(
      {
        ...state.region,
        box: nextBox,
        stats: null
      },
      resolveDragConfigActionType(actionType)
    )
    return
  }

  if (state.kind === 'resize-threshold') {
    const currentWorld = canvasNormalizedPointToWorld(plane, point, props.imageFrame, props.viewportTransform)
    const deltaWorld = subVec3(currentWorld, state.anchorWorld)
    if (!state.changed && vec3Length(deltaWorld) <= SEGMENTATION_DRAG_EPSILON) {
      return
    }
    const nextRegion = clampThresholdRegionMinimumSize({
      ...state.region,
      box: resizeThresholdRegionBoxByWorldPoint(state.baseBox, state.handle, currentWorld),
      stats: null
    })
    const nextProjection = projectThresholdRegionBoxToCanvasPlane(
      nextRegion.box,
      plane,
      props.imageFrame,
      props.viewportTransform
    )
    state.changed = true
    state.previewProjection = nextProjection
    setPendingThresholdDisplayBox(state.region.id, nextRegion.box)
    upsertRegion(nextRegion, resolveDragConfigActionType(actionType))
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
      if (normalizedConfig.value.voiSpheres.some((candidate) => candidate.id === state.sphereId)) {
        removeVoiSphere(state.sphereId, 'end')
      } else {
        completeSegmentationEdit('select')
      }
      return
    }
    upsertVoiSphere(
      nextSphere,
      resolveDragConfigActionType(actionType),
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
      resolveDragConfigActionType(actionType),
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
    resolveDragConfigActionType(actionType),
    true
  )
}

function handlePointerMove(event: PointerEvent): void {
  if (consumedPointerId.value === event.pointerId) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if (!dragState.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateDrag(event, 'move')
}

function endDrag(event: PointerEvent): void {
  if (endConsumedPointer(event)) {
    return
  }
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
  if (item.region.id !== normalizedConfig.value.selectedRegionId || !isThresholdMode.value) {
    selectRegion(item.region.id, 'select')
    return
  }
  if (item.editableGeometry) {
    beginMoveThreshold(event, item)
    return
  }
  selectRegion(item.region.id, 'select')
}
</script>

<template>
  <div
    v-if="shouldRender"
    ref="overlayRef"
    class="absolute z-[3]"
    :class="canInteract ? 'cursor-crosshair' : canReceivePointerEvents ? '' : 'pointer-events-none'"
    :style="overlayStyle"
    data-testid="viewport-segmentation-overlay"
    @pointermove="handlePointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <canvas
      ref="stableHighlightCanvasRef"
      class="pointer-events-none absolute inset-0 h-full w-full"
      data-testid="viewport-segmentation-highlight"
    ></canvas>
    <canvas
      ref="activeHighlightCanvasRef"
      class="pointer-events-none absolute inset-0 h-full w-full"
      data-testid="viewport-segmentation-active-highlight"
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
        v-for="item in backgroundRegionProjections"
        :key="item.region.id"
      >
        <polygon
          v-if="regionProjectionUsesPolygon(item)"
          class="transition-colors"
          :points="projectionSvgPoints(item.projection)"
          :data-region-id="item.region.id"
          :fill="item.region.id === normalizedConfig.selectedRegionId ? hexToRgba(item.region.color, 0.12) : 'transparent'"
          :stroke="item.region.color"
          :stroke-width="item.region.id === normalizedConfig.selectedRegionId ? 2.25 : 1.5"
          :stroke-dasharray="thresholdGuideDasharray(item.projection)"
          vector-effect="non-scaling-stroke"
          :pointer-events="canSelectExistingSegmentation ? 'all' : 'none'"
          @pointerdown="handleThresholdRegionPointerDown($event, item)"
        />
        <rect
          v-else
          class="transition-colors"
          v-bind="rectSvgStyle(item.projection.clippedRect)"
          :data-region-id="item.region.id"
          :fill="item.region.id === normalizedConfig.selectedRegionId ? hexToRgba(item.region.color, 0.12) : 'transparent'"
          :stroke="item.region.color"
          :stroke-width="item.region.id === normalizedConfig.selectedRegionId ? 2.25 : 1.5"
          :stroke-dasharray="thresholdGuideDasharray(item.projection)"
          vector-effect="non-scaling-stroke"
          :pointer-events="canSelectExistingSegmentation ? 'all' : 'none'"
          @pointerdown="handleThresholdRegionPointerDown($event, item)"
        />
      </g>

      <ellipse
        v-for="item in backgroundSphereProjections"
        :key="item.sphere.id"
        class="transition-colors"
        :class="[
          canSelectExistingSegmentation ? (item.selected && isVoiMode ? 'cursor-move' : 'cursor-pointer') : ''
        ]"
        :data-voi-id="item.sphere.id"
        :cx="`${item.projection.center.x * 100}%`"
        :cy="`${item.projection.center.y * 100}%`"
        :rx="`${item.projection.radiusX * 100}%`"
        :ry="`${item.projection.radiusY * 100}%`"
        :fill="item.selected ? hexToRgba(item.sphere.color, 0.12) : 'transparent'"
        :stroke="item.sphere.color"
        :stroke-width="item.selected ? 2.25 : (item.projection.intersectsPlane ? 1.75 : 1.5)"
        :stroke-dasharray="item.projection.intersectsPlane ? undefined : '5 5'"
        vector-effect="non-scaling-stroke"
        :pointer-events="canSelectExistingSegmentation ? 'all' : 'none'"
        @pointerdown="beginMoveVoi"
      />

      <polygon
        v-if="selectedRegionProjection && regionProjectionUsesPolygon(selectedRegionProjection)"
        class="transition-colors"
        :points="projectionSvgPoints(selectedRegionProjection.projection)"
        :data-region-id="selectedRegionProjection.region.id"
        :fill="hexToRgba(selectedRegionProjection.region.color, 0.12)"
        :stroke="selectedRegionProjection.region.color"
        stroke-width="2.25"
        :stroke-dasharray="thresholdGuideDasharray(selectedRegionProjection.projection)"
        vector-effect="non-scaling-stroke"
        :pointer-events="canSelectExistingSegmentation ? 'all' : 'none'"
        @pointerdown="handleThresholdRegionPointerDown($event, selectedRegionProjection)"
      />
      <rect
        v-else-if="selectedRegionProjection"
        class="transition-colors"
        v-bind="rectSvgStyle(selectedRegionProjection.projection.clippedRect)"
        :data-region-id="selectedRegionProjection.region.id"
        :fill="hexToRgba(selectedRegionProjection.region.color, 0.12)"
        :stroke="selectedRegionProjection.region.color"
        stroke-width="2.25"
        :stroke-dasharray="thresholdGuideDasharray(selectedRegionProjection.projection)"
        vector-effect="non-scaling-stroke"
        :pointer-events="canSelectExistingSegmentation ? 'all' : 'none'"
        @pointerdown="handleThresholdRegionPointerDown($event, selectedRegionProjection)"
      />
      <circle
        v-for="point in selectedHandles"
        :key="point.handle"
        class="stroke-slate-950"
        :class="canEditThreshold ? 'cursor-nwse-resize' : ''"
        :cx="`${point.x * 100}%`"
        :cy="`${point.y * 100}%`"
        :fill="selectedRegionProjection?.region.color ?? '#bef264'"
        r="4.5"
        stroke-width="1.5"
	        vector-effect="non-scaling-stroke"
	        :pointer-events="canEditThreshold ? 'all' : 'none'"
	        :data-handle="point.handle"
	        @pointerdown="beginResizeThreshold($event, point.handle)"
	      />

      <ellipse
        v-if="selectedSphereProjection"
        class="transition-colors"
        :class="canCreateOrSelectVoi ? 'cursor-move' : ''"
        :data-voi-id="selectedSphereProjection.sphere.id"
        :cx="`${selectedSphereProjection.projection.center.x * 100}%`"
        :cy="`${selectedSphereProjection.projection.center.y * 100}%`"
        :rx="`${selectedSphereProjection.projection.radiusX * 100}%`"
        :ry="`${selectedSphereProjection.projection.radiusY * 100}%`"
        :fill="hexToRgba(selectedSphereProjection.sphere.color, 0.12)"
        :stroke="selectedSphereProjection.sphere.color"
        stroke-width="2.25"
        :stroke-dasharray="selectedSphereProjection.projection.intersectsPlane ? undefined : '5 5'"
        vector-effect="non-scaling-stroke"
        :pointer-events="canSelectExistingSegmentation ? 'all' : 'none'"
        @pointerdown="beginMoveVoi"
      />
      <circle
        v-for="point in sphereHandles"
        :key="`sphere-${point.handle}`"
        class="stroke-slate-950"
        :class="canEditSelectedVoi ? 'cursor-nwse-resize' : ''"
        :cx="`${point.x * 100}%`"
        :cy="`${point.y * 100}%`"
        :fill="selectedSphereProjection?.sphere.color ?? '#a5f3fc'"
        r="4.5"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        :pointer-events="canEditSelectedVoi ? 'all' : 'none'"
        @pointerdown="beginResizeVoi"
      />
    </svg>
  </div>
</template>
