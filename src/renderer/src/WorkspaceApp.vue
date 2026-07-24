<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue'
import { VApp, VMain } from 'vuetify/components'
import dicomFileIcon from './assets/dicom-action-icons/dicom-file.svg?raw'
import folderIcon from './assets/dicom-action-icons/open-folder.svg?raw'
import { useUiLocale } from './composables/ui/useUiLocale'
import { useUiPreferences, type AppLocale } from './composables/ui/useUiPreferences'
import { useViewerWorkspace } from './composables/workspace/core/useViewerWorkspace'
import type { DicomDropInput } from './platform/runtime'
import { isFourDSeriesItem } from './types/viewer'
import { resolvePrimaryTwoDimensionalViewType } from './composables/workspace/views/seriesViewSupport'
import { normalizeInlineSvg } from './utils/svg'
import { initializePwaInstall } from './platform/pwaInstall'
import { usePointerDockResize } from './composables/ui/usePointerDockResize'

const SidebarBootFallback = defineComponent({
  name: 'SidebarBootFallback',
  setup: () => () =>
    h('aside', { class: 'app-boot-panel app-boot-panel--sidebar', 'aria-hidden': 'true' }, [
      h('div', { class: 'app-boot-brand' }, [
        h('span', { class: 'app-boot-brand__mark' }),
        h('span', { class: 'app-boot-brand__line' })
      ]),
      h('div', { class: 'app-boot-stack' }, [
        h('span', { class: 'app-boot-line app-boot-line--wide' }),
        h('span', { class: 'app-boot-line' }),
        h('span', { class: 'app-boot-line app-boot-line--short' })
      ]),
      h('div', { class: 'app-boot-list' }, Array.from({ length: 5 }, (_, index) => h('span', { class: 'app-boot-row', key: index })))
    ])
})

const WorkspaceBootFallback = defineComponent({
  name: 'WorkspaceBootFallback',
  setup: () => () =>
    h('section', { class: 'app-boot-panel app-boot-panel--workspace', 'aria-hidden': 'true' }, [
      h('div', { class: 'app-boot-toolbar' }, [
        h('span', { class: 'app-boot-pill' }),
        h('span', { class: 'app-boot-pill app-boot-pill--short' }),
        h('span', { class: 'app-boot-pill app-boot-pill--short' })
      ]),
      h('div', { class: 'app-boot-viewer' }, [
        h('span', { class: 'app-boot-crosshair app-boot-crosshair--horizontal' }),
        h('span', { class: 'app-boot-crosshair app-boot-crosshair--vertical' })
      ])
    ])
})

const shellIconPaths: Record<string, string> = {
  close:
    'M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29 10.59 10.59 16.89 4.29z',
  error:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.54 12.12-1.42 1.42L12 13.41l-2.12 2.13-1.42-1.42L10.59 12 8.46 9.88l1.42-1.42L12 10.59l2.12-2.13 1.42 1.42L13.41 12l2.13 2.12Z',
  fullscreen:
    'M5 5h6v2H7v4H5V5Zm8 0h6v6h-2V7h-4V5ZM5 13h2v4h4v2H5v-6Zm12 0h2v6h-6v-2h4v-4Z',
  info:
    'M11 17h2v-6h-2v6Zm0-8h2V7h-2v2Zm1-7a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',
  minimize: 'M5 18h14v-2H5v2Z',
  success:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 13.8-3.6-3.6 1.4-1.4 2.2 2.2 4.8-4.8 1.4 1.4-6.2 6.2Z',
  warning:
    'M1.8 21h20.4L12 3 1.8 21Zm11.2-3h-2v-2h2v2Zm0-4h-2V9h2v5Z'
}

const ShellIcon = defineComponent({
  name: 'ShellIcon',
  props: {
    name: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      default: 24
    }
  },
  setup(props) {
    return () =>
      h(
        'svg',
        {
          class: 'app-shell-icon-svg',
          width: props.size,
          height: props.size,
          viewBox: '0 0 24 24',
          focusable: 'false',
          'aria-hidden': 'true'
        },
        [h('path', { d: shellIconPaths[props.name] ?? shellIconPaths.info })]
      )
  }
})

