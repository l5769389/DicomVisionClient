<script setup lang="ts">
import { computed, ref } from 'vue'
import { VBtn, VCard, VChip, VDivider, VList, VListItem, VMenu } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { FolderSeriesItem, ViewType } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

const props = defineProps<{
  isLoadingFolder: boolean
  selectedSeriesId: string
  seriesList: FolderSeriesItem[]
}>()

const emit = defineEmits<{
  openSeriesView: [seriesId: string, viewType: ViewType]
  removeSeries: [seriesId: string]
  selectSeries: [seriesId: string]
}>()

const SERIES_DRAG_TYPE = 'application/x-dicomvision-series-id'

type SeriesContextAction = 'Stack' | 'MPR' | '3D' | 'Tag' | 'delete'

const { t } = useUiLocale()
const isContextMenuOpen = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextSeries = ref<FolderSeriesItem | null>(null)

const contextMenuAnchorStyle = computed(() => ({
  left: `${contextMenuPosition.value.x}px`,
  top: `${contextMenuPosition.value.y}px`
}))

const contextMenuActions = computed(() => [
  {
    key: 'Stack' as const,
    title: t('quickPreview'),
    subtitle: 'Stack view',
    badge: '2D'
  },
  {
    key: 'MPR' as const,
    title: 'MPR',
    subtitle: 'Multi-planar reconstruction',
    badge: 'MPR'
  },
  {
    key: '3D' as const,
    title: '3D',
    subtitle: 'Volume rendering',
    badge: '3D'
  },
  {
    key: 'Tag' as const,
    title: 'TAG',
    subtitle: 'DICOM Tags',
    badge: 'TAG'
  },
  {
    key: 'delete' as const,
    title: t('deleteSeries'),
    subtitle: 'Remove this series from the workspace',
    badge: 'DEL',
    danger: true
  }
])

const contextSeriesPreview = computed(() => {
  if (!contextSeries.value) {
    return {
      title: '',
      meta: '',
      id: ''
    }
  }

  return {
    title: contextSeries.value.seriesDescription || t('unnamedSeries'),
    meta: `${contextSeries.value.modality || 'N/A'} · ${contextSeries.value.instanceCount} ${t('frames')}`,
    id: contextSeries.value.seriesId
  }
})

function closeContextMenu(): void {
  isContextMenuOpen.value = false
}

function handleSeriesContextMenu(event: MouseEvent, series: FolderSeriesItem): void {
  event.preventDefault()
  emit('selectSeries', series.seriesId)
  contextSeries.value = series
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  isContextMenuOpen.value = true
}

function handleContextAction(action: SeriesContextAction): void {
  if (!contextSeries.value) {
    return
  }

  if (action === 'delete') {
    emit('removeSeries', contextSeries.value.seriesId)
  } else {
    emit('openSeriesView', contextSeries.value.seriesId, action)
  }

  closeContextMenu()
}

function handleSeriesDragStart(event: DragEvent, seriesId: string): void {
  if (!event.dataTransfer) {
    return
  }

  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(SERIES_DRAG_TYPE, seriesId)
  event.dataTransfer.setData('text/plain', seriesId)
  emit('selectSeries', seriesId)
}

function handleSeriesDragEnd(): void {
  // Keep drag lifecycle explicit on the source side.
}
</script>

