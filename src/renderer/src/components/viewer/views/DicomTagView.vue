<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { VBtn, VCard, VChip, VDialog, VDivider, VList, VListItem, VMenu, VPagination, VTextarea, VTextField } from 'vuetify/components'
import AppIcon from '../../AppIcon.vue'
import type { DicomTagItem, ViewerTabItem } from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import { openExportLocation, saveBinaryFile, type SaveFilePreference } from '../../../platform/exporting'
import {
  getDicomTagModifyJob,
  getDicomTagModifyJobArtifact,
  postDicomTagModifyArtifact,
  postDicomTagModifyJob,
  type DicomTagModifyJob
} from '../../../services/typedApi'

const props = defineProps<{
  activeTab: ViewerTabItem
}>()

const emit = defineEmits<{
  indexChange: [payload: { tabKey: string; index: number }]
}>()

type ContextAction = 'modify' | 'row' | 'tag' | 'name' | 'value'
type TagEditScope = 'current' | 'series'
interface DicomTagTreeNode {
  id: string
  title: string
  tag: string
  keyword: string
  name: string
  vr: string
  value: string
  searchText: string
  depth: number
  original: DicomTagItem
  children?: DicomTagTreeNode[]
}

interface VisibleDicomTagTreeRow extends DicomTagTreeNode {
  hasChildren: boolean
  isExpanded: boolean
  isMatched: boolean
  level: number
}

const TAG_ROW_HEIGHT = 76
const TAG_OVERSCAN_ROWS = 8
const TAG_TREE_INDENT_PX = 28
const TAG_TREE_MAX_GUIDE_DEPTH = 10
const TAG_EDIT_EXPORT_ROOT = 'DicomVisionTagEdits'
const TAG_EDIT_JOB_POLL_INTERVAL_MS = 700
const TAG_EDIT_JOB_MAX_POLLS = 1500
const TAG_EDIT_JOB_STATUS_TIMEOUT_MS = 8000
const TAG_EDIT_JOB_MAX_STATUS_ERRORS = 3
const EDITABLE_BINARY_VR_VALUES = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'UN'])

const { locale, tagViewCopy: copy } = useUiLocale()
const { dicomTagDisplayMode, dicomTagEditSavePreference } = useUiPreferences()
const currentDisplayIndex = computed(() => (props.activeTab.tagIndex ?? 0) + 1)
const totalDisplayCount = computed(() => Math.max(1, props.activeTab.tagTotal ?? 1))
const isTreeTagDisplayMode = computed(() => dicomTagDisplayMode.value === 'tree')
const searchQuery = ref('')
const pageInput = ref('1')
const tagListScroller = ref<HTMLElement | null>(null)
const tagListScrollTop = ref(0)
const tagListViewportHeight = ref(0)
const expandedTagTreeNodeIds = ref<Set<string>>(new Set())
const isContextMenuOpen = ref(false)
const contextMenuPosition = ref({
  x: 0,
  y: 0
})
const contextMenuItem = ref<DicomTagItem | null>(null)
const isTagEditDialogOpen = ref(false)
const tagEditItem = ref<DicomTagItem | null>(null)
const tagEditScope = ref<TagEditScope>('current')
const tagEditValue = ref('')
const isSavingTagEdit = ref(false)
const isOpeningTagEditLocation = ref(false)
const tagEditDialogError = ref('')
const tagEditNotice = ref<{ tone: 'success' | 'error'; message: string; detail?: string; directoryPath?: string; filePath?: string } | null>(null)

const filteredTagItems = computed(() => {
  const items = props.activeTab.tagItems ?? []
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return items
  }

  return items.filter((item) => doesTagMatchQuery(item, query))
})

const treeTagItems = computed(() => buildTagTree(props.activeTab.tagItems ?? []))

const tagTreeItemCount = computed(() => props.activeTab.tagItems?.length ?? 0)
const tagTreeSearchText = computed(() => searchQuery.value.trim())
const visibleTreeTagRows = computed(() =>
  flattenTagTreeRows(treeTagItems.value, tagTreeSearchText.value.toLowerCase(), expandedTagTreeNodeIds.value)
)
const tagTreeSummaryText = computed(() =>
  tagTreeSearchText.value
    ? `${visibleTreeTagRows.value.length} / ${tagTreeItemCount.value} Tags`
    : `${tagTreeItemCount.value} Tags`
)

const virtualTagStartIndex = computed(() =>
  Math.max(0, Math.floor(tagListScrollTop.value / TAG_ROW_HEIGHT) - TAG_OVERSCAN_ROWS)
)

const virtualTagEndIndex = computed(() =>
  Math.min(
    filteredTagItems.value.length,
    Math.ceil((tagListScrollTop.value + Math.max(tagListViewportHeight.value, TAG_ROW_HEIGHT)) / TAG_ROW_HEIGHT) +
      TAG_OVERSCAN_ROWS
  )
)

const visibleTagRows = computed(() =>
  filteredTagItems.value.slice(virtualTagStartIndex.value, virtualTagEndIndex.value).map((item, offset) => ({
    item,
    index: virtualTagStartIndex.value + offset
  }))
)

const virtualTopSpacerHeight = computed(() => virtualTagStartIndex.value * TAG_ROW_HEIGHT)
const virtualBottomSpacerHeight = computed(() =>
  Math.max(0, (filteredTagItems.value.length - virtualTagEndIndex.value) * TAG_ROW_HEIGHT)
)

const contextMenuAnchorStyle = computed(() => ({
  left: `${contextMenuPosition.value.x}px`,
  top: `${contextMenuPosition.value.y}px`
}))

const contextMenuPreview = computed(() => {
  if (!contextMenuItem.value) {
    return { tag: '', name: '', value: '' }
  }

  const value = contextMenuItem.value.value || '--'
  return {
    tag: contextMenuItem.value.tag || '--',
    name: resolveTagName(contextMenuItem.value),
    value: value.length > 96 ? `${value.slice(0, 96)}...` : value
  }
})

