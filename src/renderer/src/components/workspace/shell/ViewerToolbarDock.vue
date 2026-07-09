<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool, StackToolOption, StackToolOptionSelectBehavior } from './toolbarTypes'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import ViewerToolbarDockPanelContent from './ViewerToolbarDockPanelContent.vue'

const props = defineProps<{
  activeTab: ViewerTabItem
  activeTools: StackTool[]
  areToolbarActionsDisabled: boolean
  isPlaying: boolean
  isPlaybackPaused: boolean
  isToolSelected: (tool: StackTool) => boolean
  menuIconSize: number
  openMenuKey: string | null
  resultPanelIcon?: string
  resultPanelOpen?: boolean
  resultPanelTitle?: string
  resultPanelToolKey?: string | null
  width?: number
  collapsed?: boolean
  stackToolSelections: Partial<Record<string, string>>
  toolbarIconSize: number
  utilityPanelIcon?: string
  utilityPanelOpen?: boolean
  utilityPanelTitle?: string
  utilityPanelToolKey?: string | null
}>()

const emit = defineEmits<{
  applyTool: [tool: StackTool, behavior?: StackToolOptionSelectBehavior]
  endPlayback: [behavior?: StackToolOptionSelectBehavior]
  pausePlayback: [behavior?: StackToolOptionSelectBehavior]
  closeUtilityPanel: []
  closeResultPanel: []
  dockResize: []
  collapseChange: [collapsed: boolean]
  openSettings: [sectionKey?: string]
  selectToolOption: [tool: StackTool, optionValue: string, behavior?: StackToolOptionSelectBehavior]
  setMenuOpen: [toolKey: string | null]
}>()

const { locale, toolbarCopy: copy } = useUiLocale()
const isDockCollapsed = ref(props.collapsed ?? false)
const lastActivatedToolKey = ref<string | null>(null)
const lastDetaillessToolKey = ref<string | null>(null)
const utilityDetailToolKeys = new Set(['mprMip', 'volumeParams', 'surfaceParams', 'segmentation'])
const actionDetailToolKeys = new Set(['annotate'])
const unselectedActionMenuToolKeys = new Set(['rotate', 'export', 'reset'])
const autoApplyOptionToolKeys = new Set(['measure', 'qa'])
const modeOptionPanelToolKeys = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'measure', 'qa', 'annotate'])

function getDockToolOptions(tool: StackTool): StackToolOption[] {
  return tool.options ?? tool.dockOptions ?? []
}

function hasDockToolOptions(tool: StackTool): boolean {
  return getDockToolOptions(tool).length > 0
}

function getDockPanelTool(tool: StackTool): StackTool {
  return tool.options?.length ? tool : { ...tool, options: getDockToolOptions(tool) }
}

const currentMenuTool = computed(() => {
  const tool = props.activeTools.find((item) => item.key === props.openMenuKey && hasDockToolOptions(item))
  return tool ? getDockPanelTool(tool) : undefined
})
const lastActivatedTool = computed(() => props.activeTools.find((tool) => tool.key === lastActivatedToolKey.value) ?? null)
const lastDetaillessTool = computed(() => props.activeTools.find((tool) => tool.key === lastDetaillessToolKey.value) ?? null)
const selectedOperationTool = computed(() => props.activeTools.find((tool) => props.isToolSelected(tool)) ?? null)
const activePanelTool = computed(() => {
  if (currentMenuTool.value) {
    return currentMenuTool.value
  }
  if (props.utilityPanelOpen === true) {
    return undefined
  }
  const fallbackTool = [lastActivatedTool.value, selectedOperationTool.value].find((tool) => tool && hasDockToolOptions(tool))
  return fallbackTool ? getDockPanelTool(fallbackTool) : undefined
})
const shouldEmbedResultInActiveTool = computed(() => {
  const panelToolKey = activePanelTool.value?.key
  return props.resultPanelOpen === true && Boolean(panelToolKey) && panelToolKey === props.resultPanelToolKey
})
const shouldShowUtilityPanel = computed(() =>
  props.utilityPanelOpen === true && (!activePanelTool.value || activePanelTool.value.key === props.utilityPanelToolKey)
)
const shouldShowStandaloneResultPanel = computed(() =>
  props.resultPanelOpen === true &&
  !shouldEmbedResultInActiveTool.value &&
  !shouldShowUtilityPanel.value &&
  !activePanelTool.value
)
const isPanelActive = computed(() => Boolean(shouldShowStandaloneResultPanel.value || shouldShowUtilityPanel.value || activePanelTool.value))
const activeDockToolKey = computed(
  () =>
    (shouldShowUtilityPanel.value ? props.utilityPanelToolKey : null) ??
    activePanelTool.value?.key ??
    (shouldShowStandaloneResultPanel.value ? props.resultPanelToolKey : null) ??
    lastActivatedTool.value?.key ??
    selectedOperationTool.value?.key ??
    props.openMenuKey ??
    null
)
const activeDisplayTool = computed(
  () =>
    activePanelTool.value ??
    lastDetaillessTool.value ??
    selectedOperationTool.value ??
    props.activeTools.find((tool) => tool.key === props.openMenuKey) ??
    props.activeTools[0] ??
    null
)
const activePanelLabel = computed(() => activeDisplayTool.value?.label ?? props.activeTab.title)
const activePanelDescription = computed(() => copy.value.dockNoDetails)
const dockCollapseTitle = computed(() => copy.value.dockCollapse)
const dockExpandTitle = computed(() => copy.value.dockExpand)
const isZh = computed(() => locale.value === 'zh-CN')
const annotationActionCopy = computed(() => ({
  clearAnnotations: isZh.value ? '清除标注' : 'Clear Annotations',
  clearAnnotationsDesc: isZh.value ? '移除当前目标视图中的标注结果。' : 'Remove annotations from the current target view.'
}))

