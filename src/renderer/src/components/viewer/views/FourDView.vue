<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import ViewerToolbar from '../../workspace/shell/ViewerToolbar.vue'
import MprView from './MprView.vue'
import type { StackTool } from '../../workspace/shell/toolbarTypes'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  CornerInfo,
  DraftMeasurementMode,
  FourDPhaseCacheItem,
  FourDPhaseItem,
  MeasurementDraft,
  MeasurementOverlay,
  MprViewportKey,
  ViewerMtfItem,
  ViewerTabItem
} from '../../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeOperation: string
  activeViewportKey: string
  activeTools: StackTool[]
  areToolbarActionsDisabled: boolean
  getAnnotations: (viewportKey: MprViewportKey) => AnnotationOverlay[]
  getCursorClass: (viewportKey: MprViewportKey) => string
  getDraftAnnotation: (viewportKey: MprViewportKey) => AnnotationDraft | null
  getDraftMeasurementMode: (viewportKey: MprViewportKey) => DraftMeasurementMode | null
  getDraftMeasurement: (viewportKey: MprViewportKey) => MeasurementDraft | null
  getMeasurements: (viewportKey: MprViewportKey) => MeasurementOverlay[]
  getMtfDraftMode: (viewportKey: MprViewportKey) => DraftMeasurementMode | null
  getMtfDraft: (viewportKey: MprViewportKey) => { mtfId?: string; points: { x: number; y: number }[] } | null
  getMtfItems: (viewportKey: MprViewportKey) => ViewerMtfItem[]
  selectedMtfId?: string | null
  getCornerInfo: (viewportKey: MprViewportKey) => CornerInfo
  isToolSelected: (tool: StackTool) => boolean
  menuIconSize: number
  openMenuKey: string | null
  stackToolSelections: Partial<Record<string, string>>
  toolbarIconSize: number
  toggleIconSize: number
}>()

const emit = defineEmits<{
  applyTool: [tool: StackTool]
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  clearMtf: []
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  openMtfCurve: []
  phaseChange: [phaseIndex: number]
  fpsChange: [fps: number]
  playbackChange: [isPlaying: boolean]
  selectMtf: [payload: { mtfId: string | null }]
  selectToolOption: [tool: StackTool, optionValue: string]
  setMenuOpen: [toolKey: string | null]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
}>()

const FPS_MIN = 1
const FPS_MAX = 30
const FPS_OPTIONS = [1, 2, 5, 10, 15, 30] as const

const fps = ref(props.activeTab.fourDPlaybackFps ?? 2)
const fpsMenuOpen = ref(false)

const phaseItems = computed<FourDPhaseItem[]>(() => {
  if (props.activeTab.fourDPhaseItems?.length) {
    return props.activeTab.fourDPhaseItems
  }

  const phaseCount = Math.max(1, props.activeTab.fourDPhaseCount ?? 10)
  return Array.from({ length: phaseCount }, (_, index) => ({
    phaseIndex: index,
    label: `Phase ${String(index + 1).padStart(2, '0')}`,
    seriesId: null,
    imageSrc: '',
    status: 'pending'
  }))
})

const rawPhaseIndex = computed(() => {
  const value = props.activeTab.fourDPhaseIndex ?? 0
  return Number.isFinite(value) ? Math.trunc(value) : 0
})

