<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { VBtn, VMenu } from 'vuetify/components'
import AppIcon from '../../AppIcon.vue'
import {
  DEFAULT_FUSION_PET_WINDOW_MAX,
  DEFAULT_FUSION_PET_WINDOW_MIN,
  DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET,
  getFusionPetPseudocolorGradient
} from '../../../constants/pseudocolor'
import type { ViewerTabItem } from '../../../types/viewer'

const PET_RANGE_EMIT_INTERVAL_MS = 80
const DEFAULT_PET_RANGE_MAX = 30
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

const petDisplayInfo = computed(() =>
  props.activeTab.viewType === 'PET'
    ? props.activeTab.petInfo
    : props.activeTab.fusionInfo
)
const petUnitEventPrefix = computed(() => (props.activeTab.viewType === 'PET' ? 'petUnit' : 'fusionPetUnit'))
const petWindowEventPrefix = computed(() => (props.activeTab.viewType === 'PET' ? 'petWindow' : 'fusionPetWindow'))

function isLikelyCtWindowLeakedIntoPetRange(minValue: number, maxValue: number): boolean {
  const unit = String(petDisplayInfo.value?.petUnit ?? petDisplayInfo.value?.petUnitLabel ?? '').toLowerCase()
  const isPetQuantUnit = unit.includes('suv') || unit.includes('sul') || unit.includes('g/ml')
  return isPetQuantUnit && minValue < -1 && maxValue >= 100
}

const selectedUnit = computed(() => petDisplayInfo.value?.petUnit ?? 'SUVbw')
const backendWindowMax = computed(() => {
  const minValue = Number(petDisplayInfo.value?.petWindowMin ?? DEFAULT_FUSION_PET_WINDOW_MIN)
  const value = Number(petDisplayInfo.value?.petWindowMax ?? DEFAULT_FUSION_PET_WINDOW_MAX)
  if (Number.isFinite(minValue) && Number.isFinite(value) && isLikelyCtWindowLeakedIntoPetRange(minValue, value)) {
    return DEFAULT_FUSION_PET_WINDOW_MAX
  }
  return Number.isFinite(value) ? Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, value) : DEFAULT_FUSION_PET_WINDOW_MAX
})
const draftWindowMax = ref(backendWindowMax.value)
const rangeUpperLimit = ref(Math.max(DEFAULT_PET_RANGE_MAX, Math.ceil(backendWindowMax.value)))
const draftRangeUpperLimit = ref(rangeUpperLimit.value)
const rangeUpperLimitSearch = ref(formatRangeUpperLimit(rangeUpperLimit.value))
const isDragging = ref(false)
const isRangeMenuOpen = ref(false)
let pendingTimer: ReturnType<typeof window.setTimeout> | null = null
let pendingValue: number | null = null
let pendingRangeMaxTimer: ReturnType<typeof window.setTimeout> | null = null
let pendingOptimisticWindowMax: number | null = null
let pendingOptimisticUntil = 0

const rangeGradient = computed(() => getFusionPetPseudocolorGradient(DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET))
const displayWindowMax = computed(() => Number(draftWindowMax.value).toFixed(draftWindowMax.value < 10 ? 2 : 0))
const rangeUpperLimitModel = computed(() => formatRangeUpperLimit(draftRangeUpperLimit.value))
const selectedUnitLabel = computed(() => fusionPetUnitOptions.find((option) => option.value === selectedUnit.value)?.label ?? selectedUnit.value)
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
  pendingOptimisticWindowMax = Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, value)
  pendingOptimisticUntil = Date.now() + PET_RANGE_OPTIMISTIC_TTL_MS
}