function supportsPlayback(viewType: ViewerTabItem['viewType']): boolean {
  return viewType === 'Stack' || viewType === 'Layout' || viewType === 'MPR' || viewType === '4D'
}

function isToolDisabled(tool: StackTool): boolean {
  return props.areToolbarActionsDisabled && !(tool.key === 'play' && supportsPlayback(props.activeTab.viewType) && (props.isPlaying || props.isPlaybackPaused))
}

function isDockToolActive(tool: StackTool): boolean {
  return tool.pressed === true || activeDockToolKey.value === tool.key
}

function canShowSelectedOptionOnDockButton(tool: StackTool): boolean {
  return hasDockToolOptions(tool) && tool.showSelectedOptionIcon !== false && !unselectedActionMenuToolKeys.has(tool.key)
}

function shouldExpandDockForTool(tool: StackTool): boolean {
  return hasDockToolOptions(tool) || utilityDetailToolKeys.has(tool.key) || actionDetailToolKeys.has(tool.key)
}

function getSelectedToolOptionValue(tool: StackTool): string | null {
  return props.stackToolSelections[tool.key] ?? getDockToolOptions(tool).find((option) => !option.disabled)?.value ?? null
}

function clearActiveAnnotations(): void {
  const tool = activeDisplayTool.value
  if (!tool || tool.key !== 'annotate') {
    return
  }
  emit('selectToolOption', tool, 'reset:annotations', { keepMenuOpen: true })
}

function expandDockForDetailTool(): void {
  if (!isDockCollapsed.value) {
    return
  }
  isDockCollapsed.value = false
  emit('collapseChange', false)
  emit('dockResize')
}

function shouldCloseResultForTool(tool: StackTool): boolean {
  return !(tool.key === 'qa' && props.resultPanelIcon === 'water-phantom')
}

function handleToolClick(tool: StackTool): void {
  if (isToolDisabled(tool)) {
    return
  }
  if (shouldCloseResultForTool(tool)) {
    emit('closeResultPanel')
  }
  lastActivatedToolKey.value = tool.key
  if (hasDockToolOptions(tool)) {
    expandDockForDetailTool()
    const isCurrentUtilityTool = props.utilityPanelOpen && props.utilityPanelToolKey === tool.key
    if (!isCurrentUtilityTool) {
      emit('closeUtilityPanel')
    }
    if (props.openMenuKey !== tool.key) {
      emit('setMenuOpen', tool.key)
    }

    if (tool.key === 'segmentation') {
      if (!isCurrentUtilityTool) {
        const optionValue = getSelectedToolOptionValue(tool) ?? 'segmentation:threshold'
        emit('selectToolOption', tool, optionValue, { keepMenuOpen: true })
      }
      return
    }

    if (tool.key === 'window') {
      emit('applyTool', tool, { keepMenuOpen: true })
      return
    }

    if (autoApplyOptionToolKeys.has(tool.key)) {
      const optionValue = getSelectedToolOptionValue(tool)
      if (optionValue) {
        emit('selectToolOption', tool, optionValue, { keepMenuOpen: true })
        return
      }
    }
    if (modeOptionPanelToolKeys.has(tool.key)) {
      emit('applyTool', tool, { keepMenuOpen: true })
    }
    return
  }
  lastDetaillessToolKey.value = tool.key
  emit('setMenuOpen', null)
  emit('closeUtilityPanel')
  if (shouldExpandDockForTool(tool)) {
    expandDockForDetailTool()
  }
  emit('applyTool', tool)
}

