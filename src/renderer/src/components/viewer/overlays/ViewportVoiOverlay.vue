<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OverlayImageFrame } from './overlayGeometry'
import type { MprSegmentationConfig, MprSegmentationVoiBox, MprViewportKey } from '../../../types/viewer'
import {
  createDefaultMprSegmentationConfig,
  createDefaultMprSegmentationVoiBox,
  normalizeMprSegmentationConfig
} from '../../../types/viewer'
import {
  getVoiPlaneRect,
  normalizeVoiRectFromPoints,
  resizeVoiPlaneRect,
  translateVoiPlaneRect,
  updateVoiBoxFromPlaneRect,
  type NormalizedVoiPoint,
  type NormalizedVoiRect,
  type VoiResizeHandle
} from '../../../composables/measurements/mprVoiGeometry'

const props = withDefaults(
  defineProps<{
    config?: MprSegmentationConfig | null
    editable?: boolean
    imageFrame: OverlayImageFrame
    isOblique?: boolean
    viewportKey: string
  }>(),
  {
    config: null,
    editable: false,
    isOblique: false
  }
)

const emit = defineEmits<{
  configChange: [config: MprSegmentationConfig, actionType?: 'move' | 'end']
}>()

type DragState =
  | {
      kind: 'create'
      pointerId: number
      anchor: NormalizedVoiPoint
      baseBox: MprSegmentationVoiBox
    }
  | {
      kind: 'move'
      pointerId: number
      anchor: NormalizedVoiPoint
      startRect: NormalizedVoiRect
      baseBox: MprSegmentationVoiBox
    }
  | {
      kind: 'resize'
      pointerId: number
      handle: VoiResizeHandle
      startRect: NormalizedVoiRect
      baseBox: MprSegmentationVoiBox
    }

const overlayRef = ref<HTMLDivElement | null>(null)
const dragState = ref<DragState | null>(null)

const mprViewportKey = computed<MprViewportKey | null>(() => {
  const key = props.viewportKey
  return key === 'mpr-ax' || key === 'mpr-cor' || key === 'mpr-sag' ? key : null
})

const normalizedConfig = computed(() =>
  normalizeMprSegmentationConfig(props.config ?? createDefaultMprSegmentationConfig())
)

const currentBox = computed(() => normalizedConfig.value.voiBox ?? null)
const shouldRender = computed(() => {
  return Boolean(mprViewportKey.value && props.imageFrame.width > 1 && props.imageFrame.height > 1 && (currentBox.value || canEdit.value))
})
const canEdit = computed(() => Boolean(props.editable && !props.isOblique && mprViewportKey.value))

const overlayStyle = computed(() => ({
  left: `${props.imageFrame.left}px`,
  top: `${props.imageFrame.top}px`,
  width: `${props.imageFrame.width}px`,
  height: `${props.imageFrame.height}px`
}))

const rect = computed<NormalizedVoiRect | null>(() => {
  const viewportKey = mprViewportKey.value
  const box = currentBox.value
  if (!viewportKey || !box) {
    return null
  }
  return getVoiPlaneRect(box, viewportKey)
})

const rectStyle = computed(() => {
  const value = rect.value
  if (!value) {
    return null
  }
  return {
    x: `${value.xMin * 100}%`,
    y: `${value.yMin * 100}%`,
    width: `${Math.max(0, value.xMax - value.xMin) * 100}%`,
    height: `${Math.max(0, value.yMax - value.yMin) * 100}%`
  }
})

const handlePoints = computed<Array<{ handle: VoiResizeHandle; x: string; y: string }>>(() => {
  const value = rect.value
  if (!value) {
    return []
  }
  return [
    { handle: 'nw', x: `${value.xMin * 100}%`, y: `${value.yMin * 100}%` },
    { handle: 'ne', x: `${value.xMax * 100}%`, y: `${value.yMin * 100}%` },
    { handle: 'se', x: `${value.xMax * 100}%`, y: `${value.yMax * 100}%` },
    { handle: 'sw', x: `${value.xMin * 100}%`, y: `${value.yMax * 100}%` }
  ]
})

function getPoint(event: PointerEvent): NormalizedVoiPoint | null {
  const overlay = overlayRef.value
  if (!overlay) {
    return null
  }
  const bounds = overlay.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null
  }
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
  }
}

