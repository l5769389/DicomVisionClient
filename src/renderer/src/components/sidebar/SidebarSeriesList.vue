<script setup lang="ts">
import { computed, ref } from 'vue'
import { VBtn, VCard, VChip, VDivider, VList, VListItem, VMenu } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import { isFourDSeriesItem, type FolderSeriesItem, type ViewType } from '../../types/viewer'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { saveBinaryFile, type SaveFilePreference } from '../../platform/exporting'
import {
  getDicomDeidentifyJob,
  getDicomDeidentifyJobArtifact,
  postDicomDeidentifyJob,
  type DicomTagModifyJob
} from '../../services/typedApi'
import { getSeriesMetaLabel, getSeriesValueMetaLabel } from './seriesMetadata'
import { getSeriesFallbackLabel, getSeriesThumbnailSrc } from './seriesThumbnail'

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
const DEIDENTIFY_EXPORT_ROOT = 'DicomVisionDeidentified'
const DEIDENTIFY_JOB_POLL_INTERVAL_MS = 700
const DEIDENTIFY_JOB_MAX_POLLS = 1500
const DEIDENTIFY_JOB_STATUS_TIMEOUT_MS = 8000
const DEIDENTIFY_JOB_MAX_STATUS_ERRORS = 3

type SeriesContextAction = 'Stack' | 'MPR' | '3D' | '4D' | 'Tag' | 'deidentify' | 'delete'

const { locale, t } = useUiLocale()
const { dicomDeidentifyPreference, exportPreference } = useUiPreferences()
const isContextMenuOpen = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextSeries = ref<FolderSeriesItem | null>(null)
const isDeidentifyingSeriesId = ref('')

const contextMenuAnchorStyle = computed(() => ({
  left: `${contextMenuPosition.value.x}px`,
  top: `${contextMenuPosition.value.y}px`
}))

const isZh = computed(() => locale.value === 'zh-CN')
const selectedDeidentifyFieldCount = computed(() => dicomDeidentifyPreference.value.selectedFieldKeys.length)
const deidentifyCopy = computed(() => ({
  actionTitle: isZh.value ? '脱敏导出' : 'De-identify Export',
  actionSubtitle:
    selectedDeidentifyFieldCount.value > 0
      ? (isZh.value ? '生成脱敏 DICOM 副本' : 'Create de-identified DICOM copies')
      : (isZh.value ? '请先在设置中选择脱敏项' : 'Select de-identification fields in settings first'),
  downloadStarted: (fileName: string) => (isZh.value ? `已交给浏览器下载：${fileName}` : `Browser download started: ${fileName}`),
  exportFailed: isZh.value ? 'DICOM 脱敏导出失败。' : 'Failed to export de-identified DICOM.',
  exportJobCompleted: (count: number) =>
    isZh.value ? `DICOM 脱敏导出已完成，已生成 ${count} 个 DICOM 文件。` : `DICOM de-identify export completed. Created ${count} DICOM file(s).`,
  exportJobPackaging: isZh.value ? 'DICOM 已处理完成，正在打包结果...' : 'DICOM processing complete. Packaging result...',
  exportJobPreparing: isZh.value ? '正在准备脱敏导出任务...' : 'Preparing de-identify export...',
  exportJobProgress: (processed: number, total: number, percent: number) =>
    isZh.value ? `已处理 ${processed}/${total}（${percent}%）` : `Processed ${processed}/${total} (${percent}%)`,
  exportJobSaving: isZh.value ? '正在保存脱敏导出结果...' : 'Saving de-identify export result...',
  exportJobStarted: isZh.value ? 'DICOM 脱敏导出任务已开始，可继续浏览图像。' : 'DICOM de-identify export started. You can keep browsing images.',
  exportJobTimeout: isZh.value ? 'DICOM 脱敏导出任务仍在执行，请稍后再查看。' : 'DICOM de-identify export is still running. Check again later.',
  savedDirectory: (directory: string) => (isZh.value ? `保存位置：${directory}` : `Saved to: ${directory}`)
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
    key: '4D' as const,
    title: '4D',
    subtitle: 'Respiratory phase playback',
    badge: '4D',
    disabled: !isFourDSeriesItem(contextSeries.value)
  },
  {
    key: 'Tag' as const,
    title: 'TAG',
    subtitle: 'DICOM Tags',
    badge: 'TAG'
  },
  {
    key: 'deidentify' as const,
    title: deidentifyCopy.value.actionTitle,
    subtitle: deidentifyCopy.value.actionSubtitle,
    badge: 'DEID',
    disabled: selectedDeidentifyFieldCount.value === 0 || Boolean(isDeidentifyingSeriesId.value)
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
      id: '',
      thumbnailSrc: '',
      fallbackLabel: ''
    }
  }

  return {
    title: contextSeries.value.seriesDescription || t('unnamedSeries'),
    meta: getSeriesMetaLabel(contextSeries.value),
    id: contextSeries.value.seriesId,
    thumbnailSrc: getSeriesThumbnailSrc(contextSeries.value),
    fallbackLabel: getSeriesFallbackLabel(contextSeries.value)
  }
})

