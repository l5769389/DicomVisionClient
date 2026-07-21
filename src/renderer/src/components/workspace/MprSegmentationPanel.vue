<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import {
  MPR_SEGMENTATION_SIDECAR_EXTENSION,
  buildMprSegmentationSidecar,
  buildMprSegmentationSidecarFileName,
  mergeMprSegmentationSidecarItems,
  parseMprSegmentationSidecarText
} from '../../composables/workspace/segmentation/mprSegmentationSidecar'
import { dispatchWorkspaceStatusToast } from '../../composables/workspace/tasks/workspaceStatus'
import { chooseCustomExportDirectory, saveBinaryFile, type SaveFilePreference } from '../../platform/exporting'
import { viewerRuntime } from '../../platform/runtime'
import {
  MPR_SEGMENTATION_DEPTH_LIMITS,
  MPR_SEGMENTATION_HU_LIMITS,
  MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS,
  MPR_SEGMENTATION_MAX_VOI_SPHERES,
  createDefaultMprSegmentationConfig,
  normalizeMprSegmentationConfig,
  resolveMprLegacyVoiSphere,
  type MprSegmentationConfigActionType,
  type MprSegmentationConfig,
  type MprThresholdRegion,
  type MprVoiSphere
} from '../../types/viewer'

const props = defineProps<{
  config: MprSegmentationConfig
  embedded?: boolean
  mobile?: boolean
  isProcessing?: boolean
  seriesId?: string | null
  seriesLabel?: string | null
}>()

const emit = defineEmits<{
  close: []
  configChange: [config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType]
  modeChange: [mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null]
}>()

type PanelActionType = MprSegmentationConfigActionType

const PANEL_MARGIN_PX = 12
const DEFAULT_PANEL_TOP_PX = 80
const DEFAULT_PANEL_RIGHT_PX = 16
const DEFAULT_PANEL_WIDTH_PX = 520

interface PanelPosition {
  x: number
  y: number
}

interface PendingExportConfirmation {
  defaultFileNameStem: string
  fileNameStem: string
  directoryPath: string | null
  selectedThresholdRegionIds: Set<string>
  selectedVoiSphereIds: Set<string>
}

type SegmentationMode = 'segmentation:threshold' | 'segmentation:voi'

const draftConfig = ref<MprSegmentationConfig | null>(null)
const localDraftActive = ref(false)
const embeddedMode = ref<SegmentationMode>('segmentation:threshold')
const importInputRef = ref<HTMLInputElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelPosition = ref<PanelPosition | null>(null)
const panelDragState = ref<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
const pendingExportConfirmation = ref<PendingExportConfirmation | null>(null)
const { exportPreference, locale } = useUiPreferences()
const displayedConfig = computed(() => draftConfig.value ?? normalizeMprSegmentationConfig(props.config))
const regions = computed(() => displayedConfig.value.thresholdRegions)
const voiSpheres = computed(() => displayedConfig.value.voiSpheres)
const selectedRegion = computed(() =>
  regions.value.find((region) => region.id === displayedConfig.value.selectedRegionId) ?? null
)
const isZh = computed(() => locale.value === 'zh-CN')
const descriptionPlaceholder = computed(() => isZh.value ? '描述信息' : 'Description')
const panelCopy = computed(() => isZh.value
  ? {
      eyebrow: '分割',
      title: '阈值分割与球形 VOI',
      updating: '更新中',
      preview: '预览',
      import: '导入',
      export: '导出',
      close: '关闭',
      emptyThreshold: '在阈值分割模式中绘制一个或多个矩形区域。每个区域使用 HU > 阈值。',
      hideRegion: '隐藏分割',
      showRegion: '显示分割',
      deleteRegion: '删除分割',
      includeInExport: '包含在导出中',
      color: '颜色',
      description: '描述',
      percent: '百分比',
      depth: '深度',
      voiTitle: 'VOI 球体',
      voiEmpty: '在 VOI 模式中绘制圆形区域',
      item: '项',
      radius: '半径',
      hideVoi: '隐藏 VOI',
      showVoi: '显示 VOI',
      deleteVoi: '删除 VOI',
      clearRegions: '清除分割',
      clearAll: '全部清除',
      exportNoSelection: '请选择至少一个分割或 VOI 项。',
      exportConfirmTitle: '导出分割文件',
      exportConfirmMessage: (count: number) => `确认导出 ${count} 个分割项？`,
      exportPathLabel: '保存位置',
      exportFileLabel: '文件名',
      exportChoosePath: '选择',
      exportSuffixLabel: '固定格式',
      cancel: '取消',
      confirmExport: '确认导出',
      exportSuccess: '分割文件已导出',
      exportFailure: '分割导出失败',
      exportPathChooseFailure: '选择导出路径失败',
      importSuccess: '已导入分割项',
      importSkipped: (count: number) => `已达到数量上限，跳过 ${count} 个分割项。`,
      importFailure: '分割导入失败'
    }
  : {
      eyebrow: 'Segmentation',
      title: 'Threshold regions and spherical VOI',
      updating: 'Updating',
      preview: 'Preview',
      import: 'Import',
      export: 'Export',
      close: 'Close',
      emptyThreshold: 'Draw one or more rectangles in threshold mode. Each region uses HU > threshold.',
      hideRegion: 'Hide region',
      showRegion: 'Show region',
      deleteRegion: 'Delete region',
      includeInExport: 'Include in export',
      color: 'Color',
      description: 'Description',
      percent: 'Percent',
      depth: 'Depth',
      voiTitle: 'VOI sphere',
      voiEmpty: 'Draw a circle in VOI mode',
      item: 'item',
      radius: 'Radius',
      hideVoi: 'Hide VOI',
      showVoi: 'Show VOI',
      deleteVoi: 'Delete VOI',
      clearRegions: 'Clear regions',
      clearAll: 'Clear all',
      exportNoSelection: 'Select at least one segmentation or VOI item.',
      exportConfirmTitle: 'Export segmentation file',
      exportConfirmMessage: (count: number) => `Export ${count} segmentation item${count === 1 ? '' : 's'}?`,
      exportPathLabel: 'Save location',
      exportFileLabel: 'File name',
      exportChoosePath: 'Choose',
      exportSuffixLabel: 'Fixed format',
      cancel: 'Cancel',
      confirmExport: 'Export',
      exportSuccess: 'Segmentation file exported',
      exportFailure: 'Failed to export segmentation',
      exportPathChooseFailure: 'Failed to choose export location',
      importSuccess: 'Imported segmentation items',
      importSkipped: (count: number) => `Skipped ${count} item${count === 1 ? '' : 's'} because the limit was reached.`,
      importFailure: 'Failed to import segmentation'
    }
)
const panelRootStyle = computed<Record<string, string>>(() => {
  if (props.embedded) {
    return {} as Record<string, string>
  }
  const position = panelPosition.value
  if (position) {
    return {
      left: `${position.x}px`,
      top: `${position.y}px`,
      right: 'auto',
      maxHeight: `calc(100vh - ${PANEL_MARGIN_PX * 2}px)`
    }
  }
  return {
    left: 'auto',
    right: `${DEFAULT_PANEL_RIGHT_PX}px`,
    top: `${DEFAULT_PANEL_TOP_PX}px`,
    maxHeight: `calc(100vh - ${PANEL_MARGIN_PX * 2}px)`
  }
})

watch(
  () => props.config,
  () => {
    if (draftConfig.value && localDraftActive.value) {
      return
    }
    draftConfig.value = null
  },
  { deep: true }
)

watch(
  () => [displayedConfig.value.selectedVoi, displayedConfig.value.selectedVoiId, displayedConfig.value.selectedRegionId] as const,
  ([selectedVoi, selectedVoiId, selectedRegionId]) => {
    if (selectedVoi || selectedVoiId) {
      embeddedMode.value = 'segmentation:voi'
      return
    }
    if (selectedRegionId) {
      embeddedMode.value = 'segmentation:threshold'
    }
  },
  { immediate: true }
)

