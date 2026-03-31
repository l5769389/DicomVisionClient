<script setup lang="ts">
import { computed } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import type { ViewerTabItem } from '../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
}>()

const emit = defineEmits<{
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number }]
}>()

const sliceInfo = computed(() => {
  const raw = props.activeTab.sliceLabel.trim()
  const match = raw.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return { current: 1, total: 1 }
  }

  const current = Number(match[1])
  const total = Number(match[2])
  return {
    current: Number.isFinite(current) && current > 0 ? current : 1,
    total: Number.isFinite(total) && total > 0 ? total : 1
  }
})

function handleSliceSliderInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const nextValue = Number(target.value)
  const delta = nextValue - sliceInfo.value.current
  if (!Number.isFinite(delta) || delta === 0) {
    return
  }

  emit('viewportWheel', {
    viewportKey: 'single',
    deltaY: delta
  })
}
</script>

<template>
  <div class="viewer-layout viewer-layout--stack grid h-full w-full grid-cols-[minmax(0,1fr)_34px] gap-2">
    <ViewerCanvasStage
      class="min-w-0"
      viewport-key="single"
      viewport-class="grid place-items-center"
      :is-active="true"
      :render-surface-active="true"
      :image-src="props.activeTab.imageSrc"
      :is-loading="Boolean(props.activeTab.viewId) && !props.activeTab.imageSrc"
      loading-label="正在加载栈视图..."
      :alt="props.activeTab.viewType"
      placeholder="单视口预览"
      :corner-info="props.activeTab.cornerInfo"
      :orientation="props.activeTab.orientation"
      @click-viewport="emit('viewportClick', $event)"
      @wheel-viewport="emit('viewportWheel', $event)"
      @pointer-down="emit('pointerDown', $event, 'single')"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
    />

    <div class="flex min-h-0 flex-col items-center rounded-xl border border-white/8 bg-[linear-gradient(180deg,rgba(10,18,31,0.94),rgba(7,13,24,0.98))] px-1.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Slice</span>
      <span class="mt-1 text-[10px] font-semibold text-slate-500">1</span>
      <div class="my-2 flex min-h-0 flex-1 items-center">
        <input
          class="stack-slice-slider h-full w-3.5 cursor-pointer accent-sky-300"
          type="range"
          min="1"
          :max="sliceInfo.total"
          :value="sliceInfo.current"
          orient="vertical"
          aria-label="切换切片"
          @input="handleSliceSliderInput"
        />
      </div>
      <span class="text-[10px] font-semibold text-slate-500">{{ sliceInfo.total }}</span>
    </div>
  </div>
</template>

<style scoped>
.stack-slice-slider {
  appearance: slider-vertical;
  writing-mode: bt-lr;
  transform: rotate(180deg);
}
</style>
