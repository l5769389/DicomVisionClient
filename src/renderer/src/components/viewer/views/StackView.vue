<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  CornerInfo,
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementOverlay,
  QaWaterAnalysis,
  ViewerMtfItem,
  ViewerTabItem
} from '../../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeOperation: string
  annotations?: AnnotationOverlay[]
  cornerInfo: CornerInfo
  cursorClass?: string
  draftAnnotation?: AnnotationDraft | null
  draftMeasurementMode?: DraftMeasurementMode | null
  draftMeasurement?: MeasurementDraft | null
  measurements?: MeasurementOverlay[]
  mtfDraftMode?: DraftMeasurementMode | null
  mtfDraft?: { mtfId?: string; points: { x: number; y: number }[] } | null
  mtfItems?: ViewerMtfItem[]
  qaWaterAnalysis?: QaWaterAnalysis | null
  selectedMtfId?: string | null
  isCurrentSliceStarred?: boolean
  starredSliceCount?: number
  starredSliceIndexes?: number[]
}>()

const { viewerCopy } = useUiLocale()

const emit = defineEmits<{
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  clearMtf: []
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null; row?: number | null; col?: number | null }]
  imageLoaded: [viewportKey: string]
  openMtfCurve: []
  selectMtf: [payload: { mtfId: string | null }]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  toggleSliceStar: [payload: { viewportKey: string; sliceIndex: number }]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
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

const sliderValue = ref(1)
const isSliceSliderActive = ref(false)
const currentSliceIndex = computed(() => Math.max(0, sliceInfo.value.current - 1))
const sortedStarredSliceIndexes = computed(() =>
  [...new Set(props.starredSliceIndexes ?? [])]
    .filter((index) => Number.isFinite(index) && index >= 0 && index < sliceInfo.value.total)
    .sort((a, b) => a - b)
)
const previousStarredSliceIndex = computed(() => {
  const current = currentSliceIndex.value
  return sortedStarredSliceIndexes.value.filter((index) => index < current).at(-1) ?? null
})
const showSliceSlider = computed(() => props.activeTab.showSliceSlider !== false)
const nextStarredSliceIndex = computed(() => {
  const current = currentSliceIndex.value
  return sortedStarredSliceIndexes.value.find((index) => index > current) ?? null
})

function clampSliceValue(value: number, total = sliceInfo.value.total): number {
  return Math.min(Math.max(value, 1), total)
}

watch(
  sliceInfo,
  (value) => {
    if (!isSliceSliderActive.value) {
      sliderValue.value = clampSliceValue(value.current, value.total)
    }
  },
  { immediate: true }
)

watch(
  () => props.activeTab.key,
  () => {
    isSliceSliderActive.value = false
    sliderValue.value = clampSliceValue(sliceInfo.value.current, sliceInfo.value.total)
  }
)

function beginSliceSliderDrag(): void {
  isSliceSliderActive.value = true
}

function endSliceSliderDrag(): void {
  sliderValue.value = clampSliceValue(sliderValue.value)
  isSliceSliderActive.value = false
}

function handleSliceSliderInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  beginSliceSliderDrag()
  const rawValue = Number(target.value)
  if (!Number.isFinite(rawValue)) {
    return
  }
  const nextValue = clampSliceValue(rawValue)
  const previousValue = sliderValue.value
  sliderValue.value = nextValue
  const delta = nextValue - previousValue
  if (!Number.isFinite(delta) || delta === 0) {
    return
  }

  emit('viewportWheel', {
    viewportKey: 'single',
    deltaY: delta,
    exact: true
  })
}

function toggleCurrentSliceStar(): void {
  emit('toggleSliceStar', {
    viewportKey: 'single',
    sliceIndex: currentSliceIndex.value
  })
}

function jumpToStarredSlice(sliceIndex: number | null): void {
  if (sliceIndex === null) {
    return
  }
  const targetValue = clampSliceValue(sliceIndex + 1)
  const delta = targetValue - sliderValue.value
  if (delta === 0) {
    return
  }

  emit('viewportWheel', {
    viewportKey: 'single',
    deltaY: delta,
    exact: true
  })
}
</script>