function toggleDockCollapsed(): void {
  isDockCollapsed.value = !isDockCollapsed.value
  emit('collapseChange', isDockCollapsed.value)
  emit('dockResize')
}

watch(
  () => props.collapsed,
  (value) => {
    if (typeof value === 'boolean') {
      isDockCollapsed.value = value
    }
  }
)

watch(
  () => props.activeTab.key,
  () => {
    lastActivatedToolKey.value = null
    lastDetaillessToolKey.value = null
  }
)
</script>

<template>
  <aside
    class="viewer-toolbar-dock"
    :class="{ 'viewer-toolbar-dock--collapsed': isDockCollapsed }"
    :style="{ '--viewer-toolbar-dock-width': `${width ?? 224}px` }"
    data-tool-menu-root
  >
    <div class="viewer-toolbar-dock__body">
      <div class="viewer-toolbar-dock__tools-region">
        <div class="viewer-toolbar-dock__tools">
          <div
            v-for="tool in activeTools"
            :key="tool.key"
            class="viewer-toolbar-dock__tool-group"
            :class="{
              'viewer-toolbar-dock__tool-group--compound': hasDockToolOptions(tool),
              'viewer-toolbar-dock__tool-group--active': isDockToolActive(tool)
            }"
          >
            <button
              type="button"
              class="viewer-toolbar-dock__button"
              :class="{
                'viewer-toolbar-dock__button--active': isDockToolActive(tool),
                'viewer-toolbar-dock__button--options': hasDockToolOptions(tool),
                'viewer-toolbar-dock__button--accent': tool.key === 'play' && (isPlaying || isPlaybackPaused)
              }"
              :disabled="isToolDisabled(tool)"
              :aria-expanded="hasDockToolOptions(tool) ? activePanelTool?.key === tool.key : undefined"
              :aria-pressed="tool.pressed"
              :title="tool.title ?? (hasDockToolOptions(tool) ? copy.toolOptions(tool.label) : tool.label)"
              @click.stop="handleToolClick(tool)"
            >
              <PseudocolorBand
                v-if="tool.key === 'pseudocolor'"
                compact
                :preset="canShowSelectedOptionOnDockButton(tool) ? (tool.options?.find((item) => item.value === stackToolSelections[tool.key])?.swatchKey ?? tool.swatchKey ?? 'bw') : (tool.swatchKey ?? 'bw')"
              />
              <AppIcon
                v-else
                :name="canShowSelectedOptionOnDockButton(tool) ? (tool.options?.find((item) => item.value === stackToolSelections[tool.key])?.icon ?? tool.icon) : tool.icon"
                :size="toolbarIconSize"
              />
            </button>
          </div>
        </div>
      </div>

      <div v-if="!isDockCollapsed && $slots.status" class="viewer-toolbar-dock__status">
        <slot name="status" />
      </div>

      <div
        v-if="!isDockCollapsed"
        class="viewer-toolbar-dock__panel"
        :class="{ 'viewer-toolbar-dock__panel--empty': !isPanelActive }"
      >
        <Transition name="viewer-toolbar-dock-panel" mode="out-in">
          <div
            v-if="shouldShowStandaloneResultPanel"
            :key="`result:${resultPanelToolKey ?? resultPanelTitle ?? 'panel'}`"
            class="viewer-toolbar-dock__panel-content-shell"
          >
            <div class="viewer-toolbar-dock__panel-header">
              <div class="viewer-toolbar-dock__panel-title">
                <AppIcon :name="resultPanelIcon ?? 'info'" :size="16" />
                <span>{{ resultPanelTitle }}</span>
              </div>
            </div>

            <div class="viewer-toolbar-dock__result-panel">
              <slot name="result" />
            </div>
          </div>
          <div
            v-else-if="shouldShowUtilityPanel"
            :key="`utility:${utilityPanelToolKey ?? utilityPanelTitle ?? 'panel'}`"
            class="viewer-toolbar-dock__panel-content-shell"
          >
            <div class="viewer-toolbar-dock__panel-header">
              <div class="viewer-toolbar-dock__panel-title">
                <AppIcon :name="utilityPanelIcon ?? 'settings'" :size="16" />
                <span>{{ utilityPanelTitle }}</span>
              </div>
            </div>

            <div class="viewer-toolbar-dock__utility-panel">
              <slot name="panel" />
            </div>
          </div>
          <div
            v-else-if="activePanelTool"
            :key="`menu:${activePanelTool.key}`"
            class="viewer-toolbar-dock__panel-content-shell"
          >
            <div class="viewer-toolbar-dock__panel-header">
              <div class="viewer-toolbar-dock__panel-title">
                <AppIcon :name="activePanelTool.icon" :size="16" />
                <span>{{ activePanelTool.label }}</span>
              </div>
            </div>

            <div class="viewer-toolbar-dock__tool-panel-body">
              <ViewerToolbarDockPanelContent
                :active-tab="activeTab"
                :is-playing="isPlaying"
                :is-playback-paused="isPlaybackPaused"
                :menu-icon-size="menuIconSize"
                :stack-tool-selections="stackToolSelections"
                :tool="activePanelTool"
                @apply-tool="(tool, behavior) => emit('applyTool', tool, behavior)"
                @end-playback="(behavior) => emit('endPlayback', behavior)"
                @pause-playback="(behavior) => emit('pausePlayback', behavior)"
                @select="emit('selectToolOption', activePanelTool, $event, { keepMenuOpen: true })"
                @open-settings="emit('openSettings', $event)"
              />
              <div
                v-if="shouldEmbedResultInActiveTool"
                class="viewer-toolbar-dock__embedded-result-panel"
                :key="`embedded-result:${resultPanelTitle ?? 'panel'}`"
              >
                <slot name="result" />
              </div>
            </div>
          </div>
          <div
            v-else
            :key="`empty:${activeDisplayTool?.key ?? activeTab.key}`"
            class="viewer-toolbar-dock__panel-content-shell viewer-toolbar-dock__panel-content-shell--empty"
            :class="{ 'viewer-toolbar-dock__panel-content-shell--empty-with-action': activeDisplayTool?.key === 'annotate' }"
          >
            <div class="viewer-toolbar-dock__active-tool-panel">
              <div class="viewer-toolbar-dock__active-tool-icon">
                <PseudocolorBand
                  v-if="activeDisplayTool?.key === 'pseudocolor'"
                  compact
                  :preset="activeDisplayTool.options?.find((item) => item.value === stackToolSelections[activeDisplayTool.key])?.swatchKey ?? activeDisplayTool.swatchKey ?? 'bw'"
                />
                <AppIcon
                  v-else
                  :name="activeDisplayTool?.icon ?? 'settings'"
                  :size="20"
                />
              </div>
              <div class="viewer-toolbar-dock__active-tool-copy">
                <div class="viewer-toolbar-dock__active-tool-label">{{ activePanelLabel }}</div>
                <div class="viewer-toolbar-dock__active-tool-description">{{ activePanelDescription }}</div>
              </div>
            </div>
            <button
              v-if="activeDisplayTool?.key === 'annotate'"
              type="button"
              class="viewer-toolbar-dock__active-tool-action viewer-toolbar-dock__active-tool-action--danger"
              @click="clearActiveAnnotations"
            >
              <span class="viewer-toolbar-dock__active-tool-action-icon">
                <AppIcon name="reset" :size="16" />
              </span>
              <span class="viewer-toolbar-dock__active-tool-action-copy">
                <span class="viewer-toolbar-dock__active-tool-action-label">{{ annotationActionCopy.clearAnnotations }}</span>
                <span class="viewer-toolbar-dock__active-tool-action-description">{{ annotationActionCopy.clearAnnotationsDesc }}</span>
              </span>
            </button>
          </div>
        </Transition>
      </div>

      <div class="viewer-toolbar-dock__footer">
        <button
          type="button"
          class="viewer-toolbar-dock__collapse-button"
          :title="isDockCollapsed ? dockExpandTitle : dockCollapseTitle"
          :aria-label="isDockCollapsed ? dockExpandTitle : dockCollapseTitle"
          @click="toggleDockCollapsed"
        >
          <AppIcon :name="isDockCollapsed ? 'chevron-left' : 'chevron-right'" :size="16" :stroke-width="2.3" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.viewer-toolbar-dock {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  width: var(--viewer-toolbar-dock-width, 224px);
  min-width: var(--viewer-toolbar-dock-width, 224px);
  max-width: var(--viewer-toolbar-dock-width, 224px);
  height: 100%;
  min-height: 0;
  align-self: stretch;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 88%, transparent);
  border-radius: 16px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card-soft) 60%, transparent), color-mix(in srgb, var(--theme-surface-panel-strong-solid) 82%, transparent));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 16px 34px rgba(0, 0, 0, 0.2);
  transition:
    width 150ms ease,
    min-width 150ms ease,
    max-width 150ms ease;
}

