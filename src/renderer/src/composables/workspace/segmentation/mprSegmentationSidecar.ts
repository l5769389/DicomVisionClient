import {
  MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS,
  MPR_SEGMENTATION_MAX_VOI_SPHERES,
  normalizeMprSegmentationConfig,
  normalizeMprThresholdRegion,
  normalizeMprVoiSphere,
  type MprSegmentationConfig,
  type MprThresholdRegion,
  type MprVoiSphere
} from '../../../types/viewer'

export const MPR_SEGMENTATION_SIDECAR_KIND = 'dicomvision.mpr-segmentation'
export const MPR_SEGMENTATION_SIDECAR_VERSION = 1
export const MPR_SEGMENTATION_SIDECAR_EXTENSION = 'dvsseg.json'

export interface MprSegmentationSidecarSource {
  seriesId?: string | null
  seriesLabel?: string | null
  viewType: 'MPR'
}

export interface MprSegmentationSidecar {
  kind: typeof MPR_SEGMENTATION_SIDECAR_KIND
  version: typeof MPR_SEGMENTATION_SIDECAR_VERSION
  createdAt: string
  appVersion?: string | null
  source: MprSegmentationSidecarSource
  items: {
    thresholdRegions: MprThresholdRegion[]
    voiSpheres: MprVoiSphere[]
  }
}

export interface BuildMprSegmentationSidecarParams {
  appVersion?: string | null
  config: MprSegmentationConfig
  createdAt?: Date
  selectedThresholdRegionIds?: Iterable<string>
  selectedVoiSphereIds?: Iterable<string>
  source?: Partial<MprSegmentationSidecarSource> | null
}

export interface ParsedMprSegmentationSidecarItems {
  thresholdRegions: MprThresholdRegion[]
  voiSpheres: MprVoiSphere[]
}

export interface MergedMprSegmentationSidecar {
  config: MprSegmentationConfig
  importedThresholdRegionIds: string[]
  importedVoiSphereIds: string[]
  skippedThresholdRegionCount: number
  skippedVoiSphereCount: number
}

export interface MergeMprSegmentationSidecarItemsOptions {
  maxThresholdRegions?: number
  maxVoiSpheres?: number
}

function cloneVec3(value: [number, number, number]): [number, number, number] {
  return [value[0], value[1], value[2]]
}

function stripThresholdRegionStats(region: MprThresholdRegion): MprThresholdRegion {
  return {
    id: region.id,
    enabled: region.enabled,
    label: region.label,
    thresholdHu: region.thresholdHu,
    thresholdMode: region.thresholdMode,
    thresholdPercentile: region.thresholdPercentile,
    color: region.color,
    box: {
      centerWorld: cloneVec3(region.box.centerWorld),
      rowWorld: cloneVec3(region.box.rowWorld),
      colWorld: cloneVec3(region.box.colWorld),
      normalWorld: cloneVec3(region.box.normalWorld),
      widthMm: region.box.widthMm,
      heightMm: region.box.heightMm,
      depthMm: region.box.depthMm,
      sourceViewport: region.box.sourceViewport
    }
  }
}

function stripVoiSphereStats(sphere: MprVoiSphere): MprVoiSphere {
  return {
    id: sphere.id,
    enabled: sphere.enabled,
    label: sphere.label,
    centerWorld: cloneVec3(sphere.centerWorld),
    radiusMm: sphere.radiusMm,
    color: sphere.color
  }
}

function normalizeSelectedIds(ids: Iterable<string> | undefined): Set<string> | null {
  if (!ids) {
    return null
  }
  return new Set(Array.from(ids).filter((id) => id.trim().length > 0))
}

function compactOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized || null
}

