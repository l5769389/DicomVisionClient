<script setup lang="ts">
import { computed } from 'vue'
import { VBtn, VCard } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import { isFourDSeriesItem, type FolderSeriesItem } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { getSeriesValueMetaLabel } from './seriesMetadata'
import { getSeriesFallbackLabel, getSeriesThumbnailSrc } from './seriesThumbnail'

const props = defineProps<{
  keySliceCount?: number
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

const { t, viewerCopy } = useUiLocale()

type CompatibilityIssue = NonNullable<FolderSeriesItem['compatibilityIssues']>[number]
type CompatibilitySeverity = 'info' | 'warning' | 'error'

const compatibilityIssues = computed(() => props.series.compatibilityIssues ?? [])
const hasCompatibilityIssues = computed(() => compatibilityIssues.value.length > 0)
const compatibilitySeverity = computed<CompatibilitySeverity>(() => {
  if (compatibilityIssues.value.some((issue) => issue.severity === 'error')) {
    return 'error'
  }
  if (compatibilityIssues.value.some((issue) => issue.severity === 'warning' || !issue.severity)) {
    return 'warning'
  }
  return 'info'
})
const compatibilityIcon = computed(() => {
  if (compatibilitySeverity.value === 'error') {
    return 'error'
  }
  if (compatibilitySeverity.value === 'info') {
    return 'info'
  }
  return 'warning'
})
const compatibilityTitle = computed(() =>
  compatibilityIssues.value.map((issue) => formatCompatibilityIssue(issue)).join('\n')
)
const hasKeySlices = computed(() => (props.keySliceCount ?? 0) > 0)

function formatCompatibilityIssue(issue: CompatibilityIssue): string {
  const title = issue.title || issue.code
  return issue.detail ? `${title}: ${issue.detail}` : title
}
</script>

<template>
  <VCard
    draggable="true"
    class="series-list-card group relative rounded-xl! border! px-2! py-2! transition duration-150"
    :class="{ 'series-list-card--selected': selected }"
    @contextmenu="emit('seriesContextMenu', $event, series)"
    @dragstart="emit('seriesDragStart', $event, series)"
    @dragend="emit('seriesDragEnd')"
  >
    <button
      class="grid min-w-0 w-full grid-cols-[46px_minmax(0,1fr)] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-0.5 pr-8 text-left"
      type="button"
      @click="emit('select', series.seriesId)"
      @dblclick="emit('openStack', series.seriesId)"
    >
      <span class="series-thumbnail col-start-1 row-span-2" :class="{ 'series-thumbnail--active': selected }">
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
      <span class="col-start-2 row-start-1 flex min-w-0 items-center gap-2">
        <span class="min-w-0 flex-1 truncate text-sm font-semibold" :class="selected ? 'text-[var(--theme-active-foreground)]' : 'text-[var(--theme-text-primary)]'">{{ series.seriesDescription || t('unnamedSeries') }}</span>
        <span
          v-if="hasCompatibilityIssues"
          class="series-compatibility-chip"
          :data-severity="compatibilitySeverity"
          :title="compatibilityTitle"
          aria-label="DICOM compatibility notice"
        >
          <AppIcon :name="compatibilityIcon" :size="12" />
          <span>{{ compatibilityIssues.length }}</span>
        </span>
        <span
          v-if="hasKeySlices"
          class="series-key-slice-chip"
          :class="{ 'series-key-slice-chip--active': selected }"
          :title="viewerCopy.keySliceReviewAction(props.keySliceCount ?? 0)"
          aria-label="Key slice count"
        >
          <AppIcon name="star" :size="11" />
          <span>{{ props.keySliceCount }}</span>
        </span>
      </span>
      <span class="col-start-2 row-start-2 flex min-w-0 items-center gap-2">
        <span class="min-w-0 flex-1 truncate text-[11px] leading-5" :class="selected ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-muted)]'">{{ getSeriesValueMetaLabel(series) }}</span>
        <span v-if="isFourDSeriesItem(series)" class="series-four-d-chip" :class="{ 'series-four-d-chip--active': selected }">4D</span>
        <span class="series-modality-chip" :class="{ 'series-modality-chip--active': selected }">{{ series.modality || 'N/A' }}</span>
      </span>
    </button>

    <VBtn
      variant="flat"
      class="series-more-button absolute right-2 top-1/2 h-7! w-7! min-w-0! -translate-y-1/2 rounded-lg! border!"
      :aria-label="t('seriesActions')"
      :title="t('seriesActions')"
      @click.stop="emit('seriesContextMenu', $event, series)"
    >
      <AppIcon name="menu" :size="14" />
    </VBtn>
  </VCard>
</template>

<style scoped>
.series-list-card {
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--theme-border-soft) 68%, transparent) !important;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 84%, transparent) !important;
  box-shadow: none !important;
}