.viewer-toolbar-dock--collapsed {
  width: 58px;
  min-width: 58px;
  max-width: 58px;
}

.viewer-toolbar-dock__body {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.viewer-toolbar-dock__tools-region {
  display: flex;
  flex: 0 0 auto;
  min-height: 0;
  max-height: min(360px, 52vh);
  align-items: flex-start;
  gap: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  overflow: hidden;
  padding: 8px;
}

.viewer-toolbar-dock--collapsed .viewer-toolbar-dock__tools-region {
  flex: 1 1 auto;
  max-height: none;
  justify-content: center;
  border-bottom: 0;
  padding: 6px;
}

.viewer-toolbar-dock__tools {
  display: grid;
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
  grid-template-columns: repeat(auto-fit, minmax(36px, 1fr));
  justify-content: stretch;
  align-content: flex-start;
  gap: 5px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-color: color-mix(in srgb, var(--theme-border-strong) 72%, transparent) transparent;
  scrollbar-width: thin;
}

.viewer-toolbar-dock__tools::-webkit-scrollbar {
  width: 5px;
}

.viewer-toolbar-dock__tools::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
}

.viewer-toolbar-dock__tools::-webkit-scrollbar-track {
  background: transparent;
}

.viewer-toolbar-dock--collapsed .viewer-toolbar-dock__tools {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: center;
  overflow-y: auto;
}

