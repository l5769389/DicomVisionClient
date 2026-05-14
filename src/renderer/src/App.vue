<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { VApp, VMain } from 'vuetify/components'
import AppIcon from './components/AppIcon.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import ViewerWorkspace from './components/workspace/ViewerWorkspace.vue'
import { useViewerWorkspace } from './composables/workspace/core/useViewerWorkspace'
import { isFourDSeriesItem } from './types/viewer'

const viewer = useViewerWorkspace()
const isSelectedSeriesFourD = computed(() =>
  isFourDSeriesItem(viewer.seriesList.value.find((item) => item.seriesId === viewer.selectedSeriesId.value))
)
const hasDesktopWindowControls = computed(() => typeof window !== 'undefined' && Boolean(window.viewerApi))
const isDicomFileDropActive = ref(false)
const statusToastIcon = computed(() => {
  switch (viewer.statusToast.value?.tone) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'info'
  }
})

const preventSelection = (event: Event): void => {
  event.preventDefault()
}

const preventSelectAll = (event: KeyboardEvent): void => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
  }
}

onMounted(() => {
  document.addEventListener('selectstart', preventSelection)
  window.addEventListener('keydown', preventSelectAll)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectstart', preventSelection)
  window.removeEventListener('keydown', preventSelectAll)
})

const handleQuickPreviewSeriesDrop = (seriesId: string): void => {
  void viewer.openSeriesView(seriesId, 'Stack')
}

const handleQuickPreviewSelectedSeries = (): void => {
  if (!viewer.selectedSeriesId.value) {
    return
  }

  void viewer.openSeriesView(viewer.selectedSeriesId.value, 'Stack')
}

const minimizeWindow = (): void => {
  void window.viewerApi?.minimizeWindow()
}

const toggleWindowFullScreen = (): void => {
  void window.viewerApi?.toggleWindowFullScreen()
}

const closeWindow = (): void => {
  void window.viewerApi?.closeWindow()
}

const isExternalFileDragEvent = (event: DragEvent): boolean => {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes('Files')
}

