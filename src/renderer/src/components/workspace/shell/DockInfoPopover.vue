<script lang="ts">
import { ref as createSharedRef } from 'vue'

let nextDockInfoPopoverId = 0
const activeDockInfoPopoverId = createSharedRef<string | null>(null)
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const props = withDefaults(defineProps<{
  text: string
  label?: string
  location?: 'left center' | 'right center' | 'top center' | 'bottom center'
}>(), {
  label: '',
  location: 'left center'
})

const popoverId = `dock-info-popover-${++nextDockInfoPopoverId}`
const triggerRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})
const { locale } = useUiLocale()
const isOpen = computed(() => activeDockInfoPopoverId.value === popoverId)
const accessibleLabel = computed(() => props.label || (locale.value === 'zh-CN' ? '查看说明' : 'View help'))

function close(): void {
  if (isOpen.value) {
    activeDockInfoPopoverId.value = null
  }
}

function toggle(): void {
  activeDockInfoPopoverId.value = isOpen.value ? null : popoverId
}

function updatePosition(): void {
  const trigger = triggerRef.value
  const popover = popoverRef.value
  if (!trigger || !popover) {
    return
  }
  const gap = 8
  const viewportPadding = 12
  const triggerRect = trigger.getBoundingClientRect()
  const popoverRect = popover.getBoundingClientRect()
  const preferRight = props.location === 'right center'
  const leftCandidate = triggerRect.left - popoverRect.width - gap
  const rightCandidate = triggerRect.right + gap
  const canUsePreferredRight = rightCandidate + popoverRect.width <= window.innerWidth - viewportPadding
  const canUseLeft = leftCandidate >= viewportPadding
  const left = preferRight
    ? (canUsePreferredRight ? rightCandidate : Math.max(viewportPadding, leftCandidate))
    : (canUseLeft ? leftCandidate : Math.min(window.innerWidth - popoverRect.width - viewportPadding, rightCandidate))
  const top = Math.max(
    viewportPadding,
    Math.min(window.innerHeight - popoverRect.height - viewportPadding, triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2)
  )
  popoverStyle.value = { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` }
}

function handleDocumentPointerDown(event: PointerEvent): void {
  const target = event.target as Node | null
  if (!target || triggerRef.value?.contains(target) || popoverRef.value?.contains(target)) {
    return
  }
  close()
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
    triggerRef.value?.focus()
  }
}

function addGlobalListeners(): void {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', updatePosition)
}

function removeGlobalListeners(): void {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', updatePosition)
}

watch(isOpen, async (value) => {
  removeGlobalListeners()
  if (value) {
    await nextTick()
    updatePosition()
    addGlobalListeners()
  }
})

watch(() => props.text, (value) => {
  if (!value) {
    close()
  }
})

onBeforeUnmount(() => {
  removeGlobalListeners()
  close()
})
</script>

<template>
  <span
    v-if="text"
    ref="triggerRef"
    class="dock-info-popover__trigger"
    role="button"
    tabindex="0"
    :aria-controls="popoverId"
    :aria-expanded="isOpen"
    :aria-label="accessibleLabel"
    :title="accessibleLabel"
    @click.stop="toggle"
    @keydown.enter.stop.prevent="toggle"
    @keydown.space.stop.prevent="toggle"
  >
    <AppIcon name="explanation" :size="15" />
  </span>
  <Teleport to="body">
    <div
      v-if="isOpen"
      :id="popoverId"
      ref="popoverRef"
      class="dock-info-popover__card"
      role="note"
      :style="popoverStyle"
    >
      {{ text }}
    </div>
  </Teleport>
</template>

<style scoped>
.dock-info-popover__trigger {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  align-self: center;
  align-items: center;
  justify-content: center;
  margin-inline-start: 4px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--theme-text-muted);
  line-height: 0;
  vertical-align: middle;
  transition: background 140ms ease, color 140ms ease;
}

.dock-info-popover__trigger :deep(.app-icon-svg) {
  display: block;
  flex: 0 0 auto;
}

.dock-info-popover__trigger:hover,
.dock-info-popover__trigger:focus-visible,
.dock-info-popover__trigger[aria-expanded="true"] {
  background: color-mix(in srgb, var(--theme-accent) 13%, transparent);
  color: var(--theme-text-primary);
  outline: none;
}

.dock-info-popover__card {
  position: fixed;
  z-index: 2600;
  width: min(280px, calc(100vw - 28px));
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 82%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 96%, black 4%);
  padding: 11px 13px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-line;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
}
</style>
