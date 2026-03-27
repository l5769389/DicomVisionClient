<script setup lang="ts">
import ViewerCanvasStage from './ViewerCanvasStage.vue'
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
}>()
</script>

<template>
  <div class="viewer-layout viewer-layout--volume">
    <ViewerCanvasStage
      viewport-key="volume"
      viewport-class="viewer-viewport--volume"
      :is-active="true"
      :render-surface-active="true"
      :image-src="activeTab.imageSrc"
      :alt="activeTab.viewType"
      placeholder="3D 视图预留区域"
      :corner-info="activeTab.cornerInfo"
      :orientation="activeTab.orientation"
      :soft-image="true"
      @click-viewport="emit('viewportClick', $event)"
      @pointer-down="emit('pointerDown', $event, 'volume')"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
    />
  </div>
</template>