function emitWindowMax(value: number): void {
  const nextValue = Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, value)
  markOptimisticWindowMax(nextValue)
  emit('select', `${petWindowEventPrefix.value}:${DEFAULT_FUSION_PET_WINDOW_MIN}:${nextValue}`)
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
  const clamped = Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, Math.min(nextValue, rangeUpperLimit.value))
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
  const ratio = Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, Math.min(1, draftWindowMax.value / previousUpperLimit))
  rangeUpperLimit.value = nextUpperLimit
  draftRangeUpperLimit.value = nextUpperLimit
  rangeUpperLimitSearch.value = formatRangeUpperLimit(nextUpperLimit)
  draftWindowMax.value = Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, Math.min(nextUpperLimit, ratio * nextUpperLimit))
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

function handleRangeUpperLimitOption(rawValue: string): void {
  clearPendingRangeMaxTimer()
  handleRangeUpperLimitCommit(rawValue)
  isRangeMenuOpen.value = false
}

function isRangeUpperLimitOptionActive(rawValue: string): boolean {
  const value = Number(rawValue)
  return Number.isFinite(value) && Math.abs(value - rangeUpperLimit.value) < 0.001
}

function handleUnitValue(value: string): void {
  if (value) {
    emit('select', `${petUnitEventPrefix.value}:${value}`)
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
          step="0.01"
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
      <VMenu
        :model-value="isRangeMenuOpen"
        location="bottom end"
        :offset="8"
        scroll-strategy="reposition"
        :close-on-content-click="false"
        @update:model-value="isRangeMenuOpen = $event"
      >
        <template #activator="{ props: menuProps }">
          <VBtn
            v-bind="menuProps"
            variant="flat"
            type="button"
            class="fusion-pet-display-tool__dropdown-button fusion-pet-display-tool__dropdown-button--range theme-button-secondary"
            :disabled="disabled"
            :title="rangeUpperLimitModel"
          >
            <span class="fusion-pet-display-tool__range-max-value">{{ rangeUpperLimitModel }}</span>
            <AppIcon name="chevron-down" :size="13" :stroke-width="2.2" />
          </VBtn>
        </template>

        <div data-tool-menu-root class="fusion-pet-display-tool__menu fusion-pet-display-tool__menu--range theme-shell-panel">
          <input
            class="fusion-pet-display-tool__range-max-input"
            inputmode="decimal"
            :disabled="disabled"
            :value="rangeUpperLimitSearch"
            aria-label="PET range maximum"
            @input="handleRangeUpperLimitSearch(($event.target as HTMLInputElement).value)"
            @change="handleRangeUpperLimitModelUpdate(($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="handleRangeUpperLimitOption(($event.target as HTMLInputElement).value)"
          />
          <button
            v-for="option in petRangeMaxOptionLabels"
            :key="option"
            type="button"
            class="fusion-pet-display-tool__menu-option fusion-pet-display-tool__range-option"
            :class="{ 'fusion-pet-display-tool__menu-option--active': isRangeUpperLimitOptionActive(option) }"
            @click="handleRangeUpperLimitOption(option)"
          >
            <span class="fusion-pet-display-tool__menu-option-rail" />
            <span>{{ option }}</span>
            <AppIcon v-if="isRangeUpperLimitOptionActive(option)" name="check" :size="14" />
          </button>
        </div>
      </VMenu>
    </div>
    <VMenu
      location="bottom end"
      :offset="8"
      scroll-strategy="reposition"
      :close-on-content-click="true"
    >
      <template #activator="{ props: menuProps }">
        <VBtn
          v-bind="menuProps"
          variant="flat"
          type="button"
          class="fusion-pet-display-tool__dropdown-button fusion-pet-display-tool__dropdown-button--unit theme-button-secondary"
          :disabled="disabled"
          :title="selectedUnitLabel"
        >
          <span class="fusion-pet-display-tool__unit-label">{{ selectedUnitLabel }}</span>
          <AppIcon name="chevron-down" :size="13" :stroke-width="2.2" />
        </VBtn>
      </template>

      <div data-tool-menu-root class="fusion-pet-display-tool__menu fusion-pet-display-tool__menu--unit theme-shell-panel">
        <button
          v-for="option in fusionPetUnitOptions"
          :key="option.value"
          type="button"
          class="fusion-pet-display-tool__menu-option fusion-pet-display-tool__unit-option"
          :class="{ 'fusion-pet-display-tool__menu-option--active': selectedUnit === option.value }"
          @click="handleUnitValue(option.value)"
        >
          <span class="fusion-pet-display-tool__menu-option-rail" />
          <span>{{ option.label }}</span>
          <AppIcon v-if="selectedUnit === option.value" name="check" :size="14" />
        </button>
      </div>
    </VMenu>
  </div>
</template>

<style scoped>
.fusion-pet-display-tool {
  display: inline-flex;
  height: 36px;
  min-width: 452px;
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

.fusion-pet-display-tool__dropdown-button {
  display: inline-flex !important;
  min-width: 0 !important;
  height: 28px !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 6px !important;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent) !important;
  border-radius: 9px !important;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-surface-card-soft) 92%, white 3%),
    color-mix(in srgb, var(--theme-surface-panel-solid) 92%, black 4%)
  ) !important;
  color: var(--theme-text-primary) !important;
  padding: 0 8px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
  text-transform: none !important;
  transition: border-color 0.15s ease, filter 0.15s ease;
}

