<script setup lang="ts">
import { computed, ref } from 'vue'
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

const defaultCustomLayout = { rows: 2, columns: 2 }
const previewLayout = ref<{ rows: number; columns: number } | null>(null)
const activeLayout = computed(() => normalizeLayoutSize(props.activeRows, props.activeColumns) ?? defaultCustomLayout)
const displayedLayout = computed(() => previewLayout.value ?? activeLayout.value)
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

function getLayoutIconCells(option: StackToolOption): number[] {
  return Array.from({ length: getLayoutOptionRows(option) * getLayoutOptionColumns(option) }, (_, index) => index)
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

function isPresetLayoutActive(option: StackToolOption): boolean {
  return isSameLayout(getLayoutOptionRows(option), getLayoutOptionColumns(option))
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
        v-for="option in options"
        :key="option.value"
        type="button"
        class="layout-preset-button"
        :class="{ 'layout-preset-button--active': isPresetLayoutActive(option) }"
        :title="option.label"
        @mouseenter="setPreviewLayout(getLayoutOptionRows(option), getLayoutOptionColumns(option))"
        @focus="setPreviewLayout(getLayoutOptionRows(option), getLayoutOptionColumns(option))"
        @blur="clearPreviewLayout"
        @click="emit('select', option.value)"
      >
        <span
          class="layout-preset-icon"
          :style="{
            gridTemplateColumns: `repeat(${getLayoutOptionColumns(option)}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${getLayoutOptionRows(option)}, minmax(0, 1fr))`
          }"
        >
          <span
            v-for="cell in getLayoutIconCells(option)"
            :key="cell"
            class="layout-preset-icon__cell"
          />
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
  gap: 16px 22px;
  padding: 20px 28px 18px;
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
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 11px;
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
.layout-preset-button--active {
  border-color: transparent;
  background: color-mix(in srgb, var(--theme-text-primary) 10%, var(--theme-surface-muted));
  color: var(--theme-text-primary);
  outline: none;
}

.layout-preset-button--active {
  background: color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-muted));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

.layout-preset-button:active {
  transform: translateY(1px);
}

.layout-preset-icon {
  display: grid;
  width: 31px;
  height: 31px;
  gap: 2px;
}

.layout-preset-icon__cell {
  min-width: 0;
  min-height: 0;
  border: 2px solid currentColor;
  border-radius: 1px;
  opacity: 0.9;
}

.layout-custom-grid {
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--theme-surface-panel) 72%, transparent);
}

.layout-custom-cell {
  aspect-ratio: 1 / 1;
  min-height: 40px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong) 78%, transparent);
  cursor: pointer;
  transition:
    background 90ms ease,
    border-color 90ms ease;
}

.layout-custom-cell--active {
  border-color: color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 36%, var(--theme-surface-card));
}

.layout-custom-cell:focus-visible {
  outline: none;
  box-shadow: var(--theme-focus-ring);
}

.layout-custom-label {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 74%, transparent);
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
</style>
