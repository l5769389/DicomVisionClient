<script setup lang="ts">
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

const { toolbarCopy: copy } = useUiLocale()

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
  return props.stackToolSelections[props.tool.key] === option.value || option.checked === true
}

function getSelectedPlaybackFps(value: string | undefined): string {
  const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
  return match?.[1] ?? '5'
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
      <div class="viewer-toolbar-dock-panel-content__fps-grid">
        <button
          v-for="option in tool.options ?? []"
          :key="option.value"
          type="button"
          class="viewer-toolbar-dock-panel-content__chip"
          :class="{ 'viewer-toolbar-dock-panel-content__chip--active': stackToolSelections[tool.key] === option.value }"
          @click="emit('select', option.value)"
        >
          {{ option.label.replace(/^FPS\s*/i, '') }}
        </button>
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
