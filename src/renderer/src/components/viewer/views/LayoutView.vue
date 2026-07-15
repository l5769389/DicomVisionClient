<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import { SERIES_DRAG_PAYLOAD_TYPE, SERIES_DRAG_TYPE, type SeriesDragPayload } from '../../../constants/dragDrop'
import type { DicomDropInput } from '../../../platform/runtime'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import type {
  AnnotationDraft,
  AnnotationOverlay,
  DraftMeasurementMode,
  MeasurementDraft,
  MeasurementOverlay,
  CornerInfo,
  ViewerLayoutSlot,
  ViewerTabItem
} from '../../../types/viewer'
import type { VolumeOrientationFace } from '../../../composables/workspace/volume/volumeOrientation'

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
  hoverViewportChange: [payload: { viewportKey: string; x: number | null; y: number | null; row?: number | null; col?: number | null }]
  imageLoaded: [viewportKey: string]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerLeave: [viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  slotDicomDrop: [payload: { tabKey: string; slotId: string; drop: DicomDropInput }]
  slotSeriesDrop: [payload: { tabKey: string; slotId: string; seriesId: string; folderPath?: string; seriesInstanceUid?: string | null }]
  updateAnnotationColor: [payload: { viewportKey: string; annotationId: string; color: string }]
  updateAnnotationSize: [payload: { viewportKey: string; annotationId: string; size: 'sm' | 'md' | 'lg' }]
  updateAnnotationText: [payload: { viewportKey: string; annotationId: string; text: string }]
  volumeOrientationSelect: [payload: { viewportKey: string; face: VolumeOrientationFace }]
  viewportClick: [viewportKey: string]
  viewportWheel: [payload: { viewportKey: string; deltaY: number; exact?: boolean; deltaX?: number; deltaMode?: number; ctrlKey?: boolean; canvasX?: number; canvasY?: number; canvasWidth?: number; canvasHeight?: number }]
}>()

interface SliceInfo {
  current: number
  total: number
}

const EMPTY_CORNER_INFO: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

const activeDropSlotId = ref<string | null>(null)
const sliderValues = ref<Record<string, number>>({})
const activeSliderIds = ref<Record<string, boolean>>({})
const maximizedSlotId = ref<string | null>(null)
const { locale, viewerCopy } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const template = computed(() => props.activeTab.layoutTemplate ?? null)
const rows = computed(() => Math.max(1, template.value?.rows ?? 1))
const columns = computed(() => Math.max(1, template.value?.columns ?? 1))
const slots = computed<ViewerLayoutSlot[]>(() => {
  const layoutSlots = props.activeTab.layoutSlots ?? template.value?.slots ?? []
  return layoutSlots.length
    ? layoutSlots
    : [
        {
          id: 'slot-1-1',
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          viewType: 'Stack'
        }
      ]
})
const isSingleStackLayout = computed(() => {
  const [slot] = slots.value
  return rows.value === 1 && columns.value === 1 && slots.value.length === 1 && Boolean(slot && isStackSlot(slot))
})
const isVolumeClipActive = computed(() => {
  const operation = props.activeOperation.replace(/^stack:/, '')
  return operation === 'volumeClip:inside' || operation === 'volumeClip:outside'
})
const showSliceSlider = computed(() => props.activeTab.showSliceSlider !== false)
const layoutIdentity = computed(() => `${props.activeTab.key}:${rows.value}:${columns.value}`)

const sliceInfos = computed<Record<string, SliceInfo>>(() =>
  slots.value.reduce<Record<string, SliceInfo>>((result, slot) => {
    result[slot.id] = parseSliceInfo(slot.sliceLabel ?? '')
    return result
  }, {})
)

function getSlotStyle(slot: ViewerLayoutSlot): Record<string, string> {
  if (maximizedSlotId.value === slot.id) {
    return {
      gridColumn: `1 / span ${columns.value}`,
      gridRow: `1 / span ${rows.value}`
    }
  }

  return {
    gridColumn: `${slot.column + 1} / span ${Math.max(1, slot.columnSpan)}`,
    gridRow: `${slot.row + 1} / span ${Math.max(1, slot.rowSpan)}`
  }
}

