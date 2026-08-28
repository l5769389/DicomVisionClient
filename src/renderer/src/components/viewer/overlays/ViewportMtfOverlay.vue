<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { DraftMeasurementMode, MeasurementDraftPoint, ViewerMtfItem } from '../../../types/viewer'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import {
  getOverlayHandlePointsFromRectBounds,
  getOverlayRectBounds,
  type OverlayRectBounds,
  type OverlayScreenPoint
} from './overlayGeometry'

type MtfRenderMode = 'committed' | 'selected' | 'moving' | 'draft'

interface RenderedMtfItem {
  key: string
  mtfId: string | null
  rect: OverlayRectBounds
  handlePoints: OverlayScreenPoint[]
  mode: MtfRenderMode
}

const ACTION_BAR_WIDTH = 82
const ACTION_BAR_HEIGHT = 42

const committedStrokeOuter = 'rgba(3,15,24,0.92)'
const committedStrokeInner = 'rgba(244,114,182,0.98)'
const draftStrokeOuter = 'rgba(56,18,32,0.92)'
const draftStrokeInner = 'rgba(251,146,190,0.98)'

const props = withDefaults(
  defineProps<{
    focusState?: 'focus' | 'context' | 'neutral'
    imageFrame: {
      left: number
      top: number
      width: number
      height: number
    }
    mtfDraftMode?: DraftMeasurementMode | null
    mtfDraft?: { mtfId?: string; points: MeasurementDraftPoint[] } | null
    mtfItems?: ViewerMtfItem[]
    selectedMtfId?: string | null
  }>(),
  {
    focusState: 'neutral',
    mtfDraftMode: null,
    mtfDraft: null,
    mtfItems: () => [],
    selectedMtfId: null
  }
)

const emit = defineEmits<{
  clear: []
  copy: []
}>()

const { overlayCopy } = useUiLocale()

function buildRenderedMtfItem(
  key: string,
  points: MeasurementDraftPoint[],
  mode: MtfRenderMode,
  source?: ViewerMtfItem | null
): RenderedMtfItem | null {
  const rect = getOverlayRectBounds(props.imageFrame, points)
  if (!rect) {
    return null
  }

  return {
    key,
    mtfId: source?.mtfId ?? (key === 'draft' ? props.mtfDraft?.mtfId ?? null : key),
    rect,
    handlePoints: getOverlayHandlePointsFromRectBounds(rect),
    mode
  }
}

function toMtfRenderMode(mode: DraftMeasurementMode | null | undefined): MtfRenderMode {
  if (mode === 'moving') {
    return 'moving'
  }
  if (mode === 'selected') {
    return 'selected'
  }
  return 'draft'
}

function getActionBarStyle(rect: OverlayRectBounds): { left: string; top: string } {
  const minLeft = props.imageFrame.left + 12
  const maxLeft = Math.max(props.imageFrame.left + props.imageFrame.width - ACTION_BAR_WIDTH - 12, minLeft)
  const minTop = props.imageFrame.top + 12
  const maxTop = Math.max(props.imageFrame.top + props.imageFrame.height - ACTION_BAR_HEIGHT - 12, minTop)

  return {
    left: `${Math.round(Math.max(minLeft, Math.min(maxLeft, rect.left + rect.width + 12)))}px`,
    top: `${Math.round(Math.max(minTop, Math.min(maxTop, rect.top + 4)))}px`
  }
}

const renderedCommittedItems = computed(() =>
  props.mtfItems
    .map((item) =>
      buildRenderedMtfItem(
        item.mtfId,
        item.points,
        item.mtfId === props.selectedMtfId && (!props.mtfDraft || props.mtfDraft.mtfId !== item.mtfId)
          ? 'selected'
          : 'committed',
        item
      )
    )
    .filter((item): item is RenderedMtfItem => item != null)
)

const renderedDraftItem = computed(() => {
  if (!props.mtfDraft) {
    return null
  }

  const sourceItem =
    props.mtfDraft.mtfId != null ? props.mtfItems.find((item) => item.mtfId === props.mtfDraft?.mtfId) ?? null : null

  return buildRenderedMtfItem('draft', props.mtfDraft.points, toMtfRenderMode(props.mtfDraftMode), sourceItem)
})

const allRenderedItems = computed(() =>
  renderedDraftItem.value ? [...renderedCommittedItems.value, renderedDraftItem.value] : renderedCommittedItems.value
)

