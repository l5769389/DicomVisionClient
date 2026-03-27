<script setup lang="ts">
import SidebarPanel from './components/SidebarPanel.vue'
import ViewerWorkspace from './components/ViewerWorkspace.vue'
import { useViewerWorkspace } from './composables/useViewerWorkspace'

const viewer = useViewerWorkspace()
</script>

<template>
  <v-app class="app-root">
    <div class="app-shell" :class="{ 'app-shell--collapsed': viewer.isSidebarCollapsed.value }">
      <SidebarPanel
        :connection-state="viewer.connectionState.value"
        :has-selected-series="viewer.hasSelectedSeries.value"
        :is-loading-folder="viewer.isLoadingFolder.value"
        :is-sidebar-collapsed="viewer.isSidebarCollapsed.value"
        :selected-series-id="viewer.selectedSeriesId.value"
        :series-list="viewer.seriesList.value"
        @choose-folder="viewer.chooseFolder"
        @open-view="viewer.openView"
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
        @active-viewport-change="viewer.setActiveViewportKey"
        @mpr-crosshair="viewer.handleMprCrosshair"
        @viewport-drag="viewer.handleViewportDrag"
        @viewport-wheel="viewer.handleViewportWheel"
        @workspace-ready="viewer.setViewerStage"
      />
    </div>
  </v-app>
</template>
