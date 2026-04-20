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
  <div class="theme-shell-panel min-h-0 flex flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <div class="shrink-0">
      <div class="mb-4 flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ t('seriesList') }}</div>
          <div class="mt-1 text-xs text-[var(--theme-text-muted)]">{{ t('seriesListSubtitle') }}</div>
        </div>
        <VChip v-if="seriesList.length" size="small" class="theme-card-soft rounded-full! border! px-2.5! py-1! text-xs! font-semibold! text-[var(--theme-text-secondary)]!" variant="flat">{{ seriesList.length }}</VChip>
      </div>
      <div v-if="isLoadingFolder && seriesList.length" class="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_8%,transparent)] px-4 py-2.5 text-xs text-[var(--theme-text-secondary)]">
        <span class="h-2 w-2 animate-pulse rounded-full bg-[var(--theme-accent)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--theme-accent)_12%,transparent)]" aria-hidden="true"></span>
        <span>{{ t('loadingMoreSeries') }}</span>
      </div>
    </div>

    <div class="series-list-scroll min-h-0 flex-1 overflow-auto pr-1">
      <div v-if="isLoadingFolder && !seriesList.length" class="theme-card-soft flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-[var(--theme-text-secondary)]">
        <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--theme-accent)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--theme-accent)_12%,transparent)]" aria-hidden="true"></span>
        <span>{{ t('loadingSeries') }}</span>
      </div>
      <div v-else-if="seriesList.length" class="flex flex-col gap-3">
        <VCard
          v-for="series in seriesList"
          :key="series.seriesId"
          draggable="true"
          class="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl! border! px-3! py-3! transition duration-150"
          :class="series.seriesId === selectedSeriesId ? 'theme-active-surface' : 'theme-card-soft border! shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.08)] hover:theme-hover-surface'"
          @contextmenu="handleSeriesContextMenu($event, series)"
          @dragstart="handleSeriesDragStart($event, series.seriesId)"
          @dragend="handleSeriesDragEnd"
        >
          <button class="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-left" type="button" draggable="true" @click="emit('selectSeries', series.seriesId)" @dblclick="emit('openSeriesView', series.seriesId, 'Stack')" @dragstart="handleSeriesDragStart($event, series.seriesId)" @dragend="handleSeriesDragEnd">
            <span class="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border transition" :class="series.seriesId === selectedSeriesId ? 'theme-active-pill shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent)_14%,transparent)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] group-hover:theme-hover-pill'"><span class="h-2 w-2 rounded-full" :class="series.seriesId === selectedSeriesId ? 'bg-[var(--theme-accent-strong)]' : 'bg-transparent group-hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_70%,transparent)]'"></span></span>
            <span class="col-start-2 truncate text-sm font-semibold" :class="series.seriesId === selectedSeriesId ? 'text-[var(--theme-active-foreground)]' : 'text-[var(--theme-text-primary)]'">{{ series.seriesDescription || t('unnamedSeries') }}</span>
            <span class="col-start-2 text-xs leading-5" :class="series.seriesId === selectedSeriesId ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-muted)]'">
              {{ series.modality || 'N/A' }} · {{ series.instanceCount }} {{ t('frames') }}
              <template v-if="series.width && series.height"> · {{ series.width }}×{{ series.height }}</template>
            </span>
            <span class="col-start-2 block truncate text-[11px] leading-5" :title="series.seriesId" :class="series.seriesId === selectedSeriesId ? 'text-[var(--theme-active-foreground-muted)]' : 'text-[var(--theme-text-muted)]'">{{ series.seriesId }}</span>
          </button>
          <VBtn
            variant="flat"
            class="self-center h-10! w-10! min-w-0! rounded-xl! border!"
            :class="series.seriesId === selectedSeriesId ? 'border-white/18! bg-white/12! text-white!' : 'border-rose-300/14! bg-rose-400/8! text-rose-100!'"
            :aria-label="t('deleteSeries')"
            :title="t('deleteSeries')"
            @click="emit('removeSeries', series.seriesId)"
          >
            <AppIcon name="trash" :size="17" />
          </VBtn>
        </VCard>
      </div>
      <div v-else class="theme-card-soft rounded-2xl border border-dashed px-4 py-5 text-sm leading-6 text-[var(--theme-text-muted)]">{{ t('noSeriesDesc') }}</div>
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
        <VCard class="series-context-menu theme-shell-panel min-w-[300px] overflow-hidden rounded-[24px]! border! text-[var(--theme-text-primary)]! shadow-[0_28px_64px_rgba(0,0,0,0.5)]!">
          <div class="series-context-menu__chrome"></div>
          <div class="relative px-2.5 pb-2.5 pt-2.5">
            <div class="rounded-[18px] border border-[color:color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_72%,transparent)] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-[9px] font-semibold uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--theme-text-secondary)_68%,var(--theme-accent)_32%)]">{{ t('seriesActions') }}</div>
                  <div class="mt-1 truncate text-[12px] font-medium text-[var(--theme-text-primary)]">{{ contextSeriesPreview.title }}</div>
                  <div class="mt-0.5 truncate text-[11px] text-[var(--theme-text-secondary)]">{{ contextSeriesPreview.meta }}</div>
                  <div class="mt-1 truncate font-mono text-[10px] text-[var(--theme-text-muted)]">{{ contextSeriesPreview.id }}</div>
                </div>
                <div class="rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] px-2 py-[5px] text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-primary)]">
                  {{ t('open') }}
                </div>
              </div>
            </div>

            <VDivider class="my-2.5 border-[var(--theme-border-soft)] opacity-100" />

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
                    <div class="truncate text-[12px] font-medium" :class="action.danger ? 'text-rose-300' : 'text-[var(--theme-text-primary)]'">{{ action.title }}</div>
                    <div class="truncate text-[11px]" :class="action.danger ? 'text-rose-300/70' : 'text-[var(--theme-text-secondary)]'">{{ action.subtitle }}</div>
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
    radial-gradient(circle at bottom left, color-mix(in srgb, var(--theme-accent-warm) 18%, transparent), transparent 34%),
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