const SidebarPanel = defineAsyncComponent({
  loader: () => import('./components/SidebarPanel.vue'),
  loadingComponent: SidebarBootFallback,
  delay: 0,
  suspensible: false
})
const ViewerWorkspace = defineAsyncComponent({
  loader: () => import('./components/workspace/ViewerWorkspace.vue'),
  loadingComponent: WorkspaceBootFallback,
  delay: 0,
  suspensible: false
})

const viewer = useViewerWorkspace()
const { locale } = useUiLocale()
const {
  confirmInitialLocale,
  hasSelectedInitialLocale,
  workspaceDockPreference,
  setWorkspaceDockPreference
} = useUiPreferences()
type AppStatusToastTone = 'info' | 'success' | 'warning' | 'error'
type DicomDropPreviewKind = 'file' | 'folder' | 'mixed'
const SIDEBAR_MIN_WIDTH = 280
const SIDEBAR_MAX_WIDTH = 480
const SIDEBAR_COLLAPSE_THRESHOLD = 220
const SIDEBAR_COLLAPSED_WIDTH = 64

const isZh = computed(() => locale.value === 'zh-CN')
const isWebPlatform = computed(() => viewer.viewerPlatform === 'web')
const shouldShowIcpFooter = computed(
  () =>
    isWebPlatform.value &&
    !viewer.hasSelectedSeries.value &&
    viewer.seriesList.value.length === 0 &&
    viewer.viewerTabs.value.length === 0
)
const isSelectedSeriesFourD = computed(() =>
  isFourDSeriesItem(viewer.seriesList.value.find((item) => item.seriesId === viewer.selectedSeriesId.value))
)
const hasDesktopWindowControls = computed(() => typeof window !== 'undefined' && Boolean(window.viewerApi))
const closeNotificationLabel = computed(() => (isZh.value ? '关闭通知' : 'Close notification'))
const shouldShowInitialLocaleDialog = computed(() => !hasSelectedInitialLocale.value)
const isDicomFileDropActive = ref(false)
const dicomDropPreviewKind = ref<DicomDropPreviewKind>('file')
const sidebarPanelRef = ref<{ openSettings?: (sectionKey?: string | null) => void } | null>(null)
const sidebarDockResize = usePointerDockResize<'sidebar'>({
  onCommit: (_key, result) => {
    setWorkspaceDockPreference({
      ...workspaceDockPreference.value,
      leftWidth: result.collapsed ? workspaceDockPreference.value.leftWidth : result.width,
      leftCollapsed: result.collapsed
    })
    if (viewer.isSidebarCollapsed.value !== result.collapsed) {
      viewer.toggleSidebar()
    }
  }
})
const sidebarResizePreviewWidth = computed(() => sidebarDockResize.preview.value?.result.width ?? null)
const sidebarResizePreviewCollapsed = computed(() => sidebarDockResize.preview.value?.result.collapsed ?? null)
const isSidebarResizing = sidebarDockResize.isResizing
const dicomDropPreviewIcon = computed(() =>
  normalizeInlineSvg(dicomDropPreviewKind.value === 'folder' ? folderIcon : dicomFileIcon)
)
const appMainLayoutStyle = computed(() => ({
  '--app-sidebar-width': `${sidebarResizePreviewWidth.value ?? workspaceDockPreference.value.leftWidth}px`,
  '--app-sidebar-preview-width': `${sidebarResizePreviewWidth.value ?? workspaceDockPreference.value.leftWidth}px`
}))
const effectiveSidebarCollapsed = computed(() => sidebarResizePreviewCollapsed.value ?? viewer.isSidebarCollapsed.value)

function startSidebarResize(event: PointerEvent): void {
  if (window.matchMedia('(max-width: 900px)').matches) {
    return
  }
  const wasCollapsed = viewer.isSidebarCollapsed.value
  const startWidth = wasCollapsed ? SIDEBAR_COLLAPSED_WIDTH : workspaceDockPreference.value.leftWidth
  sidebarDockResize.start(event, {
    key: 'sidebar',
    direction: 'left',
    startWidth,
    config: {
      collapsedWidth: SIDEBAR_COLLAPSED_WIDTH,
      collapseThreshold: SIDEBAR_COLLAPSE_THRESHOLD,
      minWidth: SIDEBAR_MIN_WIDTH,
      maxWidth: SIDEBAR_MAX_WIDTH
    }
  })
}

