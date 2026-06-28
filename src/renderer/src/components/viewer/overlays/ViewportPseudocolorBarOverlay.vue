<script setup lang="ts">
import { computed } from 'vue'
import { getVerticalPseudocolorGradient } from '../../../constants/pseudocolor'
import type { WindowLevelInfo } from '../../../types/viewer'

const props = withDefaults(
  defineProps<{
    stageHeight: number
    stageWidth: number
    pseudocolorPreset?: string | null
    windowInfo?: WindowLevelInfo | null
    lightSurface?: boolean
  }>(),
  {
    pseudocolorPreset: null,
    windowInfo: null,
    lightSurface: false
  }
)

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatWindowValue(value: number): string {
  return String(Math.round(value))
}

const metrics = computed(() => {
  const roundedStageWidth = Math.round(props.stageWidth)
  const roundedStageHeight = Math.round(props.stageHeight)
  if (!props.pseudocolorPreset || roundedStageWidth < 96 || roundedStageHeight < 120) {
    return null
  }

  const barHeight = Math.round(clamp(roundedStageHeight * 0.46, 88, Math.max(88, roundedStageHeight - 72)))
  const top = Math.round(clamp((roundedStageHeight - barHeight) / 2, 16, Math.max(16, roundedStageHeight - barHeight - 16)))
  const left = Math.round(clamp(roundedStageWidth * 0.035, 14, 28))
  const barWidth = roundedStageWidth < 420 ? 6 : 8
  const labelOffset = barWidth + 6
  const labelColor = props.lightSurface ? '#132033' : '#f8fafc'
  const textShadow = props.lightSurface
    ? '0 1px 1px rgba(255,255,255,0.82), 0 0 4px rgba(15,23,42,0.24)'
    : '0 1px 6px rgba(0,0,0,0.88)'
  const ww = props.windowInfo?.ww
  const wl = props.windowInfo?.wl
  const hasWindowInfo = typeof ww === 'number' && Number.isFinite(ww) && ww > 0 && typeof wl === 'number' && Number.isFinite(wl)
  const topValue = hasWindowInfo ? wl + ww / 2 : null
  const bottomValue = hasWindowInfo ? wl - ww / 2 : null
  const labelStyle = {
    left: `${labelOffset}px`,
    color: labelColor,
    textShadow
  }

  return {
    barStyle: {
      width: `${barWidth}px`,
      height: `${barHeight}px`,
      background: getVerticalPseudocolorGradient(props.pseudocolorPreset)
    },
    bottomLabel: bottomValue == null ? '' : formatWindowValue(bottomValue),
    bottomLabelStyle: labelStyle,
    containerStyle: {
      left: `${left}px`,
      top: `${top}px`
    },
    topLabel: topValue == null ? '' : formatWindowValue(topValue),
    topLabelStyle: labelStyle
  }
})
</script>

<template>
  <div
    v-if="metrics"
    class="pointer-events-none absolute z-[3] select-none"
    :style="metrics.containerStyle"
  >
    <div
      class="rounded-[2px] border border-white/15 shadow-[0_0_10px_rgba(0,0,0,0.4)]"
      :style="metrics.barStyle"
    ></div>
    <div
      v-if="metrics.topLabel"
      class="absolute top-[-7px] whitespace-nowrap text-[11px] font-semibold italic leading-none"
      :style="metrics.topLabelStyle"
    >
      {{ metrics.topLabel }}
    </div>
    <div
      v-if="metrics.bottomLabel"
      class="absolute bottom-[-7px] whitespace-nowrap text-[11px] font-semibold italic leading-none"
      :style="metrics.bottomLabelStyle"
    >
      {{ metrics.bottomLabel }}
    </div>
  </div>
</template>
