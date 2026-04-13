import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { createDefaultVolumeRenderConfig } from './volumeRenderConfig'
import type { ViewerTabItem, VolumeRenderConfig } from '../../types/viewer'
import type { StackTool, StackToolOption } from '../../components/workspace/toolbarTypes'

const MODE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d'])
const SELECTABLE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'page', 'measure'])

const measureTool: StackTool = {
  key: 'measure',
  label: '测量',
  icon: 'measure',
  kind: 'action',
  options: [
    { value: 'measure:line', label: '线段', icon: 'measure-line' },
    { value: 'measure:rect', label: '矩形', icon: 'measure-rect' },
    { value: 'measure:ellipse', label: '椭圆', icon: 'measure-ellipse' },
    { value: 'measure:angle', label: '角度', icon: 'measure-angle' }
  ]
}

const stackTools: StackTool[] = [
  { key: 'pan', label: '平移', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: '缩放', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: '调窗', icon: 'window', kind: 'mode' },
  {
    key: 'rotate',
    label: '旋转',
    icon: 'rotate',
    kind: 'action',
    options: [
      { value: 'rotate:cw90', label: '顺时针 90°', icon: 'rotate-cw90' },
      { value: 'rotate:ccw90', label: '逆时针 90°', icon: 'rotate-ccw90' },
      { value: 'rotate:mirror-h', label: '水平镜像', icon: 'mirror-h' },
      { value: 'rotate:mirror-v', label: '垂直镜像', icon: 'mirror-v' }
    ]
  },
  { key: 'reset', label: '重置', icon: 'reset', kind: 'action' },
  { key: 'page', label: '翻页', icon: 'page', kind: 'action' },
  { key: 'annotate', label: '标注', icon: 'annotate', kind: 'action' },
  measureTool,
  { key: 'play', label: '播放', icon: 'play', kind: 'action' },
  { key: 'export', label: '导出', icon: 'export', kind: 'action' },
  {
    key: 'pseudocolor',
    label: '伪彩',
    icon: 'pseudocolor',
    kind: 'action',
    options: [
      { value: 'pseudocolor:gray', label: '灰度', icon: 'pseudocolor-gray' },
      { value: 'pseudocolor:hot', label: 'Hot', icon: 'pseudocolor-hot' },
      { value: 'pseudocolor:pet', label: 'PET', icon: 'pseudocolor-pet' },
      { value: 'pseudocolor:rainbow', label: '彩虹', icon: 'pseudocolor-rainbow' }
    ]
  }
]

const genericTools: StackTool[] = [
  { key: 'pan', label: '平移', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: '缩放', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: '调窗', icon: 'window', kind: 'mode' },
  measureTool,
  { key: 'export', label: '导出', icon: 'export', kind: 'action' }
]

