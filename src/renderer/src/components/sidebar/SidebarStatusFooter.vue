<script setup lang="ts">
import { computed } from 'vue'
import { VBtn } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { ConnectionState } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

const props = defineProps<{
  connectionDotClass: string
  connectionIcon: string
  connectionState: ConnectionState
  connectionToneClass: string
}>()

const emit = defineEmits<{
  openMenu: []
  toggleSidebar: []
}>()

const { locale, t } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const connectionStateLabel = computed(() => {
  const labels: Record<ConnectionState, { zh: string; en: string }> = {
    idle: { zh: '待连接', en: 'Idle' },
    starting: { zh: '启动中', en: 'Starting' },
    connected: { zh: '已连接', en: 'Connected' },
    connecting: { zh: '连接中', en: 'Connecting' },
    reconnecting: { zh: '重连中', en: 'Reconnecting' },
    disconnected: { zh: '未连接', en: 'Disconnected' }
  }
  const label = labels[props.connectionState]
  return isZh.value ? label.zh : label.en
})
</script>

<template>
  <div class="theme-shell-panel mt-auto flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-3 py-2.5">
    <div class="min-w-0 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-2xl border" :class="connectionToneClass">
        <AppIcon :name="connectionIcon" :size="18" />
      </div>
      <div class="min-w-0">
        <div class="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">{{ t('connection') }}</div>
        <div class="flex min-w-0 items-center gap-2 text-xs text-[var(--theme-text-secondary)]">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="connectionDotClass"></span>
          <span class="truncate">{{ connectionStateLabel }}</span>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <VBtn variant="flat" class="theme-button-secondary h-11! w-11! min-w-0! rounded-2xl! border!" :aria-label="t('openSettings')" @click="emit('openMenu')">
        <AppIcon name="menu" :size="19" />
      </VBtn>
      <VBtn variant="flat" class="theme-button-secondary h-11! w-11! min-w-0! rounded-2xl! border!" :aria-label="t('collapseSidebar')" @click="emit('toggleSidebar')">
        <AppIcon name="chevron-left" :size="20" />
      </VBtn>
    </div>
  </div>
</template>