function isFourDSeries(series: FolderSeriesItem): boolean {
  return isFourDSeriesItem(series)
}

function closeContextMenu(): void {
  isContextMenuOpen.value = false
}

function resolveBackendErrorDetail(error: unknown): string {
  const responseData = (error as { response?: { data?: unknown } } | null)?.response?.data
  if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
    const detail = (responseData as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim()
    }
  }

  return error instanceof Error && error.message.trim() ? error.message.trim() : ''
}

function showGlobalStatusToast(
  message: string,
  tone: 'info' | 'success' | 'warning' | 'error' = 'info',
  options: {
    detail?: string | null
    directoryPath?: string | null
    filePath?: string | null
    canOpenLocation?: boolean
    busy?: boolean
    progressLabel?: string | null
    progressPercent?: number | null
    durationMs?: number
  } = {}
): void {
  window.dispatchEvent(
    new CustomEvent('dicomvision:status-toast', {
      detail: {
        message,
        tone,
        ...options
      }
    })
  )
}

function waitForDelay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getDeidentifyJobProgress(job: DicomTagModifyJob): { isPackaging: boolean; processed: number; total: number; percent: number; label: string } {
  const total = Math.max(0, Number(job.totalCount ?? 0))
  const processedFallback = job.status === 'succeeded' ? total : 0
  const processed = Math.max(0, Math.min(total || Number(job.processedCount ?? processedFallback), Number(job.processedCount ?? processedFallback)))
  const isProcessingComplete = total > 0 && processed >= total
  const percentFromJob = Number(job.progressPercent)
  const percent =
    isProcessingComplete
      ? 100
      : Number.isFinite(percentFromJob) && percentFromJob >= 0
        ? Math.max(0, Math.min(100, Math.round(percentFromJob)))
        : total > 0
          ? Math.max(0, Math.min(100, Math.round((processed / total) * 100)))
          : 0

  return {
    isPackaging: isProcessingComplete && job.status !== 'succeeded',
    processed,
    total,
    percent,
    label:
      total > 0
        ? isProcessingComplete && job.status !== 'succeeded'
          ? deidentifyCopy.value.exportJobPackaging
          : deidentifyCopy.value.exportJobProgress(processed, total, percent)
        : deidentifyCopy.value.exportJobPreparing
  }
}

function showDeidentifyJobProgress(job: DicomTagModifyJob, message = deidentifyCopy.value.exportJobStarted): void {
  const progress = getDeidentifyJobProgress(job)
  showGlobalStatusToast(progress.isPackaging ? deidentifyCopy.value.exportJobPackaging : message, 'info', {
    busy: true,
    durationMs: 0,
    progressLabel: progress.label,
    progressPercent: progress.percent
  })
}

async function waitForDicomDeidentifyJob(initialJob: DicomTagModifyJob): Promise<DicomTagModifyJob> {
  let job = initialJob
  let failedStatusPollCount = 0
  showDeidentifyJobProgress(job)
  for (let pollIndex = 0; pollIndex < DEIDENTIFY_JOB_MAX_POLLS; pollIndex += 1) {
    if (job.status === 'succeeded' || job.status === 'failed') {
      return job
    }
    await waitForDelay(DEIDENTIFY_JOB_POLL_INTERVAL_MS)
    try {
      job = await getDicomDeidentifyJob(initialJob.jobId, { timeout: DEIDENTIFY_JOB_STATUS_TIMEOUT_MS })
      failedStatusPollCount = 0
      showDeidentifyJobProgress(job)
    } catch (error) {
      failedStatusPollCount += 1
      if (failedStatusPollCount >= DEIDENTIFY_JOB_MAX_STATUS_ERRORS) {
        throw error
      }
    }
  }
  throw new Error(deidentifyCopy.value.exportJobTimeout)
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

async function handleContextAction(action: SeriesContextAction): Promise<void> {
  const series = contextSeries.value
  if (!series) {
    return
  }
  if (action === '4D' && !isFourDSeries(series)) {
    return
  }

  if (action === 'delete') {
    emit('removeSeries', series.seriesId)
  } else if (action === 'deidentify') {
    closeContextMenu()
    await exportDeidentifiedSeries(series)
    return
  } else {
    emit('openSeriesView', series.seriesId, action)
  }

  closeContextMenu()
}

function getSafeDeidentifyFolderName(value: string): string {
  return value.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^[._ -]+|[._ -]+$/g, '').slice(0, 24) || 'series'
}

