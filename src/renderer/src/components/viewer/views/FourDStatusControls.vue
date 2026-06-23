<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { FourDPhaseItem } from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

type FourDPhaseVisualState = 'unloaded' | 'loading' | 'loaded' | 'error'
type FourDPhaseRuntimeKind = 'idle' | 'ready' | 'loading' | 'playing' | 'error'

const props = defineProps<{
  externalPlaybackLocked?: boolean
  interactionLocked: boolean
  isPlaying: boolean
  layout?: 'top' | 'dock'
  normalizedFps: number
  normalizedPhaseIndex: number
  phaseItems: FourDPhaseItem[]
  phaseLoadProgressLabel: string
  phaseRuntimeKind: FourDPhaseRuntimeKind
  phaseStatusAriaLabel: string
  phaseVisualStates: Record<number, FourDPhaseVisualState>
  playbackButtonDisabled: boolean
  playbackButtonLabel: string
  playbackButtonTitle: string
  playbackProgress: string
  showPhasePanel?: boolean
  showPlaybackControls?: boolean
  showTabStripToggle?: boolean
  isTabStripCollapsed?: boolean
}>()

const emit = defineEmits<{
  fpsChange: [fps: number]
  phaseChange: [phaseIndex: number]
  playbackToggle: []
  toggleTabStrip: []
}>()

const fpsMenuOpen = ref(false)
const { toolbarCopy, viewerCopy } = useUiLocale()
const copy = computed(() => viewerCopy.value)
const toolbarCopyValue = computed(() => toolbarCopy.value)
const FPS_OPTIONS = [1, 2, 5, 10, 15, 30] as const
const controlsLocked = computed(() => props.interactionLocked || props.externalPlaybackLocked === true)

watch(
  controlsLocked,
  (value) => {
    if (value) {
      fpsMenuOpen.value = false
    }
  }
)

function selectFps(value: number): void {
  fpsMenuOpen.value = false
  emit('fpsChange', value)
}
</script>

