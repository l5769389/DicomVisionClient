<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { VCombobox } from 'vuetify/components'
import {
  DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET,
  getFusionPetPseudocolorGradient
} from '../../../constants/pseudocolor'
import type { ViewerTabItem } from '../../../types/viewer'

const PET_RANGE_EMIT_INTERVAL_MS = 80
const DEFAULT_PET_RANGE_MAX = 30
const DEFAULT_PET_WINDOW_MAX = 4.5
const PET_RANGE_MAX_DEBOUNCE_MS = 360
const PET_RANGE_OPTIMISTIC_TTL_MS = 1600
const petRangeMaxOptions = [5, 10, 20, 30, 40]
const petRangeMaxOptionLabels = petRangeMaxOptions.map((option) => String(option))

const props = defineProps<{
  activeTab: ViewerTabItem
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [value: string]
}>()

const fusionPetUnitOptions = [
  { value: 'kBqml', label: 'kBq/ml' },
  { value: 'SUVbsa', label: 'cm2/ml' },
  { value: 'SUVbw', label: 'g/ml (SUVbw)' },
  { value: 'SUL', label: 'g/ml* (SUL)' },
  { value: 'percentIDg', label: '%ID/g' },
  { value: 'source', label: 'Source' }
]

function isLikelyCtWindowLeakedIntoPetRange(minValue: number, maxValue: number): boolean {
  const unit = String(props.activeTab.fusionInfo?.petUnit ?? props.activeTab.fusionInfo?.petUnitLabel ?? '').toLowerCase()
  const isPetQuantUnit = unit.includes('suv') || unit.includes('sul') || unit.includes('g/ml')
  return isPetQuantUnit && minValue < -1 && maxValue >= 100
}

const selectedUnit = computed(() => props.activeTab.fusionInfo?.petUnit ?? 'SUVbw')
const backendWindowMax = computed(() => {
  const minValue = Number(props.activeTab.fusionInfo?.petWindowMin ?? 0)
  const value = Number(props.activeTab.fusionInfo?.petWindowMax ?? DEFAULT_PET_WINDOW_MAX)
  if (Number.isFinite(minValue) && Number.isFinite(value) && isLikelyCtWindowLeakedIntoPetRange(minValue, value)) {
    return DEFAULT_PET_WINDOW_MAX
  }
  return Number.isFinite(value) ? Math.max(0, value) : DEFAULT_PET_WINDOW_MAX
})
const draftWindowMax = ref(backendWindowMax.value)
const rangeUpperLimit = ref(Math.max(DEFAULT_PET_RANGE_MAX, Math.ceil(backendWindowMax.value)))
const draftRangeUpperLimit = ref(rangeUpperLimit.value)
const rangeUpperLimitSearch = ref(formatRangeUpperLimit(rangeUpperLimit.value))
const isDragging = ref(false)
let pendingTimer: ReturnType<typeof window.setTimeout> | null = null
let pendingValue: number | null = null
let pendingRangeMaxTimer: ReturnType<typeof window.setTimeout> | null = null
let pendingOptimisticWindowMax: number | null = null
let pendingOptimisticUntil = 0

const rangeGradient = computed(() => getFusionPetPseudocolorGradient(DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET))
const displayWindowMax = computed(() => Number(draftWindowMax.value).toFixed(draftWindowMax.value < 10 ? 1 : 0))
const rangeUpperLimitModel = computed(() => formatRangeUpperLimit(draftRangeUpperLimit.value))
const rangeValueLabelPosition = computed(() => {
  if (rangeUpperLimit.value <= 0) {
    return 7
  }
  return Math.min(93, Math.max(7, (draftWindowMax.value / rangeUpperLimit.value) * 100))
})

watch(
  backendWindowMax,
  (value) => {
    if (pendingOptimisticWindowMax != null) {
      if (Math.abs(value - pendingOptimisticWindowMax) < 0.05) {
        pendingOptimisticWindowMax = null
      } else if (Date.now() < pendingOptimisticUntil) {
        return
      } else {
        pendingOptimisticWindowMax = null
      }
    }
    if (!isDragging.value && value <= rangeUpperLimit.value) {
      draftWindowMax.value = Math.max(0, value)
    }
  },
  { immediate: true }
)

function clearPendingTimer(): void {
  if (pendingTimer != null) {
    window.clearTimeout(pendingTimer)
    pendingTimer = null
  }
}

function clearPendingRangeMaxTimer(): void {
  if (pendingRangeMaxTimer != null) {
    window.clearTimeout(pendingRangeMaxTimer)
    pendingRangeMaxTimer = null
  }
}

function formatRangeUpperLimit(value: number): string {
  const finiteValue = Number.isFinite(value) ? value : DEFAULT_PET_RANGE_MAX
  return Number.isInteger(finiteValue) ? String(finiteValue) : String(Number(finiteValue.toFixed(1)))
}

function markOptimisticWindowMax(value: number): void {
  pendingOptimisticWindowMax = Math.max(0, value)
  pendingOptimisticUntil = Date.now() + PET_RANGE_OPTIMISTIC_TTL_MS
}

