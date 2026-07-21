<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../AppIcon.vue'
import LayoutMenuPanel from './LayoutMenuPanel.vue'
import MprLayoutMenuPanel from './MprLayoutMenuPanel.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import type { ViewerTabItem } from '../../../types/viewer'
import {
  isStackToolOptionSelected,
  resolveStackToolOptionSelectionMode,
  type StackTool,
  type StackToolOption
} from './toolbarTypes'

const props = defineProps<{
  activeTab: ViewerTabItem
  docked?: boolean
  menuIconSize: number
  stackToolSelections: Partial<Record<string, string>>
  tool: StackTool
}>()

const emit = defineEmits<{
  select: [optionValue: string]
}>()

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

function parsePlaybackFps(value: string): number | null {
  const match = value.match(/^playbackFps:(\d+)$/)
  return match ? Number(match[1]) : null
}

const playbackFpsOptions = computed(() =>
  (props.tool.options ?? [])
    .map((option) => ({ ...option, fps: parsePlaybackFps(option.value) }))
    .filter((option): option is typeof option & { fps: number } => Number.isFinite(option.fps))
)
const playbackSelectedIndex = computed(() => {
  const selectedValue = props.stackToolSelections[props.tool.key]
  const selectedIndex = playbackFpsOptions.value.findIndex((option) => option.value === selectedValue)
  if (selectedIndex >= 0) {
    return selectedIndex
  }
  const defaultIndex = playbackFpsOptions.value.findIndex((option) => option.fps === 5)
  return defaultIndex >= 0 ? defaultIndex : 0
})
const playbackSliderMax = computed(() => Math.max(0, playbackFpsOptions.value.length - 1))
const playbackSelectedFps = computed(() => playbackFpsOptions.value[playbackSelectedIndex.value]?.fps ?? 5)

function selectPlaybackIndex(index: number): void {
  const clampedIndex = Math.max(0, Math.min(playbackSliderMax.value, Math.round(index)))
  const option = playbackFpsOptions.value[clampedIndex]
  if (option) {
    emit('select', option.value)
  }
}

function handlePlaybackSliderInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement | null)?.value ?? playbackSelectedIndex.value)
  selectPlaybackIndex(Number.isFinite(value) ? value : playbackSelectedIndex.value)
}

function isVolumeOrientationOption(option: StackToolOption): boolean {
  return /^volumeOrientation:[APLRSI]$/.test(option.value)
}

function getVolumeOrientationInitial(option: StackToolOption): string {
  return (option.label.trim()[0] ?? '').toUpperCase()
}

function getVolumeOrientationSuffix(option: StackToolOption): string {
  return option.label.trim().slice(1).toLowerCase()
}

function isToolbarOptionActive(option: StackToolOption): boolean {
  return isStackToolOptionSelected(props.tool, option, props.stackToolSelections[props.tool.key])
}

const optionSelectionMode = computed(() => resolveStackToolOptionSelectionMode(props.tool))

function optionRole(): 'radio' | 'checkbox' | 'menuitem' {
  if (optionSelectionMode.value === 'single') return 'radio'
  if (optionSelectionMode.value === 'multiple') return 'checkbox'
  return 'menuitem'
}

function isDestructiveOption(option: StackToolOption): boolean {
  const value = option.value.toLowerCase()
  return value.startsWith('clear:')
    || value.startsWith('delete:')
    || value === 'reset:all'
    || value === 'reset:measurements'
    || value === 'reset:annotations'
    || value === 'reset:mtf'
    || value === 'reset:qa-water'
}
</script>

