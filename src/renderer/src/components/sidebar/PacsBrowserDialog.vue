<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { VBtn, VDatePicker, VDialog, VLocaleProvider, VMenu } from 'vuetify/components'
import { zhHans } from 'vuetify/locale'
import type { PacsSeriesItem, PacsStudyItem } from '@shared/generated/backendApi'
import AppIcon from '../AppIcon.vue'
import { toApiPacsDicomwebProfile, toApiPacsDimseProfile } from '../../composables/pacs/pacsProfileApi'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import { showDicomJobProgressToast, waitForDicomJob } from '../../composables/workspace/tasks/dicomJobTask'
import { dispatchWorkspaceStatusToast } from '../../composables/workspace/tasks/workspaceStatus'
import type { FolderSeriesItem } from '../../types/viewer'
import {
  createPacsDefaultStudyDateRange,
  formatPacsDateValue,
  normalizePacsLimitValue,
  PACS_LIMIT_DEFAULT,
  PACS_LIMIT_PRESETS,
  PACS_SERIES_LIMIT,
  parsePacsDateValue
} from '../../composables/pacs/pacsQueryUtils'
import {
  cancelPacsDimseSeriesDownloadJob,
  cancelPacsWadoSeriesDownloadJob,
  getPacsDimseSeriesDownloadJob,
  getPacsWadoSeriesDownloadJob,
  postApi,
  postPacsDimseSeriesDownloadJob,
  postPacsSeriesPreview,
  postPacsWadoSeriesDownloadJob,
  type LoadFolderResponse,
  type PacsSeriesPreviewResponse,
  type PacsSeriesDownloadJob
} from '../../services/typedApi'

const props = withDefaults(defineProps<{
  isOpen: boolean
  loadedSeriesList?: FolderSeriesItem[]
}>(), {
  loadedSeriesList: () => []
})

const emit = defineEmits<{
  close: []
  seriesLoaded: [response: LoadFolderResponse]
}>()

const { locale } = useUiLocale()
const { pacsPreference } = useUiPreferences()

const isQueryingStudies = ref(false)
const isQueryingSeries = ref(false)
const queryError = ref('')
const isProfileMenuOpen = ref(false)
const isModalityMenuOpen = ref(false)
const isLimitMenuOpen = ref(false)
const isStudyDateFromMenuOpen = ref(false)
const isStudyDateToMenuOpen = ref(false)
const isAdvancedFiltersOpen = ref(false)
const pacsFilterScrollRef = ref<HTMLElement | null>(null)
const pacsAdvancedFilterSectionRef = ref<HTMLElement | null>(null)
const advancedFilterRestoreScrollTop = ref<number | null>(null)
const selectedProfileId = ref('')
const studyInstanceUid = ref('')
const patientKeyword = ref('')
const patientId = ref('')
const accessionNumber = ref('')
const studyDescription = ref('')
const modality = ref('')
const seriesInstanceUid = ref('')
const seriesDescription = ref('')
const bodyPartExamined = ref('')
const studyDateFrom = ref('')
const studyDateTo = ref('')
const limit = ref(PACS_LIMIT_DEFAULT)
const studyOffset = ref(0)
const seriesOffset = ref(0)
const studies = ref<PacsStudyItem[]>([])
const selectedStudyUid = ref('')
const seriesItems = ref<PacsSeriesItem[]>([])
const activeSeriesUid = ref('')
const downloadingSeriesUid = ref('')
const activeDownloadJobId = ref('')
const activeDownloadProtocol = ref<'dicomweb' | 'dimse'>('dicomweb')
const isCancellingDownload = ref(false)
const previewLoadingSeriesUid = ref('')
const seriesPreviewByUid = ref<Record<string, PacsSeriesPreviewResponse>>({})
const seriesPreviewErrorsByUid = ref<Record<string, string>>({})

const isDialogOpen = computed({
  get: () => props.isOpen,
  set: (value: boolean) => {
    if (!value) emit('close')
  }
})
const isZh = computed(() => locale.value === 'zh-CN')
const enabledProfiles = computed(() => pacsPreference.value.profiles.filter((profile) => profile.enabled))
const selectedProfile = computed(() => (
  enabledProfiles.value.find((profile) => profile.id === selectedProfileId.value) ??
  enabledProfiles.value.find((profile) => profile.id === pacsPreference.value.activeProfileId) ??
  enabledProfiles.value[0] ??
  null
))
const selectedStudy = computed(() => studies.value.find((study) => study.studyInstanceUid === selectedStudyUid.value) ?? null)
const canQuery = computed(() => Boolean(selectedProfile.value) && !isQueryingStudies.value)
const hasPreviousStudyPage = computed(() => studyOffset.value > 0)
const hasNextStudyPage = computed(() => studies.value.length >= limit.value)
const hasPreviousSeriesPage = computed(() => seriesOffset.value > 0)
const hasNextSeriesPage = computed(() => seriesItems.value.length >= PACS_SERIES_LIMIT)
const studyPageLabel = computed(() => (studies.value.length ? `${studyOffset.value + 1}-${studyOffset.value + studies.value.length}` : '0'))
const seriesPageLabel = computed(() => (
  isQueryingSeries.value ? '...' : seriesItems.value.length ? `${seriesOffset.value + 1}-${seriesOffset.value + seriesItems.value.length}` : '0'
))
const selectedProfileLabel = computed(() => selectedProfile.value?.name ?? (isZh.value ? '未选择配置' : 'No profile selected'))
const isSelectedProfileDimse = computed(() => selectedProfile.value?.protocol === 'dimse')
const advancedFilterCount = computed(() => [
  studyInstanceUid.value,
  studyDescription.value,
  seriesInstanceUid.value,
  seriesDescription.value,
  bodyPartExamined.value
].filter((value) => value.trim()).length)
const pacsVuetifyLocale = computed(() => (isZh.value ? 'zhHans' : 'en'))
const pacsVuetifyLocaleMessages = { zhHans }
const pacsModalityOptions = ['ALL', 'CT', 'MR', 'PT', 'US', 'XA', 'CR', 'DX', 'MG', 'NM', 'RF', 'OT']
const PACS_ADVANCED_FILTER_SCROLL_DELAY_MS = 240
let advancedFilterScrollTimeoutId: number | null = null
const studyDateFromModel = computed<Date | null>({
  get: () => parsePacsDateValue(studyDateFrom.value),
  set: (value) => {
    studyDateFrom.value = formatPacsDateValue(value)
  }
})
const studyDateToModel = computed<Date | null>({
  get: () => parsePacsDateValue(studyDateTo.value),
  set: (value) => {
    studyDateTo.value = formatPacsDateValue(value)
  }
})
const downloadedSeriesByUid = computed(() => {
  const seriesByUid = new Map<string, FolderSeriesItem>()
  for (const series of props.loadedSeriesList) {
    const uid = series.seriesInstanceUid?.trim()
    if (uid && !seriesByUid.has(uid)) {
      seriesByUid.set(uid, series)
    }
  }
  return seriesByUid
})
const pacsDownloadCopy = computed(() => ({
  started: isZh.value ? 'PACS 序列下载任务已开始，完成后会打开影像。' : 'PACS series download started. The series will open when ready.',
  preparing: isZh.value ? '正在准备 PACS 下载...' : 'Preparing PACS download...',
  packaging: isZh.value ? 'DICOM 已下载，正在注册序列...' : 'DICOM downloaded, registering series...',
  progress: (processed: number, total: number, percent: number) => (
    isZh.value ? `已下载 ${processed}/${total} (${percent}%)` : `Downloaded ${processed}/${total} (${percent}%)`
  )
}))

function ensureDefaultStudyDateRange(): void {
  if (studyDateFrom.value && studyDateTo.value) {
    return
  }

  const defaultRange = createPacsDefaultStudyDateRange()
  if (!studyDateFrom.value) {
    studyDateFrom.value = defaultRange.from
  }
  if (!studyDateTo.value) {
    studyDateTo.value = defaultRange.to
  }
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      clearAdvancedFilterScrollTimer()
      return
    }
    ensureDefaultStudyDateRange()
    selectedProfileId.value = selectedProfile.value?.id ?? ''
    queryError.value = ''
  },
  { immediate: true }
)

watch(selectedProfile, (profile) => {
  if (profile) {
    selectedProfileId.value = profile.id
  }
})

function selectProfile(profileId: string): void {
  selectedProfileId.value = profileId
  isProfileMenuOpen.value = false
}

