<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  CornerInfo,
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementOverlay,
  MprLayoutKey,
  MprSegmentationConfigActionType,
  MprSegmentationConfig,
  MprSegmentationOverlay,
  MprCrosshairInfo,
  MprViewportKey,
  ScaleBarInfo,
  ViewProgressInfo,
  ViewerMtfItem,
  ViewerTabItem
} from '../../../types/viewer'
import {
  DEFAULT_MPR_SEGMENTATION_COLOR,
  DEFAULT_MPR_VOI_COLOR
} from '../../../types/viewer'
import { DEFAULT_MPR_LAYOUT_KEY } from '../../../composables/workspace/layout/mprLayoutOptions'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

type MprDisplayViewportKey = MprViewportKey | 'volume'

const props = withDefaults(
  defineProps<{
    activeTab: ViewerTabItem
    activeOperation: string
    activeViewportKey: string
    allowViewportMaximize?: boolean
    layoutKey?: MprLayoutKey | null
    mprSegmentationDefaultThresholdColor?: string
    mprSegmentationDefaultVoiColor?: string
    mprSegmentationConfig?: MprSegmentationConfig | null
    getAnnotations: (viewportKey: MprViewportKey) => AnnotationOverlay[]
    getCursorClass: (viewportKey: MprViewportKey) => string
    getDraftAnnotation: (viewportKey: MprViewportKey) => AnnotationDraft | null
    getDraftMeasurementMode: (viewportKey: MprViewportKey) => DraftMeasurementMode | null
    getDraftMeasurement: (viewportKey: MprViewportKey) => MeasurementDraft | null
    getMeasurements: (viewportKey: MprViewportKey) => MeasurementOverlay[]
    getMtfDraftMode: (viewportKey: MprViewportKey) => DraftMeasurementMode | null
    getMtfDraft: (viewportKey: MprViewportKey) => { mtfId?: string; points: { x: number; y: number }[] } | null
    getMtfItems: (viewportKey: MprViewportKey) => ViewerMtfItem[]
    selectedMtfId?: string | null
    getCornerInfo: (viewportKey: MprViewportKey) => CornerInfo
  }>(),
  {
    allowViewportMaximize: true,
    layoutKey: DEFAULT_MPR_LAYOUT_KEY,
    mprSegmentationDefaultThresholdColor: DEFAULT_MPR_SEGMENTATION_COLOR,
    mprSegmentationDefaultVoiColor: DEFAULT_MPR_VOI_COLOR,
    mprSegmentationConfig: null,
    selectedMtfId: null
  }
)

const emit = defineEmits<{
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  clearMtf: []
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  openMtfCurve: []
  selectMtf: [payload: { mtfId: string | null }]
  mprSegmentationConfigChange: [config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType]
  mprSegmentationModeChange: [mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
}>()

const { locale, viewerCopy } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')

interface MprViewportLayoutItem {
  key: MprDisplayViewportKey
  label: string
  className: string
  kind: 'mpr' | 'volume'
}

interface MprViewportLayoutConfig {
  containerClass: string
  items: MprViewportLayoutItem[]
}

const MPR_LAYOUT_CONFIGS: Record<MprLayoutKey, MprViewportLayoutConfig> = {
  'three-columns': {
    containerClass: 'grid-cols-3 grid-rows-1',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1', kind: 'mpr' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-2 row-start-1', kind: 'mpr' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-3 row-start-1', kind: 'mpr' }
    ]
  },
  'right-primary': {
    containerClass: 'grid-cols-2 grid-rows-2',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1', kind: 'mpr' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-1 row-start-2', kind: 'mpr' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-2 row-span-2 row-start-1', kind: 'mpr' }
    ]
  },
  'three-rows': {
    containerClass: 'grid-cols-1 grid-rows-3',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1', kind: 'mpr' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-1 row-start-2', kind: 'mpr' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-1 row-start-3', kind: 'mpr' }
    ]
  },
  quad: {
    containerClass: 'grid-cols-2 grid-rows-2',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1', kind: 'mpr' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-2 row-start-1', kind: 'mpr' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-1 row-start-2', kind: 'mpr' }
    ]
  },
  'mpr-3d': {
    containerClass: 'grid-cols-2 grid-rows-2',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1', kind: 'mpr' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-2 row-start-1', kind: 'mpr' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-1 row-start-2', kind: 'mpr' },
      { key: 'volume', label: '3D', className: 'col-start-2 row-start-2', kind: 'volume' }
    ]
  }
}

