<script setup lang="ts">
import { computed } from 'vue'
import { VBtn, VCard } from 'vuetify/components'
import type { ViewType } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
import clinicalLight2dIcon from '../../assets/theme-action-icons/clinical_light/2d.png'
import clinicalLight3dIcon from '../../assets/theme-action-icons/clinical_light/3d.png'
import clinicalLight4dIcon from '../../assets/theme-action-icons/clinical_light/4d.png'
import clinicalLightMprIcon from '../../assets/theme-action-icons/clinical_light/mpr.png'
import clinicalLightFolderIcon from '../../assets/theme-action-icons/clinical_light/open_folder.png'
import clinicalLightTagIcon from '../../assets/theme-action-icons/clinical_light/tag.png'
import coolDeepBlue2dIcon from '../../assets/theme-action-icons/cool_deep_blue/2d.png'
import coolDeepBlue3dIcon from '../../assets/theme-action-icons/cool_deep_blue/3d.png'
import coolDeepBlue4dIcon from '../../assets/theme-action-icons/cool_deep_blue/4d.png'
import coolDeepBlueMprIcon from '../../assets/theme-action-icons/cool_deep_blue/mpr.png'
import coolDeepBlueFolderIcon from '../../assets/theme-action-icons/cool_deep_blue/open_folder.png'
import coolDeepBlueTagIcon from '../../assets/theme-action-icons/cool_deep_blue/tag.png'
import industrialDark2dIcon from '../../assets/theme-action-icons/industrial_dark/2d.png'
import industrialDark3dIcon from '../../assets/theme-action-icons/industrial_dark/3d.png'
import industrialDark4dIcon from '../../assets/theme-action-icons/industrial_dark/4d.png'
import industrialDarkMprIcon from '../../assets/theme-action-icons/industrial_dark/mpr.png'
import industrialDarkFolderIcon from '../../assets/theme-action-icons/industrial_dark/open_folder.png'
import industrialDarkTagIcon from '../../assets/theme-action-icons/industrial_dark/tag.png'

type ThemeIconSet = 'clinical_light' | 'cool_deep_blue' | 'industrial_dark'
type QuickActionIconKey = 'folder' | 'stack' | 'volume' | 'fourD' | 'tag' | 'mpr'

const quickActionIcons: Record<ThemeIconSet, Record<QuickActionIconKey, string>> = {
  clinical_light: {
    folder: clinicalLightFolderIcon,
    stack: clinicalLight2dIcon,
    volume: clinicalLight3dIcon,
    fourD: clinicalLight4dIcon,
    tag: clinicalLightTagIcon,
    mpr: clinicalLightMprIcon
  },
  cool_deep_blue: {
    folder: coolDeepBlueFolderIcon,
    stack: coolDeepBlue2dIcon,
    volume: coolDeepBlue3dIcon,
    fourD: coolDeepBlue4dIcon,
    tag: coolDeepBlueTagIcon,
    mpr: coolDeepBlueMprIcon
  },
  industrial_dark: {
    folder: industrialDarkFolderIcon,
    stack: industrialDark2dIcon,
    volume: industrialDark3dIcon,
    fourD: industrialDark4dIcon,
    tag: industrialDarkTagIcon,
    mpr: industrialDarkMprIcon
  }
}

const props = defineProps<{
  hasSelectedSeries: boolean
  isSelectedSeriesFourD: boolean
  viewerFolderSourceMode: 'desktop-picker' | 'web-prompt' | 'server-sample'
  viewerPlatform: 'desktop' | 'web'
}>()

const emit = defineEmits<{
  chooseFolder: []
  openView: [viewType: ViewType]
}>()

const { t } = useUiLocale()
const { themeId } = useUiPreferences()

const themeIconSet = computed<ThemeIconSet>(() => {
  if (themeId.value === 'clinical-light') {
    return 'clinical_light'
  }
  if (themeId.value === 'aurora') {
    return 'cool_deep_blue'
  }
  return 'industrial_dark'
})

const folderActionLabel = computed(() => {
  if (props.viewerFolderSourceMode === 'server-sample') {
    return t('loadSample')
  }
  return props.viewerPlatform === 'web' ? t('inputPath') : t('loadFolder')
})

function getQuickActionIcon(key: QuickActionIconKey): string {
  return quickActionIcons[themeIconSet.value][key]
}
</script>

<template>
  <VCard class="quick-actions-card theme-shell-panel rounded-2xl! border! p-2.5! shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <div class="quick-action-icon-grid grid grid-cols-6 gap-1.5">
      <VBtn variant="flat" class="quick-action-button quick-action-button--primary theme-button-primary h-10! min-w-0! rounded-xl! border! p-0! shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_18px_rgba(9,18,32,0.18)]" :aria-label="folderActionLabel" :title="folderActionLabel" @click="emit('chooseFolder')">
        <img class="quick-action-image" :src="getQuickActionIcon('folder')" alt="" draggable="false" />
      </VBtn>
      <VBtn variant="flat" class="quick-action-button quick-action-button--secondary theme-button-secondary h-10! min-w-0! rounded-xl! border! p-0!" :disabled="!hasSelectedSeries" :aria-label="t('quickPreview')" :title="t('quickPreview')" @click="emit('openView', 'Stack')">
        <img class="quick-action-image" :src="getQuickActionIcon('stack')" alt="" draggable="false" />
      </VBtn>
      <VBtn variant="flat" class="quick-action-button quick-action-button--secondary theme-button-secondary h-10! min-w-0! rounded-xl! border! p-0!" :disabled="!hasSelectedSeries" aria-label="3D" title="3D" @click="emit('openView', '3D')">
        <img class="quick-action-image" :src="getQuickActionIcon('volume')" alt="" draggable="false" />
      </VBtn>
      <VBtn variant="flat" class="quick-action-button quick-action-button--secondary theme-button-secondary h-10! min-w-0! rounded-xl! border! p-0!" :disabled="!hasSelectedSeries || !isSelectedSeriesFourD" aria-label="4D" title="4D" @click="emit('openView', '4D')">
        <img class="quick-action-image" :src="getQuickActionIcon('fourD')" alt="" draggable="false" />
      </VBtn>
      <VBtn variant="flat" class="quick-action-button quick-action-button--secondary theme-button-secondary h-10! min-w-0! rounded-xl! border! p-0!" :disabled="!hasSelectedSeries" aria-label="DICOM Tags" title="DICOM Tags" @click="emit('openView', 'Tag')">
        <img class="quick-action-image" :src="getQuickActionIcon('tag')" alt="" draggable="false" />
      </VBtn>
      <VBtn variant="flat" class="quick-action-button quick-action-button--secondary theme-button-secondary h-10! min-w-0! rounded-xl! border! p-0!" :disabled="!hasSelectedSeries" aria-label="MPR" title="MPR" @click="emit('openView', 'MPR')">
        <img class="quick-action-image" :src="getQuickActionIcon('mpr')" alt="" draggable="false" />
      </VBtn>
    </div>

    <div v-if="viewerPlatform === 'web'" class="mt-2 text-[11px] leading-5 text-[var(--theme-text-muted)]">
      {{
        viewerFolderSourceMode === 'server-sample'
          ? t('webSampleHint')
          : t('webPathHint')
      }}
    </div>
  </VCard>
</template>

<style scoped>
.quick-action-button {
  overflow: hidden;
}

.quick-action-image {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}

:deep(.quick-action-button .v-btn__content) {
  display: grid;
  height: 100%;
  width: 100%;
  place-items: center;
  padding: 0;
}
</style>
