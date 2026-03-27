<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { STACK_DEFAULT_OPERATION, STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import type { ViewerOperationItem, ViewerTabItem, WorkspaceReadyPayload } from '../types/viewer'
import { useViewerWorkspacePointer } from '../composables/useViewerWorkspacePointer'
import AppIcon from './AppIcon.vue'
import MprView from './viewer/MprView.vue'
import StackView from './viewer/StackView.vue'
import VolumeView from './viewer/VolumeView.vue'

interface StackToolOption {
  value: string
  label: string
  icon: string
}

interface StackTool {
  key: string
  label: string
  icon: string
  options?: StackToolOption[]
}

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
  viewportDrag: [payload: { deltaX: number; deltaY: number; phase: 'start' | 'move' | 'end'; viewportKey: string }]
  viewportWheel: [deltaY: number]
  workspaceReady: [payload: WorkspaceReadyPayload]
}>()

const viewportHostRef = useTemplateRef<HTMLElement>('viewportHostRef')
const isPlaying = ref(false)
const stackToolSelections = ref<Record<string, string>>({
  rotate: 'rotate:cw90',
  measure: 'measure:line',
  pseudocolor: 'pseudocolor:gray'
})
const activeTabRef = computed(() => props.activeTab)
const activeOperationRef = computed(() => props.activeOperation)
const toolbarIconSize = 25
const menuIconSize = 18
const toggleIconSize = 14
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
  { key: 'pan', label: '平移', icon: 'pan' },
  { key: 'zoom', label: '缩放', icon: 'zoom' },
  { key: 'window', label: '调窗', icon: 'window' },
  {
    key: 'rotate',
    label: '旋转',
    icon: 'rotate',
    options: [
      { value: 'rotate:cw90', label: '顺时针 90°', icon: 'rotate-cw90' },
      { value: 'rotate:ccw90', label: '逆时针 90°', icon: 'rotate-ccw90' },
      { value: 'rotate:mirror-h', label: '水平镜像', icon: 'mirror-h' },
      { value: 'rotate:mirror-v', label: '垂直镜像', icon: 'mirror-v' }
    ]
  },
  { key: 'reset', label: '重置', icon: 'reset' },
  { key: 'page', label: '翻页', icon: 'page' },
  { key: 'annotate', label: '标注', icon: 'annotate' },
  {
    key: 'measure',
    label: '测量',
    icon: 'measure',
    options: [
      { value: 'measure:line', label: '线段', icon: 'measure-line' },
      { value: 'measure:rect', label: '矩形', icon: 'measure-rect' },
      { value: 'measure:ellipse', label: '椭圆', icon: 'measure-ellipse' },
      { value: 'measure:angle', label: '角度', icon: 'measure-angle' }
    ]
  },
  { key: 'play', label: '播放', icon: 'play' },
  { key: 'export', label: '导出', icon: 'export' },
  {
    key: 'pseudocolor',
    label: '伪彩',
    icon: 'pseudocolor',
    options: [
      { value: 'pseudocolor:gray', label: '灰度', icon: 'pseudocolor-gray' },
      { value: 'pseudocolor:hot', label: 'Hot', icon: 'pseudocolor-hot' },
      { value: 'pseudocolor:pet', label: 'PET', icon: 'pseudocolor-pet' },
      { value: 'pseudocolor:rainbow', label: '彩虹', icon: 'pseudocolor-rainbow' }
    ]
  }
]

const genericTools: StackTool[] = [
  { key: 'pan', label: '平移', icon: 'pan' },
  { key: 'zoom', label: '缩放', icon: 'zoom' },
  { key: 'window', label: '调窗', icon: 'window' },
  { key: 'reset', label: '重置', icon: 'reset' },
  { key: 'export', label: '导出', icon: 'export' }
]

const genericToolsWithCrosshair: StackTool[] = [{ key: 'crosshair', label: '十字线', icon: 'crosshair' }, ...genericTools]

const activeTools = computed(() =>
  props.activeTab?.viewType === 'Stack'
    ? stackTools
    : props.activeTab?.viewType === 'MPR'
      ? genericToolsWithCrosshair
      : genericTools
)

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

function getActiveSliceLabel(): string {
  if (props.activeTab?.viewType !== 'MPR') {
    return props.activeTab?.sliceLabel ?? ''
  }

  if (activeViewportKey.value === 'single' || activeViewportKey.value === 'volume') {
    return ''
  }

  return props.activeTab?.viewportSliceLabels?.[activeViewportKey.value] ?? ''
}

function getToolIcon(tool: StackTool): string {
  const selectedValue = stackToolSelections.value[tool.key]
  if (!tool.options || !selectedValue) {
    return tool.icon
  }

  return tool.options.find((item) => item.value === selectedValue)?.icon ?? tool.icon
}

function getToolValue(tool: StackTool): string {
  return `${STACK_OPERATION_PREFIX}${stackToolSelections.value[tool.key] ?? tool.key}`
}

function applyTool(tool: StackTool): void {
  if (tool.key === 'play') {
    isPlaying.value = true
    emit('setActiveOperation', `${STACK_OPERATION_PREFIX}play`)
    return
  }

  emit('setActiveOperation', getToolValue(tool))
}

