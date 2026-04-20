<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { ViewOperationType } from '@shared/viewerConstants'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  AnnotationSize,
  CornerInfo,
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementDraftPoint,
  MeasurementOverlay,
  MprMipConfig,
  ViewerTabItem,
  ViewType,
  WorkspaceReadyPayload
} from '../../types/viewer'
import { findArrowAnnotationAtPoint, isValidArrowAnnotation, translateAnnotationPoints, updateEditedArrowPoints } from '../../composables/annotations/annotationGeometry'
import { useViewerWorkspacePointer } from '../../composables/measurements/useViewerWorkspacePointer'
import { filterMeasurementDraftByPreferences, filterMeasurementOverlayByPreferences } from '../../composables/measurements/measurementLabelPreferences'
import { useViewerWorkspaceShell } from '../../composables/workspace/shell/useViewerWorkspaceShell'
import MprView from '../viewer/views/MprView.vue'
import StackView from '../viewer/views/StackView.vue'
import DicomTagView from '../viewer/views/DicomTagView.vue'
import VolumeView from '../viewer/views/VolumeView.vue'
import MprMipConfigPanel from './MprMipConfigPanel.vue'
import VolumeRenderConfigPanel from './VolumeRenderConfigPanel.vue'
import ViewerTabStrip from './ViewerTabStrip.vue'
import ViewerToolbar from './shell/ViewerToolbar.vue'
import type { VolumeRenderConfig } from '../../types/viewer'
import { useViewerWorkspaceToolbar } from '../../composables/workspace/toolbar/useViewerWorkspaceToolbar'
import MtfCurveDialog from '../viewer/overlays/MtfCurveDialog.vue'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import { buildExportFileStem, exportCurrentView, type ViewerExportFormat, type ViewerExportOverlays } from '../../composables/workspace/export/viewExport'
import { openExportLocation, type ExportedFileResult } from '../../platform/exporting'
import { viewerRuntime } from '../../platform/runtime'

const props = defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
  activeTabKey: string
  hasSelectedSeries: boolean
  isViewLoading: boolean
  message: string
  selectedSeriesId: string
  viewerTabs: ViewerTabItem[]
}>()

const SERIES_DRAG_TYPE = 'application/x-dicomvision-series-id'

