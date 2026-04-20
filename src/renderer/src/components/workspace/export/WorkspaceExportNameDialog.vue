<script setup lang="ts">
import type { WorkspaceExportCopy } from '../../../composables/ui/uiMessages'
import type { ViewerExportFormat } from '../../../composables/workspace/export/viewExport'

defineProps<{
  copy: WorkspaceExportCopy
  error: string
  extension: string
  format: ViewerExportFormat
  inputRef: HTMLInputElement | null
  modelValue: string
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
  'update:inputRef': [value: HTMLInputElement | null]
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div
    class="absolute inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    :aria-label="copy.setExportName"
    @click.self="emit('cancel')"
  >
    <form
      class="w-[min(480px,100%)] rounded-[24px] border border-[color:color-mix(in_srgb,var(--theme-accent)_34%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-surface-panel-strong)_92%,#050914)] p-5 shadow-[0_28px_72px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.06)]"
      @submit.prevent="emit('confirm')"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-base font-semibold text-[var(--theme-text-primary)]">
            {{ copy.setExportName }}
          </div>
          <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">
            {{ copy.editNameHint }}
          </div>
        </div>
        <div class="shrink-0 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-1 text-xs font-semibold uppercase text-[var(--theme-text-secondary)]">
          {{ format === 'png' ? 'PNG' : 'DICOM' }}
        </div>
      </div>

      <label class="mt-5 block text-xs font-semibold text-[var(--theme-text-secondary)]" for="export-file-name-input">
        {{ copy.exportName }}
      </label>
      <div
        class="mt-2 flex min-w-0 overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_20%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-surface-card)_82%,#0f172a)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_28px_rgba(0,0,0,0.2)] transition focus-within:border-[var(--theme-accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-accent)_18%,transparent),inset_0_1px_0_rgba(255,255,255,0.07)]"
      >
        <input
          id="export-file-name-input"
          :ref="(element) => emit('update:inputRef', element as HTMLInputElement | null)"
          :value="modelValue"
          class="min-w-0 flex-1 bg-[color:color-mix(in_srgb,var(--theme-surface-card)_88%,#111827)] px-3 py-2.5 text-sm text-[var(--theme-text-primary)] outline-none"
          type="text"
          autocomplete="off"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keydown.esc.prevent="emit('cancel')"
        />
        <div class="flex shrink-0 items-center border-l border-[var(--theme-border-soft)] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,black)] px-3 text-sm font-semibold text-[var(--theme-text-secondary)]">
          .{{ extension }}
        </div>
      </div>
      <div v-if="error" class="mt-2 text-xs leading-5 text-rose-300">{{ error }}</div>
      <div class="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-2.5 text-xs font-semibold text-[var(--theme-text-secondary)] transition hover:text-[var(--theme-text-primary)]"
          @click="emit('cancel')"
        >
          {{ copy.cancel }}
        </button>
        <button type="submit" class="theme-button-primary rounded-2xl px-5 py-2.5 text-xs font-semibold">
          {{ copy.export }}
        </button>
      </div>
    </form>
  </div>
</template>
