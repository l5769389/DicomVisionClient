<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../../AppIcon.vue'
import LayoutMenuPanel from './LayoutMenuPanel.vue'
import MprLayoutMenuPanel from './MprLayoutMenuPanel.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool, StackToolOption, StackToolOptionSelectBehavior } from './toolbarTypes'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const props = defineProps<{
  activeTab: ViewerTabItem
  isPlaybackPaused: boolean
  isPlaying: boolean
  menuIconSize: number
  stackToolSelections: Partial<Record<string, string>>
  tool: StackTool
}>()

const emit = defineEmits<{
  applyTool: [tool: StackTool, behavior?: StackToolOptionSelectBehavior]
  endPlayback: [behavior?: StackToolOptionSelectBehavior]
  pausePlayback: [behavior?: StackToolOptionSelectBehavior]
  select: [optionValue: string]
}>()

const { locale, toolbarCopy: copy } = useUiLocale()
const UNSELECTED_ACTION_MENU_TOOL_KEYS = new Set(['rotate', 'qa', 'export', 'reset'])
const customWindowWidth = ref('')
const customWindowLevel = ref('')
const isZh = computed(() => locale.value === 'zh-CN')
const customWindowCopy = computed(() => ({
  title: isZh.value ? '临时窗值' : 'Custom Window',
  description: isZh.value ? '输入 WW / WL 后立即应用到当前目标视图。' : 'Enter WW / WL and apply it to the current target view.',
  width: isZh.value ? '窗宽 WW' : 'WW',
  level: isZh.value ? '窗位 WL' : 'WL',
  apply: isZh.value ? '应用窗值' : 'Apply Window',
  invalid: isZh.value ? '请输入有效数字，窗宽需大于 0。' : 'Enter valid numbers. WW must be greater than 0.'
}))
const measureActionCopy = computed(() => ({
  clearMeasurements: isZh.value ? '清除测量' : 'Clear Measurements',
  clearMeasurementsDesc: isZh.value ? '移除当前目标视图中的测量结果。' : 'Remove measurements from the current target view.'
}))

function getActiveLayoutRows(activeTab: ViewerTabItem): number {
  if (activeTab.viewType === 'Layout') {
    return activeTab.layoutTemplate?.rows ?? 1
  }
  return 1
}

function getActiveLayoutColumns(activeTab: ViewerTabItem): number {
  if (activeTab.viewType === 'Layout') {
    return activeTab.layoutTemplate?.columns ?? 1
  }
  return 1
}

function isOptionActive(option: StackToolOption): boolean {
  if (UNSELECTED_ACTION_MENU_TOOL_KEYS.has(props.tool.key)) {
    return false
  }
  return props.stackToolSelections[props.tool.key] === option.value || option.checked === true
}

function getSelectedPlaybackFps(value: string | undefined): string {
  const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
  return match?.[1] ?? '5'
}

function parsePlaybackFpsOption(value: string | null | undefined): number | null {
  const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
  const fps = match ? Number(match[1]) : Number.NaN
  return Number.isFinite(fps) ? fps : null
}

const playbackFpsOptions = computed(() =>
  (props.tool.options ?? [])
    .map((option) => ({
      ...option,
      fps: parsePlaybackFpsOption(option.value)
    }))
    .filter((option): option is StackToolOption & { fps: number } => option.fps !== null)
)
const playbackFpsIndex = computed(() => {
  const selectedValue = props.stackToolSelections.play
  const selectedIndex = playbackFpsOptions.value.findIndex((option) => option.value === selectedValue)
  return selectedIndex >= 0 ? selectedIndex : Math.max(0, playbackFpsOptions.value.findIndex((option) => option.fps === 5))
})
const playbackFpsSliderMax = computed(() => Math.max(0, playbackFpsOptions.value.length - 1))

function selectPlaybackFpsIndex(index: number): void {
  const option = playbackFpsOptions.value[Math.max(0, Math.min(playbackFpsSliderMax.value, Math.round(index)))]
  if (option) {
    emit('select', option.value)
  }
}

function handlePlaybackFpsSliderInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement | null)?.value ?? playbackFpsIndex.value)
  selectPlaybackFpsIndex(value)
}

