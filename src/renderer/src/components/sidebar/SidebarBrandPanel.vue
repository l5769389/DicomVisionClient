<script setup lang="ts">
import { useUiLocale } from '../../composables/ui/useUiLocale'

defineProps<{
  compact?: boolean
  viewerPlatform: 'desktop' | 'web'
}>()

const { t } = useUiLocale()
</script>

<template>
  <div
    class="sidebar-brand-card relative overflow-hidden rounded-2xl border p-3"
    :class="{ 'sidebar-brand-card--compact': compact }"
  >
    <div class="sidebar-brand-card__shine pointer-events-none absolute inset-x-0 top-0 h-px"></div>

    <div class="sidebar-brand-content relative z-[1] flex min-w-0 items-center gap-3">
      <div class="sidebar-brand-mark shrink-0" aria-hidden="true">
        <span class="sidebar-brand-mark__frame"></span>
        <span class="sidebar-brand-mark__slice sidebar-brand-mark__slice--top"></span>
        <span class="sidebar-brand-mark__slice sidebar-brand-mark__slice--bottom"></span>
        <span class="sidebar-brand-mark__letters">DV</span>
      </div>

      <div v-if="!compact" class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <div class="sidebar-brand-title min-w-0 truncate">DICOM Vision</div>
          <div class="sidebar-brand-platform shrink-0 rounded-full border">
            {{ viewerPlatform === 'web' ? 'WEB' : 'DESKTOP' }}
          </div>
        </div>
        <div class="sidebar-brand-subtitle mt-1 truncate">{{ t('diagnosticWorkspace') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-brand-card {
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-panel);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 10px 20px color-mix(in srgb, black 14%, transparent);
}

.sidebar-brand-card--compact {
  display: flex;
  width: 62px;
  justify-content: center;
  border-radius: 20px;
  padding: 4px;
}

.sidebar-brand-card--compact .sidebar-brand-content {
  justify-content: center;
  gap: 0;
}

.sidebar-brand-card__shine {
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--theme-accent) 34%, transparent),
    transparent
  );
}

:global(:root[data-theme="clinical-light"]) .sidebar-brand-card {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 10px 22px color-mix(in srgb, var(--theme-accent-strong) 10%, transparent);
}

.sidebar-brand-mark {
  position: relative;
  display: grid;
  overflow: hidden;
  width: 52px;
  height: 52px;
  place-items: center;
  border-color: color-mix(in srgb, var(--theme-accent) 34%, var(--theme-border-soft));
  border-width: 1px;
  border-style: solid;
  border-radius: 16px 11px 16px 11px;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-panel-strong)),
      color-mix(in srgb, var(--theme-accent-strong) 8%, var(--theme-surface-card-soft))
    );
  color: color-mix(in srgb, var(--theme-accent) 86%, var(--theme-text-primary));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 12%, transparent),
    inset 0 -10px 18px color-mix(in srgb, black 16%, transparent);
}

.sidebar-brand-mark::before,
.sidebar-brand-mark::after {
  position: absolute;
  content: '';
  pointer-events: none;
}

.sidebar-brand-mark::before {
  inset: 8px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 26%, transparent);
  border-radius: 10px 7px 10px 7px;
  opacity: 0.7;
}

.sidebar-brand-mark::after {
  width: 30px;
  height: 30px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 18%, transparent);
  border-radius: 50%;
  opacity: 0.22;
}

.sidebar-brand-mark__frame {
  position: absolute;
  inset: 4px;
  border-radius: 13px 8px 13px 8px;
  background:
    linear-gradient(currentColor, currentColor) left 8px top 8px / 11px 1.5px no-repeat,
    linear-gradient(currentColor, currentColor) left 8px top 8px / 1.5px 11px no-repeat,
    linear-gradient(currentColor, currentColor) right 8px top 8px / 11px 1.5px no-repeat,
    linear-gradient(currentColor, currentColor) right 8px top 8px / 1.5px 11px no-repeat,
    linear-gradient(currentColor, currentColor) left 8px bottom 8px / 11px 1.5px no-repeat,
    linear-gradient(currentColor, currentColor) left 8px bottom 8px / 1.5px 11px no-repeat,
    linear-gradient(currentColor, currentColor) right 8px bottom 8px / 11px 1.5px no-repeat,
    linear-gradient(currentColor, currentColor) right 8px bottom 8px / 1.5px 11px no-repeat;
  opacity: 0.54;
}

.sidebar-brand-mark__slice {
  position: absolute;
  left: 12px;
  right: 12px;
  height: 1px;
  background: color-mix(in srgb, var(--theme-text-primary) 26%, transparent);
}

.sidebar-brand-mark__slice--top {
  top: 20px;
}

.sidebar-brand-mark__slice--bottom {
  bottom: 20px;
}

.sidebar-brand-mark__letters {
  position: relative;
  z-index: 1;
  display: grid;
  width: 30px;
  height: 22px;
  place-items: center;
  border-radius: 7px 4px 7px 4px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 58%, transparent);
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: 1;
  text-shadow: 0 1px 8px color-mix(in srgb, black 26%, transparent);
}

:global(:root[data-theme="clinical-light"]) .sidebar-brand-mark {
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--theme-accent) 18%, white),
      color-mix(in srgb, var(--theme-accent-strong) 8%, var(--theme-surface-card-soft))
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 16px color-mix(in srgb, var(--theme-accent-strong) 10%, transparent);
}

:global(:root[data-theme="clinical-light"]) .sidebar-brand-mark__letters {
  background: color-mix(in srgb, white 62%, transparent);
}

:global(:root[data-theme="industrial-utility"]) .sidebar-brand-mark {
  border-radius: 10px 4px 10px 4px;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--theme-accent) 14%, #151d24),
      color-mix(in srgb, var(--theme-accent-warm) 7%, #0d1318)
    );
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.035),
    inset 0 -10px 18px rgba(0, 0, 0, 0.18);
}

:global(:root[data-theme="industrial-utility"]) .sidebar-brand-mark::before,
:global(:root[data-theme="industrial-utility"]) .sidebar-brand-mark__frame {
  border-radius: 6px 2px 6px 2px;
}

.sidebar-brand-title {
  color: var(--theme-text-primary);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.05;
}

.sidebar-brand-platform {
  border-color: color-mix(in srgb, var(--theme-accent) 22%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card-soft));
  color: color-mix(in srgb, var(--theme-text-secondary) 86%, var(--theme-accent) 14%);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1;
  padding: 5px 8px 4px;
}

.sidebar-brand-subtitle {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.25;
}
</style>