const normalizedPhaseIndex = computed(() => {
  const maxIndex = Math.max(0, phaseItems.value.length - 1)
  return Math.min(Math.max(rawPhaseIndex.value, 0), maxIndex)
})
const activePhaseNumber = computed(() => normalizedPhaseIndex.value + 1)
const phaseCount = computed(() => Math.max(1, phaseItems.value.length))
const playbackProgress = computed(() => `${(activePhaseNumber.value / phaseCount.value) * 100}%`)
const canPlay = computed(() => phaseCount.value > 1)
const normalizedFps = computed(() => normalizeFpsValue(fps.value))
const isPlaying = computed(() => Boolean(props.activeTab.fourDIsPlaying))
const isPreloading = computed(() => Boolean(props.activeTab.fourDIsPreloading))
const interactionLocked = computed(() => isPlaying.value || isPreloading.value)
const toolbarLocked = computed(() => interactionLocked.value || props.areToolbarActionsDisabled)
const playbackButtonDisabled = computed(() => !canPlay.value || isPreloading.value)
const playbackButtonLabel = computed(() => (isPreloading.value ? 'Loading 4D playback' : isPlaying.value ? 'Pause 4D playback' : 'Play 4D playback'))
const playbackButtonTitle = computed(() => (isPreloading.value ? 'Loading' : isPlaying.value ? 'Pause' : 'Play'))
const interactionLockLabel = computed(() => (isPreloading.value ? 'Loading 4D phases' : 'Playing - MPR tools disabled'))
const interactionLockDescription = computed(() =>
  isPreloading.value
    ? 'Preparing phase viewports before playback starts.'
    : `Phase ${activePhaseNumber.value} of ${phaseCount.value} is playing at ${normalizedFps.value} FPS.`
)
const interactionLockMeta = computed(() =>
  isPreloading.value
    ? `${phaseCount.value} phases queued`
    : `${String(activePhaseNumber.value).padStart(2, '0')} / ${String(phaseCount.value).padStart(2, '0')}`
)
const footerPlaybackStatus = computed(() =>
  isPreloading.value ? 'Loading phases' : isPlaying.value ? `Playing ${normalizedFps.value} FPS` : ''
)

type FourDPhaseVisualState = 'loaded' | 'pending' | 'loading' | 'error'

function resolvePhaseVisualState(phase: FourDPhaseItem, phaseIndex: number): FourDPhaseVisualState {
  const phaseKey = String(phase.phaseIndex ?? phaseIndex)
  const cache: FourDPhaseCacheItem | undefined = props.activeTab.fourDPhaseCache?.[phaseKey]

  if (cache?.status === 'error' || phase.status === 'error') {
    return 'error'
  }
  if (cache?.status === 'ready' || phase.status === 'ready') {
    return 'loaded'
  }
  if (cache?.status === 'loading') {
    return 'loading'
  }
  return 'pending'
}

const phaseVisualStates = computed<Record<number, FourDPhaseVisualState>>(() =>
  phaseItems.value.reduce<Record<number, FourDPhaseVisualState>>((accumulator, phase, index) => {
    accumulator[phase.phaseIndex] = resolvePhaseVisualState(phase, index)
    return accumulator
  }, {})
)
const phasePanelStatusLabel = computed(() => (isPreloading.value ? 'Loading' : isPlaying.value ? 'Playing' : 'Ready'))
const phasePanelStatusDetail = computed(() => {
  const phasePosition = `${String(activePhaseNumber.value).padStart(2, '0')} / ${String(phaseCount.value).padStart(2, '0')}`
  if (isPreloading.value) {
    return `${phaseCount.value} phases queued`
  }
  if (isPlaying.value) {
    return `${phasePosition} · ${normalizedFps.value} FPS`
  }
  return phasePosition
})

function normalizeFpsValue(value: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return 2
  }
  return Math.max(FPS_MIN, Math.min(FPS_MAX, Math.trunc(numericValue)))
}

function togglePlayback(): void {
  if (isPreloading.value) {
    return
  }
  if (isPlaying.value) {
    emit('playbackChange', false)
    return
  }
  if (!canPlay.value) {
    return
  }
  emit('playbackChange', true)
}

function selectPhase(index: number): void {
  const maxIndex = Math.max(0, phaseItems.value.length - 1)
  const nextIndex = Math.min(Math.max(index, 0), maxIndex)
  emit('phaseChange', nextIndex)
}

function selectFps(value: number): void {
  fps.value = normalizeFpsValue(value)
  fpsMenuOpen.value = false
}

function emitWhenIdle(callback: () => void): void {
  if (interactionLocked.value) {
    return
  }
  callback()
}

