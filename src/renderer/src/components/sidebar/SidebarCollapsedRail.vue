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
      <div class="relative flex h-18 w-18 items-center justify-center overflow-hidden rounded-[28px] border border-sky-300/20 bg-[radial-gradient(circle_at_30%_20%,rgba(103,205,255,0.34),transparent_35%),linear-gradient(180deg,rgba(10,24,40,0.98),rgba(8,16,29,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_28px_rgba(0,0,0,0.26)]">
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(120,143,166,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(120,143,166,0.12)_1px,transparent_1px)] bg-[size:14px_14px,14px_14px]"></div>
        <div class="absolute inset-[10px] rounded-[20px] border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]"></div>
        <div class="relative flex items-center justify-center"><span class="text-[24px] font-black tracking-[0.18em] text-white">DV</span></div>
      </div>
    </div>

    <div class="min-h-0 flex flex-1 flex-col overflow-visible rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,20,34,0.94),rgba(8,15,27,0.98))] px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div class="mb-3 flex items-center justify-center">
        <VChip size="x-small" class="rounded-full! border! border-sky-300/12! bg-sky-300/8! px-2! py-1! text-[9px]! font-semibold! uppercase! tracking-[0.18em]! text-sky-100/70!" variant="flat">
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
            <span class="flex h-11 w-11 items-center justify-center rounded-2xl border text-[11px] font-bold uppercase transition duration-150" :class="series.seriesId === selectedSeriesId ? 'border-sky-300/45 bg-[linear-gradient(180deg,rgba(67,158,229,0.32),rgba(235,106,42,0.16))] text-white shadow-[0_0_0_4px_rgba(125,211,252,0.12)]' : 'border-white/8 bg-white/5 text-slate-300 hover:border-sky-300/22 hover:bg-white/8 hover:text-white'">
              {{ String(index + 1).padStart(2, '0') }}
            </span>
          </button>
        </div>
        <div v-else class="flex flex-col items-center gap-2 px-1 py-2 text-center text-[10px] text-slate-500">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3">+</div>
          <span class="leading-4">{{ t('noSeries') }}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="mt-auto pt-2">
    <div class="flex flex-col items-center gap-2 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,17,31,0.92),rgba(7,14,27,0.98))] px-2 py-2.5">
      <div class="flex w-full flex-col items-center gap-1 rounded-[18px] border px-2 py-2" :class="connectionToneClass">
        <AppIcon :name="connectionIcon" :size="18" />
        <span class="h-2.5 w-2.5 rounded-full" :class="connectionDotClass"></span>
      </div>
      <VBtn variant="flat" class="h-10! w-10! min-w-0! rounded-2xl! border! border-white/8! bg-white/6! text-slate-100!" :aria-label="t('openSettings')" @click="emit('openMenu')"><AppIcon name="menu" :size="18" /></VBtn>
      <VBtn variant="flat" class="h-10! w-10! min-w-0! rounded-2xl! border! border-white/8! bg-white/6! text-slate-100!" :aria-label="t('expandSidebar')" @click="emit('toggleSidebar')"><AppIcon name="chevron-right" :size="19" /></VBtn>
    </div>
  </div>
</template>