function getSlotTitle(slot: ViewerLayoutSlot, index: number): string {
  return slot.seriesTitle ?? (isZh.value ? `视口 ${index + 1}` : `Slot ${index + 1}`)
}

function isStackSlot(slot: ViewerLayoutSlot): boolean {
  return Boolean(slot.viewId && (slot.viewType === 'Stack' || slot.sourceViewType === 'Stack' || slot.sourceViewType === 'CompareStack'))
}

function isVolumeSlot(slot: ViewerLayoutSlot): boolean {
  return Boolean(slot.viewId && (slot.viewType === '3D' || slot.sourceViewType === '3D'))
}

function hasCornerInfo(cornerInfo: ViewerLayoutSlot['cornerInfo'] | null | undefined): boolean {
  return Boolean(cornerInfo && Object.values(cornerInfo).some((lines) => lines.length > 0))
}

function getVolumeCornerInfo(slot: ViewerLayoutSlot) {
  return hasCornerInfo(slot.cornerInfo) ? slot.cornerInfo! : props.activeTab.cornerInfo ?? EMPTY_CORNER_INFO
}

function parseSliceInfo(sliceLabel: string): SliceInfo {
  const match = sliceLabel.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return { current: 1, total: 1 }
  }

  const current = Number(match[1])
  const total = Number(match[2])
  return {
    current: Number.isFinite(current) && current > 0 ? current : 1,
    total: Number.isFinite(total) && total > 0 ? total : 1
  }
}

function clampSliceValue(value: number, total: number): number {
  return Math.min(Math.max(value, 1), total)
}

function syncInactiveSliderValues(values = sliceInfos.value): void {
  const nextValues = { ...sliderValues.value }
  slots.value.forEach((slot) => {
    const sliceInfo = values[slot.id] ?? { current: 1, total: 1 }
    if (!activeSliderIds.value[slot.id]) {
      nextValues[slot.id] = clampSliceValue(sliceInfo.current, sliceInfo.total)
    }
  })
  sliderValues.value = nextValues
}

watch(sliceInfos, (values) => syncInactiveSliderValues(values), { immediate: true })

watch(
  () => props.activeTab.key,
  () => {
    activeSliderIds.value = {}
    syncInactiveSliderValues()
  }
)

function beginSliceSliderDrag(slotId: string): void {
  activeSliderIds.value = {
    ...activeSliderIds.value,
    [slotId]: true
  }
}

function endSliceSliderDrag(slotId: string): void {
  const sliceInfo = sliceInfos.value[slotId] ?? { current: 1, total: 1 }
  sliderValues.value = {
    ...sliderValues.value,
    [slotId]: clampSliceValue(sliderValues.value[slotId] ?? sliceInfo.current, sliceInfo.total)
  }
  activeSliderIds.value = {
    ...activeSliderIds.value,
    [slotId]: false
  }
}

function handleSliceSliderInput(event: Event, slot: ViewerLayoutSlot): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  beginSliceSliderDrag(slot.id)
  const rawValue = Number(target.value)
  if (!Number.isFinite(rawValue)) {
    return
  }
  const sliceInfo = sliceInfos.value[slot.id] ?? { current: 1, total: 1 }
  const nextValue = clampSliceValue(rawValue, sliceInfo.total)
  const previousValue = sliderValues.value[slot.id] ?? sliceInfo.current
  sliderValues.value = {
    ...sliderValues.value,
    [slot.id]: nextValue
  }
  const delta = nextValue - previousValue
  if (!Number.isFinite(delta) || delta === 0) {
    return
  }

  emit('viewportWheel', {
    viewportKey: slot.id,
    deltaY: delta,
    exact: true
  })
}