function appendDesktopPath(baseDirectory: string, ...segments: string[]): string {
  const separator = baseDirectory.includes('\\') ? '\\' : '/'
  const base = baseDirectory.replace(/[\\/]+$/g, '')
  const cleanSegments = segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, '')).filter(Boolean)
  return [base, ...cleanSegments].join(separator)
}

async function resolveDeidentifySavePreference(seriesFolder: string, fallbackSeriesId: string): Promise<SaveFilePreference> {
  if (!window.viewerApi?.saveExportFile) {
    return exportPreference.value
  }

  const configuredDirectory =
    exportPreference.value.locationMode === 'custom'
      ? exportPreference.value.desktopDirectory?.trim()
      : await window.viewerApi.getDefaultExportDirectory?.()

  if (!configuredDirectory) {
    return exportPreference.value
  }

  return {
    ...exportPreference.value,
    locationMode: 'custom',
    desktopDirectory: appendDesktopPath(
      configuredDirectory,
      DEIDENTIFY_EXPORT_ROOT,
      getSafeDeidentifyFolderName(seriesFolder || fallbackSeriesId)
    )
  }
}

async function exportDeidentifiedSeries(series: FolderSeriesItem): Promise<void> {
  if (isDeidentifyingSeriesId.value) {
    return
  }
  if (selectedDeidentifyFieldCount.value === 0) {
    showGlobalStatusToast(deidentifyCopy.value.actionSubtitle, 'error')
    return
  }

  isDeidentifyingSeriesId.value = series.seriesId
  try {
    const job = await postDicomDeidentifyJob({
      seriesId: series.seriesId,
      fieldKeys: dicomDeidentifyPreference.value.selectedFieldKeys,
      replacementPrefix: dicomDeidentifyPreference.value.replacementPrefix
    })
    showDeidentifyJobProgress(job)
    void finishDeidentifyExportJob(job, series)
  } catch (error) {
    const detail = resolveBackendErrorDetail(error)
    isDeidentifyingSeriesId.value = ''
    showGlobalStatusToast(deidentifyCopy.value.exportFailed, 'error', {
      detail: detail || undefined,
      busy: false,
      durationMs: 8000
    })
  }
}