const exportableItemCount = computed(() => regions.value.length + voiSpheres.value.length)
const isEmbeddedVoiMode = computed(() => props.embedded && embeddedMode.value === 'segmentation:voi')
const currentModeClearDisabled = computed(() => isEmbeddedVoiMode.value ? voiSpheres.value.length === 0 : regions.value.length === 0)
const currentModeClearLabel = computed(() => isEmbeddedVoiMode.value ? (isZh.value ? '清除 VOI' : 'Clear VOI') : panelCopy.value.clearRegions)
const currentModeClearIcon = computed(() => isEmbeddedVoiMode.value ? 'segmentation-voi' : 'segmentation-threshold')
const hasAnySegmentationItems = computed(() => regions.value.length > 0 || voiSpheres.value.length > 0)
const pendingExportSelectedCount = computed(() => {
  const request = pendingExportConfirmation.value
  if (!request) {
    return 0
  }
  return regions.value.filter((region) => request.selectedThresholdRegionIds.has(region.id)).length +
    voiSpheres.value.filter((sphere) => request.selectedVoiSphereIds.has(sphere.id)).length
})
const isExportConfirmOpen = computed(() => pendingExportConfirmation.value !== null)
const isDesktopRuntime = computed(() => viewerRuntime.platform === 'desktop')

function emitConfig(config: MprSegmentationConfig, actionType: PanelActionType = 'end'): void {
  const normalized = normalizeMprSegmentationConfig(config)
  if (actionType === 'local') {
    localDraftActive.value = true
    draftConfig.value = normalized
    emit('configChange', normalized, actionType)
    return
  }

  if (actionType === 'select' || actionType === 'style') {
    localDraftActive.value = false
    draftConfig.value = normalized
    emit('configChange', normalized, actionType)
    return
  }

  if (actionType === 'move') {
    localDraftActive.value = true
    draftConfig.value = normalized
    emit('configChange', normalized, actionType)
  } else {
    localDraftActive.value = false
    draftConfig.value = null
    emit('configChange', normalized, actionType)
  }
}

function getMprSegmentationFileNameStem(fileName: string): string {
  const suffix = `.${MPR_SEGMENTATION_SIDECAR_EXTENSION}`
  return fileName.toLowerCase().endsWith(suffix)
    ? fileName.slice(0, -suffix.length)
    : fileName.replace(/\.json$/i, '')
}

function normalizeExportFileNameStem(fileNameStem: string, fallbackStem: string): string {
  const sanitized = fileNameStem
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.+$/g, '')
    .trim()
  return sanitized || fallbackStem
}

function buildExportFileName(fileNameStem: string, fallbackStem: string): string {
  return `${normalizeExportFileNameStem(fileNameStem, fallbackStem)}.${MPR_SEGMENTATION_SIDECAR_EXTENSION}`
}

function getExportSavePreference(directoryPath?: string | null): SaveFilePreference {
  if (viewerRuntime.platform === 'desktop') {
    const directory = directoryPath?.trim()
    return directory
      ? {
          ...exportPreference.value,
          locationMode: 'custom',
          desktopDirectory: directory
        }
      : {
          ...exportPreference.value,
          locationMode: 'default'
        }
  }
  return {
    ...exportPreference.value,
    locationMode: 'default'
  }
}

async function resolveExportConfirmLocation(): Promise<string | null> {
  if (viewerRuntime.platform !== 'desktop') {
    return null
  }
  if (exportPreference.value.locationMode === 'custom') {
    return exportPreference.value.desktopDirectory?.trim() || null
  }
  try {
    const defaultDirectory = await window.viewerApi?.getDefaultExportDirectory?.()
    return typeof defaultDirectory === 'string' && defaultDirectory.trim() ? defaultDirectory.trim() : null
  } catch {
    return null
  }
}

function getAppVersion(): string | null {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null
}

async function requestExportSelectedSegmentation(): Promise<void> {
  if (exportableItemCount.value <= 0) {
    dispatchWorkspaceStatusToast(panelCopy.value.exportNoSelection, 'warning')
    return
  }

  const defaultFileNameStem = getMprSegmentationFileNameStem(buildMprSegmentationSidecarFileName())
  pendingExportConfirmation.value = {
    defaultFileNameStem,
    fileNameStem: defaultFileNameStem,
    directoryPath: await resolveExportConfirmLocation(),
    selectedThresholdRegionIds: new Set(regions.value.map((region) => region.id)),
    selectedVoiSphereIds: new Set(voiSpheres.value.map((sphere) => sphere.id))
  }
}

function closeExportConfirmDialog(): void {
  pendingExportConfirmation.value = null
}

function updatePendingExportFileNameStem(value: string): void {
  if (!pendingExportConfirmation.value) {
    return
  }
  pendingExportConfirmation.value.fileNameStem = value
}

function updatePendingExportDirectoryPath(value: string): void {
  if (!pendingExportConfirmation.value) {
    return
  }
  pendingExportConfirmation.value.directoryPath = value
}

function isPendingExportRegionSelected(regionId: string): boolean {
  return pendingExportConfirmation.value?.selectedThresholdRegionIds.has(regionId) ?? false
}

function isPendingExportVoiSelected(sphereId: string): boolean {
  return pendingExportConfirmation.value?.selectedVoiSphereIds.has(sphereId) ?? false
}

function updatePendingExportRegionSelection(regionId: string, checked: boolean): void {
  const request = pendingExportConfirmation.value
  if (!request) {
    return
  }
  const next = new Set(request.selectedThresholdRegionIds)
  if (checked) {
    next.add(regionId)
  } else {
    next.delete(regionId)
  }
  pendingExportConfirmation.value = {
    ...request,
    selectedThresholdRegionIds: next
  }
}

function updatePendingExportVoiSelection(sphereId: string, checked: boolean): void {
  const request = pendingExportConfirmation.value
  if (!request) {
    return
  }
  const next = new Set(request.selectedVoiSphereIds)
  if (checked) {
    next.add(sphereId)
  } else {
    next.delete(sphereId)
  }
  pendingExportConfirmation.value = {
    ...request,
    selectedVoiSphereIds: next
  }
}

async function choosePendingExportDirectory(): Promise<void> {
  if (!pendingExportConfirmation.value) {
    return
  }
  try {
    const selectedDirectory = await chooseCustomExportDirectory()
    if (selectedDirectory?.desktopDirectory) {
      pendingExportConfirmation.value.directoryPath = selectedDirectory.desktopDirectory
    }
  } catch (error) {
    console.error('Failed to choose segmentation export location.', error)
    dispatchWorkspaceStatusToast(panelCopy.value.exportPathChooseFailure, 'error')
  }
}

async function confirmPendingExport(): Promise<void> {
  const exportRequest = pendingExportConfirmation.value
  if (!exportRequest) {
    return
  }
  if (pendingExportSelectedCount.value <= 0) {
    dispatchWorkspaceStatusToast(panelCopy.value.exportNoSelection, 'warning')
    return
  }
  pendingExportConfirmation.value = null

  try {
    const sidecar = buildMprSegmentationSidecar({
      appVersion: getAppVersion(),
      config: displayedConfig.value,
      selectedThresholdRegionIds: exportRequest.selectedThresholdRegionIds,
      selectedVoiSphereIds: exportRequest.selectedVoiSphereIds,
      source: {
        seriesId: props.seriesId ?? null,
        seriesLabel: props.seriesLabel ?? null,
        viewType: 'MPR'
      }
    })
    const data = new TextEncoder().encode(JSON.stringify(sidecar, null, 2))
    const result = await saveBinaryFile({
      data,
      fileName: buildExportFileName(exportRequest.fileNameStem, exportRequest.defaultFileNameStem),
      mimeType: 'application/json',
      preference: getExportSavePreference(exportRequest.directoryPath)
    })
    dispatchWorkspaceStatusToast(panelCopy.value.exportSuccess, 'success', {
      canOpenLocation: result.mode === 'filesystem',
      detail: result.locationDescription,
      directoryPath: result.directoryPath ?? null,
      filePath: result.filePath ?? null
    })
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message : panelCopy.value.exportFailure
    dispatchWorkspaceStatusToast(message, 'error', { durationMs: 6000 })
  }
}

