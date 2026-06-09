<script setup lang="ts">
import { VBtn, VCard, VMenu } from 'vuetify/components'
import AppIcon from '../../AppIcon.vue'
import FusionPetDisplayTool from './FusionPetDisplayTool.vue'
import LayoutMenuPanel from './LayoutMenuPanel.vue'
import MprLayoutMenuPanel from './MprLayoutMenuPanel.vue'
import PseudocolorBand from './PseudocolorBand.vue'
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

function getActiveLayoutRows(activeTab: ViewerTabItem): number {
  if (activeTab.viewType === 'Layout') {
    return activeTab.layoutTemplate?.rows ?? 1
  }
  return 1
}

function getActiveLayoutColumns(activeTab: ViewerTabItem): number {
  if (activeTab.viewType === 'Layout') {
    return activeTab.layoutTemplate?.columns ?? 1
  }
  return 1
}

function getSelectedPlaybackFps(value: string | undefined): string {
  const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
  return match?.[1] ?? '5'
}

function shouldCloseToolMenuOnContentClick(tool: StackTool): boolean {
  if (tool.key === 'export' && tool.options?.some((option) => option.value.startsWith('exportTarget:'))) {
    return false
  }
  return tool.key !== 'compareSync' && tool.key !== 'display' && tool.menuKind !== 'layout' && tool.menuKind !== 'mprLayout'
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
        <FusionPetDisplayTool
          v-if="tool.inlineKind === 'fusionPetDisplay'"
          :active-tab="activeTab"
          :disabled="areToolbarActionsDisabled"
          @select="emit('selectToolOption', tool, $event)"
        />
        <div
          v-else-if="tool.inlineKind === 'fusionRegistration'"
          class="fusion-registration-tool"
          :class="{ 'fusion-registration-tool--disabled': areToolbarActionsDisabled }"
        >
          <VBtn
            variant="flat"
            type="button"
            class="fusion-registration-tool__button fusion-registration-tool__button--toggle inline-flex! h-9! w-9! min-w-0! items-center! justify-center! rounded-l-xl! rounded-r-none! border! border-r-0! transition hover:brightness-110"
            :active="activeTab.fusionManualRegistration === true"
            :class="{ 'fusion-registration-tool__button--active': activeTab.fusionManualRegistration === true }"
            :disabled="areToolbarActionsDisabled"
            :title="tool.label"
            @click.stop="emit('selectToolOption', tool, 'fusionRegistration:toggle')"
          >
            <AppIcon name="crosshair" :size="toolbarIconSize" />
          </VBtn>
          <VBtn
            variant="flat"
            type="button"
            class="fusion-registration-tool__button inline-flex! h-9! w-9! min-w-0! items-center! justify-center! rounded-none! border-y! border-r-0! transition hover:brightness-110"
            :disabled="areToolbarActionsDisabled"
            :title="copy.toolOptions('Reset Registration')"
            @click.stop="emit('selectToolOption', tool, 'fusionRegistration:reset')"
          >
            <AppIcon name="reset" :size="toolbarIconSize" />
          </VBtn>
          <VBtn
            variant="flat"
            type="button"
            class="fusion-registration-tool__button inline-flex! h-9! w-9! min-w-0! items-center! justify-center! rounded-l-none! rounded-r-xl! border! border-l-white/10! transition hover:brightness-110"
            :disabled="areToolbarActionsDisabled"
            :title="copy.toolOptions('Save Registration')"
            @click.stop="emit('selectToolOption', tool, 'fusionRegistration:save')"
          >
            <AppIcon name="save" :size="toolbarIconSize" />
          </VBtn>
        </div>
        <template v-else-if="tool.key === 'play' && supportsPlayback(activeTab.viewType) && (isPlaying || isPlaybackPaused)">
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

            <div
              data-tool-menu-root
              class="theme-shell-panel relative inline-flex min-w-[120px] flex-col overflow-hidden rounded-[18px] border border-[color:color-mix(in_srgb,var(--theme-border-strong)_74%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card)_92%,white_4%),color-mix(in_srgb,var(--theme-surface-panel-solid)_94%,black_6%))] p-1.5 shadow-[0_24px_52px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
            >
              <button
                v-for="option in tool.options"
                :key="option.value"
                type="button"
                class="toolbar-menu-option group relative inline-flex items-center justify-between gap-2.5 overflow-hidden rounded-xl! border border-transparent px-2.5! py-1.5! text-left! text-[13px]! text-[var(--theme-text-secondary)]! transition duration-150 hover:border-[color:color-mix(in_srgb,var(--theme-accent)_20%,transparent)]! hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_9%,transparent)]!"
                :class="{
                  'toolbar-menu-option--active border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)]! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_16%,transparent),color-mix(in_srgb,var(--theme-accent)_10%,transparent))]! text-[var(--theme-text-primary)]! shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]!': stackToolSelections[tool.key] === option.value
                }"
                @click="emit('selectToolOption', tool, option.value)"
              >
                <div
                  class="toolbar-menu-option__rail pointer-events-none absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[color:color-mix(in_srgb,var(--theme-accent)_80%,white_8%)] opacity-0 transition"
                  :class="{ 'opacity-100': stackToolSelections[tool.key] === option.value }"
                />
                <span>{{ option.label }}</span>
                <AppIcon v-if="stackToolSelections[tool.key] === option.value" name="check" :size="14" />
              </button>
            </div>
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
            :close-on-content-click="shouldCloseToolMenuOnContentClick(tool)"
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

            <div
              data-tool-menu-root
              class="theme-shell-panel relative inline-flex min-w-[220px] max-w-[320px] flex-col overflow-hidden rounded-[20px] border border-[color:color-mix(in_srgb,var(--theme-border-strong)_74%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card)_92%,white_4%),color-mix(in_srgb,var(--theme-surface-panel-solid)_94%,black_6%))] p-1.5 shadow-[0_24px_52px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
              :class="{ 'toolbar-layout-menu': tool.menuKind === 'layout', 'toolbar-mpr-layout-menu': tool.menuKind === 'mprLayout', 'toolbar-display-menu': tool.key === 'display' }"
            >
              <div class="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
              <template v-if="tool.menuKind === 'layout'">
                <LayoutMenuPanel
                  :options="tool.options ?? []"
                  :active-rows="getActiveLayoutRows(activeTab)"
                  :active-columns="getActiveLayoutColumns(activeTab)"
                  @select="emit('selectToolOption', tool, $event)"
                />
              </template>
              <template v-else-if="tool.menuKind === 'mprLayout'">
                <MprLayoutMenuPanel
                  :options="tool.options ?? []"
                  :active-value="stackToolSelections[tool.key]"
                  @select="emit('selectToolOption', tool, $event)"
                />
              </template>
              <template v-else>
                <template
                  v-for="(option, optionIndex) in tool.options"
                  :key="option.value"
                >
                  <div
                    v-if="option.group && option.group !== tool.options?.[optionIndex - 1]?.group"
                    class="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:color-mix(in_srgb,var(--theme-text-muted)_88%,white_10%)]"
                  >
                    {{ option.group }}
                  </div>
                  <button
                    type="button"
                    class="toolbar-menu-option group relative w-full appearance-none overflow-hidden rounded-xl! border border-transparent bg-transparent px-2.5! py-1.5! text-left! text-[13px]! text-[var(--theme-text-secondary)]! transition duration-150 hover:border-[color:color-mix(in_srgb,var(--theme-accent)_20%,transparent)]! hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_9%,transparent)]!"
                    :class="{
                      'toolbar-menu-option--active border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)]! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_16%,transparent),color-mix(in_srgb,var(--theme-accent)_10%,transparent))]! text-[var(--theme-text-primary)]! shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]!': stackToolSelections[tool.key] === option.value || option.checked
                    }"
                    @click="emit('selectToolOption', tool, option.value)"
                  >
                    <div
                      class="toolbar-menu-option__rail pointer-events-none absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[color:color-mix(in_srgb,var(--theme-accent)_80%,white_8%)] opacity-0 transition"
                      :class="{ 'opacity-100': stackToolSelections[tool.key] === option.value || option.checked }"
                    />
                    <div class="flex items-center justify-between gap-2.5">
                      <div class="flex min-w-0 items-center gap-3">
                        <div
                          class="toolbar-menu-option__icon flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[color:color-mix(in_srgb,var(--theme-border-soft)_86%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card-soft)_92%,white_2%),color-mix(in_srgb,var(--theme-surface-panel-solid)_92%,black_4%))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition group-hover:border-[color:color-mix(in_srgb,var(--theme-accent)_18%,transparent)]"
                          :class="{
                            'w-[46px] rounded-xl': tool.key === 'pseudocolor',
                            'border-[color:color-mix(in_srgb,var(--theme-accent)_26%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_14%,var(--theme-surface-card-soft)_86%),color-mix(in_srgb,var(--theme-accent)_10%,var(--theme-surface-panel-solid)_90%))]': stackToolSelections[tool.key] === option.value || option.checked
                          }"
                        >
                          <PseudocolorBand
                            v-if="tool.key === 'pseudocolor'"
                            compact
                            class="w-[36px] scale-[1.04]"
                            :preset="option.swatchKey ?? 'bw'"
                          />
                          <AppIcon
                            v-else
                            :name="option.icon"
                            :size="menuIconSize + 2"
                          />
                        </div>
                        <div :class="tool.key === 'display' ? 'min-w-[4.75rem]' : 'min-w-0'">
                          <div
                            class="whitespace-nowrap font-medium text-[var(--theme-text-primary)]"
                            :class="{ truncate: tool.key !== 'display' }"
                          >
                            {{ option.label }}
                          </div>
                          <div v-if="option.description" class="mt-0.5 text-[11px] leading-[1.2] text-[var(--theme-text-muted)]">
                            {{ option.description }}
                          </div>
                        </div>
                      </div>
                      <span
                        v-if="tool.key === 'compareSync' || tool.key === 'display'"
                        class="toolbar-menu-option__check grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:color-mix(in_srgb,var(--theme-border-soft)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card-soft)_92%,transparent)] text-[var(--theme-text-muted)]"
                        :class="{ 'border-[color:color-mix(in_srgb,var(--theme-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_16%,transparent)] text-[var(--theme-accent)]': option.checked }"
                      >
                        <AppIcon v-if="option.checked" name="check" :size="14" />
                      </span>
                      <span
                        v-if="option.badge"
                        class="toolbar-menu-option__badge shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--theme-border-soft)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card-soft)_94%,white_2%)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-text-muted)]"
                      >
                        {{ option.badge }}
                      </span>
                    </div>
                  </button>
                </template>
              </template>
            </div>
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

.fusion-registration-tool {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  border-radius: 0.75rem;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card) 48%, transparent), color-mix(in srgb, var(--theme-surface-panel-strong-solid) 68%, transparent));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.025),
    inset 0 -1px 0 rgba(0, 0, 0, 0.24);
}

.fusion-registration-tool--disabled {
  opacity: 0.62;
}

.fusion-registration-tool__button {
  border-color: color-mix(in srgb, var(--theme-border-soft) 82%, transparent) !important;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface-card-soft) 92%, white 2%),
      color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 4%)
    ) !important;
  color: var(--theme-text-primary) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

.fusion-registration-tool__button--active {
  border-color: color-mix(in srgb, var(--theme-accent) 50%, var(--theme-border-strong)) !important;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-accent) 26%, var(--theme-surface-card-soft) 74%),
      color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-panel-solid) 82%)
    ) !important;
  color: var(--theme-active-foreground) !important;
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
