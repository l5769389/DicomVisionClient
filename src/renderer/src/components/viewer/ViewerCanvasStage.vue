<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CornerInfo, MprCrosshairInfo, OrientationInfo } from '../../types/viewer'
import ViewportCornerOverlay from './ViewportCornerOverlay.vue'
import ViewportCrosshairOverlay from './ViewportCrosshairOverlay.vue'
import ViewportOrientationOverlay from './ViewportOrientationOverlay.vue'

const props = withDefaults(
  defineProps<{
    alt: string
    cornerInfo: CornerInfo
    imageClass?: string
    imageSrc: string
    isActive?: boolean
    mprCrosshair?: MprCrosshairInfo | null
    orientation: OrientationInfo
    placeholder: string
    renderSurfaceActive?: boolean
    softImage?: boolean
    viewportClass?: string
    viewportKey: string
  }>(),
  {
    imageClass: '',
    isActive: false,
    mprCrosshair: null,
    renderSurfaceActive: false,
    softImage: false,
    viewportClass: ''
  }
)

const emit = defineEmits<{
  clickViewport: [viewportKey: string]
  pointerCancel: [event: PointerEvent]
  pointerDown: [event: PointerEvent, viewportKey: string]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  wheelViewport: [payload: { viewportKey: string; deltaY: number }]
}>()

const stageRef = ref<HTMLDivElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const stageSize = ref({
  width: 0,
  height: 0
})
const imageFrame = ref({
  left: 0,
  top: 0,
  width: 0,
  height: 0
})

let resizeObserver: ResizeObserver | null = null

function getRenderedImageRect(image: HTMLImageElement): DOMRect {
  const rect = image.getBoundingClientRect()
  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) {
    return rect
  }

  const elementAspectRatio = rect.width / rect.height
  const imageAspectRatio = naturalWidth / naturalHeight

  if (elementAspectRatio > imageAspectRatio) {
    const renderedWidth = rect.height * imageAspectRatio
    const offsetX = (rect.width - renderedWidth) / 2
    return new DOMRect(rect.left + offsetX, rect.top, renderedWidth, rect.height)
  }

  const renderedHeight = rect.width / imageAspectRatio
  const offsetY = (rect.height - renderedHeight) / 2
  return new DOMRect(rect.left, rect.top + offsetY, rect.width, renderedHeight)
}

function updateStageMetrics(): void {
  const stage = stageRef.value
  const image = imageRef.value

  if (!stage) {
    return
  }

  const stageRect = stage.getBoundingClientRect()
  stageSize.value = {
    width: stageRect.width,
    height: stageRect.height
  }

  if (!image || !props.imageSrc) {
    imageFrame.value = {
      left: 0,
      top: 0,
      width: 0,
      height: 0
    }
    return
  }

  const imageRect = getRenderedImageRect(image)
  imageFrame.value = {
    left: imageRect.left - stageRect.left,
    top: imageRect.top - stageRect.top,
    width: imageRect.width,
    height: imageRect.height
  }
}

function observeLayout(): void {
  resizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver = new ResizeObserver(() => {
    updateStageMetrics()
  })

  if (stageRef.value) {
    resizeObserver.observe(stageRef.value)
  }
  if (imageRef.value) {
    resizeObserver.observe(imageRef.value)
  }
}

onMounted(() => {
  observeLayout()
  updateStageMetrics()
  window.addEventListener('resize', updateStageMetrics)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', updateStageMetrics)
})

watch(
  () => [props.imageSrc, props.isActive, props.viewportKey] as const,
  async () => {
    await nextTick()
    observeLayout()
    updateStageMetrics()
  }
)
</script>

<template>
  <div
    class="viewer-viewport relative h-full w-full overflow-hidden rounded-2xl border border-slate-600/20 bg-[linear-gradient(180deg,rgba(4,8,14,0.98),rgba(2,5,10,1)),radial-gradient(circle_at_top_right,rgba(35,130,210,0.08),transparent_28%)] text-slate-200"
    :class="[
      viewportClass,
      isActive
        ? 'border-sky-300/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_0_0_1px_rgba(83,170,241,0.18),0_8px_16px_rgba(8,89,156,0.14)]'
        : ''
    ]"
    :data-active-viewport="isActive ? 'true' : 'false'"
    @click="emit('clickViewport', viewportKey)"
    @wheel.prevent="emit('wheelViewport', { viewportKey, deltaY: $event.deltaY })"
    @pointerdown="emit('pointerDown', $event, viewportKey)"
    @pointermove="emit('pointerMove', $event)"
    @pointerup="emit('pointerUp', $event)"
    @pointercancel="emit('pointerCancel', $event)"
  >
    <div
      ref="stageRef"
      class="relative grid h-full w-full place-items-center overflow-hidden bg-black"
      :data-active-render-surface="renderSurfaceActive ? 'true' : 'false'"
      :data-viewport-key="viewportKey"
    >
      <img
        v-if="imageSrc"
        ref="imageRef"
        class="block h-full w-full select-none object-contain object-center pointer-events-none"
        :class="[imageClass, { 'opacity-[0.88] saturate-[0.9]': softImage }]"
        :src="imageSrc"
        :alt="alt"
        draggable="false"
        @dragstart.prevent
        @load="updateStageMetrics"
      />
      <ViewportCrosshairOverlay
        :stage-width="stageSize.width"
        :stage-height="stageSize.height"
        :image-frame="imageFrame"
        :mpr-crosshair="mprCrosshair"
        :viewport-key="viewportKey"
        :is-active="isActive"
      />
      <ViewportCornerOverlay :corner-info="cornerInfo" :viewport-key="viewportKey" />
      <ViewportOrientationOverlay :orientation="orientation" />
      <span
        v-if="!imageSrc"
        class="absolute left-3 top-3 rounded-full bg-slate-900/80 px-3 py-1 text-xs tracking-[0.14em] text-slate-400"
      >
        {{ placeholder }}
      </span>
    </div>
  </div>
</template>
