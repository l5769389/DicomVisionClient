<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../../AppIcon.vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import { PSEUDOCOLOR_PRESET_OPTIONS } from '../../../constants/pseudocolor'
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
  fusionConfigChange: [payload: { manualRegistration?: boolean; pseudocolorPreset?: string; action?: 'reset' | 'save' }]
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

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const manualDragState = ref<ManualRegistrationDragState | null>(null)

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
const petPseudocolorPreset = computed(() => props.activeTab.fusionInfo?.petPseudocolorPreset ?? 'pet')
const loadingLabel = computed(() => (isZh.value ? '正在加载融合视图...' : 'Loading fusion view...'))
const placeholderLabel = computed(() => (isZh.value ? 'PET/CT 融合预览' : 'PET/CT fusion preview'))

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

function handlePseudocolorChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }
  emit('fusionConfigChange', { pseudocolorPreset: target.value })
}
</script>

<template>
  <div class="pet-ct-fusion-view relative h-full min-h-0 w-full overflow-hidden">
    <div class="pet-ct-fusion-view__toolbar theme-shell-panel-strong absolute right-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-[var(--theme-border-soft)] p-1.5 shadow-lg">
      <button
        type="button"
        class="pet-ct-fusion-view__tool"
        :class="{ 'pet-ct-fusion-view__tool--active': manualRegistrationEnabled }"
        :title="isZh ? '手动配准' : 'Manual registration'"
        @click="emit('fusionConfigChange', { manualRegistration: !manualRegistrationEnabled })"
      >
        <AppIcon name="crosshair" :size="18" />
      </button>
      <button
        type="button"
        class="pet-ct-fusion-view__tool"
        :title="isZh ? '重置配准' : 'Reset registration'"
        @click="emit('fusionConfigChange', { action: 'reset' })"
      >
        <AppIcon name="reset" :size="18" />
      </button>
      <button
        type="button"
        class="pet-ct-fusion-view__tool"
        :title="isZh ? '保存配准' : 'Save registration'"
        @click="emit('fusionConfigChange', { action: 'save' })"
      >
        <AppIcon name="save" :size="18" />
      </button>
      <select
        class="pet-ct-fusion-view__select"
        :value="petPseudocolorPreset"
        :title="isZh ? 'PET 伪彩' : 'PET pseudocolor'"
        @change="handlePseudocolorChange"
      >
        <option
          v-for="option in PSEUDOCOLOR_PRESET_OPTIONS"
          :key="option.key"
          :value="option.key"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-1.5">
      <section
        v-for="pane in panes"
        :key="pane.key"
        class="theme-shell-panel-strong relative min-h-0 overflow-hidden rounded-xl border border-[var(--theme-border-soft)]"
        :class="{ 'pet-ct-fusion-view__pane--active': activeViewportKey === pane.key }"
      >
        <div class="pointer-events-none absolute left-3 top-2 z-10 rounded-md bg-black/35 px-2 py-1 text-[11px] font-semibold text-white/85">
          {{ pane.title }}
        </div>
        <ViewerCanvasStage
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
          :loading-label="loadingLabel"
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
      </section>
    </div>
  </div>
</template>

<style scoped>
.pet-ct-fusion-view__pane--active {
  border-color: color-mix(in srgb, var(--theme-accent) 72%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 52%, transparent);
}

.pet-ct-fusion-view__tool {
  display: inline-flex;
  height: 34px;
  width: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--theme-text-primary);
  transition: background-color 120ms ease, color 120ms ease;
}

.pet-ct-fusion-view__tool:hover,
.pet-ct-fusion-view__tool--active {
  background: color-mix(in srgb, var(--theme-accent) 18%, transparent);
  color: var(--theme-accent-strong);
}

.pet-ct-fusion-view__select {
  height: 34px;
  max-width: 132px;
  border-radius: 10px;
  border: 1px solid var(--theme-border-soft);
  background: var(--theme-control-bg);
  padding: 0 28px 0 10px;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 700;
}
</style>
