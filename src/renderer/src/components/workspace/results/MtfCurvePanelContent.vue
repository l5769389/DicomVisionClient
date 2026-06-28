<script setup lang="ts">
import { computed } from 'vue'
import type { ViewerMtfItem } from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const CHART_LEFT = 4
const CHART_RIGHT = 98
const CHART_TOP = 7
const CHART_BOTTOM = 90
const CHART_WIDTH = CHART_RIGHT - CHART_LEFT
const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP

const props = defineProps<{
  mtfItem: ViewerMtfItem | null
}>()

const emit = defineEmits<{
  copy: []
  delete: []
}>()

const { locale, overlayCopy } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const metrics = computed(() => props.mtfItem?.metrics ?? null)
const curve = computed(() => props.mtfItem?.curve ?? [])
const xAxisUnit = computed(() => metrics.value?.unit || 'lp/mm')
const xAxisLabel = computed(() => `${isZh.value ? '空间频率' : 'Spatial Frequency'} (${xAxisUnit.value})`)
const xMax = computed(() => Math.max(...curve.value.map((point) => point.frequency), 1))
const canUseSelectedMtf = computed(() => Boolean(props.mtfItem?.mtfId))

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
      color: 'var(--theme-accent-warm)',
      softColor: 'color-mix(in srgb, var(--theme-accent-warm) 16%, transparent)'
    },
    {
      key: 'mtf10',
      label: 'MTF10',
      frequency: metrics.value?.mtf10 ?? null,
      color: 'var(--theme-status-danger)',
      softColor: 'color-mix(in srgb, var(--theme-status-danger) 14%, transparent)'
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

function stripGuidePrefix(value: string, label: 'MTF50' | 'MTF10'): string {
  return value.replace(new RegExp(`^${label}\\s*`, 'i'), '').trim()
}

const guideRows = computed(() => [
  {
    key: 'mtf50',
    label: 'MTF50',
    text: stripGuidePrefix(overlayCopy.value.mtf50Guide, 'MTF50')
  },
  {
    key: 'mtf10',
    label: 'MTF10',
    text: stripGuidePrefix(overlayCopy.value.mtf10Guide, 'MTF10')
  }
])
</script>

<template>
  <div class="mtf-curve-panel-content">
    <div class="mtf-curve-panel-content__scroll">
      <section class="mtf-curve-panel-content__card">
        <div class="mtf-curve-panel-content__section-header">
          <div class="mtf-curve-panel-content__eyebrow">{{ overlayCopy.curvePlot }}</div>
          <div class="mtf-curve-panel-content__legend">
            <div
              v-for="marker in markerItems"
              :key="`${marker.key}-legend`"
              class="mtf-curve-panel-content__legend-item"
              :style="{ backgroundColor: marker.softColor }"
            >
              <span class="mtf-curve-panel-content__legend-dot" :style="{ backgroundColor: marker.color }" />
              <span>{{ marker.label }}</span>
            </div>
          </div>
        </div>

        <div class="mtf-curve-panel-content__chart">
          <svg viewBox="0 0 100 100" class="mtf-curve-panel-content__svg">
            <defs>
              <linearGradient id="mtf-result-area-fill" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stop-color="var(--theme-accent)" stop-opacity="0.22" />
                <stop offset="100%" stop-color="var(--theme-accent)" stop-opacity="0" />
              </linearGradient>
            </defs>

            <line :x1="CHART_LEFT" :y1="CHART_BOTTOM" :x2="CHART_RIGHT" :y2="CHART_BOTTOM" class="mtf-curve-panel-content__axis" />
            <line :x1="CHART_LEFT" :y1="CHART_BOTTOM" :x2="CHART_LEFT" :y2="CHART_TOP" class="mtf-curve-panel-content__axis" />
            <line :x1="CHART_LEFT" y1="50" :x2="CHART_RIGHT" y2="50" class="mtf-curve-panel-content__grid-line" />
            <line :x1="CHART_LEFT" :y1="CHART_TOP" :x2="CHART_RIGHT" :y2="CHART_TOP" class="mtf-curve-panel-content__grid-line" />
            <line x1="54" :y1="CHART_TOP" x2="54" :y2="CHART_BOTTOM" class="mtf-curve-panel-content__grid-line" />

            <text x="0.8" :y="CHART_BOTTOM + 3.8" class="mtf-curve-panel-content__tick">0</text>
            <text x="0.4" y="51.8" class="mtf-curve-panel-content__tick">0.5</text>
            <text x="0.4" :y="CHART_TOP + 2.8" class="mtf-curve-panel-content__tick">1.0</text>
            <text :x="CHART_LEFT" y="96.8" class="mtf-curve-panel-content__tick">0</text>
            <text :x="CHART_RIGHT" y="96.8" text-anchor="end" class="mtf-curve-panel-content__tick">{{ xMax.toFixed(3) }}</text>
            <text x="0.8" y="5.2" class="mtf-curve-panel-content__axis-label">MTF</text>
            <text x="60" y="99" class="mtf-curve-panel-content__axis-label">{{ xAxisLabel }}</text>

            <path
              v-if="chartPath"
              :d="`${chartPath} L ${CHART_RIGHT} ${CHART_BOTTOM} L ${CHART_LEFT} ${CHART_BOTTOM} Z`"
              fill="url(#mtf-result-area-fill)"
              stroke="none"
            />
            <path
              v-if="chartPath"
              :d="chartPath"
              fill="none"
              class="mtf-curve-panel-content__curve"
            />

            <g v-for="marker in markerItems" :key="marker.key">
              <line :x1="marker.x" :y1="CHART_BOTTOM" :x2="marker.x" :y2="marker.y" class="mtf-curve-panel-content__marker-line" :style="{ stroke: marker.color }" />
              <line :x1="CHART_LEFT" :y1="marker.y" :x2="marker.x" :y2="marker.y" class="mtf-curve-panel-content__marker-line" :style="{ stroke: marker.color }" />
              <circle :cx="marker.x" :cy="marker.y" r="2.15" :style="{ fill: marker.color }" />
            </g>
          </svg>
        </div>
      </section>

      <section class="mtf-curve-panel-content__card">
        <div class="mtf-curve-panel-content__eyebrow">{{ overlayCopy.keyMetrics }}</div>
        <div class="mtf-curve-panel-content__metrics">
          <div
            v-for="row in summaryRows"
            :key="row.label"
            class="mtf-curve-panel-content__metric"
          >
            <span>{{ row.label }}</span>
            <strong>{{ row.value }}</strong>
          </div>
        </div>
      </section>

      <section class="mtf-curve-panel-content__guide">
        <div class="mtf-curve-panel-content__eyebrow">{{ overlayCopy.readingGuide }}</div>
        <p>{{ overlayCopy.mtfGuideIntro }}</p>
        <div class="mtf-curve-panel-content__guide-rows">
          <div
            v-for="row in guideRows"
            :key="row.key"
            class="mtf-curve-panel-content__guide-row"
          >
            <span>{{ row.label }}</span>
            <p>{{ row.text }}</p>
          </div>
        </div>
      </section>
    </div>

    <div class="mtf-curve-panel-content__actions">
      <button
        type="button"
        class="mtf-curve-panel-content__action-button"
        :disabled="!canUseSelectedMtf"
        @click="emit('copy')"
      >
        {{ overlayCopy.copyMtfRoi }}
      </button>
      <button
        type="button"
        class="mtf-curve-panel-content__action-button mtf-curve-panel-content__action-button--danger"
        :disabled="!canUseSelectedMtf"
        @click="emit('delete')"
      >
        {{ overlayCopy.deleteMtfRoi }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.mtf-curve-panel-content {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  overflow: hidden;
  color: var(--theme-text-primary);
}

.mtf-curve-panel-content__scroll {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  align-content: start;
  gap: 10px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.mtf-curve-panel-content__card,
.mtf-curve-panel-content__guide {
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 6px 2px;
}

.mtf-curve-panel-content__section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.mtf-curve-panel-content__eyebrow {
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.mtf-curve-panel-content__legend {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
}

.mtf-curve-panel-content__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 999px;
  padding: 3px 7px;
  color: var(--theme-text-secondary);
  font-size: 10px;
  font-weight: 700;
}

.mtf-curve-panel-content__legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.mtf-curve-panel-content__chart {
  margin-top: 10px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--theme-accent) 12%, transparent), transparent 58%),
    color-mix(in srgb, var(--theme-surface-panel-strong-solid) 88%, transparent);
  padding: 0;
}