function openSidebarSettings(sectionKey?: string): void {
  sidebarPanelRef.value?.openSettings?.(sectionKey ?? null)
}

function handleInitialLocaleSelect(nextLocale: AppLocale): void {
  confirmInitialLocale(nextLocale)
}

const dicomDropPreviewEyebrow = computed(() => {
  if (dicomDropPreviewKind.value === 'folder') {
    return isZh.value ? 'DICOM 文件夹' : 'DICOM Folder'
  }
  if (dicomDropPreviewKind.value === 'mixed') {
    return isZh.value ? 'DICOM 导入' : 'DICOM Import'
  }
  return isZh.value ? 'DICOM 文件' : 'DICOM File'
})
const dicomDropPreviewTitle = computed(() => {
  if (dicomDropPreviewKind.value === 'folder') {
    return isZh.value ? '松开以加载文件夹中的序列' : 'Drop folder to load series'
  }
  if (dicomDropPreviewKind.value === 'mixed') {
    return isZh.value ? '松开以加载文件和文件夹中的序列' : 'Drop files and folders to load series'
  }
  return isZh.value ? '松开以加载 DICOM 或压缩包' : 'Drop DICOM file or archive to load series'
})
const dicomDropPreviewHint = computed(() => {
  if (dicomDropPreviewKind.value === 'folder') {
    return isZh.value ? '将扫描文件夹内容并识别可用 DICOM 序列。' : 'Folder contents will be scanned for DICOM series.'
  }
  if (dicomDropPreviewKind.value === 'mixed') {
    return isZh.value ? '每个拖入路径都会独立解析。' : 'Each dropped path will be parsed independently.'
  }
  return isZh.value ? '支持 DICOM 文件以及 ZIP、7z、RAR 压缩包。' : 'Supports DICOM files and ZIP, 7z, or RAR archives.'
})
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
const shownMainProcessStatusToastIds = new Set<string>()
let removeMainProcessStatusToastListener: (() => void) | null = null
let removeOpenDicomPathsListener: (() => void) | null = null
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

function showStatusToastFromPayload(payload: unknown): void {
  if (!payload || typeof payload !== 'object') {
    return
  }

  const detail = payload as {
    id?: unknown
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
  }
  const id = typeof detail.id === 'string' ? detail.id.trim() : ''
  if (id && shownMainProcessStatusToastIds.has(id)) {
    return
  }

  const message = typeof detail.message === 'string' ? detail.message.trim() : ''
  if (!message) {
    return
  }

  if (id) {
    shownMainProcessStatusToastIds.add(id)
  }

  viewer.showStatusToast(message, isAppStatusToastTone(detail.tone) ? detail.tone : 'info', {
    detail: typeof detail.detail === 'string' ? detail.detail.trim() : null,
    directoryPath: typeof detail.directoryPath === 'string' ? detail.directoryPath : null,
    filePath: typeof detail.filePath === 'string' ? detail.filePath : null,
    canOpenLocation: detail.canOpenLocation === true,
    busy: detail.busy === true,
    progressLabel: typeof detail.progressLabel === 'string' ? detail.progressLabel.trim() : null,
    progressPercent:
      typeof detail.progressPercent === 'number' && Number.isFinite(detail.progressPercent)
        ? detail.progressPercent
        : null,
    durationMs: typeof detail.durationMs === 'number' && Number.isFinite(detail.durationMs) ? detail.durationMs : undefined
  })
}

const handleStatusToastEvent = (event: Event): void => {
  showStatusToastFromPayload((event as CustomEvent<unknown>).detail)
}

function handleOpenDicomPaths(paths: string[]): void {
  if (!paths.length) {
    return
  }

  void viewer.loadDicomPaths(paths)
}

