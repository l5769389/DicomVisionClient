<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { DraftMeasurementMode, MeasurementDraftPoint, ViewerMtfItem } from '../../../types/viewer'
import {
  getOverlayHandlePointsFromRectBounds,
  getOverlayRectBounds,
  type OverlayRectBounds,
  type OverlayScreenPoint
} from './overlayGeometry'

type MtfRenderMode = 'committed' | 'selected' | 'moving' | 'draft'

interface RenderedMtfItem {
  key: string
  mtfId: string | null
  status: ViewerMtfItem['status'] | null
  rect: OverlayRectBounds
  handlePoints: OverlayScreenPoint[]
  metrics: ViewerMtfItem['metrics'] | null
  errorMessage: string | null
  mode: MtfRenderMode
}

const MIN_POPUP_RECT_SIZE_PX = 6

const committedStrokeOuter = 'rgba(3,15,24,0.92)'
const committedStrokeInner = 'rgba(85,231,255,0.98)'
const draftStrokeOuter = 'rgba(56,22,4,0.92)'
const draftStrokeInner = 'rgba(255,184,77,0.98)'

const props = withDefaults(
  defineProps<{
    imageFrame: {
      left: number
      top: number
      width: number
      height: number
    }
    mtfDraftMode?: DraftMeasurementMode | null
    mtfDraft?: { mtfId?: string; points: MeasurementDraftPoint[] } | null
    mtfItems?: ViewerMtfItem[]
    selectedMtfId?: string | null
  }>(),
  {
    mtfDraftMode: null,
    mtfDraft: null,
    mtfItems: () => [],
    selectedMtfId: null
  }
)

const emit = defineEmits<{
  clear: []
  copy: []
  openCurve: []
}>()

function buildRenderedMtfItem(
  key: string,
  points: MeasurementDraftPoint[],
  mode: MtfRenderMode,
  source?: ViewerMtfItem | null
): RenderedMtfItem | null {
  const rect = getOverlayRectBounds(props.imageFrame, points)
  if (!rect) {
    return null
  }

  return {
    key,
    mtfId: source?.mtfId ?? (key === 'draft' ? props.mtfDraft?.mtfId ?? null : key),
    status: source?.status ?? null,
    rect,
    handlePoints: getOverlayHandlePointsFromRectBounds(rect),
    metrics: source?.metrics ?? null,
    errorMessage: source?.errorMessage ?? null,
    mode
  }
}

function toMtfRenderMode(mode: DraftMeasurementMode | null | undefined): MtfRenderMode {
  if (mode === 'moving') {
    return 'moving'
  }
  if (mode === 'selected') {
    return 'selected'
  }
  return 'draft'
}

const renderedCommittedItems = computed(() =>
  props.mtfItems
    .map((item) =>
      buildRenderedMtfItem(
        item.mtfId,
        item.points,
        item.mtfId === props.selectedMtfId && (!props.mtfDraft || props.mtfDraft.mtfId !== item.mtfId)
          ? 'selected'
          : 'committed',
        item
      )
    )
    .filter((item): item is RenderedMtfItem => item != null)
)

const renderedDraftItem = computed(() => {
  if (!props.mtfDraft) {
    return null
  }

  const sourceItem =
    props.mtfDraft.mtfId != null ? props.mtfItems.find((item) => item.mtfId === props.mtfDraft?.mtfId) ?? null : null

  return buildRenderedMtfItem('draft', props.mtfDraft.points, toMtfRenderMode(props.mtfDraftMode), sourceItem)
})

function canShowMetricCardForItem(item: RenderedMtfItem | null): boolean {
  if (!item) {
    return false
  }

  if (item.mode !== 'draft') {
    return true
  }

  return item.rect.width >= MIN_POPUP_RECT_SIZE_PX && item.rect.height >= MIN_POPUP_RECT_SIZE_PX
}

const allRenderedItems = computed(() =>
  renderedDraftItem.value ? [...renderedCommittedItems.value, renderedDraftItem.value] : renderedCommittedItems.value
)

const activeRenderedItem = computed(() => {
  if (canShowMetricCardForItem(renderedDraftItem.value)) {
    return renderedDraftItem.value
  }

  if (!props.selectedMtfId) {
    return null
  }

  return renderedCommittedItems.value.find((item) => item.mtfId === props.selectedMtfId) ?? null
})

const metricCardStyle = computed(() => {
  const rect = activeRenderedItem.value?.rect
  if (!rect) {
    return null
  }

  const minLeft = props.imageFrame.left + 12
  const maxLeft = Math.max(props.imageFrame.left + props.imageFrame.width - 244, minLeft)
  const minTop = props.imageFrame.top + 12
  const maxTop = Math.max(props.imageFrame.top + props.imageFrame.height - 176, minTop)

  return {
    left: `${Math.round(Math.max(minLeft, Math.min(maxLeft, rect.left + rect.width + 12)))}px`,
    top: `${Math.round(Math.max(minTop, Math.min(maxTop, rect.top + 4)))}px`
  }
})

const metricRows = computed(() => {
  const metrics = activeRenderedItem.value?.metrics
  if (!metrics) {
    return []
  }

  const unit = metrics.unit || 'lp/mm'
  const fwhmUnit = unit === 'lp/mm' ? 'mm' : 'px'
  return [
    { label: 'MTF50', value: metrics.mtf50 != null ? `${metrics.mtf50.toFixed(3)} ${unit}` : '-' },
    { label: 'MTF10', value: metrics.mtf10 != null ? `${metrics.mtf10.toFixed(3)} ${unit}` : '-' },
    { label: 'FWHM-W', value: metrics.fwhmW != null ? `${metrics.fwhmW.toFixed(3)} ${fwhmUnit}` : '-' },
    { label: 'FWHM-H', value: metrics.fwhmH != null ? `${metrics.fwhmH.toFixed(3)} ${fwhmUnit}` : '-' }
  ]
})

