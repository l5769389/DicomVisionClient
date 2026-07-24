<script setup lang="ts">
import AppIcon from '../../AppIcon.vue'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const props = withDefaults(defineProps<{
  hasContent?: boolean
  icon: string
  title: string
  width?: number
  collapsed?: boolean
  resizing?: boolean
}>(), {
  hasContent: true,
  width: 344,
  collapsed: false,
  resizing: false
})

const emit = defineEmits<{
  close: []
  collapseChange: [collapsed: boolean]
}>()

const { overlayCopy, toolbarCopy } = useUiLocale()
</script>

<template>
  <aside
    class="viewer-result-dock"
    :class="{
      'viewer-result-dock--collapsed': collapsed,
      'viewer-result-dock--resizing': resizing,
      'viewer-result-dock--empty': !hasContent
    }"
    :style="{ '--viewer-result-dock-width': `${width}px` }"
    data-viewer-result-dock
  >
    <header v-if="!collapsed && hasContent" class="viewer-result-dock__header">
      <div class="viewer-result-dock__title">
        <AppIcon :name="icon" :size="18" />
        <span>{{ title }}</span>
      </div>
      <button
        type="button"
        class="viewer-result-dock__close"
        :aria-label="overlayCopy.close"
        :title="overlayCopy.close"
        @click="emit('close')"
      >
        <AppIcon name="close" :size="17" />
      </button>
    </header>

    <div v-if="!collapsed" class="viewer-result-dock__content">
      <slot v-if="hasContent" />
      <div v-else class="viewer-result-dock__empty-state" aria-hidden="true" />
    </div>

    <footer v-if="collapsed" class="viewer-result-dock__footer">
      <button
        type="button"
        class="viewer-result-dock__collapse-button"
        :aria-label="toolbarCopy.dockExpand"
        :title="toolbarCopy.dockExpand"
        @click="emit('collapseChange', false)"
      >
        <AppIcon name="chevron-left" :size="17" />
      </button>
    </footer>

  </aside>
</template>

<style scoped>
.viewer-result-dock {
  display: flex;
  width: var(--viewer-result-dock-width, 344px);
  min-width: var(--viewer-result-dock-width, 344px);
  max-width: var(--viewer-result-dock-width, 344px);
  min-height: 0;
  flex-direction: column;
  align-self: stretch;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card-soft) 62%, transparent), color-mix(in srgb, var(--theme-surface-panel-strong-solid) 84%, transparent));
  box-shadow: none;
}

.viewer-result-dock--collapsed {
  width: 58px;
  min-width: 58px;
  max-width: 58px;
}

.viewer-result-dock--collapsed.viewer-result-dock--resizing {
  width: var(--viewer-result-dock-width, 58px);
  min-width: var(--viewer-result-dock-width, 58px);
  max-width: var(--viewer-result-dock-width, 58px);
}

.viewer-result-dock__header {
  display: flex;
  flex: 0 0 auto;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  padding: 8px 10px 8px 12px;
}

.viewer-result-dock__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 850;
}

.viewer-result-dock__title span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-result-dock__close {
  display: grid;
  width: 34px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-secondary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.viewer-result-dock__close:hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
}

.viewer-result-dock__content {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
  padding: 10px;
}

.viewer-result-dock__empty-state {
  min-height: 100%;
  flex: 1 1 auto;
  border: 1px dashed color-mix(in srgb, var(--theme-border-soft) 62%, transparent);
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-card) 46%, transparent), color-mix(in srgb, var(--theme-surface-panel-solid) 42%, transparent));
}

.viewer-result-dock__footer {
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
  margin-top: auto;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  padding: 7px 6px;
}

.viewer-result-dock__collapse-button {
  display: inline-flex;
  width: 38px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--theme-surface-card) 86%, transparent);
  color: var(--theme-text-secondary);
}

.viewer-result-dock__collapse-button:hover,
.viewer-result-dock__collapse-button:focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
  outline: none;
}

</style>