const volumeTools: StackTool[] = [
  { key: 'rotate3d', label: '3D旋转', icon: 'rotate3d', kind: 'mode' },
  { key: 'pan', label: '平移', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: '缩放', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: '调窗', icon: 'window', kind: 'mode' },
  { key: 'volumeParams', label: '参数', icon: 'settings', kind: 'action' },
  {
    key: 'volumePreset',
    label: '模板',
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
  { key: 'reset', label: '重置', icon: 'reset', kind: 'action' },
  { key: 'export', label: '导出', icon: 'export', kind: 'action' }
]

const genericToolsWithCrosshair: StackTool[] = [{ key: 'crosshair', label: '十字线', icon: 'crosshair', kind: 'mode' }, ...genericTools]

interface ViewerWorkspaceToolbarOptions {
  activeOperation: ComputedRef<string>
  activeTab: ComputedRef<ViewerTabItem | null>
  emitSetActiveOperation: (value: string) => void
  emitTriggerViewAction: (payload: { action: 'reset' | 'volumePreset'; value?: string }) => void
  emitViewportWheel: (deltaY: number) => void
  activeViewportKey: Ref<string>
  cleanupPointerInteractions: () => void
  stopViewportDrag: () => void
  setActiveViewport: (viewportKey: 'single' | 'volume' | 'mpr-ax' | 'mpr-cor' | 'mpr-sag') => void
}

export function useViewerWorkspaceToolbar(options: ViewerWorkspaceToolbarOptions) {
  const isPlaying = ref(false)
  const isPlaybackPaused = ref(false)
  const openMenuKey = ref<string | null>(null)
  const activeToolbarToolKey = ref<string>('window')
  const transientActiveToolKey = ref<string | null>(null)
  const isVolumeConfigPanelOpen = ref(false)
  const stackToolSelections = ref<Partial<Record<string, string>>>({
    rotate: 'rotate:cw90',
    measure: 'measure:line',
    volumePreset: 'volumePreset:aaa'
  })

  const toolbarIconSize = 20
  const menuIconSize = 16
  const toggleIconSize = 12

  let playbackTimer: ReturnType<typeof window.setInterval> | null = null
  let transientToolTimer: ReturnType<typeof window.setTimeout> | null = null

  const activeTools = computed(() =>
    options.activeTab.value?.viewType === 'Stack'
      ? stackTools
      : options.activeTab.value?.viewType === 'MPR'
        ? genericToolsWithCrosshair
        : options.activeTab.value?.viewType === '3D'
          ? volumeTools
          : genericTools
  )

  const areToolbarActionsDisabled = computed(
    () => options.activeTab.value?.viewType === 'Stack' && (isPlaying.value || isPlaybackPaused.value)
  )

  const activeVolumeRenderConfig = computed(() =>
    options.activeTab.value?.viewType === '3D'
      ? options.activeTab.value.volumeRenderConfig ?? createDefaultVolumeRenderConfig('aaa')
      : null
  )

  function getModeOperationValue(toolKey: string): string {
    if (toolKey === 'page') {
      return `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`
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

  function clearTransientActiveTool(): void {
    if (transientToolTimer != null) {
      window.clearTimeout(transientToolTimer)
      transientToolTimer = null
    }
    transientActiveToolKey.value = null
  }

  function setToolbarToolActive(toolKey: string): void {
    clearTransientActiveTool()
    activeToolbarToolKey.value = toolKey
  }

  function flashToolActive(toolKey: string, nextToolKey: string, callback?: () => void): void {
    clearTransientActiveTool()
    transientActiveToolKey.value = toolKey
    transientToolTimer = window.setTimeout(() => {
      transientActiveToolKey.value = null
      activeToolbarToolKey.value = nextToolKey
      transientToolTimer = null
      callback?.()
    }, 260)
  }

  function getSelectedOption(toolKey: string): StackToolOption | null {
    const tool = stackTools.find((item) => item.key === toolKey) ?? volumeTools.find((item) => item.key === toolKey)
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

  function isToolSelected(tool: StackTool): boolean {
    if (transientActiveToolKey.value === tool.key) {
      return true
    }
    return activeToolbarToolKey.value === tool.key
  }

  function closeMenus(): void {
    openMenuKey.value = null
  }

  function setMenuOpen(toolKey: string | null): void {
    openMenuKey.value = toolKey
  }

  function stopPlayback(): void {
    if (playbackTimer != null) {
      window.clearInterval(playbackTimer)
      playbackTimer = null
    }
    isPlaying.value = false
    isPlaybackPaused.value = false
  }

  function startPlayback(): void {
    if (playbackTimer != null) {
      window.clearInterval(playbackTimer)
      playbackTimer = null
    }
    closeMenus()
    isPlaying.value = true
    isPlaybackPaused.value = false
    playbackTimer = window.setInterval(() => {
      options.emitViewportWheel(1)
    }, 180)
  }

  function pausePlayback(): void {
    closeMenus()
    if (isPlaying.value) {
      if (playbackTimer != null) {
        window.clearInterval(playbackTimer)
        playbackTimer = null
      }
      isPlaying.value = false
      isPlaybackPaused.value = true
      return
    }
    if (isPlaybackPaused.value) {
      startPlayback()
    }
  }

  function endPlayback(): void {
    closeMenus()
    stopPlayback()
  }

  function exportActiveImage(): void {
    const activeTab = options.activeTab.value
    if (!activeTab) {
      return
    }

    const imageSrc =
      activeTab.viewType === 'MPR'
        ? activeTab.viewportImages?.[
            (options.activeViewportKey.value === 'single' || options.activeViewportKey.value === 'volume'
              ? 'mpr-ax'
              : options.activeViewportKey.value) as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
          ]
        : activeTab.imageSrc
    if (!imageSrc) {
      return
    }

    const anchor = document.createElement('a')
    const safeTitle = activeTab.seriesTitle.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'dicom-view'
    anchor.href = imageSrc
    anchor.download = `${safeTitle}-${activeTab.viewType}.png`
    anchor.click()
  }

  function applyTool(tool: StackTool): void {
    if (areToolbarActionsDisabled.value && tool.key !== 'play') {
      return
    }

    closeMenus()
    if (MODE_TOOL_KEYS.has(tool.key) || tool.key === 'page') {
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitSetActiveOperation(getModeOperationValue(tool.key))
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
      if (!activateSelectedOption(tool.key)) {
        return
      }
      setToolbarToolActive(tool.key)
      return
    }

    if (tool.key === 'measure' || tool.key === 'pseudocolor') {
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

    if (tool.key === 'export') {
      exportActiveImage()
    }
  }

  function selectToolOption(tool: StackTool, optionValue: string): void {
    stackToolSelections.value = {
      ...stackToolSelections.value,
      [tool.key]: optionValue
    }
    closeMenus()

    if (tool.key === 'rotate' || tool.key === 'measure' || tool.key === 'pseudocolor') {
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${optionValue}`)
      return
    }

    if (tool.key === 'volumePreset') {
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'volumePreset', value: optionValue })
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
    ([, viewType], previousValue) => {
      const previousTabKey = previousValue?.[0]
      const previousViewType = previousValue?.[1]
      const tabOrViewChanged = previousTabKey === undefined || viewType !== previousViewType || options.activeTab.value?.key !== previousTabKey

      if (previousTabKey !== undefined && tabOrViewChanged) {
        options.stopViewportDrag()
      }

      if (tabOrViewChanged) {
        stopPlayback()
        isVolumeConfigPanelOpen.value = false
        options.setActiveViewport(viewType === 'MPR' ? 'mpr-ax' : viewType === '3D' ? 'volume' : 'single')
        setToolbarToolActive(getDefaultToolbarToolKey(viewType))
        if (viewType === 'MPR') {
          options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.crosshair}`)
        } else {
          options.emitSetActiveOperation(getModeOperationValue(getDefaultToolbarToolKey(viewType)))
        }
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

      const normalizedOperation = value.startsWith(STACK_OPERATION_PREFIX)
        ? value.slice(STACK_OPERATION_PREFIX.length).split(':')[0]
        : value.split(':')[0]
      const matchedToolKey = normalizedOperation === VIEW_OPERATION_TYPES.scroll ? 'page' : normalizedOperation
      if (SELECTABLE_TOOL_KEYS.has(matchedToolKey)) {
        setToolbarToolActive(matchedToolKey)
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

  onBeforeUnmount(() => {
    stopPlayback()
    clearTransientActiveTool()
  })

  return {
    activeTools,
    activeToolbarToolKey,
    activeVolumeRenderConfig,
    applyTool,
    areToolbarActionsDisabled,
    closeMenus,
    endPlayback,
    handleViewportClick,
    handleViewportWheel,
    isPlaying,
    isPlaybackPaused,
    isToolSelected,
    isVolumeConfigPanelOpen,
    menuIconSize,
    openMenuKey,
    pausePlayback,
    selectToolOption,
    setMenuOpen,
    stackToolSelections,
    toolbarIconSize,
    toggleIconSize
  }
}