function emitRect(rectValue: NormalizedVoiRect, baseBox: MprSegmentationVoiBox, actionType: 'move' | 'end'): void {
  const viewportKey = mprViewportKey.value
  if (!viewportKey) {
    return
  }
  const nextBox = updateVoiBoxFromPlaneRect(baseBox, viewportKey, rectValue)
  emit(
    'configChange',
    normalizeMprSegmentationConfig({
      ...normalizedConfig.value,
      voiBox: nextBox
    }),
    actionType
  )
}

function beginDrag(event: PointerEvent, state: DragState): void {
  if (!canEdit.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  dragState.value = state
  overlayRef.value?.setPointerCapture(event.pointerId)
}

function beginCreate(event: PointerEvent): void {
  const point = getPoint(event)
  if (!point || !canEdit.value) {
    return
  }
  beginDrag(event, {
    kind: 'create',
    pointerId: event.pointerId,
    anchor: point,
    baseBox: currentBox.value ?? createDefaultMprSegmentationVoiBox()
  })
}

function beginMove(event: PointerEvent): void {
  const point = getPoint(event)
  const value = rect.value
  if (!point || !value || !currentBox.value || !canEdit.value) {
    return
  }
  beginDrag(event, {
    kind: 'move',
    pointerId: event.pointerId,
    anchor: point,
    startRect: value,
    baseBox: currentBox.value
  })
}

function beginResize(event: PointerEvent, handle: VoiResizeHandle): void {
  const value = rect.value
  if (!value || !currentBox.value || !canEdit.value) {
    return
  }
  beginDrag(event, {
    kind: 'resize',
    pointerId: event.pointerId,
    handle,
    startRect: value,
    baseBox: currentBox.value
  })
}

function updateDrag(event: PointerEvent, actionType: 'move' | 'end'): void {
  const state = dragState.value
  if (!state || state.pointerId !== event.pointerId) {
    return
  }
  const point = getPoint(event)
  if (!point) {
    return
  }

  if (state.kind === 'create') {
    emitRect(normalizeVoiRectFromPoints(state.anchor, point), state.baseBox, actionType)
    return
  }
  if (state.kind === 'move') {
    emitRect(
      translateVoiPlaneRect(state.startRect, point.x - state.anchor.x, point.y - state.anchor.y),
      state.baseBox,
      actionType
    )
    return
  }
  emitRect(resizeVoiPlaneRect(state.startRect, state.handle, point), state.baseBox, actionType)
}

function handlePointerMove(event: PointerEvent): void {
  if (!dragState.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateDrag(event, 'move')
}

function endDrag(event: PointerEvent): void {
  const state = dragState.value
  if (!state || state.pointerId !== event.pointerId) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateDrag(event, 'end')
  overlayRef.value?.releasePointerCapture(event.pointerId)
  dragState.value = null
}
</script>

<template>
  <div
    v-if="shouldRender"
    ref="overlayRef"
    class="absolute z-[3]"
    :class="canEdit ? 'cursor-crosshair' : 'pointer-events-none'"
    :style="overlayStyle"
    data-testid="viewport-voi-overlay"
    @pointermove="handlePointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <svg class="h-full w-full overflow-visible">
      <rect
        class="fill-transparent"
        x="0"
        y="0"
        width="100%"
        height="100%"
        :pointer-events="canEdit ? 'all' : 'none'"
        @pointerdown="beginCreate"
      />
      <rect
        v-if="rectStyle"
        class="fill-cyan-300/10 stroke-cyan-200/90"
        :class="canEdit ? 'cursor-move' : ''"
        :x="rectStyle.x"
        :y="rectStyle.y"
        :width="rectStyle.width"
        :height="rectStyle.height"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
        :pointer-events="canEdit ? 'all' : 'none'"
        @pointerdown="beginMove"
      />
      <circle
        v-for="point in handlePoints"
        :key="point.handle"
        class="fill-cyan-100 stroke-slate-950"
        :class="canEdit ? 'cursor-nwse-resize' : ''"
        :cx="point.x"
        :cy="point.y"
        r="5"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        :pointer-events="canEdit ? 'all' : 'none'"
        @pointerdown="beginResize($event, point.handle)"
      />
    </svg>
  </div>
</template>
