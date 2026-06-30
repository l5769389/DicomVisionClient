<script setup lang="ts">
import { computed } from 'vue'
import type { QaWaterAnalysis } from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const props = defineProps<{
  analysis: QaWaterAnalysis | null
}>()

const { locale, overlayCopy } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')

function formatMetricValue(value: number, unit: string): string {
  return `${value.toFixed(2)} ${unit}`
}

function formatSizeValue(value: number, unit: string): string {
  return `${value.toFixed(1)} ${unit}`
}

const resultState = computed<'empty' | 'loading' | 'error' | 'ready'>(() => {
  if (!props.analysis) {
    return 'empty'
  }
  if (props.analysis.status === 'loading') {
    return 'loading'
  }
  if (props.analysis.status === 'error') {
    return 'error'
  }
  return 'ready'
})

function getQaErrorMessage(message: string | undefined): string {
  const fallback = overlayCopy.value.qaWaterFailed
  const trimmedMessage = message?.trim()
  if (!trimmedMessage) {
    return fallback
  }

  const normalizedMessage = trimmedMessage.toLowerCase()
  const isGenericQaFailure =
    normalizedMessage === 'water phantom qa analysis failed.' ||
    normalizedMessage === 'qa analysis failed.' ||
    normalizedMessage.includes('phantom') ||
    normalizedMessage.includes('roi') ||
    trimmedMessage.includes('水模') ||
    trimmedMessage.includes('自动识别') ||
    trimmedMessage.includes('检测失败')

  return isGenericQaFailure ? fallback : trimmedMessage
}

const stateLabel = computed(() => {
  switch (resultState.value) {
    case 'loading':
      return isZh.value ? '分析中' : 'Analyzing'
    case 'error':
      return isZh.value ? '失败' : 'Failed'
    case 'ready':
      return isZh.value ? '已生成' : 'Ready'
    default:
      return isZh.value ? '未生成' : 'No result'
  }
})

const stateMessage = computed(() => {
  if (resultState.value === 'loading') {
    return isZh.value ? '正在分析 QA...' : 'Analyzing QA...'
  }
  if (resultState.value === 'error') {
    return getQaErrorMessage(props.analysis?.message)
  }
  if (resultState.value === 'empty') {
    return isZh.value ? '暂无 QA 结果。' : 'No QA result yet.'
  }
  return ''
})

const metricRows = computed(() => {
  const metrics = props.analysis?.metrics
  if (!metrics) {
    return []
  }

  const rows: Array<{ key: string; label: string; value: string; detail: string }> = []
  if (metrics.accuracy) {
    rows.push({
      key: 'accuracy',
      label: overlayCopy.value.qaAccuracy,
      value: formatMetricValue(metrics.accuracy.deviationHu, metrics.accuracy.unit),
      detail: `${isZh.value ? '中心均值' : 'Center mean'} ${formatMetricValue(metrics.accuracy.centerMean, metrics.accuracy.unit)}`
    })
  }
  if (metrics.uniformity) {
    rows.push({
      key: 'uniformity',
      label: overlayCopy.value.qaUniformity,
      value: formatMetricValue(metrics.uniformity.maxDeviation, metrics.uniformity.unit),
      detail: `${isZh.value ? '中心均值' : 'Center mean'} ${formatMetricValue(metrics.uniformity.centerMean, metrics.uniformity.unit)}`
    })
  }
  if (metrics.noise) {
    rows.push({
      key: 'noise',
      label: overlayCopy.value.qaNoise,
      value: formatMetricValue(metrics.noise.stdDev, metrics.noise.unit),
      detail: isZh.value ? 'ROI 标准差' : 'ROI standard deviation'
    })
  }
  return rows
})

