<script setup lang="ts">
import { computed } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import type { CornerInfo, MeasurementDraft, MeasurementOverlay, MprViewportKey, ViewerTabItem } from '../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeViewportKey: string
  getDraftMeasurement: (viewportKey: MprViewportKey) => MeasurementDraft | null
  getMeasurements: (viewportKey: MprViewportKey) => MeasurementOverlay[]
  getCornerInfo: (viewportKey: MprViewportKey) => CornerInfo
}>()

const emit = defineEmits<{
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
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
      :render-surface-active="activeViewportKey === item.key"
      :image-src="getViewportImage(item.key)"
      :is-loading="isViewportLoading(item.key)"
      loading-label="正在加载 MPR 视图..."
      :alt="item.label"
      :placeholder="`${item.label} 预览`"
      :corner-info="props.getCornerInfo(item.key)"
      :draft-measurement="props.getDraftMeasurement(item.key)"
      :measurements="props.getMeasurements(item.key)"
      :mpr-crosshair="getViewportCrosshair(item.key)"
      :orientation="getViewportOrientation(item.key)"
      @click-viewport="emit('viewportClick', $event)"
      @hover-viewport-change="emit('hoverViewportChange', $event)"
      @wheel-viewport="emit('viewportWheel', $event)"
      @pointer-down="emit('pointerDown', $event, item.key)"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
    />
  </div>
</template>