function selectToolOption(tool: StackTool, optionValue: string): void {
  stackToolSelections.value = {
    ...stackToolSelections.value,
    [tool.key]: optionValue
  }
  emit('setActiveOperation', `${STACK_OPERATION_PREFIX}${optionValue}`)
}

function pausePlayback(): void {
  isPlaying.value = false
  emit('setActiveOperation', `${STACK_OPERATION_PREFIX}pause`)
}

function endPlayback(): void {
  isPlaying.value = false
  emit('setActiveOperation', `${STACK_OPERATION_PREFIX}end`)
}

function handleViewportClick(viewportKey: string): void {
  setActiveViewport(viewportKey as never)
}

function handleViewportWheel(payload: { viewportKey: string; deltaY: number }): void {
  setActiveViewport(payload.viewportKey as never)
  emit('viewportWheel', payload.deltaY)
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
      setActiveViewport(viewType === 'MPR' ? 'mpr-ax' : viewType === '3D' ? 'volume' : 'single')
      if (viewType === 'MPR') {
        emit('setActiveOperation', `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.crosshair}`)
      }
    }

    isPlaying.value = false
  },
  { immediate: true }
)

onMounted(() => {
  emitWorkspaceReady()
})

watch(
  () => [props.activeTabKey, props.activeTab?.viewType, props.isViewLoading] as const,
  async () => {
    await nextTick()
    emitWorkspaceReady()
  }
)

watch(
  () => props.activeOperation,
  (value) => {
    if (!value) {
      emit('setActiveOperation', STACK_DEFAULT_OPERATION)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  cleanupPointerInteractions()
})
</script>

<template>
  <main class="workspace">
    <div v-if="!hasSelectedSeries" class="workspace-frame workspace-frame--empty">
      <div class="viewer-empty viewer-empty--blank viewer-empty--standalone">
        <span v-if="message">{{ message }}</span>
        <span v-else>请先在左侧序列列表中选择一条序列，再打开对应视图。</span>
      </div>
    </div>

    <div v-else class="workspace-frame">
      <div class="viewer-tabs">
        <v-btn
          v-for="tab in viewerTabs"
          :key="tab.key"
          class="viewer-tab"
          :class="{ 'viewer-tab--active': tab.key === activeTabKey }"
          variant="flat"
          @click="emit('activateTab', tab.key)"
        >
          <span class="viewer-tab-title">
            <span class="viewer-tab-series">{{ tab.seriesTitle }}</span>
            <span class="viewer-tab-type">{{ tab.viewType }}</span>
          </span>
          <v-btn size="x-small" variant="flat" class="viewer-tab-close" @click.stop="emit('closeTab', tab.key)">
            <AppIcon name="close" :size="15" :stroke-width="2.1" />
          </v-btn>
        </v-btn>
      </div>

      <div v-if="activeTab" class="workspace-toolbar workspace-toolbar--actions">
        <div class="workspace-actions">
          <div
            v-for="tool in activeTools"
            :key="tool.key"
            class="workspace-action-group"
            :class="{
              'workspace-action-group--joined': tool.key === 'play' ? activeTab.viewType === 'Stack' && isPlaying : Boolean(tool.options)
            }"
          >
            <template v-if="tool.key === 'play' && activeTab.viewType === 'Stack' && isPlaying">
              <v-btn class="workspace-action workspace-action--selected" variant="text" @click="pausePlayback">
                <AppIcon name="pause" :size="toolbarIconSize" />
              </v-btn>
              <v-btn class="workspace-action workspace-action--danger" variant="text" @click="endPlayback">
                <AppIcon name="stop" :size="toolbarIconSize" />
              </v-btn>
            </template>

            <template v-else>
              <v-btn
                class="workspace-action"
                :class="{ 'workspace-action--selected': activeOperation === getToolValue(tool) }"
                variant="text"
                @click="applyTool(tool)"
              >
                <AppIcon :name="getToolIcon(tool)" :size="toolbarIconSize" />
              </v-btn>

              <v-menu v-if="tool.options" location="bottom">
                <template #activator="{ props: menuProps }">
                  <v-btn class="workspace-action-toggle" variant="text" v-bind="menuProps">
                    <AppIcon name="chevron-down" :size="toggleIconSize" :stroke-width="2.2" />
                  </v-btn>
                </template>

                <v-list density="compact" class="workspace-action-menu">
                  <v-list-item
                    v-for="option in tool.options"
                    :key="option.value"
                    :active="stackToolSelections[tool.key] === option.value"
                    @click="selectToolOption(tool, option.value)"
                  >
                    <template #prepend>
                      <span class="workspace-action-menu-icon">
                        <AppIcon :name="option.icon" :size="menuIconSize" />
                      </span>
                    </template>
                    <v-list-item-title>{{ option.label }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </template>
          </div>
        </div>
      </div>

      <div v-if="isViewLoading" class="viewer-empty">
        <v-progress-circular indeterminate color="primary" size="28" width="3" />
        <span>正在加载视图...</span>
      </div>

      <div v-else-if="activeTab" ref="viewportHostRef" class="viewer-canvas-wrap viewer-canvas-wrap--layout">
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

      <div v-else class="viewer-empty viewer-empty--blank">
        <span v-if="message">{{ message }}</span>
        <span v-else>点击“快速浏览 / 3D / MPR”打开当前序列对应的视图。</span>
      </div>
    </div>
  </main>
</template>
