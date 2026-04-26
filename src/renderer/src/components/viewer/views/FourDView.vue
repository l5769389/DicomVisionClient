<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import type { FourDPhaseItem, MprViewportKey, ViewerTabItem, ViewType } from '../../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
}>()

const emit = defineEmits<{
  openSeriesView: [seriesId: string, viewType: Extract<ViewType, 'Stack' | 'MPR' | '3D'>]
}>()

const phaseIndex = ref(props.activeTab.fourDPhaseIndex ?? 0)
const fps = ref(props.activeTab.fourDPlaybackFps ?? 2)
const isPlaying = ref(false)
let playbackTimer: ReturnType<typeof window.setInterval> | null = null

const viewportItems = [
  { key: 'mpr-ax' as const, label: 'AX', className: 'col-start-1 row-start-1' },
  { key: 'mpr-sag' as const, label: 'SAG', className: 'col-start-1 row-start-2' },
  { key: 'mpr-cor' as const, label: 'COR', className: 'col-start-2 row-span-2 row-start-1' }
]

const phaseItems = computed<FourDPhaseItem[]>(() => {
  if (props.activeTab.fourDPhaseItems?.length) {
    return props.activeTab.fourDPhaseItems
  }

  const phaseCount = Math.max(1, props.activeTab.fourDPhaseCount ?? 10)
  return Array.from({ length: phaseCount }, (_, index) => ({
    phaseIndex: index,
    label: `Phase ${String(index + 1).padStart(2, '0')}`,
    seriesId: null,
    imageSrc: '',
    status: 'pending'
  }))
})

const normalizedPhaseIndex = computed(() => {
  const maxIndex = Math.max(0, phaseItems.value.length - 1)
  return Math.min(Math.max(phaseIndex.value, 0), maxIndex)
})

const activePhase = computed(() => phaseItems.value[normalizedPhaseIndex.value] ?? phaseItems.value[0])
const activePhaseNumber = computed(() => normalizedPhaseIndex.value + 1)
const phaseCount = computed(() => Math.max(1, phaseItems.value.length))
const playbackProgress = computed(() => `${(activePhaseNumber.value / phaseCount.value) * 100}%`)
const activePhaseSeriesId = computed(() => activePhase.value?.seriesId || props.activeTab.seriesId)

function stopPlayback(): void {
  if (playbackTimer) {
    window.clearInterval(playbackTimer)
    playbackTimer = null
  }
  isPlaying.value = false
}

function startPlayback(): void {
  stopPlayback()
  isPlaying.value = true
  playbackTimer = window.setInterval(() => {
    phaseIndex.value = (normalizedPhaseIndex.value + 1) % phaseCount.value
  }, Math.max(120, 1000 / fps.value))
}

function togglePlayback(): void {
  if (isPlaying.value) {
    stopPlayback()
    return
  }
  startPlayback()
}

function selectPhase(index: number): void {
  phaseIndex.value = index
}

function getViewportImage(viewportKey: MprViewportKey): string {
  const phase = activePhase.value
  if (!phase) {
    return ''
  }
  return phase.viewportImages?.[viewportKey] ?? (viewportKey === 'mpr-ax' ? phase.imageSrc ?? '' : '')
}

function openPhaseView(viewType: Extract<ViewType, 'Stack' | 'MPR' | '3D'>): void {
  const seriesId = activePhaseSeriesId.value
  if (!seriesId) {
    return
  }
  emit('openSeriesView', seriesId, viewType)
}

watch(
  () => props.activeTab.key,
  () => {
    phaseIndex.value = props.activeTab.fourDPhaseIndex ?? 0
    fps.value = props.activeTab.fourDPlaybackFps ?? 2
    stopPlayback()
  }
)

watch(
  fps,
  () => {
    if (isPlaying.value) {
      startPlayback()
    }
  }
)

watch(
  phaseItems,
  () => {
    phaseIndex.value = normalizedPhaseIndex.value
  }
)

onBeforeUnmount(stopPlayback)
</script>

