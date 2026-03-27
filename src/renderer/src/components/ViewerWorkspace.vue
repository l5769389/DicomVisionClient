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
const workspaceRef = ref<HTMLElement | null>(null)
const isPlaying = ref(false)
const openMenuKey = ref<string | null>(null)
const stackToolSelections = ref<Record<string, string>>({
  rotate: 'rotate:cw90',
  measure: 'measure:line',
  pseudocolor: 'pseudocolor:gray'
})
const activeTabRef = computed(() => props.activeTab)
const activeOperationRef = computed(() => props.activeOperation)
const toolbarIconSize = 24
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

function isToolSelected(tool: StackTool): boolean {
  return props.activeOperation === getToolValue(tool)
}

function closeMenus(): void {
  openMenuKey.value = null
}

function toggleToolMenu(toolKey: string): void {
  openMenuKey.value = openMenuKey.value === toolKey ? null : toolKey
}

function applyTool(tool: StackTool): void {
  closeMenus()
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
  closeMenus()
  emit('setActiveOperation', `${STACK_OPERATION_PREFIX}${optionValue}`)
}

function pausePlayback(): void {
  isPlaying.value = false
  closeMenus()
  emit('setActiveOperation', `${STACK_OPERATION_PREFIX}pause`)
}

function endPlayback(): void {
  isPlaying.value = false
  closeMenus()
  emit('setActiveOperation', `${STACK_OPERATION_PREFIX}end`)
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
      setActiveViewport(viewType === 'MPR' ? 'mpr-ax' : viewType === '3D' ? 'volume' : 'single')
      if (viewType === 'MPR') {
        emit('setActiveOperation', `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.crosshair}`)
      }
      closeMenus()
    }

    isPlaying.value = false
  },
  { immediate: true }
)

onMounted(() => {
  emitWorkspaceReady()
  document.addEventListener('pointerdown', handleDocumentPointerDown)
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
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
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
          {{ message || '请先在左侧序列列表中选择一条序列，然后打开对应视图。' }}
        </p>
      </div>
    </div>

    <div v-else class="flex h-full min-h-0 flex-col gap-3">
      <div class="panel-scrollbar flex items-stretch gap-2 overflow-x-auto overflow-y-hidden pb-1">
        <div
          v-for="tab in viewerTabs"
          :key="tab.key"
          class="group flex max-w-[360px] shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 transition"
          :class="
            tab.key === activeTabKey
              ? 'border-sky-300/35 bg-[linear-gradient(180deg,rgba(22,121,199,0.92),rgba(10,89,159,0.94))] text-white shadow-[0_12px_28px_rgba(8,89,156,0.26)]'
              : 'border-white/8 bg-slate-900/80 text-slate-300 hover:border-sky-300/18 hover:bg-slate-800/90'
          "
        >
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="emit('activateTab', tab.key)">
            <span class="truncate text-sm font-semibold">{{ tab.seriesTitle }}</span>
            <span class="rounded-full border border-white/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
              {{ tab.viewType }}
            </span>
          </button>
          <button
            type="button"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white transition hover:bg-white/18"
            aria-label="关闭视图"
            @click.stop="emit('closeTab', tab.key)"
          >
            <AppIcon name="close" :size="15" :stroke-width="2.1" />
          </button>
        </div>
      </div>

      <div
        v-if="activeTab"
        class="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(17,28,42,0.96),rgba(11,20,32,0.98))] px-4 py-3 max-[900px]:items-start"
      >
        <div class="min-w-0">
          <div class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400/70">{{ activeTab.viewType }} Viewer</div>
          <div class="mt-1 truncate text-sm text-slate-200">{{ activeTab.seriesTitle }}</div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div
            v-for="tool in activeTools"
            :key="tool.key"
            class="relative flex items-center"
            :class="tool.key === 'play' ? (activeTab.viewType === 'Stack' && isPlaying ? 'rounded-2xl border border-sky-300/22' : '') : tool.options ? 'rounded-2xl border border-white/8' : ''"
          >
            <template v-if="tool.key === 'play' && activeTab.viewType === 'Stack' && isPlaying">
              <button
                type="button"
                class="inline-flex h-12 w-12 items-center justify-center rounded-l-2xl bg-[linear-gradient(180deg,rgba(42,149,228,0.95),rgba(20,102,176,0.95))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition hover:brightness-110"
                :title="tool.label"
                @click="pausePlayback"
              >
                <AppIcon name="pause" :size="toolbarIconSize" />
              </button>
              <button
                type="button"
                class="inline-flex h-12 w-12 items-center justify-center rounded-r-2xl border-l border-white/8 bg-[linear-gradient(180deg,rgba(174,67,67,0.94),rgba(135,38,38,0.94))] text-white transition hover:brightness-110"
                title="停止播放"
                @click="endPlayback"
              >
                <AppIcon name="stop" :size="toolbarIconSize" />
              </button>
            </template>

            <template v-else>
              <button
                type="button"
                class="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(54,67,82,0.92),rgba(37,47,59,0.94))] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:brightness-110"
                :class="{
                  'rounded-r-none border-r-0': Boolean(tool.options),
                  'bg-[linear-gradient(180deg,rgba(42,149,228,0.95),rgba(20,102,176,0.95))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_rgba(8,89,156,0.24)]': isToolSelected(tool)
                }"
                :title="tool.label"
                @click="applyTool(tool)"
              >
                <AppIcon :name="getToolIcon(tool)" :size="toolbarIconSize" />
              </button>

              <div v-if="tool.options" class="relative" data-tool-menu-root>
                <button
                  type="button"
                  class="inline-flex h-12 w-8 items-center justify-center rounded-r-2xl border border-white/8 border-l-white/10 bg-[linear-gradient(180deg,rgba(67,81,96,0.95),rgba(47,58,71,0.96))] text-slate-100 transition hover:brightness-110"
                  :aria-expanded="openMenuKey === tool.key"
                  :title="`${tool.label}选项`"
                  @click.stop="toggleToolMenu(tool.key)"
                >
                  <AppIcon name="chevron-down" :size="toggleIconSize" :stroke-width="2.2" />
                </button>

                <div
                  v-if="openMenuKey === tool.key"
                  class="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-[168px] rounded-2xl border border-white/10 bg-[rgba(17,29,45,0.98)] p-2 shadow-[0_20px_44px_rgba(2,8,18,0.36)]"
                >
                  <button
                    v-for="option in tool.options"
                    :key="option.value"
                    type="button"
                    class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-sky-300/10"
                    :class="{ 'bg-sky-300/14 text-white': stackToolSelections[tool.key] === option.value }"
                    @click="selectToolOption(tool, option.value)"
                  >
                    <span class="inline-flex w-5 items-center justify-center text-slate-300">
                      <AppIcon :name="option.icon" :size="menuIconSize" />
                    </span>
                    <span>{{ option.label }}</span>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

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
