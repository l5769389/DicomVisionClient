import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { PSEUDOCOLOR_PRESET_OPTIONS, toPseudocolorSelectionValue } from '../../../constants/pseudocolor'
import { useUiPreferences } from '../../ui/useUiPreferences'
import { createDefaultVolumeRenderConfig } from '../volume/volumeRenderConfig'
import type { ViewerExportFormat } from '../export/viewExport'
import {
  createViewerLayoutOptionValue,
  parseViewerLayoutOptionValue,
  VIEWER_LAYOUT_PRESETS
} from '../layout/viewerLayoutTemplates'
import {
  MPR_LAYOUT_OPTIONS,
  parseMprLayoutSelectionValue,
  toMprLayoutSelectionValue
} from '../layout/mprLayoutOptions'
import {
  createMenuController,
  createPlaybackController,
  createToolbarActivationController
} from './toolbarStateMachines'
import {
  COMPARE_STACK_SOURCE_PANE_KEY,
  COMPARE_STACK_TARGET_PANE_KEY
} from '../views/viewerWorkspaceTabs'
import { getViewSyncEnabled, VIEW_SYNC_OPTION_CONFIGS } from '../sync/viewSyncConfig'
import type { ViewerToolbarActionPayload } from '../operations/viewActionTypes'
import {
  createDefaultMprMipConfig,
  normalizeMprMipConfig,
  type CompareSyncSettingKey,
  type MprMipConfig,
  type ViewerLayoutTemplate,
  type ViewerTabItem,
  type VolumeRenderConfig
} from '../../../types/viewer'
import type { StackTool, StackToolOption } from '../../../components/workspace/shell/toolbarTypes'

const MODE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'qa', 'mtf', 'annotate'])
const SELECTABLE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'page', 'measure', 'qa', 'mtf', 'annotate'])
const DEFAULT_QA_OPERATION = 'qa:mtf'
const WATER_PHANTOM_QA_OPERATION = 'qa:water-phantom'
const STACK_PLAYBACK_DEFAULT_FPS = 5
const STACK_PLAYBACK_FPS_OPTIONS = [1, 2, 5, 10, 15, 30] as const