const emit = defineEmits<{
  activateTab: [tabKey: string]
  activeViewportChange: [viewportKey: string]
  closeTab: [tabKey: string]
  measurementDraft: [payload: { viewportKey: string; toolType: 'line' | 'rect' | 'ellipse' | 'angle'; phase: 'start' | 'move' | 'end'; points: { x: number; y: number }[] }]
  measurementCreate: [payload: {
    viewportKey: string
    toolType: 'line' | 'rect' | 'ellipse' | 'angle'
    points: { x: number; y: number }[]
    measurementId?: string
    labelLines?: string[]
  }]
  measurementDelete: [payload: { viewportKey: string; measurementId: string }]
  tagIndexChange: [payload: { tabKey: string; index: number }]
  mtfClear: []
  mtfCommit: [payload: { viewportKey: string; points: { x: number; y: number }[]; mtfId?: string }]
  mtfCopy: [payload?: { mtfId?: string | null }]
  mtfDelete: [payload?: { mtfId?: string | null }]
  mtfSelect: [payload: { mtfId: string | null }]
  mprCrosshair: [payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }]
  setActiveOperation: [value: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  triggerViewAction: [payload: { action: 'reset' | 'volumePreset' | 'rotate' | 'pseudocolor' | 'windowPreset' | 'mprMipConfig'; value?: string; config?: MprMipConfig }]
  volumeConfigChange: [config: VolumeRenderConfig]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [deltaY: number]
  quickPreviewSeriesDrop: [seriesId: string]
  quickPreviewSelectedSeries: []
  openSeriesView: [seriesId: string, viewType: ViewType]
  toggleSidebar: []
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = useTemplateRef<HTMLElement>('viewportHostRef')
const exportNameInputRef = useTemplateRef<HTMLInputElement>('exportNameInputRef')
const activeTabRef = computed(() => props.activeTab)
const activeTabKeyRef = computed(() => props.activeTabKey)
const activeOperationRef = computed(() => props.activeOperation)
const isViewLoadingRef = computed(() => props.isViewLoading)
const viewerTabsRef = computed(() => props.viewerTabs)
const { locale, t } = useUiLocale()
const { exportPreference, roiStatOptions } = useUiPreferences()
const DEFAULT_ANNOTATION_TEXT = ''
const DEFAULT_ANNOTATION_COLOR = '#ffd166'
const DEFAULT_ANNOTATION_SIZE: AnnotationSize = 'md'
const ANNOTATION_DRAG_START_THRESHOLD = 3

type AnnotationInteractionState =
  | { kind: 'idle' }
  | { kind: 'creating'; viewportKey: string }
  | {
      kind: 'move_pending'
      viewportKey: string
      annotationId: string
      startPoint: MeasurementDraftPoint
      originalPoints: MeasurementDraftPoint[]
    }
  | {
      kind: 'moving'
      viewportKey: string
      annotationId: string
      startPoint: MeasurementDraftPoint
      originalPoints: MeasurementDraftPoint[]
    }
  | { kind: 'editing_handle'; viewportKey: string; annotationId: string; handleIndex: number }

const {
  activeViewportKey,
  cleanupPointerInteractions,
  copySelectedMeasurement,
  deleteSelectedMeasurement,
  draftMeasurements,
  getMtfDraft,
  getMtfDraftMode,
  getDraftMeasurementMode,
  handleViewportPointerCancel,
  handleViewportPointerLeave,
  handleViewportPointerDown,
  handleViewportPointerMove,
  handleViewportPointerUp,
  setActiveViewport,
  stopViewportDrag,
  updateDraftMeasurementLabelLines,
  viewportCursorClasses
} = useViewerWorkspacePointer({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitActiveViewportChange: (viewportKey) => emit('activeViewportChange', viewportKey),
  emitOperationChange: (value) => emit('setActiveOperation', value),
  emitMeasurementDraft: (payload) => emit('measurementDraft', payload),
  emitMeasurementCreate: (payload) => emit('measurementCreate', payload),
  emitMeasurementDelete: (payload) => emit('measurementDelete', payload),
  emitMtfCommit: (payload) => emit('mtfCommit', payload),
  emitMtfDelete: (payload) => emit('mtfDelete', payload),
  emitMtfSelect: (payload) => emit('mtfSelect', payload),
  emitMprCrosshair: (payload) => emit('mprCrosshair', payload),
  emitViewportDrag: (payload) => emit('viewportDrag', payload),
  getCommittedMeasurements: (viewportKey) => getCommittedMeasurements(viewportKey),
  getMtfItems: (viewportKey) => getMtfItems(viewportKey)
})

const {
  activeTools,
  activeMprMipConfig,
  activeVolumeRenderConfig,
  applyTool,
  areToolbarActionsDisabled,
  closeMenus,
  endPlayback,
  handleViewportClick,
  handleViewportWheel,
  isPlaying,
  isPlaybackPaused,
  isMprMipPanelOpen,
  isToolSelected,
  isVolumeConfigPanelOpen,
  menuIconSize,
  openMenuKey,
  pausePlayback,
  selectToolOption,
  setMenuOpen,
  stackToolSelections,
  toolbarIconSize,
  toggleIconSize,
  updateActiveMprMipConfig
} = useViewerWorkspaceToolbar({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitSetActiveOperation: (value) => emit('setActiveOperation', value),
  emitTriggerViewAction: (payload) => emit('triggerViewAction', payload),
  emitViewportWheel: (deltaY) => emit('viewportWheel', deltaY),
  emitOpenSeriesView: (seriesId, viewType) => emit('openSeriesView', seriesId, viewType),
  exportCurrentView: (format) => {
    void handleExportCurrentView(format)
  },
  activeViewportKey,
  cleanupPointerInteractions,
  stopViewportDrag: () => stopViewportDrag(),
  setActiveViewport
})

const annotationStore = ref<Record<string, Partial<Record<string, AnnotationOverlay[]>>>>({})
const draftAnnotations = ref<Partial<Record<string, AnnotationDraft | null>>>({})
const annotationInteraction = ref<AnnotationInteractionState>({ kind: 'idle' })
const annotationActivePointerId = ref<number | null>(null)
const exportNotice = ref<{
  canOpenLocation: boolean
  directoryPath?: string | null
  filePath?: string | null
  message: string
  title: string
} | null>(null)
let exportNoticeTimer: ReturnType<typeof setTimeout> | null = null
const isExportNameDialogOpen = ref(false)
const exportNameDialogFormat = ref<ViewerExportFormat>('png')
const exportNameInput = ref('')
const exportNameError = ref('')
let resolveExportNameDialog: ((value: string | null) => void) | null = null
const exportNameExtension = computed(() => (exportNameDialogFormat.value === 'png' ? 'png' : 'dcm'))

function clearExportNoticeTimer(): void {
  if (!exportNoticeTimer) {
    return
  }

  clearTimeout(exportNoticeTimer)
  exportNoticeTimer = null
}

function showExportNotice(result: ExportedFileResult | null, format: ViewerExportFormat): void {
  clearExportNoticeTimer()

  const isZh = locale.value === 'zh-CN'
  if (!result) {
    exportNotice.value = {
      canOpenLocation: false,
      message: isZh ? '当前视图无法导出，请先打开可导出的图像视图。' : 'The current view cannot be exported. Open an exportable image view first.',
      title: isZh ? '导出未完成' : 'Export Not Completed'
    }
    return
  }

  const formatLabel = format === 'png' ? 'PNG' : 'DICOM'
  exportNotice.value = {
    canOpenLocation: viewerRuntime.platform === 'desktop' && Boolean(result.filePath || result.directoryPath),
    directoryPath: result.directoryPath,
    filePath: result.filePath,
    message:
      result.mode === 'download'
        ? isZh
          ? `${formatLabel} 已交给浏览器下载。`
          : `${formatLabel} was sent to the browser downloads.`
        : isZh
          ? `已导出到 ${result.locationDescription ?? result.directoryPath ?? '选定位置'}`
          : `Exported to ${result.locationDescription ?? result.directoryPath ?? 'the selected location'}`,
    title: isZh ? '导出完成' : 'Export Complete'
  }

  exportNoticeTimer = setTimeout(() => {
    exportNotice.value = null
    exportNoticeTimer = null
  }, 8000)
}

async function handleOpenExportLocation(): Promise<void> {
  if (!exportNotice.value) {
    return
  }

  const opened = await openExportLocation({
    directoryPath: exportNotice.value.directoryPath,
    filePath: exportNotice.value.filePath
  })
  if (!opened) {
    exportNotice.value = {
      ...exportNotice.value,
      canOpenLocation: false,
      message: locale.value === 'zh-CN' ? '无法打开导出位置，请手动前往上方显示的路径。' : 'Could not open the export location. Use the path shown above.'
    }
  }
}

function resolveActiveExportImageElement(viewportKey: string): HTMLImageElement | null {
  const host = viewportHostRef.value
  if (!host) {
    return null
  }

  const surface = host.querySelector<HTMLElement>(`[data-active-render-surface="true"][data-viewport-key="${viewportKey}"]`)
  const image = surface?.querySelector<HTMLImageElement>('.viewer-image') ?? null
  return image instanceof HTMLImageElement ? image : null
}

function canvasPoint(point: MeasurementDraftPoint, width: number, height: number): { x: number; y: number } {
  return {
    x: point.x * width,
    y: point.y * height
  }
}

function drawLabel(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, maxWidth: number): void {
  const visibleLines = lines.map((line) => line.trim()).filter(Boolean)
  if (!visibleLines.length) {
    return
  }

  const lineHeight = 18
  context.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  const width = Math.min(
    Math.max(...visibleLines.map((line) => context.measureText(line).width)) + 14,
    Math.max(120, maxWidth - 16)
  )
  const height = visibleLines.length * lineHeight + 8
  const left = Math.max(8, Math.min(maxWidth - width - 8, x))
  const top = Math.max(8, y)

  context.save()
  context.fillStyle = 'rgba(7,16,28,0.92)'
  context.strokeStyle = 'rgba(125,211,252,0.55)'
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(left, top, width, height, 8)
  context.fill()
  context.stroke()
  context.fillStyle = '#f8fafc'
  visibleLines.forEach((line, index) => {
    context.fillText(line, left + 7, top + 18 + index * lineHeight)
  })
  context.restore()
}

function drawMeasurements(context: CanvasRenderingContext2D, measurements: MeasurementOverlay[], width: number, height: number): void {
  measurements.forEach((measurement) => {
    const points = measurement.points.map((point) => canvasPoint(point, width, height))
    if (!points.length) {
      return
    }

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = 'rgba(3,15,24,0.92)'
    context.lineWidth = 5

    const drawShape = (): void => {
      if (measurement.toolType === 'line' && points.length >= 2) {
        context.beginPath()
        context.moveTo(points[0].x, points[0].y)
        context.lineTo(points[1].x, points[1].y)
        context.stroke()
      } else if ((measurement.toolType === 'rect' || measurement.toolType === 'ellipse') && points.length >= 2) {
        const left = Math.min(points[0].x, points[1].x)
        const top = Math.min(points[0].y, points[1].y)
        const rectWidth = Math.abs(points[1].x - points[0].x)
        const rectHeight = Math.abs(points[1].y - points[0].y)
        context.beginPath()
        if (measurement.toolType === 'ellipse') {
          context.ellipse(left + rectWidth / 2, top + rectHeight / 2, rectWidth / 2, rectHeight / 2, 0, 0, Math.PI * 2)
        } else {
          context.rect(left, top, rectWidth, rectHeight)
        }
        context.stroke()
      } else if (measurement.toolType === 'angle' && points.length >= 2) {
        context.beginPath()
        context.moveTo(points[0].x, points[0].y)
        context.lineTo(points[1].x, points[1].y)
        if (points[2]) {
          context.lineTo(points[2].x, points[2].y)
        }
        context.stroke()
      }
    }

    drawShape()
    context.strokeStyle = 'rgba(85,231,255,0.98)'
    context.lineWidth = 2.5
    drawShape()

    const anchor = points[1] ?? points[0]
    drawLabel(context, measurement.labelLines ?? [], anchor.x + 12, anchor.y - 32, width)
    context.restore()
  })
}

function drawArrowHead(context: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, size: number): void {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return
  }

  const ux = dx / length
  const uy = dy / length
  const backX = end.x - ux * size * 2.8
  const backY = end.y - uy * size * 2.8
  const perpX = -uy * size
  const perpY = ux * size
  context.beginPath()
  context.moveTo(end.x, end.y)
  context.lineTo(backX + perpX, backY + perpY)
  context.lineTo(backX - perpX, backY - perpY)
  context.closePath()
  context.fill()
}

function drawAnnotations(context: CanvasRenderingContext2D, annotations: AnnotationOverlay[], width: number, height: number): void {
  annotations.forEach((annotation) => {
    const points = annotation.points.map((point) => canvasPoint(point, width, height))
    if (points.length < 2) {
      return
    }

    const lineWidth = annotation.size === 'lg' ? 3 : annotation.size === 'sm' ? 2 : 2.5
    const fontSize = annotation.size === 'lg' ? 16 : annotation.size === 'sm' ? 12 : 14
    context.save()
    context.strokeStyle = annotation.color
    context.fillStyle = annotation.color
    context.lineCap = 'round'
    context.lineWidth = lineWidth
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    context.lineTo(points[1].x, points[1].y)
    context.stroke()
    drawArrowHead(context, points[0], points[1], lineWidth * 2.8)

    const text = annotation.text.trim()
    if (text) {
      context.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      const labelWidth = Math.min(Math.max(context.measureText(text).width + 14, 48), Math.max(48, width - 16))
      const left = Math.max(8, Math.min(width - labelWidth - 8, points[0].x + 12))
      const top = Math.max(8, Math.min(height - fontSize - 18, points[0].y - fontSize - 12))
      context.fillStyle = 'rgba(7,14,24,0.92)'
      context.strokeStyle = 'rgba(255,255,255,0.18)'
      context.lineWidth = 1
      context.beginPath()
      context.roundRect(left, top, labelWidth, fontSize + 12, 8)
      context.fill()
      context.stroke()
      context.fillStyle = annotation.color
      context.fillText(text, left + 7, top + fontSize + 2)
    }
    context.restore()
  })
}

