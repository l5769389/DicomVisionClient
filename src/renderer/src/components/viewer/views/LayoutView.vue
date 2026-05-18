<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { ViewerLayoutSlot, ViewerTabItem } from '../../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
}>()

const template = computed(() => props.activeTab.layoutTemplate ?? null)
const rows = computed(() => Math.max(1, template.value?.rows ?? 1))
const columns = computed(() => Math.max(1, template.value?.columns ?? 1))
const slots = computed<ViewerLayoutSlot[]>(() => {
  const layoutSlots = props.activeTab.layoutSlots ?? template.value?.slots ?? []
  return layoutSlots.length
    ? layoutSlots
    : [
        {
          id: 'slot-1-1',
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          viewType: 'Stack'
        }
      ]
})

function getSlotStyle(slot: ViewerLayoutSlot): Record<string, string> {
  return {
    gridColumn: `${slot.column + 1} / span ${Math.max(1, slot.columnSpan)}`,
    gridRow: `${slot.row + 1} / span ${Math.max(1, slot.rowSpan)}`
  }
}

function getSlotBadge(slot: ViewerLayoutSlot): string {
  if (slot.sourceViewType === 'CompareStack') {
    return slot.viewportKey === 'compare-b' ? 'B' : 'A'
  }
  return slot.viewType ?? 'Slot'
}
</script>

<template>
  <div class="layout-view grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 text-[var(--theme-text-primary)]">
    <header class="layout-view__header">
      <div class="flex min-w-0 items-center gap-3">
        <span class="layout-view__icon" aria-hidden="true">
          <AppIcon name="layout" :size="18" />
        </span>
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold">{{ activeTab.title }}</div>
          <div class="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">
            {{ rows }} x {{ columns }} Layout
          </div>
        </div>
      </div>
      <span class="layout-view__count">{{ slots.length }} Slots</span>
    </header>

    <div
      class="layout-view__grid"
      :style="{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
      }"
    >
      <section
        v-for="(slot, index) in slots"
        :key="slot.id"
        class="layout-view__slot"
        :class="{ 'layout-view__slot--filled': Boolean(slot.imageSrc) }"
        :style="getSlotStyle(slot)"
      >
        <template v-if="slot.imageSrc">
          <img class="layout-view__image" :src="slot.imageSrc" :alt="slot.seriesTitle ?? `Slot ${index + 1}`" draggable="false" />
          <div class="layout-view__slot-overlay layout-view__slot-overlay--top">
            <span class="layout-view__slot-pill">{{ getSlotBadge(slot) }}</span>
            <span class="layout-view__slot-series">{{ slot.seriesTitle ?? `Slot ${index + 1}` }}</span>
          </div>
          <div v-if="slot.sliceLabel || slot.windowLabel" class="layout-view__slot-overlay layout-view__slot-overlay--bottom">
            <span v-if="slot.sliceLabel">{{ slot.sliceLabel }}</span>
            <span v-if="slot.windowLabel">{{ slot.windowLabel }}</span>
          </div>
        </template>
        <template v-else>
          <div class="layout-view__slot-badge">{{ index + 1 }}</div>
          <div class="layout-view__slot-title">Slot {{ index + 1 }}</div>
          <div class="layout-view__slot-subtitle">Ready</div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.layout-view__header {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: color-mix(in srgb, var(--theme-surface-card) 76%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.layout-view__icon {
  display: inline-grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, var(--theme-border-soft));
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  color: var(--theme-accent);
}

.layout-view__count {
  flex: 0 0 auto;
  border: 1px solid var(--theme-border-soft);
  border-radius: 999px;
  padding: 6px 10px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.layout-view__grid {
  display: grid;
  min-height: 0;
  gap: 8px;
}

.layout-view__slot {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  place-items: center;
  align-content: center;
  gap: 5px;
  padding: 8px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 84%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 82%, transparent);
  color: var(--theme-text-secondary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.layout-view__slot:not(.layout-view__slot--filled)::before {
  position: absolute;
  inset: 0;
  border: 1px dashed color-mix(in srgb, var(--theme-accent) 18%, transparent);
  border-radius: inherit;
  content: "";
  pointer-events: none;
}

.layout-view__slot--filled {
  place-items: stretch;
  align-content: stretch;
  background: #000;
}

.layout-view__image {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  object-fit: contain;
  user-select: none;
}

.layout-view__slot-overlay {
  position: absolute;
  left: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  color: var(--theme-text-primary);
  pointer-events: none;
}

.layout-view__slot-overlay--top {
  top: 10px;
}

.layout-view__slot-overlay--bottom {
  bottom: 10px;
  justify-content: space-between;
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 700;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
}

.layout-view__slot-pill {
  display: inline-flex;
  min-width: 30px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 38%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong) 82%, transparent);
  color: var(--theme-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  backdrop-filter: blur(10px);
}

.layout-view__slot-series {
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.78);
  white-space: nowrap;
}

.layout-view__slot-badge {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-soft));
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  color: var(--theme-accent);
  font-size: 13px;
  font-weight: 800;
}

.layout-view__slot-title {
  color: var(--theme-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.layout-view__slot-subtitle {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
</style>
