<script setup lang="ts">
import { VBtn, VCard, VMenu } from 'vuetify/components'
import AppIcon from '../../AppIcon.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import ViewerToolbarMenuContent from './ViewerToolbarMenuContent.vue'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool } from './toolbarTypes'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

defineProps<{
  activeTab: ViewerTabItem
  activeTools: StackTool[]
  areToolbarActionsDisabled: boolean
  embedded?: boolean
  isTabStripCollapsed?: boolean
  isPlaying: boolean
  isPlaybackPaused: boolean
  isToolSelected: (tool: StackTool) => boolean
  openMenuKey: string | null
  showTabStripToggle?: boolean
  stackToolSelections: Partial<Record<string, string>>
  toolbarIconSize: number
  menuIconSize: number
  toggleIconSize: number
}>()

const emit = defineEmits<{
  applyTool: [tool: StackTool]
  endPlayback: []
  pausePlayback: []
  selectToolOption: [tool: StackTool, optionValue: string]
  setMenuOpen: [toolKey: string | null]
  toggleTabStrip: []
}>()

const { toolbarCopy: copy } = useUiLocale()

function supportsPlayback(viewType: ViewerTabItem['viewType']): boolean {
  return viewType === 'Stack' || viewType === 'Layout'
}

function hasSyncBesideLayout(viewType: ViewerTabItem['viewType']): boolean {
  return viewType === 'CompareStack' || viewType === 'Layout'
}

function getSelectedPlaybackFps(value: string | undefined): string {
  const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
  return match?.[1] ?? '5'
}
</script>

