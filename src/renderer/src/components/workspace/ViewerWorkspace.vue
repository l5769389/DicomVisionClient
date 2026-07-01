<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import type { ViewOperationType } from '@shared/viewerConstants'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  AnnotationSize,
  CompareSyncSettingKey,
  CornerInfo,
  CornerPosition,
  DrawingScope,
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementDraftPoint,
  MeasurementOverlay,
  MprLayoutKey,
  MprCrosshairInteractionPayload,
  MprSegmentationConfigActionType,
  MprSegmentationConfig,
  QaWaterAnalysis,
  QaWaterMetricKey,
  ViewerLayoutTemplate,
  ViewerTabItem,
  ViewType,
  WorkspaceReadyPayload
} from '../../types/viewer'
import {
  findArrowAnnotationAtScreenPoint,
  isValidArrowAnnotation,
  translateAnnotationPoints,
  updateEditedArrowPoints,
  type AnnotationProjectionFrame,
  type AnnotationScreenPoint
} from '../../composables/annotations/annotationGeometry'
import { getSmoothCurveSegments } from '../../composables/measurements/measurementGeometry'
import { useViewerWorkspacePointer } from '../../composables/measurements/useViewerWorkspacePointer'
import { filterMeasurementDraftByPreferences, filterMeasurementOverlayByPreferences } from '../../composables/measurements/measurementLabelPreferences'
import { useViewerWorkspaceShell } from '../../composables/workspace/shell/useViewerWorkspaceShell'
import { useWorkspaceHotkeys } from '../../composables/workspace/shell/useWorkspaceHotkeys'
import { useQuickPreviewDrop } from '../../composables/workspace/shell/useQuickPreviewDrop'
import ViewerTabStrip from './ViewerTabStrip.vue'
import ViewerToolbar from './shell/ViewerToolbar.vue'
import ViewerToolbarDock from './shell/ViewerToolbarDock.vue'
import type { StackTool, StackToolOptionSelectBehavior } from './shell/toolbarTypes'
import type { VolumeRenderConfig } from '../../types/viewer'
import { useViewerWorkspaceToolbar } from '../../composables/workspace/toolbar/useViewerWorkspaceToolbar'
import type { ViewerToolbarActionPayload } from '../../composables/workspace/operations/viewActionTypes'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import { applyViewportCornerInfoPreference } from '../../composables/ui/viewportCornerInfo'
import { parseSliceLabel, useKeySliceStars } from '../../composables/workspace/slices/useKeySliceStars'
import type { ViewerExportFormat, ViewerExportOverlays } from '../../composables/workspace/export/viewExport'
import { resolveBackendErrorDetail } from '../../composables/workspace/tasks/workspaceStatus'
import { viewerRuntime, type DicomDropInput } from '../../platform/runtime'
import type { FusionRegistrationExportMode, FusionRegistrationExportResponse } from '../../services/typedApi'
import { useWorkspaceExportUi } from '../../composables/workspace/export/useWorkspaceExportUi'
import { DEFAULT_MPR_LAYOUT_KEY, parseMprLayoutSelectionValue } from '../../composables/workspace/layout/mprLayoutOptions'
import {
  COMPARE_STACK_SOURCE_PANE_KEY,
  COMPARE_STACK_TARGET_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  isFusionPaneKey
} from '../../composables/workspace/views/viewerWorkspaceTabs'
import {
  CompareStackView,
  DicomTagView,
  FourDView,
  LayoutView,
  MprView,
  PetCtFusionView,
  StackView,
  VolumeView
} from './asyncWorkspaceViews'

const MprMipConfigPanel = defineAsyncComponent(() => import('./MprMipConfigPanel.vue'))
const MprSegmentationPanel = defineAsyncComponent(() => import('./MprSegmentationPanel.vue'))
const VolumeRenderConfigPanel = defineAsyncComponent(() => import('./VolumeRenderConfigPanel.vue'))
const MeasurementMetricsPanelContent = defineAsyncComponent(() => import('./results/MeasurementMetricsPanelContent.vue'))
const MtfCurvePanelContent = defineAsyncComponent(() => import('./results/MtfCurvePanelContent.vue'))
const QaWaterResultPanelContent = defineAsyncComponent(() => import('./results/QaWaterResultPanelContent.vue'))
const ViewerResultDock = defineAsyncComponent(() => import('./results/ViewerResultDock.vue'))
const FusionRegistrationSaveDialog = defineAsyncComponent(() => import('./export/FusionRegistrationSaveDialog.vue'))
const WorkspaceExportNameDialog = defineAsyncComponent(() => import('./export/WorkspaceExportNameDialog.vue'))
const WorkspaceExportNotice = defineAsyncComponent(() => import('./export/WorkspaceExportNotice.vue'))
let waterPhantomQaModulePromise: Promise<typeof import('../../composables/qa/waterPhantomQa')> | null = null

function loadWaterPhantomQa(): Promise<typeof import('../../composables/qa/waterPhantomQa')> {
  waterPhantomQaModulePromise ??= import('../../composables/qa/waterPhantomQa')
  return waterPhantomQaModulePromise
}

const props = defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
  activeTabKey: string
  hasSelectedSeries: boolean
  isViewLoading: boolean
  message: string
  selectedSeriesId: string
  viewerPlatform: 'desktop' | 'web'
  viewerTabs: ViewerTabItem[]
}>()

const emit = defineEmits<{
  activateTab: [tabKey: string]
  activeViewportChange: [viewportKey: string]
  closeTab: [tabKey: string]
  closeOtherTabs: [tabKey: string]
  measurementDraft: [payload: { viewportKey: string; toolType: MeasurementDraft['toolType']; phase: 'start' | 'move' | 'end'; points: { x: number; y: number }[]; scope?: DrawingScope }]
  measurementCreate: [payload: {
    viewportKey: string
    toolType: MeasurementDraft['toolType']
    points: { x: number; y: number }[]
    measurementId?: string
    labelLines?: string[]
    scope?: DrawingScope
  }]
  measurementDelete: [payload: { viewportKey: string; measurementId: string }]
  annotationOperation: [payload: {
    viewportKey: string
    annotationId?: string
    actionType: 'end' | 'delete'
    toolType?: AnnotationDraft['toolType']
    points?: { x: number; y: number }[]
    text?: string
    color?: string
    size?: AnnotationSize
    scope?: DrawingScope
    sliceIndex?: number | null
  }]
  tagIndexChange: [payload: { tabKey: string; index: number }]
  mtfClear: []
  mtfCommit: [payload: { viewportKey: string; points: { x: number; y: number }[]; mtfId?: string; scope?: DrawingScope }]
  mtfCopy: [payload?: { mtfId?: string | null }]
  mtfDelete: [payload?: { mtfId?: string | null }]
  mtfSelect: [payload: { mtfId: string | null }]
  mprCrosshair: [payload: MprCrosshairInteractionPayload]
  fourDPhaseChange: [payload: { tabKey: string; phaseIndex: number }]
  fourDFpsChange: [payload: { tabKey: string; fps: number }]
  fourDPlaybackChange: [payload: { tabKey: string; isPlaying: boolean }]
  compareSyncChange: [payload: { tabKey: string; key: CompareSyncSettingKey; value: boolean }]
  setActiveOperation: [value: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null; row?: number | null; col?: number | null }]
  triggerViewAction: [payload: ViewerToolbarActionPayload]
  volumeConfigChange: [config: VolumeRenderConfig]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  fusionRegistrationDrag: [payload: {
    deltaX: number
    deltaY: number
    phase: 'start' | 'move' | 'end'
    subOpType: 'translate' | 'rotate'
    viewportKey: string
    anchorX?: number
    anchorY?: number
    currentX?: number
    currentY?: number
    pivotX?: number
    pivotY?: number
    rotationDeltaDegrees?: number
  }]
  fusionConfigChange: [payload: { manualRegistration?: boolean; pseudocolorPreset?: string; petUnit?: string; action?: 'reset' | 'save' }]
  viewportWheel: [payload: number | { viewportKey: string; deltaY: number; exact?: boolean }]
  viewportLayoutChange: [payload: { layoutKey: MprLayoutKey }]
  quickPreviewSeriesDrop: [seriesId: string]
  quickPreviewSelectedSeries: []
  openSeriesView: [seriesId: string, viewType: ViewType]
  openLayoutView: [template: ViewerLayoutTemplate]
  openSettings: [sectionKey?: string]
  layoutSlotDicomDrop: [payload: { tabKey: string; slotId: string; drop: DicomDropInput }]
  layoutSlotSeriesDrop: [payload: { tabKey: string; slotId: string; seriesId: string; folderPath?: string; seriesInstanceUid?: string | null }]
  toggleSidebar: []
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = useTemplateRef<HTMLElement>('viewportHostRef')
const workspaceContentRef = useTemplateRef<HTMLElement>('workspaceContentRef')
const exportNameInputRef = ref<HTMLInputElement | null>(null)
const activeTabRef = computed(() => props.activeTab)
const activeTabKeyRef = computed(() => props.activeTabKey)
const activeOperationRef = computed(() => props.activeOperation)
const isViewLoadingRef = computed(() => props.isViewLoading)
const selectedSeriesIdRef = computed(() => props.selectedSeriesId)
const viewerTabsRef = computed(() => props.viewerTabs)
const { locale, t, overlayCopy, workspaceExportCopy } = useUiLocale()
const {
  exportPreference,
  drawingScopePreference,
  measurementStylePreference,
  mprDefaultLayoutKey,
  mprSegmentationStylePreference,
  qaWaterMetrics,
  roiStatOptions,
  setWorkspaceDockPreference,
  viewerToolbarPlacement,
  viewportCornerInfoPreference,
  workspaceDockPreference
} = useUiPreferences()
const mprSegmentationDefaultThresholdColor = computed(() => mprSegmentationStylePreference.value.thresholdColor)
const mprSegmentationDefaultVoiColor = computed(() => mprSegmentationStylePreference.value.voiColor)
const {
  getStarredSliceIndexes,
  getStarredSliceCount,
  isSliceStarred,
  toggleSliceStar
} = useKeySliceStars()
const DEFAULT_ANNOTATION_TEXT = ''
const ANNOTATION_DRAG_START_THRESHOLD = 3
const ANNOTATION_POINT_CLOSE_EPSILON = 0.0005
const EXPORT_LABEL_LINE_HEIGHT_PX = 18
const TOP_RESULT_DOCK_MIN_CONTENT_WIDTH = 1280
const RIGHT_TOOLBAR_DOCK_MIN_WIDTH = 196
const RIGHT_TOOLBAR_DOCK_MAX_WIDTH = 360
const RIGHT_TOOLBAR_DOCK_COLLAPSE_THRESHOLD = 170
const RIGHT_RESULT_DOCK_MIN_WIDTH = 300
const RIGHT_RESULT_DOCK_MAX_WIDTH = 520
const RIGHT_RESULT_DOCK_COLLAPSE_THRESHOLD = 260
const pendingDeletedMeasurementIds = ref<Partial<Record<string, string[]>>>({})
const previousDrawingScopePreference = ref({ ...drawingScopePreference.value })
type WorkspaceResultPanel = 'measurement' | 'mtfCurve' | 'qaWater'

type AnnotationInteractionState =
  | { kind: 'idle' }
  | { kind: 'creating'; viewportKey: string }
  | {
      kind: 'move_pending'
      viewportKey: string
      annotationId: string
      startPoint: MeasurementDraftPoint
      startScreenPoint: AnnotationScreenPoint
      originalPoints: MeasurementDraftPoint[]
    }
  | {
      kind: 'moving'
      viewportKey: string
      annotationId: string
      startPoint: MeasurementDraftPoint
      startScreenPoint: AnnotationScreenPoint
      originalPoints: MeasurementDraftPoint[]
    }
  | { kind: 'editing_handle'; viewportKey: string; annotationId: string; handleIndex: number }

