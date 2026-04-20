import { computed, onMounted, ref, type ComputedRef } from 'vue'
import { clearStoredWebExportDirectory, canChooseCustomExportDirectory, chooseCustomExportDirectory, getDefaultExportLocationLabel, openExportLocation } from '../../platform/exporting'
import { viewerRuntime } from '../../platform/runtime'
import { useUiPreferences } from '../ui/useUiPreferences'
import type { SettingsCopy } from '../ui/uiMessages'

export function useExportSettings(copy: ComputedRef<SettingsCopy>) {
  const { exportPreference, setExportPreference } = useUiPreferences()
  const defaultExportLocationLabel = ref('')
  const canPickCustomExportLocation = ref(canChooseCustomExportDirectory())
  const exportLocationError = ref('')
  const isChoosingExportLocation = ref(false)

  const exportLocationLabel = computed(() => {
    if (exportPreference.value.locationMode === 'custom') {
      return viewerRuntime.platform === 'desktop'
        ? exportPreference.value.desktopDirectory || copy.value.exportCustomMissing
        : exportPreference.value.webDirectoryName || copy.value.exportCustomMissing
    }

    return defaultExportLocationLabel.value || copy.value.exportDefaultHint
  })

  const customExportLocationLabel = computed(() =>
    viewerRuntime.platform === 'desktop'
      ? exportPreference.value.desktopDirectory || copy.value.exportCustomMissing
      : exportPreference.value.webDirectoryName || copy.value.exportCustomMissing
  )

  const exportCustomLocationHint = computed(() => {
    if (!canPickCustomExportLocation.value) {
      return copy.value.exportUnsupportedHint
    }

    return copy.value.exportCustomHint
  })

  const exportLocationDescription = computed(() =>
    viewerRuntime.platform === 'desktop'
      ? copy.value.exportDesktopMode
      : copy.value.exportWebMode
  )

  const canOpenDefaultExportLocation = computed(
    () => viewerRuntime.platform === 'desktop' && exportPreference.value.locationMode === 'default' && Boolean(defaultExportLocationLabel.value)
  )

  function resetExportSection(): void {
    setExportPreference({
      ...exportPreference.value,
      locationMode: 'default',
      desktopDirectory: null,
      webDirectoryName: null
    })
    if (viewerRuntime.platform === 'web') {
      void clearStoredWebExportDirectory()
    }
  }

  function handleSelectDefaultExportMode(): void {
    exportLocationError.value = ''
    setExportPreference({
      ...exportPreference.value,
      locationMode: 'default'
    })
  }

  function handleSelectCustomExportMode(): void {
    exportLocationError.value = ''
    setExportPreference({
      ...exportPreference.value,
      locationMode: 'custom'
    })
  }

  async function handleChooseExportLocation(): Promise<void> {
    exportLocationError.value = ''
    isChoosingExportLocation.value = true

    try {
      const selectedDirectory = await chooseCustomExportDirectory()
      if (!selectedDirectory) {
        return
      }

      setExportPreference({
        ...exportPreference.value,
        locationMode: 'custom',
        desktopDirectory: selectedDirectory.desktopDirectory ?? exportPreference.value.desktopDirectory,
        webDirectoryName: selectedDirectory.webDirectoryName ?? exportPreference.value.webDirectoryName
      })
    } catch (error) {
      console.error('Failed to choose export location.', error)
      exportLocationError.value = copy.value.exportChooseFailed
    } finally {
      isChoosingExportLocation.value = false
    }
  }

  async function handleOpenDefaultExportLocation(): Promise<void> {
    if (!defaultExportLocationLabel.value) {
      return
    }

    exportLocationError.value = ''
    const opened = await openExportLocation({
      directoryPath: defaultExportLocationLabel.value
    })
    if (!opened) {
      exportLocationError.value = copy.value.exportOpenLocationFailed
    }
  }

  function updateExportOverlayPreference(
    format: 'png' | 'dicom',
    kind: 'measurements' | 'annotations' | 'cornerInfo',
    enabled: boolean
  ): void {
    setExportPreference({
      ...exportPreference.value,
      includeDicomAnnotations:
        format === 'dicom' && kind === 'annotations' ? enabled : exportPreference.value.includeDicomAnnotations,
      includeDicomMeasurements:
        format === 'dicom' && kind === 'measurements' ? enabled : exportPreference.value.includeDicomMeasurements,
      includePngAnnotations:
        format === 'png' && kind === 'annotations' ? enabled : exportPreference.value.includePngAnnotations,
      includePngCornerInfo:
        format === 'png' && kind === 'cornerInfo' ? enabled : exportPreference.value.includePngCornerInfo,
      includePngMeasurements:
        format === 'png' && kind === 'measurements' ? enabled : exportPreference.value.includePngMeasurements
    })
  }

  function updateUseDefaultFileName(enabled: boolean): void {
    setExportPreference({
      ...exportPreference.value,
      useDefaultFileName: enabled
    })
  }

  async function handleClearExportLocation(): Promise<void> {
    exportLocationError.value = ''
    if (viewerRuntime.platform === 'web') {
      await clearStoredWebExportDirectory()
    }
    resetExportSection()
  }

  onMounted(async () => {
    try {
      defaultExportLocationLabel.value = await getDefaultExportLocationLabel()
    } catch (error) {
      console.error('Failed to resolve default export location.', error)
      defaultExportLocationLabel.value = ''
    }
  })

  return {
    canOpenDefaultExportLocation,
    canPickCustomExportLocation,
    customExportLocationLabel,
    exportCustomLocationHint,
    exportLocationDescription,
    exportLocationError,
    exportLocationLabel,
    exportPreference,
    handleChooseExportLocation,
    handleClearExportLocation,
    handleOpenDefaultExportLocation,
    handleSelectCustomExportMode,
    handleSelectDefaultExportMode,
    isChoosingExportLocation,
    resetExportSection,
    updateExportOverlayPreference,
    updateUseDefaultFileName
  }
}
