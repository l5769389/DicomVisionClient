<script setup lang="ts">
import { VBtn, VCard, VChip } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { ViewerTabItem } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

defineProps<{
  activeTabKey: string
  canScrollTabsLeft: boolean
  canScrollTabsRight: boolean
  viewerTabs: ViewerTabItem[]
}>()

const emit = defineEmits<{
  activateTab: [tabKey: string]
  closeTab: [tabKey: string]
  scrollTabs: [direction: 'left' | 'right']
  tabStripScroll: []
  tabStripWheel: [event: WheelEvent]
}>()

const tabStripRef = defineModel<HTMLElement | null>('tabStripRef', { required: true })
const { t } = useUiLocale()
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <VBtn
      variant="flat"
      class="theme-button-secondary inline-flex! h-9! w-9! min-w-0! shrink-0 items-center! justify-center! rounded-xl! border! transition"
      :class="canScrollTabsLeft ? 'hover:border-[var(--theme-border-strong)]' : 'cursor-default opacity-50'"
      :aria-label="t('scrollTabsLeft')"
      :disabled="!canScrollTabsLeft"
      @click="emit('scrollTabs', 'left')"
    >
      <AppIcon name="chevron-left" :size="18" />
    </VBtn>

    <div
      ref="tabStripRef"
      class="tab-strip-scroll flex min-w-0 flex-1 flex-nowrap snap-x snap-mandatory items-stretch gap-2 overflow-x-auto overflow-y-hidden pb-1 pr-1 [scrollbar-gutter:stable]"
      @scroll="emit('tabStripScroll')"
      @wheel="emit('tabStripWheel', $event)"
    >
      <VCard
        v-for="tab in viewerTabs"
        :key="tab.key"
        :data-tab-key="tab.key"
        class="group flex max-w-[288px] shrink-0 snap-start items-center gap-2 rounded-2xl! border! px-3! py-2! transition"
        :class="tab.key === activeTabKey ? 'theme-active-surface' : 'theme-card-soft border! text-[var(--theme-text-secondary)] hover:theme-hover-surface'"
      >
        <button type="button" class="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left" @click="emit('activateTab', tab.key)">
          <span class="truncate text-sm font-semibold">{{ tab.seriesTitle }}</span>
          <VChip
            size="x-small"
            variant="flat"
            class="tab-viewtype-chip min-w-[60px]! justify-center rounded-full! border! px-2.5! py-0.5! text-[11px]! font-semibold! uppercase! tracking-[0.14em]!"
            :class="tab.key === activeTabKey ? 'theme-active-pill' : 'border-[var(--theme-border-soft)]! bg-[var(--theme-surface-card)]! text-[var(--theme-text-secondary)]! group-hover:theme-hover-pill'"
          >
            {{ tab.viewType }}
          </VChip>
        </button>
        <VBtn variant="flat" class="theme-button-secondary inline-flex! h-8! w-8! min-w-0! shrink-0 items-center! justify-center! rounded-xl! border! transition hover:brightness-110" :aria-label="t('closeView')" @click.stop="emit('closeTab', tab.key)">
          <AppIcon name="close" :size="15" :stroke-width="2.1" />
        </VBtn>
      </VCard>
    </div>

    <VBtn
      variant="flat"
      class="theme-button-secondary inline-flex! h-9! w-9! min-w-0! shrink-0 items-center! justify-center! rounded-xl! border! transition"
      :class="canScrollTabsRight ? 'hover:border-[var(--theme-border-strong)]' : 'cursor-default opacity-50'"
      :aria-label="t('scrollTabsRight')"
      :disabled="!canScrollTabsRight"
      @click="emit('scrollTabs', 'right')"
    >
      <AppIcon name="chevron-right" :size="18" />
    </VBtn>
  </div>
</template>