function parseCustomWindowValue(value: string | number | null | undefined): number | null {
  const parsed = Number.parseFloat(String(value ?? '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

const customWindowWidthValue = computed(() => parseCustomWindowValue(customWindowWidth.value))
const customWindowLevelValue = computed(() => parseCustomWindowValue(customWindowLevel.value))
const canApplyCustomWindow = computed(() => {
  const width = customWindowWidthValue.value
  return width !== null && width > 0 && customWindowLevelValue.value !== null
})

function applyCustomWindow(): void {
  const width = customWindowWidthValue.value
  const level = customWindowLevelValue.value
  if (width === null || level === null || width <= 0) {
    return
  }
  emit('select', `${width}|${level}`)
}
</script>

<template>
  <div class="viewer-toolbar-dock-panel-content" :class="`viewer-toolbar-dock-panel-content--${tool.key}`">
    <template v-if="tool.key === 'play'">
      <div class="viewer-toolbar-dock-panel-content__playback">
        <button
          type="button"
          class="viewer-toolbar-dock-panel-content__primary-action"
          :title="isPlaying ? copy.pausePlayback : isPlaybackPaused ? copy.resumePlayback : tool.label"
          @click="isPlaying || isPlaybackPaused ? emit('pausePlayback', { keepMenuOpen: true }) : emit('applyTool', tool, { keepMenuOpen: true })"
        >
          <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="18" />
          <span>{{ isPlaying ? copy.pausePlayback : isPlaybackPaused ? copy.resumePlayback : tool.label }}</span>
        </button>
        <button
          type="button"
          class="viewer-toolbar-dock-panel-content__secondary-action"
          :disabled="!isPlaying && !isPlaybackPaused"
          :title="copy.stopPlayback"
          @click="emit('endPlayback', { keepMenuOpen: true })"
        >
          <AppIcon name="stop" :size="17" />
          <span>{{ copy.stopPlayback }}</span>
        </button>
      </div>
      <div class="viewer-toolbar-dock-panel-content__section-label">FPS</div>
      <div class="viewer-toolbar-dock-panel-content__fps-slider">
        <input
          type="range"
          min="0"
          :max="playbackFpsSliderMax"
          step="1"
          :value="playbackFpsIndex"
          :aria-valuetext="`FPS ${getSelectedPlaybackFps(stackToolSelections.play)}`"
          @input="handlePlaybackFpsSliderInput"
        />
        <div class="viewer-toolbar-dock-panel-content__fps-ticks">
          <button
            v-for="(option, optionIndex) in playbackFpsOptions"
            :key="option.value"
            type="button"
            class="viewer-toolbar-dock-panel-content__fps-tick"
            :class="{ 'viewer-toolbar-dock-panel-content__fps-tick--active': optionIndex === playbackFpsIndex }"
            @click="selectPlaybackFpsIndex(optionIndex)"
          >
            {{ option.fps }}
          </button>
        </div>
      </div>
      <div class="viewer-toolbar-dock-panel-content__current">FPS {{ getSelectedPlaybackFps(stackToolSelections.play) }}</div>
    </template>

    <template v-else-if="tool.menuKind === 'layout'">
      <div class="viewer-toolbar-dock-panel-content__layout">
        <LayoutMenuPanel
          :options="tool.options ?? []"
          :active-rows="getActiveLayoutRows(activeTab)"
          :active-columns="getActiveLayoutColumns(activeTab)"
          @select="emit('select', $event)"
        />
      </div>
    </template>

    <template v-else-if="tool.menuKind === 'mprLayout'">
      <div class="viewer-toolbar-dock-panel-content__layout">
        <MprLayoutMenuPanel
          :options="tool.options ?? []"
          :active-value="stackToolSelections[tool.key]"
          @select="emit('select', $event)"
        />
      </div>
    </template>

    <template v-else>
      <div class="viewer-toolbar-dock-panel-content__options">
        <form
          v-if="tool.key === 'window'"
          class="viewer-toolbar-dock-panel-content__custom-window"
          @submit.prevent="applyCustomWindow"
        >
          <div class="viewer-toolbar-dock-panel-content__custom-window-header">
            <div>
              <div class="viewer-toolbar-dock-panel-content__custom-window-title">{{ customWindowCopy.title }}</div>
              <p class="viewer-toolbar-dock-panel-content__custom-window-description">{{ customWindowCopy.description }}</p>
            </div>
          </div>
          <div class="viewer-toolbar-dock-panel-content__custom-window-grid">
            <label class="viewer-toolbar-dock-panel-content__custom-window-field">
              <span>{{ customWindowCopy.width }}</span>
              <input
                v-model="customWindowWidth"
                type="number"
                inputmode="decimal"
                step="any"
                min="0.000001"
                placeholder="400"
              />
            </label>
            <label class="viewer-toolbar-dock-panel-content__custom-window-field">
              <span>{{ customWindowCopy.level }}</span>
              <input
                v-model="customWindowLevel"
                type="number"
                inputmode="decimal"
                step="any"
                placeholder="40"
              />
            </label>
          </div>
          <button
            type="submit"
            class="viewer-toolbar-dock-panel-content__custom-window-apply"
            :disabled="!canApplyCustomWindow"
          >
            <AppIcon name="check" :size="14" />
            <span>{{ customWindowCopy.apply }}</span>
          </button>
          <p
            v-if="customWindowWidth || customWindowLevel"
            class="viewer-toolbar-dock-panel-content__custom-window-validation"
            :class="{ 'viewer-toolbar-dock-panel-content__custom-window-validation--ready': canApplyCustomWindow }"
          >
            {{ canApplyCustomWindow ? `WW ${customWindowWidthValue} / WL ${customWindowLevelValue}` : customWindowCopy.invalid }}
          </p>
        </form>
        <button
          v-if="tool.key === 'measure'"
          type="button"
          class="viewer-toolbar-dock-panel-content__measure-reset"
          @click="emit('select', 'reset:measurements')"
        >
          <span class="viewer-toolbar-dock-panel-content__measure-reset-icon">
            <AppIcon name="reset" :size="16" />
          </span>
          <span class="viewer-toolbar-dock-panel-content__measure-reset-copy">
            <span class="viewer-toolbar-dock-panel-content__measure-reset-label">{{ measureActionCopy.clearMeasurements }}</span>
            <span class="viewer-toolbar-dock-panel-content__measure-reset-description">{{ measureActionCopy.clearMeasurementsDesc }}</span>
          </span>
        </button>
        <template
          v-for="(option, optionIndex) in tool.options ?? []"
          :key="option.value"
        >
          <div
            v-if="option.group && option.group !== tool.options?.[optionIndex - 1]?.group"
            class="viewer-toolbar-dock-panel-content__group-label"
          >
            {{ option.group }}
          </div>
          <button
            type="button"
            class="viewer-toolbar-dock-panel-content__option"
            :class="{
              'viewer-toolbar-dock-panel-content__option--active': isOptionActive(option),
              'viewer-toolbar-dock-panel-content__option--disabled': option.disabled
            }"
            :disabled="option.disabled"
            @click="emit('select', option.value)"
          >
            <span class="viewer-toolbar-dock-panel-content__option-rail" aria-hidden="true"></span>
            <span
              class="viewer-toolbar-dock-panel-content__option-icon"
              :class="{ 'viewer-toolbar-dock-panel-content__option-icon--wide': tool.key === 'pseudocolor' }"
            >
              <PseudocolorBand
                v-if="tool.key === 'pseudocolor'"
                compact
                class="viewer-toolbar-dock-panel-content__pseudocolor-band"
                :preset="option.swatchKey ?? 'bw'"
              />
              <AppIcon
                v-else
                :name="option.icon"
                :size="menuIconSize + 2"
              />
            </span>
            <span class="viewer-toolbar-dock-panel-content__option-copy">
              <span class="viewer-toolbar-dock-panel-content__option-label">{{ option.label }}</span>
              <span v-if="option.description" class="viewer-toolbar-dock-panel-content__option-description">{{ option.description }}</span>
            </span>
            <span
              v-if="tool.key === 'compareSync' || tool.key === 'display'"
              class="viewer-toolbar-dock-panel-content__check"
              :class="{ 'viewer-toolbar-dock-panel-content__check--active': option.checked }"
            >
              <AppIcon v-if="option.checked" name="check" :size="14" />
            </span>
            <span v-else-if="option.badge" class="viewer-toolbar-dock-panel-content__badge">{{ option.badge }}</span>
            <AppIcon
              v-else-if="isOptionActive(option)"
              name="check"
              class="viewer-toolbar-dock-panel-content__selected-icon"
              :size="15"
            />
          </button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.viewer-toolbar-dock-panel-content {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.viewer-toolbar-dock-panel-content__options {
  display: grid;
  align-content: start;
  gap: 8px;
}

.viewer-toolbar-dock-panel-content__custom-window {
  display: grid;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 56%, transparent);
  padding: 12px;
}

.viewer-toolbar-dock-panel-content__custom-window-title {
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 850;
}

.viewer-toolbar-dock-panel-content__custom-window-description {
  margin: 3px 0 0;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.viewer-toolbar-dock-panel-content__custom-window-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.viewer-toolbar-dock-panel-content__custom-window-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.viewer-toolbar-dock-panel-content__custom-window-field span {
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.viewer-toolbar-dock-panel-content__custom-window-field input {
  width: 100%;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 90%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 78%, transparent);
  padding: 9px 10px;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 800;
  outline: none;
  transition:
    border-color 150ms ease,
    background 150ms ease;
}

.viewer-toolbar-dock-panel-content__custom-window-field input:focus {
  border-color: color-mix(in srgb, var(--theme-accent) 50%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-surface-card));
}

.viewer-toolbar-dock-panel-content__custom-window-apply {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 46%, var(--theme-border-strong));
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 850;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    opacity 150ms ease;
}

.viewer-toolbar-dock-panel-content__custom-window-apply:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.viewer-toolbar-dock-panel-content__custom-window-apply:not(:disabled):hover,
.viewer-toolbar-dock-panel-content__custom-window-apply:not(:disabled):focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  outline: none;
}