const {
  activeViewportKey,
  clearDrawingDrafts,
  cleanupPointerInteractions,
  copySelectedMeasurement,
  deleteSelectedMeasurement,
  draftMeasurements,
  finishPointSequenceMeasurement,
  getMtfDraft,
  getMtfDraftMode,
  getDraftMeasurementMode,
  getViewportIdleCursorClass,
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
  emitMeasurementDraft: (payload) => emit('measurementDraft', {
    ...payload,
    scope: drawingScopePreference.value.measurement
  }),
  emitMeasurementCreate: (payload) => {
    clearMeasurementPendingDelete(payload.viewportKey, payload.measurementId)
    emit('measurementCreate', {
      ...payload,
      scope: drawingScopePreference.value.measurement
    })
  },
  emitMeasurementDelete: emitMeasurementDeleteRequest,
  emitMtfCommit: (payload) => emit('mtfCommit', {
    ...payload,
    scope: drawingScopePreference.value.mtf
  }),
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
  activeMprSegmentationConfig,
  activeVolumeRenderConfig,
  activateSegmentationSelectionMode,
  applyTool,
  areToolbarActionsDisabled,
  closeMprSegmentationPanel,
  closeMenus,
  endPlayback,
  handleViewportClick,
  handleViewportWheel: handleViewportWheelCore,
  isPlaying,
  isPlaybackPaused,
  isMprMipPanelOpen,
  isMprSegmentationPanelOpen,
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
  updateActiveMprMipConfig,
  updateActiveMprSegmentationConfig
} = useViewerWorkspaceToolbar({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitSetActiveOperation: (value) => emit('setActiveOperation', value),
  emitTriggerViewAction: (payload) => handleToolbarViewAction(payload),
  emitCompareSyncChange: (payload) => emit('compareSyncChange', payload),
  emitOpenLayoutView: (template) => emit('openLayoutView', template),
  emitViewportWheel: (payload) => emit('viewportWheel', payload),
  emitOpenSeriesView: (seriesId, viewType) => emit('openSeriesView', seriesId, viewType),
  exportCurrentView: (format, viewportKey) => {
    void handleExportCurrentView(format, viewportKey)
  },
  activeViewportKey,
  cleanupPointerInteractions,
  stopViewportDrag: () => stopViewportDrag(),
  setActiveViewport
})

function closeVolumeConfigPanel(): void {
  isVolumeConfigPanelOpen.value = false
}

function handleMprSegmentationConfigChange(config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType): void {
  updateActiveMprSegmentationConfig(config, actionType)
}

function handleMprSegmentationModeChange(mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null): void {
  if (viewportKey) {
    setActiveViewport(viewportKey)
  }
  activateSegmentationSelectionMode(mode)
}

function closeMprMipPanel(): void {
  isMprMipPanelOpen.value = false
}

function closeRightToolbarUtilityPanel(): void {
  closeVolumeConfigPanel()
  closeMprMipPanel()
  closeMprSegmentationPanel()
}

function handleToolbarApplyTool(tool: StackTool, behavior?: StackToolOptionSelectBehavior): void {
  closeResultPanel()
  applyTool(tool, behavior)
  if (tool.key === 'qa' && isWaterPhantomQaOperation(stackToolSelections.value.qa ?? '')) {
    requestQaWaterResultPanel()
  }
}

function handleToolbarSelectToolOption(tool: StackTool, optionValue: string, behavior?: StackToolOptionSelectBehavior): void {
  closeResultPanel()
  selectToolOption(tool, optionValue, behavior)
  if (tool.key === 'qa' && isWaterPhantomQaOperation(optionValue)) {
    requestQaWaterResultPanel()
  }
}

function handleToolbarSetMenuOpen(toolKey: string | null): void {
  if (toolKey) {
    closeResultPanel()
  }
  setMenuOpen(toolKey)
}

const activeMprLayoutKey = computed(() => {
  const selectedLayout = parseMprLayoutSelectionValue(stackToolSelections.value.mprLayout)
  if (activeTabRef.value?.viewType === '4D' && selectedLayout === 'mpr-3d') {
    return DEFAULT_MPR_LAYOUT_KEY
  }
  return selectedLayout ?? mprDefaultLayoutKey.value ?? DEFAULT_MPR_LAYOUT_KEY
})

const isVolumeConfigPanelAvailable = computed(() => {
  if (!activeTabRef.value) {
    return false
  }
  return activeTabRef.value.viewType === '3D' || (activeTabRef.value.viewType === 'MPR' && activeMprLayoutKey.value === 'mpr-3d')
})

const isRightToolbarLayout = computed(() => viewerToolbarPlacement.value === 'right')
const shouldShowTopToolbar = computed(() => Boolean(activeTabRef.value && activeTabRef.value.viewType !== 'Tag' && activeTabRef.value.viewType !== '4D' && !isRightToolbarLayout.value))
const shouldShowRightToolbarDock = computed(() => Boolean(activeTabRef.value && activeTabRef.value.viewType !== 'Tag' && activeTabRef.value.viewType !== '4D' && isRightToolbarLayout.value))
const rightToolbarUtilityPanelKind = computed<'volume' | 'mprMip' | 'segmentation' | null>(() => {
  const activeTab = activeTabRef.value
  if (!shouldShowRightToolbarDock.value || !activeTab) {
    return null
  }
  if (isVolumeConfigPanelAvailable.value && isVolumeConfigPanelOpen.value && activeVolumeRenderConfig.value) {
    return 'volume'
  }
  if ((activeTab.viewType === 'MPR' || activeTab.viewType === '4D') && isMprMipPanelOpen.value && activeMprMipConfig.value) {
    return 'mprMip'
  }
  if (activeTab.viewType === 'MPR' && isMprSegmentationPanelOpen.value && activeMprSegmentationConfig.value) {
    return 'segmentation'
  }
  return null
})
const rightToolbarUtilityPanelIcon = computed(() => {
  if (rightToolbarUtilityPanelKind.value === 'volume') {
    return 'settings'
  }
  if (rightToolbarUtilityPanelKind.value === 'segmentation') {
    return 'segmentation'
  }
  return 'mip'
})
const rightToolbarUtilityPanelTitle = computed(() => {
  if (rightToolbarUtilityPanelKind.value === 'volume') {
    return '3D Params'
  }
  if (rightToolbarUtilityPanelKind.value === 'segmentation') {
    return locale.value === 'zh-CN' ? '阈值分割' : 'Segmentation'
  }
  return 'MIP Params'
})
const rightToolbarUtilityPanelToolKey = computed(() => {
  if (rightToolbarUtilityPanelKind.value === 'volume') {
    return 'volumeParams'
  }
  if (rightToolbarUtilityPanelKind.value === 'mprMip') {
    return 'mprMip'
  }
  if (rightToolbarUtilityPanelKind.value === 'segmentation') {
    return 'segmentation'
  }
  return null
})

const annotationStore = ref<Record<string, Partial<Record<string, AnnotationOverlay[]>>>>({})
const draftAnnotations = ref<Partial<Record<string, AnnotationDraft | null>>>({})
const pendingDeletedAnnotationIds = ref<Partial<Record<string, string[]>>>({})
const annotationInteraction = ref<AnnotationInteractionState>({ kind: 'idle' })
const annotationActivePointerId = ref<number | null>(null)
const qaWaterAnalysis = ref<QaWaterAnalysis | null>(null)
const qaWaterAnalysisCache = ref<Record<string, QaWaterAnalysis>>({})
let qaWaterAnalysisRequestId = 0
const activeResultPanel = ref<WorkspaceResultPanel | null>(null)
const {
  cancelExportNameDialog,
  cleanupExportUi,
  confirmExportNameDialog,
  exportNameDialogFormat,
  exportNameError,
  exportNameExtension,
  exportNameInput,
  exportNotice,
  handleOpenExportLocation,
  isExportNameDialogOpen,
  requestExportFileName,
  showExportFailureNotice,
  showExportNotice
} = useWorkspaceExportUi(workspaceExportCopy, exportNameInputRef)
const isFusionRegistrationSaveDialogOpen = ref(false)
const isFusionRegistrationSaving = ref(false)
const fusionRegistrationSaveMode = ref<FusionRegistrationExportMode>('newDicom')
const fusionRegistrationSeriesDescription = ref('')
const fusionRegistrationOutputDirectory = ref('')
const fusionRegistrationSaveError = ref<string | null>(null)
const lastFusionRegistrationExport = ref<FusionRegistrationExportResponse | null>(null)
const fusionRegistrationFileInputRef = ref<HTMLInputElement | null>(null)
const isFusionRegistrationWebMode = computed(() => viewerRuntime.platform === 'web')
const fusionRegistrationSourceSeriesDescription = computed(() => getFusionPetSeriesDescription(props.activeTab) || 'PET')
const canOpenFusionRegistrationFolder = computed(() =>
  !isFusionRegistrationWebMode.value && Boolean(lastFusionRegistrationExport.value?.directoryPath && window.viewerApi?.openExportLocation)
)

function resolveActiveExportImageElement(viewportKey: string): HTMLImageElement | null {
  const host = viewportHostRef.value
  if (!host) {
    return null
  }

  const surface = host.querySelector<HTMLElement>(`[data-active-render-surface="true"][data-viewport-key="${viewportKey}"]`)
  const image = surface?.querySelector<HTMLImageElement>('.viewer-image') ?? null
  return image instanceof HTMLImageElement ? image : null
}

function isWaterPhantomQaOperation(value: string): boolean {
  const normalized = value.startsWith('stack:') ? value.slice('stack:'.length) : value
  return normalized === 'qa:water-phantom' || normalized === 'qa:water-accuracy' || normalized === 'qa:water-uniformity'
}

function getEnabledQaWaterMetricKeys(): QaWaterMetricKey[] {
  return qaWaterMetrics.value
    .filter((metric) => metric.enabled)
    .map((metric) => metric.key)
}

const qaWaterAnalysisKey = computed(() => {
  const tab = props.activeTab
  if (!isWaterPhantomQaOperation(props.activeOperation) || tab?.viewType !== 'Stack' || !tab.viewId || !tab.imageSrc) {
    return ''
  }

  return [
    props.activeOperation,
    drawingScopePreference.value.qaWater,
    tab.key,
    tab.viewId,
    tab.imageSrc,
    qaWaterMetrics.value.map((metric) => `${metric.key}:${metric.enabled ? '1' : '0'}`).join(',')
  ].join('|')
})

function rememberQaWaterAnalysis(key: string, analysis: QaWaterAnalysis): void {
  qaWaterAnalysisCache.value = {
    ...qaWaterAnalysisCache.value,
    [key]: analysis
  }
}

function requestQaWaterResultPanel(): void {
  const key = qaWaterAnalysisKey.value
  if (!key) {
    return
  }
  activeResultPanel.value = 'qaWater'
  if (!qaWaterAnalysis.value) {
    void refreshQaWaterAnalysis(key)
  }
}

async function refreshQaWaterAnalysis(key = qaWaterAnalysisKey.value): Promise<void> {
  const requestId = qaWaterAnalysisRequestId + 1
  qaWaterAnalysisRequestId = requestId
  const tab = props.activeTab
  if (!key || !isWaterPhantomQaOperation(props.activeOperation) || tab?.viewType !== 'Stack' || !tab.viewId || !tab.imageSrc) {
    qaWaterAnalysis.value = null
    return
  }

  activeResultPanel.value = 'qaWater'
  qaWaterAnalysis.value = {
    viewId: tab.viewId,
    viewportKey: 'single',
    rois: [],
    status: 'loading'
  }

  try {
    const { analyzeWaterPhantomView } = await loadWaterPhantomQa()
    const analysis = await analyzeWaterPhantomView(tab.viewId, 'single', getEnabledQaWaterMetricKeys())
    rememberQaWaterAnalysis(key, analysis)
    if (requestId === qaWaterAnalysisRequestId && key === qaWaterAnalysisKey.value) {
      qaWaterAnalysis.value = analysis
    }
  } catch (error) {
    console.error('Failed to analyze water phantom QA.', error)
    const analysis: QaWaterAnalysis = {
      viewId: tab.viewId,
      viewportKey: 'single',
      rois: [],
      status: 'error',
      message: overlayCopy.value.qaWaterFailed
    }
    rememberQaWaterAnalysis(key, analysis)
    if (requestId === qaWaterAnalysisRequestId && key === qaWaterAnalysisKey.value) {
      qaWaterAnalysis.value = analysis
    }
  }
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

  context.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  const width = Math.min(
    Math.max(...visibleLines.map((line) => context.measureText(line).width)) + 14,
    Math.max(120, maxWidth - 16)
  )
  const height = visibleLines.length * EXPORT_LABEL_LINE_HEIGHT_PX + 8
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
    context.fillText(line, left + 7, top + EXPORT_LABEL_LINE_HEIGHT_PX + index * EXPORT_LABEL_LINE_HEIGHT_PX)
  })
  context.restore()
}