export function buildMprSegmentationSidecar(params: BuildMprSegmentationSidecarParams): MprSegmentationSidecar {
  const config = normalizeMprSegmentationConfig(params.config)
  const selectedThresholdIds = normalizeSelectedIds(params.selectedThresholdRegionIds)
  const selectedVoiIds = normalizeSelectedIds(params.selectedVoiSphereIds)
  return {
    kind: MPR_SEGMENTATION_SIDECAR_KIND,
    version: MPR_SEGMENTATION_SIDECAR_VERSION,
    createdAt: (params.createdAt ?? new Date()).toISOString(),
    appVersion: compactOptionalText(params.appVersion),
    source: {
      seriesId: compactOptionalText(params.source?.seriesId),
      seriesLabel: compactOptionalText(params.source?.seriesLabel),
      viewType: 'MPR'
    },
    items: {
      thresholdRegions: config.thresholdRegions
        .filter((region) => !selectedThresholdIds || selectedThresholdIds.has(region.id))
        .map(stripThresholdRegionStats),
      voiSpheres: config.voiSpheres
        .filter((sphere) => !selectedVoiIds || selectedVoiIds.has(sphere.id))
        .map(stripVoiSphereStats)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseMprSegmentationSidecarPayload(payload: unknown): ParsedMprSegmentationSidecarItems {
  if (!isRecord(payload)) {
    throw new Error('Invalid segmentation file.')
  }
  if (payload.kind !== MPR_SEGMENTATION_SIDECAR_KIND) {
    throw new Error('Unsupported segmentation file type.')
  }
  if (payload.version !== MPR_SEGMENTATION_SIDECAR_VERSION) {
    throw new Error('Unsupported segmentation file version.')
  }
  if (!isRecord(payload.items)) {
    throw new Error('Segmentation file has no items.')
  }

  const thresholdRegions = (Array.isArray(payload.items.thresholdRegions) ? payload.items.thresholdRegions : [])
    .map((region) => normalizeMprThresholdRegion(region as Partial<MprThresholdRegion>))
    .filter((region): region is MprThresholdRegion => region !== null)
    .map(stripThresholdRegionStats)
  const voiSpheres = (Array.isArray(payload.items.voiSpheres) ? payload.items.voiSpheres : [])
    .map((sphere, index) => normalizeMprVoiSphere(sphere as Partial<MprVoiSphere>, null, index + 1))
    .filter((sphere): sphere is MprVoiSphere => sphere !== null)
    .map(stripVoiSphereStats)

  if (thresholdRegions.length === 0 && voiSpheres.length === 0) {
    throw new Error('Segmentation file has no valid items.')
  }

  return { thresholdRegions, voiSpheres }
}

export function parseMprSegmentationSidecarText(text: string): ParsedMprSegmentationSidecarItems {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('Segmentation file is not valid JSON.')
  }
  return parseMprSegmentationSidecarPayload(payload)
}

function createUniqueId(id: string, usedIds: Set<string>): string {
  const baseId = id.trim() || 'item'
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId)
    return baseId
  }

  let suffix = 2
  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  const uniqueId = `${baseId}-${suffix}`
  usedIds.add(uniqueId)
  return uniqueId
}

export function mergeMprSegmentationSidecarItems(
  currentConfig: MprSegmentationConfig,
  importedItems: ParsedMprSegmentationSidecarItems,
  options: MergeMprSegmentationSidecarItemsOptions = {}
): MergedMprSegmentationSidecar {
  const current = normalizeMprSegmentationConfig(currentConfig)
  const maxThresholdRegions = Math.max(0, Math.floor(options.maxThresholdRegions ?? MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS))
  const maxVoiSpheres = Math.max(0, Math.floor(options.maxVoiSpheres ?? MPR_SEGMENTATION_MAX_VOI_SPHERES))
  const remainingThresholdRegionSlots = Math.max(0, maxThresholdRegions - current.thresholdRegions.length)
  const remainingVoiSphereSlots = Math.max(0, maxVoiSpheres - current.voiSpheres.length)
  const usedRegionIds = new Set(current.thresholdRegions.map((region) => region.id))
  const usedVoiIds = new Set(current.voiSpheres.map((sphere) => sphere.id))
  const importedThresholdRegionIds: string[] = []
  const importedVoiSphereIds: string[] = []

  const thresholdRegionCandidates = importedItems.thresholdRegions.slice(0, remainingThresholdRegionSlots)
  const voiSphereCandidates = importedItems.voiSpheres.slice(0, remainingVoiSphereSlots)
  const skippedThresholdRegionCount = Math.max(0, importedItems.thresholdRegions.length - thresholdRegionCandidates.length)
  const skippedVoiSphereCount = Math.max(0, importedItems.voiSpheres.length - voiSphereCandidates.length)

  const thresholdRegions = thresholdRegionCandidates.map((region) => {
    const id = createUniqueId(region.id, usedRegionIds)
    importedThresholdRegionIds.push(id)
    return {
      ...stripThresholdRegionStats(region),
      id
    }
  })
  const voiSpheres = voiSphereCandidates.map((sphere) => {
    const id = createUniqueId(sphere.id, usedVoiIds)
    importedVoiSphereIds.push(id)
    return {
      ...stripVoiSphereStats(sphere),
      id
    }
  })

  const firstImportedRegionId = importedThresholdRegionIds[0] ?? null
  const firstImportedVoiId = firstImportedRegionId ? null : importedVoiSphereIds[0] ?? null
  const config = normalizeMprSegmentationConfig({
    ...current,
    enabled: true,
    clientRevision: current.clientRevision + 1,
    selectedRegionId: firstImportedRegionId,
    selectedVoi: firstImportedVoiId !== null,
    selectedVoiId: firstImportedVoiId,
    thresholdRegions: [...current.thresholdRegions, ...thresholdRegions],
    voiSpheres: [...current.voiSpheres, ...voiSpheres]
  })

  return {
    config,
    importedThresholdRegionIds,
    importedVoiSphereIds,
    skippedThresholdRegionCount,
    skippedVoiSphereCount
  }
}

function padTimestampPart(value: number): string {
  return String(value).padStart(2, '0')
}

export function buildMprSegmentationSidecarFileName(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate())
  ].join('') + '-' + [
    padTimestampPart(date.getHours()),
    padTimestampPart(date.getMinutes()),
    padTimestampPart(date.getSeconds())
  ].join('')
  return `dicomvision-mpr-segmentation-${stamp}.${MPR_SEGMENTATION_SIDECAR_EXTENSION}`
}