function hasCornerInfo(cornerInfo: CornerInfo | null | undefined): boolean {
  if (!cornerInfo) {
    return false
  }

  return [cornerInfo.topLeft, cornerInfo.topRight, cornerInfo.bottomLeft, cornerInfo.bottomRight].some((lines) =>
    lines.some((line) => line.trim())
  )
}

function drawCornerInfo(context: CanvasRenderingContext2D, cornerInfo: CornerInfo, width: number, height: number): void {
  const blocks: Array<{
    key: keyof CornerInfo
    x: number
    y: number
    align: CanvasTextAlign
    baseline: CanvasTextBaseline
  }> = [
    { key: 'topLeft', x: 18, y: 18, align: 'left', baseline: 'top' },
    { key: 'topRight', x: width - 18, y: 18, align: 'right', baseline: 'top' },
    { key: 'bottomLeft', x: 18, y: height - 18, align: 'left', baseline: 'bottom' },
    { key: 'bottomRight', x: width - 18, y: height - 18, align: 'right', baseline: 'bottom' }
  ]

  context.save()
  context.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  context.fillStyle = '#eaf3fb'
  context.strokeStyle = 'rgba(3, 15, 24, 0.92)'
  context.lineJoin = 'round'
  context.lineWidth = 3

  blocks.forEach(({ key, x, y, align, baseline }) => {
    const lines = cornerInfo[key].map((line) => line.trim()).filter(Boolean)
    if (!lines.length) {
      return
    }

    context.textAlign = align
    context.textBaseline = baseline
    lines.forEach((line, index) => {
      const lineY =
        baseline === 'top'
          ? y + index * 16
          : y - (lines.length - 1 - index) * 16
      context.strokeText(line, x, lineY)
      context.fillText(line, x, lineY)
    })
  })

  context.restore()
}

async function buildAnnotatedPngData(viewportKey: string, overlays: ViewerExportOverlays): Promise<Uint8Array | null> {
  await nextTick()
  const image = resolveActiveExportImageElement(viewportKey)
  if (!image?.src || !image.naturalWidth || !image.naturalHeight) {
    return null
  }

  if (!image.complete && typeof image.decode === 'function') {
    await image.decode()
  }

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    if (overlays.cornerInfo) {
      drawCornerInfo(context, overlays.cornerInfo, canvas.width, canvas.height)
    }
    drawMeasurements(context, overlays.measurements, canvas.width, canvas.height)
    drawAnnotations(context, overlays.annotations, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      return null
    }

    return new Uint8Array(await blob.arrayBuffer())
  } catch (error) {
    console.error('Failed to compose annotated PNG locally.', error)
    return null
  }
}

function normalizeExportFileNameStem(value: string, format: ViewerExportFormat): string {
  const extensionPattern = format === 'png' ? /\.png$/i : /\.(dcm|dicom)$/i
  return value
    .trim()
    .replace(extensionPattern, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.+$/g, '')
    .trim()
}

async function requestExportFileName(format: ViewerExportFormat, defaultFileNameStem: string): Promise<string | null> {
  if (resolveExportNameDialog) {
    resolveExportNameDialog(null)
  }

  exportNameDialogFormat.value = format
  exportNameInput.value = defaultFileNameStem
  exportNameError.value = ''
  isExportNameDialogOpen.value = true

  await nextTick()
  exportNameInputRef.value?.focus()
  exportNameInputRef.value?.select()

  return new Promise((resolve) => {
    resolveExportNameDialog = resolve
  })
}

function closeExportNameDialog(value: string | null): void {
  const resolve = resolveExportNameDialog
  resolveExportNameDialog = null
  isExportNameDialogOpen.value = false
  exportNameError.value = ''
  if (resolve) {
    resolve(value)
  }
}

function cancelExportNameDialog(): void {
  closeExportNameDialog(null)
}

function confirmExportNameDialog(): void {
  const normalizedName = normalizeExportFileNameStem(exportNameInput.value, exportNameDialogFormat.value)
  if (!normalizedName) {
    exportNameError.value = locale.value === 'zh-CN' ? '请输入有效的导出文件名。' : 'Enter a valid export file name.'
    return
  }

  closeExportNameDialog(normalizedName)
}

async function handleExportCurrentView(format: ViewerExportFormat): Promise<void> {
  try {
    if (!props.activeTab) {
      showExportNotice(null, format)
      return
    }

    const exportViewportKey = props.activeTab?.viewType === 'MPR' ? activeViewportKey.value : 'single'
    const defaultFileNameStem = buildExportFileStem(props.activeTab, activeViewportKey.value)
    let customFileNameStem: string | null = null
    if (!exportPreference.value.useDefaultFileName) {
      customFileNameStem = await requestExportFileName(format, defaultFileNameStem)
      if (!customFileNameStem) {
        return
      }
    }

    const overlays: ViewerExportOverlays = {
      annotations: getAnnotations(exportViewportKey),
      cornerInfo: props.activeTab?.viewType === 'MPR' ? getMprCornerInfo(exportViewportKey) : props.activeTab.cornerInfo,
      measurements: getExportMeasurements(exportViewportKey)
    }
    const exportOverlays: ViewerExportOverlays =
      format === 'png'
        ? {
            annotations: exportPreference.value.includePngAnnotations ? overlays.annotations : [],
            cornerInfo: exportPreference.value.includePngCornerInfo ? overlays.cornerInfo : null,
            measurements: exportPreference.value.includePngMeasurements ? overlays.measurements : []
          }
        : {
            annotations: exportPreference.value.includeDicomAnnotations ? overlays.annotations : [],
            cornerInfo: null,
            measurements: exportPreference.value.includeDicomMeasurements ? overlays.measurements : []
          }
    const shouldComposePng =
      format === 'png' &&
      (exportOverlays.annotations.length > 0 || exportOverlays.measurements.length > 0 || hasCornerInfo(exportOverlays.cornerInfo))
    const pngData = shouldComposePng ? await buildAnnotatedPngData(exportViewportKey, exportOverlays) : null
    const result = await exportCurrentView({
      activeTab: props.activeTab,
      activeViewportKey: activeViewportKey.value,
      data: pngData,
      exportFormat: format,
      exportPreference: exportPreference.value,
      fileNameStem: customFileNameStem,
      overlays: exportOverlays
    })
    showExportNotice(result, format)
  } catch (error) {
    console.error('Failed to export current view.', error)
    clearExportNoticeTimer()
    exportNotice.value = {
      canOpenLocation: false,
      message: locale.value === 'zh-CN' ? '导出失败，请检查后端连接和导出目录权限。' : 'Export failed. Check the backend connection and export directory permissions.',
      title: locale.value === 'zh-CN' ? '导出失败' : 'Export Failed'
    }
  }
}

function createAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isAnnotationOperationEnabled(): boolean {
  return (
    (props.activeTab?.viewType === 'Stack' || props.activeTab?.viewType === 'MPR') &&
    props.activeOperation.startsWith('stack:annotate')
  )
}

function getDraftAnnotation(viewportKey: string): AnnotationDraft | null {
  return draftAnnotations.value[viewportKey] ?? null
}

