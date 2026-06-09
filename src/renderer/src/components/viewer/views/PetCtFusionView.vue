<script setup lang="ts">
import { computed, ref } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  DraftMeasurementMode,
  FusionPaneKey,
  MeasurementDraft,
  MeasurementOverlay,
  ViewerTabItem
} from '../../../types/viewer'
import {
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PANE_KEYS,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY
} from '../../../composables/workspace/views/viewerWorkspaceTabs'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeOperation: string
  activeViewportKey: string
  getAnnotations: (viewportKey: string) => AnnotationOverlay[]
  getCursorClass: (viewportKey: string) => string
  getDraftAnnotation: (viewportKey: string) => AnnotationDraft | null
  getDraftMeasurementMode: (viewportKey: string) => DraftMeasurementMode | null
  getDraftMeasurement: (viewportKey: string) => MeasurementDraft | null
  getMeasurements: (viewportKey: string) => MeasurementOverlay[]
}>()

const emit = defineEmits<{
  copyAnnotation: [payload: { viewportKey: string; annotationId: string }]
  deleteAnnotation: [payload: { viewportKey: string; annotationId: string }]
  copySelectedMeasurement: [viewportKey: string]
  deleteSelectedMeasurement: [viewportKey: string, measurementId?: string]
  fusionConfigChange: [payload: { manualRegistration?: boolean; pseudocolorPreset?: string; petUnit?: string; action?: 'reset' | 'save' }]
  fusionRegistrationDrag: [payload: {
    viewportKey: string
    phase: 'start' | 'move' | 'end'
    subOpType: 'translate' | 'rotate'
    deltaX: number
    deltaY: number
  }]
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null }]
  imageLoaded: [viewportKey: string]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean }]
}>()

interface FusionPaneView {
  key: FusionPaneKey
  title: string
  imageSrc: string
  sliceLabel: string
  windowLabel: string
}

interface ManualRegistrationDragState {
  pointerId: number
  startClientX: number
  startClientY: number
  subOpType: 'translate' | 'rotate'
}

interface FusionCalibrationDragState {
  pointerId: number
}

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const manualDragState = ref<ManualRegistrationDragState | null>(null)
const calibrationDragState = ref<FusionCalibrationDragState | null>(null)
const calibrationMarkerPosition = ref({ x: 0.5, y: 0.5 })

const paneTitles = computed((): Record<FusionPaneKey, string> => ({
  'fusion-ct-ax': 'CT Axial',
  'fusion-pet-ax': 'PET Axial',
  'fusion-overlay-ax': isZh.value ? '融合 Axial' : 'Fusion Axial',
  'fusion-pet-cor-mip': 'PET Coronal MIP'
}))

const panes = computed<FusionPaneView[]>(() =>
  FUSION_PANE_KEYS.map((key) => ({
    key,
    title: paneTitles.value[key],
    imageSrc: props.activeTab.fusionImages?.[key] ?? '',
    sliceLabel: props.activeTab.fusionSliceLabels?.[key] ?? '',
    windowLabel: props.activeTab.fusionWindowLabels?.[key] ?? ''
  }))
)

const manualRegistrationEnabled = computed(() => props.activeTab.fusionManualRegistration === true)
const loadingLabel = computed(() => (isZh.value ? '正在加载融合视图...' : 'Loading fusion view...'))
const placeholderLabel = computed(() => (isZh.value ? 'PET/CT 融合预览' : 'PET/CT fusion preview'))
const progressLabels = computed<Record<string, string>>(() => ({
  queued: isZh.value ? '准备渲染' : 'Preparing render',
  waiting: isZh.value ? '等待体数据' : 'Waiting for volume',
  volume: isZh.value ? '读取切片' : 'Reading slices',
  normalize: isZh.value ? '准备体数据' : 'Preparing volume',
  initialize: isZh.value ? '初始化视图' : 'Initializing view',
  render: isZh.value ? '渲染图像' : 'Rendering image',
  encode: isZh.value ? '生成图像' : 'Encoding image',
  complete: isZh.value ? '加载完成' : 'Loaded'
}))
function getPaneLoadingProgressPercent(paneKey: FusionPaneKey): number | null {
  const progressPercent = props.activeTab.fusionLoadingProgress?.[paneKey]?.progressPercent
  return typeof progressPercent === 'number' ? progressPercent : null
}

function getPaneLoadingLabel(paneKey: FusionPaneKey): string {
  const progress = props.activeTab.fusionLoadingProgress?.[paneKey] ?? null
  if (!progress) {
    return loadingLabel.value
  }
  const label = progress.message || progressLabels.value[progress.phase] || loadingLabel.value
  const hasCounts = typeof progress.loadedCount === 'number' && typeof progress.totalCount === 'number' && progress.totalCount > 0
  return hasCounts ? `${label} ${progress.loadedCount}/${progress.totalCount}` : label
}

