<script setup lang="ts">
import { computed } from 'vue'
import { VBtn, VCard, VMenu } from 'vuetify/components'
import type { FolderSeriesItem, ViewType } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { isSeriesViewSupported } from '../../composables/workspace/views/seriesViewSupport'
import type { WebUploadPickMode } from '../../platform/runtime'
import { normalizeInlineSvg } from '../../utils/svg'
import AppIcon from '../AppIcon.vue'
import fileIcon from '../../assets/dicom-action-icons/dicom-file.svg?raw'
import folderIcon from '../../assets/dicom-action-icons/open-folder.svg?raw'

type QuickViewAction = {
  label: string
  title: string
  viewType: ViewType
  disabled: boolean
  wide?: boolean
}

const props = defineProps<{
  hasSelectedSeries: boolean
  isLocalSourceEnabled: boolean
  isSelectedSeriesFourD: boolean
  selectedSeries: FolderSeriesItem | null
  viewerFolderSourceMode: 'desktop-picker' | 'web-upload' | 'server-sample'
  viewerPlatform: 'desktop' | 'web'
}>()

const emit = defineEmits<{
  chooseFolder: [mode?: WebUploadPickMode]
  openView: [viewType: ViewType]
}>()

const { t } = useUiLocale()

const normalizedFileIcon = computed(() => normalizeInlineSvg(fileIcon))
const normalizedFolderIcon = computed(() => normalizeInlineSvg(folderIcon))
const isServerSampleMode = computed(() => props.viewerFolderSourceMode === 'server-sample')
const isWebUploadAvailable = computed(() => props.viewerPlatform === 'web')

const folderActionLabel = computed(() => {
  if (props.viewerFolderSourceMode === 'server-sample') {
    return t('loadSample')
  }
  return props.viewerPlatform === 'web' ? t('uploadDicom') : t('loadFolder')
})

const uploadModeActions = computed<{ label: string; hint: string; mode: WebUploadPickMode }[]>(() => [
  {
    label: t('uploadFolder'),
    hint: t('uploadFolderHint'),
    mode: 'folder'
  },
  {
    label: t('uploadFiles'),
    hint: t('uploadFilesHint'),
    mode: 'files'
  }
])

const quickViewActions = computed<QuickViewAction[]>(() => [
  {
    label: '2D',
    title: t('quickPreview'),
    viewType: 'Stack',
    disabled: !props.hasSelectedSeries || !isSeriesViewSupported(props.selectedSeries, 'Stack')
  },
  {
    label: '3D',
    title: '3D',
    viewType: '3D',
    disabled: !props.hasSelectedSeries || !isSeriesViewSupported(props.selectedSeries, '3D')
  },
  {
    label: '4D',
    title: '4D',
    viewType: '4D',
    disabled: !props.hasSelectedSeries || !props.isSelectedSeriesFourD || !isSeriesViewSupported(props.selectedSeries, '4D')
  },
  {
    label: 'TAG',
    title: 'DICOM Tags',
    viewType: 'Tag',
    disabled: !props.hasSelectedSeries || !isSeriesViewSupported(props.selectedSeries, 'Tag'),
    wide: true
  },
  {
    label: 'MPR',
    title: 'MPR',
    viewType: 'MPR',
    disabled: !props.hasSelectedSeries || !isSeriesViewSupported(props.selectedSeries, 'MPR'),
    wide: true
  }
])

</script>

<template>
  <VCard class="quick-actions-card theme-shell-panel rounded-2xl! border! p-2.5! shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <VBtn
      v-if="isLocalSourceEnabled && isServerSampleMode"
      variant="flat"
      class="sample-action-button mb-2 w-full! min-w-0! rounded-2xl! border! px-3! py-0!"
      :aria-label="folderActionLabel"
      :title="folderActionLabel"
      @click="emit('chooseFolder')"
    >
      <span class="sample-action-button__content">
        <span class="sample-action-button__icon" aria-hidden="true">
          <AppIcon name="play" :size="18" />
        </span>
        <span class="sample-action-button__copy">
          <span class="sample-action-button__title">{{ folderActionLabel }}</span>
          <span class="sample-action-button__badge">DEMO SAMPLE</span>
        </span>
      </span>
    </VBtn>

    <div class="quick-action-icon-grid grid grid-cols-6 gap-1.5">
      <VMenu
        v-if="isLocalSourceEnabled && isWebUploadAvailable"
        location="bottom start"
        :offset="8"
        :close-on-content-click="true"
        scroll-strategy="reposition"
      >
        <template #activator="{ props: menuProps }">
          <VBtn
            v-bind="menuProps"
            variant="flat"
            class="quick-action-button quick-action-button--primary theme-button-primary h-10! min-w-0! rounded-xl! border! p-0! shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_18px_rgba(9,18,32,0.18)]"
            :aria-label="t('uploadDicom')"
            :title="t('uploadDicom')"
          >
            <span class="quick-action-glyph" aria-hidden="true" v-html="normalizedFileIcon" />
          </VBtn>
        </template>

        <div class="quick-upload-menu theme-shell-panel min-w-[220px] rounded-2xl border p-2 shadow-[0_22px_46px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
          <button
            v-for="action in uploadModeActions"
            :key="action.mode"
            type="button"
            class="quick-upload-menu__item w-full rounded-xl border border-transparent px-3 py-2.5 text-left transition"
            @click="emit('chooseFolder', action.mode)"
          >
            <span class="block text-sm font-semibold text-[var(--theme-text-primary)]">{{ action.label }}</span>
            <span class="mt-0.5 block text-xs leading-5 text-[var(--theme-text-secondary)]">{{ action.hint }}</span>
          </button>
        </div>
      </VMenu>

      <VBtn v-if="isLocalSourceEnabled && !isWebUploadAvailable && !isServerSampleMode" variant="flat" class="quick-action-button quick-action-button--primary theme-button-primary h-10! min-w-0! rounded-xl! border! p-0! shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_18px_rgba(9,18,32,0.18)]" :aria-label="folderActionLabel" :title="folderActionLabel" @click="emit('chooseFolder')">
        <span class="quick-action-glyph" aria-hidden="true" v-html="normalizedFolderIcon" />
      </VBtn>
      <VBtn
        v-for="action in quickViewActions"
        :key="action.viewType"
        variant="flat"
        class="quick-action-button quick-action-button--secondary theme-button-secondary h-10! min-w-0! rounded-xl! border! p-0!"
        :disabled="action.disabled"
        :aria-label="action.title"
        :title="action.title"
        @click="emit('openView', action.viewType)"
      >
        <span class="quick-action-label" :class="{ 'quick-action-label--wide': action.wide }">
          {{ action.label }}
        </span>
      </VBtn>
    </div>

    <div v-if="viewerPlatform === 'web'" class="mt-2 text-[11px] leading-5 text-[var(--theme-text-muted)]">
      {{
        viewerFolderSourceMode === 'server-sample'
          ? t('webSampleHint')
          : t('webUploadHint')
      }}
    </div>
  </VCard>