function getModalityOptionLabel(option: string): string {
  return option === 'ALL' ? (isZh.value ? '全部' : 'All') : option
}

function getSelectedModalityLabel(): string {
  return modality.value ? modality.value : (isZh.value ? '全部' : 'All')
}

function selectModality(option: string): void {
  modality.value = option === 'ALL' ? '' : option
  isModalityMenuOpen.value = false
}

function clearStudyDate(field: 'from' | 'to'): void {
  if (field === 'from') {
    studyDateFrom.value = ''
    return
  }
  studyDateTo.value = ''
}

function clampScrollTop(element: HTMLElement, scrollTop: number): number {
  return Math.max(0, Math.min(scrollTop, Math.max(0, element.scrollHeight - element.clientHeight)))
}

function clearAdvancedFilterScrollTimer(): void {
  if (advancedFilterScrollTimeoutId == null) {
    return
  }
  window.clearTimeout(advancedFilterScrollTimeoutId)
  advancedFilterScrollTimeoutId = null
}

function scrollAdvancedFiltersIntoView(behavior: ScrollBehavior = 'smooth'): void {
  const scrollElement = pacsFilterScrollRef.value
  const targetElement = pacsAdvancedFilterSectionRef.value
  if (!scrollElement || !targetElement) {
    return
  }

  const scrollRect = scrollElement.getBoundingClientRect()
  const targetRect = targetElement.getBoundingClientRect()
  const targetTop = scrollElement.scrollTop + targetRect.top - scrollRect.top - 12
  scrollElement.scrollTo({
    top: clampScrollTop(scrollElement, targetTop),
    behavior
  })
}

function restoreAdvancedFiltersScroll(): void {
  const scrollElement = pacsFilterScrollRef.value
  const restoreTop = advancedFilterRestoreScrollTop.value
  advancedFilterRestoreScrollTop.value = null
  if (!scrollElement || restoreTop == null) {
    return
  }
  scrollElement.scrollTo({
    top: clampScrollTop(scrollElement, restoreTop),
    behavior: 'smooth'
  })
}

function scheduleAdvancedFiltersIntoView(): void {
  clearAdvancedFilterScrollTimer()
  void nextTick(() => {
    window.requestAnimationFrame(() => scrollAdvancedFiltersIntoView())
    advancedFilterScrollTimeoutId = window.setTimeout(() => {
      advancedFilterScrollTimeoutId = null
      scrollAdvancedFiltersIntoView('auto')
    }, PACS_ADVANCED_FILTER_SCROLL_DELAY_MS)
  })
}

function toggleAdvancedFilters(): void {
  if (!isAdvancedFiltersOpen.value) {
    advancedFilterRestoreScrollTop.value = pacsFilterScrollRef.value?.scrollTop ?? 0
    isAdvancedFiltersOpen.value = true
    scheduleAdvancedFiltersIntoView()
    return
  }

  clearAdvancedFilterScrollTimer()
  isAdvancedFiltersOpen.value = false
  void nextTick(() => {
    window.requestAnimationFrame(restoreAdvancedFiltersScroll)
  })
}

function setLimitValue(value: unknown): void {
  limit.value = normalizePacsLimitValue(value)
}

function selectLimitValue(value: unknown): void {
  setLimitValue(value)
  isLimitMenuOpen.value = false
}

function queryStudyFirstPage(): void {
  void queryStudies(0)
}

function queryPreviousStudyPage(): void {
  void queryStudies(Math.max(0, studyOffset.value - limit.value))
}

function queryNextStudyPage(): void {
  void queryStudies(studyOffset.value + limit.value)
}

function querySeriesFirstPage(): void {
  if (selectedStudy.value) {
    void querySeries(selectedStudy.value, 0)
  }
}

function queryPreviousSeriesPage(): void {
  if (selectedStudy.value) {
    void querySeries(selectedStudy.value, Math.max(0, seriesOffset.value - PACS_SERIES_LIMIT))
  }
}

function queryNextSeriesPage(): void {
  if (selectedStudy.value) {
    void querySeries(selectedStudy.value, seriesOffset.value + PACS_SERIES_LIMIT)
  }
}

function formatStudyTitle(study: PacsStudyItem): string {
  return study.studyDescription || study.patientName || study.studyInstanceUid || (isZh.value ? '未命名检查' : 'Unnamed Study')
}

function isStudySelected(study: PacsStudyItem): boolean {
  return study.studyInstanceUid === selectedStudyUid.value
}

function getSeriesUid(series: PacsSeriesItem): string {
  return series.seriesInstanceUid?.trim() ?? ''
}

function isSeriesActive(series: PacsSeriesItem): boolean {
  const uid = getSeriesUid(series)
  return Boolean(uid && uid === activeSeriesUid.value)
}

function setActiveSeries(series: PacsSeriesItem): void {
  const uid = getSeriesUid(series)
  if (uid) {
    activeSeriesUid.value = uid
  }
}

function formatCountLabel(count: number | null | undefined, zhUnit: string, enUnit: string): string | null {
  if (!count) {
    return null
  }
  return isZh.value ? `${count} ${zhUnit}` : `${count} ${enUnit}`
}

function formatStudyMeta(study: PacsStudyItem): string {
  return [
    study.patientName,
    study.patientId,
    study.studyDate,
    study.modalitiesInStudy?.join('/'),
    formatCountLabel(study.numberOfStudyRelatedSeries, '个序列', 'series'),
    formatCountLabel(study.numberOfStudyRelatedInstances, '张影像', 'images')
  ].filter(Boolean).join(' · ')
}

function formatSeriesMeta(series: PacsSeriesItem): string {
  return [
    series.modality,
    series.seriesNumber ? `#${series.seriesNumber}` : null,
    formatCountLabel(series.numberOfSeriesRelatedInstances, '张影像', 'images'),
    series.bodyPartExamined
  ].filter(Boolean).join(' · ')
}

async function queryStudies(offset = 0): Promise<void> {
  const profile = selectedProfile.value
  if (!profile) {
    queryError.value = isZh.value ? '请先在设置中启用一个 PACS 配置。' : 'Enable a PACS profile in settings first.'
    return
  }

  isQueryingStudies.value = true
  queryError.value = ''
  selectedStudyUid.value = ''
  seriesItems.value = []
  activeSeriesUid.value = ''
  seriesOffset.value = 0
  seriesPreviewByUid.value = {}
  seriesPreviewErrorsByUid.value = {}
  try {
    const normalizedLimit = normalizePacsLimitValue(limit.value)
    limit.value = normalizedLimit
    const normalizedOffset = Math.max(0, Math.trunc(Number(offset) || 0))
    const studyQuery = {
      studyInstanceUid: studyInstanceUid.value.trim() || null,
      patientId: patientId.value.trim() || null,
      patientName: patientKeyword.value.trim() || null,
      accessionNumber: accessionNumber.value.trim() || null,
      studyDescription: studyDescription.value.trim() || null,
      modality: modality.value.trim().toUpperCase() || null,
      studyDateFrom: studyDateFrom.value || null,
      studyDateTo: studyDateTo.value || null,
      limit: normalizedLimit,
      offset: normalizedOffset
    }
    const response = profile.protocol === 'dimse'
      ? await postApi('QueryDimseStudiesApiV1PacsDimseStudiesPost', {
          profile: toApiPacsDimseProfile(profile),
          ...studyQuery
        })
      : await postApi('QueryDicomwebStudiesApiV1PacsDicomwebStudiesPost', {
          profile: toApiPacsDicomwebProfile(profile),
          ...studyQuery
        })
    studies.value = response.items ?? []
    studyOffset.value = normalizedOffset
  } catch (error) {
    queryError.value = error instanceof Error ? error.message : (isZh.value ? '查询检查失败' : 'Failed to query studies')
  } finally {
    isQueryingStudies.value = false
  }
}

