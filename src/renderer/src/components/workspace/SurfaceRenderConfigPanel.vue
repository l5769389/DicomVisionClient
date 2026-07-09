<script setup lang="ts">
import { computed } from 'vue'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import type { SurfaceRenderConfig } from '../../types/viewer'
import AppIcon from '../AppIcon.vue'

const props = defineProps<{
  config: SurfaceRenderConfig
  embedded?: boolean
}>()

const emit = defineEmits<{
  close: []
  configChange: [config: SurfaceRenderConfig]
}>()

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const closePanelLabel = computed(() => (isZh.value ? '关闭 Surface 参数' : 'Close Surface parameters'))
type SurfaceMaterialKey = 'ambient' | 'diffuse' | 'specular' | 'roughness'

const copy = computed(() => ({
  title: isZh.value ? 'Surface 参数' : 'Surface Parameters',
  extraction: isZh.value ? '网格提取' : 'Extraction',
  material: isZh.value ? '材质' : 'Material',
  isoValue: isZh.value ? '等值阈值' : 'Iso Value',
  smoothing: isZh.value ? '平滑' : 'Smoothing',
  decimation: isZh.value ? '抽稀' : 'Decimation',
  color: isZh.value ? '颜色' : 'Color',
  ambient: isZh.value ? '环境光' : 'Ambient',
  diffuse: isZh.value ? '漫反射' : 'Diffuse',
  specular: isZh.value ? '高光' : 'Specular',
  roughness: isZh.value ? '粗糙度' : 'Roughness'
}))

const materialControls = computed<Array<{ key: SurfaceMaterialKey; label: string; value: number }>>(() => [
  { key: 'ambient', label: copy.value.ambient, value: props.config.ambient },
  { key: 'diffuse', label: copy.value.diffuse, value: props.config.diffuse },
  { key: 'specular', label: copy.value.specular, value: props.config.specular },
  { key: 'roughness', label: copy.value.roughness, value: props.config.roughness }
])

function updateConfig(patch: Partial<SurfaceRenderConfig>): void {
  emit('configChange', {
    ...props.config,
    ...patch
  })
}

function updateMaterial(key: SurfaceMaterialKey, value: number): void {
  updateConfig({ [key]: value })
}
</script>

<template>
  <div
    class="surface-config-panel theme-shell-panel w-[352px] max-w-[calc(100vw-2.5rem)] rounded-[20px] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_38px_rgba(0,0,0,0.34)] backdrop-blur"
    :class="{ 'surface-config-panel--embedded': embedded }"
  >
    <div v-if="!embedded" class="mb-3 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">{{ copy.title }}</div>
        <div class="mt-0.5 text-[13px] font-medium text-[var(--theme-text-primary)]">{{ props.config.preset }}</div>
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

    <div class="surface-config-panel__scroll space-y-3 overflow-y-auto pr-1">
      <section class="rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-3">
        <div class="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.extraction }}</div>
        <div class="space-y-3">
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ copy.isoValue }}</span>
              <span>{{ Math.round(props.config.isoValue) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="-2000"
              max="4000"
              step="1"
              :value="props.config.isoValue"
              @input="updateConfig({ isoValue: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
                <span>{{ copy.smoothing }}</span>
                <span>{{ props.config.smoothing.toFixed(2) }}</span>
              </div>
              <input
                class="w-full accent-[var(--theme-accent)]"
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="props.config.smoothing"
                @input="updateConfig({ smoothing: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
                <span>{{ copy.decimation }}</span>
                <span>{{ props.config.decimation.toFixed(2) }}</span>
              </div>
              <input
                class="w-full accent-[var(--theme-accent)]"
                type="range"
                min="0"
                max="0.9"
                step="0.01"
                :value="props.config.decimation"
                @input="updateConfig({ decimation: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.material }}</div>
          <label class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
            <span>{{ copy.color }}</span>
            <input
              class="h-6 w-8 rounded-md border border-[var(--theme-border-soft)] bg-transparent p-0"
              type="color"
              :value="props.config.color"
              @input="updateConfig({ color: ($event.target as HTMLInputElement).value })"
            />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="item in materialControls"
            :key="item.key"
            class="space-y-1"
          >
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
              <span>{{ item.label }}</span>
              <span>{{ item.value.toFixed(2) }}</span>
            </div>
            <input
              class="w-full accent-[var(--theme-accent)]"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="item.value"
              @input="updateMaterial(item.key, Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.surface-config-panel--embedded {
  width: 100%;
  max-width: none;
  border-radius: 0;
  border: 0;
  box-shadow: none;
}

.surface-config-panel__scroll {
  max-height: min(70vh, 560px);
}

.surface-config-panel--embedded .surface-config-panel__scroll {
  max-height: none;
}
</style>
