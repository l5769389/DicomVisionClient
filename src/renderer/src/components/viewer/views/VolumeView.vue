<script setup lang="ts">
import { computed } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import type { CornerInfo, DraftMeasurementMode, MeasurementDraft, MeasurementOverlay, ViewProgressInfo, ViewerTabItem } from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeOperation: string
  draftMeasurement?: MeasurementDraft | null
  draftMeasurementMode?: DraftMeasurementMode | null
  measurements?: MeasurementOverlay[]
}>()

const emit = defineEmits<{
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  viewportClick: [viewportKey: string]
}>()

const { locale, viewerCopy } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')

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
  preprocess: '处理 3D 数据',
  initialize: '初始化视图',
  render: '渲染影像',
  encode: '生成预览图',
  complete: '加载完成'
}

const VIEW_PROGRESS_LABELS_EN: Record<string, string> = {
  queued: 'Preparing render',
  waiting: 'Waiting for volume',
  volume: 'Reading DICOM slices',
  normalize: 'Preparing volume',
  preprocess: 'Processing 3D volume',
  initialize: 'Initializing view',
  render: 'Rendering image',
  encode: 'Encoding preview',
  complete: 'Loaded'
}

function getLoadingProgress(): ViewProgressInfo | null {
  return props.activeTab.loadingProgress ?? null
}

function getLoadingProgressPercent(): number | null {
  const progressPercent = getLoadingProgress()?.progressPercent
  return typeof progressPercent === 'number' ? progressPercent : null
}

const isVolumeProcessing = computed(() => {
  const progress = getLoadingProgress()
  if (!progress || progress.phase === 'complete') {
    return false
  }
  return progress.phase === 'preprocess'
})

function getLoadingLabel(): string {
  const fallback = viewerCopy.value.loadingVolumeView
  const progress = getLoadingProgress()
  if (!progress) {
    return fallback
  }

  const progressLabels = isZh.value ? VIEW_PROGRESS_LABELS : VIEW_PROGRESS_LABELS_EN
  const label = progress.message || progressLabels[progress.phase] || fallback
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
      :is-loading="Boolean(activeTab.viewId) && (!activeTab.imageSrc || isVolumeProcessing)"
      :loading-label="getLoadingLabel()"
      :loading-progress-percent="getLoadingProgressPercent()"
      :alt="activeTab.viewType"
      :placeholder="viewerCopy.volumePlaceholder"
      :corner-info="emptyVolumeCornerInfo"
      :orientation="activeTab.orientation"
      :draft-measurement="draftMeasurement ?? null"
      :draft-measurement-mode="draftMeasurementMode ?? null"
      :measurements="measurements ?? []"
      :soft-image="true"
      @click-viewport="emit('viewportClick', $event)"
      @pointer-down="emit('pointerDown', $event, 'volume')"
      @pointer-move="emit('pointerMove', $event)"
      @pointer-up="emit('pointerUp', $event)"
      @pointer-cancel="emit('pointerCancel', $event)"
    />
  </div>
</template>
