<script setup lang="ts">
import { ref } from 'vue'
import type { VolumeInterpolationMode, VolumeLayerConfig, VolumeLightingConfig, VolumeRenderConfig } from '../../types/viewer'

type PanelTabKey = 'tissue' | 'lighting'

const props = defineProps<{
  config: VolumeRenderConfig
}>()

const emit = defineEmits<{
  configChange: [config: VolumeRenderConfig]
}>()

const activeTab = ref<PanelTabKey>('tissue')

const interpolationOptions: Array<{ value: VolumeInterpolationMode; label: string }> = [
  { value: 'nearest', label: '最临近' },
  { value: 'linear', label: '线性' },
  { value: 'cubic', label: '三次内插' }
]

const WINDOW_WIDTH_SLIDER_FACTOR = 2
const WINDOW_LEVEL_SLIDER_FACTOR = 2

function toWidthSliderValue(value: number): number {
  return Math.round(value * WINDOW_WIDTH_SLIDER_FACTOR)
}

function fromWidthSliderValue(value: string): number {
  return Math.max(1, Math.round(Number(value) / WINDOW_WIDTH_SLIDER_FACTOR))
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
  <div
    class="w-[352px] max-w-[calc(100vw-2.5rem)] rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,24,37,0.96),rgba(10,18,29,0.98))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_38px_rgba(0,0,0,0.34)] backdrop-blur"
  >
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400/75">3D Parameters</div>
        <div class="mt-0.5 text-[13px] font-medium text-slate-200">{{ props.config.preset.toUpperCase() }}</div>
      </div>
      <div
        class="rounded-full border border-sky-300/18 bg-sky-300/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100/78"
      >
        {{ props.config.blendMode }}
      </div>
    </div>

    <div class="mb-3 grid grid-cols-2 gap-1 rounded-[14px] border border-white/8 bg-white/[0.03] p-1">
      <button
        class="rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition"
        :class="
          activeTab === 'tissue'
            ? 'bg-sky-300/18 text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.16)]'
            : 'text-slate-300 hover:bg-white/[0.04]'
        "
        type="button"
        @click="activeTab = 'tissue'"
      >
        组织窗
      </button>
      <button
        class="rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition"
        :class="
          activeTab === 'lighting'
            ? 'bg-sky-300/18 text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.16)]'
            : 'text-slate-300 hover:bg-white/[0.04]'
        "
        type="button"
        @click="activeTab = 'lighting'"
      >
        灯光
      </button>
    </div>

    <div v-if="activeTab === 'tissue'" class="max-h-[min(62vh,540px)] space-y-2 overflow-y-auto pr-1">
      <div
        v-for="layer in props.config.layers"
        :key="layer.key"
        class="rounded-[16px] border px-3 py-2.5 transition"
        :class="
          layer.enabled
            ? 'border-sky-300/28 bg-[linear-gradient(180deg,rgba(47,94,132,0.22),rgba(18,34,50,0.22))] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.08)]'
            : 'border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))]'
        "
      >
        <div class="flex items-center justify-between gap-2">
          <label
            class="flex items-center gap-2 text-[12px] font-medium"
            :class="layer.enabled ? 'text-sky-50' : 'text-slate-100'"
          >
            <input
              class="h-4 w-4 rounded border-white/20 bg-slate-900/80 accent-sky-300"
              type="checkbox"
              :checked="layer.enabled"
              @change="updateLayer(layer.key, { enabled: ($event.target as HTMLInputElement).checked })"
            />
            <span>{{ layer.label }}</span>
          </label>
          <div class="flex items-center gap-1.5">
            <input
              class="h-6 w-8 rounded-md border border-white/10 bg-transparent p-0"
              type="color"
              :value="layer.colorStart"
              @input="updateLayer(layer.key, { colorStart: ($event.target as HTMLInputElement).value })"
            />
            <input
              class="h-6 w-8 rounded-md border border-white/10 bg-transparent p-0"
              type="color"
              :value="layer.colorEnd"
              @input="updateLayer(layer.key, { colorEnd: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>

        <div class="mt-2 space-y-2">
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>窗宽</span>
              <span>{{ Math.round(layer.ww) }}</span>
            </div>
            <input
              class="w-full accent-sky-300"
              type="range"
              min="2"
              max="6000"
              step="1"
              :value="toWidthSliderValue(layer.ww)"
              @input="updateLayer(layer.key, { ww: fromWidthSliderValue(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>窗位</span>
              <span>{{ Math.round(layer.wl) }}</span>
            </div>
            <input
              class="w-full accent-sky-300"
              type="range"
              min="-2000"
              max="6000"
              step="1"
              :value="toLevelSliderValue(layer.wl)"
              @input="updateLayer(layer.key, { wl: fromLevelSliderValue(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>透明度</span>
              <span>{{ layer.opacity.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-sky-300"
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
        class="rounded-[16px] border border-sky-300/18 bg-[linear-gradient(180deg,rgba(32,55,77,0.24),rgba(15,25,36,0.2))] px-3 py-2.5"
      >
        <label class="flex items-center justify-between gap-3 text-[12px] font-medium text-slate-100">
          <span>开启阴影</span>
          <input
            class="h-4 w-4 rounded border-white/20 bg-slate-900/80 accent-sky-300"
            type="checkbox"
            :checked="props.config.lighting.shading"
            @change="updateLighting({ shading: ($event.target as HTMLInputElement).checked })"
          />
        </label>
      </div>

      <div
        class="rounded-[16px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] px-3 py-2.5"
      >
        <div class="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">插值方式</div>
        <div class="grid grid-cols-3 gap-1">
          <label
            v-for="option in interpolationOptions"
            :key="option.value"
            class="flex cursor-pointer items-center justify-center rounded-[10px] border px-2 py-1.5 text-[11px] font-medium transition"
            :class="
              props.config.lighting.interpolation === option.value
                ? 'border-sky-300/28 bg-sky-300/16 text-sky-100'
                : 'border-white/8 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'
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
        class="rounded-[16px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] px-3 py-2.5"
      >
        <div class="space-y-2">
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>环境光</span>
              <span>{{ props.config.lighting.ambient.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-sky-300"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="props.config.lighting.ambient"
              @input="updateLighting({ ambient: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>漫反射</span>
              <span>{{ props.config.lighting.diffuse.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-sky-300"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="props.config.lighting.diffuse"
              @input="updateLighting({ diffuse: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>镜面反射</span>
              <span>{{ props.config.lighting.specular.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-sky-300"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="props.config.lighting.specular"
              @input="updateLighting({ specular: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>粗糙度</span>
              <span>{{ props.config.lighting.roughness.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-sky-300"
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
