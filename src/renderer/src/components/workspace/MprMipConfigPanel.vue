<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import DockInfoPopover from './shell/DockInfoPopover.vue'
import { createDefaultMprMipConfig, normalizeMprMipConfig, type MprMipAlgorithm, type MprMipConfig, type MprViewportKey } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

const props = defineProps<{
  config: MprMipConfig
  embedded?: boolean
}>()

const emit = defineEmits<{
  configChange: [config: MprMipConfig, actionType?: 'move' | 'end']
}>()

const isCollapsed = ref(false)
const { locale, mprProjectionCopy } = useUiLocale()
const copy = computed(() => mprProjectionCopy.value)
const isZh = computed(() => locale.value === 'zh-CN')
const draftConfig = ref<MprMipConfig | null>(null)
const settlingConfig = ref<MprMipConfig | null>(null)
const activeDraftViewport = ref<MprViewportKey | null>(null)
let pendingMoveConfig: MprMipConfig | null = null
let pendingMoveTimer: ReturnType<typeof window.setTimeout> | null = null
const MIP_THICKNESS_MOVE_DEBOUNCE_MS = 50
const MIP_THICKNESS_MIN_MM = 0
const MIP_THICKNESS_MAX_MM = 100
const resetLabel = computed(() => (isZh.value ? '重置' : 'Reset'))

const algorithmOptions: ReadonlyArray<{ value: MprMipAlgorithm; label: string }> = [
  { value: 'maximum', label: 'MaxIP' },
  { value: 'minimum', label: 'MinIP' },
  { value: 'average', label: 'Average' },
  { value: 'sum', label: 'Sum' }
]

const viewportOptions: ReadonlyArray<{ key: MprViewportKey; label: string }> = [
  { key: 'mpr-ax', label: 'AX' },
  { key: 'mpr-cor', label: 'COR' },
  { key: 'mpr-sag', label: 'SAG' }
]

const normalizedConfig = computed(() => normalizeMprMipConfig(props.config))
const displayedConfig = computed(() => draftConfig.value ?? settlingConfig.value ?? normalizedConfig.value)

function hasSameViewportThicknesses(left: MprMipConfig, right: MprMipConfig): boolean {
  return viewportOptions.every((viewport) => {
    return left.viewports[viewport.key]?.thickness === right.viewports[viewport.key]?.thickness
  })
}

function hasSameNonViewportState(left: MprMipConfig, right: MprMipConfig): boolean {
  return left.enabled === right.enabled && left.algorithm === right.algorithm
}

watch(
  () => props.config,
  () => {
    if (activeDraftViewport.value != null) {
      return
    }

    const normalized = normalizedConfig.value
    const settling = settlingConfig.value
    if (!settling) {
      draftConfig.value = null
      return
    }

    if (!hasSameNonViewportState(normalized, settling) || hasSameViewportThicknesses(normalized, settling)) {
      settlingConfig.value = null
      draftConfig.value = null
    }
  },
  { deep: true }
)

function cloneConfig(config: MprMipConfig): MprMipConfig {
  return normalizeMprMipConfig(config)
}

function cancelPendingMoveConfig(): void {
  if (pendingMoveTimer !== null) {
    window.clearTimeout(pendingMoveTimer)
    pendingMoveTimer = null
  }
  pendingMoveConfig = null
}

function flushPendingMoveConfig(): void {
  if (pendingMoveTimer !== null) {
    window.clearTimeout(pendingMoveTimer)
    pendingMoveTimer = null
  }
  if (!pendingMoveConfig) {
    return
  }
  const config = pendingMoveConfig
  pendingMoveConfig = null
  emit('configChange', config, 'move')
}

function queueMoveConfig(config: MprMipConfig): void {
  pendingMoveConfig = config
  if (pendingMoveTimer !== null) {
    window.clearTimeout(pendingMoveTimer)
  }
  pendingMoveTimer = window.setTimeout(() => {
    pendingMoveTimer = null
    if (!pendingMoveConfig) {
      return
    }
    const nextConfig = pendingMoveConfig
    pendingMoveConfig = null
    emit('configChange', nextConfig, 'move')
  }, MIP_THICKNESS_MOVE_DEBOUNCE_MS)
}

