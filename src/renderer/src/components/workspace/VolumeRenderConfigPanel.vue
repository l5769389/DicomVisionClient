<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import type { VolumeInterpolationMode, VolumeLayerConfig, VolumeLightingConfig, VolumeRenderConfig } from '../../types/viewer'
import AppIcon from '../AppIcon.vue'

type PanelTabKey = 'tissue' | 'lighting'

const props = defineProps<{
  config: VolumeRenderConfig
}>()

const emit = defineEmits<{
  close: []
  configChange: [config: VolumeRenderConfig]
}>()

const activeTab = ref<PanelTabKey>('tissue')
const { locale, volumeCopy } = useUiLocale()
const closePanelLabel = computed(() => (locale.value === 'zh-CN' ? '关闭 3D 参数' : 'Close 3D parameters'))

const interpolationOptions = computed<Array<{ value: VolumeInterpolationMode; label: string }>>(() => [
  { value: 'nearest', label: volumeCopy.value.nearest },
  { value: 'linear', label: volumeCopy.value.linear },
  { value: 'cubic', label: volumeCopy.value.cubic }
])

const WINDOW_WIDTH_SLIDER_FACTOR = 2
const WINDOW_LEVEL_SLIDER_FACTOR = 2

function getLayerLabel(layer: VolumeLayerConfig): string {
  const copy = volumeCopy.value
  const labels: Partial<Record<string, string>> = {
    bone: copy.bone,
    blood: copy.blood,
    muscle: copy.muscle,
    softTissue: copy.softTissue,
    lung: copy.lung,
    custom: copy.custom
  }

  return labels[layer.key] ?? layer.label
}

function toWidthSliderValue(value: number): number {
  return Math.round(value * WINDOW_WIDTH_SLIDER_FACTOR)
}

function fromWidthSliderValue(value: string): number {
  return Math.round(Number(value) / WINDOW_WIDTH_SLIDER_FACTOR)
}

function toLevelSliderValue(value: number): number {
  return Math.round(value * WINDOW_LEVEL_SLIDER_FACTOR)
}

function fromLevelSliderValue(value: string): number {
  return Math.round(Number(value) / WINDOW_LEVEL_SLIDER_FACTOR)
}

function updateLayer(layerKey: string, patch: Partial<VolumeLayerConfig>): void {
  emit('configChange', {
    ...props.config,
    layers: props.config.layers.map((layer) =>
      layer.key === layerKey
        ? {
            ...layer,
            ...patch
          }
        : layer
    )
  })
}

function updateLighting(patch: Partial<VolumeLightingConfig>): void {
  emit('configChange', {
    ...props.config,
    lighting: {
      ...props.config.lighting,
      ...patch
    }
  })
}
</script>

