<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { ViewerOperationItem, ViewerTabItem, WorkspaceReadyPayload } from '../types/viewer'
import { useViewerWorkspacePointer } from '../composables/useViewerWorkspacePointer'
import MprView from './viewer/MprView.vue'
import StackView from './viewer/StackView.vue'
import VolumeView from './viewer/VolumeView.vue'
import ViewerTabStrip from './workspace/ViewerTabStrip.vue'
import ViewerToolbar from './workspace/ViewerToolbar.vue'
import type { StackTool, StackToolOption } from './workspace/toolbarTypes'

const MODE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d'])
const SELECTABLE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'page'])

const props = defineProps<{
  activeOperation: string
  activeTab: ViewerTabItem | null
  activeTabKey: string
  hasSelectedSeries: boolean
  isViewLoading: boolean
  message: string
  operationItems?: ViewerOperationItem[]
  viewerTabs: ViewerTabItem[]
}>()

const emit = defineEmits<{
  activateTab: [tabKey: string]
  activeViewportChange: [viewportKey: string]
  closeTab: [tabKey: string]
  mprCrosshair: [payload: { viewportKey: string; phase: 'start' | 'move' | 'end'; x: number; y: number }]
  setActiveOperation: [value: string]
  viewportDrag: [payload: { deltaX: number; deltaY: number; opType: string; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [deltaY: number]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = useTemplateRef<HTMLElement>('viewportHostRef')
const tabStripRef = ref<HTMLElement | null>(null)
const workspaceRef = ref<HTMLElement | null>(null)
const isPlaying = ref(false)
const isPlaybackPaused = ref(false)
const openMenuKey = ref<string | null>(null)
const activeToolbarToolKey = ref<string>('window')
const transientActiveToolKey = ref<string | null>(null)
const canScrollTabsLeft = ref(false)
const canScrollTabsRight = ref(false)
const stackToolSelections = ref<Partial<Record<string, string>>>({
  rotate: 'rotate:cw90',
  measure: 'measure:line'
})
const activeTabRef = computed(() => props.activeTab)
const activeOperationRef = computed(() => props.activeOperation)
const toolbarIconSize = 20
const menuIconSize = 16
const toggleIconSize = 12
let playbackTimer: ReturnType<typeof window.setInterval> | null = null
let transientToolTimer: ReturnType<typeof window.setTimeout> | null = null

const {
  activeViewportKey,
  cleanupPointerInteractions,
  handleViewportPointerCancel,
  handleViewportPointerDown,
  handleViewportPointerMove,
  handleViewportPointerUp,
  setActiveViewport,
  stopViewportDrag
} = useViewerWorkspacePointer({
  activeOperation: activeOperationRef,
  activeTab: activeTabRef,
  emitActiveViewportChange: (viewportKey) => emit('activeViewportChange', viewportKey),
  emitMprCrosshair: (payload) => emit('mprCrosshair', payload),
  emitViewportDrag: (payload) => emit('viewportDrag', payload)
})

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
  {
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
  },
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
  { key: 'export', label: '导出', icon: 'export', kind: 'action' }
]

const volumeTools: StackTool[] = [
  { key: 'rotate3d', label: '3D旋转', icon: 'rotate3d', kind: 'mode' },
  { key: 'pan', label: '平移', icon: 'pan', kind: 'mode' },
  { key: 'zoom', label: '缩放', icon: 'zoom', kind: 'mode' },
  { key: 'window', label: '调窗', icon: 'window', kind: 'mode' },
  { key: 'export', label: '导出', icon: 'export', kind: 'action' }
]

const genericToolsWithCrosshair: StackTool[] = [
  { key: 'crosshair', label: '十字线', icon: 'crosshair', kind: 'mode' },
  ...genericTools
]

const activeTools = computed(() =>
  props.activeTab?.viewType === 'Stack'
    ? stackTools
    : props.activeTab?.viewType === 'MPR'
      ? genericToolsWithCrosshair
      : props.activeTab?.viewType === '3D'
        ? volumeTools
        : genericTools
)
const areToolbarActionsDisabled = computed(() => props.activeTab?.viewType === 'Stack' && (isPlaying.value || isPlaybackPaused.value))

function emitWorkspaceReady(): void {
  const activeViewport = viewportHostRef.value?.querySelector<HTMLElement>('[data-active-render-surface="true"]')
  const stageElement = props.activeTab?.viewType === 'MPR' ? viewportHostRef.value ?? null : activeViewport ?? null
  const viewportElements = Object.fromEntries(
    Array.from(viewportHostRef.value?.querySelectorAll<HTMLElement>('[data-viewport-key]') ?? []).map((element) => [
      element.dataset.viewportKey ?? '',
      element
    ])
  )

  emit('workspaceReady', {
    element: stageElement,
    viewportKey: activeViewportKey.value,
    viewportElements
  })
}

function updateTabScrollState(): void {
  const element = tabStripRef.value
  if (!element || !props.viewerTabs.length) {
    canScrollTabsLeft.value = false
    canScrollTabsRight.value = false
    return
  }

  const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
  canScrollTabsLeft.value = element.scrollLeft > 4
  canScrollTabsRight.value = element.scrollLeft < maxScrollLeft - 4
}

function scrollTabs(direction: 'left' | 'right'): void {
  const element = tabStripRef.value
  if (!element) {
    return
  }

  const offset = Math.max(220, Math.floor(element.clientWidth * 0.55))
  element.scrollBy({
    left: direction === 'left' ? -offset : offset,
    behavior: 'smooth'
  })
}

function scrollActiveTabIntoView(): void {
  const element = tabStripRef.value
  const activeTabKey = props.activeTabKey
  if (!element || !activeTabKey) {
    return
  }

  const activeElement = Array.from(element.children).find(
    (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.tabKey === activeTabKey
  )
  if (!activeElement) {
    return
  }

  activeElement.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center'
  })
}

function handleTabStripWheel(event: WheelEvent): void {
  const element = tabStripRef.value
  if (!element || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
    return
  }

  event.preventDefault()
  element.scrollLeft += event.deltaY
  updateTabScrollState()
}

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

function setToolbarToolActive(toolKey: string): void {
  clearTransientActiveTool()
  activeToolbarToolKey.value = toolKey
}

function clearTransientActiveTool(): void {
  if (transientToolTimer != null) {
    window.clearTimeout(transientToolTimer)
    transientToolTimer = null
  }
  transientActiveToolKey.value = null
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
  const tool = stackTools.find((item) => item.key === toolKey)
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

  emit('setActiveOperation', `${STACK_OPERATION_PREFIX}${selectedOption.value}`)
  return selectedOption.value
}

function isToolSelected(tool: StackTool): boolean {
  if (transientActiveToolKey.value === tool.key) {
    return true
  }

  return activeToolbarToolKey.value === tool.key
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
    emit('viewportWheel', 1)
  }, 180)
}

