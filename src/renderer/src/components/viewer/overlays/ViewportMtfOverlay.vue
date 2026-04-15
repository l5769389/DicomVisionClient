<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { MeasurementDraftPoint, ViewerMtfItem } from '../../../types/viewer'
import {
  getOverlayHandlePointsFromRectBounds,
  getOverlayRectBounds,
  type OverlayRectBounds,
  type OverlayScreenPoint
} from './overlayGeometry'

interface RenderedMtfItem {
  mtfId: string
  status: ViewerMtfItem['status']
  rect: OverlayRectBounds
  handlePoints: OverlayScreenPoint[]
  metrics: ViewerMtfItem['metrics'] | null
  errorMessage: string | null
  isPlaceholder: boolean
}

const props = withDefaults(
  defineProps<{
    imageFrame: {
      left: number
      top: number
      width: number
      height: number
    }
    mtfDraft?: { mtfId?: string; points: MeasurementDraftPoint[] } | null
    mtfItems?: ViewerMtfItem[]
    selectedMtfId?: string | null
  }>(),
  {
    mtfDraft: null,
    mtfItems: () => [],
    selectedMtfId: null
  }
)

const emit = defineEmits<{
  clear: []
  copy: []
  openCurve: []
  select: [payload: { mtfId: string | null }]
}>()

const renderedDraftRect = computed(() => getOverlayRectBounds(props.imageFrame, props.mtfDraft?.points))

const renderedMtfItems = computed<RenderedMtfItem[]>(() => {
  const items: RenderedMtfItem[] = []

  props.mtfItems.forEach((item) => {
    const rect = getOverlayRectBounds(props.imageFrame, item.points)
    if (!rect) {
      return
    }

    items.push({
      mtfId: item.mtfId,
      status: item.status,
      rect,
      handlePoints: getOverlayHandlePointsFromRectBounds(rect),
      metrics: item.metrics ?? null,
      errorMessage: item.errorMessage ?? null,
      isPlaceholder: item.isPlaceholder ?? false
    })
  })

  return items
})

const selectedRenderedItem = computed(() => {
  if (props.selectedMtfId) {
    return renderedMtfItems.value.find((item) => item.mtfId === props.selectedMtfId) ?? null
  }

  return renderedMtfItems.value.at(-1) ?? null
})

const metricCardStyle = computed(() => {
  const rect = selectedRenderedItem.value?.rect ?? renderedDraftRect.value
  if (!rect) {
    return null
  }

  const minLeft = props.imageFrame.left + 12
  const maxLeft = Math.max(props.imageFrame.left + props.imageFrame.width - 228, minLeft)
  const minTop = props.imageFrame.top + 12
  const maxTop = Math.max(props.imageFrame.top + props.imageFrame.height - 168, minTop)

  return {
    left: `${Math.round(Math.max(minLeft, Math.min(maxLeft, rect.left + rect.width + 12)))}px`,
    top: `${Math.round(Math.max(minTop, Math.min(maxTop, rect.top + 4)))}px`
  }
})

const metricRows = computed(() => {
  const metrics = selectedRenderedItem.value?.metrics
  if (!metrics) {
    return []
  }

  const unit = metrics.unit || 'lp/mm'
  return [
    { label: 'MTF50', value: metrics.mtf50 != null ? `${metrics.mtf50.toFixed(3)} ${unit}` : '-' },
    { label: 'MTF10', value: metrics.mtf10 != null ? `${metrics.mtf10.toFixed(3)} ${unit}` : '-' },
    { label: 'Peak', value: metrics.peakValue != null ? metrics.peakValue.toFixed(3) : '-' },
    { label: 'Samples', value: metrics.sampleCount != null ? String(metrics.sampleCount) : '-' }
  ]
})

