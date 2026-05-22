<script setup lang="ts">
import { computed } from 'vue'
import { VBtn, VCard } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import type { PacsPreference } from '../../composables/ui/useUiPreferences'

const props = defineProps<{
  pacsPreference: PacsPreference
}>()

const emit = defineEmits<{
  open: []
}>()

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const enabledProfiles = computed(() => props.pacsPreference.profiles.filter((profile) => profile.enabled))
const activeProfile = computed(() => (
  enabledProfiles.value.find((profile) => profile.id === props.pacsPreference.activeProfileId) ??
  enabledProfiles.value[0] ??
  null
))
</script>

<template>
  <VCard class="theme-shell-panel rounded-2xl! border! p-3! shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <div class="flex items-center gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_11%,transparent)] text-[var(--theme-accent)]">
        <AppIcon name="pacs" :size="20" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-[var(--theme-text-primary)]">PACS Browser</div>
        <div class="mt-0.5 truncate text-xs text-[var(--theme-text-secondary)]" :title="activeProfile ? `${activeProfile.name} · ${activeProfile.baseUrl}` : ''">
          {{ activeProfile ? activeProfile.name : (isZh ? '未启用 Profile' : 'No active profile') }}
        </div>
      </div>
      <VBtn
        variant="flat"
        class="theme-button-primary h-9! min-w-0! rounded-xl! border! px-3! text-xs! font-semibold!"
        :disabled="!activeProfile"
        :title="isZh ? '打开 PACS 查询' : 'Open PACS Browser'"
        @click="emit('open')"
      >
        {{ isZh ? '打开' : 'Open' }}
      </VBtn>
    </div>
  </VCard>
</template>
