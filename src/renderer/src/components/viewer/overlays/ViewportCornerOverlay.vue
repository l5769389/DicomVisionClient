<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { isPseudocolorBackgroundLight } from '../../../constants/pseudocolor'
import { applyViewportCornerInfoPreference } from '../../../composables/ui/viewportCornerInfo'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import type { CornerInfo, CornerPosition } from '../../../types/viewer'

const props = defineProps<{
  cornerInfo: CornerInfo
  pet?: boolean
  pseudocolorPreset?: string | null
  viewportKey: string
}>()

const { viewportCornerInfoPreference } = useUiPreferences()
const cornerPositions: CornerPosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
const overlayRef = ref<HTMLDivElement | null>(null)
const hoveredLineKey = ref<string | null>(null)
const pinnedLineKey = ref<string | null>(null)
const truncatedLineKeys = ref<Set<string>>(new Set())
let resizeObserver: ResizeObserver | null = null
const displayCornerInfo = computed(() =>
  applyViewportCornerInfoPreference(props.cornerInfo, viewportCornerInfoPreference.value)
)
const cornerOverlayClass = computed(() => [
  `viewer-corner-overlay--${viewportCornerInfoPreference.value.typographyPreset}`,
  {
    'viewer-corner-overlay--pet': props.pet,
    // PET overlays use a modality-specific adaptive red treatment. A generic
    // custom overlay color can become unreadable on PET LUT backgrounds.
    'viewer-corner-overlay--custom-color': !props.pet && viewportCornerInfoPreference.value.colorMode === 'custom',
    'viewer-corner-overlay--light-background':
      viewportCornerInfoPreference.value.colorMode === 'auto' && isPseudocolorBackgroundLight(props.pseudocolorPreset)
  }
])
const cornerOverlayStyle = computed(() =>
  !props.pet && viewportCornerInfoPreference.value.colorMode === 'custom'
    ? {
      '--viewer-corner-custom-dark-color': viewportCornerInfoPreference.value.customDarkColor,
      '--viewer-corner-custom-light-color': viewportCornerInfoPreference.value.customLightColor
    }
    : undefined
)

function getCornerLines(cornerInfo: CornerInfo, position: CornerPosition): string[] {
  return cornerInfo[position] ?? []
}

function getLineKey(position: CornerPosition, lineIndex: number): string {
  return `${position}:${lineIndex}`
}

function isLineExpanded(position: CornerPosition, lineIndex: number): boolean {
  const key = getLineKey(position, lineIndex)
  return hoveredLineKey.value === key || pinnedLineKey.value === key
}

function getExpandedLine(position: CornerPosition): string | null {
  const lines = getCornerLines(displayCornerInfo.value, position)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (isLineExpanded(position, lineIndex)) {
      return lines[lineIndex] ?? null
    }
  }
  return null
}

function isLineTruncated(position: CornerPosition, lineIndex: number): boolean {
  return truncatedLineKeys.value.has(getLineKey(position, lineIndex))
}

function updateLineTruncation(element: HTMLElement, key: string): boolean {
  const truncated = element.scrollWidth > element.clientWidth + 1
  const next = new Set(truncatedLineKeys.value)
  if (truncated) {
    next.add(key)
  } else {
    next.delete(key)
    if (hoveredLineKey.value === key) {
      hoveredLineKey.value = null
    }
    if (pinnedLineKey.value === key) {
      pinnedLineKey.value = null
    }
  }
  truncatedLineKeys.value = next
  return truncated
}

function measureAllLines(): void {
  for (const element of overlayRef.value?.querySelectorAll<HTMLElement>('[data-corner-line-key]') ?? []) {
    const key = element.dataset.cornerLineKey
    if (key) {
      updateLineTruncation(element, key)
    }
  }
}

function handleLinePointerEnter(event: PointerEvent, position: CornerPosition, lineIndex: number): void {
  const key = getLineKey(position, lineIndex)
  if (updateLineTruncation(event.currentTarget as HTMLElement, key)) {
    hoveredLineKey.value = key
  }
}

