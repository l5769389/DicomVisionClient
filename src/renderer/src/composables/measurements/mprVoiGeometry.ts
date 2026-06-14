import type {
  MprPlaneInfo,
  MprThresholdRegion,
  MprThresholdRegionBox,
  MprVoiSphere,
  MprViewportKey,
  ViewTransformInfo,
  Vec3
} from '../../types/viewer'

export type ThresholdResizeHandle = 'nw' | 'ne' | 'se' | 'sw'

export interface NormalizedImagePoint {
  x: number
  y: number
}

export interface NormalizedImageRect {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface ThresholdResizeHandlePoint {
  handle: ThresholdResizeHandle
  point: NormalizedImagePoint
}

export interface ThresholdRegionProjection {
  rect: NormalizedImageRect
  clippedRect: NormalizedImageRect
  handles: ThresholdResizeHandlePoint[]
  intersectsPlane: boolean
  visible: boolean
}

export interface VoiSphereProjection {
  center: NormalizedImagePoint
  radiusX: number
  radiusY: number
  distanceToPlaneMm: number
  intersectsPlane: boolean
  visible: boolean
}

const MIN_REGION_RECT_SIZE = 0.01
const NORMALIZED_PRECISION = 1_000_000
const WORLD_PRECISION = 1_000

type Matrix3 = [[number, number, number], [number, number, number], [number, number, number]]

export interface RenderedCanvasFrame {
  width: number
  height: number
  naturalWidth?: number
  naturalHeight?: number
}

function roundNormalized(value: number): number {
  return Math.round(value * NORMALIZED_PRECISION) / NORMALIZED_PRECISION
}

function roundWorld(value: number): number {
  return Math.round(value * WORLD_PRECISION) / WORLD_PRECISION
}

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return roundNormalized(Math.max(0, Math.min(1, value)))
}

function normalizeRect(rect: NormalizedImageRect): NormalizedImageRect {
  const xA = clampUnit(rect.xMin)
  const xB = clampUnit(rect.xMax)
  const yA = clampUnit(rect.yMin)
  const yB = clampUnit(rect.yMax)
  return {
    xMin: Math.min(xA, xB),
    xMax: Math.max(xA, xB),
    yMin: Math.min(yA, yB),
    yMax: Math.max(yA, yB)
  }
}

export function normalizeImageRectFromPoints(
  anchor: NormalizedImagePoint,
  current: NormalizedImagePoint
): NormalizedImageRect {
  const rect = normalizeRect({
    xMin: anchor.x,
    xMax: current.x,
    yMin: anchor.y,
    yMax: current.y
  })
  const width = rect.xMax - rect.xMin
  const height = rect.yMax - rect.yMin
  if (width >= MIN_REGION_RECT_SIZE && height >= MIN_REGION_RECT_SIZE) {
    return rect
  }
  const centerX = (rect.xMin + rect.xMax) / 2
  const centerY = (rect.yMin + rect.yMax) / 2
  const halfWidth = Math.max(width, MIN_REGION_RECT_SIZE) / 2
  const halfHeight = Math.max(height, MIN_REGION_RECT_SIZE) / 2
  return normalizeRect({
    xMin: centerX - halfWidth,
    xMax: centerX + halfWidth,
    yMin: centerY - halfHeight,
    yMax: centerY + halfHeight
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

function roundVec3(vector: Vec3): Vec3 {
  return [roundWorld(vector[0]), roundWorld(vector[1]), roundWorld(vector[2])]
}

function planeWidthMm(plane: MprPlaneInfo): number {
  return Math.max(1, Number(plane.outputShape?.[1] ?? 1)) * Math.max(1e-6, plane.pixelSpacingColMm)
}

function planeHeightMm(plane: MprPlaneInfo): number {
  return Math.max(1, Number(plane.outputShape?.[0] ?? 1)) * Math.max(1e-6, plane.pixelSpacingRowMm)
}

function sourceImageWidth(plane: MprPlaneInfo): number {
  return Math.max(1, Number(plane.outputShape?.[1] ?? 1))
}

function sourceImageHeight(plane: MprPlaneInfo): number {
  return Math.max(1, Number(plane.outputShape?.[0] ?? 1))
}

function canvasWidth(frame: RenderedCanvasFrame): number {
  return Math.max(1, Number(frame.naturalWidth || frame.width || 1))
}

function canvasHeight(frame: RenderedCanvasFrame): number {
  return Math.max(1, Number(frame.naturalHeight || frame.height || 1))
}

function normalizeMatrix3(value: MprPlaneInfo['imageToCanvasMatrix']): Matrix3 | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null
  }
  const matrix = value.map((row) => (
    Array.isArray(row) && row.length === 3
      ? [Number(row[0]), Number(row[1]), Number(row[2])]
      : [Number.NaN, Number.NaN, Number.NaN]
  )) as Matrix3
  return matrix.every((row) => row.every((entry) => Number.isFinite(entry))) ? matrix : null
}

function invertMatrix3(matrix: Matrix3): Matrix3 | null {
  const [
    [a, b, c],
    [d, e, f],
    [g, h, i]
  ] = matrix
  const determinant =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g)
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= 1e-9) {
    return null
  }
  const inverseDeterminant = 1 / determinant
  return [
    [(e * i - f * h) * inverseDeterminant, (c * h - b * i) * inverseDeterminant, (b * f - c * e) * inverseDeterminant],
    [(f * g - d * i) * inverseDeterminant, (a * i - c * g) * inverseDeterminant, (c * d - a * f) * inverseDeterminant],
    [(d * h - e * g) * inverseDeterminant, (b * g - a * h) * inverseDeterminant, (a * e - b * d) * inverseDeterminant]
  ]
}