async function querySeries(study: PacsStudyItem, offset = 0): Promise<void> {
  const profile = selectedProfile.value
  if (!profile || !study.studyInstanceUid) return

  selectedStudyUid.value = study.studyInstanceUid
  isQueryingSeries.value = true
  queryError.value = ''
  seriesItems.value = []
  activeSeriesUid.value = ''
  seriesPreviewByUid.value = {}
  seriesPreviewErrorsByUid.value = {}
  try {
    const normalizedOffset = Math.max(0, Math.trunc(Number(offset) || 0))
    const seriesQuery = {
      studyInstanceUid: study.studyInstanceUid,
      seriesInstanceUid: seriesInstanceUid.value.trim() || null,
      modality: modality.value.trim().toUpperCase() || null,
      seriesDescription: seriesDescription.value.trim() || null,
      bodyPartExamined: bodyPartExamined.value.trim().toUpperCase() || null,
      limit: PACS_SERIES_LIMIT,
      offset: normalizedOffset
    }
    const response = profile.protocol === 'dimse'
      ? await postApi('QueryDimseSeriesApiV1PacsDimseSeriesPost', {
          profile: toApiPacsDimseProfile(profile),
          ...seriesQuery
        })
      : await postApi('QueryDicomwebSeriesApiV1PacsDicomwebSeriesPost', {
          profile: toApiPacsDicomwebProfile(profile),
          ...seriesQuery
        })
    seriesItems.value = response.items ?? []
    seriesOffset.value = normalizedOffset
  } catch (error) {
    queryError.value = error instanceof Error ? error.message : (isZh.value ? '查询序列失败' : 'Failed to query series')
  } finally {
    isQueryingSeries.value = false
  }
}

function getSeriesPreview(series: PacsSeriesItem): PacsSeriesPreviewResponse | null {
  const uid = getSeriesUid(series)
  return uid ? seriesPreviewByUid.value[uid] ?? null : null
}

function getSeriesPreviewError(series: PacsSeriesItem): string {
  const uid = getSeriesUid(series)
  return uid ? seriesPreviewErrorsByUid.value[uid] ?? '' : ''
}

function formatSeriesPreviewSummary(preview: PacsSeriesPreviewResponse | null | undefined): string {
  if (!preview) {
    return ''
  }

  return [
    formatCountLabel(preview.instanceCount, '张影像', 'images'),
    preview.rows && preview.columns ? `${preview.columns}x${preview.rows}` : null,
    preview.transferSyntaxes?.[0] ?? null,
    preview.isCompressed ? (isZh.value ? '压缩' : 'Compressed') : null,
    preview.hasMultiFrameInstances
      ? (isZh.value ? `多帧${preview.numberOfFrames ? ` ${preview.numberOfFrames}` : ''}` : `Multi-frame${preview.numberOfFrames ? ` ${preview.numberOfFrames}` : ''}`)
      : null,
    preview.photometricInterpretations?.join('/') || null
  ].filter(Boolean).join(' · ')
}

async function previewSeries(series: PacsSeriesItem): Promise<void> {
  const profile = selectedProfile.value
  const seriesUid = getSeriesUid(series)
  setActiveSeries(series)
  if (profile?.protocol === 'dimse') {
    dispatchWorkspaceStatusToast(
      isZh.value ? 'DIMSE 预览需要 C-MOVE/C-GET 接收端，后续版本补充。' : 'DIMSE preview needs a C-MOVE/C-GET receiver and will be added next.',
      'info',
      { durationMs: 4200 }
    )
    return
  }
  if (!profile || !series.studyInstanceUid || !seriesUid || previewLoadingSeriesUid.value) {
    return
  }

  previewLoadingSeriesUid.value = seriesUid
  seriesPreviewErrorsByUid.value = { ...seriesPreviewErrorsByUid.value, [seriesUid]: '' }
  try {
    const preview = await postPacsSeriesPreview({
      profile: toApiPacsDicomwebProfile(profile),
      studyInstanceUid: series.studyInstanceUid,
      seriesInstanceUid: seriesUid,
      thumbnail: true
    })
    seriesPreviewByUid.value = { ...seriesPreviewByUid.value, [seriesUid]: preview }
  } catch (error) {
    seriesPreviewErrorsByUid.value = {
      ...seriesPreviewErrorsByUid.value,
      [seriesUid]: error instanceof Error ? error.message : (isZh.value ? '预览失败' : 'Preview failed')
    }
  } finally {
    previewLoadingSeriesUid.value = ''
  }
}

function buildDownloadedLoadResponse(job: PacsSeriesDownloadJob): LoadFolderResponse | null {
  const seriesList = job.seriesList ?? []
  if (!seriesList.length) {
    return null
  }

  return {
    seriesId: job.seriesId ?? seriesList[0]?.seriesId ?? null,
    seriesList
  }
}

function getDownloadedSeries(series: PacsSeriesItem): FolderSeriesItem | null {
  const uid = getSeriesUid(series)
  return uid ? downloadedSeriesByUid.value.get(uid) ?? null : null
}

function isSeriesDownloaded(series: PacsSeriesItem): boolean {
  return Boolean(getDownloadedSeries(series))
}

function openDownloadedSeries(series: PacsSeriesItem): void {
  setActiveSeries(series)
  const downloadedSeries = getDownloadedSeries(series)
  if (!downloadedSeries) {
    return
  }

  emit('seriesLoaded', {
    seriesId: downloadedSeries.seriesId,
    seriesList: [downloadedSeries]
  })
  emit('close')
  dispatchWorkspaceStatusToast(
    isZh.value ? '该 PACS 序列已下载，已打开已有序列。' : 'This PACS series is already downloaded. Opened the existing series.',
    'info',
    {
      durationMs: 3600,
      progressLabel: isZh.value ? '已下载' : 'Downloaded',
      progressPercent: 100
    }
  )
}

async function handleSeriesAction(series: PacsSeriesItem): Promise<void> {
  setActiveSeries(series)
  if (isSeriesDownloaded(series)) {
    openDownloadedSeries(series)
    return
  }

  await downloadSeries(series)
}