const handleDicomFileDragEnter = (event: DragEvent): void => {
  if (!isExternalFileDragEvent(event)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  isDicomFileDropActive.value = true
}

const handleDicomFileDragOver = (event: DragEvent): void => {
  if (!isExternalFileDragEvent(event)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  isDicomFileDropActive.value = true
}

const handleDicomFileDragLeave = (event: DragEvent): void => {
  if (!isExternalFileDragEvent(event)) {
    return
  }

  const relatedTarget = event.relatedTarget
  if (relatedTarget instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
    return
  }

  isDicomFileDropActive.value = false
}

const handleDicomFileDrop = (event: DragEvent): void => {
  if (!isExternalFileDragEvent(event)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  isDicomFileDropActive.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  void viewer.loadDroppedDicomFiles(files)
}
</script>

<template>
  <VApp class="bg-transparent text-[var(--theme-text-primary)]">
    <VMain
      class="relative h-full overflow-hidden bg-transparent text-[var(--theme-text-primary)]"
      @dragenter="handleDicomFileDragEnter"
      @dragover="handleDicomFileDragOver"
      @dragleave="handleDicomFileDragLeave"
      @drop="handleDicomFileDrop"
    >
      <div class="window-drag-region" aria-hidden="true"></div>
      <div v-if="hasDesktopWindowControls" class="app-window-controls" aria-label="Window controls">
        <button type="button" class="app-window-control-button" title="Minimize" aria-label="Minimize" @click="minimizeWindow">
          <AppIcon name="minimize" :size="14" />
        </button>
        <button type="button" class="app-window-control-button" title="Toggle full screen" aria-label="Toggle full screen" @click="toggleWindowFullScreen">
          <AppIcon name="fullscreen" :size="16" />
        </button>
        <button type="button" class="app-window-control-button app-window-control-button--danger" title="Close" aria-label="Close" @click="closeWindow">
          <AppIcon name="close" :size="15" />
        </button>
      </div>
      <div
        class="grid h-screen max-h-screen gap-4 overflow-hidden bg-transparent p-4 transition-[grid-template-columns] duration-200 ease-out max-[900px]:grid-cols-1"
        :class="viewer.isSidebarCollapsed.value ? 'grid-cols-[92px_minmax(0,1fr)]' : 'grid-cols-[320px_minmax(0,1fr)] max-[1280px]:grid-cols-[288px_minmax(0,1fr)]'"
      >
        <SidebarPanel
          :viewer-folder-source-mode="viewer.viewerFolderSourceMode"
          :viewer-platform="viewer.viewerPlatform"
          :connection-state="viewer.connectionState.value"
          :has-selected-series="viewer.hasSelectedSeries.value"
          :is-loading-folder="viewer.isLoadingFolder.value"
          :is-selected-series-four-d="isSelectedSeriesFourD"
          :is-sidebar-collapsed="viewer.isSidebarCollapsed.value"
          :selected-series-id="viewer.selectedSeriesId.value"
          :series-list="viewer.seriesList.value"
          @choose-folder="viewer.chooseFolder"
          @open-view="viewer.openView"
          @open-series-view="viewer.openSeriesView"
          @remove-series="viewer.removeSeries"
          @select-series="viewer.selectSeries"
          @toggle-sidebar="viewer.toggleSidebar"
        />

        <ViewerWorkspace
          :active-operation="viewer.activeOperation.value"
          :active-tab="viewer.activeTab.value"
          :active-tab-key="viewer.activeTabKey.value"
          :has-selected-series="viewer.hasSelectedSeries.value"
          :is-view-loading="viewer.isViewLoading.value"
          :message="viewer.message.value"
          :selected-series-id="viewer.selectedSeriesId.value"
          :viewer-tabs="viewer.viewerTabs.value"
          @activate-tab="viewer.activateTab"
          @close-tab="viewer.closeTab"
          @open-series-view="viewer.openSeriesView"
          @set-active-operation="viewer.setActiveOperation"
          @hover-viewport-change="viewer.handleHoverViewportChange"
          @trigger-view-action="viewer.triggerViewAction"
          @active-viewport-change="viewer.setActiveViewportKey"
          @quick-preview-series-drop="handleQuickPreviewSeriesDrop"
          @quick-preview-selected-series="handleQuickPreviewSelectedSeries"
          @toggle-sidebar="viewer.toggleSidebar"
          @measurement-draft="viewer.handleMeasurementDraft"
          @measurement-create="viewer.handleMeasurementCreate"
          @measurement-delete="viewer.handleMeasurementDelete"
          @tag-index-change="viewer.handleTagIndexChange"
          @mtf-clear="viewer.handleMtfClear"
          @mtf-commit="viewer.handleMtfCommit"
          @mtf-copy="viewer.handleMtfCopy"
          @mtf-delete="viewer.handleMtfClear"
          @mtf-select="viewer.handleMtfSelect"
          @mpr-crosshair="viewer.handleMprCrosshair"
          @four-d-phase-change="viewer.handleFourDPhaseChange"
          @four-d-fps-change="viewer.handleFourDFpsChange"
          @four-d-playback-change="viewer.handleFourDPlaybackChange"
          @volume-config-change="viewer.handleVolumeConfigChange"
          @viewport-drag="viewer.handleViewportDrag"
          @viewport-wheel="viewer.handleViewportWheel"
          @workspace-ready="viewer.setViewerStage"
        />
      </div>
      <div v-if="isDicomFileDropActive" class="dicom-file-drop-overlay" aria-live="polite">
        <div class="dicom-file-drop-overlay__panel">
          <AppIcon name="folder-import" :size="30" />
          <div class="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">DICOM Import</div>
          <div class="text-2xl font-semibold text-[var(--theme-text-primary)]">Drop files or folders to load series</div>
        </div>
      </div>
      <div v-if="viewer.statusToast.value" class="app-status-toast" :data-tone="viewer.statusToast.value.tone" role="status" aria-live="polite">
        <span class="app-status-toast__icon" aria-hidden="true">
          <AppIcon :name="statusToastIcon" :size="18" />
        </span>
        <span class="app-status-toast__message">{{ viewer.statusToast.value.message }}</span>
        <button type="button" class="app-status-toast__close" aria-label="Close notification" @click="viewer.dismissStatusToast">
          <AppIcon name="close" :size="13" />
        </button>
      </div>
    </VMain>
  </VApp>
</template>

<style scoped>
.app-window-controls {
  position: fixed;
  top: 6px;
  right: 14px;
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 80%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-panel) 82%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 10px 24px rgba(0, 0, 0, 0.16);
  -webkit-app-region: no-drag;
  backdrop-filter: blur(14px);
}

.app-window-control-button {
  display: inline-flex;
  width: 28px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font: inherit;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    transform 120ms ease;
  -webkit-app-region: no-drag;
}

.app-window-control-button:hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
}

.app-window-control-button:active {
  transform: translateY(1px);
}

.app-window-control-button--danger:hover {
  border-color: rgba(174, 67, 67, 0.72);
  background: linear-gradient(180deg, rgba(174, 67, 67, 0.94), rgba(135, 38, 38, 0.94));
  color: #fff;
}

.dicom-file-drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 1150;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--theme-accent) 18%, transparent), transparent 42%),
    rgba(2, 7, 14, 0.42);
  pointer-events: none;
  -webkit-app-region: no-drag;
  backdrop-filter: blur(4px);
}

.dicom-file-drop-overlay__panel {
  display: flex;
  max-width: min(520px, calc(100vw - 48px));
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 26px 30px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-soft));
  border-radius: 22px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong) 92%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 28px 70px rgba(0, 0, 0, 0.42);
  text-align: center;
}

.app-status-toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1400;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  width: min(440px, calc(100vw - 48px));
  align-items: center;
  gap: 10px;
  padding: 10px 10px 10px 12px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong) 92%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 18px 42px rgba(0, 0, 0, 0.3);
  color: var(--theme-text-primary);
  -webkit-app-region: no-drag;
  backdrop-filter: blur(14px);
}

.app-status-toast[data-tone="error"] {
  border-color: color-mix(in srgb, #ef7777 42%, var(--theme-border-soft));
}

.app-status-toast[data-tone="warning"] {
  border-color: color-mix(in srgb, #f3c66b 42%, var(--theme-border-soft));
}

.app-status-toast[data-tone="success"] {
  border-color: color-mix(in srgb, #7bd7a4 38%, var(--theme-border-soft));
}

.app-status-toast__icon {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
  color: var(--theme-accent);
}

.app-status-toast[data-tone="error"] .app-status-toast__icon {
  background: color-mix(in srgb, #ef7777 18%, transparent);
  color: #ffb3b3;
}

.app-status-toast[data-tone="warning"] .app-status-toast__icon {
  background: color-mix(in srgb, #f3c66b 18%, transparent);
  color: #ffe0a3;
}

.app-status-toast[data-tone="success"] .app-status-toast__icon {
  background: color-mix(in srgb, #7bd7a4 16%, transparent);
  color: #a7f3c5;
}

.app-status-toast__message {
  min-width: 0;
  color: var(--theme-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.app-status-toast__close {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--theme-border-soft);
  border-radius: 10px;
  background: var(--theme-surface-card);
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.app-status-toast__close:hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
}
</style>
