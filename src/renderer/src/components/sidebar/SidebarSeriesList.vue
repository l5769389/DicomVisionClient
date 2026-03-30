<script setup lang="ts">
import { VBtn, VCard, VChip } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { FolderSeriesItem } from '../../types/viewer'

defineProps<{
  isLoadingFolder: boolean
  selectedSeriesId: string
  seriesList: FolderSeriesItem[]
}>()

const emit = defineEmits<{
  openSeriesView: [seriesId: string]
  removeSeries: [seriesId: string]
  selectSeries: [seriesId: string]
}>()
</script>

<template>
  <div class="min-h-0 flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(11,23,38,0.96),rgba(9,17,31,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <div class="shrink-0">
      <div class="mb-4 flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-semibold text-slate-50">序列列表</div>
          <div class="mt-1 text-xs text-slate-400">当前已加载的可用 DICOM 序列</div>
        </div>
        <VChip v-if="seriesList.length" size="small" class="rounded-full! border! border-sky-300/15! bg-sky-300/10! px-2.5! py-1! text-xs! font-semibold! text-sky-100/80!" variant="flat">{{ seriesList.length }}</VChip>
      </div>
      <div v-if="isLoadingFolder && seriesList.length" class="mb-4 flex items-center gap-3 rounded-2xl border border-sky-300/10 bg-sky-300/6 px-4 py-2.5 text-xs text-sky-100/75">
        <span class="h-2 w-2 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_5px_rgba(125,211,252,0.12)]" aria-hidden="true"></span>
        <span>正在加载新序列...</span>
      </div>
    </div>

    <div class="series-list-scroll min-h-0 flex-1 overflow-auto pr-1">
      <div v-if="isLoadingFolder && !seriesList.length" class="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-3 text-sm text-slate-300">
        <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.12)]" aria-hidden="true"></span>
        <span>正在加载序列...</span>
      </div>
      <div v-else-if="seriesList.length" class="flex flex-col gap-3">
        <VCard
          v-for="series in seriesList"
          :key="series.seriesId"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl! border! px-3! py-3! transition duration-150"
          :class="series.seriesId === selectedSeriesId ? 'border-sky-300/45! bg-[linear-gradient(135deg,rgba(36,110,177,0.34),rgba(217,112,54,0.18))]! shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-1px_0_rgba(255,255,255,0.03),0_14px_28px_rgba(17,76,130,0.18)]' : 'border-white/8! bg-[linear-gradient(180deg,rgba(17,28,42,0.74),rgba(10,18,30,0.88))]! shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_18px_rgba(0,0,0,0.16)] hover:border-sky-300/22! hover:bg-[linear-gradient(180deg,rgba(21,34,49,0.82),rgba(12,21,34,0.92))]! hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_24px_rgba(0,0,0,0.18)]'"
        >
          <button class="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-left" type="button" @click="emit('selectSeries', series.seriesId)" @dblclick="emit('openSeriesView', series.seriesId)">
            <span class="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border transition" :class="series.seriesId === selectedSeriesId ? 'border-sky-300 bg-[linear-gradient(180deg,rgba(82,172,241,0.22),rgba(235,106,42,0.12))] shadow-[0_0_0_4px_rgba(125,211,252,0.14)]' : 'border-slate-300/45 bg-white/5'"><span class="h-2 w-2 rounded-full" :class="series.seriesId === selectedSeriesId ? 'bg-sky-200' : 'bg-transparent'"></span></span>
            <span class="col-start-2 truncate text-sm font-semibold" :class="series.seriesId === selectedSeriesId ? 'text-white' : 'text-slate-100'">{{ series.seriesDescription || '未命名序列' }}</span>
            <span class="col-start-2 text-xs leading-5" :class="series.seriesId === selectedSeriesId ? 'text-sky-50/85' : 'text-slate-400'">{{ series.modality || 'N/A' }} · {{ series.instanceCount }} 帧<template v-if="series.width && series.height"> · {{ series.width }}×{{ series.height }}</template></span>
            <span class="col-start-2 break-all text-[11px] leading-5" :class="series.seriesId === selectedSeriesId ? 'text-sky-100/80' : 'text-slate-500'">{{ series.seriesId }}</span>
          </button>
          <VBtn variant="flat" class="self-center h-10! w-10! min-w-0! rounded-xl! border! border-rose-300/14! bg-rose-400/8! text-rose-100!" aria-label="删除序列" title="删除序列" @click="emit('removeSeries', series.seriesId)">
            <AppIcon name="trash" :size="17" />
          </VBtn>
        </VCard>
      </div>
      <div v-else class="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm leading-6 text-slate-400">加载文件夹后，这里会显示 DICOM 序列列表。</div>
    </div>
  </div>
</template>