async function showStartupStatusToast(): Promise<void> {
  const payload = await window.viewerApi?.getStartupStatusToast?.()
  showStatusToastFromPayload(payload)
}

async function handleOpenStatusToastLocation(): Promise<void> {
  const toast = viewer.statusToast.value
  if (!toast?.canOpenLocation) {
    return
  }
  const { openExportLocation } = await import('./platform/exporting')
  const opened = await openExportLocation({
    directoryPath: toast.directoryPath ?? null,
    filePath: toast.filePath ?? null
  })
  if (!opened) {
    viewer.showStatusToast(isZh.value ? '打开保存位置失败。' : 'Failed to open save location.', 'error')
  }
}

onMounted(() => {
  if (isWebPlatform.value) {
    initializePwaInstall()
  }
  document.addEventListener('selectstart', preventSelection)
  window.addEventListener('keydown', preventSelectAll)
  window.addEventListener('dicomvision:status-toast', handleStatusToastEvent)
  removeMainProcessStatusToastListener = window.viewerApi?.onStatusToast?.(showStatusToastFromPayload) ?? null
  removeOpenDicomPathsListener = window.viewerApi?.onOpenDicomPaths?.(handleOpenDicomPaths) ?? null
  handleOpenDicomPaths(window.viewerApi?.consumePendingOpenFilePaths?.() ?? [])
  void showStartupStatusToast()
})

onBeforeUnmount(() => {
  sidebarDockResize.cancel()
  document.removeEventListener('selectstart', preventSelection)
  window.removeEventListener('keydown', preventSelectAll)
  window.removeEventListener('dicomvision:status-toast', handleStatusToastEvent)
  removeMainProcessStatusToastListener?.()
  removeMainProcessStatusToastListener = null
  removeOpenDicomPathsListener?.()
  removeOpenDicomPathsListener = null
})

const handleQuickPreviewSeriesDrop = (seriesId: string): void => {
  const series = viewer.seriesList.value.find((item) => item.seriesId === seriesId) ?? null
  void viewer.openSeriesView(seriesId, resolvePrimaryTwoDimensionalViewType(series))
}

const handleQuickPreviewSelectedSeries = (): void => {
  if (!viewer.selectedSeriesId.value) {
    return
  }

  const series = viewer.seriesList.value.find((item) => item.seriesId === viewer.selectedSeriesId.value) ?? null
  void viewer.openSeriesView(viewer.selectedSeriesId.value, resolvePrimaryTwoDimensionalViewType(series))
}

const handleLayoutSlotDicomDrop = (payload: { tabKey: string; slotId: string; drop: DicomDropInput }): void => {
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

const handleWindowControl = (control: 'minimize' | 'fullscreen' | 'close'): void => {
  if (control === 'minimize') {
    minimizeWindow()
    return
  }
  if (control === 'fullscreen') {
    toggleWindowFullScreen()
    return
  }
  closeWindow()
}

const isExternalFileDragEvent = (event: DragEvent): boolean => {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes('Files')
}

function getExternalDropPreviewKind(event: DragEvent): DicomDropPreviewKind {
  const items = Array.from(event.dataTransfer?.items ?? [])
  const entries = items
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry != null)
  const hasDirectory = entries.some((entry) => entry.isDirectory)
  const hasEntryFile = entries.some((entry) => entry.isFile)
  const hasDataTransferFile = Array.from(event.dataTransfer?.files ?? []).some((file) => file.name.trim())
  const hasFile = hasEntryFile || hasDataTransferFile || (items.length > 0 && !hasDirectory)

  if (hasDirectory && hasFile) {
    return 'mixed'
  }
  if (hasDirectory) {
    return 'folder'
  }
  return 'file'
}

function updateDicomDropPreview(event: DragEvent): void {
  dicomDropPreviewKind.value = getExternalDropPreviewKind(event)
}