<template>
  <VCard
    class="viewer-toolbar-card flex min-h-9 w-full shrink-0 items-center justify-start overflow-visible rounded-xl!"
    :class="[
      embedded ? 'border-0! bg-transparent! p-0! shadow-none!' : 'viewer-toolbar-card--standalone border-0! px-2! py-1! shadow-none!',
      areToolbarActionsDisabled ? 'viewer-toolbar-card--locked' : ''
    ]"
  >
    <div class="viewer-toolbar-tools flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-1.5 overflow-x-auto overflow-y-visible">
      <div
        v-for="tool in activeTools"
        :key="tool.key"
        class="toolbar-tool-group relative flex items-center overflow-visible"
        :class="[
          tool.key === 'play'
            ? supportsPlayback(activeTab.viewType) && (isPlaying || isPlaybackPaused)
              ? 'toolbar-tool-group--compound rounded-xl'
              : ''
            : tool.options
              ? 'toolbar-tool-group--compound rounded-xl'
              : '',
          tool.key === 'layout' || tool.key === 'mprLayout'
            ? hasSyncBesideLayout(activeTab.viewType)
              ? 'toolbar-tool-group--layout-lead'
              : 'toolbar-tool-group--layout-anchor'
            : '',
          tool.key === 'compareSync' ? 'toolbar-tool-group--sync-anchor' : '',
          tool.key === 'tag' ? 'toolbar-tool-group--secondary-action' : ''
        ]"
      >
        <template v-if="tool.key === 'play' && supportsPlayback(activeTab.viewType) && (isPlaying || isPlaybackPaused)">
          <VBtn
            variant="flat"
            class="toolbar-playback-button toolbar-playback-button--pause inline-flex! h-9! w-9! min-w-0! items-center! justify-center! rounded-l-xl! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_84%,white_10%),var(--theme-accent-strong))]! text-[var(--theme-accent-contrast)]! shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition hover:brightness-110"
            :title="isPlaying ? copy.pausePlayback : copy.resumePlayback"
            @click="emit('pausePlayback')"
          >
            <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="toolbarIconSize" />
          </VBtn>
          <VMenu
            v-if="tool.options"
            :model-value="openMenuKey === tool.key"
            location="bottom end"
            :offset="8"
            scroll-strategy="reposition"
            :close-on-content-click="true"
            @update:model-value="emit('setMenuOpen', $event ? tool.key : null)"
          >
            <template #activator="{ props: menuProps }">
              <VBtn
                v-bind="menuProps"
                variant="flat"
                class="toolbar-playback-button toolbar-playback-fps-button inline-flex! h-9! min-w-0! items-center! justify-center! rounded-none! border-l! border-white/8! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_58%,var(--theme-surface-card)_42%),color-mix(in_srgb,var(--theme-accent-strong)_46%,var(--theme-surface-panel-solid)_54%))]! px-2.5! text-[var(--theme-accent-contrast)]! transition hover:brightness-110"
                :aria-expanded="openMenuKey === tool.key"
                :title="copy.toolOptions('FPS')"
              >
                <span class="toolbar-playback-fps-button__label">FPS</span>
                <span class="toolbar-playback-fps-button__value">{{ getSelectedPlaybackFps(stackToolSelections.play) }}</span>
                <AppIcon name="chevron-down" :size="toggleIconSize" :stroke-width="2.2" />
              </VBtn>
            </template>

            <ViewerToolbarMenuContent
              :active-tab="activeTab"
              :menu-icon-size="menuIconSize"
              :stack-tool-selections="stackToolSelections"
              :tool="tool"
              @select="emit('selectToolOption', tool, $event)"
            />
          </VMenu>
          <VBtn
            variant="flat"
            class="toolbar-playback-button toolbar-playback-button--stop inline-flex! h-9! w-9! min-w-0! items-center! justify-center! rounded-r-xl! border-l! border-white/8! bg-[linear-gradient(180deg,rgba(174,67,67,0.94),rgba(135,38,38,0.94))]! text-[var(--theme-text-primary)]! transition hover:brightness-110"
            :title="copy.stopPlayback"
            @click="emit('endPlayback')"
          >
            <AppIcon name="stop" :size="toolbarIconSize" />
          </VBtn>
        </template>

        <template v-else>
          <VBtn
            variant="flat"
            type="button"
            class="theme-button-secondary inline-flex! h-9! w-9! min-w-0! items-center! justify-center! rounded-xl! border! shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.14)] transition hover:brightness-110"
            :disabled="areToolbarActionsDisabled && !(tool.key === 'play' && supportsPlayback(activeTab.viewType))"
            :active="isToolSelected(tool) || openMenuKey === tool.key"
            :class="{ 'toolbar-tool-button': true, 'rounded-r-none! border-r-0!': Boolean(tool.options), 'toolbar-tool-button--active': isToolSelected(tool) || openMenuKey === tool.key }"
            :title="tool.label"
            @click.stop="emit('applyTool', tool)"
          >
            <PseudocolorBand
              v-if="tool.key === 'pseudocolor'"
              compact
              :preset="tool.options?.find((item) => item.value === stackToolSelections[tool.key])?.swatchKey ?? tool.swatchKey ?? 'bw'"
            />
            <AppIcon
              v-else
              :name="tool.options && tool.showSelectedOptionIcon !== false ? (tool.options.find((item) => item.value === stackToolSelections[tool.key])?.icon ?? tool.icon) : tool.icon"
              :size="toolbarIconSize"
            />
          </VBtn>

          <VMenu
            v-if="tool.options"
            :model-value="openMenuKey === tool.key"
            location="bottom end"
            :offset="8"
            scroll-strategy="reposition"
            :close-on-content-click="tool.key !== 'compareSync' && tool.key !== 'display' && tool.menuKind !== 'layout' && tool.menuKind !== 'mprLayout'"
            @update:model-value="emit('setMenuOpen', $event ? tool.key : null)"
          >
            <template #activator="{ props: menuProps }">
              <VBtn
                v-bind="menuProps"
                variant="flat"
                class="toolbar-tool-menu-button theme-button-secondary inline-flex! h-9! w-5! min-w-0! items-center! justify-center! rounded-l-none! rounded-r-xl! border-y! border-r! border-l! border-l-white/10! px-0! transition hover:brightness-110"
                :disabled="areToolbarActionsDisabled"
                :aria-expanded="openMenuKey === tool.key"
                :title="copy.toolOptions(tool.label)"
              >
                <AppIcon name="chevron-down" :size="Math.max(10, toggleIconSize - 1)" :stroke-width="2.2" />
              </VBtn>
            </template>

            <ViewerToolbarMenuContent
              :active-tab="activeTab"
              :menu-icon-size="menuIconSize"
              :stack-tool-selections="stackToolSelections"
              :tool="tool"
              @select="emit('selectToolOption', tool, $event)"
            />
          </VMenu>
        </template>
      </div>
    </div>
    <div
      v-if="showTabStripToggle"
      class="toolbar-tab-strip-toggle ml-2 flex h-9 shrink-0 items-center border-l border-[color:color-mix(in_srgb,var(--theme-border-strong)_58%,transparent)] pl-2"
    >
      <VBtn
        variant="flat"
        type="button"
        class="theme-button-secondary inline-flex! h-9! w-9! min-w-0! items-center! justify-center! rounded-xl! border! shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.14)] transition hover:brightness-110"
        :title="isTabStripCollapsed ? copy.showTabs : copy.hideTabs"
        :aria-label="isTabStripCollapsed ? copy.showTabs : copy.hideTabs"
        @click="emit('toggleTabStrip')"
      >
        <AppIcon :name="isTabStripCollapsed ? 'chevron-down' : 'chevron-up'" :size="toggleIconSize + 2" :stroke-width="2.3" />
      </VBtn>
    </div>
  </VCard>