function applyMatrix3(matrix: Matrix3, x: number, y: number): NormalizedImagePoint {
  const w = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2]
  const denominator = Math.abs(w) > 1e-9 ? w : 1
  return {
    x: (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2]) / denominator,
    y: (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]) / denominator
  }
}

function normalizeRotationDegrees(rotationDegrees: number | null | undefined): number {
  const numericValue = Number(rotationDegrees ?? 0)
  if (!Number.isFinite(numericValue)) {
    return 0
  }
  return ((Math.round(numericValue / 90) * 90) % 360 + 360) % 360
}

function getTransformValues(transform?: ViewTransformInfo | null) {
  const zoom = Number(transform?.zoom ?? 1)
  return {
    rotationDegrees: normalizeRotationDegrees(transform?.rotationDegrees ?? 0),
    horFlip: Boolean(transform?.horFlip),
    verFlip: Boolean(transform?.verFlip),
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1,
    offsetX: Number.isFinite(Number(transform?.offsetX)) ? Number(transform?.offsetX) : 0,
    offsetY: Number.isFinite(Number(transform?.offsetY)) ? Number(transform?.offsetY) : 0
  }
}

function getCanvasTransformMetrics(
  plane: MprPlaneInfo,
  frame: RenderedCanvasFrame,
  transform?: ViewTransformInfo | null
) {
  const resolved = getTransformValues(transform)
  const radians = resolved.rotationDegrees * Math.PI / 180
  const zoom = resolved.zoom
  return {
    sourceWidth: sourceImageWidth(plane),
    sourceHeight: sourceImageHeight(plane),
    targetWidth: canvasWidth(frame),
    targetHeight: canvasHeight(frame),
    scaleX: (resolved.horFlip ? -zoom : zoom) * Math.max(1e-6, plane.pixelSpacingColMm),
    scaleY: (resolved.verFlip ? -zoom : zoom) * Math.max(1e-6, plane.pixelSpacingRowMm),
    cosTheta: Math.cos(radians),
    sinTheta: Math.sin(radians),
    offsetX: resolved.offsetX,
    offsetY: resolved.offsetY
  }
}

export function sourceImagePointToCanvasNormalized(
  plane: MprPlaneInfo,
  point: NormalizedImagePoint,
  frame: RenderedCanvasFrame,
  transform?: ViewTransformInfo | null
): NormalizedImagePoint {
  const matrix = normalizeMatrix3(plane.imageToCanvasMatrix)
  if (matrix) {
    const canvasPoint = applyMatrix3(matrix, point.x * sourceImageWidth(plane), point.y * sourceImageHeight(plane))
    return {
      x: roundNormalized(canvasPoint.x / canvasWidth(frame)),
      y: roundNormalized(canvasPoint.y / canvasHeight(frame))
    }
  }
  const metrics = getCanvasTransformMetrics(plane, frame, transform)
  const sourceX = point.x * metrics.sourceWidth - metrics.sourceWidth / 2
  const sourceY = point.y * metrics.sourceHeight - metrics.sourceHeight / 2
  const scaledX = sourceX * metrics.scaleX
  const scaledY = sourceY * metrics.scaleY
  const canvasX = metrics.cosTheta * scaledX - metrics.sinTheta * scaledY + metrics.targetWidth / 2 + metrics.offsetX
  const canvasY = metrics.sinTheta * scaledX + metrics.cosTheta * scaledY + metrics.targetHeight / 2 + metrics.offsetY
  return {
    x: roundNormalized(canvasX / metrics.targetWidth),
    y: roundNormalized(canvasY / metrics.targetHeight)
  }
}