const roiSizeSummary = computed(() => {
  const firstRoi = props.analysis?.metrics?.uniformity?.roiStats[0]
  if (!firstRoi) {
    return []
  }

  return [
    {
      key: 'size',
      label: overlayCopy.value.roiSize,
      value: `${formatSizeValue(firstRoi.width, firstRoi.sizeUnit)} x ${formatSizeValue(firstRoi.height, firstRoi.sizeUnit)}`
    },
    {
      key: 'area',
      label: overlayCopy.value.roiArea,
      value: formatSizeValue(firstRoi.area, firstRoi.areaUnit)
    }
  ]
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
</script>

<template>
  <div class="qa-water-result-panel-content" :class="`qa-water-result-panel-content--${resultState}`">
    <section class="qa-water-result-panel-content__report" :aria-busy="resultState === 'loading'">
      <header class="qa-water-result-panel-content__header">
        <div>
          <div class="qa-water-result-panel-content__eyebrow">{{ isZh ? 'QA 报告' : 'QA Report' }}</div>
        </div>
        <span class="qa-water-result-panel-content__state">{{ stateLabel }}</span>
      </header>

      <div v-if="resultState !== 'ready'" class="qa-water-result-panel-content__message">
        <span v-if="resultState === 'loading'" class="qa-water-result-panel-content__spinner" />
        <span>{{ stateMessage }}</span>
      </div>

      <template v-if="resultState === 'ready'">
        <section class="qa-water-result-panel-content__section">
          <div class="qa-water-result-panel-content__section-title">{{ isZh ? '结果指标' : 'Metrics' }}</div>
          <table class="qa-water-result-panel-content__table">
            <tbody>
              <tr v-for="row in metricRows" :key="row.key">
                <th scope="row">
                  <span>{{ row.label }}</span>
                  <small>{{ row.detail }}</small>
                </th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="roiSizeSummary.length" class="qa-water-result-panel-content__section">
          <div class="qa-water-result-panel-content__section-title">{{ isZh ? 'ROI 概览' : 'ROI Summary' }}</div>
          <table class="qa-water-result-panel-content__table qa-water-result-panel-content__table--compact">
            <tbody>
              <tr v-for="row in roiSizeSummary" :key="row.key">
                <th scope="row">{{ row.label }}</th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="uniformityRoiRows.length" class="qa-water-result-panel-content__section">
          <div class="qa-water-result-panel-content__section-title">{{ isZh ? 'ROI 明细' : 'ROI Details' }}</div>
          <table class="qa-water-result-panel-content__table qa-water-result-panel-content__table--roi">
            <thead>
              <tr>
                <th scope="col">{{ overlayCopy.roi }}</th>
                <th scope="col">{{ overlayCopy.mean }}</th>
                <th scope="col">{{ overlayCopy.delta }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in uniformityRoiRows" :key="row.id">
                <th scope="row">{{ row.label }}</th>
                <td>{{ row.mean }}</td>
                <td>{{ row.deviation }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>

      <div v-else class="qa-water-result-panel-content__placeholder">
        <div class="qa-water-result-panel-content__placeholder-line" />
        <div class="qa-water-result-panel-content__placeholder-line qa-water-result-panel-content__placeholder-line--short" />
        <div class="qa-water-result-panel-content__placeholder-grid">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.qa-water-result-panel-content {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  color: var(--theme-text-primary);
}

.qa-water-result-panel-content__report {
  display: flex;
  min-height: 420px;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.qa-water-result-panel-content__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  padding: 12px;
}

.qa-water-result-panel-content__eyebrow,
.qa-water-result-panel-content__section-title {
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.qa-water-result-panel-content__state {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 26%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  padding: 4px 9px;
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 800;
}

.qa-water-result-panel-content--error .qa-water-result-panel-content__state {
  border-color: color-mix(in srgb, var(--theme-status-danger) 36%, transparent);
  background: color-mix(in srgb, var(--theme-status-danger) 12%, transparent);
  color: var(--theme-status-danger-text);
}

.qa-water-result-panel-content__message {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 56%, transparent);
  padding: 10px 12px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.qa-water-result-panel-content__spinner {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  border: 2px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
  border-top-color: var(--theme-accent);
  border-radius: 999px;
  animation: qa-water-spin 850ms linear infinite;
}

.qa-water-result-panel-content__section {
  flex: 0 0 auto;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 56%, transparent);
  padding: 11px 12px;
}

.qa-water-result-panel-content__section:last-child {
  border-bottom: 0;
}

.qa-water-result-panel-content__section-title {
  margin-bottom: 7px;
}

.qa-water-result-panel-content__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
}

.qa-water-result-panel-content__table th,
.qa-water-result-panel-content__table td {
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 50%, transparent);
  padding: 8px 0;
  vertical-align: top;
}

.qa-water-result-panel-content__table tr:first-child th,
.qa-water-result-panel-content__table tr:first-child td {
  border-top: 0;
}

.qa-water-result-panel-content__table th {
  color: var(--theme-text-secondary);
  font-weight: 700;
  text-align: left;
}

.qa-water-result-panel-content__table th span {
  display: block;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 850;
}

.qa-water-result-panel-content__table th small {
  display: block;
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 650;
}

.qa-water-result-panel-content__table td {
  color: var(--theme-text-primary);
  font-weight: 850;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.qa-water-result-panel-content__table--compact th {
  width: 50%;
}

.qa-water-result-panel-content__table--roi th,
.qa-water-result-panel-content__table--roi td {
  padding: 6px 0;
}

.qa-water-result-panel-content__table--roi thead th {
  border-top: 0;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.qa-water-result-panel-content__table--roi th:nth-child(n + 2),
.qa-water-result-panel-content__table--roi td {
  text-align: right;
}

.qa-water-result-panel-content__placeholder {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  padding: 14px 12px;
}

.qa-water-result-panel-content__placeholder-line,
.qa-water-result-panel-content__placeholder-grid span {
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-primary) 8%, transparent);
}

.qa-water-result-panel-content__placeholder-line {
  width: 72%;
  height: 10px;
}

.qa-water-result-panel-content__placeholder-line--short {
  width: 46%;
}

.qa-water-result-panel-content__placeholder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-top: 8px;
}

.qa-water-result-panel-content__placeholder-grid span {
  height: 38px;
  border-radius: 10px;
}

@keyframes qa-water-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