watch(
  () => props.activeTab.key,
  () => {
    fps.value = props.activeTab.fourDPlaybackFps ?? 2
    fpsMenuOpen.value = false
  }
)

watch(
  fps,
  () => {
    const nextFps = normalizedFps.value
    if (nextFps !== fps.value) {
      fps.value = nextFps
      return
    }
    emit('fpsChange', nextFps)
  }
)

watch(
  () => props.activeTab.fourDPlaybackFps,
  (value) => {
    if (typeof value === 'number' && Number.isFinite(value) && value !== fps.value) {
      fps.value = value
    }
  }
)

watch(
  phaseItems,
  () => {
    if (rawPhaseIndex.value !== normalizedPhaseIndex.value) {
      emit('phaseChange', normalizedPhaseIndex.value)
    }
  }
)

watch(
  canPlay,
  (value) => {
    if (!value) {
      emit('playbackChange', false)
    }
  }
)

watch(
  interactionLocked,
  (value) => {
    if (value) {
      fpsMenuOpen.value = false
    }
  }
)
</script>

<template>
  <div class="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-2 text-[var(--theme-text-primary)]">
    <div class="four-d-toolbar-shell flex min-h-10 flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div class="min-w-0 flex-1">
        <ViewerToolbar
          class="four-d-viewer-toolbar"
          :active-tab="activeTab"
          :active-tools="activeTools"
          :are-toolbar-actions-disabled="toolbarLocked"
          embedded
          :is-playing="false"
          :is-playback-paused="false"
          :is-tool-selected="isToolSelected"
          :menu-icon-size="menuIconSize"
          :open-menu-key="openMenuKey"
          :stack-tool-selections="stackToolSelections"
          :toggle-icon-size="toggleIconSize"
          :toolbar-icon-size="toolbarIconSize"
          @apply-tool="emitWhenIdle(() => emit('applyTool', $event))"
          @end-playback="() => undefined"
          @pause-playback="() => undefined"
          @select-tool-option="(tool, optionValue) => emitWhenIdle(() => emit('selectToolOption', tool, optionValue))"
          @set-menu-open="emit('setMenuOpen', $event)"
        />
      </div>

      <div class="four-d-playback-controls flex flex-wrap items-center justify-end gap-2">
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
              :disabled="interactionLocked"
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
            class="theme-shell-panel relative inline-flex min-w-[120px] flex-col overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--theme-border-strong)_74%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card)_92%,white_4%),color-mix(in_srgb,var(--theme-surface-panel)_94%,black_6%))] p-2 shadow-[0_24px_52px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
          >
            <button
              v-for="option in FPS_OPTIONS"
              :key="option"
              type="button"
              class="four-d-fps-option"
              :class="{ 'four-d-fps-option--active': option === normalizedFps }"
              @click="selectFps(option)"
            >
              <span>FPS {{ option }}</span>
              <AppIcon v-if="option === normalizedFps" name="check" :size="14" />
            </button>
          </div>
        </VMenu>
        <button class="four-d-icon-button" type="button" :disabled="playbackButtonDisabled" :aria-label="playbackButtonLabel" :title="playbackButtonTitle" @click="togglePlayback">
          <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="18" />
        </button>
      </div>
    </div>

    <div class="grid min-h-0 grid-cols-[minmax(0,1fr)_104px] gap-2 max-xl:grid-cols-1 max-xl:grid-rows-[minmax(0,1fr)_auto]">
      <div class="relative min-h-0">
        <MprView
          :active-tab="activeTab"
          :active-operation="interactionLocked ? '' : activeOperation"
          :active-viewport-key="activeViewportKey"
          :get-annotations="getAnnotations"
          :get-cursor-class="getCursorClass"
          :get-draft-annotation="getDraftAnnotation"
          :get-draft-measurement-mode="getDraftMeasurementMode"
          :get-draft-measurement="getDraftMeasurement"
          :get-measurements="getMeasurements"
          :get-mtf-draft-mode="getMtfDraftMode"
          :get-mtf-draft="getMtfDraft"
          :get-mtf-items="getMtfItems"
          :selected-mtf-id="selectedMtfId ?? null"
          :get-corner-info="getCornerInfo"
          @copy-annotation="emitWhenIdle(() => emit('copyAnnotation', $event))"
          @delete-annotation="emitWhenIdle(() => emit('deleteAnnotation', $event))"
          @copy-selected-measurement="emitWhenIdle(() => emit('copySelectedMeasurement', $event))"
          @delete-selected-measurement="(viewportKey, measurementId) => emitWhenIdle(() => emit('deleteSelectedMeasurement', viewportKey, measurementId))"
          @clear-mtf="emitWhenIdle(() => emit('clearMtf'))"
          @copy-selected-mtf="emitWhenIdle(() => emit('copySelectedMtf', $event))"
          @hover-viewport-change="emitWhenIdle(() => emit('hoverViewportChange', $event))"
          @open-mtf-curve="emitWhenIdle(() => emit('openMtfCurve'))"
          @select-mtf="emitWhenIdle(() => emit('selectMtf', $event))"
          @viewport-click="emitWhenIdle(() => emit('viewportClick', $event))"
          @viewport-wheel="emitWhenIdle(() => emit('viewportWheel', $event))"
          @pointer-down="(event, viewportKey) => emitWhenIdle(() => emit('pointerDown', event, viewportKey))"
          @pointer-leave="emitWhenIdle(() => emit('pointerLeave', $event))"
          @pointer-move="emitWhenIdle(() => emit('pointerMove', $event))"
          @pointer-up="emitWhenIdle(() => emit('pointerUp', $event))"
          @pointer-cancel="emitWhenIdle(() => emit('pointerCancel', $event))"
          @update-annotation-color="emitWhenIdle(() => emit('updateAnnotationColor', $event))"
          @update-annotation-size="emitWhenIdle(() => emit('updateAnnotationSize', $event))"
          @update-annotation-text="emitWhenIdle(() => emit('updateAnnotationText', $event))"
        />
        <div
          v-if="isPreloading"
          class="four-d-state-overlay pointer-events-none absolute inset-0 z-[12] flex items-end justify-center rounded-2xl p-4"
          aria-live="polite"
        >
          <div class="four-d-state-card" :class="{ 'four-d-state-card--loading': isPreloading }">
            <div class="four-d-state-card__icon">
              <AppIcon name="four-d" :size="19" />
              <span class="four-d-state-card__pulse"></span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[12px] font-semibold text-[var(--theme-text-primary)]">{{ interactionLockLabel }}</div>
              <div class="mt-0.5 truncate text-[11px] text-[var(--theme-text-secondary)]">{{ interactionLockDescription }}</div>
            </div>
            <div class="four-d-state-card__meta">{{ interactionLockMeta }}</div>
          </div>
        </div>
      </div>

      <aside class="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] content-start gap-2 rounded-2xl border border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_66%,transparent)] p-2" aria-live="polite">
        <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-text-secondary)]">Phases</div>
        <div class="h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]">
          <div class="h-full rounded-full bg-[var(--theme-accent)] transition-[width] duration-150" :style="{ width: playbackProgress }"></div>
        </div>
        <div class="grid grid-cols-2 gap-2 max-xl:grid-cols-10 max-md:grid-cols-5">
          <button
            v-for="phase in phaseItems"
            :key="phase.phaseIndex"
            class="four-d-phase-button"
            :class="[
              { 'four-d-phase-button--active': phase.phaseIndex === normalizedPhaseIndex },
              `four-d-phase-button--${phaseVisualStates[phase.phaseIndex] ?? 'pending'}`
            ]"
            type="button"
            :disabled="interactionLocked"
            :aria-label="`Select 4D frame ${phase.phaseIndex + 1}`"
            @click="selectPhase(phase.phaseIndex)"
          >
            <span>{{ String(phase.phaseIndex + 1).padStart(2, '0') }}</span>
            <span
              class="four-d-phase-button__status"
              :class="`four-d-phase-button__status--${phaseVisualStates[phase.phaseIndex] ?? 'pending'}`"
              aria-hidden="true"
            ></span>
          </button>
        </div>
        <div class="four-d-phase-footer">
          <div class="flex flex-wrap items-center gap-3">
            <span class="four-d-phase-legend">
              <span class="four-d-phase-legend__dot four-d-phase-legend__dot--loaded" aria-hidden="true"></span>
              <span>Loaded</span>
            </span>
            <span class="four-d-phase-legend">
              <span class="four-d-phase-legend__dot four-d-phase-legend__dot--pending" aria-hidden="true"></span>
              <span>Pending</span>
            </span>
          </div>
          <div v-if="footerPlaybackStatus" class="four-d-phase-runtime">
            <span
              class="four-d-phase-runtime__dot"
              :class="{
                'four-d-phase-runtime__dot--loading': isPreloading,
                'four-d-phase-runtime__dot--playing': isPlaying
              }"
              aria-hidden="true"
            ></span>
            <span>{{ footerPlaybackStatus }}</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
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

