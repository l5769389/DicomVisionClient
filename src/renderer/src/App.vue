<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { VApp, VMain } from 'vuetify/components'
import AppIcon from './components/AppIcon.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import ViewerWorkspace from './components/workspace/ViewerWorkspace.vue'
import { useViewerWorkspace } from './composables/workspace/core/useViewerWorkspace'
import { openExportLocation } from './platform/exporting'
import { isFourDSeriesItem } from './types/viewer'

const viewer = useViewerWorkspace()
type AppStatusToastTone = 'info' | 'success' | 'warning' | 'error'
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
const statusToastProgressLabel = computed(() => {
  const toast = viewer.statusToast.value
  const label = toast?.progressLabel?.trim() ?? ''
  if (!label) {
    return ''
  }

  const message = toast?.message.trim() ?? ''
  const detail = toast?.detail?.trim() ?? ''
  return label === message || label === detail ? '' : label
})

const preventSelection = (event: Event): void => {
  event.preventDefault()
}

const preventSelectAll = (event: KeyboardEvent): void => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
  }
}

function isAppStatusToastTone(value: unknown): value is AppStatusToastTone {
  return value === 'info' || value === 'success' || value === 'warning' || value === 'error'
}

const handleStatusToastEvent = (event: Event): void => {
  const detail = (event as CustomEvent<{
    message?: unknown
    tone?: unknown
    detail?: unknown
    directoryPath?: unknown
    filePath?: unknown
    canOpenLocation?: unknown
    busy?: unknown
    progressLabel?: unknown
    progressPercent?: unknown
    durationMs?: unknown
  }>).detail
  const message = typeof detail?.message === 'string' ? detail.message.trim() : ''
  if (!message) {
    return
  }
  viewer.showStatusToast(message, isAppStatusToastTone(detail?.tone) ? detail.tone : 'info', {
    detail: typeof detail?.detail === 'string' ? detail.detail.trim() : null,
    directoryPath: typeof detail?.directoryPath === 'string' ? detail.directoryPath : null,
    filePath: typeof detail?.filePath === 'string' ? detail.filePath : null,
    canOpenLocation: detail?.canOpenLocation === true,
    busy: detail?.busy === true,
    progressLabel: typeof detail?.progressLabel === 'string' ? detail.progressLabel.trim() : null,
    progressPercent:
      typeof detail?.progressPercent === 'number' && Number.isFinite(detail.progressPercent)
        ? detail.progressPercent
        : null,
    durationMs: typeof detail?.durationMs === 'number' && Number.isFinite(detail.durationMs) ? detail.durationMs : undefined
  })
}

async function handleOpenStatusToastLocation(): Promise<void> {
  const toast = viewer.statusToast.value
  if (!toast?.canOpenLocation) {
    return
  }
  const opened = await openExportLocation({
    directoryPath: toast.directoryPath ?? null,
    filePath: toast.filePath ?? null
  })
  if (!opened) {
    viewer.showStatusToast('打开保存位置失败。', 'error')
  }
}

