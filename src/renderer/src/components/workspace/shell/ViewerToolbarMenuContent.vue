<script setup lang="ts">
import AppIcon from '../../AppIcon.vue'
import LayoutMenuPanel from './LayoutMenuPanel.vue'
import MprLayoutMenuPanel from './MprLayoutMenuPanel.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool } from './toolbarTypes'

const props = defineProps<{
  activeTab: ViewerTabItem
  docked?: boolean
  menuIconSize: number
  stackToolSelections: Partial<Record<string, string>>
  tool: StackTool
}>()

const emit = defineEmits<{
  select: [optionValue: string]
}>()

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
  <div
    data-tool-menu-root
    class="viewer-toolbar-menu-content theme-shell-panel relative inline-flex flex-col overflow-hidden border border-[color:color-mix(in_srgb,var(--theme-border-strong)_74%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-surface-card)_92%,white_4%),color-mix(in_srgb,var(--theme-surface-panel-solid)_94%,black_6%))] shadow-[0_24px_52px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
    :class="[
      tool.key === 'play'
        ? 'viewer-toolbar-menu-content--playback min-w-[120px] rounded-[18px] p-1.5'
        : 'min-w-[220px] max-w-[320px] rounded-[20px] p-1.5',
      {
        'toolbar-layout-menu': tool.menuKind === 'layout',
        'toolbar-mpr-layout-menu': tool.menuKind === 'mprLayout',
        'toolbar-display-menu': tool.key === 'display',
        'viewer-toolbar-menu-content--docked': docked
      }
    ]"
  >
    <div v-if="tool.key !== 'play'" class="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />

    <template v-if="tool.key === 'play'">
      <button
        v-for="option in tool.options ?? []"
        :key="option.value"
        type="button"
        class="toolbar-menu-option group relative inline-flex items-center justify-between gap-2.5 overflow-hidden rounded-xl! border border-transparent px-2.5! py-1.5! text-left! text-[13px]! text-[var(--theme-text-secondary)]! transition duration-150 hover:border-[color:color-mix(in_srgb,var(--theme-accent)_20%,transparent)]! hover:bg-[color:color-mix(in_srgb,var(--theme-accent)_9%,transparent)]!"
        :class="{
          'toolbar-menu-option--active border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)]! bg-[linear-gradient(180deg,color-mix(in_srgb,var(--theme-accent)_16%,transparent),color-mix(in_srgb,var(--theme-accent)_10%,transparent))]! text-[var(--theme-text-primary)]! shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]!': stackToolSelections[tool.key] === option.value
        }"
        @click="emit('select', option.value)"
      >
        <div
          class="toolbar-menu-option__rail pointer-events-none absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[color:color-mix(in_srgb,var(--theme-accent)_80%,white_8%)] opacity-0 transition"
          :class="{ 'opacity-100': stackToolSelections[tool.key] === option.value }"
        />
        <span>{{ option.label }}</span>
        <AppIcon v-if="stackToolSelections[tool.key] === option.value" name="check" :size="14" />
      </button>
    </template>

    <template v-else-if="tool.menuKind === 'layout'">
      <LayoutMenuPanel
        :options="tool.options ?? []"
        :active-rows="getActiveLayoutRows(activeTab)"
        :active-columns="getActiveLayoutColumns(activeTab)"
        @select="emit('select', $event)"
      />
    </template>

    <template v-else-if="tool.menuKind === 'mprLayout'">
      <MprLayoutMenuPanel
        :options="tool.options ?? []"
        :active-value="stackToolSelections[tool.key]"
        @select="emit('select', $event)"
      />
    </template>

    <template v-else>
      <template
        v-for="(option, optionIndex) in tool.options ?? []"
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
          @click="emit('select', option.value)"
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
</template>

<style scoped>
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

.viewer-toolbar-menu-content--docked {
  width: 100% !important;
  min-width: 0 !important;
  max-width: none !important;
  border-radius: 14px !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 12px 26px rgba(0, 0, 0, 0.18) !important;
}
</style>