.series-list-card:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 24%, var(--theme-border-soft)) !important;
  background: color-mix(in srgb, var(--theme-accent) 5%, var(--theme-surface-card-soft)) !important;
}

.series-list-card--selected {
  position: relative;
  border-color: var(--series-active-border) !important;
  background: var(--series-active-surface) !important;
  box-shadow: var(--series-active-shadow) !important;
}

.series-list-card--selected:hover {
  border-color: var(--series-active-border) !important;
  background: var(--series-active-surface) !important;
  box-shadow: var(--series-active-shadow) !important;
}

.series-list-card--selected::before {
  position: absolute;
  inset: 7px auto 7px 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--theme-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--theme-accent) 34%, transparent);
  content: "";
}

.series-thumbnail {
  position: relative;
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  border-radius: 15px;
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
  min-height: 18px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  padding: 0 6px;
  color: var(--theme-text-secondary);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.series-four-d-chip--active {
  border-color: var(--theme-active-pill-border);
  background: var(--theme-active-pill-bg);
  color: var(--theme-active-foreground);
}

.series-key-slice-chip {
  display: inline-flex;
  height: 18px;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 42%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  padding: 0 5px;
  color: var(--theme-accent);
  font-size: 9px;
  font-weight: 800;
}

.series-key-slice-chip--active {
  border-color: var(--theme-active-pill-border);
  background: var(--theme-active-pill-bg);
  color: var(--theme-active-foreground);
}

.series-modality-chip {
  min-width: 22px;
  text-align: right;
  color: var(--theme-text-secondary);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.series-modality-chip--active {
  color: var(--theme-active-foreground-secondary);
}

.series-compatibility-chip {
  display: inline-flex;
  height: 18px;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  border: 1px solid color-mix(in srgb, var(--theme-accent-warm) 34%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent-warm) 12%, transparent);
  padding: 0 5px;
  color: color-mix(in srgb, var(--theme-accent-warm) 82%, white 10%);
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}

.series-compatibility-chip[data-severity="error"] {
  border-color: rgba(251, 113, 133, 0.34);
  background: rgba(251, 113, 133, 0.12);
  color: rgb(251, 113, 133);
}

.series-compatibility-chip[data-severity="info"] {
  border-color: color-mix(in srgb, var(--theme-accent) 30%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  color: color-mix(in srgb, var(--theme-accent) 82%, white 10%);
}

.series-more-button {
  border-color: color-mix(in srgb, var(--theme-border-soft) 72%, transparent) !important;
  background: color-mix(in srgb, var(--theme-surface-panel-strong) 74%, transparent) !important;
  color: var(--theme-text-secondary) !important;
  opacity: 0;
  transform: translateY(-50%) translateX(4px);
  transition:
    opacity 150ms ease,
    transform 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.series-list-card:hover .series-more-button,
.series-list-card:focus-within .series-more-button,
.series-list-card--selected .series-more-button {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

.series-more-button:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-soft)) !important;
  color: var(--theme-text-primary) !important;
}

:deep(.series-more-button .v-btn__overlay),
:deep(.series-more-button .v-btn__underlay) {
  opacity: 0 !important;
}
</style>