export function canvasNormalizedPointToSourceImage(
  plane: MprPlaneInfo,
  point: NormalizedImagePoint,
  frame: RenderedCanvasFrame,
  transform?: ViewTransformInfo | null
): NormalizedImagePoint {
  const matrix = normalizeMatrix3(plane.imageToCanvasMatrix)
  const inverse = matrix ? invertMatrix3(matrix) : null
  if (inverse) {
    const sourcePoint = applyMatrix3(inverse, point.x * canvasWidth(frame), point.y * canvasHeight(frame))
    return {
      x: roundNormalized(sourcePoint.x / sourceImageWidth(plane)),
      y: roundNormalized(sourcePoint.y / sourceImageHeight(plane))
    }
  }
  const metrics = getCanvasTransformMetrics(plane, frame, transform)
  const translatedX = point.x * metrics.targetWidth - metrics.targetWidth / 2 - metrics.offsetX
  const translatedY = point.y * metrics.targetHeight - metrics.targetHeight / 2 - metrics.offsetY
  const scaledX = metrics.cosTheta * translatedX + metrics.sinTheta * translatedY
  const scaledY = -metrics.sinTheta * translatedX + metrics.cosTheta * translatedY
  return {
    x: roundNormalized((scaledX / metrics.scaleX + metrics.sourceWidth / 2) / metrics.sourceWidth),
    y: roundNormalized((scaledY / metrics.scaleY + metrics.sourceHeight / 2) / metrics.sourceHeight)
  }
}

export function normalizedImagePointToWorld(plane: MprPlaneInfo, point: NormalizedImagePoint): Vec3 {
  const rowOffsetMm = (clampUnit(point.y) - 0.5) * planeHeightMm(plane)
  const colOffsetMm = (clampUnit(point.x) - 0.5) * planeWidthMm(plane)
  return roundVec3(
    addVec3(
      addVec3(plane.centerWorld as Vec3, scaleVec3(plane.rowWorld as Vec3, rowOffsetMm)),
      scaleVec3(plane.colWorld as Vec3, colOffsetMm)
    )
  )
}

export function worldPointToNormalizedImage(plane: MprPlaneInfo, world: Vec3): NormalizedImagePoint {
  const delta = subVec3(world, plane.centerWorld as Vec3)
  return {
    x: roundNormalized(0.5 + dotVec3(delta, plane.colWorld as Vec3) / planeWidthMm(plane)),
    y: roundNormalized(0.5 + dotVec3(delta, plane.rowWorld as Vec3) / planeHeightMm(plane))
  }
}

export function canvasNormalizedPointToWorld(
  plane: MprPlaneInfo,
  point: NormalizedImagePoint,
  frame: RenderedCanvasFrame,
  transform?: ViewTransformInfo | null
): Vec3 {
  return normalizedImagePointToWorld(plane, canvasNormalizedPointToSourceImage(plane, point, frame, transform))
}

export function worldPointToCanvasNormalized(
  plane: MprPlaneInfo,
  world: Vec3,
  frame: RenderedCanvasFrame,
  transform?: ViewTransformInfo | null
): NormalizedImagePoint {
  return sourceImagePointToCanvasNormalized(plane, worldPointToNormalizedImage(plane, world), frame, transform)
}

export function buildThresholdRegionBoxFromImageRect(
  plane: MprPlaneInfo,
  viewportKey: MprViewportKey,
  rect: NormalizedImageRect,
  depthMm: number
): MprThresholdRegionBox {
  const normalized = normalizeRect(rect)
  const center = normalizedImagePointToWorld(plane, {
    x: (normalized.xMin + normalized.xMax) / 2,
    y: (normalized.yMin + normalized.yMax) / 2
  })
  return {
    centerWorld: center,
    rowWorld: plane.rowWorld as Vec3,
    colWorld: plane.colWorld as Vec3,
    normalWorld: plane.normalWorld as Vec3,
    widthMm: Math.max(0.1, roundWorld((normalized.xMax - normalized.xMin) * planeWidthMm(plane))),
    heightMm: Math.max(0.1, roundWorld((normalized.yMax - normalized.yMin) * planeHeightMm(plane))),
    depthMm: Math.max(0.1, roundWorld(depthMm)),
    sourceViewport: viewportKey
  }
}

