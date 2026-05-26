<script setup lang="ts">
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import type { CornerInfo, ViewProgressInfo, ViewerTabItem } from '../../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeOperation: string
}>()

const emit = defineEmits<{
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  viewportClick: [viewportKey: string]
}>()

const emptyVolumeCornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

const VIEW_PROGRESS_LABELS: Record<string, string> = {
  queued: '准备渲染',
  waiting: '等待体数据',
  volume: '读取 DICOM 切片',
  normalize: '整理体数据',
  initialize: '初始化视图',
  render: '渲染影像',
  encode: '生成预览图',
  complete: '加载完成'
}

function getLoadingProgress(): ViewProgressInfo | null {
  return props.activeTab.loadingProgress ?? null
}

function getLoadingProgressPercent(): number | null {
  const progressPercent = getLoadingProgress()?.progressPercent
  return typeof progressPercent === 'number' ? progressPercent : null
}

function getLoadingLabel(): string {
  const fallback = '正在加载 3D 视图...'
  const progress = getLoadingProgress()
  if (!progress) {
    return fallback
  }

  const label = progress.message || VIEW_PROGRESS_LABELS[progress.phase] || fallback
  const hasCounts = typeof progress.loadedCount === 'number' && typeof progress.totalCount === 'number' && progress.totalCount > 0
  return hasCounts ? `${label} ${progress.loadedCount}/${progress.totalCount}` : label
}
</script>

<template>
  <div class="h-full w-full">
    <ViewerCanvasStage
      viewport-key="volume"
      viewport-class="grid place-items-center"
      :is-active="true"
      :render-surface-active="true"
      :image-src="activeTab.imageSrc"
      :active-operation="activeOperation"
      :is-loading="Boolean(activeTab.viewId) && !activeTab.imageSrc"
      :loading-label="getLoadingLabel()"
      :loading-progress-percent="getLoadingProgressPercent()"
      :alt="activeTab.viewType"
      placeholder="3D 视图预留区域"
      :corner-info="emptyVolumeCornerInfo"
      :orientation="activeTab.orientation"
      :soft-image="true"
      @click-viewport="emit('viewportClick', $event)"
      @pointer-down="emit('pointerDown', $event, 'volume')"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
    />
  </div>
</template>