async function cancelActiveDownload(): Promise<void> {
  const jobId = activeDownloadJobId.value
  if (!jobId || isCancellingDownload.value) {
    return
  }

  isCancellingDownload.value = true
  try {
    if (activeDownloadProtocol.value === 'dimse') {
      await cancelPacsDimseSeriesDownloadJob(jobId)
    } else {
      await cancelPacsWadoSeriesDownloadJob(jobId)
    }
    dispatchWorkspaceStatusToast(isZh.value ? 'PACS 下载任务已取消' : 'PACS download cancelled', 'info', {
      durationMs: 3600
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : (isZh.value ? '取消 PACS 下载失败' : 'Failed to cancel PACS download')
    queryError.value = message
    dispatchWorkspaceStatusToast(message, 'error', { durationMs: 6000 })
  } finally {
    isCancellingDownload.value = false
  }
}

async function downloadSeries(series: PacsSeriesItem): Promise<void> {
  const profile = selectedProfile.value
  const seriesUid = getSeriesUid(series)
  if (!profile || !series.studyInstanceUid || !seriesUid || downloadingSeriesUid.value) {
    return
  }

  setActiveSeries(series)
  downloadingSeriesUid.value = seriesUid
  activeDownloadProtocol.value = profile.protocol
  queryError.value = ''
  try {
    const initialJob = profile.protocol === 'dimse'
      ? await postPacsDimseSeriesDownloadJob({
          profile: toApiPacsDimseProfile(profile),
          studyInstanceUid: series.studyInstanceUid,
          seriesInstanceUid: seriesUid
        })
      : await postPacsWadoSeriesDownloadJob({
          profile: toApiPacsDicomwebProfile(profile),
          studyInstanceUid: series.studyInstanceUid,
          seriesInstanceUid: seriesUid
        })
    activeDownloadJobId.value = initialJob.jobId
    showDicomJobProgressToast(initialJob, pacsDownloadCopy.value)

    const getDownloadJob = profile.protocol === 'dimse'
      ? getPacsDimseSeriesDownloadJob
      : getPacsWadoSeriesDownloadJob
    const finishedJob = await waitForDicomJob(initialJob, getDownloadJob, {
      timeoutMessage: isZh.value ? 'PACS 下载任务等待超时' : 'PACS download job timed out',
      onProgress: (job) => showDicomJobProgressToast(job, pacsDownloadCopy.value)
    })

    if (finishedJob.status === 'failed') {
      throw new Error(finishedJob.error || (isZh.value ? 'PACS 序列下载失败' : 'PACS series download failed'))
    }

    if (finishedJob.status === 'cancelled') {
      dispatchWorkspaceStatusToast(isZh.value ? 'PACS 下载任务已取消' : 'PACS download cancelled', 'info', {
        durationMs: 3600
      })
      return
    }

    const loadResponse = buildDownloadedLoadResponse(finishedJob)
    if (!loadResponse) {
      throw new Error(isZh.value ? 'PACS 序列已下载，但没有可打开的 DICOM 序列。' : 'PACS series downloaded, but no readable series was returned.')
    }

    emit('seriesLoaded', loadResponse)
    emit('close')
    const loadedSeriesCount = loadResponse.seriesList?.length ?? 0
    dispatchWorkspaceStatusToast(isZh.value ? 'PACS 序列已下载并打开' : 'PACS series downloaded and opened', 'success', {
      durationMs: 3600,
      progressLabel: formatCountLabel(loadedSeriesCount, '个序列', 'series') ?? '0',
      progressPercent: 100
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : (isZh.value ? 'PACS 序列下载失败' : 'PACS series download failed')
    queryError.value = message
    dispatchWorkspaceStatusToast(message, 'error', { durationMs: 6000 })
  } finally {
    downloadingSeriesUid.value = ''
    activeDownloadJobId.value = ''
    activeDownloadProtocol.value = 'dicomweb'
  }
}
</script>

<template>
  <VDialog v-model="isDialogOpen" width="96vw" max-width="1480" scrollable>
    <div class="theme-shell-panel pacs-browser-dialog overflow-hidden rounded-[28px] border shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
      <div class="flex items-start justify-between gap-4 border-b border-[var(--theme-border-soft)] px-6 py-5">
        <div class="min-w-0">
          <div class="flex items-center gap-3 text-[var(--theme-text-primary)]">
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_13%,transparent)] text-[var(--theme-accent)]">
              <AppIcon name="pacs" :size="22" />
            </span>
            <div>
              <div class="text-xl font-semibold">{{ isZh ? 'PACS 浏览器' : 'PACS Browser' }}</div>
              <div class="mt-1 text-sm leading-6 text-[var(--theme-text-secondary)]">
                {{ isZh ? '通过 DICOMweb / DIMSE 查询检查和序列。' : 'Query studies and series through DICOMweb or DIMSE.' }}
              </div>
            </div>
          </div>
        </div>
        <VBtn class="pacs-dialog-close-button h-11! w-11! min-w-0! rounded-2xl!" variant="flat" @click="emit('close')">
          <AppIcon name="close" :size="22" />
        </VBtn>
      </div>

      <div class="pacs-browser-body grid gap-0 overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside class="pacs-filter-panel min-h-0 border-b border-[var(--theme-border-soft)] lg:border-b-0 lg:border-r">
          <div ref="pacsFilterScrollRef" class="pacs-filter-scroll flex flex-col gap-4 p-5" :class="{ 'pacs-filter-scroll--advanced-open': isAdvancedFiltersOpen }">
            <div class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '配置' : 'Profile' }}</span>
              <VMenu
                v-model="isProfileMenuOpen"
                location="bottom start"
                :offset="8"
                scroll-strategy="reposition"
                :close-on-content-click="true"
              >
                <template #activator="{ props: menuProps }">
                  <button
                    v-bind="menuProps"
                    type="button"
                    class="pacs-select-trigger"
                    :class="{ 'pacs-select-trigger--open': isProfileMenuOpen }"
                    :disabled="!enabledProfiles.length"
                  >
                    <span class="truncate">{{ selectedProfileLabel }}</span>
                    <AppIcon name="chevron-down" :size="17" />
                  </button>
                </template>
                <div class="pacs-select-menu theme-shell-panel border">
                  <button
                    v-for="profile in enabledProfiles"
                    :key="profile.id"
                    type="button"
                    class="toolbar-menu-option pacs-select-option"
                    :class="{ 'toolbar-menu-option--active pacs-select-option--active': profile.id === selectedProfileId }"
                    @click="selectProfile(profile.id)"
                  >
                    <span class="pacs-select-option__rail"></span>
                    <span class="min-w-0 flex-1 truncate">{{ profile.name }}</span>
                    <AppIcon v-if="profile.id === selectedProfileId" name="check" :size="14" />
                  </button>
                </div>
              </VMenu>
            </div>
            <label class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '患者姓名' : 'Patient Name' }}</span>
              <input v-model="patientKeyword" class="pacs-input" placeholder="Patient*" @keydown.enter="queryStudyFirstPage" />
            </label>
            <label class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '患者 ID' : 'Patient ID' }}</span>
              <input v-model="patientId" class="pacs-input" placeholder="ID..." @keydown.enter="queryStudyFirstPage" />
            </label>
            <label class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '检查号' : 'Accession Number' }}</span>
              <input v-model="accessionNumber" class="pacs-input" placeholder="ACC..." @keydown.enter="queryStudyFirstPage" />
            </label>
            <label class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '模态' : 'Modality' }}</span>
              <VMenu
                v-model="isModalityMenuOpen"
                location="bottom start"
                :offset="8"
                scroll-strategy="reposition"
                :close-on-content-click="true"
              >
                <template #activator="{ props: menuProps }">
                  <button
                    v-bind="menuProps"
                    type="button"
                    class="pacs-select-trigger"
                    :class="{ 'pacs-select-trigger--open': isModalityMenuOpen }"
                  >
                    <span class="truncate">{{ getSelectedModalityLabel() }}</span>
                    <AppIcon name="chevron-down" :size="17" />
                  </button>
                </template>
                <div class="pacs-select-menu theme-shell-panel border">
                  <button
                    v-for="option in pacsModalityOptions"
                    :key="option"
                    type="button"
                    class="toolbar-menu-option pacs-select-option"
                    :class="{ 'toolbar-menu-option--active pacs-select-option--active': (option === 'ALL' && !modality) || modality === option }"
                    @click="selectModality(option)"
                  >
                    <span class="pacs-select-option__rail"></span>
                    <span class="min-w-0 flex-1 truncate">{{ getModalityOptionLabel(option) }}</span>
                    <AppIcon v-if="(option === 'ALL' && !modality) || modality === option" name="check" :size="14" />
                  </button>
                </div>
              </VMenu>
            </label>
            <VLocaleProvider
              :locale="pacsVuetifyLocale"
              fallback-locale="en"
              :messages="pacsVuetifyLocaleMessages"
            >
              <div class="grid grid-cols-2 gap-3">
                <div class="grid gap-1.5">
                  <span class="pacs-field-label">{{ isZh ? '开始日期' : 'From' }}</span>
                  <div class="pacs-date-control">
                    <VMenu
                      v-model="isStudyDateFromMenuOpen"
                      location="bottom start"
                      :offset="8"
                      scroll-strategy="reposition"
                      :close-on-content-click="false"
                      content-class="pacs-date-menu"
                    >
                      <template #activator="{ props: menuProps }">
                        <button
                          v-bind="menuProps"
                          type="button"
                          class="pacs-date-trigger"
                          :class="{
                            'pacs-date-trigger--active': isStudyDateFromMenuOpen,
                            'pacs-date-trigger--empty': !studyDateFrom,
                            'pacs-date-trigger--has-value': studyDateFrom
                          }"
                        >
                          <span class="truncate">{{ studyDateFrom || (isZh ? '开始日期' : 'From') }}</span>
                        </button>
                      </template>
                      <VDatePicker
                        v-model="studyDateFromModel"
                        hide-header
                        class="pacs-date-picker"
                        @update:model-value="isStudyDateFromMenuOpen = false"
                      />
                    </VMenu>
                    <button v-if="studyDateFrom" type="button" class="pacs-date-clear" @click="clearStudyDate('from')">
                      <AppIcon name="close" :size="13" />
                    </button>
                  </div>
                </div>
                <div class="grid gap-1.5">
                  <span class="pacs-field-label">{{ isZh ? '结束日期' : 'To' }}</span>
                  <div class="pacs-date-control">
                    <VMenu
                      v-model="isStudyDateToMenuOpen"
                      location="bottom start"
                      :offset="8"
                      scroll-strategy="reposition"
                      :close-on-content-click="false"
                      content-class="pacs-date-menu"
                    >
                      <template #activator="{ props: menuProps }">
                        <button
                          v-bind="menuProps"
                          type="button"
                          class="pacs-date-trigger"
                          :class="{
                            'pacs-date-trigger--active': isStudyDateToMenuOpen,
                            'pacs-date-trigger--empty': !studyDateTo,
                            'pacs-date-trigger--has-value': studyDateTo
                          }"
                        >
                          <span class="truncate">{{ studyDateTo || (isZh ? '结束日期' : 'To') }}</span>
                        </button>
                      </template>
                      <VDatePicker
                        v-model="studyDateToModel"
                        hide-header
                        class="pacs-date-picker"
                        @update:model-value="isStudyDateToMenuOpen = false"
                      />
                    </VMenu>
                    <button v-if="studyDateTo" type="button" class="pacs-date-clear" @click="clearStudyDate('to')">
                      <AppIcon name="close" :size="13" />
                    </button>
                  </div>
                </div>
              </div>
            </VLocaleProvider>
            <div class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '最多返回' : 'Limit' }}</span>
              <VMenu
                v-model="isLimitMenuOpen"
                location="bottom start"
                :offset="8"
                scroll-strategy="reposition"
                :close-on-content-click="true"
              >
                <template #activator="{ props: menuProps }">
                  <button
                    v-bind="menuProps"
                    type="button"
                    class="pacs-select-trigger"
                    :class="{ 'pacs-select-trigger--open': isLimitMenuOpen }"
                  >
                    <span class="truncate">{{ limit }}</span>
                    <AppIcon name="chevron-down" :size="17" />
                  </button>
                </template>
                <div class="pacs-select-menu theme-shell-panel border">
                  <button
                    v-for="option in PACS_LIMIT_PRESETS"
                    :key="option"
                    type="button"
                    class="toolbar-menu-option pacs-select-option"
                    :class="{ 'toolbar-menu-option--active pacs-select-option--active': limit === option }"
                    @click="selectLimitValue(option)"
                  >
                    <span class="pacs-select-option__rail"></span>
                    <span class="min-w-0 flex-1 truncate">{{ option }}</span>
                    <AppIcon v-if="limit === option" name="check" :size="14" />
                  </button>
                </div>
              </VMenu>
            </div>
            <section
              ref="pacsAdvancedFilterSectionRef"
              class="pacs-advanced-filter-section"
              :class="{ 'pacs-advanced-filter-section--open': isAdvancedFiltersOpen }"
            >
              <button
                type="button"
                class="pacs-advanced-filter-trigger"
                :aria-expanded="isAdvancedFiltersOpen"
                @click="toggleAdvancedFilters"
              >
                <span class="min-w-0">
                  <span class="block truncate">{{ isZh ? '更多筛选条件' : 'More filters' }}</span>
                  <span class="mt-0.5 block truncate text-[11px] font-semibold text-[var(--theme-text-muted)]">
                    {{ advancedFilterCount ? (isZh ? `已填写 ${advancedFilterCount} 项` : `${advancedFilterCount} active`) : (isZh ? 'UID、描述、部位' : 'UID, descriptions, body part') }}
                  </span>
                </span>
                <span class="pacs-advanced-filter-icon" :class="{ 'pacs-advanced-filter-icon--open': isAdvancedFiltersOpen }">
                  <AppIcon name="chevron-down" :size="16" />
                </span>
              </button>
              <div
                class="pacs-advanced-filter-body"
                :aria-hidden="!isAdvancedFiltersOpen"
                :class="{ 'pacs-advanced-filter-body--open': isAdvancedFiltersOpen }"
                :inert="!isAdvancedFiltersOpen"
              >
                <div class="pacs-advanced-filter-content grid gap-3">
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">{{ isZh ? '检查 UID' : 'Study UID' }}</span>
                    <input v-model="studyInstanceUid" class="pacs-input" placeholder="1.2.840..." @keydown.enter="queryStudyFirstPage" />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">{{ isZh ? '检查描述' : 'Study Description' }}</span>
                    <input v-model="studyDescription" class="pacs-input" placeholder="Chest / Abdomen..." @keydown.enter="queryStudyFirstPage" />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">{{ isZh ? '序列 UID' : 'Series UID' }}</span>
                    <input v-model="seriesInstanceUid" class="pacs-input" placeholder="1.2.840..." @keydown.enter="querySeriesFirstPage" />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">{{ isZh ? '序列描述' : 'Series Description' }}</span>
                    <input v-model="seriesDescription" class="pacs-input" placeholder="AX / Portal..." @keydown.enter="querySeriesFirstPage" />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">{{ isZh ? '检查部位' : 'Body Part' }}</span>
                    <input v-model="bodyPartExamined" class="pacs-input" placeholder="CHEST / ABDOMEN" @keydown.enter="querySeriesFirstPage" />
                  </label>
                </div>
              </div>
            </section>
          </div>
          <div class="pacs-filter-footer border-t border-[var(--theme-border-soft)] p-4">
            <VBtn
              variant="flat"
              class="theme-button-primary min-h-11! w-full rounded-2xl! border! text-sm! font-semibold!"
              :disabled="!canQuery"
              @click="queryStudyFirstPage"
            >
              {{ isQueryingStudies ? (isZh ? '查询中...' : 'Querying...') : (isZh ? '查询检查' : 'Query Studies') }}
            </VBtn>
            <div v-if="!enabledProfiles.length" class="mt-3 rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm leading-6 text-[var(--theme-text-secondary)]">
              {{ isZh ? '请先在设置中启用 PACS，并至少启用一个配置。' : 'Enable PACS and at least one profile in settings first.' }}
            </div>
          </div>
        </aside>

        <main class="pacs-browser-main min-h-0 min-w-0 overflow-hidden p-5">
          <div v-if="queryError" class="mb-4 rounded-2xl border border-[color:color-mix(in_srgb,#ef4444_34%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,#ef4444_10%,var(--theme-surface-card))] px-4 py-3 text-sm leading-6 text-[color:color-mix(in_srgb,#ef4444_72%,var(--theme-text-primary))]">
            {{ queryError }}
          </div>

          <div class="pacs-result-layout grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(420px,1fr)_minmax(360px,430px)]">
            <section class="pacs-result-section min-h-0 min-w-0 overflow-hidden">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '检查' : 'Studies' }}</div>
                <div class="flex items-center gap-2">
                  <button type="button" class="pacs-page-button" :disabled="!hasPreviousStudyPage || isQueryingStudies" @click="queryPreviousStudyPage">
                    <AppIcon name="chevron-left" :size="14" />
                  </button>
                  <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ studyPageLabel }}</span>
                  <button type="button" class="pacs-page-button" :disabled="!hasNextStudyPage || isQueryingStudies" @click="queryNextStudyPage">
                    <AppIcon name="chevron-right" :size="14" />
                  </button>
                </div>
              </div>
              <div v-if="!studies.length" class="pacs-empty-state grid place-items-center rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-6 text-center text-sm leading-6 text-[var(--theme-text-secondary)]">
                {{ isZh ? '设置查询条件后，点击“查询检查”。' : 'Set filters, then query studies.' }}
              </div>
              <div v-else class="pacs-scroll-list pacs-study-list grid gap-2.5 pr-1">
                <button
                  v-for="study in studies"
                  :key="study.studyInstanceUid"
                  type="button"
                  class="pacs-result-card pacs-study-card rounded-[20px] border px-4 py-3 text-left transition"
                  :class="isStudySelected(study) ? 'pacs-result-card--active' : 'pacs-result-card--inactive'"
                  @click="querySeries(study)"
                >
                  <div class="flex min-h-0 items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm font-semibold" :class="isStudySelected(study) ? 'text-[var(--theme-active-foreground)]' : 'text-[var(--theme-text-primary)]'" :title="formatStudyTitle(study)">{{ formatStudyTitle(study) }}</div>
                      <div class="mt-1 truncate text-xs leading-5" :class="isStudySelected(study) ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-secondary)]'" :title="formatStudyMeta(study)">{{ formatStudyMeta(study) }}</div>
                      <div class="pacs-mono pacs-single-line mt-1 font-mono text-[11px]" :class="isStudySelected(study) ? 'text-[var(--theme-active-foreground-muted)]' : 'text-[var(--theme-text-muted)]'" :title="study.studyInstanceUid">{{ study.studyInstanceUid }}</div>
                    </div>
                    <AppIcon name="chevron-right" :size="18" :class="isStudySelected(study) ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-secondary)]'" />
                  </div>
                </button>
              </div>
            </section>

            <section class="pacs-result-section min-h-0 min-w-0 overflow-hidden">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '序列' : 'Series' }}</div>
                <div class="flex items-center gap-2">
                  <button type="button" class="pacs-page-button" :disabled="!hasPreviousSeriesPage || isQueryingSeries" @click="queryPreviousSeriesPage">
                    <AppIcon name="chevron-left" :size="14" />
                  </button>
                  <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ seriesPageLabel }}</span>
                  <button type="button" class="pacs-page-button" :disabled="!hasNextSeriesPage || isQueryingSeries" @click="queryNextSeriesPage">
                    <AppIcon name="chevron-right" :size="14" />
                  </button>
                </div>
              </div>
              <div v-if="!selectedStudy" class="pacs-empty-state grid place-items-center rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-6 text-center text-sm leading-6 text-[var(--theme-text-secondary)]">
                {{ isZh ? '选择一个检查后查看序列。' : 'Select a study to view series.' }}
              </div>
              <div v-else class="pacs-series-panel flex flex-col rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-3">
                <div class="mb-3 border-b border-[var(--theme-border-soft)] px-2 pb-3">
                  <div class="truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ formatStudyTitle(selectedStudy) }}</div>
                  <div class="mt-1 truncate text-xs text-[var(--theme-text-secondary)]">{{ selectedStudy.studyDate || '--' }}</div>
                </div>
                <div v-if="isQueryingSeries" class="pacs-series-state px-2 py-10 text-center text-sm text-[var(--theme-text-secondary)]">{{ isZh ? '正在查询序列...' : 'Querying series...' }}</div>
                <div v-else-if="!seriesItems.length" class="pacs-series-state px-2 py-10 text-center text-sm text-[var(--theme-text-secondary)]">{{ isZh ? '没有返回序列。' : 'No series returned.' }}</div>
                <div v-else class="pacs-scroll-list pacs-series-list grid gap-2 pr-1">
                  <div
                    v-for="series in seriesItems"
                    :key="series.seriesInstanceUid"
                    class="pacs-series-card min-w-0 rounded-2xl border px-3 py-3"
                    :class="{
                      'pacs-series-card--active': isSeriesActive(series),
                      'pacs-series-card--downloaded': isSeriesDownloaded(series),
                      'pacs-series-card--with-preview': Boolean(getSeriesPreview(series) || getSeriesPreviewError(series))
                    }"
                    :aria-current="isSeriesActive(series) ? 'true' : undefined"
                    :aria-busy="previewLoadingSeriesUid === getSeriesUid(series) || downloadingSeriesUid === getSeriesUid(series) ? 'true' : undefined"
                    role="group"
                  >
                    <div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-center gap-2">
                          <div
                            class="min-w-0 flex-1 truncate text-sm font-semibold"
                            :class="isSeriesActive(series) ? 'text-[var(--theme-active-foreground)]' : 'text-[var(--theme-text-primary)]'"
                            :title="series.seriesDescription || series.seriesInstanceUid"
                          >
                            {{ series.seriesDescription || series.seriesInstanceUid }}
                          </div>
                          <span v-if="isSeriesDownloaded(series)" class="pacs-downloaded-badge">
                            <AppIcon name="check" :size="12" />
                            {{ isZh ? '已下载' : 'Downloaded' }}
                          </span>
                        </div>
                        <div
                          class="mt-1 truncate text-xs leading-5"
                          :class="isSeriesActive(series) ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-secondary)]'"
                          :title="formatSeriesMeta(series)"
                        >
                          {{ formatSeriesMeta(series) }}
                        </div>
                        <div
                          class="pacs-mono pacs-single-line mt-1 font-mono text-[11px]"
                          :class="isSeriesActive(series) ? 'text-[var(--theme-active-foreground-muted)]' : 'text-[var(--theme-text-muted)]'"
                          :title="series.seriesInstanceUid"
                        >
                          {{ series.seriesInstanceUid }}
                        </div>
                      </div>
                      <div class="pacs-series-actions flex shrink-0 flex-wrap justify-end gap-2">
                        <VBtn
                          v-if="!isSelectedProfileDimse"
                          variant="flat"
                          class="h-9! shrink-0 rounded-xl! border! px-3! text-[11px]! font-semibold!"
                          :class="getSeriesPreview(series) ? 'theme-button-secondary' : 'theme-button-primary'"
                          :disabled="Boolean(previewLoadingSeriesUid) || Boolean(downloadingSeriesUid)"
                          @click.stop="previewSeries(series)"
                        >
                          <span class="mr-1 inline-flex"><AppIcon name="info" :size="15" /></span>
                          {{ previewLoadingSeriesUid === getSeriesUid(series) ? (isZh ? '预览中' : 'Previewing') : (isZh ? '预览' : 'Preview') }}
                        </VBtn>
                        <VBtn
                          v-if="downloadingSeriesUid === getSeriesUid(series)"
                          variant="flat"
                          class="theme-button-secondary h-9! shrink-0 rounded-xl! border! px-3! text-[11px]! font-semibold!"
                          :disabled="isCancellingDownload"
                          @click.stop="cancelActiveDownload"
                        >
                          <span class="mr-1 inline-flex"><AppIcon name="stop" :size="15" /></span>
                          {{ isCancellingDownload ? (isZh ? '取消中' : 'Cancelling') : (isZh ? '取消' : 'Cancel') }}
                        </VBtn>
                        <VBtn
                          v-else
                          variant="flat"
                          class="h-9! shrink-0 rounded-xl! border! px-3! text-[11px]! font-semibold!"
                          :class="isSeriesDownloaded(series) ? 'theme-button-secondary' : 'theme-button-primary'"
                          :disabled="Boolean(downloadingSeriesUid)"
                          @click.stop="handleSeriesAction(series)"
                        >
                          <span class="mr-1 inline-flex"><AppIcon :name="isSeriesDownloaded(series) ? 'check' : 'folder-import'" :size="15" /></span>
                          {{ isSeriesDownloaded(series) ? (isZh ? '打开' : 'Open') : (isZh ? '下载打开' : 'Download') }}
                        </VBtn>
                      </div>
                    </div>
                    <div v-if="getSeriesPreview(series)" class="pacs-preview mt-3 grid gap-3 rounded-xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                      <div class="pacs-preview-thumb grid place-items-center overflow-hidden rounded-lg border border-[var(--theme-border-soft)] bg-black/30">
                        <img v-if="getSeriesPreview(series)?.thumbnailSrc" :src="getSeriesPreview(series)?.thumbnailSrc ?? ''" alt="" class="h-full w-full object-contain" />
                        <AppIcon v-else name="info" :size="22" class="text-[var(--theme-text-muted)]" />
                      </div>
                      <div class="min-w-0">
                        <div class="truncate text-xs font-semibold text-[var(--theme-text-primary)]" :title="formatSeriesPreviewSummary(getSeriesPreview(series))">{{ formatSeriesPreviewSummary(getSeriesPreview(series)) }}</div>
                        <div v-if="getSeriesPreview(series)?.thumbnailError" class="pacs-preview-error mt-1 text-[11px] leading-5 text-[var(--theme-text-muted)]">
                          {{ getSeriesPreview(series)?.thumbnailError }}
                        </div>
                        <div class="mt-2 grid gap-1 text-[11px] leading-5 text-[var(--theme-text-secondary)]">
                          <div>{{ isZh ? '实例数' : 'Instances' }}: {{ getSeriesPreview(series)?.instanceCount ?? 0 }}</div>
                          <div>{{ isZh ? '尺寸' : 'Size' }}: {{ getSeriesPreview(series)?.columns || '--' }} x {{ getSeriesPreview(series)?.rows || '--' }}</div>
                          <div class="truncate" :title="getSeriesPreview(series)?.transferSyntaxes?.join(', ') || '--'">{{ isZh ? '传输语法' : 'Transfer Syntax' }}: {{ getSeriesPreview(series)?.transferSyntaxes?.join(', ') || '--' }}</div>
                        </div>
                      </div>
                    </div>
                    <div v-if="getSeriesPreviewError(series)" class="mt-2 rounded-xl border border-[var(--theme-status-danger-border)] bg-[var(--theme-status-danger-surface)] px-3 py-2 text-xs leading-5 text-[var(--theme-status-danger-text)]">
                      {{ getSeriesPreviewError(series) }}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  </VDialog>