function isExternalFileDragEvent(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function isSeriesDragEvent(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes(SERIES_DRAG_PAYLOAD_TYPE) || types.includes(SERIES_DRAG_TYPE)
}

function resolveDraggedSeriesPayload(event: DragEvent): SeriesDragPayload | null {
  const transfer = event.dataTransfer
  if (!transfer) {
    return null
  }

  const rawPayload = transfer.getData(SERIES_DRAG_PAYLOAD_TYPE)
  if (rawPayload) {
    try {
      const payload = JSON.parse(rawPayload) as Partial<SeriesDragPayload>
      const seriesId = typeof payload.seriesId === 'string' ? payload.seriesId.trim() : ''
      if (seriesId) {
        return {
          seriesId,
          folderPath: typeof payload.folderPath === 'string' ? payload.folderPath : undefined,
          seriesInstanceUid: typeof payload.seriesInstanceUid === 'string' ? payload.seriesInstanceUid : null
        }
      }
    } catch {
      return null
    }
  }

  const seriesId = transfer.getData(SERIES_DRAG_TYPE).trim()
  return seriesId ? { seriesId } : null
}

function canDropFilesIntoSlot(slot: ViewerLayoutSlot): boolean {
  return !slot.imageSrc && !slot.viewId
}

function canHandleSlotDrop(event: DragEvent, slot: ViewerLayoutSlot): boolean {
  return isSeriesDragEvent(event) || (canDropFilesIntoSlot(slot) && isExternalFileDragEvent(event))
}

function getLayoutLoadingLabel(): string {
  return isZh.value ? '正在加载布局视图...' : 'Loading layout view...'
}

function getLayoutPlaceholder(): string {
  return isZh.value ? '布局视口' : 'Layout viewport'
}

function getLayoutSliceAriaLabel(): string {
  return isZh.value ? '切换布局切片' : 'Change layout slice'
}

function handleSlotDragEnter(event: DragEvent, slot: ViewerLayoutSlot): void {
  if (!canHandleSlotDrop(event, slot)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  activeDropSlotId.value = slot.id
}

function handleSlotDragOver(event: DragEvent, slot: ViewerLayoutSlot): void {
  if (!canHandleSlotDrop(event, slot)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  activeDropSlotId.value = slot.id
}

function handleSlotDragLeave(event: DragEvent, slot: ViewerLayoutSlot): void {
  if (activeDropSlotId.value !== slot.id) {
    return
  }

  const relatedTarget = event.relatedTarget
  if (relatedTarget instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
    return
  }
  activeDropSlotId.value = null
}

function handleSlotDrop(event: DragEvent, slot: ViewerLayoutSlot): void {
  if (!canHandleSlotDrop(event, slot)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  activeDropSlotId.value = null
  const seriesPayload = resolveDraggedSeriesPayload(event)
  if (seriesPayload) {
    emit('slotSeriesDrop', {
      tabKey: props.activeTab.key,
      slotId: slot.id,
      ...seriesPayload
    })
    return
  }

  const files = Array.from(event.dataTransfer?.files ?? [])
  if (!files.length) {
    return
  }

  emit('slotDicomDrop', {
    tabKey: props.activeTab.key,
    slotId: slot.id,
    drop: {
      dataTransfer: event.dataTransfer,
      files
    }
  })
}

function handleSlotDoubleClick(slot: ViewerLayoutSlot): void {
  if (!isStackSlot(slot) && !isVolumeSlot(slot)) {
    return
  }

  emit('viewportClick', slot.id)
  maximizedSlotId.value = maximizedSlotId.value === slot.id ? null : slot.id
}

watch(
  layoutIdentity,
  () => {
    maximizedSlotId.value = null
  }
)
</script>

<template>
  <div class="layout-view h-full min-h-0 text-[var(--theme-text-primary)]" :class="{ 'layout-view--single-stack': isSingleStackLayout }">
    <div
      class="layout-view__grid"
      :style="{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
      }"
    >
      <section
        v-for="(slot, index) in slots"
        :key="slot.id"
        class="layout-view__slot"
        :class="{
          'layout-view__slot--filled': Boolean(slot.imageSrc || slot.viewId),
          'layout-view__slot--active': !slot.viewId && (isSingleStackLayout || activeViewportKey === slot.id),
          'layout-view__slot--maximized': maximizedSlotId === slot.id,
          'layout-view__slot--hidden-by-maximized': maximizedSlotId != null && maximizedSlotId !== slot.id,
          'layout-view__slot--drop-target': canDropFilesIntoSlot(slot),
          'layout-view__slot--drop-active': activeDropSlotId === slot.id
        }"
        :style="getSlotStyle(slot)"
        @dragenter="handleSlotDragEnter($event, slot)"
        @dragover="handleSlotDragOver($event, slot)"
        @dragleave="handleSlotDragLeave($event, slot)"
        @drop="handleSlotDrop($event, slot)"
      >
        <template v-if="isVolumeSlot(slot)">
          <ViewerCanvasStage
            class="min-w-0 h-full w-full"
            :viewport-key="slot.id"
            viewport-class="grid place-items-center"
            :is-active="activeViewportKey === slot.id"
            :render-surface-active="true"
            :image-src="slot.imageSrc ?? ''"
            :is-loading="Boolean(slot.viewId) && (!slot.imageSrc || activeTab.loadingProgress?.phase === 'preprocess')"
            :loading-label="activeTab.loadingProgress?.message || getLayoutLoadingLabel()"
            :loading-progress-percent="activeTab.loadingProgress?.progressPercent ?? null"
            :alt="getSlotTitle(slot, index)"
            :active-operation="activeOperation"
            :placeholder="getLayoutPlaceholder()"
            :corner-info="getVolumeCornerInfo(slot)"
            :orientation="slot.orientation ?? activeTab.orientation"
            :scale-bar="null"
            :show-corner-info="activeTab.showCornerInfo !== false"
            :show-scale-bar="false"
            :show-volume-orientation-cube="activeTab.showVolumeOrientationCube !== false"
            :hide-draft-handles="isVolumeClipActive"
            :soft-image="true"
            @click-viewport="emit('viewportClick', $event)"
            @pointer-down="(event) => emit('pointerDown', event, slot.id)"
            @pointer-move="emit('pointerMove', $event)"
            @pointer-up="emit('pointerUp', $event)"
            @pointer-cancel="emit('pointerCancel', $event)"
            @volume-orientation-select="emit('volumeOrientationSelect', { viewportKey: slot.id, face: $event })"
            @double-click-viewport="handleSlotDoubleClick(slot)"
          />
        </template>

        <template v-else-if="isStackSlot(slot)">
          <div class="layout-view__slot-body" :class="{ 'layout-view__slot-body--no-slider': !showSliceSlider }">
            <ViewerCanvasStage
              class="min-w-0"
              :viewport-key="slot.id"
              viewport-class="grid place-items-center"
              :is-active="isSingleStackLayout || activeViewportKey === slot.id"
              :render-surface-active="true"
              :image-src="slot.imageSrc ?? ''"
              :is-loading="Boolean(slot.viewId) && !slot.imageSrc"
              :loading-label="getLayoutLoadingLabel()"
              :alt="getSlotTitle(slot, index)"
              :active-operation="activeOperation"
              :placeholder="getLayoutPlaceholder()"
              :annotations="getAnnotations(slot.id)"
              :corner-info="slot.cornerInfo ?? activeTab.cornerInfo"
              :cursor-class="getCursorClass(slot.id)"
              :draft-annotation="getDraftAnnotation(slot.id)"
              :draft-measurement-mode="getDraftMeasurementMode(slot.id)"
              :draft-measurement="getDraftMeasurement(slot.id)"
              :measurements="getMeasurements(slot.id)"
              :scale-bar="slot.scaleBar ?? null"
              :pseudocolor-preset="slot.pseudocolorPreset ?? activeTab.pseudocolorPreset"
              :pseudocolor-window-info="slot.currentWindowInfo ?? slot.initialWindowInfo ?? null"
              :show-corner-info="activeTab.showCornerInfo !== false"
              :show-scale-bar="activeTab.showScaleBar !== false"
              :show-pseudocolor-bar="activeTab.showPseudocolorBar !== false"
              :orientation="slot.orientation ?? activeTab.orientation"
              :viewport-transform="slot.transformState ?? null"
              @copy-selected-measurement="emit('copySelectedMeasurement', $event)"
              @copy-annotation="emit('copyAnnotation', $event)"
              @delete-annotation="emit('deleteAnnotation', $event)"
              @delete-selected-measurement="(viewportKey, measurementId) => emit('deleteSelectedMeasurement', viewportKey, measurementId)"
              @click-viewport="emit('viewportClick', $event)"
              @hover-viewport-change="emit('hoverViewportChange', $event)"
              @image-loaded="emit('imageLoaded', $event)"
              @wheel-viewport="emit('viewportWheel', $event)"
              @pointer-down="(event) => emit('pointerDown', event, slot.id)"
              @pointer-leave="emit('pointerLeave', $event)"
              @pointer-move="emit('pointerMove', $event)"
              @pointer-up="emit('pointerUp', $event)"
              @pointer-cancel="emit('pointerCancel', $event)"
              @double-click-viewport="handleSlotDoubleClick(slot)"
              @update-annotation-color="emit('updateAnnotationColor', $event)"
              @update-annotation-size="emit('updateAnnotationSize', $event)"
              @update-annotation-text="emit('updateAnnotationText', $event)"
            />

            <div
              v-if="showSliceSlider"
              class="layout-view__slider flex min-h-0 flex-col items-center rounded-xl border px-1 py-2"
              :class="isSingleStackLayout ? 'layout-view__slider--single stack-slice-panel theme-shell-panel-strong' : 'theme-card-soft'"
            >
              <span class="layout-view__slice-label grid min-h-8 w-full place-items-center break-all text-center text-[9px] font-semibold uppercase leading-[1.12] tracking-[0.16em] text-[var(--theme-text-muted)]">{{ viewerCopy.slice }}</span>
              <span class="mt-1 text-[10px] font-semibold text-[var(--theme-text-secondary)]">{{ sliderValues[slot.id] ?? 1 }}</span>
              <div class="my-2 flex min-h-0 flex-1 items-center">
                <input
                  class="layout-view__slice-slider h-full w-3 cursor-pointer"
                  type="range"
                  min="1"
                  :max="sliceInfos[slot.id]?.total ?? 1"
                  :value="sliderValues[slot.id] ?? 1"
                  orient="vertical"
                  :aria-label="getLayoutSliceAriaLabel()"
                  @pointerdown="beginSliceSliderDrag(slot.id)"
                  @pointerup="endSliceSliderDrag(slot.id)"
                  @pointercancel="endSliceSliderDrag(slot.id)"
                  @change="endSliceSliderDrag(slot.id)"
                  @input="handleSliceSliderInput($event, slot)"
                />
              </div>
              <span class="text-[10px] font-semibold text-[var(--theme-text-secondary)]">{{ sliceInfos[slot.id]?.total ?? 1 }}</span>
            </div>
          </div>
        </template>

        <template v-else-if="slot.imageSrc">
          <img class="layout-view__image" :src="slot.imageSrc" :alt="getSlotTitle(slot, index)" draggable="false" />
          <div v-if="slot.sliceLabel || slot.windowLabel" class="layout-view__slot-overlay layout-view__slot-overlay--bottom">
            <span v-if="slot.sliceLabel">{{ slot.sliceLabel }}</span>
            <span v-if="slot.windowLabel">{{ slot.windowLabel }}</span>
          </div>
        </template>

        <template v-else>
          <div class="layout-view__slot-badge">{{ index + 1 }}</div>
          <div class="layout-view__slot-title">{{ getSlotTitle(slot, index) }}</div>
          <div class="layout-view__slot-subtitle">{{ isZh ? '拖入 DICOM' : 'Drop DICOM' }}</div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.layout-view__grid {
  display: grid;
  height: 100%;
  min-height: 0;
  gap: 8px;
}

.layout-view--single-stack .layout-view__grid {
  gap: 0;
}

.layout-view__slot {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  place-items: center;
  align-content: center;
  gap: 5px;
  padding: 8px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 84%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 82%, transparent);
  color: var(--theme-text-secondary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.layout-view--single-stack .layout-view__slot {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.layout-view__slot:not(.layout-view__slot--filled)::before {
  position: absolute;
  inset: 0;
  border: 1px dashed color-mix(in srgb, var(--theme-accent) 18%, transparent);
  border-radius: inherit;
  content: "";
  pointer-events: none;
}

.layout-view__slot--active {
  border-color: color-mix(in srgb, var(--theme-accent) 82%, var(--theme-border-strong));
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--theme-accent) 24%, transparent),
    inset 4px 0 0 color-mix(in srgb, var(--theme-accent) 78%, transparent),
    0 0 0 2px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

.layout-view--single-stack .layout-view__slot--active {
  border-color: transparent;
  box-shadow: none;
}

.layout-view__slot--maximized {
  z-index: 2;
}

.layout-view__slot--hidden-by-maximized {
  display: none;
}

.layout-view__slot--drop-target {
  cursor: copy;
}

.layout-view__slot--drop-active {
  border-color: color-mix(in srgb, var(--theme-accent) 68%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-card-soft));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 28%, transparent),
    0 18px 38px color-mix(in srgb, var(--theme-accent) 14%, transparent);
}

.layout-view__slot--drop-active:not(.layout-view__slot--filled)::before {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, transparent);
}