const handleDicomFileDragEnter = (event: DragEvent): void => {
  if (!isExternalFileDragEvent(event)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  updateDicomDropPreview(event)
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
  updateDicomDropPreview(event)
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
  updateDicomDropPreview(event)
  isDicomFileDropActive.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  void viewer.loadDroppedDicomFiles({
    dataTransfer: event.dataTransfer,
    files
  })
}
</script>

<template>
  <VApp class="bg-transparent text-[var(--theme-text-primary)]">
    <VMain
      class="relative h-full overflow-hidden bg-transparent text-[var(--theme-text-primary)]"
      :data-platform="viewer.viewerPlatform"
      :data-icp-footer-visible="shouldShowIcpFooter ? 'true' : 'false'"
      @dragenter="handleDicomFileDragEnter"
      @dragover="handleDicomFileDragOver"
      @dragleave="handleDicomFileDragLeave"
      @drop="handleDicomFileDrop"
    >
      <div class="window-drag-region" aria-hidden="true"></div>
      <div
        class="app-main-layout grid h-screen max-h-screen overflow-hidden bg-transparent pt-2 pr-4 pb-4 pl-2"
        :data-sidebar-collapsed="effectiveSidebarCollapsed ? 'true' : 'false'"
        :data-sidebar-resizing="isSidebarResizing ? 'true' : 'false'"
        :style="appMainLayoutStyle"
      >
        <SidebarPanel
          ref="sidebarPanelRef"
          :viewer-folder-source-mode="viewer.viewerFolderSourceMode"
          :viewer-platform="viewer.viewerPlatform"
          :connection-state="viewer.connectionState.value"
          :has-selected-series="viewer.hasSelectedSeries.value"
          :is-loading-folder="viewer.isLoadingFolder.value"
          :is-selected-series-four-d="isSelectedSeriesFourD"
          :is-sidebar-collapsed="effectiveSidebarCollapsed"
          :selected-series-id="viewer.selectedSeriesId.value"
          :series-list="viewer.seriesList.value"
          @compare-series="viewer.openSeriesCompare"
          @choose-folder="viewer.chooseFolder"
          @open-key-slice="viewer.openKeySlice"
          @open-view="viewer.openView"
          @open-pet-ct-fusion="viewer.openPetCtFusion"
          @open-series-view="viewer.openSeriesView"
          @pacs-series-loaded="viewer.applyLoadedDicomSeries($event, { selectLoadedSeries: true, openFirstSeriesView: true })"
          @remove-series="viewer.removeSeries"
          @select-series="viewer.selectSeries"
          @toggle-sidebar="viewer.toggleSidebar"
        />
        <div
          class="app-sidebar-resize-handle"
          aria-hidden="true"
          @pointerdown="startSidebarResize"
        ></div>
        <div v-if="isSidebarResizing" class="app-sidebar-resize-preview" aria-hidden="true"></div>

        <ViewerWorkspace
          :active-operation="viewer.activeOperation.value"
          :active-tab="viewer.activeTab.value"
          :active-tab-key="viewer.activeTabKey.value"
          :has-selected-series="viewer.hasSelectedSeries.value"
          :is-view-loading="viewer.isViewLoading.value"
          :message="viewer.message.value"
          :selected-series-id="viewer.selectedSeriesId.value"
          :show-window-controls="hasDesktopWindowControls"
          :viewer-platform="viewer.viewerPlatform"
          :viewer-tabs="viewer.viewerTabs.value"
          @activate-tab="viewer.activateTab"
          @close-tab="viewer.closeTab"
          @close-other-tabs="viewer.closeOtherTabs"
          @open-layout-view="viewer.openLayoutView"
          @open-key-slice="viewer.openKeySlice"
          @layout-slot-dicom-drop="handleLayoutSlotDicomDrop"
          @layout-slot-series-drop="handleLayoutSlotSeriesDrop"
          @open-series-view="viewer.openSeriesView"
          @montage-state-change="viewer.handleMontageStateChange"
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
          @annotation-operation="viewer.handleAnnotationOperation"
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
          @fusion-config-change="viewer.handleFusionConfigChange"
          @fusion-registration-drag="viewer.handleFusionRegistrationDrag"
          @compare-sync-change="viewer.handleCompareSyncChange"
          @volume-config-change="viewer.handleVolumeConfigChange"
          @surface-config-change="viewer.handleSurfaceConfigChange"
          @volume-clip="viewer.handleVolumeClip"
          @viewport-drag="viewer.handleViewportDrag"
          @viewport-layout-change="viewer.handleViewportLayoutChange"
          @viewport-wheel="viewer.handleViewportWheel"
          @workspace-ready="viewer.setViewerStage"
          @open-settings="openSidebarSettings"
          @window-control="handleWindowControl"
        />
      </div>
      <footer v-if="shouldShowIcpFooter" class="app-icp-footer">
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">皖ICP备2026017376号</a>
      </footer>
      <div v-if="isDicomFileDropActive" class="dicom-file-drop-overlay" aria-live="polite">
        <div class="dicom-file-drop-overlay__panel">
          <div class="dicom-file-drop-overlay__icon" :data-kind="dicomDropPreviewKind" aria-hidden="true" v-html="dicomDropPreviewIcon" />
          <div class="dicom-file-drop-overlay__eyebrow">{{ dicomDropPreviewEyebrow }}</div>
          <div class="dicom-file-drop-overlay__title">{{ dicomDropPreviewTitle }}</div>
          <div class="dicom-file-drop-overlay__hint">{{ dicomDropPreviewHint }}</div>
        </div>
      </div>
      <div
        v-if="shouldShowInitialLocaleDialog"
        class="app-initial-locale"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-initial-locale-title"
      >
        <div class="app-initial-locale__panel">
          <div class="app-initial-locale__mark">DV</div>
          <div class="app-initial-locale__eyebrow">DicomVision</div>
          <h2 id="app-initial-locale-title" class="app-initial-locale__title">
            选择界面语言 / Choose language
          </h2>
          <p class="app-initial-locale__desc">
            首次启动前请选择界面语言。你之后也可以在设置中随时修改。
            <br />
            Choose the interface language. You can change it later in Settings.
          </p>
          <div class="app-initial-locale__actions">
            <button type="button" class="app-initial-locale__button" @click="handleInitialLocaleSelect('zh-CN')">
              <span>简体中文</span>
              <small>推荐中文用户使用</small>
            </button>
            <button type="button" class="app-initial-locale__button" @click="handleInitialLocaleSelect('en-US')">
              <span>English</span>
              <small>Use English interface</small>
            </button>
          </div>
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
          <ShellIcon :name="statusToastIcon" :size="18" />
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
        <button type="button" class="app-status-toast__close" :aria-label="closeNotificationLabel" @click="viewer.dismissStatusToast">
          <ShellIcon name="close" :size="13" />
        </button>
      </div>
    </VMain>
  </VApp>
</template>

<style scoped>
.app-main-layout {
  position: relative;
  gap: 8px;
  grid-template-columns: var(--app-sidebar-width, 320px) minmax(0, 1fr);
}

.app-main-layout[data-sidebar-collapsed="true"] {
  grid-template-columns: 64px minmax(0, 1fr);
}

.app-main-layout[data-sidebar-resizing="true"] {
  grid-template-columns: var(--app-sidebar-preview-width, 64px) minmax(0, 1fr);
}

.app-sidebar-resize-handle {
  position: absolute;
  top: 8px;
  bottom: 16px;
  left: calc(var(--app-sidebar-width, 320px) + 8px);
  z-index: 80;
  width: 9px;
  cursor: col-resize;
  transform: translateX(-1px);
  -webkit-app-region: no-drag;
}

.app-main-layout[data-sidebar-collapsed="true"] .app-sidebar-resize-handle {
  left: 72px;
}

.app-main-layout[data-sidebar-resizing="true"] .app-sidebar-resize-handle {
  left: calc(var(--app-sidebar-preview-width, 64px) + 8px);
}

.app-sidebar-resize-handle::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 4px;
  width: 1px;
  border-left: 2px solid color-mix(in srgb, var(--theme-accent) 44%, var(--theme-border-strong));
  content: "";
  opacity: 0.86;
  transition:
    border-color 150ms ease,
    opacity 150ms ease;
}

