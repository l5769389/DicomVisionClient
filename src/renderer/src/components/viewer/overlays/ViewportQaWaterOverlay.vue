<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const isErrorDialogDismissed = ref(false)

function roiToScreen(roi: QaWaterRoi): { cx: number; cy: number; radius: number } {
  return {
    cx: props.imageFrame.left + roi.center.x * props.imageFrame.width,
    cy: props.imageFrame.top + roi.center.y * props.imageFrame.height,
    radius: roi.radius * Math.min(props.imageFrame.width, props.imageFrame.height)
  }
}

function formatMetricValue(value: number, unit: string): string {
  return `${value.toFixed(2)} ${unit}`
}

function formatSizeValue(value: number, unit: string): string {
  return `${value.toFixed(1)} ${unit}`
}

const statusMessage = computed(() => {
  if (!props.analysis) {
    return ''
  }
  if (props.analysis.status === 'loading') {
    return '正在分析水模 QA...'
  }
  return props.analysis.message || '水模 QA 分析失败，请确认图像包含完整水模后重试。'
})

const errorDialogOpen = computed(() => props.analysis?.status === 'error' && !isErrorDialogDismissed.value)

const metricRows = computed(() => {
  const metrics = props.analysis?.metrics
  if (!metrics) {
    return []
  }

  const rows: Array<{ label: string; value: string }> = []
  if (metrics.accuracy) {
    rows.push({
      label: 'Accuracy',
      value: formatMetricValue(metrics.accuracy.deviationHu, metrics.accuracy.unit)
    })
  }
  if (metrics.uniformity) {
    rows.push({
      label: 'Uniformity',
      value: formatMetricValue(metrics.uniformity.maxDeviation, metrics.uniformity.unit)
    })
  }
  if (metrics.noise) {
    rows.push({
      label: 'Noise',
      value: formatMetricValue(metrics.noise.stdDev, metrics.noise.unit)
    })
  }
  return rows
})

const uniformityRoiRows = computed(() => {
  const unit = props.analysis?.metrics?.uniformity?.unit ?? 'HU'
  return props.analysis?.metrics?.uniformity?.roiStats.map((item) => ({
    id: item.id,
    label: item.label,
    mean: formatMetricValue(item.mean, unit),
    deviation:
      item.deviationFromCenter == null
        ? '-'
        : `${item.deviationFromCenter >= 0 ? '+' : ''}${item.deviationFromCenter.toFixed(2)} ${unit}`
  })) ?? []
})

const roiSizeSummary = computed(() => {
  const firstRoi = props.analysis?.metrics?.uniformity?.roiStats[0]
  if (!firstRoi) {
    return null
  }

  return {
    size: `${formatSizeValue(firstRoi.width, firstRoi.sizeUnit)} x ${formatSizeValue(firstRoi.height, firstRoi.sizeUnit)}`,
    area: formatSizeValue(firstRoi.area, firstRoi.areaUnit)
  }
})

watch(
  () => [props.analysis?.status, props.analysis?.message, props.analysis?.viewId, props.analysis?.viewportKey] as const,
  () => {
    isErrorDialogDismissed.value = false
  }
)
</script>

<template>
  <div v-if="analysis" class="pointer-events-none absolute inset-0 z-[4]">
    <svg
      v-if="analysis.status === 'ready' && analysis.rois.length"
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

    <div
      v-if="analysis.status === 'loading' || (analysis.status === 'ready' && metricRows.length)"
      class="absolute left-4 top-4 max-w-[520px] rounded-lg border border-cyan-300/30 bg-slate-950/88 px-4 py-3 text-xs leading-5 text-slate-100 shadow-[0_18px_36px_rgba(0,0,0,0.34)] backdrop-blur"
    >
      <div class="mb-1 font-semibold uppercase tracking-[0.16em] text-cyan-100">Water Phantom QA</div>
      <template v-if="analysis.status === 'ready'">
        <div v-for="row in metricRows" :key="row.label" class="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
          <span class="text-slate-300">{{ row.label }}</span>
          <span class="text-right font-semibold text-slate-50">{{ row.value }}</span>
        </div>
        <div v-if="roiSizeSummary" class="mt-3 border-t border-cyan-200/14 pt-2">
          <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
            <span class="text-slate-300">ROI Size</span>
            <span class="text-right font-semibold text-slate-50">{{ roiSizeSummary.size }}</span>
          </div>
          <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
            <span class="text-slate-300">ROI Area</span>
            <span class="text-right font-semibold text-slate-50">{{ roiSizeSummary.area }}</span>
          </div>
        </div>
        <div v-if="uniformityRoiRows.length" class="mt-3 border-t border-cyan-200/14 pt-2">
          <div class="mb-1 grid grid-cols-[54px_82px_82px] gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">
            <span>ROI</span>
            <span class="text-right">Mean</span>
            <span class="text-right">Delta</span>
          </div>
          <div
            v-for="row in uniformityRoiRows"
            :key="row.id"
            class="grid grid-cols-[54px_82px_82px] gap-2 text-[11px] leading-5"
          >
            <span class="truncate text-slate-300">{{ row.label }}</span>
            <span class="text-right font-medium text-slate-100">{{ row.mean }}</span>
            <span class="text-right text-cyan-100">{{ row.deviation }}</span>
          </div>
        </div>
      </template>
      <div v-else class="text-amber-100">{{ statusMessage }}</div>
    </div>

    <div
      v-if="errorDialogOpen"
      class="pointer-events-auto fixed inset-0 z-[60] grid place-items-center bg-black/48 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qa-water-error-title"
    >
      <div class="w-full max-w-[420px] rounded-lg border border-amber-200/28 bg-slate-950 px-5 py-4 text-sm text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.48)]">
        <div id="qa-water-error-title" class="text-base font-semibold text-amber-100">水模 QA 检测失败</div>
        <div class="mt-2 text-sm leading-6 text-slate-200">{{ statusMessage }}</div>
        <div class="mt-4 flex justify-end">
          <button
            class="rounded-md border border-amber-100/24 bg-amber-200/12 px-3 py-1.5 text-xs font-semibold text-amber-50 transition hover:bg-amber-200/18"
            type="button"
            @click="isErrorDialogDismissed = true"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
