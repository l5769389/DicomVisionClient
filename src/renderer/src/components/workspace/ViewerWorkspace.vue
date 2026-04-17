<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { ViewOperationType } from '@shared/viewerConstants'
import type { DraftMeasurementMode, MeasurementDraft, MeasurementOverlay, ViewerTabItem, ViewType, WorkspaceReadyPayload } from '../../types/viewer'
import { useViewerWorkspacePointer } from '../../composables/measurements/useViewerWorkspacePointer'
import { filterMeasurementDraftByPreferences, filterMeasurementOverlayByPreferences } from '../../composables/measurements/measurementLabelPreferences'
import { useViewerWorkspaceShell } from '../../composables/workspace/shell/useViewerWorkspaceShell'
import MprView from '../viewer/views/MprView.vue'
import StackView from '../viewer/views/StackView.vue'
import DicomTagView from '../viewer/views/DicomTagView.vue'
import VolumeView from '../viewer/views/VolumeView.vue'
import VolumeRenderConfigPanel from './VolumeRenderConfigPanel.vue'
import ViewerTabStrip from './ViewerTabStrip.vue'
import ViewerToolbar from './shell/ViewerToolbar.vue'
import type { VolumeRenderConfig } from '../../types/viewer'
import { useViewerWorkspaceToolbar } from '../../composables/workspace/toolbar/useViewerWorkspaceToolbar'
import MtfCurveDialog from '../viewer/overlays/MtfCurveDialog.vue'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'

const props = defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
  activeTabKey: string
  hasSelectedSeries: boolean
  isViewLoading: boolean
  message: string
  selectedSeriesId: string
  viewerTabs: ViewerTabItem[]
}>()

const SERIES_DRAG_TYPE = 'application/x-dicomvision-series-id'

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
  tagIndexChange: [payload: { tabKey: string; index: number }]
  mtfClear: []
  mtfCommit: [payload: { viewportKey: string; points: { x: number; y: number }[]; mtfId?: string }]
  mtfCopy: [payload?: { mtfId?: string | null }]
  mtfDelete: [payload?: { mtfId?: string | null }]
  mtfSelect: [payload: { mtfId: string | null }]
  mprCrosshair: [payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }]
  setActiveOperation: [value: string]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  triggerViewAction: [payload: { action: 'reset' | 'volumePreset' | 'rotate' | 'pseudocolor' | 'windowPreset'; value?: string }]
  volumeConfigChange: [config: VolumeRenderConfig]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: ViewOperationType; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [deltaY: number]
  quickPreviewSeriesDrop: [seriesId: string]
  quickPreviewSelectedSeries: []
  openSeriesView: [seriesId: string, viewType: ViewType]
  toggleSidebar: []
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = useTemplateRef<HTMLElement>('viewportHostRef')
const activeTabRef = computed(() => props.activeTab)
const activeTabKeyRef = computed(() => props.activeTabKey)
const activeOperationRef = computed(() => props.activeOperation)
const isViewLoadingRef = computed(() => props.isViewLoading)
const viewerTabsRef = computed(() => props.viewerTabs)
const { t } = useUiLocale()
const { roiStatOptions } = useUiPreferences()

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
  emitOpenSeriesView: (seriesId, viewType) => emit('openSeriesView', seriesId, viewType),
  activeViewportKey,
  cleanupPointerInteractions,
  stopViewportDrag: () => stopViewportDrag(),
  setActiveViewport
})

function getDraftMeasurement(viewportKey: string): MeasurementDraft | null {
  const draft = draftMeasurements.value[viewportKey]
  return filterMeasurementDraftByPreferences(draft ?? null, roiStatOptions.value)
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
    return committedMeasurements.map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
  }

  return committedMeasurements
    .filter((measurement) => measurement.measurementId !== editingMeasurementId)
    .map((measurement) => filterMeasurementOverlayByPreferences(measurement, roiStatOptions.value))
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
const isQuickPreviewDropActive = ref(false)
const activeMtfState = computed(() => props.activeTab?.mtfState ?? null)
const canAcceptQuickPreviewDrop = computed(() => !props.isViewLoading && !props.activeTab)
const hasViewerTabs = computed(() => props.viewerTabs.length > 0)
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

function resolveDraggedSeriesId(event: DragEvent): string {
  const transfer = event.dataTransfer
  if (!transfer) {
    return ''
  }

  return transfer.getData(SERIES_DRAG_TYPE) || transfer.getData('text/plain') || ''
}

