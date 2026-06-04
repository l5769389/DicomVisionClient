<script setup lang="ts">
import { VBtn, VChip } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { FolderSeriesItem } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import SidebarBrandPanel from './SidebarBrandPanel.vue'
import { getSeriesMetaLabel } from './seriesMetadata'
import { getSeriesFallbackLabel, getSeriesThumbnailSrc } from './seriesThumbnail'

defineProps<{
  connectionDotClass: string
  connectionIcon: string
  connectionToneClass: string
  selectedSeriesId: string
  seriesList: FolderSeriesItem[]
  viewerPlatform: 'desktop' | 'web'
}>()

const emit = defineEmits<{
  openMenu: []
  openSeriesView: [seriesId: string]
  removeSeries: [seriesId: string]
  selectSeries: [seriesId: string]
  showSeriesHoverCard: [event: MouseEvent | FocusEvent, series: FolderSeriesItem, index: number]
  hideSeriesHoverCard: []
  toggleSidebar: []
}>()

const { t } = useUiLocale()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-visible">
    <div class="flex items-start justify-center pt-1">
      <SidebarBrandPanel compact :viewer-platform="viewerPlatform" />
    </div>

    <div class="theme-shell-panel min-h-0 flex flex-1 flex-col overflow-visible rounded-[22px] px-1.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div class="mb-2 flex items-center justify-center">
        <VChip size="x-small" class="rounded-full! border! border-[var(--theme-border-strong)]! bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)]! px-1.5! py-0.5! text-[9px]! font-semibold! uppercase! tracking-[0.12em]! text-[color:color-mix(in_srgb,var(--theme-text-primary)_72%,var(--theme-accent))]!" variant="flat">
          {{ seriesList.length || 0 }}
        </VChip>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-visible">
        <div v-if="seriesList.length" class="flex flex-col items-center gap-2 pb-1">
          <button
            v-for="(series, index) in seriesList"
            :key="series.seriesId"
            type="button"
            class="flex w-full justify-center"
            :aria-label="series.seriesDescription || t('unnamedSeries')"
            :title="`${series.seriesDescription || t('unnamedSeries')} | ${getSeriesMetaLabel(series)}`"
            @mouseenter="emit('showSeriesHoverCard', $event, series, index)"
            @mouseleave="emit('hideSeriesHoverCard')"
            @focus="emit('showSeriesHoverCard', $event, series, index)"
            @blur="emit('hideSeriesHoverCard')"
            @click="emit('selectSeries', series.seriesId)"
            @dblclick="emit('openSeriesView', series.seriesId)"
          >
            <span class="rail-series-thumbnail" :class="{ 'rail-series-thumbnail--active': series.seriesId === selectedSeriesId }">
              <img v-if="getSeriesThumbnailSrc(series)" :src="getSeriesThumbnailSrc(series)" :alt="series.seriesDescription || t('unnamedSeries')" loading="lazy" decoding="async" draggable="false" />
              <span v-else>{{ getSeriesFallbackLabel(series, String(index + 1).padStart(2, '0')) }}</span>
            </span>
          </button>
        </div>
        <div v-else class="flex flex-col items-center gap-2 px-1 py-2 text-center text-[10px] text-[var(--theme-text-muted)]">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl border border-dashed border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)]">+</div>
          <span class="leading-4">{{ t('noSeries') }}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="mt-auto pt-2">
    <div class="theme-shell-panel flex flex-col items-center gap-2 rounded-[22px] px-1.5 py-2">
      <div class="rail-connection-indicator" :class="connectionToneClass" :title="connectionIcon">
        <AppIcon :name="connectionIcon" :size="17" />
        <span class="rail-connection-indicator__dot" :class="connectionDotClass"></span>
      </div>
      <VBtn variant="flat" class="theme-button-secondary h-9! w-9! min-w-0! rounded-2xl!" :aria-label="t('openSettings')" @click="emit('openMenu')"><AppIcon name="menu" :size="17" /></VBtn>
      <VBtn variant="flat" class="theme-button-secondary h-9! w-9! min-w-0! rounded-2xl!" :aria-label="t('expandSidebar')" @click="emit('toggleSidebar')"><AppIcon name="chevron-right" :size="18" /></VBtn>
    </div>
  </div>
</template>

<style scoped>
.rail-connection-indicator {
  position: relative;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 16px;
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.rail-connection-indicator__dot {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-surface-panel-solid) 92%, transparent);
}

.rail-series-thumbnail {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--theme-accent) 15%, transparent), transparent 46%),
    linear-gradient(180deg, rgba(2, 6, 12, 0.98), rgba(0, 0, 0, 1));
  color: var(--theme-text-secondary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    transform 150ms ease;
}

.rail-series-thumbnail:hover {
  border-color: var(--theme-hover-border);
  transform: translateY(-1px);
}

.rail-series-thumbnail--active {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, white 6%);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 18%, transparent),
    0 0 0 2px color-mix(in srgb, var(--theme-accent) 12%, transparent);
}

.rail-series-thumbnail--active:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, white 6%);
  transform: none;
}

.rail-series-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
