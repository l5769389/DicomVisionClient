<script setup lang="ts">
import { computed } from 'vue'
import { applyViewportCornerInfoPreference } from '../../../composables/ui/viewportCornerInfo'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import type { CornerInfo, CornerPosition } from '../../../types/viewer'

const props = defineProps<{
  cornerInfo: CornerInfo
  viewportKey: string
}>()

const { viewportCornerInfoPreference } = useUiPreferences()
const cornerPositions: CornerPosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
const displayCornerInfo = computed(() =>
  applyViewportCornerInfoPreference(props.cornerInfo, viewportCornerInfoPreference.value)
)

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
      :class="[`viewer-corner-block--${position}`, { 'viewer-corner-block--empty': !getCornerLines(displayCornerInfo, position).length }]"
    >
      <span v-for="line in getCornerLines(displayCornerInfo, position)" :key="`${viewportKey}-${position}-${line}`" class="viewer-corner-line">
        {{ line }}
      </span>
    </div>
  </div>
</template>