function isSeriesDragEvent(event: DragEvent): boolean {
  const transfer = event.dataTransfer
  if (!transfer) {
    return false
  }

  const types = Array.from(transfer.types ?? [])
  return types.includes(SERIES_DRAG_TYPE) || types.includes('text/plain')
}

function handleQuickPreviewDragEnter(event: DragEvent): void {
  if (!canAcceptQuickPreviewDrop.value || !isSeriesDragEvent(event)) {
    return
  }

  event.preventDefault()
  isQuickPreviewDropActive.value = true
}

function handleQuickPreviewDragOver(event: DragEvent): void {
  if (!canAcceptQuickPreviewDrop.value || !isSeriesDragEvent(event)) {
    return
  }

  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  isQuickPreviewDropActive.value = true
}

function handleQuickPreviewDragLeave(event: DragEvent): void {
  const relatedTarget = event.relatedTarget
  if (relatedTarget instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
    return
  }

  isQuickPreviewDropActive.value = false
}

function handleQuickPreviewDrop(event: DragEvent): void {
  if (!canAcceptQuickPreviewDrop.value || !isSeriesDragEvent(event)) {
    isQuickPreviewDropActive.value = false
    return
  }

  event.preventDefault()
  const seriesId = resolveDraggedSeriesId(event).trim()
  isQuickPreviewDropActive.value = false
  if (!seriesId) {
    return
  }

  emit('quickPreviewSeriesDrop', seriesId)
}

function handleQuickPreviewDragEnd(): void {
  isQuickPreviewDropActive.value = false
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
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
    event.preventDefault()
    if (props.activeTabKey) {
      emit('closeTab', props.activeTabKey)
    }
    return
  }

  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    emit('toggleSidebar')
    return
  }

  if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && props.selectedSeriesId) {
    event.preventDefault()
    emit('quickPreviewSelectedSeries')
    return
  }

  if (event.key === 'F10' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    exportActiveImage()
    return
  }

  handleNavigationShortcut(event)
}

function getActiveSliceInfo(): { current: number; total: number } | null {
  const tab = props.activeTab
  if (!tab) {
    return null
  }

  const raw =
    tab.viewType === 'MPR'
      ? tab.viewportSliceLabels?.[activeViewportKey.value as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'] ?? tab.sliceLabel
      : tab.sliceLabel
  const match = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return null
  }

  const current = Number(match[1])
  const total = Number(match[2])
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return null
  }

  return { current, total }
}

function exportActiveImage(): void {
  const activeTab = props.activeTab
  if (!activeTab) {
    return
  }

  const imageSrc =
    activeTab.viewType === 'MPR'
      ? activeTab.viewportImages?.[
          (activeViewportKey.value === 'single' || activeViewportKey.value === 'volume'
            ? 'mpr-ax'
            : activeViewportKey.value) as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
        ]
      : activeTab.imageSrc
  if (!imageSrc) {
    return
  }

  const anchor = document.createElement('a')
  const safeTitle = activeTab.seriesTitle.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'dicom-view'
  anchor.href = imageSrc
  anchor.download = `${safeTitle}-${activeTab.viewType}.png`
  anchor.click()
}

function handleNavigationShortcut(event: KeyboardEvent): void {
  const tab = props.activeTab
  if (!tab) {
    return
  }

  if (tab.viewType === 'Tag') {
    const currentIndex = tab.tagIndex ?? 0
    const total = Math.max(1, tab.tagTotal ?? 1)
    let nextIndex: number | null = null

    if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = total - 1
    } else if (event.key === 'ArrowLeft') {
      nextIndex = Math.max(0, currentIndex - (event.shiftKey ? 10 : 1))
    } else if (event.key === 'ArrowRight') {
      nextIndex = Math.min(total - 1, currentIndex + (event.shiftKey ? 10 : 1))
    }

    if (nextIndex != null && nextIndex !== currentIndex) {
      event.preventDefault()
      emit('tagIndexChange', { tabKey: tab.key, index: nextIndex })
    }
    return
  }

  if (tab.viewType !== 'Stack' && tab.viewType !== 'MPR') {
    return
  }

  const sliceInfo = getActiveSliceInfo()
  if (!sliceInfo) {
    return
  }

  let delta: number | null = null
  if (event.key === 'Home') {
    delta = 1 - sliceInfo.current
  } else if (event.key === 'End') {
    delta = sliceInfo.total - sliceInfo.current
  } else if (event.key === 'ArrowLeft') {
    delta = event.shiftKey ? -10 : -1
  } else if (event.key === 'ArrowRight') {
    delta = event.shiftKey ? 10 : 1
  }

  if (!delta) {
    return
  }

  event.preventDefault()
  handleViewportWheel({
    viewportKey: activeViewportKey.value,
    deltaY: delta,
    exact: true
  })
}