</template>

<style scoped>
.pacs-browser-dialog {
  color: var(--theme-text-primary);
}

.pacs-dialog-close-button {
  border: 1px solid var(--theme-border-soft) !important;
  background: var(--theme-surface-card) !important;
  color: var(--theme-text-secondary) !important;
  box-shadow: none !important;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease,
    color 150ms ease,
    transform 120ms ease;
}

.pacs-dialog-close-button:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-strong)) !important;
  background: color-mix(in srgb, var(--theme-accent) 10%, var(--theme-surface-card)) !important;
  color: var(--theme-text-primary) !important;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 16%, transparent) !important;
}

.pacs-dialog-close-button:active {
  transform: translateY(1px);
  border-color: color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-strong)) !important;
  background: var(--theme-active-surface-soft) !important;
  color: var(--theme-active-foreground) !important;
}

.pacs-dialog-close-button :deep(.v-btn__overlay),
.pacs-dialog-close-button :deep(.v-btn__underlay) {
  background: transparent !important;
  opacity: 0 !important;
}

.pacs-browser-body {
  height: min(78vh, 760px);
  max-height: calc(100vh - 112px);
  min-height: min(560px, calc(100vh - 112px));
}

.pacs-browser-main {
  display: flex;
  flex-direction: column;
}

