<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VBtn, VDialog, VLocaleProvider, VMenu } from 'vuetify/components'
import { VDateInput } from 'vuetify/labs/VDateInput'
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
  cancelPacsWadoSeriesDownloadJob,
  getPacsWadoSeriesDownloadJob,
  postApi,
  postPacsSeriesPreview,
  postPacsWadoSeriesDownloadJob,
  type LoadFolderResponse,
  type PacsSeriesPreviewResponse,
  type PacsWadoSeriesDownloadJob
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

const PACS_LIMIT_MIN = 1
const PACS_LIMIT_MAX = 200
const PACS_LIMIT_DEFAULT = 50
const PACS_LIMIT_PRESETS = [25, 50, 100, 200]
const PACS_SERIES_LIMIT = 200

const { locale } = useUiLocale()
const { pacsPreference } = useUiPreferences()

const isQueryingStudies = ref(false)
const isQueryingSeries = ref(false)
const queryError = ref('')
const isProfileMenuOpen = ref(false)
const isAdvancedFiltersOpen = ref(false)
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
const downloadingSeriesUid = ref('')
const activeDownloadJobId = ref('')
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
const selectedProfileLabel = computed(() => selectedProfile.value?.name ?? (isZh.value ? '未选择 Profile' : 'No profile selected'))
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
  started: isZh.value ? 'PACS Series 下载任务已开始，完成后会打开影像。' : 'PACS series download started. The series will open when ready.',
  preparing: isZh.value ? '正在准备 PACS 下载...' : 'Preparing PACS download...',
  packaging: isZh.value ? 'DICOM 已下载，正在注册序列...' : 'DICOM downloaded, registering series...',
  progress: (processed: number, total: number, percent: number) => (
    isZh.value ? `已下载 ${processed}/${total} (${percent}%)` : `Downloaded ${processed}/${total} (${percent}%)`
  )
}))

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return
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

function toggleAdvancedFilters(): void {
  isAdvancedFiltersOpen.value = !isAdvancedFiltersOpen.value
}

function parsePacsDateValue(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

function formatPacsDateValue(value: unknown): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value as string | number)
  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeLimitValue(value: unknown): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return PACS_LIMIT_DEFAULT
  }
  return Math.min(PACS_LIMIT_MAX, Math.max(PACS_LIMIT_MIN, Math.trunc(numericValue)))
}