<template>
  <div class="theme-shell-panel w-[352px] max-w-[calc(100vw-2.5rem)] rounded-[20px] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_38px_rgba(0,0,0,0.34)] backdrop-blur">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">{{ volumeCopy.parameters }}</div>
        <div class="mt-0.5 text-[13px] font-medium text-[var(--theme-text-primary)]">{{ props.config.preset.toUpperCase() }}</div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <div class="rounded-full border border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:color-mix(in_srgb,var(--theme-text-primary)_72%,var(--theme-accent))]">
          {{ props.config.blendMode }}
        </div>
        <button
          type="button"
          class="volume-config-close-button"
          :aria-label="closePanelLabel"
          :title="closePanelLabel"
          @click="emit('close')"
        >
          <AppIcon name="close" :size="15" />
        </button>
      </div>
    </div>

    <div class="mb-3 grid grid-cols-2 gap-1 rounded-[14px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] p-1">
      <button
        class="rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition"
        :class="
          activeTab === 'tissue'
            ? 'bg-[color:color-mix(in_srgb,var(--theme-accent)_16%,transparent)] text-[var(--theme-text-primary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]'
            : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface-card)]'
        "
        type="button"
        @click="activeTab = 'tissue'"
      >
        {{ volumeCopy.tissue }}
      </button>
      <button
        class="rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition"
        :class="
          activeTab === 'lighting'
            ? 'bg-[color:color-mix(in_srgb,var(--theme-accent)_16%,transparent)] text-[var(--theme-text-primary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]'
            : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface-card)]'
        "
        type="button"
        @click="activeTab = 'lighting'"
      >
        {{ volumeCopy.lighting }}
      </button>
    </div>

    <div v-if="activeTab === 'tissue'" class="max-h-[min(62vh,540px)] space-y-2 overflow-y-auto pr-1">
      <div
        v-for="layer in props.config.layers"
        :key="layer.key"
        class="rounded-[16px] border px-3 py-2.5 transition"
        :class="
          layer.enabled
            ? 'border-[var(--theme-border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_16%,transparent),var(--theme-surface-card-soft))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--theme-accent)_8%,transparent)]'
            : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)]'
        "
      >
        <div class="flex items-center justify-between gap-2">
          <label
            class="flex items-center gap-2 text-[12px] font-medium"
            :class="layer.enabled ? 'text-[var(--theme-text-primary)]' : 'text-[var(--theme-text-primary)]'"
          >
            <input
              class="h-4 w-4 rounded border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] accent-[var(--theme-accent)]"
              type="checkbox"
              :checked="layer.enabled"
              @change="updateLayer(layer.key, { enabled: ($event.target as HTMLInputElement).checked })"
            />
            <span>{{ getLayerLabel(layer) }}</span>
          </label>
          <div class="flex items-center gap-1.5">
            <input
              class="h-6 w-8 rounded-md border border-[var(--theme-border-soft)] bg-transparent p-0"
              type="color"
              :value="layer.colorStart"
              @input="updateLayer(layer.key, { colorStart: ($event.target as HTMLInputElement).value })"
            />
            <input
              class="h-6 w-8 rounded-md border border-[var(--theme-border-soft)] bg-transparent p-0"
              type="color"
              :value="layer.colorEnd"
              @input="updateLayer(layer.key, { colorEnd: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>

        <div class="mt-2 space-y-2">
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ volumeCopy.windowWidth }}</span>
              <span>{{ Math.round(layer.ww) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="-4000"
              max="6000"
              step="1"
              :value="toWidthSliderValue(layer.ww)"
              @input="updateLayer(layer.key, { ww: fromWidthSliderValue(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ volumeCopy.windowLevel }}</span>
              <span>{{ Math.round(layer.wl) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="-2000"
              max="6000"
              step="1"
              :value="toLevelSliderValue(layer.wl)"
              @input="updateLayer(layer.key, { wl: fromLevelSliderValue(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ volumeCopy.opacity }}</span>
              <span>{{ layer.opacity.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="layer.opacity"
              @input="updateLayer(layer.key, { opacity: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="max-h-[min(62vh,540px)] space-y-2 overflow-y-auto pr-1">
      <div
        class="rounded-[16px] border border-[var(--theme-border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_14%,transparent),var(--theme-surface-card-soft))] px-3 py-2.5"
      >
        <label class="flex items-center justify-between gap-3 text-[12px] font-medium text-[var(--theme-text-primary)]">
          <span>{{ volumeCopy.enableShading }}</span>
          <input
            class="h-4 w-4 rounded border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] accent-[var(--theme-accent)]"
            type="checkbox"
            :checked="props.config.lighting.shading"
            @change="updateLighting({ shading: ($event.target as HTMLInputElement).checked })"
          />
        </label>
      </div>

      <div
        class="rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2.5"
      >
        <div class="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">{{ volumeCopy.interpolation }}</div>
        <div class="grid grid-cols-3 gap-1">
          <label
            v-for="option in interpolationOptions"
            :key="option.value"
            class="flex cursor-pointer items-center justify-center rounded-[10px] border px-2 py-1.5 text-[11px] font-medium transition"
            :class="
              props.config.lighting.interpolation === option.value
                ? 'border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_14%,transparent)] text-[var(--theme-text-primary)]'
                : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface-card-soft)]'
            "
          >
            <input
              class="sr-only"
              type="radio"
              name="volume-interpolation"
              :value="option.value"
              :checked="props.config.lighting.interpolation === option.value"
              @change="updateLighting({ interpolation: option.value })"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>

      <div
        class="rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2.5"
      >
        <div class="space-y-2">
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ volumeCopy.ambient }}</span>
              <span>{{ props.config.lighting.ambient.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="props.config.lighting.ambient"
              @input="updateLighting({ ambient: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ volumeCopy.diffuse }}</span>
              <span>{{ props.config.lighting.diffuse.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="props.config.lighting.diffuse"
              @input="updateLighting({ diffuse: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ volumeCopy.specular }}</span>
              <span>{{ props.config.lighting.specular.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="props.config.lighting.specular"
              @input="updateLighting({ specular: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ volumeCopy.roughness }}</span>
              <span>{{ props.config.lighting.roughness.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="props.config.lighting.roughness"
              @input="updateLighting({ roughness: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.volume-config-close-button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 86%, transparent);
  color: var(--theme-text-secondary);
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.volume-config-close-button:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 36%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  color: var(--theme-text-primary);
}
</style>