.pacs-filter-panel {
  display: flex;
  flex-direction: column;
  background: var(--theme-surface-panel);
  overflow: hidden;
}

.pacs-filter-scroll {
  min-height: 0;
  flex: 1 1 auto;
  gap: 12px !important;
  overflow: auto;
  padding: 18px !important;
  scrollbar-gutter: auto;
}

.pacs-filter-scroll--advanced-open {
  overflow: auto;
  padding-bottom: 22px !important;
  scrollbar-gutter: stable;
}

.pacs-filter-footer {
  flex: 0 0 auto;
  background: var(--theme-surface-panel);
  box-shadow: 0 -16px 34px color-mix(in srgb, var(--theme-surface-panel-solid) 36%, transparent);
}

.pacs-result-layout {
  flex: 1 1 0;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
}

.pacs-result-section,
.pacs-empty-state,
.pacs-series-panel,
.pacs-series-state,
.pacs-scroll-list {
  min-height: 0;
}

.pacs-result-section,
.pacs-series-panel {
  display: flex;
  flex-direction: column;
}

.pacs-empty-state,
.pacs-series-panel,
.pacs-series-state,
.pacs-scroll-list {
  flex: 1 1 0;
}

.pacs-scroll-list {
  align-content: start;
  align-items: start;
  grid-auto-rows: max-content;
  overflow: auto;
  scrollbar-gutter: stable;
}