onMounted(() => {
  window.addEventListener('keydown', handleWorkspaceKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWorkspaceKeydown)
  isQuickPreviewDropActive.value = false
})
</script>

<template>
  <main
    class="theme-shell-panel min-h-0 min-w-0 overflow-hidden rounded-[26px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_56px_rgba(0,0,0,0.28)]"
  >
    <div
      v-if="!hasSelectedSeries"
      class="grid h-full place-items-center rounded-[20px] border border-dashed p-8 text-center transition duration-150"
      :class="isQuickPreviewDropActive ? 'theme-drop-active' : 'theme-shell-panel-soft'"
      @dragenter="handleQuickPreviewDragEnter"
      @dragover="handleQuickPreviewDragOver"
      @dragleave="handleQuickPreviewDragLeave"
      @drop="handleQuickPreviewDrop"
      @dragend="handleQuickPreviewDragEnd"
    >
      <div class="max-w-xl space-y-3">
        <div class="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--theme-text-muted)]">{{ t('viewerWorkspace') }}</div>
        <div class="text-3xl font-semibold tracking-[0.08em] text-[var(--theme-text-primary)]">{{ isQuickPreviewDropActive ? t('dropQuickPreview') : t('waitingSeries') }}</div>
        <div class="mx-auto h-px w-24" :style="{ background: 'linear-gradient(to right, transparent, color-mix(in srgb, var(--theme-accent) 45%, transparent), transparent)' }"></div>
        <p class="text-sm leading-7 text-[var(--theme-text-secondary)]">
          {{ isQuickPreviewDropActive ? t('dropQuickPreviewDesc') : message || t('waitingSeriesDesc') }}
        </p>
      </div>
    </div>

    <div v-else class="flex h-full min-h-0 flex-col gap-3">
      <ViewerTabStrip
        v-if="hasViewerTabs"
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
        v-if="activeTab && activeTab.viewType !== 'Tag'"
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

      <div v-if="isViewLoading" class="theme-shell-panel-strong grid flex-1 place-items-center rounded-[20px] border p-8">
        <div class="flex items-center gap-3 text-sm text-[var(--theme-text-secondary)]">
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--theme-accent)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--theme-accent)_14%,transparent)]"></span>
          <span>{{ t('loadingView') }}</span>
        </div>
      </div>

      <div
        v-else-if="activeTab"
        ref="viewportHostRef"
        class="theme-viewport-surface relative flex-1 overflow-hidden rounded-[20px] border p-2.5"
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
          v-else-if="activeTab.viewType === '3D'"
          :active-tab="activeTab"
          @viewport-click="handleViewportClick"
          @pointer-down="handleViewportPointerDown"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />

        <DicomTagView
          v-else
          :active-tab="activeTab"
          @index-change="emit('tagIndexChange', $event)"
        />

        <MtfCurveDialog
          :is-open="isMtfCurveDialogOpen"
          :mtf-item="selectedMtfItem"
          @close="handleCloseMtfCurve"
        />
      </div>

      <div
        v-else
        class="grid flex-1 place-items-center rounded-[20px] border border-dashed p-8 text-center transition duration-150"
        :class="isQuickPreviewDropActive ? 'theme-drop-active' : 'theme-shell-panel-soft'"
        @dragenter="handleQuickPreviewDragEnter"
        @dragover="handleQuickPreviewDragOver"
        @dragleave="handleQuickPreviewDragLeave"
        @drop="handleQuickPreviewDrop"
        @dragend="handleQuickPreviewDragEnd"
      >
        <div class="max-w-lg space-y-3">
          <div class="text-2xl font-semibold tracking-[0.06em] text-[var(--theme-text-primary)]">{{ isQuickPreviewDropActive ? t('dropQuickPreview') : t('openView') }}</div>
          <p class="text-sm leading-7 text-[var(--theme-text-secondary)]">
            {{ isQuickPreviewDropActive ? t('emptyDropQuickPreviewDesc') : message || t('openViewDesc') }}
          </p>
        </div>
      </div>
    </div>
  </main>
</template>