const activeRenderedItem = computed(() => {
  if (renderedDraftItem.value?.mtfId) {
    return renderedDraftItem.value
  }

  if (!props.selectedMtfId) {
    return null
  }

  return renderedCommittedItems.value.find((item) => item.mtfId === props.selectedMtfId) ?? null
})

const activeActionStyle = computed(() =>
  activeRenderedItem.value ? getActionBarStyle(activeRenderedItem.value.rect) : null
)

function getOuterStroke(item: RenderedMtfItem): string {
  return item.mode === 'committed' ? committedStrokeOuter : draftStrokeOuter
}

function getInnerStroke(item: RenderedMtfItem): string {
  if (item.mode === 'moving') {
    return 'rgba(255,224,130,1)'
  }
  if (item.mode === 'selected') {
    return 'rgba(255,202,111,0.98)'
  }
  return item.mode === 'committed' ? committedStrokeInner : draftStrokeInner
}

function getOuterStrokeDasharray(item: RenderedMtfItem): string | undefined {
  return item.mode === 'draft' ? '10 7' : undefined
}

function getInnerStrokeDasharray(item: RenderedMtfItem): string | undefined {
  return item.mode === 'draft' ? '10 7' : undefined
}

function shouldRenderHandles(item: RenderedMtfItem): boolean {
  return item.mode !== 'committed'
}

function getHandleRadius(item: RenderedMtfItem): number {
  return item.mode === 'committed' ? 3.5 : 4
}

function getHandleFill(item: RenderedMtfItem): string {
  return item.mode === 'committed' ? 'white' : 'rgba(255,244,214,0.98)'
}

function getShapeFill(item: RenderedMtfItem): string {
  if (item.mode === 'moving') {
    return 'rgba(255,184,77,0.18)'
  }
  if (item.mode === 'selected') {
    return 'rgba(255,184,77,0.1)'
  }
  return 'none'
}
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 transition-opacity duration-150"
    :class="props.focusState === 'focus' ? 'z-[11] opacity-100' : props.focusState === 'context' ? 'z-[8] opacity-[0.48]' : 'z-[8] opacity-100'"
  >
    <svg class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" shape-rendering="geometricPrecision">
      <g v-for="item in allRenderedItems" :key="item.key">
        <rect
          :x="item.rect.left"
          :y="item.rect.top"
          :width="item.rect.width"
          :height="item.rect.height"
          :fill="getShapeFill(item)"
          :stroke="getOuterStroke(item)"
          stroke-width="5"
          stroke-linejoin="round"
          :stroke-dasharray="getOuterStrokeDasharray(item)"
        />
        <rect
          :x="item.rect.left"
          :y="item.rect.top"
          :width="item.rect.width"
          :height="item.rect.height"
          :fill="getShapeFill(item)"
          :stroke="getInnerStroke(item)"
          stroke-width="2.5"
          stroke-linejoin="round"
          :stroke-dasharray="getInnerStrokeDasharray(item)"
        />

        <template v-if="shouldRenderHandles(item)">
          <circle
            v-for="(handle, index) in item.handlePoints"
            :key="`${item.key}-handle-${index}`"
            :cx="handle.x"
            :cy="handle.y"
            :r="getHandleRadius(item)"
            :fill="getHandleFill(item)"
            :stroke="getOuterStroke(item)"
            stroke-width="1.25"
          />
        </template>
      </g>
    </svg>

    <div
      v-if="activeRenderedItem?.mtfId && activeActionStyle"
      class="pointer-events-auto absolute z-[13] inline-flex items-center gap-1 rounded-xl border border-white/12 bg-slate-950/92 p-1 shadow-[0_12px_24px_rgba(0,0,0,0.34)]"
      :class="props.focusState === 'focus' ? 'ring-1 ring-pink-200/18' : ''"
      :style="activeActionStyle"
      @pointerdown.stop.prevent
    >
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-slate-100 transition hover:bg-white/12"
        :aria-label="overlayCopy.copyMtfRoi"
        @click="emit('copy')"
      >
        <AppIcon name="copy" :size="16" />
      </button>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/16 bg-red-400/10 text-red-100 transition hover:bg-red-400/18"
        :aria-label="overlayCopy.deleteMtfRoi"
        @click="emit('clear')"
      >
        <AppIcon name="trash" :size="16" />
      </button>
    </div>
  </div>
</template>
