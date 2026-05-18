<script setup lang="ts">
import { computed, ref } from 'vue'
import { VBtn, VCard, VChip, VDialog, VMenu } from 'vuetify/components'
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
  compareSeries: [sourceSeriesId: string, targetSeriesId: string]
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

type SeriesContextAction = 'Stack' | 'MPR' | '3D' | '4D' | 'Tag' | 'compare' | 'deidentify' | 'delete'

const { locale, t } = useUiLocale()
const { dicomDeidentifyPreference, exportPreference } = useUiPreferences()
const isContextMenuOpen = ref(false)
const isCompareDialogOpen = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextSeries = ref<FolderSeriesItem | null>(null)
const compareSourceSeries = ref<FolderSeriesItem | null>(null)
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
    key: 'compare' as const,
    title: isZh.value ? '对比' : 'Compare',
    subtitle: isZh.value ? '选择另一个序列打开 Stack 对比' : 'Choose another series for Stack compare',
    badge: 'CMP',
    disabled: props.seriesList.length < 2
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

const compareSourcePreview = computed(() => {
  const series = compareSourceSeries.value
  if (!series) {
    return {
      title: '',
      meta: '',
      id: '',
      thumbnailSrc: '',
      fallbackLabel: ''
    }
  }

  return {
    title: series.seriesDescription || t('unnamedSeries'),
    meta: getSeriesMetaLabel(series),
    id: series.seriesId,
    thumbnailSrc: getSeriesThumbnailSrc(series) ?? '',
    fallbackLabel: getSeriesFallbackLabel(series)
  }
})