function openImportFilePicker(): void {
  importInputRef.value?.click()
}

async function handleImportFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) {
    return
  }

  try {
    const importedItems = parseMprSegmentationSidecarText(await file.text())
    const mergeResult = mergeMprSegmentationSidecarItems(displayedConfig.value, importedItems, {
      maxThresholdRegions: MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS,
      maxVoiSpheres: MPR_SEGMENTATION_MAX_VOI_SPHERES
    })
    const firstImportedRegionId = mergeResult.importedThresholdRegionIds[0] ?? null
    const firstImportedVoiId = mergeResult.importedVoiSphereIds[0] ?? null
    const importedCount = mergeResult.importedThresholdRegionIds.length + mergeResult.importedVoiSphereIds.length
    const skippedCount = mergeResult.skippedThresholdRegionCount + mergeResult.skippedVoiSphereCount
    if (importedCount <= 0) {
      dispatchWorkspaceStatusToast(panelCopy.value.importSkipped(skippedCount), 'warning', { durationMs: 6000 })
      return
    }
    const selectedImportedRegion = firstImportedRegionId
      ? mergeResult.config.thresholdRegions.find((region) => region.id === firstImportedRegionId) ?? null
      : null
    if (selectedImportedRegion) {
      emit('modeChange', 'segmentation:threshold', selectedImportedRegion.box.sourceViewport)
    } else if (firstImportedVoiId) {
      emit('modeChange', 'segmentation:voi')
    }
    emitConfig(mergeResult.config, 'end')
    dispatchWorkspaceStatusToast(`${panelCopy.value.importSuccess}: ${importedCount}`, 'success')
    if (skippedCount > 0) {
      dispatchWorkspaceStatusToast(panelCopy.value.importSkipped(skippedCount), 'warning', { durationMs: 6000 })
    }
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message : panelCopy.value.importFailure
    dispatchWorkspaceStatusToast(message, 'error', { durationMs: 6000 })
  }
}

onBeforeUnmount(() => {
  stopPanelDrag()
})

function emitPatch(patch: Partial<MprSegmentationConfig>, actionType: PanelActionType = 'end'): void {
  emitConfig(
    {
      ...displayedConfig.value,
      ...patch
    },
    actionType
  )
}

function hasStatsPatch(patch: Partial<MprThresholdRegion> | Partial<MprVoiSphere>): boolean {
  return Object.prototype.hasOwnProperty.call(patch, 'stats')
}

function patchRegion(regionId: string, patch: Partial<MprThresholdRegion>, actionType: PanelActionType = 'end'): void {
  emitPatch(
    {
      thresholdRegions: regions.value.map((region) =>
        region.id === regionId
          ? {
              ...region,
              ...patch,
              box: patch.box ?? region.box,
              stats: hasStatsPatch(patch) ? patch.stats ?? null : region.stats
            }
          : region
      )
    },
    actionType
  )
}

function selectRegion(regionId: string): void {
  const region = regions.value.find((candidate) => candidate.id === regionId)
  embeddedMode.value = 'segmentation:threshold'
  emit('modeChange', 'segmentation:threshold', region?.box.sourceViewport ?? null)
  emitPatch({ selectedRegionId: regionId, selectedVoi: false, selectedVoiId: null }, 'select')
}

function toggleRegion(region: MprThresholdRegion): void {
  patchRegion(region.id, { enabled: !region.enabled }, 'end')
}

function deleteRegion(regionId: string): void {
  const nextRegions = regions.value.filter((region) => region.id !== regionId)
  const isDeletingSelectedRegion = displayedConfig.value.selectedRegionId === regionId
  emitPatch(
    {
      selectedRegionId: isDeletingSelectedRegion ? nextRegions[0]?.id ?? null : displayedConfig.value.selectedRegionId,
      selectedVoi: isDeletingSelectedRegion ? false : displayedConfig.value.selectedVoi,
      selectedVoiId: isDeletingSelectedRegion ? null : displayedConfig.value.selectedVoiId,
      thresholdRegions: nextRegions
    },
    'end'
  )
}

function updateThreshold(region: MprThresholdRegion, value: string, actionType: 'move' | 'end' = 'move'): void {
  patchRegion(region.id, { thresholdHu: Number(value), thresholdMode: 'hu', stats: null }, actionType === 'move' ? 'local' : actionType)
}

function updateThresholdPercentile(region: MprThresholdRegion, value: string, actionType: 'move' | 'end' = 'move'): void {
  patchRegion(region.id, { thresholdPercentile: Number(value), thresholdMode: 'percentile', stats: null }, actionType === 'move' ? 'local' : actionType)
}

function updateThresholdMode(region: MprThresholdRegion, mode: MprThresholdRegion['thresholdMode']): void {
  patchRegion(region.id, { thresholdMode: mode, stats: null }, 'end')
}

function updateDepth(region: MprThresholdRegion, value: string, actionType: 'move' | 'end' = 'move'): void {
  patchRegion(
    region.id,
    {
      box: {
        ...region.box,
        depthMm: Number(value)
      },
      stats: null
    },
    actionType
  )
}

function updateRegionColor(region: MprThresholdRegion, value: string): void {
  patchRegion(region.id, { color: value }, 'style')
}

function updateRegionLabel(region: MprThresholdRegion, value: string): void {
  patchRegion(region.id, { label: value }, 'style')
}

function clampPanelPosition(x: number, y: number): PanelPosition {
  if (typeof window === 'undefined') {
    return { x, y }
  }
  const panel = panelRef.value
  const width = panel?.offsetWidth || DEFAULT_PANEL_WIDTH_PX
  const height = panel?.offsetHeight || Math.min(520, window.innerHeight - PANEL_MARGIN_PX * 2)
  const maxX = Math.max(PANEL_MARGIN_PX, window.innerWidth - width - PANEL_MARGIN_PX)
  const maxY = Math.max(PANEL_MARGIN_PX, window.innerHeight - Math.min(height, window.innerHeight - PANEL_MARGIN_PX * 2) - PANEL_MARGIN_PX)
  return {
    x: Math.max(PANEL_MARGIN_PX, Math.min(maxX, x)),
    y: Math.max(PANEL_MARGIN_PX, Math.min(maxY, y))
  }
}

function stopPanelDrag(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', handlePanelPointerMove)
    window.removeEventListener('pointerup', handlePanelPointerUp)
    window.removeEventListener('pointercancel', handlePanelPointerUp)
  }
  panelDragState.value = null
}

function beginPanelDrag(event: PointerEvent): void {
  if (props.embedded) {
    return
  }
  if (event.button !== 0) {
    return
  }
  const panel = panelRef.value
  if (!panel) {
    return
  }
  const rect = panel.getBoundingClientRect()
  const currentPosition = panelPosition.value ?? { x: rect.left, y: rect.top }
  const clampedPosition = clampPanelPosition(currentPosition.x, currentPosition.y)
  panelPosition.value = clampedPosition
  panelDragState.value = {
    pointerId: event.pointerId,
    offsetX: event.clientX - clampedPosition.x,
    offsetY: event.clientY - clampedPosition.y
  }
  window.addEventListener('pointermove', handlePanelPointerMove)
  window.addEventListener('pointerup', handlePanelPointerUp)
  window.addEventListener('pointercancel', handlePanelPointerUp)
  event.preventDefault()
  event.stopPropagation()
}