function emitConfigPatch(patch: Partial<MprMipConfig>, actionType: 'move' | 'end' = 'end'): void {
  const nextConfig = cloneConfig({
    ...displayedConfig.value,
    ...patch
  })
  if (actionType === 'move') {
    draftConfig.value = nextConfig
    settlingConfig.value = null
  } else {
    cancelPendingMoveConfig()
    draftConfig.value = null
    settlingConfig.value = null
    activeDraftViewport.value = null
  }
  emit('configChange', nextConfig, actionType)
}

function setMipEnabled(enabled: boolean): void {
  emitConfigPatch({ enabled }, 'end')
}

function clampThicknessMm(thickness: number): number {
  return Math.max(
    MIP_THICKNESS_MIN_MM,
    Math.min(MIP_THICKNESS_MAX_MM, Math.round(Number.isFinite(thickness) ? thickness : MIP_THICKNESS_MIN_MM))
  )
}

function resolveNextViewportThicknessConfig(viewportKey: MprViewportKey, thickness: number): MprMipConfig {
  return cloneConfig({
    ...displayedConfig.value,
    viewports: {
      ...displayedConfig.value.viewports,
      [viewportKey]: {
        thickness: clampThicknessMm(thickness)
      }
    }
  })
}

function updateViewportThickness(viewportKey: MprViewportKey, thickness: number, actionType: 'move' | 'end' = 'move'): void {
  const nextConfig = resolveNextViewportThicknessConfig(viewportKey, thickness)
  if (actionType === 'move') {
    activeDraftViewport.value = viewportKey
    draftConfig.value = nextConfig
    settlingConfig.value = null
    queueMoveConfig(nextConfig)
  } else {
    cancelPendingMoveConfig()
    activeDraftViewport.value = null
    draftConfig.value = null
    settlingConfig.value = nextConfig
    emit('configChange', nextConfig, actionType)
  }
}

function updateViewportThicknessInput(viewportKey: MprViewportKey, value: string, actionType: 'move' | 'end' = 'move'): void {
  updateViewportThickness(viewportKey, Number(value), actionType)
}

function beginViewportThicknessDrag(viewportKey: MprViewportKey): void {
  cancelPendingMoveConfig()
  activeDraftViewport.value = viewportKey
  draftConfig.value = cloneConfig(displayedConfig.value)
  settlingConfig.value = null
}

function endViewportThicknessDrag(viewportKey: MprViewportKey, value: string | number): void {
  flushPendingMoveConfig()
  updateViewportThickness(viewportKey, Number(value), 'end')
}

function resetViewportThicknesses(): void {
  const defaults = createDefaultMprMipConfig()
  emitConfigPatch(
    {
      viewports: {
        'mpr-ax': { thickness: defaults.viewports['mpr-ax'].thickness },
        'mpr-cor': { thickness: defaults.viewports['mpr-cor'].thickness },
        'mpr-sag': { thickness: defaults.viewports['mpr-sag'].thickness }
      }
    },
    'end'
  )
}

onBeforeUnmount(() => {
  cancelPendingMoveConfig()
})
</script>

