<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  CompareStackPaneKey,
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementOverlay,
  ViewerTabItem
} from '../../../types/viewer'
import {
  COMPARE_STACK_PANE_KEYS,
  COMPARE_STACK_SOURCE_PANE_KEY,
  createComparePaneRecord
} from '../../../composables/workspace/views/viewerWorkspaceTabs'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeOperation: string
  activeViewportKey: string
  getAnnotations: (viewportKey: string) => AnnotationOverlay[]
  getCursorClass: (viewportKey: string) => string
  getDraftAnnotation: (viewportKey: string) => AnnotationDraft | null
  getDraftMeasurementMode: (viewportKey: string) => DraftMeasurementMode | null
  getDraftMeasurement: (viewportKey: string) => MeasurementDraft | null
  getMeasurements: (viewportKey: string) => MeasurementOverlay[]
  getStarredSliceCount?: (seriesId: string) => number
  isSliceStarred?: (seriesId: string, sliceIndex: number) => boolean
}>()

const { locale, viewerCopy } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const compareLoadingLabel = computed(() => (isZh.value ? '正在加载对比视图...' : 'Loading compare view...'))
const comparePlaceholder = computed(() => (isZh.value ? 'Stack 对比预览' : 'Stack compare preview'))
const compareSliceLabel = computed(() => (isZh.value ? '切换对比切片' : 'Change compare slice'))
const syncedCompareSliceLabel = computed(() => (isZh.value ? '切换同步对比切片' : 'Change synced compare slice'))

const emit = defineEmits<{
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  imageLoaded: [viewportKey: string]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  toggleSliceStar: [payload: { viewportKey: string; seriesId: string; sliceIndex: number }]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
}>()

interface ComparePaneView {
  key: CompareStackPaneKey
  badge: string
  seriesId: string
  title: string
  imageSrc: string
  sliceLabel: string
}

interface SliceInfo {
  current: number
  total: number
}

const sliderValues = ref<Record<CompareStackPaneKey, number>>(createComparePaneRecord(() => 1))
const activeSliderKeys = ref<Record<CompareStackPaneKey, boolean>>(createComparePaneRecord(() => false))

const panes = computed<ComparePaneView[]>(() =>
  COMPARE_STACK_PANE_KEYS.map((key, index) => ({
    key,
    badge: index === 0 ? 'A' : 'B',
    seriesId: props.activeTab.compareSeriesIds?.[key] ?? (index === 0 ? props.activeTab.seriesId : ''),
    title: props.activeTab.compareSeriesTitles?.[key] || (index === 0 ? props.activeTab.seriesTitle : 'Compare Series'),
    imageSrc: props.activeTab.compareImages?.[key] ?? '',
    sliceLabel: props.activeTab.compareSliceLabels?.[key] ?? ''
  }))
)

function parseSliceInfo(sliceLabel: string): SliceInfo {
  const match = sliceLabel.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return { current: 1, total: 1 }
  }

  const current = Number(match[1])
  const total = Number(match[2])
  return {
    current: Number.isFinite(current) && current > 0 ? current : 1,
    total: Number.isFinite(total) && total > 0 ? total : 1
  }
}

const sliceInfos = computed<Record<CompareStackPaneKey, SliceInfo>>(() =>
  createComparePaneRecord((paneKey) => parseSliceInfo(props.activeTab.compareSliceLabels?.[paneKey] ?? ''))
)

const isScrollSynced = computed(() => props.activeTab.compareSyncScroll !== false)
const syncedSliderPane = computed(() => panes.value[0] ?? null)
const syncedSliceInfo = computed(() => sliceInfos.value[COMPARE_STACK_SOURCE_PANE_KEY])

function clampSliceValue(value: number, total: number): number {
  return Math.min(Math.max(value, 1), total)
}

function syncInactiveSliderValues(values = sliceInfos.value): void {
  COMPARE_STACK_PANE_KEYS.forEach((key) => {
    if (!activeSliderKeys.value[key]) {
      sliderValues.value[key] = clampSliceValue(values[key].current, values[key].total)
    }
  })
}

watch(sliceInfos, (values) => syncInactiveSliderValues(values), { immediate: true })

watch(
  () => props.activeTab.key,
  () => {
    activeSliderKeys.value = createComparePaneRecord(() => false)
    syncInactiveSliderValues()
  }
)

function beginSliceSliderDrag(paneKey: CompareStackPaneKey): void {
  activeSliderKeys.value[paneKey] = true
}

function endSliceSliderDrag(paneKey: CompareStackPaneKey): void {
  const sliceInfo = sliceInfos.value[paneKey]
  sliderValues.value[paneKey] = clampSliceValue(sliderValues.value[paneKey], sliceInfo.total)
  activeSliderKeys.value[paneKey] = false
}