<template>
  <div class="min-h-0 flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(11,23,38,0.96),rgba(9,17,31,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <div class="shrink-0">
      <div class="mb-4 flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-semibold text-slate-50">{{ t('seriesList') }}</div>
          <div class="mt-1 text-xs text-slate-400">{{ t('seriesListSubtitle') }}</div>
        </div>
        <VChip v-if="seriesList.length" size="small" class="rounded-full! border! border-sky-300/15! bg-sky-300/10! px-2.5! py-1! text-xs! font-semibold! text-sky-100/80!" variant="flat">{{ seriesList.length }}</VChip>
      </div>
      <div v-if="isLoadingFolder && seriesList.length" class="mb-4 flex items-center gap-3 rounded-2xl border border-sky-300/10 bg-sky-300/6 px-4 py-2.5 text-xs text-sky-100/75">
        <span class="h-2 w-2 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_5px_rgba(125,211,252,0.12)]" aria-hidden="true"></span>
        <span>{{ t('loadingMoreSeries') }}</span>
      </div>
    </div>

    <div class="series-list-scroll min-h-0 flex-1 overflow-auto pr-1">
      <div v-if="isLoadingFolder && !seriesList.length" class="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-3 text-sm text-slate-300">
        <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.12)]" aria-hidden="true"></span>
        <span>{{ t('loadingSeries') }}</span>
      </div>
      <div v-else-if="seriesList.length" class="flex flex-col gap-3">
        <VCard
          v-for="series in seriesList"
          :key="series.seriesId"
          draggable="true"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl! border! px-3! py-3! transition duration-150"
          :class="series.seriesId === selectedSeriesId ? 'border-sky-300/45! bg-[linear-gradient(135deg,rgba(36,110,177,0.34),rgba(217,112,54,0.18))]! shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-1px_0_rgba(255,255,255,0.03),0_14px_28px_rgba(17,76,130,0.18)]' : 'border-white/8! bg-[linear-gradient(180deg,rgba(17,28,42,0.74),rgba(10,18,30,0.88))]! shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_18px_rgba(0,0,0,0.16)] hover:border-sky-300/22! hover:bg-[linear-gradient(180deg,rgba(21,34,49,0.82),rgba(12,21,34,0.92))]! hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_24px_rgba(0,0,0,0.18)]'"
          @contextmenu="handleSeriesContextMenu($event, series)"
          @dragstart="handleSeriesDragStart($event, series.seriesId)"
          @dragend="handleSeriesDragEnd"
        >
          <button class="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-left" type="button" draggable="true" @click="emit('selectSeries', series.seriesId)" @dblclick="emit('openSeriesView', series.seriesId, 'Stack')" @dragstart="handleSeriesDragStart($event, series.seriesId)" @dragend="handleSeriesDragEnd">
            <span class="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border transition" :class="series.seriesId === selectedSeriesId ? 'border-sky-300 bg-[linear-gradient(180deg,rgba(82,172,241,0.22),rgba(235,106,42,0.12))] shadow-[0_0_0_4px_rgba(125,211,252,0.14)]' : 'border-slate-300/45 bg-white/5'"><span class="h-2 w-2 rounded-full" :class="series.seriesId === selectedSeriesId ? 'bg-sky-200' : 'bg-transparent'"></span></span>
            <span class="col-start-2 truncate text-sm font-semibold" :class="series.seriesId === selectedSeriesId ? 'text-white' : 'text-slate-100'">{{ series.seriesDescription || t('unnamedSeries') }}</span>
            <span class="col-start-2 text-xs leading-5" :class="series.seriesId === selectedSeriesId ? 'text-sky-50/85' : 'text-slate-400'">
              {{ series.modality || 'N/A' }} · {{ series.instanceCount }} {{ t('frames') }}
              <template v-if="series.width && series.height"> · {{ series.width }}×{{ series.height }}</template>
            </span>
            <span class="col-start-2 break-all text-[11px] leading-5" :class="series.seriesId === selectedSeriesId ? 'text-sky-100/80' : 'text-slate-500'">{{ series.seriesId }}</span>
          </button>
          <VBtn variant="flat" class="self-center h-10! w-10! min-w-0! rounded-xl! border! border-rose-300/14! bg-rose-400/8! text-rose-100!" :aria-label="t('deleteSeries')" :title="t('deleteSeries')" @click="emit('removeSeries', series.seriesId)">
            <AppIcon name="trash" :size="17" />
          </VBtn>
        </VCard>
      </div>
      <div v-else class="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm leading-6 text-slate-400">{{ t('noSeriesDesc') }}</div>
    </div>

    <div v-if="contextSeries" class="fixed z-[2100] h-0 w-0" :style="contextMenuAnchorStyle">
      <VMenu
        v-model="isContextMenuOpen"
        activator="parent"
        location="bottom start"
        :offset="8"
        scroll-strategy="reposition"
        :close-on-content-click="true"
      >
        <VCard class="series-context-menu min-w-[300px] overflow-hidden rounded-[24px]! border! border-sky-200/14! bg-[linear-gradient(180deg,rgba(9,19,33,0.995),rgba(6,13,24,0.995))]! text-slate-100! shadow-[0_28px_64px_rgba(0,0,0,0.5)]!">
          <div class="series-context-menu__chrome"></div>
          <div class="relative px-2.5 pb-2.5 pt-2.5">
            <div class="rounded-[18px] border border-white/8 bg-white/[0.04] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-[9px] font-semibold uppercase tracking-[0.22em] text-sky-200/72">{{ t('seriesActions') }}</div>
                  <div class="mt-1 truncate text-[12px] font-medium text-white">{{ contextSeriesPreview.title }}</div>
                  <div class="mt-0.5 truncate text-[11px] text-slate-400">{{ contextSeriesPreview.meta }}</div>
                  <div class="mt-1 truncate font-mono text-[10px] text-slate-500">{{ contextSeriesPreview.id }}</div>
                </div>
                <div class="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-[5px] text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                  {{ t('open') }}
                </div>
              </div>
            </div>

            <VDivider class="my-2.5 border-white/8 opacity-100" />

            <VList class="bg-transparent! py-0!">
              <VListItem
                v-for="action in contextMenuActions"
                :key="action.key"
                class="series-context-menu__item rounded-[16px]! px-2.5! py-1.5!"
                :class="{ 'series-context-menu__item--danger': action.danger }"
                @click="handleContextAction(action.key)"
              >
                <div class="flex items-center gap-2.5">
                  <div class="series-context-menu__badge" :class="{ 'series-context-menu__badge--danger': action.danger }">{{ action.badge }}</div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-[12px] font-medium" :class="action.danger ? 'text-rose-100' : 'text-white'">{{ action.title }}</div>
                    <div class="truncate text-[11px]" :class="action.danger ? 'text-rose-200/60' : 'text-slate-400'">{{ action.subtitle }}</div>
                  </div>
                </div>
              </VListItem>
            </VList>
          </div>
        </VCard>
      </VMenu>
    </div>
  </div>
</template>

<style scoped>
.series-context-menu {
  position: relative;
  backdrop-filter: blur(16px);
}

.series-context-menu__chrome {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(125, 211, 252, 0.18), transparent 30%),
    radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 34%);
  pointer-events: none;
}

.series-context-menu__item {
  min-height: 50px;
  color: rgba(241, 245, 249, 1);
  transition:
    background-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.series-context-menu__item:hover {
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.12), rgba(34, 211, 238, 0.08));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 22px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}

.series-context-menu__item--danger:hover {
  background: linear-gradient(180deg, rgba(251, 113, 133, 0.14), rgba(225, 29, 72, 0.08));
}

.series-context-menu__badge {
  display: inline-flex;
  height: 24px;
  min-width: 38px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(103, 232, 249, 0.2);
  border-radius: 9999px;
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.14), rgba(14, 116, 144, 0.16));
  color: rgba(207, 250, 254, 0.95);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.series-context-menu__badge--danger {
  border-color: rgba(251, 113, 133, 0.22);
  background: linear-gradient(180deg, rgba(251, 113, 133, 0.16), rgba(159, 18, 57, 0.16));
  color: rgba(255, 228, 230, 0.95);
}
</style>