function handleLinePointerLeave(position: CornerPosition, lineIndex: number): void {
  const key = getLineKey(position, lineIndex)
  if (hoveredLineKey.value === key) {
    hoveredLineKey.value = null
  }
}

function handleLineClick(event: MouseEvent, position: CornerPosition, lineIndex: number): void {
  const key = getLineKey(position, lineIndex)
  if (!updateLineTruncation(event.currentTarget as HTMLElement, key)) {
    return
  }
  pinnedLineKey.value = pinnedLineKey.value === key ? null : key
}

function handleLineFocus(event: FocusEvent, position: CornerPosition, lineIndex: number): void {
  const key = getLineKey(position, lineIndex)
  if (updateLineTruncation(event.currentTarget as HTMLElement, key)) {
    hoveredLineKey.value = key
  }
}

function handleLineBlur(position: CornerPosition, lineIndex: number): void {
  handleLinePointerLeave(position, lineIndex)
}

function handleLineKeydown(event: KeyboardEvent, position: CornerPosition, lineIndex: number): void {
  if (!['Enter', ' '].includes(event.key)) {
    return
  }
  event.preventDefault()
  const element = event.currentTarget as HTMLElement
  const key = getLineKey(position, lineIndex)
  if (updateLineTruncation(element, key)) {
    pinnedLineKey.value = pinnedLineKey.value === key ? null : key
  }
}

function handleDocumentPointerDown(): void {
  pinnedLineKey.value = null
}

function isCoordinateLine(line: string): boolean {
  return /^(?:Cursor\s+)?X:\s*(?:-?\d+|--)\s+Y:\s*(?:-?\d+|--)(?:\s+.+)?$/i.test(line.trim())
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('resize', measureAllLines)
  if (typeof ResizeObserver !== 'undefined' && overlayRef.value) {
    resizeObserver = new ResizeObserver(measureAllLines)
    resizeObserver.observe(overlayRef.value)
  }
  void nextTick(measureAllLines)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', measureAllLines)
  resizeObserver?.disconnect()
})

watch(displayCornerInfo, () => {
  hoveredLineKey.value = null
  pinnedLineKey.value = null
  void nextTick(measureAllLines)
}, { deep: true })
</script>

<template>
  <div ref="overlayRef" class="viewer-corner-overlay pointer-events-none absolute inset-0 z-[6]" :class="cornerOverlayClass" :style="cornerOverlayStyle">
    <div
      v-for="position in cornerPositions"
      :key="`${viewportKey}-${position}`"
      class="viewer-corner-block"
      :class="[
        `viewer-corner-block--${position}`,
        {
          'viewer-corner-block--empty': !getCornerLines(displayCornerInfo, position).length
        }
      ]"
    >
      <span
        v-for="(line, lineIndex) in getCornerLines(displayCornerInfo, position)"
        :key="`${viewportKey}-${position}-${lineIndex}`"
        class="viewer-corner-line"
        :class="{
          'viewer-corner-line--coordinates': isCoordinateLine(line),
          'viewer-corner-line--truncated': isLineTruncated(position, lineIndex)
        }"
        :data-corner-line-key="getLineKey(position, lineIndex)"
        :role="isLineTruncated(position, lineIndex) ? 'button' : undefined"
        :tabindex="isLineTruncated(position, lineIndex) ? 0 : undefined"
        :aria-expanded="isLineTruncated(position, lineIndex) ? isLineExpanded(position, lineIndex) : undefined"
        :title="isLineTruncated(position, lineIndex) ? line : undefined"
        @pointerenter="handleLinePointerEnter($event, position, lineIndex)"
        @pointerleave="handleLinePointerLeave(position, lineIndex)"
        @pointerdown.stop
        @click.stop="handleLineClick($event, position, lineIndex)"
        @focus="handleLineFocus($event, position, lineIndex)"
        @blur="handleLineBlur(position, lineIndex)"
        @keydown="handleLineKeydown($event, position, lineIndex)"
      >
        {{ line }}
      </span>
      <div v-if="getExpandedLine(position)" class="viewer-corner-detail">
        <span class="viewer-corner-detail-line">{{ getExpandedLine(position) }}</span>
      </div>
    </div>
  </div>
</template>