function handleSliceSliderInput(event: Event, pane: ComparePaneView): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  beginSliceSliderDrag(pane.key)
  const rawValue = Number(target.value)
  if (!Number.isFinite(rawValue)) {
    return
  }
  const sliceInfo = sliceInfos.value[pane.key]
  const nextValue = clampSliceValue(rawValue, sliceInfo.total)
  const previousValue = sliderValues.value[pane.key] ?? sliceInfo.current
  sliderValues.value[pane.key] = nextValue
  const delta = nextValue - previousValue
  if (!Number.isFinite(delta) || delta === 0) {
    return
  }

  emit('viewportWheel', {
    viewportKey: pane.key,
    deltaY: delta,
    exact: true
  })
}

function handleSyncedSliceSliderInput(event: Event): void {
  const pane = syncedSliderPane.value
  if (!pane) {
    return
  }
  handleSliceSliderInput(event, pane)
}

function getPaneSliceIndex(pane: ComparePaneView): number {
  return Math.max(0, sliceInfos.value[pane.key].current - 1)
}

function isPaneSliceStarred(pane: ComparePaneView): boolean {
  return Boolean(pane.seriesId && props.isSliceStarred?.(pane.seriesId, getPaneSliceIndex(pane)))
}

function getPaneStarredSliceCount(pane: ComparePaneView): number {
  return pane.seriesId ? (props.getStarredSliceCount?.(pane.seriesId) ?? 0) : 0
}

function togglePaneSliceStar(pane: ComparePaneView): void {
  if (!pane.seriesId) {
    return
  }

  emit('toggleSliceStar', {
    viewportKey: pane.key,
    seriesId: pane.seriesId,
    sliceIndex: getPaneSliceIndex(pane)
  })
}

</script>

