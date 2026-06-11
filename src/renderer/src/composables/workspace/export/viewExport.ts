import { api } from '../../../services/api'
import { saveExportedFile, type ExportedFileResult } from '../../../platform/exporting'
import type { ExportPreference } from '../../ui/useUiPreferences'
import type { AnnotationOverlay, CornerInfo, FusionPaneKey, MeasurementOverlay, MprViewportKey, ViewerTabItem } from '../../../types/viewer'
import {
  COMPARE_STACK_TARGET_PANE_KEY,
  MPR_PRIMARY_VIEWPORT_KEY,
  isMprLikeViewType,
  resolveComparePaneKey,
  resolveFusionPaneKey,
  resolveMprViewportKey,
  resolveViewIdForTabViewport
} from '../views/viewerViewportTargets'

export type ViewerExportFormat = 'png' | 'dicom' | 'dicom-sr' | 'dicom-gsps'

export interface ViewerExportOverlays {
  annotations: AnnotationOverlay[]
  cornerInfo: CornerInfo | null
  measurements: MeasurementOverlay[]
}

export function getViewerExportFileExtension(format: ViewerExportFormat): 'png' | 'dcm' {
  return format === 'png' ? 'png' : 'dcm'
}

export function getViewerExportFormatLabel(format: ViewerExportFormat): string {
  if (format === 'dicom-sr') {
    return 'DICOM SR'
  }
  if (format === 'dicom-gsps') {
    return 'DICOM GSPS'
  }
  return format === 'png' ? 'PNG' : 'DICOM'
}

function cloneCornerInfo(cornerInfo: CornerInfo | null): CornerInfo | null {
  if (!cornerInfo) {
    return null
  }

  return {
    topLeft: [...cornerInfo.topLeft],
    topRight: [...cornerInfo.topRight],
    bottomLeft: [...cornerInfo.bottomLeft],
    bottomRight: [...cornerInfo.bottomRight]
  }
}

function cloneMeasurements(measurements: MeasurementOverlay[]): MeasurementOverlay[] {
  return measurements.map((measurement) => ({
    measurementId: measurement.measurementId,
    toolType: measurement.toolType,
    points: measurement.points.map((point) => ({ x: point.x, y: point.y })),
    labelLines: [...measurement.labelLines]
  }))
}

function cloneAnnotations(annotations: AnnotationOverlay[]): AnnotationOverlay[] {
  return annotations.map((annotation) => ({
    annotationId: annotation.annotationId,
    toolType: annotation.toolType,
    points: annotation.points.map((point) => ({ x: point.x, y: point.y })),
    text: annotation.text,
    color: annotation.color,
    size: annotation.size
  }))
}

function resolveExportViewportKey(activeViewportKey: string): MprViewportKey {
  return resolveMprViewportKey(activeViewportKey)
}

function getFusionExportPaneLabel(paneKey: FusionPaneKey): string {
  switch (paneKey) {
    case 'fusion-ct-ax':
      return 'ct-ax'
    case 'fusion-pet-ax':
      return 'pet-ax'
    case 'fusion-pet-cor-mip':
      return 'pet-cor-mip'
    case 'fusion-overlay-ax':
    default:
      return 'fusion-ax'
  }
}