.pacs-filter-scroll,
.pacs-scroll-list {
  scrollbar-color: color-mix(in srgb, var(--theme-scroll-thumb-start) 78%, var(--theme-scroll-thumb-end)) var(--theme-scroll-track);
  scrollbar-width: thin;
}

.pacs-filter-scroll:not(.pacs-filter-scroll--advanced-open) {
  scrollbar-width: none;
}

.pacs-filter-scroll::-webkit-scrollbar,
.pacs-scroll-list::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.pacs-filter-scroll:not(.pacs-filter-scroll--advanced-open)::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.pacs-filter-scroll::-webkit-scrollbar-track,
.pacs-scroll-list::-webkit-scrollbar-track {
  border-radius: 999px;
  background: var(--theme-scroll-track);
}

.pacs-filter-scroll::-webkit-scrollbar-thumb,
.pacs-scroll-list::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--theme-scroll-thumb-start), var(--theme-scroll-thumb-end)) padding-box;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 14%, transparent);
}

@media (min-width: 1280px) {
  .pacs-result-layout {
    grid-template-rows: minmax(0, 1fr);
  }
}

.pacs-field-label {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pacs-input {
  min-height: 42px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: var(--theme-surface-card);
  padding: 0 12px;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 600;
  outline: none;
}

.pacs-input:focus {
  border-color: color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-strong));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 24%, transparent);
}

.pacs-page-button {
  display: grid;
  height: 26px;
  width: 26px;
  place-items: center;
  border: 1px solid var(--theme-border-soft);
  border-radius: 999px;
  background: var(--theme-surface-card);
  color: var(--theme-text-secondary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.pacs-page-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 10%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.pacs-page-button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.pacs-limit-options {
  min-height: 42px;
}

.pacs-limit-option {
  min-width: 0;
  min-height: 42px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background: var(--theme-surface-card);
  color: var(--theme-text-secondary);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease,
    color 150ms ease;
}

.pacs-limit-option:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 32%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-surface-card-soft));
  color: var(--theme-text-primary);
}

.pacs-limit-option--active {
  border-color: var(--theme-active-border);
  background: var(--theme-active-surface-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 26%, transparent);
  color: var(--theme-active-foreground);
}

.pacs-advanced-filter-section {
  overflow: hidden;
  min-height: 56px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 18px;
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  transition:
    background 160ms ease,
    min-height 190ms ease;
}

.pacs-advanced-filter-section--open {
  min-height: 438px;
  background: color-mix(in srgb, var(--theme-surface-card) 86%, transparent);
}

.pacs-advanced-filter-trigger {
  display: flex;
  min-height: 54px;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 800;
  text-align: left;
  transition:
    background 150ms ease,
    color 150ms ease;
}

.pacs-advanced-filter-trigger:hover {
  background: color-mix(in srgb, var(--theme-accent) 7%, transparent);
}

.pacs-advanced-filter-icon {
  display: grid;
  height: 28px;
  width: 28px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--theme-border-soft);
  border-radius: 10px;
  color: var(--theme-text-secondary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    transform 180ms ease;
}

.pacs-advanced-filter-icon--open {
  border-color: color-mix(in srgb, var(--theme-accent) 36%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 11%, transparent);
  color: var(--theme-active-foreground);
  transform: rotate(180deg);
}

.pacs-advanced-filter-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 190ms ease;
}

.pacs-advanced-filter-body--open {
  grid-template-rows: 1fr;
}

.pacs-advanced-filter-content {
  min-height: 0;
  overflow: hidden;
  padding: 0 14px;
  transition:
    padding-bottom 190ms ease,
    padding-top 190ms ease;
}

.pacs-advanced-filter-body--open .pacs-advanced-filter-content {
  padding-top: 4px;
  padding-bottom: 14px;
}

.pacs-preview-thumb {
  aspect-ratio: 1;
  min-height: 86px;
}

.pacs-preview-error {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.pacs-date-control {
  position: relative;
  min-width: 0;
}

.pacs-date-trigger {
  display: flex;
  min-height: 42px;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: var(--theme-surface-card);
  padding: 0 12px;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 600;
  outline: none;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease,
    color 150ms ease;
}

.pacs-date-trigger:hover,
.pacs-date-trigger--active {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

.pacs-date-trigger:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-strong));
  box-shadow: var(--theme-focus-ring);
}

.pacs-date-trigger--empty {
  color: var(--theme-text-muted);
}

.pacs-date-trigger--has-value {
  padding-right: 38px;
}

.pacs-date-trigger span {
  min-width: 0;
  max-width: 100%;
}

.pacs-date-clear {
  position: absolute;
  top: 50%;
  right: 10px;
  display: grid;
  height: 20px;
  width: 20px;
  transform: translateY(-50%);
  place-items: center;
  border-radius: 999px;
  color: var(--theme-text-muted);
  transition:
    background 150ms ease,
    color 150ms ease;
}

.pacs-date-clear:hover {
  background: color-mix(in srgb, var(--theme-accent) 11%, transparent);
  color: var(--theme-text-primary);
}

.pacs-date-picker {
  background: var(--theme-surface-panel-strong);
  color: var(--theme-text-primary);
}

:deep(.pacs-vuetify-field .v-field) {
  min-height: 42px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: var(--theme-surface-card);
  color: var(--theme-text-primary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease;
}

:deep(.pacs-vuetify-field .v-field:hover) {
  border-color: color-mix(in srgb, var(--theme-accent) 32%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 6%, var(--theme-surface-card));
}

:deep(.pacs-vuetify-field .v-field.v-field--focused) {
  border-color: color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-strong));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 24%, transparent);
}

:deep(.pacs-vuetify-field .v-field__outline) {
  color: transparent;
}

:deep(.pacs-vuetify-field .v-field__input) {
  min-height: 40px;
  align-items: center;
  padding: 0 12px;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 600;
}

:deep(.pacs-vuetify-field .v-field__input input) {
  min-height: 0;
  padding: 0;
  background: transparent !important;
  color: var(--theme-text-primary);
  font: inherit;
  line-height: 1.35;
}

:deep(.pacs-vuetify-field .v-field__clearable),
:deep(.pacs-vuetify-field .v-field__append-inner),
:deep(.pacs-vuetify-field .v-icon) {
  color: var(--theme-text-secondary);
}

:global(.pacs-date-menu .v-overlay__content),
:global(.pacs-date-menu),
:global(.pacs-vuetify-menu .v-overlay__content),
:global(.pacs-vuetify-menu) {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  border-radius: 18px;
  background: var(--theme-surface-panel-strong);
  color: var(--theme-text-primary);
  box-shadow: 0 22px 52px rgba(0, 0, 0, 0.42);
}

:global(.pacs-date-menu .v-picker),
:global(.pacs-date-menu .v-date-picker),
:global(.pacs-vuetify-menu .v-list) {
  background: var(--theme-surface-panel-strong);
  color: var(--theme-text-primary);
}