<template>
  <div class="compare-stack-view flex h-full min-h-0 w-full flex-col gap-2">
    <div class="compare-stack-content" :class="{ 'compare-stack-content--synced': isScrollSynced }">
      <div class="compare-stack-panes grid min-h-0 grid-cols-2 gap-2">
      <section
        v-for="pane in panes"
        :key="pane.key"
        class="compare-stack-pane theme-shell-panel-strong grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border"
        :class="{ 'compare-stack-pane--active': activeViewportKey === pane.key }"
      >
      <div class="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--theme-border-soft)] px-3 py-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="compare-stack-pane__badge">{{ pane.badge }}</span>
          <div class="min-w-0">
            <div class="truncate text-[13px] font-semibold text-[var(--theme-text-primary)]">{{ pane.title }}</div>
            <div class="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] text-[var(--theme-text-muted)]">
              <span class="truncate">{{ pane.sliceLabel || `${viewerCopy.slice} --` }}</span>
              <span v-if="getPaneStarredSliceCount(pane)" class="compare-stack-pane__star-count">{{ getPaneStarredSliceCount(pane) }}</span>
            </div>
          </div>
        </div>
        <button
          class="compare-stack-pane__star-button"
          type="button"
          :class="{ 'compare-stack-pane__star-button--active': isPaneSliceStarred(pane) }"
          :title="isPaneSliceStarred(pane) ? viewerCopy.unmarkKeySlice : viewerCopy.markKeySlice"
          :aria-pressed="isPaneSliceStarred(pane) ? 'true' : 'false'"
          @click="togglePaneSliceStar(pane)"
        >
          <AppIcon :name="isPaneSliceStarred(pane) ? 'star' : 'star-outline'" :size="16" />
        </button>
      </div>

      <div class="compare-stack-pane__body" :class="{ 'compare-stack-pane__body--synced': isScrollSynced }">
        <ViewerCanvasStage
          class="min-w-0"
          :viewport-key="pane.key"
          viewport-class="grid place-items-center"
          :is-active="activeViewportKey === pane.key"
          :render-surface-active="true"
          :image-src="pane.imageSrc"
          :is-loading="Boolean(activeTab.compareViewIds?.[pane.key]) && !pane.imageSrc"
          :loading-label="compareLoadingLabel"
          :alt="pane.title"
          :active-operation="activeOperation"
          :placeholder="comparePlaceholder"
          :annotations="getAnnotations(pane.key)"
          :corner-info="activeTab.compareCornerInfos?.[pane.key] ?? activeTab.cornerInfo"
          :cursor-class="getCursorClass(pane.key)"
          :draft-annotation="getDraftAnnotation(pane.key)"
          :draft-measurement-mode="getDraftMeasurementMode(pane.key)"
          :draft-measurement="getDraftMeasurement(pane.key)"
          :measurements="getMeasurements(pane.key)"
          :scale-bar="activeTab.compareScaleBars?.[pane.key] ?? null"
          :orientation="activeTab.compareOrientations?.[pane.key] ?? activeTab.orientation"
          @copy-selected-measurement="emit('copySelectedMeasurement', $event)"
          @copy-annotation="emit('copyAnnotation', $event)"
          @delete-annotation="emit('deleteAnnotation', $event)"
          @delete-selected-measurement="(viewportKey, measurementId) => emit('deleteSelectedMeasurement', viewportKey, measurementId)"
          @click-viewport="emit('viewportClick', $event)"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @image-loaded="emit('imageLoaded', $event)"
          @wheel-viewport="emit('viewportWheel', $event)"
          @pointer-down="emit('pointerDown', $event, pane.key)"
          @pointer-leave="emit('pointerLeave', $event)"
          @pointer-move="emit('pointerMove', $event)"
          @pointer-up="emit('pointerUp', $event)"
          @pointer-cancel="emit('pointerCancel', $event)"
          @update-annotation-color="emit('updateAnnotationColor', $event)"
          @update-annotation-size="emit('updateAnnotationSize', $event)"
          @update-annotation-text="emit('updateAnnotationText', $event)"
        />

        <div v-if="!isScrollSynced" class="theme-card-soft flex min-h-0 flex-col items-center rounded-xl border px-1 py-2">
          <span class="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ viewerCopy.slice }}</span>
          <span class="mt-1 text-[10px] font-semibold text-[var(--theme-text-secondary)]">{{ sliderValues[pane.key] }}</span>
          <div class="my-2 flex min-h-0 flex-1 items-center">
            <input
              class="compare-stack-slider h-full w-3 cursor-pointer"
              type="range"
              min="1"
              :max="sliceInfos[pane.key].total"
              :value="sliderValues[pane.key]"
              orient="vertical"
              :aria-label="compareSliceLabel"
              @pointerdown="beginSliceSliderDrag(pane.key)"
              @pointerup="endSliceSliderDrag(pane.key)"
              @pointercancel="endSliceSliderDrag(pane.key)"
              @change="endSliceSliderDrag(pane.key)"
              @input="handleSliceSliderInput($event, pane)"
            />
          </div>
          <span class="text-[10px] font-semibold text-[var(--theme-text-secondary)]">{{ sliceInfos[pane.key].total }}</span>
        </div>
      </div>
      </section>
      </div>

      <div v-if="isScrollSynced && syncedSliderPane" class="theme-card-soft flex min-h-0 flex-col items-center rounded-xl border px-1 py-2">
        <span class="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ viewerCopy.slice }}</span>
        <span class="mt-1 text-[10px] font-semibold text-[var(--theme-text-secondary)]">{{ sliderValues[COMPARE_STACK_SOURCE_PANE_KEY] }}</span>
        <div class="my-2 flex min-h-0 flex-1 items-center">
          <input
            class="compare-stack-slider h-full w-3 cursor-pointer"
            type="range"
            min="1"
            :max="syncedSliceInfo.total"
            :value="sliderValues[COMPARE_STACK_SOURCE_PANE_KEY]"
            orient="vertical"
            :aria-label="syncedCompareSliceLabel"
            @pointerdown="beginSliceSliderDrag(COMPARE_STACK_SOURCE_PANE_KEY)"
            @pointerup="endSliceSliderDrag(COMPARE_STACK_SOURCE_PANE_KEY)"
            @pointercancel="endSliceSliderDrag(COMPARE_STACK_SOURCE_PANE_KEY)"
            @change="endSliceSliderDrag(COMPARE_STACK_SOURCE_PANE_KEY)"
            @input="handleSyncedSliceSliderInput"
          />
        </div>
        <span class="text-[10px] font-semibold text-[var(--theme-text-secondary)]">{{ syncedSliceInfo.total }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compare-stack-content {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.compare-stack-content--synced {
  grid-template-columns: minmax(0, 1fr) 30px;
}

.compare-stack-pane__body {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 30px;
  gap: 8px;
  padding: 8px;
}

.compare-stack-pane__body--synced {
  grid-template-columns: minmax(0, 1fr);
}

.compare-stack-pane {
  background: color-mix(in srgb, var(--theme-surface-card) 88%, transparent);
}

.compare-stack-pane--active {
  border-color: color-mix(in srgb, var(--theme-accent) 56%, var(--theme-border-strong));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 18%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 10%, transparent);
}

.compare-stack-pane__badge {
  display: inline-grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 36%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 800;
}

.compare-stack-pane__star-button {
  display: inline-grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 84%, transparent);
  color: var(--theme-text-secondary);
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease;
}

.compare-stack-pane__star-button:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 62%, var(--theme-border-strong));
  color: var(--theme-text-primary);
}

.compare-stack-pane__star-button--active {
  border-color: color-mix(in srgb, var(--theme-accent) 72%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 22%, var(--theme-surface-card));
  color: var(--theme-accent);
}

.compare-stack-pane__star-count {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 18%, transparent);
  color: var(--theme-accent);
  font-size: 9px;
  font-weight: 800;
}

.compare-stack-slider {
  appearance: slider-vertical;
  writing-mode: bt-lr;
  transform: rotate(180deg);
  accent-color: var(--theme-accent);
}

@media (max-width: 1100px) {
  .compare-stack-panes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