function handlePanelPointerMove(event: PointerEvent): void {
  const dragState = panelDragState.value
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return
  }
  panelPosition.value = clampPanelPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY)
}

function handlePanelPointerUp(event: PointerEvent): void {
  const dragState = panelDragState.value
  if (dragState && dragState.pointerId !== event.pointerId) {
    return
  }
  stopPanelDrag()
}

function clearThresholdRegions(): void {
  emitPatch({ selectedRegionId: null, thresholdRegions: [] }, 'end')
}

function clearVoi(sphereId: string): void {
  const nextSpheres = voiSpheres.value.filter((sphere) => sphere.id !== sphereId)
  const isDeletingSelectedVoi = displayedConfig.value.selectedVoiId === sphereId
  const nextSelectedVoi = resolveMprLegacyVoiSphere(
    nextSpheres,
    isDeletingSelectedVoi ? nextSpheres[0]?.id ?? null : displayedConfig.value.selectedVoiId
  )
  emitPatch({
    selectedRegionId: isDeletingSelectedVoi ? null : displayedConfig.value.selectedRegionId,
    selectedVoi: nextSelectedVoi !== null,
    selectedVoiId: nextSelectedVoi?.id ?? null,
    voiSpheres: nextSpheres,
    voiSphere: nextSelectedVoi
  }, 'end')
}

function clearVoiSpheres(): void {
  emitPatch({
    selectedRegionId: displayedConfig.value.selectedRegionId,
    selectedVoi: false,
    selectedVoiId: null,
    voiSpheres: [],
    voiSphere: null
  }, 'end')
}

function clearCurrentModeItems(): void {
  if (isEmbeddedVoiMode.value) {
    clearVoiSpheres()
    return
  }
  clearThresholdRegions()
}

function patchVoiSphere(sphereId: string, patch: Partial<MprVoiSphere>, actionType: PanelActionType = 'end'): void {
  const sphere = voiSpheres.value.find((candidate) => candidate.id === sphereId)
  if (!sphere) {
    return
  }
  const nextSphere = {
    ...sphere,
    ...patch,
    stats: hasStatsPatch(patch) ? patch.stats ?? null : sphere.stats
  }
  const nextSpheres = voiSpheres.value.map((candidate) => (candidate.id === sphereId ? nextSphere : candidate))
  const legacyVoiSphere = resolveMprLegacyVoiSphere(nextSpheres, displayedConfig.value.selectedVoiId)
  emitPatch(
    {
      voiSpheres: nextSpheres,
      voiSphere: legacyVoiSphere
    },
    actionType
  )
}

function selectVoi(sphereId: string): void {
  if (!voiSpheres.value.some((sphere) => sphere.id === sphereId)) {
    return
  }
  embeddedMode.value = 'segmentation:voi'
  emit('modeChange', 'segmentation:voi')
  emitPatch({ selectedRegionId: null, selectedVoi: true, selectedVoiId: sphereId }, 'select')
}

function selectSegmentationMode(mode: SegmentationMode): void {
  embeddedMode.value = mode
  if (mode === 'segmentation:voi') {
    const selectedVoi = displayedConfig.value.selectedVoiId
      ? voiSpheres.value.find((sphere) => sphere.id === displayedConfig.value.selectedVoiId) ?? null
      : null
    const targetVoi = selectedVoi ?? voiSpheres.value[0] ?? null
    if (targetVoi) {
      selectVoi(targetVoi.id)
      return
    }
    emit('modeChange', 'segmentation:voi')
    emitPatch({ selectedRegionId: null, selectedVoi: true, selectedVoiId: null }, 'select')
    return
  }

  const selectedThreshold = displayedConfig.value.selectedRegionId
    ? regions.value.find((region) => region.id === displayedConfig.value.selectedRegionId) ?? null
    : null
  const targetRegion = selectedThreshold ?? regions.value[0] ?? null
  if (targetRegion) {
    selectRegion(targetRegion.id)
    return
  }
  emit('modeChange', 'segmentation:threshold', null)
  emitPatch({ selectedRegionId: null, selectedVoi: false, selectedVoiId: null }, 'select')
}

function updateVoiColor(sphere: MprVoiSphere, value: string): void {
  patchVoiSphere(sphere.id, { color: value }, 'style')
}

function updateVoiLabel(sphere: MprVoiSphere, value: string): void {
  patchVoiSphere(sphere.id, { label: value }, 'style')
}

function clearAll(): void {
  emitConfig(createDefaultMprSegmentationConfig(), 'end')
}

function formatMetric(value: number | null | undefined, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'
}

function formatStatsSummary(region: MprThresholdRegion): string {
  const stats = region.stats
  return [
    `mean ${formatMetric(stats?.huMean)}`,
    `min ${formatMetric(stats?.huMin)}`,
    `max ${formatMetric(stats?.huMax)}`,
    `sd ${formatMetric(stats?.huStdDev)}`,
    `vol ${formatMetric(stats?.volumeCm3)} cm3`,
    `n ${stats?.sampleCount ?? 0}`,
    `eff ${formatMetric(stats?.effectiveThresholdHu)}`
  ].join(' / ')
}

function getThresholdMetricRows(region: MprThresholdRegion): Array<{ key: string; label: string; value: string }> {
  const stats = region.stats
  return [
    { key: 'mean', label: 'mean', value: formatMetric(stats?.huMean) },
    { key: 'min', label: 'min', value: formatMetric(stats?.huMin) },
    { key: 'max', label: 'max', value: formatMetric(stats?.huMax) },
    { key: 'sd', label: 'sd', value: formatMetric(stats?.huStdDev) },
    { key: 'vol', label: 'vol', value: `${formatMetric(stats?.volumeCm3)} cm3` },
    { key: 'n', label: 'n', value: stats ? String(stats.sampleCount) : '--' },
    { key: 'eff', label: 'eff', value: formatMetric(stats?.effectiveThresholdHu) }
  ]
}

function formatVoiStatsSummary(sphere: MprVoiSphere): string {
  const stats = sphere.stats
  return [
    `mean ${formatMetric(stats?.huMean)}`,
    `min ${formatMetric(stats?.huMin)}`,
    `max ${formatMetric(stats?.huMax)}`,
    `sd ${formatMetric(stats?.huStdDev)}`,
    `vol ${formatMetric(stats?.volumeCm3)} cm3`,
    `n ${stats?.sampleCount ?? 0}`
  ].join(' / ')
}

function getVoiMetricRows(sphere: MprVoiSphere): Array<{ key: string; label: string; value: string }> {
  const stats = sphere.stats
  return [
    { key: 'mean', label: 'mean', value: formatMetric(stats?.huMean) },
    { key: 'min', label: 'min', value: formatMetric(stats?.huMin) },
    { key: 'max', label: 'max', value: formatMetric(stats?.huMax) },
    { key: 'sd', label: 'sd', value: formatMetric(stats?.huStdDev) },
    { key: 'vol', label: 'vol', value: `${formatMetric(stats?.volumeCm3)} cm3` },
    { key: 'n', label: 'n', value: stats ? String(stats.sampleCount) : '--' }
  ]
}

function formatEffectiveThreshold(region: MprThresholdRegion): string {
  return formatMetric(region.stats?.effectiveThresholdHu ?? region.thresholdHu)
}
</script>

