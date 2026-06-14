<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import {
  MPR_SEGMENTATION_DEPTH_LIMITS,
  MPR_SEGMENTATION_HU_LIMITS,
  createDefaultMprSegmentationConfig,
  normalizeMprSegmentationConfig,
  type MprSegmentationConfigActionType,
  type MprSegmentationConfig,
  type MprThresholdRegion,
  type MprVoiSphere
} from '../../types/viewer'

const props = defineProps<{
  config: MprSegmentationConfig
  isProcessing?: boolean
}>()

const emit = defineEmits<{
  close: []
  configChange: [config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType]
  modeChange: [mode: 'segmentation:threshold' | 'segmentation:voi']
}>()

type PanelActionType = MprSegmentationConfigActionType

const PANEL_MARGIN_PX = 12
const DEFAULT_PANEL_TOP_PX = 80
const DEFAULT_PANEL_RIGHT_PX = 16
const DEFAULT_PANEL_WIDTH_PX = 520

interface PanelPosition {
  x: number
  y: number
}

const draftConfig = ref<MprSegmentationConfig | null>(null)
const localDraftActive = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const panelPosition = ref<PanelPosition | null>(null)
const panelDragState = ref<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
const displayedConfig = computed(() => draftConfig.value ?? normalizeMprSegmentationConfig(props.config))
const regions = computed(() => displayedConfig.value.thresholdRegions)
const voiSpheres = computed(() => displayedConfig.value.voiSpheres)
const selectedRegion = computed(() =>
  regions.value.find((region) => region.id === displayedConfig.value.selectedRegionId) ?? null
)
const panelRootStyle = computed<Record<string, string>>(() => {
  const position = panelPosition.value
  if (position) {
    return {
      left: `${position.x}px`,
      top: `${position.y}px`,
      right: 'auto',
      maxHeight: `calc(100vh - ${PANEL_MARGIN_PX * 2}px)`
    }
  }
  return {
    left: 'auto',
    right: `${DEFAULT_PANEL_RIGHT_PX}px`,
    top: `${DEFAULT_PANEL_TOP_PX}px`,
    maxHeight: `calc(100vh - ${PANEL_MARGIN_PX * 2}px)`
  }
})

watch(
  () => props.config,
  () => {
    if (draftConfig.value && localDraftActive.value) {
      return
    }
    draftConfig.value = null
  },
  { deep: true }
)

function emitConfig(config: MprSegmentationConfig, actionType: PanelActionType = 'end'): void {
  const normalized = normalizeMprSegmentationConfig(config)
  if (actionType === 'local') {
    localDraftActive.value = true
    draftConfig.value = normalized
    emit('configChange', normalized, actionType)
    return
  }

  if (actionType === 'move') {
    localDraftActive.value = true
    draftConfig.value = normalized
    emit('configChange', normalized, actionType)
  } else {
    localDraftActive.value = false
    draftConfig.value = null
    emit('configChange', normalized, actionType)
  }
}

onBeforeUnmount(() => {
  stopPanelDrag()
})

function emitPatch(patch: Partial<MprSegmentationConfig>, actionType: PanelActionType = 'end'): void {
  emitConfig(
    {
      ...displayedConfig.value,
      ...patch
    },
    actionType
  )
}

function patchRegion(regionId: string, patch: Partial<MprThresholdRegion>, actionType: PanelActionType = 'end'): void {
  emitPatch(
    {
      selectedRegionId: regionId,
      selectedVoi: false,
      selectedVoiId: null,
      thresholdRegions: regions.value.map((region) =>
        region.id === regionId
          ? {
              ...region,
              ...patch,
              box: patch.box ?? region.box,
              stats: patch.stats ?? null
            }
          : region
      )
    },
    actionType
  )
}

function selectRegion(regionId: string): void {
  emit('modeChange', 'segmentation:threshold')
  emitPatch({ selectedRegionId: regionId, selectedVoi: false, selectedVoiId: null }, 'end')
}

function toggleRegion(region: MprThresholdRegion): void {
  patchRegion(region.id, { enabled: !region.enabled }, 'end')
}

function deleteRegion(regionId: string): void {
  const nextRegions = regions.value.filter((region) => region.id !== regionId)
  emitPatch(
    {
      selectedRegionId: nextRegions[0]?.id ?? null,
      selectedVoi: false,
      selectedVoiId: null,
      thresholdRegions: nextRegions
    },
    'end'
  )
}

