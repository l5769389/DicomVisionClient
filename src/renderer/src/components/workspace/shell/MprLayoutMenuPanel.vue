<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../AppIcon.vue'
import {
  DEFAULT_MPR_LAYOUT_KEY,
  parseMprLayoutSelectionValue,
  toMprLayoutSelectionValue
} from '../../../composables/workspace/layout/mprLayoutOptions'
import type { MprLayoutKey } from '../../../types/viewer'
import type { StackToolOption } from './toolbarTypes'

interface MprLayoutIconCell {
  row: number
  column: number
  rowSpan?: number
  columnSpan?: number
  accent?: boolean
}

interface MprLayoutIconConfig {
  rows: number
  columns: number
  cells: MprLayoutIconCell[]
}

const props = defineProps<{
  options: StackToolOption[]
  activeValue?: string | null
}>()

const emit = defineEmits<{
  select: [optionValue: string]
}>()

const activeKey = computed(() => parseMprLayoutSelectionValue(props.activeValue) ?? DEFAULT_MPR_LAYOUT_KEY)

const iconConfigs: Record<MprLayoutKey, MprLayoutIconConfig> = {
  'three-columns': {
    rows: 1,
    columns: 3,
    cells: [
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 1, column: 3 }
    ]
  },
  'right-primary': {
    rows: 2,
    columns: 2,
    cells: [
      { row: 1, column: 1 },
      { row: 2, column: 1 },
      { row: 1, column: 2, rowSpan: 2 }
    ]
  },
  'three-rows': {
    rows: 3,
    columns: 1,
    cells: [
      { row: 1, column: 1 },
      { row: 2, column: 1 },
      { row: 3, column: 1 }
    ]
  },
  quad: {
    rows: 2,
    columns: 2,
    cells: [
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 2, column: 1 }
    ]
  },
  'mpr-3d': {
    rows: 2,
    columns: 2,
    cells: [
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 2, column: 1 },
      { row: 2, column: 2, accent: true }
    ]
  }
}

function getOptionKey(option: StackToolOption): MprLayoutKey {
  return option.mprLayoutKey ?? parseMprLayoutSelectionValue(option.value) ?? DEFAULT_MPR_LAYOUT_KEY
}

function getIconConfig(option: StackToolOption): MprLayoutIconConfig {
  return iconConfigs[getOptionKey(option)]
}

function isActive(option: StackToolOption): boolean {
  return getOptionKey(option) === activeKey.value
}

function selectOption(option: StackToolOption): void {
  if (option.disabled) {
    return
  }

  emit('select', option.value || toMprLayoutSelectionValue(getOptionKey(option)))
}
</script>

<template>
  <div class="mpr-layout-menu-panel">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="isActive(option)"
      class="mpr-layout-option"
      :class="{
        'mpr-layout-option--active': isActive(option),
        'mpr-layout-option--disabled': option.disabled
      }"
      :disabled="option.disabled"
      :title="option.label"
      @click="selectOption(option)"
    >
      <span
        class="mpr-layout-icon"
        :style="{
          gridTemplateColumns: `repeat(${getIconConfig(option).columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${getIconConfig(option).rows}, minmax(0, 1fr))`
        }"
      >
        <span
          v-for="(cell, index) in getIconConfig(option).cells"
          :key="`${option.value}-${index}`"
          class="mpr-layout-icon__cell"
          :class="{ 'mpr-layout-icon__cell--accent': cell.accent }"
          :style="{
            gridColumn: `${cell.column} / span ${cell.columnSpan ?? 1}`,
            gridRow: `${cell.row} / span ${cell.rowSpan ?? 1}`
          }"
        />
      </span>
      <span v-if="isActive(option)" class="mpr-layout-option__check" aria-hidden="true">
        <AppIcon name="check" :size="10" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.mpr-layout-menu-panel {
  display: grid;
  grid-template-columns: repeat(4, 32px);
  gap: 10px 12px;
  padding: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 64%, transparent);
}

.mpr-layout-option {
  position: relative;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: color-mix(in srgb, var(--theme-text-secondary) 88%, var(--theme-text-primary));
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    opacity 120ms ease;
}

.mpr-layout-option:hover,
.mpr-layout-option:focus-visible {
  border-color: transparent;
  background: color-mix(in srgb, var(--theme-text-primary) 8%, var(--theme-surface-muted));
  color: var(--theme-text-primary);
  outline: none;
}

.mpr-layout-option--active {
  border-color: color-mix(in srgb, var(--theme-accent) 42%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-muted));
  color: var(--theme-text-primary);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 22%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 9%, transparent);
}

.mpr-layout-option__check {
  position: absolute;
  right: 2px;
  top: 2px;
  display: grid;
  width: 14px;
  height: 14px;
  place-items: center;
  border-radius: 999px;
  background: var(--theme-accent);
  color: var(--theme-accent-contrast);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
}

.mpr-layout-option--disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.mpr-layout-option--disabled:hover,
.mpr-layout-option--disabled:focus-visible {
  background: transparent;
  color: color-mix(in srgb, var(--theme-text-secondary) 88%, var(--theme-text-primary));
}

.mpr-layout-icon {
  display: grid;
  width: 24px;
  height: 24px;
  gap: 2px;
}

.mpr-layout-icon__cell {
  min-width: 0;
  min-height: 0;
  border: 1.45px solid currentColor;
  border-radius: 1px;
  opacity: 0.9;
}

.mpr-layout-icon__cell--accent {
  border-color: var(--theme-accent-warm, #f97316);
  background: var(--theme-accent-warm, #f97316);
  opacity: 1;
}
</style>
