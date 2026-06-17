<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import {
  MPR_SEGMENTATION_DEPTH_LIMITS,
  MPR_SEGMENTATION_HU_LIMITS,
  createDefaultMprSegmentationConfig,
  normalizeMprSegmentationConfig,
  resolveMprLegacyVoiSphere,
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
  modeChange: [mode: 'segmentation:threshold' | 'segmentation:voi', viewportKey?: string | null]
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
const { locale } = useUiPreferences()
const displayedConfig = computed(() => draftConfig.value ?? normalizeMprSegmentationConfig(props.config))
const regions = computed(() => displayedConfig.value.thresholdRegions)
const voiSpheres = computed(() => displayedConfig.value.voiSpheres)
const selectedRegion = computed(() =>
  regions.value.find((region) => region.id === displayedConfig.value.selectedRegionId) ?? null
)
const isZh = computed(() => locale.value === 'zh-CN')
const panelCopy = computed(() => isZh.value
  ? {
      eyebrow: '分割',
      title: '阈值分割与球形 VOI',
      updating: '更新中',
      preview: '预览',
      close: '关闭',
      emptyThreshold: '在阈值分割模式中绘制一个或多个矩形区域。每个区域使用 HU > 阈值。',
      hideRegion: '隐藏分割',
      showRegion: '显示分割',
      deleteRegion: '删除分割',
      color: '颜色',
      description: '描述',
      percent: '百分比',
      depth: '深度',
      voiTitle: 'VOI 球体',
      voiEmpty: '在 VOI 模式中绘制圆形区域',
      item: '项',
      radius: '半径',
      hideVoi: '隐藏 VOI',
      showVoi: '显示 VOI',
      deleteVoi: '删除 VOI',
      clearRegions: '清除分割',
      clearAll: '全部清除'
    }
  : {
      eyebrow: 'Segmentation',
      title: 'Threshold regions and spherical VOI',
      updating: 'Updating',
      preview: 'Preview',
      close: 'Close',
      emptyThreshold: 'Draw one or more rectangles in threshold mode. Each region uses HU > threshold.',
      hideRegion: 'Hide region',
      showRegion: 'Show region',
      deleteRegion: 'Delete region',
      color: 'Color',
      description: 'Description',
      percent: 'Percent',
      depth: 'Depth',
      voiTitle: 'VOI sphere',
      voiEmpty: 'Draw a circle in VOI mode',
      item: 'item',
      radius: 'Radius',
      hideVoi: 'Hide VOI',
      showVoi: 'Show VOI',
      deleteVoi: 'Delete VOI',
      clearRegions: 'Clear regions',
      clearAll: 'Clear all'
    }
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

  if (actionType === 'select' || actionType === 'style') {
    localDraftActive.value = false
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

function hasStatsPatch(patch: Partial<MprThresholdRegion> | Partial<MprVoiSphere>): boolean {
  return Object.prototype.hasOwnProperty.call(patch, 'stats')
}

function patchRegion(regionId: string, patch: Partial<MprThresholdRegion>, actionType: PanelActionType = 'end'): void {
  emitPatch(
    {
      thresholdRegions: regions.value.map((region) =>
        region.id === regionId
          ? {
              ...region,
              ...patch,
              box: patch.box ?? region.box,
              stats: hasStatsPatch(patch) ? patch.stats ?? null : region.stats
            }
          : region
      )
    },
    actionType
  )
}

function selectRegion(regionId: string): void {
  const region = regions.value.find((candidate) => candidate.id === regionId)
  emit('modeChange', 'segmentation:threshold', region?.box.sourceViewport ?? null)
  emitPatch({ selectedRegionId: regionId, selectedVoi: false, selectedVoiId: null }, 'select')
}

function toggleRegion(region: MprThresholdRegion): void {
  patchRegion(region.id, { enabled: !region.enabled }, 'end')
}

function deleteRegion(regionId: string): void {
  const nextRegions = regions.value.filter((region) => region.id !== regionId)
  const isDeletingSelectedRegion = displayedConfig.value.selectedRegionId === regionId
  emitPatch(
    {
      selectedRegionId: isDeletingSelectedRegion ? nextRegions[0]?.id ?? null : displayedConfig.value.selectedRegionId,
      selectedVoi: isDeletingSelectedRegion ? false : displayedConfig.value.selectedVoi,
      selectedVoiId: isDeletingSelectedRegion ? null : displayedConfig.value.selectedVoiId,
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

function updateRegionColor(region: MprThresholdRegion, value: string): void {
  patchRegion(region.id, { color: value }, 'style')
}

function updateRegionLabel(region: MprThresholdRegion, value: string): void {
  patchRegion(region.id, { label: value }, 'style')
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
  const isDeletingSelectedVoi = displayedConfig.value.selectedVoiId === sphereId
  const nextSelectedVoi = resolveMprLegacyVoiSphere(
    nextSpheres,
    isDeletingSelectedVoi ? nextSpheres[0]?.id ?? null : displayedConfig.value.selectedVoiId
  )
  emitPatch({
    selectedRegionId: isDeletingSelectedVoi ? null : displayedConfig.value.selectedRegionId,
    selectedVoi: nextSelectedVoi !== null,
    selectedVoiId: nextSelectedVoi?.id ?? null,
    voiSpheres: nextSpheres,
    voiSphere: nextSelectedVoi
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
    stats: hasStatsPatch(patch) ? patch.stats ?? null : sphere.stats
  }
  const nextSpheres = voiSpheres.value.map((candidate) => (candidate.id === sphereId ? nextSphere : candidate))
  const legacyVoiSphere = resolveMprLegacyVoiSphere(nextSpheres, displayedConfig.value.selectedVoiId)
  emitPatch(
    {
      voiSpheres: nextSpheres,
      voiSphere: legacyVoiSphere
    },
    actionType
  )
}

function selectVoi(sphereId: string): void {
  if (!voiSpheres.value.some((sphere) => sphere.id === sphereId)) {
    return
  }
  emit('modeChange', 'segmentation:voi')
  emitPatch({ selectedRegionId: null, selectedVoi: true, selectedVoiId: sphereId }, 'select')
}

function updateVoiColor(sphere: MprVoiSphere, value: string): void {
  patchVoiSphere(sphere.id, { color: value }, 'style')
}

function updateVoiLabel(sphere: MprVoiSphere, value: string): void {
  patchVoiSphere(sphere.id, { label: value }, 'style')
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
          <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ panelCopy.eyebrow }}</div>
          <div class="mt-0.5 flex min-w-0 items-center gap-2">
            <span class="truncate text-[12px] font-medium text-[var(--theme-text-primary)]">{{ panelCopy.title }}</span>
            <span
              data-testid="mpr-segmentation-processing"
              class="inline-flex w-[4.75rem] shrink-0 items-center gap-1 rounded-full border border-sky-300/30 bg-sky-400/12 px-2 py-0.5 text-[10px] font-semibold text-sky-100 transition-opacity"
              :class="props.isProcessing ? 'opacity-100' : 'pointer-events-none opacity-0'"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200"></span>
              <span>{{ panelCopy.updating }}</span>
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
          <span>{{ panelCopy.preview }}</span>
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          :title="panelCopy.close"
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
        {{ panelCopy.emptyThreshold }}
      </div>

      <div
        v-for="region in regions"
        :key="region.id"
        class="rounded-md border px-2.5 py-2 transition"
        :class="region.id === displayedConfig.selectedRegionId ? 'border-cyan-300/45 bg-cyan-500/16' : 'border-white/8 bg-black/10'"
        :data-testid="`mpr-threshold-select-${region.id}`"
        @click="selectRegion(region.id)"
      >
        <div class="flex min-w-0 items-center gap-2">
          <button
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition"
            :class="region.enabled ? 'border-cyan-300/45 bg-cyan-400/20 text-cyan-100' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-muted)]'"
            type="button"
            :aria-pressed="region.enabled"
            :title="region.enabled ? panelCopy.hideRegion : panelCopy.showRegion"
            @click.stop="toggleRegion(region)"
          >
            <AppIcon :name="region.enabled ? 'display' : 'display-off'" :size="15" />
          </button>
          <label
            class="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/20"
            :title="panelCopy.color"
            @click.stop
          >
            <span class="h-3.5 w-3.5 rounded-full border border-white/35" :style="{ backgroundColor: region.color }"></span>
            <input
              class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="color"
              :aria-label="panelCopy.color"
              :value="region.color"
              :data-testid="`mpr-threshold-color-${region.id}`"
              @input.stop="updateRegionColor(region, ($event.target as HTMLInputElement).value)"
              @change.stop="updateRegionColor(region, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <input
            class="h-7 min-w-0 flex-[0_1_7.5rem] rounded-md border border-white/10 bg-black/16 px-2 text-[12px] font-semibold text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-cyan-200/55"
            type="text"
            :aria-label="panelCopy.description"
            :placeholder="panelCopy.description"
            :value="region.label"
            :data-testid="`mpr-threshold-label-${region.id}`"
            @click.stop
            @input.stop="updateRegionLabel(region, ($event.target as HTMLInputElement).value)"
          />
          <span class="min-w-0 flex-1 truncate text-[12px] text-[var(--theme-text-secondary)]">
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
            :title="panelCopy.deleteRegion"
            :data-testid="`mpr-threshold-delete-${region.id}`"
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
            <span class="text-[12px] font-semibold text-[var(--theme-text-secondary)]">{{ panelCopy.percent }}</span>
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

          <div class="grid grid-cols-[4rem_1fr_4.5rem_1.75rem] items-center gap-2">
            <span class="text-[12px] font-semibold text-[var(--theme-text-secondary)]">{{ panelCopy.depth }}</span>
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
            <span class="text-[11px] font-semibold text-[var(--theme-text-muted)]">mm</span>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 truncate text-[12px] text-[var(--theme-text-secondary)]">
            <span class="font-semibold text-[var(--theme-text-primary)]">{{ panelCopy.voiTitle }}</span>
            <span class="mx-1 text-[var(--theme-text-muted)]">/</span>
            <template v-if="voiSpheres.length > 0">
              {{ voiSpheres.length }} {{ panelCopy.item }}{{ !isZh && voiSpheres.length === 1 ? '' : !isZh ? 's' : '' }}
            </template>
            <template v-else>
              {{ panelCopy.voiEmpty }}
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
              :title="sphere.enabled ? panelCopy.hideVoi : panelCopy.showVoi"
              @click.stop="patchVoiSphere(sphere.id, { enabled: !sphere.enabled }, 'end')"
            >
              <AppIcon :name="sphere.enabled ? 'display' : 'display-off'" :size="14" />
            </button>
            <label
              class="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/20"
              :title="panelCopy.color"
              @click.stop
            >
              <span class="h-3.5 w-3.5 rounded-full border border-white/35" :style="{ backgroundColor: sphere.color }"></span>
              <input
                class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                type="color"
                :aria-label="panelCopy.color"
                :value="sphere.color"
                :data-testid="`mpr-voi-color-${sphere.id}`"
                @input.stop="updateVoiColor(sphere, ($event.target as HTMLInputElement).value)"
                @change.stop="updateVoiColor(sphere, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <input
              class="h-7 min-w-0 flex-[0_1_7.5rem] rounded-md border border-white/10 bg-black/16 px-2 text-[12px] font-semibold text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-cyan-200/55"
              type="text"
              :aria-label="panelCopy.description"
              :placeholder="panelCopy.description"
              :value="sphere.label"
              :data-testid="`mpr-voi-label-${sphere.id}`"
              @click.stop
              @input.stop="updateVoiLabel(sphere, ($event.target as HTMLInputElement).value)"
            />
            <span class="min-w-0 flex-1 truncate text-[12px] text-[var(--theme-text-secondary)]">
              {{ panelCopy.radius }} {{ formatMetric(sphere.radiusMm) }} mm
            </span>
            <button
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--theme-text-secondary)] transition hover:bg-rose-500/12 hover:text-rose-100"
              type="button"
              :title="panelCopy.deleteVoi"
              :data-testid="`mpr-voi-delete-${sphere.id}`"
              @click.stop="clearVoi(sphere.id)"
            >
              <AppIcon name="trash" :size="14" />
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
          <span>{{ panelCopy.clearRegions }}</span>
        </button>
        <button
          class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-100 transition hover:border-rose-200/45 hover:bg-rose-500/15"
          type="button"
          @click="clearAll"
        >
          <AppIcon name="trash" :size="14" />
          <span>{{ panelCopy.clearAll }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