<template>
  <div
    data-tool-menu-root
    class="viewer-toolbar-menu-content theme-shell-panel relative inline-flex flex-col overflow-hidden border border-[color:color-mix(in_srgb,var(--theme-border-strong)_74%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card)_92%,white_4%),color-mix(in_srgb,var(--theme-surface-panel-solid)_94%,black_6%))] shadow-[0_24px_52px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
    :class="[
      tool.key === 'play'
        ? 'viewer-toolbar-menu-content--playback min-w-[120px] rounded-[18px] p-1.5'
        : 'min-w-[220px] max-w-[320px] rounded-[20px] p-1.5',
      {
        'toolbar-layout-menu': tool.menuKind === 'layout',
        'toolbar-mpr-layout-menu': tool.menuKind === 'mprLayout',
        'toolbar-display-menu': tool.key === 'display',
        'viewer-toolbar-menu-content--docked': docked
      }
    ]"
  >
    <div v-if="tool.key !== 'play'" class="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />

    <template v-if="tool.key === 'play'">
      <div class="viewer-toolbar-menu-content__playback-fps">
        <div class="viewer-toolbar-menu-content__playback-head">
          <span>FPS</span>
          <strong>{{ playbackSelectedFps }}</strong>
        </div>
        <input
          class="viewer-toolbar-menu-content__playback-slider"
          type="range"
          min="0"
          :max="playbackSliderMax"
          step="1"
          :value="playbackSelectedIndex"
          @change="handlePlaybackSliderInput"
          @input="handlePlaybackSliderInput"
        />
        <div class="viewer-toolbar-menu-content__playback-ticks">
          <button
            v-for="(option, optionIndex) in playbackFpsOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="optionIndex === playbackSelectedIndex"
            class="viewer-toolbar-menu-content__playback-tick"
            :class="{ 'viewer-toolbar-menu-content__playback-tick--active': optionIndex === playbackSelectedIndex }"
            @click="selectPlaybackIndex(optionIndex)"
          >
            {{ option.fps }}
          </button>
        </div>
      </div>
    </template>

    <template v-else-if="tool.menuKind === 'layout'">
      <LayoutMenuPanel
        :options="tool.options ?? []"
        :active-rows="getActiveLayoutRows(activeTab)"
        :active-columns="getActiveLayoutColumns(activeTab)"
        @select="emit('select', $event)"
      />
    </template>

    <template v-else-if="tool.menuKind === 'mprLayout'">
      <MprLayoutMenuPanel
        :options="tool.options ?? []"
        :active-value="stackToolSelections[tool.key]"
        @select="emit('select', $event)"
      />
    </template>

    <template v-else>
      <template
        v-for="(option, optionIndex) in tool.options ?? []"
        :key="option.value"
      >
        <div
          v-if="option.group && option.group !== tool.options?.[optionIndex - 1]?.group"
          class="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:color-mix(in_srgb,var(--theme-text-muted)_88%,white_10%)]"
        >
          {{ option.group }}
        </div>
        <button
          type="button"
          :role="optionRole()"
          :aria-checked="optionSelectionMode !== 'none' ? isToolbarOptionActive(option) : undefined"
          class="toolbar-menu-option group relative min-h-[var(--viewer-tool-option-min-height)] w-full appearance-none overflow-hidden rounded-lg! border border-transparent bg-transparent px-2.5! py-1.5! text-left! text-[13px]! text-[var(--theme-text-secondary)]! transition duration-150 hover:border-[color:color-mix(in_srgb,var(--theme-accent)_20%,transparent)]! hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_9%,transparent)]!"
          :class="{
            'toolbar-menu-option--active border-[var(--theme-selection-border)]! bg-[var(--theme-selection-surface)]! text-[var(--theme-text-primary)]! shadow-[var(--theme-selection-shadow)]!': isToolbarOptionActive(option),
            'toolbar-menu-option--destructive': isDestructiveOption(option)
          }"
          @click="emit('select', option.value)"
        >
          <div class="flex items-center justify-between gap-2.5">
            <div class="flex min-w-0 items-center gap-3">
              <div
                v-if="tool.key === 'pseudocolor' || option.icon"
                class="toolbar-menu-option__icon flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:color-mix(in_srgb,var(--theme-border-soft)_86%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card-soft)_92%,white_2%),color-mix(in_srgb,var(--theme-surface-panel-solid)_92%,black_4%))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition group-hover:border-[color:color-mix(in_srgb,var(--theme-accent)_18%,transparent)]"
                :class="{
                  'w-[46px] rounded-lg': tool.key === 'pseudocolor',
                  'border-[color:color-mix(in_srgb,var(--theme-accent)_26%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_14%,var(--theme-surface-card-soft)_86%),color-mix(in_srgb,var(--theme-accent)_10%,var(--theme-surface-panel-solid)_90%))]': isToolbarOptionActive(option)
                }"
              >
                <PseudocolorBand
                  v-if="tool.key === 'pseudocolor'"
                  compact
                  class="w-[36px] scale-[1.04]"
                  :preset="option.swatchKey ?? 'bw'"
                />
                <AppIcon
                  v-else-if="option.icon"
                  :name="option.icon"
                  :size="menuIconSize + 2"
                />
              </div>
              <div :class="tool.key === 'display' ? 'min-w-[4.75rem]' : 'min-w-0'">
                <div
                  class="whitespace-nowrap font-medium text-[var(--theme-text-primary)]"
                  :class="{ truncate: tool.key !== 'display' }"
                >
                  <span v-if="isVolumeOrientationOption(option)" class="volume-orientation-option-label">
                    <span class="volume-orientation-option-label__initial">{{ getVolumeOrientationInitial(option) }}</span>
                    <span class="volume-orientation-option-label__suffix">{{ getVolumeOrientationSuffix(option) }}</span>
                  </span>
                  <template v-else>{{ option.label }}</template>
                </div>
                <div v-if="option.description" class="mt-0.5 text-[11px] leading-[1.2] text-[var(--theme-text-muted)]">
                  {{ option.description }}
                </div>
              </div>
            </div>
            <span
              v-if="optionSelectionMode === 'multiple'"
              class="toolbar-menu-option__check grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:color-mix(in_srgb,var(--theme-border-soft)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card-soft)_92%,transparent)] text-[var(--theme-text-muted)]"
              :class="{ 'border-[color:color-mix(in_srgb,var(--theme-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_16%,transparent)] text-[var(--theme-accent)]': option.checked }"
            >
              <AppIcon v-if="option.checked" name="check" :size="14" />
            </span>
            <AppIcon
              v-else-if="optionSelectionMode === 'single' && isToolbarOptionActive(option)"
              name="check"
              class="toolbar-menu-option__selected-icon shrink-0 text-[var(--theme-accent)]"
              :size="16"
            />
            <span
              v-if="option.badge"
              class="toolbar-menu-option__badge shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--theme-border-soft)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card-soft)_94%,white_2%)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-text-muted)]"
            >
              {{ option.badge }}
            </span>
          </div>
        </button>
      </template>
      <div
        v-if="tool.footerOptions?.length"
        class="viewer-toolbar-menu-content__footer-actions"
      >
        <button
          v-for="option in tool.footerOptions"
          :key="option.value"
          type="button"
          class="toolbar-menu-option toolbar-menu-option--footer group relative min-h-[var(--viewer-tool-option-min-height)] w-full appearance-none overflow-hidden rounded-lg! border border-transparent bg-transparent px-2.5! py-1.5! text-left! text-[13px]! text-[var(--theme-text-secondary)]! transition duration-150 hover:border-[color:color-mix(in_srgb,var(--theme-accent)_20%,transparent)]! hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_9%,transparent)]!"
          :class="{ 'toolbar-menu-option--destructive': isDestructiveOption(option) }"
          @click="emit('select', option.value)"
        >
          <div class="flex items-center gap-3">
            <div
              v-if="option.icon"
              class="toolbar-menu-option__icon flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:color-mix(in_srgb,var(--theme-border-soft)_86%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card-soft)_92%,white_2%),color-mix(in_srgb,var(--theme-surface-panel-solid)_92%,black_4%))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition group-hover:border-[color:color-mix(in_srgb,var(--theme-accent)_18%,transparent)]"
            >
              <AppIcon :name="option.icon" :size="menuIconSize + 2" />
            </div>
            <div class="min-w-0">
              <div class="whitespace-nowrap font-medium text-[var(--theme-text-primary)]">
                {{ option.label }}
              </div>
              <div v-if="option.description" class="mt-0.5 text-[11px] leading-[1.2] text-[var(--theme-text-muted)]">
                {{ option.description }}
              </div>
            </div>
          </div>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.toolbar-layout-menu {
  width: min(232px, calc(100vw - 32px));
  max-width: min(232px, calc(100vw - 32px)) !important;
  padding: 0 !important;
}