export function estimateThresholdRegionDefaultDepthMm(
  plane: MprPlaneInfo,
  rect?: NormalizedImageRect
): number {
  const normalSpacingMm = Number.isFinite(plane.pixelSpacingNormalMm) ? plane.pixelSpacingNormalMm : 1
  if (!rect) {
    return Math.max(0.1, roundWorld(Math.max(normalSpacingMm * 6, 5)))
  }
  const normalized = normalizeRect(rect)
  const rectWidthMm = Math.max(0.1, (normalized.xMax - normalized.xMin) * planeWidthMm(plane))
  const rectHeightMm = Math.max(0.1, (normalized.yMax - normalized.yMin) * planeHeightMm(plane))
  const shorterSideMm = Math.min(rectWidthMm, rectHeightMm)
  const upperBoundMm = Math.max(normalSpacingMm, Math.min(shorterSideMm, 50))
  const candidateMm = Math.max(normalSpacingMm * 6, shorterSideMm * 0.12, 5)
  return Math.max(0.1, roundWorld(Math.max(normalSpacingMm, Math.min(upperBoundMm, candidateMm))))
}

export function createThresholdRegionFromImageRect(
  plane: MprPlaneInfo,
  viewportKey: MprViewportKey,
  rect: NormalizedImageRect,
  options: {
    id: string
    label: string
    thresholdHu: number
    thresholdMode?: MprThresholdRegion['thresholdMode']
    thresholdPercentile?: number
    color: string
    depthMm: number
  }
): MprThresholdRegion {
  return {
    id: options.id,
    enabled: true,
    label: options.label,
    thresholdHu: options.thresholdHu,
    thresholdMode: options.thresholdMode ?? 'hu',
    thresholdPercentile: options.thresholdPercentile ?? 80,
    color: options.color,
    box: buildThresholdRegionBoxFromImageRect(plane, viewportKey, rect, options.depthMm),
    stats: null
  }
}

function getBoxCorners(box: MprThresholdRegionBox): Vec3[] {
  const center = box.centerWorld
  const halfRow = scaleVec3(box.rowWorld, box.heightMm / 2)
  const halfCol = scaleVec3(box.colWorld, box.widthMm / 2)
  const halfNormal = scaleVec3(box.normalWorld, box.depthMm / 2)
  const corners: Vec3[] = []
  for (const rowSign of [-1, 1] as const) {
    for (const colSign of [-1, 1] as const) {
      for (const normalSign of [-1, 1] as const) {
        corners.push(
          addVec3(
            addVec3(addVec3(center, scaleVec3(halfRow, rowSign)), scaleVec3(halfCol, colSign)),
            scaleVec3(halfNormal, normalSign)
          )
        )
      }
    }
  }
  return corners
}

function dedupeWorldPoints(points: Vec3[]): Vec3[] {
  const seen = new Set<string>()
  const result: Vec3[] = []
  for (const point of points) {
    const rounded = roundVec3(point)
    const key = rounded.join(',')
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(rounded)
  }
  return result
}

function getBoxPlaneIntersectionPoints(box: MprThresholdRegionBox, plane: MprPlaneInfo): Vec3[] {
  const corners = getBoxCorners(box)
  const normal = plane.normalWorld as Vec3
  const center = plane.centerWorld as Vec3
  const distances = corners.map((corner) => dotVec3(subVec3(corner, center), normal))
  const edges = [
    [0, 1],
    [0, 2],
    [0, 4],
    [1, 3],
    [1, 5],
    [2, 3],
    [2, 6],
    [3, 7],
    [4, 5],
    [4, 6],
    [5, 7],
    [6, 7]
  ] as const
  const epsilon = 1e-6
  const points: Vec3[] = []

  for (let index = 0; index < corners.length; index += 1) {
    if (Math.abs(distances[index]) <= epsilon) {
      points.push(corners[index])
    }
  }

  for (const [startIndex, endIndex] of edges) {
    const startDistance = distances[startIndex]
    const endDistance = distances[endIndex]
    const start = corners[startIndex]
    const end = corners[endIndex]

    if (Math.abs(startDistance) <= epsilon && Math.abs(endDistance) <= epsilon) {
      points.push(start, end)
      continue
    }
    if (startDistance * endDistance > 0) {
      continue
    }
    const denominator = startDistance - endDistance
    if (Math.abs(denominator) <= epsilon) {
      continue
    }
    const t = startDistance / denominator
    if (t < -epsilon || t > 1 + epsilon) {
      continue
    }
    points.push(addVec3(start, scaleVec3(subVec3(end, start), t)))
  }

  return dedupeWorldPoints(points)
}