function setLimitValue(value: unknown): void {
  limit.value = normalizeLimitValue(value)
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

function formatStudyMeta(study: PacsStudyItem): string {
  return [
    study.patientName,
    study.patientId,
    study.studyDate,
    study.modalitiesInStudy?.join('/'),
    study.numberOfStudyRelatedSeries ? `${study.numberOfStudyRelatedSeries} series` : null,
    study.numberOfStudyRelatedInstances ? `${study.numberOfStudyRelatedInstances} images` : null
  ].filter(Boolean).join(' · ')
}

function formatSeriesMeta(series: PacsSeriesItem): string {
  return [
    series.modality,
    series.seriesNumber ? `#${series.seriesNumber}` : null,
    series.numberOfSeriesRelatedInstances ? `${series.numberOfSeriesRelatedInstances} images` : null,
    series.bodyPartExamined
  ].filter(Boolean).join(' · ')
}

async function queryStudies(offset = 0): Promise<void> {
  const profile = selectedProfile.value
  if (!profile) {
    queryError.value = isZh.value ? '请先在设置中启用一个 PACS Profile。' : 'Enable a PACS profile in settings first.'
    return
  }

  isQueryingStudies.value = true
  queryError.value = ''
  selectedStudyUid.value = ''
  seriesItems.value = []
  seriesOffset.value = 0
  seriesPreviewByUid.value = {}
  seriesPreviewErrorsByUid.value = {}
  try {
    const normalizedLimit = normalizeLimitValue(limit.value)
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
  const uid = series.seriesInstanceUid?.trim()
  return uid ? seriesPreviewByUid.value[uid] ?? null : null
}

function getSeriesPreviewError(series: PacsSeriesItem): string {
  const uid = series.seriesInstanceUid?.trim()
  return uid ? seriesPreviewErrorsByUid.value[uid] ?? '' : ''
}

function formatSeriesPreviewSummary(preview: PacsSeriesPreviewResponse | null | undefined): string {
  if (!preview) {
    return ''
  }

  return [
    preview.instanceCount ? `${preview.instanceCount} images` : null,
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
  const seriesUid = series.seriesInstanceUid?.trim()
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

function buildDownloadedLoadResponse(job: PacsWadoSeriesDownloadJob): LoadFolderResponse | null {
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
  const uid = series.seriesInstanceUid?.trim()
  return uid ? downloadedSeriesByUid.value.get(uid) ?? null : null
}

function isSeriesDownloaded(series: PacsSeriesItem): boolean {
  return Boolean(getDownloadedSeries(series))
}

function openDownloadedSeries(series: PacsSeriesItem): void {
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
    isZh.value ? '该 PACS Series 已下载，已打开已有序列。' : 'This PACS series is already downloaded. Opened the existing series.',
    'info',
    {
      durationMs: 3600,
      progressLabel: isZh.value ? '已下载' : 'Downloaded',
      progressPercent: 100
    }
  )
}

async function handleSeriesAction(series: PacsSeriesItem): Promise<void> {
  if (isSeriesDownloaded(series)) {
    openDownloadedSeries(series)
    return
  }

  if (selectedProfile.value?.protocol === 'dimse') {
    dispatchWorkspaceStatusToast(
      isZh.value ? 'DIMSE 下载需要配置本机接收端口，下一步会接入 C-MOVE/C-GET。' : 'DIMSE download needs a local receiver port; C-MOVE/C-GET support is next.',
      'info',
      { durationMs: 5200 }
    )
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
    await cancelPacsWadoSeriesDownloadJob(jobId)
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
  if (!profile || !series.studyInstanceUid || !series.seriesInstanceUid || downloadingSeriesUid.value) {
    return
  }
  if (profile.protocol === 'dimse') {
    return
  }

  downloadingSeriesUid.value = series.seriesInstanceUid
  queryError.value = ''
  try {
    const initialJob = await postPacsWadoSeriesDownloadJob({
      profile: toApiPacsDicomwebProfile(profile),
      studyInstanceUid: series.studyInstanceUid,
      seriesInstanceUid: series.seriesInstanceUid
    })
    activeDownloadJobId.value = initialJob.jobId
    showDicomJobProgressToast(initialJob, pacsDownloadCopy.value)

    const finishedJob = await waitForDicomJob(initialJob, getPacsWadoSeriesDownloadJob, {
      timeoutMessage: isZh.value ? 'PACS 下载任务等待超时' : 'PACS download job timed out',
      onProgress: (job) => showDicomJobProgressToast(job, pacsDownloadCopy.value)
    })

    if (finishedJob.status === 'failed') {
      throw new Error(finishedJob.error || (isZh.value ? 'PACS Series 下载失败' : 'PACS series download failed'))
    }

    if (finishedJob.status === 'cancelled') {
      dispatchWorkspaceStatusToast(isZh.value ? 'PACS 下载任务已取消' : 'PACS download cancelled', 'info', {
        durationMs: 3600
      })
      return
    }

    const loadResponse = buildDownloadedLoadResponse(finishedJob)
    if (!loadResponse) {
      throw new Error(isZh.value ? 'PACS Series 已下载，但没有可打开的 DICOM 序列。' : 'PACS series downloaded, but no readable series was returned.')
    }

    emit('seriesLoaded', loadResponse)
    emit('close')
    const loadedSeriesCount = loadResponse.seriesList?.length ?? 0
    dispatchWorkspaceStatusToast(isZh.value ? 'PACS Series 已下载并打开' : 'PACS series downloaded and opened', 'success', {
      durationMs: 3600,
      progressLabel: `${loadedSeriesCount} series`,
      progressPercent: 100
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : (isZh.value ? 'PACS Series 下载失败' : 'PACS series download failed')
    queryError.value = message
    dispatchWorkspaceStatusToast(message, 'error', { durationMs: 6000 })
  } finally {
    downloadingSeriesUid.value = ''
    activeDownloadJobId.value = ''
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
              <div class="text-xl font-semibold">PACS Browser</div>
              <div class="mt-1 text-sm leading-6 text-[var(--theme-text-secondary)]">
                {{ isZh ? '通过 DICOMweb QIDO 查询检查和序列。' : 'Query studies and series through DICOMweb QIDO.' }}
              </div>
            </div>
          </div>
        </div>
        <VBtn class="h-11! w-11! min-w-0! rounded-2xl! border! border-[var(--theme-border-soft)]! bg-[var(--theme-surface-card)]! text-[var(--theme-text-secondary)]!" variant="flat" @click="emit('close')">
          <AppIcon name="close" :size="22" />
        </VBtn>
      </div>

      <div class="pacs-browser-body grid gap-0 overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside class="pacs-filter-panel min-h-0 border-b border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] lg:border-b-0 lg:border-r">
          <div class="pacs-filter-scroll flex flex-col gap-4 p-5">
            <div class="grid gap-1.5">
              <span class="pacs-field-label">Profile</span>
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
              <span class="pacs-field-label">Patient ID</span>
              <input v-model="patientId" class="pacs-input" placeholder="ID..." @keydown.enter="queryStudyFirstPage" />
            </label>
            <label class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '检查号' : 'Accession Number' }}</span>
              <input v-model="accessionNumber" class="pacs-input" placeholder="ACC..." @keydown.enter="queryStudyFirstPage" />
            </label>
            <label class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '模态' : 'Modality' }}</span>
              <input v-model="modality" class="pacs-input" placeholder="CT / MR / PT" @keydown.enter="queryStudyFirstPage" />
            </label>
            <VLocaleProvider
              :locale="pacsVuetifyLocale"
              fallback-locale="en"
              :messages="pacsVuetifyLocaleMessages"
            >
              <div class="grid grid-cols-2 gap-3">
                <div class="grid gap-1.5">
                  <span class="pacs-field-label">{{ isZh ? '开始日期' : 'From' }}</span>
                  <VDateInput
                    v-model="studyDateFromModel"
                    class="pacs-vuetify-field pacs-date-input"
                    :placeholder="isZh ? '开始日期' : 'From'"
                    :input-format="'yyyy-mm-dd'"
                    :display-format="formatPacsDateValue"
                    :menu-props="{ contentClass: 'pacs-date-menu' }"
                    clearable
                    hide-details
                    variant="outlined"
                    prepend-icon=""
                  />
                </div>
                <div class="grid gap-1.5">
                  <span class="pacs-field-label">{{ isZh ? '结束日期' : 'To' }}</span>
                  <VDateInput
                    v-model="studyDateToModel"
                    class="pacs-vuetify-field pacs-date-input"
                    :placeholder="isZh ? '结束日期' : 'To'"
                    :input-format="'yyyy-mm-dd'"
                    :display-format="formatPacsDateValue"
                    :menu-props="{ contentClass: 'pacs-date-menu' }"
                    clearable
                    hide-details
                    variant="outlined"
                    prepend-icon=""
                  />
                </div>
              </div>
            </VLocaleProvider>
            <div class="grid gap-1.5">
              <span class="pacs-field-label">{{ isZh ? '最多返回' : 'Limit' }}</span>
              <div class="pacs-limit-options grid grid-cols-4 gap-2">
                <button
                  v-for="option in PACS_LIMIT_PRESETS"
                  :key="option"
                  type="button"
                  class="pacs-limit-option"
                  :class="{ 'pacs-limit-option--active': limit === option }"
                  @click="setLimitValue(option)"
                >
                  {{ option }}
                </button>
              </div>
            </div>
            <section
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
                    {{ advancedFilterCount ? (isZh ? `已填写 ${advancedFilterCount} 项` : `${advancedFilterCount} active`) : (isZh ? 'UID、描述、Body Part' : 'UID, descriptions, body part') }}
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
                <div class="pacs-advanced-filter-content grid gap-4">
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">Study UID</span>
                    <input v-model="studyInstanceUid" class="pacs-input" placeholder="1.2.840..." @keydown.enter="queryStudyFirstPage" />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">{{ isZh ? '检查描述' : 'Study Description' }}</span>
                    <input v-model="studyDescription" class="pacs-input" placeholder="Chest / Abdomen..." @keydown.enter="queryStudyFirstPage" />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">Series UID</span>
                    <input v-model="seriesInstanceUid" class="pacs-input" placeholder="1.2.840..." @keydown.enter="querySeriesFirstPage" />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">{{ isZh ? '序列描述' : 'Series Description' }}</span>
                    <input v-model="seriesDescription" class="pacs-input" placeholder="AX / Portal..." @keydown.enter="querySeriesFirstPage" />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="pacs-field-label">Body Part</span>
                    <input v-model="bodyPartExamined" class="pacs-input" placeholder="CHEST / ABDOMEN" @keydown.enter="querySeriesFirstPage" />
                  </label>
                </div>
              </div>
            </section>
          </div>
          <div class="pacs-filter-footer border-t border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] p-4">
            <VBtn
              variant="flat"
              class="theme-button-primary min-h-11! w-full rounded-2xl! border! text-sm! font-semibold!"
              :disabled="!canQuery"
              @click="queryStudyFirstPage"
            >
              {{ isQueryingStudies ? (isZh ? '查询中...' : 'Querying...') : (isZh ? '查询检查' : 'Query Studies') }}
            </VBtn>
            <div v-if="!enabledProfiles.length" class="mt-3 rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm leading-6 text-[var(--theme-text-secondary)]">
              {{ isZh ? '请先在设置中启用 PACS，并至少启用一个 Profile。' : 'Enable PACS and at least one profile in settings first.' }}
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
                  class="pacs-result-card rounded-[20px] border px-4 py-3 text-left transition"
                  :class="isStudySelected(study) ? 'pacs-result-card--active' : 'pacs-result-card--inactive'"
                  @click="querySeries(study)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold" :class="isStudySelected(study) ? 'text-[var(--theme-active-foreground)]' : 'text-[var(--theme-text-primary)]'">{{ formatStudyTitle(study) }}</div>
                      <div class="mt-1 truncate text-xs leading-5" :class="isStudySelected(study) ? 'text-[var(--theme-active-foreground-secondary)]' : 'text-[var(--theme-text-secondary)]'" :title="formatStudyMeta(study)">{{ formatStudyMeta(study) }}</div>
                      <div class="pacs-mono mt-1 font-mono text-[11px]" :class="isStudySelected(study) ? 'text-[var(--theme-active-foreground-muted)]' : 'text-[var(--theme-text-muted)]'" :title="study.studyInstanceUid">{{ study.studyInstanceUid }}</div>
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
                <div v-else class="pacs-scroll-list grid gap-2 pr-1">
                  <div
                    v-for="series in seriesItems"
                    :key="series.seriesInstanceUid"
                    class="pacs-series-card min-w-0 rounded-2xl border px-3 py-3"
                    :class="{ 'pacs-series-card--downloaded': isSeriesDownloaded(series) }"
                  >
                    <div class="flex min-w-0 items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex min-w-0 items-center gap-2">
                          <div class="truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ series.seriesDescription || series.seriesInstanceUid }}</div>
                          <span v-if="isSeriesDownloaded(series)" class="pacs-downloaded-badge">
                            <AppIcon name="check" :size="12" />
                            {{ isZh ? '已下载' : 'Downloaded' }}
                          </span>
                        </div>
                        <div class="mt-1 truncate text-xs leading-5 text-[var(--theme-text-secondary)]">{{ formatSeriesMeta(series) }}</div>
                        <div class="pacs-mono mt-1 font-mono text-[11px] text-[var(--theme-text-muted)]" :title="series.seriesInstanceUid">{{ series.seriesInstanceUid }}</div>
                      </div>
                      <div class="flex shrink-0 flex-wrap justify-end gap-2">
                        <VBtn
                          v-if="!isSelectedProfileDimse"
                          variant="flat"
                          class="h-9! shrink-0 rounded-xl! border! px-3! text-[11px]! font-semibold!"
                          :class="getSeriesPreview(series) ? 'theme-button-secondary' : 'theme-button-primary'"
                          :disabled="Boolean(previewLoadingSeriesUid) || Boolean(downloadingSeriesUid)"
                          @click.stop="previewSeries(series)"
                        >
                          <span class="mr-1 inline-flex"><AppIcon name="info" :size="15" /></span>
                          {{ previewLoadingSeriesUid === series.seriesInstanceUid ? (isZh ? '预览中' : 'Previewing') : (isZh ? '预览' : 'Preview') }}
                        </VBtn>
                        <VBtn
                          v-if="downloadingSeriesUid === series.seriesInstanceUid"
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
                          :class="isSeriesDownloaded(series) || isSelectedProfileDimse ? 'theme-button-secondary' : 'theme-button-primary'"
                          :disabled="Boolean(downloadingSeriesUid)"
                          @click.stop="handleSeriesAction(series)"
                        >
                          <span class="mr-1 inline-flex"><AppIcon :name="isSelectedProfileDimse ? 'info' : isSeriesDownloaded(series) ? 'check' : 'folder-import'" :size="15" /></span>
                          {{ isSelectedProfileDimse ? (isZh ? '仅查询' : 'Query only') : isSeriesDownloaded(series) ? (isZh ? '打开' : 'Open') : (isZh ? '下载打开' : 'Download') }}
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
                          <div class="truncate" :title="getSeriesPreview(series)?.transferSyntaxes?.join(', ') || '--'">Transfer Syntax: {{ getSeriesPreview(series)?.transferSyntaxes?.join(', ') || '--' }}</div>
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

.pacs-browser-body {
  height: min(72vh, 720px);
  max-height: calc(100vh - 150px);
  min-height: min(520px, calc(100vh - 150px));
}

.pacs-browser-main {
  display: flex;
  flex-direction: column;
}

.pacs-filter-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pacs-filter-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  scrollbar-gutter: stable;
}

.pacs-filter-footer {
  flex: 0 0 auto;
  box-shadow: 0 -16px 34px color-mix(in srgb, black 24%, transparent);
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
  overflow: auto;
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
  min-height: 416px;
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
      color-mix(in srgb, var(--theme-surface-panel) 94%, black 6%)
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

.pacs-result-card {
  position: relative;
  overflow: hidden;
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
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-panel);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease;
}

.pacs-series-card--downloaded {
  border-color: var(--theme-status-success-border);
  background: color-mix(in srgb, var(--theme-status-success) 8%, var(--theme-surface-panel));
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--theme-status-success) 68%, transparent);
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