.app-sidebar-resize-handle:hover::before,
.app-main-layout[data-sidebar-resizing="true"] .app-sidebar-resize-handle::before {
  border-left-style: dashed;
  border-left-color: color-mix(in srgb, var(--theme-accent) 72%, var(--theme-border-strong));
  opacity: 1;
}

.app-sidebar-resize-preview {
  position: absolute;
  top: 10px;
  bottom: 18px;
  left: calc(var(--app-sidebar-preview-width, var(--app-sidebar-width, 320px)) + 8px);
  z-index: 120;
  width: 0;
  border-left: 1px dashed color-mix(in srgb, var(--theme-accent) 78%, transparent);
  pointer-events: none;
}

.app-shell-icon-svg {
  display: inline-flex;
  flex: 0 0 auto;
  fill: currentColor;
  line-height: 1;
}

.v-main[data-platform="web"][data-icp-footer-visible="true"] .app-main-layout {
  height: calc(100vh - 28px);
  max-height: calc(100vh - 28px);
  padding-bottom: 8px;
}

.app-icp-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 78%, transparent);
  color: var(--theme-text-muted);
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
  -webkit-app-region: no-drag;
  backdrop-filter: blur(10px);
}

.app-icp-footer a {
  color: inherit;
  pointer-events: auto;
  text-decoration: none;
}

