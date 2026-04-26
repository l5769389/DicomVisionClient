<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { VApp, VMain } from 'vuetify/components'
import SidebarPanel from './components/SidebarPanel.vue'
import ViewerWorkspace from './components/workspace/ViewerWorkspace.vue'
import { useViewerWorkspace } from './composables/workspace/core/useViewerWorkspace'

const viewer = useViewerWorkspace()

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
</script>

<template>
  <VApp class="bg-transparent text-[var(--theme-text-primary)]">
    <VMain class="relative h-full overflow-hidden bg-transparent text-[var(--theme-text-primary)]">
      <div class="window-drag-region" aria-hidden="true"></div>
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
          @volume-config-change="viewer.handleVolumeConfigChange"
          @viewport-drag="viewer.handleViewportDrag"
          @viewport-wheel="viewer.handleViewportWheel"
          @workspace-ready="viewer.setViewerStage"
        />
      </div>
    </VMain>
  </VApp>
</template>