const isContextMenuItemEditable = computed(() => Boolean(contextMenuItem.value && isEditableTagItem(contextMenuItem.value)))
const canOpenTagEditNoticeLocation = computed(() => Boolean(tagEditNotice.value?.directoryPath && window.viewerApi?.openExportLocation))
const isZh = computed(() => locale.value === 'zh-CN')
const tagEditCopy = computed(() => ({
  applyCurrent: isZh.value ? '仅当前 DICOM' : 'Current DICOM only',
  applyCurrentDesc: isZh.value ? '只生成当前实例的修改副本。' : 'Create a modified copy for the current instance only.',
  applySeries: isZh.value ? '本 Series 全部 DICOM' : 'All DICOMs in this series',
  applySeriesDesc: isZh.value ? '为当前 series 中所有实例生成修改副本。' : 'Create modified copies for every instance in this series.',
  cancel: isZh.value ? '取消' : 'Cancel',
  confirm: isZh.value ? '确认保存' : 'Save copies',
  currentValue: isZh.value ? '当前值' : 'Current value',
  dialogTitle: isZh.value ? '修改 DICOM Tag' : 'Edit DICOM Tag',
  dialogSubtitle: isZh.value
    ? '不会覆盖原始文件，会按 DICOM Tag 设置中的保存策略生成新的 DICOM 文件。'
    : 'Original files are not overwritten. New DICOM files are saved using the DICOM Tag save settings.',
  editableDisabled: isZh.value ? '该 Tag 不支持在这里直接修改' : 'This tag cannot be edited here',
  modifyAction: isZh.value ? '修改 Tag Value' : 'Edit Tag Value',
  modifySubtitle: isZh.value ? '生成新的 DICOM 副本' : 'Create modified DICOM copies',
  newValue: isZh.value ? '新值' : 'New value',
  openLocation: isZh.value ? '打开' : 'Open',
  openLocationFailed: isZh.value ? '打开保存位置失败。' : 'Failed to open the save location.',
  seriesJobStarted: isZh.value ? 'Series Tag 修改任务已开始，可继续浏览图像。' : 'Series tag edit started. You can keep browsing images.',
  seriesJobCompleted: (count: number) =>
    isZh.value ? `Series Tag 修改任务已完成，已生成 ${count} 个 DICOM 文件。` : `Series tag edit completed. Created ${count} DICOM file(s).`,
  seriesJobFailed: isZh.value ? 'Series Tag 修改任务失败。' : 'Series tag edit failed.',
  seriesJobPackaging: isZh.value ? 'DICOM 已处理完成，正在打包结果...' : 'DICOM processing complete. Packaging result...',
  seriesJobPreparing: isZh.value ? '正在准备批量修改任务...' : 'Preparing batch edit...',
  seriesJobProgress: (processed: number, total: number, percent: number) =>
    isZh.value ? `已处理 ${processed}/${total}（${percent}%）` : `Processed ${processed}/${total} (${percent}%)`,
  seriesJobSaving: isZh.value ? '正在保存批量修改结果...' : 'Saving batch edit result...',
  seriesJobTimeout: isZh.value ? 'Series Tag 修改任务仍在执行，请稍后再查看。' : 'Series tag edit is still running. Check again later.',
  saving: isZh.value ? '正在保存...' : 'Saving...',
  saveFailed: isZh.value ? 'DICOM Tag 修改保存失败。' : 'Failed to save DICOM tag edit.',
  downloadStarted: (fileName: string) => (isZh.value ? `已交给浏览器下载：${fileName}` : `Browser download started: ${fileName}`),
  saved: (count: number) =>
    isZh.value
      ? `已生成 ${count} 个修改后的 DICOM 文件`
      : `Created ${count} modified DICOM file(s)`,
  savedDirectory: (directory: string) => (isZh.value ? `保存位置：${directory}` : `Saved to: ${directory}`),
  scopeTitle: isZh.value ? '应用范围' : 'Apply scope',
  targetTag: isZh.value ? '目标 Tag' : 'Target Tag'
}))

const contextMenuActions = computed<Array<{ key: ContextAction; title: string; subtitle: string; badge: string; disabled?: boolean }>>(() => [
  {
    key: 'modify',
    title: tagEditCopy.value.modifyAction,
    subtitle: isContextMenuItemEditable.value ? tagEditCopy.value.modifySubtitle : tagEditCopy.value.editableDisabled,
    badge: 'EDIT',
    disabled: !isContextMenuItemEditable.value
  },
  {
    key: 'row' as const,
    title: copy.value.copyRow,
    subtitle: 'Tag / Name / VR / Value',
    badge: 'ROW'
  },
  {
    key: 'tag' as const,
    title: copy.value.copyTagId,
    subtitle: contextMenuPreview.value.tag,
    badge: 'TAG'
  },
  {
    key: 'name' as const,
    title: copy.value.copyName,
    subtitle: contextMenuPreview.value.name,
    badge: 'NAME'
  },
  {
    key: 'value' as const,
    title: copy.value.copyValue,
    subtitle: contextMenuPreview.value.value,
    badge: 'VAL'
  }
])

const tagEditPreview = computed(() => {
  const item = tagEditItem.value
  if (!item) {
    return { tag: '--', name: '--', vr: '--', value: '' }
  }
  return {
    tag: item.tag || '--',
    name: resolveTagName(item),
    vr: item.vr || '--',
    value: item.value || ''
  }
})

watch(
  () => [props.activeTab.key, props.activeTab.tagIndex, props.activeTab.tagTotal] as const,
  () => {
    pageInput.value = String(currentDisplayIndex.value)
  },
  { immediate: true }
)

watch(
  () => props.activeTab.key,
  () => {
    closeContextMenu()
    contextMenuItem.value = null
    isTagEditDialogOpen.value = false
    tagEditItem.value = null
  }
)

watch(
  treeTagItems,
  (items) => {
    expandedTagTreeNodeIds.value = new Set(collectTreeNodeIds(items))
  },
  { immediate: true }
)

watch(
  tagListScroller,
  (element, _previousElement, onCleanup) => {
    if (!element) {
      return
    }

    updateTagListViewport(element)
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(() => updateTagListViewport(element))
    resizeObserver.observe(element)
    onCleanup(() => resizeObserver.disconnect())
  },
  { flush: 'post' }
)

watch(
  () => [props.activeTab.key, props.activeTab.tagIndex, searchQuery.value, dicomTagDisplayMode.value] as const,
  async () => {
    closeContextMenu()
    await nextTick()
    if (!tagListScroller.value) {
      return
    }
    tagListScroller.value.scrollTop = 0
    updateTagListViewport(tagListScroller.value)
  }
)

function updateTagListViewport(element = tagListScroller.value): void {
  if (!element) {
    tagListScrollTop.value = 0
    tagListViewportHeight.value = 0
    return
  }

  tagListScrollTop.value = element.scrollTop
  tagListViewportHeight.value = element.clientHeight
}

function handleTagListScroll(event: Event): void {
  updateTagListViewport(event.currentTarget as HTMLElement)
}

function updateSearchQuery(value: string | null): void {
  searchQuery.value = value ?? ''
}

function clearSearchQuery(): void {
  searchQuery.value = ''
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

function getJobProgress(job: DicomTagModifyJob): { isPackaging: boolean; processed: number; total: number; percent: number; label: string } {
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
          ? tagEditCopy.value.seriesJobPackaging
          : tagEditCopy.value.seriesJobProgress(processed, total, percent)
        : tagEditCopy.value.seriesJobPreparing
  }
}

function showTagEditJobProgress(job: DicomTagModifyJob, message = tagEditCopy.value.seriesJobStarted): void {
  const progress = getJobProgress(job)
  showGlobalStatusToast(progress.isPackaging ? tagEditCopy.value.seriesJobPackaging : message, 'info', {
    busy: true,
    durationMs: 0,
    progressLabel: progress.label,
    progressPercent: progress.percent
  })
}

async function waitForDicomTagModifyJob(initialJob: DicomTagModifyJob): Promise<DicomTagModifyJob> {
  let job = initialJob
  let failedStatusPollCount = 0
  showTagEditJobProgress(job)
  for (let pollIndex = 0; pollIndex < TAG_EDIT_JOB_MAX_POLLS; pollIndex += 1) {
    if (job.status === 'succeeded' || job.status === 'failed') {
      return job
    }
    await waitForDelay(TAG_EDIT_JOB_POLL_INTERVAL_MS)
    try {
      job = await getDicomTagModifyJob(initialJob.jobId, { timeout: TAG_EDIT_JOB_STATUS_TIMEOUT_MS })
      failedStatusPollCount = 0
      showTagEditJobProgress(job)
    } catch (error) {
      failedStatusPollCount += 1
      if (failedStatusPollCount >= TAG_EDIT_JOB_MAX_STATUS_ERRORS) {
        throw error
      }
    }
  }
  throw new Error(tagEditCopy.value.seriesJobTimeout)
}

function isEditableTagItem(item: DicomTagItem): boolean {
  const normalizedTag = item.tag.replace(/[(),\s]/g, '').toUpperCase()
  return Boolean(
    item.tagPath?.length &&
      item.tag &&
      item.vr !== 'SQ' &&
      item.vr !== 'ITEM' &&
      normalizedTag !== '7FE00010' &&
      !EDITABLE_BINARY_VR_VALUES.has(item.vr)
  )
}

function openTagEditDialog(item: DicomTagItem): void {
  if (!isEditableTagItem(item)) {
    tagEditNotice.value = {
      tone: 'error',
      message: tagEditCopy.value.editableDisabled
    }
    return
  }

  tagEditItem.value = item
  tagEditValue.value = item.value ?? ''
  tagEditScope.value = 'current'
  tagEditDialogError.value = ''
  isTagEditDialogOpen.value = true
}