<template>
  <div class="four-d-status-controls" :class="{ 'four-d-status-controls--dock': layout === 'dock' }">
    <div v-if="showPlaybackControls" class="four-d-playback-controls">
      <VMenu
        :model-value="fpsMenuOpen"
        location="bottom end"
        :offset="8"
        :close-on-content-click="true"
        @update:model-value="fpsMenuOpen = $event"
      >
        <template #activator="{ props: menuProps }">
          <button
            v-bind="menuProps"
            class="four-d-fps-button"
            type="button"
            :disabled="controlsLocked"
            :aria-expanded="fpsMenuOpen"
            title="4D playback FPS"
          >
            <span class="four-d-fps-button__label">FPS</span>
            <span class="four-d-fps-button__value">{{ normalizedFps }}</span>
            <AppIcon name="chevron-down" :size="12" :stroke-width="2.2" />
          </button>
        </template>

        <div
          data-tool-menu-root
          class="theme-shell-panel relative inline-flex min-w-[120px] flex-col overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--theme-border-strong)_74%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card)_92%,white_4%),color-mix(in_srgb,var(--theme-surface-panel-solid)_94%,black_6%))] p-2 shadow-[0_24px_52px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
        >
          <button
            v-for="option in FPS_OPTIONS"
            :key="option"
            type="button"
            class="four-d-fps-option toolbar-menu-option group relative overflow-hidden rounded-2xl! border border-transparent px-3! py-2.5! text-left! text-sm! text-[var(--theme-text-secondary)]! transition duration-150 hover:border-[color:color-mix(in_srgb,var(--theme-accent)_20%,transparent)]! hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_9%,transparent)]!"
            :class="{
              'four-d-fps-option--active toolbar-menu-option--active border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)]! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_16%,transparent),color-mix(in_srgb,var(--theme-accent)_10%,transparent))]! text-[var(--theme-text-primary)]! shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]!': option === normalizedFps
            }"
            @click="selectFps(option)"
          >
            <div
              class="toolbar-menu-option__rail pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-full bg-[color:color-mix(in_srgb,var(--theme-accent)_80%,white_8%)] opacity-0 transition"
              :class="{ 'opacity-100': option === normalizedFps }"
            />
            <span>FPS {{ option }}</span>
            <AppIcon v-if="option === normalizedFps" name="check" :size="14" />
          </button>
        </div>
      </VMenu>
      <button class="four-d-icon-button" type="button" :disabled="playbackButtonDisabled" :aria-label="playbackButtonLabel" :title="playbackButtonTitle" @click="emit('playbackToggle')">
        <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="18" />
      </button>
      <button
        v-if="showTabStripToggle"
        class="four-d-icon-button four-d-tab-strip-toggle-button"
        type="button"
        :aria-label="isTabStripCollapsed ? toolbarCopyValue.showTabs : toolbarCopyValue.hideTabs"
        :title="isTabStripCollapsed ? toolbarCopyValue.showTabs : toolbarCopyValue.hideTabs"
        @click="emit('toggleTabStrip')"
      >
        <AppIcon :name="isTabStripCollapsed ? 'chevron-down' : 'chevron-up'" :size="16" :stroke-width="2.3" />
      </button>
    </div>

    <aside v-if="showPhasePanel" class="four-d-phase-panel" aria-live="polite">
      <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-text-secondary)]">{{ copy.phases }}</div>
      <div class="h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]">
        <div class="h-full rounded-full bg-[var(--theme-accent)] transition-[width] duration-150" :style="{ width: playbackProgress }"></div>
      </div>
      <div class="four-d-phase-grid">
        <button
          v-for="phase in phaseItems"
          :key="phase.phaseIndex"
          class="four-d-phase-button"
          :class="[
            { 'four-d-phase-button--active': phase.phaseIndex === normalizedPhaseIndex },
            `four-d-phase-button--${phaseVisualStates[phase.phaseIndex] ?? 'unloaded'}`
          ]"
          type="button"
          :disabled="controlsLocked"
          :aria-label="copy.select4dFrame(phase.phaseIndex + 1)"
          @click="emit('phaseChange', phase.phaseIndex)"
        >
          <span>{{ String(phase.phaseIndex + 1).padStart(2, '0') }}</span>
          <span
            class="four-d-phase-button__status"
            :class="`four-d-phase-button__status--${phaseVisualStates[phase.phaseIndex] ?? 'unloaded'}`"
            aria-hidden="true"
          ></span>
        </button>
      </div>
      <div class="four-d-phase-footer">
        <div class="flex flex-wrap items-center gap-2">
          <span class="four-d-phase-legend">
            <span class="four-d-phase-legend__dot four-d-phase-legend__dot--loaded" aria-hidden="true"></span>
            {{ copy.loaded }}
          </span>
          <span class="four-d-phase-legend">
            <span class="four-d-phase-legend__dot four-d-phase-legend__dot--loading" aria-hidden="true"></span>
            {{ copy.loading }}
          </span>
          <span class="four-d-phase-legend">
            <span class="four-d-phase-legend__dot four-d-phase-legend__dot--unloaded" aria-hidden="true"></span>
            {{ copy.notLoaded }}
          </span>
        </div>
        <div
          class="four-d-phase-runtime"
          :class="`four-d-phase-runtime--${phaseRuntimeKind}`"
          role="status"
          :aria-label="phaseStatusAriaLabel"
          :title="phaseStatusAriaLabel"
        >
          <span class="four-d-phase-runtime__dot" :class="`four-d-phase-runtime__dot--${phaseRuntimeKind}`" aria-hidden="true"></span>
          <span class="four-d-phase-runtime__count">{{ phaseLoadProgressLabel }}</span>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.four-d-status-controls {
  min-width: 0;
}

.four-d-status-controls--dock {
  display: grid;
  gap: 8px;
}

.four-d-playback-controls {
  display: flex;
  min-height: 36px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.four-d-status-controls--dock .four-d-playback-controls {
  justify-content: stretch;
}

.four-d-status-controls--dock .four-d-fps-button {
  flex: 1 1 auto;
  justify-content: center;
}

.four-d-icon-button,
.four-d-phase-button {
  border: 1px solid var(--theme-border-soft);
  background: var(--theme-surface-card-soft);
  color: var(--theme-text-primary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.four-d-icon-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 14px;
}

.four-d-icon-button:hover,
.four-d-phase-button:hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
}

.four-d-icon-button:disabled,
.four-d-phase-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.four-d-fps-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  border-radius: 999px;
  border: 1px solid var(--theme-border-soft);
  background: var(--theme-surface-card-elevated);
  color: var(--theme-text-primary);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 8px 20px rgba(0, 0, 0, 0.14);
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.four-d-fps-button:hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  box-shadow: var(--theme-hover-shadow);
}