function exportActiveImage(): void {
  const activeTab = props.activeTab
  if (!activeTab) {
    return
  }

  const imageSrc =
    activeTab.viewType === 'MPR'
      ? activeTab.viewportImages?.[activeViewportKey.value === 'single' || activeViewportKey.value === 'volume' ? 'mpr-ax' : activeViewportKey.value]
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

function closeMenus(): void {
  openMenuKey.value = null
}

function setMenuOpen(toolKey: string | null): void {
  openMenuKey.value = toolKey
}

function applyTool(tool: StackTool): void {
  if (areToolbarActionsDisabled.value && tool.key !== 'play') {
    return
  }

  closeMenus()
  if (MODE_TOOL_KEYS.has(tool.key) || tool.key === 'page') {
    stopViewportDrag()
    setToolbarToolActive(tool.key)
    emit('setActiveOperation', getModeOperationValue(tool.key))
    return
  }

  if (tool.key === 'reset') {
    stopViewportDrag()
    const defaultToolKey = getDefaultToolbarToolKey(props.activeTab?.viewType)
    flashToolActive('reset', defaultToolKey, () => {
      emit('setActiveOperation', getModeOperationValue(defaultToolKey))
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
    stopViewportDrag()
    setToolbarToolActive(tool.key)
    emit('setActiveOperation', `${STACK_OPERATION_PREFIX}${optionValue}`)
  }
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

function handleViewportClick(viewportKey: string): void {
  setActiveViewport(viewportKey as never)
}

function handleViewportWheel(payload: { viewportKey: string; deltaY: number }): void {
  setActiveViewport(payload.viewportKey as never)
  emit('viewportWheel', payload.deltaY)
}

function handleDocumentPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    closeMenus()
    return
  }

  if (target.closest('[data-tool-menu-root]')) {
    return
  }

  closeMenus()
}

watch(
  () => [props.activeTabKey, props.activeTab?.viewType] as const,
  ([, viewType], previousValue) => {
    const previousTabKey = previousValue?.[0]
    const previousViewType = previousValue?.[1]
    const tabOrViewChanged =
      previousTabKey === undefined || props.activeTabKey !== previousTabKey || viewType !== previousViewType

    if (previousTabKey !== undefined && tabOrViewChanged) {
      stopViewportDrag()
    }

    if (tabOrViewChanged) {
      stopPlayback()
      setActiveViewport(viewType === 'MPR' ? 'mpr-ax' : viewType === '3D' ? 'volume' : 'single')
      setToolbarToolActive(getDefaultToolbarToolKey(viewType))
      if (viewType === 'MPR') {
        emit('setActiveOperation', `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.crosshair}`)
      } else {
        emit('setActiveOperation', getModeOperationValue(getDefaultToolbarToolKey(viewType)))
      }
      closeMenus()
    }

  },
  { immediate: true }
)

onMounted(() => {
  emitWorkspaceReady()
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('resize', updateTabScrollState)
  void nextTick().then(updateTabScrollState)
})

watch(
  () => [props.activeTabKey, props.activeTab?.viewType, props.isViewLoading] as const,
  async () => {
    await nextTick()
    emitWorkspaceReady()
    scrollActiveTabIntoView()
    updateTabScrollState()
  }
)

watch(
  () => props.viewerTabs.length,
  async () => {
    await nextTick()
    scrollActiveTabIntoView()
    updateTabScrollState()
  },
  { immediate: true }
)

watch(
  () => props.activeOperation,
  (value) => {
    if (!value) {
      const defaultToolKey = getDefaultToolbarToolKey(props.activeTab?.viewType)
      setToolbarToolActive(defaultToolKey)
      emit('setActiveOperation', getModeOperationValue(defaultToolKey))
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

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', updateTabScrollState)
  stopPlayback()
  clearTransientActiveTool()
  cleanupPointerInteractions()
})
</script>

<template>
  <main
    ref="workspaceRef"
    class="min-h-0 min-w-0 overflow-hidden rounded-[26px] border border-sky-100/10 bg-[linear-gradient(180deg,rgba(6,13,24,0.97),rgba(7,14,27,0.99))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_56px_rgba(0,0,0,0.28)]"
  >
    <div v-if="!hasSelectedSeries" class="grid h-full place-items-center rounded-[20px] border border-dashed border-white/8 bg-[linear-gradient(180deg,rgba(7,14,25,0.94),rgba(4,9,18,0.98))] p-8 text-center">
      <div class="max-w-xl space-y-3">
        <div class="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400/70">Viewer Workspace</div>
        <div class="text-3xl font-semibold tracking-[0.08em] text-slate-50">等待载入序列</div>
        <div class="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-sky-300/45 to-transparent"></div>
        <p class="text-sm leading-7 text-slate-300">
          {{ message || '请先在左侧序列列表中选择一个序列，然后打开对应视图。' }}
        </p>
      </div>
    </div>

    <div v-else class="flex h-full min-h-0 flex-col gap-3">
      <ViewerTabStrip
        v-model:tab-strip-ref="tabStripRef"
        :active-tab-key="activeTabKey"
        :can-scroll-tabs-left="canScrollTabsLeft"
        :can-scroll-tabs-right="canScrollTabsRight"
        :viewer-tabs="viewerTabs"
        @activate-tab="emit('activateTab', $event)"
        @close-tab="emit('closeTab', $event)"
        @scroll-tabs="scrollTabs"
        @tab-strip-scroll="updateTabScrollState"
        @tab-strip-wheel="handleTabStripWheel"
      />

      <ViewerToolbar
        v-if="activeTab"
        :active-tab="activeTab"
        :active-tools="activeTools"
        :are-toolbar-actions-disabled="areToolbarActionsDisabled"
        :is-playing="isPlaying"
        :is-playback-paused="isPlaybackPaused"
        :is-tool-selected="isToolSelected"
        :menu-icon-size="menuIconSize"
        :open-menu-key="openMenuKey"
        :stack-tool-selections="stackToolSelections"
        :toggle-icon-size="toggleIconSize"
        :toolbar-icon-size="toolbarIconSize"
        @apply-tool="applyTool"
        @end-playback="endPlayback"
        @pause-playback="pausePlayback"
        @select-tool-option="selectToolOption"
        @set-menu-open="setMenuOpen"
      />

      <div v-if="isViewLoading" class="grid flex-1 place-items-center rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,14,24,0.92),rgba(6,11,20,0.98))] p-8">
        <div class="flex items-center gap-3 text-sm text-slate-300">
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.14)]"></span>
          <span>正在加载视图...</span>
        </div>
      </div>

      <div
        v-else-if="activeTab"
        ref="viewportHostRef"
        class="flex-1 overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,14,24,0.92),rgba(6,11,20,0.98)),repeating-linear-gradient(90deg,rgba(255,255,255,0.015)_0,rgba(255,255,255,0.015)_1px,transparent_1px,transparent_28px)] p-2.5"
      >
        <StackView
          v-if="activeTab.viewType === 'Stack'"
          :active-tab="activeTab"
          @viewport-click="handleViewportClick"
          @viewport-wheel="handleViewportWheel"
          @pointer-down="handleViewportPointerDown"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />

        <MprView
          v-else-if="activeTab.viewType === 'MPR'"
          :active-tab="activeTab"
          :active-viewport-key="activeViewportKey"
          @viewport-click="handleViewportClick"
          @viewport-wheel="handleViewportWheel"
          @pointer-down="handleViewportPointerDown"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />

        <VolumeView
          v-else
          :active-tab="activeTab"
          @viewport-click="handleViewportClick"
          @pointer-down="handleViewportPointerDown"
          @pointer-move="handleViewportPointerMove"
          @pointer-up="handleViewportPointerUp"
          @pointer-cancel="handleViewportPointerCancel"
        />
      </div>

      <div v-else class="grid flex-1 place-items-center rounded-[20px] border border-dashed border-white/8 bg-[linear-gradient(180deg,rgba(7,14,25,0.94),rgba(4,9,18,0.98))] p-8 text-center">
        <div class="max-w-lg space-y-3">
          <div class="text-2xl font-semibold tracking-[0.06em] text-slate-50">打开一个视图</div>
          <p class="text-sm leading-7 text-slate-300">
            {{ message || '点击“快速浏览 / 3D / MPR”打开当前序列对应的视图。' }}
          </p>
        </div>
      </div>
    </div>
  </main>
</template>

