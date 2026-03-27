<script setup lang="ts">
import type { OrientationInfo } from '../../types/viewer'

defineProps<{
  orientation: OrientationInfo
}>()
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[3]">
    <span v-if="orientation.top" class="viewer-orientation-label viewer-orientation-label--top">{{ orientation.top }}</span>
    <span v-if="orientation.right" class="viewer-orientation-label viewer-orientation-label--right">{{ orientation.right }}</span>
    <span v-if="orientation.bottom" class="viewer-orientation-label viewer-orientation-label--bottom">{{ orientation.bottom }}</span>
    <span v-if="orientation.left" class="viewer-orientation-label viewer-orientation-label--left">{{ orientation.left }}</span>
  </div>
</template>