<template>
  <div
    v-bind="$attrs"
    ref="panelRef"
    class="theme-shell-panel mpr-segmentation-panel flex flex-col overflow-hidden rounded-xl border border-sky-100/25 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-panel-strong-solid)_98%,black_2%),color-mix(in_srgb,var(--theme-surface-panel-solid)_96%,black_4%))] px-3 pb-2.5 pt-0 backdrop-blur-xl"
    :class="[
      props.embedded ? 'mpr-segmentation-panel--embedded relative h-full min-h-0 w-full shadow-none ring-0' : 'mpr-segmentation-panel--floating fixed z-[60] w-[min(520px,calc(100vw-2.5rem))] shadow-[0_30px_80px_rgba(0,0,0,0.58),0_10px_24px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.10),inset_0_0_0_1px_rgba(255,255,255,0.04)] ring-1 ring-black/45',
      { 'mpr-segmentation-panel--mobile': props.mobile }
    ]"
    :style="panelRootStyle"
  >
    <div class="-mx-3 mb-2.5 flex items-center justify-between gap-3 rounded-t-xl border-b border-white/10 bg-white/[0.055] px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.22)]">
      <div
        class="flex min-w-0 flex-1 select-none items-center gap-2"
        :class="props.embedded ? '' : 'cursor-move'"
        :data-testid="props.embedded ? undefined : 'mpr-segmentation-panel-drag-handle'"
        @pointerdown="beginPanelDrag"
      >
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/18 text-[var(--theme-text-muted)] shadow-inner">
          <span class="grid grid-cols-2 gap-0.5">
            <span class="h-1 w-1 rounded-full bg-current"></span>
            <span class="h-1 w-1 rounded-full bg-current"></span>
            <span class="h-1 w-1 rounded-full bg-current"></span>
            <span class="h-1 w-1 rounded-full bg-current"></span>
          </span>
        </span>
        <div class="min-w-0">
          <div v-if="!props.embedded" class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ panelCopy.eyebrow }}</div>
          <div class="mt-0.5 flex min-w-0 items-center gap-2">
            <span
              class="leading-4 text-[var(--theme-text-primary)]"
              :class="props.embedded ? 'text-[13px] font-semibold' : 'truncate text-[12px] font-medium'"
            >
              {{ props.embedded ? panelCopy.eyebrow : panelCopy.title }}
            </span>
            <span
              data-testid="mpr-segmentation-processing"
              class="inline-flex w-[4.75rem] shrink-0 items-center gap-1 rounded-full border border-sky-300/30 bg-sky-400/12 px-2 py-0.5 text-[10px] font-semibold text-sky-100 transition-opacity"
              :class="props.isProcessing ? 'opacity-100' : 'pointer-events-none opacity-0'"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200"></span>
              <span>{{ panelCopy.updating }}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <input
          ref="importInputRef"
          class="hidden"
          type="file"
          accept=".dvsseg.json,.json,application/json"
          data-testid="mpr-segmentation-import-input"
          @change="handleImportFileChange"
        />
        <button
          class="inline-flex h-8 items-center gap-2 px-0 text-[11px] font-semibold transition"
          :class="displayedConfig.enabled ? 'text-[var(--theme-text-primary)]' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
          type="button"
          :aria-pressed="displayedConfig.enabled"
          @click="emitPatch({ enabled: !displayedConfig.enabled }, 'end')"
        >
          <span
            class="relative h-4 w-7 rounded-full border transition"
            :class="displayedConfig.enabled ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]' : 'border-[var(--theme-border-strong)] bg-[var(--theme-surface-card)]'"
          >
            <span
              class="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--theme-text-primary)] shadow-sm transition"
              :class="displayedConfig.enabled ? 'left-[13px]' : 'left-0.5 opacity-70'"
            ></span>
          </span>
          <span>{{ panelCopy.preview }}</span>
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          :title="panelCopy.import"
          data-testid="mpr-segmentation-import"
          @click="openImportFilePicker"
        >
          <AppIcon name="import" :size="15" />
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          :title="panelCopy.export"
          data-testid="mpr-segmentation-export"
          @click="requestExportSelectedSegmentation"
        >
          <AppIcon name="export" :size="15" />
        </button>
        <button
          v-if="!props.embedded"
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          :title="panelCopy.close"
          data-testid="mpr-segmentation-close"
          @click="emit('close')"
        >
          <AppIcon name="close" :size="15" />
        </button>
      </div>
    </div>

    <div
      v-if="props.embedded"
      class="mb-2 grid grid-cols-2 gap-1 rounded-xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] p-1"
      data-testid="mpr-segmentation-mode-tabs"
    >
      <button
        type="button"
        class="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-2 text-[12px] font-semibold transition"
        :class="embeddedMode === 'segmentation:threshold' ? 'bg-[var(--theme-accent)] text-white shadow-sm' : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-hover-surface)] hover:text-[var(--theme-text-primary)]'"
        data-testid="mpr-segmentation-mode-threshold"
        @click="selectSegmentationMode('segmentation:threshold')"
      >
        <AppIcon name="segmentation-threshold" :size="14" />
        <span>{{ isZh ? '阈值分割' : 'Threshold' }}</span>
        <span class="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{{ regions.length }}</span>
      </button>
      <button
        type="button"
        class="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-2 text-[12px] font-semibold transition"
        :class="embeddedMode === 'segmentation:voi' ? 'bg-[var(--theme-accent)] text-white shadow-sm' : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-hover-surface)] hover:text-[var(--theme-text-primary)]'"
        data-testid="mpr-segmentation-mode-voi"
        @click="selectSegmentationMode('segmentation:voi')"
      >
        <AppIcon name="segmentation-voi" :size="14" />
        <span>VOI</span>
        <span class="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{{ voiSpheres.length }}</span>
      </button>
    </div>

    <div
      class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]"
      :class="props.embedded ? 'max-h-none' : 'max-h-[min(32rem,calc(100vh-14rem))]'"
      data-testid="mpr-segmentation-record-list"
    >
      <div
        v-if="!props.embedded || embeddedMode === 'segmentation:threshold'"
        class="flex items-center justify-between gap-3 px-0.5 pt-0.5"
      >
        <div class="min-w-0 truncate text-[12px] text-[var(--theme-text-secondary)]">
          <span class="font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '阈值分割' : 'Threshold regions' }}</span>
          <span class="mx-1 text-[var(--theme-text-muted)]">/</span>
          <span>{{ regions.length }} {{ panelCopy.item }}{{ !isZh && regions.length === 1 ? '' : !isZh ? 's' : '' }}</span>
        </div>
      </div>

      <div
        v-if="(!props.embedded || embeddedMode === 'segmentation:threshold') && regions.length === 0"
        class="rounded-lg border border-dashed border-[var(--theme-border-soft)] px-3 py-3 text-[12px] text-[var(--theme-text-secondary)]"
      >
        {{ panelCopy.emptyThreshold }}
      </div>

      <div
        v-for="region in regions"
        v-if="!props.embedded || embeddedMode === 'segmentation:threshold'"
        :key="region.id"
        class="mpr-segmentation-panel__item rounded-md border px-2.5 py-2 transition"
        :class="region.id === displayedConfig.selectedRegionId ? 'mpr-segmentation-panel__item--active' : ''"
        :data-testid="`mpr-threshold-select-${region.id}`"
        @click="selectRegion(region.id)"
      >
        <div class="mpr-segmentation-panel__record-header grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2">
          <button
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition"
            :class="region.enabled ? 'border-cyan-300/45 bg-cyan-400/20 text-cyan-100' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-muted)]'"
            type="button"
            :aria-pressed="region.enabled"
            :title="region.enabled ? panelCopy.hideRegion : panelCopy.showRegion"
            @click.stop="toggleRegion(region)"
          >
            <AppIcon :name="region.enabled ? 'display' : 'display-off'" :size="15" />
          </button>
          <label
            class="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/20"
            :title="panelCopy.color"
            @click.stop
          >
            <span class="h-3.5 w-3.5 rounded-full border border-white/35" :style="{ backgroundColor: region.color }"></span>
            <input
              class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="color"
              :aria-label="panelCopy.color"
              :value="region.color"
              :data-testid="`mpr-threshold-color-${region.id}`"
              @input.stop="updateRegionColor(region, ($event.target as HTMLInputElement).value)"
              @change.stop="updateRegionColor(region, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <input
            class="h-7 min-w-0 rounded-md border border-white/10 bg-black/16 px-2 text-[12px] font-semibold text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-cyan-200/55"
            type="text"
            :aria-label="panelCopy.description"
            :placeholder="descriptionPlaceholder"
            :value="region.label"
            :data-testid="`mpr-threshold-label-${region.id}`"
            @click.stop
            @input.stop="updateRegionLabel(region, ($event.target as HTMLInputElement).value)"
          />
          <div
            v-if="selectedRegion?.id === region.id"
            class="mpr-segmentation-panel__record-mode inline-flex shrink-0 rounded-md border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-0.5"
          >
            <button
              class="h-6 rounded px-2 text-[11px] font-semibold transition"
              :class="region.thresholdMode === 'hu' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
              type="button"
              @click.stop="updateThresholdMode(region, 'hu')"
            >
              HU
            </button>
            <button
              class="h-6 rounded px-2 text-[11px] font-semibold transition"
              :class="region.thresholdMode === 'percentile' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
              type="button"
              @click.stop="updateThresholdMode(region, 'percentile')"
            >
              %
            </button>
          </div>
          <button
            class="mpr-segmentation-panel__record-delete mpr-segmentation-panel__icon-action mpr-segmentation-panel__icon-action--danger"
            type="button"
            :title="panelCopy.deleteRegion"
            :data-testid="`mpr-threshold-delete-${region.id}`"
            @click.stop="deleteRegion(region.id)"
          >
            <AppIcon name="trash" :size="15" />
          </button>
        </div>

        <div
          class="mt-2 rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2.5 py-2 text-[11px] leading-4 text-[var(--theme-text-secondary)]"
          :data-testid="`mpr-threshold-summary-${region.id}`"
        >
          {{ region.thresholdMode === 'percentile' ? `${region.thresholdPercentile.toFixed(1)}% / HU ~ ${formatEffectiveThreshold(region)}` : `HU > ${region.thresholdHu}` }}
        </div>

        <div
          class="mpr-segmentation-panel__metrics mt-2 grid min-h-[4.5rem] grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3"
          :data-testid="`mpr-threshold-metrics-${region.id}`"
        >
          <div
            v-for="metric in getThresholdMetricRows(region)"
            :key="metric.key"
            class="mpr-segmentation-panel__metric-cell min-w-0 rounded-lg border px-2 py-1.5"
          >
            <div class="mpr-segmentation-panel__metric-label text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--theme-text-muted)]">{{ metric.label }}</div>
            <div class="mpr-segmentation-panel__metric-value mt-0.5 break-words font-semibold text-[var(--theme-text-secondary)]">{{ metric.value }}</div>
          </div>
        </div>

        <div
          v-if="selectedRegion?.id === region.id"
          class="mt-2 space-y-2"
        >
          <div
            v-if="region.thresholdMode === 'percentile'"
            class="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-2"
          >
            <span class="text-[12px] font-semibold text-[var(--theme-text-secondary)]">{{ panelCopy.percent }}</span>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="0"
              max="100"
              step="0.5"
              :value="region.thresholdPercentile"
              @input.stop="updateThresholdPercentile(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateThresholdPercentile(region, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              class="rounded-md border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
              type="number"
              min="0"
              max="100"
              step="0.5"
              :value="region.thresholdPercentile"
              @input.stop="updateThresholdPercentile(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateThresholdPercentile(region, ($event.target as HTMLInputElement).value, 'end')"
            />
          </div>
          <div
            v-else
            class="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-2"
          >
            <span class="text-[12px] font-semibold text-[var(--theme-text-secondary)]">HU</span>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              :min="MPR_SEGMENTATION_HU_LIMITS.min"
              :max="MPR_SEGMENTATION_HU_LIMITS.max"
              step="1"
              :value="region.thresholdHu"
              @input.stop="updateThreshold(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateThreshold(region, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              class="rounded-md border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
              type="number"
              :min="MPR_SEGMENTATION_HU_LIMITS.min"
              :max="MPR_SEGMENTATION_HU_LIMITS.max"
              step="1"
              :value="region.thresholdHu"
              @input.stop="updateThreshold(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateThreshold(region, ($event.target as HTMLInputElement).value, 'end')"
            />
          </div>

          <div class="grid grid-cols-[4rem_1fr_4.5rem_1.75rem] items-center gap-2">
            <span class="text-[12px] font-semibold text-[var(--theme-text-secondary)]">{{ panelCopy.depth }}</span>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              :min="MPR_SEGMENTATION_DEPTH_LIMITS.min"
              :max="MPR_SEGMENTATION_DEPTH_LIMITS.max"
              step="0.5"
              :value="region.box.depthMm"
              @input.stop="updateDepth(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateDepth(region, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              class="rounded-md border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
              type="number"
              :min="MPR_SEGMENTATION_DEPTH_LIMITS.min"
              :max="MPR_SEGMENTATION_DEPTH_LIMITS.max"
              step="0.5"
              :value="region.box.depthMm"
              @input.stop="updateDepth(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateDepth(region, ($event.target as HTMLInputElement).value, 'end')"
            />
            <span class="text-[11px] font-semibold text-[var(--theme-text-muted)]">mm</span>
          </div>
        </div>
      </div>

      <div
        v-if="!props.embedded || embeddedMode === 'segmentation:voi'"
        class="flex items-center justify-between gap-3 px-0.5 pt-1.5"
      >
        <div class="min-w-0 truncate text-[12px] text-[var(--theme-text-secondary)]">
          <span class="font-semibold text-[var(--theme-text-primary)]">VOI</span>
          <span class="mx-1 text-[var(--theme-text-muted)]">/</span>
          <span>{{ voiSpheres.length }} {{ panelCopy.item }}{{ !isZh && voiSpheres.length === 1 ? '' : !isZh ? 's' : '' }}</span>
        </div>
      </div>

      <div
        v-if="(!props.embedded || embeddedMode === 'segmentation:voi') && voiSpheres.length === 0"
        class="rounded-lg border border-dashed border-[var(--theme-border-soft)] px-3 py-3 text-[12px] text-[var(--theme-text-secondary)]"
      >
        {{ panelCopy.voiEmpty }}
      </div>

      <div
        v-for="sphere in voiSpheres"
        v-if="!props.embedded || embeddedMode === 'segmentation:voi'"
        :key="sphere.id"
        class="mpr-segmentation-panel__item rounded-md border px-2.5 py-2 transition"
        :class="displayedConfig.selectedVoiId === sphere.id ? 'mpr-segmentation-panel__item--active' : ''"
        :data-testid="`mpr-voi-select-${sphere.id}`"
        @click="selectVoi(sphere.id)"
      >
          <div class="mpr-segmentation-panel__record-header mpr-segmentation-panel__record-header--voi grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
            <button
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition"
              :class="sphere.enabled ? 'border-cyan-300/45 bg-cyan-400/20 text-cyan-100' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-muted)]'"
              type="button"
              :aria-pressed="sphere.enabled"
              :title="sphere.enabled ? panelCopy.hideVoi : panelCopy.showVoi"
              @click.stop="patchVoiSphere(sphere.id, { enabled: !sphere.enabled }, 'end')"
            >
              <AppIcon :name="sphere.enabled ? 'display' : 'display-off'" :size="15" />
            </button>
            <label
              class="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/20"
              :title="panelCopy.color"
              @click.stop
            >
              <span class="h-3.5 w-3.5 rounded-full border border-white/35" :style="{ backgroundColor: sphere.color }"></span>
              <input
                class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                type="color"
                :aria-label="panelCopy.color"
                :value="sphere.color"
                :data-testid="`mpr-voi-color-${sphere.id}`"
                @input.stop="updateVoiColor(sphere, ($event.target as HTMLInputElement).value)"
                @change.stop="updateVoiColor(sphere, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <input
              class="h-7 min-w-0 flex-[0_1_7.5rem] rounded-md border border-white/10 bg-black/16 px-2 text-[12px] font-semibold text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-cyan-200/55"
              type="text"
              :aria-label="panelCopy.description"
              :placeholder="descriptionPlaceholder"
              :value="sphere.label"
              :data-testid="`mpr-voi-label-${sphere.id}`"
              @click.stop
              @input.stop="updateVoiLabel(sphere, ($event.target as HTMLInputElement).value)"
            />
            <span class="min-w-0 flex-1 truncate text-[12px] text-[var(--theme-text-secondary)]">
              {{ panelCopy.radius }} {{ formatMetric(sphere.radiusMm) }} mm
            </span>
            <button
              class="mpr-segmentation-panel__record-delete mpr-segmentation-panel__icon-action mpr-segmentation-panel__icon-action--danger"
              type="button"
              :title="panelCopy.deleteVoi"
              :data-testid="`mpr-voi-delete-${sphere.id}`"
              @click.stop="clearVoi(sphere.id)"
            >
              <AppIcon name="trash" :size="15" />
            </button>
          </div>
          <div
            class="mpr-segmentation-panel__metrics mt-2 grid min-h-[4.5rem] grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3"
            :data-testid="`mpr-voi-metrics-${sphere.id}`"
          >
            <div
              v-for="metric in getVoiMetricRows(sphere)"
              :key="metric.key"
              class="mpr-segmentation-panel__metric-cell min-w-0 rounded-lg border px-2 py-1.5"
            >
              <div class="mpr-segmentation-panel__metric-label text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--theme-text-muted)]">{{ metric.label }}</div>
              <div class="mpr-segmentation-panel__metric-value mt-0.5 break-words font-semibold text-[var(--theme-text-secondary)]">{{ metric.value }}</div>
            </div>
          </div>
        </div>

    </div>

    <div class="mpr-segmentation-panel__footer" data-testid="mpr-segmentation-footer">
      <button
        class="mpr-segmentation-panel__clear-button"
        type="button"
        :disabled="currentModeClearDisabled"
        data-testid="mpr-segmentation-clear-current"
        @click="clearCurrentModeItems"
      >
        <AppIcon :name="currentModeClearIcon" :size="14" />
        <span>{{ currentModeClearLabel }}</span>
      </button>
      <button
        class="mpr-segmentation-panel__clear-button mpr-segmentation-panel__clear-button--danger"
        type="button"
        :disabled="!hasAnySegmentationItems"
        data-testid="mpr-segmentation-clear-all"
        @click="clearAll"
      >
        <AppIcon name="trash" :size="14" />
        <span>{{ panelCopy.clearAll }}</span>
      </button>
    </div>

  <Teleport to="body">
    <div
      v-if="isExportConfirmOpen && pendingExportConfirmation"
      class="fixed inset-0 z-[120] grid place-items-center bg-[var(--theme-overlay-backdrop)] p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      :aria-label="panelCopy.exportConfirmTitle"
      data-testid="mpr-segmentation-export-confirm-dialog"
      @click.self="closeExportConfirmDialog"
      @keydown.esc.prevent="closeExportConfirmDialog"
    >
      <div
        class="w-[min(520px,100%)] overflow-hidden rounded-[20px] border border-[color:color-mix(in_srgb,var(--theme-accent)_30%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-surface-panel-strong-solid)_96%,#050914)] shadow-[0_28px_72px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        <div class="flex items-start gap-3 border-b border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_58%,transparent)] px-4 py-3.5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color:color-mix(in_srgb,var(--theme-accent)_36%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_14%,var(--theme-surface-card))] text-[var(--theme-text-primary)]">
            <AppIcon name="export" :size="18" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ panelCopy.exportConfirmTitle }}</div>
            <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">
              {{ panelCopy.exportConfirmMessage(pendingExportSelectedCount) }}
            </div>
          </div>
        </div>

        <div class="space-y-3 px-4 py-3.5">
          <div
            class="rounded-xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2.5"
            data-testid="mpr-segmentation-export-selection"
          >
            <div class="mb-2 flex items-center justify-between gap-3">
              <span class="text-[11px] font-semibold uppercase text-[var(--theme-text-muted)]">
                {{ isZh ? '导出项目' : 'Items to export' }}
              </span>
              <span class="text-[11px] font-semibold text-[var(--theme-text-secondary)]">
                {{ pendingExportSelectedCount }} / {{ exportableItemCount }}
              </span>
            </div>

            <div class="max-h-48 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
              <div v-if="regions.length > 0" class="space-y-1.5">
                <div class="text-[11px] font-semibold text-[var(--theme-text-secondary)]">
                  {{ isZh ? '阈值分割' : 'Threshold regions' }}
                </div>
                <div
                  v-for="region in regions"
                  :key="`export-region-${region.id}`"
                  class="rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-solid)] px-2.5 py-2 transition hover:border-[var(--theme-border-strong)]"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <input
                      class="h-3.5 w-3.5 shrink-0 accent-[var(--theme-accent)]"
                      type="checkbox"
                      :checked="isPendingExportRegionSelected(region.id)"
                      :data-testid="`mpr-export-dialog-threshold-${region.id}`"
                      @change="updatePendingExportRegionSelection(region.id, ($event.target as HTMLInputElement).checked)"
                    />
                    <span class="h-3 w-3 shrink-0 rounded-full border border-white/35" :style="{ backgroundColor: region.color }"></span>
                    <input
                      class="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/14 px-2 text-xs font-semibold text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-cyan-200/55"
                      type="text"
                      :aria-label="panelCopy.description"
                      :placeholder="descriptionPlaceholder"
                      :value="region.label"
                      :data-testid="`mpr-export-dialog-threshold-label-${region.id}`"
                      @input.stop="updateRegionLabel(region, ($event.target as HTMLInputElement).value)"
                    />
                    <span class="shrink-0 text-[11px] text-[var(--theme-text-secondary)]">
                      {{ region.thresholdMode === 'percentile' ? `${region.thresholdPercentile.toFixed(1)}% / HU~${formatEffectiveThreshold(region)}` : `HU>${region.thresholdHu}` }}
                    </span>
                  </div>
                  <div
                    class="mt-1.5 truncate pl-[3.25rem] text-[11px] leading-4 text-[var(--theme-text-secondary)]"
                    :data-testid="`mpr-export-dialog-threshold-metrics-${region.id}`"
                  >
                    {{ formatStatsSummary(region) }}
                  </div>
                </div>
              </div>

              <div v-if="voiSpheres.length > 0" class="space-y-1.5">
                <div class="text-[11px] font-semibold text-[var(--theme-text-secondary)]">
                  VOI
                </div>
                <div
                  v-for="sphere in voiSpheres"
                  :key="`export-voi-${sphere.id}`"
                  class="rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-solid)] px-2.5 py-2 transition hover:border-[var(--theme-border-strong)]"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <input
                      class="h-3.5 w-3.5 shrink-0 accent-[var(--theme-accent)]"
                      type="checkbox"
                      :checked="isPendingExportVoiSelected(sphere.id)"
                      :data-testid="`mpr-export-dialog-voi-${sphere.id}`"
                      @change="updatePendingExportVoiSelection(sphere.id, ($event.target as HTMLInputElement).checked)"
                    />
                    <span class="h-3 w-3 shrink-0 rounded-full border border-white/35" :style="{ backgroundColor: sphere.color }"></span>
                    <input
                      class="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/14 px-2 text-xs font-semibold text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-cyan-200/55"
                      type="text"
                      :aria-label="panelCopy.description"
                      :placeholder="descriptionPlaceholder"
                      :value="sphere.label"
                      :data-testid="`mpr-export-dialog-voi-label-${sphere.id}`"
                      @input.stop="updateVoiLabel(sphere, ($event.target as HTMLInputElement).value)"
                    />
                    <span class="shrink-0 text-[11px] text-[var(--theme-text-secondary)]">
                      {{ panelCopy.radius }} {{ formatMetric(sphere.radiusMm) }} mm
                    </span>
                  </div>
                  <div
                    class="mt-1.5 truncate pl-[3.25rem] text-[11px] leading-4 text-[var(--theme-text-secondary)]"
                    :data-testid="`mpr-export-dialog-voi-metrics-${sphere.id}`"
                  >
                    {{ formatVoiStatsSummary(sphere) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="isDesktopRuntime"
            class="rounded-xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-2.5"
          >
            <label class="text-[11px] font-semibold uppercase text-[var(--theme-text-muted)]" for="mpr-segmentation-export-directory">
              {{ panelCopy.exportPathLabel }}
            </label>
            <div class="mt-2 flex min-w-0 gap-2">
              <input
                id="mpr-segmentation-export-directory"
                class="min-w-0 flex-1 rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-solid)] px-3 py-2 text-xs text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-accent)]"
                type="text"
                :value="pendingExportConfirmation.directoryPath ?? ''"
                data-testid="mpr-segmentation-export-directory-input"
                @input="updatePendingExportDirectoryPath(($event.target as HTMLInputElement).value)"
                @keydown.esc.prevent="closeExportConfirmDialog"
              />
              <button
                type="button"
                class="rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2 text-xs font-semibold text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
                data-testid="mpr-segmentation-export-directory-choose"
                @click="choosePendingExportDirectory"
              >
                {{ panelCopy.exportChoosePath }}
              </button>
            </div>
          </div>
          <div class="rounded-xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2.5">
            <label class="text-[11px] font-semibold uppercase text-[var(--theme-text-muted)]" for="mpr-segmentation-export-file-name">
              {{ panelCopy.exportFileLabel }}
            </label>
            <div class="mt-2 flex min-w-0 overflow-hidden rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-solid)] transition focus-within:border-[var(--theme-accent)]">
              <input
                id="mpr-segmentation-export-file-name"
                class="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-[var(--theme-text-primary)] outline-none placeholder:text-[var(--theme-text-muted)]"
                type="text"
                :value="pendingExportConfirmation.fileNameStem"
                data-testid="mpr-segmentation-export-file-name-stem-input"
                @input="updatePendingExportFileNameStem(($event.target as HTMLInputElement).value)"
                @keydown.esc.prevent="closeExportConfirmDialog"
              />
              <span
                class="flex shrink-0 items-center border-l border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,var(--theme-surface-card))] px-3 text-[11px] font-semibold text-[var(--theme-text-secondary)]"
                data-testid="mpr-segmentation-export-file-name-suffix"
                :title="panelCopy.exportSuffixLabel"
              >
                .{{ MPR_SEGMENTATION_SIDECAR_EXTENSION }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-[var(--theme-border-soft)] px-4 py-3.5">
          <button
            type="button"
            class="rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-2.5 text-xs font-semibold text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
            data-testid="mpr-segmentation-export-confirm-cancel"
            @click="closeExportConfirmDialog"
          >
            {{ panelCopy.cancel }}
          </button>
          <button
            type="button"
            class="theme-button-primary rounded-2xl px-5 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            data-testid="mpr-segmentation-export-confirm-submit"
            :disabled="pendingExportSelectedCount <= 0"
            @click="confirmPendingExport"
          >
            {{ panelCopy.confirmExport }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
  </div>
</template>

<style scoped>
.mpr-segmentation-panel {
  container-type: inline-size;
}

.mpr-segmentation-panel--mobile {
  height: 100%;
  min-height: 0;
  border-color: color-mix(in srgb, var(--theme-border-strong) 62%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface-panel-strong-solid) 94%, var(--theme-accent) 6%),
      color-mix(in srgb, var(--theme-surface-panel-solid) 98%, transparent)
    );
}

.mpr-segmentation-panel--mobile [data-testid='mpr-segmentation-record-list'] {
  flex: 1 1 0;
  min-height: 0;
  padding-bottom: 0.25rem;
}

.mpr-segmentation-panel__item {
  position: relative;
  border-color: var(--theme-border-soft);
  background: color-mix(in srgb, var(--theme-surface-card) 84%, transparent);
}

.mpr-segmentation-panel__item::before {
  content: '';
  position: absolute;
  inset: 10px auto 10px 0;
  width: 3px;
  border-radius: 999px;
  background: transparent;
}

.mpr-segmentation-panel__item--active {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 13%, var(--theme-surface-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 12%, transparent);
}

.mpr-segmentation-panel__item--active::before {
  background: var(--theme-accent);
}

.mpr-segmentation-panel__metric-cell {
  border-color: var(--theme-border-soft);
  background: color-mix(in srgb, var(--theme-surface-card-soft) 88%, transparent);
}

@container (max-width: 280px) {
  .mpr-segmentation-panel__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-height: 0;
  }
}

@container (max-width: 250px) {
  .mpr-segmentation-panel__record-header:not(.mpr-segmentation-panel__record-header--voi) {
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: start;
  }

  .mpr-segmentation-panel__record-mode {
    grid-column: 3 / -1;
    grid-row: 2;
    justify-self: start;
  }

  .mpr-segmentation-panel__record-delete {
    grid-column: -2;
    grid-row: 1;
  }

  .mpr-segmentation-panel__record-header--voi {
    grid-template-columns: auto auto minmax(0, 1fr) auto;
  }

  .mpr-segmentation-panel__record-header--voi > :nth-child(4) {
    grid-column: 3 / -1;
    grid-row: 2;
  }
}

.mpr-segmentation-panel--mobile .mpr-segmentation-panel__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 0;
  gap: 0.375rem;
}