</template>

<style scoped>
.quick-action-icon-grid {
  align-items: center;
  justify-items: center;
}

.sample-action-button {
  height: 52px !important;
  min-height: 52px !important;
  overflow: hidden;
  border-color: color-mix(in srgb, #f59e0b 42%, var(--theme-border-strong)) !important;
  background:
    linear-gradient(135deg, color-mix(in srgb, #f59e0b 92%, #ffffff 8%), #14b8a6) !important;
  color: #07111d !important;
  text-transform: none !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.42),
    0 12px 22px rgba(20, 184, 166, 0.2),
    0 8px 18px rgba(245, 158, 11, 0.18) !important;
}

.sample-action-button:hover:not(.v-btn--disabled) {
  border-color: color-mix(in srgb, #fbbf24 62%, var(--theme-border-strong)) !important;
  background:
    linear-gradient(135deg, #fbbf24, color-mix(in srgb, #14b8a6 86%, #ffffff 14%)) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 14px 26px rgba(20, 184, 166, 0.24),
    0 10px 22px rgba(245, 158, 11, 0.22) !important;
}

.sample-action-button__content {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.sample-action-button__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(7, 17, 29, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.42);
  color: #07111d;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.sample-action-button__copy {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 3px;
}

.sample-action-button__title {
  max-width: 100%;
  overflow: hidden;
  color: #07111d;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sample-action-button__badge {
  max-width: 100%;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(7, 17, 29, 0.15);
  color: rgba(7, 17, 29, 0.78);
  font-family: var(--theme-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
  padding: 3px 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-action-button {
  width: min(42px, 100%) !important;
  height: 42px !important;
  inline-size: min(42px, 100%) !important;
  block-size: 42px !important;
  min-inline-size: 0 !important;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--theme-border-strong) 72%, transparent) !important;
  background: color-mix(in srgb, var(--theme-surface-card) 74%, transparent) !important;
  color: color-mix(in srgb, var(--theme-accent) 74%, var(--theme-text-primary)) !important;
  box-shadow: none !important;
}

.quick-action-button--primary {
  color: color-mix(in srgb, var(--theme-accent) 86%, var(--theme-text-primary)) !important;
}

.quick-action-button:hover:not(.v-btn--disabled) {
  border-color: color-mix(in srgb, var(--theme-accent) 48%, var(--theme-border-strong)) !important;
  background: color-mix(in srgb, var(--theme-accent) 11%, var(--theme-surface-card-soft)) !important;
  color: color-mix(in srgb, var(--theme-accent) 88%, var(--theme-text-primary)) !important;
}

.quick-upload-menu__item:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 28%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
}

.quick-action-glyph {
  display: block;
  width: 34px;
  height: 34px;
  pointer-events: none;
  user-select: none;
}

.quick-action-button--primary .quick-action-glyph {
  width: 35px;
  height: 35px;
}

.quick-action-glyph :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  color: currentColor;
  overflow: visible;
}

.quick-action-button.v-btn--disabled .quick-action-glyph {
  opacity: 0.34;
}

.quick-action-label {
  display: grid;
  min-width: 0;
  place-items: center;
  font-family: var(--theme-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1;
  color: currentColor;
}

.quick-action-label--wide {
  font-size: 12px;
  letter-spacing: 0.06em;
}

.quick-action-button.v-btn--disabled .quick-action-label {
  opacity: 0.4;
}

:deep(.quick-action-button .v-btn__content) {
  display: grid;
  height: 100%;
  width: 100%;
  place-items: center;
  padding: 0;
}

:deep(.sample-action-button .v-btn__content) {
  display: grid;
  width: 100%;
  min-width: 0;
  padding: 0;
}
</style>
