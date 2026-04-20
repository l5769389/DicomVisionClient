import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { PSEUDOCOLOR_PRESET_OPTIONS, toPseudocolorSelectionValue } from '../../../constants/pseudocolor'
import { useUiPreferences } from '../../ui/useUiPreferences'
import { createDefaultVolumeRenderConfig } from '../volume/volumeRenderConfig'
import type { ViewerExportFormat } from '../export/viewExport'
import {
  createMenuController,
  createPlaybackController,
  createToolbarActivationController
} from './toolbarStateMachines'
import { createDefaultMprMipConfig, type MprMipConfig, type ViewerTabItem, type VolumeRenderConfig } from '../../../types/viewer'
import type { StackTool, StackToolOption } from '../../../components/workspace/shell/toolbarTypes'

const MODE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'qa', 'mtf', 'annotate'])
const SELECTABLE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'page', 'measure', 'qa', 'mtf', 'annotate'])
const DEFAULT_QA_OPERATION = 'qa:mtf'
const WATER_PHANTOM_QA_OPERATION = 'qa:water-phantom'

const measureTool: StackTool = {
  key: 'measure',
  label: 'Measure',
  icon: 'measure',
  kind: 'action',
  options: [
    { value: 'measure:line', label: 'Line', icon: 'measure-line' },
    { value: 'measure:rect', label: 'Rect', icon: 'measure-rect' },
    { value: 'measure:ellipse', label: 'Ellipse', icon: 'measure-ellipse' },
    { value: 'measure:angle', label: 'Angle', icon: 'measure-angle' }
  ]
}

const qaTool: StackTool = {
  key: 'qa',
  label: 'QA',
  icon: 'qa',
  kind: 'mode',
  showSelectedOptionIcon: false,
  options: [
    {
      value: DEFAULT_QA_OPERATION,
      label: 'MTF',
      icon: 'mtf',
      description: 'Spatial resolution from a metal point ROI',
      badge: 'Resolution',
      group: 'Spatial Resolution'
    },
    {
      value: WATER_PHANTOM_QA_OPERATION,
      label: 'Water Phantom QA',
      icon: 'water-phantom',
      description: 'Auto-detect water phantom and report accuracy, uniformity, and noise',
      badge: 'Water',
      group: 'Water Phantom'
    }
  ]
}

const pseudocolorTool: StackTool = {
  key: 'pseudocolor',
  label: 'Pseudocolor',
  icon: 'pseudocolor',
  swatchKey: 'bw',
  kind: 'action',
  options: PSEUDOCOLOR_PRESET_OPTIONS.map((option) => ({
    value: `pseudocolor:${option.key}`,
    label: option.label,
    icon: 'pseudocolor',
    swatchKey: option.key
  }))
}

const tagTool: StackTool = {
  key: 'tag',
  label: 'Tag',
  icon: 'tag',
  kind: 'action'
}

const exportTool: StackTool = {
  key: 'export',
  label: 'Export',
  icon: 'export',
  kind: 'action',
  options: [
    { value: 'png', label: 'PNG', icon: 'export' },
    { value: 'dicom', label: 'DICOM', icon: 'export' }
  ]
}

const stackTools: StackTool[] = [
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  {
    key: 'rotate',
    label: 'Rotate',
    icon: 'rotate',
    kind: 'action',
    options: [
      { value: 'rotate:cw90', label: 'CW 90', icon: 'rotate-cw90' },
      { value: 'rotate:ccw90', label: 'CCW 90', icon: 'rotate-ccw90' },
      { value: 'rotate:mirror-h', label: 'Mirror H', icon: 'mirror-h' },
      { value: 'rotate:mirror-v', label: 'Mirror V', icon: 'mirror-v' }
    ]
  },
  { key: 'reset', label: 'Reset', icon: 'reset', kind: 'action' },
  { key: 'page', label: 'Page', icon: 'page', kind: 'action' },
  tagTool,
  qaTool,
  { key: 'annotate', label: 'Annotate', icon: 'annotate', kind: 'mode' },
  measureTool,
  { key: 'play', label: 'Play', icon: 'play', kind: 'action' },
  exportTool,
  pseudocolorTool
]

