<script setup lang="ts">
import { VBtn, VCard } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import { isFourDSeriesItem, type FolderSeriesItem } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { getSeriesValueMetaLabel } from './seriesMetadata'
import { getSeriesFallbackLabel, getSeriesThumbnailSrc } from './seriesThumbnail'

const props = defineProps<{
  selected: boolean
  series: FolderSeriesItem
}>()

const emit = defineEmits<{
  openStack: [seriesId: string]
  remove: [seriesId: string]
  select: [seriesId: string]
  seriesContextMenu: [event: MouseEvent, series: FolderSeriesItem]
  seriesDragEnd: []
  seriesDragStart: [event: DragEvent, series: FolderSeriesItem]
}>()

const { t } = useUiLocale()
</script>

<template>
  <VCard
    draggable="true"
    class="series-list-card group relative rounded-2xl! border! px-3! py-3! transition duration-150"
    :class="selected ? 'theme-active-surface' : 'theme-card-soft border! shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.08)] hover:theme-hover-surface'"
    @contextmenu="emit('seriesContextMenu', $event, series)"
    @dragstart="emit('seriesDragStart', $event, series)"
    @dragend="emit('seriesDragEnd')"
  >
    <button
      class="grid min-w-0 w-full grid-cols-[64px_minmax(0,1fr)] grid-rows-[auto_auto_auto] items-start gap-x-3 gap-y-1 text-left"
      type="button"
      @click="emit('select', series.seriesId)"
      @dblclick="emit('openStack', series.seriesId)"
    >
      <span class="series-thumbnail col-start-1 row-span-3" :class="{ 'series-thumbnail--active': selected }">
        <img
          v-if="getSeriesThumbnailSrc(series)"
          :src="getSeriesThumbnailSrc(series)"
          :alt="series.seriesDescription || t('unnamedSeries')"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <span v-else class="series-thumbnail__fallback">{{ getSeriesFallbackLabel(series) }}</span>
        <span class="series-thumbnail__scanline" aria-hidden="true"></span>
        <span class="series-thumbnail__dot" :class="{ 'series-thumbnail__dot--active': selected }" aria-hidden="true"></span>
      </span>
      <span class="col-start-2 flex min-w-0 items-center gap-2">
        <span class="min-w-0 flex-1 truncate text-sm font-semibold" :class="selected ? 'text-[var(--theme-active-foreground)]' : 'text-[var(--theme-text-primary)]'">{{ series.seriesDescription || t('unnamedSeries') }}</span>
        <span class="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em]" :class="selected ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-secondary)]'">{{ series.modality || 'N/A' }}</span>
        <span v-if="isFourDSeriesItem(series)" class="series-four-d-chip" :class="{ 'series-four-d-chip--active': selected }">4D</span>
      </span>
      <span class="col-start-2 block truncate pr-10 text-[11px] leading-5" :class="selected ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-muted)]'">{{ getSeriesValueMetaLabel(series) }}</span>
      <span class="col-start-2 block truncate pr-10 text-[11px] leading-5" :title="series.seriesId" :class="selected ? 'text-[var(--theme-active-foreground-muted)]' : 'text-[var(--theme-text-muted)]'">{{ series.seriesId }}</span>
    </button>

    <VBtn
      variant="flat"
      class="series-delete-button absolute bottom-3 right-3 h-8! w-8! min-w-0! rounded-lg! border!"
      :class="selected ? 'border-white/18! bg-white/12! text-white!' : 'border-rose-300/14! bg-rose-400/8! text-rose-100!'"
      :aria-label="t('deleteSeries')"
      :title="t('deleteSeries')"
      @click="emit('remove', series.seriesId)"
    >
      <AppIcon name="trash" :size="14" />
    </VBtn>
  </VCard>
</template>

<style scoped>
.series-list-card.theme-active-surface {
  position: relative;
  border-color: var(--series-active-border) !important;
  background: var(--series-active-surface) !important;
  box-shadow: var(--series-active-shadow) !important;
}

.series-list-card.theme-active-surface:hover {
  border-color: var(--series-active-border) !important;
  background: var(--series-active-surface) !important;
  box-shadow: var(--series-active-shadow) !important;
}

.series-list-card.theme-active-surface::before {
  position: absolute;
  inset: 8px auto 8px 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--theme-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--theme-accent) 34%, transparent);
  content: "";
}

.series-thumbnail {
  position: relative;
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--theme-accent) 16%, transparent), transparent 46%),
    linear-gradient(180deg, rgba(2, 6, 12, 0.98), rgba(0, 0, 0, 1));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 10px 20px rgba(0, 0, 0, 0.2);
}

.series-thumbnail--active {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, white 6%);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 20%, transparent),
    0 0 0 2px color-mix(in srgb, var(--theme-accent) 12%, transparent);
}

.series-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.series-thumbnail__fallback {
  color: color-mix(in srgb, var(--theme-text-primary) 78%, var(--theme-accent) 22%);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.series-thumbnail__scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(180deg, transparent 0, transparent 5px, rgba(255, 255, 255, 0.035) 6px);
  pointer-events: none;
}

.series-thumbnail__dot {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-muted) 46%, transparent);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.24);
}

.series-thumbnail__dot--active {
  background: var(--theme-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 14%, transparent);
}

.series-four-d-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  padding: 0 8px;
  color: var(--theme-text-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.series-four-d-chip--active {
  border-color: var(--theme-active-pill-border);
  background: var(--theme-active-pill-bg);
  color: var(--theme-active-foreground);
}
</style>