async function finishDeidentifyExportJob(initialJob: DicomTagModifyJob, series: FolderSeriesItem): Promise<void> {
  try {
    const completedJob = await waitForDicomDeidentifyJob(initialJob)
    if (completedJob.status === 'failed') {
      throw new Error(completedJob.error || deidentifyCopy.value.exportFailed)
    }

    const progress = getDeidentifyJobProgress(completedJob)
    showGlobalStatusToast(deidentifyCopy.value.exportJobSaving, 'info', {
      busy: true,
      durationMs: 0,
      progressLabel: progress.label,
      progressPercent: 100
    })
    const artifact = await getDicomDeidentifyJobArtifact(completedJob.jobId)
    const savedFile = await saveBinaryFile({
      data: artifact.data,
      fileName: artifact.fileName,
      mimeType: artifact.mediaType,
      preference: await resolveDeidentifySavePreference(artifact.seriesFolder, series.seriesId)
    })
    showGlobalStatusToast(deidentifyCopy.value.exportJobCompleted(artifact.modifiedCount), 'success', {
      detail: savedFile.locationDescription
        ? deidentifyCopy.value.savedDirectory(savedFile.locationDescription)
        : deidentifyCopy.value.downloadStarted(artifact.fileName),
      directoryPath: savedFile.directoryPath ?? null,
      filePath: savedFile.filePath ?? null,
      canOpenLocation: Boolean((savedFile.directoryPath || savedFile.filePath) && window.viewerApi?.openExportLocation),
      busy: false,
      durationMs: 10000
    })
  } catch (error) {
    const detail = resolveBackendErrorDetail(error)
    showGlobalStatusToast(deidentifyCopy.value.exportFailed, 'error', {
      detail: detail || (error instanceof Error ? error.message : undefined),
      busy: false,
      durationMs: 8000
    })
  } finally {
    isDeidentifyingSeriesId.value = ''
  }
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
          class="series-list-card group relative rounded-2xl! border! px-3! py-3! transition duration-150"
          :class="series.seriesId === selectedSeriesId ? 'theme-active-surface' : 'theme-card-soft border! shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.08)] hover:theme-hover-surface'"
          @contextmenu="handleSeriesContextMenu($event, series)"
          @dragstart="handleSeriesDragStart($event, series.seriesId)"
          @dragend="handleSeriesDragEnd"
        >
          <button class="grid min-w-0 w-full grid-cols-[64px_minmax(0,1fr)] grid-rows-[auto_auto_auto] items-start gap-x-3 gap-y-1 text-left" type="button" draggable="true" @click="emit('selectSeries', series.seriesId)" @dblclick="emit('openSeriesView', series.seriesId, 'Stack')" @dragstart="handleSeriesDragStart($event, series.seriesId)" @dragend="handleSeriesDragEnd">
            <span class="series-thumbnail col-start-1 row-span-3" :class="{ 'series-thumbnail--active': series.seriesId === selectedSeriesId }">
              <img v-if="getSeriesThumbnailSrc(series)" :src="getSeriesThumbnailSrc(series)" :alt="series.seriesDescription || t('unnamedSeries')" loading="lazy" decoding="async" draggable="false" />
              <span v-else class="series-thumbnail__fallback">{{ getSeriesFallbackLabel(series) }}</span>
              <span class="series-thumbnail__scanline" aria-hidden="true"></span>
              <span class="series-thumbnail__dot" :class="{ 'series-thumbnail__dot--active': series.seriesId === selectedSeriesId }" aria-hidden="true"></span>
            </span>
            <span class="col-start-2 flex min-w-0 items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-sm font-semibold" :class="series.seriesId === selectedSeriesId ? 'text-[var(--theme-active-foreground)]' : 'text-[var(--theme-text-primary)]'">{{ series.seriesDescription || t('unnamedSeries') }}</span>
              <span class="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em]" :class="series.seriesId === selectedSeriesId ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-secondary)]'">{{ series.modality || 'N/A' }}</span>
              <span v-if="isFourDSeries(series)" class="series-four-d-chip" :class="{ 'series-four-d-chip--active': series.seriesId === selectedSeriesId }">4D</span>
            </span>
            <span class="col-start-2 block truncate pr-10 text-[11px] leading-5" :class="series.seriesId === selectedSeriesId ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-muted)]'">{{ getSeriesValueMetaLabel(series) }}</span>
            <span class="col-start-2 block truncate pr-10 text-[11px] leading-5" :title="series.seriesId" :class="series.seriesId === selectedSeriesId ? 'text-[var(--theme-active-foreground-muted)]' : 'text-[var(--theme-text-muted)]'">{{ series.seriesId }}</span>
          </button>
          <VBtn
            variant="flat"
            class="series-delete-button absolute bottom-3 right-3 h-8! w-8! min-w-0! rounded-lg! border!"
            :class="series.seriesId === selectedSeriesId ? 'border-white/18! bg-white/12! text-white!' : 'border-rose-300/14! bg-rose-400/8! text-rose-100!'"
            :aria-label="t('deleteSeries')"
            :title="t('deleteSeries')"
            @click="emit('removeSeries', series.seriesId)"
          >
            <AppIcon name="trash" :size="14" />
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
                <div class="series-context-menu__thumb">
                  <img v-if="contextSeriesPreview.thumbnailSrc" :src="contextSeriesPreview.thumbnailSrc" :alt="contextSeriesPreview.title" loading="lazy" decoding="async" draggable="false" />
                  <span v-else>{{ contextSeriesPreview.fallbackLabel }}</span>
                </div>
                <div class="min-w-0 flex-1">
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
                :class="{ 'series-context-menu__item--danger': action.danger, 'series-context-menu__item--disabled': action.disabled }"
                @click="!action.disabled && handleContextAction(action.key)"
              >
                <div class="flex items-center gap-2.5">
                  <div class="series-context-menu__badge" :class="{ 'series-context-menu__badge--danger': action.danger, 'series-context-menu__badge--disabled': action.disabled }">{{ action.badge }}</div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-[12px] font-medium" :class="action.disabled ? 'text-[var(--theme-text-muted)]' : action.danger ? 'text-rose-300' : 'text-[var(--theme-text-primary)]'">{{ action.title }}</div>
                    <div class="truncate text-[11px]" :class="action.disabled ? 'text-[var(--theme-text-muted)]' : action.danger ? 'text-rose-300/70' : 'text-[var(--theme-text-secondary)]'">{{ action.subtitle }}</div>
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

.series-context-menu__item--disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.series-context-menu__item--disabled:hover {
  background: transparent;
  box-shadow: none;
  transform: none;
}

.series-context-menu__thumb {
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

.series-context-menu__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.series-context-menu__badge--disabled {
  border-color: color-mix(in srgb, var(--theme-text-primary) 12%, transparent);
  background: color-mix(in srgb, var(--theme-text-primary) 6%, transparent);
  color: var(--theme-text-muted);
}
</style>