const genericTools: StackTool[] = [
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  tagTool,
  qaTool,
  measureTool,
  pseudocolorTool,
  exportTool
]

const volumeTools: StackTool[] = [
  { key: 'rotate3d', label: '3D Rotate', icon: 'rotate3d', kind: 'mode' },
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  tagTool,
  { key: 'volumeParams', label: 'Params', icon: 'settings', kind: 'action' },
  {
    key: 'volumePreset',
    label: 'Preset',
    icon: 'volumePreset',
    kind: 'action',
    options: [
      { value: 'volumePreset:aaa', label: 'AAA', icon: 'volume-preset-aaa' },
      { value: 'volumePreset:red', label: 'Red', icon: 'volume-preset-red' },
      { value: 'volumePreset:cardiac', label: 'Cardiac', icon: 'volume-preset-cardiac' },
      { value: 'volumePreset:muscle', label: 'Muscle', icon: 'volume-preset-muscle' },
      { value: 'volumePreset:mip', label: 'MIP', icon: 'volume-preset-mip' }
    ]
  },
  { key: 'reset', label: 'Reset', icon: 'reset', kind: 'action' },
  exportTool
]

const genericToolsWithCrosshair: StackTool[] = [
  { key: 'crosshair', label: 'Crosshair', icon: 'crosshair', kind: 'mode' },
  { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' },
  ...genericTools
]

interface ViewerWorkspaceToolbarOptions {
  activeOperation: ComputedRef<string>
  activeTab: ComputedRef<ViewerTabItem | null>
  emitSetActiveOperation: (value: string) => void
  emitTriggerViewAction: (payload: {
    action: 'reset' | 'volumePreset' | 'rotate' | 'pseudocolor' | 'windowPreset' | 'mprMipConfig'
    value?: string
    config?: MprMipConfig
  }) => void
  emitViewportWheel: (deltaY: number) => void
  emitOpenSeriesView: (seriesId: string, viewType: 'Tag') => void
  exportCurrentView: (format: ViewerExportFormat) => void
  activeViewportKey: Ref<string>
  cleanupPointerInteractions: () => void
  stopViewportDrag: () => void
  setActiveViewport: (viewportKey: 'single' | 'volume' | 'mpr-ax' | 'mpr-cor' | 'mpr-sag') => void
}

interface StoredToolbarState {
  activeOperation: string
  activeToolKey: string
  selections: Partial<Record<string, string>>
}

export function useViewerWorkspaceToolbar(options: ViewerWorkspaceToolbarOptions) {
  const { getWindowPresetLabel, locale, selectedPseudocolorKey, selectedWindowPresetId, windowPresets } = useUiPreferences()
  const playbackController = createPlaybackController()
  const menuController = createMenuController()
  const toolbarActivationController = createToolbarActivationController('window')

  const playbackSnapshot = ref(playbackController.getSnapshot())
  const menuSnapshot = ref(menuController.getSnapshot())
  const toolbarActivationSnapshot = ref(toolbarActivationController.getSnapshot())

  const isVolumeConfigPanelOpen = ref(false)
  const isMprMipPanelOpen = ref(false)
  const stackToolSelections = ref<Partial<Record<string, string>>>({
    rotate: 'rotate:cw90',
    measure: 'measure:line',
    annotate: 'annotate:arrow',
    qa: DEFAULT_QA_OPERATION,
    pseudocolor: toPseudocolorSelectionValue(selectedPseudocolorKey.value),
    export: 'png',
    volumePreset: 'volumePreset:aaa'
  })
  const toolbarStateByTabKey = new Map<string, StoredToolbarState>()
  const pendingTransientCallback = ref<(() => void) | null>(null)

  const toolbarIconSize = 20
  const menuIconSize = 16
  const toggleIconSize = 12

  let playbackTimer: ReturnType<typeof window.setInterval> | null = null

  function formatWindowPresetValue(ww: number, wl: number): string {
    return `${ww}|${wl}`
  }

  const isPlaying = computed(() => playbackSnapshot.value.matches('playing'))
  const isPlaybackPaused = computed(() => playbackSnapshot.value.matches('paused'))
  const openMenuKey = computed(() => menuSnapshot.value.context.openKey)
  const activeToolbarToolKey = computed(() => toolbarActivationSnapshot.value.context.activeKey)
  const transientActiveToolKey = computed(() => toolbarActivationSnapshot.value.context.transientKey)

  const windowTool = computed<StackTool>(() => ({
    key: 'window',
    label: 'Window',
    icon: 'window',
    kind: 'mode',
    showSelectedOptionIcon: false,
    options: windowPresets.value.map((preset) => ({
      value: formatWindowPresetValue(preset.ww, preset.wl),
      label: getWindowPresetLabel(preset),
      icon: 'contrast',
      description: `WW ${Math.round(preset.ww)} / WL ${Math.round(preset.wl)}`,
      badge: preset.source === 'custom' ? (locale.value === 'zh-CN' ? '自定义' : 'Custom') : locale.value === 'zh-CN' ? '系统' : 'System'
    }))
  }))

  const activeTools = computed(() =>
    options.activeTab.value?.viewType === 'Stack'
      ? stackTools.map((tool) => (tool.key === 'window' ? windowTool.value : tool))
      : options.activeTab.value?.viewType === 'MPR'
        ? genericToolsWithCrosshair.map((tool) => (tool.key === 'window' ? windowTool.value : tool))
        : options.activeTab.value?.viewType === '3D'
          ? volumeTools
          : genericTools.map((tool) => (tool.key === 'window' ? windowTool.value : tool))
  )

  const areToolbarActionsDisabled = computed(
    () => options.activeTab.value?.viewType === 'Stack' && (isPlaying.value || isPlaybackPaused.value)
  )

  const activeVolumeRenderConfig = computed(() =>
    options.activeTab.value?.viewType === '3D'
      ? options.activeTab.value.volumeRenderConfig ?? createDefaultVolumeRenderConfig('aaa')
      : null
  )

  const activeMprMipConfig = computed(() => {
    const activeTab = options.activeTab.value
    if (!activeTab || activeTab.viewType !== 'MPR') {
      return null
    }

    return activeTab.mprMipConfig ?? createDefaultMprMipConfig()
  })

  function getModeOperationValue(toolKey: string): string {
    if (toolKey === 'page') {
      return `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`
    }
    if (toolKey === 'annotate') {
      return `${STACK_OPERATION_PREFIX}annotate:arrow`
    }
    if (toolKey === 'qa') {
      return `${STACK_OPERATION_PREFIX}${normalizeQaOperation(stackToolSelections.value.qa ?? DEFAULT_QA_OPERATION)}`
    }
    return `${STACK_OPERATION_PREFIX}${toolKey}`
  }

  function getDefaultToolbarToolKey(viewType: ViewerTabItem['viewType'] | undefined): string {
    if (viewType === 'MPR') {
      return 'crosshair'
    }
    if (viewType === '3D') {
      return 'rotate3d'
    }
    return 'window'
  }

  function setToolbarToolActive(toolKey: string): void {
    toolbarActivationController.setActive(toolKey)
  }

  function getDefaultOperationValue(viewType: ViewerTabItem['viewType'] | undefined): string {
    if (viewType === 'MPR') {
      return `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.crosshair}`
    }
    return getModeOperationValue(getDefaultToolbarToolKey(viewType))
  }

  function captureToolbarState(tabKey: string | undefined): void {
    if (!tabKey) {
      return
    }

    toolbarStateByTabKey.set(tabKey, {
      activeOperation: options.activeOperation.value,
      activeToolKey: activeToolbarToolKey.value,
      selections: { ...stackToolSelections.value }
    })
  }

  function restoreToolbarState(tabKey: string | undefined, viewType: ViewerTabItem['viewType'] | undefined): void {
    const savedState = tabKey ? toolbarStateByTabKey.get(tabKey) : null
    if (savedState) {
      stackToolSelections.value = {
        ...stackToolSelections.value,
        ...savedState.selections
      }
      setToolbarToolActive(savedState.activeToolKey)
      options.emitSetActiveOperation(savedState.activeOperation || getDefaultOperationValue(viewType))
      return
    }

    const defaultToolKey = getDefaultToolbarToolKey(viewType)
    setToolbarToolActive(defaultToolKey)
    options.emitSetActiveOperation(getDefaultOperationValue(viewType))
  }

  function flashToolActive(toolKey: string, nextToolKey: string, callback?: () => void): void {
    pendingTransientCallback.value = callback ?? null
    toolbarActivationController.flash(toolKey, nextToolKey)
  }

  function getSelectedOption(toolKey: string): StackToolOption | null {
    const tool =
      activeTools.value.find((item) => item.key === toolKey) ??
      stackTools.find((item) => item.key === toolKey) ??
      genericTools.find((item) => item.key === toolKey) ??
      volumeTools.find((item) => item.key === toolKey)
    const selectedValue = stackToolSelections.value[toolKey]
    if (!tool?.options || !selectedValue) {
      return null
    }
    return tool.options.find((item) => item.value === selectedValue) ?? null
  }

  function activateSelectedOption(toolKey: string): string | null {
    const selectedOption = getSelectedOption(toolKey)
    if (!selectedOption) {
      return null
    }
    options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${selectedOption.value}`)
    return selectedOption.value
  }

  function normalizeQaOperation(value: string): string {
    if (value === 'qa:water-accuracy' || value === 'qa:water-uniformity') {
      return WATER_PHANTOM_QA_OPERATION
    }
    if (value === 'qa:mtf' || value === WATER_PHANTOM_QA_OPERATION) {
      return value
    }
    return DEFAULT_QA_OPERATION
  }

  function isToolSelected(tool: StackTool): boolean {
    if (transientActiveToolKey.value === tool.key) {
      return true
    }
    return activeToolbarToolKey.value === tool.key
  }

  function closeMenus(): void {
    menuController.close()
  }

  function setMenuOpen(toolKey: string | null): void {
    if (toolKey == null) {
      menuController.close()
      return
    }
    menuController.toggle(toolKey)
  }

  function stopPlayback(): void {
    if (playbackTimer != null) {
      window.clearInterval(playbackTimer)
      playbackTimer = null
    }
    playbackController.stop()
  }

  function getCurrentStackSliceInfo(): { current: number; total: number } | null {
    const activeTab = options.activeTab.value
    if (!activeTab || activeTab.viewType !== 'Stack') {
      return null
    }

    const match = activeTab.sliceLabel.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
    if (!match) {
      return null
    }

    const current = Number(match[1])
    const total = Number(match[2])
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 1) {
      return null
    }

    return { current, total }
  }

  function tickPlayback(): void {
    const sliceInfo = getCurrentStackSliceInfo()
    if (!sliceInfo) {
      stopPlayback()
      return
    }

    if (sliceInfo.current >= sliceInfo.total) {
      stopPlayback()
      return
    }

    options.emitViewportWheel(1)
  }

  function startPlayback(): void {
    if (options.activeTab.value?.viewType !== 'Stack') {
      return
    }
    if (!getCurrentStackSliceInfo()) {
      return
    }

    if (playbackTimer != null) {
      window.clearInterval(playbackTimer)
      playbackTimer = null
    }
    closeMenus()
    playbackController.start()
    playbackTimer = window.setInterval(() => {
      tickPlayback()
    }, 180)
  }

  function resumePlayback(): void {
    if (options.activeTab.value?.viewType !== 'Stack') {
      stopPlayback()
      return
    }
    if (!getCurrentStackSliceInfo()) {
      stopPlayback()
      return
    }

    if (playbackTimer != null) {
      window.clearInterval(playbackTimer)
      playbackTimer = null
    }
    closeMenus()
    playbackController.resume()
    playbackTimer = window.setInterval(() => {
      tickPlayback()
    }, 180)
  }

  function pausePlayback(): void {
    closeMenus()
    if (isPlaying.value) {
      if (playbackTimer != null) {
        window.clearInterval(playbackTimer)
        playbackTimer = null
      }
      playbackController.pause()
      return
    }
    if (isPlaybackPaused.value) {
      resumePlayback()
    }
  }

  function endPlayback(): void {
    closeMenus()
    stopPlayback()
  }

  function updateActiveMprMipConfig(config: MprMipConfig): void {
    const activeTab = options.activeTab.value
    if (!activeTab || activeTab.viewType !== 'MPR') {
      return
    }

    options.emitTriggerViewAction({ action: 'mprMipConfig', config })
  }

  function applyTool(tool: StackTool): void {
    if (areToolbarActionsDisabled.value && tool.key !== 'play') {
      return
    }

    closeMenus()
    if (MODE_TOOL_KEYS.has(tool.key) || tool.key === 'page') {
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      if ((tool.key === 'measure' || tool.key === 'qa') && getSelectedOption(tool.key)) {
        activateSelectedOption(tool.key)
      } else {
        options.emitSetActiveOperation(getModeOperationValue(tool.key))
      }
      return
    }

    if (tool.key === 'reset') {
      options.stopViewportDrag()
      if (options.activeTab.value?.viewType === '3D') {
        stackToolSelections.value = {
          ...stackToolSelections.value,
          volumePreset: 'volumePreset:aaa'
        }
      }
      options.emitTriggerViewAction({ action: 'reset' })
      const defaultToolKey = getDefaultToolbarToolKey(options.activeTab.value?.viewType)
      flashToolActive('reset', defaultToolKey, () => {
        options.emitSetActiveOperation(getModeOperationValue(defaultToolKey))
      })
      return
    }

    if (tool.key === 'volumeParams') {
      isVolumeConfigPanelOpen.value = !isVolumeConfigPanelOpen.value
      return
    }

    if (tool.key === 'mprMip') {
      isMprMipPanelOpen.value = !isMprMipPanelOpen.value
      return
    }

    if (tool.key === 'volumePreset') {
      const selectedOption = getSelectedOption(tool.key)
      if (!selectedOption) {
        return
      }
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'volumePreset', value: selectedOption.value })
      })
      return
    }

    if (tool.key === 'rotate') {
      const selectedOption = getSelectedOption(tool.key)
      if (!selectedOption) {
        return
      }
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'rotate', value: selectedOption.value })
      })
      return
    }

    if (tool.key === 'pseudocolor') {
      const selectedOption = getSelectedOption(tool.key)
      if (!selectedOption) {
        return
      }
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'pseudocolor', value: selectedOption.value })
      })
      return
    }

    if (tool.key === 'measure' || tool.key === 'qa') {
      if (!getSelectedOption(tool.key)) {
        return
      }
      if (activeToolbarToolKey.value !== tool.key) {
        setToolbarToolActive(tool.key)
        activateSelectedOption(tool.key)
      }
      return
    }

    if (tool.key === 'play') {
      startPlayback()
      return
    }

    if (tool.key === 'tag') {
      const seriesId = options.activeTab.value?.seriesId?.trim() ?? ''
      if (seriesId) {
        options.emitOpenSeriesView(seriesId, 'Tag')
      }
      return
    }

    if (tool.key === 'export') {
      options.exportCurrentView((stackToolSelections.value.export as ViewerExportFormat | undefined) ?? 'png')
    }
  }

  function selectToolOption(tool: StackTool, optionValue: string): void {
    stackToolSelections.value = {
      ...stackToolSelections.value,
      [tool.key]: optionValue
    }
    closeMenus()

    if (tool.key === 'rotate') {
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'rotate', value: optionValue })
      })
      return
    }

    if (tool.key === 'pseudocolor') {
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'pseudocolor', value: optionValue })
      })
      return
    }

    if (tool.key === 'window') {
      const selectedPreset = windowPresets.value.find((preset) => formatWindowPresetValue(preset.ww, preset.wl) === optionValue)
      if (selectedPreset) {
        selectedWindowPresetId.value = selectedPreset.id
      }
      options.emitTriggerViewAction({ action: 'windowPreset', value: optionValue })
      return
    }

    if (tool.key === 'measure' || tool.key === 'qa') {
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${optionValue}`)
      return
    }

    if (tool.key === 'volumePreset') {
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'volumePreset', value: optionValue })
      })
      return
    }

    if (tool.key === 'export') {
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.exportCurrentView(optionValue as ViewerExportFormat)
      })
    }
  }

  function handleViewportClick(viewportKey: string): void {
    options.setActiveViewport(viewportKey as never)
  }

  function handleViewportWheel(payload: { viewportKey: string; deltaY: number; exact?: boolean }): void {
    options.setActiveViewport(payload.viewportKey as never)
    const delta = payload.exact ? payload.deltaY : payload.deltaY > 0 ? 1 : payload.deltaY < 0 ? -1 : 0
    if (!Number.isFinite(delta) || delta === 0) {
      return
    }
    options.emitViewportWheel(delta)
  }

  watch(
    () => [options.activeTab.value?.key, options.activeTab.value?.viewType] as const,
    ([tabKey, viewType], previousValue) => {
      const previousTabKey = previousValue?.[0]
      const previousViewType = previousValue?.[1]
      const tabOrViewChanged =
        previousTabKey === undefined || viewType !== previousViewType || options.activeTab.value?.key !== previousTabKey

      if (previousTabKey !== undefined && tabOrViewChanged) {
        options.stopViewportDrag()
      }

      if (tabOrViewChanged) {
        if (previousTabKey !== undefined && previousTabKey !== tabKey) {
          captureToolbarState(previousTabKey)
        }
        stopPlayback()
        isVolumeConfigPanelOpen.value = false
        isMprMipPanelOpen.value = false
        options.setActiveViewport(viewType === 'MPR' ? 'mpr-ax' : viewType === '3D' ? 'volume' : 'single')
        restoreToolbarState(tabKey, viewType)
        closeMenus()
      }
    },
    { immediate: true }
  )

  watch(
    () => options.activeOperation.value,
    (value, previousValue) => {
      const normalizeOperation = (operation: string | undefined): string =>
        operation ? (operation.startsWith(STACK_OPERATION_PREFIX) ? operation.slice(STACK_OPERATION_PREFIX.length) : operation) : ''

      const previousNormalized = normalizeOperation(previousValue)
      const currentNormalized = normalizeOperation(value)
      const isMeasurementToMeasurementSwitch =
        previousNormalized.startsWith('measure:') && currentNormalized.startsWith('measure:')

      if (previousValue !== undefined && value !== previousValue && !isMeasurementToMeasurementSwitch) {
        options.cleanupPointerInteractions()
      }
      if (!value) {
        const defaultToolKey = getDefaultToolbarToolKey(options.activeTab.value?.viewType)
        setToolbarToolActive(defaultToolKey)
        options.emitSetActiveOperation(getModeOperationValue(defaultToolKey))
        return
      }

      const operationWithoutPrefix = value.startsWith(STACK_OPERATION_PREFIX)
        ? value.slice(STACK_OPERATION_PREFIX.length)
        : value
      if (operationWithoutPrefix.startsWith('qa:')) {
        stackToolSelections.value = {
          ...stackToolSelections.value,
          qa: normalizeQaOperation(operationWithoutPrefix)
        }
      }

      const normalizedOperation = operationWithoutPrefix.split(':')[0]
      const matchedToolKey =
        normalizedOperation === VIEW_OPERATION_TYPES.scroll
          ? 'page'
          : normalizedOperation === 'mtf'
            ? 'qa'
            : normalizedOperation
      if (SELECTABLE_TOOL_KEYS.has(matchedToolKey)) {
        setToolbarToolActive(matchedToolKey)
      }
    },
    { immediate: true }
  )

  watch(
    () => selectedWindowPresetId.value,
    (value) => {
      const selectedPreset = windowPresets.value.find((preset) => preset.id === value) ?? windowPresets.value[0]
      if (!selectedPreset) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        window: formatWindowPresetValue(selectedPreset.ww, selectedPreset.wl)
      }
    },
    { immediate: true }
  )

  watch(
    () => options.activeTab.value?.volumePreset,
    (value) => {
      if (options.activeTab.value?.viewType !== '3D') {
        return
      }
      stackToolSelections.value = {
        ...stackToolSelections.value,
        volumePreset: value || 'volumePreset:aaa'
      }
    },
    { immediate: true }
  )

  watch(
    () => {
      const tab = options.activeTab.value
      if (!tab) {
        return selectedPseudocolorKey.value
      }
      if (tab.viewType === 'MPR') {
        return tab.viewportPseudocolorPresets?.[
          (options.activeViewportKey.value === 'single' || options.activeViewportKey.value === 'volume'
            ? 'mpr-ax'
            : options.activeViewportKey.value) as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
        ] ?? tab.pseudocolorPreset
      }
      return tab.pseudocolorPreset
    },
    (value) => {
      stackToolSelections.value = {
        ...stackToolSelections.value,
        pseudocolor: toPseudocolorSelectionValue(value)
      }
    },
    { immediate: true }
  )

  watch(
    () => selectedPseudocolorKey.value,
    (value) => {
      if (options.activeTab.value) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        pseudocolor: toPseudocolorSelectionValue(value)
      }
    },
    { immediate: true }
  )

  const playbackSubscription = playbackController.subscribe((snapshot) => {
    playbackSnapshot.value = snapshot
  })
  const menuSubscription = menuController.subscribe((snapshot) => {
    menuSnapshot.value = snapshot
  })
  const toolbarActivationSubscription = toolbarActivationController.subscribe((snapshot) => {
    const previousTransientKey = toolbarActivationSnapshot.value.context.transientKey
    toolbarActivationSnapshot.value = snapshot
    if (previousTransientKey != null && snapshot.context.transientKey == null) {
      pendingTransientCallback.value?.()
      pendingTransientCallback.value = null
    }
  })

  onBeforeUnmount(() => {
    stopPlayback()
    playbackSubscription.unsubscribe()
    menuSubscription.unsubscribe()
    toolbarActivationSubscription.unsubscribe()
    playbackController.shutdown()
    menuController.shutdown()
    toolbarActivationController.shutdown()
    pendingTransientCallback.value = null
  })

  return {
    activeTools,
    activeToolbarToolKey,
    activeMprMipConfig,
    activeVolumeRenderConfig,
    applyTool,
    areToolbarActionsDisabled,
    closeMenus,
    endPlayback,
    handleViewportClick,
    handleViewportWheel,
    isPlaying,
    isPlaybackPaused,
    isMprMipPanelOpen,
    isToolSelected,
    isVolumeConfigPanelOpen,
    menuIconSize,
    openMenuKey,
    pausePlayback,
    selectToolOption,
    setMenuOpen,
    stackToolSelections,
    toolbarIconSize,
    toggleIconSize,
    updateActiveMprMipConfig
  }
}
