<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ConnectionState, FolderSeriesItem, ViewType } from '../types/viewer'
import SidebarBrandPanel from './sidebar/SidebarBrandPanel.vue'
import SidebarCollapsedRail from './sidebar/SidebarCollapsedRail.vue'
import SidebarQuickActions from './sidebar/SidebarQuickActions.vue'
import SidebarSeriesList from './sidebar/SidebarSeriesList.vue'
import SidebarSettingsDialog from './sidebar/SidebarSettingsDialog.vue'
import SidebarStatusFooter from './sidebar/SidebarStatusFooter.vue'
import { getSeriesMetaLabel } from './sidebar/seriesMetadata'
import { getSeriesFallbackLabel, getSeriesThumbnailSrc } from './sidebar/seriesThumbnail'

const props = defineProps<{
  viewerFolderSourceMode: 'desktop-picker' | 'web-prompt' | 'server-sample'
  viewerPlatform: 'desktop' | 'web'
  connectionState: ConnectionState
  hasSelectedSeries: boolean
  isLoadingFolder: boolean
  isSelectedSeriesFourD: boolean
  isSidebarCollapsed: boolean
  selectedSeriesId: string
  seriesList: FolderSeriesItem[]
}>()

const emit = defineEmits<{
  compareSeries: [sourceSeriesId: string, targetSeriesId: string]
  chooseFolder: []
  openView: [viewType: ViewType]
  openSeriesView: [seriesId: string, viewType: ViewType]
  removeSeries: [seriesId: string]
  selectSeries: [seriesId: string]
  toggleSidebar: []
}>()

const isMenuOpen = ref(false)
const hoveredSeries = ref<(FolderSeriesItem & { index: number }) | null>(null)
const hoveredSeriesCardStyle = ref<Record<string, string>>({})

const connectionIcon = computed(() => {
  if (props.connectionState === 'connected') return 'connected'
  if (props.connectionState === 'connecting' || props.connectionState === 'reconnecting') return 'connecting'
  return 'disconnected'
})

const connectionToneClass = computed(() => {
  if (props.connectionState === 'connected') return 'theme-connection-tone theme-connection-tone--connected'
  if (props.connectionState === 'connecting' || props.connectionState === 'reconnecting') {
    return 'theme-connection-tone theme-connection-tone--connecting'
  }
  return 'theme-connection-tone theme-connection-tone--disconnected'
})

const connectionDotClass = computed(() => {
  if (props.connectionState === 'connected') return 'theme-connection-dot theme-connection-dot--connected'
  if (props.connectionState === 'connecting' || props.connectionState === 'reconnecting') {
    return 'theme-connection-dot theme-connection-dot--connecting'
  }
  return 'theme-connection-dot theme-connection-dot--disconnected'
})

function handleOpenSeriesView(seriesId: string, viewType: ViewType): void {
  emit('openSeriesView', seriesId, viewType)
}

function handleCompareSeries(sourceSeriesId: string, targetSeriesId: string): void {
  emit('compareSeries', sourceSeriesId, targetSeriesId)
}

function openMenu(): void {
  isMenuOpen.value = true
}

function closeMenu(): void {
  isMenuOpen.value = false
}

function showSeriesHoverCard(event: MouseEvent | FocusEvent, series: FolderSeriesItem, index: number): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  const rect = target.getBoundingClientRect()
  hoveredSeries.value = { ...series, index }
  hoveredSeriesCardStyle.value = {
    left: `${rect.right + 14}px`,
    top: `${rect.top + rect.height / 2}px`
  }
}

function hideSeriesHoverCard(): void {
  hoveredSeries.value = null
}
</script>

<template>
  <aside class="theme-shell-panel min-h-0 min-w-0 rounded-[26px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_48px_rgba(0,0,0,0.28)] backdrop-blur max-[900px]:max-h-[460px]">
    <div class="flex h-full flex-col gap-3">
      <template v-if="!isSidebarCollapsed">
        <SidebarBrandPanel />
        <SidebarQuickActions :has-selected-series="hasSelectedSeries" :is-selected-series-four-d="isSelectedSeriesFourD" :viewer-folder-source-mode="viewerFolderSourceMode" :viewer-platform="viewerPlatform" @choose-folder="emit('chooseFolder')" @open-view="emit('openView', $event)" />
        <SidebarSeriesList :is-loading-folder="isLoadingFolder" :selected-series-id="selectedSeriesId" :series-list="seriesList" @compare-series="handleCompareSeries" @open-series-view="handleOpenSeriesView" @remove-series="emit('removeSeries', $event)" @select-series="emit('selectSeries', $event)" />
        <SidebarStatusFooter :connection-dot-class="connectionDotClass" :connection-icon="connectionIcon" :connection-state="connectionState" :connection-tone-class="connectionToneClass" @open-menu="openMenu" @toggle-sidebar="emit('toggleSidebar')" />
      </template>

      <template v-else>
        <SidebarCollapsedRail
          :connection-dot-class="connectionDotClass"
          :connection-icon="connectionIcon"
          :connection-tone-class="connectionToneClass"
          :selected-series-id="selectedSeriesId"
          :series-list="seriesList"
          @hide-series-hover-card="hideSeriesHoverCard"
          @open-menu="openMenu"
          @open-series-view="emit('openSeriesView', $event, 'Stack')"
          @select-series="emit('selectSeries', $event)"
          @show-series-hover-card="showSeriesHoverCard"
          @toggle-sidebar="emit('toggleSidebar')"
        />
      </template>
    </div>
  </aside>

  <Teleport to="body">
    <div v-if="hoveredSeries && isSidebarCollapsed" class="theme-shell-panel fixed z-[1200] w-64 -translate-y-1/2 rounded-2xl border p-3 text-left shadow-[0_18px_40px_rgba(0,0,0,0.4)]" :style="hoveredSeriesCardStyle">
      <div class="mb-2 flex items-start justify-between gap-2">
        <div class="hover-series-thumbnail">
          <img v-if="getSeriesThumbnailSrc(hoveredSeries)" :src="getSeriesThumbnailSrc(hoveredSeries)" :alt="hoveredSeries.seriesDescription || 'Unnamed Series'" loading="lazy" decoding="async" draggable="false" />
          <span v-else>{{ getSeriesFallbackLabel(hoveredSeries) }}</span>
        </div>
        <span class="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ hoveredSeries.seriesDescription || 'Unnamed Series' }}</span>
        <span class="theme-card-soft shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-text-secondary)]">#{{ hoveredSeries.index + 1 }}</span>
      </div>
      <div class="text-[11px] leading-5 text-[var(--theme-text-secondary)]">
        <div>{{ getSeriesMetaLabel(hoveredSeries) }}</div>
        <div class="mt-1 truncate text-[var(--theme-text-muted)]" :title="hoveredSeries.seriesId">{{ hoveredSeries.seriesId }}</div>
      </div>
    </div>
  </Teleport>

  <SidebarSettingsDialog :is-open="isMenuOpen" @close="closeMenu" />
</template>

<style scoped>
.hover-series-thumbnail {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 24%, transparent);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(2, 6, 12, 0.98), rgba(0, 0, 0, 1));
  color: color-mix(in srgb, var(--theme-text-primary) 78%, var(--theme-accent) 22%);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.hover-series-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
