<script setup lang="ts">
import { computed } from 'vue'
import { VCard, VMenu } from 'vuetify/components'
import type { ViewerMtfItem } from '../../../types/viewer'

const CHART_LEFT = 6
const CHART_RIGHT = 99
const CHART_TOP = 12
const CHART_BOTTOM = 88
const CHART_WIDTH = CHART_RIGHT - CHART_LEFT
const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP

const props = defineProps<{
  isOpen: boolean
  mtfItem: ViewerMtfItem | null
}>()

const emit = defineEmits<{
  close: []
}>()

const metrics = computed(() => props.mtfItem?.metrics ?? null)
const curve = computed(() => props.mtfItem?.curve ?? [])
const xAxisUnit = computed(() => metrics.value?.unit || 'lp/mm')
const xAxisLabel = computed(() => `Spatial Frequency (${xAxisUnit.value})`)
const xMax = computed(() => Math.max(...curve.value.map((point) => point.frequency), 1))

function normalizeX(frequency: number): number {
  return CHART_LEFT + (frequency / xMax.value) * CHART_WIDTH
}

function normalizeY(value: number): number {
  return CHART_BOTTOM - Math.max(0, Math.min(1, value)) * CHART_HEIGHT
}

const chartPath = computed(() => {
  if (!curve.value.length) {
    return ''
  }

  return curve.value
    .map((point, index) => {
      const x = normalizeX(point.frequency)
      const y = normalizeY(point.value)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
})

function findCurveY(targetFrequency: number | null | undefined): number | null {
  if (targetFrequency == null || !curve.value.length) {
    return null
  }

  const points = curve.value
  if (targetFrequency <= points[0].frequency) {
    return normalizeY(points[0].value)
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (targetFrequency <= current.frequency) {
      const delta = current.frequency - previous.frequency
      const ratio = delta > 0 ? (targetFrequency - previous.frequency) / delta : 0
      return normalizeY(previous.value + (current.value - previous.value) * ratio)
    }
  }

  return normalizeY(points[points.length - 1].value)
}

const markerItems = computed(() => {
  const candidates = [
    {
      key: 'mtf50',
      label: 'MTF50',
      frequency: metrics.value?.mtf50 ?? null,
      color: 'rgba(251,191,36,0.98)',
      softColor: 'rgba(251,191,36,0.18)'
    },
    {
      key: 'mtf10',
      label: 'MTF10',
      frequency: metrics.value?.mtf10 ?? null,
      color: 'rgba(248,113,113,0.98)',
      softColor: 'rgba(248,113,113,0.18)'
    }
  ]

  return candidates
    .map((item) => {
      if (item.frequency == null) {
        return null
      }

      const x = normalizeX(item.frequency)
      const y = findCurveY(item.frequency)
      if (y == null) {
        return null
      }

      return {
        ...item,
        x,
        y
      }
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
})

const summaryRows = computed(() => {
  const currentMetrics = metrics.value
  if (!currentMetrics) {
    return []
  }

  const frequencyUnit = currentMetrics.unit || 'lp/mm'
  const fwhmUnit = frequencyUnit === 'lp/mm' ? 'mm' : 'px'

  return [
    { label: 'MTF50', value: currentMetrics.mtf50 != null ? `${currentMetrics.mtf50.toFixed(3)} ${frequencyUnit}` : '-' },
    { label: 'MTF10', value: currentMetrics.mtf10 != null ? `${currentMetrics.mtf10.toFixed(3)} ${frequencyUnit}` : '-' },
    { label: 'FWHM-W', value: currentMetrics.fwhmW != null ? `${currentMetrics.fwhmW.toFixed(3)} ${fwhmUnit}` : '-' },
    { label: 'FWHM-H', value: currentMetrics.fwhmH != null ? `${currentMetrics.fwhmH.toFixed(3)} ${fwhmUnit}` : '-' }
  ]
})

const statusText = computed(() => {
  if (!curve.value.length) {
    return 'No curve data'
  }

  if (markerItems.value.length < 2) {
    return 'Curve markers are incomplete'
  }

  return 'Measured from the current ROI'
})
</script>

<template>
  <div
    v-if="isOpen"
    class="absolute inset-0 z-[30] grid place-items-center bg-[radial-gradient(circle_at_top,rgba(18,45,68,0.42),rgba(1,6,12,0.88)_58%)] px-4 py-5 backdrop-blur-[4px]"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-[790px] overflow-hidden rounded-[28px] border border-cyan-200/12 bg-[linear-gradient(135deg,rgba(4,14,25,0.985),rgba(2,8,16,0.99))] text-slate-100 shadow-[0_32px_80px_rgba(0,0,0,0.52)]">
      <div class="border-b border-white/8 bg-[linear-gradient(90deg,rgba(22,76,94,0.16),rgba(255,255,255,0.02))] px-5 py-3">
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <div class="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/68">MTF Curve</div>
            <div class="h-4 w-px bg-white/10" />
            <div class="truncate text-[13px] text-slate-400">{{ statusText }}</div>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-[20px] text-slate-200 transition hover:bg-white/12"
            aria-label="Close MTF curve"
            @click="emit('close')"
          >
            ×
          </button>
        </div>
      </div>

      <div class="grid gap-0 lg:grid-cols-[minmax(0,1.82fr)_minmax(260px,0.78fr)]">
        <section class="border-b border-white/8 p-4 lg:border-b-0 lg:border-r">
          <div class="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(8,25,39,0.96),rgba(5,14,24,0.98))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div class="flex items-center justify-between gap-4">
              <div>
                <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Curve Plot</div>
                <div class="mt-1 text-[13px] text-slate-300">Normalized MTF against spatial frequency</div>
              </div>
              <div class="flex flex-wrap justify-end gap-2">
                <div
                  v-for="marker in markerItems"
                  :key="`${marker.key}-legend`"
                  class="inline-flex items-center gap-2 rounded-full border border-white/8 px-3 py-1.5 text-[12px] text-slate-200"
                  :style="{ backgroundColor: marker.softColor }"
                >
                  <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: marker.color }" />
                  <span>{{ marker.label }}</span>
                </div>
              </div>
            </div>

            <div class="mt-3.5 overflow-hidden rounded-[20px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(14,48,71,0.24),rgba(3,10,18,1)_62%)] px-0 py-1">
              <svg viewBox="0 0 100 100" class="block aspect-[16/9.2] w-full">
                <defs>
                  <linearGradient id="mtf-area-fill" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stop-color="rgba(103,232,249,0.22)" />
                    <stop offset="100%" stop-color="rgba(103,232,249,0.01)" />
                  </linearGradient>
                </defs>

                <line :x1="CHART_LEFT" :y1="CHART_BOTTOM" :x2="CHART_RIGHT" :y2="CHART_BOTTOM" stroke="rgba(148,163,184,0.38)" stroke-width="0.8" />
                <line :x1="CHART_LEFT" :y1="CHART_BOTTOM" :x2="CHART_LEFT" :y2="CHART_TOP" stroke="rgba(148,163,184,0.38)" stroke-width="0.8" />

                <line :x1="CHART_LEFT" y1="50" :x2="CHART_RIGHT" y2="50" stroke="rgba(125,211,252,0.14)" stroke-width="0.6" stroke-dasharray="2 2" />
                <line :x1="CHART_LEFT" :y1="CHART_TOP" :x2="CHART_RIGHT" :y2="CHART_TOP" stroke="rgba(125,211,252,0.08)" stroke-width="0.6" stroke-dasharray="2 2" />
                <line x1="53.5" :y1="CHART_TOP" x2="53.5" :y2="CHART_BOTTOM" stroke="rgba(125,211,252,0.08)" stroke-width="0.6" stroke-dasharray="2 2" />

                <text x="2.2" :y="CHART_BOTTOM + 3.8" fill="rgba(148,163,184,0.84)" font-size="3.1">0</text>
                <text x="0.6" y="51.5" fill="rgba(148,163,184,0.84)" font-size="3.1">0.5</text>
                <text x="1.1" :y="CHART_TOP + 2.6" fill="rgba(148,163,184,0.84)" font-size="3.1">1.0</text>
                <text :x="CHART_LEFT" y="96.8" fill="rgba(148,163,184,0.84)" font-size="3.1">0</text>
                <text :x="CHART_RIGHT" y="96.8" text-anchor="end" fill="rgba(148,163,184,0.84)" font-size="3.1">{{ xMax.toFixed(3) }}</text>

                <text x="1.2" y="8" fill="rgba(148,163,184,0.74)" font-size="2.9">MTF</text>
                <text x="68" y="99" fill="rgba(148,163,184,0.74)" font-size="2.75">{{ xAxisLabel }}</text>

                <path
                  v-if="chartPath"
                  :d="`${chartPath} L ${CHART_RIGHT} ${CHART_BOTTOM} L ${CHART_LEFT} ${CHART_BOTTOM} Z`"
                  fill="url(#mtf-area-fill)"
                  stroke="none"
                />
                <path
                  v-if="chartPath"
                  :d="chartPath"
                  fill="none"
                  stroke="rgba(103,232,249,0.98)"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />

                <g v-for="marker in markerItems" :key="marker.key">
                  <line :x1="marker.x" :y1="CHART_BOTTOM" :x2="marker.x" :y2="marker.y" :stroke="marker.color" stroke-width="0.7" stroke-dasharray="2 2" />
                  <line :x1="CHART_LEFT" :y1="marker.y" :x2="marker.x" :y2="marker.y" :stroke="marker.color" stroke-width="0.7" stroke-dasharray="2 2" />
                  <circle :cx="marker.x" :cy="marker.y" r="1.65" :fill="marker.color" />
                </g>
              </svg>
            </div>
          </div>
        </section>

        <aside class="flex flex-col gap-2.5 p-4">
          <div class="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,22,36,0.94),rgba(6,14,24,0.98))] p-3.5">
            <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Key Metrics</div>
            <div class="mt-2.5 grid gap-2">
              <div
                v-for="row in summaryRows"
                :key="row.label"
                class="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2.5"
              >
                <span class="min-w-0 flex-1 text-[12px] font-medium uppercase tracking-[0.14em] text-slate-400">{{ row.label }}</span>
                <span class="shrink-0 text-sm font-semibold text-white">{{ row.value }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end">
            <VMenu location="top center" :offset="10">
              <template #activator="{ props: menuProps }">
                <button
                  v-bind="menuProps"
                  type="button"
                  class="rounded-2xl border border-cyan-300/14 bg-cyan-300/8 px-3 py-1.5 text-[12px] font-medium text-cyan-50 transition hover:bg-cyan-300/14"
                >
                  Reading Guide
                </button>
              </template>

              <VCard
                class="w-[320px] rounded-[22px] border border-cyan-200/12 bg-[linear-gradient(180deg,rgba(7,20,31,0.98),rgba(4,12,21,0.99))] p-4 text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.42)]"
              >
                <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Reading Guide</div>
                <div class="mt-3 text-sm leading-6 text-slate-300">
                  Higher curves indicate better retained contrast at finer spatial frequencies.
                </div>
                <div class="mt-3 text-sm leading-6 text-slate-300">
                  <span class="font-medium text-white">MTF50</span> reflects mid-contrast detail response.
                </div>
                <div class="mt-1 text-sm leading-6 text-slate-300">
                  <span class="font-medium text-white">MTF10</span> is often used as the limiting-resolution reference.
                </div>
              </VCard>
            </VMenu>
          </div>

          <div class="mt-auto flex justify-end pt-0.5">
            <button
              type="button"
              class="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/18"
              @click="emit('close')"
            >
              Close
            </button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
