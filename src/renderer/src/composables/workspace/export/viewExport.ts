import { api } from '../../../services/api'
import { saveExportedFile } from '../../../platform/exporting'
import type { ExportPreference } from '../../ui/useUiPreferences'
import type { MprViewportKey, ViewerTabItem } from '../../../types/viewer'

export type ViewerExportFormat = 'png' | 'dicom'

function resolveExportViewportKey(activeViewportKey: string): MprViewportKey {
  if (activeViewportKey === 'mpr-cor' || activeViewportKey === 'mpr-sag') {
    return activeViewportKey
  }
  return 'mpr-ax'
}

function buildExportFileStem(activeTab: ViewerTabItem, activeViewportKey: string): string {
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
  exportFormat: ViewerExportFormat
  exportPreference: ExportPreference
}): Promise<{ locationDescription: string | null; mode: 'filesystem' | 'download' } | null> {
  const { activeTab, activeViewportKey, exportFormat, exportPreference } = params
  if (!activeTab || activeTab.viewType === 'Tag') {
    return null
  }

  const viewId = resolveExportViewId(activeTab, activeViewportKey)
  if (!viewId) {
    return null
  }

  const response = await api.post<ArrayBuffer>(
    '/view/export',
    {
      viewId,
      exportFormat
    },
    {
      responseType: 'arraybuffer'
    }
  )

  const bytes = new Uint8Array(response.data)
  const fileStem = buildExportFileStem(activeTab, activeViewportKey)
  return await saveExportedFile({
    data: bytes,
    exportPreference,
    fileName: `${fileStem}.${exportFormat === 'png' ? 'png' : 'dcm'}`,
    mimeType: exportFormat === 'png' ? 'image/png' : 'application/dicom'
  })
}
