<script setup lang="ts">
import { VBtn } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { ConnectionState } from '../../types/viewer'

defineProps<{
  connectionDotClass: string
  connectionIcon: string
  connectionState: ConnectionState
  connectionToneClass: string
}>()

const emit = defineEmits<{
  openMenu: []
  toggleSidebar: []
}>()
</script>

<template>
  <div class="mt-auto flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-sky-100/10 bg-[linear-gradient(180deg,rgba(8,17,31,0.92),rgba(7,14,27,0.98))] px-3 py-2.5">
    <div class="min-w-0 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-2xl border" :class="connectionToneClass"><AppIcon :name="connectionIcon" :size="18" /></div>
      <div class="min-w-0">
        <div class="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400/70">Connection</div>
        <div class="flex min-w-0 items-center gap-2 text-xs text-slate-200"><span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="connectionDotClass"></span><span class="truncate capitalize">{{ connectionState }}</span></div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <VBtn variant="flat" class="h-11! w-11! min-w-0! rounded-2xl! border! border-white/8! bg-white/6! text-slate-100!" aria-label="打开设置" @click="emit('openMenu')"><AppIcon name="menu" :size="19" /></VBtn>
      <VBtn variant="flat" class="h-11! w-11! min-w-0! rounded-2xl! border! border-white/8! bg-white/6! text-slate-100!" aria-label="收起侧栏" @click="emit('toggleSidebar')"><AppIcon name="chevron-left" :size="20" /></VBtn>
    </div>
  </div>
</template>