const selectedStatusLabel = computed(() => {
  switch (selectedRenderedItem.value?.status) {
    case 'calculating':
      return '计算中'
    case 'error':
      return '分析失败'
    case 'ready':
      return '分析完成'
    default:
      return '绘制 ROI'
  }
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[8]">
    <svg class="absolute inset-0 h-full w-full">
      <g
        v-for="item in renderedMtfItems"
        :key="item.mtfId"
        class="pointer-events-auto cursor-pointer"
        @pointerdown.stop.prevent="emit('select', { mtfId: item.mtfId })"
      >
        <rect
          :x="item.rect.left"
          :y="item.rect.top"
          :width="item.rect.width"
          :height="item.rect.height"
          rx="8"
          :fill="item.mtfId === selectedRenderedItem?.mtfId ? 'rgba(56,189,248,0.16)' : 'rgba(56,189,248,0.08)'"
          :stroke="item.mtfId === selectedRenderedItem?.mtfId ? 'rgba(125,211,252,1)' : 'rgba(56,189,248,0.72)'"
          :stroke-width="item.mtfId === selectedRenderedItem?.mtfId ? 2.5 : 1.6"
        />
        <circle
          v-for="(handle, index) in item.mtfId === selectedRenderedItem?.mtfId ? item.handlePoints : []"
          :key="`${item.mtfId}-handle-${index}`"
          :cx="handle.x"
          :cy="handle.y"
          r="4.5"
          fill="rgba(255,255,255,0.98)"
          stroke="rgba(8,30,48,0.9)"
          stroke-width="1.5"
        />
      </g>

      <rect
        v-if="renderedDraftRect"
        :x="renderedDraftRect.left"
        :y="renderedDraftRect.top"
        :width="renderedDraftRect.width"
        :height="renderedDraftRect.height"
        rx="8"
        fill="rgba(250,204,21,0.10)"
        stroke="rgba(251,191,36,0.95)"
        stroke-width="2"
        stroke-dasharray="10 6"
      />
    </svg>

    <div
      v-if="metricCardStyle && (selectedRenderedItem || renderedDraftRect)"
      class="pointer-events-auto absolute w-[216px] rounded-2xl border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(5,16,28,0.96),rgba(5,12,20,0.98))] p-3 text-slate-100 shadow-[0_18px_32px_rgba(0,0,0,0.34)]"
      :style="metricCardStyle"
      @pointerdown.stop.prevent
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">MTF Metric</div>
          <div class="mt-1 text-sm font-semibold text-white">{{ selectedStatusLabel }}</div>
        </div>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/16 bg-red-400/10 text-red-100 transition hover:bg-red-400/18"
          aria-label="删除 MTF ROI"
          @click="emit('clear')"
        >
          <AppIcon name="trash" :size="16" />
        </button>
      </div>

      <div v-if="selectedRenderedItem?.status === 'ready'" class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px] leading-5">
        <template v-for="row in metricRows" :key="row.label">
          <div class="text-slate-400">{{ row.label }}</div>
          <div class="text-right font-medium text-slate-50">{{ row.value }}</div>
        </template>
      </div>

      <div v-else-if="selectedRenderedItem?.status === 'error'" class="mt-3 text-[12px] leading-5 text-red-100/90">
        {{ selectedRenderedItem.errorMessage || '当前 ROI 的 MTF 分析未完成。' }}
      </div>

      <div v-else-if="selectedRenderedItem?.status === 'calculating'" class="mt-3 text-[12px] leading-5 text-slate-300">
        正在向后端发送当前 ROI 并等待返回 MTF 指标。
      </div>

      <div v-else class="mt-3 text-[12px] leading-5 text-slate-300">
        拖拽一个矩形 ROI 开始分析。当前视口可以保留多个 MTF ROI。
      </div>

      <div
        v-if="selectedRenderedItem?.isPlaceholder"
        class="mt-3 rounded-xl border border-amber-300/12 bg-amber-300/8 px-3 py-2 text-[11px] leading-5 text-amber-50/90"
      >
        当前展示的是链路占位结果，后续可替换为真实 MTF 算法。
      </div>

      <div class="mt-3 flex justify-end gap-2">
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-slate-100 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
          :disabled="!selectedRenderedItem"
          aria-label="复制 MTF ROI"
          @click="emit('copy')"
        >
          <AppIcon name="copy" :size="16" />
        </button>
        <button
          type="button"
          class="rounded-lg border border-cyan-300/22 bg-cyan-300/10 px-3 py-1.5 text-[12px] font-medium text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-45"
          :disabled="selectedRenderedItem?.status !== 'ready'"
          @click="emit('openCurve')"
        >
          查看曲线
        </button>
      </div>
    </div>
  </div>
</template>
