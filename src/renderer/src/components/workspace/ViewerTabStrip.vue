<script setup lang="ts">
import { computed } from 'vue'
import { VBtn, VCard, VChip } from 'vuetify/components'
import AppIcon from '../AppIcon.vue'
import type { ViewerTabItem } from '../../types/viewer'
import { useUiLocale } from '../../composables/ui/useUiLocale'

const props = defineProps<{
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
const shouldShowScrollControls = computed(() => props.canScrollTabsLeft || props.canScrollTabsRight)
</script>

<template>
  <div class="flex min-w-0 items-center gap-1.5">
    <VBtn
      v-if="shouldShowScrollControls"
      variant="flat"
      class="tab-scroll-button theme-button-secondary inline-flex! h-8! w-8! min-w-0! shrink-0 items-center! justify-center! rounded-lg! border! transition"
      :class="canScrollTabsLeft ? 'hover:border-[var(--theme-border-strong)]' : 'cursor-default opacity-50'"
      :aria-label="t('scrollTabsLeft')"
      :disabled="!canScrollTabsLeft"
      @click="emit('scrollTabs', 'left')"
    >
      <AppIcon name="chevron-left" :size="16" />
    </VBtn>

    <div
      ref="tabStripRef"
      class="tab-strip-scroll flex min-w-0 flex-1 flex-nowrap snap-x snap-mandatory items-stretch gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5 pr-1 [scrollbar-gutter:stable]"
      @scroll="emit('tabStripScroll')"
      @wheel="emit('tabStripWheel', $event)"
    >
      <VCard
        v-for="tab in viewerTabs"
        :key="tab.key"
        :data-tab-key="tab.key"
        role="button"
        tabindex="0"
        class="viewer-tab-card group flex max-w-[260px] shrink-0 snap-start items-center gap-1.5 rounded-xl! border! px-2.5! py-1.5! transition"
        :class="tab.key === activeTabKey ? 'theme-active-surface' : 'theme-card-soft border! text-[var(--theme-text-secondary)] hover:theme-hover-surface'"
        @click="emit('activateTab', tab.key)"
        @keydown.enter.prevent="emit('activateTab', tab.key)"
        @keydown.space.prevent="emit('activateTab', tab.key)"
      >
        <button type="button" class="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 text-left" tabindex="-1">
          <span class="truncate text-[13px] font-semibold">{{ tab.seriesTitle }}</span>
          <VChip
            size="x-small"
            variant="flat"
            class="viewer-tab-chip tab-viewtype-chip min-w-[52px]! justify-center rounded-full! border! px-2! py-0.5! text-[10px]! font-semibold! uppercase! tracking-[0.12em]!"
            :class="tab.key === activeTabKey ? 'theme-active-pill' : 'border-[var(--theme-border-soft)]! bg-[var(--theme-surface-card)]! text-[var(--theme-text-secondary)]! group-hover:theme-hover-pill'"
          >
            {{ tab.viewType }}
          </VChip>
        </button>
        <VBtn variant="flat" class="viewer-tab-close theme-button-secondary inline-flex! h-7! w-7! min-w-0! shrink-0 items-center! justify-center! rounded-lg! border! transition hover:brightness-110" :aria-label="t('closeView')" @click.stop="emit('closeTab', tab.key)">
          <AppIcon name="close" :size="14" :stroke-width="2.1" />
        </VBtn>
      </VCard>
    </div>

    <VBtn
      v-if="shouldShowScrollControls"
      variant="flat"
      class="tab-scroll-button theme-button-secondary inline-flex! h-8! w-8! min-w-0! shrink-0 items-center! justify-center! rounded-lg! border! transition"
      :class="canScrollTabsRight ? 'hover:border-[var(--theme-border-strong)]' : 'cursor-default opacity-50'"
      :aria-label="t('scrollTabsRight')"
      :disabled="!canScrollTabsRight"
      @click="emit('scrollTabs', 'right')"
    >
      <AppIcon name="chevron-right" :size="16" />
    </VBtn>
  </div>
</template>