function emitWindowMax(value: number): void {
  const nextValue = Math.max(0, value)
  markOptimisticWindowMax(nextValue)
  emit('select', `fusionPetWindow:0:${nextValue}`)
}

function scheduleWindowMax(value: number): void {
  pendingValue = value
  if (pendingTimer != null) {
    return
  }
  pendingTimer = window.setTimeout(() => {
    pendingTimer = null
    if (pendingValue != null) {
      emitWindowMax(pendingValue)
      pendingValue = null
    }
  }, PET_RANGE_EMIT_INTERVAL_MS)
}

function flushWindowMax(): void {
  clearPendingTimer()
  pendingValue = null
  emitWindowMax(draftWindowMax.value)
}

function updateDraftWindowMax(rawValue: string, flush = false): void {
  const nextValue = Number(rawValue)
  if (!Number.isFinite(nextValue)) {
    return
  }
  const clamped = Math.max(0, Math.min(nextValue, rangeUpperLimit.value))
  draftWindowMax.value = clamped
  markOptimisticWindowMax(clamped)
  if (flush) {
    flushWindowMax()
  } else {
    scheduleWindowMax(clamped)
  }
}

function updateRangeUpperLimit(rawValue: string): void {
  const nextValue = Number(rawValue)
  if (!Number.isFinite(nextValue)) {
    return
  }
  draftRangeUpperLimit.value = Math.max(1, nextValue)
  rangeUpperLimitSearch.value = rawValue
  clearPendingRangeMaxTimer()
  pendingRangeMaxTimer = window.setTimeout(() => {
    pendingRangeMaxTimer = null
    applyRangeUpperLimit(draftRangeUpperLimit.value)
  }, PET_RANGE_MAX_DEBOUNCE_MS)
}

function applyRangeUpperLimit(rawValue: number): void {
  const previousUpperLimit = Math.max(1, rangeUpperLimit.value)
  const nextUpperLimit = Math.max(1, rawValue)
  const ratio = Math.max(0, Math.min(1, draftWindowMax.value / previousUpperLimit))
  rangeUpperLimit.value = nextUpperLimit
  draftRangeUpperLimit.value = nextUpperLimit
  rangeUpperLimitSearch.value = formatRangeUpperLimit(nextUpperLimit)
  draftWindowMax.value = Math.max(0, Math.min(nextUpperLimit, ratio * nextUpperLimit))
  flushWindowMax()
}

function handleRangeUpperLimitCommit(rawValue: string): void {
  const nextValue = Number(rawValue)
  if (!Number.isFinite(nextValue)) {
    return
  }
  clearPendingRangeMaxTimer()
  applyRangeUpperLimit(nextValue)
}

function handleRangeUpperLimitSearch(rawValue: string | null): void {
  if (rawValue == null) {
    return
  }
  updateRangeUpperLimit(rawValue)
}

function handleRangeUpperLimitModelUpdate(rawValue: string | number | null): void {
  if (rawValue == null) {
    return
  }
  handleRangeUpperLimitCommit(String(rawValue))
}

function handleUnitChange(event: Event): void {
  const value = (event.target as HTMLSelectElement | null)?.value
  if (value) {
    emit('select', `fusionPetUnit:${value}`)
  }
}

function handlePointerDown(): void {
  isDragging.value = true
}

function handlePointerUp(): void {
  if (!isDragging.value) {
    return
  }
  isDragging.value = false
  flushWindowMax()
}

onBeforeUnmount(() => {
  clearPendingTimer()
  clearPendingRangeMaxTimer()
})
</script>

<template>
  <div class="fusion-pet-display-tool" :class="{ 'fusion-pet-display-tool--disabled': disabled }">
    <span class="fusion-pet-display-tool__label">PET</span>
    <div class="fusion-pet-display-tool__range">
      <span class="fusion-pet-display-tool__range-end">0</span>
      <div class="fusion-pet-display-tool__range-track" :style="{ '--fusion-pet-gradient': rangeGradient }">
        <input
          class="fusion-pet-display-tool__slider"
          type="range"
          min="0"
          :max="rangeUpperLimit"
          step="0.1"
          :disabled="disabled"
          :value="draftWindowMax"
          @input="updateDraftWindowMax(($event.target as HTMLInputElement).value)"
          @change="updateDraftWindowMax(($event.target as HTMLInputElement).value, true)"
          @pointerdown="handlePointerDown"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
        />
        <span
          class="fusion-pet-display-tool__value"
          :style="{ left: `${rangeValueLabelPosition}%` }"
        >
          {{ displayWindowMax }}
        </span>
      </div>
      <VCombobox
        class="fusion-pet-display-tool__range-max"
        density="compact"
        hide-details
        inputmode="decimal"
        :disabled="disabled"
        :items="petRangeMaxOptionLabels"
        :menu-props="{ contentClass: 'fusion-pet-display-tool__range-max-menu', maxHeight: 220 }"
        :model-value="rangeUpperLimitModel"
        :search="rangeUpperLimitSearch"
        single-line
        variant="solo"
        @update:model-value="handleRangeUpperLimitModelUpdate"
        @update:search="handleRangeUpperLimitSearch"
      />
    </div>
    <select
      class="fusion-pet-display-tool__select fusion-pet-display-tool__select--unit"
      :disabled="disabled"
      :value="selectedUnit"
      @change="handleUnitChange"
    >
      <option v-for="option in fusionPetUnitOptions" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.fusion-pet-display-tool {
  display: inline-flex;
  height: 36px;
  min-width: 448px;
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  border-radius: 12px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-surface-card) 92%, white 4%),
    color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 6%)
  );
  padding: 4px 8px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 20px rgba(0, 0, 0, 0.14);
}

