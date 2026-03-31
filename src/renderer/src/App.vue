<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { VApp, VMain } from 'vuetify/components'
import SidebarPanel from './components/SidebarPanel.vue'
import ViewerWorkspace from './components/ViewerWorkspace.vue'
import { useViewerWorkspace } from './composables/useViewerWorkspace'

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
</script>

<template>
  <VApp class="bg-transparent text-slate-50">
    <VMain class="relative h-full overflow-hidden bg-transparent text-slate-50">
      <div class="window-drag-region" aria-hidden="true"></div>
      <div
        class="grid h-screen max-h-screen gap-4 overflow-hidden bg-transparent p-4 transition-[grid-template-columns] duration-200 ease-out max-[900px]:grid-cols-1"
        :class="viewer.isSidebarCollapsed.value ? 'grid-cols-[92px_minmax(0,1fr)]' : 'grid-cols-[320px_minmax(0,1fr)] max-[1280px]:grid-cols-[288px_minmax(0,1fr)]'"
      >
        <SidebarPanel
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
          :operation-items="viewer.operationItems"
          :viewer-tabs="viewer.viewerTabs.value"
          @activate-tab="viewer.activateTab"
          @close-tab="viewer.closeTab"
          @set-active-operation="viewer.setActiveOperation"
          @trigger-view-action="viewer.triggerViewAction"
          @active-viewport-change="viewer.setActiveViewportKey"
          @mpr-crosshair="viewer.handleMprCrosshair"
          @viewport-drag="viewer.handleViewportDrag"
          @viewport-wheel="viewer.handleViewportWheel"
          @workspace-ready="viewer.setViewerStage"
        />
      </div>
    </VMain>
  </VApp>
</template>
