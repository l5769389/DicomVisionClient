<script setup lang="ts">
import { VBtn, VChip } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { FolderSeriesItem } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

defineProps<{
  connectionDotClass: string
  connectionIcon: string
  connectionToneClass: string
  selectedSeriesId: string
  seriesList: FolderSeriesItem[]
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
  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-visible">
    <div class="flex items-start justify-center pt-2">
      <div class="relative flex h-18 w-18 items-center justify-center overflow-hidden rounded-[28px] border border-[var(--theme-border-strong)] bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--theme-accent)_34%,transparent),transparent_35%),linear-gradient(180deg,var(--theme-surface-panel-strong),var(--theme-surface-panel))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_28px_rgba(0,0,0,0.26)]">
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(color-mix(in_srgb,var(--theme-text-secondary)_14%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--theme-text-secondary)_14%,transparent)_1px,transparent_1px)] bg-[size:14px_14px,14px_14px]"></div>
        <div class="absolute inset-[10px] rounded-[20px] border border-[var(--theme-border-soft)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--theme-text-primary)_5%,transparent),transparent)]"></div>
        <div class="relative flex items-center justify-center"><span class="text-[24px] font-black tracking-[0.18em] text-[var(--theme-text-primary)]">DV</span></div>
      </div>
    </div>

    <div class="theme-shell-panel min-h-0 flex flex-1 flex-col overflow-visible rounded-[24px] px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div class="mb-3 flex items-center justify-center">
        <VChip size="x-small" class="rounded-full! border! border-[var(--theme-border-strong)]! bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)]! px-2! py-1! text-[9px]! font-semibold! uppercase! tracking-[0.18em]! text-[color:color-mix(in_srgb,var(--theme-text-primary)_72%,var(--theme-accent))]!" variant="flat">
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
            :title="`${series.seriesDescription || t('unnamedSeries')} | ${series.modality || 'N/A'} | ${series.instanceCount} ${t('frames')}`"
            @mouseenter="emit('showSeriesHoverCard', $event, series, index)"
            @mouseleave="emit('hideSeriesHoverCard')"
            @focus="emit('showSeriesHoverCard', $event, series, index)"
            @blur="emit('hideSeriesHoverCard')"
            @click="emit('selectSeries', series.seriesId)"
            @dblclick="emit('openSeriesView', series.seriesId)"
          >
            <span class="flex h-11 w-11 items-center justify-center rounded-2xl border text-[11px] font-bold uppercase transition duration-150" :class="series.seriesId === selectedSeriesId ? 'theme-active-surface shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent)_14%,transparent)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-secondary)] hover:theme-hover-surface'">
              {{ String(index + 1).padStart(2, '0') }}
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
    <div class="theme-shell-panel flex flex-col items-center gap-2 rounded-[24px] px-2 py-2.5">
      <div class="flex w-full flex-col items-center gap-1 rounded-[18px] border px-2 py-2" :class="connectionToneClass">
        <AppIcon :name="connectionIcon" :size="18" />
        <span class="h-2.5 w-2.5 rounded-full" :class="connectionDotClass"></span>
      </div>
      <VBtn variant="flat" class="theme-button-secondary h-10! w-10! min-w-0! rounded-2xl!" :aria-label="t('openSettings')" @click="emit('openMenu')"><AppIcon name="menu" :size="18" /></VBtn>
      <VBtn variant="flat" class="theme-button-secondary h-10! w-10! min-w-0! rounded-2xl!" :aria-label="t('expandSidebar')" @click="emit('toggleSidebar')"><AppIcon name="chevron-right" :size="19" /></VBtn>
    </div>
  </div>
</template>
