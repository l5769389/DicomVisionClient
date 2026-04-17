<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ConnectionState, FolderSeriesItem, ViewType } from '../types/viewer'
import SidebarBrandPanel from './sidebar/SidebarBrandPanel.vue'
import SidebarCollapsedRail from './sidebar/SidebarCollapsedRail.vue'
import SidebarQuickActions from './sidebar/SidebarQuickActions.vue'
import SidebarSeriesList from './sidebar/SidebarSeriesList.vue'
import SidebarSettingsDialog from './sidebar/SidebarSettingsDialog.vue'
import SidebarStatusFooter from './sidebar/SidebarStatusFooter.vue'

const props = defineProps<{
  viewerFolderSourceMode: 'desktop-picker' | 'web-prompt' | 'server-sample'
  viewerPlatform: 'desktop' | 'web'
  connectionState: ConnectionState
  hasSelectedSeries: boolean
  isLoadingFolder: boolean
  isSidebarCollapsed: boolean
  selectedSeriesId: string
  seriesList: FolderSeriesItem[]
}>()

const emit = defineEmits<{
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
  if (props.connectionState === 'connected') return 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100'
  if (props.connectionState === 'connecting' || props.connectionState === 'reconnecting') return 'border-amber-300/18 bg-amber-400/10 text-amber-50'
  return 'border-rose-300/18 bg-rose-400/10 text-rose-100'
})

const connectionDotClass = computed(() => {
  if (props.connectionState === 'connected') return 'bg-emerald-400 shadow-[0_0_0_5px_rgba(74,222,128,0.14)]'
  if (props.connectionState === 'connecting' || props.connectionState === 'reconnecting') return 'bg-amber-400 shadow-[0_0_0_5px_rgba(251,191,36,0.14)]'
  return 'bg-rose-400 shadow-[0_0_0_5px_rgba(248,113,113,0.14)]'
})

function handleOpenSeriesView(seriesId: string, viewType: ViewType): void {
  emit('openSeriesView', seriesId, viewType)
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
        <SidebarQuickActions :has-selected-series="hasSelectedSeries" :viewer-folder-source-mode="viewerFolderSourceMode" :viewer-platform="viewerPlatform" @choose-folder="emit('chooseFolder')" @open-view="emit('openView', $event)" />
        <SidebarSeriesList :is-loading-folder="isLoadingFolder" :selected-series-id="selectedSeriesId" :series-list="seriesList" @open-series-view="handleOpenSeriesView" @remove-series="emit('removeSeries', $event)" @select-series="emit('selectSeries', $event)" />
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
    <div v-if="hoveredSeries && isSidebarCollapsed" class="theme-shell-panel fixed z-[1200] w-60 -translate-y-1/2 rounded-2xl border p-3 text-left shadow-[0_18px_40px_rgba(0,0,0,0.4)]" :style="hoveredSeriesCardStyle">
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ hoveredSeries.seriesDescription || 'Unnamed Series' }}</span>
        <span class="theme-card-soft shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-text-secondary)]">#{{ hoveredSeries.index + 1 }}</span>
      </div>
      <div class="text-[11px] leading-5 text-[var(--theme-text-secondary)]">
        <div>{{ hoveredSeries.modality || 'N/A' }} / {{ hoveredSeries.instanceCount }} frames</div>
        <div v-if="hoveredSeries.width && hoveredSeries.height">{{ hoveredSeries.width }}×{{ hoveredSeries.height }}</div>
        <div class="mt-1 break-all text-[var(--theme-text-muted)]">{{ hoveredSeries.seriesId }}</div>
      </div>
    </div>
  </Teleport>

  <SidebarSettingsDialog :is-open="isMenuOpen" @close="closeMenu" />
</template>
