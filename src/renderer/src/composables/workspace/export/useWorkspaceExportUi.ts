import { computed, nextTick, ref, type ComputedRef, type Ref } from 'vue'
import { openExportLocation, type ExportedFileResult } from '../../../platform/exporting'
import { viewerRuntime } from '../../../platform/runtime'
import type { WorkspaceExportCopy } from '../../ui/uiMessages'
import type { ViewerExportFormat } from './viewExport'

export interface WorkspaceExportNoticeState {
  canOpenLocation: boolean
  directoryPath?: string | null
  filePath?: string | null
  message: string
  title: string
}

export function normalizeExportFileNameStem(value: string, format: ViewerExportFormat): string {
  const extensionPattern = format === 'png' ? /\.png$/i : /\.(dcm|dicom)$/i
  return value
    .trim()
    .replace(extensionPattern, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.+$/g, '')
    .trim()
}

export function useWorkspaceExportUi(copy: ComputedRef<WorkspaceExportCopy>, inputRef: Ref<HTMLInputElement | null>) {
  const exportNotice = ref<WorkspaceExportNoticeState | null>(null)
  const isExportNameDialogOpen = ref(false)
  const exportNameDialogFormat = ref<ViewerExportFormat>('png')
  const exportNameInput = ref('')
  const exportNameError = ref('')
  let exportNoticeTimer: ReturnType<typeof setTimeout> | null = null
  let resolveExportNameDialog: ((value: string | null) => void) | null = null

  const exportNameExtension = computed(() => (exportNameDialogFormat.value === 'png' ? 'png' : 'dcm'))

  function clearExportNoticeTimer(): void {
    if (!exportNoticeTimer) {
      return
    }

    clearTimeout(exportNoticeTimer)
    exportNoticeTimer = null
  }

  function showExportNotice(result: ExportedFileResult | null, format: ViewerExportFormat): void {
    clearExportNoticeTimer()

    if (!result) {
      exportNotice.value = {
        canOpenLocation: false,
        message: copy.value.unableToExport,
        title: copy.value.exportNotCompleted
      }
      return
    }

    const formatLabel = format === 'png' ? 'PNG' : 'DICOM'
    exportNotice.value = {
      canOpenLocation: viewerRuntime.platform === 'desktop' && Boolean(result.filePath || result.directoryPath),
      directoryPath: result.directoryPath,
      filePath: result.filePath,
      message:
        result.mode === 'download'
          ? copy.value.sentToDownloads(formatLabel)
          : copy.value.exportedTo(result.locationDescription ?? result.directoryPath ?? 'the selected location'),
      title: copy.value.exportComplete
    }

    exportNoticeTimer = setTimeout(() => {
      exportNotice.value = null
      exportNoticeTimer = null
    }, 8000)
  }

  async function handleOpenExportLocation(): Promise<void> {
    if (!exportNotice.value) {
      return
    }

    const opened = await openExportLocation({
      directoryPath: exportNotice.value.directoryPath,
      filePath: exportNotice.value.filePath
    })
    if (!opened) {
      exportNotice.value = {
        ...exportNotice.value,
        canOpenLocation: false,
        message: copy.value.openLocationFailed
      }
    }
  }

  async function requestExportFileName(format: ViewerExportFormat, defaultFileNameStem: string): Promise<string | null> {
    if (resolveExportNameDialog) {
      resolveExportNameDialog(null)
    }

    exportNameDialogFormat.value = format
    exportNameInput.value = defaultFileNameStem
    exportNameError.value = ''
    isExportNameDialogOpen.value = true

    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()

    return new Promise((resolve) => {
      resolveExportNameDialog = resolve
    })
  }

  function closeExportNameDialog(value: string | null): void {
    const resolve = resolveExportNameDialog
    resolveExportNameDialog = null
    isExportNameDialogOpen.value = false
    exportNameError.value = ''
    if (resolve) {
      resolve(value)
    }
  }

  function cancelExportNameDialog(): void {
    closeExportNameDialog(null)
  }

  function confirmExportNameDialog(): void {
    const normalizedName = normalizeExportFileNameStem(exportNameInput.value, exportNameDialogFormat.value)
    if (!normalizedName) {
      exportNameError.value = copy.value.invalidFileName
      return
    }

    closeExportNameDialog(normalizedName)
  }

  function showExportFailureNotice(): void {
    clearExportNoticeTimer()
    exportNotice.value = {
      canOpenLocation: false,
      message: copy.value.exportFailedMessage,
      title: copy.value.exportFailed
    }
  }

  function cleanupExportUi(): void {
    clearExportNoticeTimer()
    closeExportNameDialog(null)
  }

  return {
    cancelExportNameDialog,
    cleanupExportUi,
    confirmExportNameDialog,
    exportNameDialogFormat,
    exportNameError,
    exportNameExtension,
    exportNameInput,
    exportNotice,
    handleOpenExportLocation,
    isExportNameDialogOpen,
    requestExportFileName,
    showExportFailureNotice,
    showExportNotice
  }
}