.mpr-segmentation-panel--mobile .mpr-segmentation-panel__metric-cell {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.35rem;
  min-height: 1.75rem;
  border-radius: 0.5rem;
  padding: 0.3rem 0.45rem;
}

.mpr-segmentation-panel--mobile .mpr-segmentation-panel__metric-label {
  font-size: 0.55rem;
  letter-spacing: 0.06em;
}

.mpr-segmentation-panel--mobile .mpr-segmentation-panel__metric-value {
  margin-top: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mpr-segmentation-panel__icon-action {
  display: inline-flex;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--theme-text-secondary);
  transition: color 0.16s ease, background 0.16s ease;
}

.mpr-segmentation-panel__icon-action--danger:hover {
  background: var(--theme-status-danger-surface);
  color: var(--theme-status-danger-text);
}

.mpr-segmentation-panel__footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--theme-border-soft);
  padding-top: 0.5rem;
}

.mpr-segmentation-panel--mobile .mpr-segmentation-panel__footer {
  margin-top: auto;
  padding-bottom: 0.125rem;
}

.mpr-segmentation-panel__clear-button {
  display: inline-flex;
  min-height: 2rem;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 1px solid var(--theme-border-soft);
  border-radius: 999px;
  background: var(--theme-surface-card-soft);
  color: var(--theme-text-primary);
  padding: 0.375rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 700;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.mpr-segmentation-panel__clear-button:hover:not(:disabled) {
  border-color: var(--theme-border-strong);
  background: var(--theme-hover-surface);
}

.mpr-segmentation-panel__clear-button--danger {
  border-color: var(--theme-status-danger-border);
  background: var(--theme-status-danger-surface);
  color: var(--theme-status-danger-text);
}

.mpr-segmentation-panel__clear-button--danger:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--theme-status-danger-border) 78%, var(--theme-text-primary));
  background: color-mix(in srgb, var(--theme-status-danger-surface) 84%, var(--theme-status-danger-text) 16%);
}

.mpr-segmentation-panel__clear-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  filter: grayscale(0.28);
}
</style>
