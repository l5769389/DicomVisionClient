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
  <div class="sidebar-status-footer theme-shell-panel mt-auto flex items-center justify-between gap-2 border px-2.5 py-2">
    <div class="min-w-0 flex items-center gap-2.5">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg border" :class="connectionToneClass">
        <AppIcon :name="connectionIcon" :size="18" />
      </div>
      <div class="min-w-0">
        <div class="mb-0.5 text-[10px] font-semibold text-[var(--theme-text-muted)]">{{ t('connection') }}</div>
        <div class="flex min-w-0 items-center gap-2 text-xs text-[var(--theme-text-secondary)]">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="connectionDotClass"></span>
          <span class="truncate">{{ connectionStateLabel }}</span>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <VBtn variant="flat" class="theme-button-secondary h-9! w-9! min-w-0! rounded-lg! border!" :aria-label="t('openSettings')" @click="emit('openMenu')">
        <AppIcon name="menu" :size="19" />
      </VBtn>
      <VBtn variant="flat" class="theme-button-secondary h-9! w-9! min-w-0! rounded-lg! border!" :aria-label="t('collapseSidebar')" @click="emit('toggleSidebar')">
        <AppIcon name="chevron-left" :size="20" />
      </VBtn>
    </div>
  </div>
</template>

<style scoped>
.sidebar-status-footer {
  min-height: 52px;
  border-radius: 10px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 4%, transparent);
}
</style>
