<script setup lang="ts">
import { computed } from 'vue'
import { VBtn } from 'vuetify/components'
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
  <div class="viewer-tab-strip-shell flex min-w-0 items-end gap-1.5" role="tablist" :aria-label="t('viewerWorkspace')">
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
      class="tab-strip-scroll flex min-w-0 flex-1 flex-nowrap snap-x snap-mandatory items-end gap-1 overflow-x-auto overflow-y-hidden pr-1 [scrollbar-gutter:stable]"
      @scroll="emit('tabStripScroll')"
      @wheel="emit('tabStripWheel', $event)"
    >
      <div
        v-for="tab in viewerTabs"
        :key="tab.key"
        :data-tab-key="tab.key"
        role="tab"
        :aria-selected="tab.key === activeTabKey"
        tabindex="0"
        class="viewer-tab-item group flex max-w-[250px] shrink-0 snap-start items-center gap-2 px-3 py-1.5 transition"
        :class="tab.key === activeTabKey ? 'viewer-tab-item--active' : 'viewer-tab-item--inactive'"
        @click="emit('activateTab', tab.key)"
        @keydown.enter.prevent="emit('activateTab', tab.key)"
        @keydown.space.prevent="emit('activateTab', tab.key)"
      >
        <span class="viewer-tab-title min-w-0 flex-1 truncate text-[13px] font-semibold">{{ tab.seriesTitle }}</span>
        <span class="viewer-tab-type shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em]">{{ tab.viewType }}</span>
        <button type="button" class="viewer-tab-close-inline" :aria-label="t('closeView')" @click.stop="emit('closeTab', tab.key)" @keydown.stop>
          <AppIcon name="close" :size="14" :stroke-width="2.1" />
        </button>
      </div>
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

<style scoped>
.viewer-tab-strip-shell {
  position: relative;
  min-height: 42px;
  padding: 3px 6px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-panel-strong-solid) 66%, transparent), transparent 82%),
    color-mix(in srgb, var(--theme-surface-panel-solid) 68%, transparent);
}

.viewer-tab-strip-shell::after {
  position: absolute;
  right: 6px;
  bottom: -1px;
  left: 6px;
  height: 1px;
  background: color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  content: "";
  pointer-events: none;
}

.tab-strip-scroll {
  min-height: 38px;
}

.viewer-tab-item {
  position: relative;
  min-width: 112px;
  min-height: 36px;
  margin-bottom: 0;
  border: 1px solid transparent;
  border-bottom-color: transparent;
  border-radius: 10px 10px 0 0;
  background: transparent;
  color: var(--theme-text-secondary);
  cursor: pointer;
  outline: none;
}

.viewer-tab-item::after {
  position: absolute;
  top: 0;
  right: 12px;
  left: 12px;
  height: 3px;
  border-radius: 0 0 999px 999px;
  background: transparent;
  content: "";
}

.viewer-tab-item--active {
  z-index: 1;
  margin-bottom: -1px;
  border-color: color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-top-color: color-mix(in srgb, var(--theme-accent) 54%, var(--theme-border-soft));
  border-bottom-color: color-mix(in srgb, var(--theme-surface-panel-solid) 96%, black 4%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 11%, var(--theme-surface-card) 89%), color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 6%));
  color: var(--theme-text-primary);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.035),
    0 -1px 0 color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

.viewer-tab-item--active::after {
  background: color-mix(in srgb, var(--theme-accent) 82%, white 6%);
}

.viewer-tab-item--inactive:hover {
  border-color: color-mix(in srgb, var(--theme-border-soft) 48%, transparent);
  border-bottom-color: transparent;
  background: color-mix(in srgb, var(--theme-accent) 5%, var(--theme-surface-panel-strong));
  color: var(--theme-text-primary);
}

.viewer-tab-type {
  color: color-mix(in srgb, var(--theme-text-secondary) 76%, var(--theme-accent) 24%);
}

.viewer-tab-item--active .viewer-tab-type {
  color: var(--theme-accent);
}

.viewer-tab-close-inline {
  display: inline-grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--theme-text-muted);
  cursor: pointer;
  transition:
    background 120ms ease,
    color 120ms ease;
}

.viewer-tab-close-inline:hover {
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  color: var(--theme-text-primary);
}

.viewer-tab-item:focus-visible,
.viewer-tab-close-inline:focus-visible {
  box-shadow: var(--theme-focus-ring);
}
</style>
