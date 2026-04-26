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
  <VCard class="theme-shell-panel rounded-2xl! border! p-4! shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <div class="mb-3 flex items-center justify-between">
      <span class="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--theme-text-muted)]">{{ t('quickActions') }}</span>
      <VChip size="x-small" class="rounded-full! border! px-2! py-1! text-[11px]! theme-card-soft text-[var(--theme-text-secondary)]!" variant="flat">
        {{ viewerPlatform === 'web' ? 'Web' : 'Desktop' }}
      </VChip>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <VBtn variant="flat" class="theme-button-primary col-span-2 rounded-full! border! px-4! py-3! text-sm! font-semibold! shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_24px_rgba(9,18,32,0.24)]" @click="emit('chooseFolder')">
        {{
          viewerFolderSourceMode === 'server-sample'
            ? t('loadSample')
            : viewerPlatform === 'web'
              ? t('inputPath')
              : t('loadFolder')
        }}
      </VBtn>
      <VBtn variant="flat" class="theme-button-secondary rounded-full! border! px-4! py-3! text-sm! font-semibold!" :disabled="!hasSelectedSeries" @click="emit('openView', 'Stack')">
        {{ t('quickPreview') }}
      </VBtn>
      <VBtn variant="flat" class="theme-button-secondary rounded-full! border! px-4! py-3! text-sm! font-semibold!" :disabled="!hasSelectedSeries" @click="emit('openView', '4D')">
        4D
      </VBtn>
      <VBtn variant="flat" class="theme-button-secondary rounded-full! border! px-4! py-3! text-sm! font-semibold!" :disabled="!hasSelectedSeries" @click="emit('openView', '3D')">
        3D
      </VBtn>
      <VBtn variant="flat" class="theme-button-secondary rounded-full! border! px-4! py-3! text-sm! font-semibold!" :disabled="!hasSelectedSeries" @click="emit('openView', 'MPR')">
        MPR
      </VBtn>
      <VBtn variant="flat" class="theme-button-secondary rounded-full! border! px-4! py-3! text-sm! font-semibold!" :disabled="!hasSelectedSeries" @click="emit('openView', 'Tag')">
        Tag
      </VBtn>
    </div>

    <div v-if="viewerPlatform === 'web'" class="mt-3 text-[11px] leading-5 text-[var(--theme-text-muted)]">
      {{
        viewerFolderSourceMode === 'server-sample'
          ? t('webSampleHint')
          : t('webPathHint')
      }}
    </div>
  </VCard>
</template>
