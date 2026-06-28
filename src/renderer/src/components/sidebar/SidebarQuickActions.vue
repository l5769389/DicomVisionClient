<script setup lang="ts">
import { computed } from 'vue'
import { VBtn, VCard, VMenu } from 'vuetify/components'
import type { FolderSeriesItem, ViewType } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import {
  isPrimaryTwoDimensionalViewSupported,
  isSeriesViewSupported,
  resolvePrimaryTwoDimensionalViewType
} from '../../composables/workspace/views/seriesViewSupport'
import type { WebUploadPickMode } from '../../platform/runtime'
import { canInstall as pwaCanInstall, isInstalled as pwaIsInstalled, promptInstall } from '../../platform/pwaInstall'
import { normalizeInlineSvg } from '../../utils/svg'
import AppIcon from '../AppIcon.vue'
import fileIcon from '../../assets/dicom-action-icons/dicom-file.svg?raw'

type QuickViewAction = {
  label: string
  title: string
  viewType: ViewType
  disabled: boolean
  wide?: boolean
}

type SourcePickerAction = {
  description: string
  icon: string
  label: string
  mode: WebUploadPickMode
}

const props = defineProps<{
  hasSelectedSeries: boolean
  isSelectedSeriesFourD: boolean
  selectedSeries: FolderSeriesItem | null
  viewerFolderSourceMode: 'desktop-picker' | 'web-upload' | 'server-sample'
  viewerPlatform: 'desktop' | 'web'
}>()

const emit = defineEmits<{
  chooseFolder: [mode?: WebUploadPickMode]
  openView: [viewType: ViewType]
}>()

const { locale, t } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')

const normalizedFileIcon = computed(() => normalizeInlineSvg(fileIcon))
const isServerSampleMode = computed(() => props.viewerFolderSourceMode === 'server-sample')
const installAppLabel = computed(() => (isZh.value ? '安装应用' : 'Install app'))
const shouldShowInstallAppAction = computed(() => (
  props.viewerPlatform === 'web' &&
  pwaCanInstall.value &&
  !pwaIsInstalled.value
))
const pickerActionLabel = computed(() => {
  if (props.viewerPlatform === 'web') {
    return t('uploadDicom')
  }
  return isZh.value ? '加载 DICOM' : 'Load DICOM'
})
const sourcePickerActions = computed<SourcePickerAction[]>(() => {
  if (props.viewerPlatform === 'web') {
    return [
      {
        description: t('uploadFilesHint'),
        icon: 'file-upload',
        label: t('uploadFiles'),
        mode: 'files'
      },
      {
        description: t('uploadFolderHint'),
        icon: 'folder-upload',
        label: t('uploadFolder'),
        mode: 'folder'
      }
    ]
  }

  return [
    {
      description: isZh.value ? '选择一个或多个 DICOM 文件。' : 'Choose one or more DICOM files.',
      icon: 'file-upload',
      label: isZh.value ? '加载文件' : 'Load Files',
      mode: 'files'
    },
    {
      description: isZh.value ? '选择一个或多个文件夹。' : 'Choose one or more folders.',
      icon: 'folder-upload',
      label: t('loadFolder'),
      mode: 'folder'
    }
  ]
})
const primaryTwoDimensionalViewType = computed(() => resolvePrimaryTwoDimensionalViewType(props.selectedSeries))

const folderActionLabel = computed(() => {
  if (props.viewerFolderSourceMode === 'server-sample') {
    return t('loadSample')
  }
  return props.viewerPlatform === 'web' ? t('uploadDicom') : t('loadFolder')
})

