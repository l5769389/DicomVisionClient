<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

import { computed, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import {
  createDefaultMprSegmentationConfig,
  MPR_SEGMENTATION_HU_LIMITS,
  normalizeMprSegmentationConfig,
  type MprSegmentationConfig
} from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

const props = defineProps<{
  config: MprSegmentationConfig
}>()

const emit = defineEmits<{
  close: []
  configChange: [config: MprSegmentationConfig, actionType?: 'move' | 'end']
}>()

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const huFields = ['lowerHu', 'upperHu'] as const
const copy = computed(() => ({
  title: isZh.value ? '阈值分割' : 'Threshold',
  subtitle: isZh.value ? 'MPR mask 预览 / VOI' : 'MPR mask preview / VOI',
  preview: isZh.value ? '预览' : 'Preview',
  lowerHu: isZh.value ? 'HU 下限' : 'Lower HU',
  upperHu: isZh.value ? 'HU 上限' : 'Upper HU',
  opacity: isZh.value ? '透明度' : 'Opacity',
  color: isZh.value ? '颜色' : 'Color',
  clearVoi: isZh.value ? '清除 VOI' : 'Clear VOI',
  clearSegmentation: isZh.value ? '清除分割' : 'Clear mask'
}))

const draftConfig = ref<MprSegmentationConfig | null>(null)
const displayedConfig = computed(() => draftConfig.value ?? normalizeMprSegmentationConfig(props.config))
const opacityPercent = computed(() => Math.round(displayedConfig.value.opacity * 100))

watch(
  () => props.config,
  () => {
    draftConfig.value = null
  },
  { deep: true }
)

function emitConfig(config: MprSegmentationConfig, actionType: 'move' | 'end' = 'end'): void {
  const normalized = normalizeMprSegmentationConfig(config)
  if (actionType === 'move') {
    draftConfig.value = normalized
  } else {
    draftConfig.value = null
  }
  emit('configChange', normalized, actionType)
}

function emitPatch(patch: Partial<MprSegmentationConfig>, actionType: 'move' | 'end' = 'end'): void {
  emitConfig(
    {
      ...displayedConfig.value,
      ...patch
    },
    actionType
  )
}

function updateHu(field: 'lowerHu' | 'upperHu', value: string, actionType: 'move' | 'end' = 'move'): void {
  emitPatch(
    {
      [field]: Number(value)
    },
    actionType
  )
}

function updateOpacity(value: string, actionType: 'move' | 'end' = 'move'): void {
  emitPatch(
    {
      opacity: Number(value)
    },
    actionType
  )
}

function clearVoi(): void {
  emitPatch({ voiBox: null }, 'end')
}

function clearSegmentation(): void {
  emitConfig(
    {
      ...createDefaultMprSegmentationConfig(),
      voiBox: null
    },
    'end'
  )
}
</script>

<template>
  <div
    v-bind="$attrs"
    class="theme-shell-panel max-h-full w-[min(360px,calc(100vw-2.5rem))] overflow-y-auto rounded-[18px] border-[color:color-mix(in_srgb,var(--theme-border-strong)_85%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-panel-strong-solid)_96%,black_4%),color-mix(in_srgb,var(--theme-surface-panel-solid)_94%,black_6%))] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.03),0_24px_54px_rgba(0,0,0,0.42),0_8px_20px_rgba(0,0,0,0.24)] backdrop-blur-xl"
  >
    <div class="mb-2.5 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.title }}</div>
        <div class="mt-0.5 truncate text-[12px] font-medium text-[var(--theme-text-primary)]">{{ copy.subtitle }}</div>
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
          <span>{{ copy.preview }}</span>
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
        v-for="field in huFields"
        :key="field"
        class="rounded-[14px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2"
      >
        <div class="mb-1.5 flex items-center justify-between gap-3">
          <span class="text-[11px] font-semibold text-[var(--theme-text-secondary)]">{{ field === 'lowerHu' ? copy.lowerHu : copy.upperHu }}</span>
          <input
            class="w-20 rounded-[10px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 text-right text-[12px] text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]"
            type="number"
            :min="MPR_SEGMENTATION_HU_LIMITS.min"
            :max="MPR_SEGMENTATION_HU_LIMITS.max"
            step="1"
            :value="displayedConfig[field]"
            @input="updateHu(field, ($event.target as HTMLInputElement).value, 'move')"
            @change="updateHu(field, ($event.target as HTMLInputElement).value, 'end')"
            @blur="updateHu(field, ($event.target as HTMLInputElement).value, 'end')"
          />
        </div>
        <input
          class="w-full accent-[var(--theme-accent)]"
          type="range"
          :min="MPR_SEGMENTATION_HU_LIMITS.min"
          :max="MPR_SEGMENTATION_HU_LIMITS.max"
          step="1"
          :value="displayedConfig[field]"
          @input="updateHu(field, ($event.target as HTMLInputElement).value, 'move')"
          @change="updateHu(field, ($event.target as HTMLInputElement).value, 'end')"
        />
      </div>

      <div class="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[14px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-3 py-2">
        <label class="min-w-0">
          <div class="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-[var(--theme-text-secondary)]">
            <span>{{ copy.opacity }}</span>
            <span>{{ opacityPercent }}%</span>
          </div>
          <input
            class="w-full accent-[var(--theme-accent)]"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="displayedConfig.opacity"
            @input="updateOpacity(($event.target as HTMLInputElement).value, 'move')"
            @change="updateOpacity(($event.target as HTMLInputElement).value, 'end')"
          />
        </label>
        <label class="flex flex-col items-center gap-1 text-[10px] font-semibold text-[var(--theme-text-secondary)]">
          <span>{{ copy.color }}</span>
          <input
            class="h-8 w-9 cursor-pointer rounded-[10px] border border-[var(--theme-border-soft)] bg-transparent p-0.5"
            type="color"
            :value="displayedConfig.color"
            @input="emitPatch({ color: ($event.target as HTMLInputElement).value }, 'move')"
            @change="emitPatch({ color: ($event.target as HTMLInputElement).value }, 'end')"
          />
        </label>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button
          class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2.5 text-[11px] font-semibold text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
          type="button"
          @click="clearVoi"
        >
          <AppIcon name="segmentation-voi" :size="14" />
          <span>{{ copy.clearVoi }}</span>
        </button>
        <button
          class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-100 transition hover:border-rose-200/45 hover:bg-rose-500/15"
          type="button"
          @click="clearSegmentation"
        >
          <AppIcon name="trash" :size="14" />
          <span>{{ copy.clearSegmentation }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