function updateThreshold(region: MprThresholdRegion, value: string, actionType: 'move' | 'end' = 'move'): void {
  patchRegion(region.id, { thresholdHu: Number(value), thresholdMode: 'hu', stats: null }, actionType === 'move' ? 'local' : actionType)
}

function updateThresholdPercentile(region: MprThresholdRegion, value: string, actionType: 'move' | 'end' = 'move'): void {
  patchRegion(region.id, { thresholdPercentile: Number(value), thresholdMode: 'percentile', stats: null }, actionType === 'move' ? 'local' : actionType)
}

function updateThresholdMode(region: MprThresholdRegion, mode: MprThresholdRegion['thresholdMode']): void {
  patchRegion(region.id, { thresholdMode: mode, stats: null }, 'end')
}

function updateDepth(region: MprThresholdRegion, value: string, actionType: 'move' | 'end' = 'move'): void {
  patchRegion(
    region.id,
    {
      box: {
        ...region.box,
        depthMm: Number(value)
      },
      stats: null
    },
    actionType
  )
}

function clampPanelPosition(x: number, y: number): PanelPosition {
  if (typeof window === 'undefined') {
    return { x, y }
  }
  const panel = panelRef.value
  const width = panel?.offsetWidth || DEFAULT_PANEL_WIDTH_PX
  const height = panel?.offsetHeight || Math.min(520, window.innerHeight - PANEL_MARGIN_PX * 2)
  const maxX = Math.max(PANEL_MARGIN_PX, window.innerWidth - width - PANEL_MARGIN_PX)
  const maxY = Math.max(PANEL_MARGIN_PX, window.innerHeight - Math.min(height, window.innerHeight - PANEL_MARGIN_PX * 2) - PANEL_MARGIN_PX)
  return {
    x: Math.max(PANEL_MARGIN_PX, Math.min(maxX, x)),
    y: Math.max(PANEL_MARGIN_PX, Math.min(maxY, y))
  }
}

function stopPanelDrag(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', handlePanelPointerMove)
    window.removeEventListener('pointerup', handlePanelPointerUp)
    window.removeEventListener('pointercancel', handlePanelPointerUp)
  }
  panelDragState.value = null
}

function beginPanelDrag(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }
  const panel = panelRef.value
  if (!panel) {
    return
  }
  const rect = panel.getBoundingClientRect()
  const currentPosition = panelPosition.value ?? { x: rect.left, y: rect.top }
  const clampedPosition = clampPanelPosition(currentPosition.x, currentPosition.y)
  panelPosition.value = clampedPosition
  panelDragState.value = {
    pointerId: event.pointerId,
    offsetX: event.clientX - clampedPosition.x,
    offsetY: event.clientY - clampedPosition.y
  }
  window.addEventListener('pointermove', handlePanelPointerMove)
  window.addEventListener('pointerup', handlePanelPointerUp)
  window.addEventListener('pointercancel', handlePanelPointerUp)
  event.preventDefault()
  event.stopPropagation()
}

function handlePanelPointerMove(event: PointerEvent): void {
  const dragState = panelDragState.value
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return
  }
  panelPosition.value = clampPanelPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY)
}

function handlePanelPointerUp(event: PointerEvent): void {
  const dragState = panelDragState.value
  if (dragState && dragState.pointerId !== event.pointerId) {
    return
  }
  stopPanelDrag()
}

function clearThresholdRegions(): void {
  emitPatch({ selectedRegionId: null, thresholdRegions: [] }, 'end')
}

function clearVoi(sphereId: string): void {
  const nextSpheres = voiSpheres.value.filter((sphere) => sphere.id !== sphereId)
  const selectedVoiId = displayedConfig.value.selectedVoiId === sphereId ? null : displayedConfig.value.selectedVoiId
  emitPatch({
    selectedVoi: selectedVoiId !== null,
    selectedVoiId,
    voiSpheres: nextSpheres,
    voiSphere: nextSpheres[0] ?? null
  }, 'end')
}

function patchVoiSphere(sphereId: string, patch: Partial<MprVoiSphere>, actionType: PanelActionType = 'end'): void {
  const sphere = voiSpheres.value.find((candidate) => candidate.id === sphereId)
  if (!sphere) {
    return
  }
  const nextSphere = {
    ...sphere,
    ...patch,
    stats: patch.stats ?? null
  }
  const selectedVoiId = patch.enabled === false && displayedConfig.value.selectedVoiId === sphereId
    ? null
    : sphereId
  const nextSpheres = voiSpheres.value.map((candidate) => (candidate.id === sphereId ? nextSphere : candidate))
  emitPatch(
    {
      selectedRegionId: null,
      selectedVoi: selectedVoiId !== null,
      selectedVoiId,
      voiSpheres: nextSpheres,
      voiSphere: nextSphere
    },
    actionType
  )
}