function closeTagEditDialog(): void {
  if (isSavingTagEdit.value) {
    return
  }

  isTagEditDialogOpen.value = false
  tagEditDialogError.value = ''
}

function getSafeTagEditFolderName(value: string): string {
  return value.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^[._ -]+|[._ -]+$/g, '').slice(0, 24) || 'series'
}

function appendDesktopPath(baseDirectory: string, ...segments: string[]): string {
  const separator = baseDirectory.includes('\\') ? '\\' : '/'
  const base = baseDirectory.replace(/[\\/]+$/g, '')
  const cleanSegments = segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, '')).filter(Boolean)
  return [base, ...cleanSegments].join(separator)
}

async function resolveTagEditSavePreference(seriesFolder: string): Promise<SaveFilePreference> {
  if (!window.viewerApi?.saveExportFile) {
    return { locationMode: 'default' }
  }

  const configuredDirectory =
    dicomTagEditSavePreference.value.locationMode === 'custom'
      ? dicomTagEditSavePreference.value.desktopDirectory?.trim()
      : await window.viewerApi.getDefaultExportDirectory?.()

  if (!configuredDirectory) {
    return { locationMode: 'default' }
  }

  return {
    locationMode: 'custom',
    desktopDirectory: appendDesktopPath(configuredDirectory, TAG_EDIT_EXPORT_ROOT, getSafeTagEditFolderName(seriesFolder || props.activeTab.seriesId))
  }
}

async function openTagEditNoticeLocation(): Promise<void> {
  const notice = tagEditNotice.value
  if (!notice?.directoryPath) {
    return
  }

  isOpeningTagEditLocation.value = true
  try {
    const opened = await openExportLocation({
      directoryPath: notice.directoryPath,
      filePath: null
    })
    if (!opened) {
      throw new Error(tagEditCopy.value.openLocationFailed)
    }
  } catch (error) {
    tagEditNotice.value = {
      tone: 'error',
      message: tagEditCopy.value.openLocationFailed,
      detail: error instanceof Error ? error.message : undefined
    }
  } finally {
    isOpeningTagEditLocation.value = false
  }
}

async function submitTagEdit(): Promise<void> {
  const item = tagEditItem.value
  if (!item?.tagPath?.length || !isEditableTagItem(item)) {
    tagEditDialogError.value = tagEditCopy.value.editableDisabled
    return
  }

  isSavingTagEdit.value = true
  tagEditDialogError.value = ''

  if (tagEditScope.value === 'series') {
    tagEditNotice.value = null
    try {
      const job = await postDicomTagModifyJob({
        seriesId: props.activeTab.seriesId,
        index: props.activeTab.tagIndex ?? 0,
        tagPath: item.tagPath,
        value: tagEditValue.value,
        scope: 'series'
      })
      showTagEditJobProgress(job)
      isTagEditDialogOpen.value = false
      void finishSeriesTagEditJob(job)
    } catch (error) {
      const message = resolveBackendErrorDetail(error) || tagEditCopy.value.saveFailed
      tagEditDialogError.value = message
      showGlobalStatusToast(message, 'error')
    } finally {
      isSavingTagEdit.value = false
    }
    return
  }

  try {
    const artifact = await postDicomTagModifyArtifact({
      seriesId: props.activeTab.seriesId,
      index: props.activeTab.tagIndex ?? 0,
      tagPath: item.tagPath,
      value: tagEditValue.value,
      scope: tagEditScope.value
    })
    const savedFile = await saveBinaryFile({
      data: artifact.data,
      fileName: artifact.fileName,
      mimeType: artifact.mediaType,
      preference: await resolveTagEditSavePreference(artifact.seriesFolder)
    })
    tagEditNotice.value = {
      tone: 'success',
      message: tagEditCopy.value.saved(artifact.modifiedCount),
      detail: savedFile.locationDescription
        ? tagEditCopy.value.savedDirectory(savedFile.locationDescription)
        : tagEditCopy.value.downloadStarted(artifact.fileName),
      directoryPath: savedFile.directoryPath ?? undefined,
      filePath: savedFile.filePath ?? undefined
    }
    isTagEditDialogOpen.value = false
  } catch (error) {
    const message = resolveBackendErrorDetail(error) || tagEditCopy.value.saveFailed
    tagEditDialogError.value = message
    tagEditNotice.value = {
      tone: 'error',
      message: tagEditCopy.value.saveFailed,
      detail: message
    }
  } finally {
    isSavingTagEdit.value = false
  }
}

async function finishSeriesTagEditJob(initialJob: DicomTagModifyJob): Promise<void> {
  try {
    const completedJob = await waitForDicomTagModifyJob(initialJob)
    if (completedJob.status === 'failed') {
      throw new Error(completedJob.error || tagEditCopy.value.seriesJobFailed)
    }

    const progress = getJobProgress(completedJob)
    showGlobalStatusToast(tagEditCopy.value.seriesJobSaving, 'info', {
      busy: true,
      durationMs: 0,
      progressLabel: progress.label,
      progressPercent: 100
    })
    const artifact = await getDicomTagModifyJobArtifact(completedJob.jobId)
    const savedFile = await saveBinaryFile({
      data: artifact.data,
      fileName: artifact.fileName,
      mimeType: artifact.mediaType,
      preference: await resolveTagEditSavePreference(artifact.seriesFolder)
    })
    const message = tagEditCopy.value.seriesJobCompleted(artifact.modifiedCount)
    const detail = savedFile.locationDescription ?? tagEditCopy.value.downloadStarted(artifact.fileName)
    tagEditNotice.value = null
    showGlobalStatusToast(message, 'success', {
      detail,
      directoryPath: savedFile.directoryPath ?? null,
      filePath: savedFile.filePath ?? null,
      canOpenLocation: Boolean((savedFile.directoryPath || savedFile.filePath) && window.viewerApi?.openExportLocation),
      busy: false,
      durationMs: 10000
    })
  } catch (error) {
    const detail = resolveBackendErrorDetail(error) || (error instanceof Error ? error.message : '') || tagEditCopy.value.seriesJobFailed
    tagEditNotice.value = null
    showGlobalStatusToast(tagEditCopy.value.seriesJobFailed, 'error', {
      detail,
      busy: false,
      durationMs: 8000
    })
  }
}

function getRawTagDepth(item: DicomTagItem): number {
  return Number.isFinite(item.depth) ? Math.max(0, item.depth) : 0
}

function buildTagTree(items: DicomTagItem[]): DicomTagTreeNode[] {
  const roots: DicomTagTreeNode[] = []
  const stack: DicomTagTreeNode[] = []

  items.forEach((item, index) => {
    const depth = getRawTagDepth(item)
    const tag = item.tag || '--'
    const keyword = item.keyword || ''
    const name = resolveTagName(item)
    const vr = item.vr || '--'
    const value = item.value || '--'
    const node: DicomTagTreeNode = {
      id: `${index}-${item.tag || 'tag'}-${item.keyword || item.name || 'unnamed'}`,
      title: name,
      tag,
      keyword,
      name,
      vr,
      value,
      searchText: buildTagSearchText(tag, name, keyword, value, vr),
      depth,
      original: item
    }

    const parent = depth > 0 ? stack[depth - 1] : null
    if (parent) {
      parent.children = parent.children ?? []
      parent.children.push(node)
    } else {
      roots.push(node)
    }

    stack.length = depth
    stack[depth] = node
  })

  return roots
}

function collectTreeNodeIds(nodes: DicomTagTreeNode[]): string[] {
  const ids: string[] = []
  const stack = [...nodes].reverse()
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) {
      continue
    }
    ids.push(node.id)
    const children = node.children ?? []
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index]
      if (child) {
        stack.push(child)
      }
    }
  }
  return ids
}

function doesTreeNodeMatchQuery(node: DicomTagTreeNode, query: string): boolean {
  return !query || node.searchText.includes(query)
}