.four-d-fps-button[aria-expanded="true"] {
  border-color: var(--theme-active-border);
  background: var(--theme-active-surface-soft);
  color: var(--theme-text-primary);
  box-shadow: var(--theme-active-shadow-soft);
}

.four-d-fps-button:focus-visible {
  outline: none;
  border-color: var(--theme-active-border);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--theme-accent) 20%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 8px 20px rgba(0, 0, 0, 0.14);
}

.four-d-fps-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.four-d-fps-button__label {
  color: var(--theme-text-secondary);
  font-weight: 600;
}

.four-d-fps-button__value {
  min-width: 18px;
  text-align: center;
}

.four-d-fps-option {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.four-d-phase-panel {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: 8px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: color-mix(in srgb, var(--theme-surface-card) 66%, transparent);
  padding: 8px;
}

.four-d-phase-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.four-d-status-controls--dock .four-d-phase-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.four-d-phase-button {
  display: inline-grid;
  min-height: 36px;
  place-items: center;
  position: relative;
  border-radius: 10px;
  padding: 0;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.four-d-phase-button span {
  line-height: 1;
}

.four-d-phase-button--unloaded {
  border-style: dashed;
  opacity: 0.68;
}

.four-d-phase-button--loading {
  border-color: color-mix(in srgb, var(--theme-accent-warm) 36%, transparent);
  background: color-mix(in srgb, var(--theme-accent-warm) 10%, transparent);
}

.four-d-phase-button--loaded {
  border-color: color-mix(in srgb, #34d399 38%, transparent);
  background: color-mix(in srgb, #34d399 8%, transparent);
}

.four-d-phase-button--error {
  border-color: color-mix(in srgb, #fb7185 34%, transparent);
  background: color-mix(in srgb, #fb7185 10%, transparent);
}

.four-d-phase-button--active,
.four-d-phase-button--active:hover {
  border-color: var(--theme-active-border);
  background: var(--theme-active-surface-soft);
  box-shadow: var(--theme-active-shadow-soft);
}

.four-d-phase-button__status {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
}

.four-d-phase-button__status--unloaded {
  background: color-mix(in srgb, var(--theme-text-primary) 24%, transparent);
}

.four-d-phase-button__status--loading {
  background: var(--theme-accent-warm);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent-warm) 14%, transparent);
}

.four-d-phase-button__status--loaded {
  background: #34d399;
}

.four-d-phase-button__status--error {
  background: #fb7185;
}

.four-d-phase-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid color-mix(in srgb, var(--theme-text-primary) 8%, transparent);
  padding-top: 8px;
}

.four-d-phase-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 600;
}

.four-d-phase-runtime {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  width: 100%;
  min-height: 24px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-text-primary) 8%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-primary) 5%, transparent);
  padding: 4px 7px;
  color: var(--theme-text-secondary);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.four-d-phase-runtime--loading {
  border-color: color-mix(in srgb, var(--theme-accent-warm) 22%, transparent);
  background: color-mix(in srgb, var(--theme-accent-warm) 8%, transparent);
}

.four-d-phase-runtime--playing {
  border-color: color-mix(in srgb, var(--theme-accent) 22%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
}

.four-d-phase-runtime--error {
  border-color: color-mix(in srgb, #fb7185 28%, transparent);
  background: color-mix(in srgb, #fb7185 8%, transparent);
}

.four-d-phase-runtime__count {
  min-width: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: clip;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.four-d-phase-legend__dot,
.four-d-phase-runtime__dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.four-d-phase-legend__dot--loaded {
  background: #34d399;
}

.four-d-phase-legend__dot--loading {
  background: var(--theme-accent-warm);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent-warm) 14%, transparent);
}

.four-d-phase-legend__dot--unloaded,
.four-d-phase-runtime__dot--idle {
  border: 1px dashed color-mix(in srgb, var(--theme-text-primary) 32%, transparent);
  background: color-mix(in srgb, var(--theme-text-primary) 24%, transparent);
}

.four-d-phase-runtime__dot--ready {
  background: #34d399;
}

.four-d-phase-runtime__dot--loading {
  background: var(--theme-accent-warm);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent-warm) 14%, transparent);
}

.four-d-phase-runtime__dot--playing {
  background: var(--theme-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent) 14%, transparent);
}

.four-d-phase-runtime__dot--error {
  background: #fb7185;
  box-shadow: 0 0 0 4px color-mix(in srgb, #fb7185 14%, transparent);
}
</style>