function selectVoi(sphereId: string): void {
  if (!voiSpheres.value.some((sphere) => sphere.id === sphereId)) {
    return
  }
  emit('modeChange', 'segmentation:voi')
  emitPatch({ selectedRegionId: null, selectedVoi: true, selectedVoiId: sphereId }, 'end')
}

function clearAll(): void {
  emitConfig(createDefaultMprSegmentationConfig(), 'end')
}

function formatMetric(value: number | null | undefined, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'
}

function formatStatsSummary(region: MprThresholdRegion): string {
  const stats = region.stats
  return [
    `mean ${formatMetric(stats?.huMean)}`,
    `min ${formatMetric(stats?.huMin)}`,
    `max ${formatMetric(stats?.huMax)}`,
    `sd ${formatMetric(stats?.huStdDev)}`,
    `vol ${formatMetric(stats?.volumeCm3)} cm3`,
    `n ${stats?.sampleCount ?? 0}`,
    `eff ${formatMetric(stats?.effectiveThresholdHu)}`
  ].join(' / ')
}

function formatVoiStatsSummary(sphere: MprVoiSphere): string {
  const stats = sphere.stats
  return [
    `mean ${formatMetric(stats?.huMean)}`,
    `min ${formatMetric(stats?.huMin)}`,
    `max ${formatMetric(stats?.huMax)}`,
    `sd ${formatMetric(stats?.huStdDev)}`,
    `vol ${formatMetric(stats?.volumeCm3)} cm3`,
    `n ${stats?.sampleCount ?? 0}`
  ].join(' / ')
}

function formatEffectiveThreshold(region: MprThresholdRegion): string {
  return formatMetric(region.stats?.effectiveThresholdHu ?? region.thresholdHu)
}
</script>