.fusion-pet-display-tool--disabled {
  opacity: 0.58;
  pointer-events: none;
}

.fusion-pet-display-tool__label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--theme-text-primary);
}

.fusion-pet-display-tool__select {
  height: 26px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 92%, black 4%);
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 700;
  outline: none;
}

.fusion-pet-display-tool__select--unit {
  width: 98px;
}

.fusion-pet-display-tool__range {
  display: inline-flex;
  min-width: 278px;
  align-items: center;
  gap: 6px;
}

.fusion-pet-display-tool__range-end {
  min-width: 14px;
  text-align: right;
  font-size: 12px;
  font-weight: 800;
  color: var(--theme-text-primary);
}

.fusion-pet-display-tool__range-track {
  position: relative;
  width: 190px;
  height: 24px;
  border-radius: 7px;
  background: var(--fusion-pet-gradient);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

.fusion-pet-display-tool__slider {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: ew-resize;
}

.fusion-pet-display-tool__slider::-webkit-slider-thumb {
  width: 12px;
  height: 24px;
  appearance: none;
  border: 0;
  border-radius: 5px;
  background: color-mix(in srgb, var(--theme-text-primary) 62%, var(--theme-accent) 38%);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.26);
}

.fusion-pet-display-tool__value {
  position: absolute;
  top: 50%;
  z-index: 2;
  transform: translate(-50%, -50%);
  min-width: 24px;
  border-radius: 999px;
  padding: 1px 5px;
  background: rgba(10, 16, 24, 0.56);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.84);
  pointer-events: none;
}

.fusion-pet-display-tool__range-max {
  width: 76px;
  flex: 0 0 76px;
}

:deep(.fusion-pet-display-tool__range-max .v-input__control) {
  min-height: 26px;
}

:deep(.fusion-pet-display-tool__range-max .v-field) {
  min-height: 26px;
  height: 26px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 92%, black 4%);
  color: var(--theme-text-primary);
  box-shadow: none;
}

:deep(.fusion-pet-display-tool__range-max .v-field:hover) {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-strong));
}

:deep(.fusion-pet-display-tool__range-max .v-field.v-field--focused) {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 22%, transparent);
}

:deep(.fusion-pet-display-tool__range-max .v-field__overlay),
:deep(.fusion-pet-display-tool__range-max .v-field__outline) {
  display: none;
}

:deep(.fusion-pet-display-tool__range-max .v-field__input) {
  min-height: 24px;
  align-items: center;
  flex-wrap: nowrap;
  overflow: hidden;
  padding: 0 2px 0 8px;
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 800;
}

:deep(.fusion-pet-display-tool__range-max .v-field__input input) {
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  background: transparent !important;
  color: var(--theme-text-primary);
  font: inherit;
  line-height: 1.25;
  text-align: center;
}

:deep(.fusion-pet-display-tool__range-max .v-combobox__selection) {
  max-width: none;
  margin: 0;
  overflow: visible;
}

:deep(.fusion-pet-display-tool__range-max .v-combobox__selection-text) {
  overflow: visible;
  text-overflow: clip;
}

:deep(.fusion-pet-display-tool__range-max .v-field__append-inner) {
  align-items: center;
  padding: 0 4px 0 0;
  color: var(--theme-text-secondary);
}

:deep(.fusion-pet-display-tool__range-max .v-icon) {
  color: var(--theme-text-secondary);
  font-size: 14px;
}

:global(.fusion-pet-display-tool__range-max-menu),
:global(.fusion-pet-display-tool__range-max-menu .v-overlay__content) {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  border-radius: 14px;
  background: var(--theme-surface-panel-strong);
  color: var(--theme-text-primary);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.38);
}

:global(.fusion-pet-display-tool__range-max-menu .v-list) {
  background: var(--theme-surface-panel-strong);
  color: var(--theme-text-primary);
  padding: 4px;
}

:global(.fusion-pet-display-tool__range-max-menu .v-list-item) {
  min-height: 30px;
  border-radius: 10px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

:global(.fusion-pet-display-tool__range-max-menu .v-list-item:hover) {
  background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
  color: var(--theme-text-primary);
}

:global(.fusion-pet-display-tool__range-max-menu .v-list-item--active) {
  background: var(--theme-active-surface-soft);
  color: var(--theme-active-foreground);
}
</style>