.mtf-curve-panel-content__svg {
  display: block;
  width: 100%;
  min-height: 226px;
  aspect-ratio: 1.2 / 1;
}

.mtf-curve-panel-content__axis {
  stroke: color-mix(in srgb, var(--theme-text-muted) 40%, transparent);
  stroke-width: 0.8;
}

.mtf-curve-panel-content__grid-line {
  stroke: color-mix(in srgb, var(--theme-accent) 14%, transparent);
  stroke-width: 0.6;
  stroke-dasharray: 2 2;
}

.mtf-curve-panel-content__tick,
.mtf-curve-panel-content__axis-label {
  fill: color-mix(in srgb, var(--theme-text-secondary) 84%, transparent);
  font-size: 4.1px;
  font-weight: 700;
}

.mtf-curve-panel-content__axis-label {
  fill: color-mix(in srgb, var(--theme-text-secondary) 74%, transparent);
}

.mtf-curve-panel-content__curve {
  stroke: var(--theme-accent);
  stroke-width: 2.15;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mtf-curve-panel-content__marker-line {
  stroke-width: 0.9;
  stroke-dasharray: 2 2;
}

.mtf-curve-panel-content__metrics {
  display: grid;
  gap: 7px;
  margin-top: 8px;
}

.mtf-curve-panel-content__metric {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 60%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 54%, transparent);
  padding: 8px 9px;
}

.mtf-curve-panel-content__metric span {
  min-width: 0;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.mtf-curve-panel-content__metric strong {
  flex: 0 0 auto;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 800;
}

.mtf-curve-panel-content__guide {
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.mtf-curve-panel-content__guide p {
  margin: 8px 0 0;
}

.mtf-curve-panel-content__guide-rows {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.mtf-curve-panel-content__guide-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}

.mtf-curve-panel-content__guide-row span {
  border: 1px solid color-mix(in srgb, var(--theme-accent) 28%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  padding: 3px 7px;
  color: var(--theme-text-primary);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.08em;
}

.mtf-curve-panel-content__guide-row p {
  margin: 2px 0 0;
}

.mtf-curve-panel-content__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  flex: 0 0 auto;
  margin-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  padding-top: 10px;
}

.mtf-curve-panel-content__action-button {
  min-height: 36px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 84%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 800;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.mtf-curve-panel-content__action-button:hover:not(:disabled) {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
}

.mtf-curve-panel-content__action-button--danger {
  border-color: color-mix(in srgb, var(--theme-status-danger) 28%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-status-danger) 10%, var(--theme-surface-card));
  color: var(--theme-status-danger-text);
}

.mtf-curve-panel-content__action-button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}
</style>
