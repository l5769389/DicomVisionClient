<script setup lang="ts">
import ViewerViewport from './ViewerViewport.vue'
import type { ViewerTabItem } from '../../types/viewer'

defineProps<{
  activeTab: ViewerTabItem
}>()

const emit = defineEmits<{
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number }]
}>()
</script>

<template>
  <div class="viewer-layout viewer-layout--stack">
    <ViewerViewport
      viewport-key="single"
      viewport-class="viewer-viewport--single"
      :is-active="true"
      :render-surface-active="true"
      :image-src="activeTab.imageSrc"
      :alt="activeTab.viewType"
      placeholder="单视口预览"
      :corner-info="activeTab.cornerInfo"
      :orientation="activeTab.orientation"
      @click-viewport="emit('viewportClick', $event)"
      @wheel-viewport="emit('viewportWheel', $event)"
      @pointer-down="emit('pointerDown', $event, 'single')"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
    />
  </div>
</template>
