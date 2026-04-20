<script setup lang="ts">
import { VBtn, VCard, VMenu } from 'vuetify/components'
import AppIcon from '../../AppIcon.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool } from './toolbarTypes'

defineProps<{
  activeTab: ViewerTabItem
  activeTools: StackTool[]
  areToolbarActionsDisabled: boolean
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
</script>

<template>
  <VCard class="theme-shell-panel flex min-h-10 shrink-0 items-center justify-start overflow-visible rounded-2xl! border! px-3! py-2!">
    <div class="flex flex-1 flex-wrap items-center justify-start gap-2 overflow-visible">
      <div
        v-for="tool in activeTools"
        :key="tool.key"
        class="relative flex items-center overflow-visible"
        :class="tool.key === 'play' ? (activeTab.viewType === 'Stack' && (isPlaying || isPlaybackPaused) ? 'rounded-2xl border border-[var(--theme-border-strong)]' : '') : tool.options ? 'rounded-2xl border border-[var(--theme-border-soft)]' : ''"
      >
        <template v-if="tool.key === 'play' && activeTab.viewType === 'Stack' && (isPlaying || isPlaybackPaused)">
          <VBtn
            variant="flat"
            class="inline-flex! h-10! w-10! min-w-0! items-center! justify-center! rounded-l-2xl! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_84%,white_10%),var(--theme-accent-strong))]! text-[var(--theme-accent-contrast)]! shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition hover:brightness-110"
            :title="isPlaying ? '暂停播放' : '继续播放'"
            @click="emit('pausePlayback')"
          >
            <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="toolbarIconSize" />
          </VBtn>
          <VBtn
            variant="flat"
            class="inline-flex! h-10! w-10! min-w-0! items-center! justify-center! rounded-r-2xl! border-l! border-white/8! bg-[linear-gradient(180deg,rgba(174,67,67,0.94),rgba(135,38,38,0.94))]! text-[var(--theme-text-primary)]! transition hover:brightness-110"
            title="停止播放"
            @click="emit('endPlayback')"
          >
            <AppIcon name="stop" :size="toolbarIconSize" />
          </VBtn>
        </template>

        <template v-else>
          <VBtn
            variant="flat"
            type="button"
            class="theme-button-secondary inline-flex! h-10! w-10! min-w-0! items-center! justify-center! rounded-2xl! border! shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.14)] transition hover:brightness-110"
            :disabled="areToolbarActionsDisabled && tool.key !== 'play'"
            :active="isToolSelected(tool)"
            :class="{ 'toolbar-tool-button': true, 'rounded-r-none! border-r-0!': Boolean(tool.options), 'toolbar-tool-button--active': isToolSelected(tool) }"
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
            :close-on-content-click="true"
            @update:model-value="emit('setMenuOpen', $event ? tool.key : null)"
          >
            <template #activator="{ props: menuProps }">
              <VBtn
                v-bind="menuProps"
                variant="flat"
                class="theme-button-secondary inline-flex! h-10! w-7! min-w-0! items-center! justify-center! rounded-l-none! rounded-r-2xl! border-y! border-r! border-l! border-l-white/10! transition hover:brightness-110"
                :disabled="areToolbarActionsDisabled"
                :aria-expanded="openMenuKey === tool.key"
                :title="`${tool.label}选项`"
              >
                <AppIcon name="chevron-down" :size="toggleIconSize" :stroke-width="2.2" />
              </VBtn>
            </template>

            <div data-tool-menu-root class="theme-shell-panel inline-flex min-w-[180px] flex-col rounded-[22px] border p-2 shadow-[0_20px_44px_rgba(2,8,18,0.36)] backdrop-blur">
              <template
                v-for="(option, optionIndex) in tool.options"
                :key="option.value"
              >
                <div
                  v-if="option.group && option.group !== tool.options?.[optionIndex - 1]?.group"
                  class="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]"
                >
                  {{ option.group }}
                </div>
                <div
                  class="rounded-xl! px-3! py-2.5! text-left! text-sm! text-[var(--theme-text-secondary)]! transition hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)]!"
                  :class="{ 'bg-[color:color-mix(in_srgb,var(--theme-accent)_14%,transparent)]! text-[var(--theme-text-primary)]!': stackToolSelections[tool.key] === option.value }"
                  @click="emit('selectToolOption', tool, option.value)"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex min-w-0 items-center">
                    <PseudocolorBand
                      v-if="tool.key === 'pseudocolor'"
                      class="mr-[10px]"
                      :preset="option.swatchKey ?? 'bw'"
                    />
                    <AppIcon
                      v-else
                      class="mr-[10px]"
                      :name="option.icon"
                      :size="menuIconSize + 6"
                    />
                      <div class="min-w-0">
                        <div class="truncate whitespace-nowrap">{{ option.label }}</div>
                        <div v-if="option.description" class="mt-0.5 text-[11px] text-[var(--theme-text-muted)]">
                          {{ option.description }}
                        </div>
                      </div>
                    </div>
                    <span
                      v-if="option.badge"
                      class="shrink-0 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)]"
                    >
                      {{ option.badge }}
                    </span>
                  </div>
                </div>
              </template>
            </div>
          </VMenu>
        </template>
      </div>
    </div>
  </VCard>
</template>
