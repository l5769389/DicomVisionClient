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
  MprViewportKey,
  ScaleBarInfo,
  ViewerMtfItem,
  ViewerTabItem
} from '../../../types/viewer'
import { DEFAULT_MPR_LAYOUT_KEY } from '../../../composables/workspace/layout/mprLayoutOptions'

const props = withDefaults(
  defineProps<{
    activeTab: ViewerTabItem
    activeOperation: string
    activeViewportKey: string
    allowViewportMaximize?: boolean
    layoutKey?: MprLayoutKey | null
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

interface MprViewportLayoutItem {
  key: MprViewportKey
  label: string
  className: string
}

interface MprViewportLayoutConfig {
  containerClass: string
  items: MprViewportLayoutItem[]
}

const MPR_LAYOUT_CONFIGS: Record<Exclude<MprLayoutKey, 'mpr-3d'>, MprViewportLayoutConfig> = {
  'three-columns': {
    containerClass: 'grid-cols-3 grid-rows-1',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-2 row-start-1' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-3 row-start-1' }
    ]
  },
  'right-primary': {
    containerClass: 'grid-cols-2 grid-rows-2',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-1 row-start-2' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-2 row-span-2 row-start-1' }
    ]
  },
  'three-rows': {
    containerClass: 'grid-cols-1 grid-rows-3',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-1 row-start-2' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-1 row-start-3' }
    ]
  },
  quad: {
    containerClass: 'grid-cols-2 grid-rows-2',
    items: [
      { key: 'mpr-ax', label: 'Axial', className: 'col-start-1 row-start-1' },
      { key: 'mpr-cor', label: 'Coronal', className: 'col-start-2 row-start-1' },
      { key: 'mpr-sag', label: 'Sagittal', className: 'col-start-1 row-start-2' }
    ]
  }
}

const normalizedLayoutKey = computed<Exclude<MprLayoutKey, 'mpr-3d'>>(() => {
  const layoutKey = props.layoutKey
  if (layoutKey && layoutKey !== 'mpr-3d' && layoutKey in MPR_LAYOUT_CONFIGS) {
    return layoutKey
  }

  return DEFAULT_MPR_LAYOUT_KEY
})

const activeLayoutConfig = computed(() => MPR_LAYOUT_CONFIGS[normalizedLayoutKey.value])
const viewportItems = computed(() => activeLayoutConfig.value.items)

const maximizedViewportKey = ref<MprViewportKey | null>(null)

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

function getViewportImage(viewportKey: MprViewportKey): string {
  return props.activeTab.viewportImages?.[viewportKey] ?? ''
}

function getViewportOrientation(viewportKey: MprViewportKey) {
  return props.activeTab.viewportOrientations?.[viewportKey] ?? props.activeTab.orientation
}

function getViewportCrosshair(viewportKey: MprViewportKey) {
  return props.activeTab.viewportCrosshairs?.[viewportKey] ?? null
}

function getViewportPlane(viewportKey: MprViewportKey) {
  return props.activeTab.viewportPlanes?.[viewportKey] ?? null
}

function getViewportScaleBar(viewportKey: MprViewportKey): ScaleBarInfo | null {
  return props.activeTab.viewportScaleBars?.[viewportKey] ?? null
}

function isViewportLoading(viewportKey: MprViewportKey): boolean {
  return Boolean(props.activeTab.viewportViewIds?.[viewportKey]) && !getViewportImage(viewportKey)
}

function normalizeOperation(operation: string): string {
  return operation.startsWith('stack:') ? operation.slice('stack:'.length) : operation
}

function getViewportClass(viewportKey: MprViewportKey, className: string): string {
  return maximizedViewportKey.value === viewportKey ? 'col-start-1 row-start-1' : className
}

function isViewportActive(viewportKey: MprViewportKey): boolean {
  return (maximizedViewportKey.value ?? props.activeViewportKey) === viewportKey
}

function isMprViewportKey(viewportKey: string): viewportKey is MprViewportKey {
  return viewportKey === 'mpr-ax' || viewportKey === 'mpr-sag' || viewportKey === 'mpr-cor'
}

function handleViewportDoubleClick(viewportKey: string): void {
  emit('viewportClick', viewportKey)

  if (!isMprViewportKey(viewportKey) || !canToggleViewportMaximize.value) {
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
      :annotations="props.getAnnotations(item.key)"
      :cursor-class="props.getCursorClass(item.key)"
      :draft-annotation="props.getDraftAnnotation(item.key)"
      :render-surface-active="isViewportActive(item.key)"
      :image-src="getViewportImage(item.key)"
      :active-operation="props.activeOperation"
      :is-loading="isViewportLoading(item.key)"
      loading-label="正在加载 MPR 视图..."
      :alt="item.label"
      :placeholder="`${item.label} 预览`"
      :corner-info="props.getCornerInfo(item.key)"
      :draft-measurement-mode="props.getDraftMeasurementMode(item.key)"
      :draft-measurement="props.getDraftMeasurement(item.key)"
      :measurements="props.getMeasurements(item.key)"
      :mtf-draft-mode="props.getMtfDraftMode(item.key)"
      :mtf-draft="props.getMtfDraft(item.key)"
      :mtf-items="props.getMtfItems(item.key)"
      :selected-mtf-id="props.selectedMtfId ?? null"
      :mpr-crosshair="getViewportCrosshair(item.key)"
      :mpr-frame="props.activeTab.mprFrame ?? null"
      :mpr-plane="getViewportPlane(item.key)"
      :scale-bar="getViewportScaleBar(item.key)"
      :orientation="getViewportOrientation(item.key)"
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
      @wheel-viewport="emit('viewportWheel', $event)"
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