function drawSmoothMeasurementPath(context: CanvasRenderingContext2D, points: MeasurementDraftPoint[], closePath = false): void {
  if (points.length < 2) {
    return
  }

  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  getSmoothCurveSegments(points, closePath).forEach((segment) => {
    context.bezierCurveTo(
      segment.controlPoint1.x,
      segment.controlPoint1.y,
      segment.controlPoint2.x,
      segment.controlPoint2.y,
      segment.end.x,
      segment.end.y
    )
  })
  if (closePath) {
    context.closePath()
  }
  context.stroke()
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
      } else if (measurement.toolType === 'curve' && points.length >= 2) {
        drawSmoothMeasurementPath(context, points)
      } else if (measurement.toolType === 'freeform' && points.length >= 3) {
        drawSmoothMeasurementPath(context, points, true)
      }
    }

    drawShape()
    context.strokeStyle = 'rgba(85,231,255,0.98)'
    context.lineWidth = 2.5
    drawShape()

    const anchor = measurement.toolType === 'curve'
      ? points[points.length - 1] ?? points[0]
      : points[1] ?? points[0]
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

  const displayCornerInfo = applyViewportCornerInfoPreference(cornerInfo, viewportCornerInfoPreference.value)
  return [displayCornerInfo.topLeft, displayCornerInfo.topRight, displayCornerInfo.bottomLeft, displayCornerInfo.bottomRight].some((lines) =>
    lines.some((line) => line.trim())
  )
}

function isMprLikeViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'MPR' || viewType === '4D'
}

function isCompareStackViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'CompareStack'
}

function isLayoutViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'Layout'
}

function isPetCtFusionViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'PETCTFusion'
}

function resolveLayoutSlot(tab: ViewerTabItem, viewportKey: string) {
  const slots = tab.layoutSlots ?? []
  return slots.find((slot) => slot.id === viewportKey) ?? slots.find((slot) => Boolean(slot.viewId)) ?? null
}

function resolveCurrentSliceIndex(viewportKey: string): number | null {
  const tab = props.activeTab
  if (!tab) {
    return null
  }
  if (isMprLikeViewType(tab.viewType)) {
    return parseSliceLabel(tab.viewportSliceLabels?.[viewportKey as keyof NonNullable<ViewerTabItem['viewportSliceLabels']>])?.index ?? null
  }
  if (isCompareStackViewType(tab.viewType)) {
    const paneKey = viewportKey === COMPARE_STACK_TARGET_PANE_KEY ? COMPARE_STACK_TARGET_PANE_KEY : COMPARE_STACK_SOURCE_PANE_KEY
    return parseSliceLabel(tab.compareSliceLabels?.[paneKey])?.index ?? null
  }
  if (isLayoutViewType(tab.viewType)) {
    return parseSliceLabel(resolveLayoutSlot(tab, viewportKey)?.sliceLabel)?.index ?? null
  }
  if (isPetCtFusionViewType(tab.viewType)) {
    const paneKey = isFusionPaneKey(viewportKey) ? viewportKey : FUSION_OVERLAY_AXIAL_PANE_KEY
    return parseSliceLabel(tab.fusionSliceLabels?.[paneKey])?.index ?? null
  }
  return parseSliceLabel(tab.sliceLabel)?.index ?? null
}

function isScopedDrawingVisible(
  scope: DrawingScope | null | undefined,
  itemSliceIndex: number | null | undefined,
  currentSliceIndex: number | null
): boolean {
  if ((scope ?? 'image') === 'series') {
    return true
  }
  if (itemSliceIndex == null || currentSliceIndex == null) {
    return true
  }
  return itemSliceIndex === currentSliceIndex
}

function getActiveCornerInfoForExport(tab: ViewerTabItem, viewportKey: string): CornerInfo {
  if (isMprLikeViewType(tab.viewType)) {
    return getMprCornerInfo(viewportKey)
  }
  if (isCompareStackViewType(tab.viewType)) {
    const paneKey =
      viewportKey === COMPARE_STACK_TARGET_PANE_KEY
        ? COMPARE_STACK_TARGET_PANE_KEY
        : COMPARE_STACK_SOURCE_PANE_KEY
    return tab.compareCornerInfos?.[paneKey] ?? tab.cornerInfo
  }
  if (isLayoutViewType(tab.viewType)) {
    return resolveLayoutSlot(tab, viewportKey)?.cornerInfo ?? tab.cornerInfo
  }
  if (isPetCtFusionViewType(tab.viewType)) {
    const paneKey = isFusionPaneKey(viewportKey) ? viewportKey : FUSION_OVERLAY_AXIAL_PANE_KEY
    return tab.fusionCornerInfos?.[paneKey] ?? tab.cornerInfo
  }
  return tab.cornerInfo
}

function drawCornerInfo(context: CanvasRenderingContext2D, cornerInfo: CornerInfo, width: number, height: number): void {
  const displayCornerInfo = applyViewportCornerInfoPreference(cornerInfo, viewportCornerInfoPreference.value)
  const blocks: Array<{
    key: CornerPosition
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
    const lines = displayCornerInfo[key].map((line) => line.trim()).filter(Boolean)
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

async function handleExportCurrentView(format: ViewerExportFormat, viewportKeyOverride?: string): Promise<void> {
  try {
    if (!props.activeTab) {
      showExportNotice(null, format)
      return
    }

    const shouldUseActiveViewport =
      isMprLikeViewType(props.activeTab.viewType) ||
      isCompareStackViewType(props.activeTab.viewType) ||
      isLayoutViewType(props.activeTab.viewType) ||
      isPetCtFusionViewType(props.activeTab.viewType)
    const exportViewportKey = viewportKeyOverride ?? (shouldUseActiveViewport ? activeViewportKey.value : 'single')
    const { buildExportFileStem, exportCurrentView } = await import('../../composables/workspace/export/viewExport')
    const exportFileNameStem = buildExportFileStem(props.activeTab, exportViewportKey)
    const defaultFileNameStem =
      format === 'dicom-sr'
        ? `${exportFileNameStem}-measurements-sr`
        : format === 'dicom-gsps'
          ? `${exportFileNameStem}-presentation-state`
          : exportFileNameStem
    let customFileNameStem: string | null = null
    if (!exportPreference.value.useDefaultFileName) {
      customFileNameStem = await requestExportFileName(format, defaultFileNameStem)
      if (!customFileNameStem) {
        return
      }
    }

    const overlays: ViewerExportOverlays = {
      annotations: getAnnotations(exportViewportKey),
      cornerInfo: getActiveCornerInfoForExport(props.activeTab, exportViewportKey),
      measurements: getExportMeasurements(exportViewportKey)
    }
    const exportOverlays: ViewerExportOverlays =
      format === 'png'
        ? {
            annotations: exportPreference.value.includePngAnnotations ? overlays.annotations : [],
            cornerInfo: exportPreference.value.includePngCornerInfo ? overlays.cornerInfo : null,
            measurements: exportPreference.value.includePngMeasurements ? overlays.measurements : []
          }
        : format === 'dicom-sr'
          ? {
              annotations: [],
              cornerInfo: null,
              measurements: overlays.measurements
            }
          : format === 'dicom-gsps'
            ? {
                annotations: overlays.annotations,
                cornerInfo: null,
                measurements: overlays.measurements
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
      activeViewportKey: exportViewportKey,
      data: pngData,
      exportFormat: format,
      exportPreference: exportPreference.value,
      fileNameStem: customFileNameStem,
      overlays: exportOverlays
    })
    showExportNotice(result, format)
  } catch (error) {
    console.error('Failed to export current view.', error)
    showExportFailureNotice()
  }
}

function createAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isAnnotationOperationPath(value: string): boolean {
  const normalized = value.startsWith('stack:') ? value.slice('stack:'.length) : value
  return normalized === 'annotate' || normalized.startsWith('annotate:')
}

function isTransientDrawingOperationPath(value: string): boolean {
  const normalized = value.startsWith('stack:') ? value.slice('stack:'.length) : value
  return (
    normalized.startsWith('measure:') ||
    normalized === 'annotate' ||
    normalized.startsWith('annotate:') ||
    normalized.startsWith('qa:')
  )
}

function clearTransientDrawingDrafts(): void {
  clearDrawingDrafts()
  clearDraftAnnotations()
  annotationInteraction.value = { kind: 'idle' }
}

function handleViewportWheel(payload: Parameters<typeof handleViewportWheelCore>[0]): void {
  clearTransientDrawingDrafts()
  handleViewportWheelCore(payload)
}

function isAnnotationOperationEnabled(): boolean {
  return (
    (props.activeTab?.viewType === 'Stack' ||
      props.activeTab?.viewType === 'PET' ||
      isCompareStackViewType(props.activeTab?.viewType) ||
      isLayoutViewType(props.activeTab?.viewType) ||
      isMprLikeViewType(props.activeTab?.viewType)) &&
    isAnnotationOperationPath(props.activeOperation)
  )
}

function getDraftAnnotation(viewportKey: string): AnnotationDraft | null {
  return draftAnnotations.value[viewportKey] ?? null
}

function getAnnotations(viewportKey: string): AnnotationOverlay[] {
  const activeTab = props.activeTab
  if (!activeTab) {
    return []
  }

  const committedAnnotations =
    activeTab.viewType === 'Stack' || activeTab.viewType === 'PET'
      ? (activeTab.annotations ?? [])
      : (activeTab.viewportAnnotations?.[viewportKey] ?? [])

  const pendingDeletedIds = new Set(pendingDeletedAnnotationIds.value[viewportKey] ?? [])
  const currentSliceIndex = resolveCurrentSliceIndex(viewportKey)
  return committedAnnotations
    .filter((annotation) => !pendingDeletedIds.has(annotation.annotationId))
    .filter((annotation) => isScopedDrawingVisible(annotation.scope, annotation.sliceIndex, currentSliceIndex))
}

function clearAllAnnotationsForActiveTab(): void {
  pendingDeletedAnnotationIds.value = {}
  clearDraftAnnotations()
  annotationInteraction.value = { kind: 'idle' }
}

function getFusionPetSeriesDescription(tab: ViewerTabItem | null): string {
  const fromMetadata = tab?.fusionSeriesDescriptions?.pet?.trim()
  if (fromMetadata) {
    return fromMetadata
  }
  const title = tab?.title ?? ''
  const titleMatch = /\+\s*(.+?)(?:\s+(?:路|·)\s*PET\/CT|\s+PET\/CT|$)/i.exec(title)
  const fromTitle = titleMatch?.[1]?.trim()
  if (fromTitle) {
    return fromTitle
  }
  return tab?.fusionInfo?.petSeriesId?.trim() || 'PET'
}

function buildFusionRegistrationSeriesDescription(tab: ViewerTabItem | null): string {
  return `${getFusionPetSeriesDescription(tab)}_Reg`.slice(0, 64)
}

async function resolveFusionRegistrationDefaultOutputDirectory(): Promise<string> {
  const customDirectory =
    exportPreference.value.locationMode === 'custom'
      ? exportPreference.value.desktopDirectory?.trim()
      : ''
  if (customDirectory) {
    return customDirectory
  }
  const { getDefaultExportLocationLabel } = await import('../../platform/exporting')
  const defaultDirectory = (await getDefaultExportLocationLabel()).trim()
  return defaultDirectory === 'Browser default downloads' ? '' : defaultDirectory
}

async function openFusionRegistrationSaveDialog(): Promise<void> {
  if (!props.activeTab || props.activeTab.viewType !== 'PETCTFusion') {
    return
  }
  fusionRegistrationSaveMode.value = 'newDicom'
  fusionRegistrationSeriesDescription.value = buildFusionRegistrationSeriesDescription(props.activeTab)
  fusionRegistrationSaveError.value = null
  lastFusionRegistrationExport.value = null
  isFusionRegistrationSaveDialogOpen.value = true
  if (isFusionRegistrationWebMode.value) {
    fusionRegistrationOutputDirectory.value = ''
    return
  }
  try {
    fusionRegistrationOutputDirectory.value = await resolveFusionRegistrationDefaultOutputDirectory()
  } catch {
    fusionRegistrationOutputDirectory.value = ''
  }
}

async function handleFusionRegistrationBrowseDirectory(): Promise<void> {
  try {
    const { chooseCustomExportDirectory } = await import('../../platform/exporting')
    const selectedDirectory = await chooseCustomExportDirectory()
    if (selectedDirectory?.desktopDirectory) {
      fusionRegistrationOutputDirectory.value = selectedDirectory.desktopDirectory
      fusionRegistrationSaveError.value = null
      return
    }
    if (selectedDirectory?.webDirectoryName) {
      fusionRegistrationSaveError.value = '当前保存配准结果需要桌面文件夹路径，请选择本地文件夹。'
    }
  } catch (error) {
    fusionRegistrationSaveError.value = resolveBackendErrorDetail(error) || '选择输出文件夹失败。'
  }
}

function resolveFusionRegistrationExportViewId(tab: ViewerTabItem): string | null {
  const overlayViewId = tab.fusionViewIds?.[FUSION_OVERLAY_AXIAL_PANE_KEY]
  if (overlayViewId) {
    return overlayViewId
  }
  return Object.values(tab.fusionViewIds ?? {}).find((value): value is string => Boolean(value)) ?? null
}

async function handleFusionRegistrationSaveConfirm(): Promise<void> {
  const tab = props.activeTab
  if (!tab || tab.viewType !== 'PETCTFusion') {
    fusionRegistrationSaveError.value = '当前没有可保存的 PET/CT 配准视图。'
    return
  }
  const viewId = resolveFusionRegistrationExportViewId(tab)
  if (!viewId) {
    fusionRegistrationSaveError.value = '融合视图尚未初始化，请等待图像加载完成后再保存。'
    return
  }
  const outputDirectory = fusionRegistrationOutputDirectory.value.trim()
  if (!isFusionRegistrationWebMode.value && !outputDirectory) {
    fusionRegistrationSaveError.value = '请选择输出路径。'
    return
  }
  const seriesDescription = fusionRegistrationSeriesDescription.value.trim() || buildFusionRegistrationSeriesDescription(tab)
  isFusionRegistrationSaving.value = true
  fusionRegistrationSaveError.value = null
  try {
    if (isFusionRegistrationWebMode.value) {
      const { postFusionRegistrationExportArtifact } = await import('../../services/typedApi')
      const { saveBinaryFile } = await import('../../platform/exporting')
      const artifact = await postFusionRegistrationExportArtifact({
        mode: fusionRegistrationSaveMode.value,
        seriesDescription,
        viewId
      })
      await saveBinaryFile({
        data: artifact.data,
        fileName: artifact.fileName,
        mimeType: artifact.mediaType,
        preference: { locationMode: 'default' }
      })
      exportNotice.value = {
        canOpenLocation: false,
        filePath: null,
        message: `已生成 ${artifact.fileCount} 个文件并发送到浏览器下载。`,
        title: workspaceExportCopy.value.exportComplete
      }
      emit('triggerViewAction', { action: 'fusionRegistrationSave' })
      return
    }

    const { postFusionRegistrationExport } = await import('../../services/typedApi')
    const result = await postFusionRegistrationExport({
      mode: fusionRegistrationSaveMode.value,
      outputDirectory,
      seriesDescription,
      viewId
    })
    lastFusionRegistrationExport.value = result
    fusionRegistrationSeriesDescription.value = result.seriesDescription
    exportNotice.value = {
      canOpenLocation: Boolean(result.directoryPath && window.viewerApi?.openExportLocation),
      directoryPath: result.directoryPath,
      filePath: result.filePath ?? null,
      message: `已保存 ${result.fileCount} 个文件到 ${result.directoryPath}`,
      title: workspaceExportCopy.value.exportComplete
    }
    emit('triggerViewAction', { action: 'fusionRegistrationSave' })
  } catch (error) {
    fusionRegistrationSaveError.value = resolveBackendErrorDetail(error) || '保存配准结果失败。'
  } finally {
    isFusionRegistrationSaving.value = false
  }
}

async function handleOpenFusionRegistrationFolder(): Promise<void> {
  const result = lastFusionRegistrationExport.value
  if (!result?.directoryPath) {
    return
  }
  const { openExportLocation } = await import('../../platform/exporting')
  const opened = await openExportLocation({
    directoryPath: result.directoryPath,
    filePath: null
  })
  if (!opened) {
    fusionRegistrationSaveError.value = workspaceExportCopy.value.openLocationFailed
  }
}

function handleOpenFusionRegistrationLoadFile(): void {
  if (!props.activeTab || props.activeTab.viewType !== 'PETCTFusion') {
    return
  }
  if (fusionRegistrationFileInputRef.value) {
    fusionRegistrationFileInputRef.value.value = ''
    fusionRegistrationFileInputRef.value.click()
  }
}

async function handleFusionRegistrationFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) {
    return
  }
  if (!file.name.toLowerCase().endsWith('.br')) {
    exportNotice.value = {
      canOpenLocation: false,
      message: '请选择 DicomVision .br 配准文件。',
      title: workspaceExportCopy.value.exportFailed
    }
    return
  }
  try {
    const parsed = JSON.parse(await file.text()) as Record<string, unknown>
    emit('triggerViewAction', { action: 'fusionRegistrationLoad', registrationFile: parsed })
  } catch {
    exportNotice.value = {
      canOpenLocation: false,
      message: '配准文件不是有效的 JSON。',
      title: workspaceExportCopy.value.exportFailed
    }
  }
}