function getAnnotations(viewportKey: string): AnnotationOverlay[] {
  const tabKey = props.activeTab?.key
  if (!tabKey) {
    return []
  }

  return annotationStore.value[tabKey]?.[viewportKey] ?? []
}

function setViewportAnnotations(viewportKey: string, annotations: AnnotationOverlay[]): void {
  const tabKey = props.activeTab?.key
  if (!tabKey) {
    return
  }

  annotationStore.value = {
    ...annotationStore.value,
    [tabKey]: {
      ...(annotationStore.value[tabKey] ?? {}),
      [viewportKey]: annotations
    }
  }
}

function upsertAnnotation(viewportKey: string, annotation: AnnotationOverlay): void {
  const current = getAnnotations(viewportKey)
  const index = current.findIndex((item) => item.annotationId === annotation.annotationId)
  setViewportAnnotations(
    viewportKey,
    index === -1 ? [...current, annotation] : current.map((item, currentIndex) => (currentIndex === index ? annotation : item))
  )
}

function removeAnnotation(viewportKey: string, annotationId: string): void {
  setViewportAnnotations(
    viewportKey,
    getAnnotations(viewportKey).filter((item) => item.annotationId !== annotationId)
  )
}

function setDraftAnnotation(viewportKey: string, annotation: AnnotationDraft | null): void {
  draftAnnotations.value = {
    ...draftAnnotations.value,
    [viewportKey]: annotation
  }
}

function clearDraftAnnotations(): void {
  draftAnnotations.value = {}
}

function findAnnotation(viewportKey: string, annotationId: string): AnnotationOverlay | null {
  return getAnnotations(viewportKey).find((item) => item.annotationId === annotationId) ?? null
}

function selectAnnotation(viewportKey: string, annotation: AnnotationOverlay): void {
  setDraftAnnotation(viewportKey, {
    annotationId: annotation.annotationId,
    toolType: annotation.toolType,
    points: annotation.points,
    text: annotation.text,
    color: annotation.color,
    size: annotation.size
  })
}

function clearSelectedAnnotation(viewportKey?: string): void {
  if (!viewportKey) {
    clearDraftAnnotations()
    annotationInteraction.value = { kind: 'idle' }
    return
  }

  setDraftAnnotation(viewportKey, null)
  annotationInteraction.value = { kind: 'idle' }
}

function getDraftMeasurement(viewportKey: string): MeasurementDraft | null {
  const draft = draftMeasurements.value[viewportKey]
  return filterMeasurementDraftByPreferences(draft ?? null, roiStatOptions.value)
}

function getCommittedMeasurements(viewportKey: string): MeasurementOverlay[] {
  if (!props.activeTab) {
    return []
  }
  if (props.activeTab.viewType === 'MPR') {
    return props.activeTab.viewportMeasurements?.[viewportKey as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'] ?? []
  }
  return props.activeTab.measurements ?? []
}

function getVisibleCommittedMeasurements(viewportKey: string): MeasurementOverlay[] {
  const committedMeasurements = getCommittedMeasurements(viewportKey)
  const draft = draftMeasurements.value[viewportKey]
  const editingMeasurementId = draft?.measurementId
  if (!editingMeasurementId) {
    return committedMeasurements.map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
  }

  return committedMeasurements
    .filter((measurement) => measurement.measurementId !== editingMeasurementId)
    .map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
}

function getExportMeasurements(viewportKey: string): MeasurementOverlay[] {
  return getCommittedMeasurements(viewportKey).map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
}

function getMtfItems(viewportKey: string) {
  const items = (props.activeTab?.mtfState?.items ?? []).filter((item) => item.viewportKey === viewportKey)
  const draft = getMtfDraft(viewportKey)
  if (!draft?.mtfId) {
    return items
  }

  return items.filter((item) => item.mtfId !== draft.mtfId)
}

function getViewportCursorClass(viewportKey: string): string {
  if (isAnnotationOperationEnabled()) {
    return viewportCursorClasses.value[viewportKey] ?? 'cursor-crosshair'
  }
  return viewportCursorClasses.value[viewportKey] ?? ''
}

function getMprCornerInfo(viewportKey: string) {
  return (
    props.activeTab?.viewportCornerInfos?.[viewportKey as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'] ??
    props.activeTab?.cornerInfo ?? {
      topLeft: [],
      topRight: [],
      bottomLeft: [],
      bottomRight: []
    }
  )
}

function resolvePointerContainer(event: PointerEvent): HTMLElement | null {
  const target = event.target
  if (!(target instanceof Element)) {
    return null
  }

  return target.closest('.viewer-viewport')
}

function resolveViewportImageElement(event: PointerEvent): HTMLImageElement | null {
  const container = resolvePointerContainer(event)
  if (!container) {
    return null
  }

  const image = container.querySelector<HTMLImageElement>('.viewer-image')
  return image instanceof HTMLImageElement ? image : null
}

function getRenderedImageRect(imageElement: HTMLImageElement): DOMRect {
  const rect = imageElement.getBoundingClientRect()
  const naturalWidth = imageElement.naturalWidth
  const naturalHeight = imageElement.naturalHeight
  if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) {
    return rect
  }

  const elementAspectRatio = rect.width / rect.height
  const imageAspectRatio = naturalWidth / naturalHeight

  if (elementAspectRatio > imageAspectRatio) {
    const renderedWidth = rect.height * imageAspectRatio
    const offsetX = (rect.width - renderedWidth) / 2
    return new DOMRect(rect.left + offsetX, rect.top, renderedWidth, rect.height)
  }

  const renderedHeight = rect.width / imageAspectRatio
  const offsetY = (rect.height - renderedHeight) / 2
  return new DOMRect(rect.left, rect.top + offsetY, rect.width, renderedHeight)
}

function getNormalizedViewportPoint(event: PointerEvent): MeasurementDraftPoint | null {
  const imageElement = resolveViewportImageElement(event)
  if (!imageElement) {
    return null
  }

  const rect = getRenderedImageRect(imageElement)
  if (!rect.width || !rect.height) {
    return null
  }

  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  }
}

function setAnnotationPointerCapture(pointerTarget: HTMLElement, pointerId: number): void {
  pointerTarget.setPointerCapture(pointerId)
  annotationActivePointerId.value = pointerId
}

function releaseAnnotationPointerCapture(pointerTarget?: EventTarget | null): void {
  if (!(pointerTarget instanceof HTMLElement) || annotationActivePointerId.value == null) {
    annotationActivePointerId.value = null
    return
  }

  if (pointerTarget.hasPointerCapture(annotationActivePointerId.value)) {
    pointerTarget.releasePointerCapture(annotationActivePointerId.value)
  }
  annotationActivePointerId.value = null
}

function stopAnnotationInteraction(pointerTarget?: EventTarget | null): void {
  releaseAnnotationPointerCapture(pointerTarget)
  annotationInteraction.value = { kind: 'idle' }
}

function updateSelectedAnnotation(viewportKey: string, annotationId: string, updater: (current: AnnotationOverlay) => AnnotationOverlay): void {
  const current = findAnnotation(viewportKey, annotationId)
  if (!current) {
    return
  }

  const nextAnnotation = updater(current)
  upsertAnnotation(viewportKey, nextAnnotation)
  selectAnnotation(viewportKey, nextAnnotation)
}

function offsetAnnotationPoints(points: MeasurementDraftPoint[], delta: number): MeasurementDraftPoint[] {
  const shiftedPoints = points.map((point) => ({
    x: Math.max(0, Math.min(1, point.x + delta)),
    y: Math.max(0, Math.min(1, point.y + delta))
  }))

  const changed = shiftedPoints.some((point, index) => point.x !== points[index]?.x || point.y !== points[index]?.y)
  if (changed) {
    return shiftedPoints
  }

  return points.map((point) => ({
    x: Math.max(0, Math.min(1, point.x - delta)),
    y: Math.max(0, Math.min(1, point.y - delta))
  }))
}