export function buildExportFileStem(activeTab: ViewerTabItem, activeViewportKey: string): string {
  const activeLayoutSlot =
    activeTab.viewType === 'Layout'
      ? activeTab.layoutSlots?.find((slot) => slot.id === activeViewportKey) ?? activeTab.layoutSlots?.find((slot) => Boolean(slot.viewId))
      : null
  const safeTitle = (activeLayoutSlot?.seriesTitle ?? activeTab.seriesTitle).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'dicom-view'
  if (activeTab.viewType === 'CompareStack') {
    const viewportLabel = resolveComparePaneKey(activeViewportKey) === COMPARE_STACK_TARGET_PANE_KEY ? 'b' : 'a'
    return `${safeTitle}-compare-${viewportLabel}`
  }
  if (activeTab.viewType === 'Layout') {
    const slotLabel = activeLayoutSlot?.id.replace(/[^a-zA-Z0-9_-]+/g, '-') || 'slot'
    return `${safeTitle}-layout-${slotLabel}`
  }
  if (activeTab.viewType === 'PETCTFusion') {
    return `${safeTitle}-${getFusionExportPaneLabel(resolveFusionPaneKey(activeViewportKey))}`
  }
  if (!isMprLikeViewType(activeTab.viewType)) {
    return `${safeTitle}-${activeTab.viewType.toLowerCase()}`
  }

  const viewportKey = resolveExportViewportKey(activeViewportKey)
  const viewportLabel =
    viewportKey === 'mpr-cor' ? 'cor' : viewportKey === 'mpr-sag' ? 'sag' : MPR_PRIMARY_VIEWPORT_KEY.replace('mpr-', '')
  return `${safeTitle}-mpr-${viewportLabel}`
}

function resolveExportViewId(activeTab: ViewerTabItem, activeViewportKey: string): string | null {
  if (activeTab.viewType === 'CompareStack') {
    return activeTab.compareViewIds?.[resolveComparePaneKey(activeViewportKey)] ?? null
  }

  if (activeTab.viewType === 'Layout') {
    return resolveViewIdForTabViewport(activeTab, activeViewportKey) || null
  }

  if (activeTab.viewType === 'PETCTFusion') {
    return activeTab.fusionViewIds?.[resolveFusionPaneKey(activeViewportKey)] ?? null
  }

  if (!isMprLikeViewType(activeTab.viewType)) {
    return activeTab.viewId || null
  }

  const viewportKey = resolveExportViewportKey(activeViewportKey)
  return activeTab.viewportViewIds?.[viewportKey] ?? null
}

export async function exportCurrentView(params: {
  activeTab: ViewerTabItem | null
  activeViewportKey: string
  data?: Uint8Array | null
  exportFormat: ViewerExportFormat
  exportPreference: ExportPreference
  fileNameStem?: string | null
  overlays?: ViewerExportOverlays
}): Promise<ExportedFileResult | null> {
  const { activeTab, activeViewportKey, data, exportFormat, exportPreference, fileNameStem, overlays } = params
  if (!activeTab || activeTab.viewType === 'Tag') {
    return null
  }

  const viewId = resolveExportViewId(activeTab, activeViewportKey)
  if (!viewId) {
    return null
  }

  const bytes =
    data ??
    new Uint8Array(
      (
        await api.post<ArrayBuffer>(
          '/view/export',
          {
            viewId,
            exportFormat,
            overlayMode:
              exportFormat === 'dicom-sr'
                ? 'structured-report'
                : exportFormat === 'dicom-gsps'
                  ? 'presentation-state'
                  : 'burned-in',
            overlays: {
              annotations: cloneAnnotations(overlays?.annotations ?? []),
              cornerInfo: cloneCornerInfo(overlays?.cornerInfo ?? null),
              measurements: cloneMeasurements(overlays?.measurements ?? [])
            },
            preserveSourceDicom: true
          },
          {
            responseType: 'arraybuffer'
          }
        )
      ).data
    )

  const fileStem = fileNameStem?.trim() || buildExportFileStem(activeTab, activeViewportKey)
  return await saveExportedFile({
    data: bytes,
    exportPreference,
    fileName: `${fileStem}.${getViewerExportFileExtension(exportFormat)}`,
    mimeType: exportFormat === 'png' ? 'image/png' : 'application/dicom'
  })
}

export async function exportCurrentViewFromBackend(params: {
  activeTab: ViewerTabItem | null
  activeViewportKey: string
  exportFormat: ViewerExportFormat
  exportPreference: ExportPreference
  overlays?: ViewerExportOverlays
}): Promise<ExportedFileResult | null> {
  return exportCurrentView(params)
}