function handleToolbarViewAction(payload: ViewerToolbarActionPayload): void {
  if (payload.action === 'fusionRegistrationSave' && props.activeTab?.viewType === 'PETCTFusion') {
    void openFusionRegistrationSaveDialog()
    return
  }

  if (payload.action === 'fusionRegistrationLoad' && props.activeTab?.viewType === 'PETCTFusion') {
    handleOpenFusionRegistrationLoadFile()
    return
  }

  if (payload.action === 'clearAnnotations' || payload.action === 'resetAll') {
    clearAllAnnotationsForActiveTab()
  }

  emit('triggerViewAction', payload)
}

function commitAnnotation(viewportKey: string, annotation: AnnotationOverlay | AnnotationDraft): void {
  if (!annotation.annotationId || !isValidArrowAnnotation(annotation.points)) {
    return
  }

  emit('annotationOperation', {
    viewportKey,
    annotationId: annotation.annotationId,
    actionType: 'end',
    toolType: annotation.toolType,
    points: annotation.points,
    text: annotation.text,
    color: annotation.color,
    size: annotation.size,
    scope: annotation.scope ?? drawingScopePreference.value.annotation,
    sliceIndex: annotation.sliceIndex ?? resolveCurrentSliceIndex(viewportKey)
  })
}

function markAnnotationPendingDelete(viewportKey: string, annotationId: string): void {
  const nextIds = new Set(pendingDeletedAnnotationIds.value[viewportKey] ?? [])
  nextIds.add(annotationId)
  pendingDeletedAnnotationIds.value = {
    ...pendingDeletedAnnotationIds.value,
    [viewportKey]: Array.from(nextIds)
  }
}

function emitAnnotationDelete(viewportKey: string, annotationId: string): void {
  markAnnotationPendingDelete(viewportKey, annotationId)
  emit('annotationOperation', {
    viewportKey,
    annotationId,
    actionType: 'delete'
  })
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
    size: annotation.size,
    scope: annotation.scope ?? 'image',
    sliceIndex: annotation.sliceIndex ?? null
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
  if (isMprLikeViewType(props.activeTab.viewType) || isCompareStackViewType(props.activeTab.viewType) || isLayoutViewType(props.activeTab.viewType)) {
    return props.activeTab.viewportMeasurements?.[viewportKey] ?? []
  }
  return props.activeTab.measurements ?? []
}

function getVisibleCommittedMeasurements(viewportKey: string): MeasurementOverlay[] {
  const committedMeasurements = getCommittedMeasurements(viewportKey)
  const draft = draftMeasurements.value[viewportKey]
  const editingMeasurementId = draft?.measurementId
  const pendingDeletedIds = new Set(pendingDeletedMeasurementIds.value[viewportKey] ?? [])
  const currentSliceIndex = resolveCurrentSliceIndex(viewportKey)
  const visibleCommittedMeasurements = pendingDeletedIds.size
    ? committedMeasurements.filter((measurement) => !pendingDeletedIds.has(measurement.measurementId))
    : committedMeasurements
  const scopedMeasurements = visibleCommittedMeasurements.filter((measurement) =>
    isScopedDrawingVisible(measurement.scope, measurement.sliceIndex, currentSliceIndex)
  )
  if (!editingMeasurementId) {
    return scopedMeasurements.map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
  }

  return scopedMeasurements
    .filter((measurement) => measurement.measurementId !== editingMeasurementId)
    .map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
}

function getExportMeasurements(viewportKey: string): MeasurementOverlay[] {
  const currentSliceIndex = resolveCurrentSliceIndex(viewportKey)
  return getCommittedMeasurements(viewportKey)
    .filter((measurement) => isScopedDrawingVisible(measurement.scope, measurement.sliceIndex, currentSliceIndex))
    .map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
}

function getMtfItems(viewportKey: string) {
  const currentSliceIndex = resolveCurrentSliceIndex(viewportKey)
  const items = (props.activeTab?.mtfState?.items ?? []).filter(
    (item) =>
      item.viewportKey === viewportKey &&
      isScopedDrawingVisible(item.scope, item.sliceIndex, currentSliceIndex)
  )
  const draft = getMtfDraft(viewportKey)
  if (!draft?.mtfId) {
    return items
  }

  return items.filter((item) => item.mtfId !== draft.mtfId)
}

