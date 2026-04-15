<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { ViewOperationType } from '@shared/viewerConstants'
import type { DraftMeasurementMode, MeasurementDraft, MeasurementOverlay, ViewerTabItem, WorkspaceReadyPayload } from '../../types/viewer'
import { useViewerWorkspacePointer } from '../../composables/measurements/useViewerWorkspacePointer'
import { useViewerWorkspaceShell } from '../../composables/workspace/shell/useViewerWorkspaceShell'
import MprView from '../viewer/views/MprView.vue'
import StackView from '../viewer/views/StackView.vue'
import VolumeView from '../viewer/views/VolumeView.vue'
import VolumeRenderConfigPanel from './VolumeRenderConfigPanel.vue'
import ViewerTabStrip from './ViewerTabStrip.vue'
import ViewerToolbar from './shell/ViewerToolbar.vue'
import type { VolumeRenderConfig } from '../../types/viewer'
import { useViewerWorkspaceToolbar } from '../../composables/workspace/toolbar/useViewerWorkspaceToolbar'
import MtfCurveDialog from '../viewer/overlays/MtfCurveDialog.vue'

const props = defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
  activeTabKey: string
  hasSelectedSeries: boolean
  isViewLoading: boolean
  message: string
  viewerTabs: ViewerTabItem[]
}>()