function flattenTagTreeRows(
  nodes: DicomTagTreeNode[],
  query: string,
  expandedIds: Set<string>,
  level = 0
): VisibleDicomTagTreeRow[] {
  const rows: VisibleDicomTagTreeRow[] = []
  const isSearching = query.length > 0

  nodes.forEach((node) => {
    const children = node.children ?? []
    const isMatched = doesTreeNodeMatchQuery(node, query)
    const isExpanded = isSearching || expandedIds.has(node.id)
    const childRows =
      children.length > 0 && (isSearching || isExpanded)
        ? flattenTagTreeRows(children, query, expandedIds, level + 1)
        : []
    const shouldInclude = !isSearching || isMatched || childRows.length > 0
    if (!shouldInclude) {
      return
    }

    rows.push({
      ...node,
      hasChildren: children.length > 0,
      isExpanded,
      isMatched,
      level
    })

    if (isExpanded) {
      rows.push(...childRows)
    }
  })

  return rows
}

function buildTagSearchText(...fields: Array<string | null | undefined>): string {
  return fields.map((field) => field ?? '').join('\n').toLowerCase()
}

function toggleTreeNode(nodeId: string): void {
  const nextExpandedIds = new Set(expandedTagTreeNodeIds.value)
  if (nextExpandedIds.has(nodeId)) {
    nextExpandedIds.delete(nodeId)
  } else {
    nextExpandedIds.add(nodeId)
  }
  expandedTagTreeNodeIds.value = nextExpandedIds
}

function getTreeRowIndentStyle(item: VisibleDicomTagTreeRow): Record<string, string> {
  const guideDepth = Math.min(item.level, TAG_TREE_MAX_GUIDE_DEPTH)
  return {
    '--tag-tree-depth': String(item.level),
    '--tag-tree-guide-depth': String(guideDepth),
    paddingLeft: `${guideDepth * TAG_TREE_INDENT_PX}px`
  }
}

function getTreeGuideStyle(level: number): Record<string, string> {
  return {
    left: `${(level - 1) * TAG_TREE_INDENT_PX + 11}px`
  }
}

function getTreeBranchStyle(item: VisibleDicomTagTreeRow): Record<string, string> {
  const guideDepth = Math.min(item.level, TAG_TREE_MAX_GUIDE_DEPTH)
  return {
    left: `${(guideDepth - 1) * TAG_TREE_INDENT_PX + 11}px`,
    width: `${TAG_TREE_INDENT_PX - 8}px`
  }
}

function doesTagMatchQuery(item: DicomTagItem, query: string): boolean {
  return buildTagSearchText(item.tag, item.name, item.value, item.keyword, item.vr).includes(query)
}

function goToPage(page: number): void {
  const nextPage = Math.max(1, Math.min(page, totalDisplayCount.value))
  pageInput.value = String(nextPage)
  const nextIndex = nextPage - 1
  if (nextIndex === (props.activeTab.tagIndex ?? 0)) {
    return
  }

  emit('indexChange', {
    tabKey: props.activeTab.key,
    index: nextIndex
  })
}

function submitPageInput(): void {
  const parsed = Number.parseInt(pageInput.value.trim(), 10)
  if (!Number.isFinite(parsed)) {
    pageInput.value = String(currentDisplayIndex.value)
    return
  }

  goToPage(parsed)
}

function closeContextMenu(): void {
  isContextMenuOpen.value = false
}

function handleRowContextMenu(event: MouseEvent, item: DicomTagItem): void {
  event.preventDefault()
  contextMenuItem.value = item
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  isContextMenuOpen.value = true
}

function resolveTagName(item: DicomTagItem): string {
  return item.name || item.keyword || '--'
}