function areAnnotationPointSetsClose(a: MeasurementDraftPoint[], b: MeasurementDraftPoint[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((point, index) => {
    const other = b[index]
    return other != null && Math.abs(point.x - other.x) < 0.0005 && Math.abs(point.y - other.y) < 0.0005
  })
}

function handleAnnotationTextUpdate(payload: { viewportKey: string; annotationId: string; text: string }): void {
  updateSelectedAnnotation(payload.viewportKey, payload.annotationId, (current) => ({
    ...current,
    text: payload.text
  }))
}

function handleAnnotationColorUpdate(payload: { viewportKey: string; annotationId: string; color: string }): void {
  updateSelectedAnnotation(payload.viewportKey, payload.annotationId, (current) => ({
    ...current,
    color: payload.color
  }))
}

function handleAnnotationSizeUpdate(payload: { viewportKey: string; annotationId: string; size: AnnotationSize }): void {
  updateSelectedAnnotation(payload.viewportKey, payload.annotationId, (current) => ({
    ...current,
    size: payload.size
  }))
}

function copySelectedAnnotation(viewportKey?: string): boolean {
  const resolvedViewportKey = viewportKey ?? activeViewportKey.value
  const draft = getDraftAnnotation(resolvedViewportKey)
  if (!draft?.annotationId) {
    return false
  }

  const source = findAnnotation(resolvedViewportKey, draft.annotationId)
  if (!source) {
    return false
  }

  const occupiedPointSets = getAnnotations(resolvedViewportKey).map((annotation) => annotation.points)
  let copiedPoints = source.points
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const candidate = offsetAnnotationPoints(source.points, 0.01 * attempt)
    if (!occupiedPointSets.some((points) => areAnnotationPointSetsClose(points, candidate))) {
      copiedPoints = candidate
      break
    }
    copiedPoints = candidate
  }

  const copiedAnnotation: AnnotationOverlay = {
    ...source,
    annotationId: createAnnotationId(),
    points: copiedPoints
  }

  upsertAnnotation(resolvedViewportKey, copiedAnnotation)
  selectAnnotation(resolvedViewportKey, copiedAnnotation)
  annotationInteraction.value = { kind: 'idle' }
  return true
}

function deleteSelectedAnnotation(viewportKey?: string): boolean {
  const resolvedViewportKey = viewportKey ?? activeViewportKey.value
  const draft = getDraftAnnotation(resolvedViewportKey)
  if (!draft?.annotationId) {
    return false
  }

  removeAnnotation(resolvedViewportKey, draft.annotationId)
  setDraftAnnotation(resolvedViewportKey, null)
  annotationInteraction.value = { kind: 'idle' }
  return true
}

function handleAnnotationDelete(payload: { viewportKey: string; annotationId: string }): void {
  removeAnnotation(payload.viewportKey, payload.annotationId)
  const draft = getDraftAnnotation(payload.viewportKey)
  if (draft?.annotationId === payload.annotationId) {
    setDraftAnnotation(payload.viewportKey, null)
  }
  annotationInteraction.value = { kind: 'idle' }
}

function handleAnnotationCopy(payload: { viewportKey: string; annotationId: string }): void {
  const annotation = findAnnotation(payload.viewportKey, payload.annotationId)
  if (!annotation) {
    return
  }

  selectAnnotation(payload.viewportKey, annotation)
  void copySelectedAnnotation(payload.viewportKey)
}

function handleAnnotationPointerDown(event: PointerEvent, viewportKey: string): boolean {
  if (!isAnnotationOperationEnabled()) {
    return false
  }

  const pointerTarget = resolvePointerContainer(event)
  const point = getNormalizedViewportPoint(event)
  const imageElement = resolveViewportImageElement(event)
  if (!(pointerTarget instanceof HTMLElement) || !point || !imageElement) {
    return false
  }

  event.preventDefault()
  setActiveViewport(viewportKey as never)
  const rect = getRenderedImageRect(imageElement)
  const annotations = getAnnotations(viewportKey)
  const hit = findArrowAnnotationAtPoint(annotations, point, rect)

  if (hit?.handleIndex != null) {
    selectAnnotation(viewportKey, hit.annotation)
    setAnnotationPointerCapture(pointerTarget, event.pointerId)
    annotationInteraction.value = {
      kind: 'editing_handle',
      viewportKey,
      annotationId: hit.annotation.annotationId,
      handleIndex: hit.handleIndex
    }
    return true
  }

  if (hit) {
    selectAnnotation(viewportKey, hit.annotation)
    setAnnotationPointerCapture(pointerTarget, event.pointerId)
    annotationInteraction.value = {
      kind: 'move_pending',
      viewportKey,
      annotationId: hit.annotation.annotationId,
      startPoint: point,
      originalPoints: hit.annotation.points
    }
    return true
  }

  const nextDraft: AnnotationDraft = {
    toolType: 'arrow',
    points: [point, point],
    text: DEFAULT_ANNOTATION_TEXT,
    color: DEFAULT_ANNOTATION_COLOR,
    size: DEFAULT_ANNOTATION_SIZE
  }
  setDraftAnnotation(viewportKey, nextDraft)
  setAnnotationPointerCapture(pointerTarget, event.pointerId)
  annotationInteraction.value = {
    kind: 'creating',
    viewportKey
  }
  return true
}

function handleAnnotationPointerMove(event: PointerEvent): boolean {
  if (annotationActivePointerId.value !== event.pointerId) {
    return false
  }

  const interaction = annotationInteraction.value
  const point = getNormalizedViewportPoint(event)
  if (!point) {
    return true
  }

  if (interaction.kind === 'creating') {
    const draft = getDraftAnnotation(interaction.viewportKey)
    if (!draft) {
      return true
    }

    setDraftAnnotation(interaction.viewportKey, {
      ...draft,
      points: [draft.points[0], point]
    })
    return true
  }

  if (interaction.kind === 'move_pending') {
    const imageElement = resolveViewportImageElement(event)
    if (!imageElement) {
      return true
    }

    const rect = getRenderedImageRect(imageElement)
    const deltaX = (point.x - interaction.startPoint.x) * rect.width
    const deltaY = (point.y - interaction.startPoint.y) * rect.height
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < ANNOTATION_DRAG_START_THRESHOLD) {
      return true
    }

    annotationInteraction.value = {
      ...interaction,
      kind: 'moving'
    }
  }

  const movingInteraction = annotationInteraction.value
  if (movingInteraction.kind === 'moving') {
    updateSelectedAnnotation(
      movingInteraction.viewportKey,
      movingInteraction.annotationId,
      (current) => ({
        ...current,
        points: translateAnnotationPoints(
          movingInteraction.originalPoints,
          point.x - movingInteraction.startPoint.x,
          point.y - movingInteraction.startPoint.y
        )
      })
    )
    return true
  }

  if (interaction.kind === 'editing_handle') {
    updateSelectedAnnotation(interaction.viewportKey, interaction.annotationId, (current) => ({
      ...current,
      points: updateEditedArrowPoints(current.points, interaction.handleIndex, point)
    }))
    return true
  }

  return false
}

function handleAnnotationPointerUp(event: PointerEvent): boolean {
  if (annotationActivePointerId.value !== event.pointerId) {
    return false
  }

  const interaction = annotationInteraction.value
  if (interaction.kind === 'creating') {
    const draft = getDraftAnnotation(interaction.viewportKey)
    if (draft && isValidArrowAnnotation(draft.points)) {
      const annotation: AnnotationOverlay = {
        annotationId: createAnnotationId(),
        toolType: 'arrow',
        points: draft.points,
        text: draft.text,
        color: draft.color,
        size: draft.size
      }
      upsertAnnotation(interaction.viewportKey, annotation)
      selectAnnotation(interaction.viewportKey, annotation)
    } else {
      setDraftAnnotation(interaction.viewportKey, null)
    }

    stopAnnotationInteraction(event.currentTarget)
    return true
  }

  if (interaction.kind === 'move_pending' || interaction.kind === 'moving' || interaction.kind === 'editing_handle') {
    stopAnnotationInteraction(event.currentTarget)
    return true
  }

  return false
}