function getViewportCursorClass(viewportKey: string): string {
  const transientCursorClass = viewportCursorClasses.value[viewportKey]
  if (transientCursorClass) {
    return transientCursorClass
  }
  if (isAnnotationOperationEnabled()) {
    return 'cursor-crosshair'
  }
  return getViewportIdleCursorClass(viewportKey)
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

interface AnnotationPointerProjection {
  sourcePoint: MeasurementDraftPoint
  screenPoint: AnnotationScreenPoint
  frame: AnnotationProjectionFrame
}

function getAnnotationPointerProjection(event: PointerEvent): AnnotationPointerProjection | null {
  const imageElement = resolveViewportImageElement(event)
  if (!imageElement) {
    return null
  }

  const rect = getRenderedImageRect(imageElement)
  if (!rect.width || !rect.height) {
    return null
  }

  const frame: AnnotationProjectionFrame = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    naturalWidth: imageElement.naturalWidth || rect.width,
    naturalHeight: imageElement.naturalHeight || rect.height
  }
  const screenPoint = {
    x: event.clientX,
    y: event.clientY
  }

  return {
    sourcePoint: {
      x: Math.max(0, Math.min(1, (screenPoint.x - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (screenPoint.y - rect.top) / rect.height))
    },
    screenPoint,
    frame
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

function updateSelectedAnnotation(
  viewportKey: string,
  annotationId: string,
  updater: (current: AnnotationOverlay) => AnnotationOverlay,
  options: { commit?: boolean } = {}
): void {
  const draft = getDraftAnnotation(viewportKey)
  const current = draft?.annotationId === annotationId
    ? ({ ...draft, annotationId } as AnnotationOverlay)
    : findAnnotation(viewportKey, annotationId)
  if (!current) {
    return
  }

  const nextAnnotation = updater(current)
  selectAnnotation(viewportKey, nextAnnotation)
  if (options.commit ?? true) {
    commitAnnotation(viewportKey, nextAnnotation)
  }
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
    return (
      other != null &&
      Math.abs(point.x - other.x) < ANNOTATION_POINT_CLOSE_EPSILON &&
      Math.abs(point.y - other.y) < ANNOTATION_POINT_CLOSE_EPSILON
    )
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

  selectAnnotation(resolvedViewportKey, copiedAnnotation)
  commitAnnotation(resolvedViewportKey, copiedAnnotation)
  annotationInteraction.value = { kind: 'idle' }
  return true
}

function deleteSelectedAnnotation(viewportKey?: string): boolean {
  const resolvedViewportKey = viewportKey ?? activeViewportKey.value
  const draft = getDraftAnnotation(resolvedViewportKey)
  if (!draft?.annotationId) {
    return false
  }

  emitAnnotationDelete(resolvedViewportKey, draft.annotationId)
  setDraftAnnotation(resolvedViewportKey, null)
  annotationInteraction.value = { kind: 'idle' }
  return true
}

function handleAnnotationDelete(payload: { viewportKey: string; annotationId: string }): void {
  emitAnnotationDelete(payload.viewportKey, payload.annotationId)
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
  if (!event.isPrimary || event.button !== 0) {
    return false
  }

  if (!isAnnotationOperationEnabled()) {
    return false
  }

  const pointerTarget = resolvePointerContainer(event)
  const projection = getAnnotationPointerProjection(event)
  if (!(pointerTarget instanceof HTMLElement) || !projection) {
    return false
  }

  event.preventDefault()
  setActiveViewport(viewportKey)
  const point = projection.sourcePoint
  const annotations = getAnnotations(viewportKey)
  const hit = findArrowAnnotationAtScreenPoint(annotations, projection.screenPoint, projection.frame)

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
      startScreenPoint: projection.screenPoint,
      originalPoints: hit.annotation.points
    }
    return true
  }

  const nextDraft: AnnotationDraft = {
    toolType: 'arrow',
    points: [point, point],
    text: DEFAULT_ANNOTATION_TEXT,
    color: measurementStylePreference.value.annotationColor,
    size: measurementStylePreference.value.annotationSize,
    scope: drawingScopePreference.value.annotation,
    sliceIndex: resolveCurrentSliceIndex(viewportKey)
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
  if (interaction.kind === 'idle') {
    return false
  }
  const projection = getAnnotationPointerProjection(event)
  if (!projection) {
    return true
  }
  const point = projection.sourcePoint

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
    const deltaX = projection.screenPoint.x - interaction.startScreenPoint.x
    const deltaY = projection.screenPoint.y - interaction.startScreenPoint.y
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
      }),
      { commit: false }
    )
    return true
  }

  if (interaction.kind === 'editing_handle') {
    updateSelectedAnnotation(interaction.viewportKey, interaction.annotationId, (current) => ({
      ...current,
      points: updateEditedArrowPoints(current.points, interaction.handleIndex, point)
    }), { commit: false })
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
        size: draft.size,
        scope: draft.scope ?? drawingScopePreference.value.annotation,
        sliceIndex: draft.sliceIndex ?? resolveCurrentSliceIndex(interaction.viewportKey)
      }
      selectAnnotation(interaction.viewportKey, annotation)
      commitAnnotation(interaction.viewportKey, annotation)
    } else {
      setDraftAnnotation(interaction.viewportKey, null)
    }

    stopAnnotationInteraction(event.currentTarget)
    return true
  }

  if (interaction.kind === 'move_pending' || interaction.kind === 'moving' || interaction.kind === 'editing_handle') {
    const draft = getDraftAnnotation(interaction.viewportKey)
    if (draft?.annotationId) {
      commitAnnotation(interaction.viewportKey, draft)
    }
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

const activeMtfState = computed(() => props.activeTab?.mtfState ?? null)
const canAcceptQuickPreviewDrop = computed(() => !props.isViewLoading && !props.activeTab)
const MPR_SEGMENTATION_PROGRESS_VIEWPORTS = ['mpr-ax', 'mpr-cor', 'mpr-sag'] as const
const isMprSegmentationProcessing = computed(() => {
  const progress = props.activeTab?.viewportLoadingProgress
  return MPR_SEGMENTATION_PROGRESS_VIEWPORTS.some((viewportKey) => Boolean(progress?.[viewportKey]))
})
const hasViewerTabs = computed(() => props.viewerTabs.length > 0)
const isTabStripCollapsed = ref(false)
const workspaceContentWidth = ref(0)
type RightDockResizeTarget = 'toolbar' | 'result'
const activeRightDockResize = ref<{ target: RightDockResizeTarget; startX: number; startWidth: number } | null>(null)
const rightDockResizePreviewWidth = ref<number | null>(null)
const rightDockResizePreviewTarget = ref<RightDockResizeTarget | null>(null)
const isRightDockResizing = computed(() => activeRightDockResize.value != null)
const workspaceContentStyle = computed(() => ({
  '--viewer-right-dock-preview-width': `${rightDockResizePreviewWidth.value ?? 0}px`
}))
const shouldForceShowTabStrip = computed(() => !props.activeTab || props.activeTab.viewType === 'Tag')
const shouldShowTabStrip = computed(() => hasViewerTabs.value && (!isTabStripCollapsed.value || shouldForceShowTabStrip.value))
const shouldShowTabStripToggle = computed(() => hasViewerTabs.value && Boolean(props.activeTab) && props.activeTab?.viewType !== 'Tag')
const selectedMtfId = computed(() => activeMtfState.value?.selectedMtfId ?? null)
const selectedMtfItem = computed(() => {
  const state = activeMtfState.value
  if (!state?.selectedMtfId) {
    return null
  }

  const item = state.items.find((candidate) => candidate.mtfId === state.selectedMtfId) ?? null
  if (!item) {
    return null
  }
  return isScopedDrawingVisible(item.scope, item.sliceIndex, resolveCurrentSliceIndex(item.viewportKey)) ? item : null
})
const selectedMeasurementEntry = computed<{ viewportKey: string; measurement: MeasurementDraft } | null>(() => {
  const preferredKeys = [
    activeViewportKey.value,
    ...Object.keys(draftMeasurements.value)
  ].filter((key, index, keys) => Boolean(key) && keys.indexOf(key) === index)

  for (const viewportKey of preferredKeys) {
    const draft = draftMeasurements.value[viewportKey]
    if (!draft?.measurementId) {
      continue
    }
    if (!isScopedDrawingVisible(draft.scope, draft.sliceIndex, resolveCurrentSliceIndex(viewportKey))) {
      continue
    }
    const filteredDraft = filterMeasurementDraftByPreferences(draft, roiStatOptions.value)
    if (filteredDraft) {
      return {
        viewportKey,
        measurement: filteredDraft
      }
    }
  }

  return null
})
const activeResultPanelKind = computed<WorkspaceResultPanel | null>(() => {
  if (selectedMeasurementEntry.value) {
    return 'measurement'
  }
  if (activeResultPanel.value === 'mtfCurve') {
    return selectedMtfItem.value?.status === 'ready' ? 'mtfCurve' : null
  }
  if (activeResultPanel.value === 'qaWater') {
    return isWaterPhantomQaOperation(props.activeOperation) ? 'qaWater' : null
  }
  return null
})
const topResultDockCanReserve = computed(() => workspaceContentWidth.value >= TOP_RESULT_DOCK_MIN_CONTENT_WIDTH)
const qaResultPanelTitle = computed(() => (locale.value === 'zh-CN' ? 'QA 报告' : 'QA Report'))
const measurementResultPanelTitle = computed(() => (locale.value === 'zh-CN' ? '测量详情' : 'Measurement Details'))
const resultPanelTitle = computed(() => {
  if (activeResultPanelKind.value === 'measurement') {
    return measurementResultPanelTitle.value
  }
  if (activeResultPanelKind.value === 'mtfCurve') {
    return overlayCopy.value.mtfCurveTitle
  }
  return qaResultPanelTitle.value
})
const resultPanelIcon = computed(() => {
  if (activeResultPanelKind.value === 'measurement') {
    return 'measure'
  }
  return activeResultPanelKind.value === 'mtfCurve' ? 'mtf' : 'water-phantom'
})
const resultPanelToolKey = computed(() => {
  if (activeResultPanelKind.value === 'measurement') {
    return 'measure'
  }
  if (activeResultPanelKind.value === 'mtfCurve') {
    return activeTools.value.some((tool) => tool.key === 'mtf') ? 'mtf' : 'qa'
  }
  if (activeResultPanelKind.value === 'qaWater') {
    return 'qa'
  }
  return null
})
const shouldShowTopResultDock = computed(() =>
  Boolean(
    activeTabRef.value &&
    activeTabRef.value.viewType !== 'Tag' &&
    !isRightToolbarLayout.value &&
    (activeResultPanelKind.value || topResultDockCanReserve.value)
  )
)

function handleOpenMtfCurve(): void {
  if (selectedMtfItem.value?.status === 'ready') {
    activeResultPanel.value = 'mtfCurve'
  }
}

function closeResultPanel(): void {
  activeResultPanel.value = null
}

function getRightDockResizeConfig(target: RightDockResizeTarget): { min: number; max: number; collapse: number; widthKey: 'rightToolbarWidth' | 'rightResultWidth'; collapsedKey: 'rightToolbarCollapsed' | 'rightResultCollapsed' } {
  return target === 'toolbar'
    ? {
        min: RIGHT_TOOLBAR_DOCK_MIN_WIDTH,
        max: RIGHT_TOOLBAR_DOCK_MAX_WIDTH,
        collapse: RIGHT_TOOLBAR_DOCK_COLLAPSE_THRESHOLD,
        widthKey: 'rightToolbarWidth',
        collapsedKey: 'rightToolbarCollapsed'
      }
    : {
        min: RIGHT_RESULT_DOCK_MIN_WIDTH,
        max: RIGHT_RESULT_DOCK_MAX_WIDTH,
        collapse: RIGHT_RESULT_DOCK_COLLAPSE_THRESHOLD,
        widthKey: 'rightResultWidth',
        collapsedKey: 'rightResultCollapsed'
      }
}

function clampRightDockWidth(target: RightDockResizeTarget, width: number): number {
  const config = getRightDockResizeConfig(target)
  return Math.max(config.min, Math.min(config.max, Math.round(width)))
}

function resolveRightDockPreviewWidth(target: RightDockResizeTarget, width: number): number {
  const config = getRightDockResizeConfig(target)
  return width < config.collapse ? 58 : clampRightDockWidth(target, width)
}

function updateWorkspaceDockPreferencePatch(patch: Partial<typeof workspaceDockPreference.value>): void {
  setWorkspaceDockPreference({
    ...workspaceDockPreference.value,
    ...patch
  })
}

function handleRightDockCollapseChange(target: RightDockResizeTarget, collapsed: boolean): void {
  const config = getRightDockResizeConfig(target)
  updateWorkspaceDockPreferencePatch({
    [config.collapsedKey]: collapsed
  })
}

function cleanupRightDockResizeListeners(): void {
  window.removeEventListener('pointermove', handleRightDockResizeMove)
  window.removeEventListener('pointerup', handleRightDockResizeEnd)
  window.removeEventListener('pointercancel', handleRightDockResizeCancel)
}

function handleRightDockResizeMove(event: PointerEvent): void {
  const activeResize = activeRightDockResize.value
  if (!activeResize) {
    return
  }
  const nextWidth = activeResize.startWidth + activeResize.startX - event.clientX
  rightDockResizePreviewWidth.value = resolveRightDockPreviewWidth(activeResize.target, nextWidth)
}

function handleRightDockResizeCancel(): void {
  activeRightDockResize.value = null
  rightDockResizePreviewWidth.value = null
  rightDockResizePreviewTarget.value = null
  cleanupRightDockResizeListeners()
}

function handleRightDockResizeEnd(event: PointerEvent): void {
  const activeResize = activeRightDockResize.value
  if (!activeResize) {
    return
  }
  const config = getRightDockResizeConfig(activeResize.target)
  const rawWidth = activeResize.startWidth + activeResize.startX - event.clientX
  const shouldCollapse = rawWidth < config.collapse
  updateWorkspaceDockPreferencePatch({
    [config.widthKey]: shouldCollapse ? workspaceDockPreference.value[config.widthKey] : clampRightDockWidth(activeResize.target, rawWidth),
    [config.collapsedKey]: shouldCollapse
  })
  handleRightDockResizeCancel()
}

function startRightDockResize(target: RightDockResizeTarget, event: PointerEvent): void {
  event.preventDefault()
  const config = getRightDockResizeConfig(target)
  const startWidth = workspaceDockPreference.value[config.widthKey]
  activeRightDockResize.value = {
    target,
    startX: event.clientX,
    startWidth
  }
  rightDockResizePreviewTarget.value = target
  rightDockResizePreviewWidth.value = startWidth
  window.addEventListener('pointermove', handleRightDockResizeMove)
  window.addEventListener('pointerup', handleRightDockResizeEnd)
  window.addEventListener('pointercancel', handleRightDockResizeCancel)
}

const {
  clearQuickPreviewDropState,
  handleQuickPreviewDragEnter,
  handleQuickPreviewDragLeave,
  handleQuickPreviewDragOver,
  handleQuickPreviewDrop,
  isQuickPreviewDropActive,
  quickPreviewDropClass
} = useQuickPreviewDrop({
  canAcceptDrop: canAcceptQuickPreviewDrop,
  onDropSeries: (seriesId) => emit('quickPreviewSeriesDrop', seriesId)
})

function handleCopySelectedMtf(): void {
  runSelectedMtfAction((mtfId) => {
    emit('mtfCopy', { mtfId })
  })
}

function isStackCurrentSliceStarred(tab: ViewerTabItem): boolean {
  const slice = parseSliceLabel(tab.sliceLabel)
  return Boolean(slice && isSliceStarred(tab.seriesId, slice.index))
}

function handleStackSliceStar(payload: { sliceIndex: number }): void {
  if (props.activeTab?.viewType !== 'Stack' && props.activeTab?.viewType !== 'PET') {
    return
  }
  toggleSliceStar(props.activeTab.seriesId, payload.sliceIndex)
}

function handleCompareSliceStar(payload: { seriesId: string; sliceIndex: number }): void {
  toggleSliceStar(payload.seriesId, payload.sliceIndex)
}

function getViewportAnnotations(viewportKey: string): AnnotationOverlay[] {
  return getAnnotations(viewportKey)
}

function getViewportDraftAnnotation(viewportKey: string): AnnotationDraft | null {
  return getDraftAnnotation(viewportKey)
}

function getViewportDraftMeasurementMode(viewportKey: string): ReturnType<typeof getDraftMeasurementMode> {
  return getDraftMeasurementMode(viewportKey)
}

function getViewportDraftMeasurement(viewportKey: string): MeasurementDraft | null {
  return getDraftMeasurement(viewportKey)
}

function getViewportMeasurements(viewportKey: string): MeasurementOverlay[] {
  return getVisibleCommittedMeasurements(viewportKey)
}

function getViewportMtfDraftMode(viewportKey: string): ReturnType<typeof getMtfDraftMode> {
  return getMtfDraftMode(viewportKey)
}

function getViewportMtfDraft(viewportKey: string) {
  return getMtfDraft(viewportKey)
}

function getViewportMtfItems(viewportKey: string) {
  return getMtfItems(viewportKey)
}

function handleCopySelectedMeasurement(viewportKey: string): void {
  void copySelectedMeasurement(viewportKey)
}

function markMeasurementPendingDelete(viewportKey: string, measurementId: string): void {
  const nextIds = new Set(pendingDeletedMeasurementIds.value[viewportKey] ?? [])
  nextIds.add(measurementId)
  pendingDeletedMeasurementIds.value = {
    ...pendingDeletedMeasurementIds.value,
    [viewportKey]: Array.from(nextIds)
  }
}

function clearMeasurementPendingDelete(viewportKey: string, measurementId: string | undefined): void {
  if (!measurementId) {
    return
  }
  pendingDeletedMeasurementIds.value = {
    ...pendingDeletedMeasurementIds.value,
    [viewportKey]: (pendingDeletedMeasurementIds.value[viewportKey] ?? []).filter((id) => id !== measurementId)
  }
}

function clearLocalDraftMeasurement(viewportKey: string): void {
  draftMeasurements.value = {
    ...draftMeasurements.value,
    [viewportKey]: null
  }
}

function emitMeasurementDeleteRequest(payload: { viewportKey: string; measurementId: string }): void {
  markMeasurementPendingDelete(payload.viewportKey, payload.measurementId)
  emit('measurementDelete', payload)
}

function deleteSelectedMeasurementFromViewport(viewportKey?: string, measurementId?: string): boolean {
  const targetViewportKey = viewportKey ?? activeViewportKey.value
  const beforeDraft = draftMeasurements.value[targetViewportKey]
  const targetMeasurementId = measurementId?.trim() || beforeDraft?.measurementId
  if (targetMeasurementId) {
    markMeasurementPendingDelete(targetViewportKey, targetMeasurementId)
  }
  const deleted = deleteSelectedMeasurement(targetViewportKey, targetMeasurementId)
  if (targetMeasurementId) {
    clearLocalDraftMeasurement(targetViewportKey)
  }
  const afterDraft = draftMeasurements.value[targetViewportKey]
  const deletedMeasurementId = targetMeasurementId ?? (
    beforeDraft?.measurementId !== afterDraft?.measurementId ? beforeDraft?.measurementId : undefined
  )
  if (deletedMeasurementId) {
    markMeasurementPendingDelete(targetViewportKey, deletedMeasurementId)
    if (!deleted) {
      emitMeasurementDeleteRequest({
        viewportKey: targetViewportKey,
        measurementId: deletedMeasurementId
      })
    }
  }
  return deleted || Boolean(deletedMeasurementId)
}

function handleDeleteSelectedMeasurement(viewportKey: string, measurementId?: string): void {
  void deleteSelectedMeasurementFromViewport(viewportKey, measurementId)
}

function handleDeleteSelectedMeasurementHotkey(): boolean {
  return deleteSelectedMeasurementFromViewport(activeViewportKey.value)
}

function handleSelectMtf(payload: { mtfId: string | null }): void {
  emit('mtfSelect', payload)
  const item = payload.mtfId ? activeMtfState.value?.items.find((candidate) => candidate.mtfId === payload.mtfId) : null
  if (item?.status === 'ready') {
    activeResultPanel.value = 'mtfCurve'
  }
}

function runSelectedMtfAction(action: (mtfId: string) => void): boolean {
  const mtfId = selectedMtfItem.value?.mtfId
  if (!mtfId) {
    return false
  }

  action(mtfId)
  return true
}

function handleDeleteSelectedMtf(): void {
  void runSelectedMtfAction((mtfId) => {
    if (activeResultPanel.value === 'mtfCurve') {
      closeResultPanel()
    }
    emit('mtfDelete', { mtfId })
  })
}

watch(
  () => activeMtfState.value,
  (value) => {
    if (!value?.items.length || !selectedMtfItem.value) {
      if (activeResultPanel.value === 'mtfCurve') {
        closeResultPanel()
      }
    }
  }
)

watch(
  () => [selectedMtfItem.value?.mtfId ?? null, selectedMtfItem.value?.status ?? null] as const,
  ([mtfId, status]) => {
    if (mtfId && status === 'ready') {
      activeResultPanel.value = 'mtfCurve'
    }
  }
)

watch(
  () => props.activeOperation,
  (value, previousValue) => {
    if (previousValue && value !== previousValue && isTransientDrawingOperationPath(previousValue)) {
      clearTransientDrawingDrafts()
      return
    }
    if (!isAnnotationOperationPath(value)) {
      clearDraftAnnotations()
      annotationInteraction.value = { kind: 'idle' }
    }
  }
)

watch(
  drawingScopePreference,
  (value) => {
    const previousValue = previousDrawingScopePreference.value
    if (value.measurement !== previousValue.measurement) {
      pendingDeletedMeasurementIds.value = {}
      clearTransientDrawingDrafts()
      handleToolbarViewAction({ action: 'clearMeasurements' })
    }
    if (value.annotation !== previousValue.annotation) {
      pendingDeletedAnnotationIds.value = {}
      clearTransientDrawingDrafts()
      handleToolbarViewAction({ action: 'clearAnnotations' })
    }
    if (value.mtf !== previousValue.mtf) {
      clearTransientDrawingDrafts()
      handleToolbarViewAction({ action: 'clearMtf' })
    }
    if (value.qaWater !== previousValue.qaWater) {
      clearTransientDrawingDrafts()
      qaWaterAnalysisRequestId += 1
      qaWaterAnalysisCache.value = {}
      qaWaterAnalysis.value = null
      if (activeResultPanel.value === 'qaWater') {
        closeResultPanel()
      }
    }
    previousDrawingScopePreference.value = { ...value }
  },
  { deep: true }
)

watch(
  () => qaWaterAnalysisKey.value,
  (value) => {
    if (!value) {
      qaWaterAnalysisRequestId += 1
      qaWaterAnalysis.value = null
      if (activeResultPanel.value === 'qaWater') {
        closeResultPanel()
      }
      return
    }
    const cachedAnalysis = qaWaterAnalysisCache.value[value]
    if (cachedAnalysis) {
      qaWaterAnalysisRequestId += 1
      qaWaterAnalysis.value = cachedAnalysis
      activeResultPanel.value = 'qaWater'
      return
    }
    void refreshQaWaterAnalysis(value)
  },
  { immediate: true }
)

watch(
  () => props.activeTabKey,
  () => {
    closeResultPanel()
    clearDraftAnnotations()
    annotationInteraction.value = { kind: 'idle' }
  }
)

const { canScrollTabsLeft, canScrollTabsRight, handleTabStripWheel, notifyWorkspaceReady, scrollTabs, tabStripRef, updateTabScrollState } =
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

function updateWorkspaceContentWidth(): void {
  workspaceContentWidth.value = workspaceContentRef.value?.clientWidth ?? 0
}

watch(
  () => workspaceContentRef.value,
  (element, _previousElement, onCleanup) => {
    updateWorkspaceContentWidth()
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      updateWorkspaceContentWidth()
    })
    resizeObserver.observe(element)
    onCleanup(() => resizeObserver.disconnect())
  },
  { flush: 'post', immediate: true }
)

