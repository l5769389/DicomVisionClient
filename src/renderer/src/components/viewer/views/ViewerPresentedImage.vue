<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type HTMLAttributes } from 'vue'
import {
  releaseRenderedImageObjectUrl,
  retainRenderedImageObjectUrl
} from '../../../composables/workspace/views/renderedImageUrlRegistry'

const props = withDefaults(defineProps<{
  alt?: string
  displayClass?: HTMLAttributes['class']
  draggable?: boolean
  source: string
}>(), {
  alt: '',
  displayClass: '',
  draggable: false
})

const emit = defineEmits<{
  elementReady: [image: HTMLImageElement]
  error: [source: string]
  presented: [image: HTMLImageElement, source: string]
}>()

type ImageSlotId = 0 | 1

interface ImageSlot {
  id: ImageSlotId
  source: string
}

const slots = reactive<[ImageSlot, ImageSlot]>([
  { id: 0, source: '' },
  { id: 1, source: '' }
])
const slotElements = new Map<ImageSlotId, HTMLImageElement>()
const activeSlotId = ref<ImageSlotId>(0)
const decodingSlotId = ref<ImageSlotId | null>(null)
const retiringSlotId = ref<ImageSlotId | null>(null)
const desiredSource = ref(props.source)
let retireFrame: number | null = null

const orderedSlots = computed(() => {
  const activeSlot = slots[activeSlotId.value]
  const inactiveSlot = slots[activeSlotId.value === 0 ? 1 : 0]
  return [activeSlot, inactiveSlot]
})

function setSlotSource(slotId: ImageSlotId, source: string): void {
  const slot = slots[slotId]
  if (slot.source === source) {
    return
  }
  retainRenderedImageObjectUrl(source)
  const previousSource = slot.source
  slot.source = source
  releaseRenderedImageObjectUrl(previousSource)
}

function cancelRetirement(): void {
  if (retireFrame != null) {
    window.cancelAnimationFrame(retireFrame)
    retireFrame = null
  }
}

function publishActiveElement(): void {
  void nextTick(() => {
    const image = slotElements.get(activeSlotId.value)
    if (image) {
      emit('elementReady', image)
    }
  })
}

function clearAllSlots(): void {
  cancelRetirement()
  decodingSlotId.value = null
  retiringSlotId.value = null
  setSlotSource(0, '')
  setSlotSource(1, '')
}

function beginDecoding(source: string): void {
  if (!source || source === slots[activeSlotId.value].source || decodingSlotId.value != null) {
    return
  }
  const nextSlotId: ImageSlotId = activeSlotId.value === 0 ? 1 : 0
  cancelRetirement()
  retiringSlotId.value = null
  decodingSlotId.value = nextSlotId
  setSlotSource(nextSlotId, source)
}

function advanceToDesiredSource(): void {
  const nextSource = desiredSource.value
  const activeSource = slots[activeSlotId.value].source
  if (!nextSource) {
    clearAllSlots()
    return
  }
  if (nextSource === activeSource || decodingSlotId.value != null || retiringSlotId.value != null) {
    return
  }
  beginDecoding(nextSource)
}

function retirePreviousSlot(slotId: ImageSlotId): void {
  cancelRetirement()
  retiringSlotId.value = slotId
  retireFrame = window.requestAnimationFrame(() => {
    // Keep the previous decoded image through one complete browser paint. A
    // second frame avoids exposing the black viewport while the compositor
    // promotes the newly active image layer.
    retireFrame = window.requestAnimationFrame(() => {
      retireFrame = null
      if (retiringSlotId.value === slotId && activeSlotId.value !== slotId) {
        retiringSlotId.value = null
        setSlotSource(slotId, '')
      }
      advanceToDesiredSource()
    })
  })
}

function handleImageLoad(slotId: ImageSlotId, event: Event): void {
  const image = event.currentTarget as HTMLImageElement | null
  const loadedSource = image?.getAttribute('src') ?? ''
  if (!image || !loadedSource || loadedSource !== slots[slotId].source) {
    return
  }

  if (slotId === decodingSlotId.value) {
    const previousActiveSlotId = activeSlotId.value
    activeSlotId.value = slotId
    decodingSlotId.value = null
    emit('elementReady', image)
    emit('presented', image, loadedSource)
    retirePreviousSlot(previousActiveSlotId)
    return
  }

  if (slotId === activeSlotId.value) {
    emit('presented', image, loadedSource)
  }
}

function handleImageError(slotId: ImageSlotId, event: Event): void {
  const image = event.currentTarget as HTMLImageElement | null
  const failedSource = image?.getAttribute('src') ?? ''
  if (!failedSource || failedSource !== slots[slotId].source || slotId !== decodingSlotId.value) {
    return
  }
  decodingSlotId.value = null
  setSlotSource(slotId, '')
  emit('error', failedSource)
  if (desiredSource.value === failedSource) {
    desiredSource.value = slots[activeSlotId.value].source
  }
  advanceToDesiredSource()
}

function setSlotElement(slotId: ImageSlotId, element: unknown): void {
  if (element instanceof HTMLImageElement) {
    slotElements.set(slotId, element)
  } else {
    slotElements.delete(slotId)
  }
}

setSlotSource(0, props.source)

onMounted(publishActiveElement)

onBeforeUnmount(() => {
  clearAllSlots()
  slotElements.clear()
})

watch(
  () => props.source,
  (nextSource) => {
    desiredSource.value = nextSource
    if (!nextSource) {
      clearAllSlots()
      return
    }
    if (!slots[activeSlotId.value].source) {
      setSlotSource(activeSlotId.value, nextSource)
      publishActiveElement()
      return
    }
    advanceToDesiredSource()
  }
)
</script>

<template>
  <template v-for="slot in orderedSlots" :key="slot.id">
    <img
      v-if="slot.source"
      :ref="(element) => setSlotElement(slot.id, element)"
      :alt="slot.id === activeSlotId ? alt : ''"
      :aria-hidden="slot.id === activeSlotId ? undefined : 'true'"
      :class="[
        slot.id === activeSlotId || slot.id === retiringSlotId ? displayClass : '',
        'viewer-image-buffer pointer-events-none absolute inset-0 h-full w-full object-contain object-center',
        slot.id === activeSlotId ? 'viewer-image-buffer--active z-[2]' : '',
        slot.id === decodingSlotId ? 'viewer-image-preload invisible z-0' : '',
        slot.id === retiringSlotId ? 'viewer-image-buffer--retiring z-[1]' : ''
      ]"
      :draggable="slot.id === activeSlotId ? draggable : false"
      :src="slot.source"
      @dragstart.prevent
      @error="handleImageError(slot.id, $event)"
      @load="handleImageLoad(slot.id, $event)"
    />
  </template>
</template>