function handleAnnotationPointerCancel(event: PointerEvent): boolean {
  if (annotationActivePointerId.value !== event.pointerId) {
    return false
  }

  if (annotationInteraction.value.kind === 'creating') {
    setDraftAnnotation(annotationInteraction.value.viewportKey, null)
  }

  stopAnnotationInteraction(event.currentTarget)
  return true
}

function handleAnnotationPointerLeave(_viewportKey: string): void {
}

function handleViewportPointerDownWithAnnotations(event: PointerEvent, viewportKey: string): void {
  if (handleAnnotationPointerDown(event, viewportKey)) {
    return
  }
  handleViewportPointerDown(event, viewportKey)
}

function handleViewportPointerMoveWithAnnotations(event: PointerEvent): void {
  if (handleAnnotationPointerMove(event)) {
    return
  }
  handleViewportPointerMove(event)
}

function handleViewportPointerUpWithAnnotations(event: PointerEvent): void {
  if (handleAnnotationPointerUp(event)) {
    return
  }
  handleViewportPointerUp(event)
}

function handleViewportPointerCancelWithAnnotations(event: PointerEvent): void {
  if (handleAnnotationPointerCancel(event)) {
    return
  }
  handleViewportPointerCancel(event)
}

function handleViewportPointerLeaveWithAnnotations(viewportKey: string): void {
  handleAnnotationPointerLeave(viewportKey)
  handleViewportPointerLeave(viewportKey)
}

const isMtfCurveDialogOpen = ref(false)
const isQuickPreviewDropActive = ref(false)
const activeMtfState = computed(() => props.activeTab?.mtfState ?? null)
const canAcceptQuickPreviewDrop = computed(() => !props.isViewLoading && !props.activeTab)
const hasViewerTabs = computed(() => props.viewerTabs.length > 0)
const selectedMtfItem = computed(() => {
  const state = activeMtfState.value
  if (!state?.selectedMtfId) {
    return null
  }

  return state.items.find((item) => item.mtfId === state.selectedMtfId) ?? null
})

function handleOpenMtfCurve(): void {
  if (selectedMtfItem.value?.status === 'ready') {
    isMtfCurveDialogOpen.value = true
  }
}

function handleCloseMtfCurve(): void {
  isMtfCurveDialogOpen.value = false
}

function handleClearMtf(): void {
  isMtfCurveDialogOpen.value = false
  emit('mtfDelete', {
    mtfId: selectedMtfItem.value?.mtfId ?? null
  })
}

function resolveDraggedSeriesId(event: DragEvent): string {
  const transfer = event.dataTransfer
  if (!transfer) {
    return ''
  }

  return transfer.getData(SERIES_DRAG_TYPE) || transfer.getData('text/plain') || ''
}

function isSeriesDragEvent(event: DragEvent): boolean {
  const transfer = event.dataTransfer
  if (!transfer) {
    return false
  }

  const types = Array.from(transfer.types ?? [])
  return types.includes(SERIES_DRAG_TYPE) || types.includes('text/plain')
}

function handleQuickPreviewDragEnter(event: DragEvent): void {
  if (!canAcceptQuickPreviewDrop.value || !isSeriesDragEvent(event)) {
    return
  }

  event.preventDefault()
  isQuickPreviewDropActive.value = true
}

function handleQuickPreviewDragOver(event: DragEvent): void {
  if (!canAcceptQuickPreviewDrop.value || !isSeriesDragEvent(event)) {
    return
  }

  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  isQuickPreviewDropActive.value = true
}

function handleQuickPreviewDragLeave(event: DragEvent): void {
  const relatedTarget = event.relatedTarget
  if (relatedTarget instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
    return
  }

  isQuickPreviewDropActive.value = false
}

function handleQuickPreviewDrop(event: DragEvent): void {
  if (!canAcceptQuickPreviewDrop.value || !isSeriesDragEvent(event)) {
    isQuickPreviewDropActive.value = false
    return
  }

  event.preventDefault()
  const seriesId = resolveDraggedSeriesId(event).trim()
  isQuickPreviewDropActive.value = false
  if (!seriesId) {
    return
  }

  emit('quickPreviewSeriesDrop', seriesId)
}

function handleQuickPreviewDragEnd(): void {
  isQuickPreviewDropActive.value = false
}

function handleCopySelectedMtf(): void {
  if (!selectedMtfItem.value) {
    return
  }

  emit('mtfCopy', {
    mtfId: selectedMtfItem.value.mtfId
  })
}

function handleDeleteSelectedMtf(): void {
  handleClearMtf()
}

function handleSelectMtf(payload: { mtfId: string | null }): void {
  emit('mtfSelect', payload)
}

function copySelectedMtfAction(): boolean {
  if (!selectedMtfItem.value) {
    return false
  }

  handleCopySelectedMtf()
  return true
}

function deleteSelectedMtfAction(): boolean {
  if (!selectedMtfItem.value) {
    return false
  }

  handleDeleteSelectedMtf()
  return true
}

watch(
  () => activeMtfState.value,
  (value) => {
    if (!value?.items.length || !selectedMtfItem.value) {
      isMtfCurveDialogOpen.value = false
    }
  }
)

watch(
  () => props.activeOperation,
  (value) => {
    if (!value.startsWith('stack:annotate')) {
      clearDraftAnnotations()
      annotationInteraction.value = { kind: 'idle' }
    }
  }
)

watch(
  () => props.activeTabKey,
  () => {
    clearDraftAnnotations()
    annotationInteraction.value = { kind: 'idle' }
  }
)

const { canScrollTabsLeft, canScrollTabsRight, handleTabStripWheel, scrollTabs, tabStripRef, updateTabScrollState } =
  useViewerWorkspaceShell({
    activeTab: activeTabRef,
    activeTabKey: activeTabKeyRef,
    activeViewportKey,
    cleanupPointerInteractions,
    closeMenus,
    emitWorkspaceReady: (payload) => emit('workspaceReady', payload),
    isViewLoading: isViewLoadingRef,
    updateDraftMeasurementLabelLines,
    viewerTabs: viewerTabsRef,
    viewportHostRef
  })

function handleWorkspaceKeydown(event: KeyboardEvent): void {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return
  }

  const preferMtf = props.activeOperation === 'mtf'
  const preferAnnotation = props.activeOperation.startsWith('stack:annotate')

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    if (
      (preferAnnotation && copySelectedAnnotation()) ||
      (preferMtf && copySelectedMtfAction()) ||
      copySelectedMeasurement() ||
      copySelectedMtfAction() ||
      copySelectedAnnotation()
    ) {
      event.preventDefault()
    }
    return
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (
      (preferAnnotation && deleteSelectedAnnotation()) ||
      (preferMtf && deleteSelectedMtfAction()) ||
      deleteSelectedMeasurement() ||
      deleteSelectedMtfAction() ||
      deleteSelectedAnnotation()
    ) {
      event.preventDefault()
    }
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
    event.preventDefault()
    if (props.activeTabKey) {
      emit('closeTab', props.activeTabKey)
    }
    return
  }

  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    emit('toggleSidebar')
    return
  }

  if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && props.selectedSeriesId) {
    event.preventDefault()
    emit('quickPreviewSelectedSeries')
    return
  }

  if (event.key === 'F10' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    void handleExportCurrentView('png')
    return
  }

  if (event.key === 'F11' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    void handleExportCurrentView('dicom')
    return
  }

  handleNavigationShortcut(event)
}

function getActiveSliceInfo(): { current: number; total: number } | null {
  const tab = props.activeTab
  if (!tab) {
    return null
  }

  const raw =
    tab.viewType === 'MPR'
      ? tab.viewportSliceLabels?.[activeViewportKey.value as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'] ?? tab.sliceLabel
      : tab.sliceLabel
  const match = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return null
  }

  const current = Number(match[1])
  const total = Number(match[2])
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return null
  }

  return { current, total }
}