watch(
  () => [viewerToolbarPlacement.value, props.activeTabKey, shouldShowTopResultDock.value] as const,
  () => {
    void nextTick().then(() => {
      notifyWorkspaceReady()
    })
  }
)

function toggleTabStripCollapsed(): void {
  isTabStripCollapsed.value = !isTabStripCollapsed.value
  void nextTick().then(() => {
    notifyWorkspaceReady()
    updateTabScrollState()
  })
}

function handleRightToolbarDockResize(): void {
  void nextTick().then(() => {
    notifyWorkspaceReady()
  })
}

watch(
  () => [activeMprLayoutKey.value, props.activeTabKey] as const,
  async ([layoutKey, tabKey], previousValue) => {
    const [previousLayoutKey, previousTabKey] = previousValue ?? []
    if (!tabKey || (layoutKey === previousLayoutKey && tabKey === previousTabKey)) {
      return
    }

    const viewType = activeTabRef.value?.viewType
    if (viewType !== 'MPR' && viewType !== '4D') {
      return
    }

    if (layoutKey !== 'mpr-3d' && activeViewportKey.value === 'volume') {
      setActiveViewport('mpr-ax')
    }
    await nextTick()
    notifyWorkspaceReady()
    emit('viewportLayoutChange', { layoutKey })
  }
)

useWorkspaceHotkeys({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  activeTabKey: activeTabKeyRef,
  activeViewportKey,
  closeActiveTab: () => {
    if (props.activeTabKey) {
      emit('closeTab', props.activeTabKey)
    }
  },
  copySelectedAnnotation,
  copySelectedMeasurement,
  copySelectedMtf: () => runSelectedMtfAction((mtfId) => emit('mtfCopy', { mtfId })),
  deleteSelectedAnnotation,
  deleteSelectedMeasurement: handleDeleteSelectedMeasurementHotkey,
  deleteSelectedMtf: () => runSelectedMtfAction((mtfId) => {
    if (activeResultPanel.value === 'mtfCurve') {
      closeResultPanel()
    }
    emit('mtfDelete', { mtfId })
  }),
  exportCurrentView: (format) => {
    void handleExportCurrentView(format)
  },
  finishPointSequenceMeasurement,
  quickPreviewSelectedSeries: () => emit('quickPreviewSelectedSeries'),
  selectedSeriesId: selectedSeriesIdRef,
  tagIndexChange: (payload) => emit('tagIndexChange', payload),
  toggleSidebar: () => emit('toggleSidebar'),
  viewportWheel: handleViewportWheel
})

onBeforeUnmount(() => {
  handleRightDockResizeCancel()
  clearQuickPreviewDropState()
  cleanupExportUi()
  stopAnnotationInteraction()
})
</script>

