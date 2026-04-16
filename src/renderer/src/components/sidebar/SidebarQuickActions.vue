<script setup lang="ts">
import { VBtn, VCard, VChip } from 'vuetify/components'
import type { ViewType } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

defineProps<{
  hasSelectedSeries: boolean
  viewerFolderSourceMode: 'desktop-picker' | 'web-prompt' | 'server-sample'
  viewerPlatform: 'desktop' | 'web'
}>()

const emit = defineEmits<{
  chooseFolder: []
  openView: [viewType: ViewType]
}>()

const { t } = useUiLocale()
</script>

<template>
  <VCard class="rounded-2xl! border! border-white/8! bg-slate-900/55! p-4! shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <div class="mb-3 flex items-center justify-between">
      <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/60">{{ t('quickActions') }}</span>
      <VChip size="x-small" class="rounded-full! border! border-sky-200/10! bg-sky-300/8! px-2! py-1! text-[11px]! text-sky-100/70!" variant="flat">
        {{ viewerPlatform === 'web' ? 'Web' : 'Desktop' }}
      </VChip>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <VBtn variant="flat" class="col-span-2 rounded-full! border! border-sky-200/20! bg-[linear-gradient(135deg,rgba(75,173,255,0.18),rgba(255,149,92,0.18))]! px-4! py-3! text-sm! font-semibold! text-slate-50! shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_24px_rgba(9,18,32,0.24)]" @click="emit('chooseFolder')">
        {{
          viewerFolderSourceMode === 'server-sample'
            ? t('loadSample')
            : viewerPlatform === 'web'
              ? t('inputPath')
              : t('loadFolder')
        }}
      </VBtn>
      <VBtn variant="flat" class="rounded-full! border! border-white/8! bg-white/7! px-4! py-3! text-sm! font-semibold! text-slate-100!" :disabled="!hasSelectedSeries" @click="emit('openView', 'Stack')">
        {{ t('quickPreview') }}
      </VBtn>
      <VBtn variant="flat" class="rounded-full! border! border-white/8! bg-white/7! px-4! py-3! text-sm! font-semibold! text-slate-100!" :disabled="!hasSelectedSeries" @click="emit('openView', '3D')">
        3D
      </VBtn>
      <VBtn variant="flat" class="rounded-full! border! border-white/8! bg-white/7! px-4! py-3! text-sm! font-semibold! text-slate-100!" :disabled="!hasSelectedSeries" @click="emit('openView', 'MPR')">
        MPR
      </VBtn>
      <VBtn variant="flat" class="rounded-full! border! border-white/8! bg-white/7! px-4! py-3! text-sm! font-semibold! text-slate-100!" :disabled="!hasSelectedSeries" @click="emit('openView', 'Tag')">
        Tag
      </VBtn>
    </div>

    <div v-if="viewerPlatform === 'web'" class="mt-3 text-[11px] leading-5 text-slate-400">
      {{
        viewerFolderSourceMode === 'server-sample'
          ? t('webSampleHint')
          : t('webPathHint')
      }}
    </div>
  </VCard>
</template>