function handleNavigationShortcut(event: KeyboardEvent): void {
  const tab = props.activeTab
  if (!tab) {
    return
  }

  if (tab.viewType === 'Tag') {
    const currentIndex = tab.tagIndex ?? 0
    const total = Math.max(1, tab.tagTotal ?? 1)
    let nextIndex: number | null = null

    if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = total - 1
    } else if (event.key === 'ArrowLeft') {
      nextIndex = Math.max(0, currentIndex - (event.shiftKey ? 10 : 1))
    } else if (event.key === 'ArrowRight') {
      nextIndex = Math.min(total - 1, currentIndex + (event.shiftKey ? 10 : 1))
    }

    if (nextIndex != null && nextIndex !== currentIndex) {
      event.preventDefault()
      emit('tagIndexChange', { tabKey: tab.key, index: nextIndex })
    }
    return
  }

  if (tab.viewType !== 'Stack' && tab.viewType !== 'MPR') {
    return
  }

  const sliceInfo = getActiveSliceInfo()
  if (!sliceInfo) {
    return
  }

  let delta: number | null = null
  if (event.key === 'Home') {
    delta = 1 - sliceInfo.current
  } else if (event.key === 'End') {
    delta = sliceInfo.total - sliceInfo.current
  } else if (event.key === 'ArrowLeft') {
    delta = event.shiftKey ? -10 : -1
  } else if (event.key === 'ArrowRight') {
    delta = event.shiftKey ? 10 : 1
  }

  if (!delta) {
    return
  }

  event.preventDefault()
  handleViewportWheel({
    viewportKey: activeViewportKey.value,
    deltaY: delta,
    exact: true
  })
}

onMounted(() => {
  window.addEventListener('keydown', handleWorkspaceKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWorkspaceKeydown)
  isQuickPreviewDropActive.value = false
  clearExportNoticeTimer()
  closeExportNameDialog(null)
  stopAnnotationInteraction()
})
</script>

