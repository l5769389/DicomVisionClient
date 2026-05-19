<script setup lang="ts">
import { VBtn, VCard, VMenu } from 'vuetify/components'
import AppIcon from '../../AppIcon.vue'
import LayoutMenuPanel from './LayoutMenuPanel.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool } from './toolbarTypes'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

defineProps<{
  activeTab: ViewerTabItem
  activeTools: StackTool[]
  areToolbarActionsDisabled: boolean
  embedded?: boolean
  isPlaying: boolean
  isPlaybackPaused: boolean
  isToolSelected: (tool: StackTool) => boolean
  openMenuKey: string | null
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
</script>

<template>
  <VCard
    class="viewer-toolbar-card flex min-h-9 shrink-0 items-center justify-start overflow-visible rounded-xl!"
    :class="[
      embedded ? 'border-0! bg-transparent! p-0! shadow-none!' : 'theme-shell-panel border! px-2! py-1.5!',
      areToolbarActionsDisabled ? 'viewer-toolbar-card--locked' : ''
    ]"
  >
    <div class="flex flex-1 flex-wrap items-center justify-start gap-1.5 overflow-visible">
      <div
        v-for="tool in activeTools"
        :key="tool.key"
        class="toolbar-tool-group relative flex items-center overflow-visible"
        :class="[
          tool.key === 'play'
            ? supportsPlayback(activeTab.viewType) && (isPlaying || isPlaybackPaused)
              ? 'rounded-xl border border-[var(--theme-border-strong)]'
              : ''
            : tool.options
              ? 'rounded-xl border border-[var(--theme-border-soft)]'
              : '',
          tool.key === 'layout'
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
            :close-on-content-click="tool.key !== 'compareSync' && tool.menuKind !== 'layout'"
            @update:model-value="emit('setMenuOpen', $event ? tool.key : null)"
          >
            <template #activator="{ props: menuProps }">
              <VBtn
                v-bind="menuProps"
                variant="flat"
                class="toolbar-tool-menu-button theme-button-secondary inline-flex! h-9! w-6! min-w-0! items-center! justify-center! rounded-l-none! rounded-r-xl! border-y! border-r! border-l! border-l-white/10! transition hover:brightness-110"
                :disabled="areToolbarActionsDisabled"
                :aria-expanded="openMenuKey === tool.key"
                :title="copy.toolOptions(tool.label)"
              >
                <AppIcon name="chevron-down" :size="toggleIconSize" :stroke-width="2.2" />
              </VBtn>
            </template>

            <div
              data-tool-menu-root
              class="theme-shell-panel relative inline-flex min-w-[220px] max-w-[320px] flex-col overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--theme-border-strong)_74%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card)_92%,white_4%),color-mix(in_srgb,var(--theme-surface-panel)_94%,black_6%))] p-2 shadow-[0_24px_52px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
              :class="{ 'toolbar-layout-menu': tool.menuKind === 'layout' }"
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
              <template v-else>
                <template
                  v-for="(option, optionIndex) in tool.options"
                  :key="option.value"
                >
                  <div
                    v-if="option.group && option.group !== tool.options?.[optionIndex - 1]?.group"
                    class="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--theme-text-muted)_88%,white_10%)]"
                  >
                    {{ option.group }}
                  </div>
                  <div
                    class="toolbar-menu-option group relative overflow-hidden rounded-2xl! border border-transparent px-3! py-2.5! text-left! text-sm! text-[var(--theme-text-secondary)]! transition duration-150 hover:border-[color:color-mix(in_srgb,var(--theme-accent)_20%,transparent)]! hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_9%,transparent)]!"
                    :class="{
                      'toolbar-menu-option--active border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)]! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_16%,transparent),color-mix(in_srgb,var(--theme-accent)_10%,transparent))]! text-[var(--theme-text-primary)]! shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]!': stackToolSelections[tool.key] === option.value || option.checked
                    }"
                    @click="emit('selectToolOption', tool, option.value)"
                  >
                    <div
                      class="toolbar-menu-option__rail pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-full bg-[color:color-mix(in_srgb,var(--theme-accent)_80%,white_8%)] opacity-0 transition"
                      :class="{ 'opacity-100': stackToolSelections[tool.key] === option.value || option.checked }"
                    />
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex min-w-0 items-center gap-4">
                        <div
                          class="toolbar-menu-option__icon flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-border-soft)_86%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card-soft)_92%,white_2%),color-mix(in_srgb,var(--theme-surface-panel)_92%,black_4%))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition group-hover:border-[color:color-mix(in_srgb,var(--theme-accent)_18%,transparent)]"
                          :class="{
                            'w-[54px] rounded-[18px]': tool.key === 'pseudocolor',
                            'border-[color:color-mix(in_srgb,var(--theme-accent)_26%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_14%,var(--theme-surface-card-soft)_86%),color-mix(in_srgb,var(--theme-accent)_10%,var(--theme-surface-panel)_90%))]': stackToolSelections[tool.key] === option.value || option.checked
                          }"
                        >
                          <PseudocolorBand
                            v-if="tool.key === 'pseudocolor'"
                            compact
                            class="w-[42px] scale-[1.06]"
                            :preset="option.swatchKey ?? 'bw'"
                          />
                          <AppIcon
                            v-else
                            :name="option.icon"
                            :size="menuIconSize + 4"
                          />
                        </div>
                        <div class="min-w-0">
                          <div class="truncate whitespace-nowrap font-medium text-[var(--theme-text-primary)]">{{ option.label }}</div>
                          <div v-if="option.description" class="mt-0.5 text-[11px] leading-[1.35] text-[var(--theme-text-muted)]">
                            {{ option.description }}
                          </div>
                        </div>
                      </div>
                      <span
                        v-if="tool.key === 'compareSync'"
                        class="toolbar-menu-option__check grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[color:color-mix(in_srgb,var(--theme-border-soft)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card-soft)_92%,transparent)] text-[var(--theme-text-muted)]"
                        :class="{ 'border-[color:color-mix(in_srgb,var(--theme-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_16%,transparent)] text-[var(--theme-accent)]': option.checked }"
                      >
                        <AppIcon v-if="option.checked" name="check" :size="14" />
                      </span>
                      <span
                        v-if="option.badge"
                        class="toolbar-menu-option__badge shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--theme-border-soft)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card-soft)_94%,white_2%)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)]"
                      >
                        {{ option.badge }}
                      </span>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </VMenu>
        </template>
      </div>
    </div>
  </VCard>
</template>

<style scoped>
.toolbar-layout-menu {
  width: min(368px, calc(100vw - 32px));
  max-width: min(368px, calc(100vw - 32px)) !important;
  padding: 0 !important;
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
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-surface-panel) 34%, transparent);
}

.toolbar-tool-group--sync-anchor {
  margin-right: 0.75rem;
}

.toolbar-tool-group--secondary-action {
  margin-left: 0.25rem;
}
</style>
