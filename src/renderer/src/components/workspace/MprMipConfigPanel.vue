<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

import { computed, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import { normalizeMprMipConfig, type MprMipAlgorithm, type MprMipConfig, type MprViewportKey } from '../../types/viewer'

const props = defineProps<{
  config: MprMipConfig
}>()

const emit = defineEmits<{
  configChange: [config: MprMipConfig]
}>()

const isCollapsed = ref(false)

const algorithmOptions: Array<{ value: MprMipAlgorithm; label: string; description: string }> = [
  { value: 'maximum', label: 'MaxIP', description: 'Highlight high-density structures.' },
  { value: 'minimum', label: 'MinIP', description: 'Highlight low-density structures.' },
  { value: 'average', label: 'Average', description: 'Blend the slab into a softer preview.' },
  { value: 'sum', label: 'Sum', description: 'Accumulate voxel intensity through the slab.' }
]

const viewportOptions: Array<{ key: MprViewportKey; label: string }> = [
  { key: 'mpr-ax', label: 'AX' },
  { key: 'mpr-cor', label: 'COR' },
  { key: 'mpr-sag', label: 'SAG' }
]

const normalizedConfig = computed(() => normalizeMprMipConfig(props.config))

function updateConfig(patch: Partial<MprMipConfig>): void {
  emit('configChange', {
    ...props.config,
    ...patch
  })
}

function setMipEnabled(enabled: boolean): void {
  updateConfig({ enabled })
}

function updateViewportThickness(viewportKey: MprViewportKey, thickness: number): void {
  const normalizedThickness = Math.max(1, Math.min(80, Math.round(Number.isFinite(thickness) ? thickness : 1)))
  emit('configChange', {
    ...props.config,
    viewports: {
      ...props.config.viewports,
      [viewportKey]: {
        thickness: normalizedThickness
      }
    }
  })
}

function updateViewportThicknessInput(viewportKey: MprViewportKey, value: string): void {
  updateViewportThickness(viewportKey, Number(value))
}
</script>

<template>
  <div
    v-bind="$attrs"
    class="theme-shell-panel max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-[22px] border-[color:color-mix(in_srgb,var(--theme-border-strong)_85%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-panel-strong)_96%,black_4%),color-mix(in_srgb,var(--theme-surface-panel)_94%,black_6%))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.03),0_24px_54px_rgba(0,0,0,0.42),0_8px_20px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-[width]"
    :class="isCollapsed ? 'w-[300px]' : 'w-[368px]'"
  >
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">MPR Projection</div>
        <div class="mt-0.5 text-[13px] font-medium text-[var(--theme-text-primary)]">MIP slab preview</div>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          :title="isCollapsed ? 'Expand MIP panel' : 'Collapse MIP panel'"
          @click="isCollapsed = !isCollapsed"
        >
          <AppIcon :name="isCollapsed ? 'chevron-left' : 'chevron-right'" :size="16" />
        </button>
      </div>
    </div>

    <div
      v-if="!isCollapsed"
      class="mb-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] p-1"
    >
      <div class="grid grid-cols-2 gap-1">
        <button
          type="button"
          class="rounded-[13px] border px-3 py-2.5 text-left transition"
          :class="
            !props.config.enabled
              ? 'border-[color:color-mix(in_srgb,var(--theme-accent-warm)_48%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-accent-warm)_12%,var(--theme-surface-card))] text-[var(--theme-text-primary)] shadow-[0_8px_18px_rgba(0,0,0,0.16)]'
              : 'border-transparent text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface-card-soft)] hover:text-[var(--theme-text-primary)]'
          "
          @click="setMipEnabled(false)"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="text-[12px] font-semibold">Disabled</span>
            <span
              class="h-2.5 w-2.5 rounded-full border"
              :class="!props.config.enabled ? 'border-[var(--theme-accent-warm)] bg-[var(--theme-accent-warm)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent-warm)_18%,transparent)]' : 'border-[var(--theme-border-strong)]'"
            ></span>
          </span>
          <span class="mt-1 block text-[10px] leading-4 text-[var(--theme-text-muted)]">Native MPR</span>
        </button>
        <button
          type="button"
          class="rounded-[13px] border px-3 py-2.5 text-left transition"
          :class="
            props.config.enabled
              ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_58%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-accent)_14%,var(--theme-surface-card))] text-[var(--theme-text-primary)] shadow-[0_8px_18px_rgba(0,0,0,0.16)]'
              : 'border-transparent text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface-card-soft)] hover:text-[var(--theme-text-primary)]'
          "
          @click="setMipEnabled(true)"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="text-[12px] font-semibold">Enabled</span>
            <span
              class="h-2.5 w-2.5 rounded-full border"
              :class="props.config.enabled ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]' : 'border-[var(--theme-border-strong)]'"
            ></span>
          </span>
          <span class="mt-1 block text-[10px] leading-4 text-[var(--theme-text-muted)]">Slab projection</span>
        </button>
      </div>
    </div>

    <div
      v-if="!isCollapsed"
      class="mb-3 rounded-[16px] border px-3 py-2.5 transition"
      :class="props.config.enabled ? 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] opacity-50 grayscale'"
    >
      <div class="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">Algorithm</div>
      <div class="grid grid-cols-1 gap-1.5">
        <label
          v-for="option in algorithmOptions"
          :key="option.value"
          class="flex cursor-pointer items-start gap-3 rounded-[12px] border px-3 py-2 transition"
          :class="
            props.config.algorithm === option.value
              ? 'border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_14%,transparent)]'
              : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:bg-[var(--theme-surface-card-soft)]'
          "
        >
          <input
            class="mt-0.5 h-4 w-4 accent-[var(--theme-accent)]"
            type="radio"
            name="mpr-mip-algorithm"
            :disabled="!props.config.enabled"
            :value="option.value"
            :checked="props.config.algorithm === option.value"
            @change="updateConfig({ algorithm: option.value })"
          />
          <span class="min-w-0">
            <span class="block text-[12px] font-medium text-[var(--theme-text-primary)]">{{ option.label }}</span>
            <span class="mt-0.5 block text-[11px] leading-5 text-[var(--theme-text-secondary)]">{{ option.description }}</span>
          </span>
        </label>
      </div>
    </div>

    <div class="space-y-2">
      <div
        v-for="viewport in viewportOptions"
        :key="viewport.key"
        class="rounded-[16px] border px-3 transition"
        :class="[
          isCollapsed ? 'py-2' : 'py-2.5',
          props.config.enabled ? 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] opacity-50 grayscale'
        ]"
      >
        <div v-if="isCollapsed" class="flex items-center gap-2">
          <div class="w-8 shrink-0 text-[12px] font-medium text-[var(--theme-text-primary)]">
            {{ viewport.label }}
          </div>
          <input
            class="min-w-0 flex-1 accent-[var(--theme-accent)]"
            type="range"
            min="1"
            max="80"
            step="1"
            :disabled="!props.config.enabled"
            :value="normalizedConfig.viewports[viewport.key].thickness"
            @input="updateViewportThickness(viewport.key, Number(($event.target as HTMLInputElement).value))"
          />
          <label class="flex w-[72px] items-center justify-end gap-1 text-[10px] font-semibold uppercase text-[var(--theme-text-secondary)]">
            <input
              class="w-12 rounded-[10px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-1.5 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
              type="number"
              min="1"
              max="80"
              step="1"
              :disabled="!props.config.enabled"
              :value="normalizedConfig.viewports[viewport.key].thickness"
              @input="updateViewportThicknessInput(viewport.key, ($event.target as HTMLInputElement).value)"
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
                min="1"
                max="80"
                step="1"
                :disabled="!props.config.enabled"
                :value="normalizedConfig.viewports[viewport.key].thickness"
                @input="updateViewportThicknessInput(viewport.key, ($event.target as HTMLInputElement).value)"
              />
              <span>mm</span>
            </label>
          </div>

          <input
            class="w-full accent-[var(--theme-accent)]"
            type="range"
            min="1"
            max="80"
            step="1"
            :disabled="!props.config.enabled"
            :value="normalizedConfig.viewports[viewport.key].thickness"
            @input="updateViewportThickness(viewport.key, Number(($event.target as HTMLInputElement).value))"
          />
        </template>
      </div>
    </div>
  </div>
</template>
