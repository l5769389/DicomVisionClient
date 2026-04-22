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

            <div
              data-tool-menu-root
              class="theme-shell-panel relative inline-flex min-w-[220px] max-w-[320px] flex-col overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--theme-border-strong)_74%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card)_92%,white_4%),color-mix(in_srgb,var(--theme-surface-panel)_94%,black_6%))] p-2 shadow-[0_24px_52px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
            >
              <div class="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
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
                  class="group relative overflow-hidden rounded-2xl! border border-transparent px-3! py-2.5! text-left! text-sm! text-[var(--theme-text-secondary)]! transition duration-150 hover:border-[color:color-mix(in_srgb,var(--theme-accent)_20%,transparent)]! hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_9%,transparent)]!"
                  :class="{
                    'border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)]! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_16%,transparent),color-mix(in_srgb,var(--theme-accent)_10%,transparent))]! text-[var(--theme-text-primary)]! shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]!': stackToolSelections[tool.key] === option.value
                  }"
                  @click="emit('selectToolOption', tool, option.value)"
                >
                  <div
                    class="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-full bg-[color:color-mix(in_srgb,var(--theme-accent)_80%,white_8%)] opacity-0 transition"
                    :class="{ 'opacity-100': stackToolSelections[tool.key] === option.value }"
                  />
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-4">
                      <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-border-soft)_86%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card-soft)_92%,white_2%),color-mix(in_srgb,var(--theme-surface-panel)_92%,black_4%))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition group-hover:border-[color:color-mix(in_srgb,var(--theme-accent)_18%,transparent)]"
                        :class="{
                          'w-[54px] rounded-[18px]': tool.key === 'pseudocolor',
                          'border-[color:color-mix(in_srgb,var(--theme-accent)_26%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_14%,var(--theme-surface-card-soft)_86%),color-mix(in_srgb,var(--theme-accent)_10%,var(--theme-surface-panel)_90%))]': stackToolSelections[tool.key] === option.value
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
                      v-if="option.badge"
                      class="shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--theme-border-soft)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-card-soft)_94%,white_2%)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)]"
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
