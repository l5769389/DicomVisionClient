<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import ViewerToolbar from '../../workspace/shell/ViewerToolbar.vue'
import ViewerToolbarDock from '../../workspace/shell/ViewerToolbarDock.vue'
import MprMipConfigPanel from '../../workspace/MprMipConfigPanel.vue'
import FourDStatusControls from './FourDStatusControls.vue'
import MprView from './MprView.vue'
import type { StackTool, StackToolOptionSelectBehavior } from '../../workspace/shell/toolbarTypes'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  CornerInfo,
  DraftMeasurementMode,
  FourDPhaseCacheItem,
  FourDPhaseItem,
  MeasurementDraft,
  MeasurementOverlay,
  MprLayoutKey,
  MprMipConfig,
  MprViewportKey,
  ViewerMtfItem,
  ViewerTabItem
} from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

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
  isTabStripCollapsed?: boolean
  mprLayoutKey?: MprLayoutKey | null
  isToolSelected: (tool: StackTool) => boolean
  menuIconSize: number
  openMenuKey: string | null
  showTabStripToggle?: boolean
  stackToolSelections: Partial<Record<string, string>>
  toolbarIconSize: number
  toggleIconSize: number
  toolbarPlacement?: 'top' | 'right'
  activeMprMipConfig?: MprMipConfig | null
  isMprMipPanelOpen?: boolean
  isSlicePlaybackPaused?: boolean
  isSlicePlaybackPlaying?: boolean
  resultPanelIcon?: string
  resultPanelOpen?: boolean
  resultPanelTitle?: string
  resultPanelToolKey?: string | null
}>()

const emit = defineEmits<{
  applyTool: [tool: StackTool, behavior?: StackToolOptionSelectBehavior]
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  copySelectedMtf: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  clearMtf: []
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null; row?: number | null; col?: number | null }]
  openSettings: [sectionKey?: string]
  openMtfCurve: []
  phaseChange: [phaseIndex: number]
  fpsChange: [fps: number]
  playbackChange: [isPlaying: boolean]
  closeMprMipPanel: []
  closeResultPanel: []
  dockResize: []
  endPlayback: []
  mprMipConfigChange: [config: MprMipConfig, actionType?: 'move' | 'end']
  pausePlayback: []
  selectMtf: [payload: { mtfId: string | null }]
  selectToolOption: [tool: StackTool, optionValue: string, behavior?: StackToolOptionSelectBehavior]
  setMenuOpen: [toolKey: string | null]
  toggleTabStrip: []
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean; deltaX?: number; deltaMode?: number; ctrlKey?: boolean; canvasX?: number; canvasY?: number; canvasWidth?: number; canvasHeight?: number }]
}>()

const FPS_MIN = 1
const FPS_MAX = 30

const fps = ref(props.activeTab.fourDPlaybackFps ?? 2)
const { viewerCopy } = useUiLocale()
const copy = computed(() => viewerCopy.value)
const isRightToolbarLayout = computed(() => props.toolbarPlacement === 'right')

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
const isSlicePlaybackPlaying = computed(() => props.isSlicePlaybackPlaying === true)
const isSlicePlaybackPaused = computed(() => props.isSlicePlaybackPaused === true)
const isSlicePlaybackActive = computed(() => isSlicePlaybackPlaying.value || isSlicePlaybackPaused.value)
const interactionLocked = computed(() => isPlaying.value || isPreloading.value || isSlicePlaybackActive.value)
const toolbarLocked = computed(() => interactionLocked.value || props.areToolbarActionsDisabled)
const playbackButtonDisabled = computed(() => !canPlay.value || isPreloading.value || isSlicePlaybackActive.value)
const playbackButtonLabel = computed(() => (isPreloading.value ? copy.value.loading4dPlayback : isPlaying.value ? copy.value.pause4dPlayback : copy.value.play4dPlayback))
const playbackButtonTitle = computed(() => (isPreloading.value ? copy.value.loading4dPlayback : isPlaying.value ? copy.value.pause4dPlayback : copy.value.play4dPlayback))
const interactionLockLabel = computed(() => (isPreloading.value ? copy.value.loading4dPhases : copy.value.playingMprToolsDisabled))
const interactionLockDescription = computed(() =>
  isPreloading.value
    ? copy.value.preparing4dPhases
    : copy.value.playingPhaseDetail(activePhaseNumber.value, phaseCount.value, normalizedFps.value)
)
const interactionLockMeta = computed(() =>
  isPreloading.value
    ? copy.value.phasesQueued(phaseCount.value)
    : `${String(activePhaseNumber.value).padStart(2, '0')} / ${String(phaseCount.value).padStart(2, '0')}`
)

