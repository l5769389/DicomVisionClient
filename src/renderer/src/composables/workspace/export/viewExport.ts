import { api } from '../../../services/api'
import { saveExportedFile, type ExportedFileResult } from '../../../platform/exporting'
import type { ExportPreference } from '../../ui/useUiPreferences'
import type { AnnotationOverlay, MeasurementOverlay, MprViewportKey, ViewerTabItem } from '../../../types/viewer'

export type ViewerExportFormat = 'png' | 'dicom'

export interface ViewerExportOverlays {
  annotations: AnnotationOverlay[]
  measurements: MeasurementOverlay[]
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
  if (activeViewportKey === 'mpr-cor' || activeViewportKey === 'mpr-sag') {
    return activeViewportKey
  }
  return 'mpr-ax'
}

export function buildExportFileStem(activeTab: ViewerTabItem, activeViewportKey: string): string {
  const safeTitle = activeTab.seriesTitle.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'dicom-view'
  if (activeTab.viewType !== 'MPR') {
    return `${safeTitle}-${activeTab.viewType.toLowerCase()}`
  }

  const viewportKey = resolveExportViewportKey(activeViewportKey)
  const viewportLabel =
    viewportKey === 'mpr-cor' ? 'cor' : viewportKey === 'mpr-sag' ? 'sag' : 'ax'
  return `${safeTitle}-mpr-${viewportLabel}`
}

function resolveExportViewId(activeTab: ViewerTabItem, activeViewportKey: string): string | null {
  if (activeTab.viewType !== 'MPR') {
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
            overlayMode: 'burned-in',
            overlays: {
              annotations: cloneAnnotations(overlays?.annotations ?? []),
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
    fileName: `${fileStem}.${exportFormat === 'png' ? 'png' : 'dcm'}`,
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
