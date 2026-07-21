<script setup lang="ts">
import { computed } from 'vue'
import type { MeasurementDraft } from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const props = defineProps<{
  measurement: MeasurementDraft | null
  viewportKey: string | null
}>()

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')

const toolLabelMap: Record<MeasurementDraft['toolType'], { zh: string; en: string }> = {
  line: { zh: '线段', en: 'Line' },
  rect: { zh: '矩形', en: 'Rectangle' },
  ellipse: { zh: '椭圆', en: 'Ellipse' },
  angle: { zh: '角度', en: 'Angle' },
  curve: { zh: '曲线', en: 'Curve' },
  freeform: { zh: '自由手绘', en: 'Freehand' }
}

const toolLabel = computed(() => {
  const toolType = props.measurement?.toolType
  if (!toolType) {
    return '-'
  }
  const labels = toolLabelMap[toolType]
  return isZh.value ? labels.zh : labels.en
})

const labelLines = computed(() => props.measurement?.labelLines?.filter((line) => line.trim()) ?? [])
const pointRows = computed(() =>
  (props.measurement?.points ?? []).map((point, index) => ({
    index: index + 1,
    x: point.x,
    y: point.y
  }))
)

const scopeLabel = computed(() => {
  const scope = props.measurement?.scope ?? 'image'
  if (isZh.value) {
    return scope === 'series' ? '整个序列' : '当前影像'
  }
  return scope === 'series' ? 'Series' : 'Current image'
})

function formatPointValue(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : '-'
}
</script>

<template>
  <div class="measurement-metrics-panel">
    <section class="measurement-metrics-panel__section">
      <div class="measurement-metrics-panel__eyebrow">
        {{ isZh ? '测量详情' : 'Measurement Metrics' }}
      </div>
      <dl class="measurement-metrics-panel__summary">
        <div>
          <dt>{{ isZh ? '工具' : 'Tool' }}</dt>
          <dd>{{ toolLabel }}</dd>
        </div>
        <div>
          <dt>{{ isZh ? '范围' : 'Scope' }}</dt>
          <dd>{{ scopeLabel }}</dd>
        </div>
        <div v-if="viewportKey">
          <dt>{{ isZh ? '视图' : 'Viewport' }}</dt>
          <dd>{{ viewportKey }}</dd>
        </div>
      </dl>
    </section>

    <section v-if="labelLines.length" class="measurement-metrics-panel__section">
      <div class="measurement-metrics-panel__eyebrow">
        {{ isZh ? '结果' : 'Result' }}
      </div>
      <div class="measurement-metrics-panel__values">
        <div
          v-for="line in labelLines"
          :key="line"
          class="measurement-metrics-panel__value"
        >
          {{ line }}
        </div>
      </div>
    </section>

    <section v-if="pointRows.length" class="measurement-metrics-panel__section">
      <div class="measurement-metrics-panel__eyebrow">
        {{ isZh ? '控制点' : 'Control Points' }}
      </div>
      <div class="measurement-metrics-panel__points">
        <div
          v-for="point in pointRows"
          :key="point.index"
          class="measurement-metrics-panel__point"
        >
          <span>P{{ point.index }}</span>
          <strong>X {{ formatPointValue(point.x) }}</strong>
          <strong>Y {{ formatPointValue(point.y) }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.measurement-metrics-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  color: var(--theme-text-primary);
}

.measurement-metrics-panel__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.measurement-metrics-panel__eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--theme-text-muted);
}

.measurement-metrics-panel__summary {
  display: grid;
  gap: 8px;
  margin: 0;
}

.measurement-metrics-panel__summary div,
.measurement-metrics-panel__point {
  display: grid;
  grid-template-columns: minmax(72px, 0.55fr) minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface-card) 58%, transparent);
  padding: 8px 10px;
}

.measurement-metrics-panel__summary dt {
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.measurement-metrics-panel__summary dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.measurement-metrics-panel__values,
.measurement-metrics-panel__points {
  display: grid;
  gap: 8px;
}

.measurement-metrics-panel__value {
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-accent) 11%, transparent);
  padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.35;
  color: var(--theme-text-primary);
}

.measurement-metrics-panel__point {
  grid-template-columns: 42px minmax(0, 1fr) minmax(0, 1fr);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.measurement-metrics-panel__point span {
  color: var(--theme-text-muted);
  font-weight: 800;
}

.measurement-metrics-panel__point strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
