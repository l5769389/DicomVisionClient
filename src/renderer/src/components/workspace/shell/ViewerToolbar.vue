<script setup lang="ts">
import { computed, ref } from 'vue'
import { VBtn, VCard, VMenu } from 'vuetify/components'
import AppIcon from '../../AppIcon.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool, StackToolOption } from './toolbarTypes'
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
const customLayoutHover = ref({ rows: 2, columns: 2 })
const customLayoutCells = computed(() =>
  Array.from({ length: 36 }, (_, index) => ({
    row: Math.floor(index / 6) + 1,
    column: (index % 6) + 1
  }))
)

function getLayoutOptionRows(option: StackToolOption): number {
  return Math.max(1, option.layoutRows ?? 1)
}

function getLayoutOptionColumns(option: StackToolOption): number {
  return Math.max(1, option.layoutColumns ?? 1)
}

function getLayoutIconCells(option: StackToolOption): number[] {
  return Array.from({ length: getLayoutOptionRows(option) * getLayoutOptionColumns(option) }, (_, index) => index)
}

function isCustomLayoutCellActive(row: number, column: number): boolean {
  return row <= customLayoutHover.value.rows && column <= customLayoutHover.value.columns
}

function setCustomLayoutHover(row: number, column: number): void {
  customLayoutHover.value = { rows: row, columns: column }
}

function createCustomLayoutOptionValue(row: number, column: number): string {
  return `layout:custom:${row}x${column}`
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
        :class="tool.key === 'play' ? (activeTab.viewType === 'Stack' && (isPlaying || isPlaybackPaused) ? 'rounded-xl border border-[var(--theme-border-strong)]' : '') : tool.options ? 'rounded-xl border border-[var(--theme-border-soft)]' : ''"
      >
        <template v-if="tool.key === 'play' && activeTab.viewType === 'Stack' && (isPlaying || isPlaybackPaused)">
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
            :disabled="areToolbarActionsDisabled && !(tool.key === 'play' && activeTab.viewType === 'Stack')"
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
                <div class="layout-menu-panel">
                  <div class="layout-preset-grid">
                    <button
                      v-for="option in tool.options"
                      :key="option.value"
                      type="button"
                      class="layout-preset-button"
                      :title="option.label"
                      @click="emit('selectToolOption', tool, option.value)"
                    >
                      <span
                        class="layout-preset-icon"
                        :style="{
                          gridTemplateColumns: `repeat(${getLayoutOptionColumns(option)}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${getLayoutOptionRows(option)}, minmax(0, 1fr))`
                        }"
                      >
                        <span
                          v-for="cell in getLayoutIconCells(option)"
                          :key="cell"
                          class="layout-preset-icon__cell"
                        />
                      </span>
                    </button>
                  </div>

                  <div class="layout-custom-grid" @mouseleave="setCustomLayoutHover(2, 2)">
                    <button
                      v-for="cell in customLayoutCells"
                      :key="`${cell.row}-${cell.column}`"
                      type="button"
                      class="layout-custom-cell"
                      :class="{ 'layout-custom-cell--active': isCustomLayoutCellActive(cell.row, cell.column) }"
                      :title="`${cell.row} x ${cell.column}`"
                      @mouseenter="setCustomLayoutHover(cell.row, cell.column)"
                      @focus="setCustomLayoutHover(cell.row, cell.column)"
                      @click="emit('selectToolOption', tool, createCustomLayoutOptionValue(cell.row, cell.column))"
                    />
                  </div>
                  <div class="layout-custom-label">{{ customLayoutHover.rows }} x {{ customLayoutHover.columns }}</div>
                </div>
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

.layout-menu-panel {
  display: grid;
  gap: 0;
}

.layout-preset-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px 20px;
  padding: 28px 34px 24px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
}

.layout-preset-button,
.layout-custom-cell {
  appearance: none;
  border: 0;
  font: inherit;
}

.layout-preset-button {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: color-mix(in srgb, var(--theme-text-secondary) 88%, var(--theme-text-primary));
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    transform 120ms ease;
}

.layout-preset-button:hover,
.layout-preset-button:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 36%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  color: var(--theme-text-primary);
  outline: none;
}

.layout-preset-button:active {
  transform: translateY(1px);
}

.layout-preset-icon {
  display: grid;
  width: 30px;
  height: 30px;
  gap: 2px;
}

.layout-preset-icon__cell {
  min-width: 0;
  min-height: 0;
  border: 2px solid currentColor;
  border-radius: 1px;
  opacity: 0.9;
}

.layout-custom-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 3px;
  padding: 8px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 76%, transparent);
}

.layout-custom-cell {
  aspect-ratio: 1 / 1;
  min-height: 40px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong) 78%, transparent);
  cursor: pointer;
  transition:
    background 90ms ease,
    border-color 90ms ease;
}

.layout-custom-cell--active {
  border-color: color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 36%, var(--theme-surface-card));
}

.layout-custom-cell:focus-visible {
  outline: none;
  box-shadow: var(--theme-focus-ring);
}

.layout-custom-label {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 74%, transparent);
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
</style>
