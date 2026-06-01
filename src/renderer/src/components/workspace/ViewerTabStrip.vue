<script setup lang="ts">
import { computed, ref } from 'vue'
import { VBtn, VMenu } from 'vuetify/components'
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
  closeOtherTabs: [tabKey: string]
  scrollTabs: [direction: 'left' | 'right']
  tabStripScroll: []
  tabStripWheel: [event: WheelEvent]
}>()

const tabStripRef = defineModel<HTMLElement | null>('tabStripRef', { required: true })
const { locale, t } = useUiLocale()
const shouldShowScrollControls = computed(() => props.canScrollTabsLeft || props.canScrollTabsRight)
const isTabContextMenuOpen = ref(false)
const tabContextMenuPosition = ref({ x: 0, y: 0 })
const contextTabKey = ref('')
const isZh = computed(() => locale.value === 'zh-CN')
const contextTab = computed(() => props.viewerTabs.find((tab) => tab.key === contextTabKey.value) ?? null)
const canCloseOtherTabs = computed(() => props.viewerTabs.length > 1 && Boolean(contextTab.value))
const tabContextMenuAnchorStyle = computed(() => ({
  left: `${tabContextMenuPosition.value.x}px`,
  top: `${tabContextMenuPosition.value.y}px`
}))

function openTabContextMenu(event: MouseEvent, tabKey: string): void {
  event.preventDefault()
  event.stopPropagation()
  contextTabKey.value = tabKey
  tabContextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  isTabContextMenuOpen.value = true
}

function closeTabFromMenu(): void {
  const tabKey = contextTabKey.value
  isTabContextMenuOpen.value = false
  if (tabKey) {
    emit('closeTab', tabKey)
  }
}

function closeOtherTabsFromMenu(): void {
  const tabKey = contextTabKey.value
  if (!tabKey || !canCloseOtherTabs.value) {
    return
  }
  isTabContextMenuOpen.value = false
  emit('closeOtherTabs', tabKey)
}
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
        @contextmenu="openTabContextMenu($event, tab.key)"
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

    <div v-if="contextTab" class="fixed z-[2200] h-0 w-0" :style="tabContextMenuAnchorStyle">
      <VMenu
        v-model="isTabContextMenuOpen"
        activator="parent"
        content-class="viewer-tab-context-menu-overlay"
        location="bottom start"
        :offset="6"
        scroll-strategy="reposition"
        :close-on-content-click="true"
      >
        <div class="viewer-tab-context-menu" role="menu">
          <button type="button" class="viewer-tab-context-menu__item" role="menuitem" @click="closeTabFromMenu">
            <AppIcon name="close" :size="15" />
            <span>{{ isZh ? '关闭' : t('closeView') }}</span>
          </button>
          <button
            type="button"
            class="viewer-tab-context-menu__item"
            role="menuitem"
            :disabled="!canCloseOtherTabs"
            @click="closeOtherTabsFromMenu"
          >
            <AppIcon name="layout" :size="15" />
            <span>{{ isZh ? '关闭其他标签页' : 'Close Other Tabs' }}</span>
          </button>
        </div>
      </VMenu>
    </div>
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

:global(.viewer-tab-context-menu-overlay) {
  width: 188px !important;
  max-width: calc(100vw - 24px) !important;
}

.viewer-tab-context-menu {
  display: grid;
  gap: 3px;
  min-width: 188px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  border-radius: 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-panel-strong-solid) 94%, transparent), color-mix(in srgb, var(--theme-surface-panel-solid) 98%, transparent));
  padding: 5px;
  color: var(--theme-text-primary);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
  backdrop-filter: blur(16px);
}

.viewer-tab-context-menu__item {
  display: grid;
  min-height: 34px;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  padding: 0 9px;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease;
}

.viewer-tab-context-menu__item:hover:not(:disabled),
.viewer-tab-context-menu__item:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 30%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-card) 88%);
  color: var(--theme-text-primary);
  outline: none;
}

.viewer-tab-context-menu__item:disabled {
  color: var(--theme-text-muted);
  cursor: not-allowed;
  opacity: 0.58;
}
</style>
