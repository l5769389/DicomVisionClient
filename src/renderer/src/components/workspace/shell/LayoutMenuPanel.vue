<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { StackToolOption } from './toolbarTypes'
import {
  VIEWER_LAYOUT_CUSTOM_GRID_SIZE,
  createCustomViewerLayoutOptionValue
} from '../../../composables/workspace/layout/viewerLayoutTemplates'

const props = defineProps<{
  options: StackToolOption[]
  activeRows?: number | null
  activeColumns?: number | null
}>()

const emit = defineEmits<{
  select: [optionValue: string]
}>()

interface LayoutPresetOption {
  value: string
  label: string
  rows: number
  columns: number
  cells: number[]
}

const defaultCustomLayout = { rows: 2, columns: 2 }
const previewLayout = ref<{ rows: number; columns: number } | null>(null)
const activeLayout = computed(() => normalizeLayoutSize(props.activeRows, props.activeColumns) ?? defaultCustomLayout)
const displayedLayout = computed(() => previewLayout.value ?? activeLayout.value)
const presetOptions = computed<LayoutPresetOption[]>(() =>
  props.options.map((option) => {
    const rows = getLayoutOptionRows(option)
    const columns = getLayoutOptionColumns(option)

    return {
      value: option.value,
      label: option.label,
      rows,
      columns,
      cells: Array.from({ length: rows * columns }, (_, index) => index)
    }
  })
)
const customGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${VIEWER_LAYOUT_CUSTOM_GRID_SIZE}, minmax(0, 1fr))`
}))
const customLayoutCells = computed(() =>
  Array.from({ length: VIEWER_LAYOUT_CUSTOM_GRID_SIZE * VIEWER_LAYOUT_CUSTOM_GRID_SIZE }, (_, index) => ({
    row: Math.floor(index / VIEWER_LAYOUT_CUSTOM_GRID_SIZE) + 1,
    column: (index % VIEWER_LAYOUT_CUSTOM_GRID_SIZE) + 1
  }))
)

function getLayoutOptionRows(option: StackToolOption): number {
  return Math.max(1, option.layoutRows ?? 1)
}

function getLayoutOptionColumns(option: StackToolOption): number {
  return Math.max(1, option.layoutColumns ?? 1)
}

function normalizeLayoutSize(rows?: number | null, columns?: number | null): { rows: number; columns: number } | null {
  if (!Number.isFinite(rows) || !Number.isFinite(columns)) {
    return null
  }

  return {
    rows: Math.min(VIEWER_LAYOUT_CUSTOM_GRID_SIZE, Math.max(1, Math.trunc(rows as number))),
    columns: Math.min(VIEWER_LAYOUT_CUSTOM_GRID_SIZE, Math.max(1, Math.trunc(columns as number)))
  }
}

function isSameLayout(rows: number, columns: number, target = displayedLayout.value): boolean {
  return target.rows === rows && target.columns === columns
}

function isPresetLayoutActive(option: LayoutPresetOption): boolean {
  return isSameLayout(option.rows, option.columns, activeLayout.value)
}

function isPresetLayoutPreview(option: LayoutPresetOption): boolean {
  return Boolean(previewLayout.value && isSameLayout(option.rows, option.columns))
}

function isCustomLayoutCellActive(row: number, column: number): boolean {
  const layout = displayedLayout.value
  return row <= layout.rows && column <= layout.columns
}

function setPreviewLayout(row: number, column: number): void {
  previewLayout.value = normalizeLayoutSize(row, column) ?? defaultCustomLayout
}

function clearPreviewLayout(): void {
  previewLayout.value = null
}
</script>

<template>
  <div class="layout-menu-panel">
    <div class="layout-preset-grid" @mouseleave="clearPreviewLayout">
      <button
        v-for="option in presetOptions"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="isPresetLayoutActive(option)"
        class="layout-preset-button"
        :class="{
          'layout-preset-button--active': isPresetLayoutActive(option),
          'layout-preset-button--preview': isPresetLayoutPreview(option)
        }"
        :title="option.label"
        @mouseenter="setPreviewLayout(option.rows, option.columns)"
        @focus="setPreviewLayout(option.rows, option.columns)"
        @blur="clearPreviewLayout"
        @click="emit('select', option.value)"
      >
        <span
          class="layout-preset-icon"
          :style="{
            gridTemplateColumns: `repeat(${option.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${option.rows}, minmax(0, 1fr))`
          }"
        >
          <span
            v-for="cell in option.cells"
            :key="cell"
            class="layout-preset-icon__cell"
          />
        </span>
        <span v-if="isPresetLayoutActive(option)" class="layout-preset-button__check" aria-hidden="true">
          <AppIcon name="check" :size="10" />
        </span>
      </button>
    </div>

    <div class="layout-custom-grid" :style="customGridStyle" @mouseleave="clearPreviewLayout">
      <button
        v-for="cell in customLayoutCells"
        :key="`${cell.row}-${cell.column}`"
        type="button"
        class="layout-custom-cell"
        :class="{ 'layout-custom-cell--active': isCustomLayoutCellActive(cell.row, cell.column) }"
        :title="`${cell.row} x ${cell.column}`"
        @mouseenter="setPreviewLayout(cell.row, cell.column)"
        @focus="setPreviewLayout(cell.row, cell.column)"
        @blur="clearPreviewLayout"
        @click="emit('select', createCustomViewerLayoutOptionValue(cell.row, cell.column))"
      />
    </div>
    <div class="layout-custom-label">{{ displayedLayout.rows }} x {{ displayedLayout.columns }}</div>
  </div>
</template>

<style scoped>
.layout-menu-panel {
  display: grid;
  gap: 0;
  overflow: hidden;
}

.layout-preset-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px 8px;
  padding: 8px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 62%, transparent);
}

.layout-preset-button,
.layout-custom-cell {
  appearance: none;
  border: 0;
  font: inherit;
}

.layout-preset-button {
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
    transform 120ms ease;
}

.layout-preset-button:hover,
.layout-preset-button:focus-visible,
.layout-preset-button--preview {
  border-color: transparent;
  background: color-mix(in srgb, var(--theme-text-primary) 8%, var(--theme-surface-muted));
  color: var(--theme-text-primary);
  outline: none;
}

.layout-preset-button--active {
  border-color: color-mix(in srgb, var(--theme-accent) 42%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-muted));
  color: var(--theme-text-primary);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 22%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 9%, transparent);
}

.layout-preset-button__check {
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

.layout-preset-button:active {
  transform: translateY(1px);
}

.layout-preset-icon {
  display: grid;
  width: 21px;
  height: 21px;
  gap: 1.5px;
}

.layout-preset-icon__cell {
  min-width: 0;
  min-height: 0;
  border: 1.35px solid currentColor;
  border-radius: 1px;
  opacity: 0.9;
}

.layout-custom-grid {
  display: grid;
  gap: 1.5px;
  padding: 4px 6px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 72%, transparent);
}

.layout-custom-cell {
  aspect-ratio: 1 / 1;
  min-height: 22px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 2px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 78%, transparent);
  cursor: pointer;
  transition:
    background 90ms ease,
    border-color 90ms ease;
}

.layout-custom-cell--active {
  border-color: color-mix(in srgb, var(--theme-accent) 50%, var(--theme-border-strong));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 20%, transparent), transparent 58%),
    color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 12%, transparent);
}

.layout-custom-cell:focus-visible {
  outline: none;
  box-shadow: var(--theme-focus-ring);
}

.layout-custom-label {
  display: flex;
  min-height: 20px;
  align-items: center;
  justify-content: center;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 74%, transparent);
  color: var(--theme-text-muted);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
</style>