.layout-view__slot--filled {
  place-items: stretch;
  align-content: stretch;
  background: transparent;
}

.layout-view__slot-body {
  display: grid;
  min-width: 0;
  min-height: 0;
  height: 100%;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) 30px;
  gap: 8px;
}

.layout-view__slot-body--no-slider {
  grid-template-columns: minmax(0, 1fr);
}

.layout-view--single-stack .layout-view__slot-body {
  grid-template-columns: minmax(0, 1fr) 34px;
}

.layout-view--single-stack .layout-view__slot-body--no-slider {
  grid-template-columns: minmax(0, 1fr);
}

.layout-view__slider {
  align-self: stretch;
}

.layout-view__slider--single {
  padding: 10px 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.layout-view__slice-slider {
  width: 14px;
  border: 0 !important;
  appearance: none;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  writing-mode: vertical-lr;
  accent-color: var(--theme-accent);
  outline: none;
}

.layout-view__slice-slider::-webkit-slider-runnable-track {
  width: 4px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-border-strong) 52%, transparent);
  box-shadow: none;
}

.layout-view__slice-slider::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  margin-left: -6px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 82%, white 12%);
  border-radius: 999px;
  appearance: none;
  background: var(--theme-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

.layout-view__slice-slider::-moz-range-track {
  width: 4px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-border-strong) 52%, transparent);
}

.layout-view__slice-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 82%, white 12%);
  border-radius: 999px;
  background: var(--theme-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

.layout-view__image {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: #000;
  object-fit: contain;
  user-select: none;
}

.layout-view__slot-overlay {
  position: absolute;
  left: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  color: var(--theme-text-primary);
  pointer-events: none;
}

.layout-view__slot-overlay--bottom {
  bottom: 10px;
  justify-content: space-between;
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 700;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
}

.layout-view__slot-badge {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-soft));
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  color: var(--theme-accent);
  font-size: 13px;
  font-weight: 800;
}

.layout-view__slot-title {
  color: var(--theme-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.layout-view__slot-subtitle {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
</style>
