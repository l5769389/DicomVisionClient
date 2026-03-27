<script setup lang="ts">
import type { CornerInfo, CornerPosition, OrientationInfo } from '../../types/viewer'

const props = withDefaults(
  defineProps<{
    alt: string
    cornerInfo: CornerInfo
    imageClass?: string
    imageSrc: string
    isActive?: boolean
    orientation: OrientationInfo
    placeholder: string
    renderSurfaceActive?: boolean
    softImage?: boolean
    viewportClass?: string
    viewportKey: string
  }>(),
  {
    imageClass: '',
    isActive: false,
    renderSurfaceActive: false,
    softImage: false,
    viewportClass: ''
  }
)

const emit = defineEmits<{
  clickViewport: [viewportKey: string]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  wheelViewport: [payload: { viewportKey: string; deltaY: number }]
}>()

const cornerPositions: CornerPosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

function getCornerLines(position: CornerPosition): string[] {
  return props.cornerInfo[position] ?? []
}

function hasCornerLines(position: CornerPosition): boolean {
  return getCornerLines(position).length > 0
}
</script>

<template>
  <div
    class="viewer-viewport"
    :class="[viewportClass, { 'viewer-viewport--active': isActive }]"
    :data-active-viewport="isActive ? 'true' : 'false'"
    @click="emit('clickViewport', viewportKey)"
    @wheel.prevent="emit('wheelViewport', { viewportKey, deltaY: $event.deltaY })"
    @pointerdown="emit('pointerDown', $event, viewportKey)"
    @pointermove="emit('pointerMove', $event)"
    @pointerup="emit('pointerUp', $event)"
    @pointercancel="emit('pointerCancel', $event)"
  >
    <div
      class="viewer-viewport-stage"
      :data-active-render-surface="renderSurfaceActive ? 'true' : 'false'"
      :data-viewport-key="viewportKey"
    >
      <img
        v-if="imageSrc"
        class="viewer-image"
        :class="[imageClass, { 'viewer-image--soft': softImage }]"
        :src="imageSrc"
        :alt="alt"
        draggable="false"
        @dragstart.prevent
      />
      <div class="viewer-corner-overlay">
        <div
          v-for="position in cornerPositions"
          :key="`${viewportKey}-${position}`"
          class="viewer-corner-block"
          :class="[`viewer-corner-block--${position}`, { 'viewer-corner-block--empty': !hasCornerLines(position) }]"
        >
          <span v-for="line in getCornerLines(position)" :key="`${viewportKey}-${position}-${line}`" class="viewer-corner-line">
            {{ line }}
          </span>
        </div>
      </div>
      <div class="viewer-orientation-overlay">
        <span v-if="orientation.top" class="viewer-orientation-label viewer-orientation-label--top">{{ orientation.top }}</span>
        <span v-if="orientation.right" class="viewer-orientation-label viewer-orientation-label--right">{{ orientation.right }}</span>
        <span v-if="orientation.bottom" class="viewer-orientation-label viewer-orientation-label--bottom">{{ orientation.bottom }}</span>
        <span v-if="orientation.left" class="viewer-orientation-label viewer-orientation-label--left">{{ orientation.left }}</span>
      </div>
      <span v-if="!imageSrc" class="viewer-viewport-placeholder">{{ placeholder }}</span>
    </div>
  </div>
</template>