function buildRowText(item: DicomTagItem): string {
  return [item.tag || '--', resolveTagName(item), item.vr || '--', item.value || '--'].join('\t')
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  textArea.style.pointerEvents = 'none'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

async function handleContextAction(action: ContextAction): Promise<void> {
  if (!contextMenuItem.value) {
    return
  }

  if (action === 'modify') {
    openTagEditDialog(contextMenuItem.value)
    closeContextMenu()
    return
  }

  if (action === 'row') {
    await writeClipboardText(buildRowText(contextMenuItem.value))
  } else if (action === 'tag') {
    await writeClipboardText(contextMenuItem.value.tag || '--')
  } else if (action === 'name') {
    await writeClipboardText(resolveTagName(contextMenuItem.value))
  } else {
    await writeClipboardText(contextMenuItem.value.value || '--')
  }

  closeContextMenu()
}
</script>

<template>
  <section class="dicom-tag-view flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border">
    <header class="tag-view-header border-b px-4 py-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="tag-view-title truncate text-[20px] font-semibold tracking-[0.01em]">{{ activeTab.seriesTitle }}</h2>
          <VChip size="x-small" variant="flat" class="tag-view-chip rounded-full! border! border-sky-300/18! bg-sky-300/10! px-2.5! text-[10px]! font-semibold! uppercase! tracking-[0.16em]! text-sky-100!">
            DICOM Tags
          </VChip>
        </div>

        <div class="tag-view-meta-list mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span class="tag-view-meta rounded-full border px-2.5 py-1">{{ copy.instance }} {{ currentDisplayIndex }} / {{ totalDisplayCount }}</span>
          <span v-if="activeTab.tagSopInstanceUid" class="tag-view-meta max-w-full truncate rounded-full border px-2.5 py-1">SOP {{ activeTab.tagSopInstanceUid }}</span>
          <span
            v-if="activeTab.tagFilePath"
            class="tag-view-meta tag-view-meta--path min-w-0 max-w-full truncate rounded-full border px-2.5 py-1 font-mono text-[11px]"
          >
            {{ activeTab.tagFilePath }}
          </span>
        </div>
      </div>
    </header>

    <div class="tag-view-toolbar border-b px-4 py-2.5">
      <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div class="tag-control-panel rounded-[14px] border p-2">
          <div class="tag-control-label mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]">{{ copy.instanceNavigation }}</div>
          <div class="flex flex-wrap items-center gap-2">
            <VPagination
              :model-value="currentDisplayIndex"
              :length="totalDisplayCount"
              :total-visible="7"
              class="tag-view-pagination min-w-0 flex-1"
              density="compact"
              :disabled="activeTab.tagIsLoading"
              @update:model-value="goToPage"
            />
            <div class="flex items-center gap-2">
              <VTextField
                v-model="pageInput"
                class="tag-field tag-page-field w-[94px]"
                density="compact"
                hide-details
                :label="copy.page"
                variant="outlined"
                :disabled="activeTab.tagIsLoading"
                @keydown.enter.prevent="submitPageInput"
                @blur="submitPageInput"
              />
              <VBtn
                variant="flat"
                density="compact"
                class="tag-view-go-button rounded-full! border! px-3! text-xs! font-semibold!"
                :disabled="activeTab.tagIsLoading"
                @click="submitPageInput"
              >
                {{ copy.goTo }}
              </VBtn>
            </div>
          </div>
        </div>

        <div class="tag-control-panel rounded-[14px] border p-2">
          <div class="tag-control-label mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]">{{ copy.filter }}</div>
          <VTextField
            :model-value="searchQuery"
            class="tag-field tag-search-field"
            density="compact"
            hide-details
            :label="copy.searchLabel"
            variant="outlined"
            @update:model-value="updateSearchQuery"
          >
            <template v-if="searchQuery" #append-inner>
              <button
                type="button"
                class="tag-search-clear-button"
                aria-label="Clear search"
                @mousedown.prevent
                @click.stop="clearSearchQuery"
              >
                <AppIcon name="close" :size="17" />
              </button>
            </template>
          </VTextField>
        </div>
      </div>
    </div>

    <div class="tag-view-content min-h-0 flex-1 px-4 py-3">
      <div v-if="activeTab.tagIsLoading" class="tag-state tag-state--loading grid h-full min-h-[260px] place-items-center rounded-[18px] border border-white/8 bg-white/4 text-sm text-slate-300">
        {{ copy.loading }}
      </div>

      <div v-else-if="activeTab.tagLoadError" class="tag-state tag-state--error grid h-full min-h-[260px] place-items-center rounded-[18px] border border-rose-300/18 bg-rose-400/8 px-6 text-center text-sm text-rose-100">
        {{ activeTab.tagLoadError }}
      </div>

      <div v-else-if="activeTab.tagItems?.length" class="tag-table-shell flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <template v-if="isTreeTagDisplayMode">
          <div class="tag-tree-head grid grid-cols-[minmax(420px,1fr)_90px_minmax(280px,1fr)] gap-4 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
            <span>Tree / Tag / Name</span>
            <span>VR</span>
            <span>Value</span>
          </div>

          <div class="tag-tree-summary border-b px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]">
            {{ tagTreeSummaryText }}
          </div>

          <div class="tag-tree-scroll min-h-0 flex-1 overflow-auto">
            <template v-if="visibleTreeTagRows.length">
              <div
                v-for="item in visibleTreeTagRows"
                :key="item.id"
                class="tag-tree-row grid min-w-0 grid-cols-[minmax(320px,1fr)_90px_minmax(260px,1fr)] gap-4"
                :class="{
                  'tag-tree-row--branch': item.hasChildren,
                  'tag-tree-row--item': item.vr === 'ITEM',
                  'tag-tree-row--sequence': item.vr === 'SQ',
                  'tag-tree-row--matched': Boolean(tagTreeSearchText && item.isMatched),
                  'tag-tree-row--menu-open': isContextMenuOpen && contextMenuItem === item.original
                }"
                @contextmenu.stop.prevent="handleRowContextMenu($event, item.original)"
              >
                <div class="tag-tree-row__identity min-w-0" :style="getTreeRowIndentStyle(item)">
                  <div v-if="item.level > 0" class="tag-tree-row__guides" aria-hidden="true">
                    <span
                      v-for="guideLevel in Math.min(item.level, TAG_TREE_MAX_GUIDE_DEPTH)"
                      :key="guideLevel"
                      class="tag-tree-row__guide-line"
                      :style="getTreeGuideStyle(guideLevel)"
                    ></span>
                    <span class="tag-tree-row__branch-line" :style="getTreeBranchStyle(item)"></span>
                  </div>

                  <button
                    v-if="item.hasChildren"
                    type="button"
                    class="tag-tree-row__toggle"
                    :aria-label="item.isExpanded ? 'Collapse tag branch' : 'Expand tag branch'"
                    @click.stop="toggleTreeNode(item.id)"
                  >
                    <AppIcon name="chevron-right" :size="15" class="tag-tree-row__toggle-icon" :class="{ 'tag-tree-row__toggle-icon--open': item.isExpanded }" />
                  </button>
                  <span v-else class="tag-tree-row__leaf-dot" aria-hidden="true"></span>

                  <div class="tag-tree-row__identity-text min-w-0">
                    <div class="tag-tree-row__tag truncate font-mono text-[13px]">{{ item.tag }}</div>
                    <div class="tag-tree-row__name mt-1 truncate text-[14px] font-semibold">{{ item.name }}</div>
                    <div v-if="item.keyword" class="tag-tree-row__keyword mt-0.5 truncate font-mono text-[11px]">{{ item.keyword }}</div>
                  </div>
                </div>
                <span class="tag-tree-row__vr font-mono text-[13px] font-semibold">{{ item.vr }}</span>
                <span class="tag-tree-row__value font-mono text-[13px] leading-6" :title="item.value">{{ item.value }}</span>
              </div>
            </template>

            <div v-else class="tag-state tag-state--empty grid h-full min-h-[260px] place-items-center px-6 text-center text-sm text-slate-400">
              {{ tagTreeSearchText ? copy.noMatches : copy.empty }}
            </div>
          </div>
        </template>

        <template v-else>
          <div class="tag-table-head grid grid-cols-[150px_240px_90px_minmax(260px,1fr)] gap-4 border-b border-white/8 bg-white/6 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
            <span>Tag</span>
            <span>Name</span>
            <span>VR</span>
            <span>Value</span>
          </div>

          <div ref="tagListScroller" class="tag-list-scroll min-h-0 flex-1 overflow-auto" @scroll="handleTagListScroll">
            <div v-if="filteredTagItems.length" :style="{ height: `${virtualTopSpacerHeight}px` }"></div>
            <div
              v-for="{ item, index } in visibleTagRows"
              :key="`${item.tag}-${item.keyword}-${index}`"
              class="tag-row grid grid-cols-[150px_240px_90px_minmax(260px,1fr)] gap-4 border-b border-white/6 px-6 text-sm text-slate-200 transition-colors duration-150 hover:bg-white/3 last:border-b-0"
              :class="{ 'tag-row--menu-open': isContextMenuOpen && contextMenuItem === item }"
              :style="{ height: `${TAG_ROW_HEIGHT}px` }"
              @contextmenu="handleRowContextMenu($event, item)"
            >
              <span class="tag-row__tag font-mono text-[13px] text-sky-200/85">{{ item.tag || '--' }}</span>
              <div class="tag-row__name-cell min-w-0">
                <div class="tag-row__name truncate text-[15px] font-medium text-white">{{ item.name || item.keyword || '--' }}</div>
                <div v-if="item.keyword" class="tag-row__keyword mt-1 truncate font-mono text-[11px] text-slate-500">{{ item.keyword }}</div>
              </div>
              <span class="tag-row__vr font-mono text-[13px] font-semibold text-amber-200/85">{{ item.vr || '--' }}</span>
              <span class="tag-row__value font-mono text-[13px] leading-6 text-slate-300" :title="item.value || '--'">{{ item.value || '--' }}</span>
            </div>
            <div v-if="filteredTagItems.length" :style="{ height: `${virtualBottomSpacerHeight}px` }"></div>

            <div v-if="!filteredTagItems.length" class="tag-state tag-state--empty grid h-full min-h-[260px] place-items-center px-6 text-center text-sm text-slate-400">
              {{ copy.noMatches }}
            </div>
          </div>
        </template>

        <div v-if="contextMenuItem" class="fixed z-[2100] h-0 w-0" :style="contextMenuAnchorStyle">
          <VMenu
            v-model="isContextMenuOpen"
            activator="parent"
            location="bottom start"
            :offset="8"
            scroll-strategy="reposition"
            :close-on-content-click="true"
          >
            <VCard class="tag-context-menu theme-shell-panel min-w-[300px] overflow-hidden rounded-[24px]! border! text-[var(--theme-text-primary)]! shadow-[0_28px_64px_rgba(0,0,0,0.5)]!">
              <div class="tag-context-menu__chrome"></div>
              <div class="relative px-2.5 pb-2.5 pt-2.5">
                <div class="tag-context-preview rounded-[18px] border border-[color:color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_72%,transparent)] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div class="flex items-start justify-between gap-3">
                    <div class="tag-context-menu__thumb">
                      <AppIcon name="tag" :size="20" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-[9px] font-semibold uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--theme-text-secondary)_68%,var(--theme-accent)_32%)]">{{ copy.tagActions }}</div>
                      <div class="mt-1 truncate font-mono text-[12px] font-medium text-[var(--theme-text-primary)]">{{ contextMenuPreview.tag }}</div>
                      <div class="mt-0.5 truncate text-[11px] text-[var(--theme-text-secondary)]">{{ contextMenuPreview.name }}</div>
                      <div class="mt-1 truncate font-mono text-[10px] text-[var(--theme-text-muted)]">{{ contextMenuPreview.value }}</div>
                    </div>
                    <div class="rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] px-2 py-[5px] text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-primary)]">
                      {{ copy.copy }}
                    </div>
                  </div>
                </div>

                <VDivider class="my-2.5 border-[var(--theme-border-soft)] opacity-100" />

                <VList class="bg-transparent! py-0!">
                  <VListItem
                    v-for="action in contextMenuActions"
                    :key="action.key"
                    :disabled="action.disabled"
                    class="tag-context-menu__item rounded-[16px]! px-2.5! py-1.5!"
                    :class="{ 'tag-context-menu__item--disabled': action.disabled }"
                    @click="!action.disabled && handleContextAction(action.key)"
                  >
                    <div class="flex items-center gap-2.5">
                      <div class="tag-context-menu__badge" :class="{ 'tag-context-menu__badge--disabled': action.disabled }">{{ action.badge }}</div>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-[12px] font-medium" :class="action.disabled ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-primary)]'">{{ action.title }}</div>
                        <div class="truncate text-[11px]" :class="action.disabled ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-secondary)]'">{{ action.subtitle }}</div>
                      </div>
                    </div>
                  </VListItem>
                </VList>
              </div>
            </VCard>
          </VMenu>
        </div>
      </div>

      <div v-else class="tag-state tag-state--empty grid h-full min-h-[260px] place-items-center rounded-[18px] border border-dashed border-white/10 bg-white/3 text-sm text-slate-400">
        {{ copy.empty }}
      </div>
    </div>

    <VDialog v-model="isTagEditDialogOpen" max-width="660" persistent>
      <VCard class="tag-edit-dialog overflow-hidden rounded-[24px]! border! p-0! text-[var(--theme-text-primary)]!">
        <div class="tag-edit-dialog__header px-5 py-5">
          <div class="flex items-start justify-between gap-4">
            <div class="flex min-w-0 gap-3">
              <div class="tag-edit-dialog__icon">
                <AppIcon name="tag" :size="18" />
              </div>
              <div class="min-w-0">
                <div class="text-lg font-semibold leading-tight">{{ tagEditCopy.dialogTitle }}</div>
                <div class="mt-2 max-w-[520px] text-sm leading-6 text-[var(--theme-text-secondary)]">{{ tagEditCopy.dialogSubtitle }}</div>
              </div>
            </div>
            <button type="button" class="tag-edit-dialog__close" :disabled="isSavingTagEdit" @click="closeTagEditDialog">
              <AppIcon name="close" :size="17" />
            </button>
          </div>
        </div>

        <div class="space-y-4 px-5 py-5">
          <div class="tag-edit-target rounded-[18px] border px-4 py-4">
            <div class="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ tagEditCopy.targetTag }}</div>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="tag-edit-target__tag font-mono text-sm">{{ tagEditPreview.tag }}</span>
                  <span class="tag-edit-target__vr font-mono text-[12px] font-semibold">{{ tagEditPreview.vr }}</span>
                </div>
                <div class="mt-2 truncate text-[15px] font-semibold leading-6 text-[var(--theme-text-primary)]">{{ tagEditPreview.name }}</div>
                <div class="tag-edit-target__value mt-2 min-w-0 truncate font-mono text-[12px]">
                  {{ tagEditCopy.currentValue }}: {{ tagEditPreview.value || '--' }}
                </div>
              </div>
            </div>
          </div>

          <div class="tag-edit-field-block">
            <div class="tag-edit-field-label">{{ tagEditCopy.newValue }}</div>
            <VTextarea
              v-model="tagEditValue"
              class="tag-edit-textarea"
              :disabled="isSavingTagEdit"
              :placeholder="tagEditCopy.newValue"
              rows="3"
              auto-grow
              hide-details
              variant="outlined"
            />
          </div>

          <div class="tag-edit-scope rounded-[18px] border px-4 py-4">
            <div class="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ tagEditCopy.scopeTitle }}</div>
            <div class="tag-edit-scope-grid">
              <button
                type="button"
                class="tag-edit-scope-option"
                :class="{ 'tag-edit-scope-option--active': tagEditScope === 'current' }"
                :disabled="isSavingTagEdit"
                @click="tagEditScope = 'current'"
              >
                <span class="tag-edit-scope-option__check">
                  <AppIcon v-if="tagEditScope === 'current'" name="check" :size="13" />
                </span>
                <span class="tag-edit-scope-option__text">
                  <span>{{ tagEditCopy.applyCurrent }}</span>
                  <span>{{ tagEditCopy.applyCurrentDesc }}</span>
                </span>
              </button>
              <button
                type="button"
                class="tag-edit-scope-option"
                :class="{ 'tag-edit-scope-option--active': tagEditScope === 'series' }"
                :disabled="isSavingTagEdit"
                @click="tagEditScope = 'series'"
              >
                <span class="tag-edit-scope-option__check">
                  <AppIcon v-if="tagEditScope === 'series'" name="check" :size="13" />
                </span>
                <span class="tag-edit-scope-option__text">
                  <span>{{ tagEditCopy.applySeries }}</span>
                  <span>{{ tagEditCopy.applySeriesDesc }}</span>
                </span>
              </button>
            </div>
          </div>

          <div v-if="tagEditDialogError" class="tag-edit-dialog__error rounded-[14px] border px-4 py-3 text-sm leading-6">
            {{ tagEditDialogError }}
          </div>

          <div class="tag-edit-dialog__footer flex justify-end gap-2 pt-1">
            <VBtn variant="text" class="tag-edit-action-button" :disabled="isSavingTagEdit" @click="closeTagEditDialog">
              {{ tagEditCopy.cancel }}
            </VBtn>
            <VBtn variant="flat" class="tag-edit-action-button tag-edit-action-button--primary" :loading="isSavingTagEdit" @click="submitTagEdit">
              <span class="inline-flex items-center gap-2">
                <AppIcon v-if="!isSavingTagEdit" name="check" :size="14" />
                {{ isSavingTagEdit ? tagEditCopy.saving : tagEditCopy.confirm }}
              </span>
            </VBtn>
          </div>
        </div>
      </VCard>
    </VDialog>

    <div v-if="tagEditNotice" class="tag-edit-notice" :data-tone="tagEditNotice.tone" role="status" aria-live="polite">
      <AppIcon :name="tagEditNotice.tone === 'success' ? 'success' : 'error'" :size="18" />
      <div class="tag-edit-notice__content min-w-0 flex-1">
        <div class="tag-edit-notice__message truncate text-sm font-semibold" :title="tagEditNotice.message">{{ tagEditNotice.message }}</div>
        <div v-if="tagEditNotice.detail" class="tag-edit-notice__detail mt-0.5 truncate text-[12px] opacity-75" :title="tagEditNotice.detail">{{ tagEditNotice.detail }}</div>
      </div>
      <button
        v-if="canOpenTagEditNoticeLocation"
        type="button"
        class="tag-edit-notice__open"
        :disabled="isOpeningTagEditLocation"
        @click="void openTagEditNoticeLocation()"
      >
        {{ tagEditCopy.openLocation }}
      </button>
      <button type="button" class="tag-edit-notice__close" aria-label="Close notification" @click="tagEditNotice = null">
        <AppIcon name="close" :size="13" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.dicom-tag-view {
  position: relative;
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-card-soft);
  color: var(--theme-text-primary);
}