type FourDPhaseVisualState = 'loaded' | 'unloaded' | 'loading' | 'error'
type FourDPhaseRuntimeKind = 'idle' | 'ready' | 'loading' | 'playing' | 'error'

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
  return 'unloaded'
}

const phaseVisualStates = computed<Record<number, FourDPhaseVisualState>>(() =>
  phaseItems.value.reduce<Record<number, FourDPhaseVisualState>>((accumulator, phase, index) => {
    accumulator[phase.phaseIndex] = resolvePhaseVisualState(phase, index)
    return accumulator
  }, {})
)

const phaseVisualStateCounts = computed(() =>
  Object.values(phaseVisualStates.value).reduce<Record<FourDPhaseVisualState, number>>(
    (accumulator, state) => {
      accumulator[state] += 1
      return accumulator
    },
    {
      error: 0,
      loaded: 0,
      loading: 0,
      unloaded: 0
    }
  )
)

const phaseCountDigits = computed(() => Math.max(2, String(phaseCount.value).length))
const phaseRuntimeKind = computed<FourDPhaseRuntimeKind>(() => {
  const counts = phaseVisualStateCounts.value

  if (counts.error) {
    return 'error'
  }
  if (isPreloading.value || counts.loading) {
    return 'loading'
  }
  if (isPlaying.value) {
    return 'playing'
  }
  return counts.unloaded ? 'idle' : 'ready'
})
const phaseRuntimeStateLabel = computed(() => {
  if (isPreloading.value) {
    return copy.value.loading4dPhases
  }
  if (isPlaying.value) {
    return copy.value.playingFps(normalizedFps.value)
  }
  return copy.value.playbackIdle4d
})
const phaseLoadProgressLabel = computed(
  () => `${formatPhaseStatusCount(phaseVisualStateCounts.value.loaded)}/${formatPhaseStatusCount(phaseCount.value)}`
)
const phaseStatusAriaLabel = computed(() => {
  const counts = phaseVisualStateCounts.value
  return copy.value.phaseLoadStatus(phaseRuntimeStateLabel.value, counts.loaded, counts.loading, counts.unloaded, counts.error)
})
const phasePanelStatusLabel = computed(() => (isPreloading.value ? copy.value.loading : isPlaying.value ? copy.value.playing : copy.value.ready))
const phasePanelStatusDetail = computed(() => {
  const phasePosition = `${String(activePhaseNumber.value).padStart(2, '0')} / ${String(phaseCount.value).padStart(2, '0')}`
  if (isPreloading.value) {
    return copy.value.phasesQueued(phaseCount.value)
  }
  if (isPlaying.value) {
    return `${phasePosition} · ${normalizedFps.value} FPS`
  }
  return phasePosition
})

function formatPhaseStatusCount(value: number): string {
  const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
  return String(normalizedValue).padStart(phaseCountDigits.value, '0')
}

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
}

function emitWhenIdle(callback: () => void): void {
  if (interactionLocked.value) {
    return
  }
  callback()
}

function emitToolbarOption(tool: StackTool, optionValue: string, behavior?: StackToolOptionSelectBehavior): void {
  if (tool.key === 'play' && isSlicePlaybackActive.value) {
    emit('selectToolOption', tool, optionValue, behavior)
    return
  }
  emitWhenIdle(() => emit('selectToolOption', tool, optionValue, behavior))
}