<template>
  <div
    v-bind="$attrs"
    ref="panelRef"
    class="theme-shell-panel fixed z-[60] w-[min(520px,calc(100vw-2.5rem))] overflow-y-auto rounded-xl border border-sky-100/25 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-panel-strong-solid)_98%,black_2%),color-mix(in_srgb,var(--theme-surface-panel-solid)_96%,black_4%))] px-3 pb-2.5 pt-0 shadow-[0_30px_80px_rgba(0,0,0,0.58),0_10px_24px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.10),inset_0_0_0_1px_rgba(255,255,255,0.04)] ring-1 ring-black/45 backdrop-blur-xl"
    :style="panelRootStyle"
  >
    <div class="-mx-3 mb-2.5 flex items-center justify-between gap-3 rounded-t-xl border-b border-white/10 bg-white/[0.055] px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.22)]">
      <div
        class="flex min-w-0 flex-1 cursor-move select-none items-center gap-2"
        data-testid="mpr-segmentation-panel-drag-handle"
        @pointerdown="beginPanelDrag"
      >
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/18 text-[var(--theme-text-muted)] shadow-inner">
          <span class="grid grid-cols-2 gap-0.5">
            <span class="h-1 w-1 rounded-full bg-current"></span>
            <span class="h-1 w-1 rounded-full bg-current"></span>
            <span class="h-1 w-1 rounded-full bg-current"></span>
            <span class="h-1 w-1 rounded-full bg-current"></span>
          </span>
        </span>
        <div class="min-w-0">
          <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">Segmentation</div>
          <div class="mt-0.5 flex min-w-0 items-center gap-2">
            <span class="truncate text-[12px] font-medium text-[var(--theme-text-primary)]">Threshold regions and spherical VOI</span>
            <span
              data-testid="mpr-segmentation-processing"
              class="inline-flex w-[4.75rem] shrink-0 items-center gap-1 rounded-full border border-sky-300/30 bg-sky-400/12 px-2 py-0.5 text-[10px] font-semibold text-sky-100 transition-opacity"
              :class="props.isProcessing ? 'opacity-100' : 'pointer-events-none opacity-0'"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200"></span>
              <span>Updating</span>
            </span>
          </div>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          class="inline-flex h-8 items-center gap-2 px-0 text-[11px] font-semibold transition"
          :class="displayedConfig.enabled ? 'text-[var(--theme-text-primary)]' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
          type="button"
          :aria-pressed="displayedConfig.enabled"
          @click="emitPatch({ enabled: !displayedConfig.enabled }, 'end')"
        >
          <span
            class="relative h-4 w-7 rounded-full border transition"
            :class="displayedConfig.enabled ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]' : 'border-[var(--theme-border-strong)] bg-[var(--theme-surface-card)]'"
          >
            <span
              class="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--theme-text-primary)] shadow-sm transition"
              :class="displayedConfig.enabled ? 'left-[13px]' : 'left-0.5 opacity-70'"
            ></span>
          </span>
          <span>Preview</span>
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          title="Close"
          @click="emit('close')"
        >
          <AppIcon name="close" :size="15" />
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <div
        v-if="regions.length === 0"
        class="rounded-lg border border-dashed border-[var(--theme-border-soft)] px-3 py-3 text-[12px] text-[var(--theme-text-secondary)]"
      >
        Draw one or more rectangles in threshold mode. Each region uses HU &gt; threshold.
      </div>

      <div
        v-for="region in regions"
        :key="region.id"
        class="rounded-lg border px-3 py-2 transition"
        :class="region.id === displayedConfig.selectedRegionId ? 'border-sky-300/45 bg-sky-500/18' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)]'"
        @click="selectRegion(region.id)"
      >
        <div class="flex min-w-0 items-center gap-2">
          <button
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition"
            :class="region.enabled ? 'border-sky-300/45 bg-sky-400/20 text-sky-100' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-muted)]'"
            type="button"
            :aria-pressed="region.enabled"
            :title="region.enabled ? 'Hide region' : 'Show region'"
            @click.stop="toggleRegion(region)"
          >
            <AppIcon :name="region.enabled ? 'display' : 'display-off'" :size="15" />
          </button>
          <button
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition"
            :class="region.id === displayedConfig.selectedRegionId ? 'border-sky-200/60 bg-sky-300/25 text-sky-50' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-muted)] hover:border-sky-300/35 hover:text-sky-100'"
            type="button"
            :aria-pressed="region.id === displayedConfig.selectedRegionId"
            title="Select region"
            :data-testid="`mpr-threshold-select-${region.id}`"
            @click.stop="selectRegion(region.id)"
          >
            <AppIcon
              v-if="region.id === displayedConfig.selectedRegionId"
              name="check"
              :size="13"
            />
            <span
              v-else
              class="h-2 w-2 rounded-full border border-current"
            ></span>
          </button>
          <span class="text-[13px] font-semibold text-[var(--theme-text-primary)]">{{ region.label }}</span>
          <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: region.color }"></span>
          <span class="min-w-0 flex-1 text-[12px] text-[var(--theme-text-secondary)]">
            {{ region.thresholdMode === 'percentile' ? `${region.thresholdPercentile.toFixed(1)}% / HU~${formatEffectiveThreshold(region)}` : `HU>${region.thresholdHu}` }}
          </span>
          <div
            v-if="selectedRegion?.id === region.id"
            class="inline-flex shrink-0 rounded-md border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-0.5"
          >
            <button
              class="h-6 rounded px-2 text-[11px] font-semibold transition"
              :class="region.thresholdMode === 'hu' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
              type="button"
              @click.stop="updateThresholdMode(region, 'hu')"
            >
              HU
            </button>
            <button
              class="h-6 rounded px-2 text-[11px] font-semibold transition"
              :class="region.thresholdMode === 'percentile' ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
              type="button"
              @click.stop="updateThresholdMode(region, 'percentile')"
            >
              %
            </button>
          </div>
          <button
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--theme-text-secondary)] transition hover:bg-rose-500/12 hover:text-rose-100"
            type="button"
            title="Delete region"
            @click.stop="deleteRegion(region.id)"
          >
            <AppIcon name="trash" :size="15" />
          </button>
        </div>

        <div class="mt-1.5 max-h-8 overflow-hidden text-[11px] leading-4 text-[var(--theme-text-secondary)]">
          {{ formatStatsSummary(region) }}
        </div>

        <div
          v-if="selectedRegion?.id === region.id"
          class="mt-2 space-y-2"
        >
          <div
            v-if="region.thresholdMode === 'percentile'"
            class="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-2"
          >
            <span class="text-[12px] font-semibold text-[var(--theme-text-secondary)]">Percent</span>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="0"
              max="100"
              step="0.5"
              :value="region.thresholdPercentile"
              @input.stop="updateThresholdPercentile(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateThresholdPercentile(region, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              class="rounded-md border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
              type="number"
              min="0"
              max="100"
              step="0.5"
              :value="region.thresholdPercentile"
              @input.stop="updateThresholdPercentile(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateThresholdPercentile(region, ($event.target as HTMLInputElement).value, 'end')"
            />
          </div>
          <div
            v-else
            class="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-2"
          >
            <span class="text-[12px] font-semibold text-[var(--theme-text-secondary)]">HU</span>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              :min="MPR_SEGMENTATION_HU_LIMITS.min"
              :max="MPR_SEGMENTATION_HU_LIMITS.max"
              step="1"
              :value="region.thresholdHu"
              @input.stop="updateThreshold(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateThreshold(region, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              class="rounded-md border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
              type="number"
              :min="MPR_SEGMENTATION_HU_LIMITS.min"
              :max="MPR_SEGMENTATION_HU_LIMITS.max"
              step="1"
              :value="region.thresholdHu"
              @input.stop="updateThreshold(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateThreshold(region, ($event.target as HTMLInputElement).value, 'end')"
            />
          </div>

          <div class="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-2">
            <span class="text-[12px] font-semibold text-[var(--theme-text-secondary)]">Depth</span>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              :min="MPR_SEGMENTATION_DEPTH_LIMITS.min"
              :max="MPR_SEGMENTATION_DEPTH_LIMITS.max"
              step="0.5"
              :value="region.box.depthMm"
              @input.stop="updateDepth(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateDepth(region, ($event.target as HTMLInputElement).value, 'end')"
            />
            <input
              class="rounded-md border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
              type="number"
              :min="MPR_SEGMENTATION_DEPTH_LIMITS.min"
              :max="MPR_SEGMENTATION_DEPTH_LIMITS.max"
              step="0.5"
              :value="region.box.depthMm"
              @input.stop="updateDepth(region, ($event.target as HTMLInputElement).value, 'move')"
              @change.stop="updateDepth(region, ($event.target as HTMLInputElement).value, 'end')"
            />
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 truncate text-[12px] text-[var(--theme-text-secondary)]">
            <span class="font-semibold text-[var(--theme-text-primary)]">VOI sphere</span>
            <span class="mx-1 text-[var(--theme-text-muted)]">/</span>
            <template v-if="voiSpheres.length > 0">
              {{ voiSpheres.length }} item{{ voiSpheres.length === 1 ? '' : 's' }}
            </template>
            <template v-else>
              Draw a circle in VOI mode
            </template>
          </div>
        </div>

        <div
          v-for="sphere in voiSpheres"
          :key="sphere.id"
          class="mt-2 rounded-md border px-2.5 py-2 transition"
          :class="displayedConfig.selectedVoiId === sphere.id ? 'border-cyan-300/45 bg-cyan-500/16' : 'border-white/8 bg-black/10'"
          :data-testid="`mpr-voi-select-${sphere.id}`"
          @click="selectVoi(sphere.id)"
        >
          <div class="flex items-center gap-2">
            <button
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition"
              :class="sphere.enabled ? 'border-cyan-300/45 bg-cyan-400/20 text-cyan-100' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-muted)]'"
              type="button"
              :aria-pressed="sphere.enabled"
              :title="sphere.enabled ? 'Hide VOI' : 'Show VOI'"
              @click.stop="patchVoiSphere(sphere.id, { enabled: !sphere.enabled }, 'end')"
            >
              <AppIcon :name="sphere.enabled ? 'display' : 'display-off'" :size="14" />
            </button>
            <span class="text-[13px] font-semibold text-[var(--theme-text-primary)]">{{ sphere.label }}</span>
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-300"></span>
            <span class="min-w-0 flex-1 truncate text-[12px] text-[var(--theme-text-secondary)]">
              Radius {{ formatMetric(sphere.radiusMm) }} mm
            </span>
            <button
              class="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 text-[11px] font-semibold text-[var(--theme-text-secondary)] transition hover:border-rose-200/45 hover:bg-rose-500/12 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              @click.stop="clearVoi(sphere.id)"
            >
              <AppIcon name="trash" :size="14" />
              <span>Delete</span>
            </button>
          </div>
          <div class="mt-1.5 max-h-8 overflow-hidden text-[11px] leading-4 text-[var(--theme-text-secondary)]">
            {{ formatVoiStatsSummary(sphere) }}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button
          class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2.5 text-[11px] font-semibold text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)] disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          :disabled="regions.length === 0"
          @click="clearThresholdRegions"
        >
          <AppIcon name="segmentation-threshold" :size="14" />
          <span>Clear regions</span>
        </button>
        <button
          class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-100 transition hover:border-rose-200/45 hover:bg-rose-500/15"
          type="button"
          @click="clearAll"
        >
          <AppIcon name="trash" :size="14" />
          <span>Clear all</span>
        </button>
      </div>
    </div>
  </div>
</template>