const compareCandidates = computed(() =>
  props.seriesList.filter((series) => series.seriesId !== compareSourceSeries.value?.seriesId)
)

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
  } else if (action === 'compare') {
    compareSourceSeries.value = series
    isCompareDialogOpen.value = true
    closeContextMenu()
    return
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

function confirmCompareSeries(targetSeries: FolderSeriesItem): void {
  const sourceSeries = compareSourceSeries.value
  if (!sourceSeries || sourceSeries.seriesId === targetSeries.seriesId) {
    return
  }

  emit('compareSeries', sourceSeries.seriesId, targetSeries.seriesId)
  isCompareDialogOpen.value = false
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
        content-class="series-context-menu-overlay"
        location="bottom start"
        :offset="8"
        scroll-strategy="reposition"
        :close-on-content-click="true"
      >
        <VCard class="series-context-menu theme-shell-panel w-[304px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[22px]! border! text-[var(--theme-text-primary)]! shadow-[0_24px_52px_rgba(0,0,0,0.44)]!">
          <div class="series-context-menu__chrome"></div>
          <div class="series-context-menu__body relative px-2 pb-2 pt-2">
            <div class="series-context-menu__actions space-y-0.5">
              <VBtn
                v-for="action in contextMenuActions"
                :key="action.key"
                class="series-context-menu__item h-auto! w-full! min-w-0! justify-start! rounded-[14px]! px-0! py-0! normal-case! tracking-normal!"
                :class="{ 'series-context-menu__item--danger': action.danger, 'series-context-menu__item--disabled': action.disabled }"
                variant="flat"
                :ripple="false"
                :disabled="action.disabled"
                @click="!action.disabled && handleContextAction(action.key)"
              >
                <div class="series-context-menu__item-content flex w-full items-center gap-2.5">
                  <div class="series-context-menu__badge" :class="{ 'series-context-menu__badge--danger': action.danger, 'series-context-menu__badge--disabled': action.disabled }">{{ action.badge }}</div>
                  <div class="min-w-0 flex-1 text-left">
                    <div class="truncate text-[12px] font-medium" :class="action.disabled ? 'text-[var(--theme-text-muted)]' : action.danger ? 'text-rose-300' : 'text-[var(--theme-text-primary)]'">{{ action.title }}</div>
                    <div class="truncate text-[11px]" :class="action.disabled ? 'text-[var(--theme-text-muted)]' : action.danger ? 'text-rose-300/70' : 'text-[var(--theme-text-secondary)]'">{{ action.subtitle }}</div>
                  </div>
                </div>
              </VBtn>
            </div>
          </div>
        </VCard>
      </VMenu>
    </div>

    <VDialog v-model="isCompareDialogOpen" max-width="920">
      <VCard class="series-compare-dialog theme-shell-panel overflow-hidden rounded-[24px]! border! p-0! text-[var(--theme-text-primary)]! shadow-[0_28px_70px_rgba(0,0,0,0.52)]!">
        <div class="flex items-start justify-between gap-4 border-b border-[var(--theme-border-soft)] px-5 py-4">
          <div class="min-w-0">
            <div class="text-lg font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '选择对比序列' : 'Choose Compare Series' }}</div>
            <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ isZh ? 'A 为当前基准序列，选择一个 B 目标序列后会打开左右并排的 Stack 对比 Tab。' : 'A is the current source series. Choose a B target series to open a side-by-side Stack compare tab.' }}</div>
          </div>
          <VBtn class="h-10! w-10! min-w-0! rounded-xl! border! border-[var(--theme-border-soft)]! bg-[var(--theme-surface-muted)]! text-[var(--theme-text-secondary)]!" variant="flat" @click="isCompareDialogOpen = false">
            <AppIcon name="close" :size="18" />
          </VBtn>
        </div>

        <div class="grid gap-4 p-5 md:grid-cols-[minmax(280px,0.92fr)_56px_minmax(0,1.18fr)]">
          <section class="series-compare-dialog__source theme-card-soft rounded-2xl border p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <span class="series-compare-dialog__role-badge series-compare-dialog__role-badge--source">A</span>
                <div>
                  <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">{{ isZh ? '基准 Source' : 'Source Series' }}</div>
                  <div class="mt-0.5 text-[11px] font-medium text-[var(--theme-accent)]">{{ isZh ? '已固定为当前序列' : 'Locked as current series' }}</div>
                </div>
              </div>
              <span class="rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-accent)]">SOURCE</span>
            </div>

            <div class="mt-5 grid grid-cols-[58px_minmax(0,1fr)] gap-3">
              <span class="series-compare-dialog__thumb series-compare-dialog__thumb--source">
                <img v-if="compareSourcePreview.thumbnailSrc" :src="compareSourcePreview.thumbnailSrc" :alt="compareSourcePreview.title" loading="lazy" decoding="async" draggable="false" />
                <span v-else>{{ compareSourcePreview.fallbackLabel }}</span>
              </span>
              <div class="min-w-0">
                <div class="truncate text-base font-semibold text-[var(--theme-text-primary)]">{{ compareSourcePreview.title }}</div>
                <div class="mt-1.5 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ compareSourcePreview.meta }}</div>
                <div class="mt-1.5 truncate font-mono text-[11px] text-[var(--theme-text-muted)]" :title="compareSourcePreview.id">{{ compareSourcePreview.id }}</div>
              </div>
            </div>
          </section>

          <div class="series-compare-dialog__connector hidden items-center justify-center md:flex" aria-hidden="true">
            <span class="series-compare-dialog__connector-line"></span>
            <span class="series-compare-dialog__connector-badge">VS</span>
            <span class="series-compare-dialog__connector-line"></span>
          </div>

          <section class="min-w-0">
            <div class="mb-2 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="series-compare-dialog__role-badge series-compare-dialog__role-badge--target">B</span>
                <div>
                  <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">{{ isZh ? '目标 Target' : 'Target Series' }}</div>
                  <div class="mt-0.5 text-[11px] text-[var(--theme-text-secondary)]">{{ isZh ? '点击下方序列作为右侧 B 视图' : 'Click a series below as the right-side B view' }}</div>
                </div>
              </div>
              <span class="theme-card-soft rounded-full border px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-text-secondary)]">{{ compareCandidates.length }}</span>
            </div>
            <div class="series-compare-dialog__list min-h-0 max-h-[420px] space-y-2 overflow-auto pr-1">
              <button
                v-for="candidate in compareCandidates"
                :key="candidate.seriesId"
                class="series-compare-dialog__candidate theme-card-soft grid w-full grid-cols-[50px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 text-left transition duration-150"
                type="button"
                @click="confirmCompareSeries(candidate)"
              >
                <span class="series-compare-dialog__thumb">
                  <img v-if="getSeriesThumbnailSrc(candidate)" :src="getSeriesThumbnailSrc(candidate)" :alt="candidate.seriesDescription || t('unnamedSeries')" loading="lazy" decoding="async" draggable="false" />
                  <span v-else>{{ getSeriesFallbackLabel(candidate) }}</span>
                </span>
                <span class="min-w-0">
                  <span class="flex min-w-0 items-center gap-2">
                    <span class="truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ candidate.seriesDescription || t('unnamedSeries') }}</span>
                    <span class="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-secondary)]">{{ candidate.modality || 'N/A' }}</span>
                  </span>
                  <span class="mt-1 block truncate text-[11px] text-[var(--theme-text-secondary)]">{{ getSeriesValueMetaLabel(candidate) }}</span>
                  <span class="mt-1 block truncate font-mono text-[10px] text-[var(--theme-text-muted)]">{{ candidate.seriesId }}</span>
                </span>
                <span class="series-compare-dialog__target-action">
                  <span>B</span>
                  <AppIcon name="chevron-right" :size="15" />
                </span>
              </button>
            </div>
          </section>
        </div>
      </VCard>
    </VDialog>
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
  max-height: min(620px, calc(100vh - 24px));
  backdrop-filter: blur(16px);
}