const normalizedLayoutKey = computed<MprLayoutKey>(() => {
  const layoutKey = props.layoutKey
  if (layoutKey && layoutKey in MPR_LAYOUT_CONFIGS) {
    return layoutKey
  }

  return DEFAULT_MPR_LAYOUT_KEY
})

const activeLayoutConfig = computed(() => MPR_LAYOUT_CONFIGS[normalizedLayoutKey.value])
const viewportItems = computed(() => activeLayoutConfig.value.items)

const maximizedViewportKey = ref<MprDisplayViewportKey | null>(null)

const isViewportMaximized = computed(() => maximizedViewportKey.value != null)

const visibleViewportItems = computed(() => {
  const viewportKey = maximizedViewportKey.value
  if (!viewportKey) {
    return viewportItems.value
  }
  return viewportItems.value.filter((item) => item.key === viewportKey)
})

const canToggleViewportMaximize = computed(() => {
  if (!props.allowViewportMaximize) {
    return false
  }

  const operation = normalizeOperation(props.activeOperation)
  return !(
    operation.startsWith('measure:') ||
    operation.startsWith('annotate:') ||
    operation === 'mtf' ||
    operation.startsWith('mtf:') ||
    operation === 'qa:mtf' ||
    operation.startsWith('qa:mtf')
  )
})

const emptyVolumeCornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

const DEFAULT_MPR_CROSSHAIR: MprCrosshairInfo = {
  centerX: 0.5,
  centerY: 0.5,
  hitRadius: 8,
  horizontalPosition: 0.5,
  verticalPosition: 0.5,
  horizontalAngleRad: null,
  verticalAngleRad: null,
  horizontalSlabOffsetX: null,
  horizontalSlabOffsetY: null,
  verticalSlabOffsetX: null,
  verticalSlabOffsetY: null
}

type MprOnlyLayoutItem = MprViewportLayoutItem & { key: MprViewportKey; kind: 'mpr' }

function isMprLayoutItem(item: MprViewportLayoutItem): item is MprOnlyLayoutItem {
  return item.kind === 'mpr' && isMprViewportKey(item.key)
}

function asMprViewportKey(item: MprViewportLayoutItem): MprViewportKey | null {
  return isMprLayoutItem(item) ? item.key : null
}

function getViewportImage(viewportKey: MprViewportKey): string {
  return props.activeTab.viewportImages?.[viewportKey] ?? ''
}

function getViewportOrientation(viewportKey: MprViewportKey) {
  return props.activeTab.viewportOrientations?.[viewportKey] ?? props.activeTab.orientation
}

function getViewportCrosshair(viewportKey: MprViewportKey) {
  return props.activeTab.viewportCrosshairs?.[viewportKey] ?? DEFAULT_MPR_CROSSHAIR
}

function getViewportPlane(viewportKey: MprViewportKey) {
  return props.activeTab.viewportPlanes?.[viewportKey] ?? null
}

function getViewportScaleBar(viewportKey: MprViewportKey): ScaleBarInfo | null {
  return props.activeTab.viewportScaleBars?.[viewportKey] ?? null
}

function getViewportSegmentationOverlay(viewportKey: MprViewportKey): MprSegmentationOverlay | null {
  return props.activeTab.viewportSegmentationOverlays?.[viewportKey] ?? null
}

function getItemSegmentationOverlay(item: MprViewportLayoutItem): MprSegmentationOverlay | null {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? getViewportSegmentationOverlay(viewportKey) : null
}

function isViewportLoading(viewportKey: MprViewportKey): boolean {
  return Boolean(props.activeTab.viewportViewIds?.[viewportKey]) && !getViewportImage(viewportKey)
}