<template>
  <div class="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 text-[var(--theme-text-primary)]">
    <div class="flex min-h-[56px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_72%,transparent)] px-3 py-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="grid h-8 w-8 place-items-center rounded-xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,transparent)] text-[var(--theme-text-primary)]">
            <AppIcon name="four-d" :size="18" />
          </span>
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold">4D Respiratory Series</div>
            <div class="truncate text-[11px] text-[var(--theme-text-muted)]">{{ activeTab.seriesTitle }}</div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <div class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--theme-text-secondary)]">
          Phase {{ String(activePhaseNumber).padStart(2, '0') }} / {{ phaseCount }}
        </div>
        <label class="flex items-center gap-2 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2.5 py-1 text-xs text-[var(--theme-text-secondary)]">
          <span>FPS</span>
          <select v-model.number="fps" class="four-d-select h-7 rounded-full px-2 text-xs font-semibold">
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="5">5</option>
            <option :value="10">10</option>
          </select>
        </label>
        <button class="four-d-icon-button" type="button" :aria-label="isPlaying ? 'Pause 4D playback' : 'Play 4D playback'" :title="isPlaying ? 'Pause' : 'Play'" @click="togglePlayback">
          <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="18" />
        </button>
        <button class="four-d-icon-button" type="button" aria-label="Stop 4D playback" title="Stop" @click="stopPlayback">
          <AppIcon name="stop" :size="18" />
        </button>
      </div>
    </div>

    <div class="grid min-h-0 grid-cols-[minmax(0,1fr)_240px] gap-2 max-xl:grid-cols-1 max-xl:grid-rows-[minmax(0,1fr)_auto]">
      <div class="grid min-h-0 grid-cols-2 grid-rows-2 gap-2">
        <ViewerCanvasStage
          v-for="item in viewportItems"
          :key="item.key"
          :viewport-key="item.key"
          :viewport-class="item.className"
          :is-active="item.key === 'mpr-ax'"
          :render-surface-active="item.key === 'mpr-ax'"
          :image-src="getViewportImage(item.key)"
          :alt="`${item.label} phase preview`"
          :placeholder="`${item.label} Phase ${String(activePhaseNumber).padStart(2, '0')}`"
          :corner-info="activeTab.cornerInfo"
          :orientation="activeTab.orientation"
        />
      </div>

      <aside class="flex min-h-0 flex-col gap-2 rounded-2xl border border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_66%,transparent)] p-3 max-xl:grid max-xl:grid-cols-[minmax(0,1fr)_auto] max-xl:items-start">
        <div class="min-w-0">
          <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">Phase Control</div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]">
            <div class="h-full rounded-full bg-[var(--theme-accent)] transition-[width] duration-150" :style="{ width: playbackProgress }"></div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button
              v-for="phase in phaseItems"
              :key="phase.phaseIndex"
              class="four-d-phase-button"
              :class="{ 'four-d-phase-button--active': phase.phaseIndex === normalizedPhaseIndex }"
              type="button"
              @click="selectPhase(phase.phaseIndex)"
            >
              <span>{{ String(phase.phaseIndex + 1).padStart(2, '0') }}</span>
              <span>{{ phase.status === 'ready' ? 'Ready' : 'Pending' }}</span>
            </button>
          </div>
        </div>

        <div class="mt-auto grid gap-2 max-xl:mt-0 max-xl:w-[180px]">
          <button class="four-d-action-button" type="button" @click="openPhaseView('Stack')">
            <AppIcon name="page" :size="17" />
            <span>Stack</span>
          </button>
          <button class="four-d-action-button" type="button" @click="openPhaseView('MPR')">
            <AppIcon name="crosshair" :size="17" />
            <span>MPR</span>
          </button>
          <button class="four-d-action-button" type="button" @click="openPhaseView('3D')">
            <AppIcon name="rotate3d" :size="17" />
            <span>3D</span>
          </button>
        </div>
      </aside>
    </div>

    <div class="h-2 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)]">
      <div class="h-full rounded-full bg-[linear-gradient(90deg,var(--theme-accent),var(--theme-accent-warm))] transition-[width] duration-150" :style="{ width: playbackProgress }"></div>
    </div>
  </div>
</template>

<style scoped>
.four-d-icon-button,
.four-d-action-button,
.four-d-phase-button {
  border: 1px solid var(--theme-border-soft);
  background: var(--theme-surface-card-soft);
  color: var(--theme-text-primary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.four-d-icon-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 14px;
}

.four-d-icon-button:hover,
.four-d-action-button:hover,
.four-d-phase-button:hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
}

.four-d-action-button {
  display: grid;
  min-height: 40px;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border-radius: 14px;
  padding: 0 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 700;
}

.four-d-phase-button {
  display: grid;
  min-height: 42px;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border-radius: 12px;
  padding: 0 8px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
}

.four-d-phase-button span:last-child {
  overflow: hidden;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.four-d-phase-button--active {
  border-color: var(--theme-active-border);
  background: var(--theme-active-surface-soft);
  box-shadow: var(--theme-active-shadow-soft);
}

.four-d-select {
  border: 1px solid var(--theme-border-soft);
  background: var(--theme-surface-card);
  color: var(--theme-text-primary);
}
</style>