.toolbar-mpr-layout-menu {
  width: min(220px, calc(100vw - 32px));
  max-width: min(220px, calc(100vw - 32px)) !important;
  min-width: 0 !important;
  padding: 0 !important;
}

.toolbar-display-menu {
  width: min(224px, calc(100vw - 32px));
  min-width: 0 !important;
  max-width: min(224px, calc(100vw - 32px)) !important;
}

.volume-orientation-option-label {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  letter-spacing: 0;
}

.volume-orientation-option-label__initial {
  color: var(--theme-text-primary);
  font-weight: 900;
}

.volume-orientation-option-label__suffix {
  color: var(--theme-text-muted);
  font-weight: 750;
  text-transform: lowercase;
}

.viewer-toolbar-menu-content__footer-actions {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
}

.toolbar-menu-option--footer {
  color: var(--theme-text-secondary) !important;
}

.toolbar-menu-option--destructive {
  border-color: color-mix(in srgb, var(--theme-danger) 34%, transparent) !important;
  color: var(--theme-danger) !important;
}

.toolbar-menu-option--destructive:hover,
.toolbar-menu-option--destructive:focus-visible {
  border-color: color-mix(in srgb, var(--theme-danger) 56%, transparent) !important;
  background: color-mix(in srgb, var(--theme-danger) 11%, transparent) !important;
}

.toolbar-menu-option--destructive .toolbar-menu-option__icon {
  border-color: color-mix(in srgb, var(--theme-danger) 34%, transparent) !important;
  color: var(--theme-danger);
}

.viewer-toolbar-menu-content__playback-fps {
  display: grid;
  gap: 9px;
  min-width: 168px;
  padding: 8px;
}

.viewer-toolbar-menu-content__playback-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.viewer-toolbar-menu-content__playback-head strong {
  color: var(--theme-text-primary);
  font-size: 16px;
  letter-spacing: 0;
}

.viewer-toolbar-menu-content__playback-slider {
  width: 100%;
  min-width: 0;
  accent-color: var(--theme-accent);
}

.viewer-toolbar-menu-content__playback-ticks {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 5px;
}

.viewer-toolbar-menu-content__playback-tick {
  min-height: 28px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 62%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 84%, transparent);
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 850;
}

.viewer-toolbar-menu-content__playback-tick--active {
  border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card-soft));
  color: var(--theme-text-primary);
}

.viewer-toolbar-menu-content--docked {
  width: 100% !important;
  min-width: 0 !important;
  max-width: none !important;
  border-radius: 14px !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 12px 26px rgba(0, 0, 0, 0.18) !important;
}
</style>
