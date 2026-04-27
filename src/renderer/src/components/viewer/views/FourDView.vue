<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import ViewerToolbar from '../../workspace/shell/ViewerToolbar.vue'
import MprView from './MprView.vue'
import type { StackTool } from '../../workspace/shell/toolbarTypes'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  CornerInfo,
  DraftMeasurementMode,
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
  deleteSelectedMeasurement: [viewportKey: string]
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

const phaseIndex = ref(props.activeTab.fourDPhaseIndex ?? 0)
const fps = ref(props.activeTab.fourDPlaybackFps ?? 2)
const isPlaying = ref(false)
let playbackTimer: ReturnType<typeof window.setInterval> | null = null

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

const normalizedPhaseIndex = computed(() => {
  const maxIndex = Math.max(0, phaseItems.value.length - 1)
  return Math.min(Math.max(phaseIndex.value, 0), maxIndex)
})
const activePhaseNumber = computed(() => normalizedPhaseIndex.value + 1)
const phaseCount = computed(() => Math.max(1, phaseItems.value.length))
const playbackProgress = computed(() => `${(activePhaseNumber.value / phaseCount.value) * 100}%`)
const canPlay = computed(() => phaseCount.value > 1)
const normalizedFps = computed(() => normalizeFpsValue(fps.value))
const interactionLocked = computed(() => isPlaying.value || Boolean(props.activeTab.fourDIsPlaying))
const toolbarLocked = computed(() => interactionLocked.value || props.areToolbarActionsDisabled)

function normalizeFpsValue(value: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return 2
  }
  return Math.max(FPS_MIN, Math.min(FPS_MAX, Math.trunc(numericValue)))
}

function setPlaybackState(value: boolean): void {
  if (isPlaying.value === value) {
    return
  }
  isPlaying.value = value
  emit('playbackChange', value)
}

function clearPlaybackTimer(): void {
  if (playbackTimer) {
    window.clearInterval(playbackTimer)
    playbackTimer = null
  }
}

function pausePlayback(): void {
  clearPlaybackTimer()
  setPlaybackState(false)
}

function startPlayback(): void {
  if (!canPlay.value) {
    return
  }
  clearPlaybackTimer()
  setPlaybackState(true)
  playbackTimer = window.setInterval(() => {
    selectPhase((normalizedPhaseIndex.value + 1) % phaseCount.value)
  }, 1000 / normalizedFps.value)
}

function togglePlayback(): void {
  if (isPlaying.value) {
    pausePlayback()
    selectPhase(normalizedPhaseIndex.value)
    return
  }
  startPlayback()
}

function selectPhase(index: number): void {
  const maxIndex = Math.max(0, phaseItems.value.length - 1)
  const nextIndex = Math.min(Math.max(index, 0), maxIndex)
  phaseIndex.value = nextIndex
  emit('phaseChange', nextIndex)
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
    phaseIndex.value = props.activeTab.fourDPhaseIndex ?? 0
    fps.value = props.activeTab.fourDPlaybackFps ?? 2
    pausePlayback()
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
    if (isPlaying.value) {
      startPlayback()
    }
  }
)

watch(
  () => props.activeTab.fourDPhaseIndex,
  (value) => {
    if (typeof value === 'number' && Number.isFinite(value) && value !== phaseIndex.value) {
      phaseIndex.value = value
    }
  }
)

watch(
  phaseItems,
  () => {
    if (phaseIndex.value !== normalizedPhaseIndex.value) {
      selectPhase(normalizedPhaseIndex.value)
    }
  }
)

watch(
  canPlay,
  (value) => {
    if (!value) {
      pausePlayback()
    }
  }
)

onBeforeUnmount(() => {
  pausePlayback()
})
</script>

<template>
  <div class="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-2 text-[var(--theme-text-primary)]">
    <div class="flex min-h-[52px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_72%,transparent)] px-3 py-2">
      <div class="min-w-0 flex-1">
        <ViewerToolbar
          class="four-d-viewer-toolbar"
          :active-tab="activeTab"
          :active-tools="activeTools"
          :are-toolbar-actions-disabled="toolbarLocked"
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

      <div class="flex flex-wrap items-center justify-end gap-2">
        <label class="flex items-center gap-2 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2.5 py-1 text-xs text-[var(--theme-text-secondary)]">
          <span>FPS</span>
          <select v-model.number="fps" class="four-d-select h-7 rounded-full px-2 text-xs font-semibold" :disabled="interactionLocked">
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="15">15</option>
            <option :value="30">30</option>
          </select>
        </label>
        <button class="four-d-icon-button" type="button" :disabled="!canPlay" :aria-label="isPlaying ? 'Pause 4D playback' : 'Play 4D playback'" :title="isPlaying ? 'Pause' : 'Play'" @click="togglePlayback">
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
          @delete-selected-measurement="emitWhenIdle(() => emit('deleteSelectedMeasurement', $event))"
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
          v-if="interactionLocked"
          class="pointer-events-none absolute inset-0 z-[12] grid place-items-start justify-items-end rounded-2xl bg-[color:color-mix(in_srgb,black_8%,transparent)] p-3"
        >
          <span class="rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_82%,transparent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--theme-text-secondary)] shadow-[0_12px_24px_rgba(0,0,0,0.22)]">
            Playing - MPR tools disabled
          </span>
        </div>
      </div>

      <aside class="grid min-h-0 content-start gap-2 rounded-2xl border border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_66%,transparent)] p-2">
        <div class="h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]">
          <div class="h-full rounded-full bg-[var(--theme-accent)] transition-[width] duration-150" :style="{ width: playbackProgress }"></div>
        </div>
        <div class="grid grid-cols-2 gap-2 max-xl:grid-cols-10 max-md:grid-cols-5">
          <button
            v-for="phase in phaseItems"
            :key="phase.phaseIndex"
            class="four-d-phase-button"
            :class="{ 'four-d-phase-button--active': phase.phaseIndex === normalizedPhaseIndex }"
            type="button"
            :disabled="interactionLocked"
            :aria-label="`Select 4D frame ${phase.phaseIndex + 1}`"
            @click="selectPhase(phase.phaseIndex)"
          >
            <span>{{ String(phase.phaseIndex + 1).padStart(2, '0') }}</span>
          </button>
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
  border-radius: 10px;
  padding: 0;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.four-d-phase-button span {
  line-height: 1;
}

.four-d-phase-button--active {
  border-color: var(--theme-active-border);
  background: var(--theme-active-surface-soft);
  box-shadow: var(--theme-active-shadow-soft);
}

.four-d-select {
  border: 1px solid var(--theme-border-soft);
  background: var(--theme-surface-card);
  color: var(--theme-text-primary);
}

.four-d-viewer-toolbar {
  min-height: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}
</style>