const selectedStatusLabel = computed(() => {
  if (renderedDraftItem.value?.mode === 'draft' && !renderedDraftItem.value?.mtfId) {
    return '绘制 ROI'
  }

  switch (activeRenderedItem.value?.status) {
    case 'calculating':
      return '计算中'
    case 'error':
      return '分析失败'
    case 'ready':
      return '分析完成'
    default:
      return activeRenderedItem.value ? '已选中 ROI' : '绘制 ROI'
  }
})

function getOuterStroke(item: RenderedMtfItem): string {
  return item.mode === 'committed' ? committedStrokeOuter : draftStrokeOuter
}

function getInnerStroke(item: RenderedMtfItem): string {
  if (item.mode === 'moving') {
    return 'rgba(255,224,130,1)'
  }
  if (item.mode === 'selected') {
    return 'rgba(255,202,111,0.98)'
  }
  return item.mode === 'committed' ? committedStrokeInner : draftStrokeInner
}

function getOuterStrokeDasharray(item: RenderedMtfItem): string | undefined {
  return item.mode === 'draft' ? '10 7' : undefined
}

function getInnerStrokeDasharray(item: RenderedMtfItem): string | undefined {
  return item.mode === 'draft' ? '10 7' : undefined
}

function shouldRenderHandles(item: RenderedMtfItem): boolean {
  return item.mode !== 'committed'
}

function getHandleRadius(item: RenderedMtfItem): number {
  return item.mode === 'committed' ? 3.5 : 4
}

function getHandleFill(item: RenderedMtfItem): string {
  return item.mode === 'committed' ? 'white' : 'rgba(255,244,214,0.98)'
}

function getShapeFill(item: RenderedMtfItem): string {
  if (item.mode === 'moving') {
    return 'rgba(255,184,77,0.18)'
  }
  if (item.mode === 'selected') {
    return 'rgba(255,184,77,0.1)'
  }
  return 'none'
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[8]">
    <svg class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" shape-rendering="geometricPrecision">
      <g v-for="item in allRenderedItems" :key="item.key">
        <rect
          :x="item.rect.left"
          :y="item.rect.top"
          :width="item.rect.width"
          :height="item.rect.height"
          :fill="getShapeFill(item)"
          :stroke="getOuterStroke(item)"
          stroke-width="5"
          stroke-linejoin="round"
          :stroke-dasharray="getOuterStrokeDasharray(item)"
        />
        <rect
          :x="item.rect.left"
          :y="item.rect.top"
          :width="item.rect.width"
          :height="item.rect.height"
          :fill="getShapeFill(item)"
          :stroke="getInnerStroke(item)"
          stroke-width="2.5"
          stroke-linejoin="round"
          :stroke-dasharray="getInnerStrokeDasharray(item)"
        />

        <template v-if="shouldRenderHandles(item)">
          <circle
            v-for="(handle, index) in item.handlePoints"
            :key="`${item.key}-handle-${index}`"
            :cx="handle.x"
            :cy="handle.y"
            :r="getHandleRadius(item)"
            :fill="getHandleFill(item)"
            :stroke="getOuterStroke(item)"
            stroke-width="1.25"
          />
        </template>
      </g>
    </svg>

    <div
      v-if="metricCardStyle && activeRenderedItem"
      class="pointer-events-auto absolute w-[228px] rounded-2xl border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(5,16,28,0.96),rgba(5,12,20,0.98))] p-3 text-slate-100 shadow-[0_18px_32px_rgba(0,0,0,0.34)]"
      :style="metricCardStyle"
      @pointerdown.stop.prevent
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">MTF Metric</div>
          <div class="mt-1 text-sm font-semibold text-white">{{ selectedStatusLabel }}</div>
        </div>
        <div class="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/6 p-1">
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/16 bg-cyan-300/10 text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="activeRenderedItem.status !== 'ready'"
            aria-label="查看 MTF 曲线"
            @click="emit('openCurve')"
          >
            <AppIcon name="mtf" :size="16" />
          </button>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-slate-100 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!activeRenderedItem.mtfId"
            aria-label="复制 MTF ROI"
            @click="emit('copy')"
          >
            <AppIcon name="copy" :size="16" />
          </button>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/16 bg-red-400/10 text-red-100 transition hover:bg-red-400/18 disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!activeRenderedItem.mtfId"
            aria-label="删除 MTF ROI"
            @click="emit('clear')"
          >
            <AppIcon name="trash" :size="16" />
          </button>
        </div>
      </div>

      <div v-if="activeRenderedItem.status === 'ready'" class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px] leading-5">
        <template v-for="row in metricRows" :key="row.label">
          <div class="text-slate-400">{{ row.label }}</div>
          <div class="text-right font-medium text-slate-50">{{ row.value }}</div>
        </template>
      </div>

      <div v-else-if="activeRenderedItem.status === 'error'" class="mt-3 text-[12px] leading-5 text-red-100/90">
        {{ activeRenderedItem.errorMessage || '当前 ROI 的 MTF 分析未完成。' }}
      </div>

      <div v-else-if="activeRenderedItem.status === 'calculating'" class="mt-3 text-[12px] leading-5 text-slate-300">
        正在将当前 ROI 发送到后端，并等待返回 MTF 指标。
      </div>

      <div v-else class="mt-3 text-[12px] leading-5 text-slate-300">
        拖拽一个矩形 ROI 开始分析。当前视口可以保留多个 MTF ROI。
      </div>

    </div>
  </div>
</template>