:global(.series-context-menu-overlay) {
  width: 304px !important;
  max-width: calc(100vw - 24px) !important;
  max-height: calc(100vh - 24px) !important;
}

.series-context-menu__body {
  max-height: min(620px, calc(100vh - 24px));
  overflow-y: auto;
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
  position: relative;
  min-height: 44px;
  border: 1px solid transparent !important;
  outline: 0 !important;
  background: transparent !important;
  color: var(--theme-text-primary) !important;
  box-shadow: none !important;
  overflow: visible;
  text-align: left;
}

.series-context-menu__item-content {
  position: relative;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 7px 10px;
  background: transparent;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}

.series-context-menu__item-content::before {
  position: absolute;
  inset: 8px auto 8px 0;
  width: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 78%, var(--theme-text-primary) 8%);
  content: '';
  opacity: 0;
  transition: opacity 160ms ease;
}

.series-context-menu__item:hover .series-context-menu__item-content {
  border-color: color-mix(in srgb, var(--theme-accent) 26%, transparent) !important;
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-card) 76%) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
}

.series-context-menu__item:hover .series-context-menu__item-content::before {
  opacity: 1;
}

.series-context-menu__item--danger:hover .series-context-menu__item-content {
  border-color: rgba(251, 113, 133, 0.24) !important;
  background: color-mix(in srgb, rgb(251, 113, 133) 10%, var(--theme-surface-card) 78%) !important;
}

.series-context-menu__item--danger:hover .series-context-menu__item-content::before {
  background: rgb(251, 113, 133);
}

.series-context-menu__item--disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.series-context-menu__item--disabled:hover .series-context-menu__item-content {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
}

.series-context-menu__item--disabled:hover .series-context-menu__item-content::before {
  opacity: 0;
}

:deep(.series-context-menu__item .v-btn__content) {
  width: 100%;
  justify-content: flex-start;
  white-space: normal;
}

:deep(.series-context-menu__item .v-btn__overlay),
:deep(.series-context-menu__item .v-btn__underlay) {
  opacity: 0 !important;
  background: transparent !important;
}

:deep(.series-context-menu__item .v-btn__content) {
  position: relative;
  z-index: 1;
}

.series-context-menu__badge {
  display: inline-flex;
  height: 22px;
  min-width: 36px;
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

.series-compare-dialog {
  backdrop-filter: blur(18px);
}

.series-compare-dialog__source {
  border-color: color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-soft));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 12%, transparent), transparent 42%),
    color-mix(in srgb, var(--theme-surface-card) 90%, transparent);
}

.series-compare-dialog__role-badge {
  display: inline-grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.series-compare-dialog__role-badge--source {
  border: 1px solid color-mix(in srgb, var(--theme-accent) 44%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-card));
  color: var(--theme-accent);
}

.series-compare-dialog__role-badge--target {
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 74%, transparent);
  background: color-mix(in srgb, var(--theme-surface-muted) 86%, transparent);
  color: var(--theme-text-primary);
}

.series-compare-dialog__connector {
  flex-direction: column;
  gap: 8px;
}

.series-compare-dialog__connector-line {
  width: 1px;
  min-height: 46px;
  background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--theme-accent) 36%, transparent), transparent);
}

.series-compare-dialog__connector-badge {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 32%, var(--theme-border-soft));
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-panel) 90%, transparent);
  color: color-mix(in srgb, var(--theme-text-primary) 82%, var(--theme-accent) 18%);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.series-compare-dialog__candidate:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 9%, var(--theme-surface-card));
  transform: translateY(-1px);
}

.series-compare-dialog__candidate:hover .series-compare-dialog__target-action {
  border-color: color-mix(in srgb, var(--theme-accent) 44%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
  color: var(--theme-accent);
}

.series-compare-dialog__thumb {
  display: grid;
  width: 50px;
  height: 50px;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  border-radius: 16px;
  background:
    radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--theme-accent) 16%, transparent), transparent 44%),
    linear-gradient(180deg, rgba(2, 6, 12, 0.98), rgba(0, 0, 0, 1));
  color: color-mix(in srgb, var(--theme-text-primary) 78%, var(--theme-accent) 22%);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.series-compare-dialog__thumb--source {
  width: 58px;
  height: 58px;
  border-radius: 18px;
}

.series-compare-dialog__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.series-compare-dialog__target-action {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 4px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-muted) 78%, transparent);
  padding: 0 8px;
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    color 150ms ease;
}
</style>