:global(.pacs-vuetify-menu .v-list-item) {
  min-height: 38px;
  color: var(--theme-text-secondary);
}

:global(.pacs-vuetify-menu .v-list-item:hover) {
  background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
  color: var(--theme-text-primary);
}

:global(.pacs-vuetify-menu .v-list-item--active) {
  background: var(--theme-active-surface-soft);
  color: var(--theme-active-foreground);
}

:global(.pacs-date-menu .v-date-picker-month__day--selected .v-btn) {
  background: color-mix(in srgb, var(--theme-accent) 74%, var(--theme-surface-card)) !important;
  color: var(--theme-accent-contrast) !important;
}

:global(.pacs-date-menu .v-picker-title) {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-panel-strong)),
      color-mix(in srgb, var(--theme-accent-warm) 8%, var(--theme-surface-panel-strong))
    ) !important;
  color: var(--theme-text-primary) !important;
  font-size: 13px !important;
  font-weight: 800 !important;
}

:global(.pacs-date-menu .v-date-picker-header) {
  display: none !important;
}

:global(.pacs-date-menu .v-date-picker-header__content) {
  display: none !important;
}

:global(.pacs-date-menu .v-date-picker-controls) {
  background: var(--theme-surface-panel-strong) !important;
  color: var(--theme-text-primary) !important;
}

:global(.pacs-date-menu .v-date-picker-controls .v-btn),
:global(.pacs-date-menu .v-date-picker-header .v-btn) {
  color: var(--theme-text-secondary) !important;
}

:global(.pacs-date-menu .v-date-picker-controls .v-btn:hover),
:global(.pacs-date-menu .v-date-picker-header .v-btn:hover) {
  background: color-mix(in srgb, var(--theme-accent) 11%, transparent) !important;
  color: var(--theme-text-primary) !important;
}

:global(.pacs-date-menu .v-date-picker-month) {
  background: var(--theme-surface-panel-strong) !important;
  color: var(--theme-text-primary) !important;
  padding: 0 18px 18px !important;
}

:global(.pacs-date-menu .v-date-picker-month__weekday) {
  color: var(--theme-text-muted) !important;
  font-size: 12px !important;
  font-weight: 800 !important;
}

:global(.pacs-date-menu .v-btn__overlay) {
  background: transparent !important;
  opacity: 0 !important;
}

:global(.pacs-date-menu .v-date-picker-month__day .v-btn) {
  border: 1px solid transparent !important;
  background: transparent !important;
  color: var(--theme-text-primary) !important;
  font-weight: 700 !important;
}

:global(.pacs-date-menu .v-date-picker-month__day:not(.v-date-picker-month__day--selected) .v-btn:not(.v-btn--disabled):hover) {
  border-color: color-mix(in srgb, var(--theme-accent) 34%, transparent) !important;
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent) !important;
  color: var(--theme-text-primary) !important;
}

:global(.pacs-date-menu .v-date-picker-month__day--current:not(.v-date-picker-month__day--selected) .v-btn) {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, transparent) !important;
  color: var(--theme-active-foreground) !important;
}

:global(.pacs-date-menu .v-date-picker-month__day--selected .v-btn),
:global(.pacs-date-menu .v-date-picker-month__day--selected .v-btn:hover),
:global(.pacs-date-menu .v-date-picker-month__day--selected.v-date-picker-month__day--current .v-btn) {
  border-color: color-mix(in srgb, var(--theme-accent) 76%, var(--theme-border-strong)) !important;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 84%, var(--theme-surface-card)),
      color-mix(in srgb, var(--theme-accent) 64%, var(--theme-accent-warm))
    ) !important;
  color: var(--theme-accent-contrast) !important;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--theme-accent) 22%, transparent) !important;
}

:global(.pacs-date-menu .v-date-picker-month__day--adjacent .v-btn),
:global(.pacs-date-menu .v-date-picker-month__day .v-btn--disabled) {
  background: transparent !important;
  color: var(--theme-text-muted) !important;
  opacity: 0.44 !important;
}

:global(.pacs-date-menu .v-date-picker-month__day--adjacent .v-btn:hover),
:global(.pacs-date-menu .v-date-picker-month__day .v-btn--disabled:hover) {
  border-color: transparent !important;
  background: transparent !important;
  color: var(--theme-text-muted) !important;
}

.pacs-select-trigger {
  display: flex;
  min-height: 42px;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: var(--theme-surface-card);
  padding: 0 12px;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 600;
  outline: none;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease,
    color 150ms ease;
}

.pacs-select-trigger:hover,
.pacs-select-trigger--open {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

.pacs-select-trigger:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-strong));
  box-shadow: var(--theme-focus-ring);
}

.pacs-select-trigger:disabled {
  cursor: not-allowed;
  color: var(--theme-text-muted);
  opacity: 0.72;
}

.pacs-select-trigger :deep(.app-icon-svg) {
  transition: transform 150ms ease;
}

.pacs-select-trigger--open :deep(.app-icon-svg) {
  transform: rotate(180deg);
}

.pacs-select-menu {
  display: grid;
  width: min(290px, calc(100vw - 48px));
  gap: 4px;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--theme-border-strong) 74%, transparent) !important;
  border-radius: 18px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface-card) 92%, white 4%),
      color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 6%)
    );
  padding: 6px;
  box-shadow:
    0 24px 52px rgba(2, 8, 18, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
}

.pacs-select-option {
  position: relative;
  display: flex;
  min-height: 38px;
  width: 100%;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  padding: 0 10px 0 12px;
  color: var(--theme-text-secondary);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.pacs-select-option:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 20%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
  color: var(--theme-text-primary);
}

.pacs-select-option--active {
  color: var(--theme-active-foreground);
}

.pacs-select-option__rail {
  position: absolute;
  inset: 9px auto 9px 0;
  width: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 80%, white 8%);
  opacity: 0;
}

.pacs-select-option--active .pacs-select-option__rail {
  opacity: 0.72;
}

.pacs-mono {
  overflow-wrap: anywhere;
}

.pacs-single-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pacs-result-card {
  position: relative;
  overflow: hidden;
}

.pacs-study-card {
  min-height: 86px;
  max-height: 112px;
}

.pacs-result-card--inactive {
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-card);
  color: var(--theme-text-secondary);
}

.pacs-result-card--inactive:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 32%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-surface-card-soft));
}

.pacs-result-card--active {
  border-color: var(--theme-active-border);
  background: var(--theme-active-surface-soft);
  box-shadow: var(--theme-active-shadow-soft);
}

.pacs-result-card--active::before {
  position: absolute;
  inset: 9px auto 9px 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--theme-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--theme-accent) 34%, transparent);
  content: "";
}

.pacs-series-card {
  position: relative;
  min-height: 104px;
  max-height: 136px;
  overflow: hidden;
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-panel);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease;
}

.pacs-series-card--with-preview {
  max-height: 330px;
}

.pacs-series-card:hover:not(.pacs-series-card--active),
.pacs-series-card:focus-within:not(.pacs-series-card--active) {
  border-color: color-mix(in srgb, var(--theme-accent) 32%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card-soft));
}

.pacs-series-card:focus-within {
  box-shadow: var(--theme-focus-ring);
}

.pacs-series-card--downloaded:not(.pacs-series-card--active) {
  border-color: var(--theme-status-success-border);
  background:
    linear-gradient(
      0deg,
      color-mix(in srgb, var(--theme-status-success) 8%, transparent),
      color-mix(in srgb, var(--theme-status-success) 8%, transparent)
    ),
    var(--theme-surface-panel);
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--theme-status-success) 68%, transparent);
}

.pacs-series-card--active {
  border-color: var(--theme-active-border);
  background: var(--theme-active-surface-soft);
  box-shadow: var(--theme-active-shadow-soft);
}

.pacs-series-card--active::before {
  position: absolute;
  inset: 9px auto 9px 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--theme-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--theme-accent) 34%, transparent);
  content: "";
}

.pacs-series-card--active .pacs-preview {
  border-color: color-mix(in srgb, var(--theme-active-border) 78%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card));
}

.pacs-series-actions {
  max-width: 100%;
}

@media (max-width: 640px) {
  .pacs-series-card {
    max-height: 190px;
  }

  .pacs-series-card--with-preview {
    max-height: 430px;
  }

  .pacs-series-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

.pacs-downloaded-badge {
  display: inline-flex;
  min-height: 20px;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--theme-status-success-border);
  border-radius: 999px;
  background: var(--theme-status-success-surface);
  padding: 0 7px;
  color: var(--theme-status-success-text);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