<template>
  <div
    v-bind="$attrs"
    class="theme-shell-panel max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-[22px] border-[color:color-mix(in_srgb,var(--theme-border-strong)_85%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-panel-strong-solid)_96%,black_4%),color-mix(in_srgb,var(--theme-surface-panel-solid)_94%,black_6%))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.03),0_24px_54px_rgba(0,0,0,0.42),0_8px_20px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-[width]"
    :class="props.embedded ? 'mpr-mip-config-panel--embedded flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 shadow-none' : isCollapsed ? 'w-[300px]' : 'w-[368px]'"
  >
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="flex items-center gap-1">
        <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">{{ copy.title }}</div>
        <DockInfoPopover
          v-if="!props.embedded"
          :text="isZh ? '设置 MPR 各平面的厚层投影算法和层厚。' : 'Configure the slab projection algorithm and thickness for each MPR plane.'"
          location="right center"
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          data-testid="mpr-mip-enable-toggle"
          class="inline-flex h-8 items-center gap-2 px-0 text-[11px] font-semibold transition"
          :class="
            displayedConfig.enabled
              ? 'text-[var(--theme-text-primary)]'
              : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'
          "
          type="button"
          :aria-pressed="displayedConfig.enabled"
          aria-label="MIP"
          @click="setMipEnabled(!displayedConfig.enabled)"
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
          <span v-if="!isCollapsed && !props.embedded">MIP</span>
        </button>
        <button
          v-if="!props.embedded"
          data-testid="mpr-mip-reset"
          class="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2.5 text-[11px] font-semibold text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          :title="resetLabel"
          @click="resetViewportThicknesses"
        >
          <AppIcon name="reset" :size="14" />
          <span v-if="!isCollapsed">{{ resetLabel }}</span>
        </button>
        <button
          v-if="!props.embedded"
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          :title="isCollapsed ? copy.expand : copy.collapse"
          @click="isCollapsed = !isCollapsed"
        >
          <AppIcon :name="isCollapsed ? 'chevron-left' : 'chevron-right'" :size="16" />
        </button>
      </div>
    </div>

    <div
      class="mb-3 grid grid-cols-4 gap-2 transition"
      :class="displayedConfig.enabled ? '' : 'opacity-50 grayscale'"
    >
      <label
        v-for="option in algorithmOptions"
        :key="option.value"
        class="flex min-w-0 cursor-pointer items-center justify-center rounded-[12px] border px-2 py-2 text-center transition"
        :class="
          displayedConfig.algorithm === option.value
            ? 'border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_16%,transparent)] text-[var(--theme-text-primary)]'
            : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface-card-soft)] hover:text-[var(--theme-text-primary)]'
        "
      >
        <input
          class="sr-only"
          type="radio"
          name="mpr-mip-algorithm"
          :disabled="!displayedConfig.enabled"
          :value="option.value"
          :checked="displayedConfig.algorithm === option.value"
          @change="emitConfigPatch({ algorithm: option.value }, 'end')"
        />
        <span class="truncate text-[11px] font-semibold">{{ option.label }}</span>
      </label>
    </div>

    <div
      class="space-y-2"
      :class="props.embedded ? 'min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]' : ''"
    >
      <div
        v-for="viewport in viewportOptions"
        :key="viewport.key"
        class="rounded-[16px] border px-3 transition"
        :class="[
          isCollapsed ? 'py-2' : 'py-2.5',
          displayedConfig.enabled ? 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] opacity-50 grayscale'
        ]"
      >
        <div v-if="isCollapsed && !props.embedded" class="flex items-center gap-2">
          <div class="w-8 shrink-0 text-[12px] font-medium text-[var(--theme-text-primary)]">
            {{ viewport.label }}
          </div>
          <span class="w-4 text-center text-[9px] font-semibold text-[var(--theme-text-muted)]">{{ MIP_THICKNESS_MIN_MM }}</span>
          <input
            class="min-w-0 flex-1 accent-[var(--theme-accent)]"
            type="range"
            :min="MIP_THICKNESS_MIN_MM"
            :max="MIP_THICKNESS_MAX_MM"
            step="1"
            :disabled="!displayedConfig.enabled"
            :value="displayedConfig.viewports[viewport.key].thickness"
            @pointerdown="beginViewportThicknessDrag(viewport.key)"
            @input="updateViewportThickness(viewport.key, Number(($event.target as HTMLInputElement).value), 'move')"
            @change="endViewportThicknessDrag(viewport.key, ($event.target as HTMLInputElement).value)"
          />
          <span class="w-5 text-center text-[9px] font-semibold text-[var(--theme-text-muted)]">{{ MIP_THICKNESS_MAX_MM }}</span>
          <label class="flex w-[72px] items-center justify-end gap-1 text-[10px] font-semibold uppercase text-[var(--theme-text-secondary)]">
            <input
              class="w-12 rounded-[10px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-1.5 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
              type="number"
              :min="MIP_THICKNESS_MIN_MM"
              :max="MIP_THICKNESS_MAX_MM"
              step="1"
              :disabled="!displayedConfig.enabled"
              :value="displayedConfig.viewports[viewport.key].thickness"
              @focus="beginViewportThicknessDrag(viewport.key)"
              @input="updateViewportThicknessInput(viewport.key, ($event.target as HTMLInputElement).value, 'move')"
              @change="endViewportThicknessDrag(viewport.key, ($event.target as HTMLInputElement).value)"
              @blur="endViewportThicknessDrag(viewport.key, ($event.target as HTMLInputElement).value)"
            />
            <span>mm</span>
          </label>
        </div>

        <template v-else>
          <div class="mb-2 flex items-center justify-between gap-3">
            <div>
              <div class="text-[12px] font-medium text-[var(--theme-text-primary)]">{{ viewport.label }}</div>
            </div>
            <label class="flex items-center gap-1 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase text-[var(--theme-text-secondary)]">
              <input
                class="w-12 bg-transparent text-right text-[12px] text-[var(--theme-text-primary)] outline-none"
                type="number"
                :min="MIP_THICKNESS_MIN_MM"
                :max="MIP_THICKNESS_MAX_MM"
                step="1"
                :disabled="!displayedConfig.enabled"
                :value="displayedConfig.viewports[viewport.key].thickness"
                @focus="beginViewportThicknessDrag(viewport.key)"
                @input="updateViewportThicknessInput(viewport.key, ($event.target as HTMLInputElement).value, 'move')"
                @change="endViewportThicknessDrag(viewport.key, ($event.target as HTMLInputElement).value)"
                @blur="endViewportThicknessDrag(viewport.key, ($event.target as HTMLInputElement).value)"
              />
              <span>mm</span>
            </label>
          </div>

          <input
            class="w-full accent-[var(--theme-accent)]"
            type="range"
            :min="MIP_THICKNESS_MIN_MM"
            :max="MIP_THICKNESS_MAX_MM"
            step="1"
            :disabled="!displayedConfig.enabled"
            :value="displayedConfig.viewports[viewport.key].thickness"
            @pointerdown="beginViewportThicknessDrag(viewport.key)"
            @input="updateViewportThickness(viewport.key, Number(($event.target as HTMLInputElement).value), 'move')"
            @change="endViewportThicknessDrag(viewport.key, ($event.target as HTMLInputElement).value)"
          />
          <div class="mt-1 flex items-center justify-between text-[9px] font-semibold text-[var(--theme-text-muted)]">
            <span>{{ MIP_THICKNESS_MIN_MM }}mm</span>
            <span>{{ MIP_THICKNESS_MAX_MM }}mm</span>
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="props.embedded"
      class="mt-auto border-t border-[var(--theme-border-soft)] pt-2"
    >
      <button
        data-testid="mpr-mip-reset"
        class="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-[color:color-mix(in_srgb,var(--theme-status-danger)_30%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-status-danger)_8%,var(--theme-surface-card))] px-3 py-2.5 text-left text-[var(--theme-text-primary)] transition hover:border-[color:color-mix(in_srgb,var(--theme-status-danger)_48%,var(--theme-border-strong))] hover:bg-[color:color-mix(in_srgb,var(--theme-status-danger)_13%,var(--theme-surface-card))]"
        type="button"
        :title="resetLabel"
        @click="resetViewportThicknesses"
      >
        <span class="grid h-9 w-9 place-items-center rounded-[12px] border border-[color:color-mix(in_srgb,var(--theme-status-danger)_32%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-status-danger)_10%,transparent)] text-[var(--theme-status-danger-text)]">
          <AppIcon name="reset" :size="16" />
        </span>
        <span class="min-w-0">
          <span class="flex items-center gap-1 truncate text-[13px] font-[850]">
            {{ resetLabel }}
            <DockInfoPopover :text="isZh ? '恢复 MIP 厚度默认值' : 'Restore default MIP thickness values.'" />
          </span>
        </span>
      </button>
    </div>
  </div>
</template>