function getItemAnnotations(item: MprViewportLayoutItem): AnnotationOverlay[] {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getAnnotations(viewportKey) : []
}

function getItemCursorClass(item: MprViewportLayoutItem): string {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getCursorClass(viewportKey) : ''
}

function getItemDraftAnnotation(item: MprViewportLayoutItem): AnnotationDraft | null {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getDraftAnnotation(viewportKey) : null
}

function getItemImage(item: MprViewportLayoutItem): string {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? getViewportImage(viewportKey) : props.activeTab.imageSrc
}

function isItemLoading(item: MprViewportLayoutItem): boolean {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? isViewportLoading(viewportKey) : Boolean(props.activeTab.viewId) && !props.activeTab.imageSrc
}

const VIEW_PROGRESS_LABELS: Record<string, string> = {
  queued: '准备渲染',
  waiting: '等待体数据',
  volume: '读取 DICOM 切片',
  normalize: '整理体数据',
  initialize: '初始化视图',
  render: '渲染影像',
  encode: '生成预览图',
  complete: '加载完成'
}

const VIEW_PROGRESS_LABELS_EN: Record<string, string> = {
  queued: 'Preparing render',
  waiting: 'Waiting for volume',
  volume: 'Reading DICOM slices',
  normalize: 'Preparing volume',
  initialize: 'Initializing view',
  render: 'Rendering image',
  encode: 'Encoding preview',
  complete: 'Loaded'
}

function getItemLoadingProgress(item: MprViewportLayoutItem): ViewProgressInfo | null {
  const viewportKey = asMprViewportKey(item)
  return viewportKey
    ? props.activeTab.viewportLoadingProgress?.[viewportKey] ?? null
    : props.activeTab.loadingProgress ?? null
}

function getItemLoadingProgressPercent(item: MprViewportLayoutItem): number | null {
  const progressPercent = getItemLoadingProgress(item)?.progressPercent
  return typeof progressPercent === 'number' ? progressPercent : null
}

function getItemLoadingLabel(item: MprViewportLayoutItem): string {
  const fallback = item.kind === 'volume' ? viewerCopy.value.loadingVolumeView : viewerCopy.value.loadingMprView
  const progress = getItemLoadingProgress(item)
  if (!progress) {
    return fallback
  }

  const progressLabels = isZh.value ? VIEW_PROGRESS_LABELS : VIEW_PROGRESS_LABELS_EN
  const label = progress.message || progressLabels[progress.phase] || fallback
  const hasCounts = typeof progress.loadedCount === 'number' && typeof progress.totalCount === 'number' && progress.totalCount > 0
  return hasCounts ? `${label} ${progress.loadedCount}/${progress.totalCount}` : label
}

function getItemCornerInfo(item: MprViewportLayoutItem): CornerInfo {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getCornerInfo(viewportKey) : emptyVolumeCornerInfo
}

function getItemDraftMeasurementMode(item: MprViewportLayoutItem): DraftMeasurementMode | null {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getDraftMeasurementMode(viewportKey) : null
}

function getItemDraftMeasurement(item: MprViewportLayoutItem): MeasurementDraft | null {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getDraftMeasurement(viewportKey) : null
}

function getItemMeasurements(item: MprViewportLayoutItem): MeasurementOverlay[] {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getMeasurements(viewportKey) : []
}

function getItemMtfDraftMode(item: MprViewportLayoutItem): DraftMeasurementMode | null {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getMtfDraftMode(viewportKey) : null
}

function getItemMtfDraft(item: MprViewportLayoutItem): { mtfId?: string; points: { x: number; y: number }[] } | null {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getMtfDraft(viewportKey) : null
}

function getItemMtfItems(item: MprViewportLayoutItem): ViewerMtfItem[] {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.getMtfItems(viewportKey) : []
}

function getItemCrosshair(item: MprViewportLayoutItem) {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? getViewportCrosshair(viewportKey) : null
}

function getItemFrame(item: MprViewportLayoutItem) {
  return asMprViewportKey(item) ? props.activeTab.mprFrame ?? null : null
}