const measureTool: StackTool = {
  key: 'measure',
  label: 'Measure',
  icon: 'measure',
  kind: 'action',
  options: [
    { value: 'measure:line', label: 'Line', icon: 'measure-line' },
    { value: 'measure:rect', label: 'Rect', icon: 'measure-rect' },
    { value: 'measure:ellipse', label: 'Ellipse', icon: 'measure-ellipse' },
    { value: 'measure:angle', label: 'Angle', icon: 'measure-angle' },
    { value: 'measure:curve', label: 'Curve', icon: 'measure-curve' },
    { value: 'measure:freeform', label: 'Freeform', icon: 'measure-freeform' }
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

const layoutTool: StackTool = {
  key: 'layout',
  label: 'Layout',
  icon: 'layout',
  kind: 'action',
  menuKind: 'layout',
  showSelectedOptionIcon: false,
  options: VIEWER_LAYOUT_PRESETS.map((template) => ({
    value: createViewerLayoutOptionValue(template),
    label: template.label,
    icon: 'layout',
    layoutRows: template.rows,
    layoutColumns: template.columns
  }))
}

const mprLayoutTool: StackTool = {
  key: 'mprLayout',
  label: 'MPR Layout',
  icon: 'layout',
  kind: 'action',
  menuKind: 'mprLayout',
  showSelectedOptionIcon: false,
  options: MPR_LAYOUT_OPTIONS.map((option) => ({
    value: toMprLayoutSelectionValue(option.key),
    label: option.label,
    icon: 'layout',
    disabled: option.disabled,
    mprLayoutKey: option.key
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

const playTool: StackTool = {
  key: 'play',
  label: 'Play',
  icon: 'play',
  kind: 'action',
  showSelectedOptionIcon: false,
  options: STACK_PLAYBACK_FPS_OPTIONS.map((fps) => ({
    value: `playbackFps:${fps}`,
    label: `FPS ${fps}`,
    icon: 'play'
  }))
}

const stackTools: StackTool[] = [
  layoutTool,
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
  { key: 'page', label: 'Page', icon: 'page', kind: 'action' },
  playTool,
  pseudocolorTool,
  { key: 'annotate', label: 'Annotate', icon: 'annotate', kind: 'mode' },
  measureTool,
  qaTool,
  exportTool,
  tagTool,
  {
    key: 'reset',
    label: 'Reset',
    icon: 'reset',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      { value: 'reset:view', label: 'Reset View', icon: 'reset', description: 'Reset WW/WL, transforms, pseudocolor, and view state.' },
      { value: 'reset:measurements', label: 'Clear Measurements', icon: 'measure', description: 'Remove all measurement overlays in the current view.' },
      { value: 'reset:mtf', label: 'Clear MTF', icon: 'mtf', description: 'Remove all MTF ROIs in the current view.' },
      { value: 'reset:annotations', label: 'Clear Annotations', icon: 'annotate', description: 'Remove all annotation overlays in the current view.' },
      { value: 'reset:all', label: 'Reset All', icon: 'trash', description: 'Reset the view and clear measurements, MTF, and annotations.' }
    ]
  }
]

function withoutMtfResetOption(tool: StackTool): StackTool {
  if (tool.key !== 'reset') {
    return tool
  }

  return {
    ...tool,
    options: tool.options
      ?.filter((option) => option.value !== 'reset:mtf')
      .map((option) =>
        option.value === 'reset:all'
          ? {
              ...option,
              description: 'Reset the view and clear measurements and annotations.'
            }
          : option
      )
  }
}

const compareStackTools: StackTool[] = stackTools
  .filter((tool) => tool.key !== 'play' && tool.key !== 'qa')
  .map(withoutMtfResetOption)

const layoutStackTools: StackTool[] = stackTools
  .filter((tool) => tool.key !== 'qa')
  .map(withoutMtfResetOption)

const genericTools: StackTool[] = [
  layoutTool,
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  measureTool,
  pseudocolorTool,
  exportTool,
  tagTool
]

const volumeParamsTool: StackTool = { key: 'volumeParams', label: 'Params', icon: 'settings', kind: 'action' }

const volumePresetTool: StackTool = {
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
}

const volumeTools: StackTool[] = [
  layoutTool,
  { key: 'rotate3d', label: '3D Rotate', icon: 'rotate3d', kind: 'mode' },
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  volumeParamsTool,
  volumePresetTool,
  exportTool,
  tagTool,
  {
    key: 'reset',
    label: 'Reset',
    icon: 'reset',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      { value: 'reset:view', label: 'Reset View', icon: 'reset', description: 'Reset 3D view parameters and rendering defaults.' },
      { value: 'reset:all', label: 'Reset All', icon: 'trash', description: 'Reset the view and clear any local overlays.' }
    ]
  }
]

const genericToolsWithCrosshair: StackTool[] = [
  mprLayoutTool,
  { key: 'crosshair', label: 'Crosshair', icon: 'crosshair', kind: 'mode' },
  { key: 'rotate3d', label: '3D Rotate', icon: 'rotate3d', kind: 'mode' },
  { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' },
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  measureTool,
  pseudocolorTool,
  exportTool,
  tagTool,
  {
    key: 'reset',
    label: 'Reset',
    icon: 'reset',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      { value: 'reset:view', label: 'Reset View', icon: 'reset', description: 'Reset crosshair, MIP config, transforms, and pseudocolor.' },
      { value: 'reset:measurements', label: 'Clear Measurements', icon: 'measure', description: 'Remove all measurements in the current MPR study.' },
      { value: 'reset:mtf', label: 'Clear MTF', icon: 'mtf', description: 'Remove all MTF ROIs in the current MPR study.' },
      { value: 'reset:annotations', label: 'Clear Annotations', icon: 'annotate', description: 'Remove all annotation overlays in the current MPR study.' },
      { value: 'reset:all', label: 'Reset All', icon: 'trash', description: 'Reset the view and clear measurements, MTF, and annotations.' }
    ]
  }
]

const mprWithVolumeTools: StackTool[] = genericToolsWithCrosshair.flatMap((tool) =>
  tool.key === 'mprMip' ? [tool, volumeParamsTool, volumePresetTool] : [tool]
)

interface ViewerWorkspaceToolbarOptions {
  activeOperation: ComputedRef<string>
  activeTab: ComputedRef<ViewerTabItem | null>
  emitSetActiveOperation: (value: string) => void
  emitTriggerViewAction: (payload: ViewerToolbarActionPayload) => void
  emitCompareSyncChange: (payload: { tabKey: string; key: CompareSyncSettingKey; value: boolean }) => void
  emitOpenLayoutView: (template: ViewerLayoutTemplate) => void | Promise<void>
  emitViewportWheel: (payload: { viewportKey: string; deltaY: number }) => void
  emitOpenSeriesView: (seriesId: string, viewType: 'Tag') => void
  exportCurrentView: (format: ViewerExportFormat) => void
  activeViewportKey: Ref<string>
  cleanupPointerInteractions: () => void
  stopViewportDrag: () => void
  setActiveViewport: (viewportKey: string) => void
}

interface StoredToolbarState {
  activeOperation: string
  activeToolKey: string
  selections: Partial<Record<string, string>>
}

export function useViewerWorkspaceToolbar(options: ViewerWorkspaceToolbarOptions) {
  const { getWindowPresetLabel, locale, mprDefaultLayoutKey, selectedPseudocolorKey, selectedWindowPresetId, windowPresets } = useUiPreferences()
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
    play: `playbackFps:${STACK_PLAYBACK_DEFAULT_FPS}`,
    pseudocolor: toPseudocolorSelectionValue(selectedPseudocolorKey.value),
    export: 'png',
    volumePreset: 'volumePreset:aaa',
    layout: createViewerLayoutOptionValue(VIEWER_LAYOUT_PRESETS[0]!),
    mprLayout: toMprLayoutSelectionValue(mprDefaultLayoutKey.value),
    reset: 'reset:view'
  })
  const toolbarStateByTabKey = new Map<string, StoredToolbarState>()
  const pendingTransientCallback = ref<(() => void) | null>(null)

  const toolbarIconSize = 18
  const menuIconSize = 15
  const toggleIconSize = 11

  let playbackTimer: ReturnType<typeof window.setInterval> | null = null

  function formatWindowPresetValue(ww: number, wl: number): string {
    return `${ww}|${wl}`
  }

  function clampStackPlaybackFps(value: number | null | undefined): number {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return STACK_PLAYBACK_DEFAULT_FPS
    }
    return Math.max(1, Math.min(30, Math.trunc(numericValue)))
  }

  function parseStackPlaybackFps(value: string | null | undefined): number {
    const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
    return clampStackPlaybackFps(match ? Number(match[1]) : STACK_PLAYBACK_DEFAULT_FPS)
  }

  function getStackPlaybackFps(): number {
    return parseStackPlaybackFps(stackToolSelections.value.play)
  }

  function getStackPlaybackIntervalMs(): number {
    return Math.max(33, Math.round(1000 / getStackPlaybackFps()))
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

  function getCompareSyncEnabled(tab: ViewerTabItem | null | undefined, key: CompareSyncSettingKey): boolean {
    return tab ? getViewSyncEnabled(tab, key) : false
  }

  const compareSyncTool = computed<StackTool>(() => {
    const tab = options.activeTab.value
    return {
      key: 'compareSync',
      label: 'Sync',
      icon: 'sync',
      kind: 'action',
      showSelectedOptionIcon: false,
      options: VIEW_SYNC_OPTION_CONFIGS.map(({ key, value, label, icon, description }) => ({
        value,
        label,
        icon,
        description,
        checked: getCompareSyncEnabled(tab, key),
        syncKey: key
      }))
    }
  })

  const activeMprLayoutKey = computed(() => parseMprLayoutSelectionValue(stackToolSelections.value.mprLayout))
  const isActiveMpr3dLayout = computed(() => options.activeTab.value?.viewType === 'MPR' && activeMprLayoutKey.value === 'mpr-3d')

  function withDynamicWindowTool(tools: StackTool[]): StackTool[] {
    return tools.map((tool) => (tool.key === 'window' ? windowTool.value : tool))
  }

  function withSyncToolAfterLayout(tools: StackTool[]): StackTool[] {
    return tools.flatMap((tool) => (tool.key === 'layout' ? [tool, compareSyncTool.value] : [tool]))
  }

  function getBaseToolsForActiveTab(): StackTool[] {
    const viewType = options.activeTab.value?.viewType
    switch (viewType) {
      case 'Stack':
        return stackTools
      case 'CompareStack':
        return withSyncToolAfterLayout(compareStackTools)
      case 'MPR':
        return isActiveMpr3dLayout.value ? mprWithVolumeTools : genericToolsWithCrosshair
      case '4D':
        return genericToolsWithCrosshair
      case 'Layout':
        return withSyncToolAfterLayout(layoutStackTools)
      case '3D':
        return volumeTools
      default:
        return genericTools
    }
  }

  const activeTools = computed(() => withDynamicWindowTool(getBaseToolsForActiveTab()))

  const areToolbarActionsDisabled = computed(
    () =>
      (supportsStackPlayback(options.activeTab.value?.viewType) && (isPlaying.value || isPlaybackPaused.value)) ||
      Boolean(options.activeTab.value?.viewType === '4D' && options.activeTab.value.fourDIsPlaying)
  )

  const activeVolumeRenderConfig = computed(() => {
    const tab = options.activeTab.value
    if (!tab || (tab.viewType !== '3D' && !isActiveMpr3dLayout.value)) {
      return null
    }

    return tab.volumeRenderConfig ?? createDefaultVolumeRenderConfig('aaa')
  })

  const activeMprMipConfig = computed(() => {
    const activeTab = options.activeTab.value
    if (!activeTab || (activeTab.viewType !== 'MPR' && activeTab.viewType !== '4D')) {
      return null
    }

    return normalizeMprMipConfig(activeTab.mprMipConfig, createDefaultMprMipConfig())
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

  function supportsStackPlayback(viewType: ViewerTabItem['viewType'] | undefined): boolean {
    return viewType === 'Stack' || viewType === 'Layout'
  }

  function getActiveLayoutSlot(tab: ViewerTabItem): NonNullable<ViewerTabItem['layoutSlots']>[number] | null {
    const slots = tab.layoutSlots ?? []
    return slots.find((slot) => slot.id === options.activeViewportKey.value && slot.viewId) ?? slots.find((slot) => Boolean(slot.viewId)) ?? null
  }

  function getActiveSeriesIdForTab(tab: ViewerTabItem | null | undefined): string {
    if (!tab) {
      return ''
    }
    if (tab.viewType === 'Layout') {
      return getActiveLayoutSlot(tab)?.seriesId?.trim() ?? tab.seriesId?.trim() ?? ''
    }
    return tab.seriesId?.trim() ?? ''
  }

  function getDefaultToolbarToolKey(viewType: ViewerTabItem['viewType'] | undefined): string {
    if (viewType === 'MPR' || viewType === '4D') {
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

  function isToolAvailable(toolKey: string): boolean {
    return activeTools.value.some((tool) => tool.key === toolKey)
  }

  function isMprLayoutView(viewType: ViewerTabItem['viewType'] | undefined): boolean {
    return viewType === 'MPR' || viewType === '4D'
  }

  function getDefaultMprLayoutSelectionValue(): string {
    return toMprLayoutSelectionValue(mprDefaultLayoutKey.value)
  }

  function withViewDefaultSelections(
    selections: Partial<Record<string, string>>,
    viewType: ViewerTabItem['viewType'] | undefined
  ): Partial<Record<string, string>> {
    if (!isMprLayoutView(viewType)) {
      return selections
    }

    const selectedMprLayout = parseMprLayoutSelectionValue(selections.mprLayout)
    if (selectedMprLayout) {
      return selections
    }

    return {
      ...selections,
      mprLayout: getDefaultMprLayoutSelectionValue()
    }
  }

  function getDefaultOperationValue(viewType: ViewerTabItem['viewType'] | undefined): string {
    if (viewType === 'MPR' || viewType === '4D') {
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
      const defaultToolKey = getDefaultToolbarToolKey(viewType)
      const activeToolKey = isToolAvailable(savedState.activeToolKey) ? savedState.activeToolKey : defaultToolKey
      stackToolSelections.value = withViewDefaultSelections({
        ...stackToolSelections.value,
        ...savedState.selections
      }, viewType)
      setToolbarToolActive(activeToolKey)
      options.emitSetActiveOperation(activeToolKey === savedState.activeToolKey && savedState.activeOperation ? savedState.activeOperation : getDefaultOperationValue(viewType))
      return
    }

    const defaultToolKey = getDefaultToolbarToolKey(viewType)
    stackToolSelections.value = isMprLayoutView(viewType)
      ? {
          ...stackToolSelections.value,
          mprLayout: getDefaultMprLayoutSelectionValue()
        }
      : stackToolSelections.value
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

  function startPlaybackTimer(): void {
    if (playbackTimer != null) {
      window.clearInterval(playbackTimer)
    }
    playbackTimer = window.setInterval(() => {
      tickPlayback()
    }, getStackPlaybackIntervalMs())
  }

  function restartPlaybackTimerIfActive(): void {
    if (!isPlaying.value) {
      return
    }
    startPlaybackTimer()
  }

  function getCurrentStackSliceInfo(): { current: number; total: number } | null {
    const activeTab = options.activeTab.value
    if (!activeTab || !supportsStackPlayback(activeTab.viewType)) {
      return null
    }

    const sliceLabel = activeTab.viewType === 'Layout' ? (getActiveLayoutSlot(activeTab)?.sliceLabel ?? '') : activeTab.sliceLabel
    const match = sliceLabel.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
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

  function getPlaybackViewportKey(): string {
    const activeTab = options.activeTab.value
    if (activeTab?.viewType === 'Layout') {
      return getActiveLayoutSlot(activeTab)?.id ?? options.activeViewportKey.value
    }
    return 'single'
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

    options.emitViewportWheel({
      viewportKey: getPlaybackViewportKey(),
      deltaY: 1
    })
  }

  function startPlayback(): void {
    if (!supportsStackPlayback(options.activeTab.value?.viewType)) {
      return
    }
    if (!getCurrentStackSliceInfo()) {
      return
    }

    closeMenus()
    playbackController.start()
    startPlaybackTimer()
  }

  function resumePlayback(): void {
    if (!supportsStackPlayback(options.activeTab.value?.viewType)) {
      stopPlayback()
      return
    }
    if (!getCurrentStackSliceInfo()) {
      stopPlayback()
      return
    }

    closeMenus()
    playbackController.resume()
    startPlaybackTimer()
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
    if (!activeTab || (activeTab.viewType !== 'MPR' && activeTab.viewType !== '4D')) {
      return
    }

    options.emitTriggerViewAction({ action: 'mprMipConfig', config })
  }

  function activateModeTool(tool: StackTool): void {
    closeMenus()
    options.stopViewportDrag()
    setToolbarToolActive(tool.key)
    if ((tool.key === 'measure' || tool.key === 'qa') && getSelectedOption(tool.key)) {
      activateSelectedOption(tool.key)
    } else {
      options.emitSetActiveOperation(getModeOperationValue(tool.key))
    }
  }

  function toggleToolMenu(tool: StackTool): void {
    setMenuOpen(openMenuKey.value === tool.key ? null : tool.key)
  }

  function applyResetTool(): void {
    closeMenus()
    options.stopViewportDrag()
    stackToolSelections.value = {
      ...stackToolSelections.value,
      reset: 'reset:view'
    }
    if (options.activeTab.value?.viewType === '3D' || (isActiveMpr3dLayout.value && options.activeViewportKey.value === 'volume')) {
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
  }

  function applySelectedViewAction(
    tool: StackTool,
    action: 'volumePreset' | 'rotate' | 'pseudocolor'
  ): void {
    closeMenus()
    const selectedOption = getSelectedOption(tool.key)
    if (!selectedOption) {
      return
    }
    flashToolActive(tool.key, activeToolbarToolKey.value, () => {
      options.emitTriggerViewAction({ action, value: selectedOption.value })
    })
  }

  function applySelectedModeTool(tool: StackTool): void {
    closeMenus()
    if (!getSelectedOption(tool.key)) {
      return
    }
    if (activeToolbarToolKey.value !== tool.key) {
      setToolbarToolActive(tool.key)
      activateSelectedOption(tool.key)
    }
  }

  const toolApplyHandlers: Record<string, (tool: StackTool) => void> = {
    compareSync: toggleToolMenu,
    layout: toggleToolMenu,
    mprLayout: toggleToolMenu,
    reset: () => applyResetTool(),
    volumeParams: () => {
      closeMenus()
      isVolumeConfigPanelOpen.value = !isVolumeConfigPanelOpen.value
    },
    mprMip: () => {
      closeMenus()
      isMprMipPanelOpen.value = !isMprMipPanelOpen.value
    },
    volumePreset: (tool) => applySelectedViewAction(tool, 'volumePreset'),
    rotate: (tool) => applySelectedViewAction(tool, 'rotate'),
    pseudocolor: (tool) => applySelectedViewAction(tool, 'pseudocolor'),
    measure: applySelectedModeTool,
    qa: applySelectedModeTool,
    play: () => {
      closeMenus()
      startPlayback()
    },
    tag: () => {
      closeMenus()
      const seriesId = getActiveSeriesIdForTab(options.activeTab.value)
      if (seriesId) {
        options.emitOpenSeriesView(seriesId, 'Tag')
      }
    },
    export: () => {
      closeMenus()
      options.exportCurrentView((stackToolSelections.value.export as ViewerExportFormat | undefined) ?? 'png')
    }
  }

  function applyTool(tool: StackTool): void {
    if (areToolbarActionsDisabled.value && tool.key !== 'play') {
      return
    }

    if (MODE_TOOL_KEYS.has(tool.key) || tool.key === 'page') {
      activateModeTool(tool)
      return
    }

    toolApplyHandlers[tool.key]?.(tool)
  }

  function selectToolOption(tool: StackTool, optionValue: string): void {
    if (tool.key === 'mprLayout') {
      const layoutKey = parseMprLayoutSelectionValue(optionValue)
      const selectedOption = tool.options?.find((option) => option.value === optionValue)
      if (!layoutKey || selectedOption?.disabled) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        mprLayout: optionValue
      }
      closeMenus()
      return
    }

    if (tool.key === 'layout') {
      const template = parseViewerLayoutOptionValue(optionValue)
      if (!template) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        layout: optionValue
      }
      closeMenus()
      void options.emitOpenLayoutView(template)
      return
    }

    if (tool.key === 'compareSync') {
      const activeTab = options.activeTab.value
      const selectedOption = tool.options?.find((option) => option.value === optionValue)
      if (!activeTab || (activeTab.viewType !== 'CompareStack' && activeTab.viewType !== 'Layout') || !selectedOption?.syncKey) {
        return
      }
      options.emitCompareSyncChange({
        tabKey: activeTab.key,
        key: selectedOption.syncKey,
        value: !selectedOption.checked
      })
      return
    }

    if (tool.key === 'play') {
      const fps = parseStackPlaybackFps(optionValue)
      stackToolSelections.value = {
        ...stackToolSelections.value,
        play: `playbackFps:${fps}`
      }
      closeMenus()
      restartPlaybackTimerIfActive()
      return
    }

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

    if (tool.key === 'reset') {
      stackToolSelections.value = {
        ...stackToolSelections.value,
        reset: 'reset:view'
      }
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        if (optionValue === 'reset:measurements') {
          options.emitTriggerViewAction({ action: 'clearMeasurements' })
          return
        }
        if (optionValue === 'reset:mtf') {
          options.emitTriggerViewAction({ action: 'clearMtf' })
          return
        }
        if (optionValue === 'reset:annotations') {
          options.emitTriggerViewAction({ action: 'clearAnnotations' })
          return
        }
        if (optionValue === 'reset:all') {
          options.emitTriggerViewAction({ action: 'resetAll' })
          return
        }
        options.emitTriggerViewAction({ action: 'reset' })
      })
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
    options.setActiveViewport(viewportKey)
  }

  function handleViewportWheel(payload: { viewportKey: string; deltaY: number; exact?: boolean }): void {
    options.setActiveViewport(payload.viewportKey)
    const delta = payload.exact ? payload.deltaY : payload.deltaY > 0 ? 1 : payload.deltaY < 0 ? -1 : 0
    if (!Number.isFinite(delta) || delta === 0) {
      return
    }
    options.emitViewportWheel({
      viewportKey: payload.viewportKey,
      deltaY: delta
    })
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
        options.setActiveViewport(
          viewType === 'MPR' || viewType === '4D'
            ? 'mpr-ax'
            : viewType === '3D'
              ? 'volume'
              : viewType === 'CompareStack'
                ? COMPARE_STACK_SOURCE_PANE_KEY
                : viewType === 'Layout'
                  ? (options.activeTab.value?.layoutSlots?.find((slot) => Boolean(slot.viewId))?.id ?? 'layout')
                  : 'single'
        )
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
        if (!isToolAvailable(matchedToolKey)) {
          return
        }
        setToolbarToolActive(matchedToolKey)
      }
    },
    { immediate: true }
  )

  watch(
    () => mprDefaultLayoutKey.value,
    (value) => {
      if (!isMprLayoutView(options.activeTab.value?.viewType) && options.activeTab.value) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        mprLayout: toMprLayoutSelectionValue(value)
      }
    }
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
      if (options.activeTab.value?.viewType !== '3D' && !isActiveMpr3dLayout.value) {
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
      if (tab.viewType === 'MPR' || tab.viewType === '4D') {
        return tab.viewportPseudocolorPresets?.[
          (options.activeViewportKey.value === 'single' || options.activeViewportKey.value === 'volume'
            ? 'mpr-ax'
            : options.activeViewportKey.value) as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
        ] ?? tab.pseudocolorPreset
      }
      if (tab.viewType === 'CompareStack') {
        const viewportKey =
          options.activeViewportKey.value === COMPARE_STACK_TARGET_PANE_KEY
            ? COMPARE_STACK_TARGET_PANE_KEY
            : COMPARE_STACK_SOURCE_PANE_KEY
        return tab.comparePseudocolorPresets?.[viewportKey] ?? tab.pseudocolorPreset
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