<template>
  <main
    class="viewer-workspace-shell theme-shell-panel relative min-h-0 min-w-0 overflow-hidden rounded-[24px] border p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_56px_rgba(0,0,0,0.28)]"
  >
    <div
      v-if="!hasSelectedSeries"
      class="viewer-workspace-empty grid h-full place-items-center rounded-[20px] border border-transparent p-8 text-center transition duration-150"
      :class="quickPreviewDropClass"
      @dragenter="handleQuickPreviewDragEnter"
      @dragover="handleQuickPreviewDragOver"
      @dragleave="handleQuickPreviewDragLeave"
      @drop="handleQuickPreviewDrop"
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

    <div v-else class="flex h-full min-h-0 flex-col gap-0">
      <ViewerTabStrip
        v-if="shouldShowTabStrip"
        v-model:tab-strip-ref="tabStripRef"
        :active-tab-key="activeTabKey"
        :can-scroll-tabs-left="canScrollTabsLeft"
        :can-scroll-tabs-right="canScrollTabsRight"
        :viewer-tabs="viewerTabs"
        @activate-tab="emit('activateTab', $event)"
        @close-tab="emit('closeTab', $event)"
        @close-other-tabs="emit('closeOtherTabs', $event)"
        @scroll-tabs="scrollTabs"
        @tab-strip-scroll="updateTabScrollState"
        @tab-strip-wheel="handleTabStripWheel"
      />

      <ViewerToolbar
        v-if="shouldShowTopToolbar && activeTab"
        :active-tab="activeTab"
        :active-tools="activeTools"
        :are-toolbar-actions-disabled="areToolbarActionsDisabled"
        :is-playing="isPlaying"
        :is-playback-paused="isPlaybackPaused"
        :is-tool-selected="isToolSelected"
        :is-tab-strip-collapsed="isTabStripCollapsed"
        :menu-icon-size="menuIconSize"
        :open-menu-key="openMenuKey"
        :show-tab-strip-toggle="shouldShowTabStripToggle"
        :stack-tool-selections="stackToolSelections"
        :toggle-icon-size="toggleIconSize"
        :toolbar-icon-size="toolbarIconSize"
        @apply-tool="handleToolbarApplyTool"
        @end-playback="endPlayback"
        @pause-playback="pausePlayback"
        @select-tool-option="handleToolbarSelectToolOption"
        @set-menu-open="handleToolbarSetMenuOpen"
        @toggle-tab-strip="toggleTabStripCollapsed"
      />

      <div v-if="isViewLoading" class="theme-shell-panel-strong grid flex-1 place-items-center rounded-[20px] border p-8">
        <div class="flex items-center gap-3 text-sm text-[var(--theme-text-secondary)]">
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--theme-accent)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--theme-accent)_14%,transparent)]"></span>
          <span>{{ t('loadingView') }}</span>
        </div>
      </div>

      <div
        v-else-if="activeTab"
        ref="workspaceContentRef"
        class="viewer-workspace-content flex min-h-0 flex-1 gap-2"
        :class="{ 'viewer-workspace-content--right-toolbar': shouldShowRightToolbarDock }"
        :data-right-dock-resizing="isRightDockResizing ? 'true' : 'false'"
        :style="workspaceContentStyle"
      >
        <div
          ref="viewportHostRef"
          class="theme-viewport-surface relative min-w-0 flex-1 overflow-hidden rounded-[20px] border p-2"
        >
        <div
          v-if="!isRightToolbarLayout && isVolumeConfigPanelAvailable && isVolumeConfigPanelOpen && activeVolumeRenderConfig"
          class="absolute right-5 top-5 z-[20]"
        >
          <VolumeRenderConfigPanel
            :config="activeVolumeRenderConfig"
            @close="closeVolumeConfigPanel"
            @config-change="emit('volumeConfigChange', $event)"
          />
        </div>

        <div
          v-if="!isRightToolbarLayout && (activeTab.viewType === 'MPR' || activeTab.viewType === '4D') && isMprMipPanelOpen && activeMprMipConfig"
          class="pointer-events-none absolute inset-y-0 right-0 z-[20] flex items-start"
        >
          <MprMipConfigPanel
            class="pointer-events-auto max-h-full rounded-r-[18px]!"
            :config="activeMprMipConfig"
            @config-change="updateActiveMprMipConfig"
          />
        </div>

        <div
          v-if="!isRightToolbarLayout && activeTab.viewType === 'MPR' && isMprSegmentationPanelOpen && activeMprSegmentationConfig"
          class="contents"
        >
          <MprSegmentationPanel
            class="pointer-events-auto"
            :config="activeMprSegmentationConfig"
            :is-processing="isMprSegmentationProcessing"
            :series-id="activeTab.seriesId"
            :series-label="activeTab.seriesTitle"
            @close="closeMprSegmentationPanel"
            @config-change="handleMprSegmentationConfigChange"
            @mode-change="handleMprSegmentationModeChange"
          />
        </div>

        <CompareStackView
          v-if="activeTab.viewType === 'CompareStack'"
          :active-tab="activeTab"
          :active-operation="props.activeOperation"
          :active-viewport-key="activeViewportKey"
          :get-annotations="getViewportAnnotations"
          :get-cursor-class="(viewportKey) => getViewportCursorClass(viewportKey)"
          :get-draft-annotation="getViewportDraftAnnotation"
          :get-draft-measurement-mode="getViewportDraftMeasurementMode"
          :get-draft-measurement="getViewportDraftMeasurement"
          :get-measurements="getViewportMeasurements"
          :get-starred-slice-count="getStarredSliceCount"
          :is-slice-starred="isSliceStarred"
          @copy-annotation="handleAnnotationCopy"
          @delete-annotation="handleAnnotationDelete"
          @copy-selected-measurement="handleCopySelectedMeasurement"
          @delete-selected-measurement="handleDeleteSelectedMeasurement"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @viewport-click="handleViewportClick"
          @viewport-wheel="handleViewportWheel"
          @pointer-down="handleViewportPointerDownWithAnnotations"
          @pointer-leave="handleViewportPointerLeaveWithAnnotations"
          @pointer-move="handleViewportPointerMoveWithAnnotations"
          @pointer-up="handleViewportPointerUpWithAnnotations"
          @pointer-cancel="handleViewportPointerCancelWithAnnotations"
          @toggle-slice-star="handleCompareSliceStar"
          @update-annotation-color="handleAnnotationColorUpdate"
          @update-annotation-size="handleAnnotationSizeUpdate"
          @update-annotation-text="handleAnnotationTextUpdate"
        />

        <LayoutView
          v-else-if="activeTab.viewType === 'Layout'"
          :active-tab="activeTab"
          :active-operation="props.activeOperation"
          :active-viewport-key="activeViewportKey"
          :get-annotations="getViewportAnnotations"
          :get-cursor-class="(viewportKey) => getViewportCursorClass(viewportKey)"
          :get-draft-annotation="getViewportDraftAnnotation"
          :get-draft-measurement-mode="getViewportDraftMeasurementMode"
          :get-draft-measurement="getViewportDraftMeasurement"
          :get-measurements="getViewportMeasurements"
          @copy-annotation="handleAnnotationCopy"
          @delete-annotation="handleAnnotationDelete"
          @copy-selected-measurement="handleCopySelectedMeasurement"
          @delete-selected-measurement="handleDeleteSelectedMeasurement"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @viewport-click="handleViewportClick"
          @viewport-wheel="handleViewportWheel"
          @pointer-down="handleViewportPointerDownWithAnnotations"
          @pointer-leave="handleViewportPointerLeaveWithAnnotations"
          @pointer-move="handleViewportPointerMoveWithAnnotations"
          @pointer-up="handleViewportPointerUpWithAnnotations"
          @pointer-cancel="handleViewportPointerCancelWithAnnotations"
          @slot-dicom-drop="emit('layoutSlotDicomDrop', $event)"
          @slot-series-drop="emit('layoutSlotSeriesDrop', $event)"
          @update-annotation-color="handleAnnotationColorUpdate"
          @update-annotation-size="handleAnnotationSizeUpdate"
          @update-annotation-text="handleAnnotationTextUpdate"
        />

        <StackView
          v-else-if="activeTab.viewType === 'Stack' || activeTab.viewType === 'PET'"
          :active-tab="activeTab"
          :active-operation="props.activeOperation"
          :annotations="getViewportAnnotations('single')"
          :corner-info="activeTab.cornerInfo"
          :cursor-class="getViewportCursorClass('single')"
          :draft-annotation="getViewportDraftAnnotation('single')"
          :draft-measurement-mode="getViewportDraftMeasurementMode('single')"
          :draft-measurement="getViewportDraftMeasurement('single')"
          :measurements="getViewportMeasurements('single')"
          :mtf-draft-mode="getViewportMtfDraftMode('single')"
          :mtf-draft="getViewportMtfDraft('single')"
          :mtf-items="getViewportMtfItems('single')"
          :qa-water-analysis="qaWaterAnalysis"
          :selected-mtf-id="selectedMtfId"
          :is-current-slice-starred="isStackCurrentSliceStarred(activeTab)"
          :starred-slice-count="getStarredSliceCount(activeTab.seriesId)"
          :starred-slice-indexes="getStarredSliceIndexes(activeTab.seriesId)"
          @copy-annotation="handleAnnotationCopy"
          @delete-annotation="handleAnnotationDelete"
          @copy-selected-measurement="handleCopySelectedMeasurement"
          @delete-selected-measurement="handleDeleteSelectedMeasurement"
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
          @toggle-slice-star="handleStackSliceStar"
          @update-annotation-color="handleAnnotationColorUpdate"
          @update-annotation-size="handleAnnotationSizeUpdate"
          @update-annotation-text="handleAnnotationTextUpdate"
        />

        <MprView
          v-else-if="activeTab.viewType === 'MPR'"
          :active-tab="activeTab"
          :active-operation="isPlaying || isPlaybackPaused ? '' : props.activeOperation"
          :active-viewport-key="activeViewportKey"
          :layout-key="activeMprLayoutKey"
          :mpr-segmentation-default-threshold-color="mprSegmentationDefaultThresholdColor"
          :mpr-segmentation-default-voi-color="mprSegmentationDefaultVoiColor"
          :mpr-segmentation-config="activeTab.mprSegmentationConfig ?? null"
          :get-annotations="getViewportAnnotations"
          :get-cursor-class="(viewportKey) => getViewportCursorClass(viewportKey)"
          :get-draft-annotation="getViewportDraftAnnotation"
          :get-draft-measurement-mode="getViewportDraftMeasurementMode"
          :get-draft-measurement="getViewportDraftMeasurement"
          :get-measurements="getViewportMeasurements"
          :get-mtf-draft-mode="getViewportMtfDraftMode"
          :get-mtf-draft="getViewportMtfDraft"
          :get-mtf-items="getViewportMtfItems"
          :selected-mtf-id="selectedMtfId"
          :get-corner-info="getMprCornerInfo"
          @copy-annotation="handleAnnotationCopy"
          @delete-annotation="handleAnnotationDelete"
          @copy-selected-measurement="handleCopySelectedMeasurement"
          @delete-selected-measurement="handleDeleteSelectedMeasurement"
          @clear-mtf="handleDeleteSelectedMtf"
          @copy-selected-mtf="handleCopySelectedMtf"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @open-mtf-curve="handleOpenMtfCurve"
          @select-mtf="handleSelectMtf"
          @mpr-segmentation-config-change="handleMprSegmentationConfigChange"
          @mpr-segmentation-mode-change="handleMprSegmentationModeChange"
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

        <PetCtFusionView
          v-else-if="activeTab.viewType === 'PETCTFusion'"
          :active-tab="activeTab"
          :active-operation="props.activeOperation"
          :active-viewport-key="activeViewportKey"
          :get-annotations="getViewportAnnotations"
          :get-cursor-class="(viewportKey) => getViewportCursorClass(viewportKey)"
          :get-draft-annotation="getViewportDraftAnnotation"
          :get-draft-measurement-mode="getViewportDraftMeasurementMode"
          :get-draft-measurement="getViewportDraftMeasurement"
          :get-measurements="getViewportMeasurements"
          @copy-annotation="handleAnnotationCopy"
          @delete-annotation="handleAnnotationDelete"
          @copy-selected-measurement="handleCopySelectedMeasurement"
          @delete-selected-measurement="handleDeleteSelectedMeasurement"
          @fusion-config-change="emit('fusionConfigChange', $event)"
          @fusion-registration-drag="emit('fusionRegistrationDrag', $event)"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
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
          :active-operation="props.activeOperation"
          @viewport-click="handleViewportClick"
          @pointer-down="handleViewportPointerDown"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />

        <FourDView
          v-else-if="activeTab.viewType === '4D'"
          :active-tab="activeTab"
          :active-operation="props.activeOperation"
          :active-viewport-key="activeViewportKey"
          :active-tools="activeTools"
          :are-toolbar-actions-disabled="areToolbarActionsDisabled"
          :get-annotations="getViewportAnnotations"
          :get-cursor-class="(viewportKey) => getViewportCursorClass(viewportKey)"
          :get-draft-annotation="getViewportDraftAnnotation"
          :get-draft-measurement-mode="getViewportDraftMeasurementMode"
          :get-draft-measurement="getViewportDraftMeasurement"
          :get-measurements="getViewportMeasurements"
          :get-mtf-draft-mode="getViewportMtfDraftMode"
          :get-mtf-draft="getViewportMtfDraft"
          :get-mtf-items="getViewportMtfItems"
          :selected-mtf-id="selectedMtfId"
          :get-corner-info="getMprCornerInfo"
          :is-tool-selected="isToolSelected"
          :is-tab-strip-collapsed="isTabStripCollapsed"
          :menu-icon-size="menuIconSize"
          :active-mpr-mip-config="activeMprMipConfig"
          :is-mpr-mip-panel-open="isMprMipPanelOpen"
          :is-slice-playback-paused="isPlaybackPaused"
          :is-slice-playback-playing="isPlaying"
          :open-menu-key="openMenuKey"
          :show-tab-strip-toggle="shouldShowTabStripToggle"
          :stack-tool-selections="stackToolSelections"
          :mpr-layout-key="activeMprLayoutKey"
          :toggle-icon-size="toggleIconSize"
          :toolbar-icon-size="toolbarIconSize"
          :toolbar-placement="viewerToolbarPlacement"
          :result-panel-icon="resultPanelIcon"
          :result-panel-open="activeResultPanelKind === 'mtfCurve'"
          :result-panel-title="resultPanelTitle"
          :result-panel-tool-key="resultPanelToolKey"
          @apply-tool="handleToolbarApplyTool"
          @close-mpr-mip-panel="closeMprMipPanel"
          @close-result-panel="closeResultPanel"
          @copy-annotation="handleAnnotationCopy"
          @delete-annotation="handleAnnotationDelete"
          @copy-selected-measurement="handleCopySelectedMeasurement"
          @delete-selected-measurement="handleDeleteSelectedMeasurement"
          @clear-mtf="handleDeleteSelectedMtf"
          @copy-selected-mtf="handleCopySelectedMtf"
          @end-playback="endPlayback"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @open-mtf-curve="handleOpenMtfCurve"
          @open-settings="emit('openSettings', $event)"
          @pause-playback="pausePlayback"
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
          @select-tool-option="handleToolbarSelectToolOption"
          @set-menu-open="handleToolbarSetMenuOpen"
          @toggle-tab-strip="toggleTabStripCollapsed"
          @mpr-mip-config-change="updateActiveMprMipConfig"
          @phase-change="emit('fourDPhaseChange', { tabKey: activeTab.key, phaseIndex: $event })"
          @fps-change="emit('fourDFpsChange', { tabKey: activeTab.key, fps: $event })"
          @playback-change="emit('fourDPlaybackChange', { tabKey: activeTab.key, isPlaying: $event })"
          @dock-resize="handleRightToolbarDockResize"
        >
          <template #result>
            <MeasurementMetricsPanelContent
              v-if="activeResultPanelKind === 'measurement'"
              :measurement="selectedMeasurementEntry?.measurement ?? null"
              :viewport-key="selectedMeasurementEntry?.viewportKey ?? null"
            />
            <MtfCurvePanelContent
              v-if="activeResultPanelKind === 'mtfCurve'"
              :mtf-item="selectedMtfItem"
              @copy="handleCopySelectedMtf"
              @delete="handleDeleteSelectedMtf"
            />
          </template>
        </FourDView>

        <DicomTagView
          v-else
          :active-tab="activeTab"
          :viewer-platform="viewerPlatform"
          @index-change="emit('tagIndexChange', $event)"
        />

        </div>

        <div
          v-if="shouldShowTopResultDock"
          class="viewer-workspace-right-dock-resize-handle"
          aria-hidden="true"
          @pointerdown="startRightDockResize('result', $event)"
        ></div>

        <ViewerResultDock
          v-if="shouldShowTopResultDock"
          :has-content="Boolean(activeResultPanelKind)"
          :icon="resultPanelIcon"
          :title="resultPanelTitle"
          :width="workspaceDockPreference.rightResultWidth"
          :collapsed="workspaceDockPreference.rightResultCollapsed"
          @close="closeResultPanel"
          @collapse-change="handleRightDockCollapseChange('result', $event)"
          @dock-resize="handleRightToolbarDockResize"
        >
          <MeasurementMetricsPanelContent
            v-if="activeResultPanelKind === 'measurement'"
            :measurement="selectedMeasurementEntry?.measurement ?? null"
            :viewport-key="selectedMeasurementEntry?.viewportKey ?? null"
          />
          <MtfCurvePanelContent
            v-if="activeResultPanelKind === 'mtfCurve'"
            :mtf-item="selectedMtfItem"
            @copy="handleCopySelectedMtf"
            @delete="handleDeleteSelectedMtf"
          />
          <QaWaterResultPanelContent
            v-else-if="activeResultPanelKind === 'qaWater'"
            :analysis="qaWaterAnalysis"
          />
        </ViewerResultDock>

        <div
          v-if="shouldShowRightToolbarDock && activeTab"
          class="viewer-workspace-right-dock-resize-handle"
          aria-hidden="true"
          @pointerdown="startRightDockResize('toolbar', $event)"
        ></div>

        <ViewerToolbarDock
          v-if="shouldShowRightToolbarDock && activeTab"
          :active-tab="activeTab"
          :active-tools="activeTools"
          :are-toolbar-actions-disabled="areToolbarActionsDisabled"
          :is-playing="isPlaying"
          :is-playback-paused="isPlaybackPaused"
          :is-tool-selected="isToolSelected"
          :menu-icon-size="menuIconSize"
          :open-menu-key="openMenuKey"
          :result-panel-icon="resultPanelIcon"
          :result-panel-open="Boolean(activeResultPanelKind)"
          :result-panel-title="resultPanelTitle"
          :result-panel-tool-key="resultPanelToolKey"
          :stack-tool-selections="stackToolSelections"
          :toolbar-icon-size="toolbarIconSize"
          :utility-panel-icon="rightToolbarUtilityPanelIcon"
          :utility-panel-open="rightToolbarUtilityPanelKind != null"
          :utility-panel-title="rightToolbarUtilityPanelTitle"
          :utility-panel-tool-key="rightToolbarUtilityPanelToolKey"
          :width="workspaceDockPreference.rightToolbarWidth"
          :collapsed="workspaceDockPreference.rightToolbarCollapsed"
          @apply-tool="handleToolbarApplyTool"
          @close-result-panel="closeResultPanel"
          @close-utility-panel="closeRightToolbarUtilityPanel"
          @end-playback="endPlayback"
          @pause-playback="pausePlayback"
          @open-settings="emit('openSettings', $event)"
          @select-tool-option="handleToolbarSelectToolOption"
          @set-menu-open="handleToolbarSetMenuOpen"
          @collapse-change="handleRightDockCollapseChange('toolbar', $event)"
          @dock-resize="handleRightToolbarDockResize"
        >
          <template #result>
            <MeasurementMetricsPanelContent
              v-if="activeResultPanelKind === 'measurement'"
              :measurement="selectedMeasurementEntry?.measurement ?? null"
              :viewport-key="selectedMeasurementEntry?.viewportKey ?? null"
            />
            <MtfCurvePanelContent
              v-if="activeResultPanelKind === 'mtfCurve'"
              :mtf-item="selectedMtfItem"
              @copy="handleCopySelectedMtf"
              @delete="handleDeleteSelectedMtf"
            />
            <QaWaterResultPanelContent
              v-else-if="activeResultPanelKind === 'qaWater'"
              :analysis="qaWaterAnalysis"
            />
          </template>
          <template #panel>
            <VolumeRenderConfigPanel
              v-if="rightToolbarUtilityPanelKind === 'volume' && activeVolumeRenderConfig"
              class="viewer-workspace-dock-panel"
              :config="activeVolumeRenderConfig"
              embedded
              @close="closeVolumeConfigPanel"
              @config-change="emit('volumeConfigChange', $event)"
            />
            <MprMipConfigPanel
              v-else-if="rightToolbarUtilityPanelKind === 'mprMip' && activeMprMipConfig"
              class="viewer-workspace-dock-panel"
              :config="activeMprMipConfig"
              embedded
              @config-change="updateActiveMprMipConfig"
            />
            <MprSegmentationPanel
              v-else-if="rightToolbarUtilityPanelKind === 'segmentation' && activeMprSegmentationConfig && activeTab.viewType === 'MPR'"
              class="viewer-workspace-dock-panel"
              :config="activeMprSegmentationConfig"
              :is-processing="isMprSegmentationProcessing"
              :series-id="activeTab.seriesId"
              :series-label="activeTab.seriesTitle"
              embedded
              @config-change="handleMprSegmentationConfigChange"
              @mode-change="handleMprSegmentationModeChange"
            />
          </template>
        </ViewerToolbarDock>
        <div
          v-if="isRightDockResizing"
          class="viewer-workspace-right-dock-resize-preview"
          :class="`viewer-workspace-right-dock-resize-preview--${rightDockResizePreviewTarget ?? 'toolbar'}`"
          aria-hidden="true"
        ></div>
      </div>

      <div
        v-else
        class="viewer-workspace-empty grid flex-1 place-items-center rounded-[20px] border border-transparent p-8 text-center transition duration-150"
        :class="quickPreviewDropClass"
        @dragenter="handleQuickPreviewDragEnter"
        @dragover="handleQuickPreviewDragOver"
        @dragleave="handleQuickPreviewDragLeave"
        @drop="handleQuickPreviewDrop"
      >
        <div class="max-w-lg space-y-3">
          <div class="text-2xl font-semibold tracking-[0.06em] text-[var(--theme-text-primary)]">{{ isQuickPreviewDropActive ? t('dropQuickPreview') : t('openView') }}</div>
          <p class="text-sm leading-7 text-[var(--theme-text-secondary)]">
            {{ isQuickPreviewDropActive ? t('emptyDropQuickPreviewDesc') : message || t('openViewDesc') }}
          </p>
        </div>
      </div>
    </div>

    <FusionRegistrationSaveDialog
      v-model:mode="fusionRegistrationSaveMode"
      v-model:output-directory="fusionRegistrationOutputDirectory"
      v-model:series-description="fusionRegistrationSeriesDescription"
      :can-open-folder="canOpenFusionRegistrationFolder"
      :error="fusionRegistrationSaveError"
      :is-open="isFusionRegistrationSaveDialogOpen"
      :is-saving="isFusionRegistrationSaving"
      :is-web="isFusionRegistrationWebMode"
      :saved-directory="lastFusionRegistrationExport?.directoryPath ?? null"
      :source-series-description="fusionRegistrationSourceSeriesDescription"
      @browse="handleFusionRegistrationBrowseDirectory"
      @close="isFusionRegistrationSaveDialogOpen = false"
      @open-folder="handleOpenFusionRegistrationFolder"
      @save="handleFusionRegistrationSaveConfirm"
    />

    <input
      ref="fusionRegistrationFileInputRef"
      class="hidden"
      type="file"
      accept=".br,application/json"
      @change="handleFusionRegistrationFileSelected"
    />

    <WorkspaceExportNameDialog
      v-if="isExportNameDialogOpen"
      v-model="exportNameInput"
      v-model:input-ref="exportNameInputRef"
      :copy="workspaceExportCopy"
      :error="exportNameError"
      :extension="exportNameExtension"
      :format="exportNameDialogFormat"
      @cancel="cancelExportNameDialog"
      @confirm="confirmExportNameDialog"
    />

    <WorkspaceExportNotice
      v-if="exportNotice"
      :copy="workspaceExportCopy"
      :notice="exportNotice"
      @close="exportNotice = null"
      @open-location="handleOpenExportLocation"
    />
  </main>