.tag-view-header,
.tag-view-toolbar {
  border-color: var(--theme-border-soft);
}

.tag-view-title {
  color: var(--theme-text-primary);
}

:deep(.tag-view-chip) {
  border-color: color-mix(in srgb, var(--theme-accent) 28%, var(--theme-border-soft)) !important;
  background: color-mix(in srgb, var(--theme-accent) 11%, transparent) !important;
  color: color-mix(in srgb, var(--theme-text-primary) 78%, var(--theme-accent)) !important;
}

.tag-view-meta-list {
  color: var(--theme-text-secondary);
}

.tag-view-meta {
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-card);
  color: var(--theme-text-secondary);
}

.tag-view-meta--path {
  border-color: color-mix(in srgb, var(--theme-border-soft) 78%, var(--theme-text-primary) 8%);
  background: var(--theme-surface-card-soft);
  color: var(--theme-text-muted);
}

.tag-control-panel {
  border-color: var(--theme-border-soft);
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
}

.tag-control-label {
  color: var(--theme-text-muted);
}

:deep(.tag-field .v-field) {
  border-radius: 14px;
  min-height: 40px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 5%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
}

:deep(.tag-field .v-field--variant-outlined) {
  background: var(--theme-surface-card);
}

:deep(.tag-field .v-field--variant-outlined .v-field__outline) {
  --v-field-border-opacity: 1;
  color: var(--theme-border-soft);
}