function emitManualRegistrationDrag(phase: 'start' | 'move' | 'end', event: PointerEvent): void {
  const state = manualDragState.value
  if (!state) {
    return
  }
  emit('fusionRegistrationDrag', {
    viewportKey: FUSION_OVERLAY_AXIAL_PANE_KEY,
    phase,
    subOpType: state.subOpType,
    deltaX: event.clientX - state.startClientX,
    deltaY: event.clientY - state.startClientY
  })
}

function handlePointerDown(event: PointerEvent, viewportKey: string): void {
  if (manualRegistrationEnabled.value && viewportKey === FUSION_OVERLAY_AXIAL_PANE_KEY && (event.button === 0 || event.button === 2)) {
    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget
    if (target instanceof HTMLElement) {
      target.setPointerCapture(event.pointerId)
    }
    manualDragState.value = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      subOpType: event.button === 2 ? 'rotate' : 'translate'
    }
    emitManualRegistrationDrag('start', event)
    return
  }

  emit('pointerDown', event, viewportKey)
}

function clampNormalized(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function updateCalibrationMarkerFromPointer(event: PointerEvent): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) {
    return
  }
  const pane = target.closest<HTMLElement>('.pet-ct-fusion-view__pane')
  if (!pane) {
    return
  }
  const rect = pane.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return
  }
  calibrationMarkerPosition.value = {
    x: clampNormalized((event.clientX - rect.left) / rect.width),
    y: clampNormalized((event.clientY - rect.top) / rect.height)
  }
}

function handleCalibrationPointerDown(event: PointerEvent): void {
  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget
  if (target instanceof HTMLElement && typeof target.setPointerCapture === 'function') {
    target.setPointerCapture(event.pointerId)
  }
  calibrationDragState.value = { pointerId: event.pointerId }
  updateCalibrationMarkerFromPointer(event)
}

function handleCalibrationPointerMove(event: PointerEvent): void {
  if (!calibrationDragState.value || calibrationDragState.value.pointerId !== event.pointerId) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateCalibrationMarkerFromPointer(event)
}

