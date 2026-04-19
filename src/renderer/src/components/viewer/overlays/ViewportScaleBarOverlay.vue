<script setup lang="ts">
import { computed } from 'vue'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import type { ScaleBarInfo } from '../../../types/viewer'

interface ImageFrame {
  left: number
  top: number
  width: number
  height: number
}

const props = withDefaults(
  defineProps<{
    imageFrame: ImageFrame
    stageHeight: number
    stageWidth: number
    scaleBar?: ScaleBarInfo | null
  }>(),
  {
    scaleBar: null
  }
)

const { scaleBarPreference } = useUiPreferences()

const metrics = computed(() => {
  if (!scaleBarPreference.value.enabled || !props.scaleBar || props.stageWidth <= 0 || props.stageHeight <= 0) {
    return null
  }

  const rawLengthPx = props.scaleBar.lengthNorm * props.stageWidth
  if (!Number.isFinite(rawLengthPx) || rawLengthPx < 8) {
    return null
  }

  const hasFrame = props.imageFrame.width > 0 && props.imageFrame.height > 0
  const frameLeft = hasFrame ? props.imageFrame.left : 0
  const frameTop = hasFrame ? props.imageFrame.top : 0
  const frameWidth = hasFrame ? props.imageFrame.width : props.stageWidth
  const frameHeight = hasFrame ? props.imageFrame.height : props.stageHeight
  const maxWidth = Math.max(0, frameWidth - 32)
  if (rawLengthPx > maxWidth) {
    return null
  }
  const lengthPx = rawLengthPx
  const totalHeight = 34
  const bottomPadding = 10
  const left = frameLeft + Math.max(0, (frameWidth - lengthPx) / 2)
  const top = Math.max(12, Math.min(frameTop + frameHeight - totalHeight - bottomPadding, props.stageHeight - totalHeight - 8))

  return {
    color: scaleBarPreference.value.color,
    label: props.scaleBar.label,
    left,
    top,
    lengthPx
  }
})
</script>

<template>
  <div
    v-if="metrics"
    class="pointer-events-none absolute z-[3] select-none"
    :style="{ left: `${metrics.left}px`, top: `${metrics.top}px` }"
  >
    <div
      class="mb-1 text-center text-[11px] font-semibold tracking-[0.12em]"
      :style="{ color: metrics.color, textShadow: '0 1px 6px rgba(0,0,0,0.88)' }"
    >
      {{ metrics.label }}
    </div>
    <div class="relative h-4" :style="{ width: `${metrics.lengthPx}px` }">
      <div
        class="absolute inset-x-0 bottom-0 rounded-full"
        :style="{ height: '2px', backgroundColor: metrics.color, boxShadow: `0 0 8px ${metrics.color}55` }"
      ></div>
      <div
        v-for="tick in 11"
        :key="tick"
        class="absolute bottom-0 -translate-x-1/2"
        :style="{
          left: `${((tick - 1) / 10) * metrics.lengthPx}px`,
          width: tick === 1 || tick === 6 || tick === 11 ? '2px' : '1px',
          height: tick === 1 || tick === 6 || tick === 11 ? '12px' : '6px',
          backgroundColor: metrics.color,
          boxShadow: `0 0 8px ${metrics.color}55`
        }"
      ></div>
    </div>
  </div>
</template>
