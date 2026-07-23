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
  <div class="viewer-tab-strip-shell flex min-w-0 items-end" role="tablist" :aria-label="t('viewerWorkspace')">
    <VBtn
      v-if="shouldShowScrollControls"
      variant="flat"
      class="tab-scroll-button tab-scroll-button--left theme-button-secondary"
      :class="canScrollTabsLeft ? 'hover:border-[var(--theme-border-strong)]' : 'cursor-default opacity-50'"
      :aria-label="t('scrollTabsLeft')"
      :disabled="!canScrollTabsLeft"
      @click="emit('scrollTabs', 'left')"
    >
      <AppIcon name="chevron-left" :size="15" />
    </VBtn>

    <div
      ref="tabStripRef"
      class="tab-strip-scroll flex min-w-0 flex-1 flex-nowrap snap-x snap-mandatory items-end overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable]"
      :class="{
        'tab-strip-scroll--can-scroll-left': canScrollTabsLeft,
        'tab-strip-scroll--can-scroll-right': canScrollTabsRight
      }"
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
        class="viewer-tab-item group flex max-w-[250px] shrink-0 snap-start items-center transition"
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
      class="tab-scroll-button tab-scroll-button--right theme-button-secondary"
      :class="canScrollTabsRight ? 'hover:border-[var(--theme-border-strong)]' : 'cursor-default opacity-50'"
      :aria-label="t('scrollTabsRight')"
      :disabled="!canScrollTabsRight"
      @click="emit('scrollTabs', 'right')"
    >
      <AppIcon name="chevron-right" :size="15" />
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
            <AppIcon name="close-all" :size="15" />
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
  gap: 8px;
  padding: 4px calc(6px + var(--workspace-window-controls-reserve, 0px)) 0 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-strong) 34%, var(--theme-border-soft));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-panel-strong-solid) 72%, transparent), color-mix(in srgb, var(--theme-surface-panel-solid) 88%, transparent));
}

.viewer-tab-strip-shell::after {
  position: absolute;
  right: 8px;
  bottom: -1px;
  left: 8px;
  height: 1px;
  background: color-mix(in srgb, var(--theme-border-strong) 32%, var(--theme-border-soft));
  content: "";
  pointer-events: none;
}

.tab-strip-scroll {
  --tab-scroll-edge-left: transparent;
  --tab-scroll-edge-right: transparent;
  position: relative;
  min-height: 37px;
  gap: 3px;
  padding: 0 1px;
  background:
    linear-gradient(90deg, var(--tab-scroll-edge-left) 0%, color-mix(in srgb, var(--tab-scroll-edge-left) 76%, transparent) 44%, transparent 100%) left center / 34px 100% no-repeat,
    linear-gradient(270deg, var(--tab-scroll-edge-right) 0%, color-mix(in srgb, var(--tab-scroll-edge-right) 76%, transparent) 44%, transparent 100%) right center / 34px 100% no-repeat;
  isolation: isolate;
}

.tab-strip-scroll--can-scroll-left {
  --tab-scroll-edge-left: var(--theme-surface-panel-strong-solid);
}

.tab-strip-scroll--can-scroll-right {
  --tab-scroll-edge-right: var(--theme-surface-panel-strong-solid);
}

.tab-scroll-button {
  position: relative;
  z-index: 3;
  display: inline-grid !important;
  width: 30px !important;
  min-width: 30px !important;
  height: 30px !important;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 84%, transparent) !important;
  border-radius: 7px !important;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 76%, transparent) !important;
  color: var(--theme-text-secondary) !important;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 10%, transparent),
    0 5px 14px color-mix(in srgb, black 18%, transparent) !important;
}

.tab-scroll-button--left {
  margin-right: 1px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 10%, transparent),
    8px 0 16px color-mix(in srgb, black 18%, transparent) !important;
}

.tab-scroll-button--right {
  margin-left: 1px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 10%, transparent),
    -8px 0 16px color-mix(in srgb, black 18%, transparent) !important;
}

.tab-scroll-button:not(:disabled):hover {
  border-color: var(--theme-hover-border) !important;
  background: var(--theme-hover-surface) !important;
  color: var(--theme-text-primary) !important;
}

.tab-scroll-button:focus-visible {
  box-shadow: var(--theme-focus-ring) !important;
}

.tab-scroll-button:disabled {
  background: color-mix(in srgb, var(--theme-surface-card-soft) 48%, transparent) !important;
}