.fusion-pet-display-tool__dropdown-button :deep(.v-btn__content) {
  display: inline-flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.fusion-pet-display-tool__dropdown-button:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-strong)) !important;
  filter: brightness(1.08);
}

.fusion-pet-display-tool__dropdown-button--range {
  width: 58px !important;
  flex: 0 0 58px;
  padding: 0 6px !important;
}

.fusion-pet-display-tool__dropdown-button--unit {
  width: 128px !important;
  flex: 0 0 128px;
  padding: 0 8px !important;
}

.fusion-pet-display-tool__range-max-value,
.fusion-pet-display-tool__unit-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
}

.fusion-pet-display-tool__range-max-value {
  flex: 1 1 auto;
  text-align: center;
}

.fusion-pet-display-tool__unit-label {
  flex: 1 1 auto;
  text-align: left;
}

.fusion-pet-display-tool__menu {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 74%, transparent);
  border-radius: 18px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-surface-card) 92%, white 4%),
    color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 6%)
  );
  padding: 6px;
  box-shadow: 0 24px 52px rgba(2, 8, 18, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
}

.fusion-pet-display-tool__menu--range {
  width: 104px;
  gap: 4px;
}

.fusion-pet-display-tool__menu--unit {
  min-width: 168px;
}

.fusion-pet-display-tool__range-max-input {
  width: 100%;
  min-width: 0;
  height: 30px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 90%, black 5%);
  color: var(--theme-text-primary);
  padding: 0 9px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.fusion-pet-display-tool__range-max-input:focus {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 22%, transparent);
}

.fusion-pet-display-tool__menu-option {
  position: relative;
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  appearance: none;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  padding: 6px 10px;
  color: var(--theme-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.fusion-pet-display-tool__menu-option:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 20%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
  color: var(--theme-text-primary);
}

.fusion-pet-display-tool__menu-option--active {
  border-color: color-mix(in srgb, var(--theme-accent) 28%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-accent) 16%, transparent),
    color-mix(in srgb, var(--theme-accent) 10%, transparent)
  );
  color: var(--theme-text-primary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.fusion-pet-display-tool__range-option {
  min-height: 30px;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
}

.fusion-pet-display-tool__unit-option {
  min-height: 34px;
}

.fusion-pet-display-tool__menu-option-rail {
  position: absolute;
  inset: 6px auto 6px 4px;
  width: 2px;
  border-radius: 999px;
  background: var(--theme-accent);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.fusion-pet-display-tool__menu-option--active .fusion-pet-display-tool__menu-option-rail {
  opacity: 0.9;
}
</style>