const quickViewActions = computed<QuickViewAction[]>(() => [
  {
    label: '2D',
    title: t('quickPreview'),
    viewType: primaryTwoDimensionalViewType.value,
    disabled: !props.hasSelectedSeries || !isPrimaryTwoDimensionalViewSupported(props.selectedSeries)
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
    title: isZh.value ? 'DICOM 标签' : 'DICOM Tags',
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

function handleUploadClick(mode: WebUploadPickMode): void {
  emit('chooseFolder', mode)
}

async function handleInstallAppClick(): Promise<void> {
  await promptInstall()
}

</script>

<template>
  <VCard class="quick-actions-card theme-shell-panel rounded-2xl! border! p-2.5! shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <VBtn
      v-if="isServerSampleMode"
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
        <span class="sample-action-button__title">{{ folderActionLabel }}</span>
      </span>
    </VBtn>

    <VBtn
      v-if="shouldShowInstallAppAction"
      variant="flat"
      class="install-action-button mb-2 w-full! min-w-0! rounded-2xl! border! px-3! py-0!"
      data-testid="quick-actions-install-app"
      :aria-label="installAppLabel"
      :title="installAppLabel"
      @click="handleInstallAppClick"
    >
      <span class="install-action-button__content">
        <span class="install-action-button__icon" aria-hidden="true">
          <AppIcon name="install-app" :size="17" />
        </span>
        <span class="install-action-button__title">{{ installAppLabel }}</span>
      </span>
    </VBtn>

    <div class="quick-action-icon-grid grid grid-cols-6 gap-1.5">
      <VMenu
        location="bottom start"
        :offset="8"
        :close-on-content-click="true"
      >
        <template #activator="{ props: menuProps }">
          <VBtn
            v-bind="menuProps"
            variant="flat"
            class="quick-action-button quick-action-button--primary theme-button-primary h-10! min-w-0! rounded-xl! border! p-0! shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_18px_rgba(9,18,32,0.18)]"
            :aria-label="pickerActionLabel"
            :title="pickerActionLabel"
          >
            <span class="quick-action-glyph" aria-hidden="true" v-html="normalizedFileIcon" />
          </VBtn>
        </template>

        <div class="source-picker-menu theme-shell-panel min-w-[220px] overflow-hidden rounded-2xl border p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.36)]">
          <button
            v-for="action in sourcePickerActions"
            :key="action.mode"
            type="button"
            class="source-picker-menu__item"
            @click="handleUploadClick(action.mode)"
          >
            <span class="source-picker-menu__icon" aria-hidden="true">
              <AppIcon :name="action.icon" :size="18" />
            </span>
            <span class="min-w-0">
              <span class="source-picker-menu__label">{{ action.label }}</span>
              <span class="source-picker-menu__description">{{ action.description }}</span>
            </span>
          </button>
        </div>
      </VMenu>
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
  border-color: color-mix(in srgb, var(--theme-accent) 42%, var(--theme-border-strong)) !important;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-card)), color-mix(in srgb, var(--theme-accent-warm) 8%, var(--theme-surface-card-soft))) !important;
  color: var(--theme-text-primary) !important;
  text-transform: none !important;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 10%, transparent),
    0 12px 24px color-mix(in srgb, var(--theme-accent) 12%, transparent) !important;
}

.sample-action-button:hover:not(.v-btn--disabled) {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong)) !important;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card)), color-mix(in srgb, var(--theme-accent-warm) 12%, var(--theme-surface-card-soft))) !important;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 12%, transparent),
    0 14px 28px color-mix(in srgb, var(--theme-accent) 16%, transparent) !important;
}

.sample-action-button__title {
  max-width: 100%;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sample-action-button__content {
  display: inline-grid;
  max-width: 100%;
  min-width: 0;
  grid-template-columns: 34px minmax(0, auto);
  align-items: center;
  gap: 12px;
}

.sample-action-button__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 36%, var(--theme-border-soft));
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card));
  color: color-mix(in srgb, var(--theme-accent) 78%, var(--theme-text-primary));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 10%, transparent);
}

.install-action-button {
  height: 42px !important;
  min-height: 42px !important;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--theme-accent) 32%, var(--theme-border-strong)) !important;
  background: color-mix(in srgb, var(--theme-accent) 10%, var(--theme-surface-card)) !important;
  color: var(--theme-text-primary) !important;
  text-transform: none !important;
}

.install-action-button:hover:not(.v-btn--disabled) {
  border-color: color-mix(in srgb, var(--theme-accent) 48%, var(--theme-border-strong)) !important;
  background: color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-card)) !important;
}

.install-action-button__content {
  display: inline-grid;
  max-width: 100%;
  min-width: 0;
  grid-template-columns: 28px minmax(0, auto);
  align-items: center;
  gap: 10px;
}

.install-action-button__icon {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 26%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-accent) 13%, transparent);
  color: var(--theme-accent);
}

.install-action-button__title {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0;
  line-height: 1;
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

.source-picker-menu {
  border-color: color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface-card) 94%, white 3%),
      color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 4%)
    );
  color: var(--theme-text-primary);
}

.source-picker-menu__item {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 9px 10px;
  text-align: left;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.source-picker-menu__item:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 24%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
}

.source-picker-menu__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 86%, transparent);
  color: color-mix(in srgb, var(--theme-accent) 78%, var(--theme-text-primary));
}

.source-picker-menu__label {
  display: block;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-picker-menu__description {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  place-items: center;
  padding: 0;
}
</style>