function getItemPlane(item: MprViewportLayoutItem) {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? getViewportPlane(viewportKey) : null
}

function getItemScaleBar(item: MprViewportLayoutItem): ScaleBarInfo | null {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? getViewportScaleBar(viewportKey) : null
}

function getItemTransform(item: MprViewportLayoutItem) {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? props.activeTab.viewportTransformStates?.[viewportKey] ?? props.activeTab.transformState ?? null : props.activeTab.transformState ?? null
}

function getItemOrientation(item: MprViewportLayoutItem) {
  const viewportKey = asMprViewportKey(item)
  return viewportKey ? getViewportOrientation(viewportKey) : props.activeTab.orientation
}

function getItemPlaceholder(item: MprViewportLayoutItem): string {
  return item.kind === 'volume' ? viewerCopy.value.volumePlaceholder : viewerCopy.value.viewportPreview(item.label)
}

function normalizeOperation(operation: string): string {
  return operation.startsWith('stack:') ? operation.slice('stack:'.length) : operation
}

function isSegmentationEditOperation(): boolean {
  const operation = normalizeOperation(props.activeOperation)
  return operation === 'segmentation:threshold' || operation === 'segmentation:voi'
}

function isItemVoiOblique(item: MprViewportLayoutItem): boolean {
  return Boolean(props.activeTab.mprCrosshairMode === 'double-oblique' || getItemPlane(item)?.isOblique)
}

function isItemSegmentationEditable(item: MprViewportLayoutItem): boolean {
  return item.kind === 'mpr' && isSegmentationEditOperation() && !isItemVoiOblique(item)
}

function handleMprSegmentationConfigChange(config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType): void {
  emit('mprSegmentationConfigChange', config, actionType)
}

function handleMprSegmentationModeChange(mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null): void {
  emit('mprSegmentationModeChange', mode, viewportKey)
}

function getViewportClass(viewportKey: MprDisplayViewportKey, className: string): string {
  return maximizedViewportKey.value === viewportKey ? 'col-start-1 row-start-1' : className
}

const effectiveActiveViewportKey = computed<MprDisplayViewportKey>(() => {
  const maximizedKey = maximizedViewportKey.value
  if (maximizedKey) {
    return maximizedKey
  }

  const activeViewportItem = viewportItems.value.find((item) => item.key === props.activeViewportKey)
  if (activeViewportItem) {
    return activeViewportItem.key
  }

  const firstMprViewport = viewportItems.value.find((item) => isMprViewportKey(item.key))?.key
  return firstMprViewport ?? viewportItems.value[0]?.key ?? 'mpr-ax'
})

function isViewportActive(viewportKey: MprDisplayViewportKey): boolean {
  return effectiveActiveViewportKey.value === viewportKey
}

function isMprViewportKey(viewportKey: string): viewportKey is MprViewportKey {
  return viewportKey === 'mpr-ax' || viewportKey === 'mpr-sag' || viewportKey === 'mpr-cor'
}

function resolveWheelViewportKey(viewportKey: string): MprViewportKey | null {
  const maximizedKey = maximizedViewportKey.value
  if (maximizedKey) {
    return isMprViewportKey(maximizedKey) ? maximizedKey : null
  }

  const activeViewportKey = effectiveActiveViewportKey.value
  if (isMprViewportKey(activeViewportKey)) {
    return activeViewportKey
  }

  return isMprViewportKey(viewportKey) ? viewportKey : null
}

function handleViewportWheel(payload: { viewportKey: string; deltaY: number; exact?: boolean }): void {
  const viewportKey = resolveWheelViewportKey(payload.viewportKey)
  if (!viewportKey) {
    return
  }

  emit('viewportWheel', {
    ...payload,
    viewportKey
  })
}

function handleViewportDoubleClick(viewportKey: string): void {
  emit('viewportClick', viewportKey)

  if (!(isMprViewportKey(viewportKey) || viewportKey === 'volume') || !canToggleViewportMaximize.value) {
    return
  }

  maximizedViewportKey.value = maximizedViewportKey.value === viewportKey ? null : viewportKey
}