</template>

<style scoped>
.viewer-toolbar-card {
  display: flex !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
}

.viewer-toolbar-tools {
  flex: 1 1 auto;
  max-width: 100%;
  min-width: 0;
  scrollbar-width: none;
}

.viewer-toolbar-tools::-webkit-scrollbar {
  display: none;
}

.toolbar-tool-group {
  flex: 0 0 auto;
}

.toolbar-tool-menu-button :deep(.v-btn__content) {
  min-width: 0;
}

.viewer-toolbar-card--standalone {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card-soft) 60%, transparent), color-mix(in srgb, var(--theme-surface-panel-strong-solid) 82%, transparent)) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.025),
    inset 0 -1px 0 rgba(0, 0, 0, 0.28) !important;
}

.toolbar-layout-menu {
  width: min(232px, calc(100vw - 32px));
  max-width: min(232px, calc(100vw - 32px)) !important;
  padding: 0 !important;
}

.toolbar-mpr-layout-menu {
  width: min(220px, calc(100vw - 32px));
  max-width: min(220px, calc(100vw - 32px)) !important;
  min-width: 0 !important;
  padding: 0 !important;
}

.toolbar-display-menu {
  width: min(224px, calc(100vw - 32px));
  min-width: 0 !important;
  max-width: min(224px, calc(100vw - 32px)) !important;
}

.toolbar-tool-group--layout-anchor {
  margin-right: 0.75rem;
}

.toolbar-tool-group--layout-lead {
  margin-right: 0;
}

.toolbar-tool-group--layout-anchor::after,
.toolbar-tool-group--sync-anchor::after {
  content: '';
  position: absolute;
  top: 0.35rem;
  right: -0.5rem;
  bottom: 0.35rem;
  width: 1px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-surface-panel-solid) 34%, transparent);
}

.toolbar-tool-group--sync-anchor {
  margin-right: 0.75rem;
}

.toolbar-tool-group--secondary-action {
  margin-left: 0.25rem;
}

.toolbar-tool-group--compound {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card) 48%, transparent), color-mix(in srgb, var(--theme-surface-panel-strong-solid) 68%, transparent));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.025),
    inset 0 -1px 0 rgba(0, 0, 0, 0.24);
}

.toolbar-playback-fps-button {
  gap: 0.28rem;
  letter-spacing: 0.04em;
}

.toolbar-playback-fps-button__label {
  font-size: 9px;
  font-weight: 800;
  opacity: 0.72;
}

.toolbar-playback-fps-button__value {
  min-width: 1.05rem;
  font-family: var(--theme-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}
</style>
