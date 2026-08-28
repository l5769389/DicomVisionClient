<script setup lang="ts">
import { computed } from 'vue'
import type { ViewerMtfItem } from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import DockInfoPopover from '../shell/DockInfoPopover.vue'

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
const status = computed(() => props.mtfItem?.status ?? null)
const isReady = computed(() => status.value === 'ready')
const xAxisUnit = computed(() => metrics.value?.unit || 'lp/mm')
const xAxisLabel = computed(() => `${isZh.value ? '空间频率' : 'Spatial Frequency'} (${xAxisUnit.value})`)
const xMax = computed(() => {
  const maximum = Math.max(...curve.value.map((point) => point.frequency).filter(Number.isFinite), 0)
  return maximum > 0 ? maximum : 1
})
const yMax = computed(() => Math.max(...curve.value.map((point) => point.value), 1))
const canUseSelectedMtf = computed(() => Boolean(props.mtfItem?.mtfId))

function normalizeX(frequency: number): number {
  return CHART_LEFT + (frequency / xMax.value) * CHART_WIDTH
}

function normalizeY(value: number): number {
  return CHART_BOTTOM - (Math.max(0, value) / yMax.value) * CHART_HEIGHT
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

const metricPresentation = computed(() => {
  const currentMetrics = metrics.value
  if (!currentMetrics) {
    return null
  }

  const frequencyUnit = currentMetrics.unit || 'lp/mm'
  const fwhmUnit = frequencyUnit === 'lp/mm' ? 'mm' : 'px'

  const warningCodes = new Set((props.mtfItem?.qualityWarnings ?? []).map((warning) => warning.code))
  const unavailable = isZh.value ? '不可测' : 'Not measurable'
  const formatFrequency = (value: number | null | undefined, nyquist: number | null | undefined, warningCode: string) => {
    if (value != null) {
      return `${value.toFixed(3)} ${frequencyUnit}`
    }
    if (nyquist != null && warningCodes.has(warningCode)) {
      return `> ${nyquist.toFixed(3)} ${frequencyUnit}`
    }
    return unavailable
  }

  return {
    radial: [
      {
        label: 'MTF50',
        value: formatFrequency(currentMetrics.mtf50, currentMetrics.radialNyquist, 'mtf50-beyond-nyquist')
      },
      {
        label: 'MTF10',
        value: formatFrequency(currentMetrics.mtf10, currentMetrics.radialNyquist, 'mtf10-beyond-nyquist')
      }
    ],
    directional: [
      {
        label: 'MTF50',
        w: formatFrequency(currentMetrics.mtf50W, currentMetrics.nyquistW, 'mtf50-w-beyond-nyquist'),
        h: formatFrequency(currentMetrics.mtf50H, currentMetrics.nyquistH, 'mtf50-h-beyond-nyquist')
      },
      {
        label: 'MTF10',
        w: formatFrequency(currentMetrics.mtf10W, currentMetrics.nyquistW, 'mtf10-w-beyond-nyquist'),
        h: formatFrequency(currentMetrics.mtf10H, currentMetrics.nyquistH, 'mtf10-h-beyond-nyquist')
      },
      {
        label: 'FWHM',
        w: currentMetrics.fwhmW != null ? `${currentMetrics.fwhmW.toFixed(3)} ${fwhmUnit}` : unavailable,
        h: currentMetrics.fwhmH != null ? `${currentMetrics.fwhmH.toFixed(3)} ${fwhmUnit}` : unavailable
      }
    ]
  }
})

const directionalAssessment = computed(() => {
  const w = metrics.value?.mtf50W
  const h = metrics.value?.mtf50H
  if (w == null || h == null || w <= 0 || h <= 0) {
    return null
  }

  const ratio = Math.max(w, h) / Math.min(w, h)
  if (ratio < 2) {
    return null
  }

  return isZh.value
    ? `W/H 方向的 MTF50 相差 ${ratio.toFixed(1)} 倍，请检查点源是否完整、近似圆形且 ROI 四周留有背景。`
    : `W/H MTF50 differs by ${ratio.toFixed(1)}x. Check that the point source is complete, approximately round, and surrounded by background.`
})

const warningRows = computed(() => {
  const translations: Record<string, string> = {
    'source-size-uncorrected': '未进行有限点源尺寸修正，结果为实测点源 MTF。',
    'roi-auto-expanded': '所选 ROI 小于 9 × 9 像素，分析时已围绕其中心自动补足最小范围。',
    'unstable-dc-fallback': '有符号点扩散函数的零频响应不稳定，已使用峰值连通的正信号分量完成低置信度计算。',
    'roi-small': 'ROI 小于 21 × 21 像素，频率估计可能不稳定。',
    'point-near-roi-edge': '点源距离 ROI 边缘过近，可能没有包含完整 PSF。',
    'fwhm-w-incomplete': 'FWHM-W 的两个半高交点未完整落在 ROI 内。',
    'fwhm-h-incomplete': 'FWHM-H 的两个半高交点未完整落在 ROI 内。',
    'low-snr': '点源信噪比较低，建议使用更大或背景更干净的 ROI。',
    'nonuniform-background': 'ROI 背景不均匀，结果可能受到背景趋势影响。',
    'mtf50-beyond-nyquist': '径向 MTF50 高于 Nyquist，无法给出精确值。',
    'mtf10-beyond-nyquist': '径向 MTF10 高于 Nyquist，无法给出精确值。',
    'mtf50-w-beyond-nyquist': 'MTF50-W 高于 Nyquist，无法给出精确值。',
    'mtf10-w-beyond-nyquist': 'MTF10-W 高于 Nyquist，无法给出精确值。',
    'mtf50-h-beyond-nyquist': 'MTF50-H 高于 Nyquist，无法给出精确值。',
    'mtf10-h-beyond-nyquist': 'MTF10-H 高于 Nyquist，无法给出精确值。'
  }
  const rows = (props.mtfItem?.qualityWarnings ?? []).map((warning) => ({
    code: warning.code,
    message: isZh.value ? (translations[warning.code] ?? warning.message) : warning.message
  }))
  if (metrics.value && metrics.value.sourceSizeCorrected === false && !rows.some((row) => row.code === 'source-size-uncorrected')) {
    rows.unshift({
      code: 'source-size-uncorrected',
      message: isZh.value
        ? translations['source-size-uncorrected']
        : 'Finite point-source size correction was not applied; this is a measured point-source MTF.'
    })
  }
  return rows
})

const errorTitle = computed(() => isZh.value ? 'MTF 分析失败' : 'MTF analysis failed')
const errorMessage = computed(() =>
  props.mtfItem?.errorMessage?.trim() || (isZh.value ? '当前 ROI 无法完成 MTF 分析。' : 'The current ROI could not be analyzed.')
)
const errorSuggestion = computed(() =>
  props.mtfItem?.errorSuggestion?.trim() || (
    isZh.value
      ? '请重新框选完整点源，并在四周保留足够的背景区域。'
      : 'Draw a new ROI around the complete point source with sufficient background margin.'
  )
)

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
const readingGuideText = computed(() => [
  overlayCopy.value.mtfGuideIntro,
  ...guideRows.value.map((row) => `${row.label}: ${row.text}`)
].join('\n'))
</script>

<template>
  <div class="mtf-curve-panel-content">
    <div class="mtf-curve-panel-content__scroll">
      <section v-if="status === 'calculating'" class="mtf-curve-panel-content__state" aria-live="polite">
        <span class="mtf-curve-panel-content__spinner" aria-hidden="true" />
        <div>
          <strong>{{ overlayCopy.mtfCalculating }}</strong>
          <p>{{ overlayCopy.mtfSubmitting }}</p>
        </div>
      </section>

      <section v-else-if="status === 'error'" class="mtf-curve-panel-content__state mtf-curve-panel-content__state--error" role="alert">
        <div class="mtf-curve-panel-content__eyebrow">{{ errorTitle }}</div>
        <strong>{{ errorMessage }}</strong>
        <p>{{ errorSuggestion }}</p>
        <code v-if="mtfItem?.errorCode">{{ mtfItem.errorCode }}</code>
      </section>

      <section v-if="isReady" class="mtf-curve-panel-content__card">
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
            <line :x1="CHART_LEFT" :y1="normalizeY(0.5)" :x2="CHART_RIGHT" :y2="normalizeY(0.5)" class="mtf-curve-panel-content__grid-line" />
            <line :x1="CHART_LEFT" :y1="CHART_TOP" :x2="CHART_RIGHT" :y2="CHART_TOP" class="mtf-curve-panel-content__grid-line" />
            <line x1="54" :y1="CHART_TOP" x2="54" :y2="CHART_BOTTOM" class="mtf-curve-panel-content__grid-line" />

            <text x="0.8" :y="CHART_BOTTOM + 3.8" class="mtf-curve-panel-content__tick">0</text>
            <text x="0.4" :y="normalizeY(0.5) + 1.8" class="mtf-curve-panel-content__tick">0.5</text>
            <text x="0.4" :y="CHART_TOP + 2.8" class="mtf-curve-panel-content__tick">{{ yMax.toFixed(1) }}</text>
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

      <section v-if="isReady && metricPresentation" class="mtf-curve-panel-content__card mtf-curve-panel-content__card--metrics">
        <div class="mtf-curve-panel-content__section-header">
          <div class="mtf-curve-panel-content__eyebrow">{{ overlayCopy.keyMetrics }}</div>
          <div class="mtf-curve-panel-content__guide-heading">
            <span>{{ overlayCopy.readingGuide }}</span>
            <DockInfoPopover :text="readingGuideText" />
          </div>
        </div>

        <div class="mtf-curve-panel-content__radial" :aria-label="isZh ? '径向指标' : 'Radial metrics'">
          <div
            v-for="row in metricPresentation.radial"
            :key="row.label"
            class="mtf-curve-panel-content__radial-metric"
          >
            <span>{{ row.label }} <small>{{ isZh ? '径向' : 'Radial' }}</small></span>
            <strong>{{ row.value }}</strong>
          </div>
        </div>

        <div class="mtf-curve-panel-content__direction-table" role="table" :aria-label="isZh ? '方向指标对照' : 'Directional metric comparison'">
          <div class="mtf-curve-panel-content__direction-row mtf-curve-panel-content__direction-row--header" role="row">
            <span role="columnheader">{{ isZh ? '指标' : 'Metric' }}</span>
            <span role="columnheader">W</span>
            <span role="columnheader">H</span>
          </div>
          <div
            v-for="row in metricPresentation.directional"
            :key="row.label"
            class="mtf-curve-panel-content__direction-row"
            role="row"
          >
            <strong role="rowheader">{{ row.label }}</strong>
            <span role="cell">{{ row.w }}</span>
            <span role="cell">{{ row.h }}</span>
          </div>
        </div>

        <p v-if="directionalAssessment" class="mtf-curve-panel-content__direction-warning" role="status">
          {{ directionalAssessment }}
        </p>
      </section>

      <details v-if="isReady && warningRows.length" class="mtf-curve-panel-content__warnings">
        <summary>
          <span>{{ isZh ? '质量提示' : 'Quality Notes' }}</span>
          <strong>{{ warningRows.length }}</strong>
        </summary>
        <ul>
          <li v-for="warning in warningRows" :key="warning.code">{{ warning.message }}</li>
        </ul>
      </details>
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
  width: 100%;
  height: 100%;
  min-height: 0;
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
  overscroll-behavior: contain;
  padding-right: 2px;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.mtf-curve-panel-content__card {
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 6px 2px;
}

.mtf-curve-panel-content__state {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-left: 2px solid var(--theme-accent);
  background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
  padding: 12px;
}

.mtf-curve-panel-content__state strong {
  display: block;
  color: var(--theme-text-primary);
  font-size: 13px;
}

.mtf-curve-panel-content__state p {
  margin: 6px 0 0;
  color: var(--theme-text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.mtf-curve-panel-content__state code {
  display: block;
  margin-top: 8px;
  color: var(--theme-text-muted);
  font-size: 10px;
}

.mtf-curve-panel-content__state--error {
  display: block;
  border-left-color: var(--theme-status-danger);
  background: color-mix(in srgb, var(--theme-status-danger) 8%, transparent);
}

.mtf-curve-panel-content__state--error strong {
  margin-top: 7px;
  color: var(--theme-status-danger-text);
}

.mtf-curve-panel-content__spinner {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  margin-top: 1px;
  border: 2px solid color-mix(in srgb, var(--theme-accent) 24%, transparent);
  border-top-color: var(--theme-accent);
  border-radius: 999px;
  animation: mtf-panel-spin 800ms linear infinite;
}

@keyframes mtf-panel-spin {
  to {
    transform: rotate(360deg);
  }
}

.mtf-curve-panel-content__warnings {
  border-left: 2px solid var(--theme-status-warning, #d8a13a);
  background: color-mix(in srgb, var(--theme-status-warning, #d8a13a) 8%, transparent);
  padding: 0 10px;
}

.mtf-curve-panel-content__warnings summary {
  display: flex;
  min-height: 38px;
  cursor: pointer;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 800;
  list-style: none;
}

.mtf-curve-panel-content__warnings summary::-webkit-details-marker {
  display: none;
}

.mtf-curve-panel-content__warnings summary strong {
  display: grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-status-warning, #d8a13a) 16%, transparent);
  color: var(--theme-status-warning-text, #f3c96f);
  font-size: 10px;
}

.mtf-curve-panel-content__warnings ul {
  display: grid;
  gap: 5px;
  margin: 0 0 10px;
  padding-left: 17px;
  color: var(--theme-text-secondary);
  font-size: 11px;
  line-height: 1.45;
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
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 88%, transparent);
  padding: 0;
}

.mtf-curve-panel-content__svg {
  display: block;
  width: 100%;
  height: clamp(158px, 22vh, 208px);
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

.mtf-curve-panel-content__card--metrics {
  display: grid;
  gap: 8px;
}

.mtf-curve-panel-content__radial {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.mtf-curve-panel-content__radial-metric {
  display: grid;
  min-width: 0;
  gap: 5px;
  border-left: 2px solid color-mix(in srgb, var(--theme-accent) 72%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card-soft) 42%, transparent);
  padding: 7px 8px;
}

.mtf-curve-panel-content__radial-metric span {
  min-width: 0;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
}

.mtf-curve-panel-content__radial-metric small {
  color: var(--theme-text-muted);
  font-size: 9px;
  font-weight: 650;
}

.mtf-curve-panel-content__radial-metric strong {
  min-width: 0;
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.mtf-curve-panel-content__direction-table {
  min-width: 0;
  overflow: hidden;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 68%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 68%, transparent);
}

.mtf-curve-panel-content__direction-row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(50px, 0.7fr) repeat(2, minmax(0, 1.35fr));
  align-items: center;
  gap: 6px;
  min-height: 34px;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 44%, transparent);
  padding: 5px 4px;
}

.mtf-curve-panel-content__direction-row:first-child {
  border-top: 0;
}

.mtf-curve-panel-content__direction-row--header {
  min-height: 27px;
  color: var(--theme-text-muted);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.mtf-curve-panel-content__direction-row--header span:not(:first-child) {
  text-align: right;
}

.mtf-curve-panel-content__direction-row strong {
  color: var(--theme-text-secondary);
  font-size: 10px;
  font-weight: 800;
}

.mtf-curve-panel-content__direction-row span[role='cell'] {
  min-width: 0;
  color: var(--theme-text-primary);
  font-size: 10px;
  font-weight: 750;
  line-height: 1.25;
  overflow-wrap: anywhere;
  text-align: right;
}

.mtf-curve-panel-content__direction-warning {
  margin: 0;
  border-left: 2px solid var(--theme-status-warning, #d8a13a);
  background: color-mix(in srgb, var(--theme-status-warning, #d8a13a) 7%, transparent);
  padding: 7px 8px;
  color: var(--theme-text-secondary);
  font-size: 10px;
  line-height: 1.45;
}

.mtf-curve-panel-content__guide-heading {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--theme-text-muted);
  font-size: 9px;
  font-weight: 750;
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
