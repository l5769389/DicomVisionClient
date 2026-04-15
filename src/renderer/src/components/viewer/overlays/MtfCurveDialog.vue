<script setup lang="ts">
import { computed } from 'vue'
import type { ViewerMtfItem } from '../../../types/viewer'

const props = defineProps<{
  isOpen: boolean
  mtfItem: ViewerMtfItem | null
}>()

const emit = defineEmits<{
  clear: []
  close: []
}>()

const chartPoints = computed(() => {
  const curve = props.mtfItem?.curve ?? []
  if (!curve.length) {
    return ''
  }

  const maxFrequency = Math.max(...curve.map((point) => point.frequency), 1)
  return curve
    .map((point, index) => {
      const x = (point.frequency / maxFrequency) * 100
      const y = 100 - Math.max(0, Math.min(100, point.value * 100))
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
})

const metrics = computed(() => props.mtfItem?.metrics ?? null)
</script>

<template>
  <div
    v-if="isOpen"
    class="absolute inset-0 z-[30] grid place-items-center bg-[rgba(1,6,12,0.64)] px-6 py-8 backdrop-blur-[2px]"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-3xl rounded-[28px] border border-cyan-200/16 bg-[linear-gradient(180deg,rgba(5,13,23,0.98),rgba(3,9,17,0.98))] p-6 text-slate-100 shadow-[0_28px_60px_rgba(0,0,0,0.42)]">
      <div class="flex items-start justify-between gap-6">
        <div>
          <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">MTF Curve</div>
          <div class="mt-1 text-2xl font-semibold text-white">空间频率响应</div>
        </div>
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-200 transition hover:bg-white/12"
          aria-label="关闭 MTF 曲线"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div class="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(7,19,33,0.9),rgba(4,11,20,0.96))] p-4">
          <div class="mb-3 flex items-center justify-between text-[12px] text-slate-400">
            <span>归一化响应</span>
            <span>空间频率</span>
          </div>
          <div class="relative overflow-hidden rounded-2xl border border-white/6 bg-[linear-gradient(180deg,rgba(4,10,18,0.96),rgba(2,7,14,1))]">
            <svg viewBox="0 0 100 100" class="block aspect-[16/9] w-full">
              <line x1="8" y1="92" x2="96" y2="92" stroke="rgba(148,163,184,0.35)" stroke-width="0.8" />
              <line x1="8" y1="92" x2="8" y2="8" stroke="rgba(148,163,184,0.35)" stroke-width="0.8" />
              <line x1="8" y1="50" x2="96" y2="50" stroke="rgba(103,232,249,0.16)" stroke-width="0.6" stroke-dasharray="2 2" />
              <line x1="50" y1="92" x2="50" y2="8" stroke="rgba(103,232,249,0.12)" stroke-width="0.6" stroke-dasharray="2 2" />
              <path
                v-if="chartPoints"
                :d="chartPoints"
                transform="translate(8,0) scale(0.88,0.84)"
                fill="none"
                stroke="rgba(103,232,249,0.98)"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>

        <div class="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,17,30,0.96),rgba(5,11,20,0.98))] p-4">
          <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">结果摘要</div>
          <div class="mt-4 space-y-3 text-sm leading-6">
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-400">MTF50</span>
              <span class="font-medium text-white">
                {{ metrics?.mtf50 != null ? `${metrics.mtf50.toFixed(3)} ${metrics.unit || 'lp/mm'}` : '-' }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-400">MTF10</span>
              <span class="font-medium text-white">
                {{ metrics?.mtf10 != null ? `${metrics.mtf10.toFixed(3)} ${metrics.unit || 'lp/mm'}` : '-' }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-400">Peak</span>
              <span class="font-medium text-white">{{ metrics?.peakValue != null ? metrics.peakValue.toFixed(3) : '-' }}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-400">Samples</span>
              <span class="font-medium text-white">{{ metrics?.sampleCount != null ? metrics.sampleCount : '-' }}</span>
            </div>
            <div class="rounded-2xl border border-amber-300/12 bg-amber-300/8 px-3 py-2 text-[12px] leading-5 text-amber-50/90">
              当前链路已打通，后端返回的是占位 MTF 结果，后续可替换为真实计算。
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-xl border border-red-300/16 bg-red-400/10 px-3 py-2 text-sm text-red-100 transition hover:bg-red-400/18"
              @click="emit('clear')"
            >
              删除 ROI
            </button>
            <button
              type="button"
              class="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-50 transition hover:bg-cyan-300/18"
              @click="emit('close')"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