function clipRect(rect: NormalizedImageRect): NormalizedImageRect {
  return {
    xMin: clampUnit(rect.xMin),
    xMax: clampUnit(rect.xMax),
    yMin: clampUnit(rect.yMin),
    yMax: clampUnit(rect.yMax)
  }
}

function buildRectHandlePoints(rect: NormalizedImageRect): ThresholdResizeHandlePoint[] {
  return [
    { handle: 'nw', point: { x: rect.xMin, y: rect.yMin } },
    { handle: 'ne', point: { x: rect.xMax, y: rect.yMin } },
    { handle: 'se', point: { x: rect.xMax, y: rect.yMax } },
    { handle: 'sw', point: { x: rect.xMin, y: rect.yMax } }
  ]
}

export function projectThresholdRegionBoxToPlane(
  box: MprThresholdRegionBox,
  plane: MprPlaneInfo
): ThresholdRegionProjection {
  const delta = subVec3(box.centerWorld, plane.centerWorld as Vec3)
  const halfPlaneNormalExtentMm =
    Math.abs(dotVec3(box.rowWorld, plane.normalWorld as Vec3)) * box.heightMm / 2 +
    Math.abs(dotVec3(box.colWorld, plane.normalWorld as Vec3)) * box.widthMm / 2 +
    Math.abs(dotVec3(box.normalWorld, plane.normalWorld as Vec3)) * box.depthMm / 2
  const distanceToPlaneMm = dotVec3(delta, plane.normalWorld as Vec3)
  const intersectsPlane = Math.abs(distanceToPlaneMm) <= halfPlaneNormalExtentMm + 1e-6
  const intersectionPoints = intersectsPlane ? getBoxPlaneIntersectionPoints(box, plane) : []
  if (intersectionPoints.length < 2) {
    const emptyRect = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 }
    return {
      rect: emptyRect,
      clippedRect: emptyRect,
      handles: [],
      intersectsPlane,
      visible: false
    }
  }
  const points = intersectionPoints.map((point) => worldPointToNormalizedImage(plane, point))
  const rect = {
    xMin: Math.min(...points.map((point) => point.x)),
    xMax: Math.max(...points.map((point) => point.x)),
    yMin: Math.min(...points.map((point) => point.y)),
    yMax: Math.max(...points.map((point) => point.y))
  }
  const clippedRect = clipRect(rect)
  const overlapsImage = rect.xMax >= 0 && rect.xMin <= 1 && rect.yMax >= 0 && rect.yMin <= 1
  return {
    rect,
    clippedRect,
    handles: buildRectHandlePoints(clippedRect),
    intersectsPlane,
    visible: intersectsPlane && overlapsImage
  }
}

export function projectThresholdRegionBoxToCanvasPlane(
  box: MprThresholdRegionBox,
  plane: MprPlaneInfo,
  frame: RenderedCanvasFrame,
  transform?: ViewTransformInfo | null
): ThresholdRegionProjection {
  const baseProjection = projectThresholdRegionBoxToPlane(box, plane)
  if (!baseProjection.visible) {
    return {
      ...baseProjection,
      handles: []
    }
  }
  const intersectionPoints = getBoxPlaneIntersectionPoints(box, plane)
  const points = intersectionPoints.map((point) => worldPointToCanvasNormalized(plane, point, frame, transform))
  const rect = {
    xMin: Math.min(...points.map((point) => point.x)),
    xMax: Math.max(...points.map((point) => point.x)),
    yMin: Math.min(...points.map((point) => point.y)),
    yMax: Math.max(...points.map((point) => point.y))
  }
  return {
    rect,
    clippedRect: clipRect(rect),
    handles: baseProjection.handles.map(({ handle, point }) => ({
      handle,
      point: sourceImagePointToCanvasNormalized(plane, point, frame, transform)
    })),
    intersectsPlane: baseProjection.intersectsPlane,
    visible: baseProjection.intersectsPlane && rect.xMax >= 0 && rect.xMin <= 1 && rect.yMax >= 0 && rect.yMin <= 1
  }
}