.viewer-toolbar-dock-panel-content__custom-window-validation {
  margin: -2px 0 0;
  color: var(--theme-status-danger-text);
  font-size: 10.5px;
  line-height: 1.35;
}

.viewer-toolbar-dock-panel-content__custom-window-validation--ready {
  color: var(--theme-text-muted);
}

.viewer-toolbar-dock-panel-content__measure-reset {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  border: 1px solid color-mix(in srgb, var(--theme-status-danger) 30%, var(--theme-border-soft));
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-status-danger) 8%, var(--theme-surface-card));
  padding: 10px 12px;
  color: var(--theme-text-primary);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.viewer-toolbar-dock-panel-content__measure-reset:hover,
.viewer-toolbar-dock-panel-content__measure-reset:focus-visible {
  border-color: color-mix(in srgb, var(--theme-status-danger) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-status-danger) 13%, var(--theme-surface-card));
  outline: none;
}

.viewer-toolbar-dock-panel-content__measure-reset-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-status-danger) 32%, var(--theme-border-soft));
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-status-danger) 10%, transparent);
  color: var(--theme-status-danger-text);
}

.viewer-toolbar-dock-panel-content__measure-reset-copy {
  min-width: 0;
}

.viewer-toolbar-dock-panel-content__measure-reset-label,
.viewer-toolbar-dock-panel-content__measure-reset-description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock-panel-content__measure-reset-label {
  font-size: 13px;
  font-weight: 850;
}