.app-icp-footer a:hover,
.app-icp-footer a:focus-visible {
  color: var(--theme-text-secondary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 1280px) {
  .app-main-layout:not([data-sidebar-collapsed="true"]) {
    grid-template-columns: minmax(280px, var(--app-sidebar-width, 288px)) minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .app-main-layout,
  .app-main-layout:not([data-sidebar-collapsed="true"]),
  .app-main-layout[data-sidebar-collapsed="true"] {
    gap: 12px;
    grid-template-columns: minmax(0, 1fr);
  }

  .app-sidebar-resize-handle,
  .app-sidebar-resize-preview {
    display: none;
  }
}

.app-boot-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--theme-border-soft);
  border-radius: 18px;
  background: var(--theme-surface-panel);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 18px 42px rgba(0, 0, 0, 0.22);
}

.app-boot-panel--sidebar {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 22px;
  padding: 22px;
}

.app-boot-panel--workspace {
  display: grid;
  grid-template-rows: 58px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
}

.app-boot-brand,
.app-boot-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-boot-brand__mark {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 34%, transparent);
  border-radius: 13px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 34%, transparent),
      color-mix(in srgb, var(--theme-accent-warm) 18%, transparent)
    );
}

.app-boot-brand__line,
.app-boot-line,
.app-boot-row,
.app-boot-pill {
  position: relative;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-primary) 9%, transparent);
}

.app-boot-brand__line::after,
.app-boot-line::after,
.app-boot-row::after,
.app-boot-pill::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--theme-text-primary) 8%, transparent), transparent);
  content: "";
  animation: app-boot-shimmer 1.25s ease-in-out infinite;
}

.app-boot-brand__line {
  width: 132px;
  height: 18px;
}

.app-boot-stack,
.app-boot-list {
  display: grid;
  gap: 12px;
}

.app-boot-line {
  width: 76%;
  height: 12px;
}

.app-boot-line--wide {
  width: 100%;
}

.app-boot-line--short {
  width: 54%;
}

.app-boot-row {
  height: 54px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
}

.app-boot-pill {
  width: 116px;
  height: 34px;
  border-radius: 11px;
}

.app-boot-pill--short {
  width: 72px;
}

.app-boot-viewer {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 84%, transparent);
  border-radius: 14px;
  background:
    linear-gradient(color-mix(in srgb, var(--theme-accent) 6%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--theme-accent) 6%, transparent) 1px, transparent 1px),
    var(--theme-surface-panel-strong-solid);
  background-size: 42px 42px;
}

.app-boot-crosshair {
  position: absolute;
  background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
}

.app-boot-crosshair--horizontal {
  top: 50%;
  left: 18%;
  width: 64%;
  height: 1px;
}

.app-boot-crosshair--vertical {
  top: 18%;
  left: 50%;
  width: 1px;
  height: 64%;
}

