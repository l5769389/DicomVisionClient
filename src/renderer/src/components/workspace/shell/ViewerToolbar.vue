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
  <VCard class="flex min-h-10 shrink-0 items-center justify-start overflow-visible rounded-2xl! border! border-white/8! bg-[linear-gradient(180deg,rgba(17,28,42,0.96),rgba(11,20,32,0.98))]! px-3! py-2!">
    <div class="flex flex-1 flex-wrap items-center justify-start gap-2 overflow-visible">
      <div
        v-for="tool in activeTools"
        :key="tool.key"
        class="relative flex items-center overflow-visible"
        :class="tool.key === 'play' ? (activeTab.viewType === 'Stack' && (isPlaying || isPlaybackPaused) ? 'rounded-2xl border border-sky-300/22' : '') : tool.options ? 'rounded-2xl border border-white/8' : ''"
      >
        <template v-if="tool.key === 'play' && activeTab.viewType === 'Stack' && (isPlaying || isPlaybackPaused)">
          <VBtn
            variant="flat"
            class="inline-flex! h-10! w-10! min-w-0! items-center! justify-center! rounded-l-2xl! bg-[linear-gradient(180deg,rgba(42,149,228,0.95),rgba(20,102,176,0.95))]! text-white! shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition hover:brightness-110"
            :title="isPlaying ? '暂停播放' : '继续播放'"
            @click="emit('pausePlayback')"
          >
            <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="toolbarIconSize" />
          </VBtn>
          <VBtn
            variant="flat"
            class="inline-flex! h-10! w-10! min-w-0! items-center! justify-center! rounded-r-2xl! border-l! border-white/8! bg-[linear-gradient(180deg,rgba(174,67,67,0.94),rgba(135,38,38,0.94))]! text-white! transition hover:brightness-110"
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
            class="inline-flex! h-10! w-10! min-w-0! items-center! justify-center! rounded-2xl! border! border-white/8! bg-[linear-gradient(180deg,rgba(54,67,82,0.92),rgba(37,47,59,0.94))]! text-slate-100! shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.14)] transition hover:brightness-110"
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
              :name="tool.options ? (tool.options.find((item) => item.value === stackToolSelections[tool.key])?.icon ?? tool.icon) : tool.icon"
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
                class="inline-flex! h-10! w-7! min-w-0! items-center! justify-center! rounded-l-none! rounded-r-2xl! border-y! border-r! border-white/8! border-l! border-l-white/10! bg-[linear-gradient(180deg,rgba(67,81,96,0.95),rgba(47,58,71,0.96))]! text-slate-100! transition hover:brightness-110"
                :disabled="areToolbarActionsDisabled"
                :aria-expanded="openMenuKey === tool.key"
                :title="`${tool.label}选项`"
              >
                <AppIcon name="chevron-down" :size="toggleIconSize" :stroke-width="2.2" />
              </VBtn>
            </template>

            <div data-tool-menu-root class="inline-flex min-w-[120px] flex-col rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,31,48,0.98),rgba(11,21,34,0.98))] p-2 shadow-[0_20px_44px_rgba(2,8,18,0.36)] backdrop-blur">
              <div
                v-for="option in tool.options"
                :key="option.value"
                class="rounded-xl! px-3! py-2.5! text-left! text-sm! text-slate-200! transition hover:bg-sky-300/10!"
                :class="{ 'bg-sky-300/14! text-white!': stackToolSelections[tool.key] === option.value }"
                @click="emit('selectToolOption', tool, option.value)"
              >
                <div class="flex w-fit items-center">
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
                  <span class="whitespace-nowrap">{{ option.label }}</span>
                </div>
              </div>
            </div>
          </VMenu>
        </template>
      </div>
    </div>
  </VCard>
</template>