.four-d-toolbar-shell {
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: color-mix(in srgb, var(--theme-surface-panel) 78%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 28px rgba(0, 0, 0, 0.16);
}

.four-d-playback-controls {
  min-height: 36px;
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
.four-d-phase-button:disabled,
.four-d-select:disabled {
  cursor: not-allowed;
  opacity: 0.45;
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

.four-d-phase-button--pending {
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

.four-d-phase-button--active {
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

.four-d-phase-button__status--pending {
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
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 16px;
  padding: 10px 12px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.four-d-fps-option:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 20%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
  color: var(--theme-text-primary);
}

.four-d-fps-option--active {
  border-color: color-mix(in srgb, var(--theme-accent) 28%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 16%, transparent), color-mix(in srgb, var(--theme-accent) 10%, transparent));
  color: var(--theme-text-primary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.four-d-phase-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid color-mix(in srgb, var(--theme-text-primary) 8%, transparent);
  padding-top: 8px;
}

.four-d-phase-legend,
.four-d-phase-runtime {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 600;
}

.four-d-phase-legend__dot,
.four-d-phase-runtime__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.four-d-phase-legend__dot--loaded {
  background: #34d399;
}

.four-d-phase-legend__dot--pending {
  background: color-mix(in srgb, var(--theme-text-primary) 24%, transparent);
  border: 1px dashed color-mix(in srgb, var(--theme-text-primary) 32%, transparent);
}

.four-d-phase-runtime__dot--loading {
  background: var(--theme-accent-warm);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent-warm) 14%, transparent);
}

.four-d-phase-runtime__dot--playing {
  background: var(--theme-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent) 14%, transparent);
}

.four-d-viewer-toolbar {
  min-height: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

.four-d-state-overlay {
  background:
    radial-gradient(circle at 50% 92%, color-mix(in srgb, var(--theme-accent) 16%, transparent), transparent 36%),
    linear-gradient(180deg, transparent 46%, rgba(0, 0, 0, 0.26));
}

.four-d-state-card {
  display: inline-flex;
  width: min(520px, 100%);
  align-items: center;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 28%, transparent);
  border-radius: 999px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card) 88%, white 4%), color-mix(in srgb, var(--theme-surface-panel) 90%, black 8%));
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  padding: 10px 12px;
  backdrop-filter: blur(16px);
}

.four-d-state-card--loading {
  border-color: color-mix(in srgb, var(--theme-accent-warm) 30%, var(--theme-accent) 18%);
}

.four-d-state-card__icon {
  position: relative;
  display: inline-grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
  color: var(--theme-text-primary);
}

.four-d-state-card__pulse {
  position: absolute;
  right: 3px;
  top: 3px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--theme-accent);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

.four-d-state-card__meta {
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--theme-text-primary) 10%, transparent);
  background: color-mix(in srgb, var(--theme-text-primary) 6%, transparent);
  padding: 5px 9px;
  color: var(--theme-text-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
</style>