function finishCalibrationDrag(event: PointerEvent): boolean {
  if (!calibrationDragState.value || calibrationDragState.value.pointerId !== event.pointerId) {
    return false
  }
  updateCalibrationMarkerFromPointer(event)
  const target = event.currentTarget
  if (target instanceof HTMLElement && typeof target.hasPointerCapture === 'function' && target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  calibrationDragState.value = null
  return true
}

function handleCalibrationPointerUp(event: PointerEvent): void {
  if (finishCalibrationDrag(event)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function handlePointerMove(event: PointerEvent): void {
  if (manualDragState.value) {
    event.preventDefault()
    emitManualRegistrationDrag('move', event)
    return
  }
  emit('pointerMove', event)
}

function finishManualDrag(event: PointerEvent, phase: 'end' | 'move' = 'end'): boolean {
  if (!manualDragState.value || manualDragState.value.pointerId !== event.pointerId) {
    return false
  }
  emitManualRegistrationDrag(phase, event)
  const target = event.currentTarget
  if (target instanceof HTMLElement && target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  manualDragState.value = null
  return true
}

function handlePointerUp(event: PointerEvent): void {
  if (finishManualDrag(event, 'end')) {
    return
  }
  emit('pointerUp', event)
}

function handlePointerCancel(event: PointerEvent): void {
  if (finishManualDrag(event, 'end')) {
    return
  }
  emit('pointerCancel', event)
}

</script>

<template>
  <div class="pet-ct-fusion-view relative h-full min-h-0 w-full overflow-hidden bg-black">
    <div class="pet-ct-fusion-view__grid grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-[3px]">
      <section
        v-for="pane in panes"
        :key="pane.key"
        class="pet-ct-fusion-view__pane relative min-h-0 overflow-hidden rounded-md border border-white/12 bg-black"
        :class="{ 'pet-ct-fusion-view__pane--active': activeViewportKey === pane.key }"
      >
        <div v-if="!pane.imageSrc" class="pointer-events-none absolute left-3 top-2 z-10 rounded-md bg-black/35 px-2 py-1 text-[11px] font-semibold text-white/85">
          {{ pane.title }}
        </div>
        <ViewerCanvasStage
          class="pet-ct-fusion-view__stage"
          :active-operation="activeOperation"
          :alt="pane.title"
          :annotations="getAnnotations(pane.key)"
          :corner-info="activeTab.fusionCornerInfos?.[pane.key] ?? activeTab.cornerInfo"
          :cursor-class="manualRegistrationEnabled && pane.key === FUSION_OVERLAY_AXIAL_PANE_KEY ? 'cursor-move' : getCursorClass(pane.key)"
          :draft-annotation="getDraftAnnotation(pane.key)"
          :draft-measurement="getDraftMeasurement(pane.key)"
          :draft-measurement-mode="getDraftMeasurementMode(pane.key)"
          :image-src="pane.imageSrc"
          :is-active="activeViewportKey === pane.key"
          :is-loading="!pane.imageSrc"
          :loading-label="getPaneLoadingLabel(pane.key)"
          :loading-progress-percent="getPaneLoadingProgressPercent(pane.key)"
          :measurements="getMeasurements(pane.key)"
          :orientation="activeTab.fusionOrientations?.[pane.key] ?? activeTab.orientation"
          :placeholder="placeholderLabel"
          :render-surface-active="true"
          :scale-bar="activeTab.fusionScaleBars?.[pane.key] ?? null"
          :show-corner-info="activeTab.showCornerInfo !== false"
          :show-scale-bar="activeTab.showScaleBar !== false"
          :viewport-key="pane.key"
          @click-viewport="emit('viewportClick', $event)"
          @copy-annotation="emit('copyAnnotation', $event)"
          @copy-selected-measurement="emit('copySelectedMeasurement', $event)"
          @delete-annotation="emit('deleteAnnotation', $event)"
          @delete-selected-measurement="emit('deleteSelectedMeasurement', $event)"
          @hover-viewport-change="emit('hoverViewportChange', $event)"
          @image-loaded="emit('imageLoaded', $event)"
          @pointer-cancel="handlePointerCancel"
          @pointer-down="handlePointerDown"
          @pointer-leave="emit('pointerLeave', $event)"
          @pointer-move="handlePointerMove"
          @pointer-up="handlePointerUp"
          @update-annotation-color="emit('updateAnnotationColor', $event)"
          @update-annotation-size="emit('updateAnnotationSize', $event)"
          @update-annotation-text="emit('updateAnnotationText', $event)"
          @wheel-viewport="emit('viewportWheel', $event)"
          @contextmenu.prevent
        />
        <button
          v-if="pane.imageSrc"
          type="button"
          class="pet-ct-fusion-view__marker"
          :aria-label="isZh ? '辅助标定' : 'Calibration marker'"
          :style="{ left: `${calibrationMarkerPosition.x * 100}%`, top: `${calibrationMarkerPosition.y * 100}%` }"
          @pointerdown="handleCalibrationPointerDown"
          @pointermove="handleCalibrationPointerMove"
          @pointerup="handleCalibrationPointerUp"
          @pointercancel="handleCalibrationPointerUp"
          @click.stop
        >
          <span class="pet-ct-fusion-view__marker-segment pet-ct-fusion-view__marker-segment--top" />
          <span class="pet-ct-fusion-view__marker-segment pet-ct-fusion-view__marker-segment--bottom" />
          <span class="pet-ct-fusion-view__marker-segment pet-ct-fusion-view__marker-segment--left" />
          <span class="pet-ct-fusion-view__marker-segment pet-ct-fusion-view__marker-segment--right" />
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pet-ct-fusion-view__pane {
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.86);
}

.pet-ct-fusion-view__pane--active {
  border-color: #1e9cff;
  box-shadow:
    inset 0 0 0 1px rgba(30, 156, 255, 0.9),
    0 0 0 1px rgba(30, 156, 255, 0.36);
}

.pet-ct-fusion-view__stage {
  border: 0;
  border-radius: 4px;
  background: #000;
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label) {
  color: #ff8f8f;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.95),
    0 0 5px rgba(0, 0, 0, 0.68);
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label--top) {
  top: 6px;
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label--right) {
  right: 6px;
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label--bottom) {
  bottom: 6px;
}

.pet-ct-fusion-view__stage :deep(.viewer-orientation-label--left) {
  left: 6px;
}

.pet-ct-fusion-view__stage :deep(.viewer-corner-block) {
  max-width: min(44%, 310px);
  padding: 9px 10px;
  color: #ff9a9a;
  font-size: 12px;
  line-height: 1.34;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.92),
    0 0 5px rgba(0, 0, 0, 0.62);
}

.pet-ct-fusion-view__marker {
  position: absolute;
  z-index: 24;
  width: 54px;
  height: 54px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0;
  transform: translate(-50%, -50%);
  cursor: move;
  touch-action: none;
}

.pet-ct-fusion-view__marker::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  opacity: 0;
  transition: opacity 120ms ease;
}

.pet-ct-fusion-view__marker:hover::before,
.pet-ct-fusion-view__marker:focus-visible::before {
  opacity: 1;
}

.pet-ct-fusion-view__marker:focus-visible {
  outline: 1px solid rgba(255, 255, 255, 0.72);
  outline-offset: 2px;
}

.pet-ct-fusion-view__marker-segment {
  position: absolute;
  display: block;
  border-radius: 999px;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.62);
  pointer-events: none;
}

.pet-ct-fusion-view__marker-segment--top,
.pet-ct-fusion-view__marker-segment--bottom {
  left: 25px;
  width: 4px;
  height: 14px;
  background: #285dff;
}

.pet-ct-fusion-view__marker-segment--top {
  top: 5px;
}

.pet-ct-fusion-view__marker-segment--bottom {
  bottom: 5px;
}

.pet-ct-fusion-view__marker-segment--left,
.pet-ct-fusion-view__marker-segment--right {
  top: 25px;
  width: 14px;
  height: 4px;
  background: #5ab929;
}

.pet-ct-fusion-view__marker-segment--left {
  left: 5px;
}

.pet-ct-fusion-view__marker-segment--right {
  right: 5px;
}

</style>