export function translateThresholdRegionBoxInPlane(
  box: MprThresholdRegionBox,
  plane: MprPlaneInfo,
  delta: NormalizedImagePoint
): MprThresholdRegionBox {
  const deltaWorld = addVec3(
    scaleVec3(plane.colWorld as Vec3, delta.x * planeWidthMm(plane)),
    scaleVec3(plane.rowWorld as Vec3, delta.y * planeHeightMm(plane))
  )
  return {
    ...box,
    centerWorld: roundVec3(addVec3(box.centerWorld, deltaWorld))
  }
}

export function resizeThresholdRegionBoxInPlane(
  region: MprThresholdRegion,
  plane: MprPlaneInfo,
  viewportKey: MprViewportKey,
  handle: ThresholdResizeHandle,
  point: NormalizedImagePoint
): MprThresholdRegion {
  const projection = projectThresholdRegionBoxToPlane(region.box, plane)
  const rect = { ...projection.clippedRect }
  if (handle === 'nw') {
    rect.xMin = point.x
    rect.yMin = point.y
  } else if (handle === 'ne') {
    rect.xMax = point.x
    rect.yMin = point.y
  } else if (handle === 'se') {
    rect.xMax = point.x
    rect.yMax = point.y
  } else {
    rect.xMin = point.x
    rect.yMax = point.y
  }
  return {
    ...region,
    box: buildThresholdRegionBoxFromImageRect(plane, viewportKey, normalizeRect(rect), region.box.depthMm),
    stats: null
  }
}

export function projectVoiSphereToPlane(sphere: MprVoiSphere, plane: MprPlaneInfo): VoiSphereProjection {
  const center = worldPointToNormalizedImage(plane, sphere.centerWorld)
  const delta = subVec3(sphere.centerWorld, plane.centerWorld as Vec3)
  const distanceToPlaneMm = dotVec3(delta, plane.normalWorld as Vec3)
  const radiusMm = Math.max(0.1, sphere.radiusMm)
  const intersectsPlane = Math.abs(distanceToPlaneMm) <= radiusMm
  const displayRadiusMm = intersectsPlane
    ? Math.sqrt(Math.max(0, radiusMm * radiusMm - distanceToPlaneMm * distanceToPlaneMm))
    : radiusMm
  const radiusX = displayRadiusMm / planeWidthMm(plane)
  const radiusY = displayRadiusMm / planeHeightMm(plane)
  return {
    center,
    radiusX,
    radiusY,
    distanceToPlaneMm: roundWorld(distanceToPlaneMm),
    intersectsPlane,
    visible: center.x + radiusX >= 0 && center.x - radiusX <= 1 && center.y + radiusY >= 0 && center.y - radiusY <= 1
  }
}

export function projectVoiSphereToCanvasPlane(
  sphere: MprVoiSphere,
  plane: MprPlaneInfo,
  frame: RenderedCanvasFrame,
  transform?: ViewTransformInfo | null
): VoiSphereProjection {
  const sourceProjection = projectVoiSphereToPlane(sphere, plane)
  const center = sourceImagePointToCanvasNormalized(plane, sourceProjection.center, frame, transform)
  const edgeX = sourceImagePointToCanvasNormalized(
    plane,
    { x: sourceProjection.center.x + sourceProjection.radiusX, y: sourceProjection.center.y },
    frame,
    transform
  )
  const edgeY = sourceImagePointToCanvasNormalized(
    plane,
    { x: sourceProjection.center.x, y: sourceProjection.center.y + sourceProjection.radiusY },
    frame,
    transform
  )
  const radiusX = Math.hypot(edgeX.x - center.x, edgeX.y - center.y)
  const radiusY = Math.hypot(edgeY.x - center.x, edgeY.y - center.y)
  return {
    ...sourceProjection,
    center,
    radiusX,
    radiusY,
    visible: center.x + radiusX >= 0 && center.x - radiusX <= 1 && center.y + radiusY >= 0 && center.y - radiusY <= 1
  }
}

export function createVoiSphereFromImageCircle(
  plane: MprPlaneInfo,
  center: NormalizedImagePoint,
  edge: NormalizedImagePoint,
  color: string
): MprVoiSphere {
  const centerWorld = normalizedImagePointToWorld(plane, center)
  const edgeWorld = normalizedImagePointToWorld(plane, edge)
  const delta = subVec3(edgeWorld, centerWorld)
  return {
    id: '',
    label: '',
    enabled: true,
    centerWorld,
    radiusMm: Math.max(0.1, roundWorld(Math.hypot(delta[0], delta[1], delta[2]))),
    color
  }
}