const emit = defineEmits<{
  activateTab: [tabKey: string]
  activeViewportChange: [viewportKey: string]
  closeTab: [tabKey: string]
  measurementDraft: [payload: { viewportKey: string; toolType: 'line' | 'rect' | 'ellipse' | 'angle'; phase: 'start' | 'move' | 'end'; points: { x: number; y: number }[] }]
  measurementCreate: [payload: {
    viewportKey: string
    toolType: 'line' | 'rect' | 'ellipse' | 'angle'
    points: { x: number; y: number }[]
    measurementId?: string
    labelLines?: string[]
  }]
  measurementDelete: [payload: { viewportKey: string; measurementId: string }]
  mtfClear: []
  mtfCommit: [payload: { viewportKey: string; points: { x: number; y: number }[]; mtfId?: string }]
  mtfCopy: [payload?: { mtfId?: string | null }]
  mtfDelete: [payload?: { mtfId?: string | null }]
  mtfSelect: [payload: { mtfId: string | null }]
  mprCrosshair: [payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }]
  setActiveOperation: [value: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  triggerViewAction: [payload: { action: 'reset' | 'volumePreset'; value?: string }]
  volumeConfigChange: [config: VolumeRenderConfig]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [deltaY: number]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = useTemplateRef<HTMLElement>('viewportHostRef')
const activeTabRef = computed(() => props.activeTab)
const activeTabKeyRef = computed(() => props.activeTabKey)
const activeOperationRef = computed(() => props.activeOperation)
const isViewLoadingRef = computed(() => props.isViewLoading)
const viewerTabsRef = computed(() => props.viewerTabs)

const {
  activeViewportKey,
  cleanupPointerInteractions,
  copySelectedMeasurement,
  deleteSelectedMeasurement,
  draftMeasurements,
  getMtfDraft,
  getMtfDraftMode,
  getDraftMeasurementMode,
  handleViewportPointerCancel,
  handleViewportPointerLeave,
  handleViewportPointerDown,
  handleViewportPointerMove,
  handleViewportPointerUp,
  setActiveViewport,
  stopViewportDrag,
  updateDraftMeasurementLabelLines,
  viewportCursorClasses
} = useViewerWorkspacePointer({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitActiveViewportChange: (viewportKey) => emit('activeViewportChange', viewportKey),
  emitOperationChange: (value) => emit('setActiveOperation', value),
  emitMeasurementDraft: (payload) => emit('measurementDraft', payload),
  emitMeasurementCreate: (payload) => emit('measurementCreate', payload),
  emitMeasurementDelete: (payload) => emit('measurementDelete', payload),
  emitMtfCommit: (payload) => emit('mtfCommit', payload),
  emitMtfDelete: (payload) => emit('mtfDelete', payload),
  emitMtfSelect: (payload) => emit('mtfSelect', payload),
  emitMprCrosshair: (payload) => emit('mprCrosshair', payload),
  emitViewportDrag: (payload) => emit('viewportDrag', payload),
  getCommittedMeasurements: (viewportKey) => getCommittedMeasurements(viewportKey),
  getMtfItems: (viewportKey) => getMtfItems(viewportKey)
})
const {
  activeTools,
  activeVolumeRenderConfig,
  applyTool,
  areToolbarActionsDisabled,
  closeMenus,
  endPlayback,
  handleViewportClick,
  handleViewportWheel,
  isPlaying,
  isPlaybackPaused,
  isToolSelected,
  isVolumeConfigPanelOpen,
  menuIconSize,
  openMenuKey,
  pausePlayback,
  selectToolOption,
  setMenuOpen,
  stackToolSelections,
  toolbarIconSize,
  toggleIconSize
} = useViewerWorkspaceToolbar({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitSetActiveOperation: (value) => emit('setActiveOperation', value),
  emitTriggerViewAction: (payload) => emit('triggerViewAction', payload),
  emitViewportWheel: (deltaY) => emit('viewportWheel', deltaY),
  activeViewportKey,
  cleanupPointerInteractions,
  stopViewportDrag: () => stopViewportDrag(),
  setActiveViewport
})

function getDraftMeasurement(viewportKey: string): MeasurementDraft | null {
  const draft = draftMeasurements.value[viewportKey]
  return draft ?? null
}

function getCommittedMeasurements(viewportKey: string): MeasurementOverlay[] {
  if (!props.activeTab) {
    return []
  }
  if (props.activeTab.viewType === 'MPR') {
    return props.activeTab.viewportMeasurements?.[viewportKey as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'] ?? []
  }
  return props.activeTab.measurements ?? []
}

function getVisibleCommittedMeasurements(viewportKey: string): MeasurementOverlay[] {
  const committedMeasurements = getCommittedMeasurements(viewportKey)
  const draft = draftMeasurements.value[viewportKey]
  const editingMeasurementId = draft?.measurementId
  if (!editingMeasurementId) {
    return committedMeasurements
  }

  return committedMeasurements.filter((measurement) => measurement.measurementId !== editingMeasurementId)
}

function getMtfItems(viewportKey: string) {
  const items = (props.activeTab?.mtfState?.items ?? []).filter((item) => item.viewportKey === viewportKey)
  const draft = getMtfDraft(viewportKey)
  if (!draft?.mtfId) {
    return items
  }

  return items.filter((item) => item.mtfId !== draft.mtfId)
}

function getViewportCursorClass(viewportKey: string): string {
  return viewportCursorClasses.value[viewportKey] ?? ''
}

function getMprCornerInfo(viewportKey: string) {
  return (
    props.activeTab?.viewportCornerInfos?.[viewportKey as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'] ??
    props.activeTab?.cornerInfo ?? {
      topLeft: [],
      topRight: [],
      bottomLeft: [],
      bottomRight: []
    }
  )
}

const isMtfCurveDialogOpen = ref(false)
const activeMtfState = computed(() => props.activeTab?.mtfState ?? null)
const selectedMtfItem = computed(() => {
  const state = activeMtfState.value
  if (!state?.selectedMtfId) {
    return null
  }

  return state.items.find((item) => item.mtfId === state.selectedMtfId) ?? null
})

function handleOpenMtfCurve(): void {
  if (selectedMtfItem.value?.status === 'ready') {
    isMtfCurveDialogOpen.value = true
  }
}

function handleCloseMtfCurve(): void {
  isMtfCurveDialogOpen.value = false
}

function handleClearMtf(): void {
  isMtfCurveDialogOpen.value = false
  emit('mtfDelete', {
    mtfId: selectedMtfItem.value?.mtfId ?? null
  })
}

function handleCopySelectedMtf(): void {
  if (!selectedMtfItem.value) {
    return
  }

  emit('mtfCopy', {
    mtfId: selectedMtfItem.value.mtfId
  })
}

function handleDeleteSelectedMtf(): void {
  handleClearMtf()
}

function handleSelectMtf(payload: { mtfId: string | null }): void {
  emit('mtfSelect', payload)
}

function copySelectedMtfAction(): boolean {
  if (!selectedMtfItem.value) {
    return false
  }

  handleCopySelectedMtf()
  return true
}

function deleteSelectedMtfAction(): boolean {
  if (!selectedMtfItem.value) {
    return false
  }

  handleDeleteSelectedMtf()
  return true
}

watch(
  () => activeMtfState.value,
  (value) => {
    if (!value?.items.length || !selectedMtfItem.value) {
      isMtfCurveDialogOpen.value = false
    }
  }
)

const { canScrollTabsLeft, canScrollTabsRight, handleTabStripWheel, scrollTabs, tabStripRef, updateTabScrollState } =
  useViewerWorkspaceShell({
    activeTab: activeTabRef,
    activeTabKey: activeTabKeyRef,
    activeViewportKey,
    cleanupPointerInteractions,
    closeMenus,
    emitWorkspaceReady: (payload) => emit('workspaceReady', payload),
    isViewLoading: isViewLoadingRef,
    updateDraftMeasurementLabelLines,
    viewerTabs: viewerTabsRef,
    viewportHostRef
  })

function handleWorkspaceKeydown(event: KeyboardEvent): void {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return
  }

  const preferMtf = props.activeOperation === 'mtf'

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    if ((preferMtf && copySelectedMtfAction()) || copySelectedMeasurement() || copySelectedMtfAction()) {
      event.preventDefault()
    }
    return
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    if ((preferMtf && deleteSelectedMtfAction()) || deleteSelectedMeasurement() || deleteSelectedMtfAction()) {
      event.preventDefault()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleWorkspaceKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWorkspaceKeydown)
})
</script>

<template>
  <main
    class="min-h-0 min-w-0 overflow-hidden rounded-[26px] border border-sky-100/10 bg-[linear-gradient(180deg,rgba(6,13,24,0.97),rgba(7,14,27,0.99))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_56px_rgba(0,0,0,0.28)]"
  >
    <div v-if="!hasSelectedSeries" class="grid h-full place-items-center rounded-[20px] border border-dashed border-white/8 bg-[linear-gradient(180deg,rgba(7,14,25,0.94),rgba(4,9,18,0.98))] p-8 text-center">
      <div class="max-w-xl space-y-3">
        <div class="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400/70">Viewer Workspace</div>
        <div class="text-3xl font-semibold tracking-[0.08em] text-slate-50">等待载入序列</div>
        <div class="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-sky-300/45 to-transparent"></div>
        <p class="text-sm leading-7 text-slate-300">
          {{ message || '请先在左侧序列列表中选择一个序列，然后打开对应视图。' }}
        </p>
      </div>
    </div>

    <div v-else class="flex h-full min-h-0 flex-col gap-3">
      <ViewerTabStrip
        v-model:tab-strip-ref="tabStripRef"
        :active-tab-key="activeTabKey"
        :can-scroll-tabs-left="canScrollTabsLeft"
        :can-scroll-tabs-right="canScrollTabsRight"
        :viewer-tabs="viewerTabs"
        @activate-tab="emit('activateTab', $event)"
        @close-tab="emit('closeTab', $event)"
        @scroll-tabs="scrollTabs"
        @tab-strip-scroll="updateTabScrollState"
        @tab-strip-wheel="handleTabStripWheel"
      />

      <ViewerToolbar
        v-if="activeTab"
        :active-tab="activeTab"
        :active-tools="activeTools"
        :are-toolbar-actions-disabled="areToolbarActionsDisabled"
        :is-playing="isPlaying"
        :is-playback-paused="isPlaybackPaused"
        :is-tool-selected="isToolSelected"
        :menu-icon-size="menuIconSize"
        :open-menu-key="openMenuKey"
        :stack-tool-selections="stackToolSelections"
        :toggle-icon-size="toggleIconSize"
        :toolbar-icon-size="toolbarIconSize"
        @apply-tool="applyTool"
        @end-playback="endPlayback"
        @pause-playback="pausePlayback"
        @select-tool-option="selectToolOption"
        @set-menu-open="setMenuOpen"
      />

      <div v-if="isViewLoading" class="grid flex-1 place-items-center rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,14,24,0.92),rgba(6,11,20,0.98))] p-8">
        <div class="flex items-center gap-3 text-sm text-slate-300">
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.14)]"></span>
          <span>正在加载视图...</span>
        </div>
      </div>

      <div
        v-else-if="activeTab"
        ref="viewportHostRef"
        class="relative flex-1 overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,14,24,0.92),rgba(6,11,20,0.98)),repeating-linear-gradient(90deg,rgba(255,255,255,0.015)_0,rgba(255,255,255,0.015)_1px,transparent_1px,transparent_28px)] p-2.5"
      >
        <div
          v-if="activeTab.viewType === '3D' && isVolumeConfigPanelOpen && activeVolumeRenderConfig"
          class="absolute right-5 top-5 z-[20]"
        >
          <VolumeRenderConfigPanel
            :config="activeVolumeRenderConfig"
            @config-change="emit('volumeConfigChange', $event)"
          />
        </div>

        <StackView
          v-if="activeTab.viewType === 'Stack'"
          :active-tab="activeTab"
          :corner-info="activeTab.cornerInfo"
          :cursor-class="getViewportCursorClass('single')"
          :draft-measurement-mode="getDraftMeasurementMode('single')"
          :draft-measurement="getDraftMeasurement('single')"
          :measurements="getVisibleCommittedMeasurements('single')"
          :mtf-draft-mode="getMtfDraftMode('single')"
          :mtf-draft="getMtfDraft('single')"
          :mtf-items="getMtfItems('single')"
          :selected-mtf-id="activeMtfState?.selectedMtfId ?? null"
          @copy-selected-measurement="copySelectedMeasurement($event)"
          @delete-selected-measurement="deleteSelectedMeasurement($event)"
          @clear-mtf="handleDeleteSelectedMtf"
          @copy-selected-mtf="handleCopySelectedMtf"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @open-mtf-curve="handleOpenMtfCurve"
          @select-mtf="handleSelectMtf"
          @viewport-click="handleViewportClick"
          @viewport-wheel="handleViewportWheel"
          @pointer-down="handleViewportPointerDown"
          @pointer-leave="handleViewportPointerLeave"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />

        <MprView
          v-else-if="activeTab.viewType === 'MPR'"
          :active-tab="activeTab"
          :active-viewport-key="activeViewportKey"
          :get-cursor-class="(viewportKey) => getViewportCursorClass(viewportKey)"
          :get-draft-measurement-mode="(viewportKey) => getDraftMeasurementMode(viewportKey)"
          :get-draft-measurement="(viewportKey) => getDraftMeasurement(viewportKey)"
          :get-measurements="(viewportKey) => getVisibleCommittedMeasurements(viewportKey)"
          :get-mtf-draft-mode="(viewportKey) => getMtfDraftMode(viewportKey)"
          :get-mtf-draft="(viewportKey) => getMtfDraft(viewportKey)"
          :get-mtf-items="(viewportKey) => getMtfItems(viewportKey)"
          :selected-mtf-id="activeMtfState?.selectedMtfId ?? null"
          :get-corner-info="(viewportKey) => getMprCornerInfo(viewportKey)"
          @copy-selected-measurement="copySelectedMeasurement($event)"
          @delete-selected-measurement="deleteSelectedMeasurement($event)"
          @clear-mtf="handleDeleteSelectedMtf"
          @copy-selected-mtf="handleCopySelectedMtf"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @open-mtf-curve="handleOpenMtfCurve"
          @select-mtf="handleSelectMtf"
          @viewport-click="handleViewportClick"
          @viewport-wheel="handleViewportWheel"
          @pointer-down="handleViewportPointerDown"
          @pointer-leave="handleViewportPointerLeave"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />

        <VolumeView
          v-else
          :active-tab="activeTab"
          @viewport-click="handleViewportClick"
          @pointer-down="handleViewportPointerDown"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />

      <MtfCurveDialog
        :is-open="isMtfCurveDialogOpen"
        :mtf-item="selectedMtfItem"
        @close="handleCloseMtfCurve"
      />
      </div>

      <div v-else class="grid flex-1 place-items-center rounded-[20px] border border-dashed border-white/8 bg-[linear-gradient(180deg,rgba(7,14,25,0.94),rgba(4,9,18,0.98))] p-8 text-center">
        <div class="max-w-lg space-y-3">
          <div class="text-2xl font-semibold tracking-[0.06em] text-slate-50">打开一个视图</div>
          <p class="text-sm leading-7 text-slate-300">
            {{ message || '点击“快速浏览 / 3D / MPR”打开当前序列对应的视图。' }}
          </p>
        </div>
      </div>
    </div>
  </main>
</template>