.viewer-toolbar-dock__tool-group {
  display: grid;
  width: clamp(36px, 100%, 42px);
  justify-self: center;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px;
  border-radius: 12px;
}

.viewer-toolbar-dock__tool-group--compound {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 74%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 58%, transparent);
}

.viewer-toolbar-dock__button {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 86%, transparent);
  color: var(--theme-text-primary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease,
    opacity 150ms ease;
}

.viewer-toolbar-dock__button {
  display: grid;
  width: 100%;
  min-width: 34px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
}

@container (max-width: 220px) {
  .viewer-toolbar-dock__tools-region {
    max-height: min(480px, 64vh);
    padding: 5px;
  }

  .viewer-toolbar-dock__tools {
    grid-template-columns: repeat(auto-fit, minmax(30px, 1fr));
    gap: 4px;
  }

  .viewer-toolbar-dock__tool-group {
    width: clamp(30px, 100%, 36px);
    border-radius: 10px;
  }

  .viewer-toolbar-dock__button {
    min-width: 30px;
    height: 32px;
    border-radius: 10px;
  }
}

.viewer-toolbar-dock__button--options {
  border-width: 0;
  background: transparent;
}

.viewer-toolbar-dock__button:hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
}

.viewer-toolbar-dock__button:focus,
.viewer-toolbar-dock__collapse-button:focus {
  outline: none;
}

.viewer-toolbar-dock__button:focus-visible,
.viewer-toolbar-dock__collapse-button:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 54%, var(--theme-border-strong));
  outline: none;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 22%, transparent),
    0 0 0 2px color-mix(in srgb, var(--theme-accent) 22%, transparent);
}

.viewer-toolbar-dock__button--active,
.viewer-toolbar-dock__tool-group--active,
.viewer-toolbar-dock__button[aria-expanded="true"] {
  border-color: color-mix(in srgb, var(--theme-accent) 72%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 34%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

.viewer-toolbar-dock__button--accent {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong));
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 84%, white 10%), var(--theme-accent-strong));
  color: var(--theme-accent-contrast);
}

.viewer-toolbar-dock__button:disabled,
.viewer-toolbar-dock__collapse-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.viewer-toolbar-dock__panel {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 74%, transparent);
  overflow: hidden;
  padding: 8px;
  transition:
    flex 160ms ease,
    padding 160ms ease;
}

