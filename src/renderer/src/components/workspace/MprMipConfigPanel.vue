<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

import { ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import type { MprMipAlgorithm, MprMipConfig, MprViewportKey } from '../../types/viewer'

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

const viewportOptions: Array<{ key: MprViewportKey; label: string; description: string }> = [
  { key: 'mpr-ax', label: 'AX', description: 'Axial slab thickness' },
  { key: 'mpr-cor', label: 'COR', description: 'Coronal slab thickness' },
  { key: 'mpr-sag', label: 'SAG', description: 'Sagittal slab thickness' }
]

function updateConfig(patch: Partial<MprMipConfig>): void {
  emit('configChange', {
    ...props.config,
    ...patch
  })
}

function updateViewportThickness(viewportKey: MprViewportKey, thickness: number): void {
  emit('configChange', {
    ...props.config,
    viewports: {
      ...props.config.viewports,
      [viewportKey]: {
        thickness
      }
    }
  })
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
        <div class="rounded-full border border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:color-mix(in_srgb,var(--theme-text-primary)_72%,var(--theme-accent))]">
          UI only
        </div>
      </div>
    </div>

    <div
      v-if="!isCollapsed"
      class="mb-3 rounded-[16px] border border-[var(--theme-border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_14%,transparent),var(--theme-surface-card-soft))] px-3 py-2.5"
    >
      <label class="flex items-center justify-between gap-3 text-[12px] font-medium text-[var(--theme-text-primary)]">
        <span>Enable MIP</span>
        <input
          class="h-4 w-4 rounded border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] accent-[var(--theme-accent)]"
          type="checkbox"
          :checked="props.config.enabled"
          @change="updateConfig({ enabled: ($event.target as HTMLInputElement).checked })"
        />
      </label>
      <p class="mt-2 text-[11px] leading-5 text-[var(--theme-text-secondary)]">
        Configure slab projection parameters now. Rendering can be wired to backend later.
      </p>
    </div>

    <div
      v-if="!isCollapsed"
      class="mb-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2.5"
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
        class="rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3"
        :class="isCollapsed ? 'py-2' : 'py-2.5'"
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
            :value="props.config.viewports[viewport.key].thickness"
            @input="updateViewportThickness(viewport.key, Number(($event.target as HTMLInputElement).value))"
          />
          <div class="w-[52px] text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-secondary)]">
            {{ props.config.viewports[viewport.key].thickness }} mm
          </div>
        </div>

        <template v-else>
          <div class="mb-2 flex items-center justify-between gap-3">
            <div>
              <div class="text-[12px] font-medium text-[var(--theme-text-primary)]">{{ viewport.label }}</div>
              <div class="text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">{{ viewport.description }}</div>
            </div>
            <div class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-secondary)]">
              {{ props.config.viewports[viewport.key].thickness }} mm
            </div>
          </div>

          <input
            class="w-full accent-[var(--theme-accent)]"
            type="range"
            min="1"
            max="80"
            step="1"
            :value="props.config.viewports[viewport.key].thickness"
            @input="updateViewportThickness(viewport.key, Number(($event.target as HTMLInputElement).value))"
          />
        </template>

        <div v-if="!isCollapsed" class="mt-2 flex items-center justify-between gap-3">
          <span class="text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">Thickness</span>
          <input
            class="w-20 rounded-[10px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
            type="number"
            min="1"
            max="80"
            step="1"
            :value="props.config.viewports[viewport.key].thickness"
            @input="updateViewportThickness(viewport.key, Math.max(1, Math.min(80, Number(($event.target as HTMLInputElement).value) || 1)))"
          />
        </div>
      </div>
    </div>
  </div>
</template>
