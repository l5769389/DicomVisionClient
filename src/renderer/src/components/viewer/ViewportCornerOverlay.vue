<script setup lang="ts">
import type { CornerInfo, CornerPosition } from '../../types/viewer'

defineProps<{
  cornerInfo: CornerInfo
  viewportKey: string
}>()

const cornerPositions: CornerPosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

function getCornerLines(cornerInfo: CornerInfo, position: CornerPosition): string[] {
  return cornerInfo[position] ?? []
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[2]">
    <div
      v-for="position in cornerPositions"
      :key="`${viewportKey}-${position}`"
      class="viewer-corner-block"
      :class="[`viewer-corner-block--${position}`, { 'viewer-corner-block--empty': !getCornerLines(cornerInfo, position).length }]"
    >
      <span v-for="line in getCornerLines(cornerInfo, position)" :key="`${viewportKey}-${position}-${line}`" class="viewer-corner-line">
        {{ line }}
      </span>
    </div>
  </div>
</template>