</template>

<style scoped>
.viewer-workspace-empty.theme-shell-panel-soft {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
}

.viewer-workspace-empty.theme-drop-active {
  border-style: dashed;
}

.viewer-workspace-content {
  position: relative;
}

.viewer-workspace-content--right-toolbar {
  align-items: stretch;
  gap: 4px;
}

.viewer-workspace-right-dock-resize-handle {
  position: relative;
  flex: 0 0 5px;
  align-self: stretch;
  cursor: col-resize;
  -webkit-app-region: no-drag;
}

.viewer-workspace-right-dock-resize-handle::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 50%;
  border-left: 2px solid color-mix(in srgb, var(--theme-accent) 46%, var(--theme-border-strong));
  content: "";
  opacity: 0.86;
  transform: translateX(-50%);
  transition:
    border-color 150ms ease,
    opacity 150ms ease;
}

.viewer-workspace-right-dock-resize-handle:hover::before,
.viewer-workspace-content[data-right-dock-resizing="true"] .viewer-workspace-right-dock-resize-handle::before {
  border-left-style: dashed;
  border-left-color: color-mix(in srgb, var(--theme-accent) 72%, var(--theme-border-strong));
  opacity: 1;
}

.viewer-workspace-right-dock-resize-preview {
  position: absolute;
  top: 8px;
  right: var(--viewer-right-dock-preview-width, 0px);
  bottom: 8px;
  z-index: 90;
  border-left: 1px dashed color-mix(in srgb, var(--theme-accent) 78%, transparent);
  pointer-events: none;
}

.viewer-workspace-dock-panel {
  width: 100%;
  max-width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 14px !important;
}
</style>
