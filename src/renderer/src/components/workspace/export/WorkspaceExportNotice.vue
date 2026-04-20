<script setup lang="ts">
import AppIcon from '../../AppIcon.vue'
import type { WorkspaceExportCopy } from '../../../composables/ui/uiMessages'
import type { WorkspaceExportNoticeState } from '../../../composables/workspace/export/useWorkspaceExportUi'

defineProps<{
  copy: WorkspaceExportCopy
  notice: WorkspaceExportNoticeState
}>()

const emit = defineEmits<{
  close: []
  openLocation: []
}>()
</script>

<template>
  <div
    class="absolute bottom-5 right-5 z-[80] w-[min(420px,calc(100%-40px))] rounded-[20px] border border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-surface-panel-strong)_94%,black)] p-4 shadow-[0_22px_44px_rgba(0,0,0,0.42)] backdrop-blur"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ notice.title }}</div>
        <div class="mt-1 break-all text-xs leading-6 text-[var(--theme-text-secondary)]">{{ notice.message }}</div>
      </div>
      <button
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-sm text-[var(--theme-text-secondary)] transition hover:text-[var(--theme-text-primary)]"
        :aria-label="copy.closeExportNotification"
        @click="emit('close')"
      >
        <AppIcon name="close" :size="14" />
      </button>
    </div>
    <div v-if="notice.canOpenLocation" class="mt-3 flex justify-end">
      <button
        type="button"
        class="theme-button-primary rounded-2xl px-4 py-2 text-xs font-semibold"
        @click="emit('openLocation')"
      >
        {{ copy.openFileLocation }}
      </button>
    </div>
  </div>
</template>
