<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type HTMLAttributes, type StyleValue } from 'vue'
import {
  releaseRenderedImageObjectUrl,
  retainRenderedImageObjectUrl
} from '../../../composables/workspace/views/renderedImageUrlRegistry'

const props = withDefaults(defineProps<{
  alt?: string
  displayClass?: HTMLAttributes['class']
  displayStyle?: StyleValue
  draggable?: boolean
  source: string
}>(), {
  alt: '',
  displayClass: '',
  displayStyle: undefined,
  draggable: false
})

const emit = defineEmits<{
  elementReady: [image: HTMLImageElement]
  error: [source: string]
  presented: [image: HTMLImageElement, source: string]
}>()

const displayedImageElement = ref<HTMLImageElement | null>(null)
const displayedSource = ref('')
const decodingSource = ref<string | null>(null)
const desiredSource = ref(props.source)

function setDisplayedSource(source: string): void {
  const previousSource = displayedSource.value
  if (source === previousSource) {
    return
  }
  retainRenderedImageObjectUrl(source)
  displayedSource.value = source
  releaseRenderedImageObjectUrl(previousSource)
}

function setDecodingSource(source: string | null): void {
  const previousSource = decodingSource.value
  if (source === previousSource) {
    return
  }
  retainRenderedImageObjectUrl(source)
  decodingSource.value = source
  releaseRenderedImageObjectUrl(previousSource)
}

setDisplayedSource(props.source)

function beginDecoding(source: string): void {
  if (!source || source === displayedSource.value || source === decodingSource.value) {
    return
  }
  setDecodingSource(source)
}

function advanceToDesiredSource(): void {
  const nextSource = desiredSource.value
  if (!nextSource) {
    setDecodingSource(null)
    setDisplayedSource('')
    return
  }
  if (nextSource === displayedSource.value) {
    setDecodingSource(null)
    return
  }
  beginDecoding(nextSource)
}

function handleDecodedImageLoad(event: Event): void {
  const image = event.currentTarget as HTMLImageElement | null
  const loadedSource = image?.getAttribute('src') ?? ''
  if (!image || !loadedSource || loadedSource !== decodingSource.value) {
    return
  }

  if (desiredSource.value !== displayedSource.value) {
    setDisplayedSource(loadedSource)
  }
  setDecodingSource(null)
  advanceToDesiredSource()
}

function handleDecodedImageError(event: Event): void {
  const image = event.currentTarget as HTMLImageElement | null
  const failedSource = image?.getAttribute('src') ?? ''
  if (!failedSource || failedSource !== decodingSource.value) {
    return
  }
  setDecodingSource(null)
  emit('error', failedSource)
  if (desiredSource.value === failedSource) {
    desiredSource.value = displayedSource.value
  }
  advanceToDesiredSource()
}

function handleDisplayedImageLoad(event: Event): void {
  const image = event.currentTarget as HTMLImageElement | null
  const loadedSource = image?.getAttribute('src') ?? ''
  if (!image || !loadedSource || loadedSource !== displayedSource.value) {
    return
  }
  emit('presented', image, loadedSource)
}

function publishDisplayedElement(): void {
  void nextTick(() => {
    if (displayedImageElement.value) {
      emit('elementReady', displayedImageElement.value)
    }
  })
}

onMounted(publishDisplayedElement)

onBeforeUnmount(() => {
  setDecodingSource(null)
  setDisplayedSource('')
})

watch(
  () => props.source,
  (nextSource) => {
    desiredSource.value = nextSource
    if (!nextSource) {
      setDecodingSource(null)
      setDisplayedSource('')
      return
    }
    if (!displayedSource.value) {
      setDisplayedSource(nextSource)
      setDecodingSource(null)
      publishDisplayedElement()
      return
    }
    if (nextSource === displayedSource.value) {
      return
    }
    if (!decodingSource.value) {
      beginDecoding(nextSource)
    }
  }
)
</script>

<template>
  <img
    v-if="displayedSource"
    ref="displayedImageElement"
    :alt="alt"
    :class="displayClass"
    :draggable="draggable"
    :src="displayedSource"
    :style="displayStyle"
    @dragstart.prevent
    @load="handleDisplayedImageLoad"
  />
  <img
    v-if="decodingSource"
    :key="decodingSource"
    class="viewer-image-preload pointer-events-none absolute h-px w-px opacity-0"
    :src="decodingSource"
    alt=""
    draggable="false"
    aria-hidden="true"
    @error="handleDecodedImageError"
    @load="handleDecodedImageLoad"
  />
</template>