@keyframes app-boot-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.app-status-toast__detail--button:focus-visible,
.app-status-toast__close:focus-visible {
  outline: none;
  box-shadow: var(--theme-focus-ring);
}

.dicom-file-drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 1150;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--theme-accent) 18%, transparent), transparent 34%),
    var(--theme-overlay-backdrop);
  pointer-events: none;
  -webkit-app-region: no-drag;
  backdrop-filter: blur(5px);
}

.dicom-file-drop-overlay__panel {
  display: flex;
  max-width: min(520px, calc(100vw - 48px));
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 34px 30px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-soft));
  border-radius: 26px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface-panel-strong-solid) 94%, white 3%),
      color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 5%)
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 9%, transparent),
    0 30px 78px rgba(0, 0, 0, 0.46);
  text-align: center;
}

.app-initial-locale {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--theme-accent) 18%, transparent), transparent 34%),
    var(--theme-overlay-backdrop);
  -webkit-app-region: no-drag;
  backdrop-filter: blur(8px);
}

.app-initial-locale__panel {
  width: min(520px, calc(100vw - 48px));
  border: 1px solid color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-soft));
  border-radius: 26px;
  padding: 30px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface-panel-strong-solid) 95%, white 3%),
      color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 5%)
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 30px 90px rgba(0, 0, 0, 0.52);
  text-align: center;
}

.app-initial-locale__mark {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  margin: 0 auto 14px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 46%, var(--theme-border-soft));
  border-radius: 16px;
  color: var(--theme-accent);
  background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.app-initial-locale__eyebrow {
  color: var(--theme-text-muted);
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.app-initial-locale__title {
  margin: 8px 0 0;
  color: var(--theme-text-primary);
  font-size: 22px;
  font-weight: 800;
}

.app-initial-locale__desc {
  margin: 12px auto 22px;
  color: var(--theme-text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.app-initial-locale__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.app-initial-locale__button {
  display: grid;
  gap: 5px;
  min-height: 84px;
  align-content: center;
  border: 1px solid var(--theme-border-soft);
  border-radius: 18px;
  padding: 14px;
  color: var(--theme-text-primary);
  background: color-mix(in srgb, var(--theme-surface-card) 88%, transparent);
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.app-initial-locale__button:hover,
.app-initial-locale__button:focus-visible {
  border-color: var(--theme-accent);
  background: color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-card));
  outline: none;
  transform: translateY(-1px);
}

.app-initial-locale__button span {
  font-size: 17px;
  font-weight: 800;
}

.app-initial-locale__button small {
  color: var(--theme-text-muted);
  font-size: 11px;
}

@media (max-width: 560px) {
  .app-initial-locale__actions {
    grid-template-columns: minmax(0, 1fr);
  }
}

.dicom-file-drop-overlay__icon {
  display: grid;
  width: 96px;
  height: 96px;
  place-items: center;
  margin-bottom: 2px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 42%, var(--theme-border-soft));
  border-radius: 26px;
  background:
    radial-gradient(circle at 64% 30%, color-mix(in srgb, var(--theme-accent) 18%, transparent), transparent 40%),
    color-mix(in srgb, var(--theme-surface-card) 86%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    0 16px 34px rgba(0, 0, 0, 0.28);
  color: color-mix(in srgb, var(--theme-accent) 78%, var(--theme-text-primary));
}

.dicom-file-drop-overlay__icon :deep(svg) {
  display: block;
  width: 72px;
  height: 72px;
  color: currentColor;
  overflow: visible;
}

.dicom-file-drop-overlay__icon[data-kind="folder"] :deep(svg) {
  width: 76px;
  height: 76px;
}

.dicom-file-drop-overlay__eyebrow {
  font-family: var(--theme-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--theme-accent) 54%, var(--theme-text-muted));
}

.dicom-file-drop-overlay__title {
  font-size: 25px;
  font-weight: 760;
  line-height: 1.16;
  color: var(--theme-text-primary);
}

.dicom-file-drop-overlay__hint {
  max-width: 390px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--theme-text-secondary);
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
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 92%, transparent);
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
