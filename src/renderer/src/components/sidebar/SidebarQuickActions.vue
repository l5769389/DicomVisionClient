<script setup lang="ts">
import { VBtn, VCard, VChip } from 'vuetify/components'
import type { ViewType } from '../../types/viewer'

defineProps<{
  hasSelectedSeries: boolean
}>()

const emit = defineEmits<{
  chooseFolder: []
  openView: [viewType: ViewType]
}>()
</script>

<template>
  <VCard class="rounded-2xl! border! border-white/8! bg-slate-900/55! p-4! shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <div class="mb-3 flex items-center justify-between">
      <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/60">Quick Actions</span>
      <VChip size="x-small" class="rounded-full! border! border-sky-200/10! bg-sky-300/8! px-2! py-1! text-[11px]! text-sky-100/70!" variant="flat">Ready</VChip>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <VBtn variant="flat" class="rounded-full! border! border-sky-200/20! bg-[linear-gradient(135deg,rgba(75,173,255,0.18),rgba(255,149,92,0.18))]! px-4! py-3! text-sm! font-semibold! text-slate-50! shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_24px_rgba(9,18,32,0.24)]" @click="emit('chooseFolder')">加载文件夹</VBtn>
      <VBtn variant="flat" class="rounded-full! border! border-white/8! bg-white/7! px-4! py-3! text-sm! font-semibold! text-slate-100!" :disabled="!hasSelectedSeries" @click="emit('openView', 'Stack')">快速浏览</VBtn>
      <VBtn variant="flat" class="rounded-full! border! border-white/8! bg-white/7! px-4! py-3! text-sm! font-semibold! text-slate-100!" :disabled="!hasSelectedSeries" @click="emit('openView', '3D')">3D</VBtn>
      <VBtn variant="flat" class="rounded-full! border! border-white/8! bg-white/7! px-4! py-3! text-sm! font-semibold! text-slate-100!" :disabled="!hasSelectedSeries" @click="emit('openView', 'MPR')">MPR</VBtn>
    </div>
  </VCard>
</template>