:deep(.tag-field .v-field__input) {
  min-height: 40px;
  padding-top: 8px;
  padding-bottom: 8px;
  color: var(--theme-text-primary);
  padding-left: 12px;
  padding-right: 12px;
}

:deep(.tag-field .v-label) {
  color: var(--theme-text-muted);
  padding-left: 4px;
}

:deep(.tag-field .v-field--focused) {
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 6%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 34%, transparent),
    0 0 0 4px color-mix(in srgb, var(--theme-accent) 9%, transparent);
}

:deep(.tag-field .v-field--focused .v-field__outline) {
  color: color-mix(in srgb, var(--theme-accent) 82%, var(--theme-text-primary));
}

:deep(.tag-search-field .v-field--focused) {
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 6%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 34%, transparent),
    0 0 0 4px color-mix(in srgb, var(--theme-accent) 9%, transparent) !important;
}

.tag-search-clear-button {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  margin-right: 4px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 80%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-primary) 8%, var(--theme-surface-card));
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.tag-search-clear-button:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 42%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card-soft));
  color: var(--theme-text-primary);
}

:deep(.tag-view-go-button) {
  border-color: var(--theme-border-soft) !important;
  background: color-mix(in srgb, var(--theme-accent) 10%, var(--theme-surface-card)) !important;
  color: var(--theme-text-primary) !important;
}

:deep(.tag-view-go-button:hover) {
  border-color: var(--theme-border-strong) !important;
  background: color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-card-soft)) !important;
}

:deep(.tag-view-pagination .v-btn) {
  min-width: 34px;
  height: 34px;
  color: var(--theme-text-secondary);
}

:deep(.tag-view-pagination .v-btn--active),
:deep(.tag-view-pagination .v-pagination__item--is-active .v-btn) {
  background: color-mix(in srgb, var(--theme-accent) 78%, var(--theme-surface-card)) !important;
  color: var(--theme-accent-contrast) !important;
}

.tag-state {
  border-color: var(--theme-border-soft);
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
  color: var(--theme-text-muted);
}

.tag-state--loading {
  color: var(--theme-text-secondary);
}

.tag-state--error {
  border-color: color-mix(in srgb, #ef7777 34%, var(--theme-border-soft));
  background: color-mix(in srgb, #ef7777 10%, var(--theme-surface-card-soft));
  color: color-mix(in srgb, #ef7777 72%, var(--theme-text-primary));
}

.tag-edit-dialog {
  border-color: var(--theme-border-soft) !important;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 5%, transparent), transparent 36%),
    var(--theme-surface-panel-strong) !important;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.42),
    0 0 0 1px color-mix(in srgb, var(--theme-border-strong) 34%, transparent) !important;
}

.tag-edit-dialog__header {
  border-bottom: 1px solid var(--theme-border-soft);
}

.tag-edit-dialog__icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 28%, var(--theme-border-soft));
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-card));
  color: color-mix(in srgb, var(--theme-accent) 78%, var(--theme-text-primary));
}

.tag-edit-dialog__close,
.tag-edit-notice__close {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--theme-border-soft);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-card) 88%, transparent);
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.tag-edit-dialog__close:hover,
.tag-edit-notice__close:hover {
  border-color: var(--theme-border-strong);
  background: color-mix(in srgb, var(--theme-accent) 9%, var(--theme-surface-card-soft));
  color: var(--theme-text-primary);
}

.tag-edit-dialog__close:disabled {
  cursor: default;
  opacity: 0.62;
}

.tag-edit-target,
.tag-edit-scope {
  border-color: var(--theme-border-soft);
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
}

.tag-edit-target__tag {
  color: color-mix(in srgb, var(--theme-accent) 76%, var(--theme-text-primary));
}

.tag-edit-target__vr {
  display: inline-flex;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent-warm) 30%, var(--theme-border-soft));
  border-radius: 999px;
  padding: 2px 8px;
  background: color-mix(in srgb, var(--theme-accent-warm) 11%, var(--theme-surface-card));
  color: color-mix(in srgb, var(--theme-accent-warm) 78%, var(--theme-text-primary));
}

.tag-edit-target__value {
  color: var(--theme-text-muted);
}

.tag-edit-field-block {
  display: grid;
  gap: 8px;
}

.tag-edit-field-label {
  padding-left: 2px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

:deep(.tag-edit-textarea .v-field) {
  border-radius: 16px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  transition:
    background-color 150ms ease,
    box-shadow 150ms ease;
}

:deep(.tag-edit-textarea .v-field__input) {
  min-height: 96px;
  padding: 14px 16px;
  color: var(--theme-text-primary);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
}

:deep(.tag-edit-textarea .v-field__input::placeholder) {
  color: var(--theme-text-muted);
  opacity: 0.72;
}

:deep(.tag-edit-textarea .v-field__outline) {
  color: transparent;
}

:deep(.tag-edit-textarea .v-field--focused) {
  background: color-mix(in srgb, var(--theme-surface-card) 94%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 46%, transparent),
    0 0 0 4px color-mix(in srgb, var(--theme-accent) 12%, transparent);
}

.tag-edit-scope-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tag-edit-scope-option {
  display: flex;
  min-height: 86px;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 15px;
  padding: 13px;
  background: color-mix(in srgb, var(--theme-surface-panel) 64%, transparent);
  color: var(--theme-text-secondary);
  text-align: left;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    box-shadow 150ms ease,
    color 150ms ease;
}

.tag-edit-scope-option:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.tag-edit-scope-option:disabled {
  cursor: default;
  opacity: 0.72;
}

.tag-edit-scope-option--active {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 13%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 16%, transparent),
    0 12px 26px color-mix(in srgb, var(--theme-accent) 10%, transparent);
}

.tag-edit-scope-option__check {
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 88%, transparent);
  color: transparent;
}

.tag-edit-scope-option--active .tag-edit-scope-option__check {
  border-color: color-mix(in srgb, var(--theme-accent) 72%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 80%, var(--theme-surface-card));
  color: var(--theme-accent-contrast);
}

.tag-edit-scope-option__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: inherit;
  font-size: 13px;
  line-height: 1.5;
}

.tag-edit-scope-option__text span:first-child {
  font-size: 14px;
  font-weight: 700;
}

.tag-edit-scope-option__text span:last-child {
  color: var(--theme-text-muted);
  font-size: 12px;
}

.tag-edit-dialog__error {
  border-color: color-mix(in srgb, #ef7777 34%, var(--theme-border-soft));
  background: color-mix(in srgb, #ef7777 10%, var(--theme-surface-card-soft));
  color: color-mix(in srgb, #ef7777 76%, var(--theme-text-primary));
}

:deep(.tag-edit-action-button) {
  min-height: 40px !important;
  border-radius: 12px !important;
  padding: 0 16px !important;
  color: var(--theme-text-secondary) !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
}

:deep(.tag-edit-action-button:hover) {
  background: color-mix(in srgb, var(--theme-accent) 9%, transparent) !important;
  color: var(--theme-text-primary) !important;
}

:deep(.tag-edit-action-button--primary) {
  border: 1px solid color-mix(in srgb, var(--theme-accent) 54%, var(--theme-border-strong)) !important;
  background: color-mix(in srgb, var(--theme-accent) 78%, var(--theme-surface-card)) !important;
  color: var(--theme-accent-contrast) !important;
  box-shadow: 0 12px 24px color-mix(in srgb, var(--theme-accent) 16%, transparent) !important;
}

@media (max-width: 680px) {
  .tag-edit-scope-grid {
    grid-template-columns: 1fr;
  }
}

.tag-edit-notice {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 40;
  display: flex;
  width: min(760px, calc(100% - 36px));
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong) 94%, transparent);
  color: var(--theme-text-primary);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32);
}

