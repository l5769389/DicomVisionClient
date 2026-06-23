<script setup lang="ts">
import type { QaWaterAnalysis, QaWaterRoi } from '../../../types/viewer'

const props = defineProps<{
  analysis: QaWaterAnalysis | null
  imageFrame: {
    left: number
    top: number
    width: number
    height: number
  }
}>()

function roiToScreen(roi: QaWaterRoi): { cx: number; cy: number; radius: number } {
  return {
    cx: props.imageFrame.left + roi.center.x * props.imageFrame.width,
    cy: props.imageFrame.top + roi.center.y * props.imageFrame.height,
    radius: roi.radius * Math.min(props.imageFrame.width, props.imageFrame.height)
  }
}
</script>

<template>
  <div v-if="analysis?.status === 'ready' && analysis.rois.length" class="pointer-events-none absolute inset-0 z-[4]">
    <svg
      class="absolute inset-0"
      aria-hidden="true"
      shape-rendering="geometricPrecision"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <g v-for="roi in analysis.rois" :key="roi.id">
        <circle
          :cx="roiToScreen(roi).cx"
          :cy="roiToScreen(roi).cy"
          :r="roiToScreen(roi).radius"
          :fill="roi.kind === 'air' ? 'rgba(251,191,36,0.09)' : 'rgba(56,189,248,0.09)'"
          :stroke="roi.kind === 'air' ? 'rgba(251,191,36,0.95)' : 'rgba(125,211,252,0.95)'"
          stroke-width="2.5"
        />
        <text
          :x="roiToScreen(roi).cx"
          :y="roiToScreen(roi).cy - roiToScreen(roi).radius - 7"
          fill="rgba(248,250,252,0.94)"
          font-size="11"
          font-weight="700"
          text-anchor="middle"
        >
          {{ roi.label }}
        </text>
      </g>
    </svg>
  </div>
</template>