.viewer-tab-item {
  position: relative;
  min-width: 118px;
  min-height: 37px;
  margin-bottom: 0;
  border: 1px solid transparent;
  border-radius: 10px 10px 0 0;
  background: color-mix(in srgb, var(--theme-surface-card) 42%, transparent);
  padding: 0 10px 0 12px;
  gap: 8px;
  color: var(--theme-text-secondary);
  cursor: pointer;
  outline: none;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease,
    box-shadow 140ms ease;
}

@media (max-width: 1180px) {
  .viewer-tab-item {
    min-width: 106px;
    padding-right: 7px;
    padding-left: 9px;
    gap: 6px;
  }

  .viewer-tab-type {
    display: none;
  }
}

.viewer-tab-item::after {
  position: absolute;
  top: 9px;
  right: -3px;
  width: 1px;
  height: 19px;
  border-radius: 1px;
  background: color-mix(in srgb, var(--theme-border-soft) 84%, transparent);
  content: "";
  pointer-events: none;
}

.viewer-tab-item::before {
  position: absolute;
  top: 0;
  left: 50%;
  width: 28px;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: transparent;
  content: "";
  transform: translateX(-50%);
  pointer-events: none;
}

.viewer-tab-item--active {
  z-index: 2;
  border-color: color-mix(in srgb, var(--theme-border-strong) 72%, var(--theme-border-soft));
  border-bottom-color: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 96%, transparent);
  background: var(--theme-surface-card-elevated);
  color: var(--theme-text-primary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 -3px 10px rgba(0, 0, 0, 0.12);
}

.viewer-tab-item--active::before {
  background: color-mix(in srgb, var(--theme-accent) 72%, white 5%);
}

.viewer-tab-item--active::after {
  display: none;
}

.viewer-tab-item--inactive:hover {
  border-color: color-mix(in srgb, var(--theme-border-strong) 34%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  color: var(--theme-text-primary);
}

.viewer-tab-type {
  color: color-mix(in srgb, var(--theme-text-secondary) 76%, var(--theme-accent) 24%);
}

.viewer-tab-item--active .viewer-tab-type {
  color: color-mix(in srgb, var(--theme-accent) 76%, var(--theme-text-primary));
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
    color 120ms ease,
    opacity 120ms ease;
}

.viewer-tab-item--inactive .viewer-tab-close-inline {
  opacity: 0.52;
}

.viewer-tab-item--inactive:hover .viewer-tab-close-inline {
  opacity: 1;
}

.viewer-tab-close-inline:hover {
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  color: var(--theme-text-primary);
}

.viewer-tab-item:focus-visible,
.viewer-tab-close-inline:focus-visible {
  box-shadow: var(--theme-focus-ring);
}

:global(:root[data-theme="clinical-light"]) .viewer-tab-strip-shell {
  border-bottom-color: color-mix(in srgb, var(--theme-border-strong) 52%, #c9d7e3);
  background: linear-gradient(180deg, #edf3f8, #e4edf5);
}

:global(:root[data-theme="clinical-light"]) .viewer-tab-item {
  background: color-mix(in srgb, #dce7f0 76%, transparent);
  color: #526579;
}

:global(:root[data-theme="clinical-light"]) .viewer-tab-item--active {
  border-color: color-mix(in srgb, var(--theme-accent-strong) 22%, #c2d1dd);
  border-bottom-color: #f4f8fb;
  background: linear-gradient(180deg, #ffffff, #f4f8fb);
  color: #17283a;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 -3px 10px rgba(56, 84, 111, 0.08);
}

:global(:root[data-theme="industrial-utility"]) .viewer-tab-strip-shell {
  border-bottom-color: rgba(142, 157, 170, 0.16);
  background: linear-gradient(180deg, #11171c, #0d1318);
}

:global(:root[data-theme="industrial-utility"]) .viewer-tab-item {
  background: rgba(255, 255, 255, 0.018);
  color: rgba(220, 233, 240, 0.68);
}

:global(:root[data-theme="industrial-utility"]) .viewer-tab-item--active {
  border-color: rgba(142, 157, 170, 0.2);
  border-bottom-color: #1a2228;
  background: linear-gradient(180deg, #222c33, #1a2228);
  color: #eef6f9;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.045),
    0 -3px 9px rgba(0, 0, 0, 0.18);
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
