import type { ComputedRef, Ref } from 'vue'
import type {
  AnnotationOverlay,
  CornerInfo,
  MeasurementOverlay,
  ViewerTabItem
} from '../../../types/viewer'
import { applyViewportCornerInfoPreference } from '../../ui/viewportCornerInfo'
import type { WorkspaceExportCopy } from '../../ui/uiMessages'
import { useUiPreferences } from '../../ui/useUiPreferences'
import { isMprLikeViewType } from '../views/viewerViewportTargets'
import type { ViewerExportFormat, ViewerExportOverlays } from './viewExport'
import { useWorkspaceExportUi } from './useWorkspaceExportUi'

function isCompareStackViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'CompareStack'
}

function isLayoutViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'Layout'
}

function isPetCtFusionViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'PETCTFusion'
}

export function hasExportCornerInfo(cornerInfo: CornerInfo | null | undefined): boolean {
  if (!cornerInfo) {
    return false
  }

  const { viewportCornerInfoPreference } = useUiPreferences()
  const displayCornerInfo = applyViewportCornerInfoPreference(cornerInfo, viewportCornerInfoPreference.value)
  return [displayCornerInfo.topLeft, displayCornerInfo.topRight, displayCornerInfo.bottomLeft, displayCornerInfo.bottomRight].some((lines) =>
    lines.some((line) => line.trim())
  )
}

export interface WorkspaceViewExportOptions {
  activeTab: ComputedRef<ViewerTabItem | null> | Ref<ViewerTabItem | null>
  activeViewportKey: ComputedRef<string> | Ref<string>
  exportNameInputRef: Ref<HTMLInputElement | null>
  getAnnotations: (viewportKey: string) => AnnotationOverlay[]
  getCornerInfoForExport: (tab: ViewerTabItem, viewportKey: string) => CornerInfo
  getExportMeasurements: (viewportKey: string) => MeasurementOverlay[]
  workspaceExportCopy: ComputedRef<WorkspaceExportCopy>
}

export function useWorkspaceViewExport(options: WorkspaceViewExportOptions) {
  const { exportPreference } = useUiPreferences()
  const exportUi = useWorkspaceExportUi(options.workspaceExportCopy, options.exportNameInputRef)

  async function handleExportCurrentView(format: ViewerExportFormat, viewportKeyOverride?: string): Promise<void> {
    try {
      const activeTab = options.activeTab.value
      if (!activeTab) {
        exportUi.showExportNotice(null, format)
        return
      }

      const shouldUseActiveViewport =
        isMprLikeViewType(activeTab.viewType) ||
        isCompareStackViewType(activeTab.viewType) ||
        isLayoutViewType(activeTab.viewType) ||
        isPetCtFusionViewType(activeTab.viewType)
      const exportViewportKey = viewportKeyOverride ?? (shouldUseActiveViewport ? options.activeViewportKey.value : 'single')
      const { buildExportFileStem, exportCurrentView } = await import('./viewExport')
      const exportFileNameStem = buildExportFileStem(activeTab, exportViewportKey)
      const defaultFileNameStem =
        format === 'dicom-sr'
          ? `${exportFileNameStem}-measurements-sr`
          : format === 'dicom-gsps'
            ? `${exportFileNameStem}-presentation-state`
            : exportFileNameStem
      let customFileNameStem: string | null = null
      if (!exportPreference.value.useDefaultFileName) {
        customFileNameStem = await exportUi.requestExportFileName(format, defaultFileNameStem)
        if (!customFileNameStem) {
          return
        }
      }

      const overlays: ViewerExportOverlays = {
        annotations: options.getAnnotations(exportViewportKey),
        cornerInfo: options.getCornerInfoForExport(activeTab, exportViewportKey),
        measurements: options.getExportMeasurements(exportViewportKey)
      }
      const exportOverlays: ViewerExportOverlays =
        format === 'png'
          ? {
              annotations: exportPreference.value.includePngAnnotations ? overlays.annotations : [],
              cornerInfo: exportPreference.value.includePngCornerInfo ? overlays.cornerInfo : null,
              measurements: exportPreference.value.includePngMeasurements ? overlays.measurements : []
            }
          : format === 'dicom-sr'
            ? { annotations: [], cornerInfo: null, measurements: overlays.measurements }
            : format === 'dicom-gsps'
              ? { annotations: overlays.annotations, cornerInfo: null, measurements: overlays.measurements }
              : {
                  annotations: exportPreference.value.includeDicomAnnotations ? overlays.annotations : [],
                  cornerInfo: null,
                  measurements: exportPreference.value.includeDicomMeasurements ? overlays.measurements : []
                }
      const result = await exportCurrentView({
        activeTab,
        activeViewportKey: exportViewportKey,
        data: null,
        exportFormat: format,
        exportPreference: exportPreference.value,
        fileNameStem: customFileNameStem,
        overlays: exportOverlays
      })
      exportUi.showExportNotice(result, format)
    } catch (error) {
      console.error('Failed to export current view.', error)
      exportUi.showExportFailureNotice()
    }
  }

  return {
    ...exportUi,
    handleExportCurrentView
  }
}