watch(
  () => props.activeTab.key,
  () => {
    fps.value = props.activeTab.fourDPlaybackFps ?? 2
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

</script>

<template>
  <div
    class="four-d-root h-full min-h-0 w-full gap-2 text-[var(--theme-text-primary)]"
    :class="isRightToolbarLayout ? 'four-d-root--right' : 'four-d-root--top'"
  >
    <div v-if="!isRightToolbarLayout" class="four-d-toolbar-shell flex min-h-10 flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div class="min-w-0 flex-1">
        <ViewerToolbar
          class="four-d-viewer-toolbar"
          :active-tab="activeTab"
          :active-tools="activeTools"
          :are-toolbar-actions-disabled="toolbarLocked"
          embedded
          :is-playing="isSlicePlaybackPlaying"
          :is-playback-paused="isSlicePlaybackPaused"
          :is-tool-selected="isToolSelected"
          :is-tab-strip-collapsed="props.isTabStripCollapsed"
          :menu-icon-size="menuIconSize"
          :open-menu-key="openMenuKey"
          :show-tab-strip-toggle="false"
          :stack-tool-selections="stackToolSelections"
          :toggle-icon-size="toggleIconSize"
          :toolbar-icon-size="toolbarIconSize"
          @apply-tool="emitWhenIdle(() => emit('applyTool', $event))"
          @end-playback="emit('endPlayback')"
          @pause-playback="emit('pausePlayback')"
          @select-tool-option="(tool, optionValue) => emitToolbarOption(tool, optionValue)"
          @set-menu-open="emit('setMenuOpen', $event)"
          @toggle-tab-strip="emit('toggleTabStrip')"
        />
      </div>

      <FourDStatusControls
        :interaction-locked="interactionLocked"
        :external-playback-locked="isSlicePlaybackActive"
        :is-playing="isPlaying"
        :normalized-fps="normalizedFps"
        :normalized-phase-index="normalizedPhaseIndex"
        :phase-items="phaseItems"
        :phase-load-progress-label="phaseLoadProgressLabel"
        :phase-runtime-kind="phaseRuntimeKind"
        :phase-status-aria-label="phaseStatusAriaLabel"
        :phase-visual-states="phaseVisualStates"
        :playback-button-disabled="playbackButtonDisabled"
        :playback-button-label="playbackButtonLabel"
        :playback-button-title="playbackButtonTitle"
        :playback-progress="playbackProgress"
        :show-phase-panel="false"
        show-playback-controls
        :show-tab-strip-toggle="props.showTabStripToggle"
        :is-tab-strip-collapsed="props.isTabStripCollapsed"
        @fps-change="selectFps"
        @playback-toggle="togglePlayback"
        @toggle-tab-strip="emit('toggleTabStrip')"
      />
    </div>

    <div
      class="four-d-content grid min-h-0 gap-2"
      :class="isRightToolbarLayout ? 'four-d-content--right' : 'four-d-content--top'"
    >
      <div class="relative min-h-0">
        <MprView
          :active-tab="activeTab"
          :active-operation="interactionLocked ? '' : activeOperation"
          :active-viewport-key="activeViewportKey"
          :allow-viewport-maximize="!interactionLocked"
          :layout-key="mprLayoutKey"
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

      <FourDStatusControls
        v-if="!isRightToolbarLayout"
        :interaction-locked="interactionLocked"
        :external-playback-locked="isSlicePlaybackActive"
        :is-playing="isPlaying"
        :normalized-fps="normalizedFps"
        :normalized-phase-index="normalizedPhaseIndex"
        :phase-items="phaseItems"
        :phase-load-progress-label="phaseLoadProgressLabel"
        :phase-runtime-kind="phaseRuntimeKind"
        :phase-status-aria-label="phaseStatusAriaLabel"
        :phase-visual-states="phaseVisualStates"
        :playback-button-disabled="playbackButtonDisabled"
        :playback-button-label="playbackButtonLabel"
        :playback-button-title="playbackButtonTitle"
        :playback-progress="playbackProgress"
        show-phase-panel
        :show-playback-controls="false"
        @phase-change="selectPhase"
      />

      <ViewerToolbarDock
        v-else
        :active-tab="activeTab"
        :active-tools="activeTools"
        :are-toolbar-actions-disabled="toolbarLocked"
        :is-playing="isSlicePlaybackPlaying"
        :is-playback-paused="isSlicePlaybackPaused"
        :is-tool-selected="isToolSelected"
        :menu-icon-size="menuIconSize"
        :open-menu-key="openMenuKey"
        :result-panel-icon="resultPanelIcon"
        :result-panel-open="Boolean(resultPanelOpen)"
        :result-panel-title="resultPanelTitle"
        :result-panel-tool-key="resultPanelToolKey ?? null"
        :stack-tool-selections="stackToolSelections"
        :toolbar-icon-size="toolbarIconSize"
        utility-panel-icon="mip"
        :utility-panel-open="Boolean(isMprMipPanelOpen && activeMprMipConfig)"
        utility-panel-title="MIP Params"
        utility-panel-tool-key="mprMip"
        @apply-tool="(tool, behavior) => emitWhenIdle(() => emit('applyTool', tool, behavior))"
        @close-result-panel="emit('closeResultPanel')"
        @close-utility-panel="emit('closeMprMipPanel')"
        @end-playback="emit('endPlayback')"
        @pause-playback="emit('pausePlayback')"
        @open-settings="emit('openSettings', $event)"
        @select-tool-option="emitToolbarOption"
        @set-menu-open="emit('setMenuOpen', $event)"
        @dock-resize="emit('dockResize')"
      >
        <template #result>
          <slot name="result" />
        </template>
        <template #panel>
          <MprMipConfigPanel
            v-if="isMprMipPanelOpen && activeMprMipConfig"
            class="four-d-dock-panel"
            :config="activeMprMipConfig"
            @config-change="(config, actionType) => emit('mprMipConfigChange', config, actionType)"
          />
        </template>
        <template #status>
          <FourDStatusControls
            layout="dock"
            :interaction-locked="interactionLocked"
            :external-playback-locked="isSlicePlaybackActive"
            :is-playing="isPlaying"
            :normalized-fps="normalizedFps"
            :normalized-phase-index="normalizedPhaseIndex"
            :phase-items="phaseItems"
            :phase-load-progress-label="phaseLoadProgressLabel"
            :phase-runtime-kind="phaseRuntimeKind"
            :phase-status-aria-label="phaseStatusAriaLabel"
            :phase-visual-states="phaseVisualStates"
            :playback-button-disabled="playbackButtonDisabled"
            :playback-button-label="playbackButtonLabel"
            :playback-button-title="playbackButtonTitle"
            :playback-progress="playbackProgress"
            show-phase-panel
            show-playback-controls
            :show-tab-strip-toggle="false"
            :is-tab-strip-collapsed="props.isTabStripCollapsed"
            @fps-change="selectFps"
            @phase-change="selectPhase"
            @playback-toggle="togglePlayback"
            @toggle-tab-strip="emit('toggleTabStrip')"
          />
        </template>
      </ViewerToolbarDock>
    </div>
  </div>
</template>

<style scoped>
.four-d-root {
  display: grid;
}

.four-d-root--top {
  grid-template-rows: auto minmax(0, 1fr);
}

.four-d-root--right {
  grid-template-rows: minmax(0, 1fr);
}

.four-d-content--top {
  grid-template-columns: minmax(0, 1fr) 104px;
}

.four-d-content--right {
  grid-template-columns: minmax(0, 1fr) auto;
}

@media (max-width: 1280px) {
  .four-d-content--top {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }
}

.four-d-dock-panel {
  width: 100%;
  max-width: 100%;
  border-radius: 14px !important;
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

.four-d-toolbar-shell {
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 78%, transparent);
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

.four-d-phase-button--active {
  border-color: var(--theme-active-border);
  background: var(--theme-active-surface-soft);
  box-shadow: var(--theme-active-shadow-soft);
}

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
  border-radius: 999px;
  flex: 0 0 auto;
}

.four-d-phase-legend__dot--loaded {
  background: #34d399;
}

.four-d-phase-legend__dot--loading {
  background: var(--theme-accent-warm);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme-accent-warm) 14%, transparent);
}

.four-d-phase-legend__dot--unloaded {
  background: color-mix(in srgb, var(--theme-text-primary) 24%, transparent);
  border: 1px dashed color-mix(in srgb, var(--theme-text-primary) 32%, transparent);
}

.four-d-phase-runtime__dot--idle {
  background: color-mix(in srgb, var(--theme-text-primary) 24%, transparent);
  border: 1px dashed color-mix(in srgb, var(--theme-text-primary) 32%, transparent);
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
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card) 88%, white 4%), color-mix(in srgb, var(--theme-surface-panel-solid) 90%, black 8%));
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