<template>
  <div
    class="viewer-layout viewer-layout--stack grid h-full w-full gap-2"
    :class="showSliceSlider ? 'viewer-layout--stack-with-slider' : 'viewer-layout--stack-no-slider'"
  >
    <ViewerCanvasStage
      class="min-w-0"
      viewport-key="single"
      viewport-class="grid place-items-center"
      :is-active="true"
      :render-surface-active="true"
      :image-src="props.activeTab.imageSrc"
      :is-loading="Boolean(props.activeTab.viewId) && !props.activeTab.imageSrc"
      :loading-label="viewerCopy.loadingStackView"
      :light-surface="props.activeTab.viewType === 'PET'"
      :alt="props.activeTab.viewType"
      :active-operation="props.activeOperation"
      :placeholder="viewerCopy.stackPlaceholder"
      :annotations="props.annotations ?? []"
      :corner-info="props.cornerInfo"
      :cursor-class="props.cursorClass ?? ''"
      :draft-annotation="props.draftAnnotation ?? null"
      :draft-measurement-mode="props.draftMeasurementMode ?? null"
      :draft-measurement="props.draftMeasurement ?? null"
      :measurements="props.measurements ?? []"
      :mtf-draft-mode="props.mtfDraftMode ?? null"
      :mtf-draft="props.mtfDraft ?? null"
      :mtf-items="props.mtfItems ?? []"
      :qa-water-analysis="props.qaWaterAnalysis ?? null"
      :selected-mtf-id="props.selectedMtfId ?? null"
      :scale-bar="props.activeTab.scaleBar ?? null"
      :pseudocolor-preset="props.activeTab.pseudocolorPreset"
      :pseudocolor-window-info="props.activeTab.currentWindowInfo ?? props.activeTab.initialWindowInfo ?? null"
      :show-corner-info="props.activeTab.showCornerInfo !== false"
      :show-scale-bar="props.activeTab.showScaleBar !== false"
      :show-pseudocolor-bar="props.activeTab.showPseudocolorBar !== false"
      :stage-surface-class="props.activeTab.viewType === 'PET' ? 'viewer-stage-surface--white viewer-stage-surface--pet-standalone' : ''"
      :viewport-transform="props.activeTab.transformState ?? null"
      :orientation="props.activeTab.orientation"
      @clear-mtf="emit('clearMtf')"
      @copy-selected-mtf="emit('copySelectedMtf', $event)"
      @copy-selected-measurement="emit('copySelectedMeasurement', $event)"
      @copy-annotation="emit('copyAnnotation', $event)"
      @delete-annotation="emit('deleteAnnotation', $event)"
      @delete-selected-measurement="(viewportKey, measurementId) => emit('deleteSelectedMeasurement', viewportKey, measurementId)"
      @click-viewport="emit('viewportClick', $event)"
      @hover-viewport-change="emit('hoverViewportChange', $event)"
      @image-loaded="emit('imageLoaded', $event)"
      @open-mtf-curve="emit('openMtfCurve')"
      @select-mtf="emit('selectMtf', $event)"
      @wheel-viewport="emit('viewportWheel', $event)"
      @pointer-down="emit('pointerDown', $event, 'single')"
      @pointer-leave="emit('pointerLeave', $event)"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
      @update-annotation-color="emit('updateAnnotationColor', $event)"
      @update-annotation-size="emit('updateAnnotationSize', $event)"
      @update-annotation-text="emit('updateAnnotationText', $event)"
    />

    <div v-if="showSliceSlider" class="stack-slice-panel theme-shell-panel-strong flex min-h-0 flex-col items-center rounded-xl border px-1.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span class="stack-slice-label grid min-h-8 w-full place-items-center break-all text-center text-[10px] font-semibold uppercase leading-[1.12] tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ viewerCopy.slice }}</span>
      <span class="mt-1 text-[10px] font-semibold text-[var(--theme-text-muted)]">{{ sliderValue }}</span>
      <div class="stack-slice-star-tools mt-2 flex flex-col items-center gap-1">
        <button
          class="stack-slice-star-button"
          type="button"
          :class="{ 'stack-slice-star-button--active': props.isCurrentSliceStarred }"
          :title="props.isCurrentSliceStarred ? viewerCopy.unmarkKeySlice : viewerCopy.markKeySlice"
          :aria-pressed="props.isCurrentSliceStarred ? 'true' : 'false'"
          @click="toggleCurrentSliceStar"
        >
          <AppIcon :name="props.isCurrentSliceStarred ? 'star' : 'star-outline'" :size="15" />
        </button>
        <span
          class="stack-slice-star-count"
          :class="{ 'stack-slice-star-count--hidden': !props.starredSliceCount }"
        >
          {{ props.starredSliceCount || 0 }}
        </span>
      </div>
      <div class="my-2 flex min-h-0 flex-1 items-center">
        <input
          class="stack-slice-slider h-full w-3.5 cursor-pointer"
          type="range"
          min="1"
          :max="sliceInfo.total"
          :value="sliderValue"
          orient="vertical"
          :aria-label="viewerCopy.switchSlice"
          @pointerdown="beginSliceSliderDrag"
          @pointerup="endSliceSliderDrag"
          @pointercancel="endSliceSliderDrag"
          @change="endSliceSliderDrag"
          @input="handleSliceSliderInput"
        />
      </div>
      <span class="text-[10px] font-semibold text-[var(--theme-text-muted)]">{{ sliceInfo.total }}</span>
      <div class="stack-slice-star-nav-group mt-2 flex flex-col items-center gap-1">
        <button
          class="stack-slice-star-nav"
          type="button"
          :title="viewerCopy.previousKeySlice"
          :disabled="previousStarredSliceIndex === null"
          @click="jumpToStarredSlice(previousStarredSliceIndex)"
        >
          <AppIcon name="chevron-up" :size="14" />
        </button>
        <button
          class="stack-slice-star-nav"
          type="button"
          :title="viewerCopy.nextKeySlice"
          :disabled="nextStarredSliceIndex === null"
          @click="jumpToStarredSlice(nextStarredSliceIndex)"
        >
          <AppIcon name="chevron-down" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer-layout--stack-with-slider {
  grid-template-columns: minmax(0, 1fr) 34px;
}

