<script setup lang="ts">
import { computed } from 'vue'
import ViewerViewport from './ViewerViewport.vue'
import type { MprViewportKey, ViewerTabItem } from '../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeViewportKey: string
}>()

const emit = defineEmits<{
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number }]
}>()

const viewportItems = computed(() => [
  { key: 'mpr-ax' as const, label: 'Axial', className: 'viewer-viewport--top' },
  { key: 'mpr-sag' as const, label: 'Sagittal', className: 'viewer-viewport--bottom' },
  { key: 'mpr-cor' as const, label: 'Coronal', className: 'viewer-viewport--main' }
])

function getViewportImage(viewportKey: MprViewportKey): string {
  return props.activeTab.viewportImages?.[viewportKey] ?? ''
}

function getViewportCornerInfo(viewportKey: MprViewportKey) {
  return props.activeTab.viewportCornerInfos?.[viewportKey] ?? props.activeTab.cornerInfo
}

function getViewportOrientation(viewportKey: MprViewportKey) {
  return props.activeTab.viewportOrientations?.[viewportKey] ?? props.activeTab.orientation
}
</script>

<template>
  <div class="viewer-layout viewer-layout--mpr">
    <ViewerViewport
      v-for="item in viewportItems"
      :key="item.key"
      :viewport-key="item.key"
      :viewport-class="item.className"
      :is-active="activeViewportKey === item.key"
      :render-surface-active="activeViewportKey === item.key"
      :image-src="getViewportImage(item.key)"
      :alt="item.label"
      :placeholder="`${item.label} 预览`"
      :corner-info="getViewportCornerInfo(item.key)"
      :orientation="getViewportOrientation(item.key)"
      @click-viewport="emit('viewportClick', $event)"
      @wheel-viewport="emit('viewportWheel', $event)"
      @pointer-down="emit('pointerDown', $event, item.key)"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
    />
  </div>
</template>
