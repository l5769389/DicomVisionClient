<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

import { computed, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { createDefaultMprMipConfig, normalizeMprMipConfig, type MprMipAlgorithm, type MprMipConfig, type MprViewportKey } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

const props = defineProps<{
  config: MprMipConfig
}>()

const emit = defineEmits<{
  configChange: [config: MprMipConfig, actionType?: 'move' | 'end']
}>()

const isCollapsed = ref(false)
const { locale, mprProjectionCopy } = useUiLocale()
const copy = computed(() => mprProjectionCopy.value)
const isZh = computed(() => locale.value === 'zh-CN')
const draftConfig = ref<MprMipConfig | null>(null)
const activeDraftViewport = ref<MprViewportKey | null>(null)
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
const displayedConfig = computed(() => draftConfig.value ?? normalizedConfig.value)

watch(
  () => props.config,
  () => {
    if (activeDraftViewport.value == null) {
      draftConfig.value = null
    }
  },
  { deep: true }
)

function cloneConfig(config: MprMipConfig): MprMipConfig {
  return normalizeMprMipConfig(config)
}

function emitConfigPatch(patch: Partial<MprMipConfig>, actionType: 'move' | 'end' = 'end'): void {
  const nextConfig = cloneConfig({
    ...displayedConfig.value,
    ...patch
  })
  if (actionType === 'move') {
    draftConfig.value = nextConfig
  } else {
    draftConfig.value = null
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
  } else {
    activeDraftViewport.value = null
    draftConfig.value = null
  }
  emit('configChange', nextConfig, actionType)
}

function updateViewportThicknessInput(viewportKey: MprViewportKey, value: string, actionType: 'move' | 'end' = 'move'): void {
  updateViewportThickness(viewportKey, Number(value), actionType)
}

function beginViewportThicknessDrag(viewportKey: MprViewportKey): void {
  activeDraftViewport.value = viewportKey
  draftConfig.value = cloneConfig(displayedConfig.value)
}

function endViewportThicknessDrag(viewportKey: MprViewportKey, value: string | number): void {
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
</script>

<template>
  <div
    v-bind="$attrs"
    class="theme-shell-panel max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-[22px] border-[color:color-mix(in_srgb,var(--theme-border-strong)_85%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-panel-strong-solid)_96%,black_4%),color-mix(in_srgb,var(--theme-surface-panel-solid)_94%,black_6%))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.03),0_24px_54px_rgba(0,0,0,0.42),0_8px_20px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-[width]"
    :class="isCollapsed ? 'w-[300px]' : 'w-[368px]'"
  >
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">{{ copy.title }}</div>
        <div class="mt-0.5 text-[13px] font-medium text-[var(--theme-text-primary)]">{{ copy.subtitle }}</div>
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
          <span v-if="!isCollapsed">MIP</span>
        </button>
        <button
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

    <div class="space-y-2">
      <div
        v-for="viewport in viewportOptions"
        :key="viewport.key"
        class="rounded-[16px] border px-3 transition"
        :class="[
          isCollapsed ? 'py-2' : 'py-2.5',
          displayedConfig.enabled ? 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] opacity-50 grayscale'
        ]"
      >
        <div v-if="isCollapsed" class="flex items-center gap-2">
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
  </div>
</template>
