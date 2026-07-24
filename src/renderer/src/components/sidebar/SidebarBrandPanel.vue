<script setup lang="ts">
import AppIcon from '../AppIcon.vue'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import brandMarkUrl from '../../assets/brand/dicomvision-mark.png'

defineProps<{
  compact?: boolean
  viewerPlatform: 'desktop' | 'web'
}>()

const GITHUB_REPOSITORY_URL = 'https://github.com/l5769389/DicomVisionClient'
const { t } = useUiLocale()
</script>

<template>
  <div
    class="sidebar-brand-card relative overflow-hidden border"
    :class="{ 'sidebar-brand-card--compact': compact }"
  >
    <div class="sidebar-brand-card__shine pointer-events-none absolute inset-x-0 top-0 h-px"></div>

    <div class="sidebar-brand-content relative z-[1] flex min-w-0 items-center gap-3">
      <div class="sidebar-brand-mark shrink-0" aria-hidden="true">
        <img class="sidebar-brand-mark__image" :src="brandMarkUrl" alt="" />
      </div>

      <div v-if="!compact" class="min-w-0 flex-1">
        <div class="sidebar-brand-title min-w-0 truncate">DICOM Vision</div>
        <div class="sidebar-brand-subtitle mt-1 truncate">{{ t('diagnosticWorkspace') }}</div>
      </div>

      <a
        v-if="!compact"
        class="sidebar-brand-github shrink-0"
        :href="GITHUB_REPOSITORY_URL"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        title="GitHub"
      >
        <AppIcon name="github" :size="18" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.sidebar-brand-card {
  min-height: 68px;
  padding: 9px 10px;
  border-radius: 10px;
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-panel);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 10px 20px color-mix(in srgb, black 14%, transparent);
}

.sidebar-brand-card--compact {
  display: flex;
  width: 52px;
  justify-content: center;
  border-radius: 10px;
  padding: 3px;
}

.sidebar-brand-card--compact .sidebar-brand-content {
  justify-content: center;
  gap: 0;
}

.sidebar-brand-card--compact .sidebar-brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 9px;
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
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 10px;
  overflow: hidden;
}

.sidebar-brand-mark__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sidebar-brand-title {
  color: var(--theme-text-primary);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.05;
}

.sidebar-brand-github {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-color: color-mix(in srgb, var(--theme-accent) 28%, transparent);
  border-width: 1px;
  border-style: solid;
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 9%, var(--theme-surface-card-soft));
  color: color-mix(in srgb, var(--theme-text-primary) 82%, var(--theme-accent) 18%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  text-decoration: none;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    box-shadow 140ms ease,
    color 140ms ease;
}

.sidebar-brand-github:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 48%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-card-soft));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 8px 18px color-mix(in srgb, var(--theme-accent) 14%, transparent);
  color: var(--theme-text-primary);
}

.sidebar-brand-subtitle {
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.25;
}
</style>