watch(
  () => props.activeTab.key,
  () => {
    maximizedViewportKey.value = null
  }
)

watch(
  () => props.allowViewportMaximize,
  (allowViewportMaximize) => {
    if (!allowViewportMaximize) {
      maximizedViewportKey.value = null
    }
  }
)
</script>

<template>
  <div
    class="grid h-full w-full gap-2"
    :class="isViewportMaximized ? 'grid-cols-1 grid-rows-1' : activeLayoutConfig.containerClass"
  >
    <ViewerCanvasStage
      v-for="item in visibleViewportItems"
      :key="item.key"
      :viewport-key="item.key"
      :viewport-class="getViewportClass(item.key, item.className)"
      :is-active="isViewportActive(item.key)"
      :annotations="getItemAnnotations(item)"
      :cursor-class="getItemCursorClass(item)"
      :draft-annotation="getItemDraftAnnotation(item)"
      :render-surface-active="isViewportActive(item.key)"
      :image-src="getItemImage(item)"
      :active-operation="props.activeOperation"
      :is-loading="isItemLoading(item)"
      :loading-label="getItemLoadingLabel(item)"
      :loading-progress-percent="getItemLoadingProgressPercent(item)"
      :alt="item.label"
      :placeholder="getItemPlaceholder(item)"
      :corner-info="getItemCornerInfo(item)"
      :draft-measurement-mode="getItemDraftMeasurementMode(item)"
      :draft-measurement="getItemDraftMeasurement(item)"
      :measurements="getItemMeasurements(item)"
      :mtf-draft-mode="getItemMtfDraftMode(item)"
      :mtf-draft="getItemMtfDraft(item)"
      :mtf-items="getItemMtfItems(item)"
      :selected-mtf-id="item.kind === 'volume' ? null : props.selectedMtfId ?? null"
      :mpr-crosshair="getItemCrosshair(item)"
      :mpr-frame="getItemFrame(item)"
      :mpr-plane="getItemPlane(item)"
      :mpr-segmentation-default-threshold-color="props.mprSegmentationDefaultThresholdColor"
      :mpr-segmentation-default-voi-color="props.mprSegmentationDefaultVoiColor"
      :mpr-segmentation-config="props.mprSegmentationConfig"
      :mpr-segmentation-overlay="getItemSegmentationOverlay(item)"
      :voi-editable="isItemSegmentationEditable(item)"
      :voi-oblique="isItemVoiOblique(item)"
      :scale-bar="getItemScaleBar(item)"
      :show-corner-info="props.activeTab.showCornerInfo !== false"
      :show-scale-bar="props.activeTab.showScaleBar !== false"
      :viewport-transform="getItemTransform(item)"
      :orientation="getItemOrientation(item)"
      :soft-image="item.kind === 'volume'"
      @clear-mtf="emit('clearMtf')"
      @copy-selected-mtf="emit('copySelectedMtf', $event)"
      @copy-selected-measurement="emit('copySelectedMeasurement', $event)"
      @copy-annotation="emit('copyAnnotation', $event)"
      @delete-annotation="emit('deleteAnnotation', $event)"
      @delete-selected-measurement="(viewportKey, measurementId) => emit('deleteSelectedMeasurement', viewportKey, measurementId)"
      @click-viewport="emit('viewportClick', $event)"
      @double-click-viewport="handleViewportDoubleClick"
      @hover-viewport-change="emit('hoverViewportChange', $event)"
      @open-mtf-curve="emit('openMtfCurve')"
      @select-mtf="emit('selectMtf', $event)"
      @mpr-segmentation-config-change="handleMprSegmentationConfigChange"
      @mpr-segmentation-mode-change="handleMprSegmentationModeChange"
      @wheel-viewport="handleViewportWheel"
      @pointer-down="emit('pointerDown', $event, item.key)"
      @pointer-leave="emit('pointerLeave', $event)"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
      @update-annotation-color="emit('updateAnnotationColor', $event)"
      @update-annotation-size="emit('updateAnnotationSize', $event)"
      @update-annotation-text="emit('updateAnnotationText', $event)"
    />
  </div>
</template>