onMounted(() => {
  document.addEventListener('selectstart', preventSelection)
  window.addEventListener('keydown', preventSelectAll)
  window.addEventListener('dicomvision:status-toast', handleStatusToastEvent)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectstart', preventSelection)
  window.removeEventListener('keydown', preventSelectAll)
  window.removeEventListener('dicomvision:status-toast', handleStatusToastEvent)
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

const handleLayoutSlotDicomDrop = (payload: { tabKey: string; slotId: string; files: File[] }): void => {
  isDicomFileDropActive.value = false
  void viewer.handleLayoutSlotDicomDrop(payload)
}

const handleLayoutSlotSeriesDrop = (payload: {
  tabKey: string
  slotId: string
  seriesId: string
  folderPath?: string
  seriesInstanceUid?: string | null
}): void => {
  isDicomFileDropActive.value = false
  void viewer.handleLayoutSlotSeriesDrop(payload)
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
          @compare-series="viewer.openSeriesCompare"
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
          @open-layout-view="viewer.openLayoutView"
          @layout-slot-dicom-drop="handleLayoutSlotDicomDrop"
          @layout-slot-series-drop="handleLayoutSlotSeriesDrop"
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
          @compare-sync-change="viewer.handleCompareSyncChange"
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
      <div
        v-if="viewer.statusToast.value"
        class="app-status-toast"
        :data-busy="viewer.statusToast.value.busy ? 'true' : undefined"
        :data-tone="viewer.statusToast.value.tone"
        role="status"
        aria-live="polite"
      >
        <span class="app-status-toast__icon" :class="{ 'app-status-toast__icon--busy': viewer.statusToast.value.busy }" aria-hidden="true">
          <AppIcon :name="statusToastIcon" :size="18" />
        </span>
        <span class="app-status-toast__content">
          <span class="app-status-toast__message">{{ viewer.statusToast.value.message }}</span>
          <button
            v-if="viewer.statusToast.value.detail && viewer.statusToast.value.canOpenLocation"
            type="button"
            class="app-status-toast__detail app-status-toast__detail--button"
            :title="viewer.statusToast.value.detail"
            @click="handleOpenStatusToastLocation"
          >
            {{ viewer.statusToast.value.detail }}
          </button>
          <span
            v-else-if="viewer.statusToast.value.detail"
            class="app-status-toast__detail"
            :title="viewer.statusToast.value.detail"
          >
            {{ viewer.statusToast.value.detail }}
          </span>
          <span v-if="viewer.statusToast.value.progressPercent != null" class="app-status-toast__progress" aria-hidden="true">
            <span class="app-status-toast__progress-fill" :style="{ width: `${viewer.statusToast.value.progressPercent}%` }"></span>
          </span>
          <span v-if="statusToastProgressLabel" class="app-status-toast__progress-label">
            {{ statusToastProgressLabel }}
          </span>
        </span>
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

.app-window-control-button:focus-visible,
.app-status-toast__detail--button:focus-visible,
.app-status-toast__close:focus-visible {
  outline: none;
  box-shadow: var(--theme-focus-ring);
}

.app-window-control-button:active {
  transform: translateY(1px);
}

.app-window-control-button--danger:hover {
  border-color: var(--theme-danger-border);
  background: var(--theme-danger-surface);
  color: var(--theme-danger-text);
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
  border-color: var(--theme-status-danger-border);
}

.app-status-toast[data-tone="warning"] {
  border-color: var(--theme-status-warning-border);
}

.app-status-toast[data-tone="success"] {
  border-color: var(--theme-status-success-border);
}

.app-status-toast__icon {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--theme-status-info-surface);
  color: var(--theme-status-info-text);
}

.app-status-toast__icon--busy {
  position: relative;
}

.app-status-toast__icon--busy::after {
  position: absolute;
  inset: -3px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 46%, transparent);
  border-radius: 12px;
  content: "";
  animation: app-status-busy-pulse 1.4s ease-out infinite;
}

@keyframes app-status-busy-pulse {
  0% {
    opacity: 0.88;
    transform: scale(0.88);
  }
  100% {
    opacity: 0;
    transform: scale(1.18);
  }
}

.app-status-toast[data-tone="error"] .app-status-toast__icon {
  background: var(--theme-status-danger-surface);
  color: var(--theme-status-danger-text);
}

.app-status-toast[data-tone="warning"] .app-status-toast__icon {
  background: var(--theme-status-warning-surface);
  color: var(--theme-status-warning-text);
}

.app-status-toast[data-tone="success"] .app-status-toast__icon {
  background: var(--theme-status-success-surface);
  color: var(--theme-status-success-text);
}

.app-status-toast__message {
  display: block;
  min-width: 0;
  color: var(--theme-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.app-status-toast__content {
  min-width: 0;
}

.app-status-toast__detail {
  display: block;
  max-width: 100%;
  margin-top: 2px;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-status-toast__detail--button {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--theme-accent) 56%, transparent);
  text-underline-offset: 3px;
}

.app-status-toast__detail--button:hover {
  color: var(--theme-accent);
}

.app-status-toast__progress {
  display: block;
  width: 100%;
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-border-soft) 58%, transparent);
}

.app-status-toast__progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--theme-accent) 82%, var(--theme-text-primary) 10%),
    color-mix(in srgb, var(--theme-accent-warm) 62%, var(--theme-accent) 38%)
  );
  transition: width 220ms ease;
}

.app-status-toast__progress-label {
  display: block;
  margin-top: 4px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
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
