<script setup lang="ts">
import { computed } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import type { CornerInfo, DraftMeasurementMode, MeasurementDraft, MeasurementOverlay, MprViewportKey, ViewerMtfItem, ViewerTabItem } from '../../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeViewportKey: string
  getCursorClass: (viewportKey: MprViewportKey) => string
  getDraftMeasurementMode: (viewportKey: MprViewportKey) => DraftMeasurementMode | null
  getDraftMeasurement: (viewportKey: MprViewportKey) => MeasurementDraft | null
  getMeasurements: (viewportKey: MprViewportKey) => MeasurementOverlay[]
  getMtfDraftMode: (viewportKey: MprViewportKey) => DraftMeasurementMode | null
  getMtfDraft: (viewportKey: MprViewportKey) => { mtfId?: string; points: { x: number; y: number }[] } | null
  getMtfItems: (viewportKey: MprViewportKey) => ViewerMtfItem[]
  selectedMtfId?: string | null
  getCornerInfo: (viewportKey: MprViewportKey) => CornerInfo
}>()

const emit = defineEmits<{
  copySelectedMeasurement: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string]
  clearMtf: []
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  openMtfCurve: []
  selectMtf: [payload: { mtfId: string | null }]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
}>()

const viewportItems = computed(() => [
  { key: 'mpr-ax' as const, label: 'Axial', className: 'col-start-1 row-start-1' },
  { key: 'mpr-sag' as const, label: 'Sagittal', className: 'col-start-1 row-start-2' },
  { key: 'mpr-cor' as const, label: 'Coronal', className: 'col-start-2 row-span-2 row-start-1' }
])

function getViewportImage(viewportKey: MprViewportKey): string {
  return props.activeTab.viewportImages?.[viewportKey] ?? ''
}

function getViewportOrientation(viewportKey: MprViewportKey) {
  return props.activeTab.viewportOrientations?.[viewportKey] ?? props.activeTab.orientation
}

function getViewportCrosshair(viewportKey: MprViewportKey) {
  return props.activeTab.viewportCrosshairs?.[viewportKey] ?? null
}

function isViewportLoading(viewportKey: MprViewportKey): boolean {
  return Boolean(props.activeTab.viewportViewIds?.[viewportKey]) && !getViewportImage(viewportKey)
}
</script>

<template>
  <div class="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
    <ViewerCanvasStage
      v-for="item in viewportItems"
      :key="item.key"
      :viewport-key="item.key"
      :viewport-class="item.className"
      :is-active="activeViewportKey === item.key"
      :cursor-class="props.getCursorClass(item.key)"
      :render-surface-active="activeViewportKey === item.key"
      :image-src="getViewportImage(item.key)"
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
      :orientation="getViewportOrientation(item.key)"
      @clear-mtf="emit('clearMtf')"
      @copy-selected-mtf="emit('copySelectedMtf', $event)"
      @copy-selected-measurement="emit('copySelectedMeasurement', $event)"
      @delete-selected-measurement="emit('deleteSelectedMeasurement', $event)"
      @click-viewport="emit('viewportClick', $event)"
      @hover-viewport-change="emit('hoverViewportChange', $event)"
      @open-mtf-curve="emit('openMtfCurve')"
      @select-mtf="emit('selectMtf', $event)"
      @wheel-viewport="emit('viewportWheel', $event)"
      @pointer-down="emit('pointerDown', $event, item.key)"
      @pointer-leave="emit('pointerLeave', $event)"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
    />
  </div>
</template>