.tag-edit-notice[data-tone="success"] {
  border-color: color-mix(in srgb, #7bd7a4 40%, var(--theme-border-soft));
}

.tag-edit-notice[data-tone="error"] {
  border-color: color-mix(in srgb, #ef7777 42%, var(--theme-border-soft));
}

.tag-edit-notice__content {
  overflow: hidden;
}

.tag-edit-notice__message,
.tag-edit-notice__detail {
  display: block;
  max-width: 100%;
}

.tag-edit-notice__open {
  display: inline-flex;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, var(--theme-border-soft));
  border-radius: 11px;
  padding: 0 12px;
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.tag-edit-notice__open:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--theme-accent) 50%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card-soft));
}

.tag-edit-notice__open:disabled {
  cursor: default;
  opacity: 0.62;
}

.tag-row {
  align-items: center;
  border-color: var(--theme-border-soft);
  color: var(--theme-text-secondary);
}

.tag-row:hover {
  background-color: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card-soft));
}

.tag-table-head {
  border-color: var(--theme-border-soft);
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  color: var(--theme-text-secondary);
}

.tag-row__tag {
  color: color-mix(in srgb, var(--theme-accent) 70%, var(--theme-text-primary));
}

.tag-row__name {
  color: var(--theme-text-primary);
}

.tag-row__keyword {
  color: var(--theme-text-muted);
}

.tag-row__vr {
  color: color-mix(in srgb, var(--theme-accent-warm) 70%, var(--theme-text-secondary));
}

.tag-row__value {
  display: -webkit-box;
  overflow: hidden;
  color: var(--theme-text-secondary);
  word-break: break-all;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tag-row--menu-open {
  background:
    linear-gradient(90deg, rgba(34, 211, 238, 0.06), rgba(56, 189, 248, 0.03)),
    rgba(125, 211, 252, 0.08);
  box-shadow: inset 2px 0 0 rgba(103, 232, 249, 0.65);
}

.tag-table-shell {
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-card-soft);
  color: var(--theme-text-primary);
}

.tag-tree-head {
  border-color: var(--theme-border-soft);
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  color: var(--theme-text-secondary);
}

.tag-tree-summary {
  border-color: var(--theme-border-soft);
  background: color-mix(in srgb, var(--theme-surface-card-soft) 72%, transparent);
  color: var(--theme-text-muted);
}

.tag-tree-row {
  --tag-tree-row-bg: color-mix(in srgb, var(--theme-surface-card-soft) 58%, transparent);
  position: relative;
  min-height: 74px;
  align-items: center;
  padding: 0 24px;
  background-color: var(--tag-tree-row-bg);
  color: var(--theme-text-primary);
  transition:
    background-color 150ms ease,
    box-shadow 150ms ease;
}

.tag-tree-row:hover,
.tag-tree-row--menu-open {
  background-color: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-surface-card-soft));
  box-shadow:
    inset 3px 0 0 color-mix(in srgb, var(--theme-accent) 62%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 13%, transparent);
}

.tag-tree-row:hover .tag-tree-row__guide-line,
.tag-tree-row--menu-open .tag-tree-row__guide-line,
.tag-tree-row:hover .tag-tree-row__branch-line,
.tag-tree-row--menu-open .tag-tree-row__branch-line {
  background: color-mix(in srgb, var(--theme-accent) 48%, var(--theme-border-strong));
  opacity: 0.86;
}

.tag-tree-row:hover .tag-tree-row__leaf-dot::before,
.tag-tree-row--menu-open .tag-tree-row__leaf-dot::before {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 26%, transparent);
}

.tag-tree-row--branch {
  background-color: var(--tag-tree-row-bg);
  box-shadow: none;
}

.tag-tree-row--sequence {
  background-color: var(--tag-tree-row-bg);
}

.tag-tree-row--item {
  background-color: var(--tag-tree-row-bg);
}

.tag-tree-row--matched {
  background-color: var(--tag-tree-row-bg);
  box-shadow: none;
}

.tag-tree-row__identity {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 74px;
}

.tag-tree-row__guides {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--tag-tree-guide-depth) * 28px);
  pointer-events: none;
}

.tag-tree-row__guide-line {
  position: absolute;
  top: -1px;
  bottom: -1px;
  width: 1px;
  background: color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  opacity: 0.72;
}

.tag-tree-row__branch-line {
  position: absolute;
  top: 50%;
  height: 1px;
  background: color-mix(in srgb, var(--theme-border-strong) 82%, transparent);
  opacity: 0.76;
}

.tag-tree-row__toggle,
.tag-tree-row__leaf-dot {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  align-items: center;
  justify-content: center;
}

.tag-tree-row__toggle {
  border: 1px solid color-mix(in srgb, var(--theme-accent) 28%, var(--theme-border-soft));
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  color: color-mix(in srgb, var(--theme-accent) 82%, white 8%);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.tag-tree-row__toggle:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 48%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 16%, transparent);
  color: var(--theme-text-primary);
}

.tag-tree-row__toggle-icon {
  transition: transform 150ms ease;
}

.tag-tree-row__toggle-icon--open {
  transform: rotate(90deg);
}

.tag-tree-row__leaf-dot::before {
  width: 7px;
  height: 7px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 42%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 18%, transparent);
  content: "";
}

.tag-tree-row__identity-text {
  position: relative;
  z-index: 1;
}

.tag-tree-row__tag {
  color: color-mix(in srgb, var(--theme-accent) 72%, var(--theme-text-primary));
}

.tag-tree-row__name {
  color: var(--theme-text-primary);
}

.tag-tree-row__keyword {
  color: var(--theme-text-muted);
}

.tag-tree-row__vr {
  color: color-mix(in srgb, var(--theme-accent-warm) 70%, var(--theme-text-secondary));
}

.tag-tree-row__value {
  display: -webkit-box;
  overflow: hidden;
  color: var(--theme-text-secondary);
  word-break: break-all;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tag-context-menu {
  position: relative;
  backdrop-filter: blur(16px);
}

.tag-context-menu__chrome {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(125, 211, 252, 0.18), transparent 30%),
    radial-gradient(circle at bottom left, color-mix(in srgb, var(--theme-accent-warm) 18%, transparent), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 34%);
  pointer-events: none;
}

.tag-context-menu__item {
  min-height: 50px;
  color: var(--theme-text-primary);
  transition:
    background-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.tag-context-menu__item:hover {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-accent) 14%, transparent),
    color-mix(in srgb, var(--theme-accent) 8%, transparent)
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 22px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}

.tag-context-menu__item--disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.tag-context-menu__item--disabled:hover {
  background: transparent;
  box-shadow: none;
  transform: none;
}

.tag-context-menu__thumb {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 24%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong) 86%, var(--theme-surface-card) 14%);
  color: color-mix(in srgb, var(--theme-text-primary) 78%, var(--theme-accent) 22%);
}

.tag-context-menu__badge {
  display: inline-flex;
  height: 24px;
  min-width: 38px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 22%, transparent);
  border-radius: 9999px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-accent) 16%, transparent),
    color-mix(in srgb, var(--theme-accent) 10%, var(--theme-surface-card))
  );
  color: color-mix(in srgb, var(--theme-text-primary) 84%, var(--theme-accent) 16%);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.tag-context-menu__badge--disabled {
  border-color: color-mix(in srgb, var(--theme-text-primary) 12%, transparent);
  background: color-mix(in srgb, var(--theme-text-primary) 6%, transparent);
  color: var(--theme-text-muted);
}
</style>