.viewer-toolbar-dock-panel-content__measure-reset-description {
  margin-top: 2px;
  color: var(--theme-text-muted);
  font-size: 11px;
}

.viewer-toolbar-dock-panel-content__group-label,
.viewer-toolbar-dock-panel-content__section-label {
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.viewer-toolbar-dock-panel-content__group-label {
  padding: 4px 8px 0;
}

.viewer-toolbar-dock-panel-content__option {
  position: relative;
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  padding: 10px 12px;
  color: var(--theme-text-secondary);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    opacity 150ms ease;
}

.viewer-toolbar-dock-panel-content__option:hover,
.viewer-toolbar-dock-panel-content__option:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 22%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
  color: var(--theme-text-primary);
  outline: none;
}

.viewer-toolbar-dock-panel-content__option--active {
  border-color: color-mix(in srgb, var(--theme-accent) 32%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock-panel-content__option--disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.viewer-toolbar-dock-panel-content__option-rail {
  position: absolute;
  inset-block: 10px;
  left: 0;
  width: 3px;
  border-radius: 999px;
  background: var(--theme-accent);
  opacity: 0;
}

.viewer-toolbar-dock-panel-content__option--active .viewer-toolbar-dock-panel-content__option-rail {
  opacity: 1;
}

.viewer-toolbar-dock-panel-content__option-icon,
.viewer-toolbar-dock-panel-content__check {
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 76%, transparent);
}

.viewer-toolbar-dock-panel-content__option-icon {
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: 12px;
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock-panel-content__option-icon--wide {
  width: 52px;
}

.viewer-toolbar-dock-panel-content__pseudocolor-band {
  width: 42px;
}

.viewer-toolbar-dock-panel-content__option-copy {
  min-width: 0;
}

.viewer-toolbar-dock-panel-content__option-label {
  display: block;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock-panel-content__option-description {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock-panel-content__check {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  color: var(--theme-text-muted);
}

.viewer-toolbar-dock-panel-content__check--active {
  border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 16%, transparent);
  color: var(--theme-accent);
}

.viewer-toolbar-dock-panel-content__badge {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  padding: 3px 7px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
}

.viewer-toolbar-dock-panel-content__selected-icon {
  color: var(--theme-accent);
}

.viewer-toolbar-dock-panel-content__layout {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 50%, transparent);
}

.viewer-toolbar-dock-panel-content__layout :deep(.layout-menu-panel),
.viewer-toolbar-dock-panel-content__layout :deep(.mpr-layout-menu-panel) {
  background: transparent;
}

.viewer-toolbar-dock-panel-content__layout :deep(.layout-preset-grid),
.viewer-toolbar-dock-panel-content__layout :deep(.layout-custom-grid) {
  background: transparent;
}

.viewer-toolbar-dock-panel-content__layout :deep(.mpr-layout-menu-panel) {
  grid-template-columns: repeat(5, 32px);
  justify-content: center;
}

.viewer-toolbar-dock-panel-content__playback {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.viewer-toolbar-dock-panel-content__primary-action,
.viewer-toolbar-dock-panel-content__secondary-action,
.viewer-toolbar-dock-panel-content__chip {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
  color: var(--theme-text-primary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    opacity 150ms ease;
}

.viewer-toolbar-dock-panel-content__primary-action,
.viewer-toolbar-dock-panel-content__secondary-action {
  display: inline-flex;
  min-width: 0;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 800;
}

.viewer-toolbar-dock-panel-content__primary-action {
  border-color: color-mix(in srgb, var(--theme-accent) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-card));
}

.viewer-toolbar-dock-panel-content__secondary-action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.viewer-toolbar-dock-panel-content__section-label {
  margin-top: 14px;
  padding: 0 4px;
}

.viewer-toolbar-dock-panel-content__fps-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.viewer-toolbar-dock-panel-content__fps-slider {
  display: grid;
  gap: 10px;
  margin-top: 9px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 54%, transparent);
  padding: 12px;
}

.viewer-toolbar-dock-panel-content__fps-slider input[type='range'] {
  width: 100%;
  accent-color: var(--theme-accent);
}

.viewer-toolbar-dock-panel-content__fps-ticks {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 5px;
}

.viewer-toolbar-dock-panel-content__fps-tick {
  min-width: 0;
  min-height: 28px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 850;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.viewer-toolbar-dock-panel-content__fps-tick:hover,
.viewer-toolbar-dock-panel-content__fps-tick:focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
  outline: none;
}

.viewer-toolbar-dock-panel-content__fps-tick--active {
  border-color: color-mix(in srgb, var(--theme-accent) 44%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock-panel-content__chip {
  min-height: 34px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 900;
}

.viewer-toolbar-dock-panel-content__chip:hover,
.viewer-toolbar-dock-panel-content__chip:focus-visible,
.viewer-toolbar-dock-panel-content__primary-action:hover,
.viewer-toolbar-dock-panel-content__secondary-action:not(:disabled):hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  outline: none;
}

.viewer-toolbar-dock-panel-content__chip--active {
  border-color: color-mix(in srgb, var(--theme-accent) 44%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock-panel-content__current {
  margin-top: 10px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
  text-align: center;
}
</style>