.viewer-layout--stack-no-slider {
  grid-template-columns: minmax(0, 1fr);
}

.stack-slice-slider {
  width: 14px;
  border: 0 !important;
  appearance: none;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  writing-mode: vertical-lr;
  accent-color: var(--theme-accent);
  outline: none;
}

.stack-slice-slider::-webkit-slider-runnable-track {
  width: 4px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-border-strong) 52%, transparent);
  box-shadow: none;
}

.stack-slice-slider::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  margin-left: -6px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 82%, white 12%);
  border-radius: 999px;
  appearance: none;
  background: var(--theme-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

.stack-slice-slider::-moz-range-track {
  width: 4px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-border-strong) 52%, transparent);
}

.stack-slice-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 82%, white 12%);
  border-radius: 999px;
  background: var(--theme-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

.stack-slice-star-button,
.stack-slice-star-nav {
  display: inline-grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-secondary);
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease;
}

.stack-slice-star-button {
  width: 24px;
  height: 24px;
  border-radius: 8px;
}

.stack-slice-star-tools {
  min-height: 39px;
}

.stack-slice-star-count {
  display: inline-grid;
  min-width: 18px;
  height: 11px;
  place-items: center;
  color: var(--theme-accent);
  font-size: 9px;
  font-weight: 800;
  line-height: 11px;
}

.stack-slice-star-count--hidden {
  visibility: hidden;
}

.stack-slice-star-button:hover,
.stack-slice-star-nav:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--theme-accent) 62%, var(--theme-border-strong));
  color: var(--theme-text-primary);
}

.stack-slice-star-button--active {
  border-color: color-mix(in srgb, var(--theme-accent) 72%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 22%, var(--theme-surface-card));
  color: var(--theme-accent);
}

.stack-slice-star-nav {
  width: 22px;
  height: 22px;
  border-radius: 7px;
}

.stack-slice-star-nav-group {
  min-height: 48px;
}

.stack-slice-star-nav:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
