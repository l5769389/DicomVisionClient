<script setup lang="ts">
import { VBtn, VCard, VChip } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { ViewerTabItem } from '../../types/viewer'

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
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <VBtn
      variant="flat"
      class="inline-flex! h-9! w-9! min-w-0! shrink-0 items-center! justify-center! rounded-xl! border! border-white/8! bg-slate-900/88! text-slate-200! transition"
      :class="canScrollTabsLeft ? 'hover:border-sky-300/24 hover:text-white' : 'cursor-default border-white/6 bg-slate-900/46 text-slate-600'"
      aria-label="向左滚动标签页"
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
        class="group flex max-w-[320px] shrink-0 snap-start items-center gap-2 rounded-2xl! border! px-3! py-2! transition"
        :class="tab.key === activeTabKey ? 'border-sky-300/35! bg-[linear-gradient(180deg,rgba(22,121,199,0.92),rgba(10,89,159,0.94))]! text-white shadow-[0_12px_28px_rgba(8,89,156,0.26)]' : 'border-white/8! bg-slate-900/80! text-slate-300 hover:border-sky-300/18! hover:bg-slate-800/90!'"
      >
        <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="emit('activateTab', tab.key)">
          <span class="truncate text-sm font-semibold">{{ tab.seriesTitle }}</span>
          <VChip
            size="x-small"
            variant="flat"
            class="tab-viewtype-chip rounded-full! border! px-2! py-0.5! text-[11px]! font-semibold! uppercase! tracking-[0.14em]!"
            :class="tab.key === activeTabKey ? 'border-white/18! bg-white/12! text-white!' : 'border-slate-400/18! bg-white/6! text-slate-100!'"
          >
            {{ tab.viewType }}
          </VChip>
        </button>
        <VBtn variant="flat" class="inline-flex! h-8! w-8! min-w-0! shrink-0 items-center! justify-center! rounded-xl! bg-white/12! text-white! transition hover:bg-white/18!" aria-label="关闭视图" @click.stop="emit('closeTab', tab.key)">
          <AppIcon name="close" :size="15" :stroke-width="2.1" />
        </VBtn>
      </VCard>
    </div>

    <VBtn
      variant="flat"
      class="inline-flex! h-9! w-9! min-w-0! shrink-0 items-center! justify-center! rounded-xl! border! border-white/8! bg-slate-900/88! text-slate-200! transition"
      :class="canScrollTabsRight ? 'hover:border-sky-300/24 hover:text-white' : 'cursor-default border-white/6 bg-slate-900/46 text-slate-600'"
      aria-label="向右滚动标签页"
      :disabled="!canScrollTabsRight"
      @click="emit('scrollTabs', 'right')"
    >
      <AppIcon name="chevron-right" :size="18" />
    </VBtn>
  </div>
</template>