.viewer-toolbar-dock__panel--empty {
  flex: 0 0 auto;
}

.viewer-toolbar-dock__panel-content-shell {
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
}

.viewer-toolbar-dock__panel-content-shell--empty {
  flex: 0 0 auto;
  grid-template-rows: auto;
  align-content: start;
}

.viewer-toolbar-dock__panel-content-shell--empty-with-action {
  flex: 1 1 auto;
  grid-template-rows: auto minmax(0, 1fr);
}

.viewer-toolbar-dock-panel-enter-active,
.viewer-toolbar-dock-panel-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.viewer-toolbar-dock-panel-enter-from,
.viewer-toolbar-dock-panel-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.viewer-toolbar-dock-panel-enter-to,
.viewer-toolbar-dock-panel-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.viewer-toolbar-dock__panel-header {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.viewer-toolbar-dock__panel-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 800;
}

.viewer-toolbar-dock__panel-title span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock__utility-panel,
.viewer-toolbar-dock__result-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.viewer-toolbar-dock__tool-panel-body {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.viewer-toolbar-dock__tool-panel-body > .viewer-toolbar-dock-panel-content {
  flex: 0 0 auto;
  overflow: visible;
}

.viewer-toolbar-dock__tool-panel-body > .viewer-toolbar-dock-panel-content--with-actions {
  flex: 1 1 auto;
}

.viewer-toolbar-dock__tool-panel-body > .viewer-toolbar-dock-panel-content--fusionPetDisplay {
  flex: 1 1 auto;
  overflow: hidden;
}

.viewer-toolbar-dock__embedded-result-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card) 62%, transparent), color-mix(in srgb, var(--theme-surface-panel-solid) 72%, transparent));
  padding: 10px;
}

.viewer-toolbar-dock__status {
  flex: 0 0 auto;
  max-height: min(300px, 40vh);
  min-height: 0;
  overflow: auto;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  padding: 8px;
}

.viewer-toolbar-dock__active-tool-panel {
  display: flex;
  align-self: start;
  width: 100%;
  min-height: 66px;
  align-items: center;
  gap: 12px;
  border: 1px dashed color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 42%, transparent);
  padding: 10px 12px;
}

.viewer-toolbar-dock__active-tool-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 13px;
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock__active-tool-copy {
  min-width: 0;
}

.viewer-toolbar-dock__active-tool-label {
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock__active-tool-description {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.35;
}

.viewer-toolbar-dock__active-tool-action {
  display: grid;
  align-self: end;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 58%, transparent);
  padding: 10px 12px;
  color: var(--theme-text-primary);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.viewer-toolbar-dock__active-tool-action:hover,
.viewer-toolbar-dock__active-tool-action:focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  outline: none;
}

.viewer-toolbar-dock__active-tool-action--danger {
  border-color: color-mix(in srgb, var(--theme-status-danger) 30%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-status-danger) 8%, var(--theme-surface-card));
}

.viewer-toolbar-dock__active-tool-action--danger:hover,
.viewer-toolbar-dock__active-tool-action--danger:focus-visible {
  border-color: color-mix(in srgb, var(--theme-status-danger) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-status-danger) 13%, var(--theme-surface-card));
}

.viewer-toolbar-dock__active-tool-action-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-status-danger) 32%, var(--theme-border-soft));
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-status-danger) 10%, transparent);
  color: var(--theme-status-danger-text);
}

.viewer-toolbar-dock__active-tool-action-copy {
  min-width: 0;
}

.viewer-toolbar-dock__active-tool-action-label,
.viewer-toolbar-dock__active-tool-action-description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock__active-tool-action-label {
  font-size: 13px;
  font-weight: 850;
}

.viewer-toolbar-dock__active-tool-action-description {
  margin-top: 2px;
  color: var(--theme-text-muted);
  font-size: 11px;
}

.viewer-toolbar-dock__footer {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  margin-top: auto;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  padding: 7px 8px;
}

.viewer-toolbar-dock--collapsed .viewer-toolbar-dock__footer {
  justify-content: center;
  padding: 7px 6px;
}

.viewer-toolbar-dock__collapse-button {
  display: inline-flex;
  width: 38px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--theme-surface-card) 86%, transparent);
  color: var(--theme-text-secondary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.viewer-toolbar-dock__collapse-button:hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
}
</style>