<template>
  <main
    class="theme-shell-panel relative min-h-0 min-w-0 overflow-hidden rounded-[26px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_56px_rgba(0,0,0,0.28)]"
  >
    <div
      v-if="!hasSelectedSeries"
      class="grid h-full place-items-center rounded-[20px] border border-dashed p-8 text-center transition duration-150"
      :class="isQuickPreviewDropActive ? 'theme-drop-active' : 'theme-shell-panel-soft'"
      @dragenter="handleQuickPreviewDragEnter"
      @dragover="handleQuickPreviewDragOver"
      @dragleave="handleQuickPreviewDragLeave"
      @drop="handleQuickPreviewDrop"
      @dragend="handleQuickPreviewDragEnd"
    >
      <div class="max-w-xl space-y-3">
        <div class="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--theme-text-muted)]">{{ t('viewerWorkspace') }}</div>
        <div class="text-3xl font-semibold tracking-[0.08em] text-[var(--theme-text-primary)]">{{ isQuickPreviewDropActive ? t('dropQuickPreview') : t('waitingSeries') }}</div>
        <div class="mx-auto h-px w-24" :style="{ background: 'linear-gradient(to right, transparent, color-mix(in srgb, var(--theme-accent) 45%, transparent), transparent)' }"></div>
        <p class="text-sm leading-7 text-[var(--theme-text-secondary)]">
          {{ isQuickPreviewDropActive ? t('dropQuickPreviewDesc') : message || t('waitingSeriesDesc') }}
        </p>
      </div>
    </div>

    <div v-else class="flex h-full min-h-0 flex-col gap-3">
      <ViewerTabStrip
        v-if="hasViewerTabs"
        v-model:tab-strip-ref="tabStripRef"
        :active-tab-key="activeTabKey"
        :can-scroll-tabs-left="canScrollTabsLeft"
        :can-scroll-tabs-right="canScrollTabsRight"
        :viewer-tabs="viewerTabs"
        @activate-tab="emit('activateTab', $event)"
        @close-tab="emit('closeTab', $event)"
        @scroll-tabs="scrollTabs"
        @tab-strip-scroll="updateTabScrollState"
        @tab-strip-wheel="handleTabStripWheel"
      />

      <ViewerToolbar
        v-if="activeTab && activeTab.viewType !== 'Tag'"
        :active-tab="activeTab"
        :active-tools="activeTools"
        :are-toolbar-actions-disabled="areToolbarActionsDisabled"
        :is-playing="isPlaying"
        :is-playback-paused="isPlaybackPaused"
        :is-tool-selected="isToolSelected"
        :menu-icon-size="menuIconSize"
        :open-menu-key="openMenuKey"
        :stack-tool-selections="stackToolSelections"
        :toggle-icon-size="toggleIconSize"
        :toolbar-icon-size="toolbarIconSize"
        @apply-tool="applyTool"
        @end-playback="endPlayback"
        @pause-playback="pausePlayback"
        @select-tool-option="selectToolOption"
        @set-menu-open="setMenuOpen"
      />

      <div v-if="isViewLoading" class="theme-shell-panel-strong grid flex-1 place-items-center rounded-[20px] border p-8">
        <div class="flex items-center gap-3 text-sm text-[var(--theme-text-secondary)]">
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--theme-accent)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--theme-accent)_14%,transparent)]"></span>
          <span>{{ t('loadingView') }}</span>
        </div>
      </div>

      <div
        v-else-if="activeTab"
        ref="viewportHostRef"
        class="theme-viewport-surface relative flex-1 overflow-hidden rounded-[20px] border p-2.5"
      >
        <div
          v-if="activeTab.viewType === '3D' && isVolumeConfigPanelOpen && activeVolumeRenderConfig"
          class="absolute right-5 top-5 z-[20]"
        >
          <VolumeRenderConfigPanel
            :config="activeVolumeRenderConfig"
            @config-change="emit('volumeConfigChange', $event)"
          />
        </div>

        <div
          v-if="activeTab.viewType === 'MPR' && isMprMipPanelOpen && activeMprMipConfig"
          class="pointer-events-none absolute inset-y-5 right-5 z-[20] flex items-start"
        >
          <MprMipConfigPanel
            class="pointer-events-auto max-h-full"
            :config="activeMprMipConfig"
            @config-change="updateActiveMprMipConfig"
          />
        </div>

        <StackView
          v-if="activeTab.viewType === 'Stack'"
          :active-tab="activeTab"
          :annotations="getAnnotations('single')"
          :corner-info="activeTab.cornerInfo"
          :cursor-class="getViewportCursorClass('single')"
          :draft-annotation="getDraftAnnotation('single')"
          :draft-measurement-mode="getDraftMeasurementMode('single')"
          :draft-measurement="getDraftMeasurement('single')"
          :measurements="getVisibleCommittedMeasurements('single')"
          :mtf-draft-mode="getMtfDraftMode('single')"
          :mtf-draft="getMtfDraft('single')"
          :mtf-items="getMtfItems('single')"
          :selected-mtf-id="activeMtfState?.selectedMtfId ?? null"
          @copy-annotation="handleAnnotationCopy"
          @delete-annotation="handleAnnotationDelete"
          @copy-selected-measurement="copySelectedMeasurement($event)"
          @delete-selected-measurement="deleteSelectedMeasurement($event)"
          @clear-mtf="handleDeleteSelectedMtf"
          @copy-selected-mtf="handleCopySelectedMtf"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @open-mtf-curve="handleOpenMtfCurve"
          @select-mtf="handleSelectMtf"
          @viewport-click="handleViewportClick"
          @viewport-wheel="handleViewportWheel"
          @pointer-down="handleViewportPointerDownWithAnnotations"
          @pointer-leave="handleViewportPointerLeaveWithAnnotations"
          @pointer-move="handleViewportPointerMoveWithAnnotations"
          @pointer-up="handleViewportPointerUpWithAnnotations"
          @pointer-cancel="handleViewportPointerCancelWithAnnotations"
          @update-annotation-color="handleAnnotationColorUpdate"
          @update-annotation-size="handleAnnotationSizeUpdate"
          @update-annotation-text="handleAnnotationTextUpdate"
        />

        <MprView
          v-else-if="activeTab.viewType === 'MPR'"
          :active-tab="activeTab"
          :active-viewport-key="activeViewportKey"
          :get-annotations="(viewportKey) => getAnnotations(viewportKey)"
          :get-cursor-class="(viewportKey) => getViewportCursorClass(viewportKey)"
          :get-draft-annotation="(viewportKey) => getDraftAnnotation(viewportKey)"
          :get-draft-measurement-mode="(viewportKey) => getDraftMeasurementMode(viewportKey)"
          :get-draft-measurement="(viewportKey) => getDraftMeasurement(viewportKey)"
          :get-measurements="(viewportKey) => getVisibleCommittedMeasurements(viewportKey)"
          :get-mtf-draft-mode="(viewportKey) => getMtfDraftMode(viewportKey)"
          :get-mtf-draft="(viewportKey) => getMtfDraft(viewportKey)"
          :get-mtf-items="(viewportKey) => getMtfItems(viewportKey)"
          :selected-mtf-id="activeMtfState?.selectedMtfId ?? null"
          :get-corner-info="(viewportKey) => getMprCornerInfo(viewportKey)"
          @copy-annotation="handleAnnotationCopy"
          @delete-annotation="handleAnnotationDelete"
          @copy-selected-measurement="copySelectedMeasurement($event)"
          @delete-selected-measurement="deleteSelectedMeasurement($event)"
          @clear-mtf="handleDeleteSelectedMtf"
          @copy-selected-mtf="handleCopySelectedMtf"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @open-mtf-curve="handleOpenMtfCurve"
          @select-mtf="handleSelectMtf"
          @viewport-click="handleViewportClick"
          @viewport-wheel="handleViewportWheel"
          @pointer-down="handleViewportPointerDownWithAnnotations"
          @pointer-leave="handleViewportPointerLeaveWithAnnotations"
          @pointer-move="handleViewportPointerMoveWithAnnotations"
          @pointer-up="handleViewportPointerUpWithAnnotations"
          @pointer-cancel="handleViewportPointerCancelWithAnnotations"
          @update-annotation-color="handleAnnotationColorUpdate"
          @update-annotation-size="handleAnnotationSizeUpdate"
          @update-annotation-text="handleAnnotationTextUpdate"
        />

        <VolumeView
          v-else-if="activeTab.viewType === '3D'"
          :active-tab="activeTab"
          @viewport-click="handleViewportClick"
          @pointer-down="handleViewportPointerDown"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />

        <DicomTagView
          v-else
          :active-tab="activeTab"
          @index-change="emit('tagIndexChange', $event)"
        />

        <MtfCurveDialog
          :is-open="isMtfCurveDialogOpen"
          :mtf-item="selectedMtfItem"
          @close="handleCloseMtfCurve"
        />
      </div>

      <div
        v-else
        class="grid flex-1 place-items-center rounded-[20px] border border-dashed p-8 text-center transition duration-150"
        :class="isQuickPreviewDropActive ? 'theme-drop-active' : 'theme-shell-panel-soft'"
        @dragenter="handleQuickPreviewDragEnter"
        @dragover="handleQuickPreviewDragOver"
        @dragleave="handleQuickPreviewDragLeave"
        @drop="handleQuickPreviewDrop"
        @dragend="handleQuickPreviewDragEnd"
      >
        <div class="max-w-lg space-y-3">
          <div class="text-2xl font-semibold tracking-[0.06em] text-[var(--theme-text-primary)]">{{ isQuickPreviewDropActive ? t('dropQuickPreview') : t('openView') }}</div>
          <p class="text-sm leading-7 text-[var(--theme-text-secondary)]">
            {{ isQuickPreviewDropActive ? t('emptyDropQuickPreviewDesc') : message || t('openViewDesc') }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="isExportNameDialogOpen"
      class="absolute inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      :aria-label="locale === 'zh-CN' ? '设置导出名称' : 'Set export name'"
      @click.self="cancelExportNameDialog"
    >
      <form
        class="w-[min(480px,100%)] rounded-[24px] border border-[color:color-mix(in_srgb,var(--theme-accent)_34%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-surface-panel-strong)_92%,#050914)] p-5 shadow-[0_28px_72px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.06)]"
        @submit.prevent="confirmExportNameDialog"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-base font-semibold text-[var(--theme-text-primary)]">
              {{ locale === 'zh-CN' ? '设置导出名称' : 'Set export name' }}
            </div>
            <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">
              {{ locale === 'zh-CN' ? '名称可编辑，文件后缀由导出格式固定。' : 'Edit the name. The file extension is fixed by the export format.' }}
            </div>
          </div>
          <div class="shrink-0 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-1 text-xs font-semibold uppercase text-[var(--theme-text-secondary)]">
            {{ exportNameDialogFormat === 'png' ? 'PNG' : 'DICOM' }}
          </div>
        </div>

        <label class="mt-5 block text-xs font-semibold text-[var(--theme-text-secondary)]" for="export-file-name-input">
          {{ locale === 'zh-CN' ? '文件名称' : 'File name' }}
        </label>
        <div
          class="mt-2 flex min-w-0 overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_20%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_82%,#0f172a)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_28px_rgba(0,0,0,0.2)] transition focus-within:border-[var(--theme-accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-accent)_18%,transparent),inset_0_1px_0_rgba(255,255,255,0.07)]"
        >
          <input
            id="export-file-name-input"
            ref="exportNameInputRef"
            v-model="exportNameInput"
            class="min-w-0 flex-1 bg-[color:color-mix(in_srgb,var(--theme-surface-card)_88%,#111827)] px-3 py-2.5 text-sm text-[var(--theme-text-primary)] outline-none"
            type="text"
            autocomplete="off"
            @keydown.esc.prevent="cancelExportNameDialog"
          />
          <div class="flex shrink-0 items-center border-l border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,black)] px-3 text-sm font-semibold text-[var(--theme-text-secondary)]">
            .{{ exportNameExtension }}
          </div>
        </div>
        <div v-if="exportNameError" class="mt-2 text-xs leading-5 text-rose-300">{{ exportNameError }}</div>
        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-2.5 text-xs font-semibold text-[var(--theme-text-secondary)] transition hover:text-[var(--theme-text-primary)]"
            @click="cancelExportNameDialog"
          >
            {{ locale === 'zh-CN' ? '取消' : 'Cancel' }}
          </button>
          <button type="submit" class="theme-button-primary rounded-2xl px-5 py-2.5 text-xs font-semibold">
            {{ locale === 'zh-CN' ? '导出' : 'Export' }}
          </button>
        </div>
      </form>
    </div>

    <div
      v-if="exportNotice"
      class="absolute bottom-5 right-5 z-[80] w-[min(420px,calc(100%-40px))] rounded-[20px] border border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-surface-panel-strong)_94%,black)] p-4 shadow-[0_22px_44px_rgba(0,0,0,0.42)] backdrop-blur"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ exportNotice.title }}</div>
          <div class="mt-1 break-all text-xs leading-6 text-[var(--theme-text-secondary)]">{{ exportNotice.message }}</div>
        </div>
        <button
          type="button"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-sm text-[var(--theme-text-secondary)] transition hover:text-[var(--theme-text-primary)]"
          :aria-label="locale === 'zh-CN' ? '关闭导出提示' : 'Close export notification'"
          @click="exportNotice = null"
        >
          x
        </button>
      </div>
      <div v-if="exportNotice.canOpenLocation" class="mt-3 flex justify-end">
        <button
          type="button"
          class="theme-button-primary rounded-2xl px-4 py-2 text-xs font-semibold"
          @click="handleOpenExportLocation"
        >
          {{ locale === 'zh-CN' ? '打开文件位置' : 'Open File Location' }}
        </button>
      </div>
    </div>
  </main>
</template>
